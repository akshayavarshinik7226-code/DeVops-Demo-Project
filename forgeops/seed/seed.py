"""Loads the seed CSVs into the database. Safe to run twice (it skips if data exists).

Usage (inside the api container, which has the app package):
    docker compose run --rm seed
or locally:
    cd api && DATABASE_URL=... python ../seed/seed.py
"""

import csv
import sys
from datetime import UTC, date, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
for candidate in (HERE.parent / "api", Path("/app")):
    if (candidate / "app" / "db.py").exists():
        sys.path.insert(0, str(candidate))
        break

from sqlalchemy import func, select

from app.db import employees, engine, init_db, payroll_runs


def main(force: bool = False) -> int:
    init_db()
    with engine.begin() as conn:
        existing = conn.execute(select(func.count()).select_from(employees)).scalar_one()
        if existing and not force:
            print(f"seed skipped: {existing} employees already present")
            return existing
        if force:
            conn.execute(payroll_runs.delete())
            conn.execute(employees.delete())

        with open(HERE / "employees.csv", newline="") as f:
            emp_rows = [
                {**r, "monthly_salary": float(r["monthly_salary"]), "joined_on": date.fromisoformat(r["joined_on"])}
                for r in csv.DictReader(f)
            ]
        conn.execute(employees.insert(), emp_rows)

        with open(HERE / "payroll_runs.csv", newline="") as f:
            run_rows = []
            for r in csv.DictReader(f):
                y, m = map(int, r["period"].split("-"))
                ts = datetime(y, m, 28, 10, 0, tzinfo=UTC)
                run_rows.append(
                    {
                        "period": r["period"],
                        "status": r["status"],
                        "employee_count": int(r["employee_count"]),
                        "total_gross": float(r["total_gross"]),
                        "total_tax": float(r["total_tax"]),
                        "total_net": float(r["total_net"]),
                        "created_at": ts,
                        "completed_at": ts,
                    }
                )
        conn.execute(payroll_runs.insert(), run_rows)
    print(f"seeded {len(emp_rows)} employees and {len(run_rows)} payroll runs")
    return len(emp_rows)


if __name__ == "__main__":
    main(force="--force" in sys.argv)
