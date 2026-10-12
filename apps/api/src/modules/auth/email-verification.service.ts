import { Inject, Injectable } from '@nestjs/common';

import { generateOpaqueToken } from '../../platform/auth/session-token';
import { CLOCK, type ClockPort } from '../../platform/time/clock.port';
import type { AccountSummary } from '../users';

import { AccountMailer } from './account-mailer.service';
import {
  EmailVerificationTokensRepository,
  type VerificationTokenStore,
} from './email-verification-tokens.repository';

/** SECURITY.md §3.4 : 24 heures, usage unique, invalidé par l'émission d'un nouveau jeton. */
export const EMAIL_VERIFICATION_TTL_HOURS = 24;
const HOUR_MS = 3_600_000;

/** Émission du jeton de vérification d'adresse et e-mails associés ; la consommation est dans `EmailConfirmationService`. */
@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(EmailVerificationTokensRepository) private readonly tokens: VerificationTokenStore,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly mailer: AccountMailer,
  ) {}

  /** Remplace le jeton actif du compte et envoie le lien ; seule l'empreinte SHA-256 est stockée. */
  async issue(account: AccountSummary): Promise<void> {
    const now = this.clock.now();
    const { token, hash } = generateOpaqueToken();
    await this.tokens.replaceActive({
      userId: account.id,
      purpose: 'VERIFY_SIGNUP',
      targetEmail: account.email,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_HOURS * HOUR_MS),
      now,
    });
    await this.mailer.sendVerification(account.email, token, EMAIL_VERIFICATION_TTL_HOURS);
  }

  /** Adresse déjà inscrite : on prévient son titulaire, sans rien modifier (SECURITY.md §3.4, point 2). */
  notifyRegistrationAttempt(email: string): Promise<void> {
    return this.mailer.sendRegistrationAttempt(email);
  }
}
