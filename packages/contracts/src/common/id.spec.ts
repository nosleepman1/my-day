import { describe, expect, it } from 'vitest';

import { UuidV7Schema } from './id';

describe('UuidV7Schema (ADR-011)', () => {
  it('accepts a UUIDv7', () => {
    expect(UuidV7Schema.parse('0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f80')).toBe(
      '0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f80',
    );
  });

  it.each(['3f1a2b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b', 'not-a-uuid', ''])('rejects %j', (value) => {
    expect(UuidV7Schema.safeParse(value).success).toBe(false);
  });
});
