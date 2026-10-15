import type { EntryDirection } from '@orbit/contracts';
import { MAX_AMOUNT_MINOR } from '@orbit/money';

import { DomainError } from '../../../platform/errors/domain-error';

export interface ValidAdjustmentParams {
  readonly amountMinor: bigint;
  readonly direction: EntryDirection;
  readonly reason: string;
}

export interface ReconciliationCalculation {
  readonly statementEndingBalanceMinor: bigint;
  readonly clearedBalanceMinor: bigint;
  readonly differenceMinor: bigint;
  readonly isBalanced: boolean;
  readonly adjustmentNeeded: {
    readonly direction: 'CREDIT' | 'DEBIT';
    readonly amountMinor: bigint;
  } | null;
}

/**
 * Valide les paramètres métier d'un ajustement de solde (FINANCE_RULES §4.1, §4.4).
 * - Montant strictement positif (aucun ajustement à montant nul : FIN-xx / FINANCE_RULES §4.4).
 * - Motif non vide obligatoire (FINANCE_RULES §4.1, §11.1).
 */
export function assertValidAdjustment(params: ValidAdjustmentParams): void {
  if (params.amountMinor <= 0n) {
    throw new DomainError(
      'AMOUNT_OUT_OF_RANGE',
      "Le montant d'un ajustement doit être strictement positif (aucun ajustement à montant nul).",
      { amount: params.amountMinor.toString() },
    );
  }

  if (params.amountMinor > MAX_AMOUNT_MINOR) {
    throw new DomainError('AMOUNT_OUT_OF_RANGE', 'Le montant dépasse la limite maximale autorisée (10^18).', {
      amount: params.amountMinor.toString(),
    });
  }

  if (!params.reason || params.reason.trim().length === 0) {
    throw new DomainError('BUSINESS_RULE_VIOLATION', 'Un motif est obligatoire pour un ajustement de solde.');
  }
}

/**
 * Calcule l'écart et l'ajustement nécessaire lors d'un rapprochement de compte.
 * - differenceMinor = statementEndingBalanceMinor - clearedBalanceMinor
 * - Si statementEndingBalance > clearedBalance => CREDIT de differenceMinor
 * - Si statementEndingBalance < clearedBalance => DEBIT de -differenceMinor
 * - Si égaux => isBalanced = true, aucun ajustement
 */
export function calculateReconciliation(
  clearedBalanceMinor: bigint,
  statementEndingBalanceMinor: bigint,
): ReconciliationCalculation {
  const differenceMinor = statementEndingBalanceMinor - clearedBalanceMinor;
  const isBalanced = differenceMinor === 0n;

  let adjustmentNeeded: { direction: 'CREDIT' | 'DEBIT'; amountMinor: bigint } | null = null;
  if (differenceMinor > 0n) {
    adjustmentNeeded = {
      direction: 'CREDIT',
      amountMinor: differenceMinor,
    };
  } else if (differenceMinor < 0n) {
    adjustmentNeeded = {
      direction: 'DEBIT',
      amountMinor: -differenceMinor,
    };
  }

  return {
    statementEndingBalanceMinor,
    clearedBalanceMinor,
    differenceMinor,
    isBalanced,
    adjustmentNeeded,
  };
}
