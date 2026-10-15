import { describe, expect, it } from 'vitest';

import { projectAccountCashflow } from './forecast-projector';

describe('forecast-projector domain', () => {
  const ACCOUNT_ID = '01927000-0000-7000-8000-000000000001';
  const START_DATE = '2026-10-15';
  const END_DATE = '2026-10-18'; // 4 days: 15, 16, 17, 18

  it('projects balance with zero occurrences unchanged', () => {
    const result = projectAccountCashflow({
      accountId: ACCOUNT_ID,
      accountName: 'Compte Principal',
      currency: 'XOF',
      currentBalanceMinor: 100_000n,
      startDate: START_DATE,
      endDate: END_DATE,
      occurrences: [],
    });

    expect(result.accountId).toBe(ACCOUNT_ID);
    expect(result.currentBalanceMinor).toBe('100000');
    expect(result.projectedEndBalanceMinor).toBe('100000');
    expect(result.lowestProjectedBalanceMinor).toBe('100000');
    expect(result.hasProjectedNegative).toBe(false);
    expect(result.points).toHaveLength(4);
    expect(result.points[0]).toEqual({
      date: '2026-10-15',
      realisedBalanceMinor: '100000',
      projectedBalanceMinor: '100000',
      expectedInflowsMinor: '0',
      expectedOutflowsMinor: '0',
    });
    expect(result.points[1]!.realisedBalanceMinor).toBeNull();
    expect(result.points[1]!.projectedBalanceMinor).toBe('100000');
  });

  it('applies EXPECTED income and expense occurrences to projected balance', () => {
    const occurrences = [
      // 16 oct : salaire attendu +200 000
      {
        dueOn: '2026-10-16',
        expectedAmountMinor: 200_000n,
        type: 'INCOME' as const,
        status: 'EXPECTED' as const,
      },
      // 17 oct : loyer attendu -150 000
      {
        dueOn: '2026-10-17',
        expectedAmountMinor: 150_000n,
        type: 'EXPENSE' as const,
        status: 'EXPECTED' as const,
      },
    ];

    const result = projectAccountCashflow({
      accountId: ACCOUNT_ID,
      accountName: 'Compte Principal',
      currency: 'XOF',
      currentBalanceMinor: 100_000n,
      startDate: START_DATE,
      endDate: END_DATE,
      occurrences,
    });

    expect(result.currentBalanceMinor).toBe('100000');
    // 15 oct: 100 000
    // 16 oct: 100 000 + 200 000 = 300 000
    // 17 oct: 300 000 - 150 000 = 150 000
    // 18 oct: 150 000
    expect(result.projectedEndBalanceMinor).toBe('150000');
    expect(result.lowestProjectedBalanceMinor).toBe('100000');
    expect(result.hasProjectedNegative).toBe(false);

    expect(result.points[1]!).toEqual({
      date: '2026-10-16',
      realisedBalanceMinor: null,
      projectedBalanceMinor: '300000',
      expectedInflowsMinor: '200000',
      expectedOutflowsMinor: '0',
    });
    expect(result.points[2]!).toEqual({
      date: '2026-10-17',
      realisedBalanceMinor: null,
      projectedBalanceMinor: '150000',
      expectedInflowsMinor: '0',
      expectedOutflowsMinor: '150000',
    });
  });

  it('detects negative projected balance (alert flag)', () => {
    const occurrences = [
      // 16 oct : gros paiement attendu -120 000 alors que solde = 100 000
      {
        dueOn: '2026-10-16',
        expectedAmountMinor: 120_000n,
        type: 'EXPENSE' as const,
        status: 'EXPECTED' as const,
      },
    ];

    const result = projectAccountCashflow({
      accountId: ACCOUNT_ID,
      accountName: 'Compte Principal',
      currency: 'XOF',
      currentBalanceMinor: 100_000n,
      startDate: START_DATE,
      endDate: END_DATE,
      occurrences,
    });

    expect(result.hasProjectedNegative).toBe(true);
    expect(result.lowestProjectedBalanceMinor).toBe('-20000');
    expect(result.projectedEndBalanceMinor).toBe('-20000');
  });

  it('strictly ignores CONFIRMED and SKIPPED occurrences (prevents double counting)', () => {
    const occurrences = [
      {
        dueOn: '2026-10-16',
        expectedAmountMinor: 50_000n,
        type: 'INCOME' as const,
        status: 'CONFIRMED' as const, // Already realised!
      },
      {
        dueOn: '2026-10-17',
        expectedAmountMinor: 30_000n,
        type: 'EXPENSE' as const,
        status: 'SKIPPED' as const, // Ignored
      },
    ];

    const result = projectAccountCashflow({
      accountId: ACCOUNT_ID,
      accountName: 'Compte Principal',
      currency: 'XOF',
      currentBalanceMinor: 100_000n,
      startDate: START_DATE,
      endDate: END_DATE,
      occurrences,
    });

    expect(result.projectedEndBalanceMinor).toBe('100000');
    expect(result.points[1]!.expectedInflowsMinor).toBe('0');
    expect(result.points[2]!.expectedOutflowsMinor).toBe('0');
  });

  it('optionally integrates debts when includeDebts is enabled', () => {
    const debts = [
      // Échéance de dette à payer le 17 oct: 40 000
      {
        dueDate: '2026-10-17',
        remainingMinor: 40_000n,
        type: 'PAYABLE' as const,
      },
      // Créance à recevoir le 16 oct: 10 000
      {
        dueDate: '2026-10-16',
        remainingMinor: 10_000n,
        type: 'RECEIVABLE' as const,
      },
    ];

    const result = projectAccountCashflow({
      accountId: ACCOUNT_ID,
      accountName: 'Compte Principal',
      currency: 'XOF',
      currentBalanceMinor: 100_000n,
      startDate: START_DATE,
      endDate: END_DATE,
      occurrences: [],
      debts,
    });

    // 15 oct: 100 000
    // 16 oct: 100 000 + 10 000 = 110 000
    // 17 oct: 110 000 - 40 000 = 70 000
    expect(result.projectedEndBalanceMinor).toBe('70000');
    expect(result.points[1]!.expectedInflowsMinor).toBe('10000');
    expect(result.points[2]!.expectedOutflowsMinor).toBe('40000');
  });
});
