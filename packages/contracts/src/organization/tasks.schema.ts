import { z } from 'zod';

import { CivilDateSchema, InstantSchema, TimezoneSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { UuidV7Schema } from '../common/id';

import {
  CaptureSourceSchema,
  ClientCaptureSourceSchema,
  csvEnum,
  listQueryBase,
  optionalText,
  PrioritySchema,
  SearchQuerySchema,
  TagIdsSchema,
  text,
} from './common';
import { formatRecurrence, parseRecurrence } from './recurrence';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as const;
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** Statuts terminaux : une tâche terminée ou annulée n'est jamais « en retard » (ADR-020). */
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ['DONE', 'CANCELLED'];

/** Vues calculées dans le fuseau de l'utilisateur (ADR-023). */
export const TASK_VIEWS = ['TODAY', 'OVERDUE', 'THIS_WEEK', 'NO_DUE_DATE'] as const;
export const TaskViewSchema = z.enum(TASK_VIEWS);
export type TaskView = z.infer<typeof TaskViewSchema>;

export const TASK_TITLE_MAX = 300;
export const TASK_DESCRIPTION_MAX = 20_000;
const MAX_MINUTES = 100_000;

/** Règle RRULE restreinte (voir `recurrence.ts`), normalisée sous sa forme canonique. */
export const RecurrenceRuleSchema = z
  .string()
  .trim()
  .max(200)
  .transform((rule, context) => {
    const parsed = parseRecurrence(rule.toUpperCase());
    if (parsed === null) {
      context.addIssue({ code: 'custom', message: 'Règle de récurrence non prise en charge.' });
      return z.NEVER;
    }
    return formatRecurrence(parsed);
  });

export const RecurrenceInputSchema = z
  .object({
    rule: RecurrenceRuleSchema,
    /** Première occurrence ; par défaut l'échéance de la tâche, sinon le jour courant. */
    anchorOn: CivilDateSchema.optional(),
    /** Par défaut, le fuseau des préférences. */
    timezone: TimezoneSchema.optional(),
  })
  .strict();
export type RecurrenceInput = z.infer<typeof RecurrenceInputSchema>;

export const TaskRecurrenceSchema = z.object({
  rule: z.string(),
  anchorOn: z.string(),
  timezone: z.string(),
  nextOccurrenceAt: z.string().nullable(),
});

export const TaskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatusSchema,
  priority: PrioritySchema.nullable(),
  projectId: z.uuid().nullable(),
  ideaId: z.uuid().nullable(),
  parentTaskId: z.uuid().nullable(),
  startsOn: z.string().nullable(),
  dueDate: z.string().nullable(),
  dueAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  estimatedMinutes: z.number().int().nullable(),
  actualMinutes: z.number().int().nullable(),
  /** Règle portée par la tâche d'origine d'une série ; `null` sur les occurrences générées. */
  recurrence: TaskRecurrenceSchema.nullable(),
  recurrenceSeriesId: z.uuid().nullable(),
  occurrenceDate: z.string().nullable(),
  source: CaptureSourceSchema,
  /** Dérivé à la lecture dans le fuseau de l'utilisateur, jamais stocké (ADR-020). */
  overdue: z.boolean(),
  tagIds: z.array(z.uuid()),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskRefSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: TaskStatusSchema,
  dueDate: z.string().nullable(),
});
export type TaskRef = z.infer<typeof TaskRefSchema>;

/** Détail : sous-tâches, tâches dont elle dépend (`dependsOn`) et tâches qu'elle bloque (`blocks`). */
export const TaskDetailSchema = TaskSchema.extend({
  subtasks: z.array(TaskRefSchema),
  dependsOn: z.array(TaskRefSchema),
  blocks: z.array(TaskRefSchema),
});
export type TaskDetail = z.infer<typeof TaskDetailSchema>;

export const TaskResponseSchema = dataEnvelope(TaskSchema);
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export const TaskDetailResponseSchema = dataEnvelope(TaskDetailSchema);
export type TaskDetailResponse = z.infer<typeof TaskDetailResponseSchema>;
export const TaskListResponseSchema = listEnvelope(TaskSchema);
export type TaskListResponse = z.infer<typeof TaskListResponseSchema>;

const minutes = z.number().int().min(0).max(MAX_MINUTES).nullable().optional();

const taskFields = {
  description: optionalText(TASK_DESCRIPTION_MAX).optional(),
  priority: PrioritySchema.nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  startsOn: CivilDateSchema.nullable().optional(),
  dueDate: CivilDateSchema.nullable().optional(),
  dueAt: InstantSchema.nullable().optional(),
  estimatedMinutes: minutes,
  actualMinutes: minutes,
};

function dueAtNeedsDate(value: {
  dueAt?: string | null | undefined;
  dueDate?: string | null | undefined;
}): boolean {
  return !value.dueAt || Boolean(value.dueDate);
}
const DUE_MESSAGE = { message: "Une heure d'échéance exige une date.", path: ['dueAt'] };

/** `POST /tasks` : `id` client facultatif (idempotence de la file hors ligne, ADR-016). */
export const CreateTaskRequestSchema = z
  .object({
    id: UuidV7Schema.optional(),
    title: text(1, TASK_TITLE_MAX),
    ...taskFields,
    status: TaskStatusSchema.extract(['TODO', 'IN_PROGRESS', 'BLOCKED']).optional(),
    ideaId: z.uuid().nullable().optional(),
    parentTaskId: z.uuid().nullable().optional(),
    recurrence: RecurrenceInputSchema.optional(),
    source: ClientCaptureSourceSchema.optional(),
    tagIds: TagIdsSchema.optional(),
  })
  .strict()
  .refine(dueAtNeedsDate, DUE_MESSAGE);
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

/**
 * `PATCH /tasks/:id`. `DONE` passe par `POST /:id/complete` et la sortie de `DONE`/`CANCELLED` par
 * `POST /:id/reopen` ; `recurrence: null` arrête la série. Changements de statut et d'échéance audités.
 */
export const UpdateTaskRequestSchema = z
  .object({
    title: text(1, TASK_TITLE_MAX).optional(),
    ...taskFields,
    status: TaskStatusSchema.extract(['TODO', 'IN_PROGRESS', 'BLOCKED', 'CANCELLED']).optional(),
    recurrence: RecurrenceInputSchema.nullable().optional(),
  })
  .strict()
  .refine(dueAtNeedsDate, DUE_MESSAGE);
export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequestSchema>;

export const TASK_SORTS = ['dueDate', '-priority', '-createdAt'] as const;

export const TaskListQuerySchema = z
  .object({
    ...listQueryBase,
    sort: z.enum(TASK_SORTS).default('dueDate'),
    view: TaskViewSchema.optional(),
    status: csvEnum(TASK_STATUSES).optional(),
    projectId: z.uuid().optional(),
    ideaId: z.uuid().optional(),
    /** UUID du parent, ou `none` pour les seules tâches de premier niveau. */
    parentTaskId: z.union([z.uuid(), z.literal('none')]).optional(),
    tagId: z.uuid().optional(),
    q: SearchQuerySchema.optional(),
  })
  .strict();
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;

/** `POST /tasks/:id/dependencies` : la tâche `:id` dépend de `dependsOnTaskId`. */
export const AddTaskDependencyRequestSchema = z.object({ dependsOnTaskId: z.uuid() }).strict();
export type AddTaskDependencyRequest = z.infer<typeof AddTaskDependencyRequestSchema>;

export const TaskDependencyParamSchema = z.object({ id: z.uuid(), dependsOnTaskId: z.uuid() }).strict();

/** `POST /tasks/:id/complete` : la tâche terminée et, pour une série, l'occurrence suivante. */
export const CompleteTaskResponseSchema = dataEnvelope(
  z.object({ task: TaskSchema, nextOccurrence: TaskSchema.nullable() }),
);
export type CompleteTaskResponse = z.infer<typeof CompleteTaskResponseSchema>;

export const TaskHistoryEntrySchema = z.object({
  id: z.uuid(),
  kind: z.enum(['STATUS', 'DUE_DATE', 'CREATED']),
  from: z.string().nullable(),
  to: z.string().nullable(),
  occurredAt: z.string(),
});
export type TaskHistoryEntry = z.infer<typeof TaskHistoryEntrySchema>;

/** `GET /tasks/:id/history` : 100 derniers changements, du plus récent au plus ancien. */
export const TaskHistoryResponseSchema = z.object({ data: z.array(TaskHistoryEntrySchema) });
export type TaskHistoryResponse = z.infer<typeof TaskHistoryResponseSchema>;
