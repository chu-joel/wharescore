#!/usr/bin/env python3
"""
Bulk loader for Taranaki (New Plymouth) property valuations.

Fetches all properties from the Taranaki ArcGIS FeatureServer and inserts
them into the council_valuations table.

~64K properties, takes about 2-3 minutes.

Usage:
    cd backend
    python scripts/load_taranaki_rates.py [--dry-run] [--clear]
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

TARANAKI_QUERY_URL = (
    "https://services.arcgis.com/MMPHUPU6MnEt0lEK/arcgis/rest/services/"
    "Property_Rating/FeatureServer/0/query"
)

OUT_FIELDS = ",".join([
    "Assessment", "Property_Address", "Legal_Description", "Land_Area",
    "Capital_Value", "Land_Value", "District_Rates", "Regional_Rates",
    "Total_Rates", "Valuation_Date",
])

PAGE_SIZE = 2000


def fetch_page(offset: int) -> list[dict]:
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
    for attempt in range(3):
        try:
            resp = requests.get(TARANAKI_QUERY_URL, params=params, timeout=30,
                                headers={"User-Agent": "WhareScore/1.0"})
            resp.raise_for_status()
            data = resp.json()
            return data.get("features", [])
        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt < 2:
                logger.warning(f"  Retry {attempt+1}/3: {e}")
                time.sleep((attempt + 1) * 3)
            else:
                raise


def polygon_centroid(rings):
    ring = rings[0]
    n = len(ring)
    if n == 0:
        return 0.0, 0.0
    return sum(p[0] for p in ring) / n, sum(p[1] for p in ring) / n


def main(args):
    import psycopg
    from psycopg.rows import dict_row

    conninfo = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/wharescore",
    )
    conn = psycopg.connect(conninfo, row_factory=dict_row)

    if args.clear:
        logger.info("Clearing existing Taranaki data...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'taranaki'")
        conn.commit()
        logger.info("Cleared.")

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
        for f in all_features[:10]:
            a = f["attributes"]
            cv = a.get("Capital_Value") or 0
            lv = a.get("Land_Value") or 0
            addr = a.get("Property_Address") or ""
            print(f"  {addr:50s} CV=${cv:>10,}  LV=${lv:>10,}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    seen = set()
    unique = []
    for f in all_features:
        vid = f["attributes"].get("Assessment")
        if vid and vid not in seen:
            seen.add(vid)
            unique.append(f)
        elif not vid:
            unique.append(f)
    logger.info(f"Unique properties: {len(unique)}")

    start = time.time()
    inserted = 0
    skipped = 0

    insert_sql = """
        INSERT INTO council_valuations (
            council, valuation_id, address, full_address,
            capital_value, land_value, improvements_value,
            title, geom
        ) VALUES (
            'taranaki', %s, %s, %s,
            %s, %s, %s,
            %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        )
        ON CONFLICT DO NOTHING
    """

    cur = conn.cursor()
    batch = []

    for f in unique:
        a = f["attributes"]
        geom = f.get("geometry")

        cv = a.get("Capital_Value")
        if not cv:
            skipped += 1
            continue

        lv = a.get("Land_Value") or 0
        iv = cv - lv if cv and lv else 0

        lng, lat = 0.0, 0.0
        if geom:
            if geom.get("rings"):
                lng, lat = polygon_centroid(geom["rings"])
            elif "x" in geom:
                lng, lat = geom["x"], geom["y"]

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        address = a.get("Property_Address") or ""

        batch.append((
            str(a.get("Assessment")) if a.get("Assessment") else None,
            address,
            address,
            cv, lv, iv,
            a.get("Legal_Description"),
            lng, lat,
        ))

        if len(batch) >= 500:
            cur.executemany(insert_sql, batch)
            conn.commit()
            inserted += len(batch)
            logger.info(f"  Inserted {inserted} rows...")
            batch = []

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
    parser = argparse.ArgumentParser(description="Load Taranaki property valuations")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--clear", action="store_true")
    args = parser.parse_args()
    main(args)
