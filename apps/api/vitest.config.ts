import ts from 'typescript';
import { defineConfig } from 'vitest/config';

type TranspiledModule = { code: string; map: string | null } | null;

/**
 * Transpilation TypeScript des sources de l'API avec emission des metadonnees de decorateurs dont depend
 * l'injection NestJS (TESTING.md 3.1). Le compilateur TypeScript est du JavaScript pur : contrairement au
 * binaire natif de SWC, le controle d'application de Windows ne peut pas le bloquer (ADR-040).
 */
const DECORATOR_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  useDefineForClassFields: false,
  sourceMap: true,
  inlineSources: true,
};

const typescriptDecorators = {
  name: 'orbit:typescript-decorators',
  enforce: 'pre' as const,
  transform(code: string, id: string): TranspiledModule {
    const file = id.split('?')[0] ?? id;
    if (!file.endsWith('.ts') || file.includes('/node_modules/')) return null;
    const output = ts.transpileModule(code, { fileName: file, compilerOptions: DECORATOR_OPTIONS });
    return { code: output.outputText, map: output.sourceMapText ?? null };
  },
};

export default defineConfig({
  plugins: [typescriptDecorators],
  test: {
    globals: false,
    setupFiles: ['./test/setup/unit.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts', 'test/finance/**/*.spec.ts'],
          testTimeout: 10_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.int.spec.ts'],
          globalSetup: ['./test/setup/postgres.global-setup.ts'],
          pool: 'forks',
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
      { extends: true, test: { name: 'architecture', include: ['test/architecture/**/*.arch.spec.ts'] } },
      {
        extends: true,
        test: {
          name: 'isolation',
          include: ['test/isolation/**/*.isolation.spec.ts'],
          globalSetup: ['./test/setup/postgres.global-setup.ts'],
          pool: 'forks',
          testTimeout: 60_000,
          hookTimeout: 180_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/worker.ts',
        'src/cli/cli.ts',
        'src/**/*.module.ts',
        'src/**/*.port.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
