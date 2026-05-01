-- 0062_data_change_log.sql
-- Per-row change history for upsert-capable loaders.
--
-- A row is written here every time the loader detects a real change at the
-- feature level: insert (new feature appeared upstream), update (a tracked
-- attribute changed), or delete (feature disappeared upstream).
--
-- Loaders without a stable upstream feature ID (diff_strategy = 'truncate_insert')
-- do NOT write to this table — there's no way for them to detect what
-- actually changed during a refresh.
--
-- Populated by: _record_change_log_entries() in loader_freshness.py, called
-- from the upsert path in _load_council_arcgis() when stable_id_field is set.
--
-- Use cases:
--   1. Audit: "when did this property flip in/out of the AC flood zone?"
--      → SELECT after_attrs, before_attrs FROM data_change_log
--        WHERE source_key='auckland_flood' AND source_feature_id='12345'
--        ORDER BY changed_at;
--   2. Validation gate: count of recent updates/deletes informs the
--      refusal-to-commit threshold (current row-count floor is too coarse).
--   3. User-facing change badges: "AC updated this flood map on 2026-03-15".

CREATE TABLE IF NOT EXISTS data_change_log (
    id BIGSERIAL PRIMARY KEY,

    -- DataSource registry key. Matches DATA_SOURCES_BY_KEY.
    source_key TEXT NOT NULL,

    -- The DB table the change applies to (e.g. 'flood_hazard'). Useful when
    -- one source writes to multiple tables.
    target_table TEXT NOT NULL,

    -- The upstream feature's stable identifier, as a string (e.g. AC's
    -- FPA_ID, or 'OBJECTID:12345' for sources where we synthesise an ID).
    -- `op='delete'` rows still carry the ID so we can reconstruct history.
    source_feature_id TEXT NOT NULL,

    -- One of 'insert' / 'update' / 'delete'. Use a CHECK rather than an
    -- enum for forward compatibility — adding values doesn't require
    -- migration drama.
    op TEXT NOT NULL CHECK (op IN ('insert', 'update', 'delete')),

    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Attribute snapshots. NULL for inserts (no before-state) and for
    -- deletes (no after-state). For updates, both are populated.
    -- We deliberately don't capture geometry here — too large, and
    -- geometry-only changes are rare for the layers we care about.
    -- If geometry diff matters later, add a separate boolean
    -- `geometry_changed` and reconstruct from history if needed.
    before_attrs JSONB,
    after_attrs JSONB,

    -- The job_id from data_loader:active that produced this entry, if
    -- known. Useful for grouping all changes from one cron run.
    job_id TEXT
);

-- "What changed in this source recently?" — primary access pattern for the
-- admin UI's change-history view.
CREATE INDEX IF NOT EXISTS idx_data_change_log_source_changed
    ON data_change_log (source_key, changed_at DESC);

-- "Show me the history of this specific upstream feature." Useful for the
-- audit trail when a user asks "when did this property change?".
CREATE INDEX IF NOT EXISTS idx_data_change_log_feature
    ON data_change_log (target_table, source_feature_id, changed_at DESC);

-- "Group all changes from this cron job." Used by the admin dashboard's
-- per-run summary.
CREATE INDEX IF NOT EXISTS idx_data_change_log_job
    ON data_change_log (job_id) WHERE job_id IS NOT NULL;
