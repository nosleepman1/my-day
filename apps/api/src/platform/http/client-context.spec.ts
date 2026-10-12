import { describe, expect, it } from 'vitest';

import { clientContextFrom } from './client-context';

describe('clientContextFrom', () => {
  it('returns the client IP resolved by Express and the user agent', () => {
    expect(
      clientContextFrom({ ip: '203.0.113.7', headers: { 'user-agent': 'Mozilla/5.0 Firefox/131.0' } }),
    ).toEqual({ ip: '203.0.113.7', userAgent: 'Mozilla/5.0 Firefox/131.0' });
  });

  it('keeps IPv6 and IPv4-mapped addresses', () => {
    expect(clientContextFrom({ ip: '::ffff:127.0.0.1', headers: {} }).ip).toBe('::ffff:127.0.0.1');
    expect(clientContextFrom({ ip: '2001:db8::1', headers: {} }).ip).toBe('2001:db8::1');
  });

  it('drops anything that is not an IP address', () => {
    expect(clientContextFrom({ ip: 'unknown', headers: {} }).ip).toBeNull();
    expect(clientContextFrom({ ip: undefined, headers: {} }).ip).toBeNull();
  });

  it('truncates the user agent to 200 characters and strips control characters', () => {
    const long = clientContextFrom({ ip: undefined, headers: { 'user-agent': 'A'.repeat(500) } });
    const dirty = clientContextFrom({ ip: undefined, headers: { 'user-agent': 'Bad\r\nAgent\u0000' } });

    expect(long.userAgent).toHaveLength(200);
    expect(dirty.userAgent).toBe('BadAgent');
  });

  it('returns null for a missing or blank user agent', () => {
    expect(clientContextFrom({ ip: undefined, headers: {} }).userAgent).toBeNull();
    expect(clientContextFrom({ ip: undefined, headers: { 'user-agent': '   ' } }).userAgent).toBeNull();
  });
});
