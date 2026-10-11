# PHASE-01 : Identité et sessions

- **Statut :** À faire
- **Dépend de :** PHASE-00
- **Accès :** Tous
- **Estimation :** 6 à 8 jours effectifs

## 1. Objectif
Permettre à un utilisateur de créer un compte vérifié, de se connecter par session serveur sécurisée, de gérer son profil, ses préférences et ses sessions, et poser le **contexte de cloisonnement par `user_id`** (CLS + extension Prisma) ainsi que le harnais de tests d'isolation dont dépendent toutes les phases suivantes.

## 2. Contexte à charger
1. `DECISIONS.md` : ADR-001, 002, 006, 007, 011, 014, 021, 023, 024 ; tableau des hypothèses.
2. `PRODUCT_SCOPE.md` §3 (rôles) et §4 (ligne M01).
3. `DATA_MODEL.md` : sections identité (`users`, `sessions`, `email_verification_tokens`, `password_reset_tokens`, `user_preferences`, `login_events`, `audit_logs`) et conventions de cloisonnement (clés composites `(user_id, id)`).
4. `SECURITY.md` : sessions, argon2id, CSRF, rate limiting, énumération de comptes, audit, redaction.
5. `API.md` : routes `/auth/*` et `/me`, codes d'erreur d'authentification, en-tête `X-Requested-With`.
6. `DESIGN_PATTERNS.md` : guards, contexte de requête (nestjs-cls), extension Prisma `tenantScope`, ports (`MailPort`).
7. `TESTING.md` : harnais de tests d'isolation généré par route, fabriques de données.
8. `PRODUCT_SPEC.md` §4.1 et §4.24 uniquement.

## 3. Périmètre
### Inclus
- **Inscription** avec e-mail (citext, unique) et mot de passe (argon2id, politique de longueur ≥ 12, vérification contre une petite liste de mots de passe courants embarquée), création atomique de `users` + `user_preferences` par défaut (fuseau `Africa/Dakar`, devise `XOF`, langue `fr`, format de date, `enabled_modules` = tous les modules utilisateur, `onboarding_completed_at` nul).
- **Mode d'inscription** configurable par variable d'environnement `REGISTRATION_MODE` = `closed` | `allowlist` | `open` et `REGISTRATION_ALLOWLIST` (adresses séparées par des virgules). Valeur par défaut : `allowlist`. Sert les jalons « sur invitation » de `ROADMAP.md`. *(Nouvelle décision : à consigner en ADR-026 au démarrage de la phase.)*
- **Vérification d'e-mail** par jeton à usage unique (haché SHA-256 en base, validité 24 h), renvoi limité ; connexion refusée tant que l'e-mail n'est pas vérifié (message générique côté API, code dédié pour le front).
- **MailPort** + adaptateur SMTP (Mailpit en dev et tests) ; gabarits d'e-mails en français (vérification, réinitialisation, changement de mot de passe, nouvelle connexion).
- **Connexion / déconnexion** : session opaque 256 bits, empreinte SHA-256 dans `sessions`, cookie `__Host-orbit_sid` (HttpOnly, Secure, SameSite=Lax, Path=/) ; expiration glissante 7 jours, absolue 30 jours ; `last_seen_at` mis à jour au plus une fois par minute ; rotation du jeton à la connexion (anti-fixation).
- **Sessions** : liste des sessions actives (appareil approximé par user-agent, IP tronquée, dates), révocation unitaire, révocation de toutes les autres, révocation globale à la réinitialisation ou au changement de mot de passe.
- **Réinitialisation du mot de passe** : demande (réponse identique que le compte existe ou non), jeton à usage unique 30 minutes, haché ; consommation atomique.
- **Ré-authentification** : `POST /auth/reauth` (mot de passe) qui pose `reauth_at` sur la session ; garde `@RequireRecentAuth(minutes)` (10 min par défaut) utilisée pour changement d'e-mail, de mot de passe, export, suppression (ADR-006).
- **Profil et préférences** : nom d'affichage, langue, fuseau IANA validé, devise par défaut (liste ISO limitée à XOF, EUR, USD tant que `currencies` n'existe pas — validée par `packages/money`), format de date, `enabled_modules` (ADR-024), marquage de fin d'onboarding.
- **Changement d'e-mail** (ré-auth + vérification de la nouvelle adresse + notification à l'ancienne) et **changement de mot de passe** (ré-auth + révocation des autres sessions).
- **Rôles** `USER` / `ADMIN` (colonne `users.role`), décorateur `@Roles('ADMIN')` + guard ; **commande CLI** `pnpm --filter api cli create-admin --email <e>` (mot de passe saisi de façon interactive ou généré et affiché une seule fois ; idempotente ; refuse si un ADMIN existe déjà sauf `--force` documenté).
- **Contexte de requête** : guard d'authentification global (routes publiques marquées `@Public()`), nestjs-cls avec `{ userId, role, requestId, sessionId }` (ADR-007 point 2).
- **Extension Prisma `tenantScope`** (ADR-007 point 3) : injecte `user_id` dans `where`/`data` pour les modèles marqués « tenant », lève une erreur si le contexte est absent, interdit `findUnique` par seul `id` sur ces modèles ; client « système » explicite et rare pour les opérations hors contexte (inscription, CLI), revu.
- **Protection CSRF** : middleware sur toutes les mutations (POST/PUT/PATCH/DELETE) exigeant `X-Requested-With: orbit` et un `Origin` égal à l'origine configurée.
- **Rate limiting** : `@nestjs/throttler`, stockage en mémoire (instance unique jusqu'à PHASE-08, où il passe sur Redis) ; limites fines sur `/auth/login`, `/auth/register`, `/auth/password/forgot`, `/auth/email/resend`, `/auth/reauth` (par IP et par e-mail) ; 429 avec `Retry-After`.
- **`login_events`** : succès, échecs, blocages (IP tronquée, user-agent, raison), sans mot de passe.
- **`audit_logs`** : service d'audit append-only (acteur, action, cible typée, métadonnées non sensibles, `requestId`) ; journalise inscription, vérification, connexion, déconnexion, changement d'e-mail/mot de passe, révocations, accès refusé à une ressource d'un autre utilisateur.
- **Harnais de tests d'isolation généré** : registre des routes (lecture des métadonnées NestJS) ; pour chaque route privée avec paramètre `:id`, test automatique « l'utilisateur B obtient 404 sur la ressource de A » ; pour chaque route privée, test « non authentifié → 401 » ; échec de la CI si une route n'est ni couverte ni explicitement exemptée (liste d'exemptions justifiées).
- Nettoyage des jetons et sessions expirés : méthode de service appelée à la connexion (pas de job avant PHASE-08).

### Exclu (et phase où ces éléments seront traités)
- Pages et formulaires front (connexion, inscription, paramètres) → PHASE-02.
- Fournisseur e-mail de production → PHASE-03.
- Notification e-mail asynchrone, alertes de sécurité via le système de notifications → PHASE-08 (en PHASE-01, envoi synchrone par `MailPort`).
- MFA TOTP → PHASE-13.
- Jetons d'API pour clients non navigateur → PHASE-14.
- Export et suppression de compte en libre-service → PHASE-07 (export) et PHASE-17 (suppression).
- Console d'administration → PHASE-17.

## 4. Modèle de données
Tables créées (noms canoniques, `PRODUCT_SCOPE.md` §4, détail dans `DATA_MODEL.md`, section identité) :
- `users` : `id` UUIDv7, `email` citext unique, `email_verified_at`, `password_hash`, `role` (`USER`|`ADMIN`), `display_name`, `status` (`ACTIVE`|`DISABLED`), timestamps.
- `sessions` : `id`, `user_id`, `token_hash` unique, `created_at`, `last_seen_at`, `expires_at`, `absolute_expires_at`, `reauth_at`, `revoked_at`, `ip_prefix`, `user_agent`.
- `email_verification_tokens`, `password_reset_tokens` : `id`, `user_id`, `token_hash` unique, `expires_at`, `consumed_at`, (`new_email` pour changement d'e-mail).
- `user_preferences` : `user_id` (PK et FK), `locale`, `timezone`, `default_currency`, `date_format`, `enabled_modules` (tableau de texte), `onboarding_completed_at`.
- `login_events` : `id`, `user_id` nullable (échec sur e-mail inconnu), `email_hash`, `outcome`, `reason`, `ip_prefix`, `user_agent`, `created_at`.
- `audit_logs` : `id`, `user_id` (propriétaire de la donnée), `actor_user_id`, `action`, `target_type`, `target_id`, `metadata` jsonb (sans secret), `request_id`, `created_at`. Index `(user_id, created_at desc)`.

Migration : `0001_identity`. Index uniques sur les empreintes de jetons ; index `(user_id, revoked_at)` sur `sessions`.

## 5. API
Voir `API.md`. Toutes les routes sous `/api/v1`.

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/email/verify` | Public |
| POST | `/auth/email/resend` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | USER |
| POST | `/auth/password/forgot` | Public |
| POST | `/auth/password/reset` | Public |
| POST | `/auth/reauth` | USER |
| GET | `/me` | USER |
| PATCH | `/me` | USER |
| GET | `/me/preferences` | USER |
| PATCH | `/me/preferences` | USER |
| POST | `/me/email` | USER + ré-auth |
| POST | `/me/password` | USER + ré-auth |
| GET | `/me/sessions` | USER |
| DELETE | `/me/sessions/:id` | USER |
| POST | `/me/sessions/revoke-others` | USER |
| GET | `/me/login-events` | USER |

« USER » signifie « tout utilisateur authentifié » (USER ou ADMIN). Aucun endpoint ADMIN dans cette phase ; le guard `@Roles('ADMIN')` est livré et testé sur une route de test interne.

## 6. Frontend
Aucun écran dans cette phase (PHASE-02). Le client HTTP de PHASE-00 gère déjà le cookie et `X-Requested-With`. Les e-mails pointent vers des routes front qui seront livrées en PHASE-02 (`/verify-email?token=`, `/reset-password?token=`) : les URL sont configurables.

## 7. Règles métier et cas limites
- Réponses de `/auth/register`, `/auth/login`, `/auth/password/forgot`, `/auth/email/resend` **indistinguables** que le compte existe ou non (même code, même message, temps de réponse lissé par un hachage factice) — `SECURITY.md`.
- Inscription hors liste d'autorisation (`allowlist`) ou en mode `closed` : réponse générique, aucun compte créé.
- Jeton déjà consommé, expiré ou inconnu → même erreur générique.
- Session expirée (glissante ou absolue) ou révoquée → 401, cookie effacé.
- Mutation sans `X-Requested-With: orbit` ou avec `Origin` étranger → 403 `CSRF_REJECTED`.
- Utilisateur `DISABLED` → connexion refusée (message générique), sessions révoquées.
- Ressource d'un autre utilisateur (ex. `DELETE /me/sessions/:id` d'une session de B) → **404** et entrée `audit_logs` (ADR-007 point 7).
- Fuseau horaire non IANA → 422. `enabled_modules` ne peut contenir que des modules utilisateur connus ; il n'influe jamais sur l'accès ADMIN (ADR-024).
- Le mot de passe, les jetons et le cookie ne figurent jamais dans les logs, `audit_logs`, `login_events` ni les réponses.
- Le hachage argon2id est calibré (paramètres ADR-006) et ses paramètres sont stockés dans le hash (rehash transparent si changement).

## 8. Tests exigés
- **Unitaires :** politique de mot de passe, génération et hachage de jetons, calcul des expirations (glissante/absolue), guard de rôles, garde de ré-auth, extension `tenantScope` (injection `where`/`data`, erreur sans contexte, refus de `findUnique` par `id`), middleware CSRF, mode d'inscription.
- **Intégration (Testcontainers + Mailpit ou MailPort factice) :** parcours complet inscription → e-mail reçu → vérification → connexion → `/me` → déconnexion ; reset complet ; jeton à usage unique ; expiration via horloge injectée ; révocation unitaire et globale ; changement de mot de passe révoque les autres sessions ; rate limiting renvoie 429.
- **Isolation :** harnais généré actif ; sessions de A invisibles et non révocables par B (404) ; `login-events` de A invisibles par B.
- **Sécurité :** énumération de comptes (réponses et temps comparables), brute force (blocage), fixation de session (nouveau jeton à la connexion), cookie avec attributs exacts, CSRF, logs sans secrets (test de redaction sur une requête de connexion), injection dans l'e-mail (validation).
- **CLI :** `create-admin` crée un ADMIN vérifié, refuse le doublon.
- Fuseaux : tests d'expiration exécutés aussi avec `TZ=Europe/Paris` et `America/New_York` (ADR-023).

## 9. Découpage en tâches
| Tâche | Intitulé | Dépend de |
|---|---|---|
| T1 | ADR-026 (mode d'inscription) proposée et validée ; schéma Prisma des 7 tables ; migration `0001_identity` | — |
| T2 | Service de hachage argon2id + politique de mot de passe ; génération/hachage de jetons | T1 |
| T3 | `MailPort`, adaptateur SMTP (Mailpit), gabarits FR, faux adaptateur de test | T1 |
| T4 | Inscription (modes `closed`/`allowlist`/`open`), création préférences par défaut, jeton de vérification, renvoi | T2, T3 |
| T5 | Vérification d'e-mail ; `login_events` | T4 |
| T6 | Sessions : création, cookie `__Host-`, guard global, `@Public()`, expiration glissante/absolue, déconnexion | T2 |
| T7 | Contexte CLS et extension Prisma `tenantScope` (+ client système encadré) | T6 |
| T8 | Middleware CSRF ; rate limiting par route | T6 |
| T9 | Réinitialisation du mot de passe ; ré-authentification et garde `@RequireRecentAuth` | T6, T3 |
| T10 | `/me`, préférences (fuseau, devise, `enabled_modules`, onboarding), changement d'e-mail et de mot de passe | T7, T9 |
| T11 | Gestion des sessions (liste, révocation unitaire, autres, globale) ; `/me/login-events` | T7 |
| T12 | Service `audit_logs` et branchement sur les événements de la phase ; 404 audité | T7 |
| T13 | Rôles `@Roles('ADMIN')` ; commande CLI `create-admin` | T6 |
| T14 | Harnais de tests d'isolation généré (registre des routes, tests 401 et 404 croisés, exemptions) dans `test:isolation` | T7, T11 |
| T15 | Tests de sécurité (énumération, brute force, fixation, redaction) | T8, T9 |
| T16 | Revues ECC (security-reviewer obligatoire), vérification, mise à jour `API.md`/`DATA_MODEL.md` si précisés, rapport | T1–T15 |

## 10. Agents ECC à mobiliser
- `tdd-guide` (toutes les tâches de code).
- `security-reviewer` (**obligatoire** : T6–T15).
- `database-reviewer` (T1, index, clés composites).
- `typescript-reviewer`, `code-reviewer`.
- `silent-failure-hunter` (envoi d'e-mail, gestion des erreurs d'auth).

## 11. Definition of Done
- [ ] Parcours inscription → vérification → connexion → déconnexion testé de bout en bout (API).
- [ ] Cookie de session conforme à ADR-006 ; pas de JWT.
- [ ] Extension `tenantScope` active et testée ; client système limité et documenté.
- [ ] Harnais d'isolation généré branché dans la CI ; toute nouvelle route non couverte fait échouer la CI.
- [ ] Rate limiting et CSRF actifs et testés.
- [ ] `audit_logs` et `login_events` alimentés, sans secret.
- [ ] Commande `create-admin` documentée dans le `README.md`.
- [ ] ADR-026 ajoutée à `DECISIONS.md`.
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` cochée.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-01-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`).
