-- Migration 0048: mv_sa2_comparisons — union all transit tables + polygon-based
-- transit and noise aggregation so Auckland, Christchurch, Queenstown, etc.
-- don't come back with transit_count_400m = 0 and max_noise_db = null.
--
-- Problem with the previous definition:
--   1. transit_count_400m was computed by querying `transit_stops` (regional
--      GTFS) within 400m of the SA2 centroid. It ignored `metlink_stops`
--      (Wellington) and `at_stops` (Auckland) entirely, so Auckland SA2s got 0.
--   2. max_noise_db queried `noise_contours` at ST_Intersects(nc.geom,
--      ST_Centroid(sa2.geom)) — a single point check. If the centroid happens
--      to fall between contour polygons, max_noise_db is null. Only Wellington
--      centroids happened to land inside a contour.
--
-- Fix: count all transit stops from metlink_stops, at_stops, AND transit_stops
-- that are *anywhere within the SA2 polygon*, and take the max noise level
-- across all noise_contours that intersect the polygon. These are whole-area
-- metrics so they represent "how transit-dense / noisy is this suburb" rather
-- than "what's exactly at this centroid point".
--
-- Run: psql $DATABASE_URL -f backend/migrations/0048_sa2_comparisons_transit_noise.sql

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS mv_ta_comparisons CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_sa2_comparisons CASCADE;

-- The previous definition used LATERAL subqueries that scanned noise_contours
-- per SA2, taking ~280ms × 2171 SA2s = ~10 minutes. Pre-aggregate the slow
-- joins in CTEs first so they run in a single spatial-join pass and then
-- merge-join with sa2_boundaries.
--
-- ST_MakeValid is used on both sides of the noise spatial join because a few
-- noise_contours polygons have self-intersections that trip GEOSIntersects with
-- 'TopologyException: side location conflict'. ST_MakeValid heals them.
CREATE MATERIALIZED VIEW mv_sa2_comparisons AS
WITH sa2_valid AS (
    SELECT sa2_code, sa2_name, ta_name, ST_MakeValid(geom) AS geom
    FROM sa2_boundaries
),
transit_per_sa2 AS (
    -- Union of all transit stop tables, then spatial-join once against SA2.
    SELECT sa2.sa2_code, COUNT(*)::integer AS transit_count_400m
    FROM sa2_valid sa2
    JOIN (
        SELECT geom FROM metlink_stops
        UNION ALL SELECT geom FROM at_stops
        UNION ALL SELECT geom FROM transit_stops
    ) stops ON stops.geom && sa2.geom AND ST_Within(stops.geom, sa2.geom)
    GROUP BY sa2.sa2_code
),
noise_per_sa2 AS (
    -- Single spatial join then group — 1-2 seconds instead of 10 minutes.
    -- ST_MakeValid on noise_contours.geom protects against corrupt polygons
    -- around the Auckland airport footprint that otherwise raise
    -- "side location conflict" mid-join.
    SELECT sa2.sa2_code, MAX(nc.laeq24h)::numeric AS max_noise_db
    FROM sa2_valid sa2
    JOIN noise_contours nc
      ON nc.geom && sa2.geom
     AND ST_Intersects(ST_MakeValid(nc.geom), sa2.geom)
    GROUP BY sa2.sa2_code
)
SELECT
    sa2.sa2_code,
    sa2.sa2_name,
    sa2.ta_name,
    dep.avg_nzdep,
    sch.school_count_1500m,
    COALESCE(tr.transit_count_400m, 0) AS transit_count_400m,
    np.max_noise_db,
    epb.epb_count_300m
FROM sa2_boundaries sa2
LEFT JOIN LATERAL (
    SELECT round(avg(nd.nzdep2023), 1) AS avg_nzdep
    FROM meshblocks mb
    JOIN nzdep nd ON nd.mb2023_code::text = mb.mb2023_code::text
    WHERE ST_Within(ST_Centroid(mb.geom), sa2.geom)
) dep ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS school_count_1500m
    FROM schools s
    WHERE s.geom && ST_Expand(ST_Centroid(sa2.geom), 0.015)
      AND ST_DWithin(s.geom::geography, ST_Centroid(sa2.geom)::geography, 1500)
) sch ON true
LEFT JOIN transit_per_sa2 tr ON tr.sa2_code = sa2.sa2_code
LEFT JOIN noise_per_sa2 np ON np.sa2_code = sa2.sa2_code
LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS epb_count_300m
    FROM earthquake_prone_buildings e
    WHERE e.geom && ST_Expand(ST_Centroid(sa2.geom), 0.005)
      AND ST_DWithin(e.geom::geography, ST_Centroid(sa2.geom)::geography, 300)
) epb ON true;

CREATE UNIQUE INDEX ON mv_sa2_comparisons (sa2_code);
CREATE INDEX ON mv_sa2_comparisons (ta_name);

-- mv_ta_comparisons is a straight aggregate of mv_sa2_comparisons so we
-- recreate it against the new base.
CREATE MATERIALIZED VIEW mv_ta_comparisons AS
SELECT
    ta_name,
    round(avg(avg_nzdep), 1) AS avg_nzdep,
    round(avg(school_count_1500m), 1) AS avg_school_count_1500m,
    round(avg(transit_count_400m), 1) AS avg_transit_count_400m,
    round(avg(max_noise_db), 1) AS avg_noise_db,
    round(avg(epb_count_300m), 1) AS avg_epb_count_300m
FROM mv_sa2_comparisons
WHERE ta_name IS NOT NULL
GROUP BY ta_name;

CREATE UNIQUE INDEX ON mv_ta_comparisons (ta_name);

COMMIT;
