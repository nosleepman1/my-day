# PHASE-04 : Organisation (idées, tâches, projets, tags, notes) — rapport

- **Statut :** Terminée côté code, **recette mobile du propriétaire à faire** (jalon J3). Rien n'est commité (consigne « sans commit »).
- **Branche :** travail non commité (à reporter sur `phase-04/organisation`)
- **Période :** 14 octobre 2026 ; session IA
- **Commit de merge :** à renseigner

## 1. Résumé

Le module M03 est livré de bout en bout :
- **Base :** 11 tables avec FK composites `(user_id, x_id)`, CHECK, index partiels, recherche trigramme sans accents, déclencheur anti-cycle sur les dépendances.
- **API :** 47 routes sous `/api/v1/{ideas,projects,tasks,notes,tags}`, toutes couvertes par le harnais d'isolation (36 accès croisés → 404).
- **Domaine :** machine à états des idées, conversion idée → projet atomique et idempotente, vues de tâches par fuseau, récurrence RRULE restreinte avec occurrence suivante sans doublon sous concurrence, historique audité des statuts et échéances, notes avec `If-Match` obligatoire et liens explicites (ADR-018).
- **Front :** écrans Idées, Projets, Tâches (liste et Kanban), Notes (éditeur + aperçu Markdown assaini), Tags ; capture rapide réelle (idée, tâche, note) avec file hors ligne IndexedDB rejouée au retour du réseau.

## 2. Plan exécuté

| Tâche | Livré |
|---|---|
| T1 | Schéma Prisma, migrations `20261014000000_phase04_organization` et `20261014000100_phase04_review_fixes`, registre `manual-objects.md`, tests de base (cycles, FK inter-utilisateurs, SET NULL, cascade de série) |
| T2 | Contrats Zod `packages/contracts/src/organization/*` (dont `recurrence.ts`, partagé API/front) |
| T3 | Tags : CRUD, fusion, mécanique `tagIds` / `PUT …/tags` |
| T4–T6 | Idées (CRUD, statuts, archivage, filtres, id client idempotent), projets (slug, progression dérivée), conversion, doublons trigramme (`platform/database/raw/idea-similarity.queries.ts`) |
| T7–T10 | Tâches : CRUD, sous-tâches (un niveau), historique `audit_logs`, vues TODAY/OVERDUE/THIS_WEEK/NO_DUE_DATE, dépendances sans cycle, récurrence |
| T11 | Notes, `note_links`, `SafeMarkdown` |
| T12–T14 | Front idées, projets, tâches (Kanban + alternative clavier), notes, tags (`/settings/tags`) |
| T15 | Capture rapide réelle et file hors ligne (`lib/offline/capture-queue.ts`) |
| T16 | Isolation (36 cas), XSS, E2E `e2e/tests/phase-04/organization.e2e.ts` |
| T17 | Revues database, sécurité, code ; correctifs ; ce rapport |

## 3. Fichiers créés ou modifiés

- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261014000000_phase04_organization/`, `…000100_phase04_review_fixes/`, `apps/api/prisma/manual-objects.md`
- `packages/contracts/src/organization/*`, `packages/contracts/src/audit/audit-actions.ts`, `packages/contracts/src/index.ts`
- `apps/api/src/modules/organization/**` (domain, shared, ideas, projects, tasks, notes, tags), `apps/api/src/app.module.ts`, `apps/api/src/platform/database/{database.module.ts, raw/idea-similarity.queries.ts, tenant-scope.extension.ts}`
- `apps/api/test/{helpers/signed-in.ts, integration/organization/*, integration/database/schema-organization.int.spec.ts, isolation/routes.isolation.spec.ts}`
- `apps/web/src/features/organization/**`, `apps/web/src/features/capture/*`, `apps/web/src/lib/{ids.ts, offline/*, http/client.ts, http/session.api.ts, query-keys.ts, i18n/*}`, `apps/web/src/components/data-display/{safe-markdown.tsx, markdown-blocks.ts}`, routes, shell, registre de navigation (`CURRENT_PHASE = 4`)
- `e2e/helpers/account.ts`, `e2e/tests/phase-04/organization.e2e.ts`

## 4. Modèle de données et migrations

- Profil [B] pour chaque table, FK composites partout ; `SET NULL (colonne)` écrit à la main pour `ideas.converted_project_id`, `tasks.project_id`, `tasks.idea_id` (Prisma effacerait `user_id`) ; la série récurrente est en `ON DELETE CASCADE` (revue).
- Déclencheur `trg_task_dependencies__no_cycle` : verrou consultatif par utilisateur, CTE récursive, `search_path` figé.
- `prisma migrate diff` garde deux écarts attendus et documentés : index BRIN de la PHASE-01 et les trois FK `SET NULL (colonne)`.

## 5. API

Routes de `API.md` §14.5, plus celles de la fiche absentes du catalogue : `GET /ideas/:id/similar`, `GET /tasks/:id/history`, `POST /tasks/:id/recurrence/stop`, `POST /tags/:id/merge`. Création idempotente par `id` client (UUIDv7) : `201` + `Location`, `200` au rejeu, `409` générique si l'identifiant appartient à un autre compte. `ETag: W/"<version>"` sur lecture et écriture ; `If-Match` obligatoire sur PATCH/DELETE des notes, facultatif ailleurs (envoyé par le front).

## 6. Frontend

Pages chargées à la demande (chunk `organization`), gardées par module. Capture rapide : titre seul suffit, échéance repliée pour une tâche, file hors ligne par compte (vidée à la déconnexion) avec indicateur global et erreurs conservées. Kanban : glisser-déposer et liste « Déplacer vers » (clavier). Markdown : arbre de données rendu par React, aucun HTML interprété, liens http(s)/mailto seulement.

## 7. Décisions techniques

- Un seul module NestJS `organization` (règle « un module n'importe un autre que par son index » : conversion et vues croisent idées, projets, tâches).
- `OrganizationContext` regroupe client cloisonné, identifiants, horloge et utilisateur (règle `max-params`).
- Récurrence : jour absent du mois ramené au dernier jour (31 → fin de mois) au lieu d'être sauté (RFC) ; après une complétion tardive, la série repart de demain sans rattrapage. Génération planifiée : PHASE-08.
- Idempotence par clé primaire client (fiche §3) ; `client_capture_id` renseigné à l'identique. L'en-tête `Idempotency-Key` (table M04) n'existe pas encore : la conversion est idempotente par état.

## 8. Écarts par rapport à la fiche

- Statuts de projet : `ABANDONED` (DATA_MODEL) au lieu de `CANCELLED` (fiche) ; champs `startsOn`/`targetOn` (DATA_MODEL) au lieu de `start_date`/`due_date`.
- Dépendances : erreur `422 CIRCULAR_DEPENDENCY` (API.md) au lieu de `409 DEPENDENCY_CYCLE` (fiche) ; corps `{ dependsOnTaskId }`.
- `DELETE` = suppression logique, archivage par `POST /:id/archive` (API.md §1.8), alors que la fiche disait « DELETE = archivage ».
- Recherche `q` : `ILIKE` (pas d'index FTS, prévu PHASE-07) ; trigramme seulement pour les doublons d'idées.
- Pas d'heure locale de récurrence ni de `next_occurrence_at` calculé (worker PHASE-08).

## 9. Tests exécutés (sorties réelles, Windows 11 + Docker Desktop)

`pnpm ci:local` : **SUCCÈS**. Toutes les étapes sont vertes, y compris la migration appliquée depuis zéro.

| Étape | Résultat |
|---|---|
| format, lint, typecheck, depcruise, audit | verts |
| `packages/contracts` | 131 tests ; 98,6 % lignes, 92,5 % branches |
| `packages/money` | 85 tests |
| `apps/api` (unit + intégration Testcontainers) | 419 tests ; 96,8 % lignes, 81,8 % branches |
| `apps/web` | 148 tests ; 93,0 % lignes, 81,2 % branches |
| architecture | 9 tests |
| isolation | 41 tests (36 accès croisés M03 → 404, 401 sur toutes les routes privées) |
| build | vert (chunk `organization` chargé à la demande) |
| E2E Playwright (desktop + mobile) | 18 tests verts : 5 parcours PHASE-04 × 2 + PHASE-00/02 |

Corrections nécessaires pour faire passer les E2E :
- les parcours créent chacun un compte, donc `RATE_LIMIT_ENABLED=false` pour l'API E2E (les limites restent testées en intégration) ;
- le libellé du bouton de capture diffère entre desktop et mobile ;
- les liens des pages d'authentification sont soulignés (axe `link-in-text-block`) ;
- les toasts d'enregistrement sont déplacés dans le hook de mutation : un formulaire remonté après rechargement ne recevait plus le `onSuccess` de `mutate`.

## 10. Revues ECC

Trois revues en lecture seule : `database-reviewer`, `security-reviewer`, `code-reviewer`. Aucun CRITICAL.

### 10.1 Constats et traitement

| Revue | Constat | Traitement |
|---|---|---|
| DB H1 | Suppression physique d'une tête de série bloquée par `ck_tasks__series` | FK en CASCADE + test |
| DB H2 | Index tâches non partiel, inutilisable pour les vues | `ix_tasks__open_due` partiel, `@@index` retiré |
| DB H3 | FK `idea_id` / `project_id` sans index exploitable | `ix_tasks__idea`, `ix_tasks__project_fk` |
| DB M8 | Fonction du déclencheur sans `search_path` | figé à `public, pg_temp` |
| DB L9 / Code L1 | Occurrences supprimées relues à la complétion | filtres `deletedAt: null` |
| DB L10 | Recherche de slug libre non bornée | `take: 200` |
| Sécu M1 | File hors ligne partagée entre comptes | `ownerId` par capture, rejeu et affichage filtrés, file vidée à la déconnexion |
| Sécu M2 | Parsing Markdown quadratique | quantificateurs bornés + test de performance |
| Sécu M4 | Dépendances non plafonnées | 50 par tâche (`TASK_DEPENDENCY_LIMIT`) |
| Sécu M5 | Écritures imbriquées hors cloisonnement | refusées par l'extension `tenantScope` + tests |
| Code H1 | Kanban : retour vers « À faire » sans effet | corrigé |
| Code H2 | Changer la date gardait l'ancienne heure | heure effacée + test |
| Code M1 | Pas d'`If-Match` front sur tâches/idées/projets | version envoyée par les formulaires |
| Code M2 | Éditeur de récurrence perdait BYDAY/COUNT/ancre | parties et ancre conservées |
| Code M3/M4 | Statut CANCELLED mal géré (formulaire, Kanban) | traité comme terminal, colonne « Annulée » |
| Code L2/L3/L4/L5 | Ouverture IndexedDB, rejeu des erreurs, liens imbriqués, suppression non atomique | corrigés |
| Reportés | Index de tri keyset (DB M4), précision µs des curseurs (DB M5), FTS (DB M6), fusion de tags en SQL (DB M7), audit non transactionnel (Sécu M3), oracle 409 sur id étranger (Sécu L1), libellé de lien trompeur (Sécu L3) | voir §11 |

## 11. Risques et limitations connus

- Historique des tâches : écrit après la transaction métier (comme l'audit PHASE-01) ; aide de lecture, pas preuve d'intégrité.
- Pagination : pas d'index dédié à chaque tri ; acceptable au volume mono-utilisateur.
- Une capture refusée (4xx) reste dans la file jusqu'à son abandon ; une session expirée laisse les captures du compte en attente (filtrées, non rejouées sous un autre compte).
- Budget JS du chunk initial toujours dépassé (≈ 242 Ko gzip pour 170 Ko), hérité de PHASE-02.

## 12. Reste à faire

- Recette mobile du propriétaire (J3).
- Reportés de §10.1 ; FTS en PHASE-07 ; génération planifiée des récurrences en PHASE-08.

## 13. Recette manuelle à faire par le propriétaire

Sur téléphone : capturer une idée, une tâche et une note (dont une en mode avion), convertir l'idée en projet, utiliser le Kanban, compléter une tâche quotidienne, écrire une note Markdown et la relier.

## 14. Point de reprise

PHASE-05 (finance, cœur) : la table `idempotency_keys` y arrive ; brancher alors `Idempotency-Key` sur la conversion idée → projet.

## 15. Confirmation sécurité

Aucun secret ajouté ; isolation vérifiée par le harnais (toutes les routes `:id`) et par les tests de références étrangères (tags, projet, parent, dépendance, liens) ; Markdown sans HTML ; file hors ligne cloisonnée par compte.
