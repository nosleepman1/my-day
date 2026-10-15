import type { Prisma } from '@prisma/client';

import type { Project } from '@orbit/contracts';

import { firstFreeSlug } from '../domain/slug';
import { civilOrNull, isoOrNull, type ScopedTx, TAG_IDS_SELECT, tagIdsOf } from '../shared/records';

export const PROJECT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  type: true,
  status: true,
  priority: true,
  startsOn: true,
  targetOn: true,
  completedOn: true,
  color: true,
  version: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  tags: TAG_IDS_SELECT,
} as const satisfies Prisma.ProjectSelect;

export type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_SELECT }>;

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    type: row.type,
    status: row.status,
    priority: row.priority,
    startsOn: civilOrNull(row.startsOn),
    targetOn: civilOrNull(row.targetOn),
    completedOn: civilOrNull(row.completedOn),
    color: row.color,
    tagIds: tagIdsOf(row.tags),
    version: row.version,
    archivedAt: isoOrNull(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Premier slug libre parmi les projets vivants de l'utilisateur, dans la transaction de création. */
export async function freeSlug(tx: ScopedTx, base: string): Promise<string> {
  const rows = await tx.project.findMany({
    where: { deletedAt: null, slug: { startsWith: base } },
    select: { slug: true },
    // Borne : au-delà de 200 homonymes, la création échoue en 409 plutôt que de tout lire.
    take: 200,
  });
  return firstFreeSlug(base, new Set(rows.map((row) => row.slug.toLowerCase())));
}
