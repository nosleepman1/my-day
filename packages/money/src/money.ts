import type { CurrencyCode } from './currency';
import { MoneyError } from './errors';

/** Bornes du type PostgreSQL BIGINT. */
export const BIGINT_MIN = -(2n ** 63n);
export const BIGINT_MAX = 2n ** 63n - 1n;

/** Montant maximal d'une transaction saisie, en unités mineures (FINANCE_RULES §2.1, ADR-037). */
export const MAX_AMOUNT_MINOR = 10n ** 18n;

/** Montant immuable en unités mineures. Le sens (débit ou crédit) est porté par l'appelant. */
export type Money = Readonly<{ minor: bigint; currency: CurrencyCode }>;

/**
 * Construit un montant gelé.
 * @throws {MoneyError} `AMOUNT_OUT_OF_RANGE` hors de l'intervalle BIGINT.
 */
export function money(minor: bigint, currency: CurrencyCode): Money {
  if (minor < BIGINT_MIN || minor > BIGINT_MAX) {
    throw new MoneyError('AMOUNT_OUT_OF_RANGE', 'Amount outside the BIGINT range');
  }
  return Object.freeze({ minor, currency });
}

export function zero(currency: CurrencyCode): Money {
  return money(0n, currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError('CURRENCY_MISMATCH', `Cannot combine ${a.currency} with ${b.currency}`);
  }
}

/** @throws {MoneyError} `CURRENCY_MISMATCH` si les devises diffèrent. */
export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

/** @throws {MoneyError} `CURRENCY_MISMATCH` si les devises diffèrent. */
export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.minor, a.currency);
}

/** Compare deux montants de même devise : -1, 0 ou 1. */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.minor < b.minor) return -1;
  return a.minor > b.minor ? 1 : 0;
}

export function isZero(a: Money): boolean {
  return a.minor === 0n;
}

export function isPositive(a: Money): boolean {
  return a.minor > 0n;
}

export function isNegative(a: Money): boolean {
  return a.minor < 0n;
}

/** Somme d'une liste de montants, tous dans `currency` ; une liste vide vaut zéro. */
export function sum(currency: CurrencyCode, items: readonly Money[]): Money {
  return items.reduce<Money>((total, item) => add(total, item), zero(currency));
}
