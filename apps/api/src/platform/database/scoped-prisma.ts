import type { PrismaClient } from '@prisma/client';

import type { TenantContext } from '../tenant/tenant-context';

import { tenantScopeExtension } from './tenant-scope.extension';

/** Jeton d'injection du client Prisma cloisonné par utilisateur, seul client des modules métier. */
export const TENANT_PRISMA = Symbol('TENANT_PRISMA');

/** Client cloisonné : chaque requête porte le `userId` du contexte courant (ADR-007-3). */
export function createScopedPrisma(prisma: PrismaClient, tenant: TenantContext) {
  return prisma.$extends(tenantScopeExtension(() => tenant.requireUserId()));
}

export type ScopedPrismaClient = ReturnType<typeof createScopedPrisma>;
