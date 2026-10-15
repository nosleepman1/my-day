import { Inject, Injectable } from '@nestjs/common';

import type { LoginRequest } from '@orbit/contracts';

import { PASSWORD_HASHER, type PasswordHasherPort } from '../../platform/auth/password-hasher.port';
import type { AuthenticatedSession, UserRole } from '../../platform/auth/session-resolver.port';
import { DomainError } from '../../platform/errors/domain-error';
import type { ClientContext } from '../../platform/http/client-context';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { type CredentialDirectory, UsersService } from '../users';

import { normalizeEmail } from './domain/registration';
import { type FailureInput, LoginAttempts } from './login-attempts.service';
import type { JournalEntry } from './login-journal.service';
import { type OpenedSession, SessionsService } from './sessions.service';

export type LoggedInUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
}>;

export type LoginResult = Readonly<{ token: string; maxAgeSeconds: number; user: LoggedInUser }>;

interface SessionManager {
  open(userId: string, client: ClientContext, previousToken: string | null): Promise<OpenedSession>;
  revoke(sessionId: string, reason: 'LOGOUT'): Promise<void>;
}

interface Attempts {
  assertAllowed(normalizedEmail: string, client: ClientContext): Promise<Buffer>;
  recordFailure(input: FailureInput, client: ClientContext, alertTo: string | null): Promise<void>;
  record(entry: JournalEntry): Promise<void>;
}

function invalidCredentials(): DomainError {
  return new DomainError('INVALID_CREDENTIALS', defaultMessageOf('INVALID_CREDENTIALS'));
}

/**
 * Connexion et déconnexion (SECURITY.md §3.2, §3.7, §3.8). Adresse inconnue, mot de passe faux et compte
 * inactif donnent la même erreur, au même coût (hachage factice) ; « adresse non vérifiée » n'est révélé
 * qu'au titulaire du bon mot de passe ; une adresse verrouillée répond 429, qu'elle existe ou non.
 */
@Injectable()
export class LoginService {
  constructor(
    @Inject(UsersService) private readonly accounts: CredentialDirectory,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SessionsService) private readonly sessions: SessionManager,
    @Inject(LoginAttempts) private readonly attempts: Attempts,
  ) {}

  /** @throws {DomainError} RATE_LIMITED (429), INVALID_CREDENTIALS (401) ou EMAIL_NOT_VERIFIED (403). */
  async login(
    input: LoginRequest,
    client: ClientContext,
    previousToken: string | null,
  ): Promise<LoginResult> {
    const normalized = normalizeEmail(input.email);
    const emailHmac = await this.attempts.assertAllowed(normalized, client);
    const user = await this.accounts.findCredentialsByEmail(normalized);
    const fail = (input: Omit<FailureInput, 'emailHmac'>, alertTo: string | null) =>
      this.attempts.recordFailure({ ...input, emailHmac }, client, alertTo);
    if (user === null) {
      await this.hasher.verifyAgainstDummy(input.password);
      await fail({ userId: null, failureCode: 'INVALID_CREDENTIALS' }, null);
      throw invalidCredentials();
    }
    if (!(await this.hasher.verify(user.passwordHash, input.password))) {
      await fail({ userId: user.id, failureCode: 'INVALID_CREDENTIALS' }, user.email);
      throw invalidCredentials();
    }
    if (user.status !== 'ACTIVE') {
      await fail({ userId: user.id, failureCode: 'ACCOUNT_INACTIVE' }, null);
      throw invalidCredentials();
    }
    if (user.emailVerifiedAt === null) {
      await fail({ userId: user.id, failureCode: 'EMAIL_NOT_VERIFIED' }, null);
      throw new DomainError('EMAIL_NOT_VERIFIED', defaultMessageOf('EMAIL_NOT_VERIFIED'));
    }

    const newPasswordHash = this.hasher.needsRehash(user.passwordHash)
      ? await this.hasher.hash(input.password)
      : null;
    const opened = await this.sessions.open(user.id, client, previousToken);
    await this.accounts.recordSuccessfulLogin(user.id, opened.openedAt, newPasswordHash);
    await this.attempts.record({
      eventType: 'LOGIN_SUCCEEDED',
      userId: user.id,
      emailHmac,
      sessionId: opened.sessionId,
      ip: client.ip,
      userAgentLabel: client.userAgent,
    });
    const { id, email, displayName, role, emailVerifiedAt } = user;
    return {
      token: opened.token,
      maxAgeSeconds: Math.floor((opened.absoluteExpiresAt.getTime() - opened.openedAt.getTime()) / 1_000),
      user: { id, email, displayName, role, emailVerifiedAt },
    };
  }

  async logout(session: AuthenticatedSession, client: ClientContext): Promise<void> {
    await this.sessions.revoke(session.sessionId, 'LOGOUT');
    await this.attempts.record({
      eventType: 'LOGOUT',
      userId: session.userId,
      sessionId: session.sessionId,
      ip: client.ip,
      userAgentLabel: client.userAgent,
    });
  }
}
