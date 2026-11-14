# Release and rollback drill (Task 16)

| Time (UTC) | Event |
|---|---|
| | Started deploy of the broken version to staging |
| | Health check failing (deploy.sh output / Grafana / alert) |
| | Automatic rollback started |
| | Previous version healthy again |

**Rollback took**: ___ seconds (target under 120)
**Backup taken before deploy**: file name ___
**Did the bad version reach production?** No: production is deployed only after staging passes.
**What I would automate next**:
