-- 0017_add_source_council_columns.sql
-- Add source_council TEXT column to national-schema tables that are now
-- also populated by council-specific loaders via _load_council_arcgis.
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).

-- Wrap each ALTER in a DO block so missing tables don't abort the migration
DO $$ BEGIN ALTER TABLE active_faults ADD COLUMN IF NOT EXISTS source_council TEXT; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE active_folds ADD COLUMN IF NOT EXISTS source_council TEXT; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tsunami_zones ADD COLUMN IF NOT EXISTS source_council TEXT; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE heritage_sites ADD COLUMN IF NOT EXISTS source_council TEXT; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE flood_zones ADD COLUMN IF NOT EXISTS source_council TEXT; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE liquefaction_zones ADD COLUMN IF NOT EXISTS source_council TEXT; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE noise_contours ADD COLUMN IF NOT EXISTS source_council TEXT; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE contaminated_land ADD COLUMN IF NOT EXISTS source_council TEXT; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Create tables for DOC data loaders
CREATE TABLE IF NOT EXISTS doc_huts (
    id SERIAL PRIMARY KEY,
    name TEXT,
    status TEXT,
    category TEXT,
    equipment TEXT,
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_doc_huts_geom ON doc_huts USING GIST(geom);

CREATE TABLE IF NOT EXISTS doc_tracks (
    id SERIAL PRIMARY KEY,
    name TEXT,
    status TEXT,
    category TEXT,
    track_type TEXT,
    url TEXT,
    geom GEOMETRY(MultiLineString, 4326)
);
CREATE INDEX IF NOT EXISTS idx_doc_tracks_geom ON doc_tracks USING GIST(geom);

CREATE TABLE IF NOT EXISTS doc_campsites (
    id SERIAL PRIMARY KEY,
    name TEXT,
    status TEXT,
    category TEXT,
    equipment TEXT,
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_doc_campsites_geom ON doc_campsites USING GIST(geom);
