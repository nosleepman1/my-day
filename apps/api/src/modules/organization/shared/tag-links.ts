import type { ScopedTx } from './records';

export type TaggableKind = 'idea' | 'project' | 'task' | 'note';

type LinkTable = Readonly<{
  deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
  createMany(args: { data: Record<string, string>[]; skipDuplicates: boolean }): Promise<unknown>;
}>;

const FOREIGN_KEY: Readonly<Record<TaggableKind, string>> = {
  idea: 'ideaId',
  project: 'projectId',
  task: 'taskId',
  note: 'noteId',
};

function tableOf(tx: ScopedTx, kind: TaggableKind): LinkTable {
  const tables: Record<TaggableKind, unknown> = {
    idea: tx.ideaTag,
    project: tx.projectTag,
    task: tx.taskTag,
    note: tx.noteTag,
  };
  return tables[kind] as LinkTable;
}

/** Propriétaire et type des éléments visés. */
export type TagOwner = Readonly<{ userId: string; kind: TaggableKind }>;
/** Élément visé : propriétaire, type et identifiant. */
export type TagTarget = TagOwner & Readonly<{ entityId: string }>;

/** Ajoute des liaisons ; une liaison déjà présente est ignorée. */
async function link(
  tx: ScopedTx,
  owner: TagOwner,
  pairs: readonly (readonly [string, string])[],
): Promise<void> {
  if (pairs.length === 0) return;
  const key = FOREIGN_KEY[owner.kind];
  await tableOf(tx, owner.kind).createMany({
    data: pairs.map(([entityId, tagId]) => ({ userId: owner.userId, [key]: entityId, tagId })),
    skipDuplicates: true,
  });
}

/**
 * Remplace les tags d'un élément (`PUT /<ressource>/:id/tags`, champ `tagIds` des créations). Un tag d'un
 * autre utilisateur viole la FK composite `(user_id, tag_id)` : l'erreur P2003 devient un 404 (API.md §5.3).
 */
export async function replaceTags(tx: ScopedTx, target: TagTarget, tagIds: readonly string[]): Promise<void> {
  const key = FOREIGN_KEY[target.kind];
  await tableOf(tx, target.kind).deleteMany({
    where: { [key]: target.entityId, tagId: { notIn: [...tagIds] } },
  });
  await link(
    tx,
    target,
    tagIds.map((tagId) => [target.entityId, tagId] as const),
  );
}

/** Pose `tagId` sur plusieurs éléments d'un même type (fusion de tags). */
export async function attachTag(
  tx: ScopedTx,
  owner: TagOwner,
  entityIds: readonly string[],
  tagId: string,
): Promise<void> {
  await link(
    tx,
    owner,
    entityIds.map((entityId) => [entityId, tagId] as const),
  );
}

/** Recopie des tags sur un élément (conversion idée → projet, occurrence de tâche). */
export async function copyTags(tx: ScopedTx, target: TagTarget, tagIds: readonly string[]): Promise<void> {
  await link(
    tx,
    target,
    tagIds.map((tagId) => [target.entityId, tagId] as const),
  );
}
