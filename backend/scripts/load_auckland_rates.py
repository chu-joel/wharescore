#!/usr/bin/env python3
"""
Bulk loader for Auckland Council property valuations.

Iterates through Auckland addresses in our database, looks up each one
via the Auckland Council API, and caches the result.

Usage:
    python scripts/load_auckland_rates.py [--limit 1000] [--suburb "Mount Eden"] [--resume]

Rate limiting: ~2 requests/second to be respectful of the API.
With 586K Auckland addresses, a full load would take ~3.5 days.
Recommended: run for specific suburbs or with --limit.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


async def main(args):
    from app import db
    from app.services.auckland_rates import fetch_auckland_rates

    conninfo = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/wharescore",
    )
    await db.init_pool(conninfo)

    # Ensure cache table exists
    try:
        async with db.pool.connection() as conn:
            await conn.execute("SELECT 1 FROM auckland_rates_cache LIMIT 0")
    except Exception:
        logger.info("Creating auckland_rates_cache table...")
        async with db.pool.connection() as conn:
            migration_path = os.path.join(
                os.path.dirname(__file__), "..", "migrations", "0015_auckland_rates_cache.sql"
            )
            with open(migration_path) as f:
                await conn.execute(f.read())
            logger.info("Table created.")

    # Build query for Auckland addresses
    query = """
        SELECT a.address_id, a.full_address, a.suburb_locality
        FROM addresses a
        WHERE a.town_city ILIKE '%%Auckland%%'
          AND a.address_lifecycle = 'Current'
    """
    params = []

    if args.suburb:
        query += " AND a.suburb_locality ILIKE %s"
        params.append(f"%{args.suburb}%")

    if args.resume:
        query += """
            AND NOT EXISTS (
                SELECT 1 FROM auckland_rates_cache c
                WHERE lower(c.address) LIKE '%%' || lower(a.address_number || ' ' || a.road_name) || '%%'
            )
        """

    query += " ORDER BY a.suburb_locality, a.address_number"

    if args.limit:
        query += f" LIMIT {args.limit}"

    # Fetch addresses
    async with db.pool.connection() as conn:
        cur = await conn.execute(query, params)
        addresses = cur.fetchall()

    total = len(addresses)
    logger.info(f"Found {total} Auckland addresses to process")

    success = 0
    failed = 0
    skipped = 0
    start_time = time.time()

    # Log skipped/failed addresses to files for later retry
    log_dir = os.path.join(os.path.dirname(__file__), "..")
    skipped_log = open(os.path.join(log_dir, "skipped_addresses.txt"), "a")
    failed_log = open(os.path.join(log_dir, "failed_addresses.txt"), "a")

    for i, row in enumerate(addresses):
        full_address = row["full_address"]
        suburb = row.get("suburb_locality", "")

        try:
            async with db.pool.connection() as conn:
                result = await fetch_auckland_rates(full_address, conn)

            if result and result.get("current_valuation", {}).get("capital_value"):
                success += 1
                cv = result["current_valuation"]["capital_value"]
                if (i + 1) % 50 == 0 or i < 5:
                    logger.info(
                        f"[{i+1}/{total}] {full_address} -> CV ${cv:,} "
                        f"({success} ok, {failed} fail, {skipped} skip)"
                    )
            else:
                skipped += 1
                skipped_log.write(f"{full_address}\n")
                skipped_log.flush()
                if (i + 1) % 100 == 0:
                    logger.debug(f"[{i+1}/{total}] No result for: {full_address}")

        except Exception as e:
            failed += 1
            failed_log.write(f"{full_address}\t{e}\n")
            failed_log.flush()
            logger.warning(f"[{i+1}/{total}] Error for {full_address}: {e}")

        # Rate limit: ~2 req/sec (search + assessment = 2 calls per address)
        await asyncio.sleep(0.5)

    skipped_log.close()
    failed_log.close()

    elapsed = time.time() - start_time
    logger.info(
        f"\nDone! Processed {total} addresses in {elapsed:.0f}s\n"
        f"  Success: {success}\n"
        f"  Failed:  {failed}\n"
        f"  Skipped: {skipped}\n"
        f"  Rate:    {total / elapsed:.1f} addr/sec"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load Auckland Council property valuations")
    parser.add_argument("--limit", type=int, default=None, help="Max addresses to process")
    parser.add_argument("--suburb", type=str, default=None, help="Filter by suburb name")
    parser.add_argument("--resume", action="store_true", help="Skip addresses already in cache")
    args = parser.parse_args()
    asyncio.run(main(args))
