-- 0061_data_source_health.sql
-- Tracks operational state of each DataSource loader so the scheduler knows
-- when to run the next refresh, the admin dashboard can surface stale or
-- failing sources, and reloads can be gated on row-count sanity.
--
-- Populated by:
--   - run_loader() in backend/app/services/data_loader.py — writes a row on
--     every loader invocation (success and failure).
--   - check_freshness_for() in backend/app/services/loader_freshness.py —
--     records the result of cheap upstream metadata polls so we can decide
--     whether a full reload is worth running.
--
-- One row per DataSource key. Loaders that have never run have no row
-- (left-join with NULL is the "never-attempted" signal).

CREATE TABLE IF NOT EXISTS data_source_health (
    -- DataSource registry key. Matches DATA_SOURCES_BY_KEY in data_loader.py.
    source_key TEXT PRIMARY KEY,

    -- Most-recent attempt (success OR failure). Used by the scheduler to
    -- decide "is this source due for another check_interval window?"
    last_attempt_at TIMESTAMPTZ,

    -- Most-recent successful load. NULL if every attempt has failed.
    last_success_at TIMESTAMPTZ,

    -- Most-recent successful freshness check (cheap upstream metadata poll
    -- via arcgis_lastEditDate / http_etag / row_count_diff). When this is
    -- newer than last_success_at and the upstream signal indicates "no
    -- change", we can skip the full reload entirely.
    last_freshness_check_at TIMESTAMPTZ,

    -- Most-recent upstream change marker observed (ArcGIS lastEditDate
    -- timestamp, HTTP ETag string, or row count). Compared on next check.
    last_upstream_marker TEXT,

    -- Row count from the most-recent successful load. The validation gate
    -- (see VALIDATION_FLOOR_PCT in loader_freshness.py) refuses reloads
    -- where the new count is < floor% of this value, to prevent the
    -- "AC ArcGIS returned 0 features → DELETE 35k INSERT 0" footgun.
    last_row_count INT,

    -- Most-recent error message and the attempt-count since last_success_at.
    -- consecutive_failures triggers alerting once it crosses a threshold
    -- (default 2 → "this loader has now failed twice running, look at it").
    last_error TEXT,
    consecutive_failures INT NOT NULL DEFAULT 0,

    -- Whether the most recent attempt was BLOCKED by the validation gate
    -- (vs. ran but failed for an upstream reason). Distinguishes
    -- "we deliberately refused to load bad data" from "the loader crashed".
    last_blocked_by_gate BOOLEAN NOT NULL DEFAULT FALSE,

    -- Cumulative counter for dashboards / SLOs.
    success_count INT NOT NULL DEFAULT 0,
    failure_count INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for the admin dashboard's "stalest first" / "failing first" sorts.
CREATE INDEX IF NOT EXISTS idx_data_source_health_last_success
    ON data_source_health (last_success_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_data_source_health_consecutive_failures
    ON data_source_health (consecutive_failures DESC)
    WHERE consecutive_failures > 0;

-- Auto-update updated_at on every row write.
CREATE OR REPLACE FUNCTION trg_data_source_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS data_source_health_updated_at ON data_source_health;
CREATE TRIGGER data_source_health_updated_at
    BEFORE UPDATE ON data_source_health
    FOR EACH ROW
    EXECUTE FUNCTION trg_data_source_health_updated_at();
