#!/usr/bin/env python3
"""
Bulk loader for Tauranga City Council property valuations.

Fetches all properties from two TCC ArcGIS FeatureServer layers:
  1. Capital_Value_Total_2023 (64K records) — valuations + geometry
  2. Property (89K records) — addresses + legal descriptions

Joins by VNZ and inserts into the council_valuations table.
Uses pagination (2000 records/page).

~64K properties, takes about 2-4 minutes.

Usage:
    cd backend
    python scripts/load_tcc_rates.py [--dry-run] [--clear]
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

# Capital Value layer — valuations + polygon geometry
TCC_VALUATION_URL = (
    "https://gis.tauranga.govt.nz/server/rest/services/"
    "Capital_Value_Total_2023/FeatureServer/10/query"
)

# Property layer — addresses + legal descriptions
TCC_PROPERTY_URL = (
    "https://gis.tauranga.govt.nz/server/rest/services/"
    "Property/FeatureServer/12/query"
)

VALUATION_FIELDS = (
    "VNZ,ASSESSMENT,CV2023,LV2023,VI2023,AnnualRates,LandArea"
)
PROPERTY_FIELDS = "VNZ,LOCATIONADDRESS,LEGALDESC"

PAGE_SIZE = 2000


def fetch_page(url: str, fields: str, offset: int, with_geometry: bool = False) -> list[dict]:
    """Fetch a page of records from TCC ArcGIS."""
    params = {
        "where": "1=1",
        "outFields": fields,
        "returnGeometry": str(with_geometry).lower(),
        "f": "json",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE_SIZE),
        "orderByFields": "OBJECTID",
    }
    if with_geometry:
        params["outSR"] = "4326"

    resp = requests.get(url, params=params, timeout=60,
                        headers={"User-Agent": "WhareScore/1.0"})
    resp.raise_for_status()
    data = resp.json()
    return data.get("features", [])


def fetch_all(url: str, fields: str, label: str, with_geometry: bool = False) -> list[dict]:
    """Fetch all records from a layer with pagination."""
    all_features = []
    offset = 0
    while True:
        logger.info(f"[{label}] Fetching offset {offset}...")
        features = fetch_page(url, fields, offset, with_geometry)
        if not features:
            break
        all_features.extend(features)
        logger.info(f"  Got {len(features)} (total: {len(all_features)})")
        if len(features) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return all_features


def polygon_centroid(rings: list[list[list[float]]]) -> tuple[float, float]:
    """Compute centroid of a polygon from its rings (simple average)."""
    ring = rings[0]  # outer ring
    n = len(ring)
    if n == 0:
        return 0.0, 0.0
    sx = sum(p[0] for p in ring)
    sy = sum(p[1] for p in ring)
    return sx / n, sy / n


def main(args):
    import psycopg
    from psycopg.rows import dict_row

    conninfo = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/wharescore",
    )
    conn = psycopg.connect(conninfo, row_factory=dict_row)

    if args.clear:
        logger.info("Clearing existing TCC data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'TCC'")
        conn.commit()
        logger.info("Cleared.")

    # Step 1: Fetch property addresses (no geometry needed)
    logger.info("=== Fetching Property addresses ===")
    property_features = fetch_all(TCC_PROPERTY_URL, PROPERTY_FIELDS, "Property")
    logger.info(f"Total property records: {len(property_features)}")

    # Build address lookup by VNZ
    address_map: dict[str, dict] = {}
    for f in property_features:
        a = f["attributes"]
        vnz = a.get("VNZ")
        if vnz:
            address_map[vnz] = {
                "address": a.get("LOCATIONADDRESS"),
                "legal_desc": a.get("LEGALDESC"),
            }
    logger.info(f"Address lookup built: {len(address_map)} entries")

    # Step 2: Fetch valuations with geometry
    logger.info("=== Fetching Capital Value data ===")
    val_features = fetch_all(TCC_VALUATION_URL, VALUATION_FIELDS, "Valuations", with_geometry=True)
    logger.info(f"Total valuation records: {len(val_features)}")

    if args.dry_run:
        # Show sample
        for f in val_features[:5]:
            a = f["attributes"]
            vnz = a.get("VNZ", "")
            addr_info = address_map.get(vnz, {})
            addr = addr_info.get("address", "?")
            cv = a.get("CV2023") or 0
            lv = a.get("LV2023") or 0
            print(f"  {addr:40s} CV=${cv:>10,}  LV=${lv:>10,}  VNZ={vnz}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by VNZ
    seen = set()
    unique_features = []
    for f in val_features:
        vnz = f["attributes"].get("VNZ")
        if vnz and vnz not in seen:
            seen.add(vnz)
            unique_features.append(f)
    logger.info(f"Unique properties (by VNZ): {len(unique_features)}")

    # Insert into council_valuations
    start = time.time()
    inserted = 0
    skipped = 0

    insert_sql = """
        INSERT INTO council_valuations (
            council, valuation_id, street_number, street_name,
            address, full_address,
            capital_value, land_value, improvements_value,
            legal_description, geom
        ) VALUES (
            'TCC', %s, %s, %s,
            %s, %s,
            %s, %s, %s,
            %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        )
        ON CONFLICT DO NOTHING
    """

    cur = conn.cursor()
    batch = []

    for f in unique_features:
        a = f["attributes"]
        geom = f.get("geometry")
        vnz = a.get("VNZ")

        cv = a.get("CV2023")
        if not cv:
            skipped += 1
            continue

        lv = a.get("LV2023") or 0
        vi = a.get("VI2023")
        if vi is None:
            vi = cv - lv

        # Get centroid from polygon
        lng, lat = 0.0, 0.0
        if geom and geom.get("rings"):
            lng, lat = polygon_centroid(geom["rings"])

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        # Look up address from Property layer
        addr_info = address_map.get(vnz, {})
        full_address = addr_info.get("address", "")
        legal_desc = addr_info.get("legal_desc")

        # Parse street number and name from address
        street_number = None
        street_name = None
        if full_address:
            parts = full_address.split(" ", 1)
            if len(parts) == 2 and parts[0][0:1].isdigit():
                street_number = parts[0]
                street_name = parts[1]
            else:
                street_name = full_address

        batch.append((
            vnz,
            street_number,
            street_name,
            full_address,
            f"{full_address}, Tauranga" if full_address else None,
            cv, lv, vi,
            legal_desc,
            lng, lat,
        ))

        if len(batch) >= 500:
            cur.executemany(insert_sql, batch)
            conn.commit()
            inserted += len(batch)
            logger.info(f"  Inserted {inserted} rows...")
            batch = []

    # Final batch
    if batch:
        cur.executemany(insert_sql, batch)
        conn.commit()
        inserted += len(batch)

    elapsed = time.time() - start
    logger.info(
        f"\nDone! Inserted {inserted} rows in {elapsed:.1f}s\n"
        f"  Skipped: {skipped} (no CV or geometry)\n"
        f"  No address: {sum(1 for f in unique_features if f['attributes'].get('VNZ') not in address_map)}\n"
        f"  Rate:    {inserted / max(elapsed, 0.1):.0f} rows/sec"
    )

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load TCC property valuations")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing TCC data first")
    args = parser.parse_args()
    main(args)
