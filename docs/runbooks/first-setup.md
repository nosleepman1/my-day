# Runbook : première mise en ligne d'ORBIT (tâches du propriétaire)

Guide pas à pas de PHASE-03 (T1). L'IA ne crée aucun compte et ne manipule aucun secret réel : chaque étape ci-dessous est faite par le propriétaire. Les valeurs entre chevrons sont à remplacer ; `example.com` désigne votre domaine.

Durée indicative : une journée, réparties sur deux ou trois sessions (la propagation DNS et la vérification des domaines e-mail prennent quelques heures).

## 0. Décisions à valider

- **OD-7 / ADR-041** : base PostgreSQL sur le VPS (proposé) ou Neon. Si vous choisissez Neon, dites-le avant l'étape 4 : le Compose de production perd son service `postgres`.
- **Taille du VPS** : 4 Go de RAM minimum, **8 Go recommandés** (le staging peut alors rester démarré).
- **Fournisseur e-mail** (ADR-042) : Brevo par défaut, Resend possible.

## 1. Comptes à ouvrir (région UE partout où c'est proposé)

| Service | Usage | Offre |
|---|---|---|
| OVHcloud | VPS Debian 12 ou Ubuntu 24.04, 2 vCPU, 4 à 8 Go, 40 Go SSD, datacenter UE | payant |
| Vercel | front (`apps/web`) | Hobby (Pro si usage commercial) |
| Sentry (région **EU**) | erreurs, projets `orbit-api` et `orbit-web` | gratuit |
| Brevo | e-mail transactionnel (relais SMTP) | gratuit (300/jour) |
| Backblaze B2 (région **EU Central**) | dépôt restic des sauvegardes, **fournisseur distinct d'OVH** | payant à l'usage |
| Healthchecks.io | battements « sauvegarde » et « VPS » | gratuit |
| GitHub | dépôt, Actions, GHCR | existant |

Activez la double authentification sur chaque compte. Rangez chaque identifiant dans votre gestionnaire de mots de passe.

## 2. DNS

| Nom | Type | Cible |
|---|---|---|
| `orbit.example.com` | CNAME | fourni par Vercel (domaine de production) |
| `staging.orbit.example.com` | CNAME | fourni par Vercel (domaine de branche `main`) |
| `api.example.com` | A / AAAA | IP du VPS |
| `api-staging.example.com` | A / AAAA | IP du VPS |
| `n8n.example.com` | A / AAAA | IP du VPS |

E-mail (Brevo, domaine d'envoi `orbit.example.com`) : ajoutez les enregistrements **SPF**, **DKIM** et **DMARC** affichés par Brevo (« Domaines » → « Authentifier »). DMARC de départ : `v=DMARC1; p=quarantine; rua=mailto:<vous>@example.com`.

## 3. Préparer le VPS

1. Depuis votre poste : `ssh-keygen -t ed25519 -C admin@orbit` (clé personnelle), puis **deux** clés de CI sans phrase de passe, une par environnement (la clé de staging ne peut jamais déployer la production) : `ssh-keygen -t ed25519 -C orbit-ci-staging -f orbit-ci-staging` et `ssh-keygen -t ed25519 -C orbit-ci-production -f orbit-ci-production`.
2. Connecté en root la première fois, copiez le dossier `infra/provision/` sur le VPS puis :

```bash
ADMIN_SSH_KEY="$(cat ~/.ssh/id_ed25519.pub)" DEPLOY_STAGING_SSH_KEY="$(cat orbit-ci-staging.pub)" DEPLOY_PRODUCTION_SSH_KEY="$(cat orbit-ci-production.pub)" bash provision/harden.sh
```

Le compte `admin` n'a pas de mot de passe : connexion par clé seule et `sudo` sans mot de passe. Gardez votre clé privée en lieu sûr (sans elle, seule la console OVH permet de reprendre la main).

3. Reconnectez-vous en `admin` (le root est désormais refusé) et vérifiez : `sudo ufw status`, `swapon --show`, `docker info | grep -i userns`.
4. Clonez le dépôt en lecture seule : créez une **clé de déploiement GitHub** (Settings → Deploy keys, lecture seule), puis `sudo git clone git@github.com:<owner>/orbit.git /opt/orbit/repo`.
5. Installez les scripts :

```bash
sudo install -m 0755 /opt/orbit/repo/infra/scripts/orbit-deploy.sh /usr/local/bin/orbit-deploy
```

```bash
sudo install -m 0755 /opt/orbit/repo/infra/scripts/orbit-deploy-wrapper.sh /usr/local/bin/orbit-deploy-wrapper
```

```bash
sudo cp /opt/orbit/repo/infra/systemd/orbit-* /etc/systemd/system/ && sudo systemctl daemon-reload
```

Les timers exécutent une copie figée des scripts (`/usr/local/lib/orbit/`), réinstallée par `orbit-deploy` après chaque mise en production réussie. Pour la toute première fois :

```bash
sudo install -D -m 0755 -t /usr/local/lib/orbit /opt/orbit/repo/infra/scripts/backup.sh /opt/orbit/repo/infra/scripts/diskcheck.sh
```

## 4. Configuration et secrets sur le VPS

Générez chaque secret aléatoire avec `openssl rand -base64 32` et déposez-le avec `install-secret`, jamais dans un chat ni un dépôt. L'outil donne au fichier le propriétaire que le conteneur verra réellement (Docker `userns-remap`), sinon le conteneur ne pourrait pas le lire :

```bash
openssl rand -base64 32 | sudo install-secret production rate_limit_hmac_key
```

Pour une valeur que vous connaissez (clé SMTP, URL de connexion) : `sudo install-secret production smtp_password`, collez la valeur, puis `Ctrl+D`.

Fichiers à créer, pour `production` puis `staging` (valeurs **différentes** par environnement) :

| Fichier (`/etc/orbit/<env>/secrets/`) | Contenu |
|---|---|
| `postgres_owner_password`, `orbit_app_password`, `orbit_backup_password` | mots de passe aléatoires |
| `database_url` | `postgresql://orbit_app:<orbit_app_password>@postgres:5432/orbit` |
| `database_migration_url` | `postgresql://orbit_owner:<postgres_owner_password>@postgres:5432/orbit` |
| `database_backup_url` | `postgresql://orbit_backup:<orbit_backup_password>@postgres:5432/orbit` |
| `rate_limit_hmac_key` | 32 octets aléatoires en base64 |
| `smtp_password` | clé SMTP Brevo |
| `n8n_encryption_key` (production) | 32 octets aléatoires ; **copie hors ligne obligatoire** |

`/etc/orbit/<env>/compose.env` (non secret, `0640`) :

```dotenv
GHCR_OWNER=<owner-github-en-minuscules>
APP_ORIGIN=https://orbit.example.com
API_PUBLIC_URL=https://api.example.com
TRUST_PROXY_HOPS=2
LOG_LEVEL=info
SENTRY_DSN=<dsn du projet orbit-api, région EU>
MAIL_FROM=ORBIT <no-reply@orbit.example.com>
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_USER=<identifiant SMTP Brevo>
REGISTRATION_MODE=allowlist
REGISTRATION_ALLOWLIST=<votre adresse>
ACME_EMAIL=<votre adresse>
API_DOMAIN=api.example.com
API_STAGING_DOMAIN=api-staging.example.com
N8N_DOMAIN=n8n.example.com
ADMIN_ALLOWED_CIDRS=<votre IP fixe>/32
```

Pour le staging : `APP_ORIGIN=https://staging.orbit.example.com`, `API_PUBLIC_URL=https://api-staging.example.com` et `MAIL_ALLOWLIST=<votre adresse>`.

`/etc/orbit/production/n8n.env` : `N8N_HOST=n8n.example.com`, `N8N_PROTOCOL=https`, `WEBHOOK_URL=https://n8n.example.com/`.

`/etc/orbit/deploy.env` : `GHCR_OWNER=<owner>`. `/etc/orbit/backup.env` (0400) : `RESTIC_REPOSITORY=b2:<bucket>:orbit`, `RESTIC_PASSWORD_FILE=/etc/orbit/restic_password`, `B2_ACCOUNT_ID`, `B2_ACCOUNT_KEY` (clé **sans droit de suppression**), `HC_BACKUP_URL=https://hc-ping.com/<uuid>`. `/etc/orbit/monitoring.env` : `HC_DISK_URL=https://hc-ping.com/<uuid>`.

Initialisez le dépôt restic une fois : `sudo bash -c 'set -a; . /etc/orbit/backup.env; restic init'`. Imprimez le mot de passe restic et rangez-le **séparément** de la clé n8n.

## 5. GitHub

- Environnements `staging` et `production` (Settings → Environments). Sur `production` : **Required reviewers** = vous.
- Secrets **d'environnement** (jamais au niveau du dépôt) : dans `staging`, `VPS_DEPLOY_SSH_KEY` = clé privée `orbit-ci-staging` ; dans `production`, `VPS_DEPLOY_SSH_KEY` = clé privée `orbit-ci-production` ; dans les deux, `VPS_KNOWN_HOSTS` (`ssh-keyscan <IP du VPS>`). Variables : `VPS_HOST`, `PRODUCTION_APP_ORIGIN=https://orbit.example.com`. Limitez les deux environnements à la branche `main` (« Deployment branches »).
- Actions : désactivez l'exécution des workflows pour les PR de forks (le runner est votre poste).
- Branche `production` protégée : seule l'automatisation y pousse, en avance rapide.
- GHCR : rendre le paquet `orbit-api` privé et autoriser le VPS à le tirer : `sudo docker login ghcr.io` (en **root**, car `orbit-deploy` s'exécute en root) avec un jeton en lecture seule `read:packages`.

## 6. Vercel

1. « Add New Project » → dépôt ORBIT ; **Root Directory** `apps/web`, option « Include files outside the Root Directory » cochée ; preset Vite ; Node 24.
2. Branche de production : `production`. Domaines : `orbit.example.com` (production), `staging.orbit.example.com` (branche `main`).
3. Variables : `VITE_APP_ENV` (`production` / `staging` en Preview), `VITE_SENTRY_DSN` (projet `orbit-web`).
4. **Deployment Protection** activée pour les préversions.
5. Remplacez `orbit.example.com`, `api.example.com` et `api-staging.example.com` dans `apps/web/vercel.json` par vos domaines réels (ADR-043), dans un commit dédié.

## 7. Premier démarrage

1. Staging d'abord (la production refuse un SHA qui n'a pas réussi en staging) : `sudo orbit-deploy staging <sha>` d'un commit de `main` dont l'image existe déjà sur GHCR (poussée par `deploy.yml`).
2. Production (démarre aussi Caddy, PostgreSQL, n8n et Uptime Kuma) : `sudo orbit-deploy production <même sha>`. Tant que Caddy n'est pas démarré, les tests de fumée du staging échouent faute de HTTPS : relancez `sudo orbit-deploy staging <sha>` une fois la production en service.
3. Timers : `sudo systemctl enable --now orbit-backup.timer orbit-diskcheck.timer`.
4. Premier ADMIN : runbook `first-admin.md`.
5. Uptime Kuma (tunnel SSH, `INFRASTRUCTURE.md` §5.1) : moniteurs `https://orbit.example.com/`, `https://orbit.example.com/api/v1/health/ready`, `https://api.example.com/api/v1/health/ready`, `https://n8n.example.com/`, certificats < 14 jours ; notifications e-mail et Telegram.
6. n8n : créez le compte propriétaire, activez la MFA, fermez l'inscription.

## 8. Vérifications à consigner dans le rapport de PHASE-03

- [ ] `Set-Cookie` de `__Host-orbit_sid` reçu sur `orbit.example.com` à travers la réécriture (DevTools → Network → `POST /api/v1/auth/login`), attributs `Secure; HttpOnly; SameSite=Lax; Path=/`, sans `Domain`.
- [ ] IP du client vue par l'API correcte (`TRUST_PROXY_HOPS=2`) : `Paramètres → Sécurité → Sessions` affiche votre préfixe d'IP, pas celle de Vercel.
- [ ] Durée maximale d'une réécriture externe et taille de corps acceptée : mesurées avec `curl` sur une route de test, puis consignées.
- [ ] Note SSL Labs A sur `api.example.com` ; PostgreSQL, Uptime Kuma et l'API interne injoignables depuis Internet (`nmap -Pn <IP>` : 22, 80 et 443 seulement).
- [ ] E-mail de vérification reçu, en-têtes `spf=pass`, `dkim=pass`, `dmarc=pass`.
- [ ] Restauration réelle d'une sauvegarde de staging (`backup-restore.md`), chronométrée.
- [ ] Retour arrière exercé en staging (`rollback.md`) et alerte volontaire (arrêt de l'API de staging).
