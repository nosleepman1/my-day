import { describe, expect, it } from 'vitest';

import { ipPrefix } from './ip-prefix';

describe('ipPrefix (SECURITY.md §3.2, minimisation)', () => {
  it.each([
    ['203.0.113.77', '203.0.113.0'],
    ['::ffff:127.0.0.1', '127.0.0.0'],
    ['2001:db8:abcd:12::1', '2001:db8:abcd::'],
    ['2001:0DB8:00AB:ffff:1:2:3:4', '2001:db8:ab::'],
    ['::1', '0:0:0::'],
    ['::1:2:3:4:5:6:7', '0:1:2::'],
    ['fe80::1%eth0', 'fe80:0:0::'],
  ])('truncates %s to %s', (ip, expected) => {
    expect(ipPrefix(ip)).toBe(expected);
  });

  it('returns null for a missing or invalid address', () => {
    expect(ipPrefix(null)).toBeNull();
    expect(ipPrefix('not-an-ip')).toBeNull();
  });
});
