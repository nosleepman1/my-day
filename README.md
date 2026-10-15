# ORBIT

SaaS d'organisation personnelle : finances (espèces, mobile money, banque), idées, tâches, projets, notes, calendrier, rappels, intégrations mail et calendrier, assistant IA. Chaque utilisateur dispose de son espace privé. Une zone Dev (inventaire technique et coffre-fort) est réservée à l'administrateur.

## État

Développement en 18 phases (voir [docs/ROADMAP.md](docs/ROADMAP.md)). Le socle technique (PHASE-00) et l'identité (PHASE-01 : comptes, sessions, isolation, audit) sont en place ; le shell web (PHASE-02 : design system, navigation, pages d'authentification et de paramètres) est en cours. Le dernier rapport est dans [docs/progress/](docs/progress/).

## Stack

- **Monorepo pnpm :** `apps/api`, `apps/web`, `packages/contracts`, `packages/money`, `packages/config`
- **API :** NestJS 11 (Express), Prisma 6, PostgreSQL 17, Zod 4, pino. Redis et BullMQ arrivent en PHASE-08.
- **Web :** React 19, Vite 7, TypeScript, Tailwind CSS 4, React Router 7, TanStack Query 5.
- **Tests :** Vitest 4 (transpilation TypeScript pour l'API, happy-dom pour le web), Testcontainers, fast-check, Playwright.
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

- Front : http://localhost:5173 (connexion et inscription) ; http://localhost:5173/status affiche « API OK » quand toute la chaîne fonctionne
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
| `pnpm build` | Build des paquets, de l'API (`tsc`) et du front (Vite) |
| `pnpm ci:local` | Rejoue toute la CI en local (audit, lint, types, tests, build, E2E isolé sur une base Docker dédiée) |

## Compte administrateur

L'inscription dépend de `REGISTRATION_MODE` (`closed`, `allowlist`, `open`, ADR-026). Le rôle ADMIN ne s'obtient jamais par l'interface : après avoir créé et vérifié le compte, compilez l'API puis lancez :

```bash
pnpm --filter @orbit/api build
```

```bash
pnpm --filter @orbit/api cli create-admin --email vous@exemple.sn
```

Un seul ADMIN existe ; `--force` transfère le rôle à une autre adresse. L'opération est auditée.

## Documentation

Commencer par [docs/00-INDEX.md](docs/00-INDEX.md). Les agents IA suivent [AGENTS.md](AGENTS.md). Les rapports de fin de phase sont dans [docs/progress/](docs/progress/).
