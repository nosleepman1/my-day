# PHASE-12 : Zone Dev, inventaire technique

- **Statut :** À faire
- **Dépend de :** PHASE-04, PHASE-05, PHASE-06, PHASE-07, PHASE-08, PHASE-09, PHASE-10
- **Accès :** ADMIN
- **Estimation :** 7 à 9 jours effectifs

## 1. Objectif
Offrir au propriétaire de la plateforme (ADMIN) un inventaire technique complet — applications, environnements, domaines, serveurs, services et abonnements — relié par des liaisons explicites, avec un historique technique, des alertes de renouvellement fiables et des coûts réellement payés tracés dans le registre financier.

## 2. Contexte à charger
1. `AGENTS.md`, `DECISIONS.md` (ADR-002, ADR-007, ADR-008, ADR-009, ADR-018, ADR-023), `PRODUCT_SCOPE.md` §3 et §4 (M11).
2. `docs/progress/PHASE-11-REPORT.md`.
3. `DATA_MODEL.md` : sections `applications`, `application_environments`, `domains`, `servers`, `service_subscriptions`, `environment_domains`, `environment_servers`, `environment_subscriptions`, `technical_events`, `reminders`, `recurring_transactions`, `transactions`, `document_links`.
4. `FINANCE_RULES.md` : dépenses, prévisions vs réalisé (récurrences), cas FIN-xx des récurrences.
5. `SECURITY.md` : SSRF, rôles et guard `@Roles('ADMIN')`, données sensibles (IP, hostnames).
6. `API.md` : préfixe `/dev`, erreurs 403 de rôle.
7. `FRONTEND.md` : routes protégées par rôle ; `DESIGN_SYSTEM.md`.
8. `PRODUCT_SPEC.md` §4.6, §4.7, Annexe A.2 et A.4 (pour mémoire).

## 3. Périmètre
### Inclus
- **Applications** : nom, description, projet lié, client lié (si module Pro), dépôt Git, documentation, statut, technologies (tags), date de mise en production, notes de déploiement.
- **Environnements** : type (`DEVELOPMENT`, `STAGING`, `PRODUCTION`, `CUSTOM`), nom, URL de base, statut (`ACTIVE`, `STOPPED`, `RETIRED`), dernier déploiement, notes ; les environnements arrêtés restent visibles.
- **Domaines** : registrar, dates d'enregistrement et d'expiration, renouvellement automatique **déclaré** et date de confirmation, coût annuel prévu, DNS (notes), statut.
- **Serveurs** : fournisseur, identifiant fournisseur, nom, hostname, IP, région, OS, CPU/RAM/stockage, coût prévu et période, prochaine échéance, statut, procédures de sauvegarde et de restauration.
- **Services et abonnements** : fournisseur, service, catégorie, périodicité, montant prévu, devise, prochaine échéance, statut, lien facultatif vers une récurrence financière (prévision).
- **Liaisons explicites** : `environment_domains`, `environment_servers`, `environment_subscriptions` avec rôle.
- **Historique technique** : déploiement, migration, incident, renouvellement, sauvegarde vérifiée, changement de configuration, intervention, avec résultat.
- **Renouvellement** : action dédiée qui met à jour l'échéance, écrit l'événement technique et, si payé, crée ou relie la transaction `EXPENSE`.
- **Alertes** de renouvellement via `reminders` (J-30, J-7, J-1 par défaut, configurables par ressource).
- Extensions : dashboard ADMIN (échéances à 30 jours, coûts techniques réalisés du mois), recherche (applications, domaines, serveurs par nom — jamais par IP), export (JSON de l'inventaire), agenda (échéances).

### Exclu (et phase où ces éléments seront traités)
- Coffre-fort et lien d'un secret vers une ressource : PHASE-13.
- Vérification de disponibilité, ping, récupération de certificats, appels aux API des fournisseurs : **jamais** (risque SSRF, voir §7).
- Import automatique depuis un registrar ou un cloud : non retenu.
- Automatisations sur événements techniques : PHASE-15.

## 4. Modèle de données
Migration : `phase12_dev_inventory`. Détail : `DATA_MODEL.md`. Toutes les tables portent `user_id` (= l'ADMIN propriétaire, ADR-002) et des FK composites.

| Table | Action | Points clés |
|---|---|---|
| `applications` | création | `project_id` nullable, `client_id` nullable, `name` (unique par utilisateur), `description`, `repository_url`, `documentation_url`, `status` (`IDEA`, `IN_DEVELOPMENT`, `LIVE`, `MAINTENANCE`, `RETIRED`), `technologies` (`text[]`), `launched_at`, `deployment_notes`, timestamps, `archived_at`. |
| `application_environments` | création | `application_id`, `kind`, `name` (unique par application), `base_url`, `status`, `last_deployed_at`, `notes`. |
| `domains` | création | `name` (FQDN normalisé en minuscules, IDN en punycode ; unique par utilisateur), `registrar`, `registered_on`, `expires_on` (`date`), `auto_renew_declared` (bool), `auto_renew_confirmed_at` nullable, `expected_cost_minor`, `currency`, `dns_notes`, `status` (`ACTIVE`, `EXPIRING`, `EXPIRED`, `TRANSFERRED`, `RELEASED`), `reminder_offsets_days` (`smallint[]`, défaut `{30,7,1}`). |
| `servers` | création | `provider`, `provider_resource_id`, `name`, `hostname`, `ip_address` (`inet`), `region`, `operating_system`, `cpu_cores`, `ram_mb`, `storage_gb`, `expected_cost_minor`, `currency`, `billing_period` (`MONTHLY`, `YEARLY`, …), `next_renewal_on`, `status`, `backup_procedure`, `restore_procedure`, `reminder_offsets_days`. |
| `service_subscriptions` | création | `provider`, `service_name`, `category`, `billing_period`, `expected_amount_minor`, `currency`, `next_billing_on`, `status`, `recurring_transaction_id` nullable (prévision PHASE-06), `notes`, `reminder_offsets_days`. |
| `environment_domains` | création | `environment_id`, `domain_id`, `role` (`PRIMARY`, `ALIAS`, `API`, `OTHER`). PK `(environment_id, domain_id)`. |
| `environment_servers` | création | `environment_id`, `server_id`, `role` (`APP`, `DATABASE`, `WORKER`, `PROXY`, `OTHER`). |
| `environment_subscriptions` | création | `environment_id`, `service_subscription_id`, `role`. |
| `technical_events` | création | `event_type`, `occurred_at`, `title`, `description`, `outcome` (`SUCCESS`, `FAILURE`, `PARTIAL`, `INFO`), FK nullables `application_id`, `environment_id`, `domain_id`, `server_id`, `service_subscription_id` avec `CHECK num_nonnulls(...) = 1`, `transaction_id` nullable (coût réellement payé). Immuable (pas d'`UPDATE` sauf `description`, audité). |
| `reminders` | modification | Ajout `domain_id`, `server_id`, `service_subscription_id` + mise à jour du `CHECK`. |
| `document_links` | modification | Ajout `application_id`, `server_id`, `domain_id` + mise à jour du `CHECK`. |

Choix de conception : le lien coût ↔ ressource passe par `technical_events.transaction_id` (événement `RENEWAL` ou `PAYMENT`), ce qui évite d'ajouter des colonnes de ressource dans `transactions`. Le coût **prévu** reste dans la ressource ou la récurrence ; le coût **réalisé** = somme des transactions validées liées par les événements techniques.

## 5. API
Routes sous `/api/v1/dev`, protégées par `@Roles('ADMIN')` : un `USER` reçoit **403** (code `FORBIDDEN_ROLE`), événement audité. Les données restent scopées par `user_id` de l'ADMIN.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET/POST | `/dev/applications` | ADMIN | Liste / création. |
| GET/PATCH/DELETE | `/dev/applications/:id` | ADMIN | Détail (avec environnements et ressources liées) / modification / archivage. |
| GET/POST | `/dev/environments` | ADMIN | Filtre `applicationId`. |
| GET/PATCH/DELETE | `/dev/environments/:id` | ADMIN | |
| PUT/DELETE | `/dev/environments/:id/domains/:domainId` | ADMIN | Liaison `{ role }`. |
| PUT/DELETE | `/dev/environments/:id/servers/:serverId` | ADMIN | |
| PUT/DELETE | `/dev/environments/:id/subscriptions/:subscriptionId` | ADMIN | |
| GET/POST | `/dev/domains` | ADMIN | Filtre `expiringWithinDays`. |
| GET/PATCH/DELETE | `/dev/domains/:id` | ADMIN | |
| POST | `/dev/domains/:id/renew` | ADMIN | `{ newExpiresOn, payment?: { transactionId } \| { accountId, amount, date, categoryId? } }` + `Idempotency-Key`. |
| GET/POST | `/dev/servers` | ADMIN | |
| GET/PATCH/DELETE | `/dev/servers/:id` | ADMIN | |
| POST | `/dev/servers/:id/renew` | ADMIN | Même contrat que pour les domaines. |
| GET/POST | `/dev/services` | ADMIN | Services et abonnements. |
| GET/PATCH/DELETE | `/dev/services/:id` | ADMIN | |
| POST | `/dev/services/:id/renew` | ADMIN | Même contrat. |
| GET/POST | `/dev/technical-events` | ADMIN | Historique filtrable par ressource, type, période. |
| GET/PATCH | `/dev/technical-events/:id` | ADMIN | `PATCH` limité à `description`. |
| GET | `/dev/costs?from&to&currency` | ADMIN | Coûts prévus vs réalisés par ressource, sans mélange de devises. |

## 6. Frontend
- **Routes** (masquées et protégées pour un `USER`, redirection 403 côté client) : `/dev`, `/dev/applications`, `/dev/applications/:id`, `/dev/domains`, `/dev/servers`, `/dev/services`, `/dev/history`, `/dev/costs`.
- **Composants :** `ApplicationCard` (environnements et ressources liées), `EnvironmentResourceLinker`, `ExpiryBadge` (J-30 orange, J-7 rouge, expiré), `RenewDialog` (nouvelle échéance + paiement : transaction existante ou nouvelle dépense), `TechnicalTimeline`, `CostTable` (prévu / réalisé, par devise), `SafeExternalLink` (texte de l'URL visible, `rel="noopener noreferrer nofollow"`, `target="_blank"`, pas d'aperçu).
- IP et hostnames masqués par défaut dans les listes (affichage au clic).
- **États obligatoires** : chargement, vide, erreur, interdit (rôle), hors ligne (lecture seule).

## 7. Règles métier et cas limites
1. **Rôle (ADR-002)** : guard `@Roles('ADMIN')` sur le contrôleur entier + test automatique qui vérifie que **chaque** route `/dev/*` exige ce rôle. Un `ADMIN` ne voit que ses propres ressources ; aucune donnée d'un autre utilisateur.
2. **SSRF (SECURITY.md)** : les URL (`repository_url`, `documentation_url`, `base_url`) sont validées (`http`/`https` seulement, longueur ≤ 2 048, pas d'identifiants dans l'URL) et **jamais récupérées par le serveur** : aucun client HTTP n'est importé dans le module `dev` (règle de lint `no-restricted-imports` + test d'architecture). Le front ne les rend que comme liens textuels.
3. **Renouvellement automatique** : jamais affiché « actif » sans `auto_renew_confirmed_at` ; libellé « déclaré, non confirmé » sinon (§4.7 du cahier).
4. **Statut dérivé d'expiration** : `EXPIRING` si `expires_on` ≤ aujourd'hui + 30 j, `EXPIRED` si dépassé (dérivés à la lecture, à l'image d'ADR-020 ; les statuts stockés couvrent seulement les états déclarés : `ACTIVE`, `TRANSFERRED`, `RELEASED`).
5. **Rappels (Annexe A.4)** : à chaque création ou modification d'échéance, les rappels `PENDING` de la ressource sont remplacés de façon idempotente (clé `ressource + échéance + décalage`) ; un rappel n'est envoyé qu'une fois ; une échéance passée pendant une indisponibilité déclenche un seul rappel de rattrapage (règle de PHASE-08).
6. **Renouvellement** dans une transaction SQL unique : mise à jour de l'échéance → `technical_events` (`RENEWAL`) → si paiement : transaction `EXPENSE` validée créée via le service finance (ou transaction existante reliée, qui doit être `EXPENSE`, `VALIDATED`, appartenir à l'utilisateur) → replanification des rappels. Idempotent.
7. **Prévision vs réalisé (Annexe A.2)** : si l'abonnement est relié à une `recurring_transaction`, le renouvellement payé **confirme l'occurrence** prévue correspondante (mécanisme de PHASE-06) au lieu de créer une seconde dépense ; la dépense n'est jamais comptée deux fois.
8. **Devises** : aucun total de coûts mélangeant des devises (FINANCE_RULES.md) ; `/dev/costs` regroupe par devise.
9. **Suppression** : un domaine, serveur ou service ayant un historique technique est archivé (statut `RELEASED`/`RETIRED`), pas supprimé ; les liaisons d'environnement sont supprimées en cascade, jamais les ressources.
10. **Données sensibles** : IP et hostnames exclus de la recherche plein texte, des notifications et des logs ; inclus dans l'export de l'ADMIN uniquement.
11. **Secrets** : les champs de notes refusent les motifs ressemblant à des secrets (clé privée PEM, `AKIA…`, jetons `ghp_…`, `sk-…`) avec message « utilisez le coffre-fort » (détecteur partagé, PHASE-13 le réutilisera).
12. Audit : création, modification, archivage, renouvellement, liaisons.

## 8. Tests exigés
- **Unitaires** : validation d'URL (schémas `javascript:`, `file:`, `data:`, identifiants embarqués refusés) ; normalisation de domaine (IDN, majuscules, point final) ; statut dérivé d'expiration autour de minuit (trois fuseaux) ; détecteur de secrets dans les notes.
- **Intégration** : renouvellement atomique (échec de la transaction finance → rien n'est modifié) ; idempotence ; confirmation d'occurrence récurrente sans double dépense ; replanification des rappels sans doublon ; `CHECK num_nonnulls` de `technical_events`.
- **Rôle** : chaque route `/dev/*` appelée par un `USER` → 403 et audit (test généré à partir de la table des routes).
- **Isolation entre utilisateurs** : deux ADMIN de test (A et B) — A ne voit ni ne lie aucune ressource de B (404).
- **Sécurité** : test d'architecture prouvant l'absence d'appel réseau sortant dans le module `dev` ; XSS dans les notes neutralisé ; IP absentes des logs.
- **E2E** : scénarios Annexe A.2 (serveur, échéance, prévision, paiement réel relié, pas de double comptage) et A.4 (domaine, rappel unique, renouvellement, coût en finance, historique).

## 9. Découpage en tâches
| # | Tâche | Dépend de |
|---|---|---|
| T1 | Migration complète + contrats Zod ; guard de rôle et test « toutes les routes `/dev` exigent ADMIN ». | — |
| T2 | Applications et environnements : services, routes. | T1 |
| T3 | Domaines : service, routes, normalisation, statut dérivé. | T1 |
| T4 | Serveurs et services/abonnements : services, routes. | T1 |
| T5 | Liaisons `environment_*`. | T2, T3, T4 |
| T6 | Historique technique (immuable) + détecteur de secrets dans les notes. | T1 |
| T7 | Rappels de renouvellement idempotents (extension `reminders`). | T3, T4 |
| T8 | Action de renouvellement atomique + lien finance + confirmation d'occurrence récurrente. | T6, T7 |
| T9 | `/dev/costs` prévu vs réalisé. | T8 |
| T10 | Tests SSRF/architecture, rôle, isolation. | T2–T9 |
| T11 | Front : applications, environnements, liaisons. | T2, T5 |
| T12 | Front : domaines, serveurs, services, renouvellement, historique, coûts. | T8, T9 |
| T13 | Extensions dashboard ADMIN, recherche, export, agenda. | T8 |
| T14 | E2E A.2 et A.4 + rapport de phase. | T11, T12, T13 |

## 10. Agents ECC à mobiliser
- `tdd-guide` : T3, T8.
- `database-reviewer` : migration et liaisons.
- `security-reviewer` : obligatoire (rôle, SSRF, données sensibles).
- `typescript-reviewer`, `code-reviewer` : chaque tâche.
- `react-reviewer` : écrans Dev.
- `e2e-runner` : T14.

## 11. Definition of Done
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` respectée.
- [ ] Toutes les routes `/dev/*` exigent ADMIN (test automatique vert).
- [ ] Aucune URL récupérée par le serveur (test d'architecture vert).
- [ ] Renouvellement atomique, idempotent, sans double comptage avec les prévisions.
- [ ] Rappels de renouvellement envoyés une seule fois (test).
- [ ] Tests d'isolation verts ; scénarios A.2 et A.4 verts en E2E.
- [ ] `security-reviewer` : aucun constat CRITICAL ou HIGH ouvert.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-12-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`), en précisant le choix « coût réalisé via `technical_events.transaction_id` » et les colonnes cibles que PHASE-13 utilisera pour relier un secret à une ressource.
