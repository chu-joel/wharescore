-- 0063_flood_hazard_stable_id.sql
-- Adds an upstream-stable-identifier column to flood_hazard so the
-- upsert-capable loader path can diff per-feature changes between runs.
--
-- This migration is conservative: only adds the column + index. Existing
-- rows are left with NULL (they were loaded via the old truncate+insert
-- path which doesn't track stable IDs). The next time a source like
-- auckland_flood reloads via the new upsert path, those existing rows
-- will be matched by their newly-computed stable_id and the column
-- back-filled in place.
--
-- Other target tables (district_plan_zones, heritage_extent, etc.) can
-- get the same treatment when their loaders move to the upsert path.
-- Add a separate migration per table when adopting upsert there.

ALTER TABLE flood_hazard
    ADD COLUMN IF NOT EXISTS feature_stable_id TEXT;

-- Used by the upsert path to look up existing rows by stable ID within
-- a given source_council scope. Partial index — most rows will have NULL
-- until their source migrates to upsert.
CREATE INDEX IF NOT EXISTS idx_flood_hazard_stable_id
    ON flood_hazard (source_council, feature_stable_id)
    WHERE feature_stable_id IS NOT NULL;
