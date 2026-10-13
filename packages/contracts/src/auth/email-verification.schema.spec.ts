import { describe, expect, it } from 'vitest';

import { EmailVerifiedResponseSchema, VerifyEmailRequestSchema } from './email-verification.schema';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd';

describe('VerifyEmailRequestSchema (API.md §14.3)', () => {
  it('accepts a base64url token', () => {
    expect(VerifyEmailRequestSchema.parse({ token: TOKEN })).toEqual({ token: TOKEN });
  });

  it.each([
    ['an empty token', { token: '' }],
    ['a too long token', { token: 'a'.repeat(129) }],
    ['a token with non base64url characters', { token: 'abc+def/ghi=' }],
    ['an unknown key', { token: TOKEN, email: 'a@example.test' }],
  ])('rejects %s', (_label, input) => {
    expect(VerifyEmailRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe('EmailVerifiedResponseSchema', () => {
  it('describes the 200 body', () => {
    expect(EmailVerifiedResponseSchema.parse({ data: { status: 'verified' } })).toEqual({
      data: { status: 'verified' },
    });
  });
});
