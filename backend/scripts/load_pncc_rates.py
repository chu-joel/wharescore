#!/usr/bin/env python3
"""
Bulk loader for Palmerston North City Council property valuations.

Fetches all properties from the PNCC ArcGIS FeatureServer and inserts them
into the council_valuations table. Uses pagination (2000 records/page).

~46K properties, takes about 1-2 minutes.

Usage:
    cd backend
    python scripts/load_pncc_rates.py [--dry-run] [--clear]
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

PNCC_QUERY_URL = (
    "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/"
    "PROPERTY_PARCEL_VALUATION_VIEW/FeatureServer/0/query"
)

OUT_FIELDS = ",".join([
    "LOCATION", "VALUATION_NO", "RATES_LEGAL", "RATES_AREA",
    "RATES_ADDR", "RATES_AMOUNT", "CURR_LAND_VALUE",
    "CURR_CAPITAL_VALUE", "RATES_YEAR",
])

PAGE_SIZE = 2000


def parse_currency(v) -> float | None:
    """Parse PNCC currency strings like '$ 3988.89' or '$ 465000' to numeric."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        cleaned = str(v).replace("$", "").replace(",", "").strip()
        if not cleaned:
            return None
        return float(cleaned)
    except (TypeError, ValueError):
        return None


def fetch_page(offset: int) -> list[dict]:
    """Fetch a page of properties from PNCC ArcGIS."""
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
    resp = requests.get(PNCC_QUERY_URL, params=params, timeout=30,
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
        logger.info("Clearing existing PNCC data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'PNCC'")
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
            cv = parse_currency(a.get("CURR_CAPITAL_VALUE")) or 0
            lv = parse_currency(a.get("CURR_LAND_VALUE")) or 0
            loc = a.get("LOCATION", "")
            print(f"  {loc:40s} CV=${cv:>10,.0f}  LV=${lv:>10,.0f}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by VALUATION_NO
    seen = set()
    unique_features = []
    for f in all_features:
        vid = f["attributes"].get("VALUATION_NO")
        if vid and vid not in seen:
            seen.add(vid)
            unique_features.append(f)
    logger.info(f"Unique properties (by VALUATION_NO): {len(unique_features)}")

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
            'PNCC', %s, %s, %s,
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

        cv_raw = parse_currency(a.get("CURR_CAPITAL_VALUE"))
        if not cv_raw:
            skipped += 1
            continue

        cv = int(cv_raw)
        lv_raw = parse_currency(a.get("CURR_LAND_VALUE"))
        lv = int(lv_raw) if lv_raw else 0
        iv = cv - lv

        # Get centroid from polygon
        lng, lat = 0.0, 0.0
        if geom and geom.get("rings"):
            lng, lat = polygon_centroid(geom["rings"])

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        location = a.get("LOCATION") or ""

        # Parse street number and name from LOCATION
        street_number = None
        street_name = None
        if location:
            parts = location.split(" ", 1)
            if len(parts) == 2 and parts[0][0:1].isdigit():
                street_number = parts[0]
                street_name = parts[1]
            else:
                street_name = location

        full_address = f"{location}, Palmerston North" if location else None

        batch.append((
            a.get("VALUATION_NO"),
            street_number,
            street_name,
            location,
            full_address,
            cv, lv, iv,
            a.get("RATES_LEGAL"),
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
        f"  Rate:    {inserted / max(elapsed, 0.1):.0f} rows/sec"
    )

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load PNCC property valuations")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing PNCC data first")
    args = parser.parse_args()
    main(args)
