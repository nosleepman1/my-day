import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ESLint, type Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const CONFIG_ENTRY = pathToFileURL(join(ROOT, 'packages/config/eslint/index.mjs')).href;

type OrbitEslint = (options: { rootDir: string }) => Linter.Config[];

let eslint: ESLint;

/**
 * Lint un fragment de code « placé » à un chemin virtuel : le chemin détermine les règles appliquées.
 * L'analyse typée est désactivée (fichiers virtuels) ; seules les règles syntaxiques sont vérifiées ici.
 */
async function messagesFor(code: string, virtualPath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, virtualPath) });
  return (result?.messages ?? []).map((message) => `${message.ruleId ?? 'fatal'}: ${message.message}`);
}

beforeAll(async () => {
  const { orbitEslint } = (await import(CONFIG_ENTRY)) as { orbitEslint: OrbitEslint };
  eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      ...orbitEslint({ rootDir: ROOT }),
      { files: ['**/*.ts'], ...tseslint.configs.disableTypeChecked },
    ],
  });
});

describe('ORBIT ESLint rules catch deliberate violations (TESTING.md §11)', () => {
  const RAW = 'declare const prisma: { $queryRaw: unknown; $queryRawUnsafe: unknown };\n';

  it('reserves the raw PrismaService to platform, auth, users and admin (ADR-007-3)', async () => {
    const code =
      "import { PrismaService } from '../../platform/database/prisma.service';\nexport const s = PrismaService;\n";
    const inIdeas = await messagesFor(code, 'apps/api/src/modules/ideas/ideas.repository.ts');
    const inUsers = await messagesFor(code, 'apps/api/src/modules/users/users.repository.ts');
    expect(inIdeas.join('\n')).toContain('TENANT_PRISMA');
    expect(inUsers.join('\n')).not.toContain('TENANT_PRISMA');
  });

  it('forbids raw SQL outside platform/database/raw (ADR-028)', async () => {
    const inModule = await messagesFor(
      `${RAW}export const q = prisma.$queryRaw;\n`,
      'apps/api/src/modules/ideas/ideas.repository.ts',
    );
    const inRaw = await messagesFor(
      `${RAW}export const q = prisma.$queryRaw;\n`,
      'apps/api/src/platform/database/raw/q.ts',
    );
    expect(inModule.join('\n')).toContain('ADR-028');
    expect(inRaw.join('\n')).not.toContain('ADR-028');
  });

  it('forbids unsafe raw SQL everywhere, even in the raw folder', async () => {
    const messages = await messagesFor(
      `${RAW}export const q = prisma.$queryRawUnsafe;\n`,
      'apps/api/src/platform/database/raw/q.ts',
    );
    expect(messages.join('\n')).toContain('SQL non sûr');
  });

  it('forbids converting an amount to number (ADR-008)', async () => {
    const lenient = await messagesFor(
      'declare const amountMinor: string;\nexport const n = Number(amountMinor);\n',
      'apps/api/src/platform/http/x.ts',
    );
    const strict = await messagesFor(
      'declare const value: string;\nexport const n = Number(value);\n',
      'packages/money/src/x.ts',
    );
    expect(lenient.join('\n')).toContain('ADR-008');
    expect(strict.join('\n')).toContain('ADR-008');
  });

  it('forbids console.log in production code', async () => {
    const messages = await messagesFor("console.log('debug');\n", 'apps/api/src/platform/http/x.ts');
    expect(messages.some((message) => message.startsWith('no-console'))).toBe(true);
  });

  it('forbids the system clock and findUnique inside business modules (ADR-007, ADR-011)', async () => {
    const clock = await messagesFor(
      'export const now = new Date();\n',
      'apps/api/src/modules/tasks/tasks.service.ts',
    );
    const platform = await messagesFor(
      'export const now = new Date();\n',
      'apps/api/src/platform/time/system-clock.ts',
    );
    const unique = await messagesFor(
      'declare const repo: { findUnique: () => void };\nrepo.findUnique();\n',
      'apps/api/src/modules/tasks/tasks.repository.ts',
    );
    expect(clock.join('\n')).toContain('ClockPort');
    expect(platform.join('\n')).not.toContain('ClockPort');
    expect(unique.join('\n')).toContain('findFirst');
  });

  it('keeps packages/contracts free of server frameworks (ADR-010)', async () => {
    const messages = await messagesFor(
      "import { Prisma } from '@prisma/client';\n\nexport const p = Prisma;\n",
      'packages/contracts/src/x.ts',
    );
    expect(messages.join('\n')).toContain('ADR-010');
  });

  it('forbids TypeScript enums', async () => {
    const messages = await messagesFor('export enum Status { A }\n', 'apps/api/src/platform/http/x.ts');
    expect(messages.join('\n')).toContain('enum TypeScript interdit');
  });
});
