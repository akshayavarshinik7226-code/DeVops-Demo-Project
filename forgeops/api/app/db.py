"""Database connection and table definitions (SQLAlchemy Core)."""

import os

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    create_engine,
    func,
)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./forgeops-dev.db")

# psycopg 3 driver for PostgreSQL URLs written as postgresql://
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True, connect_args=_connect_args)

metadata = MetaData()

employees = Table(
    "employees",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("emp_code", String(16), unique=True, nullable=False),
    Column("full_name", String(120), nullable=False),
    Column("email", String(160), nullable=False),
    Column("department", String(60), nullable=False, index=True),
    Column("title", String(80), nullable=False),
    Column("location", String(60), nullable=False),
    Column("monthly_salary", Numeric(12, 2), nullable=False),
    Column("status", String(16), nullable=False, default="active"),
    Column("joined_on", Date, nullable=False),
)

payroll_runs = Table(
    "payroll_runs",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("period", String(7), nullable=False),  # YYYY-MM
    Column("status", String(16), nullable=False, default="queued"),
    Column("employee_count", Integer, nullable=False, default=0),
    Column("total_gross", Numeric(14, 2), nullable=False, default=0),
    Column("total_tax", Numeric(14, 2), nullable=False, default=0),
    Column("total_net", Numeric(14, 2), nullable=False, default=0),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
    Column("completed_at", DateTime(timezone=True), nullable=True),
    Column("error", String(255), nullable=True),
)


def init_db() -> None:
    metadata.create_all(engine)
