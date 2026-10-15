import { z } from 'zod';

const AMOUNT_MESSAGE = 'Doit être une chaîne de chiffres.';
/** Bornes alignées sur `@orbit/money` (BIGINT, MAX_AMOUNT_MINOR) ; un test de contrat le vérifie. */
export const AMOUNT_BIGINT_MIN = -(2n ** 63n);
export const AMOUNT_BIGINT_MAX = 2n ** 63n - 1n;
export const MAX_ENTERED_AMOUNT_MINOR = 10n ** 18n;

const INTEGER_TEXT = /^-?\d+$/;

/** Zod 4 exécute les `refine` même après un échec de regex : on ne convertit qu'un entier bien formé. */
function isWithinBigint(value: string): boolean {
  if (!INTEGER_TEXT.test(value)) return false;
  const amount = BigInt(value);
  return amount >= AMOUNT_BIGINT_MIN && amount <= AMOUNT_BIGINT_MAX;
}

function isAtMostMaxEntered(value: string): boolean {
  return INTEGER_TEXT.test(value) && BigInt(value) <= MAX_ENTERED_AMOUNT_MINOR;
}

/** Montant signé en unités mineures (soldes, totaux), dans la plage BIGINT (API.md §6.1, ADR-008). Jamais un `number` JSON. */
export const MoneyStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d{0,18})$/, AMOUNT_MESSAGE)
  .refine((value) => value !== '-0' && isWithinBigint(value), AMOUNT_MESSAGE);

/** Montant saisi (transactions, dettes, paiements) : strictement positif, au plus 10^18 (FINANCE_RULES §2.1). */
export const PositiveMoneyStringSchema = z
  .string()
  .regex(/^[1-9]\d{0,18}$/, 'Doit être un montant strictement positif.')
  .refine(isAtMostMaxEntered, 'Montant trop élevé.');

/** Devises prises en charge (ISO 4217), alignées sur `@orbit/money` (test de contrat). */
export const CurrencyCodeSchema = z.enum([
  'XOF',
  'XAF',
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'CHF',
  'MAD',
  'GMD',
  'GNF',
  'MRU',
  'NGN',
  'GHS',
  'CNY',
  'AED',
  'SAR',
]);
export type CurrencyCodeValue = z.infer<typeof CurrencyCodeSchema>;
export type CurrencyCode = CurrencyCodeValue;
