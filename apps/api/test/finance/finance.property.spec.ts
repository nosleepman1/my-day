import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  assertSufficientFunds,
  calculateBalance,
  type LedgerEntryItem,
} from '../../src/modules/finance/domain/balance-calculator';
import { assertCanCancelTransaction } from '../../src/modules/finance/domain/cancellation-rules';
import {
  assertDestinationAmountMatches,
  convertCurrency,
} from '../../src/modules/finance/domain/fx-converter';
import {
  buildStandardLedgerEntries,
  buildTransferLedgerEntries,
} from '../../src/modules/finance/domain/ledger-entry-builder';
import { DomainError } from '../../src/platform/errors/domain-error';

describe('Finance property-based tests (fast-check) (PHASE-05 T16, ADR-008)', () => {
  describe('Invariant 1: Solde réalisé et prévisionnel pour toute suite d’écritures', () => {
    const entryArb: fc.Arbitrary<LedgerEntryItem> = fc.record({
      direction: fc.constantFrom<'CREDIT' | 'DEBIT'>('CREDIT', 'DEBIT'),
      amountMinor: fc.bigInt({ min: 1n, max: 1_000_000_000n }),
      status: fc.constantFrom<'VALIDATED' | 'PENDING' | 'CANCELLED'>('VALIDATED', 'PENDING', 'CANCELLED'),
    });

    it('solde réalisé = openingBalance + crédits validés − débits validés', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: -10_000_000_000n, max: 10_000_000_000n }),
          fc.array(entryArb, { minLength: 0, maxLength: 50 }),
          (openingBalance, entries) => {
            const result = calculateBalance(openingBalance, entries);

            let expectedRealised = openingBalance;
            let expectedProjected = openingBalance;

            for (const entry of entries) {
              if (entry.status === 'CANCELLED') {
                continue;
              }
              const signed = entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
              if (entry.status === 'VALIDATED') {
                expectedRealised += signed;
              }
              expectedProjected += signed;
            }

            expect(result.realisedMinor).toBe(expectedRealised);
            expect(result.projectedMinor).toBe(expectedProjected);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('les écritures CANCELLED n’ont aucun effet sur le solde réalisé ou prévisionnel', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 10_000_000_000n }),
          fc.array(entryArb, { minLength: 1, maxLength: 20 }),
          fc.array(entryArb, { minLength: 1, maxLength: 20 }),
          (openingBalance, activeEntries, cancelledEntries) => {
            const allCancelled: LedgerEntryItem[] = cancelledEntries.map((e) => ({
              ...e,
              status: 'CANCELLED' as const,
            }));

            const withCancelled = calculateBalance(openingBalance, [...activeEntries, ...allCancelled]);
            const withoutCancelled = calculateBalance(openingBalance, activeEntries);

            expect(withCancelled.realisedMinor).toBe(withoutCancelled.realisedMinor);
            expect(withCancelled.projectedMinor).toBe(withoutCancelled.projectedMinor);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Invariant 2: Conservation de la somme des soldes lors de transferts internes', () => {
    it('la somme des soldes de même devise est invariante lors de transferts sans frais', () => {
      fc.assert(
        fc.property(
          fc.array(fc.bigInt({ min: 100_000n, max: 10_000_000n }), { minLength: 2, maxLength: 6 }),
          fc.array(
            fc.record({
              fromIdx: fc.nat(),
              toIdx: fc.nat(),
              amountMinor: fc.bigInt({ min: 1n, max: 50_000n }),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          (initialBalances, transfers) => {
            const numAccounts = initialBalances.length;
            const currentBalances = [...initialBalances];

            const sumBefore = currentBalances.reduce((acc, val) => acc + val, 0n);

            for (const t of transfers) {
              const src = t.fromIdx % numAccounts;
              let dst = t.toIdx % numAccounts;
              if (src === dst) {
                dst = (dst + 1) % numAccounts;
              }

              const entries = buildTransferLedgerEntries({
                fromAccountId: `acc-${src}`,
                fromAccountCurrency: 'XOF',
                fromAmountMinor: t.amountMinor,
                toAccountId: `acc-${dst}`,
                toAccountCurrency: 'XOF',
                toAmountMinor: t.amountMinor,
              });

              expect(entries).toHaveLength(2);
              const debitEntry = entries.find((e) => e.direction === 'DEBIT')!;
              const creditEntry = entries.find((e) => e.direction === 'CREDIT')!;
              expect(debitEntry.amountMinor).toBe(creditEntry.amountMinor);

              currentBalances[src] = currentBalances[src]! - debitEntry.amountMinor;
              currentBalances[dst] = currentBalances[dst]! + creditEntry.amountMinor;
            }

            const sumAfter = currentBalances.reduce((acc, val) => acc + val, 0n);
            expect(sumAfter).toBe(sumBefore);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Invariant 3: Annulation ramène exactement au solde antérieur', () => {
    it('l’annulation d’une transaction validée rétablit fidèlement le solde précédent', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 1_000_000n, max: 50_000_000n }),
          fc.constantFrom<'CREDIT' | 'DEBIT'>('CREDIT', 'DEBIT'),
          fc.bigInt({ min: 1n, max: 500_000n }),
          (initialBalance, direction, amountMinor) => {
            const before = calculateBalance(initialBalance, []);
            expect(before.realisedMinor).toBe(initialBalance);

            const activeTxEntry: LedgerEntryItem = {
              direction,
              amountMinor,
              status: 'VALIDATED',
            };
            const during = calculateBalance(initialBalance, [activeTxEntry]);

            if (direction === 'CREDIT') {
              expect(during.realisedMinor).toBe(initialBalance + amountMinor);
            } else {
              expect(during.realisedMinor).toBe(initialBalance - amountMinor);
            }

            // Annulation
            assertCanCancelTransaction({
              currentStatus: 'VALIDATED',
              cancelReason: 'Annulation test de propriété',
            });

            const cancelledTxEntry: LedgerEntryItem = {
              ...activeTxEntry,
              status: 'CANCELLED',
            };
            const after = calculateBalance(initialBalance, [cancelledTxEntry]);

            expect(after.realisedMinor).toBe(before.realisedMinor);
            expect(after.projectedMinor).toBe(before.projectedMinor);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Invariant 4: Jamais de solde sous le plafond de découvert', () => {
    it('sans découvert autorisé, toute tentative de débit excédant le solde est rejetée', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 1_000_000n }),
          fc.bigInt({ min: 1n, max: 2_000_000n }),
          (currentBalance, debitAmount) => {
            const delta = -debitAmount;
            if (currentBalance + delta < 0n) {
              expect(() => {
                assertSufficientFunds(currentBalance, delta, false, 0n);
              }).toThrow(DomainError);
            } else {
              expect(() => {
                assertSufficientFunds(currentBalance, delta, false, 0n);
              }).not.toThrow();
              const newBalance = currentBalance + delta;
              expect(newBalance).toBeGreaterThanOrEqual(0n);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('avec découvert autorisé, le solde ne descend jamais sous -overdraftLimit', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 1_000_000n }),
          fc.bigInt({ min: 0n, max: 500_000n }),
          fc.bigInt({ min: 1n, max: 2_000_000n }),
          (currentBalance, overdraftLimit, debitAmount) => {
            const delta = -debitAmount;
            const minAllowed = -overdraftLimit;
            if (currentBalance + delta < minAllowed) {
              expect(() => {
                assertSufficientFunds(currentBalance, delta, true, overdraftLimit);
              }).toThrow(DomainError);
            } else {
              expect(() => {
                assertSufficientFunds(currentBalance, delta, true, overdraftLimit);
              }).not.toThrow();
              const newBalance = currentBalance + delta;
              expect(newBalance).toBeGreaterThanOrEqual(minAllowed);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Invariant 5: Propriétés de conversion de change et tolérance ±1', () => {
    it('convertCurrency est monotone par rapport au montant source pour un taux fixe', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 1n, max: 100_000_000n }),
          fc.bigInt({ min: 1n, max: 100_000_000n }),
          (src1, src2) => {
            const rate = '655.957';
            const smaller = src1 < src2 ? src1 : src2;
            const larger = src1 < src2 ? src2 : src1;

            const convSmaller = convertCurrency(smaller, 'EUR', 'XOF', rate);
            const convLarger = convertCurrency(larger, 'EUR', 'XOF', rate);

            expect(convSmaller).toBeLessThanOrEqual(convLarger);
            expect(convSmaller).toBeGreaterThanOrEqual(0n);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('assertDestinationAmountMatches accepte un écart de ±1 unité mineure et rejette au-delà', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 100n, max: 1_000_000n }),
          fc.constantFrom(-1n, 0n, 1n),
          (srcMinor, diff) => {
            const rateString = '655.957';
            const exactConverted = convertCurrency(srcMinor, 'EUR', 'XOF', rateString);
            const userSupplied = exactConverted + diff;

            expect(() => {
              assertDestinationAmountMatches({
                srcMinor,
                srcCurrency: 'EUR',
                destMinor: userSupplied,
                destCurrency: 'XOF',
                rateString,
              });
            }).not.toThrow();
          },
        ),
        { numRuns: 50 },
      );

      fc.assert(
        fc.property(
          fc.bigInt({ min: 100n, max: 1_000_000n }),
          fc.constantFrom(-5n, -2n, 2n, 5n),
          (srcMinor, diff) => {
            const rateString = '655.957';
            const exactConverted = convertCurrency(srcMinor, 'EUR', 'XOF', rateString);
            const userSupplied = exactConverted + diff;

            expect(() => {
              assertDestinationAmountMatches({
                srcMinor,
                srcCurrency: 'EUR',
                destMinor: userSupplied,
                destCurrency: 'XOF',
                rateString,
              });
            }).toThrow(DomainError);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Invariant 6: Immutabilité stricte des fonctions du domaine pur', () => {
    it('calculateBalance ne mute ni le tableau d’écritures ni les objets reçus', () => {
      const entry1: LedgerEntryItem = Object.freeze({
        direction: 'CREDIT',
        amountMinor: 50_000n,
        status: 'VALIDATED',
      });
      const entry2: LedgerEntryItem = Object.freeze({
        direction: 'DEBIT',
        amountMinor: 20_000n,
        status: 'PENDING',
      });
      const entries = Object.freeze([entry1, entry2]);

      expect(() => {
        calculateBalance(100_000n, entries);
      }).not.toThrow();
      expect(entries).toHaveLength(2);
      expect(entries[0]).toBe(entry1);
    });

    it('buildStandardLedgerEntries retourne un tableau neuf et ne mute pas l’entrée', () => {
      const input = Object.freeze({
        type: 'INCOME' as const,
        accountId: 'acc-1',
        accountCurrency: 'XOF' as const,
        amountMinor: 10_000n,
        currency: 'XOF' as const,
      });

      const entries = buildStandardLedgerEntries(input);
      expect(entries).toHaveLength(1);
      expect(Object.isFrozen(entries)).toBe(false);
    });
  });
});
