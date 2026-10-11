import { z } from 'zod';

import { ErrorCode } from '../errors/error-codes';

/*
 * Les schémas de réponse ne sont pas `.strict()` : un champ ajouté plus tard par l'API ne doit pas casser
 * un client plus ancien. `z.object` retire les clés inconnues, ce qui suffit au filtrage côté serveur (ADR-010).
 * Les schémas d'ENTRÉE, eux, restent stricts (API.md §5.2, VALIDATION_FAILED sur clé inconnue).
 */

/** Réponse portant une ressource unique : `{ data }` (API.md §4). */
export function dataEnvelope<T extends z.ZodType>(schema: T) {
  return z.object({ data: schema });
}

export const PageMetaSchema = z.object({
  limit: z.number().int().positive(),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type PageMeta = z.infer<typeof PageMetaSchema>;

/** Réponse de liste paginée par curseur : `{ data: [], meta }` (API.md §4, §7). */
export function listEnvelope<T extends z.ZodType>(schema: T) {
  return z.object({ data: z.array(schema), meta: PageMetaSchema });
}

export const FieldIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  code: z.string(),
  message: z.string(),
});
export type FieldIssue = z.infer<typeof FieldIssueSchema>;

export const ErrorCodeSchema = z.enum(ErrorCode);

/** Corps de toute réponse d'erreur (API.md §5.1). Le front décide sur `code`, jamais sur `message`. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.union([z.array(FieldIssueSchema), z.record(z.string(), z.unknown())]).optional(),
    requestId: z.string().min(1),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
