import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors/domain-error';

import { Argon2PasswordHasher, PRODUCTION_ARGON2_PARAMS, type Argon2Params } from './argon2-password-hasher';

/** Paramètres réduits pour des tests rapides ; la production utilise PRODUCTION_ARGON2_PARAMS (ADR-006). */
const FAST: Argon2Params = { memoryCost: 1024, timeCost: 1, parallelism: 1 };

describe('Argon2PasswordHasher (ADR-006, SECURITY.md §3.3)', () => {
  it('uses argon2id with m=64 MiB, t=3, p=1 in production', () => {
    expect(PRODUCTION_ARGON2_PARAMS).toEqual({ memoryCost: 65_536, timeCost: 3, parallelism: 1 });
  });

  it('hashes to a PHC argon2id string and verifies it', async () => {
    const hasher = new Argon2PasswordHasher(FAST);
    const hash = await hasher.hash('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=1024,t=1,p=1\$/);
    await expect(hasher.verify(hash, 'correct horse battery staple')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'wrong horse battery staple')).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    const hasher = new Argon2PasswordHasher(FAST);
    expect(await hasher.hash('same password value')).not.toBe(await hasher.hash('same password value'));
  });

  it('normalises to NFC so that equivalent inputs match', async () => {
    const hasher = new Argon2PasswordHasher(FAST);
    const hash = await hasher.hash('café au lait chaud');
    await expect(hasher.verify(hash, 'café au lait chaud')).resolves.toBe(true);
  });

  it('flags hashes made with other parameters for transparent rehash', async () => {
    const old = await new Argon2PasswordHasher(FAST).hash('rotate me please');
    const current = new Argon2PasswordHasher({ ...FAST, timeCost: 2 });
    expect(current.needsRehash(old)).toBe(true);
    expect(current.needsRehash(await current.hash('rotate me please'))).toBe(false);
  });

  it('returns false for a malformed stored hash instead of throwing', async () => {
    await expect(new Argon2PasswordHasher(FAST).verify('not-a-hash', 'whatever value')).resolves.toBe(false);
  });

  it('burns comparable time on a dummy hash for unknown accounts', async () => {
    await expect(new Argon2PasswordHasher(FAST).verifyAgainstDummy('any password at all')).resolves.toBe(
      false,
    );
  });

  it('answers SERVICE_UNAVAILABLE when the hashing queue is saturated', async () => {
    const hasher = new Argon2PasswordHasher(
      { memoryCost: 8192, timeCost: 3, parallelism: 1 },
      { maxConcurrent: 1, queueTimeoutMs: 1 },
    );
    const results = await Promise.allSettled([hasher.hash('first password'), hasher.hash('second password')]);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(DomainError);
    expect(rejected?.status === 'rejected' && (rejected.reason as DomainError).code).toBe(
      'SERVICE_UNAVAILABLE',
    );
  });
});
