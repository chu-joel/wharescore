#!/usr/bin/env python3
"""
load_srtm_postgis.py — Load SRTM 30m elevation tiles into PostGIS raster table.

Enables SQL-based terrain queries:
  - ST_Value(rast, point)      → elevation at a point
  - ST_Slope(rast)             → slope angle in degrees
  - ST_Aspect(rast)            → compass direction the slope faces

Usage (on Azure VM):
    python backend/scripts/load_srtm_postgis.py

Prerequisites:
    - SRTM .hgt files in /data/valhalla/elevation/srtm/
    - raster2pgsql (installed with PostGIS)
    - psql access to wharescore DB
"""

import glob
import os
import subprocess
import sys

SRTM_DIR = os.environ.get("SRTM_DIR", "/data/valhalla/elevation/srtm")
DB_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/wharescore")
TABLE_NAME = "srtm_elevation"


def main():
    hgt_files = sorted(glob.glob(os.path.join(SRTM_DIR, "*.hgt")))
    if not hgt_files:
        print(f"No .hgt files found in {SRTM_DIR}")
        print("Run setup_valhalla.sh first to download SRTM tiles.")
        sys.exit(1)

    print(f"Found {len(hgt_files)} SRTM tiles in {SRTM_DIR}")

    # ── 1. Enable PostGIS raster extension ──
    print("\n[1/4] Enabling PostGIS raster extension...")
    subprocess.run(
        ["psql", DB_URL, "-c", "CREATE EXTENSION IF NOT EXISTS postgis_raster;"],
        check=True,
    )

    # ── 2. Drop existing table if present ──
    print("[2/4] Dropping existing srtm_elevation table (if any)...")
    subprocess.run(
        ["psql", DB_URL, "-c", f"DROP TABLE IF EXISTS {TABLE_NAME} CASCADE;"],
        check=True,
    )

    # ── 3. Load tiles using raster2pgsql ──
    # -s 4326: WGS84 coordinate system
    # -t 100x100: tile size for efficient spatial queries
    # -C: add raster constraints
    # -I: create spatial index
    # -M: vacuum analyze after load
    # -F: add filename column
    print(f"[3/4] Loading {len(hgt_files)} tiles into PostGIS...")
    print("  This may take a few minutes...\n")

    # Build the raster2pgsql command with all HGT files
    # First file uses -c (create), rest use -a (append)
    for i, hgt_file in enumerate(hgt_files):
        tile_name = os.path.basename(hgt_file)
        mode = "-c" if i == 0 else "-a"

        cmd = f'raster2pgsql -s 4326 -t 100x100 {mode} -F -I "{hgt_file}" {TABLE_NAME} | psql {DB_URL}'

        print(f"  [{i+1}/{len(hgt_files)}] Loading {tile_name}...")
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"    WARNING: Failed to load {tile_name}: {result.stderr[:200]}")
        else:
            # Count lines of output (each = a tile row inserted)
            rows = result.stdout.count("INSERT")
            print(f"    ✓ {rows} raster tiles inserted")

    # ── 4. Add constraints and create helper functions ──
    print("\n[4/4] Creating terrain analysis functions...")
    sql = """
    -- Add raster constraints for query optimization
    SELECT AddRasterConstraints('public', 'srtm_elevation', 'rast');

    -- Vacuum analyze for query planning
    VACUUM ANALYZE srtm_elevation;

    -- Helper: get elevation at a point (meters above sea level)
    CREATE OR REPLACE FUNCTION get_elevation(
        lon double precision,
        lat double precision
    ) RETURNS double precision AS $$
        SELECT ST_Value(rast, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
        FROM srtm_elevation
        WHERE ST_Intersects(rast, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
        LIMIT 1;
    $$ LANGUAGE sql STABLE;

    -- Helper: get slope angle at a point (degrees, 0=flat, 90=vertical)
    CREATE OR REPLACE FUNCTION get_slope_degrees(
        lon double precision,
        lat double precision
    ) RETURNS double precision AS $$
        WITH slope_rast AS (
            SELECT ST_Slope(rast, 1, '32BF', 'DEGREES', 111120) AS rast
            FROM srtm_elevation
            WHERE ST_Intersects(rast, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
            LIMIT 1
        )
        SELECT ST_Value(rast, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
        FROM slope_rast;
    $$ LANGUAGE sql STABLE;

    -- Helper: get aspect at a point (compass degrees, 0=north, 90=east, 180=south, 270=west)
    CREATE OR REPLACE FUNCTION get_aspect(
        lon double precision,
        lat double precision
    ) RETURNS double precision AS $$
        WITH aspect_rast AS (
            SELECT ST_Aspect(rast, 1, '32BF', 'DEGREES', false) AS rast
            FROM srtm_elevation
            WHERE ST_Intersects(rast, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
            LIMIT 1
        )
        SELECT ST_Value(rast, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
        FROM aspect_rast;
    $$ LANGUAGE sql STABLE;

    -- Helper: get terrain summary for a property
    CREATE OR REPLACE FUNCTION get_terrain_summary(
        lon double precision,
        lat double precision
    ) RETURNS TABLE(
        elevation_m double precision,
        slope_degrees double precision,
        aspect_degrees double precision,
        slope_category text,
        aspect_label text
    ) AS $$
        WITH point AS (
            SELECT ST_SetSRID(ST_MakePoint(lon, lat), 4326) AS geom
        ),
        elev AS (
            SELECT ST_Value(r.rast, p.geom) AS elevation_m
            FROM srtm_elevation r, point p
            WHERE ST_Intersects(r.rast, p.geom)
            LIMIT 1
        ),
        slope AS (
            SELECT ST_Value(ST_Slope(r.rast, 1, '32BF', 'DEGREES', 111120), p.geom) AS slope_deg
            FROM srtm_elevation r, point p
            WHERE ST_Intersects(r.rast, p.geom)
            LIMIT 1
        ),
        asp AS (
            SELECT ST_Value(ST_Aspect(r.rast, 1, '32BF', 'DEGREES', false), p.geom) AS aspect_deg
            FROM srtm_elevation r, point p
            WHERE ST_Intersects(r.rast, p.geom)
            LIMIT 1
        )
        SELECT
            elev.elevation_m,
            slope.slope_deg,
            asp.aspect_deg,
            CASE
                WHEN slope.slope_deg IS NULL THEN 'unknown'
                WHEN slope.slope_deg < 2 THEN 'flat'
                WHEN slope.slope_deg < 5 THEN 'gentle'
                WHEN slope.slope_deg < 10 THEN 'moderate'
                WHEN slope.slope_deg < 15 THEN 'steep'
                WHEN slope.slope_deg < 25 THEN 'very steep'
                ELSE 'extreme'
            END AS slope_category,
            CASE
                WHEN asp.aspect_deg IS NULL THEN 'flat'
                WHEN asp.aspect_deg < 22.5 OR asp.aspect_deg >= 337.5 THEN 'north'
                WHEN asp.aspect_deg < 67.5 THEN 'northeast'
                WHEN asp.aspect_deg < 112.5 THEN 'east'
                WHEN asp.aspect_deg < 157.5 THEN 'southeast'
                WHEN asp.aspect_deg < 202.5 THEN 'south'
                WHEN asp.aspect_deg < 247.5 THEN 'southwest'
                WHEN asp.aspect_deg < 292.5 THEN 'west'
                ELSE 'northwest'
            END AS aspect_label
        FROM elev, slope, asp;
    $$ LANGUAGE sql STABLE;
    """

    subprocess.run(["psql", DB_URL, "-c", sql], check=True)

    # ── Done ──
    print("\n=== SRTM elevation data loaded successfully ===")
    print(f"\nTest queries:")
    print(f"  -- Elevation at Wellington CBD:")
    print(f"  SELECT get_elevation(174.7762, -41.2865);")
    print(f"")
    print(f"  -- Slope at a steep Wellington hill:")
    print(f"  SELECT get_slope_degrees(174.7650, -41.3000);")
    print(f"")
    print(f"  -- Full terrain summary:")
    print(f"  SELECT * FROM get_terrain_summary(174.7762, -41.2865);")


if __name__ == "__main__":
    main()
