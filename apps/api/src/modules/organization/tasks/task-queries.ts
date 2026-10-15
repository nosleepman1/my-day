import type { Prisma } from '@prisma/client';

import type { TaskView } from '@orbit/contracts';

import { type CalendarSnapshot, civilToDate } from '../domain/calendar';

type Calendar = Pick<CalendarSnapshot, 'now' | 'today' | 'weekStart' | 'weekEnd'>;

/** Tâches non terminales (ADR-020). */
export function openTasksWhere(): Prisma.TaskWhereInput {
  return { status: { notIn: ['DONE', 'CANCELLED'] } };
}

/** Échéance dépassée : l'instant `due_at` s'il existe, sinon la date civile avant aujourd'hui. */
export function overdueWhere(calendar: Calendar): Prisma.TaskWhereInput {
  return {
    OR: [{ dueAt: null, dueDate: { lt: civilToDate(calendar.today) } }, { dueAt: { lt: calendar.now } }],
  };
}

/**
 * Vues de tâches dans le fuseau de l'utilisateur (PHASE-04 §3, ADR-023), toujours limitées aux tâches
 * ouvertes : Aujourd'hui (échéance aujourd'hui, ou commencée sans être échue), En retard, Cette semaine
 * (échéance dans la semaine courante selon le premier jour préféré), Sans échéance.
 */
export function viewWhere(view: TaskView, calendar: Calendar): Prisma.TaskWhereInput {
  const today = civilToDate(calendar.today);
  switch (view) {
    case 'TODAY':
      return {
        AND: [
          openTasksWhere(),
          {
            OR: [
              { dueDate: today },
              { startsOn: { lte: today }, OR: [{ dueDate: null }, { dueDate: { gt: today } }] },
            ],
          },
        ],
      };
    case 'OVERDUE':
      return { AND: [openTasksWhere(), overdueWhere(calendar)] };
    case 'THIS_WEEK':
      return {
        AND: [
          openTasksWhere(),
          { dueDate: { gte: civilToDate(calendar.weekStart), lte: civilToDate(calendar.weekEnd) } },
        ],
      };
    case 'NO_DUE_DATE':
      return { AND: [openTasksWhere(), { dueDate: null }] };
  }
}
