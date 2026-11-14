# The 20 tasks: where each one lives in this repository

"Built" is what this repository already contains. "Run and capture" is what still has to happen on your own GitHub account and server, because it produces the evidence for your reports (screenshots, timings, links). Nothing in the evidence column can be faked from here.

## Phase 1: Foundation (Days 1 to 5)

| Day | Task | Built | Run and capture |
|---|---|---|---|
| 1 | Containerise API and worker | `api/Dockerfile`, `worker/Dockerfile`, `.dockerignore` files. Slim Python, non-root `appuser`, HEALTHCHECK on `/health` and the worker heartbeat | `docker compose build api worker`, `docker images`, `docker compose run --rm --entrypoint whoami api` → `appuser` |
| 2 | Web multi-stage build | `web/Dockerfile` (Node build → nginx-unprivileged), `web/nginx.conf` forwards `/api` and `/health` to `api` | Screenshot of the page; size comparison: build a single-stage image once (`FROM node:22-alpine`, `npx vite preview`) and compare with `docker images` |
| 3 | Docker Compose | `docker-compose.yml`: 5 services, named volumes, health-based `depends_on`, only the web port published (on 127.0.0.1), one-off `seed` job | `docker compose up -d`, `docker compose run --rm seed`, `docker compose ps`, site shows 441, `down` + `up`, still 441 |
| 4 | Config and secrets | `.env.example`, `env/staging.env.example`, `env/production.env.example`, `.gitignore`, `docs/SECRETS.md` with rotation steps | `gitleaks detect`, `docker history`, rotate the staging password (commands in SECRETS.md) |
| 5 | Git workflow | `docs/WORKFLOW.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS` | Turn on branch protection, try `git push origin main` (refused), tag `phase-1`, add **fobesitech** as collaborator |

## Phase 2: Pipeline and server (Days 6 to 10)

| Day | Task | Built | Run and capture |
|---|---|---|---|
| 6 | CI | `.github/workflows/ci.yml`: pytest (10 tests), web build, pip cache and npm cache | Red pull request (break `test_employees_seeded_with_441`), then green; add badge: `![CI](https://github.com/<you>/forgeops/actions/workflows/ci.yml/badge.svg)` |
| 7 | Security gates | Same workflow: Ruff, pip-audit, Trivy (HIGH/CRITICAL fail), Gitleaks, Hadolint, ShellCheck; `.trivyignore` for justified exceptions | On a test branch add `AWS_SECRET_ACCESS_KEY=AKIA...` to a file, or pin `requests==2.19.0`; show the failing job; remove it |
| 8 | Versioned images | `.github/workflows/release.yml`: three images to ghcr.io tagged `sha-<commit>` and `vX.Y.Z`, OCI labels, `GITHUB_TOKEN` only | Screenshot of Packages; on another machine `docker pull ghcr.io/<you>/forgeops-api:sha-xxxxxxx && docker run ...` |
| 9 | Harden a server | `infra/ansible/roles/hardening`: keys only, no root, UFW 22/80/443, fail2ban, unattended-upgrades | Server comparison table (see docs/SERVER_CHOICE.md), `ssh -o PubkeyAuthentication=no` refused, `nmap -Pn <your-ip>` |
| 10 | Infrastructure as code | `infra/ansible/site.yml` with roles base, hardening, docker, app (folders, backup cron, image prune) | Fresh server: `time ansible-playbook site.yml`; run again: `changed=0`; tag `phase-2`. (Ansible chosen because it configures any provider's server; Terraform would also create it, but ties you to one cloud API.) |

## Phase 3: Run it properly (Days 11 to 15)

| Day | Task | Built | Run and capture |
|---|---|---|---|
| 11 | Reverse proxy and HTTPS | `docker-compose.proxy.yml`, `ops/caddy/Caddyfile`: automatic Let's Encrypt, HTTP→HTTPS, HSTS and security headers, `/metrics` blocked. Caddy chosen: certificates and renewal are built in, one short file | `DOMAIN=<ip>.sslip.io`; padlock screenshot; SSL Labs grade; renewal dry run: `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile` and the ACME log lines |
| 12 | Database backups | `ops/scripts/backup.sh` (dated, gzip-checked, off-server copy, retention), `restore.sh` (scratch DB + counts), cron by Ansible, PostgreSQL tuned in compose (`shared_buffers=128MB`, `work_mem=4MB`, `max_connections=50`, slow-query log 500 ms), `docs/BACKUP_RESTORE.md` | Backup listing after two nights; `restore.sh ... restore_check` shows `employees=441` |
| 13 | Metrics | `/metrics` in the API (`api_requests_total`, `api_request_seconds`), `docker-compose.monitoring.yml`, `ops/monitoring/prometheus.yml`, dashboard JSON `ops/monitoring/grafana/dashboards/forgeops.json` covering latency, traffic, errors, saturation | SSH tunnel, refresh the site, screenshot the moving dashboard |
| 14 | Centralised logging | JSON logs from API and worker, Loki (7-day retention) + Promtail with Docker discovery, logs panel on the dashboard | Request `/api/employees?limit=500` and find it: `{service="api"} \| json \| status="400"` |
| 15 | Alerting and status page | `ops/monitoring/alert_rules.yml` (ApiDown, HighErrorRate, SlowRequests, DiskSpaceLow, HighMemory, PostgresDown), `alertmanager.yml` to Telegram, Uptime Kuma, `docs/ALERTS.md` | `docker compose stop api`, time the Telegram message (under 2 min); set up the Kuma monitor and status page; tag `phase-3` |

## Phase 4: Release (Days 16 to 20)

| Day | Task | Built | Run and capture |
|---|---|---|---|
| 16 | Staging and rollback | Staging = same compose with `-p forgeops-staging --env-file env/staging.env` on port 8081; `ops/scripts/deploy.sh` (backup, pull exact version, health wait, auto-rollback) and `rollback.sh` | Drill: build a version where `/health` returns 500 (see "Broken version for the drill" below), deploy to staging, watch it roll back. Fill docs/reports/DRILL_TIMELINE.md |
| 17 | Production through the pipeline | `.github/workflows/deploy.yml` with `environment: production` (add required reviewers), `docs/CHECKLIST_production_readiness.md`, `ops/scripts/smoke.sh` | Tick the checklist, run the workflow, open on your phone, trigger an alert, ship a tiny change the same way |
| 18 | Disaster recovery | `docs/BACKUP_RESTORE.md` "Rebuild a whole server", restore script, Ansible | On staging: `docker volume rm forgeops-staging_pgdata`, restore, compare counts; rebuild a server with Ansible; fill docs/reports/DR_REPORT.md |
| 19 | Load test | `ops/k6/load_test.js` with p95 and error-rate thresholds; resource limits in compose | Before/after table in docs/reports/LOAD_TEST_REPORT.md. Good first change to try: index on `employees(full_name)` or raising api `--workers` |
| 20 | Runbook and handover | `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md` (Mermaid), `docs/POSTMORTEM_TEMPLATE.md`, `docs/RELEASE_NOTES.md` | 30-minute incident drill + postmortem, `git tag v1.0.0`, demo video, final challenge on its own branch |

## Broken version for the drill (Task 16)
On a branch, make `/health` always fail, then release it with a tag such as `v1.0.1-broken`:
```python
# api/app/main.py, inside health():
return JSONResponse({"status": "broken on purpose"}, status_code=500)
```
Deploy it to staging. `deploy.sh` waits 60 s for health, then rolls back to the previous version by itself. The broken version never reaches production because production is only deployed after staging passes.

## Final challenge ideas (Task 20)
- Blue-green releases: run `api-blue` and `api-green`, switch Caddy's upstream, keep the old colour for instant rollback.
- Nightly security scan: a scheduled workflow (`on: schedule`) that runs Trivy on the running versions and opens an issue when something new appears.
- Database migrations with Alembic, run as a one-off job in `deploy.sh` before the new containers start.
