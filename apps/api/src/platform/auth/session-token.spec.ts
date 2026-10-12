import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { generateOpaqueToken, hashOpaqueToken } from './session-token';

describe('opaque tokens (SECURITY.md §3.2)', () => {
  it('generates 256-bit base64url tokens with their SHA-256 hash', () => {
    const { token, hash } = generateOpaqueToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toHaveLength(32);
    expect(hash.equals(createHash('sha256').update(token).digest())).toBe(true);
  });

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateOpaqueToken().token));
    expect(tokens.size).toBe(200);
  });

  it('hashes a presented token deterministically', () => {
    const { token, hash } = generateOpaqueToken();
    expect(hashOpaqueToken(token).equals(hash)).toBe(true);
    expect(hashOpaqueToken(`${token}x`).equals(hash)).toBe(false);
  });
});
