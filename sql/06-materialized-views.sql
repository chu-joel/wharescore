-- 06-materialized-views.sql
-- Pre-computed aggregates refreshed weekly (or on data load).
-- mv_sa2_valuations already exists — skip.

----------------------------------------------------------------------
-- CRIME DENSITY per area_unit (3-year window, percentile ranked)
-- Uses area_unit column (NOT meshblock — 2018 vs 2023 code mismatch)
----------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_crime_density CASCADE;
CREATE MATERIALIZED VIEW mv_crime_density AS
SELECT
  area_unit,
  territorial_authority AS ta,
  COUNT(*)::int AS crime_count_3yr,
  SUM(victimisations)::int AS victimisations_3yr,
  COUNT(*) FILTER (
    WHERE year_month >= (CURRENT_DATE - interval '1 year')::date
  )::int AS crime_count_1yr,
  PERCENT_RANK() OVER (ORDER BY SUM(victimisations)) AS percentile_rank
FROM crime
WHERE year_month >= (CURRENT_DATE - interval '3 years')::date
  AND area_unit IS NOT NULL AND area_unit != '999999'
GROUP BY area_unit, territorial_authority;

CREATE UNIQUE INDEX idx_mv_crime_au ON mv_crime_density(area_unit, ta);
CREATE INDEX idx_mv_crime_ta ON mv_crime_density(ta);

-- TA-level crime summary (city-wide stats for fallback)
DROP MATERIALIZED VIEW IF EXISTS mv_crime_ta CASCADE;
CREATE MATERIALIZED VIEW mv_crime_ta AS
SELECT
  territorial_authority AS ta,
  SUM(victimisations)::int AS victimisations_3yr,
  COUNT(DISTINCT area_unit)::int AS area_count,
  AVG(au_vics)::numeric AS avg_victimisations_per_au,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY au_vics) AS median_victimisations_per_au
FROM (
  SELECT territorial_authority, area_unit, SUM(victimisations) AS au_vics
  FROM crime
  WHERE year_month >= (CURRENT_DATE - interval '3 years')::date
    AND area_unit IS NOT NULL AND area_unit != '999999'
  GROUP BY territorial_authority, area_unit
) sub
GROUP BY territorial_authority;

CREATE UNIQUE INDEX idx_mv_crime_ta ON mv_crime_ta(ta);

----------------------------------------------------------------------
-- RENTAL MARKET per SA2 (latest quarter, with YoY)
----------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_rental_market CASCADE;
CREATE MATERIALIZED VIEW mv_rental_market AS
WITH latest AS (
  SELECT MAX(time_frame) AS q FROM bonds_detailed
  WHERE median_rent IS NOT NULL
),
curr AS (
  SELECT b.location_id, b.dwelling_type, b.number_of_beds,
         b.median_rent, b.lower_quartile_rent, b.upper_quartile_rent,
         b.geometric_mean_rent, b.total_bonds, b.active_bonds,
         b.time_frame
  FROM bonds_detailed b, latest l
  WHERE b.time_frame = l.q
    AND b.location_id IS NOT NULL AND b.location_id NOT IN ('', '-99')
    AND b.median_rent IS NOT NULL
)
SELECT
  c.location_id AS sa2_code,
  c.dwelling_type, c.number_of_beds,
  c.median_rent, c.lower_quartile_rent, c.upper_quartile_rent,
  c.geometric_mean_rent, c.total_bonds, c.active_bonds,
  c.time_frame AS quarter,
  prev.median_rent AS prev_year_median,
  CASE WHEN prev.median_rent > 0 THEN
    round(((c.median_rent - prev.median_rent) / prev.median_rent * 100)::numeric, 1)
  END AS yoy_pct,
  sa2.sa2_name, sa2.ta_name
FROM curr c
LEFT JOIN bonds_detailed prev
  ON c.location_id = prev.location_id
  AND c.dwelling_type = prev.dwelling_type
  AND c.number_of_beds = prev.number_of_beds
  AND prev.time_frame = c.time_frame - interval '1 year'
LEFT JOIN sa2_boundaries sa2 ON c.location_id = sa2.sa2_code;

CREATE INDEX idx_mv_rental_sa2 ON mv_rental_market(sa2_code);
CREATE INDEX idx_mv_rental_type ON mv_rental_market(dwelling_type, number_of_beds);

----------------------------------------------------------------------
-- RENTAL TRENDS per SA2 (CAGR at 1yr, 3yr, 5yr, 10yr)
----------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_rental_trends CASCADE;
CREATE MATERIALIZED VIEW mv_rental_trends AS
WITH ranked AS (
  SELECT location_id, dwelling_type, number_of_beds,
         time_frame, median_rent, active_bonds,
         ROW_NUMBER() OVER (
           PARTITION BY location_id, dwelling_type, number_of_beds
           ORDER BY time_frame DESC
         ) AS q_rank
  FROM bonds_detailed
  WHERE location_id IS NOT NULL AND location_id NOT IN ('', '-99')
    AND median_rent IS NOT NULL AND median_rent > 0
)
SELECT
  c.location_id AS sa2_code, c.dwelling_type, c.number_of_beds,
  c.median_rent AS current_median,
  c.time_frame AS current_quarter,
  -- YoY
  CASE WHEN y1.median_rent > 0 THEN
    round(((c.median_rent - y1.median_rent) / y1.median_rent * 100)::numeric, 1)
  END AS yoy_pct,
  -- 3yr CAGR
  CASE WHEN y3.median_rent > 0 THEN
    round((POWER(c.median_rent / y3.median_rent, 1.0/3) - 1)::numeric * 100, 1)
  END AS cagr_3yr,
  -- 5yr CAGR
  CASE WHEN y5.median_rent > 0 THEN
    round((POWER(c.median_rent / y5.median_rent, 1.0/5) - 1)::numeric * 100, 1)
  END AS cagr_5yr,
  -- 10yr CAGR
  CASE WHEN y10.median_rent > 0 THEN
    round((POWER(c.median_rent / y10.median_rent, 1.0/10) - 1)::numeric * 100, 1)
  END AS cagr_10yr
FROM ranked c
LEFT JOIN ranked y1  ON c.location_id = y1.location_id  AND c.dwelling_type = y1.dwelling_type  AND c.number_of_beds = y1.number_of_beds  AND y1.q_rank  = c.q_rank + 4
LEFT JOIN ranked y3  ON c.location_id = y3.location_id  AND c.dwelling_type = y3.dwelling_type  AND c.number_of_beds = y3.number_of_beds  AND y3.q_rank  = c.q_rank + 12
LEFT JOIN ranked y5  ON c.location_id = y5.location_id  AND c.dwelling_type = y5.dwelling_type  AND c.number_of_beds = y5.number_of_beds  AND y5.q_rank  = c.q_rank + 20
LEFT JOIN ranked y10 ON c.location_id = y10.location_id AND c.dwelling_type = y10.dwelling_type AND c.number_of_beds = y10.number_of_beds AND y10.q_rank = c.q_rank + 40
WHERE c.q_rank = 1;

CREATE INDEX idx_mv_trends_sa2 ON mv_rental_trends(sa2_code);
CREATE INDEX idx_mv_trends_combo ON mv_rental_trends(sa2_code, dwelling_type, number_of_beds);

----------------------------------------------------------------------
-- AREA PROFILES table (populated by AI script later)
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS area_profiles (
  sa2_code TEXT PRIMARY KEY,
  sa2_name TEXT NOT NULL,
  ta_name TEXT,
  profile TEXT NOT NULL,
  data_snapshot JSONB,
  model_used TEXT DEFAULT 'gpt-4o-mini',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
