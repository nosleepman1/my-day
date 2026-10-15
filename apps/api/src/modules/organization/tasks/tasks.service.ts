import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  type CreateTaskRequest,
  PRIORITY_LEVELS,
  type RecurrenceInput,
  type Task,
  type TaskListQuery,
  type TaskListResponse,
  type TaskStatus,
  type UpdateTaskRequest,
} from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import { type CalendarSnapshot, civilToDate } from '../domain/calendar';
import { assertPatchableStatus, assertReopenable } from '../domain/task-rules';
import { createOnce, type CreateOnceResult } from '../shared/create-once';
import { cursorWhere, defineSort, keysetPage, orderByOf, type SortSpec } from '../shared/keyset';
import { civilInput, definedOnly, updateVersioned, versioned } from '../shared/lifecycle';
import { OrganizationContext } from '../shared/organization-context';
import { civilOrNull } from '../shared/records';
import { replaceTags } from '../shared/tag-links';
import { UserCalendarService } from '../shared/user-calendar.service';
import { notFound } from '../shared/versioning';

import { viewWhere } from './task-queries';
import { TASK_SELECT, type TaskRow, toTask } from './task-records';
import { TaskReferences } from './task-references';

const SORTS: Readonly<Record<TaskListQuery['sort'], SortSpec>> = {
  dueDate: defineSort('dueDate', 'date', { nullable: true }),
  '-priority': defineSort('-priority', 'enum', { nullable: true, enumValues: PRIORITY_LEVELS }),
  '-createdAt': defineSort('-createdAt', 'instant'),
};

function filtersOf(query: TaskListQuery, calendar: CalendarSnapshot): Prisma.TaskWhereInput {
  const parent = query.parentTaskId === 'none' ? null : query.parentTaskId;
  return {
    deletedAt: null,
    ...(query.view === undefined ? {} : viewWhere(query.view, calendar)),
    ...(query.status === undefined ? {} : { status: { in: query.status } }),
    ...(query.projectId === undefined ? {} : { projectId: query.projectId }),
    ...(query.ideaId === undefined ? {} : { ideaId: query.ideaId }),
    ...(parent === undefined ? {} : { parentTaskId: parent }),
    ...(query.tagId === undefined ? {} : { tags: { some: { tagId: query.tagId } } }),
    ...(query.q === undefined ? {} : { title: { contains: query.q, mode: 'insensitive' } }),
  };
}

type RecurrenceColumns = Readonly<{
  recurrenceRule: string | null;
  recurrenceAnchorOn: Date | null;
  recurrenceTimezone: string | null;
  nextOccurrenceAt: null;
}>;

const NO_RECURRENCE: RecurrenceColumns = {
  recurrenceRule: null,
  recurrenceAnchorOn: null,
  recurrenceTimezone: null,
  nextOccurrenceAt: null,
};

function recurrenceColumns(
  input: RecurrenceInput,
  dueDate: string | null,
  calendar: CalendarSnapshot,
): RecurrenceColumns {
  return {
    recurrenceRule: input.rule,
    recurrenceAnchorOn: civilToDate(input.anchorOn ?? dueDate ?? calendar.today),
    recurrenceTimezone: input.timezone ?? calendar.timezone,
    nextOccurrenceAt: null,
  };
}

/** Rattachements d'une nouvelle tâche (projet, idée, parent). */
function taskLinks(input: CreateTaskRequest) {
  return {
    projectId: input.projectId ?? null,
    ideaId: input.ideaId ?? null,
    parentTaskId: input.parentTaskId ?? null,
  };
}

/** Colonnes d'une nouvelle tâche, valeurs par défaut comprises (hors identifiants et récurrence). */
function taskCreateData(input: CreateTaskRequest, dueDate: string | null) {
  return {
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? 'TODO',
    priority: input.priority ?? null,
    ...taskLinks(input),
    startsOn: civilInput(input.startsOn) ?? null,
    dueDate: civilInput(dueDate) ?? null,
    dueAt: input.dueAt == null ? null : new Date(input.dueAt),
    estimatedMinutes: input.estimatedMinutes ?? null,
    actualMinutes: input.actualMinutes ?? null,
    source: input.source ?? 'MANUAL',
    clientCaptureId: input.id ?? null,
  } as const;
}

function dueTimeWithoutDate(): DomainError {
  return new DomainError('VALIDATION_FAILED', "Une heure d'échéance exige une date.", [
    { path: ['dueAt'], code: 'custom', message: "Une heure d'échéance exige une date." },
  ]);
}

/** Tâches (API.md §14.5) : CRUD, vues par fuseau, sous-tâches, historique audité des statuts et échéances. */
@Injectable()
export class TasksService {
  constructor(
    private readonly ctx: OrganizationContext,
    private readonly calendar: UserCalendarService,
    private readonly references: TaskReferences,
    private readonly audit: AuditService,
  ) {}

  async list(query: TaskListQuery): Promise<TaskListResponse> {
    const calendar = await this.calendar.snapshot();
    const spec = SORTS[query.sort];
    const rows = await this.ctx.db.task.findMany({
      where: { AND: [filtersOf(query, calendar), cursorWhere(spec, query.cursor) as Prisma.TaskWhereInput] },
      orderBy: orderByOf(spec) as Prisma.TaskOrderByWithRelationInput[],
      take: query.limit + 1,
      select: TASK_SELECT,
    });
    const page = keysetPage(rows, query.limit, spec);
    return {
      data: page.rows.map((row) => toTask(row, calendar)),
      meta: { limit: query.limit, hasMore: page.hasMore, nextCursor: page.nextCursor },
    };
  }

  find(id: string): Promise<TaskRow | null> {
    return this.ctx.db.task.findFirst({ where: { id, deletedAt: null }, select: TASK_SELECT });
  }

  async require(id: string): Promise<TaskRow> {
    const row = await this.find(id);
    if (row === null) throw notFound();
    return row;
  }

  async get(id: string): Promise<Task> {
    const [row, calendar] = await Promise.all([this.require(id), this.calendar.snapshot()]);
    return toTask(row, calendar);
  }

  async create(input: CreateTaskRequest): Promise<CreateOnceResult<Task>> {
    const userId = this.ctx.userId();
    const calendar = await this.calendar.snapshot();
    await this.references.assertForCreate(input);
    const recurrence =
      input.recurrence === undefined
        ? NO_RECURRENCE
        : recurrenceColumns(input.recurrence, input.dueDate ?? null, calendar);
    const dueDate = input.dueDate ?? civilOrNull(recurrence.recurrenceAnchorOn);
    const result = await createOnce(
      input.id,
      (id) => this.find(id),
      () =>
        this.ctx.db.$transaction(async (tx) => {
          const id = input.id ?? this.ctx.newId();
          await tx.task.create({
            data: { id, userId, ...taskCreateData(input, dueDate), ...recurrence },
            select: { id: true },
          });
          await replaceTags(tx, { userId, kind: 'task', entityId: id }, input.tagIds ?? []);
          return tx.task.findFirstOrThrow({ where: { id }, select: TASK_SELECT });
        }),
    );
    return { row: toTask(result.row, calendar), created: result.created };
  }

  async update(id: string, patch: UpdateTaskRequest, ifMatch: number | undefined): Promise<Task> {
    const current = await this.require(id);
    const calendar = await this.calendar.snapshot();
    if (patch.status !== undefined) assertPatchableStatus(current.status, patch.status);
    await this.references.assertForUpdate(current, patch);
    const dueDate = patch.dueDate === undefined ? civilOrNull(current.dueDate) : patch.dueDate;
    // Une nouvelle date sans nouvelle heure efface l'heure : l'ancienne tomberait un autre jour.
    const dateMoved = dueDate !== civilOrNull(current.dueDate);
    const keptDueAt = dateMoved ? null : current.dueAt;
    const dueAt = dueDate === null ? null : patch.dueAt === undefined ? keptDueAt : patch.dueAt;
    if (dueAt !== null && dueDate === null) throw dueTimeWithoutDate();
    const { recurrence, ...fields } = patch;
    await updateVersioned(versioned(this.ctx.db.task), id, ifMatch ?? current.version, {
      ...definedOnly({ ...fields, startsOn: civilInput(patch.startsOn), dueDate: civilInput(patch.dueDate) }),
      dueAt: dueAt === null ? null : new Date(dueAt),
      ...(recurrence === undefined
        ? {}
        : recurrence === null
          ? NO_RECURRENCE
          : recurrenceColumns(recurrence, dueDate, calendar)),
    });
    await this.recordChanges(id, current, { status: patch.status, dueDate });
    return this.get(id);
  }

  /** Rouvre une tâche terminée ou annulée ; l'occurrence suivante déjà créée est conservée. */
  async reopen(id: string): Promise<Task> {
    const current = await this.require(id);
    assertReopenable(current.status);
    await updateVersioned(versioned(this.ctx.db.task), id, current.version, {
      status: 'TODO',
      completedAt: null,
    });
    await this.recordChanges(id, current, { status: 'TODO', dueDate: civilOrNull(current.dueDate) });
    return this.get(id);
  }

  /** Arrête une série : la règle est retirée de la tâche d'origine, les occurrences existantes restent. */
  async stopRecurrence(id: string): Promise<Task> {
    return this.update(id, { recurrence: null }, undefined);
  }

  /** Suppression logique de la tâche et de ses sous-tâches. */
  async remove(id: string): Promise<void> {
    const now = this.calendar.now();
    await this.ctx.db.$transaction(async (tx) => {
      await updateVersioned(versioned(tx.task), id, undefined, { deletedAt: now });
      await tx.task.updateMany({ where: { parentTaskId: id, deletedAt: null }, data: { deletedAt: now } });
    });
  }

  async setTags(id: string, tagIds: readonly string[]): Promise<Task> {
    await this.require(id);
    const userId = this.ctx.userId();
    await this.ctx.db.$transaction((tx) => replaceTags(tx, { userId, kind: 'task', entityId: id }, tagIds));
    return this.get(id);
  }

  /** Changements de statut et d'échéance écrits dans `audit_logs` (historique de la tâche). */
  async recordChanges(
    id: string,
    before: Pick<TaskRow, 'status' | 'dueDate'>,
    after: Readonly<{ status: TaskStatus | undefined; dueDate: string | null }>,
  ): Promise<void> {
    const userId = this.ctx.userId();
    const entry = { userId, entityType: 'task', entityId: id } as const;
    if (after.status !== undefined && after.status !== before.status) {
      await this.audit.record({
        ...entry,
        action: 'organization.task.status_change',
        metadata: { from: before.status, to: after.status },
      });
    }
    const previousDue = civilOrNull(before.dueDate);
    if (after.dueDate !== previousDue) {
      await this.audit.record({
        ...entry,
        action: 'organization.task.due_change',
        metadata: { from: previousDue, to: after.dueDate },
      });
    }
  }
}
