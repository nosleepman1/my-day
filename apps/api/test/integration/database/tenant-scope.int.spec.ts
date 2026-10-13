import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';

import { USER_MODULES } from '@orbit/contracts';

import { createScopedPrisma, type ScopedPrismaClient } from '../../../src/platform/database/scoped-prisma';
import { TenantScopeViolationError } from '../../../src/platform/database/tenant-scope.extension';
import { UuidV7Generator } from '../../../src/platform/ids/uuid-v7.generator';
import {
  MissingTenantContextError,
  type OrbitClsStore,
  TenantContext,
} from '../../../src/platform/tenant/tenant-context';

const ids = new UuidV7Generator();

describe('tenantScope extension against PostgreSQL (ADR-007-3)', () => {
  let raw: PrismaClient;
  let tenant: TenantContext;
  let scoped: ScopedPrismaClient;
  let alice: string;
  let bob: string;

  async function createUser(): Promise<string> {
    const id = ids.next();
    await raw.user.create({
      data: {
        id,
        email: `tenant-${randomUUID()}@example.test`,
        passwordHash: '$argon2id$v=19$m=1024,t=1,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaA',
        displayName: 'Test',
        preferences: { create: { enabledModules: [...USER_MODULES] } },
      },
    });
    return id;
  }

  beforeAll(async () => {
    raw = new PrismaClient({ datasourceUrl: inject('databaseUrl') });
    tenant = new TenantContext(new ClsService<OrbitClsStore>(new AsyncLocalStorage()));
    scoped = createScopedPrisma(raw, tenant);
    alice = await createUser();
    bob = await createUser();
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  const asAlice = <T>(task: () => Promise<T>): Promise<T> => tenant.runAsUser(alice, 'USER', task);

  it("only sees the current user's rows, even when asking for another user's", async () => {
    const own = await asAlice(() => scoped.userPreference.findMany({ select: { userId: true } }));
    const stolen = await asAlice(() => scoped.userPreference.findFirst({ where: { userId: bob } }));

    expect(own.map((row) => row.userId)).toEqual([alice]);
    expect(stolen).toBeNull();
  });

  it("cannot update another user's rows", async () => {
    const { count } = await asAlice(() =>
      scoped.userPreference.updateMany({ data: { timezone: 'Europe/Paris' } }),
    );

    const bobPreferences = await raw.userPreference.findFirstOrThrow({ where: { userId: bob } });
    expect(count).toBe(1);
    expect(bobPreferences.timezone).toBe('Africa/Dakar');
  });

  it('stamps created rows with the current user', async () => {
    const event = await asAlice(() =>
      scoped.loginEvent.create({
        data: { id: ids.next(), eventType: 'LOGOUT', occurredAt: new Date() },
        select: { userId: true },
      }),
    );

    expect(event.userId).toBe(alice);
  });

  it('refuses findUnique, unscoped models and any query without a context', async () => {
    await expect(asAlice(() => scoped.userPreference.findUnique({ where: { userId: bob } }))).rejects.toThrow(
      TenantScopeViolationError,
    );
    await expect(asAlice(() => scoped.user.findMany())).rejects.toThrow(TenantScopeViolationError);
    await expect(scoped.userPreference.findMany()).rejects.toThrow(MissingTenantContextError);
  });
});
