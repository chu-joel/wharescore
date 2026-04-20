# backend/app/services/event_writer.py
"""Fire-and-forget event writer with background batch flush to PostgreSQL."""
from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import date, datetime, timezone
from typing import Any

from .. import db

logger = logging.getLogger(__name__)

# Bounded queue — silently drops events if full to avoid memory pressure
_queue: asyncio.Queue | None = None
_flush_task: asyncio.Task | None = None
_MAX_QUEUE = 10_000
_FLUSH_INTERVAL = 2.0  # seconds
_FLUSH_BATCH = 50
_last_aggregation_date: date | None = None


def _hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


def client_ip_from_request(request) -> str | None:
    """Extract the real client IP from a FastAPI Request.

    Reads X-Forwarded-For and X-Real-IP first (host nginx sets these),
    falls back to request.client.host. With uvicorn running under
    --proxy-headers the fallback is ALSO safe — it reads from
    X-Forwarded-For under the hood. Without --proxy-headers the
    fallback returns the Docker bridge gateway IP, which would hash
    the same for every user (the exact bug we just fixed).

    Call from any router that wants to track_event with a real IP so
    the admin unique-visitors count is meaningful. Every server-side
    track_event should thread this through; the `/events` frontend
    ingestion endpoint already does.
    """
    try:
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
        real = request.headers.get("x-real-ip", "")
        if real:
            return real.strip()
        if request.client:
            return request.client.host
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Public API — all non-blocking
# ---------------------------------------------------------------------------

def track_event(
    event_type: str,
    *,
    user_id: str | None = None,
    session_id: str | None = None,
    ip: str | None = None,
    properties: dict[str, Any] | None = None,
) -> None:
    _enqueue("app_events", {
        "event_type": event_type,
        "user_id": user_id,
        "session_id": session_id,
        "ip_hash": _hash_ip(ip),
        "properties": properties or {},
    })


def write_perf_metric(
    *,
    method: str,
    path: str,
    path_template: str | None,
    status_code: int,
    duration_ms: float,
    user_id: str | None = None,
    ip: str | None = None,
    request_id: str | None = None,
) -> None:
    _enqueue("perf_metrics", {
        "method": method,
        "path": path,
        "path_template": path_template,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
        "user_id": user_id,
        "ip_hash": _hash_ip(ip),
        "request_id": request_id,
    })


def log_error(
    category: str,
    message: str,
    *,
    level: str = "error",
    traceback: str | None = None,
    request_id: str | None = None,
    path: str | None = None,
    user_id: str | None = None,
    properties: dict[str, Any] | None = None,
) -> None:
    _enqueue("error_log", {
        "level": level,
        "category": category,
        "message": message[:2000],
        "traceback": traceback[:10000] if traceback else None,
        "request_id": request_id,
        "path": path,
        "user_id": user_id,
        "properties": properties or {},
    })


# ---------------------------------------------------------------------------
# Lifecycle — called from main.py lifespan
# ---------------------------------------------------------------------------

async def start_writer() -> None:
    global _queue, _flush_task
    _queue = asyncio.Queue(maxsize=_MAX_QUEUE)
    _flush_task = asyncio.create_task(_flush_loop())
    logger.info("Event writer started")


async def stop_writer() -> None:
    global _flush_task
    if _flush_task:
        _flush_task.cancel()
        try:
            await _flush_task
        except asyncio.CancelledError:
            pass
    # Final flush
    if _queue and not _queue.empty():
        await _flush()
    logger.info("Event writer stopped")


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

def _enqueue(table: str, data: dict) -> None:
    if _queue is None:
        return
    try:
        _queue.put_nowait((table, data))
    except asyncio.QueueFull:
        pass  # Drop silently — better than blocking a request


async def _flush_loop() -> None:
    global _last_aggregation_date
    while True:
        try:
            await asyncio.sleep(_FLUSH_INTERVAL)
            if _queue and not _queue.empty():
                await _flush()

            # Midnight aggregation check
            today = date.today()
            if _last_aggregation_date is None:
                _last_aggregation_date = today
            elif today != _last_aggregation_date:
                yesterday = _last_aggregation_date
                _last_aggregation_date = today
                await _aggregate_day(yesterday)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Event writer flush error")


async def _flush() -> None:
    if not _queue or not db.pool:
        return

    # Drain queue
    items: list[tuple[str, dict]] = []
    while not _queue.empty() and len(items) < _FLUSH_BATCH * 3:
        try:
            items.append(_queue.get_nowait())
        except asyncio.QueueEmpty:
            break

    if not items:
        return

    # Group by table
    by_table: dict[str, list[dict]] = {}
    for table, data in items:
        by_table.setdefault(table, []).append(data)

    try:
        async with db.pool.connection() as conn:
            for table, rows in by_table.items():
                if not rows:
                    continue
                cols = list(rows[0].keys())
                placeholders = ", ".join(f"%({c})s" for c in cols)
                col_names = ", ".join(cols)

                # psycopg3 requires JSON to be serialized
                import json
                for row in rows:
                    for k, v in row.items():
                        if isinstance(v, dict):
                            row[k] = json.dumps(v)

                sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})"
                for row in rows:
                    await conn.execute(sql, row)
    except Exception:
        logger.exception("Failed to flush analytics events")


async def _aggregate_day(day: date) -> None:
    """Roll up yesterday's raw events into daily_metrics."""
    if not db.pool:
        return
    try:
        day_str = day.isoformat()
        async with db.pool.connection() as conn:
            # Aggregate app_events by type
            await conn.execute("""
                INSERT INTO daily_metrics (day, metric_name, metric_value)
                SELECT %s::date, event_type, COUNT(*)
                FROM app_events
                WHERE created_at >= %s::date AND created_at < (%s::date + INTERVAL '1 day')
                GROUP BY event_type
                ON CONFLICT (day, metric_name)
                DO UPDATE SET metric_value = EXCLUDED.metric_value
            """, [day_str, day_str, day_str])

            # Aggregate perf_metrics — total requests and avg duration
            await conn.execute("""
                INSERT INTO daily_metrics (day, metric_name, metric_value)
                SELECT %s::date, 'total_requests', COUNT(*)
                FROM perf_metrics
                WHERE created_at >= %s::date AND created_at < (%s::date + INTERVAL '1 day')
                ON CONFLICT (day, metric_name)
                DO UPDATE SET metric_value = EXCLUDED.metric_value
            """, [day_str, day_str, day_str])

            await conn.execute("""
                INSERT INTO daily_metrics (day, metric_name, metric_value, properties)
                SELECT %s::date, 'avg_response_ms',
                       ROUND(AVG(duration_ms))::bigint,
                       jsonb_build_object('p95', ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms))::bigint)
                FROM perf_metrics
                WHERE created_at >= %s::date AND created_at < (%s::date + INTERVAL '1 day')
                ON CONFLICT (day, metric_name)
                DO UPDATE SET metric_value = EXCLUDED.metric_value, properties = EXCLUDED.properties
            """, [day_str, day_str, day_str])

            # Aggregate errors
            await conn.execute("""
                INSERT INTO daily_metrics (day, metric_name, metric_value)
                SELECT %s::date, 'errors', COUNT(*)
                FROM error_log
                WHERE created_at >= %s::date AND created_at < (%s::date + INTERVAL '1 day')
                ON CONFLICT (day, metric_name)
                DO UPDATE SET metric_value = EXCLUDED.metric_value
            """, [day_str, day_str, day_str])

        logger.info(f"Daily aggregation completed for {day_str}")
    except Exception:
        logger.exception(f"Daily aggregation failed for {day}")
