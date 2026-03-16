-- 10-wellington-data.sql
-- Wellington-specific data tables for enhanced hazard, transport, and liveability data.
-- These supplement the existing national-level tables with higher-resolution regional data.

--------------------------------------------------------------
-- 1. MBIE Earthquake-Prone Building Register (national scope)
-- Replaces the WCC-only earthquake_prone_buildings table
--------------------------------------------------------------
DROP TABLE IF EXISTS mbie_epb CASCADE;
CREATE TABLE mbie_epb (
    id UUID PRIMARY KEY,
    name TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    suburb TEXT,
    city TEXT,
    region TEXT,
    earthquake_rating TEXT,       -- "0% to less than 20%", "20% to less than 34%", "Not determined"
    heritage_status TEXT,
    construction_type TEXT,
    design_date TEXT,             -- "Pre-1935", "1935-1975", etc.
    priority TEXT,                -- "Priority 1", "Priority 2", etc.
    notice_date DATE,
    completion_deadline DATE,
    issued_by TEXT,
    seismic_risk_area TEXT,       -- "High", "Medium", "Low"
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX idx_mbie_epb_geom ON mbie_epb USING GIST (geom);
CREATE INDEX idx_mbie_epb_city ON mbie_epb (city);
CREATE INDEX idx_mbie_epb_rating ON mbie_epb (earthquake_rating);

--------------------------------------------------------------
-- 2. GWRC Combined Earthquake Hazard
--------------------------------------------------------------
DROP TABLE IF EXISTS gwrc_earthquake_hazard CASCADE;
CREATE TABLE gwrc_earthquake_hazard (
    id SERIAL PRIMARY KEY,
    chi NUMERIC,                  -- Combined Hazard Index
    chi_hazard_grade INT,         -- 1–5
    severity TEXT,                -- "1 Low" → "5 High"
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX idx_gwrc_eq_geom ON gwrc_earthquake_hazard USING GIST (geom);

--------------------------------------------------------------
-- 3. GWRC Ground Shaking Amplification
--------------------------------------------------------------
DROP TABLE IF EXISTS gwrc_ground_shaking CASCADE;
CREATE TABLE gwrc_ground_shaking (
    id SERIAL PRIMARY KEY,
    zone TEXT,
    severity TEXT,                -- "Low", "Moderate", "High"
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX idx_gwrc_gs_geom ON gwrc_ground_shaking USING GIST (geom);

--------------------------------------------------------------
-- 4. GWRC Liquefaction (regional, supplements national)
--------------------------------------------------------------
DROP TABLE IF EXISTS gwrc_liquefaction CASCADE;
CREATE TABLE gwrc_liquefaction (
    id SERIAL PRIMARY KEY,
    liquefaction TEXT,            -- risk level
    simplified TEXT,              -- geology type (e.g. "Reclaimed Land")
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX idx_gwrc_liq_geom ON gwrc_liquefaction USING GIST (geom);

--------------------------------------------------------------
-- 5. GWRC Slope Failure (regional)
--------------------------------------------------------------
DROP TABLE IF EXISTS gwrc_slope_failure CASCADE;
CREATE TABLE gwrc_slope_failure (
    id SERIAL PRIMARY KEY,
    lskey TEXT,
    severity TEXT,                -- "1 Low" → "5 High"
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX idx_gwrc_sf_geom ON gwrc_slope_failure USING GIST (geom);

--------------------------------------------------------------
-- 6. WCC 2024 District Plan Fault Zones
--------------------------------------------------------------
DROP TABLE IF EXISTS wcc_fault_zones CASCADE;
CREATE TABLE wcc_fault_zones (
    id SERIAL PRIMARY KEY,
    name TEXT,
    hazard_ranking TEXT,          -- DP_HazardRanking
    fault_complexity TEXT,        -- Fault_Comp
    ri_class TEXT,                -- Recurrence Interval class
    layer_id INT,                 -- 56=Fault Avoidance, 57-59=sub-types
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX idx_wcc_fz_geom ON wcc_fault_zones USING GIST (geom);

--------------------------------------------------------------
-- 7. WCC 2024 District Plan Flood Hazards
--------------------------------------------------------------
DROP TABLE IF EXISTS wcc_flood_hazard CASCADE;
CREATE TABLE wcc_flood_hazard (
    id SERIAL PRIMARY KEY,
    name TEXT,
    hazard_ranking TEXT,          -- Low/Medium/High
    hazard_type TEXT,             -- "Inundation", "Overland Flowpath", "Stream Corridor"
    layer_id INT,                 -- 61/62/63
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX idx_wcc_fh_geom ON wcc_flood_hazard USING GIST (geom);

--------------------------------------------------------------
-- 8. WCC 2024 District Plan Tsunami Tiers
--------------------------------------------------------------
DROP TABLE IF EXISTS wcc_tsunami_hazard CASCADE;
CREATE TABLE wcc_tsunami_hazard (
    id SERIAL PRIMARY KEY,
    name TEXT,
    hazard_ranking TEXT,
    scenario TEXT,                -- return period description
    return_period TEXT,           -- "1:100yr", "1:500yr", "1:1000yr"
    layer_id INT,                 -- 52/53/54
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX idx_wcc_th_geom ON wcc_tsunami_hazard USING GIST (geom);

--------------------------------------------------------------
-- 9. WCC Building Solar Radiation
--------------------------------------------------------------
DROP TABLE IF EXISTS wcc_solar_radiation CASCADE;
CREATE TABLE wcc_solar_radiation (
    id SERIAL PRIMARY KEY,
    mean_yearly_solar NUMERIC,    -- kWh/m²
    max_yearly_solar NUMERIC,
    approx_height NUMERIC,        -- building height in metres
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX idx_wcc_sr_geom ON wcc_solar_radiation USING GIST (geom);

--------------------------------------------------------------
-- 10. Metlink Transit Stops (with route_type)
-- Supplements existing transit_stops with mode breakdown
--------------------------------------------------------------
DROP TABLE IF EXISTS metlink_stops CASCADE;
CREATE TABLE metlink_stops (
    id SERIAL PRIMARY KEY,
    stop_id TEXT UNIQUE,
    stop_code TEXT,
    stop_name TEXT,
    zone_id TEXT,
    route_types INT[],            -- array of route types serving this stop: 2=rail,3=bus,4=ferry,5=cable car
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX idx_metlink_geom ON metlink_stops USING GIST (geom);
CREATE INDEX idx_metlink_stop_id ON metlink_stops (stop_id);
