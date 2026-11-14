# ForgeOps runbook

For whoever is on call. If you need the author to explain something here, the runbook is not finished: tell them.

## The system in one minute
A payroll and people web app. Browser → Caddy (HTTPS) → web (Nginx) → api (FastAPI) → PostgreSQL. Payroll runs are queued in Redis and processed by the worker. Diagram: docs/ARCHITECTURE.md.

| Item | Value |
|---|---|
| Production URL | `https://<DOMAIN>` |
| Staging URL | `https://staging.<DOMAIN>` (port 8081 on the server) |
| Status page | `https://status.<DOMAIN>` |
| Server | `ssh deploy@<server-ip>` (keys only) |
| Release folder | `/opt/forgeops` |
| Images | `ghcr.io/<owner>/forgeops-{api,worker,web}:<version>` |
| Current version | `cat /opt/forgeops/releases/production/current` |
| Release history | `/opt/forgeops/releases/production/history.log` |

## Access
- SSH: your key must be in `infra/ansible/inventory.ini` → `admin_pubkey_file`; run the playbook to add it.
- Grafana/Prometheus: `ssh -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 deploy@<server-ip>` then open http://localhost:3000.
- Secrets: docs/SECRETS.md.

## Everyday commands (on the server, in /opt/forgeops)
```bash
P="docker compose --env-file env/production.env -p forgeops-production"
$P ps                          # what is running and healthy
$P logs -f --tail 100 api      # follow API logs
curl -s 127.0.0.1:8080/health  # {"status":"ok",...}
ops/scripts/smoke.sh http://127.0.0.1:8080
```

## Deploy
Only through GitHub: Actions → **Deploy** → Run workflow → version (e.g. `v1.0.1`) → `staging`. Check staging. Run again with `production`; a reviewer approves. Never `docker compose up` by hand in production.

## Roll back
Fastest (under 2 minutes, images are already on the server):
```bash
cd /opt/forgeops && ops/scripts/rollback.sh production            # to the previous version
ops/scripts/rollback.sh production v1.0.0                          # or a named one
```
Then run the Deploy workflow for that same version, so GitHub's record matches the server.

**Roll forward instead** when the bad release changed data in a way the old code can't read (for example a new column the old version doesn't know). Then fix and release a new version.

## Health checks
| Check | Healthy |
|---|---|
| `/health` | 200 with database ok, redis ok |
| System page in the app | four green "Healthy" pills |
| `docker compose ps` | every service `running (healthy)` |
| Uptime Kuma | green for the last 24 h |

## Alerts
Each alert and its first three checks: docs/ALERTS.md.

## Backup and restore
docs/BACKUP_RESTORE.md. Short version: `ops/scripts/backup.sh production manual`, `ops/scripts/restore.sh <file> production restore_check`.

## Common incidents
**Site down (502 from Caddy)**: `$P ps web api`. If a container is restarting, read its logs. If it began with a release, roll back.
**Payroll runs stuck on "Queued"**: System page → Payroll worker. If Down: `$P logs --tail 50 worker`, then `$P restart worker`. Queued jobs are still in Redis and will run.
**"Couldn't load this page" in the app**: the API is unreachable or returned an error. `curl 127.0.0.1:8080/health`.
**Certificate expired / browser warning**: `docker compose ... logs caddy | grep -i acme`. Usually DNS no longer points to the server, or port 80 is blocked (Let's Encrypt needs it).
**Disk full**: docs/ALERTS.md#diskspacelow.
**Locked out of SSH**: use the provider's web console, check `/etc/ssh/sshd_config.d/10-forgeops.conf` and `ufw status`, re-add your key to `~deploy/.ssh/authorized_keys`.

## Contacts
| Role | Name | How |
|---|---|---|
| Owner / on call | YOUR NAME | phone / Telegram |
| Backup on call | | |
| Hosting provider support | | provider console |
