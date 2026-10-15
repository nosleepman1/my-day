import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AdminProvisioningError, AdminProvisioningService } from '../../../src/modules/users';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import { createTestApp } from '../../helpers/create-test-app';

const STRONG = 'thiéboudienne au poisson 2026';

describe('create-admin provisioning (ADR-002, PHASE-01 T13)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let provisioning: AdminProvisioningService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    provisioning = app.get(AdminProvisioningService);
  });

  afterAll(async () => {
    await app.close();
  });

  const unique = (): string => `admin-${randomUUID()}@example.test`;
  const provision = (email: string, force = false, password = STRONG) =>
    provisioning.provision({ email, force, password: () => Promise.resolve(password) });
  const roleOf = async (email: string) => (await prisma.user.findFirstOrThrow({ where: { email } })).role;

  it('creates a verified ADMIN once, keeps it unchanged, and refuses a second one without --force', async () => {
    const first = unique();
    const second = unique();
    await prisma.user.updateMany({ where: { role: 'ADMIN' }, data: { role: 'USER' } });

    expect(await provision(first)).toBe('created');
    expect(await provision(first.toUpperCase())).toBe('unchanged');
    await expect(provision(second)).rejects.toBeInstanceOf(AdminProvisioningError);

    const admin = await prisma.user.findFirstOrThrow({
      where: { email: first },
      include: { preferences: true },
    });
    expect(admin).toMatchObject({ role: 'ADMIN', emailVerifiedAt: expect.any(Date) as unknown });
    expect(admin.preferences).not.toBeNull();
  });

  it('transfers the single ADMIN role with --force, to a new or an existing account', async () => {
    const previous = (await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } })).email;
    const fresh = unique();

    expect(await provision(fresh, true)).toBe('created');
    expect(await roleOf(previous)).toBe('USER');
    expect(await provision(previous, true)).toBe('promoted');
    expect(await roleOf(fresh)).toBe('USER');
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });

  it('refuses a password that breaks the policy', async () => {
    await expect(provision(unique(), true, 'court')).rejects.toThrow(/TOO_SHORT/);
  });
});
