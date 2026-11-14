# ForgeOps

A payroll and people app (web, API, worker, PostgreSQL, Redis) and the full delivery platform around it: containers, CI with security gates, versioned images, a hardened server built from code, HTTPS, backups, metrics, logs, alerts, staged releases with rollback, and a runbook.

Built for the Aura Workforce DevOps track (20 days, 4 phases). All names and data are fictional.

![CI](https://github.com/YOUR-GITHUB-USER/forgeops/actions/workflows/ci.yml/badge.svg)

![Overview](docs/screenshots/overview.png)

## What the app does

| Page | What you can do |
|---|---|
| Overview | See last month's payout (gross, tax, net), headcount by department, recent payroll runs |
| People | Search 441 employees by name, email, ID or title; filter by department; sort; open anyone's details |
| Payroll | Start a payroll run for a month and watch it go from queued to completed live; see history and a monthly chart |
| System | See whether the API, database, job queue and worker are healthy, which version is running, and how many jobs are waiting |

Light and dark themes, keyboard accessible, works on phones (bottom tab bar).

## Run it locally

### With Docker (recommended)
```bash
cp .env.example .env
docker compose up -d --build
docker compose run --rm seed        # loads 441 employees once
open http://localhost:8080
```
Or `make up`. Stop with `docker compose down` (data stays in the `pgdata` volume).

### Without Docker (to see what you are packaging, Task 1)
Needs Python 3.12+, Node 20+, PostgreSQL and Redis running locally.
```bash
# database
createuser -P forgeops && createdb -O forgeops forgeops       # password: forgeops
export DATABASE_URL=postgresql://forgeops:forgeops@localhost:5432/forgeops
export REDIS_URL=redis://localhost:6379/0

pip install -r api/requirements-dev.txt -r worker/requirements.txt
cd api && pytest -q && cd ..                       # 10 tests, no database needed
python seed/seed.py                                # 441 employees, 6 past payroll runs
(cd api && uvicorn app.main:app --port 8000) &     # API
python worker/worker.py &                          # payroll worker
cd web && npm install && npm run dev               # http://localhost:5173
```

## Repository map

```
api/                FastAPI service: /api/*, /health, /metrics, JSON logs, tests
worker/             payroll worker (Redis queue -> PostgreSQL), heartbeat
web/                Vite app (the UX layer), multi-stage Dockerfile, nginx.conf
seed/               employees.csv (441), payroll_runs.csv, seed.py
docker-compose.yml  the five services (+ one-off seed job)
docker-compose.server.yml      server-only: joins web to the shared edge network
docker-compose.proxy.yml       Caddy front door with automatic HTTPS
docker-compose.monitoring.yml  Prometheus, Grafana, Loki, Promtail, Alertmanager, exporters, Uptime Kuma
env/                staging / production settings templates (real files live only on the server)
.github/workflows/  ci.yml (tests + gates), release.yml (images to ghcr.io), deploy.yml (approved deploys)
infra/ansible/      server setup as code: users, SSH, firewall, fail2ban, updates, Docker, cron
ops/scripts/        deploy, rollback, backup, restore, smoke, platform
ops/monitoring/     Prometheus config, alert rules, Alertmanager, Loki, Promtail, Grafana dashboard
ops/caddy/          Caddyfile
ops/k6/             load test
docs/               runbook, architecture, phase guide, secrets, alerts, backups, checklists, templates
```

## Going live, in order

1. **Server**: create an Ubuntu 22.04/24.04 server (2 vCPU, 4 GB). Fill `infra/ansible/inventory.ini` from the example and run `cd infra/ansible && ansible-galaxy collection install -r requirements.yml && ansible-playbook site.yml`.
2. **Settings on the server**: in `/opt/forgeops/env/`, copy `production.env.example` and `staging.env.example` to `.env` files, fill real values, `chmod 600`. Log the server in to ghcr.io once.
3. **GitHub**: push this repository. Add secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`; variables `PUBLIC_URL`, `STAGING_URL`. Create environments `staging` and `production` (production with a required reviewer). Protect `main`.
4. **Release**: merge to `main` (images are built and pushed), then `git tag v1.0.0 && git push --tags`.
5. **Deploy**: Actions → Deploy → `v1.0.0` → `staging`, check it, then `production`.
6. **Front door and monitoring** (once, on the server): `ops/scripts/platform.sh all`.

Full detail: [docs/RUNBOOK.md](docs/RUNBOOK.md). Day-by-day mapping of the 20 tasks and the evidence each needs: [docs/PHASE_GUIDE.md](docs/PHASE_GUIDE.md).

## API

| Method and path | Purpose |
|---|---|
| `GET /health` | 200 when PostgreSQL and Redis are reachable, otherwise 503 |
| `GET /metrics` | Prometheus metrics (`api_requests_total`, `api_request_seconds`); internal only |
| `GET /api/employees?limit=25&offset=0&q=&department=&sort=` | list; `limit` over 200 returns 400 |
| `GET /api/employees/{id}` | one employee |
| `GET /api/departments` | headcount and monthly cost per department |
| `GET /api/stats` | totals and the last completed payroll run |
| `GET /api/payroll-runs` / `GET /api/payroll-runs/{id}` | run history / one run |
| `POST /api/payroll-runs` `{"period":"2026-11"}` | queue a run (202); 409 if that month is already in progress |
| `GET /api/system` | service health, version, commit, queue depth (used by the System page) |
| `GET /api/version` | version, commit, environment |

## Docs

- [Architecture](docs/ARCHITECTURE.md): diagram and how one change travels to production
- [Runbook](docs/RUNBOOK.md): access, deploy, rollback, health checks, incidents
- [Alerts](docs/ALERTS.md): what each alert means and the first three checks
- [Backup and restore](docs/BACKUP_RESTORE.md)
- [Secrets](docs/SECRETS.md)
- [Workflow](docs/WORKFLOW.md): branches, pull requests, protection, tags
- [Production readiness checklist](docs/CHECKLIST_production_readiness.md)
- [Release notes](docs/RELEASE_NOTES.md)
- Templates: [postmortem](docs/POSTMORTEM_TEMPLATE.md), [drill timeline](docs/reports/DRILL_TIMELINE.md), [DR report](docs/reports/DR_REPORT.md), [load test](docs/reports/LOAD_TEST_REPORT.md), [server choice](docs/SERVER_CHOICE.md)
