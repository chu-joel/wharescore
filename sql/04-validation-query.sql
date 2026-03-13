-- WhareScore POC: Validation Query
-- Verifies all 42+ tables have data and core spatial joins work.
-- Run with: psql -U postgres -d wharescore -f 04-validation-query.sql

-- Test 1: Check every table has data (all 42 data tables + MVs)
SELECT 'meshblocks' AS table_name, COUNT(*) AS row_count FROM meshblocks
UNION ALL SELECT 'nzdep', COUNT(*) FROM nzdep
UNION ALL SELECT 'parcels', COUNT(*) FROM parcels
UNION ALL SELECT 'addresses', COUNT(*) FROM addresses
UNION ALL SELECT 'flood_zones', COUNT(*) FROM flood_zones
UNION ALL SELECT 'earthquakes', COUNT(*) FROM earthquakes
UNION ALL SELECT 'schools', COUNT(*) FROM schools
UNION ALL SELECT 'school_zones', COUNT(*) FROM school_zones
UNION ALL SELECT 'crashes', COUNT(*) FROM crashes
UNION ALL SELECT 'crime', COUNT(*) FROM crime
UNION ALL SELECT 'bonds_tla', COUNT(*) FROM bonds_tla
UNION ALL SELECT 'bonds_region', COUNT(*) FROM bonds_region
UNION ALL SELECT 'bonds_detailed', COUNT(*) FROM bonds_detailed
UNION ALL SELECT 'transit_stops', COUNT(*) FROM transit_stops
UNION ALL SELECT 'building_outlines', COUNT(*) FROM building_outlines
UNION ALL SELECT 'property_titles', COUNT(*) FROM property_titles
UNION ALL SELECT 'tsunami_zones', COUNT(*) FROM tsunami_zones
UNION ALL SELECT 'liquefaction_zones', COUNT(*) FROM liquefaction_zones
UNION ALL SELECT 'transmission_lines', COUNT(*) FROM transmission_lines
UNION ALL SELECT 'coastal_erosion', COUNT(*) FROM coastal_erosion
UNION ALL SELECT 'climate_grid', COUNT(*) FROM climate_grid
UNION ALL SELECT 'climate_projections', COUNT(*) FROM climate_projections
UNION ALL SELECT 'infrastructure_projects', COUNT(*) FROM infrastructure_projects
UNION ALL SELECT 'wind_zones', COUNT(*) FROM wind_zones
UNION ALL SELECT 'noise_contours', COUNT(*) FROM noise_contours
UNION ALL SELECT 'air_quality_sites', COUNT(*) FROM air_quality_sites
UNION ALL SELECT 'water_quality_sites', COUNT(*) FROM water_quality_sites
UNION ALL SELECT 'heritage_sites', COUNT(*) FROM heritage_sites
UNION ALL SELECT 'wildfire_risk', COUNT(*) FROM wildfire_risk
UNION ALL SELECT 'district_plan_zones', COUNT(*) FROM district_plan_zones
UNION ALL SELECT 'height_controls', COUNT(*) FROM height_controls
UNION ALL SELECT 'contaminated_land', COUNT(*) FROM contaminated_land
UNION ALL SELECT 'earthquake_prone_buildings', COUNT(*) FROM earthquake_prone_buildings
UNION ALL SELECT 'resource_consents', COUNT(*) FROM resource_consents
UNION ALL SELECT 'rbnz_housing', COUNT(*) FROM rbnz_housing
UNION ALL SELECT 'sa2_boundaries', COUNT(*) FROM sa2_boundaries
UNION ALL SELECT 'council_valuations', COUNT(*) FROM council_valuations
UNION ALL SELECT 'osm_amenities', COUNT(*) FROM osm_amenities
UNION ALL SELECT 'conservation_land', COUNT(*) FROM conservation_land
UNION ALL SELECT 'market_rent_cache', COUNT(*) FROM market_rent_cache
UNION ALL SELECT 'wcc_rates_cache', COUNT(*) FROM wcc_rates_cache
UNION ALL SELECT 'area_profiles', COUNT(*) FROM area_profiles
-- Materialized views
UNION ALL SELECT 'mv_crime_density', COUNT(*) FROM mv_crime_density
UNION ALL SELECT 'mv_crime_ta', COUNT(*) FROM mv_crime_ta
UNION ALL SELECT 'mv_rental_market', COUNT(*) FROM mv_rental_market
UNION ALL SELECT 'mv_rental_trends', COUNT(*) FROM mv_rental_trends
-- Application tables (may be empty before app launch)
UNION ALL SELECT 'user_rent_reports', COUNT(*) FROM user_rent_reports
UNION ALL SELECT 'feedback', COUNT(*) FROM feedback
UNION ALL SELECT 'email_signups', COUNT(*) FROM email_signups
UNION ALL SELECT 'data_sources', COUNT(*) FROM data_sources
UNION ALL SELECT 'admin_content', COUNT(*) FROM admin_content
ORDER BY table_name;

-- Test 2: Sample deprivation scores joined to meshblock boundaries
SELECT
    m.mb2023_code,
    n.nzdep2023 AS deprivation_score,
    ST_Area(m.geom::geography) AS area_sqm
FROM meshblocks m
JOIN nzdep n ON m.mb2023_code = n.mb2023_code
WHERE n.nzdep2023 IS NOT NULL
LIMIT 5;

-- Test 3: THE VALIDATION QUERY
-- For a Wellington address: return parcel + deprivation + flood status
SELECT
    a.full_address,
    n.nzdep2023 AS deprivation_score,
    n.nzdep2023_score AS deprivation_raw_score,
    CASE
        WHEN f.ogc_fid IS NOT NULL THEN 'YES - IN FLOOD ZONE'
        ELSE 'No flood risk identified'
    END AS flood_status,
    ST_X(a.geom) AS longitude,
    ST_Y(a.geom) AS latitude
FROM addresses a
LEFT JOIN meshblocks m ON ST_Contains(m.geom, a.geom)
LEFT JOIN nzdep n ON m.mb2023_code = n.mb2023_code
LEFT JOIN flood_zones f ON ST_Intersects(f.geom, a.geom)
WHERE a.full_address ILIKE '%Petone%'
LIMIT 10;

-- Test 4: Same query for a known flood-prone area (Lower Hutt / Petone)
SELECT
    a.full_address,
    n.nzdep2023 AS deprivation_score,
    CASE
        WHEN f.ogc_fid IS NOT NULL THEN 'YES - IN FLOOD ZONE'
        ELSE 'No flood risk identified'
    END AS flood_status
FROM addresses a
LEFT JOIN meshblocks m ON ST_Contains(m.geom, a.geom)
LEFT JOIN nzdep n ON m.mb2023_code = n.mb2023_code
LEFT JOIN flood_zones f ON ST_Intersects(f.geom, a.geom)
WHERE a.full_address ILIKE '%Lower Hutt%'
AND f.ogc_fid IS NOT NULL
LIMIT 10;

-- Test 5: Count addresses in flood zones (Wellington region)
SELECT
    COUNT(*) FILTER (WHERE f.ogc_fid IS NOT NULL) AS addresses_in_flood_zone,
    COUNT(*) AS total_addresses_checked,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE f.ogc_fid IS NOT NULL) / NULLIF(COUNT(*), 0),
        1
    ) AS percent_in_flood_zone
FROM addresses a
LEFT JOIN flood_zones f ON ST_Intersects(f.geom, a.geom)
WHERE a.full_address ILIKE '%Wellington%'
   OR a.full_address ILIKE '%Lower Hutt%'
   OR a.full_address ILIKE '%Upper Hutt%'
   OR a.full_address ILIKE '%Porirua%';

-- Test 6: get_property_report() smoke test (162 Cuba Street)
SELECT jsonb_object_keys(get_property_report(
  (SELECT address_id FROM addresses WHERE full_address ILIKE '%162 Cuba Street%Te Aro%' LIMIT 1)
)) AS report_sections;
