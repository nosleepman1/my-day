// Contrôle CI (INFRASTRUCTURE.md §10, « Docker et ufw ») : dans un Compose déployé, seul Caddy publie des
// ports, et aucun service du réseau `data` ne rejoint un autre réseau sans y être autorisé.
// Usage : docker compose -f <fichier> config --format json | node infra/scripts/check-compose-ports.mjs
import { readFileSync } from 'node:fs';

const ALLOWED_PUBLISHERS = new Set(['caddy']);
const config = JSON.parse(readFileSync(0, 'utf8'));
const violations = [];

for (const [name, service] of Object.entries(config.services ?? {})) {
  if ((service.ports ?? []).length > 0 && !ALLOWED_PUBLISHERS.has(name)) {
    violations.push(`${name} publishes ports`);
  }
  if (service.privileged === true) violations.push(`${name} is privileged`);
  if (service.network_mode === 'host') violations.push(`${name} uses the host network`);
}

const dataNetwork = Object.entries(config.networks ?? {}).find(([key]) => key === 'data');
if (dataNetwork !== undefined && dataNetwork[1].internal !== true) {
  violations.push('the data network must be internal');
}

if (violations.length > 0) {
  process.stderr.write(`compose policy violations:\n- ${violations.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write(`compose policy ok (${Object.keys(config.services ?? {}).length} services)\n`);
