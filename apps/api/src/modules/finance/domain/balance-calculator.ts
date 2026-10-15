import { BIGINT_MAX, BIGINT_MIN } from '@orbit/money';

import { DomainError } from '../../../platform/errors/domain-error';

export interface LedgerEntryItem {
  readonly direction: 'CREDIT' | 'DEBIT';
  readonly amountMinor: bigint;
  readonly status: 'PENDING' | 'VALIDATED' | 'CANCELLED';
}

export interface CalculatedBalance {
  readonly realisedMinor: bigint;
  readonly projectedMinor: bigint;
}

/**
 * Calcule le solde réalisé et le solde prévisionnel d'un compte (FINANCE_RULES §3.2).
 * - Solde réalisé : openingBalance + CREDIT(VALIDATED) - DEBIT(VALIDATED)
 * - Solde prévisionnel : solde réalisé + CREDIT(PENDING) - DEBIT(PENDING)
 * - CANCELLED est ignoré dans les deux calculs.
 */
export function calculateBalance(
  openingBalanceMinor: bigint,
  entries: readonly LedgerEntryItem[],
): CalculatedBalance {
  let realised = openingBalanceMinor;
  let projectedDelta = 0n;

  for (const entry of entries) {
    if (entry.status === 'CANCELLED') {
      continue;
    }

    const signedAmount = entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;

    if (entry.status === 'VALIDATED') {
      realised += signedAmount;
    } else {
      projectedDelta += signedAmount;
    }
  }

  const projected = realised + projectedDelta;

  if (realised < BIGINT_MIN || realised > BIGINT_MAX) {
    throw new DomainError('BALANCE_OUT_OF_RANGE', 'Le solde réalisé calculé dépasse la plage autorisée.', {
      balance: realised.toString(),
    });
  }

  if (projected < BIGINT_MIN || projected > BIGINT_MAX) {
    throw new DomainError(
      'BALANCE_OUT_OF_RANGE',
      'Le solde prévisionnel calculé dépasse la plage autorisée.',
      {
        balance: projected.toString(),
      },
    );
  }

  return {
    realisedMinor: realised,
    projectedMinor: projected,
  };
}

/**
 * Vérifie l'invariant de découvert (FINANCE_RULES §3.3).
 * Invariant : à tout instant, solde_realise >= -overdraftLimitMinor.
 * deltaMinor est négatif pour un débit ou une annulation de crédit.
 */
export function assertSufficientFunds(
  currentBalanceMinor: bigint,
  deltaMinor: bigint,
  allowOverdraft: boolean,
  overdraftLimitMinor = 0n,
): void {
  const newBalance = currentBalanceMinor + deltaMinor;
  const minAllowed = allowOverdraft ? -overdraftLimitMinor : 0n;

  if (newBalance < minAllowed) {
    const required = -deltaMinor;
    const available = currentBalanceMinor - minAllowed;
    throw new DomainError('INSUFFICIENT_FUNDS', 'Solde insuffisant pour exécuter cette opération.', {
      available: available.toString(),
      required: required.toString(),
    });
  }
}
