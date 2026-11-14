# Production readiness checklist

Tick each line before the first production release (Task 17). Write how you checked it.

## Security
- [ ] Server: SSH keys only, root login off (`ssh -o PubkeyAuthentication=no deploy@host` is refused)
- [ ] Firewall shows only 22, 80, 443 (`sudo ufw status`, and `nmap` of your own server)
- [ ] fail2ban and unattended-upgrades running
- [ ] HTTPS valid, HTTP redirects to HTTPS, SSL Labs grade A or better
- [ ] PostgreSQL, Redis, API, Grafana, Prometheus not reachable from the internet
- [ ] `/metrics` returns 404 publicly
- [ ] No secrets in Git (Gitleaks clean) or in images (`docker history`)
- [ ] Containers run as non-root (`docker compose exec api whoami` → appuser)
- [ ] Trivy: no unfixed HIGH/CRITICAL, or each one is recorded in `.trivyignore` with a reason

## Reliability
- [ ] Every service has a health check and `restart: unless-stopped`
- [ ] Resource limits set for api and worker
- [ ] Log rotation on (Docker daemon and compose `logging`)
- [ ] Rollback tested on staging, under 2 minutes
- [ ] Previous version's images kept on the server

## Data
- [ ] Nightly backup runs (a file appeared this morning)
- [ ] Backup copied off the server
- [ ] Restore tested into a scratch database, counts match
- [ ] Retention deletes old backups

## Observability
- [ ] Grafana dashboard shows traffic, errors, latency, saturation
- [ ] Logs searchable in Grafana (Loki)
- [ ] Each alert tested once and arrives in Telegram within 2 minutes
- [ ] Status page public and green

## Process
- [ ] Production changes only through the Deploy workflow, with approval
- [ ] `main` protected; CI required
- [ ] Runbook written and read by someone else
- [ ] Release notes for this version
