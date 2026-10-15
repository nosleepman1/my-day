import type { Prisma } from '@prisma/client';

import type { Task, TaskRef } from '@orbit/contracts';

import type { CalendarSnapshot } from '../domain/calendar';
import { isOverdue } from '../domain/task-rules';
import { civilOrNull, isoOrNull, TAG_IDS_SELECT, tagIdsOf } from '../shared/records';

export const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  projectId: true,
  ideaId: true,
  parentTaskId: true,
  startsOn: true,
  dueDate: true,
  dueAt: true,
  completedAt: true,
  estimatedMinutes: true,
  actualMinutes: true,
  recurrenceRule: true,
  recurrenceAnchorOn: true,
  recurrenceTimezone: true,
  nextOccurrenceAt: true,
  recurrenceSeriesId: true,
  occurrenceDate: true,
  source: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  tags: TAG_IDS_SELECT,
} as const satisfies Prisma.TaskSelect;

export type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

export const TASK_REF_SELECT = { id: true, title: true, status: true, dueDate: true } as const;

export type TaskRefRow = Prisma.TaskGetPayload<{ select: typeof TASK_REF_SELECT }>;

function recurrenceOf(row: TaskRow): Task['recurrence'] {
  if (row.recurrenceRule === null || row.recurrenceAnchorOn === null || row.recurrenceTimezone === null) {
    return null;
  }
  return {
    rule: row.recurrenceRule,
    anchorOn: row.recurrenceAnchorOn.toISOString().slice(0, 10),
    timezone: row.recurrenceTimezone,
    nextOccurrenceAt: isoOrNull(row.nextOccurrenceAt),
  };
}

export function toTask(row: TaskRow, calendar: CalendarSnapshot): Task {
  const dueDate = civilOrNull(row.dueDate);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    projectId: row.projectId,
    ideaId: row.ideaId,
    parentTaskId: row.parentTaskId,
    startsOn: civilOrNull(row.startsOn),
    dueDate,
    dueAt: isoOrNull(row.dueAt),
    completedAt: isoOrNull(row.completedAt),
    estimatedMinutes: row.estimatedMinutes,
    actualMinutes: row.actualMinutes,
    recurrence: recurrenceOf(row),
    recurrenceSeriesId: row.recurrenceSeriesId,
    occurrenceDate: civilOrNull(row.occurrenceDate),
    source: row.source,
    overdue: isOverdue({ status: row.status, dueDate, dueAt: row.dueAt }, calendar),
    tagIds: tagIdsOf(row.tags),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTaskRef(row: TaskRefRow): TaskRef {
  return { id: row.id, title: row.title, status: row.status, dueDate: civilOrNull(row.dueDate) };
}
