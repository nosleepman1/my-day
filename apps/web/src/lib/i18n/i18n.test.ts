import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@orbit/contracts';

import { createI18n, resources } from '.';

describe('i18n', () => {
  it('has an errors.<CODE> message for every API error code (FRONTEND.md §3.5)', () => {
    const missing = Object.values(ErrorCode).filter((code) => !(code in resources.fr.errors));

    expect(missing).toEqual([]);
  });

  it('translates in French and interpolates values', () => {
    const i18n = createI18n();

    expect(i18n.language).toBe('fr');
    expect(i18n.t('errors:RATE_LIMITED', { seconds: 30 })).toBe('Trop de tentatives. Réessayez dans 30 s.');
    expect(i18n.t('actions.retry')).toBe('Réessayer');
  });
});
