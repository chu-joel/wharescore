-- 0022_report_missing_layers.sql
-- Add missing data layer queries to get_property_report().
-- Tables populated by DataSource entries but not previously queried:
--   active_faults, fault_avoidance_zones, historic_heritage_overlay,
--   notable_trees, significant_ecological_areas, aircraft_noise_overlay

CREATE OR REPLACE FUNCTION get_property_report(p_address_id BIGINT)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  addr RECORD;
  result jsonb;
  v_sa2_code TEXT;
  v_sa2_name TEXT;
  v_ta_name  TEXT;
BEGIN
  -- 1. Get address + geometry
  SELECT address_id, full_address, suburb_locality, town_city, unit_type, unit_value, geom
    INTO addr
    FROM addresses WHERE address_id = p_address_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 2. SA2 lookup (used by market section)
  SELECT sa2_code, sa2_name, ta_name
    INTO v_sa2_code, v_sa2_name, v_ta_name
    FROM sa2_boundaries
    WHERE ST_Within(addr.geom, geom) LIMIT 1;

  -- 3. Build report
  result := jsonb_build_object(

    -- ADDRESS
    'address', jsonb_build_object(
      'address_id', addr.address_id,
      'full_address', addr.full_address,
      'suburb', addr.suburb_locality,
      'city', addr.town_city,
      'unit_type', addr.unit_type,
      'sa2_code', v_sa2_code,
      'sa2_name', v_sa2_name,
      'ta_name', v_ta_name,
      'lng', ST_X(addr.geom),
      'lat', ST_Y(addr.geom)
    ),

    -- PROPERTY (building, title, valuation)
    'property', (
      SELECT jsonb_build_object(
        'footprint_sqm', bo.footprint_sqm,
        'building_use', bo.building_use,
        'title_no', pt.title_no,
        'estate_description', pt.estate_description,
        'title_type', pt.title_type,
        'capital_value', cv.capital_value,
        'land_value', cv.land_value,
        'improvements_value', cv.improvements_value,
        'cv_land_area', cv.cv_land_area,
        'cv_date', cv.cv_date,
        'cv_council', cv.cv_council,
        'multi_unit', mu.addr_count > 4
      )
      FROM (SELECT 1) x
      LEFT JOIN LATERAL (
        SELECT use AS building_use, round(ST_Area(geom::geography)::numeric, 1) AS footprint_sqm
        FROM building_outlines
        WHERE geom && addr.geom AND ST_Contains(geom, addr.geom) LIMIT 1
      ) bo ON true
      LEFT JOIN LATERAL (
        SELECT title_no, estate_description, type AS title_type
        FROM property_titles
        WHERE geom && addr.geom AND ST_Contains(geom, addr.geom) LIMIT 1
      ) pt ON true
      LEFT JOIN LATERAL (
        SELECT capital_value, land_value, improvements_value, land_area AS cv_land_area,
               valuation_date AS cv_date, council AS cv_council,
               valuation_id AS cv_valuation_id, full_address AS cv_address
        FROM council_valuations
        WHERE geom && ST_Expand(addr.geom, 0.0005)
          AND ST_DWithin(geom::geography, addr.geom::geography, 30)
        ORDER BY
          CASE
            WHEN addr.unit_value IS NOT NULL
              AND full_address ~* ('(Unit|Flat|Apartment)\s*' || addr.unit_value || '\b')
            THEN 0
            WHEN addr.unit_value IS NULL
              AND full_address !~* '^(Unit|Flat|Apartment|Car Park|Shop)\s'
            THEN 1
            ELSE 2
          END,
          geom <-> addr.geom
        LIMIT 1
      ) cv ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS addr_count
        FROM addresses a2
        WHERE a2.geom && ST_Expand(addr.geom, 0.0001)
          AND ST_DWithin(a2.geom::geography, addr.geom::geography, 5)
      ) mu ON true
    ),

    -- HAZARDS
    'hazards', (
      SELECT jsonb_build_object(
        'flood', fz.flood_label,
        'tsunami_zone_class', tz.zone_class,
        'tsunami_evac_zone', tz.evac_zone,
        'liquefaction', lz.liq_class,
        'wind_zone', wz.zone_name,
        'coastal_exposure', ce.assessment_level,
        'earthquake_count_30km', eq.cnt,
        'wildfire_vhe_days', wf.vhe_days,
        'wildfire_trend', wf.trend,
        'epb_count_300m', epb.cnt,
        'slope_failure', sf.susceptibility,
        -- Wellington-specific hazard data
        'earthquake_hazard_index', gwrc_eq.chi,
        'earthquake_hazard_grade', gwrc_eq.chi_grade,
        'ground_shaking_zone', gwrc_gs.zone,
        'ground_shaking_severity', gwrc_gs.severity,
        'gwrc_liquefaction', gwrc_liq.liquefaction,
        'gwrc_liquefaction_geology', gwrc_liq.simplified,
        'gwrc_slope_severity', gwrc_sf.severity,
        'fault_zone_name', fz_wcc.name,
        'fault_zone_ranking', fz_wcc.hazard_ranking,
        'wcc_flood_type', fh_wcc.hazard_type,
        'wcc_flood_ranking', fh_wcc.hazard_ranking,
        'wcc_tsunami_return_period', th_wcc.return_period,
        'wcc_tsunami_ranking', th_wcc.hazard_ranking,
        -- Council-specific regional hazard data (all cities)
        'council_liquefaction', liq_council.liquefaction,
        'council_liquefaction_geology', liq_council.simplified,
        'council_liquefaction_source', liq_council.source_council,
        'council_tsunami_ranking', tsu_council.hazard_ranking,
        'council_tsunami_scenario', tsu_council.scenario,
        'council_tsunami_return_period', tsu_council.return_period,
        'council_tsunami_source', tsu_council.source_council,
        'council_slope_severity', sf_council.severity,
        'council_slope_source', sf_council.source_council,
        'epb_nearest', epb_detail.nearest,
        'solar_mean_kwh', solar.mean_yearly_solar,
        'solar_max_kwh', solar.max_yearly_solar,
        -- GNS Landslide Database
        'landslide_count_500m', ls_count.cnt,
        'landslide_nearest', ls_nearest.nearest,
        'landslide_in_area', ls_area.in_area,
        -- Council landslide susceptibility (GWRC + Auckland)
        'landslide_susceptibility_rating', ls_susc.accuracy,
        'landslide_susceptibility_type', ls_susc.type,
        'landslide_susceptibility_source', ls_susc.source_council,
        -- Coastal hazards
        'coastal_elevation_cm', (coast_elev.elevation_m * 100)::int,
        'coastal_inundation_ranking', coast_inund.inundation_ranking,
        'coastal_inundation_scenario', coast_inund.inundation_scenario,
        -- Erosion prone land
        'on_erosion_prone_land', coalesce(epl.on_erosion_prone, false),
        'erosion_min_angle', epl.erosion_min_angle,
        -- GNS Active Faults (national) — NEW
        'active_fault_nearest', af_nearest.nearest,
        'fault_avoidance_zone', faz.zone_type,
        -- Aircraft noise overlay — NEW
        'aircraft_noise_name', ano.name,
        'aircraft_noise_dba', ano.noise_level_dba,
        'aircraft_noise_category', ano.noise_category,
        -- Overland flow paths
        'overland_flow_within_50m', ofp.nearby,
        -- Council coastal erosion (Auckland ASCIE, Tauranga, etc.)
        'council_coastal_erosion', cce.erosion_data,
        -- Coastal erosion (national, exposure + timeframe)
        'coastal_erosion_exposure', ce_nat.exposure,
        'coastal_erosion_timeframe', ce_nat.timeframe,
        -- Council flood hazard (AEP-based)
        'flood_extent_aep', fh_council.aep,
        'flood_extent_label', fh_council.label,
        -- Geotechnical reports
        'geotech_count_500m', geo_count.cnt,
        'geotech_nearest_hazard', geo_nearest.hazard
      )
      FROM (SELECT 1) x
      LEFT JOIN LATERAL (
        SELECT label AS flood_label FROM flood_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) fz ON true
      LEFT JOIN LATERAL (
        SELECT zone_class, evac_zone FROM tsunami_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) tz ON true
      LEFT JOIN LATERAL (
        SELECT liquefaction AS liq_class FROM liquefaction_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) lz ON true
      LEFT JOIN LATERAL (
        SELECT zone_name FROM wind_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) wz ON true
      LEFT JOIN LATERAL (
        SELECT assessment_level FROM coastal_erosion
        WHERE geom && ST_Expand(addr.geom, 0.02)
          AND ST_DWithin(geom::geography, addr.geom::geography, 2000)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) ce ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM earthquakes
        WHERE magnitude >= 4
          AND event_time >= CURRENT_DATE - interval '10 years'
          AND geom && ST_Expand(addr.geom, 0.3)
          AND ST_DWithin(geom::geography, addr.geom::geography, 30000)
      ) eq ON true
      LEFT JOIN LATERAL (
        SELECT ten_year_mean AS vhe_days, trend_likelihood AS trend
        FROM wildfire_risk
        ORDER BY geom <-> addr.geom LIMIT 1
      ) wf ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM earthquake_prone_buildings
        WHERE geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(geom::geography, addr.geom::geography, 300)
      ) epb ON true
      LEFT JOIN LATERAL (
        SELECT susceptibility FROM slope_failure_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) sf ON true
      -- Wellington: GWRC combined earthquake hazard (renamed from gwrc_earthquake_hazard)
      LEFT JOIN LATERAL (
        SELECT chi, chi_hazard_grade AS chi_grade
        FROM earthquake_hazard
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) gwrc_eq ON true
      -- Wellington: GWRC ground shaking amplification (renamed from gwrc_ground_shaking)
      LEFT JOIN LATERAL (
        SELECT zone, severity FROM ground_shaking
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) gwrc_gs ON true
      -- Regional liquefaction detail (GWRC data, renamed from gwrc_liquefaction)
      LEFT JOIN LATERAL (
        SELECT liquefaction, simplified FROM liquefaction_detail
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) gwrc_liq ON true
      -- Regional slope failure (GWRC data, renamed from gwrc_slope_failure)
      LEFT JOIN LATERAL (
        SELECT severity FROM slope_failure
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) gwrc_sf ON true
      -- Wellington: WCC fault zones (renamed from wcc_fault_zones)
      LEFT JOIN LATERAL (
        SELECT name, hazard_ranking FROM fault_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) fz_wcc ON true
      -- Wellington: WCC 2024 DP flood hazard (renamed from wcc_flood_hazard → flood_hazard)
      -- Uses source_council filter to get WCC-specific flood data separate from council flood_hazard
      LEFT JOIN LATERAL (
        SELECT hazard_type, hazard_ranking FROM flood_hazard
        WHERE source_council = 'wellington_city'
          AND ST_Intersects(geom, addr.geom)
        ORDER BY CASE hazard_ranking
          WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END
        LIMIT 1
      ) fh_wcc ON true
      -- Wellington: WCC 2024 DP tsunami tiers (worst return period)
      -- Table renamed from wcc_tsunami_hazard → tsunami_hazard by migration 0004
      LEFT JOIN LATERAL (
        SELECT return_period, hazard_ranking FROM tsunami_hazard
        WHERE source_council = 'wellington_city'
          AND ST_Intersects(geom, addr.geom)
        ORDER BY layer_id ASC LIMIT 1
      ) th_wcc ON true
      -- MBIE EPB nearest within 50m (same-building match)
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'name', name,
          'rating', earthquake_rating,
          'construction_type', construction_type,
          'deadline', completion_deadline,
          'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric)
        ) AS nearest
        FROM mbie_epb
        WHERE geom && ST_Expand(addr.geom, 0.001)
          AND ST_DWithin(geom::geography, addr.geom::geography, 50)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) epb_detail ON true
      -- Wellington: building solar radiation
      LEFT JOIN LATERAL (
        SELECT mean_yearly_solar, max_yearly_solar FROM wcc_solar_radiation
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) solar ON true
      -- GNS Landslide Database: events within 500m
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM landslide_events
        WHERE geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
      ) ls_count ON true
      -- GNS Landslide Database: nearest event
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'name', name,
          'trigger', trigger_name,
          'severity', severity_name,
          'movement_type', movement_type_name,
          'date', time_of_occurrence,
          'damage', damage_description,
          'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric)
        ) AS nearest
        FROM landslide_events
        WHERE geom && ST_Expand(addr.geom, 0.01)
          AND ST_DWithin(geom::geography, addr.geom::geography, 1000)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) ls_nearest ON true
      -- GNS Landslide Database: within mapped landslide area polygon
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_area FROM landslide_areas
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) ls_area ON true
      -- Council landslide susceptibility (GWRC + Auckland, worst rating)
      LEFT JOIN LATERAL (
        SELECT accuracy, type, source_council
        FROM landslide_susceptibility
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY CASE LOWER(accuracy)
          WHEN 'very high' THEN 1 WHEN 'high' THEN 2 WHEN 'moderate' THEN 3
          WHEN 'medium' THEN 3 WHEN 'low' THEN 4 WHEN 'very low' THEN 5
          ELSE 6 END
        LIMIT 1
      ) ls_susc ON true
      -- Coastal elevation band (gridcode = metres above sea level)
      LEFT JOIN LATERAL (
        SELECT gridcode AS elevation_m FROM coastal_elevation
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) coast_elev ON true
      -- Coastal inundation overlay (+1.43m SLR)
      LEFT JOIN LATERAL (
        SELECT hazard_ranking AS inundation_ranking,
               scenario AS inundation_scenario
        FROM coastal_inundation
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY CASE hazard_ranking
          WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END
        LIMIT 1
      ) coast_inund ON true
      -- Erosion prone land (GWRC regional)
      LEFT JOIN LATERAL (
        SELECT TRUE AS on_erosion_prone, min_angle AS erosion_min_angle
        FROM erosion_prone_land
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) epl ON true
      -- NEW: GNS Active Faults — nearest fault within 5km
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'name', fault_name,
          'type', fault_type,
          'slip_rate_mm_yr', slip_rate_mm_yr,
          'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric)
        ) AS nearest
        FROM active_faults
        WHERE geom && ST_Expand(addr.geom, 0.05)
          AND ST_DWithin(geom::geography, addr.geom::geography, 5000)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) af_nearest ON true
      -- NEW: Fault avoidance zones — is property inside one?
      LEFT JOIN LATERAL (
        SELECT zone_type FROM fault_avoidance_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) faz ON true
      -- NEW: Aircraft noise overlay — airport noise zone
      LEFT JOIN LATERAL (
        SELECT name, noise_level_dba, noise_category
        FROM aircraft_noise_overlay
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) ano ON true
      -- Overland flow path proximity (50m)
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM overland_flow_paths
          WHERE geom && ST_Expand(addr.geom, 0.001)
            AND ST_DWithin(geom::geography, addr.geom::geography, 50)
        ) AS nearby
      ) ofp ON true
      -- Council coastal erosion data (Auckland ASCIE, Tauranga, etc.)
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'name', name,
          'timeframe', timeframe,
          'scenario', scenario,
          'sea_level_rise', sea_level_rise,
          'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric)
        ) AS erosion_data
        FROM coastal_erosion
        WHERE source_council IS NOT NULL
          AND geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) cce ON true
      -- Coastal erosion (national, exposure + timeframe)
      LEFT JOIN LATERAL (
        SELECT assessment_level AS exposure, timeframe
        FROM coastal_erosion
        WHERE source_council IS NULL
          AND geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) ce_nat ON true
      -- Council flood hazard (AEP-based from flood_hazard table)
      LEFT JOIN LATERAL (
        SELECT hazard_type AS aep, name AS label
        FROM flood_hazard
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY CASE hazard_ranking
          WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END
        LIMIT 1
      ) fh_council ON true
      -- Geotechnical reports count within 500m
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM geotechnical_reports
        WHERE geom && ST_Expand(addr.geom, 0.006)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
      ) geo_count ON true
      -- Geotechnical reports nearest hazard
      LEFT JOIN LATERAL (
        SELECT hazard
        FROM geotechnical_reports
        WHERE geom && ST_Expand(addr.geom, 0.006)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) geo_nearest ON true
      -- Council liquefaction (all cities — from liquefaction_detail, multi-council)
      LEFT JOIN LATERAL (
        SELECT liquefaction, simplified, source_council
        FROM liquefaction_detail
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY CASE liquefaction
          WHEN 'Very High' THEN 1 WHEN 'High' THEN 2 WHEN 'Moderate' THEN 3
          WHEN 'Low' THEN 4 ELSE 5 END
        LIMIT 1
      ) liq_council ON true
      -- Council tsunami (all cities — from tsunami_hazard, multi-council)
      LEFT JOIN LATERAL (
        SELECT hazard_ranking, scenario, return_period, source_council
        FROM tsunami_hazard
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY CASE hazard_ranking
          WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END
        LIMIT 1
      ) tsu_council ON true
      -- Council slope failure (all cities — from slope_failure, multi-council)
      LEFT JOIN LATERAL (
        SELECT severity, source_council
        FROM slope_failure
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY CASE severity
          WHEN '5 High' THEN 1 WHEN '4' THEN 2 WHEN '3 Moderate' THEN 3
          WHEN '2' THEN 4 WHEN '1 Low' THEN 5
          WHEN 'Very High' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3
          WHEN 'Low' THEN 4 WHEN 'Very Low' THEN 5
          ELSE 6 END
        LIMIT 1
      ) sf_council ON true
    ),

    -- ENVIRONMENT
    'environment', (
      SELECT jsonb_build_object(
        'road_noise_db', nc.max_db,
        'air_site_name', aq.site_name, 'air_pm10_trend', aq.pm10_trend,
        'air_pm25_trend', aq.pm25_trend, 'air_distance_m', round(aq.air_dist::numeric),
        'water_site_name', wq.site_name,
        'water_ecoli_band', wq.ecoli_band, 'water_ammonia_band', wq.ammonia_band,
        'water_nitrate_band', wq.nitrate_band, 'water_drp_band', wq.drp_band,
        'water_clarity_band', wq.clarity_band,
        'water_distance_m', round(wq.water_dist::numeric),
        'climate_temp_change', cp.temp_change,
        'climate_precip_change_pct', cp.precip_change,
        'contam_nearest_name', cl.site_name, 'contam_nearest_category', cl.cat,
        'contam_nearest_distance_m', round(cl.dist::numeric),
        'contam_count_2km', cl_count.cnt,
        -- Corrosion zone
        'in_corrosion_zone', coalesce(corr.in_zone, false),
        -- Rail vibration advisory
        'in_rail_vibration_area', coalesce(rv.in_area, false),
        'rail_vibration_type', rv.noise_area_type
      )
      FROM (SELECT 1) x
      LEFT JOIN LATERAL (
        SELECT MAX(laeq24h) AS max_db FROM noise_contours
        WHERE ST_Intersects(geom, addr.geom)
      ) nc ON true
      LEFT JOIN LATERAL (
        SELECT site_name, pm10_trend, pm25_trend,
               ST_Distance(geom::geography, addr.geom::geography) AS air_dist
        FROM air_quality_sites ORDER BY geom <-> addr.geom LIMIT 1
      ) aq ON true
      LEFT JOIN LATERAL (
        SELECT site_name, ecoli_band, ammonia_band, nitrate_band, drp_band, clarity_band,
               ST_Distance(geom::geography, addr.geom::geography) AS water_dist
        FROM water_quality_sites ORDER BY geom <-> addr.geom LIMIT 1
      ) wq ON true
      LEFT JOIN LATERAL (
        SELECT AVG("T_value_change") AS temp_change,
               AVG("PR_value_change") AS precip_change
        FROM climate_projections
        WHERE vcsn_agent = (
          SELECT agent_no FROM climate_grid ORDER BY geom <-> addr.geom LIMIT 1
        ) AND scenario = 'ssp245' AND season = 'ANNUAL'
      ) cp ON true
      LEFT JOIN LATERAL (
        SELECT site_name, anzecc_category AS cat,
               ST_Distance(geom::geography, addr.geom::geography) AS dist
        FROM contaminated_land
        WHERE geom && ST_Expand(addr.geom, 0.02)
          AND ST_DWithin(geom::geography, addr.geom::geography, 2000)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) cl ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM contaminated_land
        WHERE geom && ST_Expand(addr.geom, 0.02)
          AND ST_DWithin(geom::geography, addr.geom::geography, 2000)
      ) cl_count ON true
      -- Corrosion zone (coastal salt spray)
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_zone FROM corrosion_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) corr ON true
      -- Rail vibration advisory area
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_area, noise_area_type FROM rail_vibration
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) rv ON true
    ),

    -- LIVEABILITY
    'liveability', (
      SELECT jsonb_build_object(
        'nzdep_decile', nd.nzdep2023,
        'crime_area_unit', cd.crime_area_unit,
        'crime_victimisations', cd.crime_victimisations,
        'crime_percentile', round((cd.percentile_rank * 100)::numeric, 1),
        'crime_city_median_vics', cd.city_median_vics,
        'crime_city_total_vics', cd.city_total_vics,
        'crime_city_area_count', cd.city_area_count,
        'schools_1500m', sch.schools,
        'transit_stops_400m', ts.stop_count,
        'transit_stops_list', ts_list.stops,
        'nearest_train_name', tr.stop_name,
        'nearest_train_distance_m', round(tr.train_dist::numeric),
        'cbd_distance_m', round(ST_Distance(
          addr.geom::geography,
          (SELECT geom::geography FROM cbd_points ORDER BY geom <-> addr.geom LIMIT 1)
        )::numeric),
        'crashes_300m_serious', cr.serious_count,
        'crashes_300m_fatal', cr.fatal_count,
        'crashes_300m_total', cr.total_count,
        'heritage_count_500m', hr.cnt,
        'amenities_500m', am.amenity_summary,
        'nearest_supermarket', ess.supermarket,
        'nearest_gp', ess.gp,
        'nearest_pharmacy', ess.pharmacy,
        'conservation_nearest', con.name,
        'conservation_nearest_type', con.land_type,
        'conservation_nearest_distance_m', round(con.dist::numeric),
        -- Metlink mode breakdown (800m)
        'bus_stops_800m', ml.bus_count,
        'rail_stops_800m', ml.rail_count,
        'ferry_stops_800m', ml.ferry_count,
        'cable_car_stops_800m', ml.cable_car_count,
        -- Transit travel times to key destinations
        'transit_travel_times', tt.times,
        -- Peak frequency at nearest stop
        'peak_trips_per_hour', tf.peak_trips_per_hour,
        'nearest_stop_name', tf.stop_name
      )
      FROM (SELECT 1) x
      -- NZDep
      LEFT JOIN LATERAL (
        SELECT nd2.nzdep2023 FROM meshblocks mb
        JOIN nzdep nd2 ON nd2.mb2023_code = mb.mb2023_code
        WHERE ST_Within(addr.geom, mb.geom) LIMIT 1
      ) nd ON true
      -- Crime: fuzzy match SA2 name / suburb to area_unit, fall back to TA-level stats
      LEFT JOIN LATERAL (
        SELECT
          coalesce(best_au.victimisations_3yr, ta.victimisations_3yr) AS crime_victimisations,
          best_au.area_unit AS crime_area_unit,
          best_au.percentile_rank,
          ta.median_victimisations_per_au AS city_median_vics,
          ta.victimisations_3yr AS city_total_vics,
          ta.area_count AS city_area_count
        FROM mv_crime_ta ta
        LEFT JOIN LATERAL (
          SELECT au.area_unit, au.victimisations_3yr, au.percentile_rank
          FROM mv_crime_density au
          WHERE au.ta = ta.ta
            AND (
              au.area_unit = v_sa2_name
              OR au.area_unit = addr.suburb_locality
              OR similarity(au.area_unit, v_sa2_name) > 0.3
              OR similarity(au.area_unit, addr.suburb_locality) > 0.3
            )
          ORDER BY greatest(
            similarity(au.area_unit, v_sa2_name),
            similarity(au.area_unit, addr.suburb_locality)
          ) DESC
          LIMIT 1
        ) best_au ON true
        WHERE ta.ta = v_ta_name
        LIMIT 1
      ) cd ON true
      -- Schools within 1.5km (with zone check)
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'name', s.org_name,
          'type', s.org_type,
          'eqi', s.eqi_index,
          'roll', s.total_roll,
          'distance_m', round(ST_Distance(s.geom::geography, addr.geom::geography)::numeric),
          'latitude', ST_Y(s.geom),
          'longitude', ST_X(s.geom),
          'in_zone', EXISTS(
            SELECT 1 FROM school_zones sz
            WHERE sz.school_id = s.school_id
              AND ST_Contains(sz.geom, addr.geom)
          )
        ) ORDER BY ST_Distance(s.geom, addr.geom)) AS schools
        FROM schools s
        WHERE s.geom && ST_Expand(addr.geom, 0.015)
          AND ST_DWithin(s.geom::geography, addr.geom::geography, 1500)
      ) sch ON true
      -- Transit stops 400m (count + list with coordinates for map)
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS stop_count FROM transit_stops
        WHERE geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(geom::geography, addr.geom::geography, 400)
      ) ts ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'name', stop_name,
          'latitude', ST_Y(geom),
          'longitude', ST_X(geom),
          'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric)
        ) ORDER BY ST_Distance(geom, addr.geom)) AS stops
        FROM transit_stops
        WHERE geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(geom::geography, addr.geom::geography, 400)
        LIMIT 10
      ) ts_list ON true
      -- Nearest train station (location_type=1)
      LEFT JOIN LATERAL (
        SELECT stop_name, ST_Distance(geom::geography, addr.geom::geography) AS train_dist
        FROM transit_stops
        WHERE location_type = 1
        ORDER BY geom <-> addr.geom LIMIT 1
      ) tr ON true
      -- Crashes 300m (serious/fatal)
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE crash_severity = 'Serious Crash')::int AS serious_count,
          COUNT(*) FILTER (WHERE crash_severity = 'Fatal Crash')::int AS fatal_count
        FROM crashes
        WHERE geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(geom::geography, addr.geom::geography, 300)
          AND crash_year >= EXTRACT(YEAR FROM CURRENT_DATE)::int - 5
      ) cr ON true
      -- Heritage 500m
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM heritage_sites
        WHERE geom && ST_Expand(addr.geom, 0.006)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
      ) hr ON true
      -- OSM amenities 500m (summary counts by category)
      LEFT JOIN LATERAL (
        SELECT jsonb_object_agg(subcategory, cnt) AS amenity_summary
        FROM (
          SELECT subcategory, COUNT(*)::int AS cnt
          FROM osm_amenities
          WHERE geom && ST_Expand(addr.geom, 0.006)
            AND ST_DWithin(geom::geography, addr.geom::geography, 500)
          GROUP BY subcategory
          ORDER BY cnt DESC LIMIT 15
        ) sub
      ) am ON true
      -- Nearest essentials (supermarket, GP, pharmacy) — includes lat/lng for map rendering
      LEFT JOIN LATERAL (
        SELECT
          (SELECT jsonb_build_object('name', name, 'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric), 'latitude', ST_Y(geom), 'longitude', ST_X(geom))
           FROM osm_amenities WHERE subcategory = 'supermarket'
             AND geom && ST_Expand(addr.geom, 0.02)
           ORDER BY geom <-> addr.geom LIMIT 1) AS supermarket,
          (SELECT jsonb_build_object('name', name, 'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric), 'latitude', ST_Y(geom), 'longitude', ST_X(geom))
           FROM osm_amenities WHERE subcategory IN ('doctors', 'clinic')
             AND geom && ST_Expand(addr.geom, 0.02)
           ORDER BY geom <-> addr.geom LIMIT 1) AS gp,
          (SELECT jsonb_build_object('name', name, 'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric), 'latitude', ST_Y(geom), 'longitude', ST_X(geom))
           FROM osm_amenities WHERE subcategory = 'pharmacy'
             AND geom && ST_Expand(addr.geom, 0.02)
           ORDER BY geom <-> addr.geom LIMIT 1) AS pharmacy
      ) ess ON true
      -- Nearest conservation land
      LEFT JOIN LATERAL (
        SELECT name, land_type, ST_Distance(geom::geography, addr.geom::geography) AS dist
        FROM conservation_land
        WHERE geom && ST_Expand(addr.geom, 0.05)
          AND ST_DWithin(geom::geography, addr.geom::geography, 5000)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) con ON true
      -- Metlink stops breakdown by mode (800m)
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE 3 = ANY(route_types))::int AS bus_count,
          COUNT(*) FILTER (WHERE 2 = ANY(route_types))::int AS rail_count,
          COUNT(*) FILTER (WHERE 4 = ANY(route_types))::int AS ferry_count,
          COUNT(*) FILTER (WHERE 5 = ANY(route_types))::int AS cable_car_count
        FROM metlink_stops
        WHERE geom && ST_Expand(addr.geom, 0.01)
          AND ST_DWithin(geom::geography, addr.geom::geography, 800)
      ) ml ON true
      -- Transit travel times: best time to each destination from any stop within 400m
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'destination', best.destination,
          'minutes', best.min_minutes,
          'routes', best.route_names
        ) ORDER BY best.min_minutes) AS times
        FROM (
          SELECT DISTINCT ON (ttt.destination)
            ttt.destination, ttt.min_minutes, ttt.route_names
          FROM metlink_stops ms
          JOIN transit_travel_times ttt ON ttt.stop_id = ms.stop_id
          WHERE ms.geom && ST_Expand(addr.geom, 0.005)
            AND ST_DWithin(ms.geom::geography, addr.geom::geography, 400)
          ORDER BY ttt.destination, ttt.min_minutes
        ) best
      ) tt ON true
      -- Peak frequency at busiest nearby stop
      LEFT JOIN LATERAL (
        SELECT tsf.peak_trips_per_hour, ms2.stop_name
        FROM metlink_stops ms2
        JOIN transit_stop_frequency tsf ON tsf.stop_id = ms2.stop_id
        WHERE ms2.geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(ms2.geom::geography, addr.geom::geography, 400)
        ORDER BY tsf.peak_trips_per_hour DESC
        LIMIT 1
      ) tf ON true
    ),

    -- PLANNING
    'planning', (
      SELECT jsonb_build_object(
        'zone_name', dpz.zone_name, 'zone_code', dpz.zone_code, 'zone_category', dpz.category,
        'max_height_m', hc.height_metres,
        'heritage_listed', hr_flag.listed,
        'contaminated_listed', cl_flag.listed,
        'epb_listed', epb_flag.listed,
        'resource_consents_500m_2yr', rc.cnt,
        'infrastructure_5km', infra.projects,
        'transmission_line_distance_m', tl.dist,
        -- Viewshafts
        'in_viewshaft', coalesce(vs.in_viewshaft, false),
        'viewshaft_name', vs.viewshaft_name,
        'viewshaft_significance', vs.viewshaft_significance,
        -- Character precincts
        'in_character_precinct', coalesce(cp_flag.in_precinct, false),
        'character_precinct_name', cp_flag.precinct_name,
        -- NEW: Heritage overlay (council district plan)
        'in_heritage_overlay', coalesce(hho.in_overlay, false),
        'heritage_overlay_name', hho.overlay_name,
        'heritage_overlay_type', hho.overlay_type,
        -- NEW: Notable trees within 50m
        'notable_trees_50m', nt.cnt,
        'notable_tree_nearest', nt_nearest.nearest,
        -- NEW: Significant ecological area
        'in_ecological_area', coalesce(sea.in_area, false),
        'ecological_area_name', sea.area_name,
        'ecological_area_type', sea.area_type,
        -- Special character areas
        'in_special_character', coalesce(sca.in_area, false),
        'special_character_name', sca.area_name,
        -- Height variation control
        'height_variation_limit', hvc.height_limit,
        -- Mana whenua sites
        'in_mana_whenua', coalesce(mw.in_site, false),
        'mana_whenua_name', mw.site_name,
        -- Parks
        'park_count_500m', pk_count.cnt,
        'nearest_park_name', pk.site_name,
        'nearest_park_distance_m', pk.dist
      )
      FROM (SELECT 1) x
      LEFT JOIN LATERAL (
        SELECT zone_name, zone_code, category FROM district_plan_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) dpz ON true
      LEFT JOIN LATERAL (
        SELECT height_metres FROM height_controls
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY height_metres DESC LIMIT 1
      ) hc ON true
      -- Is THIS property heritage listed?
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM heritage_sites
          WHERE geom && ST_Expand(addr.geom, 0.0003)
            AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        ) AS listed
      ) hr_flag ON true
      -- Is THIS property on contaminated land register?
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM contaminated_land
          WHERE geom && ST_Expand(addr.geom, 0.0003)
            AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        ) AS listed
      ) cl_flag ON true
      -- Is THIS property an EPB?
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM earthquake_prone_buildings
          WHERE geom && ST_Expand(addr.geom, 0.0003)
            AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        ) AS listed
      ) epb_flag ON true
      -- Resource consents 500m, last 2yr
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM resource_consents
        WHERE geom && ST_Expand(addr.geom, 0.006)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
          AND status ILIKE '%granted%'
      ) rc ON true
      -- Infrastructure projects within 5km
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'name', ip.project_name,
          'sector', ip.sector,
          'status', ip.project_status,
          'value_range', ip.value_range,
          'distance_m', round(ST_Distance(ip.geom::geography, addr.geom::geography)::numeric)
        ) ORDER BY ST_Distance(ip.geom, addr.geom)) AS projects
        FROM infrastructure_projects ip
        WHERE ip.geom IS NOT NULL
          AND ip.geom && ST_Expand(addr.geom, 0.05)
          AND ST_DWithin(ip.geom::geography, addr.geom::geography, 5000)
      ) infra ON true
      -- Nearest transmission line
      LEFT JOIN LATERAL (
        SELECT round(ST_Distance(geom::geography, addr.geom::geography)::numeric) AS dist
        FROM transmission_lines
        WHERE geom && ST_Expand(addr.geom, 0.003)
          AND ST_DWithin(geom::geography, addr.geom::geography, 200)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) tl ON true
      -- Viewshaft overlay
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_viewshaft, name AS viewshaft_name, significance AS viewshaft_significance
        FROM viewshafts
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) vs ON true
      -- Character precinct overlay
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_precinct, name AS precinct_name
        FROM character_precincts
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) cp_flag ON true
      -- NEW: Historic heritage overlay (council DP heritage items within 20m)
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_overlay, name AS overlay_name, heritage_type AS overlay_type
        FROM historic_heritage_overlay
        WHERE geom && ST_Expand(addr.geom, 0.0003)
          AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) hho ON true
      -- NEW: Notable trees within 50m (count + nearest)
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM notable_trees
        WHERE geom && ST_Expand(addr.geom, 0.0006)
          AND ST_DWithin(geom::geography, addr.geom::geography, 50)
      ) nt ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'name', name,
          'schedule', schedule,
          'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric)
        ) AS nearest
        FROM notable_trees
        WHERE geom && ST_Expand(addr.geom, 0.001)
          AND ST_DWithin(geom::geography, addr.geom::geography, 100)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) nt_nearest ON true
      -- NEW: Significant ecological area
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_area, name AS area_name, eco_type AS area_type
        FROM significant_ecological_areas
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) sea ON true
      -- Special character areas
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_area, name AS area_name
        FROM special_character_areas
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) sca ON true
      -- Height variation control
      LEFT JOIN LATERAL (
        SELECT height_limit
        FROM height_variation_control
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) hvc ON true
      -- Mana whenua sites
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_site, name AS site_name
        FROM mana_whenua_sites
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) mw ON true
      -- Parks within 500m (count)
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM park_extents
        WHERE geom && ST_Expand(addr.geom, 0.006)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
      ) pk_count ON true
      -- Nearest park
      LEFT JOIN LATERAL (
        SELECT site_name, round(ST_Distance(geom::geography, addr.geom::geography)::numeric) AS dist
        FROM park_extents
        WHERE geom && ST_Expand(addr.geom, 0.01)
          AND ST_DWithin(geom::geography, addr.geom::geography, 1000)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) pk ON true
    ),

    -- COMPARISONS (suburb + city averages for comparison bars)
    'comparisons', (
      SELECT jsonb_build_object(
        'suburb', (
          SELECT jsonb_build_object(
            'label', sc.sa2_name,
            'avg_nzdep', sc.avg_nzdep,
            'school_count_1500m', sc.school_count_1500m,
            'transit_count_400m', sc.transit_count_400m,
            'max_noise_db', sc.max_noise_db,
            'epb_count_300m', sc.epb_count_300m
          )
          FROM mv_sa2_comparisons sc
          WHERE sc.sa2_code = v_sa2_code
        ),
        'city', (
          SELECT jsonb_build_object(
            'label', tc.ta_name,
            'avg_nzdep', tc.avg_nzdep,
            'avg_school_count_1500m', tc.avg_school_count_1500m,
            'avg_transit_count_400m', tc.avg_transit_count_400m,
            'avg_noise_db', tc.avg_noise_db,
            'avg_epb_count_300m', tc.avg_epb_count_300m
          )
          FROM mv_ta_comparisons tc
          WHERE tc.ta_name = v_ta_name
        )
      )
    ),

    -- MARKET (SA2-level rental data + trends + HPI)
    'market', (
      SELECT jsonb_build_object(
        'sa2_code', v_sa2_code,
        'sa2_name', v_sa2_name,
        'rental_overview', rental_ov.data,
        'trends', trends.data,
        'hpi_latest', hpi.data
      )
      FROM (SELECT 1) x
      -- Latest quarter rental overview for this SA2 (ALL types + ALL beds)
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'dwelling_type', dwelling_type,
          'beds', number_of_beds,
          'median', median_rent,
          'lq', lower_quartile_rent,
          'uq', upper_quartile_rent,
          'bonds', total_bonds,
          'yoy_pct', yoy_pct
        )) AS data
        FROM mv_rental_market
        WHERE sa2_code = v_sa2_code
      ) rental_ov ON true
      -- Trends for this SA2
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'dwelling_type', dwelling_type,
          'beds', number_of_beds,
          'current_median', current_median,
          'yoy_pct', yoy_pct,
          'cagr_3yr', cagr_3yr,
          'cagr_5yr', cagr_5yr,
          'cagr_10yr', cagr_10yr
        )) AS data
        FROM mv_rental_trends
        WHERE sa2_code = v_sa2_code
      ) trends ON true
      -- National HPI (latest quarter)
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'quarter', quarter_end,
          'hpi', house_price_index,
          'sales', house_sales,
          'stock_value_m', housing_stock_value_m
        ) AS data
        FROM hpi_national
        ORDER BY quarter_end DESC LIMIT 1
      ) hpi ON true
    )

  );

  RETURN result;
END;
$$;
