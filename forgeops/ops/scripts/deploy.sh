#!/usr/bin/env bash
# Deploy an exact version: backup -> pull -> restart -> seed if empty -> health check -> smoke test.
# If the new version never becomes healthy, roll back to the previous one automatically.
#
#   usage: ops/scripts/deploy.sh <version> [staging|production]
#   e.g.   ops/scripts/deploy.sh v1.0.0 staging
# The Deploy workflow runs this on the server. People don't.
set -euo pipefail
VERSION="${1:?usage: deploy.sh <version> [staging|production]}"
source "$(dirname "$0")/_common.sh"
load_env "${2:-production}"

export APP_VERSION="$VERSION"
export GIT_COMMIT="${GIT_COMMIT:-$VERSION}"
START=$(date +%s)
PREVIOUS="$(cat "$STATE_DIR/current" 2>/dev/null || echo none)"
log "deploying $VERSION (previous: $PREVIOUS)"

if "${COMPOSE[@]}" ps --status running postgres 2>/dev/null | grep -q postgres; then
  log "taking pre-deploy backup"
  ops/scripts/backup.sh "$ENVIRONMENT" "pre-deploy-$VERSION"
fi

log "pulling images for $VERSION"
"${COMPOSE[@]}" pull api worker web

log "starting containers"
"${COMPOSE[@]}" up -d postgres redis
"${COMPOSE[@]}" up -d --no-deps api worker web
"${COMPOSE[@]}" run --rm seed            # loads data only when the database is empty

log "waiting for /health"
if wait_healthy 60; then
  [[ "$PREVIOUS" != "$VERSION" ]] && echo "$PREVIOUS" > "$STATE_DIR/previous"
  echo "$VERSION" > "$STATE_DIR/current"
  echo "$(date -u +%FT%TZ) $VERSION deployed $(( $(date +%s) - START ))s" >> "$STATE_DIR/history.log"
  log "healthy: $VERSION is live after $(( $(date +%s) - START ))s"
  ops/scripts/smoke.sh "http://127.0.0.1:${PORT}"
  exit 0
fi

log "UNHEALTHY after 60s"
echo "$(date -u +%FT%TZ) $VERSION FAILED" >> "$STATE_DIR/history.log"
"${COMPOSE[@]}" logs --tail 30 api || true
if [[ "$PREVIOUS" != "none" ]]; then
  log "rolling back to $PREVIOUS"
  ops/scripts/rollback.sh "$ENVIRONMENT" "$PREVIOUS"
fi
exit 1
