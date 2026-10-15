import { Inject, Injectable } from '@nestjs/common';

import { type ScopedPrismaClient, TENANT_PRISMA } from '../../../platform/database/scoped-prisma';
import type { IdGeneratorPort } from '../../../platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../../platform/ids/ids.module';
import { TenantContext } from '../../../platform/tenant/tenant-context';
import { CLOCK, type ClockPort } from '../../../platform/time/clock.port';

@Injectable()
export class FinanceContext {
  constructor(
    @Inject(TENANT_PRISMA) readonly db: ScopedPrismaClient,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly tenant: TenantContext,
  ) {}

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
