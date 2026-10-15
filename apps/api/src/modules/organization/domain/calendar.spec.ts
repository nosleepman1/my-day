import { describe, expect, it } from 'vitest';

import { addDays, calendarSnapshot, civilDateIn, weekRange } from './calendar';
import { isOverdue } from './task-rules';

describe('user calendar (ADR-023)', () => {
  it.each([
    // Minuit à Dakar (UTC+0) : changement de jour exact.
    ['2026-10-14T23:59:59.000Z', 'Africa/Dakar', '2026-10-14'],
    ['2026-10-15T00:00:00.000Z', 'Africa/Dakar', '2026-10-15'],
    // Paris passe à l'heure d'été le 29 mars 2026 à 01:00 UTC.
    ['2026-03-28T22:59:00.000Z', 'Europe/Paris', '2026-03-28'],
    ['2026-03-28T23:00:00.000Z', 'Europe/Paris', '2026-03-29'],
    ['2026-03-29T21:59:00.000Z', 'Europe/Paris', '2026-03-29'],
    ['2026-03-29T22:00:00.000Z', 'Europe/Paris', '2026-03-30'],
    // New York repasse à l'heure d'hiver le 1er novembre 2026 à 06:00 UTC.
    ['2026-11-01T03:59:00.000Z', 'America/New_York', '2026-10-31'],
    ['2026-11-01T04:00:00.000Z', 'America/New_York', '2026-11-01'],
    ['2026-11-02T04:59:00.000Z', 'America/New_York', '2026-11-01'],
    ['2026-11-02T05:00:00.000Z', 'America/New_York', '2026-11-02'],
  ])('%s in %s is the civil day %s', (instant, timezone, expected) => {
    expect(civilDateIn(new Date(instant), timezone)).toBe(expected);
  });

  it('computes the week from the preferred first day', () => {
    // 2026-10-14 est un mercredi.
    expect(weekRange('2026-10-14', 1)).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(weekRange('2026-10-14', 7)).toEqual({ start: '2026-10-11', end: '2026-10-17' });
    expect(weekRange('2026-10-12', 1)).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(weekRange('2026-10-18', 1)).toEqual({ start: '2026-10-12', end: '2026-10-18' });
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('derives overdue from the user day, or from the due instant when there is one', () => {
    const calendar = calendarSnapshot(new Date('2026-10-14T22:30:00.000Z'), 'Europe/Paris', 1);
    expect(calendar.today).toBe('2026-10-15');
    expect(isOverdue({ status: 'TODO', dueDate: '2026-10-14', dueAt: null }, calendar)).toBe(true);
    expect(isOverdue({ status: 'TODO', dueDate: '2026-10-15', dueAt: null }, calendar)).toBe(false);
    expect(isOverdue({ status: 'DONE', dueDate: '2026-10-01', dueAt: null }, calendar)).toBe(false);
    expect(
      isOverdue(
        { status: 'TODO', dueDate: '2026-10-15', dueAt: new Date('2026-10-14T22:00:00.000Z') },
        calendar,
      ),
    ).toBe(true);
    expect(isOverdue({ status: 'BLOCKED', dueDate: null, dueAt: null }, calendar)).toBe(false);
  });
});
