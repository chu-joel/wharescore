"""
Populate wcc_rates_cache by calling the WCC Property Search API for Wellington addresses.

Usage:
    py -3.14 scripts/populate_wcc_rates.py                    # all Wellington addresses
    py -3.14 scripts/populate_wcc_rates.py --limit 100        # first 100 only
    py -3.14 scripts/populate_wcc_rates.py --workers 10       # 10 concurrent API callers
    py -3.14 scripts/populate_wcc_rates.py --batch-size 200   # commit every 200 records

The script:
  1. Queries all Wellington addresses from our DB (skipping already-cached ones)
  2. Uses ThreadPoolExecutor to call WCC API concurrently (default 5 workers)
  3. For each address: address-search → account-search → full rates data
  4. Collects results and upserts into wcc_rates_cache in batches
"""
import argparse
import json
import logging
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

WCC_BASE = "https://services.wellington.govt.nz/property-search"
WCC_SEARCH_URL = f"{WCC_BASE}/api/property-info/address-search"
WCC_ACCOUNT_URL = f"{WCC_BASE}/api/property-info/account-search"
HEADERS = {"User-Agent": "WhareScore/1.0"}


def fetch_json(url: str, timeout: int = 10) -> dict | None:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(resp.read())
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None
    except Exception:
        return None


def fetch_rates_for_address(address: str) -> tuple[str, dict | None]:
    """Call WCC API: search by address, then get full account data.
    Returns (address, property_data_or_None).
    """
    # Step 1: Search for address
    search_url = f"{WCC_SEARCH_URL}?address={urllib.parse.quote(address)}&page=1&pageSize=3"
    search_data = fetch_json(search_url)

    if not search_data or not search_data.get("results"):
        return (address, None)

    result = search_data["results"][0]
    account = result.get("rateAccountNumber")
    if not account:
        return (address, None)

    # Step 2: Get full rates data by account number
    account_url = f"{WCC_ACCOUNT_URL}?account={account}"
    account_data = fetch_json(account_url)

    if not account_data or not account_data.get("results"):
        return (address, None)

    return (address, account_data["results"][0])


def upsert_batch(conn, results: list[dict]):
    """Upsert a batch of property data into the cache."""
    cur = conn.cursor()
    for prop in results:
        valuations = prop.get("valuations", [])
        current_val = next(
            (v for v in valuations if v.get("periodStatus") == "C"),
            valuations[0] if valuations else {},
        )
        cv = current_val.get("capitalValue") or 0
        lv = current_val.get("landValue") or 0

        cur.execute(
            """
            INSERT INTO wcc_rates_cache (
                valuation_number, rate_account_number, address, identifier,
                rating_category, billing_code, legal_description, valued_land_area,
                has_water_meter, capital_value, land_value, improvements_value,
                valuation_date, total_rates, rates_period, valuations, levies, fetched_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s::date, %s, %s, %s::jsonb, %s::jsonb, NOW()
            )
            ON CONFLICT (valuation_number) DO UPDATE SET
                rate_account_number = EXCLUDED.rate_account_number,
                address = EXCLUDED.address,
                identifier = EXCLUDED.identifier,
                rating_category = EXCLUDED.rating_category,
                billing_code = EXCLUDED.billing_code,
                capital_value = EXCLUDED.capital_value,
                land_value = EXCLUDED.land_value,
                improvements_value = EXCLUDED.improvements_value,
                valuation_date = EXCLUDED.valuation_date,
                total_rates = EXCLUDED.total_rates,
                rates_period = EXCLUDED.rates_period,
                valuations = EXCLUDED.valuations,
                levies = EXCLUDED.levies,
                fetched_at = NOW()
            """,
            [
                prop.get("valuationNumber"),
                prop.get("rateAccountNumber"),
                prop.get("address"),
                prop.get("identifier"),
                prop.get("ratingCategory"),
                prop.get("billingCode"),
                prop.get("legalDescription"),
                prop.get("valuedLandArea"),
                prop.get("hasWaterMeter", False),
                cv, lv, cv - lv,
                current_val.get("valuationDate"),
                current_val.get("ratesAmount"),
                current_val.get("period"),
                json.dumps(valuations),
                json.dumps(prop.get("levies", [])),
            ],
        )
    conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Populate WCC rates cache")
    parser.add_argument("--limit", type=int, default=0, help="Max addresses to process (0=all)")
    parser.add_argument("--batch-size", type=int, default=200, help="Commit every N records")
    parser.add_argument("--workers", type=int, default=5, help="Concurrent API workers")
    parser.add_argument("--offset", type=int, default=0, help="Skip first N addresses")
    args = parser.parse_args()

    conn = psycopg.connect("postgresql://postgres:postgres@localhost:5432/wharescore")
    cur = conn.cursor()

    # Get Wellington addresses — use simple OFFSET-based approach, skip already-cached
    # by checking if valuation_number exists (cheaper than LIKE match)
    log.info("Querying Wellington addresses not yet cached...")
    query = """
        SELECT a.address_id, a.full_address
        FROM addresses a
        WHERE a.town_city = 'Wellington'
        ORDER BY a.address_id
    """
    if args.offset:
        query = query.rstrip() + f"\nOFFSET {args.offset}"
    if args.limit:
        query = query.rstrip() + f"\nLIMIT {args.limit}"

    cur.execute(query)
    all_addresses = cur.fetchall()

    # Load already-cached addresses for fast skip
    cur.execute("SELECT lower(address) FROM wcc_rates_cache")
    cached_addrs = {row[0] for row in cur.fetchall()}
    log.info(f"Already cached: {len(cached_addrs)}")

    # Filter out already-cached (fuzzy match on first part of address)
    addresses = []
    for aid, full in all_addresses:
        # Our DB: "24 Greyfriars Crescent, Tawa, Wellington"
        # WCC cache: "24 Greyfriars Crescent Tawa 5028"
        street_part = full.split(",")[0].strip().lower()
        if not any(street_part in cached for cached in cached_addrs):
            addresses.append((aid, full))

    total = len(addresses)
    log.info(f"Addresses to process: {total} (of {len(all_addresses)} total Wellington)")

    if total == 0:
        log.info("Nothing to do")
        conn.close()
        return

    success = 0
    not_found = 0
    errors = 0
    batch_results = []
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        # Submit all tasks
        futures = {}
        for address_id, full_address in addresses:
            search_addr = full_address.rsplit(",", 1)[0].strip()
            future = executor.submit(fetch_rates_for_address, search_addr)
            futures[future] = (address_id, full_address)

        # Collect results as they complete
        for i, future in enumerate(as_completed(futures), 1):
            address_id, full_address = futures[future]
            try:
                addr, prop = future.result()
                if prop:
                    batch_results.append(prop)
                    success += 1
                else:
                    not_found += 1
            except Exception as e:
                errors += 1
                log.warning(f"Error for {full_address}: {e}")

            # Upsert batch
            if len(batch_results) >= args.batch_size:
                upsert_batch(conn, batch_results)
                batch_results = []

            # Log progress
            if i % args.batch_size == 0 or i == total:
                elapsed = time.time() - start_time
                rate = i / elapsed if elapsed > 0 else 0
                eta_min = (total - i) / rate / 60 if rate > 0 else 0
                log.info(
                    f"Progress: {i}/{total} ({i*100//total}%) | "
                    f"OK: {success} | Miss: {not_found} | Err: {errors} | "
                    f"{rate:.1f}/s | ETA: {eta_min:.0f}min"
                )

    # Final batch
    if batch_results:
        upsert_batch(conn, batch_results)

    elapsed = time.time() - start_time
    log.info(
        f"Done in {elapsed/60:.1f}min | {total} processed | "
        f"OK: {success} | Miss: {not_found} | Err: {errors}"
    )

    cur.execute("SELECT count(*) FROM wcc_rates_cache")
    log.info(f"Total cached: {cur.fetchone()[0]}")
    conn.close()


if __name__ == "__main__":
    main()
