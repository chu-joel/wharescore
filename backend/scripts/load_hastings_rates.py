#!/usr/bin/env python3
"""
Bulk loader for Hastings District Council property data.

Fetches all properties from the HDC ArcGIS MapServer and inserts them
into the council_valuations table. Uses pagination (2000 records/page).

NOTE: This council has RATES but NO CV/LV. We still load it because the
address, geometry, legal description, and rates data are valuable.
CV/LV are set to 0 in the bulk table; the live service returns actual
rates from the API.

~34K properties, takes about 1-2 minutes.

Usage:
    cd backend
    python scripts/load_hastings_rates.py [--dry-run] [--clear]
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
import time

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

HDC_QUERY_URL = (
    "https://gismaps.hdc.govt.nz/server/rest/services/"
    "Property/Property_Data/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "PropertyNo", "PR_address", "RT_assessment_no", "RT_CurrentYear",
    "VAL_area", "PR_cert_of_title", "RT_override_legal", "Suburb",
])

PAGE_SIZE = 2000


def fetch_page(offset: int) -> list[dict]:
    """Fetch a page of properties from Hastings ArcGIS."""
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
    resp = requests.get(HDC_QUERY_URL, params=params, timeout=30,
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


def parse_address(pr_address: str) -> tuple[str | None, str | None]:
    """Parse street_number and street_name from PR_address.
    '117 Queen Street East HASTINGS 4122' → ('117', 'Queen Street East')
    '2/10 Pakowhai Road TOMOANA 4172' → ('2/10', 'Pakowhai Road')
    """
    if not pr_address:
        return None, None
    pr_address = pr_address.strip()
    # Match leading number (with optional unit like 2/10 or 10A)
    m = re.match(r"^(\d+[A-Za-z]?(?:/\d+[A-Za-z]?)?)\s+(.+)", pr_address)
    if not m:
        return None, pr_address
    street_number = m.group(1)
    remainder = m.group(2)
    # Strip suburb + postcode from end (uppercase word(s) followed by 4-digit postcode)
    # e.g. "Queen Street East HASTINGS 4122" → "Queen Street East"
    street_name = re.sub(r"\s+[A-Z]{2,}(?:\s+[A-Z]{2,})*\s+\d{4}\s*$", "", remainder)
    if not street_name:
        street_name = remainder
    return street_number, street_name


def main(args):
    import psycopg
    from psycopg.rows import dict_row

    conninfo = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/wharescore",
    )
    conn = psycopg.connect(conninfo, row_factory=dict_row)

    if args.clear:
        logger.info("Clearing existing HASTINGS data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'HASTINGS'")
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
            rates = a.get("RT_CurrentYear") or 0
            print(f"  {(a.get('PR_address') or ''):40s} Rates=${rates:>10,.2f}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by RT_assessment_no (multi-polygon parcels create dupes)
    seen = set()
    unique_features = []
    for f in all_features:
        vid = f["attributes"].get("RT_assessment_no")
        if vid and vid not in seen:
            seen.add(vid)
            unique_features.append(f)
    logger.info(f"Unique properties (by RT_assessment_no): {len(unique_features)}")

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
            'HASTINGS', %s, %s, %s,
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

        # Get centroid from polygon
        lng, lat = 0.0, 0.0
        if geom and geom.get("rings"):
            lng, lat = polygon_centroid(geom["rings"])

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        pr_address = a.get("PR_address") or ""
        street_number, street_name = parse_address(pr_address)

        # No CV/LV for Hastings — set to 0
        cv = 0
        lv = 0
        iv = 0

        batch.append((
            a.get("RT_assessment_no"),
            street_number,
            street_name,
            pr_address,
            pr_address,
            cv, lv, iv,
            a.get("PR_cert_of_title"),
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
        f"  Skipped: {skipped} (no geometry)\n"
        f"  Rate:    {inserted / elapsed:.0f} rows/sec"
    )

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load Hastings District Council property data")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing HASTINGS data first")
    args = parser.parse_args()
    main(args)
