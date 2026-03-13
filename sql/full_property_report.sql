-- LEGACY: Ad-hoc full property report query (superseded by get_property_report() in 07-report-function.sql)
-- Kept for reference only — NOT part of the build pipeline.
-- The PL/pgSQL function in 07-report-function.sql is the production version.
--
-- Original: Full Property Report: ALL 33 tables for a given address
-- Usage: psql -d wharescore -f full_property_report.sql

\x on

WITH addr AS (
  SELECT geom, full_address FROM addresses WHERE full_address ILIKE '%162 Cuba Street%Te Aro%' LIMIT 1
),

-- PARCEL INFO
parcel AS (
  SELECT p.appellation, p.parcel_intent, ROUND(p.survey_area::numeric, 0) AS area_sqm, p.titles
  FROM parcels p, addr WHERE ST_Intersects(p.geom, addr.geom) LIMIT 1
),

-- PROPERTY TITLE
title AS (
  SELECT pt.title_no, pt.type, pt.estate_description, pt.number_owners, pt.issue_date::date
  FROM property_titles pt, addr WHERE ST_Intersects(pt.geom, addr.geom) LIMIT 1
),

-- BUILDING OUTLINES within 50m
bldg AS (
  SELECT COUNT(*) AS cnt,
    string_agg(DISTINCT bo.use, ', ') AS uses,
    string_agg(DISTINCT bo.name, ', ') FILTER (WHERE bo.name IS NOT NULL AND bo.name != '') AS named
  FROM building_outlines bo, addr
  WHERE bo.geom && ST_Expand(addr.geom, 0.001) AND ST_DWithin(bo.geom::geography, addr.geom::geography, 50)
),

-- CRIME (join via area_unit)
crime_stats AS (
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE anzsoc_division = 'Assault') AS assault,
    COUNT(*) FILTER (WHERE anzsoc_division = 'Burglary') AS burglary,
    COUNT(*) FILTER (WHERE anzsoc_division = 'Theft') AS theft,
    COUNT(*) FILTER (WHERE anzsoc_division = 'Sexual Offences') AS sexual,
    COUNT(*) FILTER (WHERE anzsoc_division = 'Robbery, blackmail, and extortion') AS robbery
  FROM crime c
  WHERE c.area_unit = (SELECT c2.area_unit FROM crime c2 WHERE c2.territorial_authority ILIKE '%Wellington%' AND c2.area_unit ILIKE '%Cuba%' LIMIT 1)
    AND c.year_month >= '2024-01-01'
),

-- RENTAL MARKET (latest Wellington City)
rental AS (
  SELECT median_rent, lower_quartile_rent AS lq_rent, upper_quartile_rent AS uq_rent,
    active_bonds, time_frame
  FROM bonds_tla WHERE location = 'Wellington City' ORDER BY time_frame DESC LIMIT 1
),

-- CLIMATE PROJECTIONS (nearest grid point, SSP3-7.0, 2081-2100, annual)
climate AS (
  SELECT
    cp."TN_value_change" AS min_temp_change,
    cp."TX_value_change" AS max_temp_change,
    cp."PR_value_change" AS precip_change_pct,
    cp."FD_value_change" AS frost_days_change,
    cp."HD18_value_change" AS heating_dd_change,
    cp."sfcWind_value_change" AS wind_change,
    cp."R99pVAL_value_change" AS extreme_rain_change
  FROM climate_grid cg, addr
  CROSS JOIN LATERAL (
    SELECT * FROM climate_projections cp2
    WHERE cp2.vcsn_agent = cg.agent_no
      AND cp2.scenario = 'ssp370'
      AND cp2.future_period = '2081-2100'
      AND cp2.season = 'Annual'
    LIMIT 1
  ) cp
  ORDER BY cg.geom <-> addr.geom LIMIT 1
),

-- COASTAL EROSION (nearest segment)
coast AS (
  SELECT ce.exposure, ce.shore_type, ce.csi_cc AS csi_score,
    ROUND(ST_Distance(ce.geom::geography, addr.geom::geography)::numeric/1000, 1) AS dist_km
  FROM coastal_erosion ce, addr ORDER BY ce.geom <-> addr.geom LIMIT 1
),

-- INFRASTRUCTURE PROJECTS within 5km
infra AS (
  SELECT COUNT(*) AS cnt,
    string_agg(
      ip.project_name || ' [' || COALESCE(ip.value_range, '?') || ', ' || COALESCE(ip.project_status, '?') || ']',
      E'\n  ' ORDER BY ST_Distance(ip.geom::geography, addr.geom::geography)
    ) AS projects
  FROM infrastructure_projects ip, addr
  WHERE ip.geom IS NOT NULL AND ip.geom && ST_Expand(addr.geom, 0.05)
    AND ST_DWithin(ip.geom::geography, addr.geom::geography, 5000)
),

-- SCHOOL ENROLMENT ZONES
szones AS (
  SELECT string_agg(sz.school_name || ' (' || COALESCE(sz.institution_type, '') || ')', E'\n  ') AS zones
  FROM school_zones sz, addr WHERE ST_Intersects(sz.geom, addr.geom)
),

-- NEAREST 5 SCHOOLS
near_schools AS (
  SELECT string_agg(
    s.school_name || ' (' || ROUND(ST_Distance(s.geom::geography, addr.geom::geography)::numeric, 0) || 'm, '
      || COALESCE(s.school_type, '') || ')',
    E'\n  ' ORDER BY ST_Distance(s.geom::geography, addr.geom::geography)
  ) AS schools
  FROM (
    SELECT s2.school_name, s2.school_type, s2.geom
    FROM schools s2, addr
    WHERE s2.geom && ST_Expand(addr.geom, 0.015) AND ST_DWithin(s2.geom::geography, addr.geom::geography, 1500)
    ORDER BY s2.geom <-> addr.geom LIMIT 5
  ) s, addr
),

-- RESOURCE CONSENTS within 300m
consents AS (
  SELECT COUNT(*) AS cnt,
    string_agg(DISTINCT rc.consent_type, ', ') AS types
  FROM resource_consents rc, addr
  WHERE rc.geom && ST_Expand(addr.geom, 0.005) AND ST_DWithin(rc.geom::geography, addr.geom::geography, 300)
),

-- NEAREST 3 TRANSIT STOPS
near_transit AS (
  SELECT string_agg(
    ts.stop_name || ' (' || ROUND(ST_Distance(ts.geom::geography, addr.geom::geography)::numeric, 0) || 'm)',
    E'\n  ' ORDER BY ST_Distance(ts.geom::geography, addr.geom::geography)
  ) AS stops
  FROM (
    SELECT t2.stop_name, t2.geom
    FROM transit_stops t2, addr
    WHERE t2.geom && ST_Expand(addr.geom, 0.005) AND ST_DWithin(t2.geom::geography, addr.geom::geography, 400)
    ORDER BY t2.geom <-> addr.geom LIMIT 3
  ) ts, addr
),

-- NEAREST 3 HERITAGE SITES
near_heritage AS (
  SELECT string_agg(
    h.name || ' (' || h.list_entry_type || ', ' || ROUND(ST_Distance(h.geom::geography, addr.geom::geography)::numeric, 0) || 'm)',
    E'\n  ' ORDER BY ST_Distance(h.geom::geography, addr.geom::geography)
  ) AS sites
  FROM (
    SELECT h2.name, h2.list_entry_type, h2.geom
    FROM heritage_sites h2, addr
    ORDER BY h2.geom <-> addr.geom LIMIT 3
  ) h, addr
),

-- NEAREST CONTAMINATED SITES
near_contam AS (
  SELECT string_agg(
    COALESCE(cl.site_name, cl.category, 'Unknown') || ' [' || COALESCE(cl.category, '') || '] (' || ROUND(ST_Distance(cl.geom::geography, addr.geom::geography)::numeric, 0) || 'm)',
    E'\n  ' ORDER BY ST_Distance(cl.geom::geography, addr.geom::geography)
  ) AS sites
  FROM (
    SELECT cl2.site_name, cl2.category, cl2.geom
    FROM contaminated_land cl2, addr
    WHERE cl2.geom && ST_Expand(addr.geom, 0.003) AND ST_DWithin(cl2.geom::geography, addr.geom::geography, 200)
    ORDER BY cl2.geom <-> addr.geom LIMIT 5
  ) cl, addr
)

SELECT
  '=== PROPERTY ===' AS section,
  addr.full_address AS "Address",
  parcel.appellation AS "Legal Description",
  parcel.area_sqm AS "Land Area (sqm)",
  parcel.parcel_intent AS "Parcel Type",
  title.title_no AS "Title No",
  title.type AS "Title Type",
  title.estate_description AS "Estate",
  title.number_owners AS "Owners",
  title.issue_date AS "Title Issued",
  bldg.cnt AS "Buildings within 50m",
  bldg.uses AS "Building Uses",
  bldg.named AS "Named Buildings",

  '=== PLANNING ===' AS section2,
  (SELECT dz.zone_name FROM district_plan_zones dz, addr WHERE ST_Intersects(dz.geom, addr.geom) LIMIT 1) AS "District Plan Zone",
  (SELECT hc.height_metres::text || 'm' FROM height_controls hc, addr WHERE ST_Intersects(hc.geom, addr.geom) LIMIT 1) AS "Height Limit",
  szones.zones AS "School Enrolment Zones",
  consents.cnt AS "Resource Consents (300m)",
  consents.types AS "Consent Types",

  '=== NATURAL HAZARDS ===' AS section3,
  COALESCE((SELECT string_agg(DISTINCT fz.title, ', ') FROM flood_zones fz, addr WHERE ST_Intersects(fz.geom, addr.geom)), 'None') AS "Flood Zone",
  COALESCE((SELECT string_agg(DISTINCT lz.liquefaction, ', ') FROM liquefaction_zones lz, addr WHERE ST_Intersects(lz.geom, addr.geom)), 'None') AS "Liquefaction",
  COALESCE((SELECT string_agg(DISTINCT tz.evac_zone, ', ') FROM tsunami_zones tz, addr WHERE ST_Intersects(tz.geom, addr.geom)), 'None') AS "Tsunami Zone",
  (SELECT COUNT(*) FROM earthquakes e, addr WHERE e.geom && ST_Expand(addr.geom, 0.3) AND ST_DWithin(e.geom::geography, addr.geom::geography, 30000) AND e.magnitude >= 4) AS "Earthquakes M4+ (30km, since 2015)",
  (SELECT wr.ten_year_mean || ' VHE days/yr (' || COALESCE(wr.trend_likelihood, 'N/A') || ')'
   FROM wildfire_risk wr, addr WHERE wr.fuel_type = 'Forest' ORDER BY wr.geom <-> addr.geom LIMIT 1) AS "Wildfire Risk (Forest)",
  (SELECT wr.ten_year_mean || ' VHE days/yr (' || COALESCE(wr.trend_likelihood, 'N/A') || ')'
   FROM wildfire_risk wr, addr WHERE wr.fuel_type = 'Grass' ORDER BY wr.geom <-> addr.geom LIMIT 1) AS "Wildfire Risk (Grass)",
  coast.exposure AS "Coastal Exposure",
  coast.shore_type AS "Coastal Shore Type",
  coast.csi_score AS "Coastal Sensitivity Index (w/ CC)",
  coast.dist_km AS "Nearest Coast (km)",

  '=== BUILT ENVIRONMENT HAZARDS ===' AS section4,
  (SELECT COUNT(*) FROM contaminated_land cl, addr WHERE cl.geom && ST_Expand(addr.geom, 0.003) AND ST_DWithin(cl.geom::geography, addr.geom::geography, 200)) AS "Contaminated Sites (200m)",
  near_contam.sites AS "Nearest Contaminated",
  (SELECT COUNT(*) FROM earthquake_prone_buildings ep, addr WHERE ep.geom && ST_Expand(addr.geom, 0.005) AND ST_DWithin(ep.geom::geography, addr.geom::geography, 300)) AS "Earthquake-Prone Buildings (300m)",
  (SELECT COUNT(*) FROM transmission_lines tl, addr WHERE tl.geom && ST_Expand(addr.geom, 0.003) AND ST_DWithin(tl.geom::geography, addr.geom::geography, 200)) AS "Transmission Lines (200m)",
  (SELECT COUNT(*) FROM crashes c, addr WHERE c.geom && ST_Expand(addr.geom, 0.005) AND ST_DWithin(c.geom::geography, addr.geom::geography, 300) AND c.crash_severity IN ('Fatal Crash','Serious Crash')) AS "Serious/Fatal Crashes (300m)",

  '=== ENVIRONMENT ===' AS section5,
  (SELECT wz.zone_name || ' (' || wz.ta || ')' FROM wind_zones wz, addr WHERE ST_Intersects(wz.geom, addr.geom) LIMIT 1) AS "Wind Zone",
  (SELECT MAX(nc.laeq24h)::text || ' dB LAeq(24h)' FROM noise_contours nc, addr WHERE ST_Intersects(nc.geom, addr.geom)) AS "Road Noise (max)",
  (SELECT aq.site_name || ': PM10=' || COALESCE(aq.pm10_trend,'N/A') || ', PM2.5=' || COALESCE(aq.pm25_trend,'N/A')
     || ' (' || ROUND(ST_Distance(aq.geom::geography, addr.geom::geography)::numeric, 0) || 'm)'
   FROM air_quality_sites aq, addr ORDER BY aq.geom <-> addr.geom LIMIT 1) AS "Air Quality (nearest)",
  (SELECT wq.site_name || ': E.coli=' || COALESCE(wq.ecoli_band,'?') || ', NH3=' || COALESCE(wq.ammonia_band,'?')
     || ', NO3=' || COALESCE(wq.nitrate_band,'?') || ', Clarity=' || COALESCE(wq.clarity_band,'?')
     || ' (' || ROUND(ST_Distance(wq.geom::geography, addr.geom::geography)::numeric/1000, 1) || 'km)'
   FROM water_quality_sites wq, addr ORDER BY wq.geom <-> addr.geom LIMIT 1) AS "Water Quality (nearest)",

  '=== CLIMATE PROJECTIONS (2081-2100, SSP3-7.0) ===' AS section6,
  climate.min_temp_change AS "Min Temp Change (C)",
  climate.max_temp_change AS "Max Temp Change (C)",
  climate.precip_change_pct AS "Precipitation Change (%)",
  climate.frost_days_change AS "Frost Days Change",
  climate.heating_dd_change AS "Heating Degree Days Change",
  climate.wind_change AS "Wind Speed Change",
  climate.extreme_rain_change AS "Extreme Rain (99th pctl) Change",

  '=== NEIGHBOURHOOD ===' AS section7,
  (SELECT n.nzdep2023 FROM meshblocks m JOIN nzdep n ON m.mb2023_code = n.mb2023_code, addr WHERE ST_Intersects(m.geom, addr.geom) LIMIT 1) AS "Deprivation Score (1-10)",
  crime_stats.total AS "Crime Total (2024+)",
  crime_stats.assault AS "- Assault",
  crime_stats.burglary AS "- Burglary",
  crime_stats.theft AS "- Theft",
  crime_stats.robbery AS "- Robbery/Extortion",
  crime_stats.sexual AS "- Sexual Offences",
  rental.median_rent AS "Median Rent (Wellington City)",
  rental.lq_rent AS "Rent Lower Quartile",
  rental.uq_rent AS "Rent Upper Quartile",
  rental.active_bonds AS "Active Bonds (Wellington City)",
  rental.time_frame AS "Rent Data Date",

  '=== HERITAGE ===' AS section8,
  (SELECT COUNT(*) FROM heritage_sites h, addr WHERE h.geom && ST_Expand(addr.geom, 0.006) AND ST_DWithin(h.geom::geography, addr.geom::geography, 500)) AS "Heritage Sites (500m)",
  near_heritage.sites AS "Nearest Heritage Sites",

  '=== TRANSPORT & SCHOOLS ===' AS section9,
  (SELECT COUNT(*) FROM transit_stops t, addr WHERE t.geom && ST_Expand(addr.geom, 0.005) AND ST_DWithin(t.geom::geography, addr.geom::geography, 400)) AS "Transit Stops (400m)",
  near_transit.stops AS "Nearest Stops",
  (SELECT COUNT(*) FROM schools s, addr WHERE s.geom && ST_Expand(addr.geom, 0.015) AND ST_DWithin(s.geom::geography, addr.geom::geography, 1500)) AS "Schools (1.5km)",
  near_schools.schools AS "Nearest Schools",

  '=== INFRASTRUCTURE ===' AS section10,
  infra.cnt AS "Infrastructure Projects (5km)",
  infra.projects AS "Projects"

FROM addr
LEFT JOIN parcel ON true
LEFT JOIN title ON true
LEFT JOIN bldg ON true
LEFT JOIN crime_stats ON true
LEFT JOIN rental ON true
LEFT JOIN climate ON true
LEFT JOIN coast ON true
LEFT JOIN infra ON true
LEFT JOIN szones ON true
LEFT JOIN near_schools ON true
LEFT JOIN consents ON true
LEFT JOIN near_transit ON true
LEFT JOIN near_heritage ON true
LEFT JOIN near_contam ON true
;
