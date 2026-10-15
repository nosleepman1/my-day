import { z } from 'zod';

import { dataEnvelope, listEnvelope } from '../common/envelope';
import { UuidV7Schema } from '../common/id';

import {
  ArchivedFilterSchema,
  CaptureSourceSchema,
  ClientCaptureSourceSchema,
  csvEnum,
  listQueryBase,
  optionalText,
  QueryBooleanSchema,
  SearchQuerySchema,
  TagIdsSchema,
} from './common';

export const NOTE_KINDS = ['NOTE', 'MEETING', 'REFERENCE', 'CHECKLIST', 'LOG'] as const;
export const NoteKindSchema = z.enum(NOTE_KINDS);
export type NoteKind = z.infer<typeof NoteKindSchema>;

export const ContentFormatSchema = z.enum(['MARKDOWN', 'PLAIN']);

export const NOTE_TITLE_MAX = 200;
/** API.md §11 et `ck_notes__content_len`. */
export const NOTE_CONTENT_MAX = 200_000;
export const NOTE_EXCERPT_LENGTH = 280;

export const NOTE_LINK_TARGETS = ['IDEA', 'PROJECT', 'TASK'] as const;

export const NoteLinkSchema = z.object({
  id: z.uuid(),
  targetType: z.enum(NOTE_LINK_TARGETS),
  targetId: z.uuid(),
  targetTitle: z.string(),
  createdAt: z.string(),
});
export type NoteLink = z.infer<typeof NoteLinkSchema>;

const noteBase = {
  id: z.uuid(),
  title: z.string().nullable(),
  contentFormat: ContentFormatSchema,
  kind: NoteKindSchema,
  source: CaptureSourceSchema,
  pinnedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  tagIds: z.array(z.uuid()),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

/** Élément de liste : extrait du contenu, sans le contenu complet. */
export const NoteSummarySchema = z.object({ ...noteBase, excerpt: z.string() });
export type NoteSummary = z.infer<typeof NoteSummarySchema>;

/** Détail : contenu brut, jamais interprété par l'API (rendu par `SafeMarkdown` côté front). */
export const NoteSchema = z.object({ ...noteBase, content: z.string(), links: z.array(NoteLinkSchema) });
export type Note = z.infer<typeof NoteSchema>;

export const NoteResponseSchema = dataEnvelope(NoteSchema);
export type NoteResponse = z.infer<typeof NoteResponseSchema>;
export const NoteListResponseSchema = listEnvelope(NoteSummarySchema);
export type NoteListResponse = z.infer<typeof NoteListResponseSchema>;

const content = z.string().normalize('NFC').max(NOTE_CONTENT_MAX);

/** `POST /notes` : `id` client facultatif (file hors ligne, ADR-016). */
export const CreateNoteRequestSchema = z
  .object({
    id: UuidV7Schema.optional(),
    title: optionalText(NOTE_TITLE_MAX).optional(),
    content: content.default(''),
    contentFormat: ContentFormatSchema.optional(),
    kind: NoteKindSchema.optional(),
    pinned: z.boolean().optional(),
    source: ClientCaptureSourceSchema.optional(),
    tagIds: TagIdsSchema.optional(),
  })
  .strict();
export type CreateNoteRequest = z.input<typeof CreateNoteRequestSchema>;

/** `PATCH /notes/:id` : `If-Match` obligatoire (API.md §10). */
export const UpdateNoteRequestSchema = z
  .object({
    title: optionalText(NOTE_TITLE_MAX).optional(),
    content: content.optional(),
    contentFormat: ContentFormatSchema.optional(),
    kind: NoteKindSchema.optional(),
    pinned: z.boolean().optional(),
  })
  .strict();
export type UpdateNoteRequest = z.infer<typeof UpdateNoteRequestSchema>;

export const NOTE_SORTS = ['-updatedAt', 'title'] as const;

export const NoteListQuerySchema = z
  .object({
    ...listQueryBase,
    sort: z.enum(NOTE_SORTS).default('-updatedAt'),
    kind: csvEnum(NOTE_KINDS).optional(),
    tagId: z.uuid().optional(),
    pinned: QueryBooleanSchema.optional(),
    archived: ArchivedFilterSchema,
    /** Notes liées à un élément donné (ADR-018). */
    ideaId: z.uuid().optional(),
    projectId: z.uuid().optional(),
    taskId: z.uuid().optional(),
    q: SearchQuerySchema.optional(),
  })
  .strict();
export type NoteListQuery = z.infer<typeof NoteListQuerySchema>;

/** `POST /notes/:id/links` : exactement une cible (ADR-018, `ck_note_links__one_target`). */
export const CreateNoteLinkRequestSchema = z
  .object({
    ideaId: z.uuid().optional(),
    projectId: z.uuid().optional(),
    taskId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (value) => [value.ideaId, value.projectId, value.taskId].filter((id) => id !== undefined).length === 1,
    { message: 'Une seule cible par lien.' },
  );
export type CreateNoteLinkRequest = z.infer<typeof CreateNoteLinkRequestSchema>;

export const NoteLinkResponseSchema = dataEnvelope(NoteLinkSchema);
export type NoteLinkResponse = z.infer<typeof NoteLinkResponseSchema>;

export const NoteLinkParamSchema = z.object({ id: z.uuid(), linkId: z.uuid() }).strict();
