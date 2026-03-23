#!/usr/bin/env python3
"""
Bulk loader for Western Bay of Plenty District Council property valuations.

Fetches all properties from four WBOPDC ArcGIS MapServer layers:
  1. Parcels (layer 12, 36K records) — addresses + legal descriptions + geometry
  2. Capital Value (layer 4, 71K records) — CV by ValuationNumber
  3. Land Value (layer 5, 40K records) — LV by ValuationNumber
  4. Improvement Value (layer 6, 46K records) — IV by ValuationNumber

Joins by ValuationNumber and inserts into the council_valuations table.
Parcel ValuationID format "06819*321*09*" is converted to ValuationNumber "681932109".

~36K properties, takes about 2-4 minutes.

Usage:
    cd backend
    python scripts/load_wbop_rates.py [--dry-run] [--clear]
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

# Parcels layer — addresses + legal descriptions + polygon geometry
WBOP_PARCELS_URL = (
    "https://map.westernbay.govt.nz/arcgisext/rest/services/"
    "Property/MapServer/12/query"
)

# Capital Value layer
WBOP_CV_URL = (
    "https://map.westernbay.govt.nz/arcgisext/rest/services/"
    "Property/MapServer/4/query"
)

# Land Value layer
WBOP_LV_URL = (
    "https://map.westernbay.govt.nz/arcgisext/rest/services/"
    "Property/MapServer/5/query"
)

# Improvement Value layer
WBOP_IV_URL = (
    "https://map.westernbay.govt.nz/arcgisext/rest/services/"
    "Property/MapServer/6/query"
)

PARCEL_FIELDS = "ParcelID,ValuationID,ParcelAddress,ValuationAddress,LegalDescription,LegalArea"
CV_FIELDS = "ValuationNumber,CapitalValue"
LV_FIELDS = "ValuationNumber,LandValue,PPH"
IV_FIELDS = "ValuationNumber,ImprovementValue"

PAGE_SIZE = 2000


def valuation_id_to_number(val_id: str) -> str:
    """Convert ValuationID format to ValuationNumber format.

    ValuationID: "06819*321*09*" → strip * → "0681932109" → strip leading 0 → "681932109"
    ValuationNumber: "681932109"
    """
    stripped = val_id.replace("*", "")
    return stripped.lstrip("0") or "0"


def parse_currency(val: str | None) -> int | None:
    """Parse currency string like '280,000' or '17,000' to integer."""
    if val is None:
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def fetch_page(url: str, fields: str, offset: int, with_geometry: bool = False) -> list[dict]:
    """Fetch a page of records from WBOP ArcGIS."""
    params = {
        "where": "1=1",
        "outFields": fields,
        "returnGeometry": str(with_geometry).lower(),
        "f": "json",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE_SIZE),
        "orderByFields": "OBJECTID",
    }
    if with_geometry:
        params["outSR"] = "4326"

    resp = requests.get(url, params=params, timeout=60,
                        headers={"User-Agent": "WhareScore/1.0"})
    resp.raise_for_status()
    data = resp.json()
    return data.get("features", [])


def fetch_all(url: str, fields: str, label: str, with_geometry: bool = False) -> list[dict]:
    """Fetch all records from a layer with pagination."""
    all_features = []
    offset = 0
    while True:
        logger.info(f"[{label}] Fetching offset {offset}...")
        features = fetch_page(url, fields, offset, with_geometry)
        if not features:
            break
        all_features.extend(features)
        logger.info(f"  Got {len(features)} (total: {len(all_features)})")
        if len(features) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return all_features


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
        logger.info("Clearing existing WBOP data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'WBOP'")
        conn.commit()
        logger.info("Cleared.")

    # Step 1: Fetch parcels with geometry (36K — fits in one page of 40K max)
    logger.info("=== Fetching Parcels (layer 12) ===")
    parcel_features = fetch_all(WBOP_PARCELS_URL, PARCEL_FIELDS, "Parcels", with_geometry=True)
    logger.info(f"Total parcel records: {len(parcel_features)}")

    # Step 2: Fetch capital values (71K — needs pagination)
    logger.info("=== Fetching Capital Values (layer 4) ===")
    cv_features = fetch_all(WBOP_CV_URL, CV_FIELDS, "CapitalValue")
    logger.info(f"Total CV records: {len(cv_features)}")

    # Step 3: Fetch land values (40K — may need pagination)
    logger.info("=== Fetching Land Values (layer 5) ===")
    lv_features = fetch_all(WBOP_LV_URL, LV_FIELDS, "LandValue")
    logger.info(f"Total LV records: {len(lv_features)}")

    # Step 4: Fetch improvement values (46K — needs pagination)
    logger.info("=== Fetching Improvement Values (layer 6) ===")
    iv_features = fetch_all(WBOP_IV_URL, IV_FIELDS, "ImprovementValue")
    logger.info(f"Total IV records: {len(iv_features)}")

    # Build lookup dicts by ValuationNumber
    cv_map: dict[str, int | None] = {}
    for f in cv_features:
        a = f["attributes"]
        vn = a.get("ValuationNumber")
        if vn:
            cv_map[str(vn).strip()] = parse_currency(a.get("CapitalValue"))
    logger.info(f"CV lookup built: {len(cv_map)} entries")

    lv_map: dict[str, int | None] = {}
    for f in lv_features:
        a = f["attributes"]
        vn = a.get("ValuationNumber")
        if vn:
            lv_map[str(vn).strip()] = parse_currency(a.get("LandValue"))
    logger.info(f"LV lookup built: {len(lv_map)} entries")

    iv_map: dict[str, int | None] = {}
    for f in iv_features:
        a = f["attributes"]
        vn = a.get("ValuationNumber")
        if vn:
            iv_map[str(vn).strip()] = parse_currency(a.get("ImprovementValue"))
    logger.info(f"IV lookup built: {len(iv_map)} entries")

    if args.dry_run:
        # Show sample
        for f in parcel_features[:5]:
            a = f["attributes"]
            val_id = a.get("ValuationID", "")
            val_num = valuation_id_to_number(val_id) if val_id else "?"
            addr = a.get("ParcelAddress", "?")
            cv = cv_map.get(val_num)
            lv = lv_map.get(val_num)
            iv = iv_map.get(val_num)
            cv_str = f"${cv:>10,}" if cv else "        N/A"
            lv_str = f"${lv:>10,}" if lv else "        N/A"
            iv_str = f"${iv:>10,}" if iv else "        N/A"
            print(f"  {addr:40s} CV={cv_str}  LV={lv_str}  IV={iv_str}  VN={val_num}")
        logger.info("Dry run — no data inserted.")
        conn.close()
        return

    # Deduplicate by ValuationNumber (multiple parcels may share one valuation)
    seen_val_numbers: set[str] = set()
    unique_features: list[dict] = []
    for f in parcel_features:
        a = f["attributes"]
        val_id = a.get("ValuationID")
        if not val_id:
            continue
        val_num = valuation_id_to_number(val_id)
        if val_num not in seen_val_numbers:
            seen_val_numbers.add(val_num)
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
            legal_description, geom
        ) VALUES (
            'WBOP', %s, %s, %s,
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
        val_id = a.get("ValuationID", "")
        val_num = valuation_id_to_number(val_id)

        cv = cv_map.get(val_num)
        if not cv:
            skipped += 1
            continue

        lv = lv_map.get(val_num) or 0
        iv = iv_map.get(val_num)
        if iv is None:
            iv = cv - lv

        # Get centroid from polygon
        lng, lat = 0.0, 0.0
        if geom and geom.get("rings"):
            lng, lat = polygon_centroid(geom["rings"])

        if lng == 0.0 and lat == 0.0:
            skipped += 1
            continue

        parcel_address = a.get("ParcelAddress") or ""
        legal_desc = a.get("LegalDescription")

        # Parse street number and name from address
        street_number = None
        street_name = None
        if parcel_address:
            parts = parcel_address.split(" ", 1)
            if len(parts) == 2 and parts[0][0:1].isdigit():
                street_number = parts[0]
                street_name = parts[1]
            else:
                street_name = parcel_address

        full_address = f"{parcel_address}, Western Bay of Plenty" if parcel_address else None

        batch.append((
            val_num,
            street_number,
            street_name,
            parcel_address,
            full_address,
            cv, lv, iv,
            legal_desc,
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
        f"  CV matches: {sum(1 for vn in seen_val_numbers if vn in cv_map)}/{len(seen_val_numbers)}\n"
        f"  LV matches: {sum(1 for vn in seen_val_numbers if vn in lv_map)}/{len(seen_val_numbers)}\n"
        f"  IV matches: {sum(1 for vn in seen_val_numbers if vn in iv_map)}/{len(seen_val_numbers)}\n"
        f"  Rate:    {inserted / max(elapsed, 0.1):.0f} rows/sec"
    )

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load WBOP property valuations")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing WBOP data first")
    args = parser.parse_args()
    main(args)
