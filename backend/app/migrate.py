# backend/app/migrate.py
"""
Lightweight SQL migration runner.

Runs at app startup (synchronously, before the async pool is created).
Uses a PostgreSQL advisory lock so only one Uvicorn worker executes
migrations — the others skip immediately.
"""
from __future__ import annotations

import logging
from pathlib import Path

import psycopg

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def run_migrations(database_url: str) -> None:
    """Apply pending SQL migrations from MIGRATIONS_DIR."""
    conn = psycopg.connect(database_url, autocommit=True)
    try:
        # Advisory lock — non-blocking. Loser returns immediately.
        row = conn.execute("SELECT pg_try_advisory_lock(7483201)").fetchone()
        if not row or not row[0]:
            logger.info("migrations: another worker holds the lock — skipping")
            return

        # Ensure tracking table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version  TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)

        # Determine already-applied versions
        applied = {
            r[0]
            for r in conn.execute("SELECT version FROM schema_migrations").fetchall()
        }

        # Discover pending migration files
        if not MIGRATIONS_DIR.is_dir():
            logger.info("migrations: directory %s not found — skipping", MIGRATIONS_DIR)
            return

        pending = sorted(
            f for f in MIGRATIONS_DIR.glob("*.sql") if f.stem not in applied
        )

        if not pending:
            logger.info("migrations: 0 pending")
            return

        logger.info("migrations: %d pending — %s", len(pending), [f.name for f in pending])

        for migration_file in pending:
            sql = migration_file.read_text(encoding="utf-8")
            version = migration_file.stem
            logger.info("migrations: applying %s …", migration_file.name)
            with conn.transaction():
                conn.execute(sql)
                conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES (%s)",
                    (version,),
                )
            logger.info("migrations: applied %s", migration_file.name)

    finally:
        conn.close()
