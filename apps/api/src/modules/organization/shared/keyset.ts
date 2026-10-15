import { DomainError } from '../../../platform/errors/domain-error';
import { decodeCursor, encodeCursor } from '../../../platform/http/cursor';
import { defaultMessageOf } from '../../../platform/http/error-mapping';

/**
 * Pagination par clé (API.md §7) pour les listes M03 : un champ de tri de la liste blanche, complété par
 * `id` (UUIDv7) dans le même sens. Curseur opaque `[clé de tri, nul ?, valeur, id]` : un curseur émis pour
 * un autre tri est refusé (`INVALID_CURSOR`). Les valeurs nulles sont rangées en dernier.
 */

export type SortKind = 'instant' | 'date' | 'text' | 'enum';

export type SortSpec = Readonly<{
  key: string;
  field: string;
  direction: 'asc' | 'desc';
  kind: SortKind;
  nullable: boolean;
  /** Ordre croissant des valeurs d'une énumération PostgreSQL. */
  enumValues: readonly string[];
}>;

type Where = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NULL_FLAG = '1';
const VALUE_FLAG = '0';

export function defineSort(
  key: string,
  kind: SortKind,
  options: Readonly<{ nullable?: boolean; enumValues?: readonly string[] }> = {},
): SortSpec {
  return {
    key,
    field: key.replace(/^-/, ''),
    direction: key.startsWith('-') ? 'desc' : 'asc',
    kind,
    nullable: options.nullable ?? false,
    enumValues: options.enumValues ?? [],
  };
}

function invalidCursor(): DomainError {
  return new DomainError('INVALID_CURSOR', defaultMessageOf('INVALID_CURSOR'));
}

export function orderByOf(spec: SortSpec): Where[] {
  const primary = spec.nullable ? { sort: spec.direction, nulls: 'last' } : spec.direction;
  return [{ [spec.field]: primary }, { id: spec.direction }];
}

function parseValue(spec: SortSpec, raw: string): Date | string {
  if (spec.kind === 'text') return raw;
  if (spec.kind === 'enum') {
    if (!spec.enumValues.includes(raw)) throw invalidCursor();
    return raw;
  }
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) throw invalidCursor();
  return value;
}

/** Valeurs d'énumération situées après `value` dans le sens du tri (Prisma ne compare pas les enums). */
function enumBeyond(spec: SortSpec, value: string): string[] {
  const index = spec.enumValues.indexOf(value);
  return spec.enumValues.filter((_, position) =>
    spec.direction === 'asc' ? position > index : position < index,
  );
}

/** Filtre « après le curseur » ; `{}` sans curseur. */
/** Parties d'un curseur émis pour ce tri ; `INVALID_CURSOR` sinon. */
function readCursor(spec: SortSpec, cursor: string): Readonly<{ isNull: boolean; raw: string; id: string }> {
  const [key, flag, raw = '', id = ''] = decodeCursor(cursor, 4);
  const validFlag = flag === NULL_FLAG || flag === VALUE_FLAG;
  if (key !== spec.key || !UUID.test(id) || !validFlag) throw invalidCursor();
  return { isNull: flag === NULL_FLAG, raw, id };
}

export function cursorWhere(spec: SortSpec, cursor: string | undefined): Where {
  if (cursor === undefined) return {};
  const { isNull, raw, id } = readCursor(spec, cursor);
  const comparison = spec.direction === 'asc' ? 'gt' : 'lt';
  const idAfter = { id: { [comparison]: id } };
  if (isNull) {
    if (!spec.nullable) throw invalidCursor();
    return { [spec.field]: null, ...idAfter };
  }
  const value = parseValue(spec, raw);
  const beyond =
    spec.kind === 'enum'
      ? { [spec.field]: { in: enumBeyond(spec, value as string) } }
      : { [spec.field]: { [comparison]: value } };
  const branches: Where[] = [beyond, { [spec.field]: value, ...idAfter }];
  return { OR: spec.nullable ? [...branches, { [spec.field]: null }] : branches };
}

function serialize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  throw new TypeError('unsupported sort value');
}

export type KeysetPage<T> = Readonly<{ rows: T[]; hasMore: boolean; nextCursor: string | null }>;

/** Découpe `limit + 1` lignes lues en une page et calcule le curseur suivant. */
export function keysetPage<T extends { id: string }>(
  rows: readonly T[],
  limit: number,
  spec: SortSpec,
): KeysetPage<T> {
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  if (!hasMore || last === undefined) return { rows: page, hasMore, nextCursor: null };
  const value = serialize((last as Record<string, unknown>)[spec.field]);
  const parts = value === null ? [spec.key, NULL_FLAG, '', last.id] : [spec.key, VALUE_FLAG, value, last.id];
  return { rows: page, hasMore, nextCursor: encodeCursor(parts) };
}
