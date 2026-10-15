import { Inject, Injectable } from '@nestjs/common';

import { isUniqueViolation } from '../../platform/database/prisma-error.mapper';
import { PrismaService } from '../../platform/database/prisma.service';
import type { IdGeneratorPort } from '../../platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../platform/ids/ids.module';

export type NewResetToken = Readonly<{
  userId: string;
  tokenHash: Buffer;
  expiresAt: Date;
  /** IP tronquée du demandeur (minimisation). */
  requestedIp: string | null;
  now: Date;
}>;

export type StoredResetToken = Readonly<{
  id: string;
  userId: string;
  expiresAt: Date;
  consumedAt: Date | null;
}>;

export interface ResetTokenStore {
  replaceActive(input: NewResetToken): Promise<boolean>;
  findByHash(tokenHash: Buffer): Promise<StoredResetToken | null>;
  /** `true` si et seulement si cet appel a consommé le jeton (encore actif et non expiré). */
  consume(id: string, now: Date): Promise<boolean>;
  invalidateAll(userId: string, now: Date): Promise<void>;
}

/** Table `password_reset_tokens` (SECURITY.md §3.5) : un seul jeton actif par compte, empreinte SHA-256. */
@Injectable()
export class PasswordResetTokensRepository implements ResetTokenStore {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  /** `false` si une demande concurrente a créé le jeton actif d'abord (index unique partiel) : rien n'est envoyé. */
  async replaceActive(input: NewResetToken): Promise<boolean> {
    try {
      await this.prisma.$transaction([
        this.prisma.passwordResetToken.updateMany({
          where: { userId: input.userId, consumedAt: null },
          data: { consumedAt: input.now },
        }),
        this.prisma.passwordResetToken.create({
          data: {
            id: this.ids.next(),
            userId: input.userId,
            tokenHash: new Uint8Array(input.tokenHash),
            expiresAt: input.expiresAt,
            requestedIp: input.requestedIp,
            createdAt: input.now,
          },
        }),
      ]);
      return true;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  findByHash(tokenHash: Buffer): Promise<StoredResetToken | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: new Uint8Array(tokenHash) },
      select: { id: true, userId: true, expiresAt: true, consumedAt: true },
    });
  }

  async consume(id: string, now: Date): Promise<boolean> {
    const { count } = await this.prisma.passwordResetToken.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    return count === 1;
  }

  async invalidateAll(userId: string, now: Date): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: now },
    });
  }
}
