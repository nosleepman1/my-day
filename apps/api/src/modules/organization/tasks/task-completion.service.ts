import { Injectable } from '@nestjs/common';

import { type CompleteTaskResponse, nextOccurrence, parseRecurrence } from '@orbit/contracts';

import { addDays, type CalendarSnapshot, civilToDate, dateToCivil } from '../domain/calendar';
import { assertPatchableStatus } from '../domain/task-rules';
import { OrganizationContext } from '../shared/organization-context';
import type { ScopedTx } from '../shared/records';
import { copyTags } from '../shared/tag-links';
import { UserCalendarService } from '../shared/user-calendar.service';
import { notFound } from '../shared/versioning';

import { TASK_SELECT, type TaskRow, toTask } from './task-records';
import { TasksService } from './tasks.service';

/**
 * Prochaine date d'une série : après l'occurrence terminée, sans revenir avant aujourd'hui. Une tâche
 * quotidienne terminée avec trois jours de retard repart donc de demain, sans rattrapage des jours manqués.
 */
function nextDateFor(
  head: TaskRow,
  current: TaskRow,
  generated: number,
  calendar: CalendarSnapshot,
): string | null {
  const rule = head.recurrenceRule === null ? null : parseRecurrence(head.recurrenceRule);
  if (rule === null || head.recurrenceAnchorOn === null) return null;
  const anchor = dateToCivil(head.recurrenceAnchorOn);
  const occurrence = current.occurrenceDate === null ? anchor : dateToCivil(current.occurrenceDate);
  const yesterday = addDays(calendar.today, -1);
  return nextOccurrence(rule, anchor, occurrence > yesterday ? occurrence : yesterday, generated);
}

/**
 * `POST /tasks/:id/complete` (PHASE-04 T10). La transition vers `DONE` est conditionnelle (une seule
 * requête gagne sous concurrence) et l'occurrence suivante est créée dans la même transaction avec
 * `ON CONFLICT DO NOTHING` sur `ux_tasks__series_occurrence` : un double clic, un rejeu hors ligne ou une
 * réouverture suivie d'une nouvelle complétion ne créent jamais deux occurrences pour la même date.
 */
@Injectable()
export class TaskCompletionService {
  constructor(
    private readonly ctx: OrganizationContext,
    private readonly calendar: UserCalendarService,
    private readonly tasks: TasksService,
  ) {}

  async complete(id: string): Promise<CompleteTaskResponse['data']> {
    const calendar = await this.calendar.snapshot();
    const outcome = await this.ctx.db.$transaction(async (tx) => {
      const current = await tx.task.findFirst({ where: { id, deletedAt: null }, select: TASK_SELECT });
      if (current === null) throw notFound();
      if (current.status === 'DONE') return { current, completed: false, next: null };
      assertPatchableStatus(current.status, 'DONE');
      const { count } = await tx.task.updateMany({
        where: { id, status: { notIn: ['DONE', 'CANCELLED'] } },
        data: { status: 'DONE', completedAt: calendar.now, version: { increment: 1 } },
      });
      if (count === 0) return { current, completed: false, next: null };
      return { current, completed: true, next: await this.createNextOccurrence(tx, current, calendar) };
    });
    if (outcome.completed) {
      await this.tasks.recordChanges(id, outcome.current, {
        status: 'DONE',
        dueDate: outcome.current.dueDate === null ? null : dateToCivil(outcome.current.dueDate),
      });
    }
    return {
      task: await this.tasks.get(id),
      nextOccurrence: outcome.next === null ? null : toTask(outcome.next, calendar),
    };
  }

  private async createNextOccurrence(
    tx: ScopedTx,
    current: TaskRow,
    calendar: CalendarSnapshot,
  ): Promise<TaskRow | null> {
    const head =
      current.recurrenceSeriesId === null
        ? current
        : await tx.task.findFirst({
            where: { id: current.recurrenceSeriesId, deletedAt: null },
            select: TASK_SELECT,
          });
    if (head === null) return null;
    const generated = 1 + (await tx.task.count({ where: { recurrenceSeriesId: head.id } }));
    const date = nextDateFor(head, current, generated, calendar);
    if (date === null) return null;
    const userId = this.ctx.userId();
    const occurrenceId = this.ctx.newId();
    const { count } = await tx.task.createMany({
      data: [
        {
          id: occurrenceId,
          userId,
          title: head.title,
          description: head.description,
          priority: head.priority,
          projectId: head.projectId,
          ideaId: head.ideaId,
          estimatedMinutes: head.estimatedMinutes,
          source: 'RECURRENCE',
          recurrenceSeriesId: head.id,
          occurrenceDate: civilToDate(date),
          dueDate: civilToDate(date),
        },
      ],
      skipDuplicates: true,
    });
    if (count > 0) {
      const tagIds = head.tags.map((tag) => tag.tagId);
      await copyTags(tx, { userId, kind: 'task', entityId: occurrenceId }, tagIds);
    }
    return tx.task.findFirst({
      // Une occurrence supprimée par l'utilisateur à cette date n'est pas recréée ni renvoyée.
      where: { recurrenceSeriesId: head.id, occurrenceDate: civilToDate(date), deletedAt: null },
      select: TASK_SELECT,
    });
  }
}
