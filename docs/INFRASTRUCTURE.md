# ORBIT : infrastructure, déploiement et exploitation

- **Statut :** référence. Applique ADR-004, 005, 006, 012, 013, 014, 015, 019 et 038 (hébergement hybride : front sur Vercel, back sur un VPS OVH) de `DECISIONS.md`, qui prime en cas de divergence.
- **Responsabilité :** comment lancer ORBIT en local, le construire, le déployer, le surveiller, le sauvegarder et le restaurer.
- **Hors périmètre :** structure du code (`ARCHITECTURE.md`), contrôles applicatifs (`SECURITY.md`), stratégie de test (`TESTING.md`), services externes (`INTEGRATIONS.md`).
- **Documents liés :** `DECISIONS.md`, `PRODUCT_SCOPE.md`, `ARCHITECTURE.md`, `SECURITY.md`, `TESTING.md`, `INTEGRATIONS.md`, `phases/PHASE-00-socle-technique.md`, `phases/PHASE-03-production-continue.md`, `phases/PHASE-08-async-rappels-notifications.md`.
- **Convention :** texte en français, identifiants et configuration en anglais. **Toutes les valeurs d'exemple sont fictives** (`example.com`, `orbit_dev_only`…). Les versions d'images et de paquets sont à **vérifier puis épingler** au moment de l'initialisation (PRODUCT_SPEC §7.1).

---

## 1. Vue d'ensemble

```
   Navigateur ──HTTPS──► Vercel : orbit.example.com (front apps/web, statique + PWA)
                          │  /api/:path*  ── réécriture ──┐
                          │  /*           → index.html     │
                                                           ▼
   Google, Meta, Telegram (webhooks) ──HTTPS──► api.example.com ─┐
   Administrateur ──HTTPS (authentifié)──────► n8n.example.com ─┤
                                                                 │
   VPS OVH (UE) ─────────────────────────────────────────────────┼──────────┐
   │                                              ┌──────────────▼───────┐  │
   │                                              │ caddy  TLS auto      │  │
   │                                              │ api.*  → api:3000    │  │
   │                                              │ n8n.*  → n8n:5678    │  │
   │                                              └───┬──────────────┬───┘  │
   │  réseau edge          ┌──────────────────────────┘              │      │
   │                 ┌─────▼─────┐   ┌────────────┐   ┌──────────────▼───┐  │
   │                 │   api     │   │  worker    │   │ n8n              │  │
   │                 │ NestJS    │   │  BullMQ    │   │ (clé API ADR-032)│  │
   │                 └─────┬─────┘   └─────┬──────┘   └──────────────────┘  │
   │   réseau data (internal: true, aucune sortie Internet)                 │
   │        ┌──────────────┴──────────┬────┘                                │
   │  ┌─────▼─────┐             ┌─────▼─────┐      ┌──────────────┐         │
   │  │ postgres  │ (sauf Neon, │  redis    │      │ uptime-kuma  │         │
   │  │           │  OD-7)      │ (PHASE-08)│      └──────────────┘         │
   │  └───────────┘             └───────────┘                               │
   │  + projet Compose « staging » (api, worker, base) à limites basses     │
   └────────────────────────────────────────────────────────────────────────┘
   Hors VPS : Vercel (front), Cloudflare R2 (fichiers, UE), Brevo ou Resend
   (e-mail), Backblaze B2 (sauvegardes restic), Sentry SaaS (erreurs, région UE),
   Healthchecks.io, Neon (base, si OD-7 le retient).
```

Dans les exemples, `<domaine>` vaut `example.com` : le front est servi sur `orbit.example.com` (Vercel), l'API sur `api.example.com` et n8n sur `n8n.example.com` (VPS). L'API de staging répond sur `api-staging.example.com`.

Principes non négociables :

1. **Même origine** : le navigateur ne parle qu'à l'origine du front. Vercel réécrit `/api/:path*` vers `https://api.<domaine>/api/:path*` (ADR-006, ADR-038) ; l'API répond sous `/api`. Le cookie `__Host-orbit_sid` reste lié au domaine du front : un appel direct à `api.<domaine>` n'emporte jamais de cookie de session. Pas de CORS en production. Seuls les webhooks entrants et n8n appellent directement `api.<domaine>`.
2. **Un seul port public** : sur le VPS, seul Caddy publie 80 et 443. PostgreSQL, Redis, l'API, le worker, n8n et Uptime Kuma ne sont **jamais** publiés sur l'hôte.
3. **Une image, plusieurs processus** : `api` et `worker` sont construits depuis le même code (ADR-012), mais tournent dans deux conteneurs distincts.
4. **Aucun secret dans Git, dans une image ou dans un payload de job.**
5. **Rien ne part en production sans sauvegarde testée** (ADR-015).

---

## 2. Environnements

| | `local` | `test` (CI) | `staging` | `production` |
|---|---|---|---|---|
| **Où (front)** | `pnpm dev` (Vite) | build Vite | Vercel : domaine de branche `staging.orbit.example.com` (branche `main`) et préversion par PR (`*.vercel.app`) | Vercel : déploiement de production |
| **Où (API, worker)** | `pnpm dev` sur l'hôte | conteneurs éphémères | second projet Compose `orbit-staging` sur le VPS OVH, limites mémoire basses (démarré à la demande si la RAM manque) | projet Compose `orbit-production` sur le VPS OVH |
| **Domaine** | `http://localhost:5173` | — | `https://staging.orbit.example.com` → `https://api-staging.example.com` | `https://orbit.example.com` → `https://api.example.com` |
| **Code applicatif** | `pnpm dev` sur l'hôte | conteneurs éphémères | front : build Vercel du SHA ; API : images GHCR `:sha` | front : build Vercel du même SHA ; API : mêmes images que staging, promues |
| **PostgreSQL** | conteneur `postgres:17` | Testcontainers | conteneur dédié (ou branche Neon si OD-7 retient Neon) | conteneur dédié, ou Neon région UE (OD-7) |
| **Fichiers** | adaptateur système de fichiers | adaptateur système de fichiers (tmp) | bucket R2 `orbit-staging-files` | bucket R2 `orbit-prod-files` |
| **E-mail** | Mailpit | faux `MailPort` en mémoire | fournisseur, liste blanche de destinataires | fournisseur transactionnel |
| **Redis** | profil `async` (PHASE-08+) | Testcontainers (PHASE-08+) | conteneur | conteneur |
| **Données** | seed fictif | fixtures | seed fictif, **jamais** de copie de production | réelles |
| **Intégrations** | mocks MSW | mocks MSW | comptes sandbox dédiés | comptes réels |
| **Secrets** | `.env` local non versionné | GitHub Secrets (aucun secret réel) | fichiers secrets sur le VPS (`/etc/orbit/staging/`) ; Vercel : variables `VITE_*` publiques seulement | fichiers secrets sur le VPS (`/etc/orbit/production/`) ; Vercel : variables `VITE_*` publiques seulement |
| **Déploiement** | — | — | automatique sur `main` (API par `deploy.yml`, front par l'intégration GitHub de Vercel) | **manuel**, après validation de staging : API d'abord, puis front |

Règles :

- Chaque environnement a **ses propres** bases, buckets, clés, clients OAuth et secrets (PRODUCT_SPEC §13.1). Une clé de staging ne fonctionne jamais en production.
- Aucun test, aucun script et aucune CI n'écrit en production, à l'exception des **smoke tests en lecture** listés au §8.6.
- La variable `APP_ENV` (`local`, `test`, `staging`, `production`) pilote les comportements. `NODE_ENV` vaut `production` dans toutes les images.
- **Préversions Vercel** : chaque PR reçoit une préversion du front, protégée par la *Deployment Protection* de Vercel, dont `/api` vise l'API de **staging** (jamais la production). Elles servent à la revue visuelle et aux E2E éventuels (`TESTING.md`).
- **Staging et production partagent le VPS** : projets Compose, réseaux `data`, bases, volumes et secrets distincts ; seul le réseau `edge` (Caddy) est commun. Si la mémoire manque (§10.1), le staging est arrêté et démarré à la demande.

---

## 3. Développement local (Windows 11)

### 3.1 Prérequis

- Docker Desktop avec le moteur WSL2.
- Node.js LTS (version épinglée dans `.nvmrc` et `package.json#engines`) et pnpm via Corepack (`corepack enable`).
- Git configuré avec `core.autocrlf=false`, et un `.gitattributes` à la racine :

```gitattributes
* text=auto eol=lf
*.sh text eol=lf
*.ps1 text eol=crlf
```

  Sans cette règle, les scripts shell copiés dans les images Linux échouent (`/bin/sh^M`).
- Hook pre-commit : `gitleaks protect --staged` (via `lefthook` ou `husky`).

### 3.2 Principe

Docker Compose ne lance que les **dépendances** (PostgreSQL, Mailpit, puis Redis). L'API et le front tournent sur l'hôte avec `pnpm dev`, pour un rechargement rapide. Vite proxifie `/api` vers `http://localhost:3000`, ce qui reproduit la règle de même origine (le rôle que joue la réécriture Vercel en production).

```ts
// apps/web/vite.config.ts (extrait)
server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } }
```

> Le cookie `__Host-orbit_sid` porte l'attribut `Secure`. Chrome, Edge et Firefox traitent `http://localhost` comme un contexte sécurisé et l'acceptent. Si un navigateur le refuse, utiliser le profil `edge` de Compose (Caddy avec `tls internal` sur `https://orbit.localhost`) plutôt que d'affaiblir le cookie.

### 3.3 Fichier `infra/compose/compose.dev.yml`

Le stockage de fichiers utilise **l'adaptateur système de fichiers** en local (ADR-013) : aucun MinIO. Le dossier `./.data/storage` est ignoré par Git.

```yaml
name: orbit-dev

services:
  postgres:
    image: postgres:17-alpine            # tag mineur à épingler
    environment:
      POSTGRES_USER: orbit_owner
      POSTGRES_PASSWORD: orbit_dev_only  # valeur locale fictive
      POSTGRES_DB: orbit
    ports: ["127.0.0.1:5433:5432"]       # jamais 0.0.0.0 ; 5433 evite un PostgreSQL local deja installe
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d:ro   # crée le rôle orbit_app
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orbit_owner -d orbit"]
      interval: 5s
      timeout: 3s
      retries: 10

  mailpit:
    image: axllent/mailpit:latest        # remplacer par un tag épinglé
    ports:
      - "127.0.0.1:1025:1025"            # SMTP
      - "127.0.0.1:8025:8025"            # interface web
    environment:
      MP_MAX_MESSAGES: 500

  redis:                                 # à partir de PHASE-08
    profiles: ["async"]
    image: redis:8-alpine                # Valkey 8 est une alternative compatible BullMQ
    command: ["redis-server", "--appendonly", "yes", "--maxmemory-policy", "noeviction"]
    ports: ["127.0.0.1:6379:6379"]
    volumes: [redisdata:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  edge:                                  # facultatif : HTTPS local (voir §3.2)
    profiles: ["edge"]
    image: caddy:2-alpine
    ports: ["127.0.0.1:443:443"]
    volumes: [./caddy/Caddyfile.dev:/etc/caddy/Caddyfile:ro]

volumes:
  pgdata:
  redisdata:
```

`maxmemory-policy noeviction` est **obligatoire** pour BullMQ : une éviction ferait disparaître des jobs.

### 3.4 Commandes

| Commande | Effet |
|---|---|
| `pnpm infra:up` | `docker compose -f infra/compose/compose.dev.yml up -d --wait` |
| `pnpm infra:up:async` | Idem avec `--profile async` (PHASE-08+) |
| `pnpm infra:down` | Arrête les conteneurs, conserve les volumes |
| `pnpm infra:reset` | Supprime les volumes (`down -v`), puis migre et rejoue le seed |
| `pnpm db:migrate` | `prisma migrate dev` (local uniquement) |
| `pnpm db:seed` | Seed fictif idempotent |
| `pnpm dev` | API (3000) et web (5173) en parallèle |

Les scripts sont écrits en Node ou en commandes `pnpm`, pas en Bash, pour fonctionner identiquement sous PowerShell et en CI.

---

## 4. Images Docker et build du front

### 4.1 Règles communes (images du VPS)

- Build **multi-stage** : dépendances, build, image d'exécution minimale.
- Image d'exécution **sans** compilateur, sans pnpm, sans code source TypeScript, sans `.env`.
- Processus lancé par un **utilisateur non root** (UID 1000 pour Node et n8n ; Caddy : `user: "1001:1001"` dans Compose avec `cap_add: [NET_BIND_SERVICE]`, à valider avec l'image officielle).
- `HEALTHCHECK` défini dans Compose (le binaire `curl` n'est pas installé : utiliser `node -e` ou `wget` busybox).
- Étiquettes OCI : `org.opencontainers.image.revision` = SHA Git, `org.opencontainers.image.source`.
- `.dockerignore` : `node_modules`, `.git`, `.env*`, `.data`, `coverage`, `**/*.test.ts`.
- Image publiée sur GHCR : `ghcr.io/<owner>/orbit-api:<sha>` (cibles `api` et `worker`). **Jamais** de déploiement sur `:latest`. Il n'y a **pas** d'image `orbit-web` : le front est construit et servi par Vercel (§4.3). Caddy, n8n, Redis, PostgreSQL et Uptime Kuma utilisent des images officielles épinglées par digest.

### 4.2 `apps/api/Dockerfile` (cibles `api` et `worker`)

Base Debian slim plutôt qu'Alpine : moteurs Prisma et modules natifs éventuels (libsodium) plus fiables sur glibc. argon2id vient de `node:crypto` (ADR-039) ; l'image doit embarquer Node ≥ 24.7.

```dockerfile
# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:24-bookworm-slim     # LTS active à vérifier et épingler par digest

FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @orbit/api...

FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @orbit/api exec prisma generate \
 && pnpm --filter @orbit/api build \
 && pnpm deploy --filter @orbit/api --prod /out

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=1000:1000 /out ./
USER 1000:1000
ENTRYPOINT ["/usr/bin/tini", "--"]

FROM runtime AS api
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM runtime AS worker
CMD ["node", "dist/worker.js"]
```

La migration n'a pas d'image propre : elle réutilise la cible `api` avec la commande `node_modules/.bin/prisma migrate deploy` et l'URL du rôle propriétaire (§9).

### 4.3 Front sur Vercel (`apps/web/vercel.json`)

Le front n'a **pas** de Dockerfile (ADR-038). Le projet Vercel est relié au dépôt GitHub :

| Réglage du projet Vercel | Valeur |
|---|---|
| Root Directory | `apps/web` (option « inclure les fichiers hors du Root Directory » active, pour `packages/*`) |
| Framework preset | Vite |
| Install Command | `pnpm install --frozen-lockfile` (pnpm détecte l'espace de travail à la racine ; version de pnpm fixée par `packageManager` dans `package.json`) |
| Build Command | `pnpm --filter "@orbit/web^..." build && pnpm build` : construit d'abord les paquets dont dépend le front (`packages/contracts`, `packages/money`), puis le front |
| Output Directory | `dist` |
| Node.js | même version majeure LTS que `.nvmrc` |
| Branche de production | `production` (avancée par `deploy.yml` après la mise en production de l'API, §8.3) ; `main` reçoit le domaine de branche `staging.orbit.example.com` |
| Ignored Build Step | facultatif : ne rien construire si ni `apps/web` ni `packages/` n'ont changé |

`packages/contracts` et `packages/money` sont intégrés au bundle au moment du build : aucun code partagé n'existe à l'exécution.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm --filter \"@orbit/web^...\" build && pnpm build",
  "outputDirectory": "dist",
  "cleanUrls": false,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://api.example.com/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Resource-Policy", "value": "same-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), geolocation=(), payment=(), microphone=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://*.r2.cloudflarestorage.com; media-src 'self' blob: https://*.r2.cloudflarestorage.com; connect-src 'self' https://*.ingest.de.sentry.io; font-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(sw.js|manifest.webmanifest|index.html)",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    }
  ]
}
```

Notes prescriptives :

- **Ordre des réécritures** : Vercel sert d'abord les fichiers existants du build, puis applique les réécritures. `/api/*` part vers l'API ; toute autre route inconnue retombe sur `index.html` (routage côté client).
- **Destination par environnement** : la production vise `api.example.com`, les préversions et le domaine de staging visent `api-staging.example.com`. Un `vercel.json` statique ne lit pas les variables d'environnement : le choix se fait par configuration programmatique (`vercel.ts`, selon `VERCEL_ENV`) ou par un middleware de routage Vercel. **À vérifier en PHASE-03 (tâche T4)** ; tant que ce n'est pas réglé, les préversions n'appellent aucune API plutôt que la production.
- **À vérifier en PHASE-03 (ADR-038)** : transmission intacte de `Set-Cookie` (`__Host-orbit_sid`, `Secure`, `HttpOnly`, `SameSite`, sans `Domain`) à travers la réécriture ; durée maximale d'une réécriture externe (les exports et les appels IA longs restent sous cette limite, sinon ils passent par un job et un lien de téléchargement) ; taille maximale du corps transmis (uploads jusqu'à `UPLOAD_MAX_BYTES`) ; en-têtes `X-Forwarded-For` transmis à l'API.
- **IP du client** : derrière Vercel puis Caddy, l'API reçoit deux sauts. `TRUST_PROXY_HOPS` est réglé selon le résultat de la vérification ci-dessus ; le rate limiting s'appuie aussi sur l'identifiant de session ou de compte, jamais seulement sur l'IP.
- **Service worker et manifeste** : `sw.js` et `manifest.webmanifest` ne sont jamais mis en cache par le CDN (`no-cache`), sans quoi une mise à jour de la PWA resterait bloquée. Le service worker n'intercepte jamais `/api/*` (`FRONTEND.md`).
- **`microphone=()`** passe à `microphone=(self)` à partir de PHASE-16 (capture vocale). **HSTS `preload`** n'est ajouté qu'après un mois sans incident TLS. `SECURITY.md` reste l'autorité sur la CSP.
- Le front ne reçoit **aucun secret** : seules des variables `VITE_*` publiques (version, nom d'environnement, DSN Sentry du front) sont injectées au build (§6.5).

---

## 5. Caddy

### 5.1 `infra/caddy/Caddyfile`

```caddyfile
{
	email ops@example.com
	admin off
}

(api_common) {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "no-referrer"
		Cross-Origin-Resource-Policy "same-origin"
		Content-Security-Policy "default-src 'none'; frame-ancestors 'none'"
		-Server
	}
	@outside_api not path /api/*
	respond @outside_api 404
	request_body {
		max_size 25MB
	}
	log {
		output stdout
		format json
	}
}

{$API_DOMAIN} {
	import api_common
	reverse_proxy api:3000 {
		header_up X-Request-Id {http.request.uuid}
		health_uri /api/v1/health/live
	}
}

{$API_STAGING_DOMAIN} {
	import api_common
	reverse_proxy orbit-staging-api:3000 {
		header_up X-Request-Id {http.request.uuid}
	}
}

{$N8N_DOMAIN} {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "no-referrer"
		-Server
	}
	# Éditeur n8n : réservé aux IP d'administration (ou au VPN WireGuard/Tailscale)
	@editor {
		not path /webhook/* /webhook-test/*
		not remote_ip {$ADMIN_ALLOWED_CIDRS}
	}
	respond @editor 403
	reverse_proxy n8n:5678
	log {
		output stdout
		format json
	}
}
```

Notes prescriptives :

- **Caddy ne sert plus le front** (ADR-038) : il ne termine TLS que pour `api.<domaine>` (production et staging) et `n8n.<domaine>`. Toute requête hors `/api/*` sur le domaine de l'API reçoit 404.
- **En-têtes de l'API** : réponses JSON uniquement, d'où une CSP `default-src 'none'`. Les en-têtes du front (CSP complète, `Permissions-Policy`, cache) sont posés par Vercel (§4.3). L'API fixe elle-même `Cache-Control: no-store` sur les réponses authentifiées.
- **L'API conserve le préfixe `/api`** (`app.setGlobalPrefix('api')`) : ni Vercel ni Caddy ne réécrivent le chemin.
- **`APP_ORIGIN`** : l'API compare l'en-tête `Origin` de chaque mutation avec l'origine publique du front (`https://orbit.example.com`), qui est celle que transmet le navigateur à travers la réécriture. Aucun en-tête CORS n'est émis.
- **`X-Request-Id`** est généré par Caddy. L'API le réutilise s'il s'agit d'un UUID valide, sinon elle en génère un. Il est renvoyé dans la réponse et figure dans chaque log.
- **Express** : `app.set('trust proxy', TRUST_PROXY_HOPS)`, réglé après la vérification du §4.3 (Vercel puis Caddy).
- **n8n** : authentification propre de n8n obligatoire (compte propriétaire, MFA activée, inscription publique fermée), **et** éditeur restreint par IP ou VPN au niveau de Caddy. Seuls `/webhook/*` restent joignables publiquement, si un workflow en a besoin. n8n appelle l'API par `API_PUBLIC_URL` avec une clé à portée limitée (ADR-032).
- **Uptime Kuma** n'est pas routé par Caddy : son interface se consulte par tunnel SSH vers l'adresse du conteneur sur le réseau Docker (`ssh -L 3001:<ip-du-conteneur>:3001 admin@vps`), sans aucun `ports:` publié.
- **Staging** : le conteneur `api` du projet Compose `orbit-staging` rejoint le réseau externe `edge` sous l'alias `orbit-staging-api`. Si le staging est arrêté, Caddy renvoie 502 sur `api-staging.<domaine>`.
- `/metrics` n'est **jamais** routé par Caddy (port interne séparé, §12.3).
- Le Caddyfile est validé en CI : `caddy validate --config infra/caddy/Caddyfile` et `caddy fmt --diff`.

---

## 6. Variables d'environnement

### 6.1 Conventions

- Toute variable sensible a une variante **`<NOM>_FILE`** qui pointe vers un fichier secret monté. **En staging et en production, seule la variante `_FILE` est acceptée** pour les secrets ; la variable en clair est refusée au démarrage.
- La configuration est **validée par Zod au démarrage** de l'API, du worker et du job de migration. Une erreur arrête le processus avec un message listant les **noms** fautifs, jamais leurs valeurs.
- Le module de configuration est le seul à lire `process.env`. Une règle ESLint (`no-restricted-properties`) l'impose partout ailleurs.
- Les variables d'une phase future sont **optionnelles** avant cette phase, puis **obligatoires** dès que le module correspondant est activé.

### 6.2 Tableau de référence

Légende : **O** = obligatoire, **C** = conditionnel, **F** = facultatif. **S** = secret (variante `_FILE` imposée hors local).

| Nom | Rôle | Exemple fictif | Oblig. | Phase |
|---|---|---|---|---|
| `NODE_ENV` | Mode Node | `production` | O | 00 |
| `APP_ENV` | Environnement logique | `staging` | O | 00 |
| `PORT` | Port HTTP de l'API | `3000` | O | 00 |
| `APP_ORIGIN` | Origine publique **du front** (Vercel), vérifiée sur chaque mutation (CSRF) ; sert aussi aux liens des e-mails | `https://orbit.example.com` | O | 00 |
| `API_PUBLIC_URL` | URL publique directe de l'API (webhooks entrants, n8n) ; jamais utilisée par le navigateur | `https://api.example.com` | O dès 03 | 03 |
| `LOG_LEVEL` | Niveau pino | `info` | F (`info`) | 00 |
| `TRUST_PROXY_HOPS` | Nombre de proxys de confiance (Vercel + Caddy en production, à confirmer en PHASE-03) | `2` | F (`1`) | 00 |
| `DATABASE_URL` **S** | Connexion du rôle applicatif `orbit_app` | `postgresql://orbit_app:changeme@postgres:5432/orbit` | O | 00 |
| `DATABASE_MIGRATION_URL` **S** | Rôle propriétaire `orbit_owner`, migrations uniquement | `postgresql://orbit_owner:changeme@postgres:5432/orbit` | C (job de migration) | 00 |
| `DATABASE_POOL_MAX` | Taille du pool | `10` | F | 00 |
| `STORAGE_DRIVER` | `fs` ou `s3` | `fs` | O | 00 |
| `STORAGE_FS_ROOT` | Racine de l'adaptateur fichier | `./.data/storage` | C (`fs`) | 00 |
| `S3_ENDPOINT` | Endpoint compatible S3 | `https://0000.eu.r2.cloudflarestorage.com` | C (`s3`) | 03 |
| `S3_REGION` | Région | `auto` | C (`s3`) | 03 |
| `S3_BUCKET` | Bucket privé | `orbit-prod-files` | C (`s3`) | 03 |
| `S3_ACCESS_KEY_ID` **S** | Clé d'accès | `fake-access-key` | C (`s3`) | 03 |
| `S3_SECRET_ACCESS_KEY` **S** | Secret d'accès | `fake-secret` | C (`s3`) | 03 |
| `SIGNED_URL_TTL_SECONDS` | Durée des URL signées (≤ 300, ADR-013) | `300` | F (`300`) | 00 |
| `UPLOAD_MAX_BYTES` | Taille max d'un fichier | `20971520` | F | 09 |
| `MAIL_DRIVER` | `smtp` (Mailpit), `brevo` ou `resend` | `smtp` | O | 01 |
| `SMTP_HOST` / `SMTP_PORT` | Mailpit en local | `localhost` / `1025` | C (`smtp`) | 01 |
| `MAIL_API_KEY` **S** | Clé du fournisseur transactionnel | `fake-mail-key` | C (`brevo`, `resend`) | 03 |
| `MAIL_FROM` | Expéditeur | `ORBIT <no-reply@orbit.example.com>` | O | 01 |
| `MAIL_ALLOWLIST` | Domaines autorisés en staging | `example.com` | C (`staging`) | 03 |
| `ARGON2_MEMORY_KIB` | Paramètre argon2id (ADR-006) | `65536` | F | 01 |
| `ARGON2_ITERATIONS` | Paramètre argon2id | `3` | F | 01 |
| `SESSION_IDLE_DAYS` / `SESSION_ABSOLUTE_DAYS` | Expirations de session | `7` / `30` | F | 01 |
| `RATE_LIMIT_STORE` | `memory` puis `redis` | `memory` | F | 01 |
| `SENTRY_DSN` | DSN du projet Sentry SaaS « api » (région UE) ; non secret, mais propre à chaque environnement | `https://key@o0.ingest.de.sentry.io/1` | C (staging, prod) | 03 |
| `SENTRY_ENVIRONMENT` | Environnement Sentry | `production` | F (`APP_ENV`) | 03 |
| `METRICS_PORT` | Port interne Prometheus | `9464` | F | 03 |
| `OPS_STATUS_TOKEN` **S** | Jeton de l'endpoint de supervision interne | `fake-ops-token` | C (staging, prod) | 03 |
| `REDIS_URL` **S** | Connexion Redis | `redis://:changeme@redis:6379/0` | O dès 08 | 08 |
| `WORKER_CONCURRENCY` | Concurrence par file | `5` | F | 08 |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Clé publique VAPID | `BFakePublicKey` | C | 08 |
| `WEB_PUSH_VAPID_PRIVATE_KEY` **S** | Clé privée VAPID | `fake-vapid-private` | C | 08 |
| `WEB_PUSH_SUBJECT` | Contact VAPID | `mailto:ops@example.com` | C | 08 |
| `MFA_ENCRYPTION_KEY` **S** | Clé de chiffrement des secrets TOTP | 32 octets en base64 | O dès 13 | 13 |
| `VAULT_KEK` **S** | Clé maître du coffre (ADR-019), **API seulement** | 32 octets en base64 | O dès 13 | 13 |
| `VAULT_KEK_VERSION` | Version active de la KEK | `1` | O dès 13 | 13 |
| `INTEGRATION_TOKENS_KEK` **S** | Clé maître des jetons OAuth (distincte du coffre) | 32 octets en base64 | O dès 14 | 14 |
| `INTEGRATION_TOKENS_KEK_VERSION` | Version active | `1` | O dès 14 | 14 |
| `GOOGLE_CLIENT_ID` | Client OAuth de l'environnement | `000-fake.apps.googleusercontent.com` | C | 14 |
| `GOOGLE_CLIENT_SECRET` **S** | Secret OAuth | `fake-google-secret` | C | 14 |
| `GOOGLE_REDIRECT_URI` | URI exacte de retour OAuth : reste sur l'origine du front (le navigateur doit présenter le cookie de session, via la réécriture) | `https://orbit.example.com/api/v1/integrations/google/callback` | C | 14 |
| `GOOGLE_WEBHOOK_BASE_URL` | Base des notifications push Calendar (directement sur l'API) | `https://api.example.com/api/v1/webhooks/google-calendar` | C | 14 |
| `API_KEY_PEPPER` **S** | Poivre HMAC des clés d'API | 32 octets en base64 | O dès 14 | 14 |
| `INBOUND_WEBHOOK_TOLERANCE_SECONDS` | Fenêtre d'horodatage HMAC | `300` | F | 14 |
| `WHATSAPP_PHONE_NUMBER_ID` | Numéro WhatsApp Business | `100000000000000` | C | 16 |
| `WHATSAPP_ACCESS_TOKEN` **S** | Jeton système Meta | `fake-meta-token` | C | 16 |
| `WHATSAPP_APP_SECRET` **S** | Secret d'application, vérifie `X-Hub-Signature-256` | `fake-app-secret` | C | 16 |
| `WHATSAPP_VERIFY_TOKEN` **S** | Jeton de vérification du webhook | `fake-verify-token` | C | 16 |
| `TELEGRAM_BOT_TOKEN` **S** | Bot Telegram (si retenu) | `000000:fake` | F | 16 |
| `TELEGRAM_WEBHOOK_SECRET` **S** | En-tête secret du webhook Telegram | `fake-telegram-secret` | F | 16 |
| `ANTHROPIC_API_KEY` **S** | API Claude (ADR-025) | `sk-ant-fake` | C | 16 |
| `AI_MODEL` | Modèle Claude retenu en PHASE-16 | `<à fixer en PHASE-16>` | C | 16 |
| `TRANSCRIPTION_DRIVER` | `self-hosted` ou fournisseur UE | `self-hosted` | C | 16 |
| `TRANSCRIPTION_URL` | Service de transcription interne | `http://transcriber:8000` | C | 16 |
| `TEST_OVERRIDE_OAUTH_BASE_URL` | Redirection des appels Google vers un mock | `http://localhost:9999` | **Interdit** hors `local`/`test` | 14 |

### 6.3 Validation Zod au démarrage

```ts
// apps/api/src/config/env.ts (extrait)
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const SECRET_KEYS = ['DATABASE_URL', 'MAIL_API_KEY', 'VAULT_KEK' /* … */] as const;

function resolveSecrets(env: NodeJS.ProcessEnv, appEnv: string): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...env };
  for (const key of SECRET_KEYS) {
    const file = env[`${key}_FILE`];
    if (file) out[key] = readFileSync(file, 'utf8').trim();
    else if (env[key] && (appEnv === 'staging' || appEnv === 'production')) {
      throw new Error(`Secret ${key} must be provided via ${key}_FILE`);
    }
  }
  return out;
}

const base64Key32 = z.string().refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes base64');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  APP_ENV: z.enum(['local', 'test', 'staging', 'production']),
  PORT: z.coerce.number().int().default(3000),
  APP_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  STORAGE_DRIVER: z.enum(['fs', 's3']),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().max(300).default(300),
  VAULT_KEK: base64Key32.optional(),
  TEST_OVERRIDE_OAUTH_BASE_URL: z.string().url().optional(),
  // …
}).superRefine((env, ctx) => {
  if (env.STORAGE_DRIVER === 'fs' && (env.APP_ENV === 'staging' || env.APP_ENV === 'production')) {
    ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'fs driver forbidden outside local/test' });
  }
  if (env.TEST_OVERRIDE_OAUTH_BASE_URL && !['local', 'test'].includes(env.APP_ENV)) {
    ctx.addIssue({ code: 'custom', path: ['TEST_OVERRIDE_OAUTH_BASE_URL'], message: 'forbidden in this environment' });
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const raw = resolveSecrets(process.env, process.env.APP_ENV ?? 'local');
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid configuration: ${names}`); // noms seulement, jamais les valeurs
  }
  return Object.freeze(parsed.data);
}
```

Tests exigés : schéma refusé si une variable obligatoire manque ; refus d'un secret en clair en `production` ; refus de `STORAGE_DRIVER=fs` en production ; refus de `TEST_OVERRIDE_*` hors `local`/`test` ; le message d'erreur ne contient aucune valeur.

### 6.4 `.env.example`

Versionné à la racine, **valeurs fictives uniquement**, tenu à jour à chaque phase (contrôlé en CI : toute clé du schéma Zod doit y figurer).

```dotenv
# --- Socle (PHASE-00) ---
NODE_ENV=development
APP_ENV=local
PORT=3000
APP_ORIGIN=http://localhost:5173
API_PUBLIC_URL=http://localhost:3000
LOG_LEVEL=debug
DATABASE_URL=postgresql://orbit_app:orbit_dev_only@localhost:5433/orbit
DATABASE_MIGRATION_URL=postgresql://orbit_owner:orbit_dev_only@localhost:5433/orbit
STORAGE_DRIVER=fs
STORAGE_FS_ROOT=./.data/storage

# --- E-mail (PHASE-01) ---
MAIL_DRIVER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
MAIL_FROM="ORBIT <no-reply@orbit.localhost>"

# --- Async (PHASE-08) ---
# REDIS_URL=redis://localhost:6379/0

# --- Coffre et MFA (PHASE-13) : générer avec `pnpm secrets:gen-key` ---
# MFA_ENCRYPTION_KEY=
# VAULT_KEK=
# VAULT_KEK_VERSION=1

# --- Intégrations (PHASE-14) ---
# INTEGRATION_TOKENS_KEK=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_REDIRECT_URI=http://localhost:5173/api/v1/integrations/google/callback
```

### 6.5 Variables hors API : Vercel et n8n

Ces variables ne passent pas par le schéma Zod de l'API.

| Nom | Où | Rôle | Exemple fictif | Secret |
|---|---|---|---|---|
| `VITE_APP_VERSION` | Vercel (build) | Version affichée et contrôlée par les smoke tests ; dérivée de `VERCEL_GIT_COMMIT_SHA` dans `vite.config.ts` | `3f2a…` | non |
| `VITE_APP_ENV` | Vercel, par environnement (Production / Preview) | Nom d'environnement affiché | `staging` | non |
| `VITE_SENTRY_DSN` | Vercel, par environnement | DSN du projet Sentry « web » (public par nature) | `https://key@o0.ingest.de.sentry.io/2` | non |
| `SENTRY_AUTH_TOKEN` | Vercel (build seulement) | Envoi des source maps à Sentry, puis suppression des `.map` du build publié | `fake-sentry-token` | **oui** (jamais préfixé `VITE_`) |
| `N8N_HOST` / `N8N_PROTOCOL` | VPS, `compose.env` | Hôte public de n8n | `n8n.example.com` / `https` | non |
| `WEBHOOK_URL` | VPS | URL publique des webhooks n8n | `https://n8n.example.com/` | non |
| `N8N_PROXY_HOPS` | VPS | n8n derrière Caddy | `1` | non |
| `N8N_SECURE_COOKIE` | VPS | Cookie de session n8n en `Secure` | `true` | non |
| `N8N_ENCRYPTION_KEY_FILE` | VPS, fichier secret | Clé de chiffrement des identifiants stockés par n8n ; copie hors ligne obligatoire (§7.2) | 32 octets aléatoires | **oui** |
| `DB_TYPE` | VPS | Base de n8n : `sqlite` (volume dédié, sauvegardé) par défaut ; `postgresdb` sur une base et un rôle dédiés si besoin | `sqlite` | non |
| `GENERIC_TIMEZONE` | VPS | Fuseau des déclencheurs planifiés | `Africa/Dakar` | non |
| `N8N_DIAGNOSTICS_ENABLED` / `N8N_PERSONALIZATION_ENABLED` | VPS | Télémétrie désactivée | `false` | non |

La clé d'API ORBIT utilisée par n8n (ADR-032) est stockée **dans les identifiants chiffrés de n8n**, jamais en variable d'environnement ni dans un workflow exporté vers `infra/n8n/workflows/`.

---

## 7. Gestion des secrets

### 7.1 Règles

1. **Jamais dans Git** : `.env`, `*.key`, `secrets/` figurent dans `.gitignore`. gitleaks tourne en pre-commit **et** en CI (§8). Un secret poussé par erreur est considéré compromis : rotation immédiate, la réécriture d'historique ne suffit pas.
2. **Jamais dans une image ni dans une couche de build** : pas de `ARG`/`ENV` sensibles dans les Dockerfiles.
3. **Fichiers secrets montés** sur le VPS, déclarés comme `secrets:` dans Compose et lus via `<NOM>_FILE` :

```
/etc/orbit/
└── production/
    ├── compose.env              # variables non sensibles (0640)
    └── secrets/                 # 0700, propriétaire root
        ├── database_url         # 0400, propriétaire = UID remappé du conteneur
        ├── mail_api_key
        ├── s3_secret_access_key
        └── ...
/etc/orbit-kek/                  # 0700 root, HORS de /etc/orbit, HORS sauvegarde
├── vault_kek.v1                 # 0400 (ADR-019)
└── integration_tokens_kek.v1    # 0400
```

4. **Montage minimal** : chaque conteneur ne reçoit que ses secrets. `VAULT_KEK` est monté **dans l'API seulement** (la révélation est une action synchrone et interactive) ; `INTEGRATION_TOKENS_KEK` dans l'API et le worker (synchronisations).
5. **Permissions** : avec Compose hors Swarm, un secret fichier est un montage en lecture seule qui conserve le propriétaire de l'hôte. Le fichier appartient donc à l'UID **remappé** du conteneur (par exemple `101000` pour l'UID 1000 avec `userns-remap`), en mode `0400`. Cela réalise l'intention d'ADR-019 (« root:600 » : lisible par un seul propriétaire) dans un contexte non root.
6. **Génération** : `pnpm secrets:gen-key` (32 octets aléatoires en base64, via `crypto.randomBytes`). Jamais de clé dérivée d'un mot de passe humain.
7. **Distribution** : les secrets sont saisis sur le VPS par l'administrateur via SSH (`install -m 0400 -o 101000 /dev/stdin …`). La CI ne connaît **que** la clé SSH de déploiement et le jeton GHCR ; elle ne transporte aucun secret applicatif. Vercel ne reçoit que des variables `VITE_*` publiques et, pour le build, `SENTRY_AUTH_TOKEN` (§6.5).
8. **Coffre personnel** : chaque secret d'infrastructure a une copie dans le gestionnaire de mots de passe de l'administrateur (Bitwarden ou équivalent), y compris `N8N_ENCRYPTION_KEY` : sans elle, les identifiants stockés par n8n sont irrécupérables après une restauration.

### 7.2 Clés maîtres (KEK) : règles spécifiques

- **Hors base** : la KEK n'est jamais en base, ni en variable d'environnement en clair, ni dans les logs.
- **Hors sauvegarde de la base** : `/etc/orbit-kek/` est **exclu** des sauvegardes restic (`--exclude`). Une restauration de la base seule ne permet donc jamais de déchiffrer le coffre.
- **Copie hors ligne** : imprimée (QR + base64) et placée dans un lieu physique sûr, plus une copie dans le gestionnaire de mots de passe, **séparée** du mot de passe restic.
- **Rotation versionnée** : ajout de `vault_kek.v2`, passage de `VAULT_KEK_VERSION=2`, re-chiffrement des DEK en tâche de fond, retrait de la v1 seulement quand plus aucune ligne ne la référence (runbook `rotate-kek`).

### 7.3 Rotation

| Secret | Fréquence | Déclencheur exceptionnel |
|---|---|---|
| Mots de passe PostgreSQL, Redis | 12 mois | départ, fuite, incident |
| Clés S3, e-mail, Meta, Google | 12 mois | fuite, alerte fournisseur |
| Clé SSH de déploiement CI | 6 mois | modification des mainteneurs |
| KEK coffre / jetons | 24 mois | suspicion de compromission |
| Mot de passe restic | jamais sans re-chiffrement de clé (`restic key add/remove`) | fuite |

---

## 8. CI/CD (GitHub Actions)

### 8.1 Flux

```
PR ──► ci.yml : install → lint/format → typecheck → unit → integration → isolation
                 → build (api + web) → audit → gitleaks → build image api (sans push) ─► merge autorisé
   └─► Vercel (intégration GitHub) : préversion du front pour la PR (API de staging)
main ─► deploy.yml : build & push image orbit-api:sha → staging API (migrations + up + smoke)
   │                 └─► [approbation manuelle "production"] → sauvegarde → migrations
   │                      → up → smoke API → avance la branche `production` au même SHA
   │                      → (échec ⇒ rollback)
   └─► Vercel : déploiement de `main` sur staging.orbit.example.com
production ─► Vercel : déploiement de production du front (après l'API) → smoke front
```

Branche `main` protégée : PR obligatoire, tous les checks verts, historique linéaire. Aucun push direct. La branche `production` n'est avancée **que** par `deploy.yml` (règle de protection : seul le jeton du workflow peut y pousser, en avance rapide).

**Le front n'est ni construit en image ni déployé par GitHub Actions** : c'est l'intégration GitHub de Vercel qui construit chaque PR, `main` et `production`. La CI garde néanmoins le lint, le typecheck, les tests et le build du web, qui restent bloquants pour le merge. L'API est toujours mise en production **avant** le front, ce qui suppose une API rétrocompatible avec le front N−1 (même règle expand/contract que les migrations, §9).

### 8.2 `ci.yml` : étapes et seuils

| # | Étape | Commande | Bloquante |
|---|---|---|---|
| 1 | Installation déterministe | `corepack enable && pnpm install --frozen-lockfile` | oui |
| 2 | Lint et format | `pnpm lint && pnpm format:check` | oui |
| 3 | Typecheck | `pnpm typecheck` (`tsc --noEmit`, mode strict) | oui |
| 4 | Tests unitaires et couverture | `pnpm test:unit --coverage` (≥ 80 % global, 100 % `packages/money` et domaine finance, ADR-021) | oui |
| 5 | Tests d'intégration | `pnpm test:integration` (Testcontainers PostgreSQL 17, puis Redis dès PHASE-08) | oui |
| 6 | Tests d'isolation | `pnpm test:isolation` (un test « A ne lit pas B » généré par route, ADR-021) | oui |
| 7 | Vérification de migration | `prisma migrate diff --exit-code` (schéma ↔ migrations) + migration sur base vide | oui |
| 8 | Build | `pnpm build` | oui |
| 9 | Audit des dépendances | `pnpm audit --prod --audit-level=high` | oui (high/critical) |
| 10 | Détection de secrets | `gitleaks/gitleaks-action` sur tout l'historique de la PR | oui |
| 11 | Build des images | `docker buildx build` des cibles `api` et `worker` (sans push) ; le front n'a pas d'image | oui |
| 12 | Scan des images | `trivy image --severity HIGH,CRITICAL --ignore-unfixed` | oui |
| 13 | Validation config | `caddy validate`, `docker compose config`, validation de `apps/web/vercel.json` contre son schéma JSON | oui |
| 14 | E2E Playwright | `pnpm test:e2e` : API et dépendances en conteneurs, front servi par `vite preview` avec le proxy `/api` (même origine) | oui sur `main`, facultative sur PR brouillon |

Extrait :

```yaml
# .github/workflows/ci.yml (extrait)
name: ci
on: { pull_request: {}, push: { branches: [main] } }
permissions: { contents: read }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }

jobs:
  checks:
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@<sha-épinglé>
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@<sha-épinglé>
        with: { node-version-file: .nvmrc }
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test:unit --coverage
      - run: pnpm test:integration     # Docker est disponible sur le runner
      - run: pnpm test:isolation
      - run: pnpm build
      - run: pnpm audit --prod --audit-level=high
      - uses: gitleaks/gitleaks-action@<sha-épinglé>
```

Règles CI : actions tierces **épinglées par SHA** ; `permissions` minimales par job ; aucun secret applicatif dans GitHub ; Dependabot (ou Renovate) hebdomadaire pour npm, Docker et Actions. Si la CI dépasse 5 minutes, introduire Turborepo (ADR-004) et paralléliser les jobs.

### 8.3 `deploy.yml` : staging puis production

```yaml
# .github/workflows/deploy.yml (extrait)
on: { workflow_run: { workflows: [ci], types: [completed], branches: [main] } }
jobs:
  images:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    permissions: { contents: read, packages: write }
    # build + push ghcr.io/<owner>/orbit-api:${{ sha }} (cibles api et worker)
  staging:
    needs: images
    environment: staging
    # ssh deploy@vps "orbit-deploy staging <sha>"
  production:
    needs: staging
    environment: production        # « Required reviewers » = propriétaire : promotion manuelle
    permissions: { contents: write } # avance de la branche production uniquement
    # ssh deploy@vps "orbit-deploy production <sha>"
    # puis : git push origin <sha>:refs/heads/production (avance rapide) → Vercel déploie le front
```

Le script `orbit-deploy` (versionné dans `infra/scripts/`, installé sur le VPS) est **la seule** porte d'entrée du déploiement. L'utilisateur SSH `deploy` n'a pas de shell libre : `command="/usr/local/bin/orbit-deploy-wrapper"` dans `authorized_keys`, qui n'accepte que `<env> <sha>` (SHA hexadécimal de 40 caractères).

### 8.4 Séquence d'un déploiement (`orbit-deploy <env> <sha>`)

1. Vérifier que le SHA est une image existante sur GHCR (`docker manifest inspect`) et noter le SHA courant dans `/var/lib/orbit/<env>/previous_sha`.
2. `docker compose pull` des images `:<sha>`.
3. **Sauvegarde pré-migration** (production uniquement) : `pg_dump -Fc` vers `/var/backups/orbit/pre-migrate-<sha>.dump`, puis `restic backup` de ce fichier. Si OD-7 retient Neon : création d'une branche Neon `pre-migrate-<sha>` (instantané) en plus du `pg_dump`. Échec ⇒ arrêt.
4. **Migrations contrôlées** : `docker compose run --rm migrate` (cible `api`, commande `prisma migrate deploy`, secret `DATABASE_MIGRATION_URL`). Échec ⇒ arrêt, l'ancienne version continue de tourner (compatible grâce à expand/contract, §9).
5. `docker compose up -d --wait` (attend les healthchecks).
6. **Smoke tests** (§8.6). Échec ⇒ rollback automatique de l'application (§8.5).
7. Journaliser le déploiement (SHA, date, durée, résultat) dans `/var/log/orbit/deploys.log` et notifier.

### 8.5 Rollback

- **Application** : `orbit-deploy <env> $(cat previous_sha)`, sans étape de migration descendante. C'est sûr car toute migration est **rétrocompatible avec la version N−1** (règle expand/contract).
- **Front** : *Instant Rollback* de Vercel vers le déploiement de production précédent (quelques secondes, sans rebuild). Si l'API est elle aussi ramenée en N−1, le front est ramené **d'abord**.
- **Base de données** : on ne rejoue **jamais** de migration « down » en production. Une migration fautive se corrige par une **nouvelle** migration (roll-forward).
- **Dernier recours** : restauration de `pre-migrate-<sha>.dump` (runbook `restore`), décision humaine, perte des écritures postérieures à annoncer.
- Les images des 10 derniers déploiements sont conservées sur le VPS et sur GHCR.

### 8.6 Smoke tests

Exécutés depuis le VPS contre l'URL publique, **en lecture seule** :

- `GET https://api.<domaine>/api/v1/health/live` → 200 ; `GET …/api/v1/health/ready` → 200.
- `GET https://orbit.<domaine>/api/v1/health/live` → 200 : la réécriture Vercel atteint bien l'API.
- `GET https://orbit.<domaine>/` → 200, contient le `VITE_APP_VERSION` attendu (après le déploiement Vercel du front).
- `GET /api/v1/me` sans cookie, via le front → 401 (le routage et l'auth répondent).
- En-têtes présents sur le front et sur l'API : `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`.
- **Staging seulement** : parcours Playwright complet avec un compte de test (connexion, création d'une tâche, d'une transaction fictive, isolation A/B).

---

## 9. Migrations en production

### 9.1 Rôles PostgreSQL

| Rôle | Droits | Utilisé par |
|---|---|---|
| `orbit_owner` | Propriétaire du schéma, DDL | Job de migration uniquement |
| `orbit_app` | `SELECT, INSERT, UPDATE, DELETE` sur les tables, `USAGE` sur les séquences ; aucun DDL | API et worker |
| `orbit_backup` | `pg_read_all_data` | `pg_dump` |

Les privilèges par défaut (`ALTER DEFAULT PRIVILEGES FOR ROLE orbit_owner … GRANT … TO orbit_app`) sont posés par la migration initiale. Les extensions `unaccent` et `pg_trgm` (ADR-017) sont créées par migration avec `orbit_owner`.

### 9.2 Règles

1. `prisma migrate deploy` uniquement hors local. `migrate dev`, `db push` et `migrate reset` sont **interdits** sur staging et production (le script de déploiement refuse).
2. **Sauvegarde avant migration** systématique en production (§8.4, étape 3).
3. **Expand/contract** : chaque changement destructif s'étale sur au moins deux déploiements.

| Changement | Déploiement N (expand) | Déploiement N+1 | Déploiement N+2 (contract) |
|---|---|---|---|
| Renommer une colonne | Ajouter la nouvelle colonne ; le code écrit dans les deux | Backfill par lots, lecture sur la nouvelle | Supprimer l'ancienne |
| Rendre une colonne `NOT NULL` | Ajouter la contrainte `CHECK … NOT VALID` | Backfill, `VALIDATE CONSTRAINT` | `SET NOT NULL` |
| Supprimer une table | Le code cesse de l'utiliser | — | `DROP TABLE` |

4. **Verrous** : chaque migration commence par `SET lock_timeout = '5s'; SET statement_timeout = '60s';`. Les index sur des tables volumineuses sont créés avec `CREATE INDEX CONCURRENTLY`, dans une migration qui ne contient **que** cette instruction (à vérifier avec la version de Prisma retenue).
5. **Backfills** : jamais dans la migration elle-même si la table dépasse 10 000 lignes ; script idempotent par lots, exécuté comme job.
6. **Revue** : toute migration est relue par l'agent `database-reviewer` et testée sur une copie de staging avant production.
7. **Traçabilité** : la table `_prisma_migrations` fait foi ; le rapport de phase liste les migrations ajoutées.

---

## 10. Durcissement du VPS

Système : Debian 12 ou Ubuntu 24.04 LTS, sur un **VPS OVH** en UE (ADR-038) : 2 vCPU, 4 Go de RAM au minimum avec 2 Go de swap (8 Go recommandés si le prix est proche), 40 Go de SSD. Le durcissement est scripté (`infra/provision/`, Ansible ou script shell idempotent) et **rejoué** à chaque provisionnement.

| Domaine | Mesure |
|---|---|
| **SSH** | Clés ed25519 uniquement ; `PasswordAuthentication no`, `PermitRootLogin no`, `KbdInteractiveAuthentication no` ; `AllowUsers admin deploy` ; port 22 limité par ufw (et, idéalement, accès via WireGuard ou Tailscale uniquement). |
| **Comptes** | `admin` (sudo, clé personnelle) ; `deploy` (sans sudo, commande forcée, §8.3). Aucun mot de passe utilisable pour SSH. |
| **Pare-feu** | `ufw default deny incoming` ; autorisés : 22 (restreint), 80, 443. Pare-feu de l'hébergeur en doublon. |
| **Docker et ufw** | Docker contourne ufw pour les ports publiés. Règle : **aucun `ports:` hors Caddy** dans le Compose de production ; contrôle en CI (`docker compose config` + script qui échoue si un autre service publie un port). |
| **Docker** | `userns-remap: "default"` dans `/etc/docker/daemon.json`, `"no-new-privileges": true`, `"live-restore": true`, `"log-driver": "json-file"` avec `max-size: 10m`, `max-file: 5`. Mode rootless envisageable, mais `userns-remap` est retenu pour sa compatibilité avec la liaison aux ports 80/443 et les volumes. |
| **Conteneurs** | `read_only: true` (avec `tmpfs: /tmp`), `cap_drop: [ALL]` (Caddy : `cap_add: [NET_BIND_SERVICE]`), `security_opt: [no-new-privileges:true]`, limites `mem_limit`/`cpus`. |
| **PostgreSQL / Redis** | Réseau `data` en `internal: true`, aucun port publié ; Redis protégé par mot de passe (`requirepass`) et ACL ; PostgreSQL : `password_encryption = scram-sha-256`. |
| **Mises à jour** | `unattended-upgrades` (sécurité seulement), redémarrage automatique à 04:30 UTC si requis ; images de base reconstruites chaque semaine par Renovate. |
| **Protection d'accès** | `fail2ban` (jails `sshd` et `caddy` sur les 401/429 répétés via logs JSON) ; rate limiting applicatif en plus. |
| **Système** | `auditd` minimal ; `chrony` (horloge juste : TOTP, signatures HMAC) ; fuseau `UTC` ; swap de 2 Go ; `vm.overcommit_memory=1` pour Redis. |
| **Disques** | Volumes Docker sous `/srv/orbit/<env>/` (et `/srv/orbit/n8n/`) ; alerte disque à 80 % (§12). Sur 40 Go : purge des images au-delà des 10 dernières, dumps locaux 3 jours. |

### 10.1 Budget mémoire du VPS

Chaque service a un `mem_limit` dans Compose (ADR-038). Valeurs de départ, à ajuster d'après `docker stats` après deux semaines de production.

| Service | Projet Compose | `mem_limit` | Remarques |
|---|---|---|---|
| `caddy` | production (partagé) | 64 Mo | TLS pour l'API, l'API de staging et n8n |
| `api` | production | 350 Mo | Node : `--max-old-space-size=256` |
| `worker` | production (PHASE-08) | 300 Mo | `--max-old-space-size=224` |
| `postgres` | production | 600 Mo | `shared_buffers=128MB`, `work_mem=4MB`, `max_connections=40` ; **absent si OD-7 retient Neon** |
| `redis` | production (PHASE-08) | 64 Mo | `maxmemory 48mb`, `noeviction` |
| `n8n` | production | 512 Mo | SQLite par défaut ; exécutions purgées après 14 jours (`EXECUTIONS_DATA_PRUNE`) |
| `uptime-kuma` | production | 150 Mo | |
| `api` + `worker` + `postgres` | staging | 200 + 200 + 256 Mo | arrêtés hors usage si la RAM manque |
| **Total production** | | **≈ 2,0 Go** (≈ 1,4 Go avec Neon) | |
| **Total avec staging** | | **≈ 2,7 Go** | |

Sur 4 Go, il reste environ 1 Go pour le système, Docker et le cache disque : le **swap de 2 Go** est obligatoire et une alerte se déclenche si son usage dépasse 50 % pendant 15 minutes (`orbit-diskcheck`, §12.5). Les sauvegardes (`pg_dump`, restic) tournent dans des conteneurs éphémères à 256 Mo. Si l'alerte de swap se répète, passer à 8 Go ou démarrer le staging à la demande seulement.

---

## 11. Sauvegardes et restauration

### 11.1 Objectifs (ADR-015)

- **RPO 24 h** : au plus 24 heures de données perdues.
- **RTO 4 h** : service rétabli en moins de 4 heures, depuis un VPS vierge.
- Aucune donnée financière réelle avant **une restauration testée et chronométrée** (fin de PHASE-03).

### 11.2 Quoi, comment, où

| Élément | Méthode | Fréquence |
|---|---|---|
| Base PostgreSQL | `pg_dump -Fc` avec `orbit_backup` (depuis un conteneur éphémère) | quotidienne, 02:15 UTC, + avant chaque migration |
| Fichiers (R2) | `rclone copy r2:orbit-prod-files /srv/orbit/backup/files-mirror` (incrémental), puis restic | quotidienne, après la base |
| n8n | volume `/srv/orbit/n8n` (base SQLite, identifiants chiffrés) via restic ; workflows aussi exportés dans `infra/n8n/workflows/` (Git) | quotidienne |
| Configuration non sensible | `/etc/orbit/<env>/compose.env`, Compose, Caddyfile, `apps/web/vercel.json` (déjà dans Git) | quotidienne |
| Secrets applicatifs | gestionnaire de mots de passe de l'administrateur | à chaque rotation |
| **KEK** | **exclues** de restic ; copie hors ligne (§7.2) | à chaque nouvelle version |

**Pourquoi `pg_dump` plutôt que pgBackRest** : avec un RPO de 24 heures et une base de quelques Go, un dump logique quotidien suffit, se restaure sur n'importe quelle version mineure de PostgreSQL 17 et se teste simplement. pgBackRest (archivage WAL, restauration à un instant donné) sera introduit si le RPO descend sous 24 heures ou si la base dépasse ~20 Go ; il fera alors l'objet d'une nouvelle ADR.

**Option Neon (OD-7, à trancher en PHASE-03)** : si la base est hébergée chez Neon (région UE), Neon assure les sauvegardes et la restauration à un instant donné, et le VPS est soulagé d'environ 600 Mo. Conséquences :

- le `pg_dump` local quotidien n'est plus le mécanisme principal de restauration ;
- un **export logique hebdomadaire hors Neon** est néanmoins **conservé** (`pg_dump -Fc` depuis le VPS avec `orbit_backup`, puis restic vers B2), pour ne pas dépendre d'un seul fournisseur et pour garder la restauration testable sur une base PostgreSQL ordinaire ; le dump pré-migration (§8.4) reste exigé ;
- la fenêtre de restauration à un instant donné de l'offre retenue (gratuite ou payante) doit couvrir au moins le RPO de 24 heures ; la latence VPS OVH ↔ Neon (même région UE) et le nombre de connexions (pooler Neon) sont mesurés en PHASE-03 ;
- le runbook `restore` décrit les deux chemins : restauration Neon (branche à un instant donné) et restauration depuis l'export hebdomadaire.

**Cohérence base/fichiers** : la base est sauvegardée **avant** les fichiers. Les objets sont immuables (clé = UUIDv7) et leur suppression physique est **différée de 30 jours** après la suppression logique. Ainsi, tout fichier référencé par un dump existe dans la copie de fichiers du même jour.

**Destination** : dépôt restic chiffré sur **Backblaze B2 (région UE)**, fournisseur distinct à la fois du VPS (OVH), de la base managée éventuelle (Neon) et du stockage de fichiers (Cloudflare R2).

- La clé B2 utilisée par le VPS **ne peut pas supprimer** de fichiers (clé applicative sans `deleteFiles`). Un ransomware sur le VPS ne peut donc pas effacer l'historique.
- Le `restic forget --prune` est exécuté **depuis le poste de l'administrateur** avec une seconde clé, une fois par mois.
- Le mot de passe restic est stocké dans le gestionnaire de mots de passe **et** sur papier, séparément de la KEK.

### 11.3 Rétention

`restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --keep-yearly 2`. Les dumps `pre-migrate-*` locaux sont conservés 14 jours. Cette politique est rappelée dans la politique de confidentialité (PHASE-17) : une donnée supprimée par l'utilisateur disparaît des sauvegardes au plus tard après 2 ans.

### 11.4 Script et supervision

Le script `infra/scripts/backup.sh`, lancé par un **timer systemd** (pas cron, pour bénéficier de `OnFailure=`) :

```bash
#!/usr/bin/env bash
set -euo pipefail
HC="https://hc-ping.com/${HC_BACKUP_UUID}"           # UUID fictif, lu depuis un fichier
curl -fsS -m 10 "$HC/start" >/dev/null || true
trap 'curl -fsS -m 10 "$HC/fail" >/dev/null || true' ERR

DUMP="/srv/orbit/backup/db/orbit-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose run --rm -T backup pg_dump -Fc -d orbit > "$DUMP"
pg_restore --list "$DUMP" >/dev/null                  # le dump est lisible
rclone copy r2-prod:orbit-prod-files /srv/orbit/backup/files-mirror --checksum
restic backup /srv/orbit/backup /srv/orbit/n8n /etc/orbit/production/compose.env \
  --exclude /etc/orbit-kek --tag daily
restic check --read-data-subset=1/30                  # vérification partielle tournante
find /srv/orbit/backup/db -name '*.dump' -mtime +3 -delete
curl -fsS -m 10 "$HC" >/dev/null
```

Le ping « succès » vers **Healthchecks.io** (ou son équivalent auto-hébergé) agit comme interrupteur d'homme mort : **l'absence** de ping sous 26 heures déclenche une alerte. C'est l'exigence « alerte si une sauvegarde attendue manque » (PRODUCT_SPEC §8.4).

### 11.5 Test de restauration mensuel chronométré

Le premier lundi de chaque mois (et obligatoirement à la fin de PHASE-03) :

1. Créer un VPS jetable (facturé à l'heure), sans accès au VPS de production.
2. Dérouler le runbook `restore` (§13.2) **chronomètre lancé**.
3. Vérifier : nombre de lignes des tables clés, somme des soldes de comptes égale à celle de production à l'instant du dump, ouverture de 5 fichiers tirés au hasard, connexion d'un compte de test.
4. Consigner dans `docs/ops/restore-tests.md` : date, dump utilisé, durée par étape, durée totale (cible < 4 h), écarts, actions correctives.
5. Détruire le VPS jetable et ses données.

Un test raté ou dépassant 4 heures bloque la phase en cours jusqu'à correction.

---

## 12. Observabilité

### 12.1 Logs

- **pino** (via `nestjs-pino`) en **JSON** sur stdout ; `pino-pretty` en local seulement.
- Champs systématiques : `time`, `level`, `msg`, `requestId`, `userId` (UUID, jamais l'e-mail), `route`, `statusCode`, `durationMs`, `jobId`/`jobType` côté worker, `appVersion`.
- **Rédaction obligatoire** (`redact`) : `req.headers.cookie`, `req.headers.authorization`, `*.password`, `*.token`, `*.secret`, `*.refreshToken`, `*.accessToken`, `body.*` sur les routes d'auth, du coffre et des intégrations. Aucun corps de requête financière n'est journalisé.
- Le `requestId` est propagé dans les jobs (`correlationId`, ADR-012) et dans les appels sortants (`X-Request-Id`).
- Rétention : rotation Docker (50 Mo par conteneur), conservation 14 jours sur disque. Une centralisation (Loki) n'est envisagée que si le volume le justifie.

### 12.2 Healthchecks

| Endpoint | Contrôle | Usage |
|---|---|---|
| `GET /api/v1/health/live` | Le processus répond ; aucune dépendance | Healthcheck Docker, Caddy |
| `GET /api/v1/health/ready` | `SELECT 1` PostgreSQL (timeout 1 s) ; `PING` Redis dès PHASE-08 ; migrations à jour | Smoke tests, Uptime Kuma |
| `GET /api/internal/ops-status` | JSON : jobs en échec 24 h, profondeur des files, âge de la dernière sauvegarde, intégrations en erreur. Exige `Authorization: Bearer <OPS_STATUS_TOKEN>` | Uptime Kuma (mot-clé JSON) |

Les réponses publiques ne détaillent pas les dépendances (`{ "status": "ok" }` ou 503), pour ne pas renseigner un attaquant. Le worker expose un healthcheck de vivacité sur un port interne.

### 12.3 Métriques

`prom-client` sur `METRICS_PORT` (9464), réseau interne seulement :

- HTTP : `http_requests_total{route,method,status}`, histogramme `http_request_duration_seconds`.
- Files (PHASE-08) : `queue_jobs_waiting`, `queue_jobs_failed_total`, `queue_job_duration_seconds` par file.
- Métier technique : `backup_last_success_timestamp`, `integration_sync_failures_total{provider}`, `outbox_pending`.
- Processus : mémoire, boucle d'événements (`collectDefaultMetrics`).

Jusqu'à PHASE-08, ces métriques sont consultées via `ops-status`. Si un tableau de bord devient utile, ajouter **VictoriaMetrics single-node + Grafana** (≈ 300 Mo de RAM) sur le VPS, ce qui suppose le passage à 8 Go (§10.1), ou une offre SaaS gratuite en région UE.

### 12.4 Outils retenus

| Besoin | Outil | Hébergement | Justification |
|---|---|---|---|
| Disponibilité, certificats TLS, mots-clés JSON | **Uptime Kuma** | VPS OVH (le même que la production, ADR-038) | Léger (~150 Mo), notifications e-mail et Telegram natives. Il surveille les URL **publiques** (front Vercel, réécriture `/api`, `api.<domaine>`, `n8n.<domaine>`). Limite : hébergé sur le serveur surveillé, il ne voit pas une panne complète du VPS ; d'où le battement ci-dessous. |
| Panne complète du VPS | **Healthchecks.io** (battement) | SaaS | Uptime Kuma (moniteur « push » inversé) ou un timer systemd ping Healthchecks.io toutes les 5 minutes ; l'absence de ping pendant 10 minutes déclenche l'alerte. |
| Erreurs applicatives (front et back) | **Sentry SaaS**, offre gratuite, **région UE** | SaaS | Remplace GlitchTip (ADR-038) : plus de VPS « ops » à maintenir. Deux projets : `api` (`@sentry/node`, API et worker) et `web` (`@sentry/react`). Quota de l'offre gratuite à surveiller ; au-delà, les événements sont abandonnés, pas facturés. |
| Tâches planifiées (sauvegardes, renouvellement des canaux push) | **Healthchecks.io** (offre gratuite) | SaaS | Interrupteur d'homme mort indépendant de toute l'infrastructure ORBIT. |

Règles d'envoi vers Sentry (front et back) : `sendDefaultPii: false` ; `beforeSend` qui supprime cookies, en-têtes d'auth, corps de requête, chaînes de requête et toute donnée utilisateur hors `user.id` (UUID) ; Session Replay désactivé ; échantillonnage des traces à 0 en production (erreurs seulement) ; source maps envoyées au build puis retirées du déploiement public. Le nettoyage des données personnelles est aussi activé côté serveur Sentry (*Data Scrubber*).

### 12.5 Alertes

| Alerte | Source | Seuil | Canal |
|---|---|---|---|
| Sauvegarde manquante ou échouée | Healthchecks.io | aucun ping succès en 26 h, ou ping `fail` | e-mail + Telegram |
| Site indisponible | Uptime Kuma | `/api/v1/health/ready` (via le front et via `api.<domaine>`) en échec 3 fois sur 3 min, ou front Vercel ≠ 200 | e-mail + Telegram |
| VPS injoignable | Healthchecks.io (battement) | aucun ping pendant 10 min | e-mail + Telegram |
| Certificat TLS | Uptime Kuma | expiration < 14 jours (`api.<domaine>`, `n8n.<domaine>`) | e-mail |
| Erreurs 5xx | Sentry + `ops-status` | nouvelle issue, ou > 1 % de 5xx sur 15 min | e-mail |
| Mémoire | script `orbit-diskcheck` → Healthchecks.io `/fail` | swap > 50 % pendant 15 min, ou conteneur tué pour dépassement de `mem_limit` | e-mail |
| Jobs en échec | `ops-status` | > 0 job en file `failed` depuis plus de 1 h (après retries) | e-mail |
| Disque | script `orbit-diskcheck` (timer 15 min) → Healthchecks.io `/fail` | > 80 % sur `/` ou `/srv` | e-mail + Telegram |
| Intégrations | `ops-status` | > 10 % d'utilisateurs Google en `REAUTH_REQUIRED` en 24 h | e-mail |

Chaque alerte renvoie vers son runbook (§13).

---

## 13. Runbooks

### 13.1 Liste à produire (dossier `docs/runbooks/`)

| Runbook | Phase | Contenu |
|---|---|---|
| `provision-vps.md` | 03 | Provisionnement et durcissement d'un VPS vierge |
| `deploy.md` | 03 | Déploiement manuel, vérifications, promotion |
| `rollback.md` | 03 | Retour à la version N−1, critères de décision |
| `restore.md` | 03 | Restauration complète base + fichiers (squelette ci-dessous) |
| `backup-failure.md` | 03 | Diagnostic d'une sauvegarde manquante |
| `disk-full.md` | 03 | Purge des images, logs, dumps locaux |
| `incident-response.md` | 03 | Qualification, confinement, communication, post-mortem |
| `secret-rotation.md` | 03 | Rotation de chaque type de secret |
| `failed-jobs.md` | 08 | Inspection, rejeu idempotent, purge d'une file |
| `rotate-kek.md` | 13 | Rotation de la KEK du coffre et des jetons |
| `integration-outage.md` | 14 | Panne Google, vague d'`invalid_grant`, renouvellement des canaux push |
| `webhook-replay.md` | 14 | Rejeu contrôlé d'événements `webhook_events` |
| `whatsapp-incident.md` | 16 | Numéro bloqué, modèle refusé, signature invalide |
| `account-deletion.md` | 17 | Suppression de compte et purge des sauvegardes |

### 13.2 Squelette du runbook `restore.md`

```markdown
# Runbook : restauration complète d'ORBIT

- Cible : RTO 4 h, RPO 24 h. Chronométrer chaque étape.
- Prérequis hors VPS : accès B2 (clé lecture), mot de passe restic, KEK (copie hors ligne),
  secrets applicatifs (gestionnaire de mots de passe), accès DNS, dépôt Git.

## 0. Décider (≤ 15 min)
- [ ] Qualifier : panne VPS, corruption de données, compromission ?
- [ ] Si compromission : NE PAS restaurer sur le même VPS ; faire tourner tous les secrets (secret-rotation.md).
- [ ] Choisir le point de restauration (`restic snapshots --tag daily`) et l'annoncer.
- [ ] Mettre la page de maintenance (déploiement Vercel de maintenance, ou `respond 503` sur `api.<domaine>`).
- [ ] Si OD-7 a retenu Neon : restaurer d'abord par une branche Neon à l'instant choisi ; l'export hebdomadaire n'est utilisé que si Neon est indisponible.

## 1. Préparer l'hôte (≤ 60 min)
- [ ] Provisionner un VPS UE (provision-vps.md), durcissement compris.
- [ ] Installer Docker, restic, rclone ; cloner le dépôt au tag déployé.
- [ ] Déposer les secrets dans /etc/orbit/production/secrets (0400) et la KEK dans /etc/orbit-kek.

## 2. Restaurer les données (≤ 90 min)
- [ ] `restic restore <snapshot> --target /srv/orbit/restore`
- [ ] Démarrer uniquement postgres ; créer les rôles (orbit_owner, orbit_app, orbit_backup).
- [ ] `pg_restore --clean --if-exists --no-owner --role=orbit_owner -d orbit <dump>`
- [ ] `prisma migrate status` : aucune migration en attente ni divergente.
- [ ] Recopier les fichiers vers le bucket : `rclone copy files-mirror r2-prod:orbit-prod-files`
      (ou vers un nouveau bucket, puis mettre à jour S3_BUCKET).

## 3. Redémarrer (≤ 30 min)
- [ ] `orbit-deploy production <sha du snapshot>` (sans migration supplémentaire).
- [ ] Mettre à jour le DNS de `api.<domaine>` et `n8n.<domaine>` si l'IP change (TTL abaissé à 300 s à l'avance) ; le front Vercel n'est pas touché.
- [ ] Restaurer `/srv/orbit/n8n` et vérifier que n8n déchiffre ses identifiants (`N8N_ENCRYPTION_KEY`).

## 4. Vérifier (≤ 30 min)
- [ ] Smoke tests (INFRASTRUCTURE.md §8.6).
- [ ] Contrôles : nombre de lignes, somme des soldes, 5 fichiers ouverts, connexion test.
- [ ] Révélation d'un secret de test du coffre (prouve que la KEK correspond).
- [ ] Healthchecks.io et Uptime Kuma au vert ; relancer une sauvegarde complète.

## 5. Clôturer
- [ ] Retirer la maintenance ; informer les utilisateurs (perte éventuelle depuis <heure du dump>).
- [ ] Consigner durées et écarts dans docs/ops/restore-tests.md ; post-mortem sous 5 jours.
```

---

## 14. Coûts mensuels indicatifs

Ordres de grandeur à **vérifier** au moment de la souscription (prix HT, octobre 2026 estimé).

| Poste | Choix | Coût / mois |
|---|---|---|
| Front | Vercel **Hobby** (gratuit). **Attention** : l'offre Hobby est réservée à un usage non commercial ; un usage commercial (ouverture payante, module Pro facturé à des tiers) requiert l'offre **Pro**, environ 20 $ par mois et par membre. Conditions et limites (durée des réécritures, bande passante, builds) **à vérifier** à la souscription | 0 € (Hobby) ou ~20 $ (Pro) |
| VPS (production + staging + n8n + Uptime Kuma) | OVH, UE : 2 vCPU, 4 Go + 2 Go de swap, 40 Go SSD (8 Go recommandés si le prix est proche) | ≈ 5 à 12 € |
| Sauvegarde/snapshot hébergeur | Option de sauvegarde automatique OVH, si disponible sur la gamme | 0 à 3 € |
| Base de données (OD-7) | PostgreSQL sur le VPS (0 €) **ou** Neon région UE : offre gratuite (stockage, calcul et fenêtre de restauration limités) ou offre payante d'entrée de gamme | 0 € à ≈ 20 $ |
| Erreurs applicatives | Sentry SaaS, offre gratuite (quota mensuel d'événements, un utilisateur) | 0 € |
| Stockage de fichiers | Cloudflare R2 (UE), 10 Go gratuits puis ~0,015 $/Go | 0 à 2 € |
| Sauvegardes | Backblaze B2 (UE), ~6 $/To, quelques dizaines de Go | < 1 € |
| E-mail transactionnel | Brevo (offre gratuite 300 mails/jour) ou Resend (3 000/mois) | 0 à 20 € |
| Domaine | `.com` ou équivalent | ~1 € |
| Healthchecks.io, GitHub (dépôt privé, Actions dans le quota), GHCR | offres gratuites | 0 € |
| **Total hors intégrations payantes** | Hobby, PostgreSQL sur le VPS → Pro + Neon payant | **≈ 7 à 80 €** |
| WhatsApp Business Platform (PHASE-16) | Facturation Meta par message modèle (`INTEGRATIONS.md`) | variable |
| API Claude (PHASE-16) | À l'usage, plafond mensuel configuré | variable |
| Évaluation de sécurité Gmail (CASA), si Gmail est ouvert au public | Annuelle, par un évaluateur agréé | à chiffrer (voir `INTEGRATIONS.md`) |

---

## 15. Mise en place en PHASE-03

PHASE-03 transforme le socle (PHASE-00 à 02) en production continue **avant** toute donnée financière réelle (ADR-015). Tâches dans l'ordre, chacune d'au plus une demi-journée :

| # | Tâche | Livrable | Dépend de |
|---|---|---|---|
| T1 | Choisir et ouvrir les comptes : VPS OVH (UE), Vercel (offre Hobby ou Pro selon l'usage, §14), Sentry (région UE), Cloudflare R2, Backblaze B2, fournisseur d'e-mail (Brevo ou Resend, décision consignée en ADR, ADR-014), Healthchecks.io. **Trancher OD-7** (PostgreSQL sur le VPS ou Neon UE) et consigner la décision en ADR | ADR « fournisseurs » + ADR OD-7 | — |
| T2 | Domaine, DNS (`orbit` et `staging.orbit` vers Vercel ; `api`, `api-staging` et `n8n` vers le VPS), SPF, DKIM, DMARC (`p=quarantine`) pour l'e-mail | DNS opérationnel | T1 |
| T3 | Dockerfile `api`/`worker`, `.dockerignore`, Caddyfile (API, API de staging, n8n), `compose.prod.yml` et `compose.staging.yml` (réseaux `edge`/`data`, `read_only`, `cap_drop`, `mem_limit` du §10.1) | Image construite en CI | — |
| T4 | **Projet Vercel** : Root Directory `apps/web`, install et build pnpm du monorepo, `apps/web/vercel.json` (réécriture `/api`, en-têtes, cache du service worker et du manifeste), domaines `orbit` et `staging.orbit`, branche de production `production`, *Deployment Protection* des préversions, destination de la réécriture par environnement. **Vérifier** : transmission de `Set-Cookie` (`__Host-orbit_sid`) à travers la réécriture, durée maximale d'une réécriture externe, taille maximale du corps, `X-Forwarded-For` reçu par l'API | Préversion de PR fonctionnelle, connexion de bout en bout en staging, résultats consignés dans le rapport de phase | T2, T3 |
| T5 | Schéma Zod de configuration complet (`APP_ORIGIN`, `API_PUBLIC_URL`, `SENTRY_DSN`…), variantes `_FILE`, `.env.example`, contrôle CI de cohérence | Tests de config verts | — |
| T6 | Scripts de provisionnement et durcissement (§10) du VPS OVH, swap de 2 Go | `provision-vps.md` | T1 |
| T7 | Rôles PostgreSQL `orbit_owner` / `orbit_app` / `orbit_backup`, migration des privilèges par défaut (sur le VPS ou sur Neon selon OD-7) | Migration relue | T3 |
| T8 | `deploy.yml`, GHCR, environnements GitHub `staging` et `production` (relecteur requis), avance de la branche `production`, utilisateur `deploy` à commande forcée, `orbit-deploy` | Premier déploiement staging automatique (API et front) | T3, T4, T6 |
| T9 | Adaptateur `StoragePort` S3 (R2) et `MailPort` du fournisseur, testés en staging | Upload et e-mail réels en staging | T1, T8 |
| T10 | Health endpoints, `ops-status`, logs pino avec rédaction, `requestId` de bout en bout, `prom-client` | Tests d'intégration verts | — |
| T11 | Observabilité : Uptime Kuma sur le VPS, battement Healthchecks.io, projets Sentry SaaS `api` et `web` (région UE, nettoyage des données personnelles, source maps), alertes du §12.5 | Alerte de test reçue ; événement Sentry de test sans donnée personnelle | T6, T10 |
| T12 | **n8n sur le VPS** : conteneur avec `mem_limit`, `n8n.<domaine>` derrière Caddy, compte propriétaire avec MFA, éditeur restreint par IP ou VPN, `N8N_ENCRYPTION_KEY` (copie hors ligne), clé d'API ORBIT à portée limitée (ADR-032, disponible en PHASE-14 : avant, n8n n'appelle pas l'API), dossier `infra/n8n/workflows/` | n8n joignable seulement après authentification ; accès refusé hors IP autorisées | T3, T6 |
| T13 | Sauvegardes : `backup.sh` (base, fichiers, n8n), timer systemd, clé B2 sans suppression, rétention, Healthchecks.io ; si Neon : export logique hebdomadaire hors Neon | Première sauvegarde visible dans `restic snapshots` | T1, T6 |
| T14 | **Test de restauration complet chronométré** sur VPS jetable, consigné | `docs/ops/restore-tests.md`, durée < 4 h | T13 |
| T15 | Promotion manuelle en production (API puis front), smoke tests, test de rollback volontaire (N → N−1 → N), y compris *Instant Rollback* Vercel | Production en ligne, rollback prouvé | T8, T14 |
| T16 | Runbooks de la phase (§13.1, ligne « 03 ») | Dossier `docs/runbooks/` | T15 |

**Definition of Done de l'infrastructure (PHASE-03)** :

- [ ] `https://orbit.example.com` (Vercel) et `https://api.example.com` en HTTPS, note A+ sur un test d'en-têtes de sécurité pour le front, aucun port autre que 22/80/443 ouvert sur le VPS (vérifié par `nmap` depuis l'extérieur).
- [ ] La connexion fonctionne à travers la réécriture Vercel : le cookie `__Host-orbit_sid` est posé sur l'origine du front, aucun en-tête CORS n'est émis, et un appel direct à `api.example.com` n'emporte aucun cookie.
- [ ] Les limites Vercel (durée des réécritures, taille du corps) sont mesurées et consignées ; les traitements qui les dépassent passent par un job.
- [ ] n8n n'est accessible qu'authentifié, depuis les IP autorisées ; le budget mémoire du §10.1 est respecté (`docker stats` consigné).
- [ ] OD-7 est tranchée et consignée en ADR.
- [ ] Un merge sur `main` déploie staging (API et front) sans intervention ; la production exige une approbation.
- [ ] Une migration a été déployée avec sauvegarde préalable ; un rollback applicatif a été exécuté.
- [ ] Une sauvegarde quotidienne existe chez B2 ; son absence déclenche une alerte (testé en suspendant le timer).
- [ ] La restauration complète a été réalisée sur un VPS vierge en moins de 4 heures, et consignée.
- [ ] Les alertes du §12.5 ont chacune été déclenchées une fois volontairement.
- [ ] Aucun secret dans Git, les images ou les logs (gitleaks, `docker history`, revue d'un échantillon de logs).
- [ ] La KEK et le mot de passe restic ont une copie hors ligne, vérifiée par une seconde personne ou une relecture.
- [ ] Rapport `docs/progress/PHASE-03-REPORT.md` rédigé.

### Évolutions ultérieures

| Phase | Ajout d'infrastructure |
|---|---|
| PHASE-08 | Redis (`noeviction`, AOF, mot de passe), conteneur `worker`, métriques de files, alerte jobs en échec, `RATE_LIMIT_STORE=redis` |
| PHASE-09 | Limites d'upload, analyse de type MIME ; antivirus (ClamAV, ~1 Go de RAM) à évaluer |
| PHASE-13 | Fichiers KEK, exclusion restic vérifiée, runbook `rotate-kek` |
| PHASE-14 | Endpoints webhooks (`rawBody`) exposés directement sur `api.<domaine>` (jamais via la réécriture Vercel), clients OAuth par environnement, renouvellement des canaux push, clé d'API de n8n |
| PHASE-16 | Service de transcription éventuel (conteneur dédié), plafonds de coûts IA et WhatsApp |
| PHASE-17 | Réévaluation RLS, quotas, purge des sauvegardes pour la suppression de compte |
