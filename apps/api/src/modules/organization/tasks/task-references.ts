import { Injectable } from '@nestjs/common';

import type { CreateTaskRequest, UpdateTaskRequest } from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';
import { OrganizationContext } from '../shared/organization-context';
import { notFound } from '../shared/versioning';

import type { TaskRow } from './task-records';

function ruleViolation(rule: string, message: string): DomainError {
  return new DomainError('BUSINESS_RULE_VIOLATION', message, { rule });
}

function archivedReference(field: string): DomainError {
  return new DomainError('REFERENCE_INVALID', 'Cet élément est archivé.', { field });
}

/**
 * Références d'une tâche (parent, projet, idée). Un élément absent, supprimé ou appartenant à un autre
 * utilisateur donne 404 (lecture cloisonnée, ADR-007) ; un élément archivé donne 422 REFERENCE_INVALID.
 */
@Injectable()
export class TaskReferences {
  constructor(private readonly ctx: OrganizationContext) {}

  async assertForCreate(input: CreateTaskRequest): Promise<void> {
    if (input.parentTaskId != null)
      await this.assertParent(input.parentTaskId, input.recurrence !== undefined);
    if (input.projectId != null) await this.assertProject(input.projectId);
    if (input.ideaId != null) await this.assertIdea(input.ideaId);
  }

  async assertForUpdate(
    current: Pick<TaskRow, 'parentTaskId' | 'recurrenceSeriesId'>,
    patch: UpdateTaskRequest,
  ): Promise<void> {
    if (patch.projectId != null) await this.assertProject(patch.projectId);
    if (patch.recurrence === undefined) return;
    if (current.recurrenceSeriesId !== null) {
      throw ruleViolation(
        'OCCURRENCE_RECURRENCE',
        "La récurrence se règle sur la tâche d'origine de la série.",
      );
    }
    if (patch.recurrence !== null && current.parentTaskId !== null) {
      throw ruleViolation('SUBTASK_RECURRENCE', 'Une sous-tâche ne peut pas être récurrente.');
    }
  }

  /** Un seul niveau de sous-tâches (PHASE-04 §4). */
  private async assertParent(id: string, recurring: boolean): Promise<void> {
    const parent = await this.ctx.db.task.findFirst({
      where: { id, deletedAt: null },
      select: { parentTaskId: true },
    });
    if (parent === null) throw notFound();
    if (parent.parentTaskId !== null) {
      throw ruleViolation('SUBTASK_DEPTH', 'Une sous-tâche ne peut pas avoir de sous-tâches.');
    }
    if (recurring) throw ruleViolation('SUBTASK_RECURRENCE', 'Une sous-tâche ne peut pas être récurrente.');
  }

  private async assertProject(id: string): Promise<void> {
    const project = await this.ctx.db.project.findFirst({
      where: { id, deletedAt: null },
      select: { archivedAt: true },
    });
    if (project === null) throw notFound();
    if (project.archivedAt !== null) throw archivedReference('projectId');
  }

  private async assertIdea(id: string): Promise<void> {
    const idea = await this.ctx.db.idea.findFirst({
      where: { id, deletedAt: null },
      select: { archivedAt: true },
    });
    if (idea === null) throw notFound();
    if (idea.archivedAt !== null) throw archivedReference('ideaId');
  }
}
