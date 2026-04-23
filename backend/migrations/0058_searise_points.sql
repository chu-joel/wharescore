-- 0058_searise_points.sql
-- Creates the searise_points table for per-site NZ SeaRise projections.
-- Populated by backend/scripts/load_searise_points.py from the Zenodo dataset
-- (record 11398538). Empty by default; services/coastal_timeline.py falls
-- back to NATIONAL_SLR national-median averages when the table is empty.

CREATE TABLE IF NOT EXISTS searise_points (
    site_id   INTEGER PRIMARY KEY,
    geom      geometry(Point, 4326) NOT NULL,
    vlm_mm_yr REAL,
    -- projections shape:
    -- {
    --   "SSP126": {"2050": {"median_cm": X, "upper_cm": Y}, "2100": {...}, "2150": {...}},
    --   "SSP245": {...},
    --   "SSP585": {...}
    -- }
    projections JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS searise_points_geom_gix
    ON searise_points USING GIST (geom);
