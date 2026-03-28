#!/usr/bin/env bash
# setup_valhalla.sh — Download NZ OSM data + SRTM elevation tiles, build Valhalla
#
# Run on the Azure VM:
#   chmod +x backend/scripts/setup_valhalla.sh
#   ./backend/scripts/setup_valhalla.sh
#
# Prerequisites: docker, wget, ~2GB disk space

set -euo pipefail

DATA_DIR="/data/valhalla"
SRTM_DIR="${DATA_DIR}/elevation/srtm"
OSM_FILE="${DATA_DIR}/new-zealand-latest.osm.pbf"

echo "=== WhareScore Valhalla + SRTM Setup ==="

# ── 1. Create directories ──
mkdir -p "${DATA_DIR}" "${SRTM_DIR}"

# ── 2. Download NZ OSM extract (~200MB) ──
if [ ! -f "${OSM_FILE}" ]; then
    echo "[1/3] Downloading NZ OSM extract from Geofabrik..."
    wget -q --show-progress -O "${OSM_FILE}" \
        "https://download.geofabrik.de/australia-oceania/new-zealand-latest.osm.pbf"
    echo "  ✓ OSM extract: $(du -h "${OSM_FILE}" | cut -f1)"
else
    echo "[1/3] OSM extract already exists, skipping download"
fi

# ── 3. Download SRTM 30m tiles for NZ ──
# NZ spans roughly S34-S48, E166-E179
# SRTM tiles use naming: S{lat}E{lon}.hgt (1° × 1° tiles)
# Source: USGS EarthExplorer via OpenTopography mirror
echo "[2/3] Downloading SRTM 30m elevation tiles for NZ..."

SRTM_BASE="https://elevation-tiles-prod.s3.amazonaws.com/skadi"
TILE_COUNT=0
SKIP_COUNT=0

for lat in $(seq 34 47); do
    for lon in $(seq 166 178); do
        TILE="S${lat}E${lon}"
        HGT_FILE="${SRTM_DIR}/${TILE}.hgt"
        GZ_FILE="${HGT_FILE}.gz"

        if [ -f "${HGT_FILE}" ]; then
            SKIP_COUNT=$((SKIP_COUNT + 1))
            continue
        fi

        # SRTM tiles are organized in directories by latitude
        URL="${SRTM_BASE}/S${lat}/${TILE}.hgt.gz"
        if wget -q --spider "${URL}" 2>/dev/null; then
            wget -q -O "${GZ_FILE}" "${URL}"
            gunzip -f "${GZ_FILE}"
            TILE_COUNT=$((TILE_COUNT + 1))
        fi
        # Tiles over ocean won't exist — that's fine
    done
done

echo "  ✓ Downloaded ${TILE_COUNT} new tiles (${SKIP_COUNT} already existed)"
echo "  ✓ SRTM data: $(du -sh "${SRTM_DIR}" | cut -f1)"

# ── 4. Generate Valhalla config ──
echo "[3/3] Generating Valhalla configuration..."

cat > "${DATA_DIR}/valhalla.json" << 'VALHALLA_CONFIG'
{
  "mjolnir": {
    "tile_dir": "/data/valhalla_tiles",
    "admin": "/data/valhalla_tiles/admin.sqlite",
    "timezone": "/data/valhalla_tiles/tz_world.sqlite",
    "concurrency": 2
  },
  "additional_data": {
    "elevation": "/data/elevation/srtm",
    "elevation_url": ""
  },
  "loki": {
    "actions": ["locate", "route", "sources_to_targets", "optimized_route", "isochrone", "trace_route", "trace_attributes", "transit_available", "expansion", "centroid", "status"],
    "logging": { "type": "std_out", "color": true, "long_request": 110.0 },
    "service_defaults": {
      "minimum_reachability": 50,
      "radius": 0,
      "search_cutoff": 35000,
      "node_snap_tolerance": 5,
      "street_side_tolerance": 5,
      "street_side_max_distance": 1000,
      "heading_tolerance": 60
    }
  },
  "thor": {
    "logging": { "type": "std_out", "color": true, "long_request": 110.0 }
  },
  "odin": {
    "logging": { "type": "std_out", "color": true }
  },
  "meili": {
    "logging": { "type": "std_out", "color": true }
  },
  "httpd": {
    "service": {
      "listen": "tcp://*:8002",
      "loopback": "ipc:///tmp/valhalla.lock",
      "interrupt": "ipc:///tmp/valhalla.interrupt"
    }
  },
  "service_limits": {
    "auto": { "max_distance": 5000.0, "max_locations": 20 },
    "pedestrian": { "max_distance": 250000.0, "max_locations": 50, "min_transit_walking_distance": 1, "max_transit_walking_distance": 10000 },
    "bicycle": { "max_distance": 500000.0, "max_locations": 50 },
    "isochrone": { "max_contours": 4, "max_time_contour": 120, "max_distance": 25000.0, "max_locations": 1, "max_distance_contour": 200 },
    "trace": { "max_distance": 200000.0, "max_gps_accuracy": 100.0, "max_search_radius": 100.0, "max_shape": 16000 },
    "skadi": { "max_shape": 750000, "min_resample": 10.0 }
  }
}
VALHALLA_CONFIG

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Build Valhalla tiles (takes ~10 min for NZ):"
echo "     docker run --rm -v ${DATA_DIR}:/data ghcr.io/gis-ops/docker-valhalla/valhalla:latest \\"
echo "       valhalla_build_tiles -c /data/valhalla.json /data/new-zealand-latest.osm.pbf"
echo ""
echo "  2. Start Valhalla via docker compose:"
echo "     docker compose -f docker-compose.prod.yml up -d valhalla"
echo ""
echo "  3. Test walking isochrone:"
echo "     curl 'http://localhost:8002/isochrone?json={\"locations\":[{\"lat\":-41.2865,\"lon\":174.7762}],\"costing\":\"pedestrian\",\"contours\":[{\"time\":10}]}'"
echo ""
