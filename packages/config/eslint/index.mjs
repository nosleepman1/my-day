import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import {
  API_MODULES,
  BANNED_EVERYWHERE,
  BASE,
  MONEY_LENIENT,
  MONEY_STRICT,
  RAW_SQL,
  syntaxFor,
  WEB_UI,
} from './rules-orbit.mjs';

const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];
const TEST_FILES = [
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.e2e.ts',
  'apps/api/test/**',
  'e2e/**',
];
const MONEY_STRICT_FILES = [
  'packages/money/src/**',
  'packages/contracts/src/finance/**',
  'packages/contracts/src/pro/**',
  'apps/web/src/features/finance/**',
  'apps/web/src/features/pro/**',
];
const API_MONEY_STRICT_FILES = ['apps/api/src/modules/finance/**', 'apps/api/src/modules/pro/**'];
const TOOL_CONFIG_FILES = [
  '**/*.config.{ts,mts,mjs,cjs,js}',
  '**/vitest.*.ts',
  'eslint.config.mjs',
  'playwright.config.ts',
];

const SHARED_PACKAGE_IMPORTS = {
  group: ['@prisma/*', '@nestjs/*', 'react', 'react-dom', 'apps/*'],
  message: 'packages/contracts reste indépendant des frameworks (ADR-010).',
};

/**
 * Configuration ESLint d'ORBIT (CODING_STANDARDS.md §10).
 * @param {{ rootDir: string }} options
 */
export function orbitEslint({ rootDir }) {
  return tseslint.config(
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/playwright-report/**',
        '**/test-results/**',
        'docs/**',
        'apps/api/prisma/migrations/**',
        '**/__fixtures__/**',
      ],
    },
    js.configs.recommended,
    {
      files: TS_FILES,
      extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir: rootDir },
        globals: { ...globals.node },
      },
      plugins: { 'import-x': importX },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
        '@typescript-eslint/prefer-readonly': 'error',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
        ],
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
        'no-console': 'error',
        'no-param-reassign': ['error', { props: true }],
        'prefer-const': 'error',
        'no-restricted-syntax': syntaxFor(BASE, RAW_SQL, MONEY_LENIENT),
        'no-restricted-imports': ['error', { paths: BANNED_EVERYWHERE }],
        'no-restricted-properties': [
          'error',
          {
            object: 'process',
            property: 'env',
            message: 'Lire la configuration via platform/config (ARCHITECTURE.md §9).',
          },
        ],
        'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
        'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
        'max-params': ['error', 4],
        'max-depth': ['error', 4],
        complexity: ['error', 12],
        'import-x/no-default-export': 'error',
        'import-x/order': [
          'error',
          {
            groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
            pathGroups: [
              { pattern: '@orbit/**', group: 'internal', position: 'before' },
              { pattern: '@platform/**', group: 'internal' },
              { pattern: '@modules/**', group: 'internal', position: 'after' },
              { pattern: '@/**', group: 'internal', position: 'after' },
            ],
            pathGroupsExcludedImportTypes: ['builtin'],
            'newlines-between': 'always',
            alphabetize: { order: 'asc', caseInsensitive: true },
          },
        ],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
      languageOptions: { globals: { ...globals.node } },
    },
    // Portées monétaires strictes (ADR-008).
    {
      files: MONEY_STRICT_FILES,
      rules: { 'no-restricted-syntax': syntaxFor(BASE, RAW_SQL, MONEY_STRICT) },
    },
    // Modules de l'API : horloge, identifiants, findUnique (ADR-007, ADR-011).
    {
      files: ['apps/api/src/modules/**'],
      rules: { 'no-restricted-syntax': syntaxFor(BASE, RAW_SQL, MONEY_LENIENT, API_MODULES) },
    },
    {
      files: API_MONEY_STRICT_FILES,
      rules: { 'no-restricted-syntax': syntaxFor(BASE, RAW_SQL, MONEY_STRICT, API_MODULES) },
    },
    // Client Prisma brut réservé à la plateforme et aux modules auth, users, admin (ADR-007-3).
    {
      files: ['apps/api/src/modules/**'],
      ignores: ['apps/api/src/modules/{auth,users,admin}/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: BANNED_EVERYWHERE,
            patterns: [
              {
                group: ['**/platform/database/prisma.service'],
                message: 'Client Prisma brut interdit ici : injecter TENANT_PRISMA (ADR-007-3).',
              },
            ],
          },
        ],
      },
    },
    // Seul dossier autorisé pour le SQL brut (ADR-028), plus les tests de l'API (sondes de privilèges, fixtures).
    {
      files: ['apps/api/src/platform/database/raw/**', 'apps/api/test/**'],
      rules: { 'no-restricted-syntax': syntaxFor(BASE, MONEY_LENIENT) },
    },
    // Paquets partagés : aucune dépendance de framework (ARCHITECTURE.md §5).
    {
      files: ['packages/contracts/src/**'],
      rules: {
        'no-restricted-imports': ['error', { paths: BANNED_EVERYWHERE, patterns: [SHARED_PACKAGE_IMPORTS] }],
      },
    },
    {
      files: ['packages/money/src/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                regex: '^(?!\\.{1,2}/)',
                message: "packages/money n'a aucune dépendance externe (CODING_STANDARDS §10.2).",
              },
            ],
          },
        ],
      },
    },
    {
      files: ['apps/api/src/modules/**/domain/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: BANNED_EVERYWHERE,
            patterns: [
              {
                group: ['@nestjs/*', '@prisma/*', 'express'],
                message: 'Le domaine reste pur (DESIGN_PATTERNS.md).',
              },
            ],
          },
        ],
      },
    },
    // Lecture de l'environnement autorisée uniquement dans la configuration, les outils et les tests.
    {
      files: [
        'apps/api/src/platform/config/**',
        ...TOOL_CONFIG_FILES,
        'apps/api/test/**',
        'e2e/**',
        'infra/scripts/**',
      ],
      rules: { 'no-restricted-properties': 'off' },
    },
    // Fichiers de configuration d'outils : export par défaut attendu.
    { files: [...TOOL_CONFIG_FILES, '**/*.d.ts'], rules: { 'import-x/no-default-export': 'off' } },
    // Front React.
    {
      files: ['apps/web/src/**/*.{ts,tsx}'],
      languageOptions: { globals: { ...globals.browser } },
      plugins: { 'react-hooks': reactHooks },
      rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
    },
    { files: ['apps/web/src/**/*.tsx'], ...jsxA11y.flatConfigs.recommended },
    {
      files: ['apps/web/src/**/*.tsx'],
      ignores: TEST_FILES,
      rules: { 'no-restricted-syntax': syntaxFor(BASE, RAW_SQL, MONEY_LENIENT, WEB_UI) },
    },
    {
      files: ['apps/web/src/features/finance/**/*.tsx', 'apps/web/src/features/pro/**/*.tsx'],
      ignores: TEST_FILES,
      rules: { 'no-restricted-syntax': syntaxFor(BASE, RAW_SQL, MONEY_STRICT, WEB_UI) },
    },
    // Tests : tailles libres ; les matchers asymétriques de Vitest sont typés `any`.
    {
      files: TEST_FILES,
      rules: {
        'max-lines-per-function': 'off',
        'max-lines': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        'no-restricted-imports': ['error', { paths: BANNED_EVERYWHERE }],
      },
    },
  );
}
