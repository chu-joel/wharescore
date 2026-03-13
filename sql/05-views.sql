-- 05-views.sql
-- Reusable spatial lookup views for single-address queries.
-- Each view is designed for: WHERE address_id = ? (hits GIST indexes via LATERAL).
-- Do NOT scan full table — these are per-property lookups only.

----------------------------------------------------------------------
-- HAZARD OVERLAYS (ST_Intersects — polygon containment)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_hazards AS
SELECT
  a.address_id,
  fz.flood_label,
  tz.tsunami_zone_class, tz.tsunami_evac_zone,
  lz.liquefaction_class,
  wz.wind_zone,
  ce.coastal_exposure
FROM addresses a
LEFT JOIN LATERAL (
  SELECT label AS flood_label
  FROM flood_zones WHERE ST_Intersects(geom, a.geom) LIMIT 1
) fz ON true
LEFT JOIN LATERAL (
  SELECT zone_class AS tsunami_zone_class, evac_zone AS tsunami_evac_zone
  FROM tsunami_zones WHERE ST_Intersects(geom, a.geom) LIMIT 1
) tz ON true
LEFT JOIN LATERAL (
  SELECT liquefaction AS liquefaction_class
  FROM liquefaction_zones WHERE ST_Intersects(geom, a.geom) LIMIT 1
) lz ON true
LEFT JOIN LATERAL (
  SELECT zone_name AS wind_zone
  FROM wind_zones WHERE ST_Intersects(geom, a.geom) LIMIT 1
) wz ON true
LEFT JOIN LATERAL (
  SELECT exposure AS coastal_exposure
  FROM coastal_erosion
  WHERE ST_DWithin(geom::geography, a.geom::geography, 2000)
  ORDER BY geom <-> a.geom LIMIT 1
) ce ON true;

----------------------------------------------------------------------
-- EARTHQUAKE PROXIMITY (count M4+ within 30km, last 10yr)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_earthquakes AS
SELECT a.address_id, eq.cnt AS earthquake_count_30km
FROM addresses a
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM earthquakes e
  WHERE e.magnitude >= 4
    AND e.event_time >= CURRENT_DATE - interval '10 years'
    AND e.geom && ST_Expand(a.geom, 0.3)          -- ~30km bbox pre-filter
    AND ST_DWithin(e.geom::geography, a.geom::geography, 30000)
) eq ON true;

----------------------------------------------------------------------
-- WILDFIRE RISK (nearest station)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_wildfire AS
SELECT a.address_id, wf.vhe_days, wf.trend_likelihood AS wildfire_trend
FROM addresses a
LEFT JOIN LATERAL (
  SELECT ten_year_mean AS vhe_days, trend_likelihood
  FROM wildfire_risk
  ORDER BY geom <-> a.geom LIMIT 1
) wf ON true;

----------------------------------------------------------------------
-- EPB COUNT (earthquake-prone buildings within 300m)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_epb AS
SELECT a.address_id, epb.cnt AS epb_count_300m
FROM addresses a
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM earthquake_prone_buildings e
  WHERE e.geom && ST_Expand(a.geom, 0.005)
    AND ST_DWithin(e.geom::geography, a.geom::geography, 300)
) epb ON true;

----------------------------------------------------------------------
-- ROAD NOISE (max dB at property — may intersect multiple contours)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_noise AS
SELECT a.address_id, nc.max_db AS road_noise_db
FROM addresses a
LEFT JOIN LATERAL (
  SELECT MAX(laeq24h) AS max_db
  FROM noise_contours WHERE ST_Intersects(geom, a.geom)
) nc ON true;

----------------------------------------------------------------------
-- AIR QUALITY (nearest monitoring site)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_air_quality AS
SELECT a.address_id,
       aq.site_name AS air_site_name, aq.pm10_trend, aq.pm25_trend,
       round(aq.dist::numeric) AS air_distance_m
FROM addresses a
LEFT JOIN LATERAL (
  SELECT site_name, pm10_trend, pm25_trend,
         ST_Distance(geom::geography, a.geom::geography) AS dist
  FROM air_quality_sites
  ORDER BY geom <-> a.geom LIMIT 1
) aq ON true;

----------------------------------------------------------------------
-- WATER QUALITY (nearest river site — best NPS-FM band available)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_water_quality AS
SELECT a.address_id,
       wq.site_name AS water_site_name,
       wq.ecoli_band, wq.ammonia_band, wq.nitrate_band, wq.drp_band, wq.clarity_band,
       round(wq.dist::numeric) AS water_distance_m
FROM addresses a
LEFT JOIN LATERAL (
  SELECT site_name, ecoli_band, ammonia_band, nitrate_band, drp_band, clarity_band,
         ST_Distance(geom::geography, a.geom::geography) AS dist
  FROM water_quality_sites
  ORDER BY geom <-> a.geom LIMIT 1
) wq ON true;

----------------------------------------------------------------------
-- CLIMATE EXPOSURE (nearest grid point, SSP2-4.5, 2041-2060, ANNUAL)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_climate AS
SELECT a.address_id,
       cp.temp_change, cp.precip_change_pct, cp.frost_day_change, cp.hot_day_change
FROM addresses a
LEFT JOIN LATERAL (
  SELECT cg.agent_no FROM climate_grid cg
  ORDER BY cg.geom <-> a.geom LIMIT 1
) grid ON true
LEFT JOIN LATERAL (
  SELECT
    AVG("T_value_change") AS temp_change,
    AVG("PR_value_change") AS precip_change_pct,
    AVG("FD_value_change") AS frost_day_change,
    AVG("TX30_value_change") AS hot_day_change
  FROM climate_projections
  WHERE vcsn_agent = grid.agent_no
    AND scenario = 'ssp245'
    AND season = 'ANNUAL'
) cp ON true;

----------------------------------------------------------------------
-- NZ DEPRIVATION INDEX (address → meshblock → nzdep)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_nzdep AS
SELECT a.address_id, nd.nzdep2023 AS nzdep_decile
FROM addresses a
LEFT JOIN LATERAL (
  SELECT mb2023_code FROM meshblocks
  WHERE ST_Within(a.geom, geom) LIMIT 1
) mb ON true
LEFT JOIN nzdep nd ON nd.mb2023_code = mb.mb2023_code;

----------------------------------------------------------------------
-- DISTRICT PLAN ZONE + HEIGHT (planning overlays)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_planning AS
SELECT a.address_id,
       dpz.zone_name, dpz.zone_code, dpz.category AS zone_category,
       hc.height_metres AS max_height_m
FROM addresses a
LEFT JOIN LATERAL (
  SELECT zone_name, zone_code, category
  FROM district_plan_zones WHERE ST_Intersects(geom, a.geom) LIMIT 1
) dpz ON true
LEFT JOIN LATERAL (
  SELECT height_metres
  FROM height_controls WHERE ST_Intersects(geom, a.geom)
  ORDER BY height_metres DESC LIMIT 1
) hc ON true;

----------------------------------------------------------------------
-- CONTAMINATED LAND (nearest within 2km)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_contamination AS
SELECT a.address_id,
       cl.site_name AS contam_site_name, cl.anzecc_category,
       round(cl.dist::numeric) AS contam_distance_m,
       cl_count.cnt AS contam_count_2km
FROM addresses a
LEFT JOIN LATERAL (
  SELECT site_name, anzecc_category,
         ST_Distance(geom::geography, a.geom::geography) AS dist
  FROM contaminated_land
  WHERE geom && ST_Expand(a.geom, 0.02)
    AND ST_DWithin(geom::geography, a.geom::geography, 2000)
  ORDER BY geom <-> a.geom LIMIT 1
) cl ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM contaminated_land
  WHERE geom && ST_Expand(a.geom, 0.02)
    AND ST_DWithin(geom::geography, a.geom::geography, 2000)
) cl_count ON true;

----------------------------------------------------------------------
-- SA2 LOOKUP (address → SA2 2018 code for bonds/market joins)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_sa2 AS
SELECT a.address_id, sa2.sa2_code, sa2.sa2_name, sa2.ta_name
FROM addresses a
LEFT JOIN LATERAL (
  SELECT sa2_code, sa2_name, ta_name
  FROM sa2_boundaries WHERE ST_Within(a.geom, geom) LIMIT 1
) sa2 ON true;

----------------------------------------------------------------------
-- COUNCIL VALUATION (address match — Wellington only)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_valuation AS
SELECT a.address_id,
       cv.capital_value, cv.land_value, cv.improvements_value,
       cv.land_area AS cv_land_area, cv.valuation_date AS cv_date,
       cv.council AS cv_council, cv.valuation_id AS cv_valuation_id,
       cv.full_address AS cv_address
FROM addresses a
LEFT JOIN LATERAL (
  -- Prefer unit-level text match over spatial-only match.
  -- council_valuations has per-unit records (~19% of 87,819 rows) with address
  -- formats like "Unit 1 45 Cuba Street" or "Flat 2 10 Abel Smith Street".
  -- LINZ addresses use "1/45 Cuba Street" format — normalize for comparison.
  -- Priority: 1) exact unit match  2) spatial nearest (may return parent/rollup)
  SELECT capital_value, land_value, improvements_value, land_area,
         valuation_date, council, valuation_id, full_address
  FROM council_valuations
  WHERE geom && ST_Expand(a.geom, 0.0005)
    AND ST_DWithin(geom::geography, a.geom::geography, 30)
  ORDER BY
    -- Score text similarity: unit-level match beats generic spatial match
    CASE
      -- If address has unit info AND valuation address contains matching unit number
      WHEN a.unit_value IS NOT NULL
        AND full_address ~* ('(Unit|Flat|Apartment)\s*' || a.unit_value || '\b')
      THEN 0  -- best: exact unit match
      -- If no unit info on address, prefer records WITHOUT unit prefix (building-level)
      WHEN a.unit_value IS NULL
        AND full_address !~* '^(Unit|Flat|Apartment|Car Park|Shop)\s'
      THEN 1  -- good: building-level match for non-unit address
      ELSE 2  -- fallback: any spatial match
    END,
    geom <-> a.geom  -- then by distance
  LIMIT 1
) cv ON true;

----------------------------------------------------------------------
-- BUILDING FOOTPRINT (area + use)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_building AS
SELECT a.address_id,
       bo.use AS building_use,
       round(ST_Area(bo.geom::geography)::numeric, 1) AS footprint_sqm
FROM addresses a
LEFT JOIN LATERAL (
  SELECT use, geom
  FROM building_outlines
  WHERE geom && ST_Expand(a.geom, 0.0005)
    AND ST_DWithin(geom::geography, a.geom::geography, 15)
  ORDER BY geom <-> a.geom LIMIT 1
) bo ON true;

----------------------------------------------------------------------
-- PROPERTY TITLE (estate description for auto-detection)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_title AS
SELECT a.address_id,
       pt.title_no, pt.estate_description, pt.type AS title_type,
       pt.number_owners
FROM addresses a
LEFT JOIN LATERAL (
  SELECT title_no, estate_description, type, number_owners
  FROM property_titles
  WHERE geom && ST_Expand(a.geom, 0.0005)
    AND ST_DWithin(geom::geography, a.geom::geography, 15)
  ORDER BY geom <-> a.geom LIMIT 1
) pt ON true;

----------------------------------------------------------------------
-- TRANSMISSION LINES (nearest within 200m)
----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_address_transmission AS
SELECT a.address_id,
       tl.designvolt, tl.description AS line_description,
       round(tl.dist::numeric) AS transmission_distance_m
FROM addresses a
LEFT JOIN LATERAL (
  SELECT designvolt, description,
         ST_Distance(geom::geography, a.geom::geography) AS dist
  FROM transmission_lines
  WHERE geom && ST_Expand(a.geom, 0.003)
    AND ST_DWithin(geom::geography, a.geom::geography, 200)
  ORDER BY geom <-> a.geom LIMIT 1
) tl ON true;
