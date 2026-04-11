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

CREATE MATERIALIZED VIEW mv_sa2_comparisons AS
SELECT
    sa2.sa2_code,
    sa2.sa2_name,
    sa2.ta_name,
    dep.avg_nzdep,
    sch.school_count_1500m,
    tr.transit_count_400m,
    ns.max_noise_db,
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
-- transit_count_400m: total transit stops anywhere inside the SA2 polygon,
-- combining Wellington (metlink_stops), Auckland (at_stops), and regional
-- (transit_stops). Named "400m" for historical reasons but now measures the
-- whole SA2, which is a truer "how transit-rich is this suburb" signal.
LEFT JOIN LATERAL (
    SELECT (
        (SELECT COUNT(*) FROM metlink_stops ms WHERE ST_Within(ms.geom, sa2.geom))
      + (SELECT COUNT(*) FROM at_stops ats WHERE ST_Within(ats.geom, sa2.geom))
      + (SELECT COUNT(*) FROM transit_stops ts WHERE ST_Within(ts.geom, sa2.geom))
    )::integer AS transit_count_400m
) tr ON true
-- max_noise_db: highest road noise level anywhere inside the SA2 polygon.
LEFT JOIN LATERAL (
    SELECT MAX(nc.laeq24h)::numeric AS max_noise_db
    FROM noise_contours nc
    WHERE nc.geom && sa2.geom
      AND ST_Intersects(nc.geom, sa2.geom)
) ns ON true
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
