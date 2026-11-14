# Alerts: what each one means and the first three checks

Rules live in `ops/monitoring/alert_rules.yml`. Alerts go to Telegram through Alertmanager. Alert only on what needs a human; if an alert fires and nobody needs to act, change the rule.

## ApiDown
Prometheus can't scrape the API for 1 minute. Users likely see errors.
1. `docker compose -p forgeops-production ps api`: is it running, restarting, unhealthy?
2. `docker compose -p forgeops-production logs --tail 100 api`: crash, bad config, database error?
3. `curl -s 127.0.0.1:8080/health`: if `database` or `redis` is `down`, fix that service first. If the last deploy caused it, `ops/scripts/rollback.sh production`.

## HighErrorRate
More than 5% of requests return 5xx for 5 minutes.
1. Grafana "Errors: responses by status": which paths?
2. Loki: `{service="api"} | json | status >= 500`: read the error lines.
3. Did a release just happen? Check `releases/production/history.log`. If yes, roll back first, investigate second.

## SlowRequests
p95 latency over 500 ms for 10 minutes.
1. Grafana "Saturation" panels: CPU, memory or disk near full?
2. Which path is slow? `histogram_quantile(0.95, sum by (le, path) (rate(api_request_seconds_bucket[5m])))`
3. PostgreSQL: `docker compose ... exec postgres psql -U forgeops -c "select query, state, now()-query_start from pg_stat_activity where state <> 'idle';"`

## DiskSpaceLow
Less than 15% disk left.
1. `df -h /` and `du -sh /var/lib/docker /opt/forgeops/backups`
2. Old images: `docker image prune -af --filter until=336h` (keeps recent versions for rollback)
3. Old backups beyond retention: `ls -lh /opt/forgeops/backups/*`; check the backup cron's retention ran.

## HighMemory
Server memory over 90% for 10 minutes.
1. `docker stats --no-stream`: which container?
2. Is a container over its limit and restarting? `docker compose ps`
3. Swap use: `free -h`. Consider a bigger server if this repeats.

## PostgresDown
The exporter can't reach PostgreSQL.
1. `docker compose ... ps postgres` and `logs --tail 50 postgres`
2. Disk full? (PostgreSQL stops writing when the disk is full) `df -h /`
3. Volume intact? `docker volume inspect forgeops-production_pgdata`. If data is lost, follow docs/BACKUP_RESTORE.md.
