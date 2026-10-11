# PHASE-17 : Administration SaaS, conformité et ouverture publique

- **Statut :** À faire
- **Dépend de :** PHASE-00 à PHASE-16 (toutes)
- **Accès :** Console : ADMIN ; export et suppression de compte : Tous
- **Estimation :** 9 à 11 jours effectifs (hors délais externes : juriste, CDP, vérifications Google et Meta)

## 1. Objectif
Rendre ORBIT exploitable comme SaaS public : console d'administration limitée aux métadonnées, quotas et drapeaux de fonctionnalité, suspension de compte, export complet et suppression définitive par l'utilisateur, réévaluation de la RLS, revue de sécurité globale et mise en conformité avec la loi sénégalaise n° 2008-12 sur les données personnelles, avant l'ouverture des inscriptions au public.

## 2. Contexte à charger
1. `AGENTS.md`, `DECISIONS.md` (ADR-001, ADR-002, ADR-006, ADR-007, ADR-013, ADR-015, ADR-019, ADR-025, hypothèse H2), `PRODUCT_SCOPE.md` §3 et §4 (M16).
2. `docs/progress/PHASE-16-REPORT.md` et la liste de tous les rapports `docs/progress/` (sections « dette » et « points ouverts »).
3. `SECURITY.md` (en entier), `INFRASTRUCTURE.md` (sauvegardes, rétention, restauration, observabilité).
4. `DATA_MODEL.md` : sections `usage_counters`, `account_deletion_requests`, `feature_flags`, `users`, `export_jobs`, et l'ordre de dépendance des tables.
5. `API.md` : routes `/admin/*`, `/me/export`, `/me/delete`, codes `QUOTA_EXCEEDED`, `ACCOUNT_SUSPENDED`.
6. `INTEGRATIONS.md` : révocations (Google, WhatsApp).
7. `TESTING.md` : tests de sécurité, charge.
8. `PRODUCT_SPEC.md` §4.24, §4.25, §8, §9.1 (pour mémoire).

## 3. Périmètre
### Inclus
- **Console ADMIN** : liste des comptes (e-mail, date d'inscription, statut, dernière connexion, volumétrie agrégée : nombre d'entités par module, octets stockés, requêtes IA du mois), métriques plateforme (inscriptions, actifs 7/30 j, files de jobs, erreurs, stockage, coûts IA agrégés), journal des actions d'administration. **Aucune donnée privée**, aucune impersonation.
- **Suspension** de compte (et levée) avec motif.
- **Quotas** et `usage_counters` : stockage, documents, requêtes IA, jetons IA, exécutions d'automatisation, webhooks, requêtes par clé d'API ; limites par défaut configurables, dérogations par utilisateur.
- **Drapeaux de fonctionnalité** (`feature_flags`) : globaux et par utilisateur (ex. `registration_open`, `gmail_enabled`, `whatsapp_enabled`, `ai_enabled_global`).
- **Export complet** du compte par l'utilisateur (archive ZIP).
- **Suppression du compte** par l'utilisateur : ré-authentification, délai de grâce, effacement complet y compris documents et objets stockés, révocations externes, politique sur les sauvegardes.
- **Réévaluation de la RLS PostgreSQL** (ADR-007 §6) : prototype, mesure, décision par ADR.
- **Revue de sécurité globale** et tests de charge.
- **Conformité loi n° 2008-12 du 25 janvier 2008 / CDP** : registre des traitements, mentions d'information, CGU, politique de confidentialité, procédure d'exercice des droits, procédure de violation de données, formalités auprès de la Commission de protection des données personnelles (CDP) — **à faire valider par un juriste**.
- **Ouverture publique** : liste de contrôle de lancement et bascule `registration_open`.

### Exclu (et phase où ces éléments seront traités)
- Abonnements payants et facturation SaaS (Wave, Stripe) : hors périmètre (hypothèse H2) ; nécessiterait une phase supplémentaire.
- Impersonation ou accès « support » aux données d'un utilisateur : **jamais** (ADR-002).
- Import de données depuis d'autres outils : non retenu ici (§4.25 du cahier : à planifier par ADR si souhaité).

## 4. Modèle de données
Migration : `phase17_saas_admin_compliance`. Détail : `DATA_MODEL.md`.

| Table | Action | Points clés |
|---|---|---|
| `usage_counters` | création | `user_id`, `metric` (`STORAGE_BYTES`, `DOCUMENTS`, `AI_REQUESTS`, `AI_TOKENS`, `AUTOMATION_RUNS`, `WEBHOOK_EVENTS`, `API_REQUESTS`), `period` (`DAY`, `MONTH`, `LIFETIME`), `period_start` (`date`), `value` BIGINT, `limit_override` nullable, `updated_at`. Unique `(user_id, metric, period, period_start)`. Incrément atomique (`INSERT … ON CONFLICT DO UPDATE`), compteurs chauds dans Redis réconciliés toutes les heures. |
| `feature_flags` | création | `key`, `description`, `is_enabled`, `user_id` nullable (dérogation par utilisateur), `updated_by`, timestamps. Unique `(key, user_id)` (NULLS NOT DISTINCT). Table **de plateforme** : seule exception au cloisonnement, lecture par le service de drapeaux, écriture ADMIN. |
| `account_deletion_requests` | création | `user_id` (**sans FK**, pour survivre à la suppression), `email_hash`, `requested_at`, `scheduled_for` (= +14 jours), `status` (`PENDING`, `CANCELLED`, `PROCESSING`, `COMPLETED`, `FAILED`), `completed_at`, `steps` (JSONB : progression par module, pour reprise), `error_code`. Conservée après suppression : sert de liste de rejeu lors d'une restauration de sauvegarde. |
| `users` | modification | Statuts `ACTIVE`, `SUSPENDED`, `PENDING_DELETION` ; `suspended_at`, `suspension_reason` (visible par l'utilisateur), `last_login_at` (si absent). |
| `export_jobs` | modification | Type `FULL_ACCOUNT`, `expires_at` de l'archive (7 jours). |
| Politiques RLS | conditionnelle | Uniquement si l'ADR de T10 conclut à l'activation (migration séparée `phase17_rls`). |

## 5. API
Routes sous `/api/v1`. Routes `/admin/*` : `@Roles('ADMIN')`, ré-auth < 15 min + TOTP pour les actions de modification.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/admin/users?status&query&cursor` | ADMIN | Liste des métadonnées de compte (jamais de contenu). |
| GET | `/admin/users/:id` | ADMIN | Métadonnées + volumétrie agrégée + `usage_counters`. |
| POST | `/admin/users/:id/suspend` | ADMIN | `{ reason }` ; interdit sur soi-même et sur un autre ADMIN. |
| POST | `/admin/users/:id/unsuspend` | ADMIN | |
| PATCH | `/admin/users/:id/quotas` | ADMIN | Dérogations `limit_override`. |
| GET | `/admin/metrics` | ADMIN | Métriques plateforme agrégées. |
| GET | `/admin/audit` | ADMIN | Journal des actions d'administration (actions ADMIN uniquement). |
| GET/PUT | `/admin/feature-flags`, `/admin/feature-flags/:key` | ADMIN | Lecture / modification (globale ou `{ userId }`). |
| GET | `/me/usage` | Tous | Consommation et limites de l'utilisateur. |
| POST | `/me/export` | Tous | Ré-auth (+ TOTP si actif) ; crée un export complet ; 1 / 24 h. |
| GET | `/me/export/:jobId` | Tous | Statut ; quand prêt : `POST /me/export/:jobId/download-url` (URL signée ≤ 5 min). |
| POST | `/me/delete` | Tous | Ré-auth (+ TOTP si actif) + saisie de confirmation (`SUPPRIMER`) ; planifie la suppression à J+14. |
| DELETE | `/me/delete` | Tous | Annulation pendant le délai de grâce (après reconnexion). |
| GET | `/me/delete` | Tous | État de la demande. |
| GET | `/legal/privacy`, `/legal/terms` | Public | Versions en vigueur des mentions (contenu statique versionné). |

## 6. Frontend
- **Routes :** `/admin` (tableau de bord), `/admin/users`, `/admin/users/:id`, `/admin/flags`, `/admin/audit` (ADMIN) ; `/settings/account` (usage, export, suppression) ; `/legal/privacy`, `/legal/terms` ; écran « Compte suspendu » ; écran « Suppression programmée » avec bouton d'annulation.
- **Composants :** `AdminUserTable` (colonnes de métadonnées uniquement, aucune navigation vers des données), `SuspendDialog`, `QuotaEditor`, `FlagToggle`, `UsageMeters`, `ExportAccountCard` (étapes, téléchargement), `DeleteAccountFlow` (explication des conséquences, de la durée de grâce et de la politique de sauvegardes ; ré-auth ; confirmation tapée), bandeau d'acceptation des CGU/politique à la première connexion après mise à jour.
- Inscription : cases d'information (pas de cases pré-cochées), liens vers les mentions ; aucun traceur non essentiel (pas de bannière de cookies nécessaire tant que seuls les cookies strictement nécessaires sont utilisés).
- **États obligatoires** : chargement, vide, erreur, quota atteint (message et lien vers l'usage), compte suspendu, suppression programmée.

## 7. Règles métier et cas limites
1. **Confidentialité ADMIN (ADR-002)** : les requêtes de la console passent par un module `admin` qui n'importe **aucun** repository métier ; il lit uniquement `users`, `usage_counters`, des vues agrégées (`COUNT`, `SUM`) et `audit_logs` filtrés sur les actions d'administration. Test d'architecture et revue obligatoires. Toute action ADMIN est auditée.
2. **Suspension** : révoque toutes les sessions, bloque la connexion (message avec motif), suspend clés d'API, intégrations (sans révocation chez le fournisseur), automatisations et rappels (jobs ignorés avec statut `SKIPPED`) ; données conservées ; e-mail d'information. Levée = rétablissement sans perte.
3. **Quotas** : vérification avant l'action coûteuse (téléversement, appel IA, exécution) ; dépassement → 429 `QUOTA_EXCEEDED` avec la limite et la date de remise à zéro ; les quotas provisoires des phases 09, 15 et 16 sont migrés vers ce mécanisme ; aucune donnée existante n'est supprimée en cas de dépassement.
4. **Drapeaux** : évaluation `dérogation utilisateur > global > défaut du code` ; mis en cache 60 s ; un drapeau désactivé masque l'interface et renvoie 403 `FEATURE_DISABLED`.
5. **Export complet** : archive ZIP générée par le worker, stockée via `StoragePort`, chiffrée au repos par le fournisseur, contenant `manifest.json` (version de schéma, date, sommes de contrôle), un JSON par module, des CSV pour les finances (devise, dates, catégories, références — §4.25), les documents d'origine, un `LISEZMOI.txt`. **Exclus** : payloads du coffre, jetons d'intégration, hachages (mot de passe, clés d'API, codes de secours), secret TOTP, sessions. Archive supprimée après 7 jours ; e-mail à disposition sans lien direct (téléchargement après connexion).
6. **Suppression** :
   - demande → `PENDING_DELETION`, sessions révoquées sauf la courante, automatisations et intégrations suspendues, e-mail de confirmation ; délai de grâce **14 jours** (à valider par le propriétaire), annulable en se reconnectant ;
   - à échéance, job reprenable et idempotent : révocation des jetons Google, déliaison WhatsApp, purge des objets de stockage sous `users/{userId}/` (documents, exports, audios), puis suppression des lignes de toutes les tables portant `user_id`, dans l'ordre inverse des dépendances, par lots ; `audit_logs` de l'utilisateur supprimés, sauf les événements de sécurité requis, pseudonymisés (identifiant remplacé par un hachage) ;
   - l'utilisateur ADMIN unique ne peut pas supprimer son compte (409 `LAST_ADMIN`) ;
   - e-mail final de confirmation à l'adresse d'origine, puis effacement de l'adresse.
7. **Sauvegardes** : les données supprimées subsistent dans les sauvegardes chiffrées jusqu'à leur expiration (rétention définie dans `INFRASTRUCTURE.md`, par exemple 30 jours) ; elles ne sont jamais consultées ; **toute restauration rejoue** les suppressions `COMPLETED` de `account_deletion_requests` postérieures à la date de la sauvegarde avant remise en service. Cette politique est écrite dans la politique de confidentialité.
8. **RLS** : prototype sur 3 tables (`transactions`, `notes`, `documents`) avec `SET LOCAL app.user_id` par transaction via l'extension Prisma ; mesure de surcoût (p95) et de compatibilité (worker, SQL brut, Testcontainers) ; décision documentée par une nouvelle ADR (activation généralisée, partielle, ou maintien du contrôle applicatif seul).
9. **Revue de sécurité globale** : passe complète `security-reviewer` sur tout le dépôt ; liste de contrôle OWASP ASVS niveau 2 ; `pnpm audit` et analyse des dépendances sans vulnérabilité haute ; recherche de secrets (gitleaks) sur l'historique ; scan dynamique OWASP ZAP (baseline) sur staging ; vérification des en-têtes (CSP, HSTS, `Referrer-Policy`, `Permissions-Policy`) ; revue des limites de débit sur toutes les routes publiques ; exercice de restauration complet (base + fichiers + KEK) chronométré face au RTO de 4 h ; mise à jour de la procédure de réponse à incident.
10. **Conformité (à valider par un juriste — bloquant pour l'ouverture)** :
    - registre des traitements (finalités, catégories de données, durées de conservation, destinataires, sous-traitants : hébergeur UE du VPS (OVH), Vercel (hébergement du front et transit des requêtes `/api` par la réécriture, ADR-038), Sentry (suivi d'erreurs, région UE), Neon si OD-7 l'a retenu, stockage objet, e-mail transactionnel, Anthropic, Google, Meta) ;
    - formalités auprès de la **CDP** (déclaration ou demande d'autorisation selon la nature des traitements) et autorisation des **transferts hors du Sénégal** (hébergement UE, réseau mondial de Vercel, fournisseur IA aux États-Unis) ;
    - mentions d'information à la collecte, politique de confidentialité, CGU, procédure d'exercice des droits (accès = export, rectification, opposition, suppression), point de contact ;
    - procédure de notification de violation de données ;
    - durées de conservation alignées sur les rétentions techniques (documents, messages, journaux, sauvegardes) ;
    - vérification de l'existence de textes plus récents que la loi de 2008 au moment de la phase.
11. **Ouverture publique** (liste de contrôle) : conformité validée ; vérification de l'application OAuth Google (et évaluation de sécurité pour Gmail) obtenue, sinon `gmail_enabled` reste désactivé ; compte Meta Business vérifié, sinon `whatsapp_enabled` désactivé ; SPF, DKIM, DMARC configurés ; test de charge (k6) respectant les objectifs de `PRODUCT_SPEC.md` §9.1 ; alertes d'exploitation actives ; bascule `registration_open = true` par l'ADMIN.

## 8. Tests exigés
- **Unitaires** : évaluation des drapeaux (priorités) ; calcul des quotas et remise à zéro par période (fuseau) ; ordonnancement des étapes de suppression ; composition de l'archive d'export (exclusions).
- **Intégration** : suppression complète d'un utilisateur de test peuplé dans **tous** les modules → zéro ligne restante portant son `user_id` (requête sur le catalogue de toutes les tables) et zéro objet sous son préfixe de stockage ; reprise après interruption ; annulation pendant le délai de grâce ; export complet contenant toutes les entités et aucun élément exclu ; rejeu des suppressions après restauration d'une sauvegarde de test.
- **Sécurité** : test d'architecture prouvant que le module `admin` n'accède à aucun repository métier ; `USER` sur `/admin/*` → 403 ; ADMIN ne peut ni lire ni exporter les données d'autrui (tentatives sur toutes les routes métier avec un identifiant d'autrui → 404) ; export et suppression sans ré-auth → 401 ; compte suspendu → sessions, clés d'API et jobs bloqués ; résultats ZAP sans alerte haute.
- **Isolation entre utilisateurs** : test généré pour chaque nouvelle route ; régénération et exécution complète de la suite d'isolation de toutes les phases.
- **Charge** : scénario k6 (connexion, dashboard, création de transactions, recherche) sur staging, résultats consignés.
- **E2E** : export complet téléchargé et vérifié ; demande de suppression, annulation, nouvelle demande, suppression effective (horloge simulée) ; suspension puis levée par l'ADMIN.

## 9. Découpage en tâches
| # | Tâche | Dépend de |
|---|---|---|
| T1 | Migration ; statuts de `users` ; service de drapeaux. | — |
| T2 | `usage_counters` : incréments atomiques, Redis + réconciliation, migration des quotas provisoires. | T1 |
| T3 | Module `admin` (métadonnées, agrégats, métriques) + test d'architecture. | T1 |
| T4 | Suspension et levée (sessions, clés, intégrations, jobs). | T3 |
| T5 | Export complet (worker, archive, exclusions, URL signée, expiration). | T1 |
| T6 | Demande de suppression, délai de grâce, annulation. | T1 |
| T7 | Exécuteur de suppression reprenable (révocations externes, stockage, tables par lots, pseudonymisation). | T6 |
| T8 | Rejeu des suppressions après restauration + mise à jour de la procédure dans `INFRASTRUCTURE.md`. | T7 |
| T9 | Front : console ADMIN, drapeaux, quotas. | T2, T3, T4 |
| T10 | Prototype RLS, mesures, ADR. | — |
| T11 | Front : compte (usage, export, suppression), pages légales, écrans suspendu/suppression. | T5, T6 |
| T12 | Revue de sécurité globale (ASVS, dépendances, gitleaks, ZAP, en-têtes, limites) et corrections. | T1–T11 |
| T13 | Exercice de restauration complet et test de charge k6. | T8 |
| T14 | Dossier de conformité (registre, mentions, procédures) remis au juriste ; intégration des retours. | T5, T7 |
| T15 | Liste de contrôle d'ouverture, E2E, bascule `registration_open`, rapport. | T12, T13, T14 |

## 10. Agents ECC à mobiliser
- `security-reviewer` : revue globale (T12) et module `admin`.
- `architect` et `database-reviewer` : décision RLS (T10), ordre de suppression.
- `tdd-guide` : T2, T5, T7.
- `typescript-reviewer`, `code-reviewer`, `silent-failure-hunter` (suppression et export reprenables).
- `react-reviewer`, `a11y-architect` : console et parcours de compte.
- `e2e-runner` : T15.
- `doc-updater` : mise à jour de `SECURITY.md`, `INFRASTRUCTURE.md`, `DECISIONS.md` (ADR RLS).

## 11. Definition of Done
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` respectée.
- [ ] Console ADMIN limitée aux métadonnées, prouvée par test d'architecture ; aucune impersonation.
- [ ] Quotas et drapeaux opérationnels ; quotas provisoires migrés.
- [ ] Export complet vérifié ; suppression complète (base + stockage + révocations) vérifiée ; rejeu après restauration testé.
- [ ] ADR RLS rédigée et appliquée.
- [ ] Revue de sécurité globale sans constat CRITICAL ou HIGH ouvert ; ZAP sans alerte haute.
- [ ] Restauration complète dans le RTO ; test de charge consigné.
- [ ] Dossier de conformité validé par écrit par un juriste ; formalités CDP engagées ou accomplies.
- [ ] Vérifications Google et Meta obtenues, ou fonctionnalités correspondantes désactivées par drapeau.
- [ ] `registration_open` activé par le propriétaire.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-17-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`), avec : décision RLS, résultats de la revue de sécurité et du test de charge, durée mesurée de restauration, état des formalités CDP et des vérifications Google/Meta, date d'ouverture publique.
