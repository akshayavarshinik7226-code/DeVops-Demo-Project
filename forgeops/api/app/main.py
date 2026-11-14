"""ForgeOps API: employees, payroll runs, health and metrics."""

import json
import logging
import os
import re
import sys
import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import redis
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel, field_validator
from sqlalchemy import func, or_, select, text

from .db import employees, engine, init_db, payroll_runs

APP_ENV = os.getenv("APP_ENV", "dev")
APP_VERSION = os.getenv("APP_VERSION", "0.0.0-dev")
GIT_COMMIT = os.getenv("GIT_COMMIT", "local")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QUEUE_NAME = "payroll:queue"
MAX_LIMIT = 200


# ---------- structured JSON logging ----------
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        payload.update(getattr(record, "extra_fields", {}))
        return json.dumps(payload)


log = logging.getLogger("forgeops.api")
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(JsonFormatter())
log.handlers = [_handler]
log.setLevel(logging.INFO)
log.propagate = False

# ---------- metrics ----------
REQUESTS = Counter("api_requests_total", "Total API requests", ["method", "path", "status"])
LATENCY = Histogram(
    "api_request_seconds",
    "API request latency in seconds",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)

_ID_RE = re.compile(r"/\d+")


def _route_label(path: str) -> str:
    """Collapse ids so metrics have low cardinality: /api/employees/12 -> /api/employees/:id"""
    return _ID_RE.sub("/:id", path)


def get_redis() -> redis.Redis:
    return redis.Redis.from_url(REDIS_URL, socket_connect_timeout=1, socket_timeout=2)


@asynccontextmanager
async def lifespan(_app):
    try:
        init_db()
    except Exception as exc:  # database may not be up yet; /health reports it
        log.warning("db init deferred", extra={"extra_fields": {"error": str(exc)}})
    yield


app = FastAPI(title="ForgeOps API", version=APP_VERSION, lifespan=lifespan)


@app.middleware("http")
async def observe(request: Request, call_next):
    start = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        elapsed = time.perf_counter() - start
        path = _route_label(request.url.path)
        if path != "/metrics":
            REQUESTS.labels(request.method, path, str(status)).inc()
            LATENCY.labels(request.method, path).observe(elapsed)
            log.info(
                "request",
                extra={
                    "extra_fields": {
                        "method": request.method,
                        "path": request.url.path,
                        "status": status,
                        "duration_ms": round(elapsed * 1000, 2),
                    }
                },
            )


# ---------- helpers ----------
def _emp_row(r) -> dict:
    return {
        "id": r.id,
        "emp_code": r.emp_code,
        "full_name": r.full_name,
        "email": r.email,
        "department": r.department,
        "title": r.title,
        "location": r.location,
        "monthly_salary": float(r.monthly_salary),
        "status": r.status,
        "joined_on": r.joined_on.isoformat() if r.joined_on else None,
    }


def _run_row(r) -> dict:
    return {
        "id": r.id,
        "period": r.period,
        "status": r.status,
        "employee_count": r.employee_count,
        "total_gross": float(r.total_gross or 0),
        "total_tax": float(r.total_tax or 0),
        "total_net": float(r.total_net or 0),
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "error": r.error,
    }


# ---------- system endpoints ----------
@app.get("/health")
def health():
    checks = {}
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "down"
    try:
        get_redis().ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "down"
    ok = all(v == "ok" for v in checks.values())
    body = {"status": "ok" if ok else "degraded", "checks": checks, "version": APP_VERSION}
    return JSONResponse(body, status_code=200 if ok else 503)


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/api/version")
def version():
    return {"version": APP_VERSION, "commit": GIT_COMMIT, "env": APP_ENV}


@app.get("/api/system")
def system():
    """Everything the UI's System page needs in one call."""
    info = {
        "version": APP_VERSION,
        "commit": GIT_COMMIT,
        "env": APP_ENV,
        "database": "down",
        "redis": "down",
        "worker": "unknown",
        "queue_depth": None,
    }
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        info["database"] = "ok"
    except Exception:
        pass
    try:
        r = get_redis()
        info["queue_depth"] = r.llen(QUEUE_NAME)
        info["redis"] = "ok"
        beat = r.get("worker:heartbeat")
        info["worker"] = "ok" if beat and time.time() - int(beat) < 30 else "down"
    except Exception:
        pass
    return info


# ---------- employees ----------
@app.get("/api/employees")
def list_employees(
    limit: int = Query(25, ge=1),
    offset: int = Query(0, ge=0),
    q: str | None = None,
    department: str | None = None,
    sort: str = "full_name",
):
    if limit > MAX_LIMIT:
        raise HTTPException(status_code=400, detail=f"limit must be {MAX_LIMIT} or less")
    sortable = {
        "full_name": employees.c.full_name,
        "department": employees.c.department,
        "monthly_salary": employees.c.monthly_salary,
        "joined_on": employees.c.joined_on,
        "-monthly_salary": employees.c.monthly_salary.desc(),
        "-joined_on": employees.c.joined_on.desc(),
    }
    if sort not in sortable:
        raise HTTPException(status_code=400, detail="unknown sort field")

    where = []
    if q:
        like = f"%{q.lower()}%"
        where.append(
            or_(
                func.lower(employees.c.full_name).like(like),
                func.lower(employees.c.email).like(like),
                func.lower(employees.c.emp_code).like(like),
                func.lower(employees.c.title).like(like),
            )
        )
    if department:
        where.append(employees.c.department == department)

    with engine.connect() as conn:
        total = conn.execute(select(func.count()).select_from(employees).where(*where)).scalar_one()
        rows = conn.execute(
            select(employees).where(*where).order_by(sortable[sort], employees.c.id).limit(limit).offset(offset)
        ).all()
    return {"total": total, "limit": limit, "offset": offset, "items": [_emp_row(r) for r in rows]}


@app.get("/api/employees/{emp_id}")
def get_employee(emp_id: int):
    with engine.connect() as conn:
        row = conn.execute(select(employees).where(employees.c.id == emp_id)).first()
    if not row:
        raise HTTPException(status_code=404, detail="employee not found")
    return _emp_row(row)


@app.get("/api/departments")
def departments():
    with engine.connect() as conn:
        rows = conn.execute(
            select(
                employees.c.department,
                func.count().label("headcount"),
                func.sum(employees.c.monthly_salary).label("monthly_cost"),
            )
            .group_by(employees.c.department)
            .order_by(func.count().desc())
        ).all()
    return [
        {"department": r.department, "headcount": r.headcount, "monthly_cost": float(r.monthly_cost or 0)} for r in rows
    ]


@app.get("/api/stats")
def stats():
    with engine.connect() as conn:
        headcount = conn.execute(select(func.count()).select_from(employees)).scalar_one()
        active = conn.execute(
            select(func.count()).select_from(employees).where(employees.c.status == "active")
        ).scalar_one()
        cost = conn.execute(select(func.coalesce(func.sum(employees.c.monthly_salary), 0))).scalar_one()
        dept_count = conn.execute(select(func.count(func.distinct(employees.c.department)))).scalar_one()
        last = conn.execute(
            select(payroll_runs).where(payroll_runs.c.status == "completed").order_by(payroll_runs.c.id.desc()).limit(1)
        ).first()
    return {
        "headcount": headcount,
        "active": active,
        "monthly_cost": float(cost),
        "departments": dept_count,
        "last_completed_run": _run_row(last) if last else None,
    }


# ---------- payroll runs ----------
class PayrollRunIn(BaseModel):
    period: str

    @field_validator("period")
    @classmethod
    def check_period(cls, v: str) -> str:
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", v):
            raise ValueError("period must look like YYYY-MM")
        return v


@app.get("/api/payroll-runs")
def list_runs(limit: int = Query(20, ge=1, le=100)):
    with engine.connect() as conn:
        rows = conn.execute(select(payroll_runs).order_by(payroll_runs.c.id.desc()).limit(limit)).all()
    return [_run_row(r) for r in rows]


@app.get("/api/payroll-runs/{run_id}")
def get_run(run_id: int):
    with engine.connect() as conn:
        row = conn.execute(select(payroll_runs).where(payroll_runs.c.id == run_id)).first()
    if not row:
        raise HTTPException(status_code=404, detail="payroll run not found")
    return _run_row(row)


@app.post("/api/payroll-runs", status_code=202)
def create_run(body: PayrollRunIn):
    with engine.begin() as conn:
        busy = conn.execute(
            select(func.count())
            .select_from(payroll_runs)
            .where(payroll_runs.c.period == body.period, payroll_runs.c.status.in_(["queued", "running"]))
        ).scalar_one()
        if busy:
            raise HTTPException(status_code=409, detail=f"a run for {body.period} is already in progress")
        run_id = conn.execute(
            payroll_runs.insert().values(period=body.period, status="queued").returning(payroll_runs.c.id)
        ).scalar_one()
    try:
        get_redis().lpush(QUEUE_NAME, json.dumps({"run_id": run_id}))
    except Exception:
        with engine.begin() as conn:
            conn.execute(
                payroll_runs.update()
                .where(payroll_runs.c.id == run_id)
                .values(status="failed", error="queue unavailable")
            )
        raise HTTPException(status_code=503, detail="job queue unavailable, try again shortly") from None
    log.info("payroll run queued", extra={"extra_fields": {"run_id": run_id, "period": body.period}})
    return get_run(run_id)
