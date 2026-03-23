#!/usr/bin/env python3
"""
Bulk loader for Christchurch/Canterbury hazard and planning data.

Loads the following layers into existing tables:
  1. Flood zones (10yr/50yr/200yr) → flood_zones
  2. Liquefaction vulnerability → liquefaction_zones
  3. Tsunami evacuation zones → tsunami_zones
  4. Slope hazard → (new slope_hazard or existing hazard framework)
  5. District plan zones → district_plan_zones
  6. Bus stops → transit_stops
  7. Contaminated land → contaminated_land
  8. Coastal erosion → coastal_erosion
  9. Fault awareness areas → (fault zones)

Usage:
    cd backend
    python scripts/load_christchurch_hazards.py [--dry-run] [--layer LAYER] [--clear]
    python scripts/load_christchurch_hazards.py --layer flood
    python scripts/load_christchurch_hazards.py --layer all
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PAGE_SIZE = 2000

# ── Layer definitions ───────────────────────────────────────────────────────

CCC_BASE = "https://gis.ccc.govt.nz/server/rest/services/OpenData"
ECAN_BASE = "https://gis.ecan.govt.nz/arcgis/rest/services/Public"

LAYERS = {
    "flood": {
        "urls": [
            (f"{CCC_BASE}/WaterCharacteristic/FeatureServer/1", "10yr"),
            (f"{CCC_BASE}/WaterCharacteristic/FeatureServer/2", "50yr"),
            (f"{CCC_BASE}/WaterCharacteristic/FeatureServer/3", "200yr"),
        ],
        "table": "flood_zones",
    },
    "liquefaction": {
        "urls": [
            (f"{CCC_BASE}/LandCharacteristic/FeatureServer/36", "vulnerability"),
        ],
        "table": "liquefaction_zones",
    },
    "tsunami": {
        "urls": [
            (f"{CCC_BASE}/WaterCharacteristic/FeatureServer/43", "evacuation"),
        ],
        "table": "tsunami_zones",
    },
    "slope": {
        "urls": [
            (f"{CCC_BASE}/LandCharacteristic/FeatureServer/1", "slope_hazard"),
        ],
        "table": "slope_hazard",
    },
    "zones": {
        "urls": [
            (f"{CCC_BASE}/DistrictPlan/FeatureServer/78", "dp_zones"),
        ],
        "table": "district_plan_zones",
    },
    "transit": {
        "urls": [
            (f"{ECAN_BASE}/Bus_Routes/MapServer/1", "bus_stops"),
        ],
        "table": "transit_stops",
    },
    "contaminated": {
        "urls": [
            (f"{CCC_BASE}/LandCharacteristic/FeatureServer/9", "hail"),
        ],
        "table": "contaminated_land",
    },
    "coastal": {
        "urls": [
            (f"{CCC_BASE}/WaterCharacteristic/FeatureServer/41", "erosion"),
        ],
        "table": "coastal_erosion",
    },
    "faults": {
        "urls": [
            (f"{ECAN_BASE}/EarthquakeFaultsLayers/MapServer/0", "fault_awareness"),
        ],
        "table": "fault_zones",
    },
}


def fetch_page(url: str, offset: int, out_fields: str = "*", oid_field: str = None) -> tuple[list[dict], str | None]:
    """Fetch a page of features from ArcGIS REST API.
    Returns (features, objectIdFieldName).
    """
    params = {
        "where": "1=1",
        "outFields": out_fields,
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json",
        "resultRecordCount": str(PAGE_SIZE),
    }
    if oid_field:
        params["orderByFields"] = oid_field
        params["resultOffset"] = str(offset)
    else:
        # First page — try without ordering to discover OID field
        params["resultOffset"] = str(offset)

    resp = requests.get(f"{url}/query", params=params, timeout=60,
                        headers={"User-Agent": "WhareScore/1.0"})
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        # Retry without orderByFields (some servers don't support it)
        params.pop("orderByFields", None)
        params.pop("resultOffset", None)
        if offset == 0:
            resp = requests.get(f"{url}/query", params=params, timeout=60,
                                headers={"User-Agent": "WhareScore/1.0"})
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                logger.warning(f"API error: {data['error']}")
                return [], None
        else:
            return [], None
    oid_name = data.get("objectIdFieldName")
    return data.get("features", []), oid_name


def fetch_all(url: str, label: str, out_fields: str = "*") -> list[dict]:
    """Fetch all features with pagination."""
    all_features = []
    offset = 0
    oid_field = None
    while True:
        logger.info(f"[{label}] Fetching offset {offset}...")
        features, discovered_oid = fetch_page(url, offset, out_fields, oid_field)
        if discovered_oid and not oid_field:
            oid_field = discovered_oid
            logger.info(f"  OID field: {oid_field}")
        if not features:
            break
        all_features.extend(features)
        logger.info(f"  Got {len(features)} (total: {len(all_features)})")
        if len(features) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        # If we can't paginate (no OID field discovered), just take what we got
        if not oid_field:
            logger.warning("  No OID field — cannot paginate, using first page only")
            break
    return all_features


def geom_to_wkt(geom: dict) -> str | None:
    """Convert ArcGIS geometry to WKT for PostGIS."""
    if not geom:
        return None

    # Point
    if "x" in geom and "y" in geom:
        return f"POINT({geom['x']} {geom['y']})"

    # Polygon
    if "rings" in geom:
        rings = []
        for ring in geom["rings"]:
            coords = ", ".join(f"{p[0]} {p[1]}" for p in ring)
            rings.append(f"({coords})")
        return f"POLYGON({', '.join(rings)})"

    # MultiPolygon (multiple rings that aren't holes)
    return None


# ── Loaders ─────────────────────────────────────────────────────────────────

def load_flood(conn, features: list[dict], sublabel: str, dry_run: bool):
    """Load flood zone polygons.
    Schema: objectid, geom, shape_length, shape_area, label, hectares, title, description, weblink, globalid
    """
    if dry_run:
        logger.info(f"  Flood {sublabel}: {len(features)} polygons (dry run)")
        for f in features[:3]:
            a = f["attributes"]
            print(f"    Catchment={a.get('Catchment')} Rainfall={a.get('RainfallEvent')}")
        return 0

    cur = conn.cursor()
    inserted = 0
    for f in features:
        a = f["attributes"]
        wkt = geom_to_wkt(f.get("geometry"))
        if not wkt:
            continue
        try:
            cur.execute("""
                INSERT INTO flood_zones (label, title, description, geom)
                VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))
            """, (
                f"CCC {sublabel}",
                f"Flood Extent {sublabel}",
                a.get("Catchment") or a.get("RainfallEvent") or sublabel,
                wkt,
            ))
            inserted += 1
        except Exception as e:
            logger.debug(f"Flood insert error: {e}")
            conn.rollback()
            continue
    conn.commit()
    return inserted


def load_liquefaction(conn, features: list[dict], sublabel: str, dry_run: bool):
    """Load liquefaction vulnerability polygons.
    Schema: objectid, geom, source, liquefaction, simplified, shape_length, shape_area
    """
    if dry_run:
        logger.info(f"  Liquefaction: {len(features)} polygons (dry run)")
        for f in features[:3]:
            a = f["attributes"]
            print(f"    Category={a.get('Liq_Cat')}")
        return 0

    cur = conn.cursor()
    inserted = 0
    for f in features:
        a = f["attributes"]
        wkt = geom_to_wkt(f.get("geometry"))
        if not wkt:
            continue
        liq_cat = a.get("Liq_Cat") or "Unknown"
        # Map to simplified categories matching existing data
        simplified = "High" if "High" in liq_cat else "Medium" if "Medium" in liq_cat else "Low" if "Low" in liq_cat or "Unlikely" in liq_cat else "Possible"
        try:
            cur.execute("""
                INSERT INTO liquefaction_zones (source, liquefaction, simplified, geom)
                VALUES ('CCC', %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))
            """, (liq_cat, simplified, wkt))
            inserted += 1
        except Exception as e:
            logger.debug(f"Liquefaction insert error: {e}")
            conn.rollback()
            continue
    conn.commit()
    return inserted


def load_tsunami(conn, features: list[dict], sublabel: str, dry_run: bool):
    """Load tsunami evacuation zone polygons.
    Schema: objectid, geom, zone_class, col_code, evac_zone, location, info, heights, shape_length, shape_area
    """
    if dry_run:
        logger.info(f"  Tsunami: {len(features)} polygons (dry run)")
        for f in features[:3]:
            a = f["attributes"]
            print(f"    ZoneType={a.get('ZoneType')} Trigger={a.get('ZoneEvacuationTrigger')}")
        return 0

    zone_class_map = {"Red": 1, "Orange": 2, "Yellow": 3}
    cur = conn.cursor()
    inserted = 0
    for f in features:
        a = f["attributes"]
        wkt = geom_to_wkt(f.get("geometry"))
        if not wkt:
            continue
        zone_type = a.get("ZoneType") or "Unknown"
        if zone_type == "No Zone":
            continue
        try:
            cur.execute("""
                INSERT INTO tsunami_zones (zone_class, evac_zone, location, info, geom)
                VALUES (%s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))
            """, (
                zone_class_map.get(zone_type, 0),
                zone_type,
                "Christchurch",
                a.get("ZoneEvacuationTrigger") or "",
                wkt,
            ))
            inserted += 1
        except Exception as e:
            logger.debug(f"Tsunami insert error: {e}")
            conn.rollback()
            continue
    conn.commit()
    return inserted


def load_district_plan_zones(conn, features: list[dict], sublabel: str, dry_run: bool):
    """Load district plan zone polygons.
    Schema: id, zone_name, zone_code, category, chapter, eplan_url, status, council, geom, source_council
    """
    if dry_run:
        logger.info(f"  DP Zones: {len(features)} polygons (dry run)")
        for f in features[:5]:
            a = f["attributes"]
            print(f"    Type={a.get('Type')} Code={a.get('Code')} Group={a.get('TypeGroup')}")
        return 0

    cur = conn.cursor()
    inserted = 0
    for f in features:
        a = f["attributes"]
        wkt = geom_to_wkt(f.get("geometry"))
        if not wkt:
            continue
        try:
            cur.execute("""
                INSERT INTO district_plan_zones (zone_name, zone_code, category, council, source_council, geom)
                VALUES (%s, %s, %s, 'CCC', 'CCC', ST_SetSRID(ST_GeomFromText(%s), 4326))
            """, (
                a.get("Type"),
                a.get("Code"),
                a.get("TypeGroup"),
                wkt,
            ))
            inserted += 1
        except Exception as e:
            logger.debug(f"DP zone insert error: {e}")
            conn.rollback()
            continue
    conn.commit()
    return inserted


def load_transit(conn, features: list[dict], sublabel: str, dry_run: bool):
    """Load bus stop points.
    Schema: stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, zone_id, location_type, parent_station, geom, source, mode_type
    """
    if dry_run:
        logger.info(f"  Bus stops: {len(features)} points (dry run)")
        for f in features[:5]:
            a = f["attributes"]
            print(f"    {a.get('PlatformName')} on {a.get('RoadName')} routes={a.get('RouteNos')}")
        return 0

    cur = conn.cursor()
    inserted = 0
    for f in features:
        a = f["attributes"]
        geom = f.get("geometry")
        if not geom or "x" not in geom:
            continue
        lng, lat = geom["x"], geom["y"]
        try:
            cur.execute("""
                INSERT INTO transit_stops (stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, source, mode_type, geom)
                VALUES (%s, %s, %s, %s, %s, %s, 'ECan', 'bus', ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            """, (
                a.get("PlatformTag"),
                a.get("PlatformNo"),
                a.get("PlatformName") or a.get("RoadName") or "Bus Stop",
                a.get("Routes") or a.get("RouteNos"),
                lat, lng,
                lng, lat,
            ))
            inserted += 1
        except Exception as e:
            logger.debug(f"Transit insert error: {e}")
            conn.rollback()
            continue
    conn.commit()
    return inserted


def load_contaminated(conn, features: list[dict], sublabel: str, dry_run: bool):
    """Load contaminated land polygons.
    Schema: id, site_id, site_name, file_no, anzecc_category, anzecc_subcategory, category,
            street_number, street_name, local_authority, legal_description, site_history, geom, source_council
    """
    if dry_run:
        logger.info(f"  Contaminated: {len(features)} polygons (dry run)")
        for f in features[:3]:
            a = f["attributes"]
            print(f"    Desc={a.get('Description')} Code={a.get('Code')} Status={a.get('Status')}")
        return 0

    cur = conn.cursor()
    inserted = 0
    for f in features:
        a = f["attributes"]
        wkt = geom_to_wkt(f.get("geometry"))
        if not wkt:
            continue
        try:
            cur.execute("""
                INSERT INTO contaminated_land (site_name, category, local_authority, source_council, geom)
                VALUES (%s, %s, 'Christchurch City', 'CCC', ST_SetSRID(ST_GeomFromText(%s), 4326))
            """, (
                a.get("Description") or "Unknown",
                a.get("Code") or "",
                wkt,
            ))
            inserted += 1
        except Exception as e:
            logger.debug(f"Contaminated insert error: {e}")
            conn.rollback()
            continue
    conn.commit()
    return inserted


def load_coastal(conn, features: list[dict], sublabel: str, dry_run: bool):
    """Load coastal erosion hazard polygons.
    Schema: ogc_fid, geom, exposure, shore_type, ..., source_council, name, coast_type, timeframe, scenario, ...
    """
    if dry_run:
        logger.info(f"  Coastal erosion: {len(features)} polygons (dry run)")
        for f in features[:3]:
            a = f["attributes"]
            print(f"    Timeframe={a.get('Timeframe')} Retreat={a.get('ShorelineRetreat')}")
        return 0

    cur = conn.cursor()
    inserted = 0
    for f in features:
        a = f["attributes"]
        wkt = geom_to_wkt(f.get("geometry"))
        if not wkt:
            continue
        try:
            cur.execute("""
                INSERT INTO coastal_erosion (source_council, name, scenario, timeframe, coast_type, geom)
                VALUES ('CCC', %s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))
            """, (
                a.get("ReportName") or "CCC Coastal Erosion",
                a.get("ScenarioName") or "",
                int(a["Timeframe"]) if a.get("Timeframe") else None,
                a.get("ModelType") or "",
                wkt,
            ))
            inserted += 1
        except Exception as e:
            logger.debug(f"Coastal insert error: {e}")
            conn.rollback()
            continue
    conn.commit()
    return inserted


def load_generic(conn, features: list[dict], sublabel: str, dry_run: bool):
    """Generic loader - just counts."""
    if dry_run:
        logger.info(f"  {sublabel}: {len(features)} features (dry run)")
        for f in features[:3]:
            a = f["attributes"]
            keys = list(a.keys())[:5]
            print(f"    {', '.join(f'{k}={a[k]}' for k in keys)}")
        return 0
    logger.warning(f"No specific loader for {sublabel} — skipping insert")
    return 0


LOADER_MAP = {
    "flood": load_flood,
    "liquefaction": load_liquefaction,
    "tsunami": load_tsunami,
    "zones": load_district_plan_zones,
    "transit": load_transit,
    "contaminated": load_contaminated,
    "coastal": load_coastal,
    "slope": load_generic,
    "faults": load_generic,
}


def main(args):
    import psycopg
    from psycopg.rows import dict_row

    conninfo = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/wharescore",
    )
    conn = psycopg.connect(conninfo, row_factory=dict_row, autocommit=False)

    layers_to_load = list(LAYERS.keys()) if args.layer == "all" else [args.layer]

    for layer_name in layers_to_load:
        if layer_name not in LAYERS:
            logger.error(f"Unknown layer: {layer_name}. Available: {', '.join(LAYERS.keys())}")
            continue

        layer = LAYERS[layer_name]
        loader_fn = LOADER_MAP.get(layer_name, load_generic)
        table = layer["table"]

        logger.info(f"\n{'='*60}")
        logger.info(f"Loading: {layer_name} → {table}")
        logger.info(f"{'='*60}")

        if args.clear:
            logger.info(f"Clearing CCC/ECan data from {table}...")
            try:
                conn.execute(f"DELETE FROM {table} WHERE source_council IN ('CCC', 'ECan')")
                conn.commit()
            except Exception as e:
                logger.warning(f"Clear failed (table may not have source_council): {e}")
                conn.rollback()

        total_inserted = 0
        for url, sublabel in layer["urls"]:
            logger.info(f"--- Fetching {sublabel} from {url.split('/')[-3]}.../{url.split('/')[-1]} ---")
            features = fetch_all(url, f"{layer_name}/{sublabel}")
            logger.info(f"Fetched {len(features)} features")

            inserted = loader_fn(conn, features, sublabel, args.dry_run)
            total_inserted += inserted

        if not args.dry_run:
            logger.info(f"✓ {layer_name}: inserted {total_inserted} rows into {table}")
        else:
            logger.info(f"  {layer_name}: would insert into {table} (dry run)")

    conn.close()
    logger.info("\nDone!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load Christchurch/Canterbury hazard data")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing CCC/ECan data first")
    parser.add_argument("--layer", default="all",
                        help=f"Layer to load: {', '.join(LAYERS.keys())}, or 'all'")
    args = parser.parse_args()
    main(args)
