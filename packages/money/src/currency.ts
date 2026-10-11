import { MoneyError } from './errors';

/**
 * Devises prises en charge et nombre de décimales ISO 4217 (ADR-008).
 * Le FCFA (XOF) n'a pas de décimales : 1 unité mineure = 1 FCFA.
 */
export const CURRENCIES = {
  XOF: { exponent: 0, symbol: 'FCFA' },
  EUR: { exponent: 2, symbol: '€' },
  USD: { exponent: 2, symbol: '$' },
} as const satisfies Record<string, { readonly exponent: number; readonly symbol: string }>;

export type CurrencyCode = keyof typeof CURRENCIES;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}

/** @throws {MoneyError} `UNKNOWN_CURRENCY` si le code n'est pas pris en charge. */
export function assertCurrencyCode(value: string): CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new MoneyError('UNKNOWN_CURRENCY', `Unsupported currency: ${value}`);
  }
  return value;
}

/** Nombre de décimales de la devise (0 pour XOF, 2 pour EUR et USD). */
export function exponentOf(currency: CurrencyCode): number {
  return CURRENCIES[currency].exponent;
}

/** Facteur entre l'unité principale et l'unité mineure (1 pour XOF, 100 pour EUR). */
export function scaleOf(currency: CurrencyCode): bigint {
  return 10n ** BigInt(exponentOf(currency));
}
