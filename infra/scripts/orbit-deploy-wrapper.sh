#!/usr/bin/env bash
# Commande forcée des clés SSH de la CI (authorized_keys de l'utilisateur `deploy`), une clé PAR environnement
# (revue PHASE-03, H3) :
#   restrict,command="/usr/local/bin/orbit-deploy-wrapper staging" ssh-ed25519 … orbit-ci-staging
#   restrict,command="/usr/local/bin/orbit-deploy-wrapper production" ssh-ed25519 … orbit-ci-production
# La clé de staging ne peut donc jamais déployer la production. N'accepte que « <env> <sha> » ou
# « rollback <env> », pour l'environnement de la clé ; tout le reste est refusé (INFRASTRUCTURE.md §8.3).
set -Eeuo pipefail

ALLOWED_ENV="${1:-}"
[[ "$ALLOWED_ENV" =~ ^(staging|production)$ ]] || { echo "orbit-deploy-wrapper: misconfigured key" >&2; exit 2; }

read -r -a args <<<"${SSH_ORIGINAL_COMMAND:-}"

if [[ ${#args[@]} -eq 2 && "${args[0]}" == "$ALLOWED_ENV" && "${args[1]}" =~ ^[0-9a-f]{40}$ ]]; then
  exec sudo -n /usr/local/bin/orbit-deploy "$ALLOWED_ENV" "${args[1]}"
fi
if [[ ${#args[@]} -eq 2 && "${args[0]}" == "rollback" && "${args[1]}" == "$ALLOWED_ENV" ]]; then
  exec sudo -n /usr/local/bin/orbit-deploy rollback "$ALLOWED_ENV"
fi

echo "orbit-deploy-wrapper: command refused" >&2
exit 2
