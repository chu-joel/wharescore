-- Extend user_rent_reports with the richer property details we capture
-- from RentComparisonFlow + RentAdvisorCard. Previously we only stored
-- dwelling_type, bedrooms, and weekly rent — the other inputs users
-- provided (bathrooms, finish tier, parking, furnishing, outdoor space,
-- character status, shared kitchen, utilities, insulation) were only
-- used to compute the on-screen estimate and then discarded.
--
-- We now persist everything the user tells us about their tenancy so
-- (a) community rent data gets more accurate as details accumulate and
-- (b) the frontend can enrich a row progressively as the user fills out
-- the rent advisor form.
--
-- All new columns are NULLABLE so existing rows keep working and the
-- backward-compatible /rent-reports body (bedrooms + rent only) still
-- validates.
--
-- Notice version lets us revise the privacy-notice copy over time
-- while keeping an audit trail of which version a given row was
-- collected under. No consent gate — the notice is informational; if
-- the user has seen it (localStorage.ws_rent_notice_seen is set) we
-- record the version they saw, otherwise it's the default.

ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS bathrooms             TEXT;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS finish_tier           TEXT;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS has_parking           BOOLEAN;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS is_furnished          BOOLEAN;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS is_partially_furnished BOOLEAN;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS has_outdoor_space     BOOLEAN;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS is_character_property BOOLEAN;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS shared_kitchen        BOOLEAN;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS utilities_included    BOOLEAN;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS not_insulated         BOOLEAN;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS source_context        TEXT;
ALTER TABLE user_rent_reports ADD COLUMN IF NOT EXISTS notice_version        TEXT;

-- Index used by progressive-enrichment UPSERTs (latest row per ip+address).
CREATE INDEX IF NOT EXISTS idx_rent_reports_ip_address_recent
  ON user_rent_reports (ip_hash, address_id, reported_at DESC);
