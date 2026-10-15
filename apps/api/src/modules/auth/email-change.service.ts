import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedSession } from '../../platform/auth/session-resolver.port';
import { generateOpaqueToken, hashOpaqueToken } from '../../platform/auth/session-token';
import { DomainError } from '../../platform/errors/domain-error';
import type { ClientContext } from '../../platform/http/client-context';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { ipPrefix } from '../../platform/http/ip-prefix';
import { enforceMinimumDuration } from '../../platform/time/minimum-duration';
import { type EmailChangeAccounts, UsersService } from '../users';

import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import { normalizeEmail } from './domain/registration';
import {
  type ConsumableTokenStore,
  EmailVerificationTokensRepository,
  type VerificationTokenStore,
} from './email-verification-tokens.repository';
import { EMAIL_VERIFICATION_TTL_HOURS } from './email-verification.service';
import { SecurityNotices } from './security-notices.service';

const HOUR_MS = 3_600_000;

function gone(): DomainError {
  return new DomainError('GONE', defaultMessageOf('GONE'));
}

/**
 * Changement d'adresse e-mail (SECURITY.md §3.6) : demande avec ré-authentification récente, jeton envoyé
 * à la nouvelle adresse, notification à l'ancienne ; réponse `202` identique si l'adresse est déjà prise.
 */
@Injectable()
export class EmailChangeService {
  constructor(
    @Inject(UsersService) private readonly accounts: EmailChangeAccounts,
    @Inject(EmailVerificationTokensRepository)
    private readonly tokens: VerificationTokenStore & ConsumableTokenStore,
    private readonly notices: SecurityNotices,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  async request(session: AuthenticatedSession, newEmail: string, client: ClientContext): Promise<void> {
    const target = normalizeEmail(newEmail);
    await enforceMinimumDuration(async () => {
      const account = await this.accounts.findAccountById(session.userId);
      if (account === null || account.email === target) return;
      if ((await this.accounts.findAccountByEmail(target)) !== null) {
        await this.notices.sendEmailChangeConflict(target);
        return;
      }
      const now = this.notices.now();
      const { token, hash } = generateOpaqueToken();
      const replaced = await this.tokens.replaceActive({
        userId: account.id,
        purpose: 'CHANGE_EMAIL',
        targetEmail: target,
        tokenHash: hash,
        expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_HOURS * HOUR_MS),
        now,
      });
      if (!replaced) return;
      await this.notices.sendEmailChangeVerification(target, token);
      await this.notices.sendEmailChangeNotice(account.email, now, ipPrefix(client.ip));
    }, this.settings.uniformResponseMs);
  }

  /** @throws {DomainError} GONE : jeton inconnu, consommé, expiré, ou adresse prise entre-temps. */
  async confirm(token: string, client: ClientContext): Promise<void> {
    const now = this.notices.now();
    const stored = await this.tokens.findByHash(hashOpaqueToken(token));
    const usable =
      stored?.purpose === 'CHANGE_EMAIL' &&
      stored.consumedAt === null &&
      stored.expiresAt.getTime() > now.getTime();
    if (!usable || !(await this.tokens.consume(stored.id, now))) throw gone();
    if (!(await this.accounts.changeEmail(stored.userId, stored.targetEmail, now))) throw gone();
    await this.notices.record({
      eventType: 'EMAIL_CHANGED',
      userId: stored.userId,
      ip: client.ip,
      userAgentLabel: client.userAgent,
    });
  }
}
