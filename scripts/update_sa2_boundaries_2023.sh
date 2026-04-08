#!/usr/bin/env bash
# Update sa2_boundaries from 2018 to 2023 (Stats NZ)
#
# WHY: Census 2023 uses 2023 SA2 codes. Our boundaries have 2018 codes.
#      707 of 2,311 census SA2s (30%) don't match — demographics invisible.
#
# PREREQUISITES:
# 1. Download from: https://datafinder.stats.govt.nz/layer/111206-statistical-area-2-2023-clipped-generalised/
#    Format: GeoPackage (.gpkg) — preferred. Or Shapefile.
# 2. SCP the file to the server:
#    scp statistical-area-2-2023-clipped-generalised.gpkg wharescore@20.5.86.126:/tmp/sa2_2023.gpkg
# 3. Run this script on the server:
#    bash scripts/update_sa2_boundaries_2023.sh /tmp/sa2_2023.gpkg

set -euo pipefail

SRC="${1:?Usage: $0 <path-to-gpkg-or-shp>}"
CONTAINER="app-postgres-1"
DB="wharescore"
PSQL="docker exec $CONTAINER psql -U postgres -d $DB"

echo "=== Source file: $SRC ==="

# --- Step 1: Inspect column names ---
echo "=== Inspecting columns ==="
ogrinfo -so "$SRC" 2>/dev/null | head -40 || docker run --rm -v "$(dirname $SRC):/data" osgeo/gdal ogrinfo -so "/data/$(basename $SRC)" | head -40

# --- Step 2: Load into staging table ---
echo "=== Loading into sa2_boundaries_staging ==="
docker cp "$SRC" "$CONTAINER:/tmp/sa2_source"

# Get the layer name
LAYER=$(docker exec "$CONTAINER" ogrinfo -q "/tmp/sa2_source" 2>/dev/null | head -1 | sed 's/^[0-9]*: //' | sed 's/ (.*//')
echo "Layer: $LAYER"

docker exec "$CONTAINER" ogr2ogr \
  -f PostgreSQL \
  "PG:dbname=$DB user=postgres" \
  "/tmp/sa2_source" \
  -nln sa2_boundaries_staging \
  -t_srs EPSG:4326 \
  -lco GEOMETRY_NAME=geom \
  -overwrite \
  -progress

# --- Step 3: Check what columns we got ---
echo "=== Staging table columns ==="
$PSQL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'sa2_boundaries_staging' ORDER BY ordinal_position;"
$PSQL -c "SELECT COUNT(*) AS staging_count FROM sa2_boundaries_staging;"

# --- Step 4: Standardise column names ---
echo "=== Standardising column names ==="
$PSQL <<'SQL'
DO $$
DECLARE
  col RECORD;
BEGIN
  -- Find the SA2 code column (contains '22023' in name, is varchar/text)
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sa2_boundaries_staging'
      AND column_name ~* 'sa2.*2023.*code|sa22023' AND data_type IN ('character varying', 'text', 'integer', 'bigint')
    LIMIT 1
  LOOP
    EXECUTE format('ALTER TABLE sa2_boundaries_staging RENAME COLUMN %I TO sa2_code', col.column_name);
    RAISE NOTICE 'Renamed % → sa2_code', col.column_name;
  END LOOP;

  -- SA2 name
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sa2_boundaries_staging'
      AND column_name ~* 'sa2.*2023.*name|sa22023.*name' AND column_name !~* 'ascii'
    LIMIT 1
  LOOP
    EXECUTE format('ALTER TABLE sa2_boundaries_staging RENAME COLUMN %I TO sa2_name', col.column_name);
    RAISE NOTICE 'Renamed % → sa2_name', col.column_name;
  END LOOP;

  -- Regional council code
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sa2_boundaries_staging'
      AND column_name ~* 'regc.*2023.*code|regc2023' AND data_type IN ('character varying', 'text', 'integer', 'bigint')
    LIMIT 1
  LOOP
    EXECUTE format('ALTER TABLE sa2_boundaries_staging RENAME COLUMN %I TO regc_code', col.column_name);
  END LOOP;

  -- Regional council name
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sa2_boundaries_staging'
      AND column_name ~* 'regc.*2023.*name|regc2023.*name' AND column_name !~* 'ascii'
    LIMIT 1
  LOOP
    EXECUTE format('ALTER TABLE sa2_boundaries_staging RENAME COLUMN %I TO regc_name', col.column_name);
  END LOOP;

  -- TA code
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sa2_boundaries_staging'
      AND column_name ~* 'ta.*2023.*code|ta2023' AND data_type IN ('character varying', 'text', 'integer', 'bigint')
    LIMIT 1
  LOOP
    EXECUTE format('ALTER TABLE sa2_boundaries_staging RENAME COLUMN %I TO ta_code', col.column_name);
  END LOOP;

  -- TA name
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sa2_boundaries_staging'
      AND column_name ~* 'ta.*2023.*name|ta2023.*name' AND column_name !~* 'ascii'
    LIMIT 1
  LOOP
    EXECUTE format('ALTER TABLE sa2_boundaries_staging RENAME COLUMN %I TO ta_name', col.column_name);
  END LOOP;

  -- Land area
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sa2_boundaries_staging'
      AND column_name ~* 'land_area'
    LIMIT 1
  LOOP
    EXECUTE format('ALTER TABLE sa2_boundaries_staging RENAME COLUMN %I TO land_area_sq_km', col.column_name);
  END LOOP;

  -- Total area
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sa2_boundaries_staging'
      AND column_name ~* 'area_sq_km|total_area'
    LIMIT 1
  LOOP
    EXECUTE format('ALTER TABLE sa2_boundaries_staging RENAME COLUMN %I TO area_sq_km', col.column_name);
  END LOOP;
END $$;

-- Ensure sa2_code is varchar
ALTER TABLE sa2_boundaries_staging ALTER COLUMN sa2_code TYPE varchar USING sa2_code::varchar;
SQL

echo "=== Verify standardised columns ==="
$PSQL -c "SELECT sa2_code, sa2_name, ta_name FROM sa2_boundaries_staging LIMIT 5;"

# --- Step 5: Verify census match BEFORE swapping ---
echo "=== Census match check (staging) ==="
$PSQL -c "
  SELECT
    (SELECT COUNT(*) FROM census_demographics) AS census_total,
    (SELECT COUNT(*) FROM sa2_boundaries_staging) AS staging_total,
    (SELECT COUNT(*) FROM census_demographics d
     JOIN sa2_boundaries_staging s ON d.sa2_code = s.sa2_code) AS matched;
"

# --- Step 6: Swap tables ---
echo "=== Swapping tables ==="
$PSQL -c "
  BEGIN;
  DROP TABLE IF EXISTS sa2_boundaries_old;
  ALTER TABLE sa2_boundaries RENAME TO sa2_boundaries_old;
  ALTER TABLE sa2_boundaries_staging RENAME TO sa2_boundaries;
  COMMIT;
"

# --- Step 7: Rebuild indexes ---
echo "=== Rebuilding indexes ==="
$PSQL -c "
  CREATE INDEX IF NOT EXISTS sa2_boundaries_geom_geom_idx ON sa2_boundaries USING GIST (geom);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sa2_code ON sa2_boundaries (sa2_code);
  CREATE INDEX IF NOT EXISTS idx_sa2_ta ON sa2_boundaries (ta_code);
  CREATE INDEX IF NOT EXISTS idx_sa2_regc ON sa2_boundaries (regc_code);
  ANALYZE sa2_boundaries;
"

# --- Step 8: Refresh materialized views ---
echo "=== Refreshing materialized views ==="
$PSQL -c "REFRESH MATERIALIZED VIEW mv_sa2_comparisons;"
echo "  mv_sa2_comparisons done"
$PSQL -c "REFRESH MATERIALIZED VIEW mv_rental_market;"
echo "  mv_rental_market done"
$PSQL -c "REFRESH MATERIALIZED VIEW mv_sa2_valuations;"
echo "  mv_sa2_valuations done"

# --- Step 9: Flush Redis ---
echo "=== Flushing Redis cache ==="
docker exec app-redis-1 redis-cli FLUSHDB 2>/dev/null || echo "  (skipped — no redis or auth needed)"

# --- Step 10: Final verification ---
echo ""
echo "=== FINAL VERIFICATION ==="
$PSQL -c "
  SELECT
    (SELECT COUNT(*) FROM sa2_boundaries) AS boundaries,
    (SELECT COUNT(*) FROM census_demographics d JOIN sa2_boundaries s ON d.sa2_code = s.sa2_code) AS census_matched;
"
echo ""
echo "Dixon Street check:"
$PSQL -c "
  SELECT d.sa2_code, d.sa2_name, d.population_2023
  FROM census_demographics d
  JOIN sa2_boundaries s ON d.sa2_code = s.sa2_code
  WHERE d.sa2_name ILIKE '%dixon%';
"
echo ""
echo "=== DONE ==="
echo "Old table kept as sa2_boundaries_old. Drop when satisfied:"
echo "  $PSQL -c 'DROP TABLE sa2_boundaries_old;'"
