-- Migration 0023: Universal transit support in property report
--
-- Adds get_transit_data() helper function that queries all transit sources
-- (metlink_stops, at_stops, transit_stops) with COALESCE fallback.
-- The Python layer calls this to overlay transit data onto the report.

-- Add geospatial index on transit_stops if missing
CREATE INDEX IF NOT EXISTS idx_transit_stops_geom ON transit_stops USING GIST (geom);

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

  RETURN jsonb_build_object(
    'bus_stops_800m', bus_count,
    'rail_stops_800m', rail_count,
    'ferry_stops_800m', ferry_count,
    'cable_car_stops_800m', cable_car_count,
    'transit_travel_times', travel_times,
    'peak_trips_per_hour', peak_freq,
    'nearest_stop_name', nearest_stop
  );
END;
$$ LANGUAGE plpgsql;
