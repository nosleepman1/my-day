#!/bin/sh
# Premier démarrage d'une base déployée (staging, production) : rôles applicatif et de sauvegarde
# (INFRASTRUCTURE.md §9.1). Les mots de passe viennent des fichiers secrets montés, jamais de l'image.
# Les privilèges de orbit_app sont posés ensuite par les migrations ; orbit_backup lit tout.
set -eu

app_password="$(cat /run/secrets/orbit_app_password)"
backup_password="$(cat /run/secrets/orbit_backup_password)"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$app_password" -v backup_password="$backup_password" <<'SQL'
CREATE ROLE orbit_app LOGIN PASSWORD :'app_password';
CREATE ROLE orbit_backup LOGIN PASSWORD :'backup_password';
GRANT pg_read_all_data TO orbit_backup;
ALTER ROLE orbit_backup SET default_transaction_read_only = on;
SQL
