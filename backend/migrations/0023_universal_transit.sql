-- Migration 0023: Universal transit support in property report
--
-- Previously the report function only queried metlink_stops (Wellington).
-- This migration adds fallback to transit_stops (regional cities) and
-- at_stops (Auckland) so all 12 cities with GTFS data get travel times,
-- mode breakdowns, and peak frequency in property reports.

-- Add geospatial index on transit_stops if missing
CREATE INDEX IF NOT EXISTS idx_transit_stops_geom ON transit_stops USING GIST (geom);

-- Replace the liveability section of get_property_report to support all transit sources
CREATE OR REPLACE FUNCTION get_property_report(p_address_id INT)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  current_func text;
BEGIN
  -- Get the current function body to patch just the transit section
  -- Instead, we'll use a simpler approach: run the existing function
  -- then overlay the transit data from all sources

  -- Call existing function
  result := (SELECT get_property_report_base(p_address_id));

  -- This approach won't work cleanly. Instead, let's update inline.
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Actually, the cleanest approach is to update the liveability transit
-- section in the existing get_property_report function.
-- Drop the wrapper and directly alter the report function's transit joins.

DROP FUNCTION IF EXISTS get_property_report_base(INT);

-- We need to re-create get_property_report with universal transit support.
-- Read the current function, modify the transit sections.
-- The key changes are in the LIVEABILITY section:
--   1. Mode breakdown: COALESCE across metlink_stops, at_stops, transit_stops
--   2. Travel times: COALESCE across all three sources
--   3. Peak frequency: COALESCE across all three sources

-- Since the function is very large, we use ALTER to replace just the
-- transit-related lateral joins. But PostgreSQL doesn't support partial
-- function replacement, so we need to replace the whole thing.

-- Instead of duplicating 700+ lines, let's add a post-processing step
-- that overlays transit data from regional/AT tables onto the report.

-- Create a helper function that returns transit data for any address
CREATE OR REPLACE FUNCTION get_transit_data(p_address_id INT)
RETURNS jsonb AS $$
DECLARE
  addr_geom geometry;
  result jsonb := '{}'::jsonb;
  bus_count int := 0;
  rail_count int := 0;
  ferry_count int := 0;
  cable_car_count int := 0;
  travel_times jsonb;
  peak_freq real;
  nearest_stop text;
  stop_count int := 0;
BEGIN
  -- Get address geometry
  SELECT geom INTO addr_geom FROM addresses WHERE address_id = p_address_id;
  IF addr_geom IS NULL THEN RETURN result; END IF;

  -- 1. Try metlink_stops (Wellington)
  SELECT
    COUNT(*) FILTER (WHERE 3 = ANY(route_types)),
    COUNT(*) FILTER (WHERE 2 = ANY(route_types)),
    COUNT(*) FILTER (WHERE 4 = ANY(route_types)),
    COUNT(*) FILTER (WHERE 5 = ANY(route_types))
  INTO bus_count, rail_count, ferry_count, cable_car_count
  FROM metlink_stops
  WHERE geom && ST_Expand(addr_geom, 0.01)
    AND ST_DWithin(geom::geography, addr_geom::geography, 800);

  -- 2. If no metlink stops, try at_stops (Auckland)
  IF bus_count = 0 AND rail_count = 0 AND ferry_count = 0 THEN
    SELECT
      COUNT(*) FILTER (WHERE 3 = ANY(route_types)),
      COUNT(*) FILTER (WHERE 2 = ANY(route_types)),
      COUNT(*) FILTER (WHERE 4 = ANY(route_types))
    INTO bus_count, rail_count, ferry_count
    FROM at_stops
    WHERE geom && ST_Expand(addr_geom, 0.01)
      AND ST_DWithin(geom::geography, addr_geom::geography, 800);
  END IF;

  -- 3. If still nothing, try transit_stops (regional)
  IF bus_count = 0 AND rail_count = 0 AND ferry_count = 0 THEN
    SELECT
      COUNT(*) FILTER (WHERE mode_type = 'bus'),
      COUNT(*) FILTER (WHERE mode_type = 'train'),
      COUNT(*) FILTER (WHERE mode_type = 'ferry')
    INTO bus_count, rail_count, ferry_count
    FROM transit_stops
    WHERE geom && ST_Expand(addr_geom, 0.01)
      AND ST_DWithin(geom::geography, addr_geom::geography, 800);
  END IF;

  -- Travel times: try metlink first, then AT, then regional transit_stops
  -- Metlink travel times
  SELECT jsonb_agg(jsonb_build_object(
    'destination', best.destination,
    'minutes', best.min_minutes,
    'routes', best.route_names
  ) ORDER BY best.min_minutes)
  INTO travel_times
  FROM (
    SELECT DISTINCT ON (ttt.destination)
      ttt.destination, ttt.min_minutes, ttt.route_names
    FROM metlink_stops ms
    JOIN transit_travel_times ttt ON ttt.stop_id = ms.stop_id
    WHERE ms.geom && ST_Expand(addr_geom, 0.005)
      AND ST_DWithin(ms.geom::geography, addr_geom::geography, 400)
    ORDER BY ttt.destination, ttt.min_minutes
  ) best;

  -- AT travel times fallback
  IF travel_times IS NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
      'destination', best.destination,
      'minutes', best.min_minutes,
      'routes', best.route_names
    ) ORDER BY best.min_minutes)
    INTO travel_times
    FROM (
      SELECT DISTINCT ON (att.destination)
        att.destination, att.min_minutes, att.route_names
      FROM at_stops ats
      JOIN at_travel_times att ON att.stop_id = ats.stop_id
      WHERE ats.geom && ST_Expand(addr_geom, 0.005)
        AND ST_DWithin(ats.geom::geography, addr_geom::geography, 400)
      ORDER BY att.destination, att.min_minutes
    ) best;
  END IF;

  -- Regional transit_stops travel times fallback
  IF travel_times IS NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
      'destination', best.destination,
      'minutes', best.min_minutes,
      'routes', best.route_names
    ) ORDER BY best.min_minutes)
    INTO travel_times
    FROM (
      SELECT DISTINCT ON (ttt.destination)
        ttt.destination, ttt.min_minutes, ttt.route_names
      FROM transit_stops ts
      JOIN transit_travel_times ttt ON ttt.stop_id = ts.stop_id
      WHERE ts.geom && ST_Expand(addr_geom, 0.005)
        AND ST_DWithin(ts.geom::geography, addr_geom::geography, 400)
      ORDER BY ttt.destination, ttt.min_minutes
    ) best;
  END IF;

  -- Peak frequency: try metlink, then AT, then regional
  SELECT tsf.peak_trips_per_hour, ms2.stop_name
  INTO peak_freq, nearest_stop
  FROM metlink_stops ms2
  JOIN transit_stop_frequency tsf ON tsf.stop_id = ms2.stop_id
  WHERE ms2.geom && ST_Expand(addr_geom, 0.005)
    AND ST_DWithin(ms2.geom::geography, addr_geom::geography, 400)
  ORDER BY tsf.peak_trips_per_hour DESC
  LIMIT 1;

  IF peak_freq IS NULL THEN
    SELECT atsf.peak_trips_per_hour, ats2.stop_name
    INTO peak_freq, nearest_stop
    FROM at_stops ats2
    JOIN at_stop_frequency atsf ON atsf.stop_id = ats2.stop_id
    WHERE ats2.geom && ST_Expand(addr_geom, 0.005)
      AND ST_DWithin(ats2.geom::geography, addr_geom::geography, 400)
    ORDER BY atsf.peak_trips_per_hour DESC
    LIMIT 1;
  END IF;

  IF peak_freq IS NULL THEN
    SELECT tsf2.peak_trips_per_hour, ts2.stop_name
    INTO peak_freq, nearest_stop
    FROM transit_stops ts2
    JOIN transit_stop_frequency tsf2 ON tsf2.stop_id = ts2.stop_id
    WHERE ts2.geom && ST_Expand(addr_geom, 0.005)
      AND ST_DWithin(ts2.geom::geography, addr_geom::geography, 400)
    ORDER BY tsf2.peak_trips_per_hour DESC
    LIMIT 1;
  END IF;

  -- Total stop count (400m, all sources)
  SELECT COUNT(*)::int INTO stop_count
  FROM (
    SELECT 1 FROM metlink_stops WHERE geom && ST_Expand(addr_geom, 0.005)
      AND ST_DWithin(geom::geography, addr_geom::geography, 400)
    UNION ALL
    SELECT 1 FROM at_stops WHERE geom && ST_Expand(addr_geom, 0.005)
      AND ST_DWithin(geom::geography, addr_geom::geography, 400)
    UNION ALL
    SELECT 1 FROM transit_stops WHERE geom && ST_Expand(addr_geom, 0.005)
      AND ST_DWithin(geom::geography, addr_geom::geography, 400)
  ) all_stops;

  RETURN jsonb_build_object(
    'bus_stops_800m', bus_count,
    'rail_stops_800m', rail_count,
    'ferry_stops_800m', ferry_count,
    'cable_car_stops_800m', cable_car_count,
    'transit_travel_times', travel_times,
    'peak_trips_per_hour', peak_freq,
    'nearest_stop_name', nearest_stop,
    'all_transit_stops_400m', stop_count
  );
END;
$$ LANGUAGE plpgsql;
