-- Migration 0009: Fix column name mismatches in get_property_report()
-- Fixes: air_quality pm10_avg, water_quality mci_score, crime table→mv_crime_density,
--        schools columns, transit_stops mode_type, crashes severity, structural corruption

DROP FUNCTION IF EXISTS get_property_report(bigint);
CREATE OR REPLACE FUNCTION get_property_report(p_address_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  addr RECORD;
  result jsonb;
  v_sa2_code TEXT;
  v_sa2_name TEXT;
  v_ta_name  TEXT;
  v_cbd_point geometry;
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

  -- 3. Region-aware CBD point
  v_cbd_point := CASE
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%auckland%'
      THEN ST_SetSRID(ST_MakePoint(174.7685, -36.8442), 4326)  -- Britomart
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%christchurch%'
      THEN ST_SetSRID(ST_MakePoint(172.6362, -43.5321), 4326)  -- Cathedral Square
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%hamilton%'
      THEN ST_SetSRID(ST_MakePoint(175.2793, -37.7870), 4326)  -- Garden Place
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%tauranga%'
      THEN ST_SetSRID(ST_MakePoint(176.1654, -37.6878), 4326)  -- CBD
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%dunedin%'
      THEN ST_SetSRID(ST_MakePoint(170.5036, -45.8788), 4326)  -- Octagon
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%napier%'
      THEN ST_SetSRID(ST_MakePoint(176.9120, -39.4928), 4326)  -- Napier CBD
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%hastings%'
      THEN ST_SetSRID(ST_MakePoint(176.8418, -39.6381), 4326)  -- Hastings CBD
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%nelson%'
      THEN ST_SetSRID(ST_MakePoint(173.2840, -41.2706), 4326)  -- Nelson CBD
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%invercargill%'
      THEN ST_SetSRID(ST_MakePoint(168.3538, -46.4132), 4326)  -- Invercargill CBD
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%queenstown%'
      THEN ST_SetSRID(ST_MakePoint(168.6626, -45.0312), 4326)  -- Queenstown CBD
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%rotorua%'
      THEN ST_SetSRID(ST_MakePoint(176.2497, -38.1368), 4326)  -- Rotorua CBD
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%new plymouth%'
      THEN ST_SetSRID(ST_MakePoint(174.0752, -39.0556), 4326)  -- New Plymouth CBD
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%whangarei%' OR lower(coalesce(addr.town_city, '')) LIKE '%whang%rei%'
      THEN ST_SetSRID(ST_MakePoint(174.3234, -35.7251), 4326)  -- Whangarei CBD
    WHEN lower(coalesce(addr.town_city, '')) LIKE '%palmerston%'
      THEN ST_SetSRID(ST_MakePoint(175.6113, -40.3523), 4326)  -- Palmerston North CBD
    WHEN lower(coalesce(v_ta_name, '')) LIKE '%auckland%'
      THEN ST_SetSRID(ST_MakePoint(174.7685, -36.8442), 4326)
    WHEN lower(coalesce(v_ta_name, '')) LIKE '%christchurch%'
      THEN ST_SetSRID(ST_MakePoint(172.6362, -43.5321), 4326)
    ELSE ST_SetSRID(ST_MakePoint(174.7762, -41.2865), 4326)    -- Wellington (default)
  END;

  -- 4. Build report
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
        'number_owners', pt.number_owners,
        'capital_value', cv.capital_value,
        'improvements_value', cv.improvements_value,
        'land_value', cv.land_value,
        'valuation_date', cv.valuation_date,
        'multi_unit', mu.addr_count > 4 OR addr.unit_value IS NOT NULL
      )
      FROM (SELECT 1) x
      LEFT JOIN LATERAL (
        SELECT round(ST_Area(geom::geography)::numeric, 1) AS footprint_sqm, "use" AS building_use FROM building_outlines
        WHERE geom && ST_Expand(addr.geom, 0.0002)
          AND ST_DWithin(geom::geography, addr.geom::geography, 15)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) bo ON true
      LEFT JOIN LATERAL (
        SELECT title_no, estate_description, number_owners FROM property_titles
        WHERE geom && ST_Expand(addr.geom, 0.0003)
          AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) pt ON true
      LEFT JOIN LATERAL (
        SELECT capital_value, improvements_value, land_value, valuation_date
        FROM council_valuations
        WHERE geom && ST_Expand(addr.geom, 0.0003)
          AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) cv ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS addr_count
        FROM addresses a2
        WHERE a2.geom && ST_Expand(addr.geom, 0.0001)
          AND ST_DWithin(a2.geom::geography, addr.geom::geography, 5)
      ) mu ON true
    ),

    -- HAZARDS (split into two jsonb_build_object calls to stay under 100-arg PG limit)
    'hazards', (
      SELECT jsonb_build_object(
        'flood_zone', fz.label,
        'flood_zone_title', fz.title,
        'flood_zone_hectares', fz.hectares,
        'tsunami_zone_class', tz.zone_class,
        'tsunami_evac_zone', tz.evac_zone,
        'liquefaction', lz.liquefaction,
        'slope_failure', sf.severity,
        'earthquake_count_30km', eq.cnt,
        'earthquake_max_mag', eq.max_mag,
        'wind_zone_speed', wz.wind_speed_zone,
        'wildfire_risk', wf.risk_level,
        'wildfire_days', wf.days,
        'noise_db', nc.laeq24h,
        'epb_count_300m', ep.cnt,
        'air_quality_site', aq.site_name,
        'air_quality_pm10_trend', aq.pm10_trend,
        'water_quality_site', wq.site_name,
        'water_quality_ecoli_band', wq.ecoli_band,
        'water_quality_nitrate_band', wq.nitrate_band,
        'water_quality_clarity_band', wq.clarity_band,
        'coastal_erosion', ce.sensitivity,
        'coastal_erosion_detail', ce.detail,
        'contam_nearest', cn.site_name,
        'contam_nearest_category', cn.category,
        'contam_nearest_distance_m', cn.dist,
        'climate_temp_change', cl.temp_change,
        'climate_rainfall_change', cl.rainfall_change
      ) || jsonb_build_object(
        -- Regional hazard layers (source_council-based)
        'earthquake_hazard_index', eh.chi,
        'earthquake_hazard_grade', eh.chi_hazard_grade,
        'ground_shaking_zone', gs.zone,
        'ground_shaking_severity', gs.severity,
        'gwrc_liquefaction', lq.liquefaction,
        'gwrc_liquefaction_geology', lq.simplified,
        'gwrc_slope_severity', sfx.severity,
        'slope_failure_type', sfx.lskey,
        'fault_zone_name', fzn.name,
        'fault_zone_ranking', fzn.hazard_ranking,
        'wcc_flood_type', fh.hazard_type,
        'wcc_flood_ranking', fh.hazard_ranking,
        'wcc_tsunami_return_period', th.return_period,
        'wcc_tsunami_ranking', th.hazard_ranking,
        'solar_mean_kwh', sol.mean_yearly_solar,
        'solar_max_kwh', sol.max_yearly_solar,
        'landslide_in_area', ls_area.in_area,
        'landslide_events_1km', ls_evt.cnt,
        -- GNS active faults
        'active_fault_nearest', af.fault_data,
        'fault_avoidance_zone', faz.zone_data,
        -- Flood extent (AEP-based)
        'flood_extent_aep', fe.aep,
        'flood_extent_label', fe.label,
        -- Coastal elevation
        'coastal_elevation_cm', celev.gridcode,
        -- Aircraft noise overlay
        'aircraft_noise_name', ano.name,
        'aircraft_noise_dba', ano.noise_level_dba,
        'aircraft_noise_category', ano.noise_category,
        -- Overland flow path proximity
        'overland_flow_within_50m', ofp.nearby,
        -- Council coastal erosion (Auckland ASCIE etc.)
        'council_coastal_erosion', cce.erosion_data
      )
      FROM (SELECT 1) x
      -- National hazard layers
      LEFT JOIN LATERAL (
        SELECT label, title, hectares FROM flood_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) fz ON true
      LEFT JOIN LATERAL (
        SELECT zone_class, evac_zone FROM tsunami_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) tz ON true
      LEFT JOIN LATERAL (
        SELECT liquefaction FROM liquefaction_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) lz ON true
      LEFT JOIN LATERAL (
        SELECT zone_name AS wind_speed_zone FROM wind_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) wz ON true
      LEFT JOIN LATERAL (
        SELECT severity FROM slope_failure_zones
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY CASE severity WHEN 'Very High' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END
        LIMIT 1
      ) sf ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt, MAX(magnitude) AS max_mag FROM earthquakes
        WHERE ST_DWithin(geom::geography, addr.geom::geography, 30000)
      ) eq ON true
      LEFT JOIN LATERAL (
        SELECT quantile AS risk_level, ten_year_mean AS days FROM wildfire_risk
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) wf ON true
      LEFT JOIN LATERAL (
        SELECT laeq24h FROM noise_contours
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY laeq24h DESC LIMIT 1
      ) nc ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM earthquake_prone_buildings
        WHERE geom && ST_Expand(addr.geom, 0.004)
          AND ST_DWithin(geom::geography, addr.geom::geography, 300)
      ) ep ON true
      -- FIX: removed pm10_avg (doesn't exist), only select pm10_trend
      LEFT JOIN LATERAL (
        SELECT site_name, pm10_trend
        FROM air_quality_sites
        WHERE geom && ST_Expand(addr.geom, 0.1)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) aq ON true
      -- FIX: removed mci_score (doesn't exist), added nitrate_band + clarity_band
      LEFT JOIN LATERAL (
        SELECT site_name, ecoli_band, nitrate_band, clarity_band
        FROM water_quality_sites
        WHERE geom && ST_Expand(addr.geom, 0.05)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) wq ON true
      LEFT JOIN LATERAL (
        SELECT exposure AS sensitivity, jsonb_build_object('shore_type', shore_type, 'csi', csi_in) AS detail
        FROM coastal_erosion
        WHERE source_council IS NULL
          AND geom && ST_Expand(addr.geom, 0.01)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) ce ON true
      LEFT JOIN LATERAL (
        SELECT site_name, category, round(ST_Distance(geom::geography, addr.geom::geography)::numeric) AS dist
        FROM contaminated_land
        WHERE geom && ST_Expand(addr.geom, 0.01)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) cn ON true
      LEFT JOIN LATERAL (
        SELECT
          cp."T_value_change" AS temp_change,
          cp."PR_value_change" AS rainfall_change
        FROM climate_grid cg
        JOIN climate_projections cp ON cp.vcsn_agent = cg.agent_no
        WHERE cg.geom && ST_Expand(addr.geom, 0.05)
          AND cp.scenario = 'RCP4.5' AND cp.season = 'Annual'
          AND cp.future_period LIKE '2031%'
        ORDER BY cg.geom <-> addr.geom LIMIT 1
      ) cl ON true
      -- Regional hazard layers (multi-council)
      LEFT JOIN LATERAL (
        SELECT chi, chi_hazard_grade FROM earthquake_hazard
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) eh ON true
      LEFT JOIN LATERAL (
        SELECT zone, severity FROM ground_shaking
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) gs ON true
      LEFT JOIN LATERAL (
        SELECT liquefaction, simplified FROM liquefaction_detail
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) lq ON true
      LEFT JOIN LATERAL (
        SELECT severity, lskey FROM slope_failure
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY CASE severity WHEN 'Very High' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END
        LIMIT 1
      ) sfx ON true
      LEFT JOIN LATERAL (
        SELECT name, hazard_ranking FROM fault_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) fzn ON true
      LEFT JOIN LATERAL (
        SELECT hazard_type, hazard_ranking FROM flood_hazard
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) fh ON true
      LEFT JOIN LATERAL (
        SELECT return_period, hazard_ranking FROM tsunami_hazard
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) th ON true
      LEFT JOIN LATERAL (
        SELECT mean_yearly_solar, max_yearly_solar FROM wcc_solar_radiation
        WHERE geom && ST_Expand(addr.geom, 0.0002)
          AND ST_DWithin(geom::geography, addr.geom::geography, 15)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) sol ON true
      -- Landslide areas (GNS polygon)
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM landslide_areas
          WHERE geom && ST_Expand(addr.geom, 0.001)
            AND ST_Intersects(geom, addr.geom)
        ) AS in_area
      ) ls_area ON true
      -- Landslide events (GNS points) within 1km
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM landslide_events
        WHERE geom && ST_Expand(addr.geom, 0.01)
          AND ST_DWithin(geom::geography, addr.geom::geography, 1000)
      ) ls_evt ON true
      -- GNS active faults: nearest within 2km
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'fault_name', fault_name,
          'fault_class', fault_class,
          'slip_rate_mm_yr', slip_rate_mm_yr,
          'recurrence_interval', recurrence_interval,
          'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric)
        ) AS fault_data
        FROM active_faults
        WHERE geom && ST_Expand(addr.geom, 0.02)
          AND ST_DWithin(geom::geography, addr.geom::geography, 2000)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) af ON true
      -- Fault avoidance zone containment
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'fault_name', fault_name,
          'zone_type', zone_type,
          'fault_class', fault_class,
          'setback_m', setback_m
        ) AS zone_data
        FROM fault_avoidance_zones
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) faz ON true
      -- Flood extent (AEP)
      LEFT JOIN LATERAL (
        SELECT aep, label FROM flood_extent
        WHERE ST_Intersects(geom, addr.geom)
        ORDER BY aep::numeric LIMIT 1
      ) fe ON true
      -- Coastal elevation
      LEFT JOIN LATERAL (
        SELECT gridcode FROM coastal_elevation
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) celev ON true
      -- Aircraft noise overlay
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
          v_cbd_point::geography
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
        -- Transit mode breakdown (800m) — union of Metlink + AT stops
        'bus_stops_800m', coalesce(ml.bus_count, 0) + coalesce(at_ml.bus_count, 0),
        'rail_stops_800m', coalesce(ml.rail_count, 0) + coalesce(at_ml.rail_count, 0),
        'ferry_stops_800m', coalesce(ml.ferry_count, 0) + coalesce(at_ml.ferry_count, 0),
        'cable_car_stops_800m', coalesce(ml.cable_car_count, 0),
        -- Transit travel times (AM + PM) — coalesce Metlink or AT
        'transit_travel_times', coalesce(tt.times, at_tt.times),
        'transit_travel_times_pm', coalesce(tt_pm.times, at_tt_pm.times),
        -- Peak frequency — coalesce Metlink or AT
        'peak_trips_per_hour', coalesce(tf.peak_trips_per_hour, at_tf.peak_trips_per_hour),
        'nearest_stop_name', coalesce(tf.stop_name, at_tf.stop_name)
      )
      FROM (SELECT 1) x
      -- NZDep
      LEFT JOIN LATERAL (
        SELECT nd2.nzdep2023 FROM meshblocks mb
        JOIN nzdep nd2 ON nd2.mb2023_code = mb.mb2023_code
        WHERE ST_Within(addr.geom, mb.geom) LIMIT 1
      ) nd ON true
      -- FIX: Crime — use mv_crime_density (has percentile_rank, ta) + mv_crime_ta for city aggs
      LEFT JOIN LATERAL (
        SELECT
          mcd.area_unit AS crime_area_unit,
          mcd.victimisations_3yr AS crime_victimisations,
          mcd.percentile_rank,
          ta_agg.victimisations_3yr AS city_total_vics,
          ta_agg.median_victimisations_per_au AS city_median_vics,
          ta_agg.area_count AS city_area_count
        FROM mv_crime_density mcd
        LEFT JOIN mv_crime_ta ta_agg ON ta_agg.ta = mcd.ta
        WHERE (
          mcd.area_unit ILIKE '%' || coalesce(v_sa2_name, '') || '%'
          OR mcd.area_unit ILIKE '%' || coalesce(addr.suburb_locality, '') || '%'
        )
        ORDER BY mcd.victimisations_3yr DESC LIMIT 1
      ) cd ON true
      -- FIX: Schools — org_name, org_type, eqi_index, total_roll (no decile)
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'name', s.org_name,
          'type', s.org_type,
          'roll', s.total_roll,
          'authority', s.authority,
          'distance_m', round(ST_Distance(s.geom::geography, addr.geom::geography)::numeric),
          'in_zone', coalesce(sz_flag.in_zone, false),
          'eqi', s.eqi_index
        ) ORDER BY ST_Distance(s.geom, addr.geom)) AS schools
        FROM schools s
        LEFT JOIN LATERAL (
          SELECT EXISTS(
            SELECT 1 FROM school_zones sz
            WHERE sz.school_id = s.school_id
              AND ST_Within(addr.geom, sz.geom)
          ) AS in_zone
        ) sz_flag ON true
        WHERE s.geom && ST_Expand(addr.geom, 0.015)
          AND ST_DWithin(s.geom::geography, addr.geom::geography, 1500)
      ) sch ON true
      -- Transit stops (400m) — count from generic transit_stops table
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS stop_count FROM transit_stops
        WHERE geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(geom::geography, addr.geom::geography, 400)
      ) ts ON true
      -- FIX: Transit stop list — removed mode_type (doesn't exist on transit_stops),
      -- use location_type to infer mode (1=station→train, 0=stop→bus)
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'name', tsl.stop_name, 'distance_m', round(tsl.dist::numeric),
          'mode', CASE WHEN tsl.location_type = 1 THEN 'train' ELSE 'bus' END
        ) ORDER BY tsl.dist) AS stops
        FROM (
          SELECT stop_name, location_type, ST_Distance(geom::geography, addr.geom::geography) AS dist
          FROM transit_stops
          WHERE geom && ST_Expand(addr.geom, 0.005)
            AND ST_DWithin(geom::geography, addr.geom::geography, 400)
          ORDER BY geom <-> addr.geom LIMIT 10
        ) tsl
      ) ts_list ON true
      -- FIX: Nearest train station — use location_type = 1 (station) instead of mode_type
      LEFT JOIN LATERAL (
        SELECT stop_name, ST_Distance(geom::geography, addr.geom::geography) AS train_dist
        FROM transit_stops
        WHERE location_type = 1
          AND geom && ST_Expand(addr.geom, 0.05)
          AND ST_DWithin(geom::geography, addr.geom::geography, 5000)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) tr ON true
      -- FIX: Crashes — crash_severity (not severity), values "Serious Crash"/"Fatal Crash"
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE crash_severity = 'Serious Crash')::int AS serious_count,
          COUNT(*) FILTER (WHERE crash_severity = 'Fatal Crash')::int AS fatal_count,
          COUNT(*)::int AS total_count
        FROM crashes
        WHERE geom && ST_Expand(addr.geom, 0.004)
          AND ST_DWithin(geom::geography, addr.geom::geography, 300)
      ) cr ON true
      -- Heritage count (500m)
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM heritage_sites
        WHERE geom && ST_Expand(addr.geom, 0.006)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
      ) hr ON true
      -- Amenities summary (500m)
      LEFT JOIN LATERAL (
        SELECT jsonb_object_agg(sub.subcategory, sub.cnt) AS amenity_summary
        FROM (
          SELECT subcategory, COUNT(*)::int AS cnt FROM osm_amenities
          WHERE geom && ST_Expand(addr.geom, 0.006)
            AND ST_DWithin(geom::geography, addr.geom::geography, 500)
          GROUP BY subcategory
        ) sub
      ) am ON true
      -- Nearest essentials
      LEFT JOIN LATERAL (
        SELECT
          (SELECT jsonb_build_object('name', name, 'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric), 'latitude', ST_Y(geom), 'longitude', ST_X(geom))
           FROM osm_amenities WHERE subcategory = 'supermarket'
             AND geom && ST_Expand(addr.geom, 0.02)
           ORDER BY geom <-> addr.geom LIMIT 1) AS supermarket,
          (SELECT jsonb_build_object('name', name, 'distance_m', round(ST_Distance(geom::geography, addr.geom::geography)::numeric), 'latitude', ST_Y(geom), 'longitude', ST_X(geom))
           FROM osm_amenities WHERE subcategory = 'gp'
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
      -- Metlink stops breakdown by mode (800m) — Wellington region
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
      -- AT stops breakdown by mode (800m) — Auckland region
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE 3 = ANY(route_types))::int AS bus_count,
          COUNT(*) FILTER (WHERE 2 = ANY(route_types))::int AS rail_count,
          COUNT(*) FILTER (WHERE 4 = ANY(route_types))::int AS ferry_count
        FROM at_stops
        WHERE geom && ST_Expand(addr.geom, 0.01)
          AND ST_DWithin(geom::geography, addr.geom::geography, 800)
      ) at_ml ON true
      -- Metlink travel times: AM peak
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
            AND ttt.peak_window = 'am'
          ORDER BY ttt.destination, ttt.min_minutes
        ) best
      ) tt ON true
      -- Metlink travel times: PM peak
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
            AND ttt.peak_window = 'pm'
          ORDER BY ttt.destination, ttt.min_minutes
        ) best
      ) tt_pm ON true
      -- AT travel times: AM peak
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'destination', best.destination,
          'minutes', best.min_minutes,
          'routes', best.route_names
        ) ORDER BY best.min_minutes) AS times
        FROM (
          SELECT DISTINCT ON (att.destination)
            att.destination, att.min_minutes, att.route_names
          FROM at_stops ats
          JOIN at_travel_times att ON att.stop_id = ats.stop_id
          WHERE ats.geom && ST_Expand(addr.geom, 0.005)
            AND ST_DWithin(ats.geom::geography, addr.geom::geography, 400)
            AND att.peak_window = 'am'
          ORDER BY att.destination, att.min_minutes
        ) best
      ) at_tt ON true
      -- AT travel times: PM peak
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'destination', best.destination,
          'minutes', best.min_minutes,
          'routes', best.route_names
        ) ORDER BY best.min_minutes) AS times
        FROM (
          SELECT DISTINCT ON (att.destination)
            att.destination, att.min_minutes, att.route_names
          FROM at_stops ats
          JOIN at_travel_times att ON att.stop_id = ats.stop_id
          WHERE ats.geom && ST_Expand(addr.geom, 0.005)
            AND ST_DWithin(ats.geom::geography, addr.geom::geography, 400)
            AND att.peak_window = 'pm'
          ORDER BY att.destination, att.min_minutes
        ) best
      ) at_tt_pm ON true
      -- Metlink peak frequency at busiest nearby stop
      LEFT JOIN LATERAL (
        SELECT tsf.peak_trips_per_hour, ms2.stop_name
        FROM metlink_stops ms2
        JOIN transit_stop_frequency tsf ON tsf.stop_id = ms2.stop_id
        WHERE ms2.geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(ms2.geom::geography, addr.geom::geography, 400)
        ORDER BY tsf.peak_trips_per_hour DESC
        LIMIT 1
      ) tf ON true
      -- AT peak frequency at busiest nearby stop
      LEFT JOIN LATERAL (
        SELECT atsf.peak_trips_per_hour, ats2.stop_name
        FROM at_stops ats2
        JOIN at_stop_frequency atsf ON atsf.stop_id = ats2.stop_id
        WHERE ats2.geom && ST_Expand(addr.geom, 0.005)
          AND ST_DWithin(ats2.geom::geography, addr.geom::geography, 400)
        ORDER BY atsf.peak_trips_per_hour DESC
        LIMIT 1
      ) at_tf ON true
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
        -- Historic heritage overlay (council-level, Auckland etc.)
        'in_heritage_overlay', coalesce(hho.in_overlay, false),
        'heritage_overlay_name', hho.overlay_name,
        -- Special character area
        'in_special_character', coalesce(sca.in_area, false),
        'special_character_name', sca.area_name,
        -- Significant ecological area
        'in_ecological_area', coalesce(sea.in_area, false),
        'ecological_area_name', sea.area_name,
        'ecological_area_type', sea.eco_type,
        -- Height variation control (Auckland)
        'height_variation_limit', hvc.height_limit,
        -- Notable trees nearby
        'notable_trees_50m', nt.cnt,
        -- Mana whenua sites
        'in_mana_whenua', coalesce(mw.in_site, false),
        'mana_whenua_name', mw.site_name,
        -- Nearest park
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
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM heritage_sites
          WHERE geom && ST_Expand(addr.geom, 0.0003)
            AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        ) AS listed
      ) hr_flag ON true
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM contaminated_land
          WHERE geom && ST_Expand(addr.geom, 0.0003)
            AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        ) AS listed
      ) cl_flag ON true
      LEFT JOIN LATERAL (
        SELECT EXISTS(
          SELECT 1 FROM earthquake_prone_buildings
          WHERE geom && ST_Expand(addr.geom, 0.0003)
            AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        ) AS listed
      ) epb_flag ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM resource_consents
        WHERE geom && ST_Expand(addr.geom, 0.006)
          AND ST_DWithin(geom::geography, addr.geom::geography, 500)
          AND status ILIKE '%granted%'
      ) rc ON true
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
      LEFT JOIN LATERAL (
        SELECT round(ST_Distance(geom::geography, addr.geom::geography)::numeric) AS dist
        FROM transmission_lines
        WHERE geom && ST_Expand(addr.geom, 0.003)
          AND ST_DWithin(geom::geography, addr.geom::geography, 200)
        ORDER BY geom <-> addr.geom LIMIT 1
      ) tl ON true
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_viewshaft, name AS viewshaft_name, significance AS viewshaft_significance
        FROM viewshafts
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) vs ON true
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_precinct, name AS precinct_name
        FROM character_precincts
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) cp_flag ON true
      -- Historic heritage overlay (council Unitary Plan overlays)
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_overlay, name AS overlay_name
        FROM historic_heritage_overlay
        WHERE geom && ST_Expand(addr.geom, 0.0003)
          AND ST_DWithin(geom::geography, addr.geom::geography, 20)
        LIMIT 1
      ) hho ON true
      -- Special character area
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_area, name AS area_name
        FROM special_character_areas
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) sca ON true
      -- Significant ecological area
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_area, name AS area_name, eco_type
        FROM significant_ecological_areas
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) sea ON true
      -- Height variation control
      LEFT JOIN LATERAL (
        SELECT height_limit
        FROM height_variation_control
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) hvc ON true
      -- Notable trees within 50m
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM notable_trees
        WHERE geom && ST_Expand(addr.geom, 0.001)
          AND ST_DWithin(geom::geography, addr.geom::geography, 50)
      ) nt ON true
      -- Mana whenua sites
      LEFT JOIN LATERAL (
        SELECT TRUE AS in_site, name AS site_name
        FROM mana_whenua_sites
        WHERE ST_Intersects(geom, addr.geom) LIMIT 1
      ) mw ON true
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
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'quarter', quarter_end,
          'index', house_price_index
        ) AS data
        FROM rbnz_housing
        ORDER BY quarter_end DESC LIMIT 1
      ) hpi ON true
    )

  );

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
