import type { CategoryKind, EconomicClass, EntryDirection, TransactionType } from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';

export type TreatmentType = 'STANDARD' | 'GIFT' | 'DEBT_REPAYMENT' | 'CUSTOMER_CREDIT';

const ALLOWED_TREATMENTS: Readonly<Record<TransactionType, ReadonlySet<TreatmentType>>> = {
  INCOME: new Set(['STANDARD', 'GIFT', 'DEBT_REPAYMENT', 'CUSTOMER_CREDIT']),
  EXPENSE: new Set(['STANDARD', 'DEBT_REPAYMENT']),
  TRANSFER: new Set(['STANDARD']),
  ADJUSTMENT: new Set(['STANDARD']),
};

export function assertAllowedTreatment(type: TransactionType, treatment: TreatmentType): void {
  if (!ALLOWED_TREATMENTS[type].has(treatment)) {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      `Le traitement ${treatment} n'est pas autorisé pour le type ${type}.`,
      {
        type,
        treatment,
      },
    );
  }
}

export function assertCategoryMatchesType(
  categoryKind: CategoryKind,
  transactionType: TransactionType,
): void {
  if (transactionType === 'INCOME' && categoryKind !== 'INCOME') {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      'Une transaction de revenu requiert une catégorie de revenu.',
      {
        categoryKind,
        transactionType,
      },
    );
  }
  if (transactionType === 'EXPENSE' && categoryKind !== 'EXPENSE') {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      'Une transaction de dépense requiert une catégorie de dépense.',
      {
        categoryKind,
        transactionType,
      },
    );
  }
}

export interface EconomicImpact {
  readonly incomeImpactMinor: bigint;
  readonly expenseImpactMinor: bigint;
  readonly netPositionImpactMinor: bigint;
}

function getIncomeImpact(treatment: TreatmentType, amountMinor: bigint): EconomicImpact {
  if (treatment === 'STANDARD') {
    return { incomeImpactMinor: amountMinor, expenseImpactMinor: 0n, netPositionImpactMinor: amountMinor };
  }
  if (treatment === 'GIFT') {
    return { incomeImpactMinor: 0n, expenseImpactMinor: 0n, netPositionImpactMinor: amountMinor };
  }
  return { incomeImpactMinor: 0n, expenseImpactMinor: 0n, netPositionImpactMinor: 0n };
}

function getExpenseImpact(treatment: TreatmentType, amountMinor: bigint): EconomicImpact {
  if (treatment === 'STANDARD') {
    return { incomeImpactMinor: 0n, expenseImpactMinor: amountMinor, netPositionImpactMinor: -amountMinor };
  }
  return { incomeImpactMinor: 0n, expenseImpactMinor: 0n, netPositionImpactMinor: 0n };
}

function getAdjustmentImpact(amountMinor: bigint, direction?: EntryDirection): EconomicImpact {
  const sign = direction === 'CREDIT' ? amountMinor : -amountMinor;
  return { incomeImpactMinor: 0n, expenseImpactMinor: 0n, netPositionImpactMinor: sign };
}

/**
 * Calcule l'impact d'une transaction sur les revenus, dépenses opérationnelles et position nette
 * selon la table de vérité de FINANCE_RULES §4.2 (T1 à T14).
 */
export function getEconomicImpact(
  type: TransactionType,
  treatment: TreatmentType,
  amountMinor: bigint,
  direction?: EntryDirection,
): EconomicImpact {
  assertAllowedTreatment(type, treatment);

  switch (type) {
    case 'INCOME':
      return getIncomeImpact(treatment, amountMinor);
    case 'EXPENSE':
      return getExpenseImpact(treatment, amountMinor);
    case 'TRANSFER':
      return { incomeImpactMinor: 0n, expenseImpactMinor: 0n, netPositionImpactMinor: 0n };
    case 'ADJUSTMENT':
      return getAdjustmentImpact(amountMinor, direction);
  }
}

/**
 * Détermine la classe économique par défaut à partir du type et du traitement.
 */
export function resolveEconomicClass(
  type: TransactionType,
  treatment: TreatmentType,
  categoryDefaultClass?: EconomicClass,
): EconomicClass {
  if (categoryDefaultClass) {
    return categoryDefaultClass;
  }
  if (type === 'TRANSFER' || treatment === 'DEBT_REPAYMENT' || treatment === 'CUSTOMER_CREDIT') {
    return 'TRANSFER_INTERNAL';
  }
  if (type === 'INCOME') {
    return treatment === 'GIFT' ? 'INCOME_EXTRAORDINARY' : 'INCOME_OPERATING';
  }
  if (type === 'EXPENSE') {
    return 'EXPENSE_OPERATING';
  }
  // ADJUSTMENT
  return 'EXPENSE_EXTRAORDINARY';
}
