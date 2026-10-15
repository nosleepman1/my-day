import { z } from 'zod';

import { CivilDateSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { UuidV7Schema } from '../common/id';

import {
  ArchivedFilterSchema,
  csvEnum,
  HexColorSchema,
  ItemRefSchema,
  listQueryBase,
  optionalText,
  PrioritySchema,
  SearchQuerySchema,
  TagIdsSchema,
  text,
} from './common';

export const PROJECT_TYPES = ['FREELANCE', 'PERSONAL_PRODUCT', 'LEARNING', 'INTERNAL'] as const;
export const ProjectTypeSchema = z.enum(PROJECT_TYPES);
export type ProjectType = z.infer<typeof ProjectTypeSchema>;

export const PROJECT_STATUSES = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ABANDONED'] as const;
export const ProjectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const PROJECT_NAME_MAX = 120;
export const PROJECT_SLUG_MAX = 80;

/** Slug : minuscules, chiffres et tirets simples (`ck_projects__slug_format`). */
export const ProjectSlugSchema = z
  .string()
  .max(PROJECT_SLUG_MAX)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Minuscules, chiffres et tirets.');

export const ProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  type: ProjectTypeSchema,
  status: ProjectStatusSchema,
  priority: PrioritySchema.nullable(),
  startsOn: z.string().nullable(),
  targetOn: z.string().nullable(),
  completedOn: z.string().nullable(),
  color: z.string().nullable(),
  tagIds: z.array(z.uuid()),
  version: z.number().int(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectResponseSchema = dataEnvelope(ProjectSchema);
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export const ProjectListResponseSchema = listEnvelope(ProjectSchema);
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

const projectFields = {
  description: optionalText(20_000).optional(),
  type: ProjectTypeSchema.optional(),
  priority: PrioritySchema.nullable().optional(),
  startsOn: CivilDateSchema.nullable().optional(),
  targetOn: CivilDateSchema.nullable().optional(),
  color: HexColorSchema.nullable().optional(),
};

function datesInOrder(value: {
  startsOn?: string | null | undefined;
  targetOn?: string | null | undefined;
}): boolean {
  return !value.startsOn || !value.targetOn || value.targetOn >= value.startsOn;
}
const DATES_MESSAGE = { message: "L'échéance précède le début.", path: ['targetOn'] };

/** `POST /projects` : slug déduit du nom s'il est absent. */
export const CreateProjectRequestSchema = z
  .object({
    id: UuidV7Schema.optional(),
    name: text(1, PROJECT_NAME_MAX),
    slug: ProjectSlugSchema.optional(),
    status: ProjectStatusSchema.extract(['PLANNED', 'ACTIVE']).optional(),
    ...projectFields,
    tagIds: TagIdsSchema.optional(),
  })
  .strict()
  .refine(datesInOrder, DATES_MESSAGE);
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

/** `PATCH /projects/:id` : `COMPLETED` fixe `completedOn` au jour courant de l'utilisateur. */
export const UpdateProjectRequestSchema = z
  .object({
    name: text(1, PROJECT_NAME_MAX).optional(),
    slug: ProjectSlugSchema.optional(),
    status: ProjectStatusSchema.optional(),
    ...projectFields,
  })
  .strict()
  .refine(datesInOrder, DATES_MESSAGE);
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

export const PROJECT_SORTS = ['-updatedAt', 'name', 'targetOn'] as const;

export const ProjectListQuerySchema = z
  .object({
    ...listQueryBase,
    sort: z.enum(PROJECT_SORTS).default('-updatedAt'),
    status: csvEnum(PROJECT_STATUSES).optional(),
    type: csvEnum(PROJECT_TYPES).optional(),
    tagId: z.uuid().optional(),
    archived: ArchivedFilterSchema,
    q: SearchQuerySchema.optional(),
  })
  .strict();
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;

/**
 * `GET /projects/:id/summary`. Progression = tâches terminées / tâches non annulées (sous-tâches
 * comprises, supprimées exclues) ; `null` sans tâche. Valeur dérivée, jamais stockée.
 */
export const ProjectSummarySchema = z.object({
  projectId: z.uuid(),
  tasks: z.object({
    total: z.number().int(),
    done: z.number().int(),
    cancelled: z.number().int(),
    open: z.number().int(),
    overdue: z.number().int(),
  }),
  progressPercent: z.number().int().min(0).max(100).nullable(),
  sourceIdea: ItemRefSchema.nullable(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export const ProjectSummaryResponseSchema = dataEnvelope(ProjectSummarySchema);
export type ProjectSummaryResponse = z.infer<typeof ProjectSummaryResponseSchema>;
