import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type {
  CreateNoteRequest,
  Note,
  NoteListQuery,
  NoteListResponse,
  UpdateNoteRequest,
} from '@orbit/contracts';

import { createOnce, type CreateOnceResult } from '../shared/create-once';
import { cursorWhere, defineSort, keysetPage, orderByOf, type SortSpec } from '../shared/keyset';
import { definedOnly, updateVersioned, versioned } from '../shared/lifecycle';
import { OrganizationContext } from '../shared/organization-context';
import { archivedWhere } from '../shared/records';
import { replaceTags } from '../shared/tag-links';
import { notFound } from '../shared/versioning';

import { NOTE_SELECT, NOTE_SUMMARY_SELECT, type NoteRow, toNote, toNoteSummary } from './note-records';

const SORTS: Readonly<Record<NoteListQuery['sort'], SortSpec>> = {
  '-updatedAt': defineSort('-updatedAt', 'instant'),
  title: defineSort('title', 'text', { nullable: true }),
};

function linkedTo(query: NoteListQuery): Prisma.NoteWhereInput {
  const target = definedOnly({ ideaId: query.ideaId, projectId: query.projectId, taskId: query.taskId });
  return Object.keys(target).length === 0 ? {} : { links: { some: target } };
}

function filtersOf(query: NoteListQuery): Prisma.NoteWhereInput {
  return {
    deletedAt: null,
    ...archivedWhere(query.archived),
    ...(query.kind === undefined ? {} : { kind: { in: query.kind } }),
    ...(query.pinned === undefined ? {} : { pinnedAt: query.pinned ? { not: null } : null }),
    ...(query.tagId === undefined ? {} : { tags: { some: { tagId: query.tagId } } }),
    ...linkedTo(query),
    ...(query.q === undefined
      ? {}
      : {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { content: { contains: query.q, mode: 'insensitive' } },
          ],
        }),
  };
}

/**
 * Notes (API.md §14.5). Le contenu Markdown est stocké brut et jamais interprété par l'API : le rendu
 * assaini se fait côté front (`SafeMarkdown`, SECURITY.md). `If-Match` obligatoire en écriture (§10).
 */
@Injectable()
export class NotesService {
  constructor(private readonly ctx: OrganizationContext) {}

  async list(query: NoteListQuery): Promise<NoteListResponse> {
    const spec = SORTS[query.sort];
    const rows = await this.ctx.db.note.findMany({
      where: { AND: [filtersOf(query), cursorWhere(spec, query.cursor) as Prisma.NoteWhereInput] },
      orderBy: orderByOf(spec) as Prisma.NoteOrderByWithRelationInput[],
      take: query.limit + 1,
      select: NOTE_SUMMARY_SELECT,
    });
    const page = keysetPage(rows, query.limit, spec);
    return {
      data: page.rows.map(toNoteSummary),
      meta: { limit: query.limit, hasMore: page.hasMore, nextCursor: page.nextCursor },
    };
  }

  find(id: string): Promise<NoteRow | null> {
    return this.ctx.db.note.findFirst({ where: { id, deletedAt: null }, select: NOTE_SELECT });
  }

  async require(id: string): Promise<NoteRow> {
    const row = await this.find(id);
    if (row === null) throw notFound();
    return row;
  }

  async get(id: string): Promise<Note> {
    return toNote(await this.require(id));
  }

  async create(input: CreateNoteRequest): Promise<CreateOnceResult<Note>> {
    const userId = this.ctx.userId();
    const result = await createOnce(
      input.id,
      (id) => this.find(id),
      () =>
        this.ctx.db.$transaction(async (tx) => {
          const id = input.id ?? this.ctx.newId();
          await tx.note.create({
            data: {
              id,
              userId,
              title: input.title ?? null,
              content: input.content ?? '',
              contentFormat: input.contentFormat ?? 'MARKDOWN',
              kind: input.kind ?? 'NOTE',
              source: input.source ?? 'MANUAL',
              clientCaptureId: input.id ?? null,
              pinnedAt: input.pinned === true ? this.ctx.now() : null,
            },
            select: { id: true },
          });
          await replaceTags(tx, { userId, kind: 'note', entityId: id }, input.tagIds ?? []);
          return tx.note.findFirstOrThrow({ where: { id }, select: NOTE_SELECT });
        }),
    );
    return { row: toNote(result.row), created: result.created };
  }

  async update(id: string, patch: UpdateNoteRequest, ifMatch: number): Promise<Note> {
    const { pinned, ...fields } = patch;
    await updateVersioned(versioned(this.ctx.db.note), id, ifMatch, {
      ...definedOnly(fields),
      ...(pinned === undefined ? {} : { pinnedAt: pinned ? this.ctx.now() : null }),
    });
    return this.get(id);
  }

  async setArchived(id: string, archived: boolean): Promise<Note> {
    await updateVersioned(versioned(this.ctx.db.note), id, undefined, {
      archivedAt: archived ? this.ctx.now() : null,
    });
    return this.get(id);
  }

  async remove(id: string, ifMatch: number): Promise<void> {
    await updateVersioned(versioned(this.ctx.db.note), id, ifMatch, { deletedAt: this.ctx.now() });
  }

  async setTags(id: string, tagIds: readonly string[]): Promise<Note> {
    await this.require(id);
    const userId = this.ctx.userId();
    await this.ctx.db.$transaction((tx) => replaceTags(tx, { userId, kind: 'note', entityId: id }, tagIds));
    return this.get(id);
  }
}
