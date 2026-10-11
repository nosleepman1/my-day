import { z } from 'zod';

const AMOUNT_MESSAGE = 'Doit être une chaîne de chiffres.';

/** Montant signé en unités mineures, au plus 18 chiffres (API.md §6.1, ADR-008). Jamais un `number` JSON. */
export const MoneyStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d{0,17})$/, AMOUNT_MESSAGE)
  .refine((value) => value !== '-0', AMOUNT_MESSAGE);

/** Montant saisi : strictement positif (transactions, dettes, paiements). */
export const PositiveMoneyStringSchema = z
  .string()
  .regex(/^[1-9]\d{0,17}$/, 'Doit être un montant strictement positif.');

/** Devises prises en charge (ISO 4217), alignées sur `@orbit/money` (test de contrat). */
export const CurrencyCodeSchema = z.enum(['XOF', 'EUR', 'USD']);
export type CurrencyCodeValue = z.infer<typeof CurrencyCodeSchema>;
