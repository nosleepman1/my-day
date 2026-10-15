import type { CurrencyCode, EntryDirection, TransactionType } from '@orbit/contracts';
import { MAX_AMOUNT_MINOR } from '@orbit/money';

import { DomainError } from '../../../platform/errors/domain-error';

export interface BuiltLedgerEntry {
  readonly accountId: string;
  readonly direction: EntryDirection;
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

export interface StandardTransactionInput {
  readonly type: TransactionType;
  readonly accountId: string;
  readonly accountCurrency: CurrencyCode;
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly adjustmentDirection?: EntryDirection;
}

export interface TransferTransactionInput {
  readonly fromAccountId: string;
  readonly fromAccountCurrency: CurrencyCode;
  readonly fromAmountMinor: bigint;
  readonly toAccountId: string;
  readonly toAccountCurrency: CurrencyCode;
  readonly toAmountMinor: bigint;
}

function assertValidAmount(amountMinor: bigint): void {
  if (amountMinor <= 0n) {
    throw new DomainError('AMOUNT_OUT_OF_RANGE', "Le montant d'une écriture doit être strictement positif.", {
      amount: amountMinor.toString(),
    });
  }
  if (amountMinor > MAX_AMOUNT_MINOR) {
    throw new DomainError('AMOUNT_OUT_OF_RANGE', 'Le montant dépasse la limite maximale autorisée (10^18).', {
      amount: amountMinor.toString(),
    });
  }
}

/**
 * Construit les écritures de grand livre pour une transaction standard (INCOME, EXPENSE, ADJUSTMENT).
 * (FINANCE_RULES §4.1, §4.2).
 */
export function buildStandardLedgerEntries(input: StandardTransactionInput): readonly BuiltLedgerEntry[] {
  assertValidAmount(input.amountMinor);

  if (input.currency !== input.accountCurrency) {
    throw new DomainError(
      'CURRENCY_MISMATCH',
      `La devise de la transaction (${input.currency}) ne correspond pas à celle du compte (${input.accountCurrency}).`,
      {
        transactionCurrency: input.currency,
        accountCurrency: input.accountCurrency,
      },
    );
  }

  let direction: EntryDirection;

  switch (input.type) {
    case 'INCOME':
      direction = 'CREDIT';
      break;
    case 'EXPENSE':
      direction = 'DEBIT';
      break;
    case 'ADJUSTMENT':
      if (!input.adjustmentDirection) {
        throw new DomainError(
          'BUSINESS_RULE_VIOLATION',
          "La direction (CREDIT ou DEBIT) est obligatoire pour une transaction d'ajustement.",
        );
      }
      direction = input.adjustmentDirection;
      break;
    case 'TRANSFER':
    default:
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        `Le type ${input.type} ne peut pas être créé via les écritures standard.`,
      );
  }

  return [
    {
      accountId: input.accountId,
      direction,
      amountMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}

/**
 * Construit les écritures de grand livre pour un virement / transfert de fonds (FINANCE_RULES §6).
 * Produit exactement deux écritures : DEBIT sur source, CREDIT sur destination.
 */
export function buildTransferLedgerEntries(input: TransferTransactionInput): readonly BuiltLedgerEntry[] {
  if (input.fromAccountId === input.toAccountId) {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      'Le compte source et le compte destination doivent être distincts.',
      { rule: 'SAME_ACCOUNT_TRANSFER' },
    );
  }

  assertValidAmount(input.fromAmountMinor);
  assertValidAmount(input.toAmountMinor);

  return [
    {
      accountId: input.fromAccountId,
      direction: 'DEBIT',
      amountMinor: input.fromAmountMinor,
      currency: input.fromAccountCurrency,
    },
    {
      accountId: input.toAccountId,
      direction: 'CREDIT',
      amountMinor: input.toAmountMinor,
      currency: input.toAccountCurrency,
    },
  ];
}
