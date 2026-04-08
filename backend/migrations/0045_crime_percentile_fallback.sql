-- Fix: Crime percentile is null for ~10% of addresses where SA2 name doesn't
-- match any NZ Police area_unit. At a Glance shows "?" for Crime.
--
-- Solution: When area_unit fuzzy match fails, use the TA median victimisations
-- ranked against ALL area_units nationally as a fallback percentile.
-- This is approximate but much better than showing "?" (unknown).

-- Step 1: Add ta_percentile to mv_crime_ta
-- This ranks each TA's median victimisations against all area_units nationally.
DROP MATERIALIZED VIEW IF EXISTS mv_crime_ta_ranked;

CREATE MATERIALIZED VIEW mv_crime_ta_ranked AS
SELECT
  ta,
  victimisations_3yr,
  area_count,
  avg_victimisations_per_au,
  median_victimisations_per_au,
  round((
    (SELECT COUNT(*)::float FROM mv_crime_density WHERE victimisations_3yr <= t.median_victimisations_per_au)
    / NULLIF((SELECT COUNT(*) FROM mv_crime_density), 0)
  )::numeric * 100, 1) AS ta_percentile
FROM mv_crime_ta t;

CREATE UNIQUE INDEX ON mv_crime_ta_ranked (ta);
