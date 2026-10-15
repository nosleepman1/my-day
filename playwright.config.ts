import { defineConfig, devices } from '@playwright/test';

const isCi = process.env['CI'] === 'true';

/** Ports surchargeables : la CI auto-hébergée tourne sur des ports dédiés pour ne pas heurter le poste de dev. */
const apiPort = process.env['E2E_API_PORT'] ?? '3000';
const webPort = process.env['E2E_WEB_PORT'] ?? '5173';
const apiUrl = `http://localhost:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;

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
    baseURL: webUrl,
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
      url: `${apiUrl}/api/v1/health/live`,
      reuseExistingServer: !isCi,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        APP_ENV: 'test',
        PORT: apiPort,
        APP_ORIGIN: webUrl,
        LOG_LEVEL: 'warn',
        DATABASE_URL: e2eDatabaseUrl,
        SMTP_PORT: process.env['ORBIT_SMTP_PORT'] ?? '1025',
        MAIL_FROM: 'ORBIT <no-reply@orbit.localhost>',
        RATE_LIMIT_HMAC_KEY: 'e2e-only-rate-limit-key-0123456789abcdef',
        // Les parcours E2E créent leurs propres comptes (adresses uniques en e2e.orbit.test).
        REGISTRATION_MODE: 'open',
        // Chaque parcours crée son compte depuis la même IP : la limite d'inscription (5/h) serait atteinte.
        // Les limitations sont couvertes par les tests d'intégration (`protections.int.spec.ts`).
        RATE_LIMIT_ENABLED: 'false',
      },
    },
    {
      command: 'pnpm --filter @orbit/web dev',
      url: webUrl,
      reuseExistingServer: !isCi,
      timeout: 120_000,
      env: { WEB_PORT: webPort, API_PROXY_TARGET: apiUrl },
    },
  ],
});
