#!/usr/bin/env python3
"""
Bulk loader for regional hazard data (Auckland, Hamilton, Tauranga).

Usage:
    cd backend
    python scripts/load_regional_hazards.py --region auckland [--dry-run]
    python scripts/load_regional_hazards.py --region hamilton [--dry-run]
    python scripts/load_regional_hazards.py --region tauranga [--dry-run]
    python scripts/load_regional_hazards.py --region all [--dry-run]
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


def fetch_all(url: str, label: str, page_size: int = 2000) -> list[dict]:
    """Fetch all features with auto-pagination."""
    all_features = []
    offset = 0
    oid_field = None
    while True:
        params = {
            "where": "1=1", "outFields": "*", "returnGeometry": "true",
            "outSR": "4326", "f": "json", "resultRecordCount": str(page_size),
        }
        if oid_field:
            params["orderByFields"] = oid_field
            params["resultOffset"] = str(offset)
        else:
            params["resultOffset"] = str(offset)

        try:
            resp = requests.get(f"{url}/query", params=params, timeout=120,
                                headers={"User-Agent": "WhareScore/1.0"})
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning(f"Request failed at offset {offset}: {e}")
            if offset == 0:
                # Try without geometry for large layers
                logger.info("  Retrying with smaller page...")
                params["resultRecordCount"] = str(min(500, page_size))
                try:
                    resp = requests.get(f"{url}/query", params=params, timeout=120,
                                        headers={"User-Agent": "WhareScore/1.0"})
                    resp.raise_for_status()
                    data = resp.json()
                except:
                    break
            else:
                break

        if "error" in data:
            # Retry without ordering
            params.pop("orderByFields", None)
            params.pop("resultOffset", None)
            if offset == 0:
                try:
                    resp = requests.get(f"{url}/query", params=params, timeout=120,
                                        headers={"User-Agent": "WhareScore/1.0"})
                    data = resp.json()
                except:
                    break
                if "error" in data:
                    logger.warning(f"API error: {data['error']}")
                    break
            else:
                break

        if not oid_field:
            oid_field = data.get("objectIdFieldName")

        features = data.get("features", [])
        if not features:
            break
        all_features.extend(features)
        logger.info(f"[{label}] offset={offset} got={len(features)} total={len(all_features)}")
        if len(features) < page_size:
            break
        offset += page_size
        if not oid_field:
            break
    return all_features


def geom_to_wkt(geom: dict) -> str | None:
    if not geom:
        return None
    if "x" in geom and "y" in geom:
        return f"POINT({geom['x']} {geom['y']})"
    if "rings" in geom:
        rings = []
        for ring in geom["rings"]:
            coords = ", ".join(f"{p[0]} {p[1]}" for p in ring)
            rings.append(f"({coords})")
        return f"POLYGON({', '.join(rings)})"
    return None


def insert_polygons(conn, features, table, columns, value_fn, source_label):
    """Generic polygon inserter."""
    cur = conn.cursor()
    inserted = 0
    for f in features:
        a = f["attributes"]
        wkt = geom_to_wkt(f.get("geometry"))
        if not wkt:
            continue
        values = value_fn(a, wkt)
        if values is None:
            continue
        try:
            placeholders = ", ".join(["%s"] * len(values))
            cur.execute(f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})", values)
            inserted += 1
        except Exception as e:
            conn.rollback()
            continue
    conn.commit()
    return inserted


def insert_points(conn, features, table, columns, value_fn, source_label):
    """Generic point inserter."""
    cur = conn.cursor()
    inserted = 0
    for f in features:
        a = f["attributes"]
        geom = f.get("geometry")
        if not geom or "x" not in geom:
            continue
        values = value_fn(a, geom)
        if values is None:
            continue
        try:
            placeholders = ", ".join(["%s"] * len(values))
            cur.execute(f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})", values)
            inserted += 1
        except Exception as e:
            conn.rollback()
            continue
    conn.commit()
    return inserted


# ── Auckland ────────────────────────────────────────────────────────────────

AKL_BASE = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services"

def load_auckland(conn, dry_run):
    results = {}

    # 1. Flood Plains (1% AEP)
    logger.info("=== Auckland Flood Plains ===")
    features = fetch_all(f"{AKL_BASE}/Flood_Plains/FeatureServer/0", "AKL Flood Plains", page_size=500)
    if dry_run:
        logger.info(f"  {len(features)} flood plain polygons")
    else:
        n = insert_polygons(conn, features, "flood_zones",
            ["label", "title", "description", "geom"],
            lambda a, wkt: ("Auckland 1% AEP", a.get("Hazard") or "Flood Plain",
                           a.get("Model_Type") or "", f"ST_SetSRID(ST_GeomFromText('{wkt}'), 4326)"),
            "Auckland")
        # Use raw SQL for geometry
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            wkt = geom_to_wkt(f.get("geometry"))
            if not wkt:
                continue
            try:
                cur.execute("INSERT INTO flood_zones (label, title, description, geom) VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))",
                    ("Auckland 1% AEP", a.get("Hazard") or "Flood Plain", a.get("Model_Type") or "", wkt))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["flood_plains"] = inserted

    # 2. Flood Prone Areas
    logger.info("=== Auckland Flood Prone Areas ===")
    features = fetch_all(f"{AKL_BASE}/Flood_Prone_Areas/FeatureServer/0", "AKL Flood Prone", page_size=500)
    if dry_run:
        logger.info(f"  {len(features)} flood prone area polygons")
    else:
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            wkt = geom_to_wkt(f.get("geometry"))
            if not wkt:
                continue
            depth = a.get("Depth100y")
            try:
                cur.execute("INSERT INTO flood_zones (label, title, description, geom) VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))",
                    ("Auckland Flood Prone", "Flood Prone Area", f"100yr depth: {depth}m" if depth else "", wkt))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["flood_prone"] = inserted

    # 3. Liquefaction (Calibrated Assessment — more accurate)
    logger.info("=== Auckland Liquefaction ===")
    features = fetch_all(f"{AKL_BASE}/Liquefaction_Vulnerability_Calibrated_Assessment/FeatureServer/0", "AKL Liquefaction")
    if dry_run:
        logger.info(f"  {len(features)} liquefaction polygons")
    else:
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            wkt = geom_to_wkt(f.get("geometry"))
            if not wkt:
                continue
            vuln = a.get("Vulnerability") or "Unknown"
            simplified = "High" if "High" in vuln else "Medium" if "Medium" in vuln or "Moderate" in vuln else "Low"
            try:
                cur.execute("INSERT INTO liquefaction_zones (source, liquefaction, simplified, geom) VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))",
                    ("Auckland Council", vuln, simplified, wkt))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["liquefaction"] = inserted

    # 4. Tsunami Evacuation Zones
    logger.info("=== Auckland Tsunami ===")
    features = fetch_all(f"{AKL_BASE}/Tsunami_Evacuation_Zones/FeatureServer/0", "AKL Tsunami")
    if dry_run:
        logger.info(f"  {len(features)} tsunami polygons")
    else:
        zone_map = {"Red": 1, "Orange": 2, "Yellow": 3}
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            wkt = geom_to_wkt(f.get("geometry"))
            if not wkt:
                continue
            zone_type = a.get("ZONETYPE") or "Unknown"
            try:
                cur.execute("INSERT INTO tsunami_zones (zone_class, evac_zone, location, info, geom) VALUES (%s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))",
                    (zone_map.get(zone_type, 0), zone_type, "Auckland", a.get("COMMENTS") or "", wkt))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["tsunami"] = inserted

    # 5. Auckland Transport Bus Stops
    logger.info("=== Auckland Bus Stops ===")
    features = fetch_all("https://services2.arcgis.com/JkPEgZJGxhSjYOo0/arcgis/rest/services/BusService/FeatureServer/0", "AT Bus Stops")
    if dry_run:
        logger.info(f"  {len(features)} bus stop points")
    else:
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            g = f.get("geometry")
            if not g or "x" not in g:
                continue
            try:
                cur.execute("""INSERT INTO transit_stops (stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, source, mode_type, geom)
                    VALUES (%s, %s, %s, %s, %s, %s, 'AT', 'bus', ST_SetSRID(ST_MakePoint(%s, %s), 4326))""",
                    (a.get("STOPID"), a.get("STOPCODE"), a.get("STOPNAME") or "Bus Stop",
                     a.get("STOPDESC"), g["y"], g["x"], g["x"], g["y"]))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["bus_stops"] = inserted

    return results


# ── Hamilton ────────────────────────────────────────────────────────────────

HCC_BASE = "https://maps.hamilton.govt.nz/server/rest/services/hcc_entpublic"

def load_hamilton(conn, dry_run):
    results = {}

    # 1. Flood Hazard (Low/Medium/High)
    logger.info("=== Hamilton Flood Hazard ===")
    features = fetch_all(f"{HCC_BASE}/portal_floodviewer_floodhazard/FeatureServer/1", "HAM Flood Hazard", page_size=1000)
    if dry_run:
        logger.info(f"  {len(features)} flood hazard polygons")
    else:
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            wkt = geom_to_wkt(f.get("geometry"))
            if not wkt:
                continue
            hazard = a.get("Hazard_Factor") or "Unknown"
            try:
                cur.execute("INSERT INTO flood_zones (label, title, description, geom) VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))",
                    (f"Hamilton {hazard}", "Flood Hazard", a.get("Model_Name") or "", wkt))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["flood_hazard"] = inserted

    return results


# ── Tauranga ────────────────────────────────────────────────────────────────

TCC_BASE = "https://gis.tauranga.govt.nz/server/rest/services"

def load_tauranga(conn, dry_run):
    results = {}

    # 1. Flood Risk (5 classifications)
    logger.info("=== Tauranga Flood Risk ===")
    features = fetch_all(f"{TCC_BASE}/fv_FloodRisk/FeatureServer/83", "TCC Flood Risk")
    if dry_run:
        logger.info(f"  {len(features)} flood risk polygons")
    else:
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            wkt = geom_to_wkt(f.get("geometry"))
            if not wkt:
                continue
            classification = a.get("FloodRiskClassification") or "Unknown"
            try:
                cur.execute("INSERT INTO flood_zones (label, title, description, geom) VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))",
                    (f"TCC {classification}", "Flood Risk", classification, wkt))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["flood_risk"] = inserted

    # 2. Liquefaction Vulnerability
    logger.info("=== Tauranga Liquefaction ===")
    features = fetch_all(f"{TCC_BASE}/Liquefaction/FeatureServer/0", "TCC Liquefaction")
    if dry_run:
        logger.info(f"  {len(features)} liquefaction polygons")
    else:
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            wkt = geom_to_wkt(f.get("geometry"))
            if not wkt:
                continue
            vuln = a.get("LiquefactionVulnerability") or "Unknown"
            simplified = "High" if "High" in vuln else "Medium" if "Medium" in vuln else "Low" if "Low" in vuln or "Unlikely" in vuln else "Possible"
            try:
                cur.execute("INSERT INTO liquefaction_zones (source, liquefaction, simplified, geom) VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))",
                    ("TCC", vuln, simplified, wkt))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["liquefaction"] = inserted

    # 3. Tsunami Evacuation Zone
    logger.info("=== Tauranga Tsunami ===")
    features = fetch_all(f"{TCC_BASE}/Natural_Hazards__multiple_data_sources/MapServer/26", "TCC Tsunami")
    if dry_run:
        logger.info(f"  {len(features)} tsunami polygons")
    else:
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            wkt = geom_to_wkt(f.get("geometry"))
            if not wkt:
                continue
            try:
                cur.execute("INSERT INTO tsunami_zones (zone_class, evac_zone, location, info, geom) VALUES (%s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))",
                    (2, "Blue", "Tauranga", a.get("AreaType") or "Evacuation Zone", wkt))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["tsunami"] = inserted

    # 4. Contaminated Land
    logger.info("=== Tauranga Contaminated Land ===")
    features = fetch_all(f"{TCC_BASE}/Man_Made_Hazards/MapServer/1", "TCC Contaminated")
    if dry_run:
        logger.info(f"  {len(features)} contaminated land polygons")
    else:
        cur = conn.cursor()
        inserted = 0
        for f in features:
            a = f["attributes"]
            wkt = geom_to_wkt(f.get("geometry"))
            if not wkt:
                continue
            try:
                cur.execute("INSERT INTO contaminated_land (site_name, category, local_authority, source_council, geom) VALUES (%s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))",
                    (a.get("LfCode") or "Land Use Info", a.get("ParcelID") or "", "Tauranga City", "TCC", wkt))
                inserted += 1
            except:
                conn.rollback()
        conn.commit()
        results["contaminated"] = inserted

    return results


def main(args):
    import psycopg
    from psycopg.rows import dict_row

    conninfo = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/wharescore")
    conn = psycopg.connect(conninfo, row_factory=dict_row, autocommit=False)

    regions = ["auckland", "hamilton", "tauranga"] if args.region == "all" else [args.region]

    for region in regions:
        logger.info(f"\n{'='*60}")
        logger.info(f"  LOADING: {region.upper()}")
        logger.info(f"{'='*60}")

        start = time.time()
        if region == "auckland":
            results = load_auckland(conn, args.dry_run)
        elif region == "hamilton":
            results = load_hamilton(conn, args.dry_run)
        elif region == "tauranga":
            results = load_tauranga(conn, args.dry_run)
        else:
            logger.error(f"Unknown region: {region}")
            continue

        elapsed = time.time() - start
        if not args.dry_run:
            logger.info(f"\n{region.upper()} done in {elapsed:.1f}s:")
            for k, v in results.items():
                logger.info(f"  {k}: {v} rows")

    conn.close()
    logger.info("\nAll done!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load regional hazard data")
    parser.add_argument("--region", required=True, help="auckland, hamilton, tauranga, or all")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(args)
