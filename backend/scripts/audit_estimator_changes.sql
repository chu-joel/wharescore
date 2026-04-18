-- Estimator audit backtest (2026-04-18 session)
-- Read-only. Safe to run on prod.

\echo '=== Backtest 3: imp_ratio SA2 coverage + IQR distribution ==='
WITH stats AS (
  SELECT sa2.sa2_code,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY (cv.capital_value - cv.land_value)::float / cv.capital_value) AS p25,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY (cv.capital_value - cv.land_value)::float / cv.capital_value) AS p75,
    COUNT(*) AS n
  FROM council_valuations cv
  JOIN sa2_boundaries sa2 ON ST_Contains(sa2.geom, cv.geom)
  WHERE cv.capital_value > cv.land_value AND cv.land_value > 0
  GROUP BY sa2.sa2_code
)
SELECT
  COUNT(*) AS total_sa2s,
  COUNT(*) FILTER (WHERE n >= 20) AS sa2s_with_enough_data,
  ROUND(100.0 * COUNT(*) FILTER (WHERE n >= 20) / NULLIF(COUNT(*), 0), 1) AS pct_covered,
  ROUND((AVG(p25 * 100) FILTER (WHERE n >= 20))::numeric, 1) AS avg_p25_pct,
  ROUND((AVG(p75 * 100) FILTER (WHERE n >= 20))::numeric, 1) AS avg_p75_pct,
  ROUND((AVG((p75 - p25) * 100) FILTER (WHERE n >= 20))::numeric, 1) AS avg_iqr_pct
FROM stats;

\echo ''
\echo '=== Backtest 4: What fraction of addresses would trigger age_proxy? ==='
-- A property triggers age_proxy if its imp_ratio is either above p75 or below p25
-- of its SA2. By definition in a big enough SA2, that's ~50% of properties.
-- Real question: how does this interact with the cv_age <= 36 month gate?
WITH sa2_stats AS (
  SELECT sa2.sa2_code,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY (cv.capital_value - cv.land_value)::float / cv.capital_value) AS p25,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY (cv.capital_value - cv.land_value)::float / cv.capital_value) AS p75,
    COUNT(*) AS n
  FROM council_valuations cv
  JOIN sa2_boundaries sa2 ON ST_Contains(sa2.geom, cv.geom)
  WHERE cv.capital_value > cv.land_value AND cv.land_value > 0
  GROUP BY sa2.sa2_code
  HAVING COUNT(*) >= 20
),
props AS (
  SELECT cv.capital_value,
         cv.land_value,
         (cv.capital_value - cv.land_value)::float / cv.capital_value AS imp_ratio,
         cv.valuation_date,
         s.p25, s.p75
  FROM council_valuations cv
  JOIN sa2_boundaries sa2 ON ST_Contains(sa2.geom, cv.geom)
  JOIN sa2_stats s ON s.sa2_code = sa2.sa2_code
  WHERE cv.capital_value > cv.land_value AND cv.land_value > 0
)
SELECT
  COUNT(*) AS eligible_properties,
  COUNT(*) FILTER (WHERE imp_ratio > p75) AS would_trigger_uplift,
  COUNT(*) FILTER (WHERE imp_ratio < p25) AS would_trigger_discount,
  ROUND(100.0 * COUNT(*) FILTER (WHERE imp_ratio > p75) / NULLIF(COUNT(*), 0), 1) AS pct_uplift,
  ROUND(100.0 * COUNT(*) FILTER (WHERE imp_ratio < p25) / NULLIF(COUNT(*), 0), 1) AS pct_discount
FROM props;

\echo ''
\echo '=== Backtest 5: Council coverage vs REVALUATION_DATES fallback matches ==='
-- ta_name substring matching against REVALUATION_DATES keys:
-- Auckland, Wellington City, Christchurch City, Taranaki, Tasman District, Buller District
SELECT DISTINCT sa2.ta_name,
       COUNT(DISTINCT cv.council) AS councils_in_ta,
       COUNT(cv.*) AS cv_rows,
       CASE
         WHEN lower(sa2.ta_name) LIKE '%auckland%' THEN 'Auckland'
         WHEN lower(sa2.ta_name) LIKE '%wellington city%' THEN 'Wellington City'
         WHEN lower(sa2.ta_name) LIKE '%christchurch%' THEN 'Christchurch City'
         WHEN lower(sa2.ta_name) LIKE '%taranaki%' THEN 'Taranaki'
         WHEN lower(sa2.ta_name) LIKE '%tasman%' THEN 'Tasman District'
         WHEN lower(sa2.ta_name) LIKE '%buller%' THEN 'Buller District'
         ELSE 'NO MATCH — falls to cv_age=None tier'
       END AS fallback_status
FROM sa2_boundaries sa2
LEFT JOIN council_valuations cv ON ST_Contains(sa2.geom, cv.geom)
GROUP BY sa2.ta_name
ORDER BY COUNT(cv.*) DESC NULLS LAST
LIMIT 30;
