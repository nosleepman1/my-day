import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  type CreateIdeaRequest,
  type Idea,
  type IdeaListQuery,
  type IdeaListResponse,
  PRIORITY_LEVELS,
  type SimilarIdeasResponse,
  type UpdateIdeaRequest,
} from '@orbit/contracts';

import { IdeaSimilarityQueries } from '../../../platform/database/raw/idea-similarity.queries';
import { assertIdeaTransition } from '../domain/idea-status';
import { createOnce, type CreateOnceResult } from '../shared/create-once';
import { cursorWhere, defineSort, keysetPage, orderByOf, type SortSpec } from '../shared/keyset';
import { definedOnly, updateVersioned, versioned } from '../shared/lifecycle';
import { OrganizationContext } from '../shared/organization-context';
import { archivedWhere } from '../shared/records';
import { replaceTags } from '../shared/tag-links';
import { notFound } from '../shared/versioning';

import { IDEA_SELECT, type IdeaRow, toIdea } from './idea-records';

const SORTS: Readonly<Record<IdeaListQuery['sort'], SortSpec>> = {
  '-capturedAt': defineSort('-capturedAt', 'instant'),
  '-updatedAt': defineSort('-updatedAt', 'instant'),
  '-priority': defineSort('-priority', 'enum', { nullable: true, enumValues: PRIORITY_LEVELS }),
};

function filtersOf(query: IdeaListQuery): Prisma.IdeaWhereInput {
  return {
    deletedAt: null,
    ...archivedWhere(query.archived),
    ...(query.status === undefined ? {} : { status: { in: query.status } }),
    ...(query.priority === undefined ? {} : { priority: { in: query.priority } }),
    ...(query.source === undefined ? {} : { source: query.source }),
    ...(query.domain === undefined ? {} : { domain: { equals: query.domain, mode: 'insensitive' } }),
    ...(query.tagId === undefined ? {} : { tags: { some: { tagId: query.tagId } } }),
    ...(query.q === undefined ? {} : { title: { contains: query.q, mode: 'insensitive' } }),
  };
}

/** Idées (API.md §14.5) : capture, revue, archivage, tags ; la conversion est dans `IdeaConversionService`. */
@Injectable()
export class IdeasService {
  constructor(
    private readonly ctx: OrganizationContext,
    private readonly similarity: IdeaSimilarityQueries,
  ) {}

  async list(query: IdeaListQuery): Promise<IdeaListResponse> {
    const spec = SORTS[query.sort];
    const rows = await this.ctx.db.idea.findMany({
      where: { AND: [filtersOf(query), cursorWhere(spec, query.cursor) as Prisma.IdeaWhereInput] },
      orderBy: orderByOf(spec) as Prisma.IdeaOrderByWithRelationInput[],
      take: query.limit + 1,
      select: IDEA_SELECT,
    });
    const page = keysetPage(rows, query.limit, spec);
    return {
      data: page.rows.map(toIdea),
      meta: { limit: query.limit, hasMore: page.hasMore, nextCursor: page.nextCursor },
    };
  }

  find(id: string): Promise<IdeaRow | null> {
    return this.ctx.db.idea.findFirst({ where: { id, deletedAt: null }, select: IDEA_SELECT });
  }

  async require(id: string): Promise<IdeaRow> {
    const row = await this.find(id);
    if (row === null) throw notFound();
    return row;
  }

  async get(id: string): Promise<Idea> {
    return toIdea(await this.require(id));
  }

  async create(input: CreateIdeaRequest): Promise<CreateOnceResult<Idea>> {
    const userId = this.ctx.userId();
    const now = this.ctx.now();
    const capturedAt =
      input.capturedAt === undefined ? now : new Date(Math.min(Date.parse(input.capturedAt), now.getTime()));
    const result = await createOnce(
      input.id,
      (id) => this.find(id),
      () =>
        this.ctx.db.$transaction(async (tx) => {
          const id = input.id ?? this.ctx.newId();
          await tx.idea.create({
            data: {
              id,
              userId,
              title: input.title,
              description: input.description ?? null,
              status: input.status ?? 'INBOX',
              priority: input.priority ?? null,
              domain: input.domain ?? null,
              potentialScore: input.potentialScore ?? null,
              decisionNote: input.decisionNote ?? null,
              source: input.source ?? 'MANUAL',
              clientCaptureId: input.id ?? null,
              capturedAt,
            },
            select: { id: true },
          });
          await replaceTags(tx, { userId, kind: 'idea', entityId: id }, input.tagIds ?? []);
          return tx.idea.findFirstOrThrow({ where: { id }, select: IDEA_SELECT });
        }),
    );
    return { row: toIdea(result.row), created: result.created };
  }

  /** Modification ; un changement de statut suit la machine à états du domaine. */
  async update(id: string, patch: UpdateIdeaRequest, ifMatch: number | undefined): Promise<Idea> {
    const current = await this.require(id);
    if (patch.status !== undefined) assertIdeaTransition(current.status, patch.status);
    await updateVersioned(versioned(this.ctx.db.idea), id, ifMatch ?? current.version, definedOnly(patch));
    return this.get(id);
  }

  async setArchived(id: string, archived: boolean): Promise<Idea> {
    await updateVersioned(versioned(this.ctx.db.idea), id, undefined, {
      archivedAt: archived ? this.ctx.now() : null,
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    await updateVersioned(versioned(this.ctx.db.idea), id, undefined, { deletedAt: this.ctx.now() });
  }

  async setTags(id: string, tagIds: readonly string[]): Promise<Idea> {
    await this.require(id);
    const userId = this.ctx.userId();
    await this.ctx.db.$transaction((tx) => replaceTags(tx, { userId, kind: 'idea', entityId: id }, tagIds));
    return this.get(id);
  }

  /** Au plus 3 idées au titre proche (trigrammes sans accents), à titre indicatif. */
  async similar(id: string): Promise<SimilarIdeasResponse> {
    const idea = await this.require(id);
    const rows = await this.similarity.similarTo(id, idea.title);
    return { data: rows.map((row) => ({ ...row, similarity: Math.round(row.similarity * 100) / 100 })) };
  }
}
