import { describe, expect, it } from 'vitest';

import { LoginRequestSchema, LoginResponseSchema } from './login.schema';

const USER = {
  id: '01928f4e-8c2a-7b3d-9e4f-0123456789ab',
  email: 'aminata.diop@example.test',
  displayName: 'Aminata',
  role: 'USER',
  emailVerifiedAt: '2026-10-12T09:30:00.000Z',
  mfaEnabled: false,
};

describe('LoginRequestSchema (API.md §14.3)', () => {
  it('accepts e-mail and password', () => {
    const input = { email: 'aminata.diop@example.test', password: 'x' };
    expect(LoginRequestSchema.parse(input)).toEqual(input);
  });

  it.each([
    ['an invalid e-mail', { email: 'nope', password: 'x' }],
    ['an empty password', { email: 'a@example.test', password: '' }],
    ['an oversized password', { email: 'a@example.test', password: 'a'.repeat(1_025) }],
    ['an unknown key', { email: 'a@example.test', password: 'x', remember: true }],
  ])('rejects %s', (_label, input) => {
    expect(LoginRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe('LoginResponseSchema', () => {
  it('describes { data: { user, mfaRequired } }', () => {
    expect(LoginResponseSchema.parse({ data: { user: USER, mfaRequired: false } })).toEqual({
      data: { user: USER, mfaRequired: false },
    });
  });

  it('never lets an unexpected field (password hash) through', () => {
    const parsed = LoginResponseSchema.parse({
      data: { user: { ...USER, passwordHash: '$argon2id$…' }, mfaRequired: false },
    });
    expect(parsed.data.user).not.toHaveProperty('passwordHash');
  });
});
