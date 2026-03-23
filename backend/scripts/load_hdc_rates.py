#!/usr/bin/env python3
"""
Bulk loader for Horowhenua District Council property valuations.

Fetches Horowhenua properties from the Horizons Regional Council ArcGIS
MapServer (which hosts property data for all TAs in the Horizons region)
and inserts them into the council_valuations table.

~19K properties, takes about 1-2 minutes.

Usage:
    cd backend
    python scripts/load_hdc_rates.py [--dry-run] [--clear]
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

# Horizons Regional Council hosts property data for all TAs in the region
HORIZONS_QUERY_URL = (
    "https://maps.horizons.govt.nz/arcgis/rest/services/"
    "LocalMapsPublic/Public_Property/MapServer/1/query"
)

OUT_FIELDS = ",".join([
    "VnzLocation", "VnzCapitalValue", "VnzLandValue",
    "VnzLegalDescription", "ValuationNumber", "TerritorialAuthority",
])

PAGE_SIZE = 2000


def fetch_page(offset: int, retries: int = 3) -> list[dict]:
    """Fetch a page of Horowhenua properties from Horizons ArcGIS."""
    params = {
        "where": "TerritorialAuthority LIKE '%Horowhenua%'",
        "outFields": OUT_FIELDS,
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE_SIZE),
        "orderByFields": "OBJECTID",
    }
    for attempt in range(retries):
        try:
            resp = requests.get(HORIZONS_QUERY_URL, params=params, timeout=60,
                                headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            data = resp.json()
            return data.get("features", [])
        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt < retries - 1:
                wait = (attempt + 1) * 3
                logger.warning(f"  Retry {attempt+1}/{retries} after error: {e}")
                time.sleep(wait)
            else:
                raise


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
    """Extract street number and street name from Horizons address.
    '1 Oxford Street Levin' → ('1', 'Oxford Street')
    '23A Queen Street Foxton' → ('23A', 'Queen Street')
    """
    if not location:
        return None, None
    tokens = location.strip().split()
    if len(tokens) < 2:
        return None, None
    street_num = tokens[0]
    # Check if first token looks like a street number
    if not any(c.isdigit() for c in street_num):
        return None, None
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
        logger.info("Clearing existing HDC data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'HDC'")
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
        time.sleep(0.5)  # be gentle on Horizons server

    logger.info(f"Total features fetched: {len(all_features)}")

    if args.dry_run:
        for f in all_features[:5]:
            a = f["attributes"]
            cv = a.get("VnzCapitalValue") or 0
            lv = a.get("VnzLandValue") or 0
            print(f"  {(a.get('VnzLocation') or ''):50s} CV=${cv:>10,.0f}  LV=${lv:>10,.0f}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by valuation number
    seen = set()
    unique_features = []
    for f in all_features:
        vid = f["attributes"].get("ValuationNumber")
        if vid and vid not in seen:
            seen.add(vid)
            unique_features.append(f)
    logger.info(f"Unique properties (by ValuationNumber): {len(unique_features)}")

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
            'HDC', %s, %s, %s,
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

        cv = a.get("VnzCapitalValue")
        if not cv:
            skipped += 1
            continue

        lv = a.get("VnzLandValue") or 0
        iv = cv - lv

        # Get centroid from polygon
        lng, lat = 0.0, 0.0
        if geom and geom.get("rings"):
            lng, lat = polygon_centroid(geom["rings"])

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        location = a.get("VnzLocation") or ""
        street_num, street_name = parse_address(location)

        batch.append((
            a.get("ValuationNumber"),
            street_num,
            street_name,
            location,
            location,
            int(cv), int(lv), int(iv),
            a.get("VnzLegalDescription"),
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
    parser = argparse.ArgumentParser(description="Load Horowhenua property valuations")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing HDC data first")
    args = parser.parse_args()
    main(args)
