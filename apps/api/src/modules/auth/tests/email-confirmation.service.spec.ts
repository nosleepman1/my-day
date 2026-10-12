import { beforeEach, describe, expect, it } from 'vitest';

import { hashOpaqueToken } from '../../../platform/auth/session-token';
import { DomainError } from '../../../platform/errors/domain-error';
import type { ClientContext } from '../../../platform/http/client-context';
import { FixedClock } from '../../../platform/time/fixed-clock';
import { EmailConfirmationService } from '../email-confirmation.service';
import type { StoredVerificationToken } from '../email-verification-tokens.repository';
import type { LoginEventInput } from '../login-events.repository';

const NOW = new Date('2026-10-12T09:30:00.000Z');
const TOKEN = 'tok_valid-0123456789';
const CLIENT: ClientContext = { ip: '203.0.113.7', userAgent: 'Firefox' };

function storedToken(overrides: Partial<StoredVerificationToken> = {}): StoredVerificationToken {
  return {
    id: 'token-1',
    userId: 'user-1',
    purpose: 'VERIFY_SIGNUP',
    targetEmail: 'aminata.diop@example.test',
    expiresAt: new Date('2026-10-13T00:00:00.000Z'),
    consumedAt: null,
    ...overrides,
  };
}

class FakeTokens {
  readonly rows = new Map<string, StoredVerificationToken>();
  readonly consumed: string[] = [];
  loseRace = false;

  findByHash(hash: Buffer): Promise<StoredVerificationToken | null> {
    return Promise.resolve(this.rows.get(hash.toString('hex')) ?? null);
  }

  consume(id: string): Promise<boolean> {
    if (this.loseRace) return Promise.resolve(false);
    this.consumed.push(id);
    return Promise.resolve(true);
  }
}

class FakeAccounts {
  readonly verified: { userId: string; email: string; at: Date }[] = [];
  emailStillMatches = true;

  markEmailVerified(userId: string, email: string, at: Date): Promise<boolean> {
    if (!this.emailStillMatches) return Promise.resolve(false);
    this.verified.push({ userId, email, at });
    return Promise.resolve(true);
  }
}

class FakeLoginEvents {
  readonly recorded: LoginEventInput[] = [];

  record(event: LoginEventInput): Promise<void> {
    this.recorded.push(event);
    return Promise.resolve();
  }
}

describe('EmailConfirmationService.verify', () => {
  let tokens: FakeTokens;
  let accounts: FakeAccounts;
  let events: FakeLoginEvents;
  let service: EmailConfirmationService;

  function store(row: StoredVerificationToken): void {
    tokens.rows.set(hashOpaqueToken(TOKEN).toString('hex'), row);
  }

  async function expectGone(): Promise<void> {
    const error: unknown = await service.verify(TOKEN, CLIENT).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('GONE');
  }

  beforeEach(() => {
    tokens = new FakeTokens();
    accounts = new FakeAccounts();
    events = new FakeLoginEvents();
    service = new EmailConfirmationService(tokens, accounts, events, new FixedClock(NOW));
  });

  it('consumes the token, marks the address verified and records EMAIL_VERIFIED', async () => {
    store(storedToken());

    await service.verify(TOKEN, CLIENT);

    expect(tokens.consumed).toEqual(['token-1']);
    expect(accounts.verified).toEqual([{ userId: 'user-1', email: 'aminata.diop@example.test', at: NOW }]);
    expect(events.recorded).toEqual([
      {
        eventType: 'EMAIL_VERIFIED',
        userId: 'user-1',
        ip: '203.0.113.7',
        userAgentLabel: 'Firefox',
        occurredAt: NOW,
      },
    ]);
  });

  it('answers GONE for an unknown token', async () => {
    await expectGone();
    expect(accounts.verified).toHaveLength(0);
  });

  it.each([
    ['already consumed', { consumedAt: new Date('2026-10-12T08:00:00.000Z') }],
    ['expired', { expiresAt: NOW }],
    ['issued for an e-mail change', { purpose: 'CHANGE_EMAIL' as const }],
  ])('answers GONE for a token %s', async (_label, overrides) => {
    store(storedToken(overrides));

    await expectGone();
    expect(tokens.consumed).toHaveLength(0);
    expect(events.recorded).toHaveLength(0);
  });

  it('answers GONE to the loser of two concurrent verifications', async () => {
    store(storedToken());
    tokens.loseRace = true;

    await expectGone();
    expect(accounts.verified).toHaveLength(0);
  });

  it('answers GONE when the account address changed since the token was issued', async () => {
    store(storedToken());
    accounts.emailStillMatches = false;

    await expectGone();
    expect(events.recorded).toHaveLength(0);
  });
});
