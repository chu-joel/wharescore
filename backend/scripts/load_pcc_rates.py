#!/usr/bin/env python3
"""
Bulk loader for Porirua City Council property valuations.

Fetches all properties from the PCC ArcGIS MapServer and inserts them
into the council_valuations table. Uses pagination (2000 records/page).

~24K properties, takes about 1 minute.

Usage:
    cd backend
    python scripts/load_pcc_rates.py [--dry-run] [--clear]
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

PCC_QUERY_URL = (
    "https://maps.poriruacity.govt.nz/server/rest/services/"
    "Property/PropertyAdminExternal/MapServer/5/query"
)

OUT_FIELDS = ",".join([
    "Address", "Valuation_No", "Total_Value", "Land_Value", "Imp_Value",
    "PCC_rates", "GW_rates", "Rates_Category", "TITLES", "FULL_APP",
])

PAGE_SIZE = 2000


def fetch_page(offset: int) -> list[dict]:
    """Fetch a page of properties from PCC ArcGIS."""
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
    resp = requests.get(PCC_QUERY_URL, params=params, timeout=30,
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


def parse_address(address: str) -> tuple[str | None, str | None]:
    """Extract street number and street name from PCC address.
    '42 Mungavin Avenue Ranui Heights, Porirua City 5024'
    → ('42', 'Mungavin Avenue')
    '2/10 Doris Street Elsdon, Porirua City 5022'
    → ('2/10', 'Doris Street')
    """
    if not address:
        return None, None
    # Strip suburb/city suffix after comma
    street_part = address.split(",")[0].strip()
    # Split into tokens: first is number, rest is street
    tokens = street_part.split()
    if len(tokens) < 2:
        return None, None
    street_num = tokens[0]
    # Find the street name (words until we hit suburb — heuristic: take 2-3 words)
    # PCC format: "42 Mungavin Avenue Ranui Heights" — street type words end the street name
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
        logger.info("Clearing existing PCC data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'PCC'")
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
            cv = a.get("Total_Value") or 0
            lv = a.get("Land_Value") or 0
            print(f"  {(a.get('Address') or ''):50s} CV=${cv:>10,.0f}  LV=${lv:>10,.0f}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by valuation number
    seen = set()
    unique_features = []
    for f in all_features:
        vid = f["attributes"].get("Valuation_No")
        if vid and vid not in seen:
            seen.add(vid)
            unique_features.append(f)
    logger.info(f"Unique properties (by Valuation_No): {len(unique_features)}")

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
            'PCC', %s, %s, %s,
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

        cv = a.get("Total_Value")
        if not cv:
            skipped += 1
            continue

        lv = a.get("Land_Value") or 0
        iv = a.get("Imp_Value") or (cv - lv)

        # Get centroid from polygon
        lng, lat = 0.0, 0.0
        if geom and geom.get("rings"):
            lng, lat = polygon_centroid(geom["rings"])

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        address = a.get("Address") or ""
        street_num, street_name = parse_address(address)

        batch.append((
            a.get("Valuation_No"),
            street_num,
            street_name,
            address,
            address,
            cv, lv, iv,
            a.get("TITLES"),
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
    parser = argparse.ArgumentParser(description="Load PCC property valuations")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing PCC data first")
    args = parser.parse_args()
    main(args)
