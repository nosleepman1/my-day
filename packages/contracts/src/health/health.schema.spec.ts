import { describe, expect, it } from 'vitest';

import { HealthResponseSchema } from './health.schema';

describe('HealthResponseSchema', () => {
  it('exposes only the status, without version or internal detail', () => {
    expect(HealthResponseSchema.parse({ data: { status: 'ok' } })).toEqual({ data: { status: 'ok' } });
    expect(HealthResponseSchema.parse({ data: { status: 'ok', version: '1.0.0' } })).toEqual({
      data: { status: 'ok' },
    });
  });
});
