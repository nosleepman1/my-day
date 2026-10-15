import type { Prisma } from '@prisma/client';

import type { Idea } from '@orbit/contracts';

import { isoOrNull, TAG_IDS_SELECT, tagIdsOf } from '../shared/records';

export const IDEA_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  domain: true,
  potentialScore: true,
  decisionNote: true,
  capturedAt: true,
  source: true,
  convertedProjectId: true,
  version: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  tags: TAG_IDS_SELECT,
} as const satisfies Prisma.IdeaSelect;

export type IdeaRow = Prisma.IdeaGetPayload<{ select: typeof IDEA_SELECT }>;

export function toIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    domain: row.domain,
    potentialScore: row.potentialScore,
    decisionNote: row.decisionNote,
    capturedAt: row.capturedAt.toISOString(),
    source: row.source,
    convertedProjectId: row.convertedProjectId,
    tagIds: tagIdsOf(row.tags),
    version: row.version,
    archivedAt: isoOrNull(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
