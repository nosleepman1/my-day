import { describe, expect, it } from 'vitest';

import {
  availableTimeZones,
  deviceTimeZone,
  formatCivilDate,
  formatInstant,
  parseCivilDate,
  todayInZone,
} from './dates';

describe('dates', () => {
  it('parses a valid civil date and rejects impossible ones', () => {
    expect(parseCivilDate('2026-10-13')).toEqual({ year: 2026, month: 10, day: 13 });
    expect(() => parseCivilDate('2026-02-30')).toThrow(RangeError);
    expect(() => parseCivilDate('13/10/2026')).toThrow(RangeError);
  });

  it.each([
    ['dd/MM/yyyy', '05/03/2026'],
    ['yyyy-MM-dd', '2026-03-05'],
    ['MM/dd/yyyy', '03/05/2026'],
  ] as const)('formats a civil date as %s', (format, expected) => {
    expect(formatCivilDate('2026-03-05', format)).toBe(expected);
  });

  it('formats an instant in the user time zone, not the device one (ADR-023)', () => {
    const iso = '2026-10-13T23:30:00.000Z';

    expect(formatInstant(iso, 'Africa/Dakar')).toBe('13/10/2026 23:30');
    expect(formatInstant(iso, 'Europe/Paris')).toBe('14/10/2026 01:30');
    expect(formatInstant(iso, 'America/New_York', 'yyyy-MM-dd')).toBe('2026-10-13 19:30');
    expect(() => formatInstant('not-a-date', 'Africa/Dakar')).toThrow(RangeError);
  });

  it('computes today in a given time zone', () => {
    const now = new Date('2026-10-13T23:30:00.000Z');

    expect(todayInZone('Africa/Dakar', now)).toBe('2026-10-13');
    expect(todayInZone('Asia/Tokyo', now)).toBe('2026-10-14');
  });

  it('lists time zones including Africa/Dakar and exposes the device zone', () => {
    expect(availableTimeZones()).toContain('Africa/Dakar');
    expect(deviceTimeZone()).toEqual(expect.any(String));
  });
});
