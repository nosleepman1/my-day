import { describe, expect, it } from 'vitest';

import { formatRecurrence, nextOccurrence, parseRecurrence, type Recurrence } from './recurrence';

function rule(text: string): Recurrence {
  const parsed = parseRecurrence(text);
  if (parsed === null) throw new Error(`invalid rule ${text}`);
  return parsed;
}

/** Les `n` premières dates de la série à partir de l'ancrage. */
function series(text: string, anchor: string, n: number): string[] {
  const parsed = rule(text);
  const dates = [anchor];
  while (dates.length < n) {
    const next = nextOccurrence(parsed, anchor, dates.at(-1) ?? anchor, dates.length);
    if (next === null) break;
    dates.push(next);
  }
  return dates;
}

describe('parseRecurrence', () => {
  it.each([
    'FREQ=DAILY',
    'FREQ=DAILY;INTERVAL=3',
    'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    'FREQ=MONTHLY;BYMONTHDAY=31',
    'FREQ=YEARLY;COUNT=5',
    'FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231',
  ])('accepts %s and formats it back identically', (text) => {
    expect(formatRecurrence(rule(text))).toBe(text);
  });

  it.each([
    'FREQ=HOURLY',
    'INTERVAL=2;FREQ=DAILY',
    'FREQ=DAILY;INTERVAL=0',
    'FREQ=DAILY;INTERVAL=100',
    'FREQ=DAILY;BYDAY=MO',
    'FREQ=WEEKLY;BYDAY=XX',
    'FREQ=WEEKLY;BYDAY=MO,MO',
    'FREQ=MONTHLY;BYMONTHDAY=32',
    'FREQ=DAILY;COUNT=3;UNTIL=20261231',
    'FREQ=DAILY;UNTIL=20260231',
    'FREQ=DAILY;INTERVAL=2;INTERVAL=3',
    'FREQ=DAILY;INTERVAL=2=3',
    `FREQ=DAILY;${'X'.repeat(300)}`,
  ])('rejects %s', (text) => {
    expect(parseRecurrence(text)).toBeNull();
  });
});

describe('nextOccurrence', () => {
  it('steps daily by the interval', () => {
    expect(series('FREQ=DAILY;INTERVAL=2', '2026-10-14', 3)).toEqual([
      '2026-10-14',
      '2026-10-16',
      '2026-10-18',
    ]);
  });

  it('jumps from a late completion to the next slot after it', () => {
    expect(nextOccurrence(rule('FREQ=DAILY;INTERVAL=3'), '2026-10-01', '2026-10-08', 1)).toBe('2026-10-10');
  });

  it('follows the weekdays of a weekly rule, every other week', () => {
    expect(series('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH', '2026-10-12', 5)).toEqual([
      '2026-10-12',
      '2026-10-15',
      '2026-10-26',
      '2026-10-29',
      '2026-11-09',
    ]);
  });

  it('defaults a weekly rule to the weekday of the anchor', () => {
    expect(series('FREQ=WEEKLY', '2026-10-14', 3)).toEqual(['2026-10-14', '2026-10-21', '2026-10-28']);
  });

  it('clamps a monthly day to the end of shorter months without drifting', () => {
    expect(series('FREQ=MONTHLY;BYMONTHDAY=31', '2026-01-31', 4)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('keeps 29 February in leap years and uses 28 February otherwise', () => {
    expect(series('FREQ=YEARLY', '2028-02-29', 5)).toEqual([
      '2028-02-29',
      '2029-02-28',
      '2030-02-28',
      '2031-02-28',
      '2032-02-29',
    ]);
  });

  it('stops after COUNT occurrences', () => {
    expect(series('FREQ=DAILY;COUNT=3', '2026-10-14', 10)).toEqual([
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
  });

  it('stops after UNTIL, inclusive', () => {
    expect(series('FREQ=WEEKLY;UNTIL=20261028', '2026-10-14', 10)).toEqual([
      '2026-10-14',
      '2026-10-21',
      '2026-10-28',
    ]);
  });

  it('crosses a year boundary', () => {
    expect(series('FREQ=MONTHLY', '2026-12-15', 2)).toEqual(['2026-12-15', '2027-01-15']);
  });
});
