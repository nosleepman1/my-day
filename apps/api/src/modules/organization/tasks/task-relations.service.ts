import { Injectable } from '@nestjs/common';

import type { TaskDetail, TaskHistoryEntry } from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';
import { wouldCreateCycle } from '../domain/dependency-graph';
import { OrganizationContext } from '../shared/organization-context';
import { UserCalendarService } from '../shared/user-calendar.service';
import { notFound } from '../shared/versioning';

import { TASK_REF_SELECT, toTask, toTaskRef } from './task-records';
import { TasksService } from './tasks.service';

const MAX_SUBTASKS = 200;
const MAX_HISTORY = 100;
/** Plafond de dépendances d'une tâche (revue sécurité PHASE-04, M4). */
const MAX_DEPENDENCIES_PER_TASK = 50;
const HISTORY_KINDS = {
  'organization.task.status_change': 'STATUS',
  'organization.task.due_change': 'DUE_DATE',
} as const;

function circularDependency(): DomainError {
  return new DomainError('CIRCULAR_DEPENDENCY', 'Cette dépendance créerait un cycle.');
}

/** Erreur levée par `trg_task_dependencies__no_cycle` ou `ck_task_dependencies__not_self`. */
function isCycleViolation(error: unknown): boolean {
  return error instanceof Error && /task dependency cycle|ck_task_dependencies__not_self/.test(error.message);
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Détail d'une tâche (sous-tâches, dépendances), dépendances sans cycle et historique (PHASE-04 T7, T9). */
@Injectable()
export class TaskRelationsService {
  constructor(
    private readonly ctx: OrganizationContext,
    private readonly calendar: UserCalendarService,
    private readonly tasks: TasksService,
  ) {}

  async detail(id: string): Promise<TaskDetail> {
    const [row, calendar, subtasks, dependsOn, blocks] = await Promise.all([
      this.tasks.require(id),
      this.calendar.snapshot(),
      this.ctx.db.task.findMany({
        where: { parentTaskId: id, deletedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: MAX_SUBTASKS,
        select: TASK_REF_SELECT,
      }),
      this.ctx.db.taskDependency.findMany({
        where: { taskId: id, dependsOn: { is: { deletedAt: null } } },
        select: { dependsOn: { select: TASK_REF_SELECT } },
      }),
      this.ctx.db.taskDependency.findMany({
        where: { dependsOnTaskId: id, task: { is: { deletedAt: null } } },
        select: { task: { select: TASK_REF_SELECT } },
      }),
    ]);
    return {
      ...toTask(row, calendar),
      subtasks: subtasks.map(toTaskRef),
      dependsOn: dependsOn.map((edge) => toTaskRef(edge.dependsOn)),
      blocks: blocks.map((edge) => toTaskRef(edge.task)),
    };
  }

  /**
   * « `id` dépend de `dependsOnTaskId` ». Contrôle applicatif du cycle pour un message clair ; le déclencheur
   * de la base reste la garantie sous concurrence (verrou consultatif par utilisateur).
   */
  async addDependency(id: string, dependsOnTaskId: string): Promise<TaskDetail> {
    if (id === dependsOnTaskId) throw circularDependency();
    const found = await this.ctx.db.task.count({
      where: { id: { in: [id, dependsOnTaskId] }, deletedAt: null },
    });
    if (found !== 2) throw notFound();
    const existing = await this.ctx.db.taskDependency.count({ where: { taskId: id } });
    if (existing >= MAX_DEPENDENCIES_PER_TASK) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Trop de dépendances pour cette tâche.', {
        rule: 'TASK_DEPENDENCY_LIMIT',
      });
    }
    const edges = await this.ctx.db.taskDependency.findMany({
      select: { taskId: true, dependsOnTaskId: true },
    });
    if (wouldCreateCycle(edges, id, dependsOnTaskId)) throw circularDependency();
    try {
      await this.ctx.db.taskDependency.createMany({
        data: [{ userId: this.ctx.userId(), taskId: id, dependsOnTaskId }],
        skipDuplicates: true,
      });
    } catch (error) {
      if (isCycleViolation(error)) throw circularDependency();
      throw error;
    }
    return this.detail(id);
  }

  async removeDependency(id: string, dependsOnTaskId: string): Promise<void> {
    const { count } = await this.ctx.db.taskDependency.deleteMany({ where: { taskId: id, dependsOnTaskId } });
    if (count === 0) throw notFound();
  }

  /** Changements de statut et d'échéance (`audit_logs`), du plus récent au plus ancien, puis la création. */
  async history(id: string): Promise<TaskHistoryEntry[]> {
    const task = await this.tasks.require(id);
    const rows = await this.ctx.db.auditLog.findMany({
      where: {
        entityType: 'task',
        entityId: id,
        action: { in: Object.keys(HISTORY_KINDS) },
        outcome: 'SUCCESS',
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: MAX_HISTORY,
      select: { id: true, action: true, metadata: true, occurredAt: true },
    });
    const changes = rows.map((row): TaskHistoryEntry => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        kind: HISTORY_KINDS[row.action as keyof typeof HISTORY_KINDS],
        from: textOf(metadata['from']),
        to: textOf(metadata['to']),
        occurredAt: row.occurredAt.toISOString(),
      };
    });
    const created: TaskHistoryEntry = {
      id: task.id,
      kind: 'CREATED',
      from: null,
      to: null,
      occurredAt: task.createdAt.toISOString(),
    };
    return changes.length < MAX_HISTORY ? [...changes, created] : changes;
  }
}
