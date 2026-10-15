# syntax=docker/dockerfile:1.7
# Image de production de l'API et du worker (INFRASTRUCTURE.md §4.2, ADR-012, ADR-038).
# Construite depuis la racine du monorepo : docker build -f apps/api/Dockerfile --target api .
# Pas d'image `web` : le front est construit et servi par Vercel.

# Node 24 LTS (crypto.argon2 exige Node >= 24.7, ADR-039). Épingler par digest dans la CI (Renovate).
ARG NODE_IMAGE=node:24.12.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    HUSKY=0
# OpenSSL dès le build : Prisma choisit son moteur (openssl-3.0.x) selon la bibliothèque détectée.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /repo

# Dépendances puis build de l'API et des paquets partagés qu'elle utilise. `pnpm deploy --legacy` lie les
# paquets de l'espace de travail par liens symboliques vers /repo : ils sont remplacés par une copie réelle
# (package.json + dist), sinon l'image ne démarre pas.
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@orbit/api..."
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter "@orbit/api^..." build \
 && pnpm --filter @orbit/api build \
 && pnpm --filter @orbit/api deploy --prod --legacy /out \
 && for pkg in contracts money; do \
      rm -rf "/out/node_modules/@orbit/${pkg}" \
      && mkdir -p "/out/node_modules/@orbit/${pkg}" \
      && cp -r "packages/${pkg}/package.json" "packages/${pkg}/dist" "/out/node_modules/@orbit/${pkg}/"; \
    done \
 && cd /out && node_modules/.bin/prisma generate --schema prisma/schema.prisma \
 && rm -rf /out/src /out/test /out/tsconfig*.json /out/vitest*.ts /out/nest-cli.json /out/.env*

# Exécution : ni compilateur, ni pnpm, ni sources TypeScript, ni .env ; utilisateur non root.
FROM ${NODE_IMAGE} AS runtime
ARG APP_VERSION=dev
ARG SOURCE_URL=https://github.com/example/orbit
LABEL org.opencontainers.image.revision=$APP_VERSION \
      org.opencontainers.image.source=$SOURCE_URL \
      org.opencontainers.image.title="orbit-api"
ENV NODE_ENV=production \
    APP_VERSION=$APP_VERSION \
    NODE_OPTIONS="--max-old-space-size=256"
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=1000:1000 /out ./
USER 1000:1000
ENTRYPOINT ["/usr/bin/tini", "--"]

FROM runtime AS api
EXPOSE 3000
# Sonde de vivacité sans curl : `node -e` (INFRASTRUCTURE.md §4.1).
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]

FROM runtime AS worker
ENV NODE_OPTIONS="--max-old-space-size=224"
CMD ["node", "dist/worker.js"]
