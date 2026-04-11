-- Migration 0050: Heal invalid geometries in noise_contours and sa2_boundaries
--
-- Migration 0020 did a similar heal but data has been reloaded since. At the
-- time of writing, 6,195 noise_contours rows and 8 sa2_boundaries rows fail
-- ST_IsValid, and one of them (a noise polygon near Auckland airport at
-- 174.711 -36.906) causes GEOSIntersects to abort with 'side location conflict'
-- and actually CRASHES the backend process, rolling back whatever transaction
-- was running.
--
-- The heal runs in-place so subsequent spatial joins (e.g. mv_sa2_comparisons
-- in 0048) can use plain geom without wrapping every row in ST_MakeValid.
--
-- Run: psql $DATABASE_URL -f backend/migrations/0050_heal_invalid_geometries.sql

BEGIN;

-- Quiet the inevitable "ring self-intersection at or near point ..." notices
-- that ST_MakeValid emits for every bad row.
SET LOCAL client_min_messages TO WARNING;

UPDATE noise_contours SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE sa2_boundaries SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);

-- ST_MakeValid can return a GEOMETRYCOLLECTION or LINESTRING when the input is
-- badly broken. The comparisons MV expects polygons, so collapse any non-polygon
-- results back to polygons via ST_CollectionExtract(geom, 3).
UPDATE noise_contours
SET geom = ST_CollectionExtract(geom, 3)
WHERE ST_GeometryType(geom) = 'ST_GeometryCollection';

UPDATE sa2_boundaries
SET geom = ST_CollectionExtract(geom, 3)
WHERE ST_GeometryType(geom) = 'ST_GeometryCollection';

COMMIT;
