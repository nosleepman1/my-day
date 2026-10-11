# PHASE-15 : Automatisations

- **Statut :** À faire
- **Dépend de :** PHASE-04, PHASE-05, PHASE-08, PHASE-09, PHASE-10, PHASE-12, PHASE-14
- **Accès :** Tous
- **Estimation :** 7 à 9 jours effectifs

## 1. Objectif
Permettre à chaque utilisateur de définir des règles « quand… si… alors… » (déclencheur, conditions, actions en liste blanche) exécutées de façon fiable par le worker, avec ses seuls droits, idempotentes, aux retries bornés et traçables, sans jamais écrire de mouvement financier sans sa confirmation.

## 2. Contexte à charger
1. `AGENTS.md`, `DECISIONS.md` (ADR-007, ADR-009, ADR-012, ADR-018), `PRODUCT_SCOPE.md` §4 (M14).
2. `docs/progress/PHASE-14-REPORT.md`.
3. `ARCHITECTURE.md` : worker, `JobQueue`, outbox, événements de domaine.
4. `DATA_MODEL.md` : sections `automation_rules`, `automation_runs`, `outbox_events`, `transactions` (statut en attente), `idempotency_keys`.
5. `FINANCE_RULES.md` : transactions en attente de confirmation (non comptées dans les soldes).
6. `SECURITY.md` : exécution pour le compte de l'utilisateur, absence de requêtes sortantes arbitraires, contenu de gabarits.
7. `API.md`, `FRONTEND.md`, `DESIGN_SYSTEM.md` (éditeur de règles).
8. `TESTING.md` : tests du worker, horloge simulée.
9. `PRODUCT_SPEC.md` §4.22 (pour mémoire).

## 3. Périmètre
### Inclus
- **Règles** : nom, description, déclencheur, conditions, actions (1 à 5), actif/inactif, version, date de dernière modification.
- **Déclencheurs** :
  - `SCHEDULE` (cron, intervalle ≥ 15 min, fuseau de l'utilisateur) ;
  - `DATE_TIME` (une fois) ;
  - `DUE_APPROACHING` (tâche, dette, facture, domaine, serveur, abonnement à N jours de l'échéance) ;
  - `ENTITY_EVENT` (événements de domaine publiés par l'outbox : `task.created`, `task.completed`, `idea.created`, `transaction.validated`, `invoice.issued`, `invoice.paid`, `debt.repayment_recorded`, …, liste blanche dans `ARCHITECTURE.md`) ;
  - `WEBHOOK_RECEIVED` (webhook générique de PHASE-14, par intégration) ;
  - `CALENDAR_EVENT` (événement qui commence dans N minutes ou créé) ;
  - `MANUAL`.
- **Conditions** : arbre limité (`all`/`any`, profondeur ≤ 3, 10 comparaisons max) sur les champs exposés de la charge du déclencheur ; opérateurs `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`, `exists` ; aucune expression évaluée.
- **Actions (liste blanche)** : `CREATE_TASK`, `CREATE_REMINDER`, `SEND_NOTIFICATION` (à soi-même : in-app, e-mail, push), `CREATE_IDEA`, `CREATE_NOTE`, `CREATE_EMAIL_DRAFT` (Gmail, PHASE-14), `CREATE_CALENDAR_EVENT` (interne ou Google cible), `PROPOSE_TRANSACTION` (transaction en attente de confirmation).
- **Exécution** : worker BullMQ, contexte de l'utilisateur propriétaire, idempotence par exécution et par action, retries bornés avec backoff, dead-letter, timeouts, historique des exécutions.
- **Exécution manuelle et simulation** (`dryRun`) : évalue conditions et actions sans effet.
- Notifications « automatisation échouée » ; extensions dashboard (dernières exécutions, échecs), export (règles en JSON).

### Exclu (et phase où ces éléments seront traités)
- Action `PRODUCE_SUMMARY` (résumé par IA) : ajoutée en PHASE-16, derrière la même liste blanche.
- Requêtes HTTP sortantes vers des URL arbitraires : **jamais** (SSRF) ; l'orchestration externe passe par n8n qui appelle ORBIT.
- Actions destructives (suppression, archivage en masse) : non proposées.
- Création de transaction **validée** : jamais par automatisation.

## 4. Modèle de données
Migration : `phase15_automations`. Détail : `DATA_MODEL.md`.

| Table | Action | Points clés |
|---|---|---|
| `automation_rules` | création | `user_id`, `name`, `description`, `trigger_type`, `trigger_config` (JSONB, union discriminée Zod), `conditions` (JSONB), `actions` (JSONB, tableau 1–5), `is_enabled`, `version` (INT, incrémenté à chaque modification), `next_run_at` (pour `SCHEDULE`/`DATE_TIME`), `last_run_at`, `consecutive_failures`, `disabled_reason`, timestamps, `deleted_at`. Index `(user_id, is_enabled)`, `(next_run_at) WHERE is_enabled`, GIN sur `trigger_config` pour la correspondance d'événements. |
| `automation_runs` | création | `user_id`, `automation_rule_id`, `rule_version`, `trigger_type`, `trigger_ref` (identifiant de l'événement outbox, du webhook ou de l'occurrence planifiée), `idempotency_key` (unique `(automation_rule_id, idempotency_key)`), `status` (`QUEUED`, `RUNNING`, `SUCCEEDED`, `PARTIAL`, `FAILED`, `DEAD_LETTER`, `SKIPPED`, `CANCELLED`), `is_dry_run`, `attempt_count`, `started_at`, `finished_at`, `step_results` (JSONB : par action, statut, code d'erreur, identifiant de l'entité créée), `result_summary`, `error_code`, `chain_depth`. Purge des exécutions réussies après 90 jours. |
| `transactions` | aucune modification | Le statut `PENDING` de PHASE-05 (`FINANCE_RULES.md`) est utilisé par `PROPOSE_TRANSACTION` : non compté dans le solde réalisé, validé explicitement par `POST /finance/transactions/:id/validate`. |

## 5. API
Routes sous `/api/v1`, session requise.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET/POST | `/automations` | Tous | Liste / création (validation complète du déclencheur, des conditions et des actions). |
| GET/PATCH/DELETE | `/automations/:id` | Tous | `PATCH` incrémente `version` ; `DELETE` = suppression logique (et annulation des exécutions en file). |
| POST | `/automations/:id/enable`, `/disable` | Tous | Activation / désactivation. |
| POST | `/automations/:id/run` | Tous | Exécution manuelle `{ dryRun?: boolean, sample?: object }` ; 10 / heure par règle. |
| GET | `/automations/:id/runs` | Tous | Historique paginé. |
| GET | `/automations/runs/:runId` | Tous | Détail d'une exécution (résultats par action). |
| POST | `/automations/runs/:runId/retry` | Tous | Relance manuelle d'une exécution `FAILED`/`DEAD_LETTER` (même clé d'idempotence par action). |
| GET | `/automations/catalog` | Tous | Déclencheurs, champs disponibles, actions et leurs schémas (générés depuis `packages/contracts`). |
| GET | `/finance/transactions?status=PENDING` | Tous | (Existant, filtré) Propositions à confirmer ; confirmation et rejet par les routes de PHASE-05. |

## 6. Frontend
- **Routes :** `/automations`, `/automations/new`, `/automations/:id`, `/automations/:id/runs`, `/automations/runs/:runId`.
- **Composants :** `RuleBuilder` en trois blocs (Quand / Si / Alors) piloté par le catalogue, `ConditionTree` (ajout de groupes ET/OU, profondeur limitée), `ActionList` (réordonnable, 5 max), `TemplateField` (variables insérables `{{trigger.title}}` depuis une liste, pas de saisie libre de code), `DryRunPanel` (résultat simulé), `RunTimeline`, `RunStatusBadge`, `PendingTransactionsInbox` (encart sur le dashboard finance : confirmer / modifier / rejeter).
- Modèles prêts à l'emploi : « Tâche de relance 3 jours après l'échéance d'une facture », « Rappel J-7 avant renouvellement de domaine », « Note à partir d'un webhook n8n ».
- **États obligatoires** : chargement, vide (avec modèles), erreur de validation par champ, règle désactivée automatiquement (raison affichée), exécution en cours, échec avec relance.

## 7. Règles métier et cas limites
1. **Droits du propriétaire (ADR-007)** : chaque job porte `{ userId, ruleId, runId }` ; le worker rejoue le contexte CLS avec `userId` = propriétaire de la règle et exécute chaque action **via les services applicatifs existants** (mêmes validations, `tenantScope`, quotas) ; aucune action n'utilise le SQL brut ni ne contourne un guard. Une règle ne peut référencer que des entités de son propriétaire (vérifié à l'enregistrement **et** à l'exécution).
2. **Idempotence** : clé d'exécution = `hash(ruleId, version, trigger_ref)` (un même événement ne déclenche la règle qu'une fois) ; clé d'action = `runId + index` transmise à `idempotency_keys` ; une relance ne recrée jamais une entité déjà créée.
3. **Retries bornés** : 3 tentatives max, backoff exponentiel (30 s, 2 min, 10 min) **uniquement** pour les erreurs transitoires (timeout, 5xx d'intégration, verrou) ; erreurs de validation ou de droit → `FAILED` immédiat. Après épuisement : `DEAD_LETTER` (file BullMQ dédiée + statut), notification « automatisation échouée ».
4. **Timeouts** : 30 s par action d'intégration (Gmail, Google Calendar), 120 s par exécution.
5. **Désactivation automatique** : 5 échecs consécutifs → `is_enabled = false`, `disabled_reason`, notification.
6. **Politique de désactivation** (§4.22) : une règle désactivée ne lance plus aucune nouvelle exécution ; les exécutions `QUEUED` passent à `SKIPPED` au démarrage ; une exécution `RUNNING` termine l'action en cours puis s'arrête avant la suivante (`PARTIAL`).
7. **Version** : l'exécution utilise la version de la règle **au moment du déclenchement** (copie figée dans le job) ; `rule_version` est enregistrée.
8. **Boucles** : les entités créées par une automatisation portent `origin = automation:<ruleId>` ; les événements qu'elles produisent incrémentent `chain_depth` ; profondeur maximale 2, au-delà `SKIPPED` ; une règle ne se redéclenche jamais sur ses propres effets.
9. **Limites** : 50 règles actives par utilisateur, 500 exécutions / jour par utilisateur, 60 / heure par règle (quotas affinés en PHASE-17 via `usage_counters`).
10. **Actions financières** : `PROPOSE_TRANSACTION` crée une transaction **en attente de confirmation**, exclue des soldes et des rapports réalisés, visible dans la boîte des propositions ; la confirmation (ou le rejet) est un acte explicite de l'utilisateur dans l'application, audité. Aucune autre action ne touche aux finances.
11. **Gabarits** : substitution de variables uniquement (pas de logique), valeurs échappées selon le contexte (texte brut), longueur bornée ; les données provenant de webhooks sont non fiables.
12. **Planification** : cron évalué dans le fuseau de l'utilisateur (ADR-023) ; occurrences manquées pendant une indisponibilité → une seule exécution de rattrapage, marquée comme telle.
13. **Erreurs** : codes stables, aucun secret ni contenu de payload dans `error_code`/`result_summary`.
14. Audit : création, modification, activation/désactivation, suppression de règle ; exécutions ayant créé une proposition financière.

## 8. Tests exigés
- **Unitaires** : validation Zod de chaque déclencheur, condition et action ; évaluateur de conditions (profondeur, types, champs inexistants) ; rendu de gabarits (échappement) ; calcul des clés d'idempotence ; prochaine exécution cron dans trois fuseaux (DST).
- **Intégration (worker réel + Redis + Testcontainers)** : événement outbox → exécution unique même si l'événement est livré deux fois ; retries avec backoff (horloge simulée) puis `DEAD_LETTER` ; désactivation pendant une exécution (`PARTIAL`, `SKIPPED`) ; prévention de boucle ; `PROPOSE_TRANSACTION` n'affecte aucun solde jusqu'à confirmation ; relance manuelle sans doublon d'entité.
- **Sécurité** : règle référençant une entité d'un autre utilisateur → refus à l'enregistrement et à l'exécution ; contexte CLS absent dans le worker → erreur (pas d'exécution) ; aucune action ne déclenche de requête sortante non prévue (test d'architecture) ; payload de webhook malveillant (gabarit, HTML) inoffensif.
- **Isolation entre utilisateurs** : test généré pour chaque route ; un événement de A ne déclenche jamais une règle de B.
- **E2E** : créer une règle « facture en retard → tâche de relance », simuler le déclencheur, voir la tâche ; règle `PROPOSE_TRANSACTION` → proposition confirmée → solde mis à jour.

## 9. Découpage en tâches
| # | Tâche | Dépend de |
|---|---|---|
| T1 | Migration + schémas Zod (déclencheurs, conditions, actions) + catalogue. | — |
| T2 | Évaluateur de conditions et moteur de gabarits (tests d'abord). | T1 |
| T3 | CRUD des règles, versionnement, activation, validation de propriété des références. | T1 |
| T4 | Exécuteur : job, contexte CLS, idempotence, résultats par action, timeouts. | T2, T3 |
| T5 | Adaptateurs d'actions sur les services existants (tâche, rappel, notification, idée, note, événement, brouillon Gmail). | T4 |
| T6 | `PROPOSE_TRANSACTION` (transaction `PENDING`) + boîte de propositions. | T4 |
| T7 | Déclencheurs `ENTITY_EVENT` et `WEBHOOK_RECEIVED` (abonnement à l'outbox). | T4 |
| T8 | Déclencheurs `SCHEDULE`, `DATE_TIME`, `DUE_APPROACHING`, `CALENDAR_EVENT` (planificateur, rattrapage). | T4 |
| T9 | Retries, dead-letter, désactivation automatique, prévention des boucles, limites. | T4 |
| T10 | Tests d'intégration du worker, sécurité, isolation. | T5–T9 |
| T11 | Front : liste, `RuleBuilder`, simulation, modèles. | T3 |
| T12 | Front : historique des exécutions, relance, boîte des propositions financières. | T6, T9 |
| T13 | Extensions dashboard et export ; E2E ; rapport. | T10, T11, T12 |

## 10. Agents ECC à mobiliser
- `tdd-guide` : T2, T4, T9.
- `security-reviewer` : exécution pour le compte de l'utilisateur, gabarits, actions financières.
- `silent-failure-hunter` : retries et dead-letter.
- `typescript-reviewer`, `code-reviewer`, `database-reviewer`.
- `react-reviewer`, `a11y-architect` : `RuleBuilder`.
- `e2e-runner` : T13.

## 11. Definition of Done
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` respectée.
- [ ] Liste blanche d'actions appliquée ; aucune requête sortante arbitraire.
- [ ] Idempotence prouvée (double livraison, relance) ; retries bornés ; dead-letter opérationnelle.
- [ ] Aucune écriture financière validée par automatisation ; propositions confirmées par l'utilisateur.
- [ ] Politique de désactivation implémentée et testée.
- [ ] Tests d'isolation verts pour toutes les nouvelles routes.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-15-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`), en listant les événements de domaine exposés, le statut de transaction utilisé pour les propositions et les limites retenues.
