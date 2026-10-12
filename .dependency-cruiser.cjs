/**
 * Regles d architecture bloquantes (ARCHITECTURE.md 5, TESTING.md 11).
 * Les chemins ne sont pas ancres en debut pour que les fichiers de violation volontaire
 * (apps/api/test/architecture/__fixtures__) soient juges par les memes regles.
 */
const DOMAIN = '(^|/)apps/api/src/modules/.*/domain/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Aucun cycle de dependances.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'web-not-to-api',
      severity: 'error',
      comment: 'Le front n importe jamais l API : seul lien, packages/contracts et packages/money.',
      from: { path: '(^|/)apps/web/' },
      to: { path: '(^|/)apps/api/' },
    },
    {
      name: 'api-not-to-web',
      severity: 'error',
      comment: 'L API n importe jamais le front.',
      from: { path: '(^|/)apps/api/', pathNot: '(^|/)apps/api/.*(^|/)apps/web/' },
      to: { path: '(^|/)apps/web/' },
    },
    {
      name: 'packages-not-to-apps',
      severity: 'error',
      comment: 'Un paquet partage ne depend jamais d une application.',
      from: { path: '(^|/)packages/' },
      to: { path: '(^|/)apps/' },
    },
    {
      name: 'shared-packages-framework-free',
      severity: 'error',
      comment: 'contracts et money restent independants des frameworks serveur et UI (ADR-010).',
      from: { path: '(^|/)packages/(contracts|money)/src/' },
      to: { path: 'node_modules/(@nestjs|@prisma|express|react|react-dom|pino)/' },
    },
    {
      name: 'money-has-no-dependency',
      severity: 'error',
      comment: 'packages/money n a aucune dependance externe (CODING_STANDARDS 10.2).',
      from: { path: '(^|/)packages/money/src/', pathNot: '[.]spec[.]ts$' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'domain-no-framework',
      severity: 'error',
      comment: 'Le domaine n importe ni NestJS, ni Prisma, ni Express (DESIGN_PATTERNS.md).',
      from: { path: DOMAIN },
      to: { path: 'node_modules/(@nestjs|@prisma|express)/' },
    },
    {
      name: 'domain-no-platform',
      severity: 'error',
      comment: 'Le domaine n importe de la plateforme que platform/errors.',
      from: { path: DOMAIN },
      to: { path: '(^|/)apps/api/src/platform/', pathNot: '(^|/)apps/api/src/platform/errors/' },
    },
    {
      name: 'vendor-sdk-only-in-adapter',
      severity: 'error',
      comment: 'nodemailer n est importe que par son adaptateur du port MAIL (DESIGN_PATTERNS.md 2).',
      from: { path: '(^|/)apps/api/', pathNot: '(^|/)apps/api/src/platform/mail/smtp-mail[.]adapter[.]ts$' },
      to: { path: 'node_modules/nodemailer/' },
    },
    {
      name: 'modules-through-public-api',
      severity: 'error',
      comment: 'Un module n importe un autre module que par son index.ts (ARCHITECTURE.md 5.2).',
      from: { path: '(^|/)apps/api/src/modules/([^/]+)/' },
      to: {
        path: '(^|/)apps/api/src/modules/([^/]+)/',
        pathNot: ['(^|/)apps/api/src/modules/$2/', '(^|/)apps/api/src/modules/[^/]+/index[.]ts$'],
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Ancré sur le dépôt : un paquet npm publié dans dist/ (nodemailer…) doit rester visible des règles.
    exclude: { path: '^(apps|packages)/[^/]+/(dist|coverage)/|(^|/)__fixtures__/' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
