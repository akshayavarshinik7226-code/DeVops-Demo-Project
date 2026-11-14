#!/usr/bin/env bash
# Start or update the shared pieces on the server: the Caddy front door and the monitoring stack.
#   usage: ops/scripts/platform.sh proxy|monitoring|all
set -euo pipefail
source "$(dirname "$0")/_common.sh"
load_env production
what="${1:-all}"

if [[ "$what" == proxy || "$what" == all ]]; then
  log "starting Caddy (HTTPS front door)"
  docker compose -f docker-compose.proxy.yml --env-file "$ENV_FILE" -p forgeops-proxy up -d
fi
if [[ "$what" == monitoring || "$what" == all ]]; then
  [[ -f ops/monitoring/telegram_token ]] || { echo "create ops/monitoring/telegram_token (chmod 600) first, see ops/monitoring/alertmanager.yml"; exit 1; }
  log "starting monitoring (Prometheus, Grafana, Loki, Alertmanager, Uptime Kuma)"
  "${COMPOSE[@]}" -f docker-compose.monitoring.yml up -d \
    prometheus alertmanager grafana node-exporter cadvisor postgres-exporter loki promtail uptime-kuma
  log "Grafana: ssh -L 3000:127.0.0.1:3000 ${USER}@<server> then http://localhost:3000"
fi
