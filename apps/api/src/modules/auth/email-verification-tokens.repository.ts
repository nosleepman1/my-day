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

export interface VerificationTokenStore {
  replaceActive(input: ActiveTokenInput): Promise<void>;
}

/** Jetons de `email_verification_tokens` : seule l'empreinte SHA-256 est stockée (SECURITY.md §3.4). */
@Injectable()
export class EmailVerificationTokensRepository implements VerificationTokenStore {
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
}
