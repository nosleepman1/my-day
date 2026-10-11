# PHASE-03 : Production continue

- **Statut :** À faire
- **Dépend de :** PHASE-02
- **Accès :** ADMIN (exploitation de la plateforme ; aucune fonctionnalité utilisateur nouvelle)
- **Estimation :** 5 à 7 jours effectifs (Vercel et n8n inclus, ADR-038)

## 1. Objectif
Mettre ORBIT en ligne de façon sûre et reproductible **avant toute donnée réelle** (ADR-015, amendée par ADR-038) : front sur **Vercel** (préversion par PR, réécriture `/api` qui conserve la même origine), API, worker et **n8n** sur un **VPS OVH** avec HTTPS par Caddy, environnements staging et production séparés, CI/CD complète avec retour arrière, sauvegardes chiffrées restic **avec restauration testée**, observabilité minimale (Sentry SaaS, Uptime Kuma), fournisseur d'e-mail transactionnel et runbooks d'exploitation.

## 2. Contexte à charger
1. `DECISIONS.md` : ADR-006 (même origine, cookie `__Host-`), ADR-012 (processus API/worker), ADR-013, ADR-014, ADR-015, ADR-032 (clés d'API, pour n8n), **ADR-038** (hébergement hybride) et OD-7 (base sur le VPS ou Neon).
2. `INFRASTRUCTURE.md` : intégralité (environnements, Vercel, Docker, Caddy, CI/CD, migrations, budget mémoire, sauvegardes, observabilité, secrets) ; son §15 détaille les tâches d'infrastructure.
3. `SECURITY.md` : sections secrets, en-têtes HTTP, durcissement du serveur, journalisation.
4. `TESTING.md` : étapes de CI, tests de fumée post-déploiement.
5. `PRODUCT_SPEC.md` §8.4, §13 uniquement.

## 3. Périmètre
### Inclus
**Tâches du propriétaire (hors IA, à faire en début de phase) :** louer le VPS OVH (UE ; 2 vCPU, 4 Go de RAM au minimum, 8 Go recommandés si le prix est proche, 40 Go de SSD), ouvrir les comptes Vercel (offre Hobby, ou Pro en cas d'usage commercial), Sentry (région UE) et, si OD-7 le retient, Neon (région UE) ; le nom de domaine et les sous-domaines (`orbit.<domaine>` et `staging.orbit.<domaine>` vers Vercel ; `api.<domaine>`, `api-staging.<domaine>` et `n8n.<domaine>` vers le VPS), le compte de stockage des sauvegardes chez **un autre fournisseur**, le compte du fournisseur e-mail (Brevo ou Resend), saisir tous les secrets réels dans le gestionnaire retenu (secrets GitHub Actions et fichiers secrets sur le serveur ; Vercel ne reçoit que des variables `VITE_*` publiques). L'IA fournit les instructions pas à pas, **ne crée aucun compte et ne manipule aucun secret réel**.

**Décision à trancher en T1 : OD-7** (PostgreSQL sur le VPS ou Neon managé en région UE), consignée en ADR. Elle conditionne le budget mémoire du VPS, la méthode de sauvegarde et le runbook de restauration (`INFRASTRUCTURE.md` §10.1 et §11).

**Tâches IA :**
- **Image Docker de production** multi-étapes : `api` (exécute `main.ts`) et `worker` (même image, commande `worker.ts`, inactif jusqu'à PHASE-08). Utilisateur non-root, image minimale, `HEALTHCHECK`. **Pas d'image `web`** (ADR-038).
- **Front sur Vercel** : projet relié au dépôt (Root Directory `apps/web`, installation et build pnpm du monorepo, paquets partagés intégrés au bundle), `apps/web/vercel.json` (réécriture `/api/:path*` → `https://api.<domaine>/api/:path*`, en-têtes de sécurité CSP, HSTS, `frame-ancestors`, etc., cache du service worker et du manifeste), préversion par PR protégée et pointant vers l'API de staging, domaine `staging.orbit.<domaine>` sur `main`, production sur la branche `production`.
- **Docker Compose de production** (`deploy/compose.prod.yml`) et staging (`deploy/compose.staging.yml`, second projet sur le même VPS, limites mémoire basses, démarré à la demande si la RAM manque) : `caddy`, `api`, `postgres` (volume dédié, non exposé ; absent si OD-7 retient Neon), `n8n`, `uptime-kuma`, réseaux `edge` et `data` ; `mem_limit` par service selon le budget mémoire d'`INFRASTRUCTURE.md` §10.1 ; Redis ajouté en PHASE-08.
- **Caddy** : HTTPS automatique pour `api.<domaine>`, `api-staging.<domaine>` et `n8n.<domaine>` uniquement (il ne sert plus le front), en-têtes de sécurité de l'API, compression, limite de taille des requêtes, journaux d'accès sans cookie ni en-tête `Authorization`. La même origine (ADR-006) est assurée par la réécriture Vercel ; l'API vérifie `Origin` contre `APP_ORIGIN`.
- **n8n sur le VPS** : `n8n.<domaine>` derrière Caddy, authentification n8n avec MFA, éditeur restreint par IP ou VPN, `N8N_ENCRYPTION_KEY` sauvegardée hors ligne, workflows versionnés dans `infra/n8n/workflows/`. La clé d'API ORBIT à portée limitée (ADR-032) n'existe qu'à partir de PHASE-14.
- **Durcissement du VPS** (script idempotent documenté, exécuté par le propriétaire) : utilisateur non-root, SSH par clé uniquement, pare-feu (22, 80, 443), mises à jour automatiques de sécurité, fail2ban, fuseau UTC, swap de 2 Go.
- **CI/CD complète** (GitHub Actions) : install figée → lint → format → typecheck → tests unitaires → intégration → isolation → E2E → couverture (seuils bloquants) → build (API et web) → **scan de dépendances** (`pnpm audit` + outil retenu dans `INFRASTRUCTURE.md`) → build et publication de l'image API taguée par SHA (GHCR) → **déploiement staging automatique** sur `main` → tests de fumée staging → **déploiement production manuel** (environnement GitHub protégé, approbation du propriétaire) : API d'abord, puis avance de la branche `production` qui déclenche le déploiement Vercel du front. Le front n'est ni construit en image ni déployé par GitHub Actions : c'est l'intégration GitHub de Vercel qui s'en charge, le lint, les tests et le build du web restant bloquants en CI.
- **Migrations contrôlées** : `prisma migrate deploy` exécuté par un conteneur éphémère avant le démarrage de la nouvelle version ; sauvegarde automatique juste avant migration en production ; politique « expand → migrate → contract » documentée.
- **Retour arrière** : redéploiement de l'image API précédente (tag SHA) et *Instant Rollback* Vercel pour le front ; procédure si une migration a été appliquée (migration corrective, jamais de modification d'une migration appliquée).
- **Sauvegardes** (ADR-015) : `pg_dump` format custom quotidien (si OD-7 retient Neon : sauvegardes Neon plus export logique hebdomadaire hors Neon) + fichiers (répertoire de stockage local, utile dès PHASE-09) + volume n8n, chiffrés par restic vers le dépôt distant ; rétention (7 quotidiennes, 4 hebdomadaires, 6 mensuelles) ; vérification `restic check` hebdomadaire ; mot de passe restic et clés hors du VPS (copie hors ligne chez le propriétaire). Planification par timer systemd ou cron hôte (pas de BullMQ avant PHASE-08).
- **Restauration testée** : script de restauration vers une base vierge (staging ou conteneur local), contrôle d'intégrité (comptage par table, `/health/ready`, connexion d'un compte de test) ; mesure du temps (RTO ≤ 4 h) ; procès-verbal dans le rapport.
- **Observabilité** : logs JSON pino collectés par Docker (rotation), `requestId` propagé de Caddy à l'API ; Uptime Kuma sur le VPS (plus de VPS « ops » séparé) surveillant le front Vercel, la réécriture `/api` et `api.<domaine>`, doublé d'un battement Healthchecks.io qui détecte la panne complète du VPS ; suivi d'erreurs par **Sentry SaaS** (offre gratuite, région UE, projets `api` et `web`, `sendDefaultPii: false` et `beforeSend` qui retire les données personnelles) ; alertes : site indisponible, VPS injoignable, disque > 80 %, swap > 50 %, sauvegarde absente depuis > 26 h, certificat proche d'expiration ; métriques de base (latence, taux d'erreur 5xx).
- **Vérifications Vercel (ADR-038)** : transmission de `Set-Cookie` à travers la réécriture, durée maximale d'une réécriture externe (exports et appels longs sous la limite, sinon job et lien de téléchargement), taille maximale du corps transmis, IP du client reçue par l'API. Résultats consignés dans le rapport.
- **Fournisseur e-mail de production** : choix Brevo ou Resend argumenté (coût, délivrabilité, région), adaptateur `MailPort` HTTP ou SMTP, enregistrements SPF, DKIM, DMARC documentés (le propriétaire les saisit dans le DNS), test d'envoi réel vers l'adresse du propriétaire uniquement.
- **Configuration par environnement** : schéma Zod de configuration étendu (URL publiques `APP_ORIGIN` et `API_PUBLIC_URL`, origine CSRF, `SENTRY_DSN`, `REGISTRATION_MODE=allowlist` en production avec la seule adresse du propriétaire), `.env.example` à jour, aucun secret dans le dépôt.
- **Runbooks** dans `docs/runbooks/` : `deploy.md`, `rollback.md`, `backup-restore.md`, `incident.md`, `secrets-rotation.md`, `first-admin.md` (création du premier ADMIN en production via la CLI de PHASE-01).

### Exclu (et phase où ces éléments seront traités)
- Redis et worker actif → PHASE-08.
- Stockage objet (R2/B2) → PHASE-09.
- Métriques de files de jobs → PHASE-08.
- Ouverture publique des inscriptions → jalon J6 de `ROADMAP.md` (après PHASE-07 au plus tôt).
- Clé maître du coffre-fort → PHASE-13.

## 4. Modèle de données
Aucune table créée ni modifiée. Pas de migration. Les migrations existantes (`0000_init_extensions`, `0001_identity`) sont appliquées en staging puis en production par le pipeline.

## 5. API
Aucun nouvel endpoint métier. `GET /api/v1/health/live` reste sans détail (la version déployée, SHA de l'image, est journalisée au démarrage, jamais exposée) ; `GET /api/v1/health/ready` est utilisé par les sondes. Voir `API.md`.

## 6. Frontend
Aucun écran nouveau. Le build de production est servi par Vercel ; le service worker est versionné par build et n'est jamais mis en cache par le CDN ; SDK Sentry du front branché (`VITE_SENTRY_DSN`) ; l'environnement staging et les préversions affichent un bandeau « STAGING » (`VITE_APP_ENV`).

## 7. Règles métier et cas limites
- Aucune exécution de test, de seed ou de script destructif contre la production (garde dans les scripts : refus si `NODE_ENV=production` sans drapeau explicite et documenté).
- Le déploiement production est **impossible sans** : CI verte, déploiement staging réussi, tests de fumée staging verts, approbation manuelle.
- Une migration qui échoue arrête le déploiement ; l'ancienne version reste en service.
- Les sauvegardes sont chiffrées avant de quitter le serveur ; le dépôt distant n'est pas chez l'hébergeur du VPS.
- Aucun secret dans les logs, les images, les artefacts de CI ni les messages de commit (scan de secrets en CI).
- Staging et production ont des bases, secrets et fournisseurs e-mail (ou expéditeurs) distincts ; staging n'envoie d'e-mails qu'à une liste d'adresses autorisées. Staging et production partagent le VPS mais pas leurs réseaux `data`, volumes ni secrets.
- Les préversions Vercel ne visent **jamais** l'API de production.
- L'API est mise en production avant le front et reste compatible avec le front N−1.

## 8. Tests exigés
- **CI :** pipeline complet vert ; seuils de couverture bloquants ; scan de dépendances sans vulnérabilité critique non justifiée ; scan de secrets.
- **Fumée post-déploiement** (staging et production) : `/health/ready` 200 sur `api.<domaine>` **et** à travers la réécriture du front, page d'accueil servie par Vercel avec la version attendue, en-têtes de sécurité présents sur le front et l'API, cookie `__Host-orbit_sid` posé sur l'origine du front avec les bons attributs lors d'une connexion de test à travers la réécriture (staging uniquement), aucun en-tête CORS émis, appel direct à `api.<domaine>` sans cookie de session.
- **Limites Vercel :** mesure de la durée maximale d'une réécriture externe et de la taille maximale de corps acceptée.
- **n8n :** accès refusé hors IP autorisées et sans authentification.
- **Mémoire :** relevé `docker stats` sous charge légère, conforme au budget d'`INFRASTRUCTURE.md` §10.1.
- **Restauration :** exécution réelle du script sur une sauvegarde réelle de staging, vérifications d'intégrité, temps mesuré ; preuve dans le rapport.
- **Retour arrière :** exercice réel en staging (déployer N, puis revenir à N-1).
- **Sécurité :** test SSL (note A attendue), vérification que PostgreSQL, Uptime Kuma et l'API interne ne sont pas joignables depuis l'extérieur, vérification des en-têtes ; `security-reviewer` sur `vercel.json`, la configuration Caddy, Docker, n8n et le script de durcissement.
- **Alertes :** déclenchement volontaire d'une alerte (arrêt de l'API en staging) et réception.
- Isolation entre utilisateurs : la suite `test:isolation` fait partie du pipeline bloquant.

## 9. Découpage en tâches
| Tâche | Intitulé | Dépend de |
|---|---|---|
| T1 | Guide pas à pas pour le propriétaire (VPS OVH, Vercel, Sentry, DNS, compte de sauvegarde, fournisseur e-mail, secrets) ; **trancher OD-7** (PostgreSQL sur le VPS ou Neon) et la consigner en ADR ; script de durcissement du VPS (swap 2 Go) | — |
| T2 | Dockerfile de production `api`/`worker` (pas d'image `web`), utilisateur non-root, healthchecks | — |
| T3 | Compose staging et production avec `mem_limit` (budget §10.1 d'`INFRASTRUCTURE.md`), Caddyfile (`api`, `api-staging`, `n8n`, en-têtes de l'API) | T2 |
| T4 | **Projet Vercel + réécriture `/api`** : Root Directory `apps/web`, build pnpm du monorepo, `vercel.json` (réécriture, en-têtes, cache du service worker et du manifeste), préversions protégées vers l'API de staging ; **vérification de `Set-Cookie` à travers la réécriture et de la limite de durée des réécritures externes** (et de la taille du corps) | T3 |
| T5 | Configuration par environnement (schéma Zod étendu : `APP_ORIGIN`, `API_PUBLIC_URL`, `SENTRY_DSN` ; garde anti-production des scripts) | T3 |
| T6 | CI complète : scan de dépendances et de secrets, couverture bloquante, lint/tests/build du web, build et push de l'image API sur GHCR | T2 |
| T7 | CD : déploiement staging automatique (API par `deploy.yml`, front par Vercel), migrations contrôlées, tests de fumée | T3, T4, T6 |
| T8 | CD : déploiement production manuel approuvé (API puis branche `production` pour Vercel), sauvegarde pré-migration, retour arrière (image N−1 et *Instant Rollback* Vercel) | T7 |
| T9 | **n8n sur le VPS** : conteneur, `n8n.<domaine>` derrière Caddy, authentification avec MFA, restriction par IP ou VPN, `N8N_ENCRYPTION_KEY` hors ligne, `infra/n8n/workflows/` | T3 |
| T10 | Sauvegardes restic (pg_dump ou export hebdomadaire hors Neon selon OD-7, fichiers, volume n8n), rétention, `restic check`, planification hôte | T1, T3 |
| T11 | Script de restauration et exercice réel chronométré | T10 |
| T12 | Observabilité : logs, `requestId` Caddy → API, Uptime Kuma sur le VPS, battement Healthchecks.io, Sentry SaaS (UE, données personnelles filtrées) pour l'API et le web, alertes disque/swap/sauvegarde/certificat | T7 |
| T13 | Adaptateur `MailPort` de production, SPF/DKIM/DMARC documentés, test d'envoi au propriétaire | T5 |
| T14 | Runbooks `docs/runbooks/*` ; mise à jour `INFRASTRUCTURE.md` si précisé (notamment limites Vercel mesurées) | T8, T11, T12 |
| T15 | Exercices : retour arrière en staging, alerte volontaire ; création du premier ADMIN en production | T8, T12 |
| T16 | Revues ECC, vérification, rapport (avec procès-verbal de restauration et résultats des vérifications Vercel) | T1–T15 |

## 10. Agents ECC à mobiliser
- `security-reviewer` (**obligatoire** : `vercel.json`, Caddy, Docker, n8n, durcissement, secrets, CI).
- `code-reviewer`, `typescript-reviewer` (scripts et adaptateurs).
- `database-reviewer` (procédure de migration et de restauration).
- `silent-failure-hunter` (scripts de sauvegarde : échec silencieux interdit, code de sortie et alerte).
- `build-error-resolver` (images et CI).

## 11. Definition of Done
- [ ] Production et staging accessibles en HTTPS : front sur Vercel, API sur le VPS, même origine assurée par la réécriture `/api` (cookie `__Host-orbit_sid` de premier niveau, aucun CORS).
- [ ] Préversion Vercel fonctionnelle pour chaque PR, branchée sur l'API de staging.
- [ ] `Set-Cookie` vérifié à travers la réécriture ; durée maximale des réécritures externes et taille maximale du corps mesurées et consignées.
- [ ] OD-7 tranchée et consignée en ADR.
- [ ] n8n en service sur `n8n.<domaine>`, accessible seulement authentifié ; `N8N_ENCRYPTION_KEY` copiée hors ligne.
- [ ] Budget mémoire du VPS respecté (`mem_limit` par service, swap 2 Go, relevé consigné).
- [ ] Sentry SaaS (région UE) reçoit les erreurs de l'API et du web, sans donnée personnelle.
- [ ] Déploiement production uniquement manuel, après staging vert (API puis front).
- [ ] Sauvegarde quotidienne chiffrée hors fournisseur du VPS ; **restauration réussie et chronométrée** consignée dans le rapport.
- [ ] Retour arrière exercé en staging.
- [ ] Alertes testées (disponibilité, disque, sauvegarde absente).
- [ ] E-mail de production délivré (vérification de compte du propriétaire) avec SPF/DKIM/DMARC valides.
- [ ] Runbooks rédigés et relus par le propriétaire.
- [ ] Premier ADMIN créé en production ; `REGISTRATION_MODE=allowlist`.
- [ ] Aucun secret réel dans le dépôt ni dans les logs de CI.
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` cochée.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-03-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`).
