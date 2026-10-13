import { Inject, Injectable } from '@nestjs/common';
import type { SessionRevokeReason } from '@prisma/client';

import { PrismaService } from '../../platform/database/prisma.service';
import type { IdGeneratorPort } from '../../platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../platform/ids/ids.module';

export type { SessionRevokeReason } from '@prisma/client';

export type NewSessionInput = Readonly<{
  userId: string;
  tokenHash: Buffer;
  createdAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  /** Préfixe /24 ou /48, jamais l'IP complète. */
  ip: string | null;
  userAgentLabel: string | null;
  /** Empreinte du jeton que présentait le navigateur : révoquée dans la même transaction (anti-fixation). */
  replacedTokenHash: Buffer | null;
  maxActive: number;
  /** Les sessions du compte expirées ou révoquées avant cet instant sont supprimées. */
  purgeBefore: Date;
}>;

export type StoredSession = Readonly<{
  id: string;
  userId: string;
  revokedAt: Date | null;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  userStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION';
  userRole: 'USER' | 'ADMIN';
}>;

export interface SessionStore {
  /** Renvoie l'identifiant de la session créée. */
  create(input: NewSessionInput): Promise<string>;
  findByTokenHash(tokenHash: Buffer): Promise<StoredSession | null>;
  touch(id: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void>;
  revoke(id: string, reason: SessionRevokeReason, at: Date): Promise<void>;
}

/** Table `sessions` (SECURITY.md §3.2) : seule l'empreinte SHA-256 du jeton est stockée. */
@Injectable()
export class SessionsRepository implements SessionStore {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  /** Révocation du jeton remplacé, purge, création et plafond de sessions actives : une seule transaction. */
  async create(input: NewSessionInput): Promise<string> {
    const id = this.ids.next();
    const now = input.createdAt;
    await this.prisma.$transaction(async (tx) => {
      if (input.replacedTokenHash !== null) {
        await tx.session.updateMany({
          where: { tokenHash: new Uint8Array(input.replacedTokenHash), revokedAt: null },
          data: { revokedAt: now, revokeReason: 'LOGOUT' },
        });
      }
      await tx.session.deleteMany({
        where: {
          userId: input.userId,
          OR: [{ absoluteExpiresAt: { lt: input.purgeBefore } }, { revokedAt: { lt: input.purgeBefore } }],
        },
      });
      await tx.session.create({
        data: {
          id,
          userId: input.userId,
          tokenHash: new Uint8Array(input.tokenHash),
          createdAt: now,
          lastSeenAt: now,
          idleExpiresAt: input.idleExpiresAt,
          absoluteExpiresAt: input.absoluteExpiresAt,
          ip: input.ip,
          userAgentLabel: input.userAgentLabel,
        },
      });
      const surplus = await tx.session.findMany({
        where: {
          userId: input.userId,
          revokedAt: null,
          idleExpiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: input.maxActive,
        select: { id: true },
      });
      if (surplus.length > 0) {
        await tx.session.updateMany({
          where: { id: { in: surplus.map((session) => session.id) } },
          data: { revokedAt: now, revokeReason: 'LIMIT' },
        });
      }
    });
    return id;
  }

  async findByTokenHash(tokenHash: Buffer): Promise<StoredSession | null> {
    const row = await this.prisma.session.findFirst({
      where: { tokenHash: new Uint8Array(tokenHash) },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        lastSeenAt: true,
        idleExpiresAt: true,
        absoluteExpiresAt: true,
        user: { select: { status: true, role: true } },
      },
    });
    if (row === null) return null;
    const { user, ...session } = row;
    return { ...session, userStatus: user.status, userRole: user.role };
  }

  async touch(id: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { lastSeenAt, idleExpiresAt },
    });
  }

  async revoke(id: string, reason: SessionRevokeReason, at: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at, revokeReason: reason },
    });
  }
}
