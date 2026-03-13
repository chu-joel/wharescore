"""
Fetch MBIE Market Rent API data and cache in PostGIS.

Usage:
    py -3.14 fetch_market_rent.py <sa2_code> [--dwelling-type Flat] [--beds 2] [--months 6]
    py -3.14 fetch_market_rent.py 252500                         # all types/beds for Mt Vic
    py -3.14 fetch_market_rent.py 252500 --dwelling-type Flat    # all bed counts for flats
    py -3.14 fetch_market_rent.py 252500,251600,251700           # multiple SA2s
    py -3.14 fetch_market_rent.py --warm-all                     # fetch ALL 2,171 SA2s from DB
"""

import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from urllib.parse import urlencode

import psycopg

DB_DSN = "postgresql://postgres:postgres@localhost:5432/wharescore"
API_BASE = "https://api.business.govt.nz/gateway/tenancy-services/market-rent/v2/statistics"

DWELLING_TYPES = ["Apartment", "Flat", "House", "Room"]
BED_COUNTS = ["1", "2", "3", "4", "5+"]


def get_api_key():
    key = os.environ.get("MBIE_API_KEY")
    if not key:
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        if os.path.exists(env_file):
            for line in open(env_file):
                if line.startswith("MBIE_API_KEY="):
                    key = line.strip().split("=", 1)[1]
    if not key:
        sys.exit("MBIE_API_KEY not found in environment or .env file")
    return key


def last_complete_month():
    """API requires period-ending to be at least 2 months ago."""
    today = date.today()
    # Go back 2 months to be safe (API rejects recent months)
    two_months_ago = (today.replace(day=1) - timedelta(days=1)).replace(day=1) - timedelta(days=1)
    return two_months_ago.strftime("%Y-%m")


def fetch_mbie(api_key, sa2_codes, dwelling_type=None, num_bedrooms=None, num_months=6):
    params = {
        "period-ending": last_complete_month(),
        "num-months": str(num_months),
        "area-definition": "SAU2019",
        "area-codes": sa2_codes,
        "include-aggregates": "true",
    }
    if dwelling_type:
        params["dwelling-type"] = dwelling_type
    if num_bedrooms:
        params["num-bedrooms"] = num_bedrooms

    url = f"{API_BASE}?{urlencode(params)}"
    req = Request(url, headers={
        "Ocp-Apim-Subscription-Key": api_key,
        "Accept": "application/json",
    })

    print(f"  GET {url}")
    with urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())

    return data


def upsert_items(conn, items, period_covered, num_months):
    if not items:
        print("  No items returned (all suppressed?)")
        return 0

    count = 0
    with conn.cursor() as cur:
        for item in items:
            # Skip aggregate rows (area="ALL") — we want per-SA2 data
            if item["area"] == "ALL":
                continue

            # Map area name back to SA2 code — API doesn't return codes directly
            # We store the area name and rely on the sa2_code from our query
            # For single-SA2 queries this is unambiguous
            # For multi-SA2 queries we need the code — but API only gives name
            # We'll handle this by querying one SA2 at a time for caching

            cur.execute("""
                INSERT INTO market_rent_cache (
                    sa2_code, dwelling_type, num_bedrooms, period_covered,
                    num_months, area_name, n_lodged, n_closed, n_current,
                    mean_rent, median_rent, lower_quartile, upper_quartile,
                    std_dev, bond_rent_ratio, log_mean, log_std_dev,
                    synthetic_lq, synthetic_uq, raw_response
                ) VALUES (
                    %(sa2_code)s, %(dwelling_type)s, %(num_bedrooms)s, %(period_covered)s,
                    %(num_months)s, %(area_name)s, %(n_lodged)s, %(n_closed)s, %(n_current)s,
                    %(mean_rent)s, %(median_rent)s, %(lower_quartile)s, %(upper_quartile)s,
                    %(std_dev)s, %(bond_rent_ratio)s, %(log_mean)s, %(log_std_dev)s,
                    %(synthetic_lq)s, %(synthetic_uq)s, %(raw_response)s
                )
                ON CONFLICT (sa2_code, dwelling_type, num_bedrooms, period_covered)
                DO UPDATE SET
                    area_name = EXCLUDED.area_name,
                    n_lodged = EXCLUDED.n_lodged,
                    n_closed = EXCLUDED.n_closed,
                    n_current = EXCLUDED.n_current,
                    mean_rent = EXCLUDED.mean_rent,
                    median_rent = EXCLUDED.median_rent,
                    lower_quartile = EXCLUDED.lower_quartile,
                    upper_quartile = EXCLUDED.upper_quartile,
                    std_dev = EXCLUDED.std_dev,
                    bond_rent_ratio = EXCLUDED.bond_rent_ratio,
                    log_mean = EXCLUDED.log_mean,
                    log_std_dev = EXCLUDED.log_std_dev,
                    synthetic_lq = EXCLUDED.synthetic_lq,
                    synthetic_uq = EXCLUDED.synthetic_uq,
                    raw_response = EXCLUDED.raw_response,
                    fetched_at = NOW()
            """, {
                "sa2_code": item["_sa2_code"],
                "dwelling_type": item["dwell"],
                "num_bedrooms": item["nBedrms"],
                "period_covered": period_covered,
                "num_months": num_months,
                "area_name": item["area"],
                "n_lodged": item.get("nLodged"),
                "n_closed": item.get("nClosed"),
                "n_current": item.get("nCurr"),
                "mean_rent": item.get("mean"),
                "median_rent": item.get("med"),
                "lower_quartile": item.get("lq"),
                "upper_quartile": item.get("uq"),
                "std_dev": item.get("sd"),
                "bond_rent_ratio": item.get("brr"),
                "log_mean": item.get("lmean"),
                "log_std_dev": item.get("lsd"),
                "synthetic_lq": item.get("slq"),
                "synthetic_uq": item.get("suq"),
                "raw_response": json.dumps(item),
            })
            count += 1

    conn.commit()
    return count


def get_all_sa2_codes(conn):
    """Load all SA2 codes from sa2_boundaries table."""
    with conn.cursor() as cur:
        cur.execute("SELECT sa2_code FROM sa2_boundaries ORDER BY sa2_code")
        return [row[0] for row in cur.fetchall()]


def fetch_single_sa2(api_key, conn, code, dwelling_type, beds, num_months, retries=2):
    """Fetch one SA2 with retry logic for transient errors."""
    for attempt in range(retries + 1):
        try:
            data = fetch_mbie(api_key, code, dwelling_type, beds, num_months)
            for item in data.get("items", []):
                item["_sa2_code"] = code
            n = upsert_items(conn, data.get("items", []),
                             data["periodCovered"], num_months)
            return n
        except HTTPError as e:
            if e.code == 429 and attempt < retries:
                wait = 10 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            elif e.code == 400:
                # Bad request — likely no data for this SA2, skip
                return 0
            else:
                raise
    return 0


def main():
    parser = argparse.ArgumentParser(description="Fetch MBIE Market Rent data into cache")
    parser.add_argument("sa2_codes", nargs="?", default=None,
                        help="Comma-separated SA2 codes (e.g. 252500,251600)")
    parser.add_argument("--dwelling-type", help="Apartment, Flat, House, or Room")
    parser.add_argument("--beds", help="1, 2, 3, 4, or 5+")
    parser.add_argument("--months", type=int, default=6, help="Aggregation window (1-24, default 6)")
    parser.add_argument("--all-combos", action="store_true",
                        help="Query every dwelling-type x beds combination individually")
    parser.add_argument("--warm-all", action="store_true",
                        help="Fetch ALL SA2 codes from sa2_boundaries table")
    parser.add_argument("--reverse", action="store_true",
                        help="Process SA2 codes in reverse order (use with second instance)")
    parser.add_argument("--skip-cached", action="store_true",
                        help="Skip SA2 codes already in market_rent_cache")
    parser.add_argument("--batch-size", type=int, default=10,
                        help="Commit and report progress every N SA2s (default 10)")
    parser.add_argument("--delay", type=float, default=0.3,
                        help="Seconds to wait between API calls (default 0.3)")
    args = parser.parse_args()

    if not args.warm_all and not args.sa2_codes:
        parser.error("Either provide sa2_codes or use --warm-all")

    api_key = get_api_key()
    conn = psycopg.connect(DB_DSN)

    if args.warm_all:
        codes = get_all_sa2_codes(conn)
        if args.skip_cached:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT sa2_code FROM market_rent_cache")
                cached = {row[0] for row in cur.fetchall()}
            before = len(codes)
            codes = [c for c in codes if c not in cached]
            print(f"Skipping {before - len(codes)} already-cached SA2s.")
        if args.reverse:
            codes = list(reversed(codes))
            print(f"Processing in REVERSE order (high to low).")
        print(f"Warming cache for {len(codes)} SA2 areas...")
    else:
        codes = [c.strip() for c in args.sa2_codes.split(",")]

    total = 0
    errors = 0
    empty = 0
    start_time = time.time()

    for i, code in enumerate(codes, 1):
        if args.all_combos:
            for dwell in DWELLING_TYPES:
                for beds in BED_COUNTS:
                    print(f"\n[{i}/{len(codes)}] {code} / {dwell} / {beds}-bed...")
                    try:
                        n = fetch_single_sa2(api_key, conn, code, dwell, beds, args.months)
                        total += n
                        if n == 0:
                            empty += 1
                        else:
                            print(f"  -> {n} rows")
                    except Exception as e:
                        errors += 1
                        print(f"  ERROR: {e}")
                    time.sleep(args.delay)
        else:
            try:
                n = fetch_single_sa2(api_key, conn, code,
                                     args.dwelling_type, args.beds, args.months)
                total += n
                if n == 0:
                    empty += 1
                else:
                    print(f"  [{i}/{len(codes)}] {code} -> {n} rows")
            except Exception as e:
                errors += 1
                print(f"  [{i}/{len(codes)}] {code} ERROR: {e}")

            if args.warm_all:
                time.sleep(args.delay)

        # Progress report every batch_size
        if i % args.batch_size == 0:
            elapsed = time.time() - start_time
            rate = i / elapsed
            remaining = (len(codes) - i) / rate
            print(f"\n  --- Progress: {i}/{len(codes)} ({i*100//len(codes)}%) | "
                  f"{total} rows cached | {empty} empty | {errors} errors | "
                  f"{elapsed:.0f}s elapsed | ~{remaining:.0f}s remaining ---\n")

    elapsed = time.time() - start_time
    conn.close()
    print(f"\nDone. {total} rows cached from {len(codes)} SA2s "
          f"({empty} empty, {errors} errors) in {elapsed:.0f}s.")


if __name__ == "__main__":
    main()
