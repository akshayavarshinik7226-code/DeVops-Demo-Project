#!/usr/bin/env bash
# Return to the previous (or a named) version. Target: under 2 minutes.
#   usage: ops/scripts/rollback.sh [staging|production] [version]
set -euo pipefail
source "$(dirname "$0")/_common.sh"
load_env "${1:-production}"
TARGET="${2:-$(cat "$STATE_DIR/previous" 2>/dev/null || true)}"
[[ -n "$TARGET" && "$TARGET" != "none" ]] || { echo "no previous version recorded; name one: rollback.sh $ENVIRONMENT v1.0.0"; exit 1; }

export APP_VERSION="$TARGET" GIT_COMMIT="$TARGET"
START=$(date +%s)
log "rolling back to $TARGET"
# the previous images are still on the server (weekly prune keeps 14 days), so no pull is needed
"${COMPOSE[@]}" up -d --no-deps api worker web
if wait_healthy 60; then
  echo "$TARGET" > "$STATE_DIR/current"
  echo "$(date -u +%FT%TZ) $TARGET rollback $(( $(date +%s) - START ))s" >> "$STATE_DIR/history.log"
  log "rolled back to $TARGET in $(( $(date +%s) - START ))s"
  exit 0
fi
log "rollback did not become healthy: follow docs/RUNBOOK.md, 'Site down'"
exit 1
