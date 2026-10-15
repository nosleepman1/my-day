#!/usr/bin/env bash
# Restauration d'un dump ORBIT dans une base PostgreSQL VIERGE et jetable, puis contrôle d'intégrité
# et chronométrage (ADR-015, INFRASTRUCTURE.md §11.5). Ne touche jamais une base existante.
#   restore.sh --dump <fichier.dump> [--keep]
#   (restic : `restic restore latest --tag daily --target /tmp/restore` puis --dump sur le fichier extrait)
# --keep laisse le conteneur démarré (port 127.0.0.1:55432) pour brancher une API de vérification.
set -Eeuo pipefail

DUMP=""
KEEP=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump) DUMP="$2"; shift 2 ;;
    --keep) KEEP=true; shift ;;
    *) echo "restore.sh: unknown argument $1" >&2; exit 2 ;;
  esac
done
[[ -f "$DUMP" ]] || { echo "restore.sh: --dump <file> is required" >&2; exit 2; }

CONTAINER="orbit-restore-$(date -u +%Y%m%d%H%M%S)"
PASSWORD="restore-$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"
start=$(date +%s)
step() { printf '[%4ss] %s\n' "$(($(date +%s) - start))" "$*"; }

cleanup() { [[ "$KEEP" == true ]] || docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

step "starting a disposable PostgreSQL 17 (${CONTAINER})"
docker run -d --name "$CONTAINER" -e POSTGRES_USER=orbit_owner -e POSTGRES_PASSWORD="$PASSWORD" \
  -e POSTGRES_DB=orbit -p 127.0.0.1:55432:5432 postgres:17.6-alpine >/dev/null
until docker exec "$CONTAINER" pg_isready -U orbit_owner -d orbit >/dev/null 2>&1; do sleep 1; done
# Les rôles existent avant la restauration : les droits du dump s'appliquent sans erreur.
docker exec "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U orbit_owner -d orbit \
  -c "CREATE ROLE orbit_app LOGIN PASSWORD '${PASSWORD}'; CREATE ROLE orbit_backup LOGIN PASSWORD '${PASSWORD}';"

step "restoring $(basename "$DUMP") ($(du -h "$DUMP" | cut -f1))"
docker exec -i "$CONTAINER" pg_restore --exit-on-error --no-owner --role=orbit_owner \
  -U orbit_owner -d orbit <"$DUMP"

step "integrity checks"
migrations=$(docker exec "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U orbit_owner -d orbit -At -c "
  SELECT count(*) FILTER (WHERE finished_at IS NOT NULL) || '|' || count(*) FILTER (WHERE finished_at IS NULL)
  FROM _prisma_migrations;")
echo "migrations applied: ${migrations%%|*}, unfinished: ${migrations##*|}"
[[ "${migrations##*|}" == "0" && "${migrations%%|*}" -gt 0 ]] || { echo "restore.sh: migrations table inconsistent" >&2; exit 1; }
docker exec "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U orbit_owner -d orbit -At -c "ANALYZE;"
echo "rows per table:"
docker exec "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U orbit_owner -d orbit -At -F ' ' -c "
  SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;
"

step "restore completed in $(($(date +%s) - start)) s (target RTO: 4 h)"
if [[ "$KEEP" == true ]]; then
  echo "restore.sh: database kept on 127.0.0.1:55432 (container ${CONTAINER}); remove it with: docker rm -f ${CONTAINER}"
fi
