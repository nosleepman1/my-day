import { Inject, Injectable } from '@nestjs/common';

import { type ScopedPrismaClient, TENANT_PRISMA } from '../../../platform/database/scoped-prisma';
import type { IdGeneratorPort } from '../../../platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../../platform/ids/ids.module';
import { TenantContext } from '../../../platform/tenant/tenant-context';
import { CLOCK, type ClockPort } from '../../../platform/time/clock.port';

/**
 * Dépendances techniques communes aux services M03 : client Prisma cloisonné (ADR-007-3), générateur
 * d'UUIDv7 (ADR-011), horloge et utilisateur courant. Un seul paramètre au lieu de quatre par service.
 */
@Injectable()
export class OrganizationContext {
  constructor(
    @Inject(TENANT_PRISMA) readonly db: ScopedPrismaClient,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly tenant: TenantContext,
  ) {}

  /** @throws {MissingTenantContextError} hors d'une requête authentifiée. */
  userId(): string {
    return this.tenant.requireUserId();
  }

  newId(): string {
    return this.ids.next();
  }

  now(): Date {
    return this.clock.now();
  }
}
