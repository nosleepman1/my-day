import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

/** Même version majeure que la production (INFRASTRUCTURE.md, PostgreSQL 17). */
const POSTGRES_IMAGE = 'postgres:17.6-alpine';
const DATABASE = 'orbit_test';
const APP_PASSWORD = 'test_only_app_password';
const API_ROOT = fileURLToPath(new URL('../..', import.meta.url));

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connexion du rôle applicatif `orbit_app` (DML seulement), utilisée par l'application testée. */
    databaseUrl: string;
    /** Connexion du rôle propriétaire, réservée aux vérifications de privilèges. */
    ownerDatabaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

function applyMigrations(ownerUrl: string): void {
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: ownerUrl, DATABASE_MIGRATION_URL: ownerUrl },
    stdio: 'pipe',
  });
}

async function enableAppLogin(started: StartedPostgreSqlContainer): Promise<string> {
  const sql = `ALTER ROLE orbit_app LOGIN PASSWORD '${APP_PASSWORD}'`;
  const result = await started.exec(['psql', '-U', 'orbit_owner', '-d', DATABASE, '-c', sql]);
  if (result.exitCode !== 0) throw new Error(`Cannot enable orbit_app login: ${result.output}`);
  return `postgresql://orbit_app:${APP_PASSWORD}@${started.getHost()}:${started.getPort()}/${DATABASE}`;
}

/**
 * Un conteneur PostgreSQL par exécution (TESTING.md §3.1) : migrations réelles appliquées par le
 * propriétaire, puis l'application testée se connecte avec le rôle `orbit_app`, comme en production.
 */
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase(DATABASE)
    .withUsername('orbit_owner')
    .withPassword('test_only_password')
    .start();
  const ownerDatabaseUrl = container.getConnectionUri();
  applyMigrations(ownerDatabaseUrl);
  project.provide('databaseUrl', await enableAppLogin(container));
  project.provide('ownerDatabaseUrl', ownerDatabaseUrl);
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
