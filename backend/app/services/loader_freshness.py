"""
loader_freshness.py — cheap upstream change-detection + validation gate.

Two responsibilities:

1. **Freshness checks.** Before running a full bulk reload (which can take
   minutes and hammers upstream ArcGIS endpoints), poll a tiny metadata
   endpoint to ask "has anything changed since we last successfully loaded?"
   If not, skip the reload entirely.

   Detection methods (per DataSource.change_detection):
     - `arcgis_lastEditDate` — fetch `?f=pjson` (~1-2KB), compare
       `editingInfo.lastEditDate` to our stored marker.
     - `http_etag` — HEAD request, compare `ETag` / `Last-Modified` header.
     - `row_count_diff` — full download + count, compare to last row count.
       Only when neither metadata method works.
     - `manual` / `none` — no automatic check possible.

2. **Validation gate.** When a reload IS run, refuse to commit if the new
   row count is implausibly low vs. the previous successful load. Prevents
   the catastrophic case where AC's ArcGIS returns HTTP 200 with 0 features
   (a transient server hiccup) and we DELETE 35k rows then INSERT 0.

The two pieces are deliberately separate: the freshness check is read-only
(makes an HTTP request, returns a yes/no), while the validation gate is
a check applied INSIDE the loader's transaction.

Called from:
  - `data_loader.run_loader()` — wraps the loader call with a freshness
    check (skipping if unchanged) and validation gate (rejecting if the
    delta is implausibly large).
  - `routers/admin.py` admin_check_freshness — exposes the freshness check
    as a standalone endpoint for the GitHub Actions cron to query.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg
import requests

logger = logging.getLogger(__name__)


# A reload is rejected if the new row count is below this fraction of the
# previous successful load. The 50% floor is generous enough to absorb
# legitimate council schema changes ("we split the layer in two") while
# catching the common failure mode (upstream returned ~zero features).
# Set to 0 (disable) for sources where wild row-count swings are normal —
# e.g. event registers that grow/shrink continuously.
VALIDATION_FLOOR_PCT = 0.50

# How recent must a successful freshness check be for the scheduler to
# accept it as authoritative? After this window the next attempt is forced
# to do a full check rather than trust a cached "no change" result.
FRESHNESS_CHECK_TTL = timedelta(days=2)

# Per-cadence intervals — how often we re-poll the upstream change marker.
# Values must match data_loader.CheckInterval enum.
CHECK_INTERVAL_DELTA: dict[str, timedelta | None] = {
    "weekly":    timedelta(days=7),
    "monthly":   timedelta(days=30),
    "quarterly": timedelta(days=90),
    "yearly":    timedelta(days=365),
    "never":     None,  # don't poll at all
    "unknown":   timedelta(days=30),  # safe default until classified
}


# ─────────────────────────────────────────────────────────────────────────
# Health-table I/O
# ─────────────────────────────────────────────────────────────────────────

@dataclass
class HealthRow:
    """In-memory mirror of a `data_source_health` row. None for any field
    means "never recorded yet"."""
    source_key: str
    last_attempt_at: datetime | None = None
    last_success_at: datetime | None = None
    last_freshness_check_at: datetime | None = None
    last_upstream_marker: str | None = None
    last_row_count: int | None = None
    last_error: str | None = None
    consecutive_failures: int = 0
    last_blocked_by_gate: bool = False
    success_count: int = 0
    failure_count: int = 0


def _fetch_health(conn: psycopg.Connection, source_key: str) -> HealthRow:
    """Read the health row for a source. Returns a HealthRow with all-None
    fields if no row exists yet."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT source_key, last_attempt_at, last_success_at,
               last_freshness_check_at, last_upstream_marker,
               last_row_count, last_error, consecutive_failures,
               last_blocked_by_gate, success_count, failure_count
        FROM data_source_health WHERE source_key = %s
        """,
        (source_key,),
    )
    row = cur.fetchone()
    if not row:
        return HealthRow(source_key=source_key)
    return HealthRow(
        source_key=row[0],
        last_attempt_at=row[1], last_success_at=row[2],
        last_freshness_check_at=row[3], last_upstream_marker=row[4],
        last_row_count=row[5], last_error=row[6],
        consecutive_failures=row[7] or 0,
        last_blocked_by_gate=row[8] or False,
        success_count=row[9] or 0, failure_count=row[10] or 0,
    )


def record_attempt(
    conn: psycopg.Connection,
    source_key: str,
    *,
    success: bool,
    row_count: int | None = None,
    error: str | None = None,
    upstream_marker: str | None = None,
    blocked_by_gate: bool = False,
) -> None:
    """Write a load attempt to data_source_health.

    UPSERT semantics: success increments success_count and resets
    consecutive_failures; failure increments both failure_count and
    consecutive_failures. Updates `last_*` timestamps to NOW()."""
    if success:
        # Validation-gate blocks count as failures (bad data refused), but
        # don't update last_success_at or last_row_count — those should
        # reflect only confirmed-good loads.
        success_inc = 0 if blocked_by_gate else 1
        failure_inc = 1 if blocked_by_gate else 0
        consecutive_clear = not blocked_by_gate
    else:
        success_inc = 0
        failure_inc = 1
        consecutive_clear = False

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO data_source_health (
            source_key, last_attempt_at, last_success_at,
            last_upstream_marker, last_row_count, last_error,
            consecutive_failures, last_blocked_by_gate,
            success_count, failure_count
        ) VALUES (
            %s, NOW(),
            CASE WHEN %s AND NOT %s THEN NOW() ELSE NULL END,
            %s,
            CASE WHEN %s AND NOT %s THEN %s ELSE NULL END,
            %s,
            CASE WHEN %s THEN 0 ELSE 1 END,
            %s, %s, %s
        )
        ON CONFLICT (source_key) DO UPDATE SET
            last_attempt_at = NOW(),
            last_success_at = CASE
                WHEN EXCLUDED.last_success_at IS NOT NULL THEN EXCLUDED.last_success_at
                ELSE data_source_health.last_success_at
            END,
            last_upstream_marker = COALESCE(EXCLUDED.last_upstream_marker, data_source_health.last_upstream_marker),
            last_row_count = CASE
                WHEN %s AND NOT %s AND %s IS NOT NULL THEN %s
                ELSE data_source_health.last_row_count
            END,
            last_error = EXCLUDED.last_error,
            consecutive_failures = CASE
                WHEN %s THEN 0
                ELSE data_source_health.consecutive_failures + 1
            END,
            last_blocked_by_gate = EXCLUDED.last_blocked_by_gate,
            success_count = data_source_health.success_count + %s,
            failure_count = data_source_health.failure_count + %s
        """,
        (
            source_key,
            success, blocked_by_gate,
            upstream_marker,
            success, blocked_by_gate, row_count,
            error,
            consecutive_clear,
            # last_blocked_by_gate, success_count, failure_count:
            blocked_by_gate, success_inc, failure_inc,
            # ON CONFLICT params:
            success, blocked_by_gate, row_count, row_count,
            consecutive_clear,
            success_inc, failure_inc,
        ),
    )
    conn.commit()


def record_freshness_check(
    conn: psycopg.Connection,
    source_key: str,
    upstream_marker: str | None,
) -> None:
    """Record a successful freshness check (no full reload was run).

    This is called by the scheduler when it polls upstream metadata and
    finds 'no change' — we update last_freshness_check_at + last_upstream_marker
    so the next iteration knows the marker is still current."""
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO data_source_health (source_key, last_freshness_check_at, last_upstream_marker)
        VALUES (%s, NOW(), %s)
        ON CONFLICT (source_key) DO UPDATE SET
            last_freshness_check_at = NOW(),
            last_upstream_marker = COALESCE(EXCLUDED.last_upstream_marker, data_source_health.last_upstream_marker)
        """,
        (source_key, upstream_marker),
    )
    conn.commit()


# ─────────────────────────────────────────────────────────────────────────
# Upstream change detection
# ─────────────────────────────────────────────────────────────────────────

@dataclass
class FreshnessResult:
    """Outcome of an upstream metadata poll.

    `changed` is True when we have positive evidence of upstream change OR
    when we don't have enough information to be sure (fail-safe — when in
    doubt, run the full loader).

    `marker` is the new upstream change-marker to record (lastEditDate /
    ETag / row count); None if not applicable for this method."""
    changed: bool
    marker: str | None
    reason: str  # human-readable for logs / admin UI


def check_arcgis_freshness(url: str, since_marker: str | None, timeout: int = 10) -> FreshnessResult:
    """Poll an ArcGIS FeatureServer/MapServer layer's metadata for
    `editingInfo.lastEditDate`. Returns changed=True if the lastEditDate
    is newer than `since_marker`, or if metadata is unavailable.

    `?f=pjson` returns ~1-2KB and counts against ArcGIS rate limits per
    request, so we don't burn it on `static` sources."""
    try:
        meta_url = url.rstrip("/") + "?f=pjson"
        resp = requests.get(meta_url, timeout=timeout)
        resp.raise_for_status()
        meta = resp.json()
    except Exception as e:
        # Conservative: when we can't poll, assume changed and let the
        # loader run. False positive (one extra reload) is much cheaper
        # than false negative (skipping a real change).
        return FreshnessResult(changed=True, marker=None, reason=f"metadata fetch failed: {e}")

    last_edit = (meta.get("editingInfo") or {}).get("lastEditDate")
    if last_edit is None:
        # Layer doesn't expose editingInfo — common on older council
        # MapServers. Fall back to "always run" semantics.
        return FreshnessResult(
            changed=True, marker=None,
            reason="endpoint does not expose editingInfo.lastEditDate",
        )

    new_marker = str(last_edit)
    if since_marker is None:
        return FreshnessResult(changed=True, marker=new_marker, reason="no prior marker recorded")
    if new_marker == since_marker:
        return FreshnessResult(changed=False, marker=new_marker, reason="lastEditDate unchanged")
    return FreshnessResult(
        changed=True, marker=new_marker,
        reason=f"lastEditDate changed: {since_marker} → {new_marker}",
    )


def check_http_etag_freshness(url: str, since_marker: str | None, timeout: int = 10) -> FreshnessResult:
    """HEAD a plain HTTP URL and compare ETag / Last-Modified.

    Used for GTFS zips and any plain-file feed that exposes those headers.
    Most NZ GTFS providers set at least Last-Modified."""
    try:
        resp = requests.head(url, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        return FreshnessResult(changed=True, marker=None, reason=f"HEAD failed: {e}")

    new_marker = resp.headers.get("ETag") or resp.headers.get("Last-Modified")
    if not new_marker:
        return FreshnessResult(
            changed=True, marker=None,
            reason="server did not return ETag or Last-Modified",
        )
    if since_marker is None:
        return FreshnessResult(changed=True, marker=new_marker, reason="no prior marker recorded")
    if new_marker == since_marker:
        return FreshnessResult(changed=False, marker=new_marker, reason="ETag/Last-Modified unchanged")
    return FreshnessResult(
        changed=True, marker=new_marker,
        reason=f"ETag/Last-Modified changed",
    )


def check_freshness_for(source: Any, conn: psycopg.Connection) -> FreshnessResult:
    """Dispatch to the appropriate freshness check for a DataSource.

    `source` is duck-typed as a `DataSource` to avoid an import cycle.
    Returns a FreshnessResult; the caller decides whether to run the
    full loader based on `result.changed`."""
    health = _fetch_health(conn, source.key)
    method = source.change_detection
    url = source.upstream_url

    if method in ("none", "manual", "unknown") or not url:
        # Can't check — caller must decide based on cadence schedule alone.
        return FreshnessResult(
            changed=True, marker=None,
            reason=f"change_detection={method}, no automatic check available",
        )

    if method == "arcgis_lastEditDate":
        result = check_arcgis_freshness(url, health.last_upstream_marker)
    elif method == "http_etag":
        result = check_http_etag_freshness(url, health.last_upstream_marker)
    elif method == "row_count_diff":
        # row_count_diff requires a full download to count, which defeats
        # the purpose of a cheap check. The scheduler should run the full
        # loader and rely on the validation gate; report changed=True so
        # that happens.
        result = FreshnessResult(
            changed=True, marker=None,
            reason="row_count_diff requires full download — caller will run loader",
        )
    else:
        result = FreshnessResult(
            changed=True, marker=None,
            reason=f"unknown change_detection method '{method}'",
        )

    # Record the freshness check (even when 'changed') so the admin
    # dashboard shows when we last looked.
    if not result.changed:
        record_freshness_check(conn, source.key, result.marker)

    return result


# ─────────────────────────────────────────────────────────────────────────
# Validation gate
# ─────────────────────────────────────────────────────────────────────────

def validate_row_count(
    conn: psycopg.Connection,
    source_key: str,
    new_row_count: int,
    floor_pct: float = VALIDATION_FLOOR_PCT,
) -> tuple[bool, str]:
    """Return (ok, reason). If ok=False, the loader should refuse to
    commit and the caller should rollback any changes.

    Logic: if a previous successful load recorded a row count, the new
    count must be at least `floor_pct * previous_count`. If no prior count
    exists, we accept any non-zero result (first load).

    The floor catches the catastrophic case where upstream returned 0
    features due to a transient server error — without this gate, the
    DELETE-then-INSERT pattern in `_load_council_arcgis` would wipe
    real data."""
    health = _fetch_health(conn, source_key)
    prev = health.last_row_count

    if prev is None or prev == 0:
        if new_row_count == 0:
            return False, "first-load returned 0 rows; refusing to record empty success"
        return True, f"first load: accepted {new_row_count} rows"

    floor = int(prev * floor_pct)
    if new_row_count < floor:
        return False, (
            f"row count dropped from {prev} to {new_row_count} "
            f"(below {int(floor_pct * 100)}% floor of {floor}); "
            f"refusing to commit — likely upstream transient failure"
        )
    return True, f"accepted {new_row_count} rows (prev {prev})"


# ─────────────────────────────────────────────────────────────────────────
# Scheduler entry point
# ─────────────────────────────────────────────────────────────────────────

def is_due_for_check(source: Any, health: HealthRow, now: datetime | None = None) -> bool:
    """Should the scheduler check this source for freshness right now?

    A source is due if:
      - it has never been attempted, OR
      - the last attempt is older than the source's check_interval window.

    `static` / `never` sources are never due — we explicitly do not
    auto-refresh peer-reviewed studies. `auto_load_enabled=False` sources
    are also never due — they need explicit operator action to run."""
    if not getattr(source, "auto_load_enabled", True):
        return False
    if source.cadence_class == "static" or source.check_interval == "never":
        return False

    delta = CHECK_INTERVAL_DELTA.get(source.check_interval)
    if delta is None:
        return False

    if health.last_attempt_at is None:
        return True

    now = now or datetime.now(timezone.utc)
    age = now - health.last_attempt_at
    return age >= delta


def select_due_sources(sources: list, conn: psycopg.Connection) -> list:
    """Return the subset of `sources` that are due for a freshness check.
    Cheap — only reads `data_source_health`."""
    now = datetime.now(timezone.utc)
    due = []
    for src in sources:
        health = _fetch_health(conn, src.key)
        if is_due_for_check(src, health, now):
            due.append(src)
    return due
