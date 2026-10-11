# PHASE-10 : Pro, clients, contacts, contrats et factures

- **Statut :** À faire
- **Dépend de :** PHASE-04, PHASE-05, PHASE-06, PHASE-07, PHASE-08, PHASE-09
- **Accès :** Tous (module désactivable via `user_preferences.enabled_modules`, ADR-024)
- **Estimation :** 9 à 11 jours effectifs

## 1. Objectif
Permettre à un utilisateur freelance de gérer ses clients, contacts et contrats, d'émettre des factures numérotées et figées, et d'encaisser des paiements fractionnés en imputant les transactions de revenu du registre financier, avec un solde et un retard toujours dérivés.

## 2. Contexte à charger
1. `AGENTS.md`, `DECISIONS.md` (ADR-007, ADR-008, ADR-009, ADR-018, ADR-020, ADR-023, ADR-024, hypothèse H1), `PRODUCT_SCOPE.md` §4 (M09) et « Évolutions prévues ».
2. `docs/progress/PHASE-09-REPORT.md`.
3. `FINANCE_RULES.md` : sections **Factures** (calcul des lignes, arrondi half-up par ligne, statuts, imputation des paiements, cas FIN-xx de la section) et **Transactions** (statuts, annulation).
4. `DATA_MODEL.md` : sections `clients`, `contacts`, `client_contacts`, `contracts`, `invoices`, `invoice_items`, `invoice_payments`, `invoice_sequences`, `projects`, `transactions`, `document_links`, `reminders`.
5. `API.md` : conventions, idempotence (`Idempotency-Key`), montants en chaîne.
6. `SECURITY.md` : génération de PDF, audit, données personnelles des clients.
7. `FRONTEND.md`, `DESIGN_SYSTEM.md` : formulaires à lignes dynamiques, affichage des montants (`packages/money`).
8. `TESTING.md` : tests financiers (fast-check), couverture 100 % du domaine finance.
9. `PRODUCT_SPEC.md` §4.3, §4.4, §4.12, §6.4, Annexe A.1 (pour mémoire).

## 3. Périmètre
### Inclus
- **Clients** (personne ou entreprise) : CRUD, statut, archivage, fiche avec historique (projets, contrats, factures, paiements, notes, documents).
- **Contacts** et liaison N:N `client_contacts` (rôle, contact principal).
- **Contrats** : référence unique par utilisateur, client, projet facultatif, montant, devise, période, statut, historique de statut (audit), documents liés.
- **Factures** : brouillon modifiable ; lignes (quantité, prix unitaire, taux de taxe) ; totaux calculés par le serveur ; **émission** qui attribue le numéro et **gèle** la facture ; paiements fractionnés par **imputation** de transactions `INCOME` validées ; statut de paiement recalculé ; **retard dérivé** ; **annulation auditée** ; PDF.
- **Encaissement en une étape** : « Enregistrer un paiement » crée la transaction `INCOME` (via le service finance de PHASE-05) et son imputation dans la même transaction SQL, avec clé d'idempotence.
- Ajout de `projects.client_id` (nullable) et sélection du client dans le formulaire projet.
- Rappels de relance (avant échéance, à échéance, après) via `reminders`.
- Rattachement de documents aux clients, contrats et factures (`document_links`).
- Module désactivable : masquage de l'interface et refus des routes `/pro/*`.
- Extensions : dashboard (à encaisser, en retard), recherche (clients, contacts, contrats, factures par numéro), export (CSV/JSON clients, factures, paiements), agenda (échéances de factures).

### Exclu (et phase où ces éléments seront traités)
- **Avoirs, remises a posteriori, radiations** : non prévus par `PRODUCT_SCOPE.md` ; nécessitent une ADR et une table dédiée (voir §7, règle 14).
- Devis : non retenus dans le périmètre consolidé.
- Envoi de la facture par e-mail au client : PHASE-14 (brouillon Gmail) ; pas d'envoi automatique.
- Rapprochement automatique paiement ↔ facture par IA : PHASE-16 (proposition à confirmer).
- Conformité fiscale locale (mentions légales obligatoires, TVA sénégalaise) : non garantie, à valider par un professionnel (§4.4 du cahier).

## 4. Modèle de données
Migration : `phase10_pro_invoicing`. Détail : `DATA_MODEL.md`.

| Table | Action | Points clés |
|---|---|---|
| `clients` | création | `user_id`, `type` (`PERSON`, `COMPANY`), `name`, `email`, `phone`, `address`, `city`, `country_code`, `status` (`ACTIVE`, `INACTIVE`), `notes`, `archived_at`, timestamps. Index `(user_id, status)`, trigramme sur `name`. |
| `contacts` | création | `user_id`, `first_name`, `last_name`, `email`, `phone`, `job_title`, `notes`, timestamps. |
| `client_contacts` | création | `user_id`, `client_id`, `contact_id`, `relationship_role`, `is_primary`. PK `(client_id, contact_id)` ; index unique partiel : un seul `is_primary = true` par client. |
| `contracts` | création | `user_id`, `client_id`, `project_id` nullable, `reference` (unique `(user_id, reference)`), `title`, `description`, `amount_minor` BIGINT nullable `CHECK >= 0`, `currency`, `start_date`, `end_date` (`CHECK end_date >= start_date`), `status` (`DRAFT`, `ACTIVE`, `COMPLETED`, `TERMINATED`), timestamps. |
| `invoice_sequences` | création | `user_id`, `prefix` (défaut `FAC`), `year`, `next_value` ; unique `(user_id, prefix, year)`. |
| `invoices` | création | `user_id`, `client_id`, `project_id` nullable, `contract_id` nullable, `invoice_number` nullable (attribué à l'émission ; unique partiel `(user_id, invoice_number)`), `issue_date`, `due_date` (`CHECK due_date >= issue_date`), `currency`, `subtotal_minor`, `tax_minor`, `total_minor` (BIGINT, `CHECK >= 0`), `status` (`DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`), `issued_at`, `cancelled_at`, `cancellation_reason`, `client_snapshot` (JSONB figé à l'émission), `notes`, timestamps. |
| `invoice_items` | création | `user_id`, `invoice_id`, `position`, `description`, `quantity` NUMERIC(12,3) `CHECK > 0`, `unit_price_minor` BIGINT `CHECK >= 0`, `tax_rate` NUMERIC(7,4) `CHECK BETWEEN 0 AND 1`, `line_subtotal_minor`, `line_tax_minor`, `line_total_minor`. |
| `invoice_payments` | création | `user_id`, `invoice_id`, `transaction_id`, `amount_minor` `CHECK > 0`, `allocated_at`, `unallocated_at` nullable, `unallocation_reason`. Unique partiel `(invoice_id, transaction_id) WHERE unallocated_at IS NULL`. |
| `projects` | modification | Ajout `client_id` nullable, FK composite `(user_id, client_id)`, `ON DELETE RESTRICT`. |
| `document_links` | modification | Ajout `client_id`, `contract_id`, `invoice_id` + mise à jour du `CHECK num_nonnulls`. |
| `reminders` | modification | Ajout `invoice_id` + mise à jour du `CHECK num_nonnulls`. |

**Tranché par ADR-030** : `invoice_payments` est la seule source d'imputation ; la colonne `transactions.invoice_id` n'existe pas.

## 5. API
Routes sous `/api/v1/pro`, session requise. Si le module Pro est désactivé : **403 `MODULE_DISABLED`** (aucune donnée supprimée). Mutations financières : en-tête `Idempotency-Key` obligatoire.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET/POST | `/pro/clients` | Tous | Liste (filtres statut, archivés, recherche) / création. |
| GET/PATCH | `/pro/clients/:id` | Tous | Fiche (avec historique agrégé) / modification. |
| POST | `/pro/clients/:id/archive`, `/unarchive` | Tous | Archivage réversible. |
| DELETE | `/pro/clients/:id` | Tous | Refusé (409 `CLIENT_HAS_HISTORY`) dès qu'une facture émise, un contrat ou un projet est lié. |
| GET/POST | `/pro/contacts` | Tous | Contacts. |
| GET/PATCH/DELETE | `/pro/contacts/:id` | Tous | |
| PUT | `/pro/clients/:id/contacts/:contactId` | Tous | Lie un contact (rôle, principal). |
| DELETE | `/pro/clients/:id/contacts/:contactId` | Tous | Délie. |
| GET/POST | `/pro/contracts` | Tous | |
| GET/PATCH/DELETE | `/pro/contracts/:id` | Tous | Changement de statut audité. |
| GET/POST | `/pro/invoices` | Tous | Liste (filtres statut, client, `overdue=true`) / création d'un brouillon avec lignes. |
| GET/PATCH | `/pro/invoices/:id` | Tous | Lecture (avec `paidMinor`, `balanceMinor`, `isOverdue`, `displayStatus`) / modification **seulement si `DRAFT`** (sinon 409 `INVOICE_LOCKED`). |
| DELETE | `/pro/invoices/:id` | Tous | Seulement si `DRAFT`. |
| POST | `/pro/invoices/:id/issue` | Tous | Émission : numérotation, gel, `client_snapshot`, rappels. |
| GET | `/pro/invoices/:id/payments` | Tous | Imputations actives et historiques. |
| POST | `/pro/invoices/:id/payments` | Tous | Corps `{ transactionId, amount }` (imputation d'une transaction existante) **ou** `{ accountId, amount, date, categoryId? }` (création de la transaction `INCOME` + imputation). |
| POST | `/pro/invoices/:id/payments/:paymentId/unallocate` | Tous | Désimputation motivée (auditée). |
| POST | `/pro/invoices/:id/cancel` | Tous | Corps `{ reason }` ; refusé s'il reste des imputations actives (409 `INVOICE_HAS_PAYMENTS`). |
| GET | `/pro/invoices/:id/pdf` | Tous | PDF généré à la volée (`Content-Disposition: attachment`). |
| GET | `/pro/invoices/next-number` | Tous | Aperçu du prochain numéro (indicatif, non réservé). |
| GET | `/finance/transactions/:id/invoice-allocations` | Tous | Côté finance : imputations d'une transaction et montant non imputé. |

## 6. Frontend
- **Routes :** `/pro` (tableau de bord Pro), `/pro/clients`, `/pro/clients/:id`, `/pro/contacts`, `/pro/contracts`, `/pro/contracts/:id`, `/pro/invoices`, `/pro/invoices/new`, `/pro/invoices/:id`.
- **Composants :** `ClientForm`, `ClientTimeline` (projets, contrats, factures, paiements, notes, documents), `ContactPicker`, `InvoiceEditor` (lignes dynamiques ; aperçu des totaux calculé localement **à titre indicatif**, valeurs définitives renvoyées par le serveur), `InvoiceStatusBadge` (statut affiché : Brouillon, Émise, Partiellement payée, Payée, **En retard**, Annulée), `RecordPaymentDialog` (choix d'une transaction existante non imputée **ou** saisie d'un encaissement), `CancelInvoiceDialog` (motif obligatoire), bouton PDF.
- **Paramètres :** bascule « Module Pro » dans Paramètres ; masque l'entrée « Pro » du menu Plus et les champs client des projets.
- **États obligatoires** : chargement, vide (« Créez votre premier client »), erreur, facture verrouillée (lecture seule avec explication), conflit d'idempotence, hors ligne (lecture seule ; **aucune écriture financière hors ligne**, ADR-016).

## 7. Règles métier et cas limites
Renvoi principal : `FINANCE_RULES.md`, section Factures (cas FIN-xx associés).
1. **Calcul par ligne (ADR-008)** : `line_subtotal = round_half_up(quantity × unit_price_minor)` ; `line_tax = round_half_up(line_subtotal × tax_rate)` ; `line_total = line_subtotal + line_tax`. Totaux de facture = sommes des lignes. Calcul exclusivement via `packages/money` (aucun `number` sur un montant). Exemple XOF : 3 × 33 333 à 18 % → sous-total 99 999, taxe 18 000 (17 999,82 arrondi), total 117 999.
2. Le client envoie quantités, prix et taux ; **le serveur ignore tout total fourni** par le client.
3. **Numérotation** : à l'émission seulement, format `{prefix}-{année}-{numéro sur 4 chiffres}` (ex. `FAC-2026-0001`), séquence par utilisateur et par année, obtenue par `UPDATE invoice_sequences … RETURNING` dans la transaction d'émission (verrou de ligne). Pas de trou provoqué par les brouillons ; deux émissions concurrentes ne produisent jamais le même numéro.
4. **Gel** : après émission, lignes, montants, client, devise et dates sont immuables (409 `INVOICE_LOCKED`) ; seules les notes internes restent modifiables, avec audit.
5. **Imputation** : la transaction doit appartenir à l'utilisateur (sinon 404), être de type `INCOME`, au statut `VALIDATED`, **dans la devise de la facture** (sinon 422 `CURRENCY_MISMATCH`). Contrainte applicative et testée : Σ imputations actives d'une transaction ≤ montant de la transaction ; Σ imputations actives d'une facture ≤ `total_minor` (sinon 422 `OVERPAYMENT`). Vérification sous verrou (`SELECT … FOR UPDATE` sur la facture et la transaction).
6. **Statut de paiement** recalculé dans la même transaction SQL à chaque imputation, désimputation, ou changement de statut d'une transaction imputée (événement de domaine de PHASE-05) : `paid = Σ imputations actives dont la transaction est VALIDATED` ; `paid = 0` → `ISSUED`, `0 < paid < total` → `PARTIALLY_PAID`, `paid = total` → `PAID`. Un invariant fast-check vérifie que le statut stocké est toujours égal au statut dérivé.
7. **Retard (ADR-020)** : `isOverdue = due_date < aujourd'hui (fuseau de l'utilisateur) ET balance > 0 ET statut ∉ {DRAFT, PAID, CANCELLED}`. Jamais stocké. Priorité d'affichage : `Annulée` > `Payée` > `En retard` > `Partiellement payée` > `Émise`.
8. **Paiement existant** : une facture ne crée jamais une seconde transaction pour un paiement déjà enregistré ; l'encaissement en une étape est idempotent (même `Idempotency-Key` → même résultat, Annexe A.1 point 10).
9. **Annulation** : uniquement `ISSUED` sans imputation active ; motif obligatoire ; numéro conservé (pas de réutilisation) ; audit avec avant/après. Une facture `PAID` ne s'annule pas directement : désimputer d'abord (audité).
10. **Annulation d'une transaction imputée** (côté finance) : l'imputation reste en historique mais ne compte plus ; le statut de la facture est recalculé ; notification.
11. **Clients** : archivage sans perte d'historique ; suppression refusée si historique ; `client_snapshot` garantit que la facture émise affiche le client tel qu'il était.
12. **Données personnelles** : les listes ne renvoient pas `address`, `notes` par défaut (champs de fiche uniquement).
13. **PDF** : généré côté serveur à partir des données figées (bibliothèque sans navigateur headless de préférence, ex. `pdfmake` ; aucun HTML utilisateur interprété) ; mention « Document non certifié fiscalement » paramétrable.
14. **Avoir** : hors périmètre. Toute correction d'une facture émise = annulation (si non payée) puis nouvelle facture. Écart à signaler au propriétaire (ADR à créer si besoin).
15. **Module désactivé** : les données restent, les transactions déjà imputées restent visibles côté finance avec la mention de la facture.
16. Audit : création/émission/annulation de facture, imputation/désimputation, changement de statut de contrat, archivage client.

## 8. Tests exigés
- **Unitaires (100 % de couverture du domaine facture)** : calcul de ligne et arrondi half-up (XOF exposant 0, EUR exposant 2), quantités décimales, taux 0 et 18 %, cas FIN-xx de `FINANCE_RULES.md` ; transitions de statut ; dérivation du retard en `Africa/Dakar`, `Europe/Paris`, `America/New_York` autour de minuit.
- **Propriétés (fast-check)** : pour toute suite d'imputations/désimputations, `0 ≤ paid ≤ total`, statut stocké = statut dérivé, Σ imputations d'une transaction ≤ son montant.
- **Intégration** : numérotation concurrente (20 émissions parallèles → 20 numéros distincts et contigus) ; encaissement en une étape atomique (échec de l'imputation → aucune transaction créée) ; idempotence ; refus de devise différente ; recalcul après annulation de transaction ; `projects.client_id` refusant un client d'un autre utilisateur (FK composite).
- **Isolation entre utilisateurs** : test généré pour chaque route `/pro/*` ; imputation d'une transaction de B sur une facture de A → 404 ; contact de B lié à un client de A → 404.
- **Sécurité** : modification d'une facture émise refusée ; module désactivé → 403 ; aucun total client pris en compte ; PDF ne contenant aucun champ d'un autre utilisateur.
- **E2E** : scénario Annexe A.1 complet (client → projet lié → facture → émission → deux paiements partiels → payée → dashboard mis à jour) ; facture en retard affichée comme telle ; annulation avec motif.

## 9. Découpage en tâches
| # | Tâche | Dépend de |
|---|---|---|
| T1 | Migration `clients`, `contacts`, `client_contacts`, `projects.client_id`. | — |
| T2 | Services et routes clients/contacts, archivage, garde de module (`ModuleEnabledGuard`). | T1 |
| T3 | Contrats : migration, service, routes, historique de statut audité. | T1 |
| T4 | Domaine facture pur (calcul de ligne, totaux, statuts, retard) dans `packages/money` + domaine finance, tests d'abord. | — |
| T5 | Migration `invoices`, `invoice_items`, `invoice_sequences` ; CRUD brouillon. | T1, T4 |
| T6 | Émission : séquence verrouillée, gel, `client_snapshot`, rappels de relance. | T5 |
| T7 | Migration `invoice_payments` ; imputation d'une transaction existante sous verrou. | T6 |
| T8 | Encaissement en une étape (création `INCOME` + imputation, idempotence). | T7 |
| T9 | Désimputation, annulation de facture, abonnement à l'événement « transaction annulée ». | T7 |
| T10 | Génération PDF. | T6 |
| T11 | Tests de propriétés, concurrence, isolation, sécurité. | T8, T9 |
| T12 | Front : clients, contacts, fiche client avec chronologie. | T2, T3 |
| T13 | Front : éditeur de facture, détail, paiements, annulation, PDF ; champ client du projet. | T8, T9, T10 |
| T14 | Extensions dashboard, recherche, export, agenda ; bascule du module dans Paramètres. | T8 |
| T15 | E2E Annexe A.1 + rapport de phase. | T12, T13, T14 |

## 10. Agents ECC à mobiliser
- `tdd-guide` : T4, T7, T8 (tests financiers d'abord).
- `database-reviewer` : migrations, verrous, contraintes, index uniques partiels.
- `security-reviewer` : imputation, PDF, garde de module.
- `typescript-reviewer`, `code-reviewer` : chaque tâche.
- `react-reviewer`, `a11y-architect` : éditeur de facture.
- `e2e-runner` : T15.

## 11. Definition of Done
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` respectée.
- [ ] Couverture 100 % du domaine facture et de `packages/money`.
- [ ] Tous les cas FIN-xx de la section Factures de `FINANCE_RULES.md` passent.
- [ ] Numérotation concurrente prouvée sans doublon ni trou.
- [ ] Aucune facture émise modifiable ; annulation auditée.
- [ ] Retard jamais stocké ; invariant statut stocké = statut dérivé vérifié.
- [ ] Module Pro désactivable sans perte de données.
- [ ] Tests d'isolation verts pour toutes les routes nouvelles.
- [ ] Scénario E2E Annexe A.1 vert sur staging.
- [ ] ADR-030 respectée : aucune colonne `transactions.invoice_id`.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-10-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`), en précisant le format de numérotation retenu, la bibliothèque PDF et la position sur les avoirs.
