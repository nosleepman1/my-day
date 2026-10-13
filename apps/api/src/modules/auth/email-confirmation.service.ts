import { Inject, Injectable } from '@nestjs/common';

import { hashOpaqueToken } from '../../platform/auth/session-token';
import { DomainError } from '../../platform/errors/domain-error';
import type { ClientContext } from '../../platform/http/client-context';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { CLOCK, type ClockPort } from '../../platform/time/clock.port';
import { type EmailVerificationTarget, UsersService } from '../users';

import {
  type ConsumableTokenStore,
  EmailVerificationTokensRepository,
  type StoredVerificationToken,
} from './email-verification-tokens.repository';
import { type LoginEventRecorder, LoginEventsRepository } from './login-events.repository';

function isUsable(token: StoredVerificationToken | null, now: Date): token is StoredVerificationToken {
  return (
    token !== null &&
    token.purpose === 'VERIFY_SIGNUP' &&
    token.consumedAt === null &&
    token.expiresAt.getTime() > now.getTime()
  );
}

function gone(): DomainError {
  return new DomainError('GONE', defaultMessageOf('GONE'));
}

/** Consommation du lien de vérification d'adresse (`POST /auth/email/verify`, SECURITY.md §3.4). */
@Injectable()
export class EmailConfirmationService {
  constructor(
    @Inject(EmailVerificationTokensRepository) private readonly tokens: ConsumableTokenStore,
    @Inject(UsersService) private readonly accounts: EmailVerificationTarget,
    @Inject(LoginEventsRepository) private readonly loginEvents: LoginEventRecorder,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  /**
   * Le jeton est consommé atomiquement (une seule requête gagne), puis l'adresse est marquée vérifiée
   * si elle est toujours celle du compte.
   * @throws {DomainError} GONE : jeton inconnu, consommé, expiré, d'un autre usage, ou adresse changée.
   */
  async verify(token: string, client: ClientContext): Promise<void> {
    const now = this.clock.now();
    const stored = await this.tokens.findByHash(hashOpaqueToken(token));
    if (!isUsable(stored, now)) throw gone();
    if (!(await this.tokens.consume(stored.id, now))) throw gone();
    if (!(await this.accounts.markEmailVerified(stored.userId, stored.targetEmail, now))) throw gone();
    await this.loginEvents.record({
      eventType: 'EMAIL_VERIFIED',
      userId: stored.userId,
      ip: client.ip,
      userAgentLabel: client.userAgent,
      occurredAt: now,
    });
  }
}
