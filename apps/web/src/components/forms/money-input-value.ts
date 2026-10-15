import {
  exponentOf,
  MAX_AMOUNT_MINOR,
  MoneyError,
  parseUserInput,
  toMinorString,
  type CurrencyCode,
} from '@orbit/money';

const NBSP = ' ';
/** Retiré au collage : espaces (`\s` couvre U+00A0 et U+202F) et devise (DESIGN_SYSTEM.md §5.3). */
const PASTE_NOISE = /\s|FCFA|€|\$|US/gi;

export type MoneyInputIssue =
  'required' | 'invalid' | 'noDecimals' | 'tooManyDecimals' | 'notPositive' | 'tooLarge';

/**
 * Normalise la frappe : chiffres seulement, plus un séparateur décimal `,` (et au plus `exposant`
 * décimales) pour les devises qui en ont. Jamais de `number` : la valeur reste une chaîne (ADR-008).
 */
export function normalizeMoneyInput(raw: string, currency: CurrencyCode): string {
  const cleaned = raw.replace(PASTE_NOISE, '');
  if (exponentOf(currency) === 0) return cleaned.replace(/\D/g, '');
  const [integerPart = '', ...rest] = cleaned.replace(/\./g, ',').split(',');
  const integer = integerPart.replace(/\D/g, '');
  if (rest.length === 0) return integer;
  return `${integer},${rest.join('').replace(/\D/g, '')}`;
}

/** Affichage pendant la frappe : groupes de milliers séparés par une espace insécable. */
export function groupMoneyInput(normalized: string): string {
  const [integer = '', fraction] = normalized.split(',');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

/** Raison du refus d'une saisie, ou `null` si elle est un montant strictement positif valide. */
export function moneyInputIssue(raw: string, currency: CurrencyCode): MoneyInputIssue | null {
  if (raw.trim() === '') return 'required';
  if (/[a-z]/i.test(raw.replace(PASTE_NOISE, ''))) return 'invalid';
  if (exponentOf(currency) === 0 && /[.,]\d/.test(raw)) return 'noDecimals';
  try {
    const value = parseUserInput(normalizeMoneyInput(raw, currency), currency);
    if (value.minor <= 0n) return 'notPositive';
    if (value.minor > MAX_AMOUNT_MINOR) return 'tooLarge';
    return null;
  } catch (error: unknown) {
    if (error instanceof MoneyError && error.code === 'TOO_MANY_DECIMALS') return 'tooManyDecimals';
    if (error instanceof MoneyError && error.code === 'AMOUNT_OUT_OF_RANGE') return 'tooLarge';
    return 'invalid';
  }
}

/**
 * Conversion avant l'envoi : chaîne d'unités mineures (`"150000"`, `"1250"` pour 12,50 €).
 * @throws {MoneyError} si la saisie n'a pas été validée par `moneyInputIssue`.
 */
export function moneyInputToMinor(raw: string, currency: CurrencyCode): string {
  return toMinorString(parseUserInput(normalizeMoneyInput(raw, currency), currency));
}
