-- 0013_national_expansion_schema.sql
-- Captures all manual schema changes from session 53 national data expansion.
-- Safe to re-run (all operations are IF NOT EXISTS / IF EXISTS).

-- 1. council_valuations: add council column + change geom to generic Geometry
DO $$ BEGIN
    ALTER TABLE council_valuations ADD COLUMN IF NOT EXISTS council VARCHAR(50);
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
    -- Need to drop dependent views first
    DROP MATERIALIZED VIEW IF EXISTS mv_sa2_valuations CASCADE;
    DROP VIEW IF EXISTS v_address_valuation CASCADE;

    ALTER TABLE council_valuations
        ALTER COLUMN geom TYPE geometry(Geometry, 4326)
        USING geom::geometry(Geometry, 4326);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Recreate the materialized view (simplified — the real definition is in the app)
DO $$ BEGIN
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sa2_valuations AS
    SELECT sa2.sa2_code,
           sa2.sa2_name,
           COUNT(*)::int AS property_count,
           AVG(cv.capital_value)::int AS avg_cv,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cv.capital_value)::int AS median_cv
    FROM council_valuations cv
    JOIN sa2_boundaries sa2 ON ST_Contains(sa2.geom, cv.geom)
    WHERE cv.capital_value > 0
    GROUP BY sa2.sa2_code, sa2.sa2_name;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. coastal_erosion: add source_council column
DO $$ BEGIN
    ALTER TABLE coastal_erosion ADD COLUMN IF NOT EXISTS source_council VARCHAR(50);
EXCEPTION WHEN others THEN NULL;
END $$;

-- 3. transit_stops: add source + mode_type columns
DO $$ BEGIN
    ALTER TABLE transit_stops ADD COLUMN IF NOT EXISTS source VARCHAR(50);
    ALTER TABLE transit_stops ADD COLUMN IF NOT EXISTS mode_type VARCHAR(20);
EXCEPTION WHEN others THEN NULL;
END $$;

-- 4. Fix duplicate migration numbering: rename 0009_saved_properties if needed
-- (Both 0009_fix_report_columns and 0009_saved_properties exist)
-- No action needed — both run fine, SQL is idempotent.

-- 5. New tables created by loaders (CREATE TABLE IF NOT EXISTS)
-- These auto-create on first data load, but we create them here too so the
-- report function doesn't fail on missing tables before data is loaded.

CREATE TABLE IF NOT EXISTS aircraft_noise_overlay (
    id SERIAL PRIMARY KEY,
    name TEXT,
    noise_level_dba INTEGER,
    noise_category TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_ano_geom ON aircraft_noise_overlay USING GIST (geom);

CREATE TABLE IF NOT EXISTS overland_flow_paths (
    id SERIAL PRIMARY KEY,
    catchment_group INTEGER,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiLineString, 4326)
);
CREATE INDEX IF NOT EXISTS idx_ofp_geom ON overland_flow_paths USING GIST (geom);

CREATE TABLE IF NOT EXISTS historic_heritage_overlay (
    id SERIAL PRIMARY KEY,
    name TEXT,
    schedule TEXT,
    heritage_type TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_hho_geom ON historic_heritage_overlay USING GIST (geom);

CREATE TABLE IF NOT EXISTS special_character_areas (
    id SERIAL PRIMARY KEY,
    name TEXT,
    schedule TEXT,
    character_type TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_sca_geom ON special_character_areas USING GIST (geom);

CREATE TABLE IF NOT EXISTS notable_trees (
    id SERIAL PRIMARY KEY,
    name TEXT,
    schedule TEXT,
    tree_type TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_nt_geom ON notable_trees USING GIST (geom);

CREATE TABLE IF NOT EXISTS significant_ecological_areas (
    id SERIAL PRIMARY KEY,
    name TEXT,
    schedule TEXT,
    eco_type TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_sea_geom ON significant_ecological_areas USING GIST (geom);

CREATE TABLE IF NOT EXISTS coastal_erosion (
    id SERIAL PRIMARY KEY,
    name TEXT,
    coast_type TEXT,
    timeframe INTEGER,
    scenario TEXT,
    geology TEXT,
    distance_from_coast TEXT,
    sea_level_rise DOUBLE PRECISION,
    assessment_level TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiLineString, 4326)
);
CREATE INDEX IF NOT EXISTS idx_ce_geom ON coastal_erosion USING GIST (geom);

CREATE TABLE IF NOT EXISTS height_variation_control (
    id SERIAL PRIMARY KEY,
    name TEXT,
    schedule TEXT,
    height_limit TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_hvc_geom ON height_variation_control USING GIST (geom);

CREATE TABLE IF NOT EXISTS mana_whenua_sites (
    id SERIAL PRIMARY KEY,
    name TEXT,
    schedule TEXT,
    site_type TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_mws_geom ON mana_whenua_sites USING GIST (geom);

CREATE TABLE IF NOT EXISTS geotechnical_reports (
    id SERIAL PRIMARY KEY,
    report_id TEXT,
    location_description TEXT,
    locality TEXT,
    hazard TEXT,
    comment TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_gr_geom ON geotechnical_reports USING GIST (geom);

CREATE TABLE IF NOT EXISTS auckland_schools (
    id SERIAL PRIMARY KEY,
    school_number INTEGER,
    school_name TEXT,
    school_type TEXT,
    school_website TEXT,
    definition TEXT,
    authority TEXT,
    gender TEXT,
    decile INTEGER,
    source_council VARCHAR(50) DEFAULT 'auckland',
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_as_geom ON auckland_schools USING GIST (geom);

CREATE TABLE IF NOT EXISTS park_extents (
    id SERIAL PRIMARY KEY,
    site_name TEXT,
    asset_group TEXT,
    tla_desc TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_pe_geom ON park_extents USING GIST (geom);

CREATE TABLE IF NOT EXISTS heritage_extent (
    id SERIAL PRIMARY KEY,
    name TEXT,
    schedule TEXT,
    heritage_type TEXT,
    source_council VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_he_geom ON heritage_extent USING GIST (geom);

CREATE TABLE IF NOT EXISTS stormwater_management_area (
    id SERIAL PRIMARY KEY,
    control_type TEXT,
    area_name TEXT,
    source_council VARCHAR(50) DEFAULT 'auckland',
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_sma_geom ON stormwater_management_area USING GIST (geom);

-- AT transit tables
CREATE TABLE IF NOT EXISTS at_stops (
    id SERIAL PRIMARY KEY,
    stop_id VARCHAR(50) UNIQUE,
    stop_code VARCHAR(20),
    stop_name TEXT,
    zone_id VARCHAR(20),
    route_types INTEGER[],
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_at_stops_geom ON at_stops USING GIST (geom);

CREATE TABLE IF NOT EXISTS at_travel_times (
    id SERIAL PRIMARY KEY,
    stop_id VARCHAR(50),
    destination TEXT,
    min_minutes REAL,
    route_names TEXT[],
    peak_window TEXT NOT NULL DEFAULT 'am',
    UNIQUE (stop_id, destination, peak_window)
);
CREATE INDEX IF NOT EXISTS idx_at_tt_stop ON at_travel_times (stop_id);

CREATE TABLE IF NOT EXISTS at_stop_frequency (
    stop_id VARCHAR(50) PRIMARY KEY,
    peak_trips_per_hour REAL
);

-- Promo redemptions (may already exist from 0012)
CREATE TABLE IF NOT EXISTS promo_redemptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    redeemed_at TIMESTAMPTZ DEFAULT now()
);
