#!/usr/bin/env bash
# Dépose un secret lisible par le seul conteneur qui l'utilise, malgré userns-remap (revue PHASE-03, H4) :
# avec Compose hors Swarm, un secret fichier est monté avec son propriétaire de l'hôte ; il doit donc
# appartenir à l'UID REMAPPÉ de l'utilisateur du conteneur (INFRASTRUCTURE.md §7.1, point 5).
#   sudo install-secret.sh <staging|production> <nom>      (la valeur est lue sur l'entrée standard)
# Exemple : openssl rand -base64 32 | sudo install-secret.sh production rate_limit_hmac_key
set -Eeuo pipefail

ENV_NAME="${1:?usage: install-secret.sh <staging|production> <name>}"
NAME="${2:?usage: install-secret.sh <staging|production> <name>}"
[[ "$ENV_NAME" =~ ^(staging|production)$ ]] || { echo "install-secret.sh: bad environment" >&2; exit 2; }
[[ $EUID -eq 0 ]] || { echo "install-secret.sh must run as root" >&2; exit 1; }

# Utilisateur du conteneur qui lit chaque secret (UID dans le conteneur).
case "$NAME" in
  database_url | rate_limit_hmac_key | smtp_password | database_migration_url) container_uid=1000 ;; # api, migrate
  postgres_owner_password | orbit_app_password | orbit_backup_password) container_uid=70 ;;         # postgres (alpine)
  database_backup_url) container_uid=0 ;;                                                            # backup (pg_dump)
  n8n_encryption_key) container_uid=1000 ;;                                                          # n8n (node)
  *) echo "install-secret.sh: unknown secret ${NAME}" >&2; exit 2 ;;
esac

remap_base=$(awk -F: '$1=="dockremap"{print $2; exit}' /etc/subuid)
[[ -n "$remap_base" ]] || { echo "install-secret.sh: dockremap not found (run harden.sh first)" >&2; exit 1; }
owner=$((remap_base + container_uid))

target="/etc/orbit/${ENV_NAME}/secrets/${NAME}"
umask 077
value=$(cat)
[[ -n "$value" ]] || { echo "install-secret.sh: empty value refused" >&2; exit 1; }
printf '%s' "$value" | install -m 0400 -o "$owner" -g "$owner" /dev/stdin "$target"
echo "install-secret.sh: ${target} written (owner uid ${owner})"
