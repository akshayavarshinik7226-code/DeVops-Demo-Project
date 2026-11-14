# Secrets

| Secret | Lives in | Who can read it | How to rotate |
|---|---|---|---|
| `POSTGRES_PASSWORD` (per environment) | `/opt/forgeops/env/<env>.env` on the server, mode 600 | the `deploy` user, root | see below |
| `GRAFANA_ADMIN_PASSWORD` | same env file | same | change in the file, `docker compose ... up -d grafana`, then change it in Grafana's profile page |
| Telegram bot token | `/opt/forgeops/ops/monitoring/telegram_token`, mode 600 | same | revoke in @BotFather, write the new token, restart alertmanager |
| Deploy SSH private key | GitHub > Settings > Secrets > `DEPLOY_SSH_KEY` | GitHub Actions only | make a new key pair, add the public key with Ansible, update the secret, remove the old public key |
| ghcr.io pull token on the server | `~/.docker/config.json` of `deploy` | the `deploy` user | create a new fine-grained token (read:packages), `docker login ghcr.io` again, delete the old token |
| Push to ghcr.io from CI | the workflow's own `GITHUB_TOKEN` | GitHub, per run | nothing to rotate: it expires with each run |

**Rules**
- Real values never go into Git, images, or logs. `.gitignore` covers `.env` and `env/*.env`; `.dockerignore` keeps them out of images.
- `.env.example` and `env/*.env.example` hold names and fake values only.
- If a secret was ever committed, deleting the file doesn't help (it is still in history). Rotate it.

**Proving it**
```bash
gitleaks detect --source . --log-opts="--all"          # history scan, expect "no leaks found"
docker history --no-trunc forgeops/forgeops-api:dev | grep -iE 'password|secret|token' || echo "no secrets in layers"
docker run --rm --entrypoint sh forgeops/forgeops-api:dev -c 'ls -la /app; env | grep -i pass || echo clean'
```

**Rotating the database password** (practised in Task 4)
```bash
NEW=$(openssl rand -base64 24 | tr -d '/+=')
docker compose --env-file env/staging.env -p forgeops-staging exec postgres \
  psql -U forgeops -d forgeops -c "ALTER USER forgeops WITH PASSWORD '$NEW';"
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW/" env/staging.env
docker compose --env-file env/staging.env -p forgeops-staging up -d api worker   # recreated with the new value
curl -fsS http://127.0.0.1:8081/health                                          # still 200
```
