# Load test (Task 19), staging only

Command: `k6 run -e BASE_URL=https://staging.<DOMAIN> ops/k6/load_test.js`

| Metric | Before | After (one change: ______) |
|---|---|---|
| Peak virtual users | 50 | 50 |
| Requests per second | | |
| p95 latency (all) | | |
| p95 latency (employees_search) | | |
| Error rate | | |
| Peak API CPU | | |
| Peak PostgreSQL CPU | | |

**Bottleneck and evidence** (dashboard screenshot during the test):
**If traffic grew tenfold**:
