import { Inject, Injectable } from '@nestjs/common';

import { PASSWORD_HASHER, type PasswordHasherPort } from '../../platform/auth/password-hasher.port';
import type { AuthenticatedSession } from '../../platform/auth/session-resolver.port';
import { DomainError } from '../../platform/errors/domain-error';
import type { ClientContext } from '../../platform/http/client-context';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { type CredentialLookup, type UserCredentials, UsersService } from '../users';

import { SecurityNotices } from './security-notices.service';
import type { SessionRevokeReason } from './sessions.repository';
import { SessionsService } from './sessions.service';

/** SECURITY.md §3.7 : 10 échecs de ré-authentification révoquent la session. */
const MAX_REAUTH_FAILURES = 10;

interface ReauthSessions {
  markReauthenticated(sessionId: string): Promise<void>;
  revoke(sessionId: string, reason: SessionRevokeReason): Promise<void>;
}

/** `POST /auth/reauth` (SECURITY.md §4) : pose `sessions.reauth_at` après vérification du mot de passe. */
@Injectable()
export class ReauthService {
  constructor(
    @Inject(UsersService) private readonly accounts: CredentialLookup,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SessionsService) private readonly sessions: ReauthSessions,
    private readonly notices: SecurityNotices,
  ) {}

  /** @throws {DomainError} REAUTH_FAILED (403) si le mot de passe est faux. */
  async reauth(session: AuthenticatedSession, password: string, client: ClientContext): Promise<void> {
    await this.assertPassword(session, password, client);
    await this.sessions.markReauthenticated(session.sessionId);
  }

  /**
   * Vérifie le mot de passe de la session (ré-authentification, `POST /me/password`) : chaque échec est
   * journalisé `REAUTH_FAILED` et 10 échecs révoquent la session (SECURITY.md §3.7).
   * @throws {DomainError} REAUTH_FAILED
   */
  async assertPassword(
    session: AuthenticatedSession,
    password: string,
    client: ClientContext,
  ): Promise<UserCredentials> {
    const credentials = await this.accounts.findCredentialsById(session.userId);
    const verified = credentials !== null && (await this.hasher.verify(credentials.passwordHash, password));
    const origin = {
      userId: session.userId,
      sessionId: session.sessionId,
      ip: client.ip,
      userAgentLabel: client.userAgent,
    };
    if (!verified) {
      await this.notices.record({ eventType: 'REAUTH_FAILED', ...origin });
      const failures = await this.notices.countSessionEvents(session.sessionId, 'REAUTH_FAILED');
      if (failures >= MAX_REAUTH_FAILURES) await this.sessions.revoke(session.sessionId, 'SECURITY');
      throw new DomainError('REAUTH_FAILED', defaultMessageOf('REAUTH_FAILED'));
    }
    await this.notices.record({ eventType: 'REAUTH_SUCCEEDED', ...origin });
    return credentials;
  }
}
