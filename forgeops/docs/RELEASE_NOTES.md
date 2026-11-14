# Release notes

## v1.0.0

**Included**
- Web app: Overview (latest payroll, headcount by department, recent runs), People (search, department filter, sort, pagination, detail panel), Payroll (start a run, live status, history, monthly chart), System (service health, version, queue). Light and dark themes, works on phones.
- API: employees, departments, stats, payroll runs, `/health`, `/metrics`, JSON logs.
- Worker: processes payroll runs from Redis with a heartbeat.
- Containers for api, worker and web; non-root; health checks; multi-stage web image.
- CI (tests, lint, security gates), image release to ghcr.io, approved deploys, automatic rollback.
- Ansible server setup with hardening; Caddy HTTPS; backups with off-server copy; Prometheus, Grafana, Loki, Alertmanager, Uptime Kuma.

**Not included**
- User login. The app is an internal demo with fictional data; put it behind Caddy `basicauth` or an SSO proxy before using real data.
- Database migrations tool. Tables are created on start; a schema change would need Alembic.
- High availability: one server, one database.

**Known limits**
- Tested with 50 concurrent users on a 2 vCPU / 4 GB server (fill in your Task 19 numbers).
- Recovery point is 24 hours (nightly backups).
