# ORBIT : périmètre produit consolidé

- **Statut :** référence. Ce document complète `PRODUCT_SPEC.md` (le cahier des charges détaillé) et applique les décisions de `DECISIONS.md`.
- **Ordre de priorité en cas de conflit :** `DECISIONS.md` > `PRODUCT_SCOPE.md` > `PRODUCT_SPEC.md`.

---

## 1. Ce qu'est ORBIT

ORBIT (nom de code de « Personal OS ») est un **SaaS d'organisation personnelle**. Chaque utilisateur dispose d'un espace privé et isolé pour :

- **ses finances :** comptes (espèces, Wave, Orange Money, banque…), entrées et sorties d'argent, transferts, dettes et créances, dépenses récurrentes, rapports ;
- **ses idées**, de la capture rapide jusqu'à la conversion en projet ;
- **sa planification :** tâches, projets, calendrier, rappels, objectifs, habitudes ;
- **ses notes et documents ;**
- **ses connexions externes :** Gmail, Google Calendar, puis WhatsApp et d'autres ;
- **un assistant IA** qui propose des actions, sans jamais agir seul sur les finances ;
- **le module Pro, en option :** clients, contrats, factures.

Le propriétaire de la plateforme (rôle `ADMIN`) dispose en plus d'une **zone Dev** : inventaire technique (applications, domaines, serveurs, services), coffre-fort de secrets et console d'administration.

**Ce qu'ORBIT n'est pas :**
- un outil d'équipe, puisqu'il n'y a ni espace partagé ni invitations ;
- une banque ;
- un logiciel comptable réglementaire ;
- un gestionnaire de mots de passe certifié.

## 2. Notion de « compte financier »

Un compte est **l'endroit où se trouve l'argent**.

- **Types :** `CASH` (espèces), `MOBILE_MONEY` (Wave, Orange Money, Free Money…), `BANK`, `PAYMENT_ACCOUNT` et `OTHER`.
- **Rôle dans les transactions :**
  - une **sortie** indique le compte débité ;
  - une **entrée** indique le compte crédité ;
  - un **transfert** (par exemple un retrait Wave vers des espèces) relie deux comptes.
- **Solde :** celui de chaque compte est calculé automatiquement (voir `FINANCE_RULES.md`).
- **Abonnement :** c'est une dépense récurrente (Netflix, hébergement…) qui débite un compte. Ce n'est pas un type de compte.
- **Frais mobile money :** ce sont des dépenses séparées, liées à la transaction d'origine.

## 3. Rôles

| Rôle | Qui | Accès |
|---|---|---|
| `USER` | Tout inscrit | Tous les modules utilisateur (section 4), uniquement sur ses propres données. |
| `ADMIN` | Propriétaire de la plateforme | Modules utilisateur sur ses propres données, plus la zone Dev et la console d'administration. **Jamais** les données privées des autres utilisateurs. |

## 4. Carte des modules

Les tables listées ici sont les **noms canoniques**. `DATA_MODEL.md` les détaille et chaque fichier de phase y renvoie.

| # | Module | Accès | Phase | Tables principales |
|---|---|---|---|---|
| M01 | Identité, comptes, sessions, préférences | Tous | PHASE-01 | `users`, `sessions`, `email_verification_tokens`, `password_reset_tokens`, `user_preferences`, `login_events`, `audit_logs` |
| M02 | Shell de l'application, design system, capture rapide (shell) | Tous | PHASE-02 | — |
| M03 | Organisation : idées, tâches, projets, tags, notes | Tous | PHASE-04 | `ideas`, `projects`, `tasks`, `task_dependencies`, `tags`, `idea_tags`, `task_tags`, `project_tags`, `note_tags`, `notes`, `note_links` |
| M04 | Finance, cœur | Tous | PHASE-05 | `currencies` (globale), `financial_accounts`, `transaction_categories`, `counterparties`, `transactions`, `ledger_entries`, `idempotency_keys` |
| M05 | Dettes, créances, récurrences et prévisions | Tous | PHASE-06 | `debts`, `debt_repayments`, `recurring_transactions`, `recurring_occurrences` |
| M06 | Dashboard, recherche globale, exports | Tous | PHASE-07 | `export_jobs` |
| M07 | Traitements asynchrones, rappels, notifications | Tous | PHASE-08 | `reminders`, `notifications`, `notification_preferences`, `outbox_events`, `push_subscriptions` |
| M08 | Calendrier interne et documents | Tous | PHASE-09 | `calendar_events`, `documents`, `document_links` |
| M09 | Pro : clients, contacts, contrats, factures | Tous (désactivable) | PHASE-10 | `clients`, `contacts`, `client_contacts`, `contracts`, `invoices`, `invoice_items`, `invoice_payments`, `invoice_sequences` |
| M10 | Objectifs, habitudes, apprentissage, journal | Tous | PHASE-11 | `goals`, `goal_links`, `habits`, `habit_logs`, `learning_items`, `learning_sessions`, `journal_entries` |
| M11 | Zone Dev : inventaire technique | **ADMIN** | PHASE-12 | `applications`, `application_environments`, `domains`, `servers`, `service_subscriptions`, `environment_domains`, `environment_servers`, `environment_subscriptions`, `technical_events` |
| M12 | Coffre-fort et MFA TOTP | Coffre : **ADMIN** ; TOTP : tous | PHASE-13 | `vault_items`, `vault_secret_payloads`, `user_mfa_factors`, `mfa_recovery_codes` |
| M13 | Intégrations : Google OAuth, Calendar, Gmail, webhooks, clés d'API, n8n | Tous (ADR-032) | PHASE-14 | `integrations`, `integration_tokens`, `external_calendar_events`, `webhook_events`, `api_keys` |
| M14 | Automatisations | Tous | PHASE-15 | `automation_rules`, `automation_runs` |
| M15 | IA et capture multicanale (WhatsApp, voix) | Tous | PHASE-16 | `ai_requests`, `ai_proposals`, `inbound_messages` |
| M16 | Administration de la plateforme SaaS, quotas, suppression et export de compte, conformité | Console : **ADMIN** ; suppression et export de compte : tous | PHASE-17 | `usage_counters`, `account_deletion_requests`, `feature_flags` |

**Phases sans module métier :**
- **PHASE-00 :** socle technique.
- **PHASE-03 :** mise en production continue (staging, production, sauvegardes, observabilité).

**Évolutions prévues dans les phases suivantes :**
- `projects.client_id`, nullable, est ajouté en PHASE-10.
- L'imputation des paiements de facture, par `invoice_payments` uniquement, arrive en PHASE-10. La colonne `transactions.invoice_id` n'existe pas (ADR-030).
- `currencies` et `idempotency_keys` sont des tables de plateforme créées dès PHASE-01 (ADR-027).
- Les widgets du dashboard sont étendus par chaque phase qui ajoute un module.

## 5. Navigation cible

**Sur mobile :** une barre du bas avec Accueil, Finances, **+** (capture rapide), Tâches et Plus.

**Le menu « Plus » contient :**
- Idées
- Projets
- Notes et documents
- Calendrier
- Objectifs
- Pro
- Automatisations
- Intégrations
- Paramètres
- Pour ADMIN seulement : **Dev** (inventaire, coffre) et **Admin**.

**Sur desktop :** une barre latérale complète.

## 6. Amendements au cahier (`PRODUCT_SPEC.md`)

| Section du cahier | Amendement |
|---|---|
| §2 (workspaces, rôles) | Remplacé par ADR-001 et ADR-002 : `user_id`, rôles USER et ADMIN. |
| §3.2, §14, §18 (V1, MVP, priorités) | Remplacés par le développement intégral en 18 phases (ADR-003, `ROADMAP.md`). |
| §4.1 (MFA « avant exposition de secrets ») | MFA TOTP livrée en PHASE-13. Avant cette phase, les actions sensibles exigent une ré-authentification par mot de passe. |
| §4.4 et §4.12 | Fusionnés dans `FINANCE_RULES.md` (factures). |
| §5 (modèle) | Remplacé par `DATA_MODEL.md` (ledger, liens explicites, `user_id`, montants en BIGINT). |
| §7.1 (Fastify) | Remplacé par Express (ADR-005). |
| §7.1 (Redis dès le départ) | Introduit en PHASE-08 (ADR-012). |
| §16 (routes `/workspaces`, `/auth/refresh`) | Supprimées. Les routes sont scopées par la session (`API.md`). |
| §19 (première mission) | Réalisée par l'ensemble documentaire `docs/`. |
