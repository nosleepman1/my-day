import type { TaskStatus } from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';

const TERMINAL: ReadonlySet<TaskStatus> = new Set(['DONE', 'CANCELLED']);

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return TERMINAL.has(status);
}

export type OverdueInput = Readonly<{ status: TaskStatus; dueDate: string | null; dueAt: Date | null }>;

/**
 * En retard (ADR-020) : statut non terminal et échéance dépassée. Avec une heure d'échéance l'instant fait
 * foi ; sinon la date civile, comparée au jour courant dans le fuseau de l'utilisateur.
 */
export function isOverdue(task: OverdueInput, calendar: Readonly<{ now: Date; today: string }>): boolean {
  if (isTerminalTaskStatus(task.status) || task.dueDate === null) return false;
  if (task.dueAt !== null) return task.dueAt.getTime() < calendar.now.getTime();
  return task.dueDate < calendar.today;
}

/**
 * `PATCH` ne fait pas sortir une tâche d'un état terminal : il faut `POST /:id/reopen`.
 * @throws {DomainError} INVALID_STATE_TRANSITION
 */
export function assertPatchableStatus(from: TaskStatus, to: TaskStatus): void {
  if (from !== to && isTerminalTaskStatus(from)) {
    throw new DomainError('INVALID_STATE_TRANSITION', 'Rouvrez la tâche avant de changer son statut.', {
      from,
      to,
    });
  }
}

/** @throws {DomainError} INVALID_STATE_TRANSITION si la tâche n'est ni terminée ni annulée. */
export function assertReopenable(status: TaskStatus): void {
  if (!isTerminalTaskStatus(status)) {
    throw new DomainError('INVALID_STATE_TRANSITION', "Cette tâche n'est pas terminée.", {
      from: status,
      to: 'TODO',
    });
  }
}

/** Progression d'un projet : terminées / non annulées, arrondie à l'entier inférieur ; `null` sans tâche. */
export function progressPercent(
  counts: Readonly<{ total: number; done: number; cancelled: number }>,
): number | null {
  const effective = counts.total - counts.cancelled;
  return effective <= 0 ? null : Math.floor((counts.done * 100) / effective);
}
