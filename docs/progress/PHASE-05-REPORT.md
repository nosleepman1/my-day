# PHASE-05 : Finance, cœur — rapport

- **Statut :** Terminée côté code et tests, conforme aux règles métier et audits ECC. Prête pour validation et transition vers PHASE-06.
- **Branche :** `phase-05/finance-coeur`
- **Période :** 15 octobre 2026 ; session IA
- **Auteur des commits :** Abdou <abdou@orbit.local>

## 1. Résumé

Le module M04 (Finance, cœur) est intégralement livré et vérifié :
- **Base de données :** 7 tables dédiées (`currencies`, `financial_accounts`, `transaction_categories`, `counterparties`, `transactions`, `ledger_entries`, `idempotency_keys`) avec clés primaires et étrangères composites `(user_id, id)` selon le Profil [B], contraintes CHECK rigoureuses sur les montants entiers (`BIGINT`), devises ISO 4217, déclencheur d'intégrité comptable (`trg_ledger_entries__guard`) interdisant la mutation d'écritures sur transaction non-`PENDING`, déclencheur (`orbit_transactions_guard`) interdisant la suppression physique des transactions, et déclencheur (`orbit_transactions_entries_shape`) assurant la parité et la cohérence des écritures. Les rapprochements bancaires s'appuient sur le domaine pur et sont tracés dans `audit_logs` sans requérir de table d'état volatile supplémentaire.
- **Devises & Monnaie :** Prise en compte stricte des unités mineures sans aucun flottant (`BIGINT`), support natif des devises sans sous-unités (XOF avec 0 décimale), conversion de change avec tolérance d'arrondi de ±1 unité mineure et conservation de l'inversion de taux.
- **Plateforme & Idempotence :** Infrastructure d'idempotence basée sur l'en-tête `Idempotency-Key` (table `idempotency_keys`, hachage canonique RFC 8785 du corps, détection des mutations concurrentes `P2002` avec statut `IDEMPOTENCY_IN_PROGRESS`, rejeu avec en-têtes `Idempotent-Replayed` et `Idempotency-Replayed`). Verrouillage pessimiste atomique ordonné (`SELECT ... FOR UPDATE` trié sur `id ASC`) avec `SET LOCAL lock_timeout = '5s'` pour prévenir tout interblocage (*deadlock*) et tout dépassement de découvert sous concurrence.
- **API :** Endpoints REST complets sous `/api/v1/finance/*`, couverts par le harnais d'isolation multi-tenant (tous les accès croisés renvoient `404 NOT_FOUND`, y compris sur la fusion de contreparties). Suppression physique des transactions interdite (`DELETE` supprimé, annulation par `POST /:id/cancel` avec motif obligatoire audité).
- **Domaine & Propriétés :** 10 tests de propriétés `fast-check` vérifiant les 6 invariants fondamentaux (égalité solde réalisé / solde calculé, conservation de somme des transferts internes, restauration stricte du solde à l'annulation, respect du découvert autorisé, conversion FX monotone, immutabilité des paramètres) et 14 tests unitaires nommés `[FIN-01]` à `[FIN-14]` couvrant les règles cardinales de `FINANCE_RULES.md`.
- **Frontend :** Espace Finance complet dans `apps/web` (vue d'ensemble, comptes, transactions, transferts, catégories, contreparties, rapprochements, graphiques et rapports), dialogues modaux accessibles au clavier, capture rapide financière, et garde-fou désactivant formellement toute écriture financière hors-ligne.

## 2. Plan exécuté

| Tâche | Livré |
|---|---|
| T1 | Schéma Prisma, migration `20261015000000_phase05_finance_core` (création tables, index, devises de base XOF/EUR/USD/CAD/GBP/CHF/MAD), registre `manual-objects.md`, intégrité SQL (Profil [B], déclencheurs `trg_ledger_entries__guard`, `orbit_transactions_guard`, `orbit_transactions_entries_shape`, index partiels). |
| T2 | Contrats Zod partagés `packages/contracts/src/finance/*` (`accounts`, `categories`, `counterparties`, `transactions`, `transfers`, `reconciliation`, `reports`). |
| T3 | Plateforme technique : service et intercepteur d'idempotence (`IdempotencyService`, `IdempotencyInterceptor`, `@Idempotent()`, `canonical-json.ts`) et requêtes de verrouillage ordonné avec timeout (`account-locking.queries.ts`). |
| T4 | Domaine pur : calcul de solde (`balance-calculator.ts`), règles de découvert (`overdraft-rules.ts`), convertisseur de devises (`fx-converter.ts`), classification économique (`economic-classification.ts`), règles d'ajustement (`adjustment-rules.ts`), règles d'annulation (`cancellation-rules.ts`), constructeur d'écritures (`ledger-entry-builder.ts`). |
| T5 | Devises : validation ISO 4217, gestion des unités mineures par `@orbit/money`. |
| T6 | Comptes financiers : CRUD, archivage/désarchivage, clôture, réouverture, ajustement de solde audité, traçabilité `AuditService` complète. |
| T7 | Catégories financières : hiérarchie plafonnée à 2 niveaux, protection des catégories système, cohérence des types (INCOME/EXPENSE). |
| T8 | Contreparties : CRUD, archivage/désarchivage, fusion avec réaffectation d'historique. |
| T9 | Transactions : grand livre en partie double, insertion en 2 étapes (compatible avec déclencheur SQL), verrouillage ordonné des comptes, vérification du découvert, mise à jour des détails non-financiers auditée, annulation auditée avec motif. |
| T10 | Transferts internes : transfert atomique entre deux comptes distincts, conversion de change (taux ou montants saisis), transaction de frais liée optionnelle en 2 étapes. |
| T11 | Rapprochement bancaire : comparaison solde relevé vs solde système à date de valeur, création optionnelle d'ajustement automatique, clôture de session de rapprochement. |
| T12 | Rapports financiers : agrégations temps réel (synthèse entrées/sorties/transferts, ventilation par catégorie, historique de solde, prévision de trésorerie), prise en compte signée des ajustements. |
| T13 | Frontend - Vues d'ensemble et comptes : synthèse multi-devises, liste et fiches de comptes, formulaires et dialogue d'ajustement. |
| T14 | Frontend - Transactions et transferts : liste filtrable, capture et formulaire complet (dépense/entrée), transfert inter-comptes avec frais, annulation avec motif. |
| T15 | Frontend - Paramétrage, rapprochement et rapports : gestion des catégories et contreparties, dialogue de rapprochement bancaire, 4 vues de rapports avec graphiques. Désactivation des mutations financières hors-ligne. |
| T16 | Tests de robustesse : 10 tests de propriétés `fast-check` (invariants de conservation, découvert, FX, annulation) et suite de 14 tests nommés `[FIN-01]` à `[FIN-14]`. |
| T17 | Revues spécialisées ECC (`security-reviewer`, `database-reviewer`, `code-reviewer`, `architect`), remédiations (déclencheurs PL/pgSQL, isolation merge, timeout lock, audit comptes, pré-alignement Phase 06). |

## 3. Fichiers créés ou modifiés

### Base de données & Migrations
- `apps/api/prisma/schema.prisma` : modèles `Currency`, `FinancialAccount`, `TransactionCategory`, `Counterparty`, `Transaction`, `LedgerEntry`, `IdempotencyKey`.
- `apps/api/prisma/migrations/20261015000000_phase05_finance_core/migration.sql` : création des tables, index partiels, devises de base, contraintes CHECK et déclencheurs SQL (`trg_ledger_entries__guard`, `orbit_transactions_guard`, `orbit_transactions_entries_shape`).
- `apps/api/prisma/manual-objects.md` : documentation des déclencheurs et règles SQL manuelles.

### Contrats partagés (`packages/contracts`)
- `packages/contracts/src/finance/currencies.ts`
- `packages/contracts/src/finance/accounts.ts`
- `packages/contracts/src/finance/categories.ts`
- `packages/contracts/src/finance/counterparties.ts`
- `packages/contracts/src/finance/transactions.ts`
- `packages/contracts/src/finance/transfers.ts`
- `packages/contracts/src/finance/reconciliation.ts`
- `packages/contracts/src/finance/reports.ts`
- `packages/contracts/src/finance/common.ts`
- `packages/contracts/src/index.ts` (exportation centralisée)

### API Backend (`apps/api`)
- `apps/api/src/platform/idempotency/*` : `idempotency.service.ts`, `idempotency.interceptor.ts`, `idempotent.decorator.ts`, `canonical-json.ts`.
- `apps/api/src/platform/database/raw/account-locking.queries.ts` : requêtes de verrouillage ordonné avec timeout.
- `apps/api/src/modules/finance/*` :
  - `domain/*` : `balance-calculator.ts`, `overdraft-rules.ts`, `fx-converter.ts`, `economic-classification.ts`, `adjustment-rules.ts`, `cancellation-rules.ts`, `ledger-entry-builder.ts`.
  - `shared/*` : `finance-context.ts`.
  - `currencies/*` : `currencies.controller.ts`, `currencies.service.ts`, `currencies.repository.ts`.
  - `accounts/*` : `accounts.controller.ts`, `accounts.service.ts`, `accounts.repository.ts`.
  - `categories/*` : `categories.controller.ts`, `categories.service.ts`, `categories.repository.ts`.
  - `counterparties/*` : `counterparties.controller.ts`, `counterparties.service.ts`, `counterparties.repository.ts`.
  - `transactions/*` : `transactions.controller.ts`, `transactions.service.ts`, `transactions.repository.ts`, `transaction-references.ts`.
  - `transfers/*` : `transfers.controller.ts`, `transfers.service.ts`, `transfers.repository.ts`.
  - `reconciliation/*` : `reconciliation.controller.ts`, `reconciliation.service.ts`, `reconciliation.repository.ts`.
  - `reports/*` : `reports.controller.ts`, `reports.service.ts`.
  - `finance.module.ts`, `finance.dto.ts`.

### Tests API (`apps/api/test`)
- `apps/api/test/finance/finance.property.spec.ts` (10 tests `fast-check` sur 6 invariants)
- `apps/api/test/finance/fin-rules.spec.ts` (14 tests nommés `[FIN-01]` à `[FIN-14]`)
- `apps/api/test/isolation/routes.isolation.spec.ts` (vérification de l'isolation multi-tenant sur l'ensemble des routes financières)
- Tests unitaires complets de chaque service, contrôleur et dépôt de `src/modules/finance/**`

### Frontend (`apps/web`)
- `apps/web/src/features/finance/api/finance.api.ts` (client d'API typé Zod avec signaux d'annulation)
- `apps/web/src/features/finance/pages/*` : `finance-overview-page.tsx`, `accounts-page.tsx`, `account-detail-page.tsx`, `transactions-page.tsx`, `transaction-detail-page.tsx`, `new-transaction-page.tsx`, `categories-page.tsx`, `counterparties-page.tsx`, `reports-page.tsx`.
- `apps/web/src/features/finance/components/*` : `adjust-balance-dialog.tsx`, `reconcile-account-dialog.tsx`, `create-category-dialog.tsx`, `create-counterparty-dialog.tsx`, `report-views.tsx`.
- `apps/web/src/features/capture/quick-capture-sheet.tsx` : support de la capture rapide vers transaction financière.
- `apps/web/src/features/finance/finance-accounts.test.tsx`, `finance-transactions.test.tsx`, `finance-management.test.tsx`.
- `apps/web/src/test/finance-fixtures.ts` : bouchons MSW pour le module finance.

## 4. Modèle de données et migrations

- **Profil [B] généralisé :** Clés primaires composites `(user_id, id)` et clés étrangères composites `(user_id, parent_id)` sur l'ensemble des 8 tables.
- **Intégrité financière par déclencheurs PostgreSQL :**
  - `trg_ledger_entries__guard` : interdit toute insertion, modification ou suppression d'écritures du grand livre sur une transaction dont le statut n'est pas `PENDING`. Pour insérer une transaction directement `VALIDATED`, le backend applique obligatoirement le patron en 2 étapes : insertion en `PENDING`, insertion des écritures, puis mise à jour atomique en `VALIDATED` dans la même transaction SQL.
  - `orbit_transactions_guard` : bloque formellement toute tentative de `DELETE` sur `transactions` (SQLSTATE `23514`). L'effacement d'une opération erronée se fait exclusivement par annulation (`CANCELLED`).
- **Précision monétaire :**
  - Colonnes de montants en `BIGINT` (unités mineures).
  - Taux de change en `DECIMAL(18, 8)` avec date de relevé (`rate_date`) et source (`rate_source`).
- **Indexation :**
  - Index partiels pour transactions en attente (`ix_transactions__pending`) et écritures par compte (`ix_ledger_entries__account`).
  - Index composites pour pagination par curseur sur date de valeur (`value_date DESC, id DESC`).

## 5. API

Conforme à `API.md` §14.6 et `PHASE-05-finance-coeur.md` :
- `GET /api/v1/finance/currencies` : devises ISO 4217 actives.
- `GET, POST /api/v1/finance/accounts`, `GET, PATCH /api/v1/finance/accounts/:id`, `POST /:id/archive`, `POST /:id/unarchive`, `POST /:id/close`, `POST /:id/reopen`, `POST /:id/adjustments`.
- `GET, POST /api/v1/finance/categories`, `GET, PATCH, DELETE /api/v1/finance/categories/:id`.
- `GET, POST /api/v1/finance/counterparties`, `GET, PATCH, DELETE /api/v1/finance/counterparties/:id`, `POST /:id/archive`, `POST /:id/unarchive`, `POST /:id/merge`.
- `GET, POST /api/v1/finance/transactions`, `GET, PATCH /api/v1/finance/transactions/:id`, `POST /:id/validate`, `POST /:id/cancel`. (La route `DELETE` a été expressément retirée en accord avec la règle d'interdiction de suppression physique).
- `POST /api/v1/finance/transfers`, `GET /api/v1/finance/transfers/:id`.
- `GET, POST /api/v1/finance/accounts/:id/reconciliations`.
- `GET /api/v1/finance/reports/summary`, `breakdown`, `balances`, `cashflow`.

Toutes les créations sensibles imposent ou gèrent l'en-tête `Idempotency-Key` (validé entre 16 et 128 caractères `[A-Za-z0-9_-]`). Tout rejeu renvoie les en-têtes `Idempotent-Replayed: true` et `Idempotency-Replayed: true`.

## 6. Frontend

- **Module dédié sous `/finance` :** Chargement paresseux avec arborescence claire et barre de navigation latérale.
- **Dépense / Entrée / Transfert :** Formulaires guidés déduisant automatiquement la devise du compte sélectionné, calculant les soldes prévisionnels et validant les contraintes métier en amont.
- **Rapprochement bancaire interactif :** Calcul immédiat de l'écart entre le relevé bancaire et le solde calculé du système, avec option de génération d'un ajustement automatique équilibrant le compte.
- **Reporting visuel :** Visualisation des flux, répartition par catégorie avec pourcentages, évolution des soldes et prévisions de trésorerie.
- **Sécurité hors-ligne :** Contrairement aux idées et tâches (qui disposent d'une file d'attente hors-ligne rejouée), les opérations financières sont strictement bloquées hors connexion afin d'éviter tout conflit de solde ou dépassement de découvert non contrôlé.

## 7. Décisions techniques & ADRs

- **ADR-044 : Modélisation de la tontine par catégories standards (tranche OD-1) :**
  - Pas de table ni type de compte dédié ; modélisation par catégories standards (`income.tontine_payout`, `expense.tontine`) associables à des contreparties.
- **ADR-045 : Insertion des transactions en 2 étapes pour conformité avec le déclencheur d'intégrité comptable :**
  - *Contexte :* Le déclencheur `trg_ledger_entries__guard` lève une exception si une écriture de grand livre est insérée alors que la transaction n'est pas en statut `PENDING`.
  - *Décision :* Toute transaction créée avec le statut `VALIDATED` (ou tout transfert avec frais) est insérée en tête avec le statut `PENDING` (`validated_at = null`), puis les écritures de grand livre sont insérées, et enfin la transaction est mise à jour en `VALIDATED` avec `validated_at = occurred_at` dans la même transaction SQL.
- **ADR-046 : Interdiction absolue de suppression physique des transactions financières :**
  - *Contexte :* Le déclencheur `orbit_transactions_guard` interdit la suppression physique sur `transactions`. La spécification `FINANCE_RULES.md` §11.1 stipule qu'une transaction erronée doit être annulée (`CANCELLED`) et jamais supprimée (`DELETE`).
  - *Décision :* Suppression de la route `DELETE /api/v1/finance/transactions/:id` dans le contrôleur, le service et le dépôt. Seule l'action `POST /api/v1/finance/transactions/:id/cancel` est autorisée avec motif obligatoire.
- **ADR-047 : Concurrence d'idempotence et gestion de course P2002 :**
  - *Contexte :* Deux requêtes concurrentes utilisant la même clé d'idempotence peuvent interroger la base avant que la première n'ait fini d'insérer sa clé `IN_PROGRESS`, déclenchant une violation de contrainte d'unicité Prisma `P2002` sur `(user_id, scope, key)`.
  - *Décision :* L'erreur Prisma `P2002` est interceptée et renvoyée en erreur métier `409 IDEMPOTENCY_IN_PROGRESS` avec l'en-tête `Retry-After: 1`.

## 8. Écarts par rapport à la fiche

- **Suppression physique de transaction :** La fiche `PHASE-05-finance-coeur.md` ne listait pas d'endpoint `DELETE /transactions/:id`, mais une route avait été initialement introduite par mimétisme avec d'autres entités. Elle a été supprimée suite à la revue base de données et à l'activation du déclencheur `orbit_transactions_guard`.
- **Classification économique dérivée :** Résolution automatique de la classe économique par défaut en fonction de la catégorie ou du type d'opération (`INCOME_OPERATING`, `EXPENSE_OPERATING`, `INTERNAL_TRANSFER`, etc.) lorsque l'utilisateur ne la spécifie pas explicitement.
- **Double en-tête de rejeu :** Émission conjointe de `Idempotent-Replayed: true` (standard RFC) et `Idempotency-Replayed: true` (convention interne historique ORBIT).

## 9. Tests exécutés (sorties réelles)

Tous les tests de l'espace de travail sont verts :

| Suite | Tests | Résultat |
|---|---|---|
| `packages/money` | 8 fichiers, 85 tests unitaires | 100 % passants |
| `packages/contracts` | 16 fichiers, 163 tests de schéma et validation | 100 % passants |
| `apps/api` (unit tests) | 70 fichiers, 570 tests (dont 10 property tests et 14 tests FIN-xx) | 100 % passants |
| `apps/api` (architecture) | 2 fichiers, 9 tests (`depcruise`, `eslint-rules`) | 100 % passants |
| `apps/web` (unit/integration) | 23 fichiers, 162 tests | 100 % passants |
| `pnpm -r typecheck` | 5 packages workspace | 0 erreur |
| `pnpm lint` (`--max-warnings 0`) | Monorepo complet | 0 erreur, 0 avertissement |
| `pnpm build` | Tous packages + apps (`api`, `web`) | Build propre (0 erreur) |
| `pnpm depcruise` | 696 modules, 2740 dépendances | 0 violation |

## 10. Revues ECC — Audit global multi-agents

Une revue approfondie multi-agents a été déployée avec 4 sous-agents spécialisés :
1. `database-reviewer` (`e4a9a0ee-3630-4c66-a0df-ef833cfd9390`)
2. `security-reviewer` (`02caa2ec-47a2-4b81-a88a-c9b854e6340c`)
3. `code-reviewer` (`eaac284c-19e9-4869-b05c-da9b679781a0`) — Score A+ (10/10)
4. `architect` (`c8db343e-600d-4673-82b0-375472fcf91b`)

### Traitement exhaustif des constats

| Réf | Agent | Sévérité | Constat | Traitement effectué |
|---|---|---|---|---|
| **DB-01** | database | CRITICAL | Le déclencheur `trg_ledger_entries__guard` bloque l'insertion directe d'écritures sur transaction `VALIDATED`. | Implémentation du patron d'insertion en 2 étapes (`insertRecords`, `createTransfer`, `insertFee`) : insertion header en `PENDING`, insertion des écritures, puis mise à jour en `VALIDATED` dans la même transaction. |
| **DB-02** | database | HIGH | La route `DELETE /transactions/:id` provoquait une violation de déclencheur `orbit_transactions_guard`. | Suppression complète de l'endpoint `DELETE /transactions/:id` dans le contrôleur, le service, le dépôt et les tests. |
| **DB-03** | database | HIGH | La fonction déclencheur `orbit_transactions_entries_shape()` accédait à `NEW.transaction_id` et manipulait des variables non assignées sur INSERT/DELETE. | Réécriture procédurale propre en PL/pgSQL avec gestion conditionnelle de `TG_TABLE_NAME` et `TG_OP`. |
| **DB-04** | database | MEDIUM | Le verrouillage pessimiste n'imposait pas de `lock_timeout` explicite dans la session de transaction. | Ajout systématique de `SET LOCAL lock_timeout = '5s'` avant tout `SELECT ... FOR UPDATE` dans `account-locking.queries.ts`. |
| **SEC-01** | security | MEDIUM | Collision concurrente lors de la création d'une clé d'idempotence. | Capture de l'erreur Prisma `P2002` dans `IdempotencyService.start` et levée d'un `DomainError('IDEMPOTENCY_IN_PROGRESS', ..., { retryAfter: 1 })`. |
| **SEC-02** | security | MEDIUM | La route `POST /counterparties/:id/merge` manquait dans le cas d'isolation multi-tenant. | Ajout de la route dans `test/isolation/routes.isolation.spec.ts` pour garantir la couverture d'isolation 100 %. |
| **SEC-03** | security | MEDIUM | Les événements de cycle de vie des comptes (`create`, `update`, `close`, `reopen`) n'étaient pas tracés dans `audit_logs`. | Injection de `AuditService` dans `AccountsService` et enregistrement systématique des 4 actions avec métadonnées. |
| **CODE-01** | code | HIGH | Le calcul de `adjustmentsMinor` dans `ReportsService.getSummary` ne signait pas le montant selon la direction comptable (CREDIT vs DEBIT). | Récupération de `ledgerEntries.direction` et signature arithmétique (+ pour CREDIT, - pour DEBIT). |
| **CODE-02** | code | LOW | Respect de la règle `max-lines-per-function` (< 50 lignes). | Découpage des méthodes `insertRecords` et `intercept` pour respecter rigoureusement la limite. |
| **ARCH-01** | architect | MEDIUM | Désalignement entre les enums Prisma (`BORROWING`, `LOAN`, `REFUND`) et les contrats Zod. | Alignement complet de `TRANSACTION_TYPES` et `TRANSACTION_SOURCES` dans `packages/contracts`, du builder d'écritures et des clés i18n frontend pour préparer la Phase 06 sans rupture. |

## 11. Sécurité et secrets

- **Attestation formelle :** Aucun secret, mot de passe, clé d'API réelle, jeton ou donnée personnelle réelle n'a été ajouté au dépôt, aux tests ou aux journaux.
- **Cloisonnement multi-tenant :** Toutes les requêtes filtrent impérativement par `user_id`. Tout accès croisé ou tentative de référencement d'un compte, d'une catégorie ou d'une contrepartie appartenant à un tiers renvoie strictement `404 NOT_FOUND` (aucun oracle d'existence, aucune fuite 403).
- **Intégrité financière :** Utilisation exclusive d'entiers (`BIGINT`), aucune valeur à virgule flottante, verrouillage pessimiste ordonné avec timeout pour empêcher toute condition de course sur les découverts.
- **Cloisonnement hors-ligne :** Les écritures financières ne sont pas autorisées hors-ligne pour garantir l'unicité et la justesse du grand livre.

## 12. Risques et limites connus

- **Taux de change historiques :** En Phase 05, les taux de change lors des transferts multi-devises sont saisis manuellement par l'utilisateur ou calculés par le ratio des montants saisis. L'intégration d'un flux automatisé de taux BCE / banques centrales est prévue en Phase 11.
- **Rapports sur très gros volumes :** Les rapports financiers actuels effectuent des agrégations à la volée sur les écritures `ledger_entries`. Pour des comptes dépassant plusieurs dizaines de milliers d'opérations, une vue matérialisée ou des compteurs pré-agrégés mensuels pourront être introduits en Phase 11.
- **Budget JS initial :** Le chunk initial du front reste à ≈ 242 Ko gzip (dépassement hérité de Phase 02, sans dégradation observée sur le chargement lazy du chunk finance).

## 13. Reste à faire pour la Phase 06

- **Jalon J4 (Recette financière du propriétaire) :**
  - Création de comptes dans plusieurs devises (XOF, EUR, USD).
  - Enregistrement de transactions réelles et vérification de la conservation des soldes.
  - Exécution d'un transfert inter-comptes avec frais et taux de change.
  - Test d'un rapprochement bancaire avec ajustement automatique.
  - Vérification de l'interdiction de suppression et du fonctionnement de l'annulation avec motif.
- **Entrée en Phase 06 (Dettes, créances, récurrences et prévisions) :**
  - Gestion des dettes et emprunts (échéanciers, amortissements, intérêts).
  - Créances clients et remboursements.
  - Moteur de récurrences financières (abonnements, salaires, loyers).
  - Prévisions de trésorerie glissantes et alertes de découvert prédictives.
