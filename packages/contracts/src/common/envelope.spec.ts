import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { dataEnvelope, ErrorResponseSchema, listEnvelope } from './envelope';

describe('response envelopes (API.md §4)', () => {
  it('wraps a single resource in data', () => {
    const schema = dataEnvelope(z.object({ status: z.literal('ok') }));
    expect(schema.parse({ data: { status: 'ok' } })).toEqual({ data: { status: 'ok' } });
    expect(() => schema.parse({ status: 'ok' })).toThrow();
  });

  it('wraps a list with cursor metadata', () => {
    const schema = listEnvelope(z.object({ id: z.string() }));
    const page = { data: [{ id: 'a' }], meta: { limit: 25, nextCursor: null, hasMore: false } };
    expect(schema.parse(page)).toEqual(page);
  });

  it('describes the error body (API.md §5.1)', () => {
    const body = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'La requête contient des champs invalides.',
        details: [
          { path: ['amountMinor'], code: 'invalid_string', message: 'Doit être une chaîne de chiffres.' },
        ],
        requestId: '0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f80',
      },
    };
    expect(ErrorResponseSchema.parse(body)).toEqual(body);
    expect(() => ErrorResponseSchema.parse({ error: { ...body.error, code: 'NOPE' } })).toThrow();
  });
});
