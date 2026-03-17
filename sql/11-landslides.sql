-- GNS NZ Landslide Database (NZLD) — Wellington region
-- Source: maps.gns.cri.nz WFS
-- 628 point events + 157 polygon outlines
-- License: CC BY 4.0

-- Point events (documented historical landslides)
CREATE TABLE IF NOT EXISTS landslide_events (
  id SERIAL PRIMARY KEY,
  gns_landslide_id INTEGER,
  name TEXT,
  time_of_occurrence DATE,
  damage_description TEXT,
  size_category INTEGER,       -- 1=small, 2=moderate, 3=large
  trigger_name TEXT,           -- Rainfall, Earthquake, unknown, other
  severity_name TEXT,          -- small, moderate, large, unknown
  debris_type_name TEXT,       -- Chaotic, etc.
  material_type_name TEXT,     -- Soil, Rock, etc.
  movement_type_name TEXT,     -- Translational slide, Flow, Fall, etc.
  activity_name TEXT,          -- active, dormant, etc.
  aspect_name TEXT,            -- N, S, E, W, etc.
  data_source_name TEXT,
  geom GEOMETRY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_landslide_events_geom ON landslide_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_landslide_events_trigger ON landslide_events (trigger_name);

-- Polygon outlines (mapped landslide areas)
CREATE TABLE IF NOT EXISTS landslide_areas (
  id SERIAL PRIMARY KEY,
  gns_feature_id INTEGER,
  gns_landslide_id INTEGER,
  name TEXT,
  feature_type TEXT,           -- "Landslide area (outline)"
  geom GEOMETRY(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS idx_landslide_areas_geom ON landslide_areas USING GIST (geom);
