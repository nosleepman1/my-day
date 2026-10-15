import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';
import type { ClientContext } from '../../../platform/http/client-context';
import { FixedClock } from '../../../platform/time/fixed-clock';
import { type FailureStats, LoginAttempts, type LoginAttemptsPolicy } from '../login-attempts.service';
import type { JournalEntry } from '../login-journal.service';

const NOW = new Date('2026-10-13T09:30:00.000Z');
const MINUTE = 60_000;
const CLIENT: ClientContext = { ip: '203.0.113.7', userAgent: 'Firefox' };
const EMAIL = 'aminata.diop@example.test';
const DIGEST = Buffer.alloc(32, 7);

class FakeJournal {
  readonly entries: JournalEntry[] = [];
  stats: FailureStats = { lastHour: 0, lastDay: 0, latestAt: null };

  record(entry: JournalEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }

  failureStats(): Promise<FailureStats> {
    return Promise.resolve(this.stats);
  }
}

class FakeMailer {
  readonly alerts: { to: string; at: Date }[] = [];

  sendLoginLocked(to: string, occurredAt: Date): Promise<void> {
    this.alerts.push({ to, at: occurredAt });
    return Promise.resolve();
  }
}

describe('LoginAttempts (SECURITY.md §3.7)', () => {
  let journal: FakeJournal;
  let mailer: FakeMailer;
  let sleeps: number[];
  let attempts: LoginAttempts;

  beforeEach(() => {
    journal = new FakeJournal();
    mailer = new FakeMailer();
    sleeps = [];
    const policy: LoginAttemptsPolicy = {
      delayUnitMs: 250,
      digestEmail: (email) => (email === EMAIL ? DIGEST : Buffer.alloc(32)),
      sleep: (milliseconds) => {
        sleeps.push(milliseconds);
        return Promise.resolve();
      },
    };
    attempts = new LoginAttempts(journal, mailer, new FixedClock(NOW), policy);
  });

  const failures = (lastHour: number, lastDay: number, minutesAgo: number): FailureStats => ({
    lastHour,
    lastDay,
    latestAt: new Date(NOW.getTime() - minutesAgo * MINUTE),
  });

  async function locked(): Promise<DomainError> {
    const error: unknown = await attempts.assertAllowed(EMAIL, CLIENT).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DomainError);
    return error as DomainError;
  }

  describe('assertAllowed', () => {
    it('returns the e-mail HMAC without delay when there is no recent failure', async () => {
      await expect(attempts.assertAllowed(EMAIL, CLIENT)).resolves.toBe(DIGEST);
      expect(sleeps).toEqual([]);
    });

    it('slows down after 3 failures: 250 ms per failure, 2 s at most', async () => {
      journal.stats = failures(3, 3, 1);
      await attempts.assertAllowed(EMAIL, CLIENT);
      journal.stats = failures(9, 9, 1);
      await attempts.assertAllowed(EMAIL, CLIENT);

      expect(sleeps).toEqual([750, 2_000]);
    });

    it('locks for 15 minutes after 10 failures in an hour, and records the refused attempt', async () => {
      journal.stats = failures(10, 10, 5);

      const error = await locked();

      expect(error.code).toBe('RATE_LIMITED');
      expect(error.details).toEqual({ retryAfterSeconds: 600 });
      expect(journal.entries).toEqual([
        {
          eventType: 'LOGIN_FAILED',
          userId: null,
          emailHmac: DIGEST,
          failureCode: 'LOCKED',
          ip: '203.0.113.7',
          userAgentLabel: 'Firefox',
        },
      ]);
      expect(sleeps).toEqual([]);
    });

    it('lets the user try again once the 15-minute lock is over', async () => {
      journal.stats = failures(10, 10, 20);

      await expect(attempts.assertAllowed(EMAIL, CLIENT)).resolves.toBe(DIGEST);
    });

    it('locks for 24 hours after 50 failures in a day', async () => {
      journal.stats = failures(2, 50, 60);

      expect((await locked()).details).toEqual({ retryAfterSeconds: 23 * 3_600 });
    });
  });

  describe('recordFailure', () => {
    it('records the failure with the e-mail HMAC', async () => {
      await attempts.recordFailure(
        { userId: 'user-1', emailHmac: DIGEST, failureCode: 'INVALID_CREDENTIALS' },
        CLIENT,
        null,
      );

      expect(journal.entries).toEqual([
        {
          eventType: 'LOGIN_FAILED',
          userId: 'user-1',
          emailHmac: DIGEST,
          failureCode: 'INVALID_CREDENTIALS',
          ip: '203.0.113.7',
          userAgentLabel: 'Firefox',
        },
      ]);
    });

    it('records ACCOUNT_LOCKED when the 10th failure of the hour locks the address', async () => {
      journal.stats = failures(10, 10, 0);

      await attempts.recordFailure(
        { userId: null, emailHmac: DIGEST, failureCode: 'INVALID_CREDENTIALS' },
        CLIENT,
        null,
      );

      expect(journal.entries.map((entry) => entry.eventType)).toEqual(['LOGIN_FAILED', 'ACCOUNT_LOCKED']);
      expect(mailer.alerts).toHaveLength(0);
    });

    it('alerts the account owner by e-mail at the 50th failure of the day', async () => {
      journal.stats = failures(3, 50, 0);

      await attempts.recordFailure(
        { userId: 'user-1', emailHmac: DIGEST, failureCode: 'INVALID_CREDENTIALS' },
        CLIENT,
        EMAIL,
      );

      expect(journal.entries.map((entry) => entry.eventType)).toEqual(['LOGIN_FAILED', 'ACCOUNT_LOCKED']);
      expect(mailer.alerts).toEqual([{ to: EMAIL, at: NOW }]);
    });

    it('does not count failures that already passed the password check', async () => {
      journal.stats = failures(10, 50, 0);

      await attempts.recordFailure(
        { userId: 'user-1', emailHmac: DIGEST, failureCode: 'EMAIL_NOT_VERIFIED' },
        CLIENT,
        EMAIL,
      );

      expect(journal.entries.map((entry) => entry.eventType)).toEqual(['LOGIN_FAILED']);
      expect(mailer.alerts).toHaveLength(0);
    });
  });
});
