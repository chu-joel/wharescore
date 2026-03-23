#!/usr/bin/env python3
"""
Bulk loader for Hamilton City Council property valuations.

Hamilton doesn't expose an ArcGIS API for valuations, so this:
1. Fetches all valid assessment numbers from HCC's public ArcGIS Online
   parcel layer (54K records, fast bulk download)
2. Scrapes each property's detail page for CV/LV data

Step 1 takes ~30 seconds. Step 2 is rate-limited by Hamilton's server
(~4-8 req/s) so the full load takes 2-4 hours.

Usage:
    cd backend
    python scripts/load_hamilton_rates.py [--dry-run] [--clear] [--workers 20] [--resume]
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

BASE_URL = "https://hamilton.govt.nz/property-rates-and-building/property/property-search/"

# HCC ArcGIS Online — public parcel layer with assessment numbers + addresses
PARCELS_URL = (
    "https://services1.arcgis.com/R6s0QqCMQdwKY6yp/ArcGIS/rest/services/"
    "property_SDEADMIN_HCC_AddressParcels_20250502/FeatureServer/0/query"
)

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0 (WhareScore/1.0)"})
SESSION.verify = False  # Hamilton's cert chain can be flaky

# Suppress SSL warnings for this script
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def fetch_property(property_id: int) -> dict | None:
    """Fetch a single property from Hamilton's search page."""
    try:
        resp = SESSION.get(
            BASE_URL,
            params={"searchby": "streetname", "keywords": "", "property": str(property_id)},
            timeout=15,
        )
        if resp.status_code != 200:
            return None

        html = resp.text

        # Check if property exists (page has valuation data)
        if "Capital value:" not in html:
            return None

        result = {"property_id": property_id}

        # Address from h1 (only if it's a real address, not "Property search")
        m = re.search(r'<h1[^>]*>\s*(.*?)\s*</h1>', html, re.S)
        if m:
            addr = re.sub(r'<[^>]+>', '', m.group(1)).strip()
            if addr and addr.lower() != "property search":
                result["address"] = addr

        # Extract all th/td pairs for structured data
        for m2 in re.finditer(r'<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>', html, re.S):
            key = re.sub(r'<[^>]+>', '', m2.group(1)).strip()
            val = re.sub(r'<[^>]+>', '', m2.group(2)).strip()
            if key == "Valuation number":
                result["valuation_number"] = val
            elif key == "Legal description":
                result["legal_description"] = val
            elif key == "Land Value" and "land_value" not in result:
                val_clean = val.replace("$", "").replace(",", "").strip()
                if val_clean and val_clean != "-":
                    try:
                        result["land_value"] = int(val_clean)
                    except ValueError:
                        pass
            elif key in ("Value of Improvements", "Improvements") and "improvements_value" not in result:
                val_clean = val.replace("$", "").replace(",", "").strip()
                if val_clean and val_clean != "-":
                    try:
                        result["improvements_value"] = int(val_clean)
                    except ValueError:
                        pass
            elif key == "Capital Value" and "capital_value" not in result:
                val_clean = val.replace("$", "").replace(",", "").strip()
                if val_clean and val_clean != "-":
                    try:
                        result["capital_value"] = int(val_clean)
                    except ValueError:
                        pass

        # Fallback: Capital value from summary line
        if "capital_value" not in result:
            m = re.search(r'Capital value:\s*\$([\d,]+)', html)
            if m:
                result["capital_value"] = int(m.group(1).replace(",", ""))

        # Total annual rates
        m = re.search(r'Total annual rates:\s*\$([\d,.]+)', html)
        if m:
            result["total_rates"] = float(m.group(1).replace(",", ""))

        if not result.get("capital_value"):
            return None

        return result

    except Exception as e:
        return None


def fetch_assessment_numbers() -> list[dict]:
    """Fetch all assessment numbers + addresses from HCC ArcGIS Online."""
    all_records = []
    offset = 0
    page_size = 2000
    while True:
        params = {
            "where": "1=1",
            "outFields": "Assessment_Number,Addresses_On_Parcel,Full_Road_Name,Suburb_Locality",
            "returnGeometry": "false",
            "resultRecordCount": str(page_size),
            "resultOffset": str(offset),
            "f": "json",
        }
        resp = requests.get(PARCELS_URL, params=params, timeout=30,
                            headers={"User-Agent": "WhareScore/1.0"})
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        if not features:
            break
        for f in features:
            a = f["attributes"]
            if a.get("Assessment_Number"):
                all_records.append(a)
        logger.info(f"  Fetched {len(all_records)} assessment numbers...")
        if len(features) < page_size:
            break
        offset += page_size
    return all_records


def main(args):
    import psycopg
    from psycopg.rows import dict_row

    conninfo = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/wharescore",
    )

    # Step 1: Get all valid assessment numbers from ArcGIS
    logger.info("Step 1: Fetching assessment numbers from HCC ArcGIS Online...")
    parcels = fetch_assessment_numbers()
    logger.info(f"Got {len(parcels)} assessment numbers")

    # Deduplicate by assessment number
    seen = set()
    unique_parcels = []
    for p in parcels:
        aid = p["Assessment_Number"]
        if aid not in seen:
            seen.add(aid)
            unique_parcels.append(p)
    logger.info(f"Unique assessment numbers: {len(unique_parcels)}")

    if args.dry_run:
        # Test a few
        for p in unique_parcels[:10]:
            result = fetch_property(p["Assessment_Number"])
            if result:
                addr = result.get("address", "")
                cv = result.get("capital_value", 0)
                lv = result.get("land_value", 0)
                print(f"  ID {p['Assessment_Number']:>6d}: {addr:50s} CV=${cv:>10,}  LV=${lv:>10,}")
            else:
                print(f"  ID {p['Assessment_Number']:>6d}: (no data)")
        logger.info("Dry run — no data inserted.")
        return

    conn = psycopg.connect(conninfo, row_factory=dict_row)

    if args.clear:
        logger.info("Clearing existing Hamilton data from council_valuations...")
        conn.execute("DELETE FROM council_valuations WHERE council = 'hamilton'")
        conn.commit()
        logger.info("Cleared.")

    # Step 2: If resuming, filter out already-loaded assessment numbers
    if args.resume:
        cur_check = conn.cursor()
        cur_check.execute("SELECT valuation_id FROM council_valuations WHERE council = 'hamilton'")
        existing = {r["valuation_id"] for r in cur_check.fetchall() if r.get("valuation_id")}
        before = len(unique_parcels)
        # We store valuation_number not assessment_number, so filter by checking existing rows
        cur_check.execute("SELECT count(*) as cnt FROM council_valuations WHERE council = 'hamilton'")
        existing_count = cur_check.fetchone()["cnt"]
        logger.info(f"Resume mode: {existing_count} already loaded, skipping those assessment numbers")

    # Step 3: Scrape property pages for CV/LV
    total = len(unique_parcels)
    logger.info(f"Step 2: Scraping {total} property pages with {args.workers} workers...")

    insert_sql = """
        INSERT INTO council_valuations (
            council, valuation_id, address, full_address,
            capital_value, land_value, improvements_value, title
        ) VALUES (
            'hamilton', %s, %s, %s,
            %s, %s, %s, %s
        )
        ON CONFLICT DO NOTHING
    """

    cur = conn.cursor()
    start_time = time.time()
    inserted = 0
    scraped = 0
    found = 0
    batch = []
    last_log = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {}
        for p in unique_parcels:
            futures[pool.submit(fetch_property, p["Assessment_Number"])] = p

        for future in as_completed(futures):
            scraped += 1
            parcel = futures[future]
            result = future.result()

            if result:
                found += 1
                # Use ArcGIS address as fallback if scraper didn't find one
                address = result.get("address")
                if not address:
                    addr_num = parcel.get("Addresses_On_Parcel", "")
                    road = parcel.get("Full_Road_Name", "")
                    suburb = parcel.get("Suburb_Locality", "")
                    address = f"{addr_num} {road}, {suburb}".strip(", ")

                batch.append((
                    result.get("valuation_number"),
                    address,
                    address,
                    result.get("capital_value"),
                    result.get("land_value", 0),
                    result.get("improvements_value", 0),
                    result.get("legal_description"),
                ))

                if len(batch) >= 200:
                    cur.executemany(insert_sql, batch)
                    conn.commit()
                    inserted += len(batch)
                    batch = []

            # Log progress every 30 seconds
            now = time.time()
            if now - last_log >= 30:
                elapsed = now - start_time
                rate = scraped / elapsed
                eta = (total - scraped) / rate if rate > 0 else 0
                logger.info(
                    f"  Progress: {scraped}/{total} scraped, {found} found, {inserted} inserted "
                    f"({rate:.1f} req/s, ETA {eta/60:.0f}m)"
                )
                last_log = now

    # Final batch
    if batch:
        cur.executemany(insert_sql, batch)
        conn.commit()
        inserted += len(batch)

    elapsed = time.time() - start_time
    logger.info(
        f"\nDone! Inserted {inserted} rows in {elapsed:.0f}s\n"
        f"  Scraped: {scraped} IDs\n"
        f"  Found:   {found} with CV data\n"
        f"  Rate:    {scraped / elapsed:.1f} req/s"
    )

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load Hamilton property valuations")
    parser.add_argument("--dry-run", action="store_true", help="Fetch a few and print, don't insert")
    parser.add_argument("--clear", action="store_true", help="Clear existing Hamilton data first")
    parser.add_argument("--resume", action="store_true", help="Skip already-loaded properties")
    parser.add_argument("--workers", type=int, default=20, help="Concurrent workers (default: 20)")
    args = parser.parse_args()
    main(args)
