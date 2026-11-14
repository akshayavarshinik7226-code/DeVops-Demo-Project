"""ForgeOps payroll worker.

Waits for jobs on the Redis list `payroll:queue`, calculates the payroll for the
period and writes the totals back to PostgreSQL. Uses only redis + psycopg.
"""

import json
import os
import signal
import sys
import time
from datetime import UTC, datetime
from decimal import Decimal

import psycopg
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://forgeops:forgeops@localhost:5432/forgeops")
QUEUE = "payroll:queue"
HEARTBEAT_KEY = "worker:heartbeat"
TAX_RATE = Decimal("0.12")  # flat, fictional, for training only
running = True


def log(msg: str, **fields) -> None:
    print(
        json.dumps({"ts": datetime.now(UTC).isoformat(), "logger": "forgeops.worker", "msg": msg, **fields}), flush=True
    )


def stop(*_):
    global running
    running = False
    log("shutdown requested")


def process(run_id: int) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("UPDATE payroll_runs SET status='running' WHERE id=%s", (run_id,))
        conn.commit()
        try:
            count, gross = conn.execute(
                "SELECT COUNT(*), COALESCE(SUM(monthly_salary),0) FROM employees WHERE status='active'"
            ).fetchone()
            gross = Decimal(gross)
            tax = (gross * TAX_RATE).quantize(Decimal("0.01"))
            time.sleep(float(os.getenv("WORKER_SIMULATED_SECONDS", "2")))  # makes the 'running' state visible
            conn.execute(
                "UPDATE payroll_runs SET status='completed', employee_count=%s, total_gross=%s, total_tax=%s, "
                "total_net=%s, completed_at=clock_timestamp(), error=NULL WHERE id=%s",
                (count, gross, tax, gross - tax, run_id),
            )
            conn.commit()
            log("payroll run completed", run_id=run_id, employees=count, gross=str(gross))
        except Exception as exc:
            conn.rollback()
            conn.execute("UPDATE payroll_runs SET status='failed', error=%s WHERE id=%s", (str(exc)[:250], run_id))
            conn.commit()
            log("payroll run failed", run_id=run_id, error=str(exc))


def main() -> int:
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    # socket timeout must be longer than the BRPOP wait, or idle waits look like failures
    r = redis.Redis.from_url(REDIS_URL, socket_timeout=15, socket_connect_timeout=5, health_check_interval=30)
    log("worker started", queue=QUEUE)
    while running:
        try:
            r.set(HEARTBEAT_KEY, int(time.time()), ex=30)
            item = r.brpop([QUEUE], timeout=5)
            if not item:
                continue
            job = json.loads(item[1])
            process(int(job["run_id"]))
        except redis.RedisError as exc:
            log("redis unavailable, retrying", error=str(exc))
            time.sleep(3)
        except psycopg.OperationalError as exc:
            log("database unavailable, retrying", error=str(exc))
            time.sleep(3)
    log("worker stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
