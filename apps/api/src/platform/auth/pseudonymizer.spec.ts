import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { Pseudonymizer } from './pseudonymizer';

const KEY = 'test-only-rate-limit-key-0123456789abcdef';

describe('Pseudonymizer (SECURITY.md §3.7)', () => {
  it('returns the 32-byte HMAC-SHA256 of the value, never the value itself', () => {
    const digest = new Pseudonymizer(KEY).digest('203.0.113.7');

    expect(digest).toHaveLength(32);
    expect(digest.equals(createHmac('sha256', KEY).update('203.0.113.7').digest())).toBe(true);
    expect(new Pseudonymizer(KEY).hex('203.0.113.7')).toBe(digest.toString('hex'));
  });

  it('depends on the key', () => {
    const other = new Pseudonymizer('another-test-only-key-0123456789abcdef');

    expect(other.hex('a@example.test')).not.toBe(new Pseudonymizer(KEY).hex('a@example.test'));
  });

  it('refuses a key shorter than 32 characters', () => {
    expect(() => new Pseudonymizer('short')).toThrow(/32/);
  });
});
