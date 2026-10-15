# PHASE-05 : Finance, cœur

- **Statut :** En cours
- **Dépend de :** PHASE-02, PHASE-03
- **Accès :** Tous
- **Estimation :** 9 à 12 jours effectifs

## 1. Objectif
Permettre à chaque utilisateur de tenir ses finances réelles de façon **exacte et auditable** : comptes (espèces, Wave, Orange Money, banque…), entrées et sorties catégorisées, transferts y compris multi-devises avec frais liés, annulation et ajustement contrôlés, soldes calculés depuis le registre, rapports par période et par catégorie, rapprochement avec un solde observé. Aucune opération n'est comptée deux fois, aucune devise n'est mélangée.

## 2. Contexte à charger
1. `DECISIONS.md` : ADR-007, 008, 009, 010, 011, 016 (pas d'écriture financière hors ligne), 020, 023 ; hypothèse H3 (découvert refusé par défaut).
2. `PRODUCT_SCOPE.md` §2 (notion de compte) et §4 (ligne M04).
3. `FINANCE_RULES.md` : **intégralité des sections** solde, classification économique, transferts, multi-devises et taux, frais, annulation, ajustement et rapprochement, idempotence, arrondi, rapports ; tous les cas FIN-xx de ces sections.
4. `DATA_MODEL.md` : sections finance (`currencies`, `financial_accounts`, `transaction_categories`, `counterparties`, `transactions`, `ledger_entries`, `idempotency_keys`).
5. `API.md` : routes `/finance/*`, montants en chaîne, en-tête `Idempotency-Key`, codes d'erreur finance.
6. `DESIGN_PATTERNS.md` : unité de travail (transaction SQL), verrouillage, SQL brut encadré (`platform/database/raw/`), service de domaine pur.
7. `SECURITY.md` : audit des opérations financières, concurrence, isolation.
8. `FRONTEND.md` et `DESIGN_SYSTEM.md` : formulaires financiers, `MoneyInput`, affichage des montants et devises.
9. `TESTING.md` : tests de propriétés fast-check, couverture 100 % du domaine finance.
10. `PRODUCT_SPEC.md` §4.9, §4.10, §6.1, §6.2, §6.5, §6.6 uniquement.

## 3. Périmètre
### Inclus
**Devises**
- Table globale `currencies` (`code`, `exponent`, `symbol`, `name`), en lecture seule pour les utilisateurs, alimentée par seed idempotent : au minimum `XOF` (0, FCFA), `XAF` (0), `EUR` (2), `USD` (2), `GBP` (2). Devise par défaut XOF (ADR-008). `packages/money` lit les exposants depuis la même source de vérité (liste partagée dans `packages/contracts` et vérifiée contre la table au démarrage).

**Comptes financiers**
- Types `CASH`, `MOBILE_MONEY`, `BANK`, `PAYMENT_ACCOUNT`, `OTHER` ; fournisseur (pour mobile money : `WAVE`, `ORANGE_MONEY`, `FREE_MONEY`, `WIZALL`, `OTHER` ; pour banque : nom libre) ; une **seule devise** par compte ; solde initial (`opening_balance_minor`) et date d'ouverture ; `allow_overdraft` (faux par défaut, H3) ; statut actif/archivé ; notes ; couleur/icône.
- Le solde initial n'est plus modifiable dès qu'une écriture existe : la correction passe par un **ajustement**.
- Archivage autorisé avec historique conservé ; un compte archivé ne reçoit plus de nouvelle écriture.

**Catégories**
- Par utilisateur, avec `kind` (`INCOME` | `EXPENSE`) et **classification économique** (selon `FINANCE_RULES.md`, ex. opérationnelle, non opérationnelle, principal de dette, mouvement interne) qui pilote les rapports ; hiérarchie à un niveau (catégorie / sous-catégorie) ; archivage ; catégories système non supprimables.
- **Seed sénégalais** (idempotent, `ensureDefaultCategories(userId)`, appelé à l'inscription et, pour les utilisateurs existants, au premier accès à la finance) :
  - Entrées : Salaire, Paiement client, Freelance, Ventes et commerce, Transfert reçu (famille, diaspora), Tontine reçue, Cadeau reçu, Remboursement reçu, Autre entrée.
  - Sorties : Alimentation et marché, Transport (taxi, bus, Yango…), Logement et loyer, Électricité (Senelec, Woyofal), Eau, Téléphone et internet (crédit, forfaits), Santé et pharmacie, Éducation et formation, Famille et solidarité, Cérémonies (baptême, mariage, deuil), Fêtes et religion (Tabaski, Korité, dons, zakat), Tontine (cotisation), Abonnements, Hébergement et services tech, Matériel, Habillement, Loisirs, **Frais mobile money et bancaires**, Remboursement de dette, Don, Autre dépense.
  - Le cadeau reçu n'est pas un revenu professionnel ; le remboursement de dette n'est pas une charge opérationnelle (classifications du seed conformes à `FINANCE_RULES.md`).

**Contreparties**
- Personne ou organisation (nom, type, téléphone facultatif, notes, archivage) ; réutilisées par les dettes (PHASE-06) et les clients (PHASE-10 pourra les relier).

**Transactions** (types de cette phase : `INCOME`, `EXPENSE`, `TRANSFER`, `REFUND`, `ADJUSTMENT` ; `BORROWING` et `LOAN` arrivent en PHASE-06)
- En-tête `transactions` + écritures `ledger_entries` (ADR-009) : revenu ou dépense = 1 écriture ; transfert = 2 écritures.
- Champs : type, statut (`PENDING`, `VALIDATED`, `CANCELLED`), description, montant (chaîne de chiffres, strictement positif), devise, date d'opération (date civile) et heure facultative, catégorie (obligatoire pour `INCOME`/`EXPENSE`/`REFUND`), compte, contrepartie, référence externe, notes, `parent_transaction_id` (frais), champs de change (transfert multi-devises), `cancelled_at`, `cancel_reason`, créateur, timestamps.
- **Transaction en attente** (`PENDING`) : affichée séparément, n'affecte pas le solde réalisé ; validation explicite.
- **Modification** d'une transaction validée : seuls description, notes, catégorie, contrepartie et référence sont modifiables (audités). Montant, devise, compte, date et type : **annuler puis recréer**.
- **Annulation** : statut `CANCELLED` avec motif, écritures conservées mais exclues des soldes, audit ; l'annulation d'une transaction annule ses frais liés dans la même transaction SQL. Jamais de suppression.
- **Remboursement** (`REFUND`) : entrée liée facultativement à une dépense d'origine, classée selon `FINANCE_RULES.md`.

**Transferts**
- Entre deux comptes **différents** de l'utilisateur ; même devise : montant unique ; **devises différentes** : montant source, **taux saisi par l'utilisateur** (jamais inventé), date du taux, montant cible calculé par `packages/money` (arrondi half-up) et affiché avant validation ; conservation du montant d'origine, du taux, de la date et du montant converti (§6.5 du cahier).
- **Frais liés** : facultatifs, saisis avec le transfert (ou une dépense), créés comme transaction `EXPENSE` séparée (catégorie « Frais mobile money et bancaires » par défaut) liée par `parent_transaction_id`, dans la même transaction SQL (ex. retrait Wave → espèces avec frais).
- Un transfert n'est ni revenu ni dépense dans les rapports.

**Ajustement et rapprochement**
- **Ajustement** : l'utilisateur saisit le solde observé à une date ; le système crée une transaction `ADJUSTMENT` du montant de l'écart (crédit ou débit), motif obligatoire, audit ; exclue des rapports de revenus et dépenses.
- **Rapprochement** : l'utilisateur saisit le solde du relevé (ou du solde Wave affiché) à une date ; le système affiche solde calculé, écart et transactions de la période ; l'utilisateur peut cocher les transactions rapprochées, puis confirmer (avec ajustement si écart restant) ; date et solde du dernier rapprochement conservés sur le compte.

**Idempotence**
- En-tête `Idempotency-Key` **obligatoire** sur `POST /finance/transactions`, `POST /finance/transfers`, ajustements et rapprochements ; table `idempotency_keys` (`user_id`, clé, empreinte de la requête, statut et corps de réponse, expiration 24 h) ; même clé + même corps → même réponse rejouée ; même clé + corps différent → erreur (`IDEMPOTENCY_KEY_REUSED`, code HTTP selon `API.md`).

**Soldes et concurrence**
- Solde réalisé = `opening_balance + Σ CREDIT − Σ DEBIT` des écritures dont la transaction est `VALIDATED` (ADR-009), calculé par **un seul service** réutilisé par les pages, les rapports et (PHASE-07) le dashboard.
- Découvert refusé si `allow_overdraft = false` : vérification sous verrou des lignes de comptes concernés (`SELECT … FOR UPDATE` dans `platform/database/raw/`, ordre de verrouillage déterministe par `id` pour éviter les interblocages).
- Solde disponible affiché = réalisé ; montant en attente affiché à part.

**Rapports**
- Résumé par période (`from`, `to`, fuseau de l'utilisateur) **par devise** : entrées, sorties, solde net, en distinguant opérationnel et non opérationnel ; répartition par catégorie (et sous-catégorie) ; flux de trésorerie par jour/semaine/mois ; soldes par compte et totaux **par devise** (jamais de total multi-devises sans conversion explicite, aucune conversion automatique dans cette phase).

**Frontend**
- Saisie d'une transaction depuis la capture rapide (**en ligne uniquement** ; hors ligne, le type transaction est désactivé avec explication — ADR-016).

### Exclu (et phase où ces éléments seront traités)
- Dettes, créances, `BORROWING`, `LOAN`, remboursements imputés → PHASE-06.
- Transactions récurrentes, abonnements, prévisions → PHASE-06.
- Widgets du dashboard, recherche des transactions, export financier → PHASE-07.
- Notifications (solde bas, etc.) → PHASE-08.
- Pièces jointes (reçus) → PHASE-09 (`document_links`).
- Factures et imputation par `invoice_payments` → PHASE-10 (ADR-030) ; lien transaction ↔ serveur/application → PHASE-12.
- Import CSV de relevés → non prévu ; à proposer comme décision si besoin.
- Conversion vers une devise de reporting avec taux → non prévu (aucun taux inventé) ; à proposer comme décision si besoin.

## 4. Modèle de données
Tables créées (noms canoniques, détail dans `DATA_MODEL.md`, sections finance) : `currencies` (globale, sans `user_id`), `financial_accounts`, `transaction_categories`, `counterparties`, `transactions`, `ledger_entries`, `idempotency_keys`.

Points obligatoires :
- Montants en `BIGINT` unités mineures, `currency CHAR(3)` FK vers `currencies` ; taux en `NUMERIC(20,10)` (ADR-008).
- `CHECK (amount_minor > 0)` sur `ledger_entries` et sur les montants de `transactions`.
- FK composites `(user_id, …)` partout ; une écriture référence un compte du même utilisateur ; la devise de l'écriture est égale à celle du compte (vérifiée par le service **et** par une contrainte ou un déclencheur selon `DATA_MODEL.md`).
- `ledger_entries` en ajout seul (ni UPDATE ni DELETE dans le code ; règle vérifiée par test d'architecture).
- Unicité `(user_id, key)` sur `idempotency_keys` ; unicité `(user_id, lower(name), parent_id)` sur les catégories.
- Index : `ledger_entries (user_id, account_id)`, `transactions (user_id, occurred_on desc)`, `transactions (user_id, category_id, occurred_on)`, `transactions (user_id, status)`.

Migrations : `0003_finance_core` (schéma) et `0004_seed_currencies` (données de référence). Le seed des catégories est applicatif (par utilisateur).

## 5. API
Voir `API.md`. Tout utilisateur authentifié, données propres uniquement. Montants toujours en chaîne de chiffres.

| Méthode | Route | Remarque |
|---|---|---|
| GET | `/finance/currencies` | liste de référence (route à ajouter au catalogue d'`API.md` si absente) |
| GET / POST | `/finance/accounts` | liste avec solde réalisé et montant en attente |
| GET / PATCH | `/finance/accounts/:id` | solde initial non modifiable après première écriture |
| POST | `/finance/accounts/:id/archive`, `/finance/accounts/:id/restore` | |
| POST | `/finance/accounts/:id/adjustments` | `Idempotency-Key` requis |
| GET / POST | `/finance/accounts/:id/reconciliations` | prévisualisation puis confirmation, `Idempotency-Key` requis |
| GET / POST | `/finance/categories` | |
| PATCH | `/finance/categories/:id` | |
| POST | `/finance/categories/:id/archive` | catégories système refusées |
| GET / POST | `/finance/counterparties` | |
| GET / PATCH | `/finance/counterparties/:id` | |
| POST | `/finance/counterparties/:id/archive` | |
| GET / POST | `/finance/transactions` | filtres période, compte, catégorie, type, statut, contrepartie, devise ; curseur ; `Idempotency-Key` requis en POST ; frais facultatifs |
| GET / PATCH | `/finance/transactions/:id` | PATCH limité aux champs non financiers |
| POST | `/finance/transactions/:id/validate` | `PENDING` → `VALIDATED` |
| POST | `/finance/transactions/:id/cancel` | motif obligatoire |
| POST | `/finance/transfers` | même devise ou multi-devises avec taux ; frais facultatifs ; `Idempotency-Key` requis |
| GET | `/finance/transfers/:id` | vue transfert (2 écritures, change, frais) |
| GET | `/finance/reports/summary` | `from`, `to` ; par devise |
| GET | `/finance/reports/by-category` | |
| GET | `/finance/reports/cashflow` | `granularity=day|week|month` |
| GET | `/finance/reports/balances` | par compte et totaux par devise |

## 6. Frontend
| Route | Écran |
|---|---|
| `/finance` | Vue d'ensemble : soldes par compte, totaux par devise, en attente, dernières transactions, accès rapide « Dépense », « Entrée », « Transfert » |
| `/finance/accounts`, `/finance/accounts/:id` | Comptes ; détail avec écritures, solde courant, ajustement, rapprochement |
| `/finance/transactions`, `/finance/transactions/:id` | Liste filtrable (période, compte, catégorie…), détail, annulation avec motif |
| `/finance/transactions/new?type=` | Formulaire dépense / entrée (montant, devise déduite du compte, date, catégorie, compte, contrepartie, frais) |
| `/finance/transfers/new` | Transfert ; multi-devises : saisie du taux, aperçu du montant converti avant validation |
| `/finance/reports` | Résumé par période, par catégorie (graphique), flux |
| `/finance/settings/categories`, `/finance/counterparties` | Gestion |

- Clé d'idempotence générée par le front **à l'ouverture** du formulaire et réutilisée en cas de nouvel essai (double clic, réseau instable).
- Montants saisis et affichés via `MoneyInput` / `MoneyText` ; jamais de `number`.
- États obligatoires, dont « découvert refusé », « conflit d'idempotence », « compte archivé », « hors ligne : saisie financière indisponible ».
- Barre du bas : **Finances** ouvre `/finance`.

## 7. Règles métier et cas limites
Toutes les règles et cas FIN-xx de `FINANCE_RULES.md` relatifs aux sections chargées s'appliquent ; rappels :
- Montant nul, négatif, non entier pour une devise à exposant 0, ou au format non chaîne → 422.
- Devise absente ou différente de celle du compte → 422.
- Transfert vers le même compte → 422 ; vers un compte archivé ou d'un autre utilisateur → 404 (autre utilisateur) ou 409 (archivé).
- Transfert multi-devises sans taux ou avec taux ≤ 0 → 422 ; le système ne propose jamais de taux.
- Découvert : dépense ou transfert qui rendrait le solde réalisé négatif sur un compte `allow_overdraft = false` → 409 `INSUFFICIENT_FUNDS` ; deux dépenses concurrentes ne peuvent pas ensemble dépasser le solde (verrou).
- Une transaction `CANCELLED` ne compte dans aucun solde ni rapport ; elle reste visible (filtrable).
- Annuler deux fois → 409 ; valider une transaction annulée → 409.
- Frais : même devise que le compte débité ; annulés avec leur parent.
- Ajustement de montant nul → refusé (aucun écart).
- La somme des soldes de tous les comptes d'une même devise ne change pas lors d'un transfert dans cette devise sans frais (invariant testé).
- Dates : `occurred_on` est une date civile dans le fuseau de l'utilisateur ; les rapports bornent les périodes selon ce fuseau.
- Toute création, validation, annulation, ajustement et rapprochement est écrit dans `audit_logs` (sans données sensibles superflues).

## 8. Tests exigés
- **Unitaires (couverture 100 % du domaine finance) :** calcul de solde, classification économique pour les rapports, calcul du montant converti, construction des écritures par type, règles d'annulation, règles d'ajustement.
- **Propriétés (fast-check) :** solde = initial + crédits − débits validés pour toute suite d'opérations ; transferts même devise conservent la somme ; annulation ramène exactement au solde antérieur ; jamais de solde négatif sans `allow_overdraft`.
- **Cas FIN-xx** de `FINANCE_RULES.md` correspondant au §6.6 du cahier : entrée simple, dépense simple, transfert interne, transaction annulée, double requête idempotente, transfert multi-devises, correction de solde, montant nul ou négatif refusé, devise manquante refusée, accès à la transaction d'un autre utilisateur refusé — chacun avec un test nommé par son identifiant.
- **Intégration :** atomicité (échec au milieu d'un transfert avec frais → rien n'est écrit), concurrence (N dépenses parallèles sur un compte sans découvert), idempotence (rejeu, clé réutilisée avec autre corps), seed des catégories idempotent pour utilisateurs existants, rapports par fuseau (bornes de période en `Africa/Dakar`, `Europe/Paris`, `America/New_York`).
- **Isolation :** harnais généré pour toutes les routes `/finance/*` ; tests ciblés : écriture vers le compte de B, catégorie de B, contrepartie de B, `parent_transaction_id` de B → 404 ; clé d'idempotence identique chez A et B sans collision.
- **Sécurité :** montants en `number` refusés par les contrats ; logs sans montants détaillés superflus ; règle d'architecture « pas de float sur montant » ; revue du SQL brut de verrouillage.
- **E2E Playwright :** créer un compte Wave et un compte Espèces → dépense alimentation → retrait Wave vers Espèces avec frais → vérifier soldes ; transfert EUR → XOF avec taux saisi ; annulation d'une dépense → solde restauré ; rapport du mois par catégorie ; double clic sur « Enregistrer » → une seule transaction ; hors ligne → saisie financière désactivée.

## 9. Découpage en tâches
| Tâche | Intitulé | Dépend de |
|---|---|---|
| T1 | Schéma Prisma des 7 tables, contraintes, index ; migrations `0003_finance_core`, `0004_seed_currencies` ; revue `database-reviewer` | — |
| T2 | Contrats Zod finance (montants en chaîne, types, statuts, erreurs) ; liste des devises partagée avec `packages/money` | T1 |
| T3 | Domaine pur : construction des écritures, classification, calcul de solde, conversion (tests 100 %) | T2 |
| T4 | Middleware/intercepteur d'idempotence + table `idempotency_keys` | T2 |
| T5 | Comptes (CRUD, mobile money, solde initial verrouillé, archivage) + service de solde unique | T3 |
| T6 | Catégories (seed sénégalais idempotent, hiérarchie, système) ; contreparties | T2 |
| T7 | Transactions `INCOME`/`EXPENSE`/`REFUND` : création, `PENDING`/validation, modification limitée, frais liés | T4, T5, T6 |
| T8 | Verrouillage des comptes (SQL brut encadré) et règle de découvert ; tests de concurrence | T7 |
| T9 | Annulation (avec frais liés) et audit | T7 |
| T10 | Transferts même devise et multi-devises (taux saisi), frais liés | T8 |
| T11 | Ajustement et rapprochement | T8 |
| T12 | Rapports : résumé, par catégorie, flux, soldes par devise | T7, T10 |
| T13 | Front : vue d'ensemble, comptes, détail compte | T5, T12 |
| T14 | Front : formulaires dépense/entrée/transfert (idempotence, `MoneyInput`, aperçu de change), annulation | T10, T13 |
| T15 | Front : ajustement, rapprochement, rapports, catégories, contreparties ; capture rapide « transaction » en ligne uniquement | T11, T12, T14 |
| T16 | Tests de propriétés, cas FIN-xx nommés, isolation ciblée, E2E | T15 |
| T17 | Revues ECC (security-reviewer et database-reviewer obligatoires), vérification, mise à jour docs, rapport | T16 |

## 10. Agents ECC à mobiliser
- `planner` (plan initial), `tdd-guide` (toutes les tâches).
- `security-reviewer` (**obligatoire** : isolation, concurrence, idempotence, audit).
- `database-reviewer` (**obligatoire** : schéma, contraintes, verrous, SQL brut, index des rapports).
- `typescript-reviewer`, `code-reviewer`, `react-reviewer`, `a11y-architect`.
- `e2e-runner` (T16).
- Revue par un agent **différent** de l'auteur pour le domaine finance (§11.12 du cahier).

## 11. Definition of Done
- [ ] Couverture 100 % sur le domaine finance et `packages/money` ; tests de propriétés verts.
- [ ] Chaque cas FIN-xx applicable a un test nommé qui passe.
- [ ] Transferts multi-devises conservent montant d'origine, taux, date et montant converti.
- [ ] Idempotence prouvée (rejeu et double clic) ; découvert refusé sous concurrence.
- [ ] Aucune écriture financière possible hors ligne.
- [ ] Rapports et soldes servis par le même service de calcul ; aucun total multi-devises.
- [ ] Toutes les routes `/finance/*` couvertes par le harnais d'isolation.
- [ ] Recette du propriétaire avec ses vrais comptes en production (jalon J4 de `ROADMAP.md`), sauvegarde vérifiée la veille.
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` cochée.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-05-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`).
