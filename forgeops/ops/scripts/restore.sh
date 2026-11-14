#!/usr/bin/env bash
# Restore a backup. Default target is a SCRATCH database, so you can check it before touching real data.
#   usage: ops/scripts/restore.sh <backup.sql.gz> [staging|production] [target_db]
#   restore over the live database (incident only): target_db = the real POSTGRES_DB, with api and worker stopped
set -euo pipefail
FILE="$(realpath "${1:?usage: restore.sh <backup.sql.gz> [environment] [target_db]}")"
source "$(dirname "$0")/_common.sh"
load_env "${2:-staging}"
TARGET_DB="${3:-restore_check}"
PSQL=("${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -v ON_ERROR_STOP=1)

if [[ "$TARGET_DB" != "$POSTGRES_DB" ]]; then
  "${PSQL[@]}" -d postgres -q -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";" -c "CREATE DATABASE \"$TARGET_DB\";"
fi
gunzip -c "$FILE" | "${PSQL[@]}" -q -d "$TARGET_DB" >/dev/null
log "restored $(basename "$FILE") into $TARGET_DB"
"${PSQL[@]}" -d "$TARGET_DB" -tA -c "SELECT 'employees=' || COUNT(*) FROM employees;" -c "SELECT 'payroll_runs=' || COUNT(*) FROM payroll_runs;"
