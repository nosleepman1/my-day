# PHASE-06 : Dettes, créances, récurrences et prévisions — rapport

- **Statut :** Terminée
- **Branche :** `phase-06/dettes-recurrences`
- **Période :** 16 octobre 2026 ; session IA
- **Auteur des commits :** Abdou <abdou@orbit.local>

## 1. Résumé

Le module M05 (Dettes, créances, récurrences et prévisions) est intégralement livré, vérifié et conforme aux standards d'ORBIT :
- **Base de données :** 4 nouveaux modèles (`Debt`, `DebtRepayment`, `RecurringTransaction`, `RecurringOccurrence`), 5 enums PostgreSQL (`debt_type`, `debt_status`, `recurring_status`, `recurring_generation_mode`, `occurrence_status`), conformité stricte au Profil [B] (clés primaires UUID et unicités composites `(user_id, id)`, 100 % de clés étrangères composites avec intégrité de devise triple). Déclencheurs de protection PL/pgSQL durcis (`trg_debts__guard` et `trg_debt_repayments__guard`) avec `search_path = public, pg_temp` garantissant l'interdiction de DELETE physique, le figeage dès clôture, l'interdiction de radiation sur dette `PAYABLE` et le contrôle pessimiste de sur-remboursement.
- **Domaine pur & Règle zéro-float :** Arithmétique monétaire 100 % `BigInt` (ou chaînes d'unités mineures). Respect strict d'ADR-020 (statut « en retard » dérivé dynamiquement à la volée, jamais persisté). Règles de récurrence RFC-5545 sans dérive calendaire (ancrages fins de mois, années bissextiles). Moteur de projection de trésorerie linéaire excluant rigoureusement les occurrences déjà confirmées pour éviter tout double comptage.
- **Sécurité & Concurrence :** Isolation multi-tenant étanche (réponse systématique `404 NOT_FOUND` en cas d'accès cross-tenant, sans fuite d'existence). Toutes les écritures portent `@Idempotent()` avec clé d'idempotence obligatoire. Verrouillage transactionnel prévenant la double confirmation d'une même occurrence (SEC-06-01), étanchéité stricte interdisant de rattacher une même transaction à la fois comme remboursement et comme occurrence (SEC-06-02), et obligation du statut `VALIDATED` sur toute transaction rattachée (SEC-06-03).
- **Frontend :** Espace Finance enrichi sous React 19 (`/finance/debts`, `/finance/debts/new`, `/finance/debts/:id`, `/finance/recurring`, `/finance/recurring/new`, `/finance/recurring/:id`, `/finance/upcoming`, `/finance/forecast`). Formulaires typés Zod, invalidation automatique du cache TanStack Query, indicateurs d'impayés/retards, dialogues modaux accessibles et désactivation stricte des écritures hors-ligne (`useOnlineStatus`).
- **Tests & Qualité :** 1 134 tests automatisés verts sur le monorepo (189 contracts, 85 money, 686 API, 174 web), incluant 8 tests de règles nommées `FIN-xx`, 4 suites de propriétés mathématiques `fast-check` et couverture d'isolation sur 100 % des routes privées. 0 erreur ESLint, 0 warning, 0 erreur de typage.

## 2. Plan exécuté

| Tâche | Intitulé | Statut | Commit(s) |
|---|---|---|---|
| T1 | Schéma des 4 tables, contraintes CHECK, index partiels, migration `20261016000000_phase06_debts_recurring` et revue base de données | Fait | `8b03385` |
| T2 | Contrats Zod partagés (`debts.schema.ts`, `recurring.schema.ts`, `reports.schema.ts`) | Fait | `5ff0a09` |
| T3 | Domaine pur : solde restant, statuts dérivés, dépassement, dates d'occurrence RFC-5545, projection | Fait | `c36b6fe` |
| T4 | Dettes : création avec/sans mouvement initial (`BORROWING`/`LOAN`), lecture, mise à jour | Fait | `a75491e` |
| T5 | Remboursements : création avec transaction, rattachement, suppression avec réouverture du solde | Fait | `d9d81b8` |
| T6 | Annulation, radiation (`WRITTEN_OFF`) et synthèse financière par devise | Fait | `e5d157d` |
| T7 | Récurrences : CRUD, cycle de vie (pause, reprise, terminaison), calcul d'échéances | Fait | `239ee2f` |
| T8 | Matérialisation idempotente des occurrences, confirmation avec/sans transaction, saut d'occurrence | Fait | `dafb20f` |
| T9 | Prévisions de trésorerie (`/finance/reports/forecast`) avec projection multi-comptes et alertes | Fait | `3718c86` |
| T10 | Frontend dettes et créances : liste filtrable par type, synthèse, détail, enregistrement de remboursement | Fait | `72aa1f9` |
| T11 | Frontend récurrences, à venir et prévisions : liste, fiches, écran À venir, courbe de prévision | Fait | `859962c` |
| T12 | Tests de propriétés (fast-check), cas FIN-xx nommés, isolation des routes privées, conformité lint | Fait | `e96fdee` |
| T13 | Revues spécialisées ECC (`security-reviewer`, `database-reviewer`, `code-reviewer`), remédiations et rapport | Fait | `69cca79` |

## 3. Fichiers créés ou modifiés

### Base de données & Migrations
- `apps/api/prisma/schema.prisma` : modèles `Debt`, `DebtRepayment`, `RecurringTransaction`, `RecurringOccurrence`, enums `DebtType`, `DebtStatus`, `RecurringStatus`, `RecurringGenerationMode`, `OccurrenceStatus`.
- `apps/api/prisma/migrations/20261016000000_phase06_debts_recurring/migration.sql` : création des 4 tables, clés composites, index partiels, triggers PL/pgSQL `trg_debts__guard` et `trg_debt_repayments__guard`.
- `apps/api/prisma/manual-objects.md` : enregistrement des 23 nouveaux objets SQL manuels.

### Contrats partagés (`packages/contracts`)
- `packages/contracts/src/finance/debts.schema.ts`
- `packages/contracts/src/finance/recurring.schema.ts`
- `packages/contracts/src/finance/reports.schema.ts` (enrichi avec le schéma de prévisions `ForecastReportSchema`)
- `packages/contracts/src/finance/index.ts`, `packages/contracts/src/index.ts`
- `packages/contracts/src/finance/debts-recurring.schema.spec.ts`

### API Backend (`apps/api`)
- `apps/api/src/modules/finance/domain/` :
  - `debt-rules.ts` & `debt-rules.spec.ts` : calcul du restant dû, statut de règlement dérivé, retard dérivé (ADR-020), assertions de validation de remboursement, annulation et radiation.
  - `recurrence-rules.ts` & `recurrence-rules.spec.ts` : parseur RFC-5545, générateur d'occurrences sans dérive calendaire, retard dérivé.
  - `forecast-projector.ts` & `forecast-projector.spec.ts` : projection de flux de trésorerie avec cumul dès le jour initial et détection de solde négatif.
- `apps/api/src/modules/finance/debts/` :
  - `debts.controller.ts`, `debts.service.ts`, `debts.repository.ts`, `debts.controller.spec.ts`, `debts.service.spec.ts`, `debts-lifecycle.service.spec.ts`, `debts-repayments.service.spec.ts`.
- `apps/api/src/modules/finance/recurring/` :
  - `recurring.controller.ts`, `recurring.service.ts`, `recurring.repository.ts`, `recurring.controller.spec.ts`, `recurring.service.spec.ts`, `recurring-occurrences.service.spec.ts`.
- `apps/api/src/modules/finance/reports/` :
  - `reports.controller.ts`, `reports.service.ts`, `reports.service.spec.ts`.
- `apps/api/src/modules/finance/finance.dto.ts`, `finance.module.ts`.

### Tests API (`apps/api/test`)
- `apps/api/test/finance/fin-rules-phase06.spec.ts` : tests des règles financières nommées `[FIN-04-bis]`, `[FIN-05-bis]`, `[FIN-06-bis]`, `[FIN-07-bis]`, `[FIN-17]`, `[FIN-20]`, `[FIN-37]`, `[FIN-40]`.
- `apps/api/test/finance/finance-phase06.property.spec.ts` : 4 propriétés mathématiques `fast-check` (invariants de remboursement, idempotence de matérialisation, linéarité de trésorerie, immutabilité).
- `apps/api/test/isolation/routes.isolation.spec.ts` : intégration des routes dettes et récurrences au harnais d'isolation multi-tenant.

### Frontend (`apps/web`)
- `apps/web/src/features/finance/api/finance.api.ts` : clients d'API pour dettes, remboursements, récurrences, occurrences et prévisions.
- `apps/web/src/features/finance/pages/` :
  - `debts-page.tsx`, `debt-detail-page.tsx`, `debt-form-page.tsx`.
  - `recurring-page.tsx`, `recurring-detail-page.tsx`, `recurring-form-page.tsx`.
  - `upcoming-occurrences-page.tsx`, `forecast-page.tsx`.
- `apps/web/src/features/finance/components/` :
  - `debt-summary-cards.tsx`, `repayment-dialog.tsx`, `cancel-debt-dialog.tsx`, `write-off-debt-dialog.tsx`.
  - `occurrence-card.tsx`, `confirm-occurrence-dialog.tsx`, `skip-occurrence-dialog.tsx`, `forecast-account-card.tsx`.
- `apps/web/src/routes/app.routes.tsx` : enregistrement des routes `/finance/debts/*`, `/finance/recurring/*`, `/finance/upcoming`, `/finance/forecast`.
- `apps/web/src/features/finance/finance-debts.test.tsx`, `finance-recurring-forecast.test.tsx`.
- `apps/web/src/test/finance-fixtures.ts` : bouchons pour dettes, récurrences et occurrences.

## 4. Modèle de données et migrations

- **Migration :** `apps/api/prisma/migrations/20261016000000_phase06_debts_recurring/migration.sql` (réversible, transactionnelle).
- **Tables créées :**
  - `debts` : `(user_id, id)` PK, `(user_id, counterparty_id)` FK, `(user_id, account_id, currency)` FK optionnelle.
  - `debt_repayments` : `(user_id, id)` PK, `(user_id, debt_id, currency)` FK composite, `(user_id, transaction_id, currency)` FK composite.
  - `recurring_transactions` : `(user_id, id)` PK, `(user_id, account_id, currency)` FK composite, `(user_id, destination_account_id)` FK.
  - `recurring_occurrences` : `(user_id, id)` PK, `(user_id, recurring_transaction_id)` FK composite, `(user_id, transaction_id)` FK optionnelle.
- **Triggers d'intégrité :**
  - `trg_debts__guard` : interdiction du DELETE physique, figeage des dettes non-OPEN, interdiction de clôture CANCELLED avec remboursements validés, interdiction de radiation sur PAYABLE.
  - `trg_debt_repayments__guard` : verrouillage FOR UPDATE transaction et dette, validation de correspondance économique (DEBT_REPAYMENT vs LOAN_COLLECTION), contrôle de non-dépassement du montant de la transaction.

## 5. API livrée

| Méthode | Route | Rôle | Testée (int / isolation) |
|---|---|---|---|
| POST | `/api/v1/finance/debts` | Création dette / créance (avec ou sans mouvement initial) | Oui / Oui |
| GET | `/api/v1/finance/debts` | Liste paginée avec filtres (statut, type, contrepartie) | Oui / — |
| GET | `/api/v1/finance/debts/summary` | Synthèse financière par devise (total dû, total à recouvrer, retards) | Oui / — |
| GET | `/api/v1/finance/debts/:id` | Détail d'une dette et de ses remboursements | Oui / Oui |
| PATCH | `/api/v1/finance/debts/:id` | Modification partielle de dette | Oui / Oui |
| POST | `/api/v1/finance/debts/:id/cancel` | Annulation d'une dette sans remboursements validés | Oui / Oui |
| POST | `/api/v1/finance/debts/:id/write-off` | Radiation d'une créance irrécouvrable | Oui / Oui |
| POST | `/api/v1/finance/debts/:id/repayments` | Enregistrement ou rattachement d'un remboursement | Oui / Oui |
| GET | `/api/v1/finance/debts/:id/repayments` | Liste des remboursements d'une dette | Oui / Oui |
| DELETE | `/api/v1/finance/debts/:id/repayments/:repaymentId` | Suppression d'imputation et réouverture du solde | Oui / Oui |
| POST | `/api/v1/finance/recurring` | Création d'une transaction récurrente | Oui / Oui |
| GET | `/api/v1/finance/recurring` | Liste des récurrences avec filtres | Oui / — |
| GET | `/api/v1/finance/recurring/occurrences` | Liste globale des occurrences (échéancier, retards) | Oui / — |
| POST | `/api/v1/finance/recurring/occurrences/:id/confirm` | Confirmation d'occurrence (génération ou rattachement de transaction) | Oui / Oui |
| POST | `/api/v1/finance/recurring/occurrences/:id/skip` | Saut d'une occurrence avec motif | Oui / Oui |
| GET | `/api/v1/finance/recurring/:id` | Détail d'une récurrence | Oui / Oui |
| GET | `/api/v1/finance/recurring/:id/occurrences` | Occurrences matérialisées d'une récurrence | Oui / Oui |
| PATCH | `/api/v1/finance/recurring/:id` | Modification d'une récurrence | Oui / Oui |
| POST | `/api/v1/finance/recurring/:id/pause` | Mise en pause d'une récurrence | Oui / Oui |
| POST | `/api/v1/finance/recurring/:id/resume` | Reprise d'une récurrence en pause | Oui / Oui |
| POST | `/api/v1/finance/recurring/:id/terminate` | Terminaison définitive d'une récurrence | Oui / Oui |
| GET | `/api/v1/finance/reports/forecast` | Rapport prévisionnel de trésorerie sur 30, 60 ou 90 jours | Oui / — |

## 6. Frontend livré

- `/finance/debts` : vue générale des dettes et créances avec cartes de synthèse par devise, onglets `Toutes` / `À payer` / `À recouvrer`, filtrage par statut et contrepartie, badges d'impayé / retard.
- `/finance/debts/new` : création guidée avec option de mouvement de trésorerie initial (`BORROWING`/`LOAN`).
- `/finance/debts/:id` : fiche détaillée avec barre de progression du remboursement, historique des versements, dialogue d'ajout de remboursement, annulation et radiation.
- `/finance/recurring` : liste des opérations récurrentes, statut actif/pause, coût mensuel équivalent, prochaine échéance.
- `/finance/recurring/new` : formulaire de configuration récurrente (règle RFC-5545, fuseau horaire, compte, catégorie).
- `/finance/recurring/:id` : gestion de cycle de vie (pause/reprise/terminaison) et tableau des occurrences.
- `/finance/upcoming` : console centrale des occurrences échues (à confirmer d'urgence) et à venir, avec dialogues de confirmation et de saut.
- `/finance/forecast` : projection visuelle de trésorerie par compte, sélecteur d'horizon (30, 60, 90 jours), intégration optionnelle des échéances de dettes, alerte sur solde négatif.

## 7. Décisions techniques

1. **Calcul du solde restant dû (DATA_MODEL.md §3.5) :** `remaining = principal_minor - sum(validated_repayments)`. Seules les transactions validées réduisent la dette. L'annulation d'une transaction rouvre automatiquement le solde restant sans nécessiter de recalcule persistant.
2. **Statut d'échéance dérivé (ADR-020) :** `isOverdue` est toujours calculé dynamiquement par rapport au jour civil de l'utilisateur (`dueDate < todayCivil`), évitant les incohérences d'état stocké lors des changements de fuseau.
3. **Idempotence de matérialisation :** Les occurrences sont générées à partir de l'ancre calendaire (`recurrenceAnchorOn`) et insérées avec `skipDuplicates: true` (`ON CONFLICT DO NOTHING`), empêchant rigoureusement les doublons même sous appels concurrents.
4. **Étanchéité dette / récurrence :** Une même transaction financière ne peut jamais être imputée à la fois sur un remboursement de dette et sur une occurrence récurrente (détection de conflit 409).
5. **Verrouillage de confirmation (SEC-06-01) :** La confirmation d'occurrence s'effectue dans une transaction SQL isolée vérifiant que le statut est strictement `EXPECTED` avant toute génération de transaction, empêchant le double débit sous requêtes concurrentes.

## 8. Écarts par rapport à la fiche

Aucun écart négatif. L'ensemble des spécifications de la fiche `docs/phases/PHASE-06-dettes-recurrences.md` a été respecté.

## 9. Tests exécutés (sorties réelles)

- **`pnpm lint` :** 0 erreur, 0 avertissement (`eslint . --max-warnings 0` réussi).
- **`pnpm typecheck` :** Réussi sur l'ensemble du monorepo (`packages/money`, `packages/contracts`, `apps/api`, `apps/web`).
- **Tests unitaires & architecture (`apps/api`) :** 82 fichiers, **686 tests passés avec succès** (100 %).
- **Tests frontend (`apps/web`) :** 25 fichiers, **174 tests passés avec succès** (100 %).
- **Tests contrats (`packages/contracts`) :** 17 fichiers, **189 tests passés avec succès** (100 %).
- **Tests monnaie (`packages/money`) :** 8 fichiers, **85 tests passés avec succès** (100 %).
- **Tests d'isolation (`apps/api/test/isolation/routes.isolation.spec.ts`) :** Toutes les routes privées avec paramètre `:id` des contrôleurs de la Phase 06 sont intégrées au harnais d'isolation et vérifiées contre les accès croisés.
- **Règles financières nommées :** `test/finance/fin-rules-phase06.spec.ts` validé avec les 8 cas nominaux (`FIN-04-bis`, `FIN-05-bis`, `FIN-06-bis`, `FIN-07-bis`, `FIN-17`, `FIN-20`, `FIN-37`, `FIN-40`).
- **Propriétés mathématiques (fast-check) :** `test/finance/finance-phase06.property.spec.ts` validé sur 100 itérations par propriété.

## 10. Revues ECC

| Agent | Constats CRITICAL/HIGH | Corrigés | Restants (MEDIUM/LOW) | Verdict |
|---|---|---|---|---|
| `database-reviewer` | 0 | 0 | 5 suggestions mineures (index INCLUDE, trigger DELETE en maintenance) | **APPROUVÉ** |
| `security-reviewer` | 1 (SEC-06-01 : concurrence sur confirmation d'occurrence) | 3 (SEC-06-01 verrou transactionnel, SEC-06-02 étanchéité dette/récurrence, SEC-06-03 vérification tx VALIDATED) | 2 LOW (vérification préventive projectId, désactivation bouton suppression offline) | **APPROUVÉ** |
| `code-reviewer` | 1 (omission flux jour initial dans forecast) | 2 (flux jour initial cumulé dans forecast, interface options fixtures web < 50 lignes) | 1 LOW (couverture locale isolée debt-rules.spec.ts enrichie) | **APPROUVÉ** |

## 11. Risques et limitations connus

- **Environnement de test Testcontainers :** Le harnais dynamique d'intégration PostgreSQL requiert Docker Desktop actif.
- **Tontines et cotisations complexes :** Les récurrences actuelles couvrent les flux périodiques standard (montant fixe, intervalle régulier). Les logiques de tontines rotatives multi-bénéficiaires relèveront des extensions de règles ou d'automatisations de la Phase 15.

## 12. Reste à faire

- **Phase 07 (Dashboard, recherche, exports) :** Intégrer les dettes échues et occurrences du jour dans le Centre d'attention (`Dashboard`), inclure les dettes et récurrences dans la recherche globale et les exports CSV/JSON.

## 13. Recette manuelle à faire par le propriétaire

1. **Création d'emprunt reçu :** Créer une dette `PAYABLE` de 300 000 FCFA avec mouvement initial vers le compte bancaire. Vérifier l'augmentation du solde du compte et l'affichage de la dette dans l'onglet `À payer`.
2. **Remboursement partiel (Annexe A.3) :** Effectuer un versement de 100 000 FCFA. Vérifier que le solde restant passe à 200 000 FCFA, que la transaction créée apparaît dans l'historique bancaire, et que la position nette reste invariante.
3. **Récurrence mensuelle :** Créer un abonnement de 10 000 FCFA mensuel ancré au 31 du mois. Vérifier dans `/finance/upcoming` que l'occurrence du mois suivant s'affiche au dernier jour civil valide.
4. **Confirmation d'occurrence :** Confirmer l'occurrence du mois depuis `/finance/upcoming`. Vérifier que la transaction bancaire est générée et que l'occurrence passe au statut `CONFIRMÉE`.
5. **Prévisions de trésorerie :** Consulter `/finance/forecast` sur 60 jours. Vérifier la courbe prévisionnelle et l'absence d'alerte rouge si le solde reste positif.

## 14. Confirmation sécurité

- [x] Aucun secret réel ajouté au dépôt.
- [x] Aucune migration destructive.
- [x] Aucun service payant ou externe appelé sans accord.
