import { describe, expect, it } from 'vitest';

import { USER_MODULES } from '../users/user-modules';

import {
  AcceptedResponseSchema,
  RegisterRequestSchema,
  ResendVerificationRequestSchema,
} from './registration.schema';

const VALID = { email: 'aminata.diop@example.test', password: 'thiéboudienne au poisson 2026' };

describe('RegisterRequestSchema (API.md §14.3)', () => {
  it('accepts e-mail and password, displayName being optional and trimmed', () => {
    expect(RegisterRequestSchema.parse(VALID)).toEqual(VALID);
    expect(RegisterRequestSchema.parse({ ...VALID, displayName: '  Aminata  ' }).displayName).toBe('Aminata');
  });

  it('trims the e-mail but leaves case normalisation to the server', () => {
    expect(RegisterRequestSchema.parse({ ...VALID, email: '  Aminata@Example.test ' }).email).toBe(
      'Aminata@Example.test',
    );
  });

  it.each([
    ['an invalid e-mail', { ...VALID, email: 'not-an-email' }],
    ['a too long e-mail', { ...VALID, email: `${'a'.repeat(250)}@example.test` }],
    ['an empty password', { ...VALID, password: '' }],
    ['an oversized password', { ...VALID, password: 'a'.repeat(1_025) }],
    ['an empty displayName', { ...VALID, displayName: '   ' }],
    ['a too long displayName', { ...VALID, displayName: 'a'.repeat(81) }],
    ['an unknown key', { ...VALID, role: 'ADMIN' }],
  ])('rejects %s', (_label, input) => {
    expect(RegisterRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe('ResendVerificationRequestSchema', () => {
  it('accepts only an e-mail', () => {
    expect(ResendVerificationRequestSchema.parse({ email: VALID.email })).toEqual({ email: VALID.email });
    expect(ResendVerificationRequestSchema.safeParse({ email: VALID.email, x: 1 }).success).toBe(false);
  });
});

describe('AcceptedResponseSchema', () => {
  it('describes the uniform 202 body', () => {
    expect(AcceptedResponseSchema.parse({ data: { status: 'accepted' } })).toEqual({
      data: { status: 'accepted' },
    });
  });
});

describe('USER_MODULES (ADR-024)', () => {
  it('lists the 16 user modules and never the ADMIN-only Dev area', () => {
    expect(USER_MODULES).toHaveLength(16);
    expect(new Set(USER_MODULES).size).toBe(16);
    expect(USER_MODULES).not.toContain('dev');
  });
});
