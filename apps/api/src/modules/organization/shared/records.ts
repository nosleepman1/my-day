import type { ArchivedFilter } from '@orbit/contracts';

import type { ScopedPrismaClient } from '../../../platform/database/scoped-prisma';

/** Client cloisonné à l'intérieur d'une transaction interactive (`$transaction(async (tx) => …)`). */
export type ScopedTx = Omit<
  ScopedPrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export function isoOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** Colonne `DATE` (minuit UTC côté Prisma) → date civile `YYYY-MM-DD`. */
export function civilOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

export function tagIdsOf(tags: readonly Readonly<{ tagId: string }>[]): string[] {
  return tags.map((tag) => tag.tagId).sort();
}

/** Filtre `archived` (API.md §1.8) sur une colonne `archived_at`. */
export function archivedWhere(filter: ArchivedFilter): Record<string, unknown> {
  if (filter === 'all') return {};
  return { archivedAt: filter === 'true' ? { not: null } : null };
}

export const TAG_IDS_SELECT = { select: { tagId: true } } as const;
