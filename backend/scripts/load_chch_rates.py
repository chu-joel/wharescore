#!/usr/bin/env python3
"""
Bulk loader for Christchurch City Council property valuations.

Fetches all properties from the CCC ArcGIS MapServer and inserts them
into the council_valuations table. Point geometry (not polygons).

~186K properties, takes about 3-5 minutes.

Note: CCC does NOT expose street addresses — only ValuationReference
and RateLegalDescription. Address matching relies on spatial join.

Usage:
    cd backend
    python scripts/load_chch_rates.py [--dry-run] [--clear]
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

CCC_QUERY_URL = (
    "https://gis.ccc.govt.nz/arcgis/rest/services/"
    "CorporateData/Rating/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "ValuationReference", "ValuationRollNumber",
    "RateLegalDescription", "CapitalValue", "LandValue", "ImprovementsValue",
])

PAGE_SIZE = 2000


def fetch_page(offset: int) -> list[dict]:
    """Fetch a page of properties from CCC ArcGIS.
    Note: CCC MapServer does NOT support orderByFields or outSR.
    Geometry is returned in NZGD2000 (EPSG:2193).
    """
    params = {
        "where": "1=1",
        "outFields": OUT_FIELDS,
        "returnGeometry": "true",
        "f": "json",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE_SIZE),
    }
    for attempt in range(3):
        try:
            resp = requests.get(CCC_QUERY_URL, params=params, timeout=30,
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


def main(args):
    import psycopg
    from psycopg.rows import dict_row

    conninfo = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/wharescore",
    )
    conn = psycopg.connect(conninfo, row_factory=dict_row)

    if args.clear:
        logger.info("Clearing existing Christchurch data...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'christchurch'")
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
        for f in all_features[:5]:
            a = f["attributes"]
            cv = a.get("CapitalValue") or 0
            lv = a.get("LandValue") or 0
            iv = a.get("ImprovementsValue") or 0
            print(f"  VR={a.get('ValuationReference',''):20s} CV=${cv:>10,}  LV=${lv:>10,}  IV=${iv:>10,}  {(a.get('RateLegalDescription') or '')[:40]}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by ValuationReference
    seen = set()
    unique = []
    for f in all_features:
        vid = f["attributes"].get("ValuationReference")
        if vid and vid not in seen:
            seen.add(vid)
            unique.append(f)
    logger.info(f"Unique properties: {len(unique)}")

    start = time.time()
    inserted = 0
    skipped = 0

    # CCC geometry is NZGD2000 (EPSG:2193) — transform to WGS84 in PostGIS
    insert_sql = """
        INSERT INTO council_valuations (
            council, valuation_id, address, full_address,
            capital_value, land_value, improvements_value,
            title, geom
        ) VALUES (
            'christchurch', %s, %s, %s,
            %s, %s, %s,
            %s, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 2193), 4326)
        )
        ON CONFLICT DO NOTHING
    """

    cur = conn.cursor()
    batch = []

    for f in unique:
        a = f["attributes"]
        geom = f.get("geometry")

        cv = a.get("CapitalValue")
        if not cv:
            skipped += 1
            continue

        lv = a.get("LandValue") or 0
        iv = a.get("ImprovementsValue") or 0

        # Coordinates are in NZGD2000 (easting/northing)
        x = geom.get("x", 0) if geom else 0
        y = geom.get("y", 0) if geom else 0

        if x == 0 and y == 0:
            skipped += 1
            continue

        legal = a.get("RateLegalDescription")

        batch.append((
            a.get("ValuationReference"),
            legal,
            legal,
            cv, lv, iv,
            legal,
            x, y,
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
    rate = inserted / elapsed if elapsed > 0 else 0
    logger.info(
        f"\nDone! Inserted {inserted} rows in {elapsed:.1f}s\n"
        f"  Skipped: {skipped} (no CV or geometry)\n"
        f"  Rate:    {rate:.0f} rows/sec"
    )
    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load Christchurch property valuations")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--clear", action="store_true")
    args = parser.parse_args()
    main(args)
