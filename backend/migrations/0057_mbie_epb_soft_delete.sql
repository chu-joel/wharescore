-- Track removals from the MBIE national Earthquake-Prone Building register.
--
-- Before: the loader did DELETE FROM mbie_epb on every refresh, so when a
-- building was delisted (remediated, demolished, reclassified) it silently
-- vanished from our DB with no audit trail. We also ignored MBIE's own
-- `hasBeenRemoved` flag, so previously-delisted rows were counted as active.
--
-- After:
--   * Base table is renamed to mbie_epb_history and retains every row we've
--     ever seen from MBIE.
--   * A view named mbie_epb exposes only currently-listed rows (MBIE says
--     hasBeenRemoved=false AND we've seen it in the latest fetch).
--   * New columns:
--       - first_seen_at / last_seen_at / removed_at — audit trail.
--       - has_been_removed          — MBIE's authoritative flag.
--       - raw_json                  — full MBIE list-endpoint payload so we
--                                     can extract new fields later without a
--                                     schema change (noticeType,
--                                     hasPartPriority, image, and whatever
--                                     else MBIE adds).

ALTER TABLE mbie_epb ADD COLUMN IF NOT EXISTS first_seen_at    TIMESTAMPTZ;
ALTER TABLE mbie_epb ADD COLUMN IF NOT EXISTS last_seen_at     TIMESTAMPTZ;
ALTER TABLE mbie_epb ADD COLUMN IF NOT EXISTS removed_at       TIMESTAMPTZ;
ALTER TABLE mbie_epb ADD COLUMN IF NOT EXISTS has_been_removed BOOLEAN DEFAULT FALSE;
ALTER TABLE mbie_epb ADD COLUMN IF NOT EXISTS raw_json         JSONB;

UPDATE mbie_epb
SET first_seen_at = COALESCE(first_seen_at, NOW()),
    last_seen_at  = COALESCE(last_seen_at,  NOW())
WHERE first_seen_at IS NULL OR last_seen_at IS NULL;

-- Swap: rename the table, publish a view under the old name so existing
-- callers (get_property_report() and friends) keep working untouched.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'mbie_epb' AND c.relkind = 'r' AND n.nspname = current_schema()
    ) THEN
        EXECUTE 'ALTER TABLE mbie_epb RENAME TO mbie_epb_history';
    END IF;
END $$;

-- "Active" = not soft-deleted AND not flagged by MBIE as removed.
CREATE OR REPLACE VIEW mbie_epb AS
SELECT id, name, address_line1, address_line2, suburb, city, region,
       earthquake_rating, heritage_status, construction_type, design_date,
       priority, notice_date, completion_deadline, issued_by,
       seismic_risk_area, geom,
       first_seen_at, last_seen_at, removed_at,
       has_been_removed, raw_json
FROM mbie_epb_history
WHERE removed_at IS NULL
  AND has_been_removed = FALSE;

CREATE INDEX IF NOT EXISTS idx_mbie_epb_active_geom
    ON mbie_epb_history USING GIST (geom)
    WHERE removed_at IS NULL AND has_been_removed = FALSE;

CREATE INDEX IF NOT EXISTS idx_mbie_epb_last_seen
    ON mbie_epb_history (last_seen_at);

CREATE INDEX IF NOT EXISTS idx_mbie_epb_has_been_removed
    ON mbie_epb_history (has_been_removed);
