import { z } from 'zod';

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

/** Paramètres de pagination par curseur (API.md §7) : `limit` de 1 à 100, 25 par défaut. */
export const PaginationQuerySchema = z
  .object({
    // Chiffres décimaux uniquement : pas de "0x10" ni de "1e1" que z.coerce accepterait.
    limit: z
      .string()
      .regex(/^[0-9]{1,3}$/)
      .transform((value) => Number.parseInt(value, 10))
      .pipe(z.number().int().min(1).max(MAX_PAGE_LIMIT))
      .default(DEFAULT_PAGE_LIMIT),
    cursor: z.string().min(1).max(512).optional(),
  })
  .strict();
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
