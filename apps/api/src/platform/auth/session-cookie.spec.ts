import { describe, expect, it } from 'vitest';

import {
  SESSION_COOKIE,
  clearSessionCookie,
  readSessionToken,
  serializeSessionCookie,
} from './session-cookie';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE';

describe('session cookie (SECURITY.md §3.2)', () => {
  it('uses the __Host- prefix', () => {
    expect(SESSION_COOKIE).toBe('__Host-orbit_sid');
  });

  it('serialises the exact attributes, without Domain', () => {
    expect(serializeSessionCookie(TOKEN, 2_592_000)).toBe(
      `__Host-orbit_sid=${TOKEN}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax`,
    );
  });

  it('clears the cookie with Max-Age=0 and the same attributes', () => {
    expect(clearSessionCookie()).toBe('__Host-orbit_sid=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax');
  });

  it('reads the token among other cookies', () => {
    expect(readSessionToken(`theme=dark; __Host-orbit_sid=${TOKEN}; other=1`)).toBe(TOKEN);
  });

  it.each([
    ['no header', undefined],
    ['no session cookie', 'theme=dark'],
    ['a malformed token', '__Host-orbit_sid=abc'],
    ['a token with forbidden characters', `__Host-orbit_sid=${TOKEN.slice(0, 42)}+`],
    ['a cookie without the __Host- prefix', `orbit_sid=${TOKEN}`],
  ])('returns null for %s', (_label, header) => {
    expect(readSessionToken(header)).toBeNull();
  });
});
