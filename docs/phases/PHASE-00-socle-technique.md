# PHASE-00 : Socle technique

- **Statut :** À faire
- **Dépend de :** aucune
- **Accès :** Tous
- **Estimation :** 3 à 4 jours effectifs

## 1. Objectif
Poser un monorepo pnpm exécutable, testé et vérifié en CI : API NestJS (Express) et web React squelettes, contrats Zod et arithmétique monétaire partagés, Prisma branché sur PostgreSQL, logs structurés, enveloppe d'erreur, health check, Docker Compose de développement et tests d'architecture. Toutes les phases suivantes s'appuient sur ce socle sans le remettre en cause.

## 2. Contexte à charger
1. `AGENTS.md` (racine), `DECISIONS.md` (ADR-004, 005, 007 points 3 et 5, 008, 010, 011, 012 point « processus », 014, 016, 021, 022, 023).
2. `ARCHITECTURE.md` : structure du monorepo, couches d'un module, flux d'une requête.
3. `DESIGN_PATTERNS.md` : structure d'un module NestJS, ports et adaptateurs.
4. `CODING_STANDARDS.md` : TypeScript strict, nommage, erreurs, logs.
5. `API.md` : préfixe `/api/v1`, enveloppe de réponse et d'erreur, codes d'erreur.
6. `TESTING.md` : outils (Vitest + SWC, Testcontainers, Playwright), seuils, organisation des tests, tests d'architecture.
7. `INFRASTRUCTURE.md` : Docker Compose de développement, variables d'environnement, CI de base.
8. `FINANCE_RULES.md` : section sur `packages/money` (arrondi half-up, exposants de devise, format des montants en chaîne).
9. `FRONTEND.md` : structure de `apps/web`.

Ne pas charger `PRODUCT_SPEC.md`.

## 3. Périmètre
### Inclus
- Monorepo pnpm workspaces : `apps/api`, `apps/web`, `packages/contracts`, `packages/money`, `packages/config` (ADR-004). Node LTS épinglé (`.nvmrc`, `engines`), `packageManager` épinglé.
- `packages/config` : `tsconfig.base.json` strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint (flat config, typescript-eslint), Prettier.
- `packages/money` **complet** : type `Money { minor: bigint; currency }`, table des exposants (XOF 0, EUR 2, USD 2), `parseMinor(string)`, `toMinorString`, `add`, `subtract`, `negate`, `compare`, `isZero`, `multiplyRate` (taux décimal en chaîne, arrondi half-up), `allocate` (répartition sans perte), `format(locale)` (`150 000 FCFA`). Erreur si devises différentes. **100 % de couverture**, tests de propriétés fast-check.
- `packages/contracts` : schéma d'enveloppe de réponse et d'erreur, catalogue initial des codes d'erreur (`VALIDATION_FAILED`, `NOT_FOUND`, `UNAUTHENTICATED`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`), schéma `MoneyString` (`^\d+$`), `uuidv7` schéma, pagination par curseur.
- `apps/api` : NestJS + adaptateur Express (ADR-005), préfixe global `/api/v1`, `ConfigModule` validé par Zod au démarrage (échec immédiat si variable manquante), `nestjs-pino` avec `requestId` (en-tête `X-Request-Id` accepté ou généré) et redaction (`password`, `token`, `authorization`, `cookie`, `secret`…), filtre d'exception global produisant l'enveloppe d'erreur, `nestjs-zod` pour la validation, Helmet, `GET /api/v1/health/live` (liveness) et `GET /api/v1/health/ready` (base joignable), deux points d'entrée `main.ts` (API) et `worker.ts` (vide, démarre et s'arrête proprement — ADR-012), arrêt gracieux.
- Prisma : `schema.prisma` avec datasource PostgreSQL 17, générateur client, migration initiale `0000_init_extensions` (extensions `citext`, `unaccent`, `pg_trgm`), `PrismaService` avec gestion de cycle de vie, générateur UUIDv7 applicatif (ADR-011). Dossier `src/platform/database/raw/` créé (vide, avec README d'usage).
- `apps/web` : Vite + React + TypeScript strict, Tailwind CSS, React Router, TanStack Query, client HTTP unique (préfixe `/api/v1`, en-tête `X-Requested-With: orbit`, `credentials: 'include'`, lecture de l'enveloppe d'erreur), page d'accueil technique affichant l'état de `/health/live`. Proxy Vite `/api` → API (même origine, ADR-006).
- Docker Compose dev : `postgres:17` (volume nommé), `mailpit` (ADR-014). Les apps tournent sur l'hôte (`pnpm dev`).
- Scripts racine : `dev`, `build`, `lint`, `format`, `format:check`, `typecheck`, `test`, `test:int`, `test:isolation` (vide pour l'instant, sort en succès avec 0 test), `test:e2e`, `test:cov`, `db:migrate`, `db:reset`, `db:seed`.
- Tests : Vitest (API avec SWC, web avec jsdom), Testcontainers PostgreSQL (helper partagé qui applique les migrations), Playwright installé avec un test de fumée (page d'accueil affiche « API OK »).
- **Tests d'architecture** (dependency-cruiser + règles ESLint) :
  - `apps/web` n'importe jamais `apps/api` ; les deux peuvent importer `packages/*` ;
  - dans un module API, `domain/` n'importe ni NestJS, ni Prisma, ni `infrastructure/` ;
  - `$queryRaw`, `$executeRaw`, `$queryRawUnsafe`, `$executeRawUnsafe` interdits hors de `platform/database/raw/` ;
  - `parseFloat`, `Number(` et `parseInt` interdits dans les fichiers qui manipulent des montants (règle sur les dossiers `finance` et `packages/money`) ;
  - aucun `console.log` dans `src/`.
- CI de base GitHub Actions : install figée, lint, format:check, typecheck, test, test:int (service Postgres ou Testcontainers), build. Cache pnpm.
- `.env.example` documenté, `.gitignore`, `.editorconfig`, commitlint (Conventional Commits), hook pre-commit léger (lint-staged).
- `README.md` racine : prérequis, démarrage en 5 commandes.

### Exclu (et phase où ces éléments seront traités)
- Tables métier, auth, sessions, contexte CLS, extension `tenantScope` → PHASE-01.
- Design system, layout, PWA → PHASE-02.
- Staging, production, images Docker de production, CD, sauvegardes → PHASE-03.
- Redis, BullMQ, contenu du worker → PHASE-08.
- StoragePort → PHASE-09 ; MailPort → PHASE-01.

## 4. Modèle de données
- Aucune table métier.
- Migration : `0000_init_extensions` (extensions `citext`, `unaccent`, `pg_trgm`). Voir `DATA_MODEL.md`, section conventions (UUIDv7, `timestamptz`, nommage snake_case, `@@map`).
- Conventions Prisma posées dès maintenant : modèles en PascalCase mappés vers des tables snake_case au pluriel, colonnes snake_case via `@map`.

## 5. API
| Méthode | Route | Rôle | Remarque |
|---|---|---|---|
| GET | `/api/v1/health/live` | Public | `{ status: "ok", version, uptime }` |
| GET | `/api/v1/health/ready` | Public | 200 si PostgreSQL répond, 503 sinon (enveloppe d'erreur) |

Format de réponse et d'erreur : `API.md`.

## 6. Frontend
- Route `/` : page technique « ORBIT » affichant l'état de l'API (chargement, OK, erreur réseau).
- Client HTTP centralisé (`src/shared/api/http.ts` ou selon `FRONTEND.md`) et `QueryClientProvider`.
- Aucun écran métier.

## 7. Règles métier et cas limites
- Démarrage de l'API **refusé** si la configuration est invalide (message listant les variables fautives, sans afficher leurs valeurs).
- Toute erreur non prévue → 500 avec code `INTERNAL`, `requestId`, sans stack ni message interne.
- Erreur de validation Zod → 422 (ou le code fixé par `API.md`) avec la liste des champs.
- `packages/money` : opérations entre devises différentes → erreur ; montant en chaîne non numérique, négatif là où interdit, ou avec décimales pour XOF → erreur de parsing ; arrondi half-up unique (ADR-008).
- Les logs ne contiennent jamais les valeurs des champs redactés (test dédié).

## 8. Tests exigés
- **Unitaires :** `packages/money` (100 %, propriétés fast-check : commutativité de l'addition, `allocate` conserve la somme, aller-retour `parse`/`toMinorString`), schémas de `packages/contracts`, filtre d'exception, validation de configuration.
- **Intégration :** `/health/live` et `/health/ready` via supertest avec Testcontainers ; `ready` renvoie 503 si la base est arrêtée.
- **Architecture :** dependency-cruiser et règles ESLint ci-dessus, avec un fichier « fixture » volontairement fautif qui doit être détecté (test du test).
- **Sécurité :** redaction des logs (un log contenant `password` et `authorization` est vérifié), en-têtes Helmet présents.
- **E2E :** test de fumée Playwright (page d'accueil + API OK).
- Isolation entre utilisateurs : sans objet (pas de données), mais le script `test:isolation` existe.

## 9. Découpage en tâches
| Tâche | Intitulé | Dépend de |
|---|---|---|
| T1 | Initialiser le monorepo pnpm, `packages/config` (tsconfig, ESLint, Prettier), commitlint, lint-staged, `.editorconfig`, `.nvmrc` | — |
| T2 | `packages/money` : type, parsing, arithmétique, `allocate`, `multiplyRate`, formatage ; tests 100 % + fast-check | T1 |
| T3 | `packages/contracts` : enveloppes, codes d'erreur, `MoneyString`, UUIDv7, pagination | T1 |
| T4 | `apps/api` : NestJS Express, préfixe `/api/v1`, config Zod, Helmet, arrêt gracieux, `main.ts` + `worker.ts` | T3 |
| T5 | Logger pino avec `requestId` et redaction ; filtre d'exception global et enveloppe d'erreur ; tests | T4 |
| T6 | Docker Compose dev (Postgres 16, Mailpit) ; Prisma, `PrismaService`, migration `0000_init_extensions`, UUIDv7 | T4 |
| T7 | Endpoints health/ready ; helper Testcontainers ; tests d'intégration | T5, T6 |
| T8 | `apps/web` : Vite, React, Tailwind, Router, TanStack Query, client HTTP, page technique, proxy `/api` | T3 |
| T9 | Tests d'architecture (dependency-cruiser, règles ESLint `$queryRaw`, montants, `console.log`) avec fixtures fautives | T4, T8 |
| T10 | Playwright + test de fumée ; scripts racine complets | T7, T8 |
| T11 | CI GitHub Actions de base ; `.env.example` ; `README.md` | T10 |
| T12 | Revues ECC, vérification complète, rapport | T11 |

## 10. Agents ECC à mobiliser
- `tdd-guide` (T2, T3, T5, T7).
- `architect` si un doute sur la structure de module (sinon suivre `ARCHITECTURE.md`).
- `typescript-reviewer`, `code-reviewer` (fin de phase).
- `security-reviewer` (redaction des logs, Helmet, filtre d'erreur).
- `database-reviewer` (migration d'extensions, conventions Prisma).
- `build-error-resolver` en cas de build cassé.

## 11. Definition of Done
- [ ] `pnpm install && pnpm dev` démarre API et web ; `docker compose up -d` démarre Postgres et Mailpit.
- [ ] `/api/v1/health/live` et `/api/v1/health/ready` répondent selon le contrat.
- [ ] `packages/money` à 100 % de couverture, tests de propriétés verts.
- [ ] Tests d'architecture actifs et prouvés (fixtures fautives détectées).
- [ ] CI verte sur la branche.
- [ ] `README.md` permet un démarrage à froid.
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` cochée (sections applicables).

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-00-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`).
