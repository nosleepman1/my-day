import { beforeEach, describe, expect, it } from 'vitest';

import { hashOpaqueToken } from '../../../platform/auth/session-token';
import { FixedClock } from '../../../platform/time/fixed-clock';
import type { AuthSettings } from '../auth-settings';
import type {
  NewSessionInput,
  SessionRevokeReason,
  SessionStore,
  StoredSession,
} from '../sessions.repository';
import { SessionsService } from '../sessions.service';

const NOW = new Date('2026-10-13T09:30:00.000Z');
const DAY = 86_400_000;
const SETTINGS: AuthSettings = {
  appOrigin: 'http://localhost:5173',
  registrationMode: 'open',
  registrationAllowlist: new Set(),
  uniformResponseMs: 0,
  sessionIdleMs: 7 * DAY,
  sessionAbsoluteMs: 30 * DAY,
};

class FakeSessions implements SessionStore {
  readonly created: NewSessionInput[] = [];
  readonly touched: { id: string; lastSeenAt: Date; idleExpiresAt: Date }[] = [];
  readonly revoked: { id: string; reason: SessionRevokeReason; at: Date }[] = [];
  stored: StoredSession | null = null;

  create(input: NewSessionInput): Promise<string> {
    this.created.push(input);
    return Promise.resolve('session-1');
  }

  findByTokenHash(): Promise<StoredSession | null> {
    return Promise.resolve(this.stored);
  }

  touch(id: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void> {
    this.touched.push({ id, lastSeenAt, idleExpiresAt });
    return Promise.resolve();
  }

  revoke(id: string, reason: SessionRevokeReason, at: Date): Promise<void> {
    this.revoked.push({ id, reason, at });
    return Promise.resolve();
  }
}

function stored(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    revokedAt: null,
    lastSeenAt: new Date(NOW.getTime() - 30_000),
    idleExpiresAt: new Date(NOW.getTime() + DAY),
    absoluteExpiresAt: new Date(NOW.getTime() + 10 * DAY),
    userStatus: 'ACTIVE',
    userRole: 'USER',
    ...overrides,
  };
}

describe('SessionsService', () => {
  let store: FakeSessions;
  let sessions: SessionsService;

  beforeEach(() => {
    store = new FakeSessions();
    sessions = new SessionsService(store, new FixedClock(NOW), SETTINGS);
  });

  describe('open', () => {
    it('stores only the SHA-256 of a fresh token, with 7 d idle and 30 d absolute expiry', async () => {
      const opened = await sessions.open('user-1', { ip: '203.0.113.77', userAgent: 'Firefox' }, null);

      const [input] = store.created;
      expect(opened.sessionId).toBe('session-1');
      expect(opened.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(input?.tokenHash.equals(hashOpaqueToken(opened.token))).toBe(true);
      expect(input).toMatchObject({
        userId: 'user-1',
        createdAt: NOW,
        idleExpiresAt: new Date(NOW.getTime() + 7 * DAY),
        absoluteExpiresAt: new Date(NOW.getTime() + 30 * DAY),
        ip: '203.0.113.0',
        userAgentLabel: 'Firefox',
        replacedTokenHash: null,
        maxActive: 20,
        purgeBefore: new Date(NOW.getTime() - 30 * DAY),
      });
      expect(opened.openedAt).toEqual(NOW);
      expect(opened.absoluteExpiresAt).toEqual(new Date(NOW.getTime() + 30 * DAY));
    });

    it('never adopts the token presented by the client: it asks to revoke it instead (anti-fixation)', async () => {
      const presented = 'AttackerChosenTokenAttackerChosenTokenAttac';

      const opened = await sessions.open('user-1', { ip: null, userAgent: null }, presented);

      expect(opened.token).not.toBe(presented);
      expect(store.created[0]?.replacedTokenHash?.equals(hashOpaqueToken(presented))).toBe(true);
    });
  });

  describe('resolve', () => {
    it('returns the session of an active user without touching it twice a minute', async () => {
      store.stored = stored();

      await expect(sessions.resolve('token')).resolves.toEqual({
        sessionId: 'session-1',
        userId: 'user-1',
        role: 'USER',
      });
      expect(store.touched).toHaveLength(0);
    });

    it('slides the idle expiry at most once a minute, never past the absolute expiry', async () => {
      const absoluteExpiresAt = new Date(NOW.getTime() + 2 * DAY);
      store.stored = stored({ lastSeenAt: new Date(NOW.getTime() - 61_000), absoluteExpiresAt });

      await sessions.resolve('token');

      expect(store.touched).toEqual([{ id: 'session-1', lastSeenAt: NOW, idleExpiresAt: absoluteExpiresAt }]);
    });

    it.each([
      ['unknown', null],
      ['revoked', stored({ revokedAt: new Date(NOW.getTime() - 1_000) })],
      ['idle-expired', stored({ idleExpiresAt: NOW })],
      ['absolutely expired', stored({ absoluteExpiresAt: NOW })],
      ['of a suspended user', stored({ userStatus: 'SUSPENDED' })],
    ])('returns null for a session %s', async (_label, row) => {
      store.stored = row;

      await expect(sessions.resolve('token')).resolves.toBeNull();
      expect(store.touched).toHaveLength(0);
    });
  });

  it('revokes with the current time', async () => {
    await sessions.revoke('session-1', 'LOGOUT');

    expect(store.revoked).toEqual([{ id: 'session-1', reason: 'LOGOUT', at: NOW }]);
  });
});
