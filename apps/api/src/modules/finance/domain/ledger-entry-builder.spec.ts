import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';

import { buildStandardLedgerEntries, buildTransferLedgerEntries } from './ledger-entry-builder';

const ACC_1 = '01927000-0000-7000-8000-000000000001';
const ACC_2 = '01927000-0000-7000-8000-000000000002';

describe('ledger-entry-builder (FINANCE_RULES §4.1, §4.2, §6)', () => {
  it('builds a CREDIT entry for INCOME', () => {
    const entries = buildStandardLedgerEntries({
      type: 'INCOME',
      accountId: ACC_1,
      accountCurrency: 'XOF',
      amountMinor: 50_000n,
      currency: 'XOF',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      accountId: ACC_1,
      direction: 'CREDIT',
      amountMinor: 50_000n,
      currency: 'XOF',
    });
  });

  it('builds a DEBIT entry for EXPENSE', () => {
    const entries = buildStandardLedgerEntries({
      type: 'EXPENSE',
      accountId: ACC_1,
      accountCurrency: 'EUR',
      amountMinor: 2_500n,
      currency: 'EUR',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      accountId: ACC_1,
      direction: 'DEBIT',
      amountMinor: 2_500n,
      currency: 'EUR',
    });
  });

  it('builds requested direction for ADJUSTMENT', () => {
    const creditAdjustment = buildStandardLedgerEntries({
      type: 'ADJUSTMENT',
      accountId: ACC_1,
      accountCurrency: 'XOF',
      amountMinor: 1_000n,
      currency: 'XOF',
      adjustmentDirection: 'CREDIT',
    });
    expect(creditAdjustment[0]?.direction).toBe('CREDIT');

    const debitAdjustment = buildStandardLedgerEntries({
      type: 'ADJUSTMENT',
      accountId: ACC_1,
      accountCurrency: 'XOF',
      amountMinor: 1_000n,
      currency: 'XOF',
      adjustmentDirection: 'DEBIT',
    });
    expect(debitAdjustment[0]?.direction).toBe('DEBIT');
  });

  it('rejects currency mismatch between transaction and account', () => {
    expect(() =>
      buildStandardLedgerEntries({
        type: 'INCOME',
        accountId: ACC_1,
        accountCurrency: 'XOF',
        amountMinor: 50_000n,
        currency: 'EUR',
      }),
    ).toThrow(DomainError);
  });

  it('rejects invalid or non-positive amounts', () => {
    expect(() =>
      buildStandardLedgerEntries({
        type: 'INCOME',
        accountId: ACC_1,
        accountCurrency: 'XOF',
        amountMinor: 0n,
        currency: 'XOF',
      }),
    ).toThrow(DomainError);

    expect(() =>
      buildStandardLedgerEntries({
        type: 'INCOME',
        accountId: ACC_1,
        accountCurrency: 'XOF',
        amountMinor: -100n,
        currency: 'XOF',
      }),
    ).toThrow(DomainError);

    expect(() =>
      buildStandardLedgerEntries({
        type: 'INCOME',
        accountId: ACC_1,
        accountCurrency: 'XOF',
        amountMinor: 10n ** 18n + 1n,
        currency: 'XOF',
      }),
    ).toThrow(DomainError);

    expect(() =>
      buildStandardLedgerEntries({
        type: 'ADJUSTMENT',
        accountId: ACC_1,
        accountCurrency: 'XOF',
        amountMinor: 100n,
        currency: 'XOF',
      }),
    ).toThrow(DomainError);

    expect(() =>
      buildStandardLedgerEntries({
        type: 'TRANSFER',
        accountId: ACC_1,
        accountCurrency: 'XOF',
        amountMinor: 100n,
        currency: 'XOF',
      }),
    ).toThrow(DomainError);
  });

  it('builds two balanced entries for a transfer', () => {
    const entries = buildTransferLedgerEntries({
      fromAccountId: ACC_1,
      fromAccountCurrency: 'EUR',
      fromAmountMinor: 10_000n,
      toAccountId: ACC_2,
      toAccountCurrency: 'XOF',
      toAmountMinor: 65_596n,
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      accountId: ACC_1,
      direction: 'DEBIT',
      amountMinor: 10_000n,
      currency: 'EUR',
    });
    expect(entries[1]).toEqual({
      accountId: ACC_2,
      direction: 'CREDIT',
      amountMinor: 65_596n,
      currency: 'XOF',
    });
  });

  it('rejects transfer towards the same account', () => {
    expect(() =>
      buildTransferLedgerEntries({
        fromAccountId: ACC_1,
        fromAccountCurrency: 'XOF',
        fromAmountMinor: 10_000n,
        toAccountId: ACC_1,
        toAccountCurrency: 'XOF',
        toAmountMinor: 10_000n,
      }),
    ).toThrow(DomainError);
  });

  describe('property-based tests (fast-check)', () => {
    it('always generates strictly positive ledger entries', () => {
      fc.assert(
        fc.property(fc.bigInt({ min: 1n, max: 1_000_000_000n }), (amount) => {
          const entries = buildStandardLedgerEntries({
            type: 'INCOME',
            accountId: ACC_1,
            accountCurrency: 'XOF',
            amountMinor: amount,
            currency: 'XOF',
          });
          expect(entries[0]?.amountMinor).toBeGreaterThan(0n);
          expect(entries[0]?.amountMinor).toBe(amount);
        }),
      );
    });
  });
});
