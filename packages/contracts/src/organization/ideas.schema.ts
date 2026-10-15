import { z } from 'zod';

import { InstantSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { UuidV7Schema } from '../common/id';

import {
  ArchivedFilterSchema,
  CaptureSourceSchema,
  ClientCaptureSourceSchema,
  csvEnum,
  listQueryBase,
  optionalText,
  PRIORITY_LEVELS,
  PrioritySchema,
  SearchQuerySchema,
  TagIdsSchema,
  text,
} from './common';
import { ProjectSchema } from './projects.schema';

export const IDEA_STATUSES = [
  'INBOX',
  'TO_REVIEW',
  'EVALUATED',
  'SELECTED',
  'IN_PROGRESS',
  'REALIZED',
  'ABANDONED',
] as const;
export const IdeaStatusSchema = z.enum(IDEA_STATUSES);
export type IdeaStatus = z.infer<typeof IdeaStatusSchema>;

export const IDEA_TITLE_MAX = 200;
export const IDEA_DESCRIPTION_MAX = 20_000;

export const IdeaSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: IdeaStatusSchema,
  priority: PrioritySchema.nullable(),
  domain: z.string().nullable(),
  potentialScore: z.number().int().nullable(),
  decisionNote: z.string().nullable(),
  capturedAt: z.string(),
  source: CaptureSourceSchema,
  convertedProjectId: z.uuid().nullable(),
  tagIds: z.array(z.uuid()),
  version: z.number().int(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Idea = z.infer<typeof IdeaSchema>;

export const IdeaResponseSchema = dataEnvelope(IdeaSchema);
export type IdeaResponse = z.infer<typeof IdeaResponseSchema>;
export const IdeaListResponseSchema = listEnvelope(IdeaSchema);
export type IdeaListResponse = z.infer<typeof IdeaListResponseSchema>;

const ideaFields = {
  description: optionalText(IDEA_DESCRIPTION_MAX).optional(),
  priority: PrioritySchema.nullable().optional(),
  domain: optionalText(60).optional(),
  potentialScore: z.number().int().min(1).max(10).nullable().optional(),
  decisionNote: optionalText(IDEA_DESCRIPTION_MAX).optional(),
};

/**
 * `POST /ideas`. `id` facultatif, généré par le client (file hors ligne, ADR-016) : rejouer la même
 * création renvoie l'idée existante au lieu d'en créer une seconde.
 */
export const CreateIdeaRequestSchema = z
  .object({
    id: UuidV7Schema.optional(),
    title: text(1, IDEA_TITLE_MAX),
    ...ideaFields,
    status: IdeaStatusSchema.extract(['INBOX', 'TO_REVIEW']).optional(),
    source: ClientCaptureSourceSchema.optional(),
    capturedAt: InstantSchema.optional(),
    tagIds: TagIdsSchema.optional(),
  })
  .strict();
export type CreateIdeaRequest = z.infer<typeof CreateIdeaRequestSchema>;

/** `PATCH /ideas/:id` : le changement de statut suit la machine à états du domaine. */
export const UpdateIdeaRequestSchema = z
  .object({
    title: text(1, IDEA_TITLE_MAX).optional(),
    ...ideaFields,
    status: IdeaStatusSchema.optional(),
  })
  .strict();
export type UpdateIdeaRequest = z.infer<typeof UpdateIdeaRequestSchema>;

export const IDEA_SORTS = ['-capturedAt', '-updatedAt', '-priority'] as const;

export const IdeaListQuerySchema = z
  .object({
    ...listQueryBase,
    sort: z.enum(IDEA_SORTS).default('-capturedAt'),
    status: csvEnum(IDEA_STATUSES).optional(),
    priority: csvEnum(PRIORITY_LEVELS).optional(),
    source: CaptureSourceSchema.optional(),
    domain: z.string().trim().min(1).max(60).optional(),
    tagId: z.uuid().optional(),
    archived: ArchivedFilterSchema,
    q: SearchQuerySchema.optional(),
  })
  .strict();
export type IdeaListQuery = z.infer<typeof IdeaListQuerySchema>;

/** `GET /ideas/:id/similar` : au plus 3 idées au titre proche, à titre indicatif (jamais de fusion). */
export const SimilarIdeaSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: IdeaStatusSchema,
  similarity: z.number(),
});
export const SimilarIdeasResponseSchema = z.object({ data: z.array(SimilarIdeaSchema) });
export type SimilarIdeasResponse = z.infer<typeof SimilarIdeasResponseSchema>;

/** `POST /ideas/:id/convert-to-project` : idempotent, `created` faux si l'idée était déjà convertie. */
export const ConvertIdeaResponseSchema = dataEnvelope(
  z.object({ idea: IdeaSchema, project: ProjectSchema, created: z.boolean() }),
);
export type ConvertIdeaResponse = z.infer<typeof ConvertIdeaResponseSchema>;
