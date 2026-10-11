import { exponentOf, scaleOf, type CurrencyCode } from './currency';
import { MoneyError } from './errors';
import { MAX_AMOUNT_MINOR, money, type Money } from './money';

/** Format d'échange de l'API : entier signé, sans zéro de tête ni `-0` (API.md §6.1). */
const WIRE_FORMAT = /^-?(?:0|[1-9]\d*)$/;
const POSITIVE_FORMAT = /^[1-9]\d*$/;
/** Saisie utilisateur : groupes de milliers (espace, espace insécable ou fine), séparateur décimal `,` ou `.`. */
const USER_INPUT_FORMAT = /^(-?)(\d{1,3}(?:[ \u00A0\u202F]\d{3})+|\d+)(?:[.,](\d+))?$/;
const GROUP_SEPARATORS = /[ \u00A0\u202F]/g;

function invalidAmount(value: string): MoneyError {
  return new MoneyError('INVALID_AMOUNT', `Invalid amount: ${JSON.stringify(value)}`);
}

/**
 * Lit un montant au format de l'API (chaîne de chiffres en unités mineures).
 * @throws {MoneyError} `INVALID_AMOUNT` ou `AMOUNT_OUT_OF_RANGE`.
 */
export function parseMinor(value: string, currency: CurrencyCode): Money {
  if (!WIRE_FORMAT.test(value) || value === '-0') throw invalidAmount(value);
  return money(BigInt(value), currency);
}

/**
 * Lit un montant saisi (transaction, dette, paiement) : strictement positif et au plus 10^18.
 * @throws {MoneyError} `INVALID_AMOUNT` ou `AMOUNT_OUT_OF_RANGE`.
 */
export function parsePositiveAmount(value: string, currency: CurrencyCode): Money {
  if (!POSITIVE_FORMAT.test(value)) throw invalidAmount(value);
  const minor = BigInt(value);
  if (minor > MAX_AMOUNT_MINOR) {
    throw new MoneyError('AMOUNT_OUT_OF_RANGE', 'Amount above the maximum allowed');
  }
  return money(minor, currency);
}

/** Écrit un montant au format de l'API. */
export function toMinorString(value: Money): string {
  return value.minor.toString();
}

/**
 * Lit une saisie de formulaire (« 150 000 », « 12,50 »). Ne jamais arrondir :
 * plus de décimales que la devise n'en autorise est refusé (FINANCE_RULES §2.1).
 * @throws {MoneyError} `INVALID_AMOUNT` ou `TOO_MANY_DECIMALS`.
 */
export function parseUserInput(text: string, currency: CurrencyCode): Money {
  const match = USER_INPUT_FORMAT.exec(text.trim());
  if (match === null) throw invalidAmount(text);
  const [, sign = '', integerPart = '', fraction = ''] = match;
  const exponent = exponentOf(currency);
  if (fraction.length > exponent) {
    throw new MoneyError('TOO_MANY_DECIMALS', `${currency} accepts at most ${exponent} decimals`);
  }
  const integerMinor = BigInt(integerPart.replace(GROUP_SEPARATORS, '')) * scaleOf(currency);
  const fractionMinor = BigInt(fraction.padEnd(exponent, '0').padStart(1, '0'));
  const minor = integerMinor + fractionMinor;
  return money(sign === '-' ? -minor : minor, currency);
}
