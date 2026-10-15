import { describe, expect, it } from 'vitest';

import { UpdatePreferencesRequestSchema } from './me.schema';

describe('UpdatePreferencesRequestSchema (ADR-024)', () => {
  it('accepts a partial update', () => {
    const patch = {
      timezone: 'Europe/Paris',
      enabledModules: ['finance', 'tasks'],
      onboardingCompleted: true,
    };

    expect(UpdatePreferencesRequestSchema.parse(patch)).toEqual(patch);
  });

  it.each([
    ['an empty body', {}],
    ['an unknown time zone', { timezone: 'Mars/Olympus' }],
    ['an ADMIN-only module', { enabledModules: ['dev'] }],
    ['a duplicated module', { enabledModules: ['finance', 'finance'] }],
    ['an unsupported currency', { defaultCurrency: 'GBP' }],
    ['reopening the onboarding', { onboardingCompleted: false }],
    ['an unknown key', { role: 'ADMIN' }],
  ])('rejects %s', (_label, patch) => {
    expect(UpdatePreferencesRequestSchema.safeParse(patch).success).toBe(false);
  });
});
