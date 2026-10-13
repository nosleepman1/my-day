import { describe, expect, it } from 'vitest';

import { defaultDisplayName, isRegistrationAllowed, normalizeEmail } from '../domain/registration';

describe('normalizeEmail (SECURITY.md §3.4)', () => {
  it('trims, lowercases local part and domain, and applies NFC', () => {
    expect(normalizeEmail('  Aminata.Diop@Example.TEST ')).toBe('aminata.diop@example.test');
    expect(normalizeEmail('Adéla@example.test')).toBe('adéla@example.test');
  });
});

describe('isRegistrationAllowed (ADR-026)', () => {
  const allowlist = new Set(['abdou@example.test']);

  it('refuses everybody in closed mode', () => {
    expect(isRegistrationAllowed('closed', allowlist, 'abdou@example.test')).toBe(false);
  });

  it('accepts only listed addresses in allowlist mode', () => {
    expect(isRegistrationAllowed('allowlist', allowlist, 'abdou@example.test')).toBe(true);
    expect(isRegistrationAllowed('allowlist', allowlist, 'other@example.test')).toBe(false);
  });

  it('accepts everybody in open mode', () => {
    expect(isRegistrationAllowed('open', new Set(), 'anyone@example.test')).toBe(true);
  });
});

describe('defaultDisplayName', () => {
  it('uses the local part of the address, capped at 80 characters', () => {
    expect(defaultDisplayName('aminata.diop@example.test')).toBe('aminata.diop');
    expect(defaultDisplayName(`${'a'.repeat(100)}@example.test`)).toHaveLength(80);
  });
});
