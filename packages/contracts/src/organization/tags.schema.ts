import { z } from 'zod';

import { dataEnvelope } from '../common/envelope';

import { HexColorSchema, text } from './common';

export const TAG_NAME_MAX = 40;

export const TagSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string().nullable(),
  /** Nombre d'éléments portant le tag, par type. */
  usage: z.object({
    ideas: z.number().int(),
    projects: z.number().int(),
    tasks: z.number().int(),
    notes: z.number().int(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Tag = z.infer<typeof TagSchema>;

/** `GET /tags` : tous les tags de l'utilisateur, par nom (liste courte, non paginée). */
export const TagListResponseSchema = z.object({ data: z.array(TagSchema) });
export type TagListResponse = z.infer<typeof TagListResponseSchema>;
export const TagResponseSchema = dataEnvelope(TagSchema);
export type TagResponse = z.infer<typeof TagResponseSchema>;

export const CreateTagRequestSchema = z
  .object({
    name: text(1, TAG_NAME_MAX),
    color: HexColorSchema.nullable().optional(),
  })
  .strict();
export type CreateTagRequest = z.infer<typeof CreateTagRequestSchema>;

export const UpdateTagRequestSchema = z
  .object({
    name: text(1, TAG_NAME_MAX).optional(),
    color: HexColorSchema.nullable().optional(),
  })
  .strict();
export type UpdateTagRequest = z.infer<typeof UpdateTagRequestSchema>;

/** `POST /tags/:id/merge` : les liaisons du tag passent sur `targetTagId`, puis le tag est supprimé. */
export const MergeTagRequestSchema = z.object({ targetTagId: z.uuid() }).strict();
export type MergeTagRequest = z.infer<typeof MergeTagRequestSchema>;
