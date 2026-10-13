import { Inject, Injectable } from '@nestjs/common';

import type { LoginRequest } from '@orbit/contracts';

import { PASSWORD_HASHER, type PasswordHasherPort } from '../../platform/auth/password-hasher.port';
import type { AuthenticatedSession, UserRole } from '../../platform/auth/session-resolver.port';
import { DomainError } from '../../platform/errors/domain-error';
import type { ClientContext } from '../../platform/http/client-context';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { type CredentialDirectory, UsersService } from '../users';

import { normalizeEmail } from './domain/registration';
import { type JournalEntry, LoginJournal } from './login-journal.service';
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

interface Journal {
  record(entry: JournalEntry): Promise<void>;
}

type FailureCode = 'INVALID_CREDENTIALS' | 'ACCOUNT_INACTIVE' | 'EMAIL_NOT_VERIFIED';

function invalidCredentials(): DomainError {
  return new DomainError('INVALID_CREDENTIALS', defaultMessageOf('INVALID_CREDENTIALS'));
}

/**
 * Connexion et déconnexion (SECURITY.md §3.2, §3.8). Adresse inconnue, mot de passe faux et compte inactif
 * donnent la même erreur, au même coût (hachage factice) ; « adresse non vérifiée » n'est révélé qu'au
 * titulaire du bon mot de passe.
 */
@Injectable()
export class LoginService {
  constructor(
    @Inject(UsersService) private readonly accounts: CredentialDirectory,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SessionsService) private readonly sessions: SessionManager,
    @Inject(LoginJournal) private readonly journal: Journal,
  ) {}

  /** @throws {DomainError} INVALID_CREDENTIALS (401) ou EMAIL_NOT_VERIFIED (403). */
  async login(
    input: LoginRequest,
    client: ClientContext,
    previousToken: string | null,
  ): Promise<LoginResult> {
    const user = await this.accounts.findCredentialsByEmail(normalizeEmail(input.email));
    if (user === null) {
      await this.hasher.verifyAgainstDummy(input.password);
      await this.fail(null, 'INVALID_CREDENTIALS', client);
      throw invalidCredentials();
    }
    if (!(await this.hasher.verify(user.passwordHash, input.password))) {
      await this.fail(user.id, 'INVALID_CREDENTIALS', client);
      throw invalidCredentials();
    }
    if (user.status !== 'ACTIVE') {
      await this.fail(user.id, 'ACCOUNT_INACTIVE', client);
      throw invalidCredentials();
    }
    if (user.emailVerifiedAt === null) {
      await this.fail(user.id, 'EMAIL_NOT_VERIFIED', client);
      throw new DomainError('EMAIL_NOT_VERIFIED', defaultMessageOf('EMAIL_NOT_VERIFIED'));
    }

    const newPasswordHash = this.hasher.needsRehash(user.passwordHash)
      ? await this.hasher.hash(input.password)
      : null;
    const opened = await this.sessions.open(user.id, client, previousToken);
    await this.accounts.recordSuccessfulLogin(user.id, opened.openedAt, newPasswordHash);
    await this.journal.record({
      eventType: 'LOGIN_SUCCEEDED',
      userId: user.id,
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
    await this.journal.record({
      eventType: 'LOGOUT',
      userId: session.userId,
      sessionId: session.sessionId,
      ip: client.ip,
      userAgentLabel: client.userAgent,
    });
  }

  private fail(userId: string | null, failureCode: FailureCode, client: ClientContext): Promise<void> {
    return this.journal.record({
      eventType: 'LOGIN_FAILED',
      userId,
      failureCode,
      ip: client.ip,
      userAgentLabel: client.userAgent,
    });
  }
}
