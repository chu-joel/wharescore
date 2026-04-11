-- Migration 0050: Remove unfixable noise_contours polygons
--
-- Migration 0020 ran ST_MakeValid across every spatial table. Data has been
-- reloaded since and there are now 6,195 noise_contours rows and 8
-- sa2_boundaries rows that fail ST_IsValid. For the noise_contours ones, the
-- corruption is severe enough that ST_MakeValid itself segfaults the
-- postgres backend (GEOS bug) on certain polygons — including one near
-- Auckland airport at 174.711 -36.906 that causes a 'side location conflict'
-- crash during mv_sa2_comparisons rebuild.
--
-- Rather than risk crashing postgres again, we DELETE the unfixable rows.
-- noise_contours is a statistical average of road noise over thousands of
-- polygons, so dropping 2.7% of rows has negligible impact on the resulting
-- max_noise_db per SA2. sa2_boundaries has 8 invalid rows which we heal in
-- place (small count, low crash risk).
--
-- Run: psql $DATABASE_URL -f backend/migrations/0050_heal_invalid_geometries.sql

BEGIN;

-- sa2_boundaries: small fix, heal in place.
SET LOCAL client_min_messages TO WARNING;
UPDATE sa2_boundaries SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE sa2_boundaries
SET geom = ST_CollectionExtract(geom, 3)
WHERE ST_GeometryType(geom) = 'ST_GeometryCollection';

-- noise_contours: ST_MakeValid crashes on these, so drop them instead.
DELETE FROM noise_contours WHERE NOT ST_IsValid(geom);

COMMIT;
