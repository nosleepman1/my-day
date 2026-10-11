import { describe, expect, it } from 'vitest';

import { CivilDateSchema, InstantSchema, TimezoneSchema } from './dates';

describe('date schemas (API.md §6.2)', () => {
  it.each(['2026-10-11T09:30:00.000Z', '2026-10-11T09:30:00+01:00'])('accepts the instant %j', (value) => {
    expect(InstantSchema.safeParse(value).success).toBe(true);
  });

  it.each(['2026-10-11T09:30:00', '2026-10-11', 'yesterday'])('rejects the instant %j', (value) => {
    expect(InstantSchema.safeParse(value).success).toBe(false);
  });

  it('accepts civil dates only in YYYY-MM-DD', () => {
    expect(CivilDateSchema.safeParse('2026-10-11').success).toBe(true);
    expect(CivilDateSchema.safeParse('2026-13-01').success).toBe(false);
    expect(CivilDateSchema.safeParse('11/10/2026').success).toBe(false);
  });

  it('accepts IANA time zones', () => {
    expect(TimezoneSchema.safeParse('Africa/Dakar').success).toBe(true);
    expect(TimezoneSchema.safeParse('Mars/Olympus').success).toBe(false);
  });
});
