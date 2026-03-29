-- 0028: Add missing GIST spatial indexes on high-frequency report tables
-- These tables are queried via ST_Intersects in get_property_report() on every
-- cold-cache request, but were only indexed on source_council (text).
-- Without GIST, each lookup is a full table scan against potentially large datasets.

CREATE INDEX IF NOT EXISTS idx_district_plan_zones_geom
    ON district_plan_zones USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_coastal_inundation_geom
    ON coastal_inundation USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_flood_extent_geom
    ON flood_extent USING GIST (geom);

-- addresses.geom is the reference point used in every report spatial query.
-- Indexing it speeds up reverse-spatial lookups (e.g. "find all reports near X").
CREATE INDEX IF NOT EXISTS idx_addresses_geom
    ON addresses USING GIST (geom);
