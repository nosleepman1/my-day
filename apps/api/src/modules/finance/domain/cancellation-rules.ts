import type { TransactionStatus } from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';

import { assertSufficientFunds } from './balance-calculator';

export interface CancellationContext {
  readonly currentStatus: TransactionStatus;
  readonly cancelReason?: string;
  readonly isChildTransaction?: boolean;
  readonly childTreatment?: string;
}

/**
 * Valide les règles d'annulation d'une transaction (FINANCE_RULES §4.3, §5.1).
 */
export function assertCanCancelTransaction(context: CancellationContext): void {
  if (context.currentStatus === 'CANCELLED') {
    throw new DomainError('INVALID_STATE_TRANSITION', 'Cette transaction est déjà annulée.', {
      currentStatus: context.currentStatus,
    });
  }

  // Pour une transaction VALIDATED, le motif d'annulation est obligatoire (min 3 caractères)
  if (context.currentStatus === 'VALIDATED') {
    const reason = context.cancelReason?.trim();
    if (!reason || reason.length < 3) {
      throw new DomainError(
        'VALIDATION_FAILED',
        "Un motif d'au moins 3 caractères est obligatoire pour annuler une transaction validée.",
      );
    }
    if (reason.length > 500) {
      throw new DomainError(
        'VALIDATION_FAILED',
        "Le motif d'annulation ne peut pas dépasser 500 caractères.",
      );
    }
  }

  // Annuler un enfant de traitement CUSTOMER_CREDIT seul est interdit
  if (context.isChildTransaction && context.childTreatment === 'CUSTOMER_CREDIT') {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      'Un crédit client ne peut pas être annulé indépendamment de son paiement parent.',
      { rule: 'CHILD_REQUIRES_PARENT' },
    );
  }
}

/**
 * Vérifie que l'annulation d'une transaction ayant crédité un compte ne viole pas le découvert autorisé
 * (FINANCE_RULES §3.3).
 */
export function assertCancellationDoesNotViolateOverdraft(
  accountCurrentBalanceMinor: bigint,
  previouslyCreditedAmountMinor: bigint,
  allowOverdraft: boolean,
  overdraftLimitMinor = 0n,
): void {
  assertSufficientFunds(
    accountCurrentBalanceMinor,
    -previouslyCreditedAmountMinor,
    allowOverdraft,
    overdraftLimitMinor,
  );
}
