import type { Prisma } from '@prisma/client';

import { NOTE_EXCERPT_LENGTH, type Note, type NoteLink, type NoteSummary } from '@orbit/contracts';

import { isoOrNull, TAG_IDS_SELECT, tagIdsOf } from '../shared/records';

const TARGET = { select: { id: true, title: true } } as const;

export const NOTE_LINK_SELECT = {
  id: true,
  createdAt: true,
  idea: TARGET,
  project: { select: { id: true, name: true } },
  task: TARGET,
} as const satisfies Prisma.NoteLinkSelect;

const NOTE_BASE_SELECT = {
  id: true,
  title: true,
  contentFormat: true,
  kind: true,
  source: true,
  pinnedAt: true,
  archivedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  tags: TAG_IDS_SELECT,
} as const satisfies Prisma.NoteSelect;

/** La liste lit le contenu pour en tirer l'extrait (200 000 caractères au plus par note, API.md §11). */
export const NOTE_SUMMARY_SELECT = {
  ...NOTE_BASE_SELECT,
  content: true,
} as const satisfies Prisma.NoteSelect;

export const NOTE_SELECT = {
  ...NOTE_BASE_SELECT,
  content: true,
  links: { select: NOTE_LINK_SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} as const satisfies Prisma.NoteSelect;

export type NoteLinkRow = Prisma.NoteLinkGetPayload<{ select: typeof NOTE_LINK_SELECT }>;
type NoteBaseRow = Prisma.NoteGetPayload<{ select: typeof NOTE_BASE_SELECT }>;
export type NoteSummaryRow = Prisma.NoteGetPayload<{ select: typeof NOTE_SUMMARY_SELECT }>;
export type NoteRow = Prisma.NoteGetPayload<{ select: typeof NOTE_SELECT }>;

/** Lien vers sa cible ; `null` si la cible a disparu (supprimée définitivement entre-temps). */
export function toNoteLink(row: NoteLinkRow): NoteLink | null {
  const base = { id: row.id, createdAt: row.createdAt.toISOString() };
  if (row.idea !== null)
    return { ...base, targetType: 'IDEA', targetId: row.idea.id, targetTitle: row.idea.title };
  if (row.project !== null) {
    return { ...base, targetType: 'PROJECT', targetId: row.project.id, targetTitle: row.project.name };
  }
  if (row.task !== null)
    return { ...base, targetType: 'TASK', targetId: row.task.id, targetTitle: row.task.title };
  return null;
}

function baseOf(row: NoteBaseRow) {
  return {
    id: row.id,
    title: row.title,
    contentFormat: row.contentFormat,
    kind: row.kind,
    source: row.source,
    pinnedAt: isoOrNull(row.pinnedAt),
    archivedAt: isoOrNull(row.archivedAt),
    tagIds: tagIdsOf(row.tags),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toNoteSummary(row: NoteSummaryRow): NoteSummary {
  return { ...baseOf(row), excerpt: row.content.slice(0, NOTE_EXCERPT_LENGTH) };
}

export function toNote(row: NoteRow): Note {
  return {
    ...baseOf(row),
    content: row.content,
    links: row.links.map(toNoteLink).filter((link): link is NoteLink => link !== null),
  };
}
