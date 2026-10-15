#!/usr/bin/env bash
# Sauvegarde chiffrée (ADR-015, INFRASTRUCTURE.md §11) : pg_dump au format custom, vérifié, puis restic
# vers un dépôt hors fournisseur du VPS. Lancée par le timer systemd orbit-backup (02:15 UTC, copie figée
# /usr/local/lib/orbit/backup.sh) et par orbit-deploy avant chaque migration de production.
# Aucun échec silencieux : code non nul + ping /fail Healthchecks.io.
#   backup.sh --env production            sauvegarde quotidienne
#   backup.sh --env production --pre-migrate <sha>
set -Eeuo pipefail

ENV_NAME="production"
PRE_MIGRATE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="$2"; shift 2 ;;
    --pre-migrate) PRE_MIGRATE="$2"; shift 2 ;;
    *) echo "backup.sh: unknown argument $1" >&2; exit 2 ;;
  esac
done
[[ "$ENV_NAME" =~ ^(staging|production)$ ]] || { echo "backup.sh: bad --env" >&2; exit 2; }

REPO_DIR="${ORBIT_REPO_DIR:-/opt/orbit/repo}"
BACKUP_ROOT="/srv/orbit/backup/${ENV_NAME}"
# RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE, B2_ACCOUNT_ID, B2_ACCOUNT_KEY, HC_BACKUP_URL (fichier 0400 root).
# shellcheck disable=SC1091
set -a && source /etc/orbit/backup.env && source /etc/orbit/deploy.env && set +a
# Le Compose exige ORBIT_SHA : le timer reprend celui de la version en service (revue PHASE-03, H1).
export ORBIT_SHA="${ORBIT_SHA:-$(cat "/var/lib/orbit/${ENV_NAME}/current_sha" 2>/dev/null || true)}"
[[ -n "$ORBIT_SHA" ]] || { echo "backup.sh: no deployed version recorded for ${ENV_NAME}" >&2; exit 1; }

# L'URL de ping est secrète : passée à curl par configuration sur l'entrée standard, jamais en argument.
ping() { curl -fsS -m 10 --retry 3 -o /dev/null -K - <<<"url = \"${HC_BACKUP_URL}$1\"" || true; }

compose() {
  docker compose -f "${REPO_DIR}/infra/compose/compose.${ENV_NAME}.yml" \
    --env-file "/etc/orbit/${ENV_NAME}/compose.env" "$@"
}

# Une seule sauvegarde à la fois (timer et pré-migration).
exec 8>/var/lock/orbit-backup.lock
flock -w 1800 8 || { echo "backup.sh: another backup is still running" >&2; exit 1; }

ping /start
mkdir -p "${BACKUP_ROOT}/db"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
name="orbit-${stamp}.dump"
[[ -n "$PRE_MIGRATE" ]] && name="pre-migrate-${PRE_MIGRATE}.dump"
dump="${BACKUP_ROOT}/db/${name}"
n8n_restart=false
cleanup() {
  rm -f "${dump}.partial"
  if [[ "$n8n_restart" == true ]]; then compose start n8n >/dev/null 2>&1 || true; fi
}
trap 'ping /fail; cleanup' ERR
trap cleanup EXIT

compose run --rm -T backup >"${dump}.partial"
mv "${dump}.partial" "$dump"

# Le dump doit être lisible avant d'être envoyé : un dump vide ou tronqué fait échouer la sauvegarde.
[[ -s "$dump" ]]
docker run --rm -i postgres:17.6-alpine pg_restore --list >/dev/null <"$dump"

tag="daily"
[[ -n "$PRE_MIGRATE" ]] && tag="pre-migrate"
paths=("$BACKUP_ROOT")
if [[ "$ENV_NAME" == "production" && -z "$PRE_MIGRATE" ]]; then
  # n8n (SQLite) est copié à froid : arrêt de quelques secondes plutôt qu'une base incohérente (revue M4).
  n8n_restart=true
  compose stop n8n >/dev/null
  rm -rf "${BACKUP_ROOT}/n8n" && cp -a /srv/orbit/n8n "${BACKUP_ROOT}/n8n"
  compose start n8n >/dev/null
  n8n_restart=false
  paths+=("/etc/orbit/production/compose.env" "/etc/orbit/production/n8n.env")
fi
# Les clés maîtres (/etc/orbit-kek) ne sont jamais sauvegardées avec les données (§7.2).
restic backup "${paths[@]}" --exclude /etc/orbit-kek --tag "$tag" --tag "$ENV_NAME" --host orbit-vps
if [[ -z "$PRE_MIGRATE" ]]; then
  restic check --read-data-subset=1/30
fi

# Rétention locale : 3 jours de dumps quotidiens, 14 jours de dumps pré-migration (§10, §11.3).
find "${BACKUP_ROOT}/db" -name 'orbit-*.dump' -mtime +3 -delete
find "${BACKUP_ROOT}/db" -name 'pre-migrate-*.dump' -mtime +14 -delete

ping ""
echo "backup.sh: ${name} stored and verified"
