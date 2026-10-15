import { notFound, versionConflict } from './versioning';

type Where = Record<string, unknown>;

/** Sous-ensemble commun des délégués Prisma des ressources versionnées (`ideas`, `projects`, `tasks`, `notes`). */
export type VersionedTable = Readonly<{
  updateMany(args: { where: Where; data: Where }): PromiseLike<{ count: number }>;
  findFirst(args: { where: Where; select: { version: true } }): PromiseLike<{ version: number } | null>;
}>;

/** Les délégués Prisma ont des signatures génériques : vue structurelle de l'un d'eux. */
export function versioned(delegate: unknown): VersionedTable {
  return delegate as VersionedTable;
}

/**
 * Écriture sur une ligne vivante (`deleted_at IS NULL`) qui incrémente `version` (API.md §10).
 * Avec `expectedVersion`, la ligne n'est modifiée que si sa version correspond.
 * @throws {DomainError} NOT_FOUND si la ligne est absente ; VERSION_CONFLICT si la version diffère.
 */
export async function updateVersioned(
  table: VersionedTable,
  id: string,
  expectedVersion: number | undefined,
  data: Where,
): Promise<void> {
  const where = {
    id,
    deletedAt: null,
    ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
  };
  const { count } = await table.updateMany({ where, data: { ...data, version: { increment: 1 } } });
  if (count > 0) return;
  const current = await table.findFirst({ where: { id, deletedAt: null }, select: { version: true } });
  throw current === null ? notFound() : versionConflict(current.version);
}

/** Retire les clés absentes : Prisma (avec `exactOptionalPropertyTypes`) refuse `undefined` explicite. */
export function definedOnly<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

/** Date civile facultative d'un PATCH → valeur Prisma (`undefined` = inchangée, `null` = effacée). */
export function civilInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  return new Date(`${value}T00:00:00.000Z`);
}
