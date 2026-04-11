-- Migration 0047: mv_rental_market — use per-SA2 latest quarter
--
-- Problem: The previous definition filtered on a GLOBAL max(time_frame) across
-- the whole bonds_detailed table (currently 2025-10-01). Some SA2s (e.g. 326600
-- Christchurch Central) don't have data for every quarter, so their most recent
-- row is 2025-07-01 — they got dropped entirely from the MV and the report
-- showed an empty market section.
--
-- Fix: pick the latest quarter per (location_id, dwelling_type, number_of_beds)
-- tuple using DISTINCT ON, so every combo that has ANY data shows its most
-- recent snapshot.
--
-- Run: psql $DATABASE_URL -f backend/migrations/0047_rental_market_per_sa2.sql

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS mv_rental_market CASCADE;

CREATE MATERIALIZED VIEW mv_rental_market AS
WITH curr AS (
    SELECT DISTINCT ON (b.location_id, b.dwelling_type, b.number_of_beds)
        b.location_id,
        b.dwelling_type,
        b.number_of_beds,
        b.median_rent,
        b.lower_quartile_rent,
        b.upper_quartile_rent,
        b.geometric_mean_rent,
        b.total_bonds,
        b.active_bonds,
        b.time_frame
    FROM bonds_detailed b
    WHERE b.location_id IS NOT NULL
      AND b.location_id NOT IN ('', '-99')
      AND b.median_rent IS NOT NULL
    ORDER BY b.location_id, b.dwelling_type, b.number_of_beds, b.time_frame DESC
)
SELECT
    c.location_id AS sa2_code,
    c.dwelling_type,
    c.number_of_beds,
    c.median_rent,
    c.lower_quartile_rent,
    c.upper_quartile_rent,
    c.geometric_mean_rent,
    c.total_bonds,
    c.active_bonds,
    c.time_frame AS quarter,
    prev.median_rent AS prev_year_median,
    CASE
        WHEN (prev.median_rent > (0)::numeric) THEN
            round((((c.median_rent - prev.median_rent) / prev.median_rent) * (100)::numeric), 1)
        ELSE NULL::numeric
    END AS yoy_pct,
    sa2.sa2_name,
    sa2.ta_name
FROM curr c
LEFT JOIN bonds_detailed prev
    ON c.location_id = prev.location_id
   AND c.dwelling_type = prev.dwelling_type
   AND c.number_of_beds = prev.number_of_beds
   AND prev.time_frame = (c.time_frame - '1 year'::interval)
LEFT JOIN sa2_boundaries sa2
    ON c.location_id = sa2.sa2_code::text;

CREATE UNIQUE INDEX ON mv_rental_market (sa2_code, dwelling_type, number_of_beds);
CREATE INDEX ON mv_rental_market (sa2_code);
CREATE INDEX ON mv_rental_market (ta_name);

COMMIT;
