import { defineConfig, devices } from '@playwright/test';

const isCi = process.env['CI'] === 'true';

/** Base de données de l'API pendant l'E2E : la base de développement locale (Docker Compose), ou celle de la CI. */
const e2eDatabaseUrl =
  process.env['E2E_DATABASE_URL'] ?? 'postgresql://orbit_app:orbit_dev_only@localhost:5433/orbit';

/**
 * Tests de bout en bout (TESTING.md §3.1, §13) : l'API compilée et le front Vite sont démarrés,
 * le navigateur passe par le proxy /api comme en production avec la réécriture Vercel.
 */
export default defineConfig({
  testDir: './e2e/tests',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @orbit/api build && pnpm --filter @orbit/api start',
      url: 'http://localhost:3000/api/v1/health/live',
      reuseExistingServer: !isCi,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        APP_ENV: 'test',
        PORT: '3000',
        APP_ORIGIN: 'http://localhost:5173',
        LOG_LEVEL: 'warn',
        DATABASE_URL: e2eDatabaseUrl,
      },
    },
    {
      command: 'pnpm --filter @orbit/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !isCi,
      timeout: 120_000,
    },
  ],
});
