import { Prisma } from '@prisma/client';

type Args = Readonly<Record<string, unknown>>;
type Clause = Record<string, unknown>;

/**
 * Modèles hors cloisonnement (DESIGN_PATTERNS.md §3) : accessibles uniquement par le client brut
 * `PrismaService`, réservé à `platform/*` et aux modules `auth`, `users` et `admin` (lint).
 */
export const UNSCOPED_MODELS: ReadonlySet<string> = new Set([
  'User',
  'Session',
  'EmailVerificationToken',
  'PasswordResetToken',
]);

/** Requête qui contournerait le cloisonnement : erreur de programmation, jamais exécutée. */
export class TenantScopeViolationError extends Error {
  override readonly name = 'TenantScopeViolationError';

  constructor(detail: string) {
    super(`Tenant scope violation: ${detail}`);
  }
}

const FILTER_OPERATIONS: ReadonlySet<string> = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);
const UNIQUE_OPERATIONS: ReadonlySet<string> = new Set(['update', 'delete']);
const CREATE_OPERATIONS: ReadonlySet<string> = new Set(['create', 'createMany', 'createManyAndReturn']);
const UPDATE_OPERATIONS: ReadonlySet<string> = new Set(['update', 'updateMany', 'updateManyAndReturn']);

function asClause(value: unknown): Clause {
  return typeof value === 'object' && value !== null ? (value as Clause) : {};
}

/** Filtre : un `userId` différent fourni par l'appelant est combiné en `AND`, donc ne trouve rien. */
function filterWhere(where: unknown, userId: string): Clause {
  const clause = asClause(where);
  if (clause['userId'] === undefined || clause['userId'] === userId) return { ...clause, userId };
  return { AND: [clause, { userId }] };
}

/** Cible unique (`update`, `delete`, `upsert`) : un `userId` étranger est refusé. */
function uniqueWhere(where: unknown, userId: string, operation: string): Clause {
  const clause = asClause(where);
  if (clause['userId'] !== undefined && clause['userId'] !== userId) {
    throw new TenantScopeViolationError(`${operation} targets another user's row`);
  }
  return { ...clause, userId };
}

function stampOwner(data: unknown, userId: string, operation: string): Clause {
  const row = asClause(data);
  if (row['userId'] !== undefined && row['userId'] !== userId) {
    throw new TenantScopeViolationError(`${operation} writes a row for another user`);
  }
  return { ...row, userId };
}

function assertNoOwnerChange(data: unknown, operation: string): void {
  if ('userId' in asClause(data)) throw new TenantScopeViolationError(`${operation} changes userId`);
}

/**
 * Réécrit les arguments d'une opération Prisma pour l'utilisateur courant (ADR-007-3). Fonction pure,
 * sans mutation ; toute opération non prévue est refusée.
 */
export function scopeArgs(operation: string, args: Args, userId: string): Args {
  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
    throw new TenantScopeViolationError(`${operation} is forbidden: use findFirst({ where: { id } })`);
  }
  if (UPDATE_OPERATIONS.has(operation)) assertNoOwnerChange(args['data'], operation);
  if (FILTER_OPERATIONS.has(operation)) return { ...args, where: filterWhere(args['where'], userId) };
  if (UNIQUE_OPERATIONS.has(operation))
    return { ...args, where: uniqueWhere(args['where'], userId, operation) };
  if (CREATE_OPERATIONS.has(operation)) {
    const data = args['data'];
    return {
      ...args,
      data: Array.isArray(data)
        ? data.map((row: unknown) => stampOwner(row, userId, operation))
        : stampOwner(data, userId, operation),
    };
  }
  if (operation === 'upsert') {
    assertNoOwnerChange(args['update'], operation);
    return {
      ...args,
      where: uniqueWhere(args['where'], userId, operation),
      create: stampOwner(args['create'], userId, operation),
    };
  }
  throw new TenantScopeViolationError(`unsupported operation ${operation}`);
}

export function assertScopedModel(model: string): void {
  if (UNSCOPED_MODELS.has(model)) {
    throw new TenantScopeViolationError(`${model} is not a tenant model: use PrismaService`);
  }
}

/** Extension Prisma `tenantScope` : `requireUserId` lève `MissingTenantContextError` sans contexte. */
export function tenantScopeExtension(requireUserId: () => string) {
  return Prisma.defineExtension({
    name: 'tenantScope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          assertScopedModel(model);
          return query(scopeArgs(operation, args, requireUserId()));
        },
      },
    },
  });
}
