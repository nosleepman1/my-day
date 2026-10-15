import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';

import {
  assertAllowedTreatment,
  assertCategoryMatchesType,
  getEconomicImpact,
  resolveEconomicClass,
} from './economic-classification';

describe('economic-classification (FINANCE_RULES §4.1, §4.2)', () => {
  it('enforces allowed treatments per transaction type', () => {
    expect(() => {
      assertAllowedTreatment('INCOME', 'STANDARD');
    }).not.toThrow();
    expect(() => {
      assertAllowedTreatment('INCOME', 'GIFT');
    }).not.toThrow();
    expect(() => {
      assertAllowedTreatment('INCOME', 'DEBT_REPAYMENT');
    }).not.toThrow();
    expect(() => {
      assertAllowedTreatment('INCOME', 'CUSTOMER_CREDIT');
    }).not.toThrow();

    expect(() => {
      assertAllowedTreatment('EXPENSE', 'STANDARD');
    }).not.toThrow();
    expect(() => {
      assertAllowedTreatment('EXPENSE', 'DEBT_REPAYMENT');
    }).not.toThrow();
    expect(() => {
      assertAllowedTreatment('EXPENSE', 'GIFT');
    }).toThrow(DomainError);

    expect(() => {
      assertAllowedTreatment('TRANSFER', 'STANDARD');
    }).not.toThrow();
    expect(() => {
      assertAllowedTreatment('TRANSFER', 'GIFT');
    }).toThrow(DomainError);

    expect(() => {
      assertAllowedTreatment('ADJUSTMENT', 'STANDARD');
    }).not.toThrow();
    expect(() => {
      assertAllowedTreatment('ADJUSTMENT', 'DEBT_REPAYMENT');
    }).toThrow(DomainError);
  });

  it('enforces category kind matches transaction type', () => {
    expect(() => {
      assertCategoryMatchesType('INCOME', 'INCOME');
    }).not.toThrow();
    expect(() => {
      assertCategoryMatchesType('EXPENSE', 'EXPENSE');
    }).not.toThrow();
    expect(() => {
      assertCategoryMatchesType('INCOME', 'EXPENSE');
    }).toThrow(DomainError);
    expect(() => {
      assertCategoryMatchesType('EXPENSE', 'INCOME');
    }).toThrow(DomainError);
  });

  it('computes economic impact according to truth table (T1-T14)', () => {
    // T1: INCOME STANDARD
    const t1 = getEconomicImpact('INCOME', 'STANDARD', 50_000n);
    expect(t1.incomeImpactMinor).toBe(50_000n);
    expect(t1.expenseImpactMinor).toBe(0n);
    expect(t1.netPositionImpactMinor).toBe(50_000n);

    // T2: INCOME GIFT
    const t2 = getEconomicImpact('INCOME', 'GIFT', 50_000n);
    expect(t2.incomeImpactMinor).toBe(0n);
    expect(t2.expenseImpactMinor).toBe(0n);
    expect(t2.netPositionImpactMinor).toBe(50_000n);

    // T3: INCOME DEBT_REPAYMENT
    const t3 = getEconomicImpact('INCOME', 'DEBT_REPAYMENT', 50_000n);
    expect(t3.incomeImpactMinor).toBe(0n);
    expect(t3.expenseImpactMinor).toBe(0n);
    expect(t3.netPositionImpactMinor).toBe(0n);

    // T5: EXPENSE STANDARD
    const t5 = getEconomicImpact('EXPENSE', 'STANDARD', 25_000n);
    expect(t5.incomeImpactMinor).toBe(0n);
    expect(t5.expenseImpactMinor).toBe(25_000n);
    expect(t5.netPositionImpactMinor).toBe(-25_000n);

    // T6: EXPENSE DEBT_REPAYMENT
    const t6 = getEconomicImpact('EXPENSE', 'DEBT_REPAYMENT', 25_000n);
    expect(t6.incomeImpactMinor).toBe(0n);
    expect(t6.expenseImpactMinor).toBe(0n);
    expect(t6.netPositionImpactMinor).toBe(0n);

    // T7: TRANSFER
    const t7 = getEconomicImpact('TRANSFER', 'STANDARD', 100_000n);
    expect(t7.incomeImpactMinor).toBe(0n);
    expect(t7.expenseImpactMinor).toBe(0n);
    expect(t7.netPositionImpactMinor).toBe(0n);

    // T13: ADJUSTMENT CREDIT
    const t13 = getEconomicImpact('ADJUSTMENT', 'STANDARD', 5_000n, 'CREDIT');
    expect(t13.incomeImpactMinor).toBe(0n);
    expect(t13.expenseImpactMinor).toBe(0n);
    expect(t13.netPositionImpactMinor).toBe(5_000n);

    // T14: ADJUSTMENT DEBIT
    const t14 = getEconomicImpact('ADJUSTMENT', 'STANDARD', 5_000n, 'DEBIT');
    expect(t14.incomeImpactMinor).toBe(0n);
    expect(t14.expenseImpactMinor).toBe(0n);
    expect(t14.netPositionImpactMinor).toBe(-5_000n);
  });

  it('resolves economic class defaults properly', () => {
    expect(resolveEconomicClass('INCOME', 'STANDARD')).toBe('INCOME_OPERATING');
    expect(resolveEconomicClass('INCOME', 'GIFT')).toBe('INCOME_EXTRAORDINARY');
    expect(resolveEconomicClass('EXPENSE', 'STANDARD')).toBe('EXPENSE_OPERATING');
    expect(resolveEconomicClass('TRANSFER', 'STANDARD')).toBe('TRANSFER_INTERNAL');
    expect(resolveEconomicClass('ADJUSTMENT', 'STANDARD')).toBe('EXPENSE_EXTRAORDINARY');
    expect(resolveEconomicClass('EXPENSE', 'STANDARD', 'EXPENSE_ESSENTIAL')).toBe('EXPENSE_ESSENTIAL');
  });

  describe('property-based tests (fast-check)', () => {
    it('transfers and debt repayments never affect operational income or expense', () => {
      fc.assert(
        fc.property(fc.bigInt({ min: 1n, max: 1_000_000_000n }), (amount) => {
          const transferImpact = getEconomicImpact('TRANSFER', 'STANDARD', amount);
          expect(transferImpact.incomeImpactMinor).toBe(0n);
          expect(transferImpact.expenseImpactMinor).toBe(0n);
          expect(transferImpact.netPositionImpactMinor).toBe(0n);

          const debtRepaymentExpense = getEconomicImpact('EXPENSE', 'DEBT_REPAYMENT', amount);
          expect(debtRepaymentExpense.incomeImpactMinor).toBe(0n);
          expect(debtRepaymentExpense.expenseImpactMinor).toBe(0n);
          expect(debtRepaymentExpense.netPositionImpactMinor).toBe(0n);

          const debtRepaymentIncome = getEconomicImpact('INCOME', 'DEBT_REPAYMENT', amount);
          expect(debtRepaymentIncome.incomeImpactMinor).toBe(0n);
          expect(debtRepaymentIncome.expenseImpactMinor).toBe(0n);
          expect(debtRepaymentIncome.netPositionImpactMinor).toBe(0n);
        }),
      );
    });
  });
});
