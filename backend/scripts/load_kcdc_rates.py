#!/usr/bin/env python3
"""
Bulk loader for Kapiti Coast District Council property valuations.

Fetches all properties from the KCDC ArcGIS MapServer and inserts them
into the council_valuations table. Uses pagination (2000 records/page).

~27K properties, takes about 1-2 minutes.

Usage:
    cd backend
    python scripts/load_kcdc_rates.py [--dry-run] [--clear]
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

KCDC_QUERY_URL = (
    "https://maps.kapiticoast.govt.nz/server/rest/services/"
    "Public/Property_Public/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "Valuation_ID", "Location", "Capital_Value", "Land_Value",
    "Improvements_Value", "Legal", "Latitude", "Longitude",
])

PAGE_SIZE = 2000


def fetch_page(offset: int) -> list[dict]:
    """Fetch a page of properties from KCDC ArcGIS."""
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
    resp = requests.get(KCDC_QUERY_URL, params=params, timeout=30,
                        headers={"User-Agent": "WhareScore/1.0"})
    resp.raise_for_status()
    data = resp.json()
    return data.get("features", [])


def polygon_centroid(rings: list[list[list[float]]]) -> tuple[float, float]:
    """Compute centroid of a polygon from its rings (simple average)."""
    ring = rings[0]
    n = len(ring)
    if n == 0:
        return 0.0, 0.0
    sx = sum(p[0] for p in ring)
    sy = sum(p[1] for p in ring)
    return sx / n, sy / n


def parse_address(location: str) -> tuple[str | None, str | None]:
    """Extract street number and street name from KCDC address.
    '93B Pukenamu Road, Te Horo' → ('93B', 'Pukenamu Road')
    '102 Waitohu Valley Road, Otaki' → ('102', 'Waitohu Valley Road')
    """
    if not location:
        return None, None
    street_part = location.split(",")[0].strip()
    tokens = street_part.split()
    if len(tokens) < 2:
        return None, None
    street_num = tokens[0]
    street_types = {
        "Street", "Road", "Avenue", "Drive", "Place", "Crescent", "Terrace",
        "Lane", "Way", "Close", "Court", "Grove", "Rise", "Heights",
        "Parade", "Boulevard", "Mews", "View", "Loop", "Track",
    }
    street_words = []
    for tok in tokens[1:]:
        street_words.append(tok)
        if tok in street_types:
            break
    street_name = " ".join(street_words) if street_words else None
    return street_num, street_name


def main(args):
    import psycopg
    from psycopg.rows import dict_row

    conninfo = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/wharescore",
    )
    conn = psycopg.connect(conninfo, row_factory=dict_row)

    if args.clear:
        logger.info("Clearing existing KCDC data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'KCDC'")
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
        for f in all_features[:5]:
            a = f["attributes"]
            cv = a.get("Capital_Value") or 0
            lv = a.get("Land_Value") or 0
            print(f"  {(a.get('Location') or ''):50s} CV=${cv:>10,}  LV=${lv:>10,}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by valuation ID
    seen = set()
    unique_features = []
    for f in all_features:
        vid = f["attributes"].get("Valuation_ID")
        if vid and vid not in seen:
            seen.add(vid)
            unique_features.append(f)
    logger.info(f"Unique properties (by Valuation_ID): {len(unique_features)}")

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
            'KCDC', %s, %s, %s,
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

        cv = a.get("Capital_Value")
        if not cv:
            skipped += 1
            continue

        lv = a.get("Land_Value") or 0
        iv = a.get("Improvements_Value") or (cv - lv)

        # Prefer Latitude/Longitude fields, fall back to polygon centroid
        lat = a.get("Latitude") or 0.0
        lng = a.get("Longitude") or 0.0
        if (lng == 0.0 or lat == 0.0) and geom and geom.get("rings"):
            lng, lat = polygon_centroid(geom["rings"])

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        location = a.get("Location") or ""
        street_num, street_name = parse_address(location)

        batch.append((
            a.get("Valuation_ID"),
            street_num,
            street_name,
            location,
            location,
            cv, lv, iv,
            a.get("Legal"),
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
    parser = argparse.ArgumentParser(description="Load KCDC property valuations")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing KCDC data first")
    args = parser.parse_args()
    main(args)
