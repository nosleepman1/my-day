import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type {
  CreateProjectRequest,
  Project,
  ProjectListQuery,
  ProjectListResponse,
  ProjectSummary,
  UpdateProjectRequest,
} from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';
import { civilToDate, dateToCivil } from '../domain/calendar';
import { slugify } from '../domain/slug';
import { progressPercent } from '../domain/task-rules';
import { createOnce, type CreateOnceResult } from '../shared/create-once';
import { cursorWhere, defineSort, keysetPage, orderByOf, type SortSpec } from '../shared/keyset';
import { civilInput, definedOnly, updateVersioned, versioned } from '../shared/lifecycle';
import { OrganizationContext } from '../shared/organization-context';
import { archivedWhere } from '../shared/records';
import { replaceTags } from '../shared/tag-links';
import { UserCalendarService } from '../shared/user-calendar.service';
import { notFound } from '../shared/versioning';
import { openTasksWhere, overdueWhere } from '../tasks/task-queries';

import { freeSlug, PROJECT_SELECT, type ProjectRow, toProject } from './project-records';

const SORTS: Readonly<Record<ProjectListQuery['sort'], SortSpec>> = {
  '-updatedAt': defineSort('-updatedAt', 'instant'),
  name: defineSort('name', 'text'),
  targetOn: defineSort('targetOn', 'date', { nullable: true }),
};

function filtersOf(query: ProjectListQuery): Prisma.ProjectWhereInput {
  return {
    deletedAt: null,
    ...archivedWhere(query.archived),
    ...(query.status === undefined ? {} : { status: { in: query.status } }),
    ...(query.type === undefined ? {} : { type: { in: query.type } }),
    ...(query.tagId === undefined ? {} : { tags: { some: { tagId: query.tagId } } }),
    ...(query.q === undefined ? {} : { name: { contains: query.q, mode: 'insensitive' } }),
  };
}

function datesOutOfOrder(): DomainError {
  return new DomainError('VALIDATION_FAILED', "L'échéance précède le début.", [
    { path: ['targetOn'], code: 'custom', message: "L'échéance précède le début." },
  ]);
}

/** Projets (API.md §14.5) : slug unique parmi les projets vivants, progression dérivée des tâches. */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly ctx: OrganizationContext,
    private readonly calendar: UserCalendarService,
  ) {}

  async list(query: ProjectListQuery): Promise<ProjectListResponse> {
    const spec = SORTS[query.sort];
    const rows = await this.ctx.db.project.findMany({
      where: { AND: [filtersOf(query), cursorWhere(spec, query.cursor) as Prisma.ProjectWhereInput] },
      orderBy: orderByOf(spec) as Prisma.ProjectOrderByWithRelationInput[],
      take: query.limit + 1,
      select: PROJECT_SELECT,
    });
    const page = keysetPage(rows, query.limit, spec);
    return {
      data: page.rows.map(toProject),
      meta: { limit: query.limit, hasMore: page.hasMore, nextCursor: page.nextCursor },
    };
  }

  find(id: string): Promise<ProjectRow | null> {
    return this.ctx.db.project.findFirst({ where: { id, deletedAt: null }, select: PROJECT_SELECT });
  }

  async require(id: string): Promise<ProjectRow> {
    const row = await this.find(id);
    if (row === null) throw notFound();
    return row;
  }

  async get(id: string): Promise<Project> {
    return toProject(await this.require(id));
  }

  async create(input: CreateProjectRequest): Promise<CreateOnceResult<Project>> {
    const userId = this.ctx.userId();
    const result = await createOnce(
      input.id,
      (id) => this.find(id),
      () =>
        this.ctx.db.$transaction(async (tx) => {
          const id = input.id ?? this.ctx.newId();
          await tx.project.create({
            data: {
              id,
              userId,
              name: input.name,
              slug: input.slug ?? (await freeSlug(tx, slugify(input.name))),
              description: input.description ?? null,
              type: input.type ?? 'PERSONAL_PRODUCT',
              status: input.status ?? 'PLANNED',
              priority: input.priority ?? null,
              startsOn: civilInput(input.startsOn) ?? null,
              targetOn: civilInput(input.targetOn) ?? null,
              color: input.color ?? null,
            },
            select: { id: true },
          });
          await replaceTags(tx, { userId, kind: 'project', entityId: id }, input.tagIds ?? []);
          return tx.project.findFirstOrThrow({ where: { id }, select: PROJECT_SELECT });
        }),
    );
    return { row: toProject(result.row), created: result.created };
  }

  /** `COMPLETED` fixe `completedOn` au jour courant de l'utilisateur ; en sortir l'efface. */
  async update(id: string, patch: UpdateProjectRequest, ifMatch: number | undefined): Promise<Project> {
    const current = await this.require(id);
    const startsOn = patch.startsOn === undefined ? civilOrNullOf(current.startsOn) : patch.startsOn;
    const targetOn = patch.targetOn === undefined ? civilOrNullOf(current.targetOn) : patch.targetOn;
    if (startsOn !== null && targetOn !== null && targetOn < startsOn) throw datesOutOfOrder();
    const completedOn = await this.completedOnFor(current.status, patch.status);
    await updateVersioned(versioned(this.ctx.db.project), id, ifMatch ?? current.version, {
      ...definedOnly({
        ...patch,
        startsOn: civilInput(patch.startsOn),
        targetOn: civilInput(patch.targetOn),
      }),
      ...(completedOn === undefined ? {} : { completedOn }),
    });
    return this.get(id);
  }

  private async completedOnFor(
    from: Project['status'],
    to: Project['status'] | undefined,
  ): Promise<Date | null | undefined> {
    if (to === undefined || to === from) return undefined;
    if (to !== 'COMPLETED') return null;
    return civilToDate((await this.calendar.snapshot()).today);
  }

  async setArchived(id: string, archived: boolean): Promise<Project> {
    await updateVersioned(versioned(this.ctx.db.project), id, undefined, {
      archivedAt: archived ? this.calendar.now() : null,
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    await updateVersioned(versioned(this.ctx.db.project), id, undefined, { deletedAt: this.calendar.now() });
  }

  async setTags(id: string, tagIds: readonly string[]): Promise<Project> {
    await this.require(id);
    const userId = this.ctx.userId();
    await this.ctx.db.$transaction((tx) =>
      replaceTags(tx, { userId, kind: 'project', entityId: id }, tagIds),
    );
    return this.get(id);
  }

  /** Progression = terminées / non annulées ; en retard selon le jour de l'utilisateur (ADR-020). */
  async summary(id: string): Promise<ProjectSummary> {
    await this.require(id);
    const calendar = await this.calendar.snapshot();
    const base = { projectId: id, deletedAt: null };
    const [total, done, cancelled, overdue, sourceIdea] = await Promise.all([
      this.ctx.db.task.count({ where: base }),
      this.ctx.db.task.count({ where: { ...base, status: 'DONE' } }),
      this.ctx.db.task.count({ where: { ...base, status: 'CANCELLED' } }),
      this.ctx.db.task.count({ where: { AND: [base, openTasksWhere(), overdueWhere(calendar)] } }),
      this.ctx.db.idea.findFirst({
        where: { convertedProjectId: id, deletedAt: null },
        select: { id: true, title: true },
      }),
    ]);
    return {
      projectId: id,
      tasks: { total, done, cancelled, open: total - done - cancelled, overdue },
      progressPercent: progressPercent({ total, done, cancelled }),
      sourceIdea,
    };
  }
}

function civilOrNullOf(value: Date | null): string | null {
  return value === null ? null : dateToCivil(value);
}
