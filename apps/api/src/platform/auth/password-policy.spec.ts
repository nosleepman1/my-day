import { describe, expect, it } from 'vitest';

import { checkPasswordPolicy, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './password-policy';

const EMAIL = 'aminata.diop@example.test';

describe('password policy (SECURITY.md §3.3)', () => {
  it('accepts a long passphrase, any Unicode allowed', () => {
    expect(checkPasswordPolicy('thiéboudienne au poisson 2026', EMAIL)).toEqual([]);
  });

  it('measures length in code points, not UTF-16 units', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(MAX_PASSWORD_LENGTH).toBe(128);
    expect(checkPasswordPolicy('🔒'.repeat(12), EMAIL)).toEqual([]);
    expect(checkPasswordPolicy('🔒'.repeat(11), EMAIL)).toEqual(['TOO_SHORT']);
  });

  it('rejects passwords that are too short or too long', () => {
    expect(checkPasswordPolicy('court-123', EMAIL)).toEqual(['TOO_SHORT']);
    expect(checkPasswordPolicy('a'.repeat(129), EMAIL)).toEqual(['TOO_LONG']);
  });

  it('rejects common passwords, case-insensitively', () => {
    expect(checkPasswordPolicy('Password1234', EMAIL)).toContain('COMMON');
    expect(checkPasswordPolicy('azertyuiop123', EMAIL)).toContain('COMMON');
  });

  it('rejects passwords containing the e-mail local part', () => {
    expect(checkPasswordPolicy('xx-Aminata.Diop-2026', EMAIL)).toContain('CONTAINS_EMAIL');
  });

  it('normalises to NFC before checking', () => {
    const decomposed = 'café café café';
    expect(checkPasswordPolicy(decomposed, EMAIL)).toEqual([]);
  });
});
