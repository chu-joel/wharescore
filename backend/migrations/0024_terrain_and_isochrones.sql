-- Migration 0024: Terrain data + walking isochrone support
--
-- Adds:
--   1. PostGIS raster extension (for SRTM elevation tiles)
--   2. Terrain columns on report snapshots
--   3. Walking isochrone helper functions
--
-- Run: psql $DATABASE_URL -f backend/migrations/0024_terrain_and_isochrones.sql

BEGIN;

-- ── 1. Enable PostGIS raster extension ──
CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- ── 2. Add terrain + isochrone columns to hosted report snapshots ──
-- These store pre-computed terrain & transit data in the report

-- Check if snapshot_data column type supports these fields
-- (It's JSONB so new keys are added automatically — no ALTER needed)

-- ── 3. Helper: count transit stops within a GeoJSON polygon ──
CREATE OR REPLACE FUNCTION count_transit_in_polygon(
    geojson text
) RETURNS TABLE(
    total_stops int,
    bus_stops int,
    rail_stops int,
    ferry_stops int
) AS $$
    WITH iso AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(geojson), 4326) AS geom
    )
    SELECT
        (SELECT COUNT(*)::int FROM metlink_stops ms, iso WHERE ST_Within(ms.geom, iso.geom))
        + (SELECT COUNT(*)::int FROM at_stops ats, iso WHERE ST_Within(ats.geom, iso.geom))
            AS total_stops,
        (SELECT COUNT(*)::int FROM metlink_stops ms, iso WHERE ST_Within(ms.geom, iso.geom) AND 3 = ANY(ms.route_types))
        + (SELECT COUNT(*)::int FROM at_stops ats, iso WHERE ST_Within(ats.geom, iso.geom) AND 3 = ANY(ats.route_types))
            AS bus_stops,
        (SELECT COUNT(*)::int FROM metlink_stops ms, iso WHERE ST_Within(ms.geom, iso.geom) AND 2 = ANY(ms.route_types))
        + (SELECT COUNT(*)::int FROM at_stops ats, iso WHERE ST_Within(ats.geom, iso.geom) AND 2 = ANY(ats.route_types))
            AS rail_stops,
        (SELECT COUNT(*)::int FROM metlink_stops ms, iso WHERE ST_Within(ms.geom, iso.geom) AND 4 = ANY(ms.route_types))
        + (SELECT COUNT(*)::int FROM at_stops ats, iso WHERE ST_Within(ats.geom, iso.geom) AND 4 = ANY(ats.route_types))
            AS ferry_stops;
$$ LANGUAGE sql STABLE;

-- ── 4. Index optimization for stop-in-polygon queries ──
-- The existing GIST indexes on metlink_stops.geom and at_stops.geom handle this,
-- but add partial indexes for route_type filtering if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_metlink_stops_bus') THEN
        CREATE INDEX idx_metlink_stops_bus ON metlink_stops USING gist(geom)
            WHERE 3 = ANY(route_types);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_metlink_stops_rail') THEN
        CREATE INDEX idx_metlink_stops_rail ON metlink_stops USING gist(geom)
            WHERE 2 = ANY(route_types);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_at_stops_bus') THEN
        CREATE INDEX idx_at_stops_bus ON at_stops USING gist(geom)
            WHERE 3 = ANY(route_types);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_at_stops_rail') THEN
        CREATE INDEX idx_at_stops_rail ON at_stops USING gist(geom)
            WHERE 2 = ANY(route_types);
    END IF;
END $$;

COMMIT;
