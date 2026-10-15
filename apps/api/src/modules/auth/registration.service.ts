import { Inject, Injectable } from '@nestjs/common';

import type { RegisterRequest, ResendVerificationRequest } from '@orbit/contracts';

import { PASSWORD_HASHER, type PasswordHasherPort } from '../../platform/auth/password-hasher.port';
import { enforceMinimumDuration } from '../../platform/time/minimum-duration';
import { type AccountDirectory, UsersService } from '../users';

import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import { defaultDisplayName, isRegistrationAllowed, normalizeEmail } from './domain/registration';
import { EmailVerificationService } from './email-verification.service';
import { assertPasswordPolicy } from './password-changer.service';

/**
 * Inscription et renvoi du lien de vérification (PHASE-01 T4). Les deux routes répondent `202` à
 * l'identique, que le compte existe ou non, et durent au moins `uniformResponseMs` (SECURITY.md §3.8).
 */
@Injectable()
export class RegistrationService {
  constructor(
    @Inject(UsersService) private readonly accounts: AccountDirectory,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    private readonly verification: EmailVerificationService,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  /** @throws {DomainError} VALIDATION_FAILED (politique de mot de passe) ou SERVICE_UNAVAILABLE (e-mail). */
  async register(input: RegisterRequest): Promise<void> {
    const email = normalizeEmail(input.email);
    assertPasswordPolicy(input.password, email, 'password');
    await enforceMinimumDuration(() => this.registerAllowed(email, input), this.settings.uniformResponseMs);
  }

  /** Aucun effet pour une adresse inconnue, déjà vérifiée ou un compte non actif ; réponse identique. */
  async resendVerification(input: ResendVerificationRequest): Promise<void> {
    const email = normalizeEmail(input.email);
    await enforceMinimumDuration(async () => {
      const account = await this.accounts.findAccountByEmail(email);
      if (account?.status !== 'ACTIVE' || account.emailVerifiedAt !== null) return;
      await this.verification.issue(account);
    }, this.settings.uniformResponseMs);
  }

  private async registerAllowed(email: string, input: RegisterRequest): Promise<void> {
    const { registrationMode, registrationAllowlist } = this.settings;
    // Le hachage est toujours calculé : il domine la durée de la requête, quelle que soit la branche.
    const passwordHash = await this.hasher.hash(input.password);
    if (!isRegistrationAllowed(registrationMode, registrationAllowlist, email)) return;
    const existing = await this.accounts.findAccountByEmail(email);
    const created =
      existing === null
        ? await this.accounts.createAccount({
            email,
            passwordHash,
            displayName: input.displayName ?? defaultDisplayName(email),
          })
        : null;
    if (created === null) {
      await this.verification.notifyRegistrationAttempt(email);
      return;
    }
    await this.verification.issue(created);
  }
}
