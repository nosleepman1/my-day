import { z } from 'zod';

import { ErrorCode } from '../errors/error-codes';

/** Réponse portant une ressource unique : `{ data }` (API.md §4). */
export function dataEnvelope<T extends z.ZodType>(schema: T) {
  return z.object({ data: schema }).strict();
}

export const PageMetaSchema = z
  .object({
    limit: z.number().int().positive(),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
  .strict();
export type PageMeta = z.infer<typeof PageMetaSchema>;

/** Réponse de liste paginée par curseur : `{ data: [], meta }` (API.md §4, §7). */
export function listEnvelope<T extends z.ZodType>(schema: T) {
  return z.object({ data: z.array(schema), meta: PageMetaSchema }).strict();
}

export const FieldIssueSchema = z
  .object({
    path: z.array(z.union([z.string(), z.number()])),
    code: z.string(),
    message: z.string(),
  })
  .strict();
export type FieldIssue = z.infer<typeof FieldIssueSchema>;

export const ErrorCodeSchema = z.enum(ErrorCode);

/** Corps de toute réponse d'erreur (API.md §5.1). Le front décide sur `code`, jamais sur `message`. */
export const ErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: ErrorCodeSchema,
        message: z.string(),
        details: z.union([z.array(FieldIssueSchema), z.record(z.string(), z.unknown())]).optional(),
        requestId: z.string(),
      })
      .strict(),
  })
  .strict();
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
