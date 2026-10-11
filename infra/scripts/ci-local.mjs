// Rejoue localement la CI de .github/workflows/ci.yml, étape par étape (mêmes commandes, même ordre).
// Usage : pnpm ci:local          (tout)
//         pnpm ci:local --no-e2e (sans le job de bout en bout)
// L'E2E tourne dans un projet Docker Compose dédié (orbit-ci) sur des ports dédiés,
// détruit à la fin : la base de développement n'est jamais touchée.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const COMPOSE_FILE = 'infra/compose/compose.dev.yml';

const E2E_ENV = {
  CI: 'true',
  COMPOSE_PROJECT_NAME: 'orbit-ci',
  ORBIT_PG_PORT: '5434',
  ORBIT_SMTP_PORT: '1026',
  ORBIT_MAILPIT_UI_PORT: '8026',
  E2E_API_PORT: '3100',
  E2E_WEB_PORT: '5273',
  E2E_DATABASE_URL: 'postgresql://orbit_app:orbit_dev_only@localhost:5434/orbit',
};
const OWNER_URL = 'postgresql://orbit_owner:orbit_dev_only@localhost:5434/orbit';

const QUALITY_STEPS = [
  'pnpm audit --audit-level high',
  'pnpm format:check',
  'pnpm build:packages',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm depcruise',
  'pnpm test:cov',
  'pnpm test:arch',
  'pnpm test:isolation',
  'pnpm build',
];

const results = [];

function run(command, { env = {}, cwd = ROOT } = {}) {
  const started = Date.now();
  process.stdout.write(`\n▶ ${command}\n`);
  const result = spawnSync(command, { cwd, env: { ...process.env, ...env }, stdio: 'inherit', shell: true });
  const ok = result.status === 0;
  results.push({ command, ok, seconds: Math.round((Date.now() - started) / 1000) });
  return ok;
}

function runAll(commands, options) {
  return commands.every((command) => run(command, options));
}

function e2e() {
  const options = { env: E2E_ENV };
  try {
    return (
      run(`docker compose -f ${COMPOSE_FILE} up -d --wait`, options) &&
      run('pnpm exec prisma migrate deploy', {
        env: { ...E2E_ENV, DATABASE_URL: OWNER_URL, DATABASE_MIGRATION_URL: OWNER_URL },
        cwd: fileURLToPath(new URL('../../apps/api', import.meta.url)),
      }) &&
      run('pnpm exec playwright install chromium', options) &&
      run('pnpm test:e2e', options)
    );
  } finally {
    run(`docker compose -f ${COMPOSE_FILE} down -v`, options);
  }
}

const withE2e = !process.argv.includes('--no-e2e');
const ok = run('pnpm install --frozen-lockfile') && runAll(QUALITY_STEPS) && (!withE2e || e2e());

process.stdout.write('\n──────── Résumé CI locale ────────\n');
for (const { command, ok: stepOk, seconds } of results) {
  process.stdout.write(`${stepOk ? '✔' : '✖'} ${command} (${seconds} s)\n`);
}
process.stdout.write(ok ? '\nCI locale : SUCCÈS\n' : '\nCI locale : ÉCHEC\n');
process.exitCode = ok ? 0 : 1;
