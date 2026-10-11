import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emet les metadonnees de decorateurs dont depend l injection NestJS (TESTING.md 3.1).
const swcPlugin = swc.vite({
  module: { type: 'es6' },
  jsc: {
    target: 'es2022',
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
  },
});

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    globals: false,
    setupFiles: ['./test/setup/unit.setup.ts'],
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'], testTimeout: 5_000 } },
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
      { extends: true, test: { name: 'isolation', include: ['test/isolation/**/*.isolation.spec.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/worker.ts', 'src/**/*.module.ts', 'src/**/*.port.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
