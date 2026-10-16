import { describe, expect, it } from 'vitest';

import { toSessionUser } from './session-user';

describe('toSessionUser', () => {
  it('converts profile with emailVerifiedAt as Date', () => {
    const verifiedDate = new Date('2026-03-01T10:00:00.000Z');
    const user = toSessionUser({
      id: '01927000-0000-7000-8000-000000000001',
      email: 'alice@example.com',
      displayName: 'Alice',
      role: 'USER',
      emailVerifiedAt: verifiedDate,
    });

    expect(user.emailVerifiedAt).toBe('2026-03-01T10:00:00.000Z');
    expect(user.mfaEnabled).toBe(false);
  });

  it('converts profile with null emailVerifiedAt', () => {
    const user = toSessionUser({
      id: '01927000-0000-7000-8000-000000000001',
      email: 'bob@example.com',
      displayName: 'Bob',
      role: 'ADMIN',
      emailVerifiedAt: null,
    });

    expect(user.emailVerifiedAt).toBeNull();
    expect(user.role).toBe('ADMIN');
  });
});
