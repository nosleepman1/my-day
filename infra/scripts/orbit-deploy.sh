#!/usr/bin/env bash
# Seule porte d'entrée du déploiement de l'API sur le VPS (INFRASTRUCTURE.md §8.3 à §8.5).
#   orbit-deploy <staging|production> <sha-40-hex>   déploie l'image orbit-api:<sha>
#   orbit-deploy rollback <staging|production>        redéploie le SHA précédent, sans migration
# Installé en /usr/local/bin/orbit-deploy ; appelé par la CI via orbit-deploy-wrapper (commande forcée).
# Garde-fous (revue PHASE-03, H2) : le SHA doit appartenir à `main`, et la production n'accepte qu'un
# SHA déjà déployé avec succès en staging.
set -Eeuo pipefail

REPO_DIR="${ORBIT_REPO_DIR:-/opt/orbit/repo}"
SCRIPTS_DIR="${REPO_DIR}/infra/scripts"
LIB_DIR="/usr/local/lib/orbit"
LOG_FILE="${ORBIT_DEPLOY_LOG:-/var/log/orbit/deploys.log}"

die() {
  echo "orbit-deploy: $*" >&2
  exit 1
}

log_result() {
  printf '%s env=%s sha=%s result=%s duration=%ss\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$3" "$4" >>"$LOG_FILE"
}

compose() {
  local env_name="$1"
  shift
  docker compose -f "${REPO_DIR}/infra/compose/compose.${env_name}.yml" \
    --env-file "/etc/orbit/${env_name}/compose.env" "$@"
}

# Le dépôt local (clé de déploiement GitHub en lecture seule) fournit Compose, Caddyfile et scripts du SHA,
# à condition que ce SHA soit sur `main` (branche protégée, revue obligatoire).
checkout_infra() {
  git -C "$REPO_DIR" fetch --quiet origin main
  git -C "$REPO_DIR" merge-base --is-ancestor "$1" origin/main || die "${1} is not on main"
  git -C "$REPO_DIR" checkout --quiet --detach "$1"
}

state() { cat "/var/lib/orbit/${1}/${2}" 2>/dev/null || true; }

# Scripts lancés par les timers systemd : copie figée de la version de production vérifiée.
install_runtime_scripts() {
  install -d -m 0755 "$LIB_DIR"
  install -m 0755 "${SCRIPTS_DIR}/backup.sh" "${SCRIPTS_DIR}/diskcheck.sh" "$LIB_DIR/"
}

deploy() {
  local env_name="$1" sha="$2" start previous
  start=$(date +%s)
  mkdir -p "/var/lib/orbit/${env_name}"
  # shellcheck disable=SC1091
  source /etc/orbit/deploy.env # GHCR_OWNER (non secret)
  export GHCR_OWNER ORBIT_SHA="$sha"
  local image="ghcr.io/${GHCR_OWNER}/orbit-api:${sha}"

  if [[ "$env_name" == "production" && "$(state staging current_sha)" != "$sha" ]]; then
    die "${sha} has not been deployed successfully to staging"
  fi
  docker manifest inspect "$image" >/dev/null || die "image ${image} not found on GHCR"
  previous=$(state "$env_name" current_sha)
  checkout_infra "$sha"
  # Réseau public du staging, partagé avec Caddy (projet production) : créé une fois, idempotent.
  docker network inspect orbit-edge-staging >/dev/null 2>&1 || docker network create orbit-edge-staging >/dev/null
  compose "$env_name" pull --quiet api migrate
  compose "$env_name" up -d --wait postgres

  # Sauvegarde pré-migration (§8.4, étape 3) ; rien à sauvegarder au tout premier déploiement.
  if [[ "$env_name" == "production" && -n "$previous" ]]; then
    "${SCRIPTS_DIR}/backup.sh" --env production --pre-migrate "$sha"
  fi

  # Migration contrôlée : un échec laisse l'ancienne version en service (expand/contract, §9).
  if ! compose "$env_name" run --rm migrate; then
    log_result "$env_name" "$sha" migration-failed $(($(date +%s) - start))
    [[ -n "$previous" ]] && checkout_infra "$previous"
    die "migration failed; previous version ${previous:-none} still serving"
  fi

  compose "$env_name" up -d --wait --remove-orphans
  if ! "${SCRIPTS_DIR}/smoke.sh" "$env_name" --api-version "$sha"; then
    log_result "$env_name" "$sha" smoke-failed $(($(date +%s) - start))
    if [[ -n "$previous" ]]; then
      echo "orbit-deploy: smoke tests failed, rolling back to ${previous}" >&2
      checkout_infra "$previous"
      ORBIT_SHA="$previous" compose "$env_name" up -d --wait --remove-orphans
    fi
    die "smoke tests failed for ${sha}"
  fi

  if [[ -n "$previous" && "$previous" != "$sha" ]]; then
    echo "$previous" >"/var/lib/orbit/${env_name}/previous_sha"
  fi
  echo "$sha" >"/var/lib/orbit/${env_name}/current_sha"
  [[ "$env_name" == "production" ]] && install_runtime_scripts
  log_result "$env_name" "$sha" success $(($(date +%s) - start))
  # Conserver les 10 dernières images (§8.5).
  docker image ls "ghcr.io/${GHCR_OWNER}/orbit-api" --format '{{.Tag}}' | tail -n +11 |
    xargs -r -I{} docker image rm "ghcr.io/${GHCR_OWNER}/orbit-api:{}" >/dev/null 2>&1 || true
}

rollback() {
  local env_name="$1" previous start
  previous=$(state "$env_name" previous_sha)
  [[ -n "$previous" ]] || die "no previous deployment recorded for ${env_name}"
  start=$(date +%s)
  # shellcheck disable=SC1091
  source /etc/orbit/deploy.env
  export GHCR_OWNER ORBIT_SHA="$previous"
  # Configuration ET image du SHA précédent ; jamais de migration descendante (§8.5).
  checkout_infra "$previous"
  compose "$env_name" up -d --wait --remove-orphans
  "${SCRIPTS_DIR}/smoke.sh" "$env_name" --api-version "$previous"
  echo "$previous" >"/var/lib/orbit/${env_name}/current_sha"
  log_result "$env_name" "$previous" rollback $(($(date +%s) - start))
}

main() {
  # Verrou : un seul déploiement à la fois par machine.
  exec 9>/var/lock/orbit-deploy.lock
  flock -n 9 || die "another deployment is running"
  if [[ "${1:-}" == "rollback" ]]; then
    [[ "${2:-}" =~ ^(staging|production)$ ]] || die "usage: orbit-deploy rollback <staging|production>"
    rollback "$2"
    return
  fi
  [[ "${1:-}" =~ ^(staging|production)$ ]] || die "usage: orbit-deploy <staging|production> <sha>"
  [[ "${2:-}" =~ ^[0-9a-f]{40}$ ]] || die "the SHA must be 40 lowercase hexadecimal characters"
  deploy "$1" "$2"
}

main "$@"
