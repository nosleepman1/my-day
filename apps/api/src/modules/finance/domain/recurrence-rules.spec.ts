import { describe, expect, it } from 'vitest';

import { generateOccurrences, isOccurrenceOverdue } from './recurrence-rules';

describe('recurrence-rules domain', () => {
  describe('generateOccurrences - MONTHLY', () => {
    it('generates monthly occurrences anchored on 15th', () => {
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=MONTHLY',
        anchorDate: '2026-10-15',
        fromDate: '2026-10-01',
        toDate: '2026-12-31',
      });
      expect(dates).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
    });

    it('handles anchor on 31st with short months (clamped to month end)', () => {
      // 31 oct -> 30 nov -> 31 dec -> 31 jan -> 28 feb 2027 (non-leap year)
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=MONTHLY',
        anchorDate: '2026-10-31',
        fromDate: '2026-10-01',
        toDate: '2027-03-01',
      });
      expect(dates).toEqual(['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
    });

    it('handles leap year on 29th of February (anchor on 29th)', () => {
      // 2028 is a leap year; 2027 is not.
      const nonLeap = generateOccurrences({
        recurrenceRule: 'FREQ=MONTHLY',
        anchorDate: '2027-01-29',
        fromDate: '2027-02-01',
        toDate: '2027-02-28',
      });
      expect(nonLeap).toEqual(['2027-02-28']);

      const leap = generateOccurrences({
        recurrenceRule: 'FREQ=MONTHLY',
        anchorDate: '2028-01-29',
        fromDate: '2028-02-01',
        toDate: '2028-02-29',
      });
      expect(leap).toEqual(['2028-02-29']);
    });

    it('respects INTERVAL=2 (bimonthly)', () => {
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=MONTHLY;INTERVAL=2',
        anchorDate: '2026-10-01',
        fromDate: '2026-10-01',
        toDate: '2027-03-31',
      });
      expect(dates).toEqual(['2026-10-01', '2026-12-01', '2027-02-01']);
    });

    it('respects BYMONTHDAY=-1 (last day of month)', () => {
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=-1',
        anchorDate: '2026-10-01',
        fromDate: '2026-10-01',
        toDate: '2026-12-31',
      });
      expect(dates).toEqual(['2026-10-31', '2026-11-30', '2026-12-31']);
    });
  });

  describe('generateOccurrences - WEEKLY', () => {
    it('generates weekly occurrences with interval 1', () => {
      // 2026-10-05 is a Monday
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=WEEKLY',
        anchorDate: '2026-10-05',
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
      });
      expect(dates).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    });

    it('generates biweekly occurrences with INTERVAL=2', () => {
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2',
        anchorDate: '2026-10-05',
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
      });
      expect(dates).toEqual(['2026-10-05', '2026-10-19']);
    });
  });

  describe('generateOccurrences - QUARTERLY & YEARLY', () => {
    it('generates quarterly occurrences (every 3 months)', () => {
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=QUARTERLY',
        anchorDate: '2026-10-01',
        fromDate: '2026-10-01',
        toDate: '2027-10-01',
      });
      expect(dates).toEqual(['2026-10-01', '2027-01-01', '2027-04-01', '2027-07-01', '2027-10-01']);
    });

    it('generates yearly occurrences', () => {
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=YEARLY',
        anchorDate: '2026-10-15',
        fromDate: '2026-01-01',
        toDate: '2029-12-31',
      });
      expect(dates).toEqual(['2026-10-15', '2027-10-15', '2028-10-15', '2029-10-15']);
    });
  });

  describe('generateOccurrences - Limits (COUNT & UNTIL)', () => {
    it('stops generating once COUNT is reached', () => {
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=MONTHLY;COUNT=3',
        anchorDate: '2026-10-01',
        fromDate: '2026-10-01',
        toDate: '2027-12-31',
      });
      expect(dates).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
    });

    it('stops generating at UNTIL date', () => {
      const dates = generateOccurrences({
        recurrenceRule: 'FREQ=MONTHLY;UNTIL=20261115',
        anchorDate: '2026-10-01',
        fromDate: '2026-10-01',
        toDate: '2027-12-31',
      });
      expect(dates).toEqual(['2026-10-01', '2026-11-01']);
    });
  });

  describe('isOccurrenceOverdue', () => {
    const TODAY = '2026-10-15';

    it('is overdue if status is EXPECTED and dueOn is before today', () => {
      expect(isOccurrenceOverdue({ dueOn: '2026-10-14', status: 'EXPECTED', todayCivil: TODAY })).toBe(true);
    });

    it('is NOT overdue if dueOn is today', () => {
      expect(isOccurrenceOverdue({ dueOn: TODAY, status: 'EXPECTED', todayCivil: TODAY })).toBe(false);
    });

    it('is NOT overdue if dueOn is in the future', () => {
      expect(isOccurrenceOverdue({ dueOn: '2026-10-16', status: 'EXPECTED', todayCivil: TODAY })).toBe(false);
    });

    it('is NOT overdue if status is CONFIRMED or SKIPPED', () => {
      expect(isOccurrenceOverdue({ dueOn: '2026-10-01', status: 'CONFIRMED', todayCivil: TODAY })).toBe(
        false,
      );
      expect(isOccurrenceOverdue({ dueOn: '2026-10-01', status: 'SKIPPED', todayCivil: TODAY })).toBe(false);
    });
  });
});
