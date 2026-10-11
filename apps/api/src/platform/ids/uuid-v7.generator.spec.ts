import { describe, expect, it } from 'vitest';

import { UuidV7Schema } from '@orbit/contracts';

import { UuidV7Generator } from './uuid-v7.generator';

describe('UuidV7Generator (ADR-011)', () => {
  it('generates distinct, time-ordered UUIDv7 values', () => {
    const generator = new UuidV7Generator();
    const ids = Array.from({ length: 50 }, () => generator.next());
    for (const id of ids) expect(UuidV7Schema.safeParse(id).success).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });
});
