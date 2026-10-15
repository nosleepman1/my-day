import { describe, expect, it } from 'vitest';

import { normalizeEmail } from './email';

describe('normalizeEmail (SECURITY.md §3.4)', () => {
  it('trims, lowercases local part and domain, and applies NFC', () => {
    expect(normalizeEmail('  Aminata.Diop@Example.TEST ')).toBe('aminata.diop@example.test');
    expect(normalizeEmail('Adéla@example.test')).toBe('adéla@example.test');
  });

  it('is idempotent', () => {
    const once = normalizeEmail(' Abdou@Example.test');

    expect(normalizeEmail(once)).toBe(once);
  });
});
