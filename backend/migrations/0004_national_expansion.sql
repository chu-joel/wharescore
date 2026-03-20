-- 0004_national_expansion.sql
-- National data expansion: rename Wellington-specific tables to generic names,
-- add source_council column, create GNS active faults table.
--
-- All DDL is inside DO blocks with EXECUTE so that table renames are visible
-- to subsequent statements within the same transaction.

DO $$
BEGIN
  -- 1. Rename Wellington-specific tables to generic national names
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gwrc_earthquake_hazard') THEN
    EXECUTE 'ALTER TABLE gwrc_earthquake_hazard RENAME TO earthquake_hazard';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gwrc_ground_shaking') THEN
    EXECUTE 'ALTER TABLE gwrc_ground_shaking RENAME TO ground_shaking';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gwrc_liquefaction') THEN
    EXECUTE 'ALTER TABLE gwrc_liquefaction RENAME TO liquefaction_detail';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gwrc_slope_failure') THEN
    EXECUTE 'ALTER TABLE gwrc_slope_failure RENAME TO slope_failure';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wcc_fault_zones') THEN
    EXECUTE 'ALTER TABLE wcc_fault_zones RENAME TO fault_zones';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wcc_flood_hazard') THEN
    EXECUTE 'ALTER TABLE wcc_flood_hazard RENAME TO flood_hazard';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wcc_tsunami_hazard') THEN
    EXECUTE 'ALTER TABLE wcc_tsunami_hazard RENAME TO tsunami_hazard';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gwrc_landslide') THEN
    EXECUTE 'ALTER TABLE gwrc_landslide RENAME TO landslide_susceptibility';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gwrc_flood_extent') THEN
    EXECUTE 'ALTER TABLE gwrc_flood_extent RENAME TO flood_extent';
  END IF;

  -- 2. Add source_council column to all tables
  -- GWRC tables
  EXECUTE 'ALTER TABLE IF EXISTS earthquake_hazard ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE earthquake_hazard SET source_council = ''greater_wellington'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS ground_shaking ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE ground_shaking SET source_council = ''greater_wellington'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS liquefaction_detail ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE liquefaction_detail SET source_council = ''greater_wellington'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS slope_failure ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE slope_failure SET source_council = ''greater_wellington'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS flood_extent ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE flood_extent SET source_council = ''greater_wellington'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS coastal_elevation ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE coastal_elevation SET source_council = ''greater_wellington'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS erosion_prone_land ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE erosion_prone_land SET source_council = ''greater_wellington'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS contaminated_land ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE contaminated_land SET source_council = ''greater_wellington'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS resource_consents ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE resource_consents SET source_council = ''greater_wellington'' WHERE source_council IS NULL';

  -- WCC tables
  EXECUTE 'ALTER TABLE IF EXISTS fault_zones ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE fault_zones SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS flood_hazard ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE flood_hazard SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS tsunami_hazard ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE tsunami_hazard SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS district_plan_zones ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE district_plan_zones SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS height_controls ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE height_controls SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS coastal_inundation ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE coastal_inundation SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS corrosion_zones ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE corrosion_zones SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS viewshafts ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE viewshafts SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS character_precincts ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE character_precincts SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS rail_vibration ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE rail_vibration SET source_council = ''wellington_city'' WHERE source_council IS NULL';
  EXECUTE 'ALTER TABLE IF EXISTS earthquake_prone_buildings ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE earthquake_prone_buildings SET source_council = ''wellington_city'' WHERE source_council IS NULL';

  -- WCC solar
  EXECUTE 'ALTER TABLE IF EXISTS wcc_solar_radiation ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE wcc_solar_radiation SET source_council = ''wellington_city'' WHERE source_council IS NULL';

  -- Metlink
  EXECUTE 'ALTER TABLE IF EXISTS metlink_stops ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE metlink_stops SET source_council = ''greater_wellington'' WHERE source_council IS NULL';

  -- Landslide susceptibility (renamed from gwrc_landslide)
  EXECUTE 'ALTER TABLE IF EXISTS landslide_susceptibility ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'UPDATE landslide_susceptibility SET source_council = ''greater_wellington'' WHERE source_council IS NULL';

  -- GNS landslides (national — leave source_council NULL)
  EXECUTE 'ALTER TABLE IF EXISTS landslide_events ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';
  EXECUTE 'ALTER TABLE IF EXISTS landslide_areas ADD COLUMN IF NOT EXISTS source_council VARCHAR(50)';

  -- 3. Create indexes on source_council
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_earthquake_hazard_council ON earthquake_hazard (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ground_shaking_council ON ground_shaking (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_liquefaction_detail_council ON liquefaction_detail (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_slope_failure_council ON slope_failure (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fault_zones_council ON fault_zones (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_flood_hazard_council ON flood_hazard (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tsunami_hazard_council ON tsunami_hazard (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_flood_extent_council ON flood_extent (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_district_plan_zones_council ON district_plan_zones (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_coastal_inundation_council ON coastal_inundation (source_council)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_landslide_susceptibility_council ON landslide_susceptibility (source_council)';

  -- 4. GNS Active Faults table
  EXECUTE '
    CREATE TABLE IF NOT EXISTS active_faults (
      id SERIAL PRIMARY KEY,
      fault_name TEXT,
      fault_id TEXT,
      fault_class TEXT,
      slip_rate_mm_yr NUMERIC,
      recurrence_interval TEXT,
      last_rupture TEXT,
      fault_type TEXT,
      accuracy TEXT,
      data_source TEXT,
      geom GEOMETRY(MultiLineString, 4326)
    )';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_active_faults_geom ON active_faults USING GIST (geom)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_active_faults_class ON active_faults (fault_class)';

  -- Fault avoidance zones
  EXECUTE '
    CREATE TABLE IF NOT EXISTS fault_avoidance_zones (
      id SERIAL PRIMARY KEY,
      fault_name TEXT,
      fault_id TEXT,
      zone_type TEXT,
      fault_class TEXT,
      setback_m NUMERIC,
      geom GEOMETRY(MultiPolygon, 4326)
    )';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_faz_geom ON fault_avoidance_zones USING GIST (geom)';

  -- 5. Auckland stormwater management area
  EXECUTE '
    CREATE TABLE IF NOT EXISTS stormwater_management_area (
      id SERIAL PRIMARY KEY,
      control_type TEXT,
      area_name TEXT,
      source_council VARCHAR(50) DEFAULT ''auckland'',
      geom GEOMETRY(MultiPolygon, 4326)
    )';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sma_geom ON stormwater_management_area USING GIST (geom)';
END;
$$;
