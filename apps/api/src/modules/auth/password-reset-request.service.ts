import { Inject, Injectable } from '@nestjs/common';

import { generateOpaqueToken } from '../../platform/auth/session-token';
import type { ClientContext } from '../../platform/http/client-context';
import { ipPrefix } from '../../platform/http/ip-prefix';
import { enforceMinimumDuration } from '../../platform/time/minimum-duration';
import { type AccountDirectory, UsersService } from '../users';

import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import { normalizeEmail } from './domain/registration';
import { PasswordResetTokensRepository, type ResetTokenStore } from './password-reset-tokens.repository';
import { PASSWORD_RESET_TTL_MINUTES, SecurityNotices } from './security-notices.service';

const MINUTE_MS = 60_000;

/**
 * `POST /auth/password/forgot` (SECURITY.md §3.5) : réponse `202` identique et de durée plancher, que
 * l'adresse existe ou non ; le lien n'est envoyé qu'à un compte actif.
 */
@Injectable()
export class PasswordResetRequestService {
  constructor(
    @Inject(UsersService) private readonly accounts: AccountDirectory,
    @Inject(PasswordResetTokensRepository) private readonly tokens: ResetTokenStore,
    private readonly notices: SecurityNotices,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  async forgot(email: string, client: ClientContext): Promise<void> {
    const normalized = normalizeEmail(email);
    await enforceMinimumDuration(async () => {
      const account = await this.accounts.findAccountByEmail(normalized);
      if (account?.status !== 'ACTIVE') return;
      const now = this.notices.now();
      const { token, hash } = generateOpaqueToken();
      const replaced = await this.tokens.replaceActive({
        userId: account.id,
        tokenHash: hash,
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * MINUTE_MS),
        requestedIp: ipPrefix(client.ip),
        now,
      });
      if (!replaced) return;
      await this.notices.record({
        eventType: 'PASSWORD_RESET_REQUESTED',
        userId: account.id,
        ip: client.ip,
        userAgentLabel: client.userAgent,
      });
      await this.notices.sendPasswordReset(account.email, token);
    }, this.settings.uniformResponseMs);
  }
}
