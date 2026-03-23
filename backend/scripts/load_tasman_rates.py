#!/usr/bin/env python3
"""
Bulk loader for Tasman District Council property valuations.

Fetches all properties from the Tasman ArcGIS MapServer and inserts them
into the council_valuations table.

~29K properties, takes about 1-2 minutes.

Usage:
    cd backend
    python scripts/load_tasman_rates.py [--dry-run] [--clear]
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

TASMAN_QUERY_URL = (
    "https://gispublic.tasman.govt.nz/server/rest/services/"
    "OpenData/OpenData_Property/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "ValuationAssessment", "PropertyLocation", "ValuationLegalDescription",
    "ValuationTitleReference", "CapitalValue", "LandValue", "ImprovementsValue",
    "Improvements", "PrimaryLandUse", "WGS84_INSIDE_X", "WGS84_INSIDE_Y",
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
            resp = requests.get(TASMAN_QUERY_URL, params=params, timeout=30,
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


def parse_address(location: str) -> tuple[str | None, str | None]:
    if not location:
        return None, None
    street_part = location.split(",")[0].strip()
    tokens = street_part.split()
    if len(tokens) < 2:
        return None, None
    street_num = tokens[0]
    if not any(c.isdigit() for c in street_num):
        return None, None
    street_types = {
        "Street", "Road", "Avenue", "Drive", "Place", "Crescent", "Terrace",
        "Lane", "Way", "Close", "Court", "Grove", "Rise", "Heights",
        "Parade", "Boulevard", "Mews", "View", "Loop", "Track", "Highway",
    }
    street_words = []
    for tok in tokens[1:]:
        street_words.append(tok)
        if tok in street_types:
            break
    return street_num, " ".join(street_words) if street_words else None


def main(args):
    import psycopg
    from psycopg.rows import dict_row

    conninfo = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/wharescore",
    )
    conn = psycopg.connect(conninfo, row_factory=dict_row)

    if args.clear:
        logger.info("Clearing existing Tasman data...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'tasman'")
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
            addr = a.get("PropertyLocation") or ""
            print(f"  {addr:50s} CV=${cv:>10,}  LV=${lv:>10,}  IV=${iv:>10,}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    seen = set()
    unique = []
    for f in all_features:
        vid = f["attributes"].get("ValuationAssessment")
        if vid and vid not in seen:
            seen.add(vid)
            unique.append(f)
    logger.info(f"Unique properties: {len(unique)}")

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
            'tasman', %s, %s, %s,
            %s, %s,
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

        cv = a.get("CapitalValue")
        if not cv:
            skipped += 1
            continue

        lv = a.get("LandValue") or 0
        iv = a.get("ImprovementsValue") or 0

        # Prefer WGS84 attribute fields, fall back to geometry
        lng = a.get("WGS84_INSIDE_X") or 0.0
        lat = a.get("WGS84_INSIDE_Y") or 0.0
        if (lng == 0.0 or lat == 0.0) and geom:
            if geom.get("rings"):
                lng, lat = polygon_centroid(geom["rings"])
            elif "x" in geom:
                lng, lat = geom["x"], geom["y"]

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        address = a.get("PropertyLocation") or ""
        street_num, street_name = parse_address(address)

        batch.append((
            a.get("ValuationAssessment"),
            street_num,
            street_name,
            address,
            address,
            cv, lv, iv,
            a.get("ValuationTitleReference"),
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
    parser = argparse.ArgumentParser(description="Load Tasman property valuations")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--clear", action="store_true")
    args = parser.parse_args()
    main(args)
