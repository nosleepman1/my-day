import { describe, expect, it } from 'vitest';

import { buildTokenLink } from './mail-links';

describe('buildTokenLink (SECURITY.md §3.4)', () => {
  it('puts the token in the URL fragment so it never reaches server logs or the Referer', () => {
    const link = buildTokenLink('https://orbit.example.com', '/verify-email', 'AbC-123_xyz');

    expect(link).toBe('https://orbit.example.com/verify-email#token=AbC-123_xyz');
    expect(new URL(link).search).toBe('');
  });

  it('encodes characters that are not URL-safe', () => {
    expect(buildTokenLink('http://localhost:5173', '/reset-password', 'a b&c')).toBe(
      'http://localhost:5173/reset-password#token=a%20b%26c',
    );
  });
});
