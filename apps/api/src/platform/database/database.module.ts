import { Global, Module } from '@nestjs/common';

import { TenantContext } from '../tenant/tenant-context';

import { PrismaService } from './prisma.service';
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
  ],
  exports: [PrismaService, TENANT_PRISMA],
})
export class DatabaseModule {}
