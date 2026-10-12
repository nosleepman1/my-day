import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { cruise, type ICruiseResult, type IConfiguration } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';

const requireFromHere = createRequire(import.meta.url);
const config = requireFromHere('../../../../.dependency-cruiser.cjs') as IConfiguration;
const FIXTURES = fileURLToPath(new URL('./__fixtures__/depcruise', import.meta.url));

/** Règles que les fichiers de violation volontaire doivent toutes déclencher (TESTING.md §11). */
const EXPECTED_RULES = [
  'api-not-to-web',
  'domain-no-framework',
  'domain-no-platform',
  'modules-through-public-api',
  'money-has-no-dependency',
  'no-circular',
  'packages-not-to-apps',
  'shared-packages-framework-free',
  'vendor-sdk-only-in-adapter',
  'web-not-to-api',
];

async function violatedRules(): Promise<string[]> {
  const result = await cruise([FIXTURES], {
    ...config.options,
    validate: true,
    ruleSet: { forbidden: config.forbidden ?? [] },
    exclude: { path: '^(apps|packages)/[^/]+/dist/' },
  });
  const output: ICruiseResult =
    typeof result.output === 'string' ? (JSON.parse(result.output) as ICruiseResult) : result.output;
  return [...new Set(output.summary.violations.map((violation) => violation.rule.name))].sort();
}

describe('dependency-cruiser rules (ARCHITECTURE.md §5)', () => {
  it('detects every forbidden dependency in the violation fixtures', async () => {
    const rules = await violatedRules();
    expect(rules).toEqual(expect.arrayContaining(EXPECTED_RULES));
  }, 60_000);
});
