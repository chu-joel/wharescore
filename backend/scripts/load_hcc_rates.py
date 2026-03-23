#!/usr/bin/env python3
"""
Bulk loader for Hutt City Council property valuations.

Fetches all properties from the HCC ArcGIS MapServer and inserts them
into the council_valuations table. Uses pagination (2000 records/page).

~46K properties, takes about 1-2 minutes.

Usage:
    cd backend
    python scripts/load_hcc_rates.py [--dry-run] [--clear]
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

HCC_QUERY_URL = (
    "https://maps.huttcity.govt.nz/server01/rest/services/"
    "HCC_External_Data/MapServer/1/query"
)

OUT_FIELDS = ",".join([
    "property_id", "prop_address", "house_no_full", "street_name",
    "capital_value", "land_value",
    "council_rates", "regional_rates", "total_rates",
    "past_capital_value", "past_land_value",
    "valuation", "cert_of_title", "prop_improv",
])

PAGE_SIZE = 2000


def fetch_page(offset: int) -> list[dict]:
    """Fetch a page of properties from HCC ArcGIS."""
    params = {
        "where": "1=1",
        "outFields": OUT_FIELDS,
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE_SIZE),
        "orderByFields": "OBJECTID",
    }
    resp = requests.get(HCC_QUERY_URL, params=params, timeout=30,
                        headers={"User-Agent": "WhareScore/1.0"})
    resp.raise_for_status()
    data = resp.json()
    return data.get("features", [])


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
        logger.info("Clearing existing HCC data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'HCC'")
        conn.commit()
        logger.info("Cleared.")

    # Fetch all pages
    all_features = []
    offset = 0
    while True:
        logger.info(f"Fetching page at offset {offset}...")
        features = fetch_page(offset)
        if not features:
            break
        all_features.extend(features)
        logger.info(f"  Got {len(features)} features (total: {len(all_features)})")
        if len(features) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    logger.info(f"Total features fetched: {len(all_features)}")

    if args.dry_run:
        # Show sample
        for f in all_features[:5]:
            a = f["attributes"]
            print(f"  {a['prop_address']:40s} CV=${a['capital_value']:>10,}  LV=${a['land_value']:>10,}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by valuation_id (multi-polygon parcels create dupes)
    seen = set()
    unique_features = []
    for f in all_features:
        vid = f["attributes"].get("valuation")
        if vid and vid not in seen:
            seen.add(vid)
            unique_features.append(f)
    logger.info(f"Unique properties (by valuation): {len(unique_features)}")

    # Insert into council_valuations
    start = time.time()
    inserted = 0
    skipped = 0

    insert_sql = """
        INSERT INTO council_valuations (
            council, valuation_id, street_number, street_name,
            address, full_address,
            capital_value, land_value, improvements_value,
            title, geom
        ) VALUES (
            'HCC', %s, %s, %s,
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

        cv = a.get("capital_value")
        if not cv:
            skipped += 1
            continue

        lv = a.get("land_value") or 0
        iv = cv - lv

        # Get centroid from polygon
        lng, lat = 0.0, 0.0
        if geom and geom.get("rings"):
            lng, lat = polygon_centroid(geom["rings"])

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        batch.append((
            a.get("valuation"),
            a.get("house_no_full"),
            a.get("street_name"),
            a.get("prop_address"),
            a.get("prop_address"),
            cv, lv, iv,
            a.get("cert_of_title"),
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
        f"  Rate:    {inserted / elapsed:.0f} rows/sec"
    )

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load HCC property valuations")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing HCC data first")
    args = parser.parse_args()
    main(args)
