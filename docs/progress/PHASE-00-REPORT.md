# PHASE-00 : Socle technique — rapport

- **Statut :** Terminée avec réserves (CI GitHub non encore exécutée : branche non poussée)
- **Branche :** phase-00/socle-technique
- **Période :** 11 octobre 2026 ; 1 session IA ; environ 1 jour effectif
- **Commit de merge :** à renseigner après merge dans `main`

## 1. Résumé

Le monorepo pnpm est exécutable et testé de bout en bout. `pnpm dev` démarre l'API NestJS et le front React ; la page d'accueil affiche « API OK » en passant par le proxy `/api` (même origine, ADR-006 et ADR-038), l'API interrogeant PostgreSQL 17 avec le rôle applicatif `orbit_app`. `@orbit/money` (calculs en `bigint`, FCFA sans décimales) et `@orbit/contracts` (codes d'erreur, enveloppes, schémas communs) sont prêts pour les phases métier. Lint, types, règles d'architecture, tests unitaires, d'intégration (Testcontainers), de bout en bout (Playwright) et build passent en local ; la CI GitHub Actions est écrite.

## 2. Plan exécuté

| Tâche | Intitulé | Statut | Commit(s) |
|---|---|---|---|
| T1 | Monorepo pnpm, `packages/config`, commitlint, lint-staged, `.editorconfig`, `.nvmrc` | Fait | 144c7d2 |
| T2 | `packages/money` complet, 100 % + fast-check | Fait | 373d3dd |
| T3 | `packages/contracts` : enveloppes, codes d'erreur, `MoneyString`, UUIDv7, pagination | Fait | 1affe57, bc96589 |
| T4 | API NestJS Express, `/api/v1`, config Zod, Helmet, arrêt gracieux, `main.ts` + `worker.ts` | Fait | 883f4a6, f8e1eb9 |
| T5 | Logger pino (`requestId`, masquage), filtre d'exception global, enveloppe d'erreur | Fait | 883f4a6, f8e1eb9 |
| T6 | Docker Compose dev (PostgreSQL 17, Mailpit), Prisma, migrations, UUIDv7 | Fait | a38c093, 20144b9 |
| T7 | `/health/live`, `/health/ready`, helper Testcontainers, tests d'intégration | Fait | 883f4a6, 20144b9 |
| T8 | Front Vite, React, Tailwind, Router, TanStack Query, client HTTP, page technique, proxy `/api` | Fait | cb91605, b48f355 |
| T9 | Tests d'architecture (dependency-cruiser, ESLint) avec fixtures fautives | Fait | 91decbf |
| T10 | Playwright + test de fumée ; scripts racine | Fait | f3e79d7 |
| T11 | CI GitHub Actions, `.env.example`, `README.md` | Fait | 8dae88d, ac49a93 |
| T12 | Revues ECC, vérification complète, rapport | Fait | 9d5097a → ed36196, ce rapport |

## 3. Fichiers créés ou modifiés

- **Racine :** `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `eslint.config.mjs`, `prettier.config.mjs`, `.dependency-cruiser.cjs`, `playwright.config.ts`, `commitlint.config.mjs`, `lefthook.yml`, `.lintstagedrc.json`, `.editorconfig`, `.nvmrc`, `.npmrc`, `.prettierignore`, `.env.example`, `README.md`, `.github/workflows/ci.yml`, `e2e/tests/phase-00/smoke.e2e.ts`.
- **packages/config :** `tsconfig/{base,node,react,library}.json`, `eslint/{index,rules-orbit}.mjs`, `prettier/index.mjs`.
- **packages/money :** `src/{currency,errors,money,parse,rounding,rate,allocate,format,index}.ts` et leurs `*.spec.ts`, `money.prop.spec.ts`.
- **packages/contracts :** `src/common/{amount,dates,envelope,id,pagination}.ts`, `src/errors/error-codes.ts`, `src/health/health.schema.ts`, tests associés.
- **apps/api :** `prisma/schema.prisma`, 2 migrations, `prisma/seed/seed.ts`, `src/{main,worker,app.module,worker.module}.ts`, `src/platform/{config,database,errors,http,ids,observability}/**`, `test/{setup,helpers,integration,architecture}/**`.
- **apps/web :** `index.html`, `vite.config.ts`, `src/{main.tsx,app/*,lib/http/*,features/system/*,styles/globals.css,test/*}`.
- **infra :** `infra/compose/compose.dev.yml`, `infra/compose/postgres/init/01-roles.sql`.
- **docs :** alignements (API.md, CODING_STANDARDS.md, DATA_MODEL.md, INFRASTRUCTURE.md, SECURITY.md, TESTING.md, fiche PHASE-00).

## 4. Modèle de données et migrations

- `20261011000000_phase00_init_extensions` : `citext`, `unaccent`, `pg_trgm` (idempotente).
- `20261011000100_phase00_roles_and_privileges` : rôle `orbit_app` (NOLOGIN, DML seulement), `REVOKE ALL ON DATABASE … FROM PUBLIC`, `REVOKE CREATE ON SCHEMA public FROM PUBLIC`, privilèges par défaut `SELECT/INSERT/UPDATE/DELETE` pour `orbit_app`, `statement_timeout = 15s`. Le LOGIN et le mot de passe de `orbit_app` sont posés par le provisionnement de chaque environnement.
- Aucune table métier (conforme à la fiche).

## 5. API livrée

| Méthode | Route | Rôle | Testée (int / isolation) |
|---|---|---|---|
| GET | `/api/v1/health/live` | Public | int ✔ / sans objet |
| GET | `/api/v1/health/ready` | Public | int ✔ (200 et 503) / sans objet |

Comportements transverses testés : enveloppe d'erreur, `NOT_FOUND` sur route inconnue, `INVALID_JSON` (400), `PAYLOAD_TOO_LARGE` (413, corps > 1 Mo), `X-Request-Id` (généré ou repris s'il est bien formé) présent sur toutes les réponses y compris 400/413, en-têtes de sécurité (CSP `default-src 'none'` + `sandbox`, HSTS 2 ans, `Cache-Control: no-store`, `Permissions-Policy`, `nosniff`, pas de `X-Powered-By`).

## 6. Frontend livré

- Route `/` : page technique « ORBIT » avec trois états (vérification, « API OK », « API injoignable »), `role="status"`.
- Client HTTP unique (`lib/http/client.ts`) : même origine, `credentials: 'include'`, `X-Requested-With: orbit`, `Idempotency-Key`, délai de 15 s, erreurs typées (`ApiError`, `NetworkError`, `ContractError`), annulation propagée.
- Politique de relance TanStack Query : jamais sur 4xx ni réponse hors contrat ; deux fois sur 5xx et réseau ; jamais sur mutation.

## 7. Décisions techniques

| Décision | Raison | Alternative écartée |
|---|---|---|
| Majeures éprouvées : TypeScript 5.9, NestJS 11, Prisma 6, Vite 7, React Router 7, ESLint 9, Zod 4, Vitest 4.1.11 | Le registre propose déjà TypeScript 7, NestJS 12, Prisma 8 (préversion), Vite 8, Vitest 5 : trop récents pour un socle fiable généré par IA | Dernières majeures |
| `packages/config/tsconfig/node.json` en résolution `Bundler` + `noEmit` | `tsc` ne fait que vérifier les types ; SWC compile l'API en CommonJS et Vitest exécute en ESM ; `Node16` rejetait l'import des paquets ESM partagés | `Node16` (CODING_STANDARDS d'origine, mis à jour) |
| Paquets partagés publiés en ESM + CJS (tsup), types par condition (`.d.ts` / `.d.cts`) | Consommés par l'API (CJS) et le front (ESM) | Sources TS importées directement |
| Build API par le builder SWC de Nest (`stripLeadingPaths`, tests exclus) | Rapide, métadonnées de décorateurs conservées | `tsc` |
| Tests web sous **happy-dom** | jsdom remplace `AbortSignal`, incompatible avec le `fetch`/`Request` de Node utilisé par MSW | jsdom (TESTING.md mis à jour) |
| PostgreSQL de développement sur le port **5433** | Un PostgreSQL local occupait déjà 5432 sur la machine | 5432 |
| Rôles et privilèges dans une **migration** | Identiques en dev, test, CI, staging, production (revue database-reviewer) | Script d'init Docker seul |
| Middleware d'erreur Express après body-parser | Nest transforme sinon toute `SyntaxError` de body-parser en `BadRequestException` et perd la cause | Détection dans le filtre global |
| `deepmerge-ts` forcé en 8.0.2 (override pnpm) | Avis de sécurité « high » via le CLI Prisma 6 | Attendre une version de Prisma 6 corrigée |
| Statut 403 du framework → `NOT_FOUND` | Une ressource ou route interdite ne confirme jamais son existence (SECURITY.md §6.2) | `FORBIDDEN` |

Aucune nouvelle ADR : ces choix sont d'implémentation ; les écarts documentaires ont été corrigés dans les docs concernés.

## 8. Écarts par rapport à la fiche

- **Alias `@platform/*`, `@modules/*`** (CODING_STANDARDS §9) non configurés : le socle n'a pas encore de module métier ; imports relatifs. À poser en PHASE-01 avec le premier module (`.swcrc` + tsconfig + Vitest).
- **Arborescence des tests** : intégration dans `apps/api/test/integration/**/*.int.spec.ts` (TESTING.md) plutôt que `modules/<m>/tests/` (ARCHITECTURE.md) ; tests web en `*.test.ts(x)` (FRONTEND.md). Convention à figer en PHASE-01.
- **i18n** : textes de la page technique en constantes ; i18next arrive en PHASE-02.
- **Hook pre-commit gitleaks** (INFRASTRUCTURE §3.1) : gitleaks n'est pas installé localement ; le scan est fait en CI (job `secrets`).
- **Contrôles listés par CODING_STANDARDS §10.3 non encore actifs** : `prisma migrate diff` en CI, diff OpenAPI (aucune route documentée encore), règles de lint `.only`/`.skip` et format des `TODO(PHASE-XX)`.
- **Dockerfile de l'API** : prévu en PHASE-03 (fiche PHASE-00 : exclu).

## 9. Tests exécutés (sorties réelles, en local sous Windows 11)

- `pnpm format:check` : tous les fichiers conformes.
- `pnpm lint` : 0 erreur, 0 avertissement.
- `pnpm typecheck` : 0 erreur (5 projets + racine).
- `pnpm depcruise` : aucune violation (126 modules, 207 dépendances).
- `pnpm test:cov` :
  - `packages/money` : 85 tests, couverture 100 % (lignes, branches, fonctions).
  - `packages/contracts` : 50 tests, 100 %.
  - `apps/api` (unitaires + intégration Testcontainers PostgreSQL 17.6) : 42 tests, lignes 99,25 %, branches 89 %.
  - `apps/web` : 13 tests, lignes 96 %, branches 94,9 %.
- `pnpm test:arch` : 8 tests (9 règles dependency-cruiser et 7 règles ESLint prouvées par des fixtures fautives).
- `pnpm test:isolation` : 0 route couverte (aucune ressource utilisateur en PHASE-00), sortie en succès.
- `pnpm test:e2e` : 2 réussis (Chromium desktop et mobile) contre l'API compilée et la base de développement.
- `pnpm build` : paquets (tsup), API (SWC, 23 fichiers), web (Vite, 445 Ko / 138 Ko gzip).
- `pnpm audit --audit-level high` : aucune vulnérabilité high ou critical ; restent 1 moderate (`uuid` via Testcontainers) et 1 low (`esbuild` via tsup), outils de test et de build.
- Vérifications manuelles : API compilée démarrée avec `orbit_app` (`/health/ready` 200 dès le premier appel), configuration invalide refusée (code de sortie 1, nom de variable seulement), worker démarré, `pnpm dev` fonctionnel via le proxy, `orbit_app` refusé sur `CREATE TABLE`.
- **Non exécuté :** la CI GitHub Actions (branche non poussée) ; gitleaks (non installé en local).

## 10. Revues ECC

| Agent | Constats CRITICAL/HIGH | Corrigés | Restants (MEDIUM/LOW) |
|---|---|---|---|
| code-reviewer | 0 / 0 | 7 MEDIUM et LOW traités (ordre des middlewares, seuil web, bornes des montants, statuts Nest, `ContractError`, rôle des tests, restauration de `process.env`) | Nommage des tests à figer, `vite preview` sans proxy, `DATABASE_MIGRATION_URL_FILE` |
| security-reviewer | 0 / 3 | Les 3 HIGH : actions épinglées par SHA, `pnpm audit` + gitleaks en CI, en-têtes complets | Sérialiseur `err` qui retire les messages Prisma des logs, query string dans les logs d'URL (PHASE-01), digests d'images (PHASE-03) |
| typescript-reviewer | 0 / 1 | HIGH (statuts Nest → 500) ; MEDIUM : bornes, schémas de réponse tolérants, `ContractError`, `requestId` obligatoire, annulation ; LOW : pagination | Comportement de `parseUserInput` sur « 1.000 » en XOF (à traiter dans les formulaires, PHASE-02/05) |
| database-reviewer | 0 / 3 | Rôles en migration, durcissement de `public`, `statement_timeout`, alignement `orbit_owner`, tests en `orbit_app` | P2003 vs FK composite, `REVOKE` des tables en ajout seul, `currencies` en lecture seule (PHASE-01) |

## 11. Risques et limitations connus

- La CI n'a jamais tourné sur GitHub : le job e2e utilise `psql` du runner Ubuntu (présent sur les images GitHub, à confirmer au premier passage).
- `REVOKE ALL ON DATABASE … FROM PUBLIC` et la création du rôle `orbit_app` supposent que le rôle de migration a le droit `CREATEROLE` ou que le provisionnement a créé `orbit_app` avant (à documenter dans le runbook de PHASE-03).
- Les messages d'erreur Prisma complets peuvent apparaître dans les logs serveur des 5xx (jamais dans les réponses) : sérialiseur dédié à ajouter avant la production (PHASE-03).
- Bundle web de 445 Ko : surtout React, React Router et Zod ; budget à surveiller en PHASE-02.

## 12. Reste à faire

- **Bloquant pour PHASE-01 :** aucun.
- **À faire en PHASE-01 :** alias d'import, extension Prisma `tenantScope`, générateur de tests d'isolation, `REVOKE UPDATE, DELETE, TRUNCATE` sur `audit_logs`, mapping P2003 affiné, rate limiting (y compris `/health/ready`), CSRF par contrôle d'`Origin`, retrait de la query string des logs, `currencies` et `idempotency_keys` (ADR-027).
- **Reporté à PHASE-02 :** i18n, design system, PWA.
- **Reporté à PHASE-03 :** Dockerfile, `vercel.json`, digests d'images, sérialiseur d'erreurs des logs, `DATABASE_MIGRATION_URL_FILE`, `TRUST_PROXY_HOPS` selon la topologie réelle.

## 13. Recette manuelle à faire par le propriétaire

1. `pnpm install`, `cp .env.example apps/api/.env`, `pnpm infra:up`, `pnpm db:migrate`, `pnpm dev`.
2. Ouvrir http://localhost:5173 sur ordinateur puis en mode mobile du navigateur : « ORBIT » et « API OK » s'affichent.
3. Arrêter PostgreSQL (`pnpm infra:down`) : la page affiche « API injoignable » après rafraîchissement ; http://localhost:3000/api/v1/health/ready répond 503.
4. Pousser la branche et vérifier que les trois jobs de la CI passent.

## 14. Point de reprise

Phase terminée. Prochaine action : merge de `phase-00/socle-technique` dans `main` après validation, puis démarrage de PHASE-01 (identité, sessions, isolation).

## 15. Confirmation sécurité

- [x] Aucun secret réel ajouté au dépôt (valeurs fictives uniquement ; `apps/api/.env` ignoré par Git).
- [x] Aucune migration destructive.
- [x] Aucun service payant ou externe appelé sans accord (seuls des téléchargements d'outils : paquets npm, images Docker officielles, navigateur Playwright).
