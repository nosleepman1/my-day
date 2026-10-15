import type { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PasswordHasherPort } from '../../../platform/auth/password-hasher.port';
import { hashOpaqueToken } from '../../../platform/auth/session-token';
import { DomainError } from '../../../platform/errors/domain-error';
import { CapturingMailAdapter } from '../../../platform/mail/capturing-mail.adapter';
import { MailDeliveryError } from '../../../platform/mail/mail-delivery.error';
import type { MailPort } from '../../../platform/mail/mail.port';
import { FixedClock } from '../../../platform/time/fixed-clock';
import type { AccountSummary, CreateAccountInput } from '../../users';
import { AccountMailer } from '../account-mailer.service';
import type { AuthSettings } from '../auth-settings';
import type { ActiveTokenInput } from '../email-verification-tokens.repository';
import { EmailVerificationService } from '../email-verification.service';
import { RegistrationService } from '../registration.service';

const NOW = new Date('2026-10-12T09:30:00.000Z');
const STRONG = 'thiéboudienne au poisson 2026';
const ORIGIN = 'http://localhost:5173';

class FakeAccounts {
  readonly accounts = new Map<string, AccountSummary>();
  readonly created: CreateAccountInput[] = [];
  duplicateOnCreate = false;

  findAccountByEmail(email: string): Promise<AccountSummary | null> {
    return Promise.resolve(this.accounts.get(email) ?? null);
  }

  createAccount(input: CreateAccountInput): Promise<AccountSummary | null> {
    if (this.duplicateOnCreate) return Promise.resolve(null);
    this.created.push(input);
    const account: AccountSummary = {
      id: `user-${this.created.length}`,
      email: input.email,
      emailVerifiedAt: null,
      status: 'ACTIVE',
    };
    this.accounts.set(input.email, account);
    return Promise.resolve(account);
  }
}

class FakeTokens {
  readonly issued: ActiveTokenInput[] = [];

  replaceActive(input: ActiveTokenInput): Promise<boolean> {
    this.issued.push(input);
    return Promise.resolve(true);
  }
}

class FakeHasher implements PasswordHasherPort {
  readonly hashed: string[] = [];

  hash(password: string): Promise<string> {
    this.hashed.push(password);
    return Promise.resolve(`hashed:${password}`);
  }
  verify(): Promise<boolean> {
    return Promise.resolve(false);
  }
  verifyAgainstDummy(): Promise<false> {
    return Promise.resolve(false);
  }
  needsRehash(): boolean {
    return false;
  }
}

function settings(overrides: Partial<AuthSettings> = {}): AuthSettings {
  return {
    appOrigin: ORIGIN,
    registrationMode: 'open',
    registrationAllowlist: new Set(),
    uniformResponseMs: 0,
    sessionIdleMs: 7 * 86_400_000,
    sessionAbsoluteMs: 30 * 86_400_000,
    ...overrides,
  };
}

describe('RegistrationService', () => {
  let accounts: FakeAccounts;
  let tokens: FakeTokens;
  let hasher: FakeHasher;
  let mail: CapturingMailAdapter;
  let logger: PinoLogger;

  /** Câble le vrai graphe du module (mailer, vérification, inscription) autour des faux adaptateurs. */
  function build(mailPort: MailPort, overrides: Partial<AuthSettings> = {}): RegistrationService {
    const authSettings = settings(overrides);
    const mailer = new AccountMailer(mailPort, authSettings, logger);
    const verification = new EmailVerificationService(tokens, new FixedClock(NOW), mailer);
    return new RegistrationService(accounts, hasher, verification, authSettings);
  }

  function service(overrides: Partial<AuthSettings> = {}): RegistrationService {
    return build(mail, overrides);
  }

  beforeEach(() => {
    accounts = new FakeAccounts();
    tokens = new FakeTokens();
    hasher = new FakeHasher();
    mail = new CapturingMailAdapter();
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
  });

  describe('register', () => {
    it('creates the account with a normalised e-mail and sends a 24 h verification link', async () => {
      await service().register({ email: ' Aminata.Diop@Example.test', password: STRONG });

      expect(accounts.created).toEqual([
        { email: 'aminata.diop@example.test', passwordHash: `hashed:${STRONG}`, displayName: 'aminata.diop' },
      ]);
      const [token] = tokens.issued;
      expect(token).toMatchObject({
        userId: 'user-1',
        purpose: 'VERIFY_SIGNUP',
        targetEmail: 'aminata.diop@example.test',
        expiresAt: new Date('2026-10-13T09:30:00.000Z'),
      });
      const sent = mail.lastTo('aminata.diop@example.test');
      expect(sent?.template).toBe('email-verification');
      expect(sent?.text).toContain(`${ORIGIN}/verify-email#token=`);
      const linkToken = mail.lastTokenFor('aminata.diop@example.test') ?? '';
      expect(hashOpaqueToken(linkToken).equals(token?.tokenHash ?? Buffer.alloc(0))).toBe(true);
    });

    it('keeps the display name chosen by the user', async () => {
      await service().register({ email: 'a.diop@example.test', password: STRONG, displayName: 'Aminata' });

      expect(accounts.created[0]?.displayName).toBe('Aminata');
    });

    it('sends a "registration attempt" e-mail when the address already exists, without touching it', async () => {
      await service().register({ email: 'aminata.diop@example.test', password: STRONG });
      mail.clear();

      await service().register({ email: 'AMINATA.DIOP@example.test', password: STRONG });

      expect(accounts.created).toHaveLength(1);
      expect(tokens.issued).toHaveLength(1);
      expect(mail.sent.map((sent) => sent.template)).toEqual(['registration-attempt']);
      expect(hasher.hashed).toHaveLength(2);
    });

    it('treats a concurrent duplicate insert like an existing account', async () => {
      accounts.duplicateOnCreate = true;

      await service().register({ email: 'aminata.diop@example.test', password: STRONG });

      expect(tokens.issued).toHaveLength(0);
      expect(mail.sent.map((sent) => sent.template)).toEqual(['registration-attempt']);
    });

    it('silently ignores an address outside the allowlist, still paying the hashing cost', async () => {
      const allowlisted = service({
        registrationMode: 'allowlist',
        registrationAllowlist: new Set(['abdou@example.test']),
      });

      await allowlisted.register({ email: 'intrus@example.test', password: STRONG });
      expect(accounts.created).toHaveLength(0);
      expect(mail.sent).toHaveLength(0);
      expect(hasher.hashed).toHaveLength(1);

      await allowlisted.register({ email: 'Abdou@example.test', password: STRONG });
      expect(accounts.created).toHaveLength(1);
    });

    it('creates nothing in closed mode', async () => {
      await service({ registrationMode: 'closed' }).register({
        email: 'abdou@example.test',
        password: STRONG,
      });

      expect(accounts.created).toHaveLength(0);
      expect(mail.sent).toHaveLength(0);
    });

    it('rejects a password that breaks the policy before any lookup', async () => {
      const error: unknown = await service()
        .register({ email: 'aminata.diop@example.test', password: 'court' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('VALIDATION_FAILED');
      expect((error as DomainError).details).toEqual([
        { path: ['password'], code: 'TOO_SHORT', message: expect.any(String) as unknown },
      ]);
      expect(hasher.hashed).toHaveLength(0);
      expect(accounts.created).toHaveLength(0);
    });

    it('keeps the uniform response when the mail fails, and logs it without the address', async () => {
      const failing = {
        send: vi.fn().mockRejectedValue(new MailDeliveryError('email-verification')),
      };
      const registration = build(failing);

      await expect(
        registration.register({ email: 'aminata.diop@example.test', password: STRONG }),
      ).resolves.toBeUndefined();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'email-verification' }),
        'auth.mail_delivery_failed',
      );
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('aminata.diop');
    });
  });

  describe('resendVerification', () => {
    it('issues a fresh token for an unverified active account', async () => {
      await service().register({ email: 'aminata.diop@example.test', password: STRONG });
      mail.clear();

      await service().resendVerification({ email: 'Aminata.Diop@example.test' });

      expect(tokens.issued).toHaveLength(2);
      expect(mail.sent.map((sent) => sent.template)).toEqual(['email-verification']);
    });

    it.each([
      ['an unknown address', null],
      ['a verified account', { emailVerifiedAt: NOW, status: 'ACTIVE' as const }],
      ['a suspended account', { emailVerifiedAt: null, status: 'SUSPENDED' as const }],
    ])('does nothing for %s', async (_label, state) => {
      if (state !== null) {
        accounts.accounts.set('aminata.diop@example.test', {
          id: 'user-9',
          email: 'aminata.diop@example.test',
          ...state,
        });
      }

      await service().resendVerification({ email: 'aminata.diop@example.test' });

      expect(tokens.issued).toHaveLength(0);
      expect(mail.sent).toHaveLength(0);
    });
  });
});
