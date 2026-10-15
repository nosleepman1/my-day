import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';

import { assertSufficientFunds, calculateBalance, type LedgerEntryItem } from './balance-calculator';

describe('balance-calculator (FINANCE_RULES §3.2, §3.3)', () => {
  it('calculates realised and projected balances correctly', () => {
    const entries: LedgerEntryItem[] = [
      { direction: 'CREDIT', amountMinor: 100_000n, status: 'VALIDATED' },
      { direction: 'DEBIT', amountMinor: 30_000n, status: 'VALIDATED' },
      { direction: 'CREDIT', amountMinor: 20_000n, status: 'PENDING' },
      { direction: 'DEBIT', amountMinor: 10_000n, status: 'PENDING' },
      { direction: 'DEBIT', amountMinor: 50_000n, status: 'CANCELLED' },
    ];

    const result = calculateBalance(10_000n, entries);

    // Opening 10000 + 100000 - 30000 = 80000
    expect(result.realisedMinor).toBe(80_000n);
    // Realised 80000 + 20000 - 10000 = 90000 (CANCELLED 50000 ignored)
    expect(result.projectedMinor).toBe(90_000n);
  });

  it('allows zero delta and positive delta without overdraft', () => {
    expect(() => {
      assertSufficientFunds(50_000n, 0n, false);
    }).not.toThrow();
    expect(() => {
      assertSufficientFunds(50_000n, 10_000n, false);
    }).not.toThrow();
  });

  it('allows debit within current balance when overdraft not allowed', () => {
    expect(() => {
      assertSufficientFunds(50_000n, -50_000n, false);
    }).not.toThrow();
    expect(() => {
      assertSufficientFunds(50_000n, -40_000n, false);
    }).not.toThrow();
  });

  it('throws INSUFFICIENT_FUNDS when debit exceeds balance and overdraft not allowed', () => {
    expect(() => {
      assertSufficientFunds(50_000n, -50_001n, false);
    }).toThrow(DomainError);
    try {
      assertSufficientFunds(50_000n, -60_000n, false);
    } catch (err) {
      expect((err as DomainError).code).toBe('INSUFFICIENT_FUNDS');
      expect((err as DomainError).details).toEqual({
        available: '50000',
        required: '60000',
      });
    }
  });

  it('respects overdraft limit when overdraft is allowed', () => {
    // Current 10000, debit 25000 -> balance -15000. Limit 20000 -> allowed
    expect(() => {
      assertSufficientFunds(10_000n, -25_000n, true, 20_000n);
    }).not.toThrow();

    // Limit 20000, debit 35000 -> balance -25000 -> rejected
    expect(() => {
      assertSufficientFunds(10_000n, -35_000n, true, 20_000n);
    }).toThrow(DomainError);
  });

  it('throws BALANCE_OUT_OF_RANGE when balance exceeds BIGINT limits', () => {
    // Realised exceeds BIGINT_MAX
    expect(() =>
      calculateBalance(2n ** 63n - 1n, [{ direction: 'CREDIT', amountMinor: 1n, status: 'VALIDATED' }]),
    ).toThrow(DomainError);

    // Projected exceeds BIGINT_MAX
    expect(() =>
      calculateBalance(2n ** 63n - 1n, [{ direction: 'CREDIT', amountMinor: 1n, status: 'PENDING' }]),
    ).toThrow(DomainError);
  });

  describe('property-based tests (fast-check)', () => {
    it('realised balance equals opening balance plus sum of validated credits minus debits', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: -10_000_000n, max: 10_000_000n }),
          fc.array(
            fc.record({
              direction: fc.constantFrom<'CREDIT' | 'DEBIT'>('CREDIT', 'DEBIT'),
              amountMinor: fc.bigInt({ min: 1n, max: 1_000_000n }),
              status: fc.constantFrom<'PENDING' | 'VALIDATED' | 'CANCELLED'>(
                'PENDING',
                'VALIDATED',
                'CANCELLED',
              ),
            }),
            { maxLength: 50 },
          ),
          (opening, entries) => {
            const calculated = calculateBalance(opening, entries);

            let expectedRealised = opening;
            for (const e of entries) {
              if (e.status === 'VALIDATED') {
                expectedRealised += e.direction === 'CREDIT' ? e.amountMinor : -e.amountMinor;
              }
            }
            expect(calculated.realisedMinor).toBe(expectedRealised);
          },
        ),
      );
    });

    it('cancelled entries never impact realised or projected balances', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 1_000_000n }),
          fc.array(fc.bigInt({ min: 1n, max: 100_000n })),
          (opening, cancelledAmounts) => {
            const entries: LedgerEntryItem[] = cancelledAmounts.map((amt) => ({
              direction: 'DEBIT',
              amountMinor: amt,
              status: 'CANCELLED',
            }));
            const res = calculateBalance(opening, entries);
            expect(res.realisedMinor).toBe(opening);
            expect(res.projectedMinor).toBe(opening);
          },
        ),
      );
    });
  });
});
