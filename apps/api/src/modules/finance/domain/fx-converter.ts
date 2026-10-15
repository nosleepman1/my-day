import { convert, money, type CurrencyCode } from '@orbit/money';

import { DomainError } from '../../../platform/errors/domain-error';

/**
 * Convertit un montant source vers une devise cible en utilisant le taux fourni par l'utilisateur.
 * (FINANCE_RULES §2.2, §6).
 * rateString : unités de devise destination pour 1 unité de devise source.
 */
export function convertCurrency(
  srcMinor: bigint,
  srcCurrency: CurrencyCode,
  destCurrency: CurrencyCode,
  rateString: string,
): bigint {
  if (srcCurrency === destCurrency) {
    return srcMinor;
  }

  try {
    const srcMoney = money(srcMinor, srcCurrency);
    const converted = convert(srcMoney, destCurrency, rateString);
    return converted.minor;
  } catch (error) {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      'Le taux de change fourni est invalide ou non positif.',
      {
        rule: 'EXCHANGE_RATE_INVALID',
        rate: rateString,
        originalError: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

export interface DestinationAmountCheck {
  readonly srcMinor: bigint;
  readonly srcCurrency: CurrencyCode;
  readonly destMinor: bigint;
  readonly destCurrency: CurrencyCode;
  readonly rateString?: string;
}

/**
 * Valide le montant destination saisi par l'utilisateur contre le montant théorique calculé.
 * Invariant (FINANCE_RULES §6.4) : écart maximum de ±1 unité mineure autorisé.
 */
export function assertDestinationAmountMatches(check: DestinationAmountCheck): void {
  const { srcMinor, srcCurrency, destMinor, destCurrency, rateString } = check;
  if (srcCurrency === destCurrency) {
    if (srcMinor !== destMinor) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Les montants doivent être identiques pour un transfert dans la même devise.',
        {
          rule: 'RATE_AMOUNT_MISMATCH',
          expected: srcMinor.toString(),
          actual: destMinor.toString(),
        },
      );
    }
    return;
  }

  if (!rateString) {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      'Un taux de change est obligatoire pour un transfert multi-devises.',
      {
        rule: 'EXCHANGE_RATE_REQUIRED',
      },
    );
  }

  const expectedMinor = convertCurrency(srcMinor, srcCurrency, destCurrency, rateString);
  const diff = destMinor > expectedMinor ? destMinor - expectedMinor : expectedMinor - destMinor;

  if (diff > 1n) {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      'Le montant de destination ne correspond pas au taux de change (tolérance ±1 unité mineure).',
      {
        rule: 'RATE_AMOUNT_MISMATCH',
        expected: expectedMinor.toString(),
        actual: destMinor.toString(),
        diff: diff.toString(),
      },
    );
  }
}
