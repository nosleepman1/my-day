import { Global, Module } from '@nestjs/common';

import { TenantContext } from '../tenant/tenant-context';

import { PrismaService } from './prisma.service';
import { AccountLockingQueries } from './raw/account-locking.queries';
import { IdeaSimilarityQueries } from './raw/idea-similarity.queries';
import { createScopedPrisma, TENANT_PRISMA } from './scoped-prisma';

/**
 * `PrismaService` : client brut (plateforme, auth, users, admin). `TENANT_PRISMA` : client cloisonné
 * par utilisateur, seul autorisé dans les autres modules (ADR-007-3, règle ESLint).
 */
@Global()
@Module({
  providers: [
    PrismaService,
    { provide: TENANT_PRISMA, inject: [PrismaService, TenantContext], useFactory: createScopedPrisma },
    IdeaSimilarityQueries,
    AccountLockingQueries,
  ],
  exports: [PrismaService, TENANT_PRISMA, IdeaSimilarityQueries, AccountLockingQueries],
})
export class DatabaseModule {}
