# PHASE-01 : Identité, sessions et isolation — rapport

- **Statut :** Terminée avec réserves (correctifs de la revue de sécurité appliqués mais **non commités** : consigne du propriétaire « pas de commit ni push » ; CI GitHub non exécutée sur ces correctifs)
- **Branche :** phase-01/identite-sessions
- **Période :** 11 au 14 octobre 2026 ; sessions IA successives
- **Commit de merge :** à renseigner après merge dans `main`

## 1. Résumé

L'API gère des comptes complets : inscription selon `REGISTRATION_MODE` (ADR-026), vérification d'e-mail, connexion par session serveur (cookie `__Host-orbit_sid`, jeton opaque haché en SHA-256, aucun JWT), déconnexion, mot de passe oublié et réinitialisation, ré-authentification, changement d'e-mail et de mot de passe, gestion des sessions et historique de connexion. L'isolation entre utilisateurs repose sur le contexte CLS et l'extension Prisma `tenantScope` ; un harnais génère les tests 401 et d'accès croisé pour chaque route. CSRF par en-tête et `Origin`, limitation de débit par IP, utilisateur et e-mail, verrouillage progressif, audit des actions sensibles et rôle ADMIN (commande `create-admin`) complètent la phase.

## 2. Plan exécuté

| Tâche | État | Commits |
|---|---|---|
| T1 Schéma identité, ADR-026 | Fait | `c4a56a7` |
| T2 argon2id, politique, jetons | Fait (ADR-039) | `86be1fb`, `8fe12c6` |
| T3 MailPort, SMTP, gabarits | Fait | `8e283db`, `715c7ee` |
| T4 Inscription, renvoi | Fait | `9a85f78`, `c0a8620`, `483803a` |
| T5 Vérification, `login_events` | Fait | `f1bcfbd`, `67ed8f2` |
| T6 Sessions, guard, déconnexion | Fait (ADR-040) | `0dda543`, `c2b0534` |
| T7 CLS, `tenantScope` | Fait | `0bd1e4d`, `86440ec`, `08fba95` |
| T8 à T15 CSRF, rate limit, reset, ré-auth, `/me`, sessions, audit, rôles, CLI, isolation, sécurité | Fait | non commités (consigne) |
| T16 Revue sécurité, correctifs, rapport | Fait | non commités (consigne) |

## 3. Fichiers créés ou modifiés

- `apps/api/src/platform/` : `auth/` (cookie, guard de session, `@Public`, rôles, `@RequireReauth`, hacheur argon2id, pseudonymiseur), `http/` (CSRF, rate limit, `ip-prefix`, curseurs, contexte client), `tenant/` (CLS), `database/` (`tenantScope`, `TENANT_PRISMA`), `audit/`, `time/`, `mail/`.
- `apps/api/src/modules/auth/` (inscription, vérification, connexion, sessions, mot de passe, ré-auth, changement d'e-mail, historique) et `modules/users/` (profil, préférences, provisionnement ADMIN), `src/cli/`.
- `packages/contracts/src/auth/*`, `users/*`, `audit/audit-actions.ts`.
- Tests : `apps/api/test/integration/{auth,users,database,audit,security,mail}`, `test/isolation/*`.
- Documentation : `DECISIONS.md` (ADR-039, ADR-040), `SECURITY.md`, `INFRASTRUCTURE.md`, `API.md`, `TESTING.md`, `CODING_STANDARDS.md`, `README.md` (commande `create-admin`).

## 4. Modèle de données et migrations

Migration `0001_identity` : `users`, `user_preferences`, `sessions`, `email_verification_tokens`, `password_reset_tokens`, `login_events`, `audit_logs` (ajout seul). Aucune migration destructive. `login_events.ip` et `sessions.ip` stockent désormais une IP tronquée (/24 ou /48, revue M7).

## 5. API livrée

`/auth/register`, `/auth/email/verify`, `/auth/email/verify/resend`, `/auth/login`, `/auth/logout`, `/auth/password/forgot`, `/auth/password/reset`, `/auth/reauth`, `/auth/email/change/confirm`, `/me` (GET, PATCH), `/me/preferences` (GET, PATCH), `/me/email`, `/me/password`, `/me/sessions`, `/me/sessions/:id`, `/me/sessions/revoke-others`, `/me/login-events`. Détails dans `API.md` §14.

## 6. Frontend livré

Aucun (PHASE-02).

## 7. Décisions techniques

- **ADR-039 :** argon2id via `node:crypto` (`crypto.argon2`, Node ≥ 24.7) : le module natif `argon2` est bloqué par Smart App Control sur le poste de développement.
- **ADR-040 :** compilation `tsc` et transpilation Vitest par `ts.transpileModule` (SWC bloqué par Smart App Control).
- Ordre des guards globaux : CSRF → session → **rôles → ré-authentification récente** (revue L1 : un USER reçoit 404 avant tout 403) → limitation de débit.
- Envoi des e-mails détaché de la réponse HTTP (revue M2) : un échec SMTP est journalisé, jamais visible du client ; la file de réessai arrive en PHASE-08.

## 8. Écarts par rapport à la fiche

- `@RequireRecentAuth` de la fiche s'appelle `@RequireReauth(maxAgeSeconds)`.
- Liens e-mail au format `…#token=` (fragment, jamais envoyé au serveur ni journalisé) au lieu d'une query string.
- Pas de table `currencies` : `PREFERENCE_CURRENCIES` (XOF, EUR, USD) issu de `@orbit/money`.

## 9. Tests exécutés (sorties réelles, en local sous Windows 11)

- `apps/api` : 50 fichiers, 344 tests en couverture (353 avec le projet `isolation`) ; couverture lignes 98,25 %, instructions 97 %, branches 84,25 %, fonctions 98,71 %.
- `packages/contracts` : 91 tests, 98,7 % ; `packages/money` : 85 tests, 100 %.
- Nouveaux tests de la revue : 5 demandes `forgot` concurrentes répondent toutes 202 ; `ipThrottleKey` (IPv4 complète, IPv6 en /64).
- `pnpm lint`, `pnpm typecheck`, `pnpm depcruise`, `pnpm format:check`, `pnpm audit --audit-level high` : verts.
- **Instabilité observée une fois :** un test de l'API a échoué lors d'un passage de couverture puis n'a pas été reproduit (344/344 au passage suivant). À surveiller en CI.
- **Non exécuté :** CI GitHub sur les correctifs (non poussés).

## 10. Revues ECC

| Agent | CRITICAL / HIGH | Corrigés | Restants |
|---|---|---|---|
| security-reviewer | 0 / 1 | H1 (course sur `replaceActive` → 409 révélant un compte : P2002 absorbé, aucun e-mail, 202 uniforme) ; M1 (échec du hachage factice non mis en cache) ; M2 (envoi SMTP détaché) ; M4 (`/me/password` passe par `ReauthService.assertPassword` : journal et révocation après 10 échecs) ; M5 (limite `changeEmail` 5/h) ; M6 (IPv6 regroupée en /64 pour la limite par IP) ; M7 (IP tronquée dans `login_events`) ; L1 (ordre des guards) ; L3 (hachage avant consommation du jeton de reset) ; L4 (UUID validé dans le curseur) | voir §11 |

## 11. Risques et limitations connus

- **M3 pré-détournement de compte :** quelqu'un peut créer un compte non vérifié avec l'adresse d'autrui ; sans conséquence tant que l'inscription est `closed` ou `allowlist`. À traiter avant `REGISTRATION_MODE=open` (expiration des comptes non vérifiés, ré-inscription qui remplace).
- **M8 SMTP sans TLS** en local (Mailpit) : TLS obligatoire à configurer en production (PHASE-03).
- **M9 verrouillage ciblé :** un tiers peut verrouiller un compte en multipliant les échecs sur son adresse (15 min puis 24 h) ; atténué par l'alerte e-mail, à réévaluer avec MFA (PHASE-13).
- L'audit n'est pas transactionnel avec l'action auditée ; les routes publiques sont auditées sans `userId`.
- `ipThrottleKey` dépend de `TRUST_PROXY_HOPS` correct en production (PHASE-03).

## 12. Reste à faire

- Commiter les correctifs T8 à T16 en commits granulaires dès que le propriétaire lève la consigne, puis pousser et faire passer la CI GitHub.
- Avant ouverture publique : M3. En PHASE-03 : M8, `TRUST_PROXY_HOPS`. En PHASE-08 : file de réessai des e-mails.

## 13. Recette manuelle à faire par le propriétaire

1. `pnpm infra:up`, `pnpm db:migrate`, `pnpm dev` avec `REGISTRATION_MODE=open` dans `apps/api/.env`.
2. S'inscrire sur http://localhost:5173/register, ouvrir le lien dans Mailpit (http://localhost:8025), se connecter.
3. Paramètres → Sécurité : voir la session courante ; se connecter depuis un autre navigateur puis révoquer cette session.
4. Mot de passe oublié → lien Mailpit → nouveau mot de passe → connexion.
5. `pnpm --filter @orbit/api cli create-admin --email <adresse>` puis vérifier l'accès à `/admin`.

## 14. Point de reprise

Phase terminée côté code. Prochaine action : commits granulaires des correctifs (sur autorisation), puis merge de `phase-01/identite-sessions`. PHASE-02 est en cours sur la même branche de travail (voir `PHASE-02-REPORT.md` quand il existera).

## 15. Confirmation sécurité

- [x] Aucun secret réel ajouté au dépôt (`apps/api/.env` ignoré ; clé HMAC de test fictive).
- [x] Aucune migration destructive.
- [x] Aucun service payant ou externe appelé.
