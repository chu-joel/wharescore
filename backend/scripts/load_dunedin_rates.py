#!/usr/bin/env python3
"""
Bulk loader for Dunedin City Council property valuations.

Fetches all properties from the DCC ArcGIS MapServer. The server has a
strict 1,000 records per page limit, so we paginate via OBJECTID ranges.

~58K properties, takes about 2-3 minutes.

Usage:
    cd backend
    python scripts/load_dunedin_rates.py [--dry-run] [--clear]
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

DCC_QUERY_URL = (
    "https://apps.dunedin.govt.nz/arcgis/rest/services/"
    "Public/Rates/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "OBJECTID", "Assessment_Number", "Formatted_address",
    "Rateable_Value", "Total_rates", "VGNumber",
    "Area_Ha", "Land_Use_Descript", "Diff_Category",
])

PAGE_SIZE = 1000


def fetch_page(min_oid: int) -> list[dict]:
    """Fetch a page of properties using OBJECTID range (more reliable than resultOffset
    when the server has a strict maxRecordCount)."""
    params = {
        "where": f"OBJECTID > {min_oid}",
        "outFields": OUT_FIELDS,
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json",
        "resultRecordCount": str(PAGE_SIZE),
        "orderByFields": "OBJECTID",
    }
    for attempt in range(3):
        try:
            resp = requests.get(DCC_QUERY_URL, params=params, timeout=30,
                                headers={"User-Agent": "WhareScore/1.0"})
            resp.raise_for_status()
            data = resp.json()
            return data.get("features", [])
        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt < 2:
                wait = (attempt + 1) * 3
                logger.warning(f"  Retry {attempt+1}/3 after error: {e}")
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


def parse_address(address: str) -> tuple[str | None, str | None]:
    """Extract street number and street name from Dunedin address.
    '18 Weka Street St Leonards' → ('18', 'Weka Street')
    '74 St Leonards Drive St Leonards' → ('74', 'St Leonards Drive')
    """
    if not address:
        return None, None
    address = address.strip()
    tokens = address.split()
    if len(tokens) < 2:
        return None, None
    street_num = tokens[0]
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
        logger.info("Clearing existing Dunedin data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'dunedin'")
        conn.commit()
        logger.info("Cleared.")

    # Fetch all pages using OBJECTID ranges
    all_features = []
    min_oid = 0
    while True:
        logger.info(f"Fetching page (OBJECTID > {min_oid})...")
        features = fetch_page(min_oid)
        if not features:
            break
        all_features.extend(features)
        # Get the max OBJECTID from this page for next query
        max_oid = max(f["attributes"]["OBJECTID"] for f in features)
        logger.info(f"  Got {len(features)} features (total: {len(all_features)}, max OID: {max_oid})")
        if len(features) < PAGE_SIZE:
            break
        min_oid = max_oid
        time.sleep(0.3)

    logger.info(f"Total features fetched: {len(all_features)}")

    if args.dry_run:
        for f in all_features[:5]:
            a = f["attributes"]
            rv = a.get("Rateable_Value") or 0
            rates = a.get("Total_rates") or 0
            addr = (a.get("Formatted_address") or "").strip()
            print(f"  {addr:50s} CV=${rv:>10,.0f}  Rates=${rates:>8,.2f}  VG={a.get('VGNumber', '').strip()}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by VGNumber (valuation number)
    seen = set()
    unique_features = []
    for f in all_features:
        vid = (f["attributes"].get("VGNumber") or "").strip()
        if vid and vid not in seen:
            seen.add(vid)
            unique_features.append(f)
        elif not vid:
            unique_features.append(f)
    logger.info(f"Unique properties (by VGNumber): {len(unique_features)}")

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
            'dunedin', %s, %s, %s,
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

        cv = a.get("Rateable_Value")
        if not cv:
            skipped += 1
            continue

        # DCC only provides Rateable_Value (capital value)
        # No separate land/improvements split available
        lv = 0
        iv = 0

        # Get centroid from polygon
        lng, lat = 0.0, 0.0
        if geom and geom.get("rings"):
            lng, lat = polygon_centroid(geom["rings"])

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        address = (a.get("Formatted_address") or "").strip()
        street_num, street_name = parse_address(address)
        vg_number = (a.get("VGNumber") or "").strip()

        batch.append((
            vg_number or None,
            street_num,
            street_name,
            address,
            address,
            int(cv), lv, iv,
            None,  # no title data
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
    parser = argparse.ArgumentParser(description="Load Dunedin property valuations")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing Dunedin data first")
    args = parser.parse_args()
    main(args)
