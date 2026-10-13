import { beforeEach, describe, expect, it } from 'vitest';

import type { PasswordHasherPort } from '../../../platform/auth/password-hasher.port';
import { DomainError } from '../../../platform/errors/domain-error';
import type { ClientContext } from '../../../platform/http/client-context';
import type { UserCredentials } from '../../users';
import type { JournalEntry } from '../login-journal.service';
import { LoginService } from '../login.service';
import type { OpenedSession } from '../sessions.service';

const NOW = new Date('2026-10-13T09:30:00.000Z');
const CLIENT: ClientContext = { ip: '203.0.113.7', userAgent: 'Firefox' };
const PASSWORD = 'thiéboudienne au poisson 2026';

function credentials(overrides: Partial<UserCredentials> = {}): UserCredentials {
  return {
    id: 'user-1',
    email: 'aminata.diop@example.test',
    displayName: 'Aminata',
    passwordHash: `hash:${PASSWORD}`,
    role: 'USER',
    status: 'ACTIVE',
    emailVerifiedAt: new Date('2026-10-12T00:00:00.000Z'),
    ...overrides,
  };
}

class FakeAccounts {
  user: UserCredentials | null = credentials();
  readonly logins: { userId: string; at: Date; newPasswordHash: string | null }[] = [];

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return Promise.resolve(this.user?.email === email ? this.user : null);
  }

  recordSuccessfulLogin(userId: string, at: Date, newPasswordHash: string | null): Promise<void> {
    this.logins.push({ userId, at, newPasswordHash });
    return Promise.resolve();
  }
}

class FakeHasher implements PasswordHasherPort {
  dummyCalls = 0;
  rehashNeeded = false;

  hash(password: string): Promise<string> {
    return Promise.resolve(`rehash:${password}`);
  }
  verify(storedHash: string, password: string): Promise<boolean> {
    return Promise.resolve(storedHash === `hash:${password}`);
  }
  verifyAgainstDummy(): Promise<false> {
    this.dummyCalls += 1;
    return Promise.resolve(false);
  }
  needsRehash(): boolean {
    return this.rehashNeeded;
  }
}

class FakeSessions {
  readonly opened: { userId: string; previousToken: string | null }[] = [];
  readonly revoked: { sessionId: string; reason: string }[] = [];

  open(userId: string, _client: ClientContext, previousToken: string | null): Promise<OpenedSession> {
    this.opened.push({ userId, previousToken });
    return Promise.resolve({
      sessionId: 'session-1',
      token: 'new-token',
      openedAt: NOW,
      absoluteExpiresAt: new Date(NOW.getTime() + 30 * 86_400_000),
    });
  }

  revoke(sessionId: string, reason: 'LOGOUT'): Promise<void> {
    this.revoked.push({ sessionId, reason });
    return Promise.resolve();
  }
}

class FakeJournal {
  readonly entries: JournalEntry[] = [];

  record(entry: JournalEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
}

describe('LoginService', () => {
  let accounts: FakeAccounts;
  let hasher: FakeHasher;
  let sessions: FakeSessions;
  let journal: FakeJournal;
  let service: LoginService;

  beforeEach(() => {
    accounts = new FakeAccounts();
    hasher = new FakeHasher();
    sessions = new FakeSessions();
    journal = new FakeJournal();
    service = new LoginService(accounts, hasher, sessions, journal);
  });

  async function failure(email: string, password: string): Promise<DomainError> {
    const error: unknown = await service
      .login({ email, password }, CLIENT, null)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DomainError);
    return error as DomainError;
  }

  it('opens a session, records the login and returns the public user', async () => {
    const result = await service.login(
      { email: ' Aminata.Diop@example.test', password: PASSWORD },
      CLIENT,
      'previous-cookie-token',
    );

    expect(sessions.opened).toEqual([{ userId: 'user-1', previousToken: 'previous-cookie-token' }]);
    expect(result).toEqual({
      token: 'new-token',
      maxAgeSeconds: 2_592_000,
      user: {
        id: 'user-1',
        email: 'aminata.diop@example.test',
        displayName: 'Aminata',
        role: 'USER',
        emailVerifiedAt: new Date('2026-10-12T00:00:00.000Z'),
      },
    });
    expect(accounts.logins).toEqual([{ userId: 'user-1', at: NOW, newPasswordHash: null }]);
    expect(journal.entries).toEqual([
      {
        eventType: 'LOGIN_SUCCEEDED',
        userId: 'user-1',
        sessionId: 'session-1',
        ip: '203.0.113.7',
        userAgentLabel: 'Firefox',
      },
    ]);
  });

  it('rehashes the password when the hashing parameters changed', async () => {
    hasher.rehashNeeded = true;

    await service.login({ email: 'aminata.diop@example.test', password: PASSWORD }, CLIENT, null);

    expect(accounts.logins[0]?.newPasswordHash).toBe(`rehash:${PASSWORD}`);
  });

  it('answers INVALID_CREDENTIALS for an unknown e-mail after a dummy verification', async () => {
    const error = await failure('inconnu@example.test', PASSWORD);

    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(hasher.dummyCalls).toBe(1);
    expect(journal.entries).toEqual([
      {
        eventType: 'LOGIN_FAILED',
        userId: null,
        failureCode: 'INVALID_CREDENTIALS',
        ip: '203.0.113.7',
        userAgentLabel: 'Firefox',
      },
    ]);
    expect(sessions.opened).toHaveLength(0);
  });

  it('answers the same INVALID_CREDENTIALS for a wrong password', async () => {
    const error = await failure('aminata.diop@example.test', 'mauvais mot de passe');

    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(journal.entries[0]).toMatchObject({ userId: 'user-1', failureCode: 'INVALID_CREDENTIALS' });
  });

  it('hides a suspended account behind INVALID_CREDENTIALS', async () => {
    accounts.user = credentials({ status: 'SUSPENDED' });

    const error = await failure('aminata.diop@example.test', PASSWORD);

    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(journal.entries[0]).toMatchObject({ failureCode: 'ACCOUNT_INACTIVE' });
    expect(sessions.opened).toHaveLength(0);
  });

  it('answers EMAIL_NOT_VERIFIED only once the password is known to be right', async () => {
    accounts.user = credentials({ emailVerifiedAt: null });

    expect((await failure('aminata.diop@example.test', PASSWORD)).code).toBe('EMAIL_NOT_VERIFIED');
    expect((await failure('aminata.diop@example.test', 'mauvais mot de passe')).code).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(sessions.opened).toHaveLength(0);
  });

  it('logout revokes the current session and records it', async () => {
    await service.logout({ sessionId: 'session-9', userId: 'user-1', role: 'USER' }, CLIENT);

    expect(sessions.revoked).toEqual([{ sessionId: 'session-9', reason: 'LOGOUT' }]);
    expect(journal.entries).toEqual([
      {
        eventType: 'LOGOUT',
        userId: 'user-1',
        sessionId: 'session-9',
        ip: '203.0.113.7',
        userAgentLabel: 'Firefox',
      },
    ]);
  });
});
