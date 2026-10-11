import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';

/** Moindre privilege (SECURITY.md, INFRASTRUCTURE.md 9.1) : le role applicatif ne fait jamais de DDL. */
describe('PostgreSQL privileges of orbit_app', () => {
  let app: PrismaClient;

  beforeAll(() => {
    app = new PrismaClient({ datasourceUrl: inject('databaseUrl') });
  });

  afterAll(async () => {
    await app.$disconnect();
  });

  it('connects as orbit_app and can read', async () => {
    const rows = await app.$queryRaw<{ current_user: string }[]>`SELECT current_user`;
    expect(rows[0]?.current_user).toBe('orbit_app');
  });

  it('cannot create a table in the public schema', async () => {
    await expect(app.$executeRaw`CREATE TABLE privilege_probe (id int)`).rejects.toThrow(
      /permission denied/i,
    );
  });

  it('runs with a statement timeout', async () => {
    const rows = await app.$queryRaw<{ statement_timeout: string }[]>`SHOW statement_timeout`;
    expect(rows[0]?.statement_timeout).toBe('15s');
  });
});
