import { Injectable } from '@nestjs/common';

import type { CreateTagRequest, Tag, UpdateTagRequest } from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { isUniqueViolation } from '../../../platform/database/prisma-error.mapper';
import { DomainError } from '../../../platform/errors/domain-error';
import { OrganizationContext } from '../shared/organization-context';
import type { ScopedTx } from '../shared/records';
import { attachTag, type TaggableKind } from '../shared/tag-links';
import { notFound } from '../shared/versioning';

const TAG_SELECT = {
  id: true,
  name: true,
  color: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { ideas: true, projects: true, tasks: true, notes: true } },
} as const;

type TagRow = Readonly<{
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: Readonly<{ ideas: number; projects: number; tasks: number; notes: number }>;
}>;

/** Les tags d'un utilisateur restent peu nombreux : liste complète, plafonnée par sécurité. */
const MAX_TAGS = 1_000;

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    usage: { ...row._count },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function nameTaken(): DomainError {
  return new DomainError('CONFLICT', 'Un tag porte déjà ce nom.', { field: 'name' });
}

/** Identifiants des éléments portant le tag `tagId`, par type d'élément. */
async function taggedIds(tx: ScopedTx, kind: TaggableKind, tagId: string): Promise<string[]> {
  const where = { tagId };
  switch (kind) {
    case 'idea':
      return (await tx.ideaTag.findMany({ where, select: { ideaId: true } })).map((row) => row.ideaId);
    case 'project':
      return (await tx.projectTag.findMany({ where, select: { projectId: true } })).map(
        (row) => row.projectId,
      );
    case 'task':
      return (await tx.taskTag.findMany({ where, select: { taskId: true } })).map((row) => row.taskId);
    case 'note':
      return (await tx.noteTag.findMany({ where, select: { noteId: true } })).map((row) => row.noteId);
  }
}

const TAGGABLE_KINDS: readonly TaggableKind[] = ['idea', 'project', 'task', 'note'];

/** Tags (API.md §14.5) : nom unique par utilisateur, insensible à la casse (`citext`). */
@Injectable()
export class TagsService {
  constructor(
    private readonly ctx: OrganizationContext,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<Tag[]> {
    const rows = await this.ctx.db.tag.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: MAX_TAGS,
      select: TAG_SELECT,
    });
    return rows.map(toTag);
  }

  async get(id: string): Promise<Tag> {
    const row = await this.ctx.db.tag.findFirst({ where: { id }, select: TAG_SELECT });
    if (row === null) throw notFound();
    return toTag(row);
  }

  async create(input: CreateTagRequest): Promise<Tag> {
    try {
      const row = await this.ctx.db.tag.create({
        data: {
          id: this.ctx.newId(),
          userId: this.ctx.userId(),
          name: input.name,
          color: input.color ?? null,
        },
        select: TAG_SELECT,
      });
      return toTag(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  }

  async update(id: string, patch: UpdateTagRequest): Promise<Tag> {
    try {
      const { count } = await this.ctx.db.tag.updateMany({ where: { id }, data: patch });
      if (count === 0) throw notFound();
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
    return this.get(id);
  }

  /** Supprime le tag ; ses liaisons disparaissent avec lui (FK `ON DELETE CASCADE`). */
  async remove(id: string): Promise<void> {
    const { count } = await this.ctx.db.tag.deleteMany({ where: { id } });
    if (count === 0) throw notFound();
  }

  /** Fusion : les éléments du tag `id` reçoivent `targetTagId`, puis `id` est supprimé, en une transaction. */
  async merge(id: string, targetTagId: string): Promise<Tag> {
    if (id === targetTagId) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Un tag ne peut pas être fusionné avec lui-même.', {
        rule: 'TAG_MERGE_SAME',
      });
    }
    const userId = this.ctx.userId();
    await this.ctx.db.$transaction(async (tx) => {
      const found = await tx.tag.count({ where: { id: { in: [id, targetTagId] } } });
      if (found !== 2) throw notFound();
      for (const kind of TAGGABLE_KINDS) {
        await attachTag(tx, { userId, kind }, await taggedIds(tx, kind, id), targetTagId);
      }
      await tx.tag.deleteMany({ where: { id } });
    });
    await this.audit.record({
      action: 'organization.tag.merge',
      userId,
      entityType: 'tag',
      entityId: targetTagId,
      metadata: { mergedTagId: id },
    });
    return this.get(targetTagId);
  }
}
