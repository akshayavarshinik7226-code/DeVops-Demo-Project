# Backup and restore

**What**: a full `pg_dump` of the database, gzipped, named `forgeops_<env>_<YYYYMMDD_HHMMSS>_<label>.sql.gz`.
**When**: nightly at 02:15 UTC (production) and 02:45 UTC (staging) by cron (installed by Ansible), plus before every deploy.
**Where**: `/opt/forgeops/backups/<env>/` and, when `OFFSITE_TARGET` is set, a copy off the server (S3-compatible bucket via `aws s3 cp`, or another machine via rclone/scp).
**Kept**: 14 days (`RETENTION_DAYS`). Older files are deleted by the same script.

**How often vs how much we can lose**: backups run every 24 hours, so in the worst case we lose up to 24 hours of changes (the recovery point). Payroll runs can be re-run from employee data, so that is acceptable here. If it wasn't, we would add WAL archiving (WAL-G) to get minutes.

## Take a backup now
```bash
cd /opt/forgeops && ops/scripts/backup.sh production manual
```

## Restore into a scratch database and verify (do this monthly)
```bash
LATEST=$(ls -t backups/production/*.sql.gz | head -1)
ops/scripts/restore.sh "$LATEST" production restore_check
# expect: employees=441 (or today's count) and payroll_runs=<n>
```

## Restore over the live database (incident only)
```bash
ops/scripts/backup.sh production before-restore           # keep what is there now, just in case
docker compose --env-file env/production.env -p forgeops-production stop api worker
ops/scripts/restore.sh backups/production/<file>.sql.gz production forgeops
docker compose --env-file env/production.env -p forgeops-production start api worker
ops/scripts/smoke.sh http://127.0.0.1:8080
```

## Rebuild a whole server from nothing
1. Create a new Ubuntu server and put its IP in `infra/ansible/inventory.ini`.
2. `cd infra/ansible && ansible-playbook site.yml` (about 5 minutes).
3. Copy `env/production.env` from your password manager to the server; `docker login ghcr.io` once.
4. Copy the newest off-server backup to `/opt/forgeops/backups/production/`.
5. Run the Deploy workflow for the last good version (it seeds an empty database; restore right after: step "over the live database").
6. Point DNS (or the sslip.io name) at the new IP.
