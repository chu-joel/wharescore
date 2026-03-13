-- 08-toast-and-cleanup.sql
-- TOAST optimization: force EXTERNAL storage for polygon geometries.
-- This stores geometry inline (not compressed/out-of-line), giving ~5x
-- faster spatial joins per Paul Ramsey's benchmarks.
-- Only worth doing for tables with complex polygon geometries used in ST_Intersects/ST_Within.

ALTER TABLE parcels ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE building_outlines ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE flood_zones ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE tsunami_zones ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE liquefaction_zones ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE district_plan_zones ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE council_valuations ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE conservation_land ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE noise_contours ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE wind_zones ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE school_zones ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE meshblocks ALTER COLUMN geom SET STORAGE EXTERNAL;
ALTER TABLE sa2_boundaries ALTER COLUMN geom SET STORAGE EXTERNAL;

-- Ensure GIST indexes exist on all spatial tables.
-- ogr2ogr creates *_geom_geom_idx automatically; we create our own named
-- idx_* versions here, then drop the ogr2ogr duplicates below.
CREATE INDEX IF NOT EXISTS idx_building_outlines_geom ON building_outlines USING gist(geom);
CREATE INDEX IF NOT EXISTS idx_property_titles_geom ON property_titles USING gist(geom);
CREATE INDEX IF NOT EXISTS idx_tsunami_zones_geom ON tsunami_zones USING gist(geom);
CREATE INDEX IF NOT EXISTS idx_flood_zones_geom ON flood_zones USING gist(geom);

-- Drop duplicate GIST indexes created by ogr2ogr (saves ~500MB total)
DROP INDEX IF EXISTS addresses_geom_geom_idx;          -- dup of idx_addresses_geom
DROP INDEX IF EXISTS meshblocks_geom_geom_idx;         -- dup of idx_meshblocks_geom
DROP INDEX IF EXISTS noise_contours_geom_geom_idx;     -- dup of idx_noise_contours_geom
DROP INDEX IF EXISTS coastal_erosion_geom_geom_idx;    -- dup of idx_coastal_erosion_geom
DROP INDEX IF EXISTS wind_zones_geom_geom_idx;         -- dup of idx_wind_zones_geom
DROP INDEX IF EXISTS tsunami_zones_geom_geom_idx;      -- replaced by idx_tsunami_zones_geom
DROP INDEX IF EXISTS transmission_lines_geom_geom_idx; -- dup of idx_transmission_lines_geom
DROP INDEX IF EXISTS school_zones_geom_geom_idx;       -- dup of idx_school_zones_geom
DROP INDEX IF EXISTS climate_grid_geom_geom_idx;       -- dup of idx_climate_grid_geom
DROP INDEX IF EXISTS parcels_geom_geom_idx;            -- dup of idx_parcels_geom
DROP INDEX IF EXISTS property_titles_geom_geom_idx;    -- replaced by idx_property_titles_geom
DROP INDEX IF EXISTS building_outlines_geom_geom_idx;  -- replaced by idx_building_outlines_geom
DROP INDEX IF EXISTS flood_zones_geom_geom_idx;        -- replaced by idx_flood_zones_geom

-- Ensure pg_trgm is loaded (for fuzzy search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Re-analyze all tables after TOAST changes
ANALYZE addresses, parcels, building_outlines, flood_zones, tsunami_zones,
        liquefaction_zones, district_plan_zones, council_valuations,
        conservation_land, noise_contours, wind_zones, school_zones,
        meshblocks, sa2_boundaries;
