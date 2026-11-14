#!/usr/bin/env bash
# PostgreSQL backup with the date in the file name, integrity check, off-server copy and retention.
#   usage: ops/scripts/backup.sh [staging|production] [label]
#   cron (installed by Ansible): 15 2 * * * /opt/forgeops/ops/scripts/backup.sh production nightly
set -euo pipefail
source "$(dirname "$0")/_common.sh"
load_env "${1:-production}"
LABEL="${2:-manual}"
BACKUP_DIR="${BACKUP_DIR:-backups/${ENVIRONMENT}}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/forgeops_${ENVIRONMENT}_$(date -u +%Y%m%d_%H%M%S)_${LABEL}.sql.gz"

"${COMPOSE[@]}" exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists | gzip -9 > "$FILE"
gzip -t "$FILE"
log "backup written: $FILE ($(du -h "$FILE" | cut -f1))"

# off-server copy: OFFSITE_TARGET="s3://bucket/forgeops" (aws cli) or "remote:forgeops" (rclone) or "user@host:/path" (scp)
if [[ -n "${OFFSITE_TARGET:-}" ]]; then
  case "$OFFSITE_TARGET" in
    s3://*) aws s3 cp --only-show-errors "$FILE" "$OFFSITE_TARGET/" ;;
    *@*:*)  scp -q "$FILE" "$OFFSITE_TARGET" ;;
    *)      rclone copy "$FILE" "$OFFSITE_TARGET" ;;
  esac
  log "copied off-server to $OFFSITE_TARGET"
fi

find "$BACKUP_DIR" -name 'forgeops_*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete
