import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  assertCanRepayDebt,
  computeDebtRemaining,
  deriveSettlementStatus,
} from '../../src/modules/finance/domain/debt-rules';
import {
  projectAccountCashflow,
  type ProjectionOccurrenceInput,
} from '../../src/modules/finance/domain/forecast-projector';
import {
  generateOccurrences,
  type RecurrenceFrequency,
} from '../../src/modules/finance/domain/recurrence-rules';

describe('Finance property-based tests (fast-check) - Phase 06', () => {
  describe('Propriété 1: Invariant de remboursement et solde restant', () => {
    it('pour toute suite de remboursements acceptés, la somme des remboursements <= principal et restant >= 0', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 1000n, max: 1_000_000_000n }),
          fc.array(fc.bigInt({ min: 1n, max: 10_000_000n }), { minLength: 1, maxLength: 20 }),
          (principal, rawRepayments) => {
            const acceptedRepayments: bigint[] = [];
            let currentRemaining = principal;

            for (const r of rawRepayments) {
              if (r <= currentRemaining) {
                expect(() => {
                  assertCanRepayDebt(currentRemaining, r);
                }).not.toThrow();
                acceptedRepayments.push(r);
                currentRemaining -= r;
              }
            }

            const calculatedRemaining = computeDebtRemaining(principal, acceptedRepayments);
            const sumRepayments = acceptedRepayments.reduce((acc, v) => acc + v, 0n);

            expect(sumRepayments).toBeLessThanOrEqual(principal);
            expect(calculatedRemaining).toBeGreaterThanOrEqual(0n);
            expect(calculatedRemaining + sumRepayments).toBe(principal);

            const status = deriveSettlementStatus(principal, calculatedRemaining);
            if (calculatedRemaining === 0n) {
              expect(status).toBe('SETTLED');
            } else if (sumRepayments > 0n) {
              expect(status).toBe('PARTIALLY_SETTLED');
            } else {
              expect(status).toBe('UNPAID');
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Propriété 2: Idempotence absolue de la génération des occurrences', () => {
    const freqArb = fc.constantFrom<RecurrenceFrequency>('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
    const intervalArb = fc.integer({ min: 1, max: 4 });

    it('générer N fois pour les mêmes paramètres retourne rigoureusement le même ensemble sans doublons', () => {
      fc.assert(
        fc.property(
          freqArb,
          intervalArb,
          fc.date({ min: new Date('2026-01-01'), max: new Date('2026-06-30') }),
          (freq, interval, anchorDateObj) => {
            const anchorDate = anchorDateObj.toISOString().slice(0, 10);
            const recurrenceRule = `FREQ=${freq};INTERVAL=${interval}`;

            const run1 = generateOccurrences({
              recurrenceRule,
              anchorDate,
              fromDate: anchorDate,
              toDate: '2026-12-31',
            });

            const run2 = generateOccurrences({
              recurrenceRule,
              anchorDate,
              fromDate: anchorDate,
              toDate: '2026-12-31',
            });

            // Idempotence : run1 === run2
            expect(run1).toEqual(run2);

            // Pas de doublons dans les dates générées
            const uniqueDates = new Set(run1);
            expect(uniqueDates.size).toBe(run1.length);

            // Les dates sont strictement ordonnées chronologiquement
            for (let i = 0; i < run1.length - 1; i += 1) {
              const current = run1[i];
              const next = run1[i + 1];
              if (current && next) {
                expect(current < next).toBe(true);
              }
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Propriété 3: Linéarité de la projection de trésorerie', () => {
    const occArb: fc.Arbitrary<ProjectionOccurrenceInput> = fc.record({
      dueOn: fc.constantFrom('2026-11-01', '2026-11-15', '2026-12-01'),
      expectedAmountMinor: fc.bigInt({ min: 100n, max: 100_000n }),
      type: fc.constantFrom<'INCOME' | 'EXPENSE'>('INCOME', 'EXPENSE'),
      status: fc.constantFrom<'EXPECTED' | 'CONFIRMED' | 'SKIPPED'>('EXPECTED', 'CONFIRMED', 'SKIPPED'),
    });

    it('solde projeté = solde réalisé + entrées EXPECTED − sorties EXPECTED', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 10_000_000n }),
          fc.array(occArb, { minLength: 0, maxLength: 20 }),
          (currentBalance, occurrences) => {
            const result = projectAccountCashflow({
              accountId: '01928000-0000-7000-8000-000000000010',
              accountName: 'Test Account',
              currency: 'XOF',
              currentBalanceMinor: currentBalance,
              startDate: '2026-10-15',
              endDate: '2027-01-15',
              occurrences,
              debts: [],
            });

            let expectedEnd = currentBalance;
            for (const occ of occurrences) {
              if (occ.status === 'EXPECTED') {
                if (occ.type === 'INCOME') {
                  expectedEnd += occ.expectedAmountMinor;
                } else if (occ.type === 'EXPENSE') {
                  expectedEnd -= occ.expectedAmountMinor;
                }
              }
            }

            expect(BigInt(result.projectedEndBalanceMinor)).toBe(expectedEnd);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Propriété 4: Immutabilité stricte des fonctions pures de la Phase 06', () => {
    it('les structures reçues en entrée ne sont jamais mutées', () => {
      const repayments = Object.freeze([10_000n, 20_000n]);
      expect(() => {
        computeDebtRemaining(50_000n, repayments);
      }).not.toThrow();
      expect(repayments).toHaveLength(2);

      const occ: ProjectionOccurrenceInput = Object.freeze({
        dueOn: '2026-11-01',
        expectedAmountMinor: 5_000n,
        type: 'EXPENSE',
        status: 'EXPECTED',
      });
      const occurrencesList = Object.freeze([occ]);

      expect(() => {
        projectAccountCashflow({
          accountId: '01928000-0000-7000-8000-000000000010',
          accountName: 'Test Account',
          currency: 'XOF',
          currentBalanceMinor: 100_000n,
          startDate: '2026-10-15',
          endDate: '2026-12-31',
          occurrences: occurrencesList,
          debts: [],
        });
      }).not.toThrow();
      expect(occurrencesList).toHaveLength(1);
    });
  });
});
