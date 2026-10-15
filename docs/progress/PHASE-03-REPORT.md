# PHASE-03 : Production continue — rapport

- **Statut :** Préparée côté code, **en attente du propriétaire** pour la mise en ligne (comptes, VPS, DNS, secrets). Rien n'est commité (consigne « sans commit »).
- **Branche :** travail non commité (à reporter sur `phase-03/production-continue`)
- **Période :** 14 octobre 2026 ; session IA
- **Commit de merge :** à renseigner

## 1. Résumé

Tout ce qui peut être écrit et vérifié sans compte ni serveur est livré et testé en local :
- image Docker de production de l'API (construite, démarrée en configuration de staging durcie, migrations exécutées depuis l'image) ;
- Compose de production et de staging, Caddyfile (validé par `caddy validate`), `vercel.json` (réécriture `/api` liée à l'hôte, en-têtes de `SECURITY.md`) ;
- configuration par environnement (SMTP chiffré obligatoire, Sentry, URL publique, liste blanche d'e-mails en staging) ;
- Sentry côté API et web, sans données personnelles ;
- CI étendue (images, Trivy, Caddy, Compose, shellcheck, `vercel.json`) et `deploy.yml` (staging automatique, production approuvée, avance de la branche `production`) ;
- scripts `orbit-deploy` (migrations contrôlées, tests de fumée, retour arrière), sauvegarde restic, restauration (répétée en local), surveillance disque/swap/OOM, durcissement du VPS, unités systemd ;
- trois ADR (041 OD-7, 042 e-mail, 043 réécriture par hôte) et sept runbooks dont le guide pas à pas du propriétaire.

La mise en ligne elle-même (DoD §11) dépend des tâches du propriétaire listées dans `docs/runbooks/first-setup.md`.

## 2. Plan exécuté

| Tâche | État |
|---|---|
| T1 Guide propriétaire, OD-7, durcissement | Fait : `first-setup.md`, ADR-041 (à valider), `infra/provision/harden.sh` |
| T2 Dockerfile `api`/`worker` | Fait et vérifié (image 981 Mo, ~111 Mio de RAM au repos) |
| T3 Compose staging/production, Caddyfile | Fait ; `docker compose config` et `caddy validate` verts |
| T4 Vercel | Configuration faite (ADR-043) ; **vérifications réelles (Set-Cookie, durée, corps) en attente du déploiement** |
| T5 Configuration par environnement | Fait (schéma Zod étendu, tests) |
| T6 CI complète | Fait (job `infrastructure`) ; non exécutée sur GitHub (rien de poussé) |
| T7–T8 CD staging/production, retour arrière | Fait (`deploy.yml`, `orbit-deploy`) ; non exercé (pas de VPS) |
| T9 n8n | Service Compose et restriction Caddy faits ; mise en service réelle en attente |
| T10 Sauvegardes | `backup.sh` + timer faits ; non exécutés (pas de dépôt B2) |
| T11 Restauration | `restore.sh` fait et **répété en local** (§9) ; exercice sur une vraie sauvegarde de staging en attente |
| T12 Observabilité | Sentry API/web, `diskcheck` + battement, journaux Caddy filtrés ; Uptime Kuma à configurer à la mise en ligne |
| T13 E-mail de production | Adaptateur SMTP chiffré + liste blanche (ADR-042) ; DNS et test réel en attente |
| T14 Runbooks | Faits (`docs/runbooks/`) |
| T15 Exercices (retour arrière, alerte, premier ADMIN) | En attente du VPS |
| T16 Revues, rapport | Rapport fait ; revue `security-reviewer` lancée (voir §10) |

## 3. Fichiers créés ou modifiés

- **Image et déploiement :** `apps/api/Dockerfile`, `.dockerignore`, `infra/compose/compose.{production,staging}.yml`, `infra/compose/postgres/init-deployed/01-roles.sh`, `infra/compose/ci-fixtures/compose.env`, `infra/caddy/Caddyfile`, `apps/web/vercel.json`.
- **Scripts :** `infra/scripts/{orbit-deploy,orbit-deploy-wrapper,smoke,backup,restore,diskcheck}.sh`, `infra/scripts/check-compose-ports.mjs`, `infra/provision/harden.sh`, `infra/systemd/orbit-{backup,diskcheck}.{service,timer}`.
- **CI/CD :** `.github/workflows/ci.yml` (job `infrastructure`), `.github/workflows/deploy.yml`.
- **API :** `platform/config/env.schema.ts` (+ tests), `platform/mail/{smtp-mail.adapter,mail.module}.ts` (+ tests), `platform/observability/error-reporter.ts` (+ tests), `platform/http/global-exception.filter.ts`, `main.ts` ; `prisma` passe en dépendance de production (migrations depuis l'image) ; `@sentry/node` 11.7.0.
- **Web :** `lib/observability/sentry.ts`, `components/environment-banner.tsx` (+ tests), `vite-env.d.ts`, `vite.config.ts` (version du build, proxy de `vite preview`), `components/ui/toaster.tsx` (styles Sonner en CSS statique) ; `@sentry/react` 11.7.0 (chunk séparé, chargé seulement avec un DSN).
- **Documentation :** `DECISIONS.md` (ADR-041 à 043), `docs/runbooks/*` (7), `.env.example`.

## 4. Modèle de données et migrations

Aucune migration. Les rôles déployés (`orbit_app`, `orbit_backup` avec `pg_read_all_data` et transactions en lecture seule) sont créés au premier démarrage de PostgreSQL par `01-roles.sh`, mots de passe lus depuis des fichiers secrets.

## 5. API

Aucun endpoint. La version déployée (`APP_VERSION` = SHA de l'image) est journalisée au démarrage (`api.started`), jamais exposée. Les erreurs 5xx sont transmises à Sentry (si `SENTRY_DSN`) sans cookie, en-tête, corps, chaîne de requête ni donnée utilisateur hors UUID.

## 6. Frontend

Bandeau « STAGING : environnement de test » hors production ; balise `<meta name="orbit-version">` lue par les tests de fumée ; Sentry chargé à la demande.

## 7. Décisions techniques

- **ADR-041** (proposée) : PostgreSQL sur le VPS ; 8 Go recommandés.
- **ADR-042** : un seul adaptateur SMTP, chiffré et authentifié en déploiement ; Brevo par défaut.
- **ADR-043** : réécriture `/api` vers la production seulement pour l'hôte de production ; préversions et staging vers l'API de staging.
- Sentry 11 : `dataCollection` (successeur de `sendDefaultPii`) entièrement désactivé, plus un nettoyage `beforeSend`.
- CSP stricte conservée (`style-src 'self'`) : les styles de Sonner sont importés en CSS statique au lieu d'être injectés.
- `pnpm deploy --legacy` lie les paquets de l'espace de travail par liens symboliques : remplacés dans l'image par une copie de `package.json` + `dist`.

## 8. Écarts par rapport à la fiche

- Compose dans `infra/compose/` (structure existante) et non `deploy/`.
- Fournisseur e-mail par relais SMTP (ADR-042) plutôt qu'un adaptateur HTTP.
- `ops-status`, `/metrics` (prom-client) et la file de réessai d'e-mails ne sont pas livrés (PHASE-08).
- Les source maps ne sont pas envoyées à Sentry (jeton de build Vercel à créer par le propriétaire).
- Image de 981 Mo : réduction possible (exclure les moteurs Prisma inutiles, élaguer `@sentry/opentelemetry`).

## 9. Tests exécutés (sorties réelles, Windows 11 + Docker Desktop)

- `pnpm ci:local` complet : **SUCCÈS** (audit, format, lint, types, depcruise 485 modules, couverture, architecture, isolation, build, E2E).
  - API : 353 tests, lignes 97,7 %.
  - Web : 103 tests, lignes 93,5 %.
  - Contrats : 91 tests, 98,7 %. Money : 85 tests, 100 %.
  - E2E : 8 réussis.
- Image `api` : construite ; démarrée en `APP_ENV=staging`, `--read-only`, `--cap-drop ALL`, secrets en fichiers ; `/health/ready` 200, conteneur « healthy », `appVersion` journalisée, 110,9 Mio de RAM.
- Migration depuis l'image (commande du service `migrate`) contre PostgreSQL 17 : « No pending migrations to apply ».
- `caddy validate` (caddy 2.10.2) : configuration valide. `docker compose config` + `check-compose-ports.mjs` : production (5 services) et staging (2) conformes.
- shellcheck 0.10.0 : aucun avertissement après corrections (dont une vraie erreur de guillemets dans `harden.sh`).
- **Répétition de restauration** : dump de la base de développement (40 Ko, 8 comptes) → `restore.sh` → PostgreSQL 17.6 vierge, 3 migrations terminées, 8 tables vérifiées, **13 s**.
- **Non exécuté (pas de serveur ni de compte) :** CI GitHub, déploiements, Trivy sur GitHub, sauvegarde restic réelle, restauration d'une vraie sauvegarde de staging, exercices de retour arrière et d'alerte, vérifications Vercel (Set-Cookie, durée maximale, taille de corps), test SSL, relevé `docker stats` sous charge, e-mail réel avec SPF/DKIM/DMARC.

## 10. Revues ECC

`security-reviewer` lancé sur toute l'infrastructure de la phase et `react-reviewer` sur le front de PHASE-02 ; leurs constats et leur traitement sont consignés en §10.1 dès réception.

### 10.1 Constats et traitement

`security-reviewer` (infrastructure PHASE-03) : 1 CRITICAL, 4 HIGH, 8 MEDIUM, 7 LOW.

| Constat | Traitement |
|---|---|
| **C1** l'alias `api` existait dans la production et le staging sur `orbit-edge` : Caddy aurait réparti le trafic de production vers l'API de staging | **Corrigé** : réseau `orbit-edge-staging` dédié (Caddy seul relie les deux), alias unique `orbit-production-api`, contrôle de la version et de l'environnement de l'API dans `smoke.sh` |
| **H1** la sauvegarde du timer échouait (`ORBIT_SHA` absent) et exécutait le HEAD du dépôt | **Corrigé** : `ORBIT_SHA` repris de `current_sha`, scripts des timers copiés dans `/usr/local/lib/orbit` après une mise en production réussie |
| **H2** `orbit-deploy` exécutait en root le Compose d'un SHA quelconque | **Corrigé** : SHA obligatoirement sur `main` (`merge-base --is-ancestor`), production refusée si le SHA n'a pas réussi en staging |
| **H3** déploiement déclenchable par une PR ou un fork ; même clé SSH pour staging et production | **Corrigé** : condition `push` sur `main` du dépôt ; une clé par environnement liée par la commande forcée (`restrict`) ; secrets d'environnement ; consignes Actions/forks |
| **H4** premier démarrage bloqué : `admin` sans sudo utilisable, secrets et volumes illisibles sous `userns-remap`, `docker login` du mauvais compte, sauvegarde pré-migration impossible au premier déploiement | **Corrigé** : sudo sans mot de passe pour `admin` (clé seule), `install-secret` (UID remappé par conteneur), volumes pré-créés avec le bon propriétaire, login GHCR en root, PostgreSQL démarré avant la sauvegarde, pas de sauvegarde au tout premier déploiement |
| M1 IP cliente derrière Vercel puis Caddy | **Ouvert** : à mesurer à la mise en ligne (`first-setup.md` §8), puis `trusted_proxies` / `TRUST_PROXY_HOPS` |
| M2 `curl \| grep -q` sous `pipefail`, interpolation dans `bash -c` | **Corrigé** (réponses lues puis filtrées ; paramètres positionnels) |
| M3 retour arrière avec le Compose du nouveau SHA | **Corrigé** (re-checkout du SHA précédent) |
| M4 copie à chaud de n8n, fichier `.partial` | **Corrigé** (arrêt bref de n8n, nettoyage par `trap`) ; Object Lock B2 à activer par le propriétaire |
| M5 breadcrumbs, `extra`, `server_name` dans Sentry | **Corrigé** côté API et web ; `connect-src` reste `*.ingest.de.sentry.io` (hôte du DSN inconnu avant création du projet) |
| M6 chaîne de requête et `Proxy-Authorization` dans les journaux Caddy | **Corrigé** |
| M7 tout hôte inconnu visait l'API de staging | **Corrigé** : réécritures liées aux hôtes de production, de staging et `*.vercel.app` |
| M8 images par tag, SHA de `actions/checkout` à revérifier | **Ouvert** : épinglage par digest via Renovate, vérification des SHA avec `gh` au premier passage de la CI |
| LOW : URL Healthchecks en argument, n8n, timeouts systemd, injection `${{ }}`, `source` d'un env-file, `.dockerignore`, destinataire multiple | **Corrigés** (`curl -K -`, `NODES_EXCLUDE` et `N8N_BLOCK_ENV_ACCESS_IN_NODE`, `TimeoutStartSec`, variables `env:`, lecture par `sed`, `.npmrc`/`*.pem`, refus de `,` et `;`) ; mots de passe visibles dans `ps` pendant `restore.sh` (conteneur jetable) acceptés |

Revue `react-reviewer` du front PHASE-02 : voir `PHASE-02-REPORT.md` §10.

## 11. Risques et limitations connus

- Toute la DoD de mise en ligne reste à exécuter par le propriétaire (`first-setup.md` §8).
- Runner CI auto-hébergé : le job `infrastructure` construit des images et lance des conteneurs sur le poste du propriétaire.
- Images de base épinglées par tag, pas encore par digest (Renovate à mettre en place).

## 12. Reste à faire

- Propriétaire : `docs/runbooks/first-setup.md` de bout en bout, puis cocher sa liste de vérifications.
- IA, après mise en ligne : consigner les mesures Vercel, le procès-verbal de restauration réelle, l'exercice de retour arrière et l'alerte volontaire ; ajuster `TRUST_PROXY_HOPS` et `INFRASTRUCTURE.md`.

## 13. Recette manuelle à faire par le propriétaire

Voir `docs/runbooks/first-setup.md`, section 8.

## 14. Point de reprise

Valider ADR-041 et le choix Brevo, ouvrir les comptes, puis dérouler `first-setup.md`. Ensuite, commits granulaires (PHASE-01, 02, 03) et premier passage de la CI GitHub.

## 15. Confirmation sécurité

- [x] Aucun secret réel dans le dépôt (valeurs fictives `example.com`, clés de test ; secrets de répétition créés puis supprimés dans le scratchpad).
- [x] Aucune migration.
- [x] Aucun compte créé, aucun service payant appelé (seuls des téléchargements d'images et de paquets publics).
