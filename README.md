# ORBIT

SaaS d'organisation personnelle : finances (espèces, mobile money, banque), idées, tâches, projets, notes, calendrier, rappels, intégrations mail et calendrier, assistant IA. Chaque utilisateur dispose de son espace privé. Une zone Dev (inventaire technique et coffre-fort) est réservée à l'administrateur.

## État

Développement en 18 phases (voir [docs/ROADMAP.md](docs/ROADMAP.md)). Le socle technique (PHASE-00) est en place : monorepo, API NestJS, front React, contrats partagés, calculs monétaires, tests et CI.

## Stack

- **Monorepo pnpm :** `apps/api`, `apps/web`, `packages/contracts`, `packages/money`, `packages/config`
- **API :** NestJS 11 (Express), Prisma 6, PostgreSQL 17, Zod 4, pino. Redis et BullMQ arrivent en PHASE-08.
- **Web :** React 19, Vite 7, TypeScript, Tailwind CSS 4, React Router 7, TanStack Query 5.
- **Tests :** Vitest 3 (SWC pour l'API, happy-dom pour le web), Testcontainers, fast-check, Playwright.
- **Exploitation :** front sur Vercel, API, worker et n8n sur un VPS (ADR-038).

## Prérequis

- Node.js 24 (voir `.nvmrc`) et pnpm via Corepack : `corepack enable`
- Docker Desktop démarré (PostgreSQL et Mailpit en local, Testcontainers pour les tests d'intégration)

## Démarrage en 5 commandes

```bash
pnpm install
```

```bash
cp .env.example apps/api/.env
```

```bash
pnpm infra:up
```

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

- Front : http://localhost:5173 (la page affiche « API OK » quand toute la chaîne fonctionne)
- API : http://localhost:3000/api/v1/health/live
- Mailpit : http://localhost:8025
- PostgreSQL de développement : port **5433** sur la machine, pour ne pas entrer en conflit avec un PostgreSQL déjà installé.

## Commandes utiles

| Commande | Effet |
|---|---|
| `pnpm lint` / `pnpm format:check` | ESLint (règles ORBIT) et Prettier |
| `pnpm typecheck` | Vérification TypeScript de tout le monorepo |
| `pnpm depcruise` | Règles d'architecture (dépendances interdites) |
| `pnpm test` | Tests unitaires et d'architecture |
| `pnpm test:cov` | Tests avec couverture (100 % exigé sur `packages/money`) |
| `pnpm test:int` | Tests d'intégration de l'API sur PostgreSQL réel (Docker requis) |
| `pnpm test:e2e` | Tests de bout en bout Playwright (base de développement démarrée et migrée) |
| `pnpm infra:down` / `pnpm infra:reset` | Arrêter, ou réinitialiser la base locale |
| `pnpm build` | Build des paquets, de l'API (SWC) et du front (Vite) |
| `pnpm ci:local` | Rejoue toute la CI en local (audit, lint, types, tests, build, E2E isolé sur une base Docker dédiée) |

## Documentation

Commencer par [docs/00-INDEX.md](docs/00-INDEX.md). Les agents IA suivent [AGENTS.md](AGENTS.md). Les rapports de fin de phase sont dans [docs/progress/](docs/progress/).
