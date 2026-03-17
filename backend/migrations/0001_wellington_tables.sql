-- 0001_wellington_tables.sql
-- Create Wellington-specific data tables + transit travel time tables.
-- Uses IF NOT EXISTS for safety.

-- 1. MBIE Earthquake-Prone Building Register
CREATE TABLE IF NOT EXISTS mbie_epb (
    id UUID PRIMARY KEY,
    name TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    suburb TEXT,
    city TEXT,
    region TEXT,
    earthquake_rating TEXT,
    heritage_status TEXT,
    construction_type TEXT,
    design_date TEXT,
    priority TEXT,
    notice_date DATE,
    completion_deadline DATE,
    issued_by TEXT,
    seismic_risk_area TEXT,
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_mbie_epb_geom ON mbie_epb USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_mbie_epb_city ON mbie_epb (city);
CREATE INDEX IF NOT EXISTS idx_mbie_epb_rating ON mbie_epb (earthquake_rating);

-- 2. GWRC Combined Earthquake Hazard
CREATE TABLE IF NOT EXISTS gwrc_earthquake_hazard (
    id SERIAL PRIMARY KEY,
    chi NUMERIC,
    chi_hazard_grade INT,
    severity TEXT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_gwrc_eq_geom ON gwrc_earthquake_hazard USING GIST (geom);

-- 3. GWRC Ground Shaking Amplification
CREATE TABLE IF NOT EXISTS gwrc_ground_shaking (
    id SERIAL PRIMARY KEY,
    zone TEXT,
    severity TEXT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_gwrc_gs_geom ON gwrc_ground_shaking USING GIST (geom);

-- 4. GWRC Liquefaction
CREATE TABLE IF NOT EXISTS gwrc_liquefaction (
    id SERIAL PRIMARY KEY,
    liquefaction TEXT,
    simplified TEXT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_gwrc_liq_geom ON gwrc_liquefaction USING GIST (geom);

-- 5. GWRC Slope Failure
CREATE TABLE IF NOT EXISTS gwrc_slope_failure (
    id SERIAL PRIMARY KEY,
    lskey TEXT,
    severity TEXT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_gwrc_sf_geom ON gwrc_slope_failure USING GIST (geom);

-- 6. WCC 2024 District Plan Fault Zones
CREATE TABLE IF NOT EXISTS wcc_fault_zones (
    id SERIAL PRIMARY KEY,
    name TEXT,
    hazard_ranking TEXT,
    fault_complexity TEXT,
    ri_class TEXT,
    layer_id INT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_wcc_fz_geom ON wcc_fault_zones USING GIST (geom);

-- 7. WCC 2024 District Plan Flood Hazards
CREATE TABLE IF NOT EXISTS wcc_flood_hazard (
    id SERIAL PRIMARY KEY,
    name TEXT,
    hazard_ranking TEXT,
    hazard_type TEXT,
    layer_id INT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_wcc_fh_geom ON wcc_flood_hazard USING GIST (geom);

-- 8. WCC 2024 District Plan Tsunami Tiers
CREATE TABLE IF NOT EXISTS wcc_tsunami_hazard (
    id SERIAL PRIMARY KEY,
    name TEXT,
    hazard_ranking TEXT,
    scenario TEXT,
    return_period TEXT,
    layer_id INT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_wcc_th_geom ON wcc_tsunami_hazard USING GIST (geom);

-- 9. WCC Building Solar Radiation
CREATE TABLE IF NOT EXISTS wcc_solar_radiation (
    id SERIAL PRIMARY KEY,
    mean_yearly_solar NUMERIC,
    max_yearly_solar NUMERIC,
    approx_height NUMERIC,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_wcc_sr_geom ON wcc_solar_radiation USING GIST (geom);

-- 10. Metlink Transit Stops (with route_type)
CREATE TABLE IF NOT EXISTS metlink_stops (
    id SERIAL PRIMARY KEY,
    stop_id TEXT UNIQUE,
    stop_code TEXT,
    stop_name TEXT,
    zone_id TEXT,
    route_types INT[],
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_metlink_geom ON metlink_stops USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_metlink_stop_id ON metlink_stops (stop_id);

-- 11. Transit Travel Times (pre-computed from GTFS)
CREATE TABLE IF NOT EXISTS transit_travel_times (
    id SERIAL PRIMARY KEY,
    stop_id TEXT NOT NULL,
    destination TEXT NOT NULL,
    min_minutes NUMERIC NOT NULL,
    route_names TEXT[],
    UNIQUE(stop_id, destination)
);
CREATE INDEX IF NOT EXISTS idx_ttt_stop ON transit_travel_times (stop_id);
CREATE INDEX IF NOT EXISTS idx_ttt_dest ON transit_travel_times (destination);

-- 12. Transit Stop Frequency (peak hour)
CREATE TABLE IF NOT EXISTS transit_stop_frequency (
    stop_id TEXT PRIMARY KEY,
    peak_trips_per_hour NUMERIC NOT NULL
);

-- 13. Data Versions (tracks when each source was last loaded)
CREATE TABLE IF NOT EXISTS data_versions (
    source TEXT PRIMARY KEY,
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    row_count INT
);
