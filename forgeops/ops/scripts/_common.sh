# shellcheck shell=bash
# Shared by the ops scripts: loads env/<environment>.env and builds the compose command.
# Usage inside a script:  source "$(dirname "$0")/_common.sh"; load_env production

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

load_env() {
  ENVIRONMENT="${1:?environment required (staging or production)}"
  cd "$ROOT" || exit 1
  ENV_FILE="env/${ENVIRONMENT}.env"
  [[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE (copy env/${ENVIRONMENT}.env.example and fill it in)"; exit 1; }
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-forgeops-$ENVIRONMENT}"
  PORT="${WEB_PORT:-8080}"
  STATE_DIR="releases/${ENVIRONMENT}"
  mkdir -p "$STATE_DIR"
  # shellcheck disable=SC2034  # used by the scripts that source this file
  COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.server.yml --env-file "$ENV_FILE" -p "$COMPOSE_PROJECT_NAME")
  # the shared network the Caddy front door uses to reach every environment
  docker network inspect forgeops-edge >/dev/null 2>&1 || docker network create forgeops-edge >/dev/null
}

wait_healthy() {
  # wait up to $1 seconds for /health on this environment's port
  local limit="${1:-60}" waited=0
  until curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; do
    (( waited >= limit )) && return 1
    sleep 2; waited=$((waited + 2))
  done
}

log() { printf '%s [%s] %s\n' "$(date -u +%H:%M:%S)" "${ENVIRONMENT:-ops}" "$*"; }
