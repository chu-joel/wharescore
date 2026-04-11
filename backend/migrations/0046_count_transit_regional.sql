-- Migration 0046: count_transit_in_polygon() — include regional transit_stops
--
-- The original function (migration 0024) only queried metlink_stops (Wellington)
-- and at_stops (Auckland). For addresses in Christchurch, Queenstown, Hamilton,
-- Dunedin, Tauranga, etc. the walking isochrone counted 0 transit stops even
-- though those cities have GTFS data loaded into the `transit_stops` table.
--
-- This migration adds transit_stops to the UNION using its `mode_type` text
-- column (values: 'bus', 'train', 'ferry') instead of the GTFS integer
-- route_types used by metlink_stops and at_stops.
--
-- Run: psql $DATABASE_URL -f backend/migrations/0046_count_transit_regional.sql

BEGIN;

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
        (
          (SELECT COUNT(*)::int FROM metlink_stops ms, iso WHERE ST_Within(ms.geom, iso.geom))
        + (SELECT COUNT(*)::int FROM at_stops ats, iso WHERE ST_Within(ats.geom, iso.geom))
        + (SELECT COUNT(*)::int FROM transit_stops ts, iso WHERE ST_Within(ts.geom, iso.geom))
        ) AS total_stops,
        (
          (SELECT COUNT(*)::int FROM metlink_stops ms, iso WHERE ST_Within(ms.geom, iso.geom) AND 3 = ANY(ms.route_types))
        + (SELECT COUNT(*)::int FROM at_stops ats, iso WHERE ST_Within(ats.geom, iso.geom) AND 3 = ANY(ats.route_types))
        + (SELECT COUNT(*)::int FROM transit_stops ts, iso WHERE ST_Within(ts.geom, iso.geom) AND ts.mode_type = 'bus')
        ) AS bus_stops,
        (
          (SELECT COUNT(*)::int FROM metlink_stops ms, iso WHERE ST_Within(ms.geom, iso.geom) AND 2 = ANY(ms.route_types))
        + (SELECT COUNT(*)::int FROM at_stops ats, iso WHERE ST_Within(ats.geom, iso.geom) AND 2 = ANY(ats.route_types))
        + (SELECT COUNT(*)::int FROM transit_stops ts, iso WHERE ST_Within(ts.geom, iso.geom) AND ts.mode_type = 'train')
        ) AS rail_stops,
        (
          (SELECT COUNT(*)::int FROM metlink_stops ms, iso WHERE ST_Within(ms.geom, iso.geom) AND 4 = ANY(ms.route_types))
        + (SELECT COUNT(*)::int FROM at_stops ats, iso WHERE ST_Within(ats.geom, iso.geom) AND 4 = ANY(ats.route_types))
        + (SELECT COUNT(*)::int FROM transit_stops ts, iso WHERE ST_Within(ts.geom, iso.geom) AND ts.mode_type = 'ferry')
        ) AS ferry_stops;
$$ LANGUAGE sql STABLE;

-- Partial index on transit_stops.mode_type for the bus/train/ferry filters.
-- transit_stops has 13K rows so the full GIST(geom) index from the table is
-- usually fine, but this gives ST_Within a narrower filter for ferry (8 rows)
-- and rail (6 rows) globally.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_transit_stops_mode_type') THEN
        CREATE INDEX idx_transit_stops_mode_type ON transit_stops (mode_type) WHERE mode_type IS NOT NULL;
    END IF;
END $$;

COMMIT;
