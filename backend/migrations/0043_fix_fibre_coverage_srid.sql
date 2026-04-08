-- Fix: fibre_coverage geometries were loaded with NZTM (EPSG:2193) coordinates
-- but declared as EPSG:4326. All spatial queries returned empty results.
--
-- Already applied manually on prod 2026-04-08. This migration is idempotent —
-- it checks if coords are in NZTM range before transforming.

DO $$
DECLARE
  sample_x double precision;
BEGIN
  SELECT ST_X(ST_Centroid(geom)) INTO sample_x FROM fibre_coverage LIMIT 1;

  -- NZTM coordinates are in the range ~1,000,000-2,200,000 for X
  -- WGS84 NZ coordinates are in the range ~165-180 for X
  IF sample_x > 10000 THEN
    RAISE NOTICE 'Fibre coverage has NZTM coordinates (X=%), transforming to WGS84...', sample_x;

    ALTER TABLE fibre_coverage ALTER COLUMN geom TYPE geometry USING geom;
    UPDATE fibre_coverage SET geom = ST_SetSRID(geom, 2193);
    UPDATE fibre_coverage SET geom = ST_Transform(geom, 4326);
    ALTER TABLE fibre_coverage ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326) USING geom;

    -- Rebuild spatial index
    DROP INDEX IF EXISTS idx_fibre_coverage_geom;
    CREATE INDEX idx_fibre_coverage_geom ON fibre_coverage USING GIST (geom);

    RAISE NOTICE 'Fibre coverage SRID fix complete.';
  ELSE
    RAISE NOTICE 'Fibre coverage already in WGS84 (X=%), skipping.', sample_x;
  END IF;
END $$;
