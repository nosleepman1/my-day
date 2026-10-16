import type { DebtStatus, DebtType, SettlementStatus } from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';

export type RepaymentEntry = Readonly<{
  amountMinor: bigint;
  transactionStatus?: 'PENDING' | 'VALIDATED' | 'CANCELLED';
}>;

/**
 * Calcule le solde restant d'une dette selon DATA_MODEL.md §3.5 et cahier §6.3 :
 * remaining = principal_minor − Σ debt_repayments.amount_minor (transactions VALIDATED uniquement).
 */
export function computeDebtRemaining(
  principalMinor: bigint,
  repayments: readonly (RepaymentEntry | bigint)[],
): bigint {
  const totalValidated = repayments.reduce((sum: bigint, item) => {
    if (typeof item === 'bigint') {
      return sum + item;
    }
    if (item.transactionStatus === undefined || item.transactionStatus === 'VALIDATED') {
      return sum + item.amountMinor;
    }
    return sum;
  }, 0n);

  const remaining = principalMinor - totalValidated;
  return remaining > 0n ? remaining : 0n;
}

/**
 * Dérive l'état de règlement d'une dette (UNPAID, PARTIALLY_SETTLED, SETTLED).
 * Jamais persisté : dérivé à la volée.
 */
export function deriveSettlementStatus(principalMinor: bigint, remainingMinor: bigint): SettlementStatus {
  if (remainingMinor <= 0n) {
    return 'SETTLED';
  }
  if (remainingMinor >= principalMinor) {
    return 'UNPAID';
  }
  return 'PARTIALLY_SETTLED';
}

/**
 * Détermine si une dette est en retard selon ADR-020 et FINANCE_RULES.md §11.2 :
 * is_overdue = due_date < todayCivil ET remaining > 0 ET status = 'OPEN'.
 * L'échéance du jour même n'est pas en retard.
 */
export function isDebtOverdue(params: {
  dueDate: string | null;
  remainingMinor: bigint;
  status: DebtStatus;
  todayCivil: string;
}): boolean {
  const { dueDate, remainingMinor, status, todayCivil } = params;
  if (!dueDate || remainingMinor <= 0n || status !== 'OPEN') {
    return false;
  }
  return dueDate < todayCivil;
}

export type RepaymentValidationResult = Readonly<{
  valid: boolean;
  error?: 'OVERPAYMENT_REFUSED' | 'INVALID_AMOUNT';
}>;

/**
 * Valide qu'un remboursement ne dépasse pas le restant dû (défaut REFUSE, FINANCE_RULES.md §8.4).
 */
export function validateRepaymentAmount(
  remainingMinor: bigint,
  repaymentAmountMinor: bigint,
): RepaymentValidationResult {
  if (repaymentAmountMinor <= 0n) {
    return { valid: false, error: 'INVALID_AMOUNT' };
  }
  if (repaymentAmountMinor > remainingMinor) {
    return { valid: false, error: 'OVERPAYMENT_REFUSED' };
  }
  return { valid: true };
}

/**
 * Valide qu'un remboursement peut être effectué, lève un DomainError si invalide.
 */
export function assertCanRepayDebt(remainingMinor: bigint, repaymentAmountMinor: bigint): void {
  const result = validateRepaymentAmount(remainingMinor, repaymentAmountMinor);
  if (!result.valid) {
    if (result.error === 'OVERPAYMENT_REFUSED') {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Le montant du remboursement dépasse le restant dû.');
    }
    throw new DomainError('VALIDATION_FAILED', 'Le montant du remboursement doit être strictement positif.');
  }
}

/**
 * Valide l'annulation d'une dette (FINANCE_RULES §6.6 / FIN-40).
 */
export function assertCanCancelDebt(params: { status: DebtStatus; hasValidatedRepayments: boolean }): void {
  if (params.status !== 'OPEN') {
    throw new DomainError('INVALID_STATE_TRANSITION', "La dette n'est plus ouverte.");
  }
  if (params.hasValidatedRepayments) {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      "Impossible d'annuler une dette ayant des remboursements validés.",
    );
  }
}

/**
 * Valide le passage en perte d'une créance (FINANCE_RULES §6.6 / FIN-40).
 */
export function assertCanWriteOffDebt(params: { type: DebtType; status: DebtStatus; reason?: string }): void {
  if (params.status !== 'OPEN') {
    throw new DomainError('INVALID_STATE_TRANSITION', "La dette n'est plus ouverte.");
  }
  if (params.type !== 'RECEIVABLE') {
    throw new DomainError('BUSINESS_RULE_VIOLATION', 'Seule une créance peut être passée en perte.');
  }
  if (params.reason?.trim() === '') {
    throw new DomainError('VALIDATION_FAILED', 'Un motif est requis pour passer la créance en perte.');
  }
}
