/**
 * Interdits propres à ORBIT (CODING_STANDARDS.md §10.2).
 * Chaque sélecteur porte un message qui cite l'ADR concernée, pour corriger au bon endroit.
 *
 * `no-restricted-syntax` ne fusionne pas ses options entre blocs de configuration :
 * chaque portée reçoit donc la liste complète de ses sélecteurs (voir `syntaxFor`).
 */

const AMOUNT_NAME = '/(amount|minor|total|balance|price|fee|cost)/i';

export const BASE = [
  {
    selector: 'TSEnumDeclaration',
    message: 'enum TypeScript interdit : utiliser z.enum ou un objet `as const` (CODING_STANDARDS §2.3).',
  },
  {
    selector: 'TSModuleDeclaration[kind="namespace"]',
    message: 'namespace interdit (CODING_STANDARDS §2.3).',
  },
  {
    selector: 'MemberExpression[property.name=/^\\$(queryRawUnsafe|executeRawUnsafe)$/]',
    message: 'SQL non sûr interdit partout (ADR-007-5, SECURITY.md).',
  },
  {
    selector: 'MemberExpression[object.name="Prisma"][property.name="raw"]',
    message: 'Prisma.raw interdit partout (ADR-007-5).',
  },
];

export const RAW_SQL = [
  {
    selector: 'MemberExpression[property.name=/^\\$(queryRaw|executeRaw)$/]',
    message: 'SQL brut autorisé uniquement dans apps/api/src/platform/database/raw/ (ADR-028).',
  },
  {
    selector: 'MemberExpression[object.name="Prisma"][property.name="sql"]',
    message: 'Prisma.sql autorisé uniquement dans apps/api/src/platform/database/raw/ (ADR-028).',
  },
];

export const MONEY_LENIENT = [
  {
    selector: `CallExpression[callee.name=/^(Number|parseFloat|parseInt)$/][arguments.0.name=${AMOUNT_NAME}]`,
    message: 'Montant converti en number interdit : utiliser @orbit/money (ADR-008).',
  },
  {
    selector: `CallExpression[callee.name=/^(Number|parseFloat|parseInt)$/][arguments.0.property.name=${AMOUNT_NAME}]`,
    message: 'Montant converti en number interdit : utiliser @orbit/money (ADR-008).',
  },
];

export const MONEY_STRICT = [
  {
    selector: 'CallExpression[callee.name=/^(Number|parseFloat|parseInt)$/]',
    message: 'Number/parseFloat/parseInt interdits dans le code monétaire (ADR-008).',
  },
  {
    selector: 'CallExpression[callee.property.name="toFixed"]',
    message: 'toFixed interdit dans le code monétaire (ADR-008).',
  },
  {
    selector: 'CallExpression[callee.object.name="Math"][callee.property.name="round"]',
    message: 'Math.round interdit dans le code monétaire : arrondi half-up de @orbit/money (ADR-008).',
  },
];

export const API_MODULES = [
  {
    selector: 'CallExpression[callee.property.name=/^findUnique(OrThrow)?$/]',
    message: 'findUnique interdit dans les modules : findFirst({ id, userId }) (ADR-007-3).',
  },
  {
    selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
    message: 'new Date() interdit dans les modules : injecter ClockPort (DESIGN_PATTERNS.md).',
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
    message: 'Date.now() interdit dans les modules : injecter ClockPort.',
  },
  {
    selector: 'CallExpression[callee.object.name="crypto"][callee.property.name="randomUUID"]',
    message: 'crypto.randomUUID() interdit dans les modules : injecter IdGeneratorPort (ADR-011).',
  },
  {
    selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
    message: 'Math.random() interdit dans les modules.',
  },
];

/** Construit l'option complète de `no-restricted-syntax` pour une portée. */
export function syntaxFor(...groups) {
  return ['error', ...groups.flat()];
}

export const BANNED_EVERYWHERE = [
  { name: 'class-validator', message: 'Validation par Zod uniquement (ADR-010).' },
  { name: 'class-transformer', message: 'Validation par Zod uniquement (ADR-010).' },
  { name: 'moment', message: 'Utiliser date-fns (FRONTEND.md §1).' },
  { name: 'axios', message: 'Utiliser le client HTTP du projet (FRONTEND.md §3).' },
  { name: 'lodash', message: 'Lodash complet interdit (FRONTEND.md §1).' },
];
