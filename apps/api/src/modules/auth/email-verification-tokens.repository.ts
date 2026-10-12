import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../platform/database/prisma.service';
import type { IdGeneratorPort } from '../../platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../platform/ids/ids.module';

export type VerificationPurpose = 'VERIFY_SIGNUP' | 'CHANGE_EMAIL';

export type ActiveTokenInput = Readonly<{
  userId: string;
  purpose: VerificationPurpose;
  targetEmail: string;
  tokenHash: Buffer;
  expiresAt: Date;
  now: Date;
}>;

export type StoredVerificationToken = Readonly<{
  id: string;
  userId: string;
  purpose: VerificationPurpose;
  targetEmail: string;
  expiresAt: Date;
  consumedAt: Date | null;
}>;

export interface VerificationTokenStore {
  replaceActive(input: ActiveTokenInput): Promise<void>;
}

export interface ConsumableTokenStore {
  findByHash(tokenHash: Buffer): Promise<StoredVerificationToken | null>;
  /** `true` si et seulement si cet appel a consommé le jeton (encore actif et non expiré à `now`). */
  consume(id: string, now: Date): Promise<boolean>;
}

const STORED_TOKEN = {
  id: true,
  userId: true,
  purpose: true,
  targetEmail: true,
  expiresAt: true,
  consumedAt: true,
} as const;

/** Jetons de `email_verification_tokens` : seule l'empreinte SHA-256 est stockée (SECURITY.md §3.4). */
@Injectable()
export class EmailVerificationTokensRepository implements VerificationTokenStore, ConsumableTokenStore {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  /**
   * Un seul jeton actif par compte et par usage (index `ux_email_verification_tokens__active`) :
   * l'émission d'un nouveau jeton consomme le précédent, dans la même transaction.
   */
  async replaceActive(input: ActiveTokenInput): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: input.userId, purpose: input.purpose, consumedAt: null },
        data: { consumedAt: input.now },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          id: this.ids.next(),
          userId: input.userId,
          purpose: input.purpose,
          targetEmail: input.targetEmail,
          tokenHash: new Uint8Array(input.tokenHash),
          expiresAt: input.expiresAt,
          createdAt: input.now,
        },
      }),
    ]);
  }

  findByHash(tokenHash: Buffer): Promise<StoredVerificationToken | null> {
    return this.prisma.emailVerificationToken.findFirst({
      where: { tokenHash: new Uint8Array(tokenHash) },
      select: STORED_TOKEN,
    });
  }

  /** Mise à jour conditionnelle : deux requêtes simultanées ne peuvent pas consommer le même jeton. */
  async consume(id: string, now: Date): Promise<boolean> {
    const { count } = await this.prisma.emailVerificationToken.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    return count === 1;
  }
}
