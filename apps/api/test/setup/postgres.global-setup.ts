import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

/** Même version majeure que la production (INFRASTRUCTURE.md, PostgreSQL 17). */
const POSTGRES_IMAGE = 'postgres:17.6-alpine';
const API_ROOT = fileURLToPath(new URL('../..', import.meta.url));

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

function applyMigrations(databaseUrl: string): void {
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_MIGRATION_URL: databaseUrl },
    stdio: 'pipe',
  });
}

/** Un conteneur PostgreSQL par exécution, migrations réelles appliquées une fois (TESTING.md §3.1). */
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase('orbit_test')
    .withUsername('orbit_owner')
    .withPassword('test_only_password')
    .start();
  const databaseUrl = container.getConnectionUri();
  applyMigrations(databaseUrl);
  project.provide('databaseUrl', databaseUrl);
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
