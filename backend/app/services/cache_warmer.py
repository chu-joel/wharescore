# backend/app/services/cache_warmer.py
"""Pre-warm Redis cache for popular addresses.

Fetches reports for the most-viewed addresses so they're cached
before real users hit them. Run as a background task after deploy
or on a schedule.

Usage (inside API container):
    python -c "
    import asyncio
    from app.services.cache_warmer import warm_cache
    asyncio.run(warm_cache(limit=100))
    "
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def warm_cache(limit: int = 100):
    """Pre-warm report cache for the most popular addresses.

    Queries saved_reports + app_events to find frequently accessed addresses,
    then fetches each report to populate the Redis cache.
    """
    from .. import db
    from ..redis import cache_get
    import httpx

    async with db.pool.connection() as conn:
        # Find top addresses by report generation + page views
        cur = await conn.execute(
            """
            SELECT address_id, COUNT(*) AS hits
            FROM (
                SELECT address_id FROM saved_reports
                UNION ALL
                SELECT (properties->>'address_id')::int
                FROM app_events
                WHERE event_type = 'report_view'
                  AND properties->>'address_id' IS NOT NULL
                  AND created_at > now() - interval '30 days'
            ) combined
            WHERE address_id IS NOT NULL
            GROUP BY address_id
            ORDER BY hits DESC
            LIMIT %s
            """,
            [limit],
        )
        rows = cur.fetchall()

    if not rows:
        logger.info("No addresses to warm")
        return

    logger.info(f"Warming cache for {len(rows)} addresses...")
    warmed = 0
    skipped = 0

    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=60) as client:
        for row in rows:
            aid = row["address_id"]
            cache_key = f"report:{aid}"

            # Skip if already cached
            cached = await cache_get(cache_key)
            if cached:
                skipped += 1
                continue

            try:
                res = await client.get(f"/api/v1/property/{aid}/report?fast=true")
                if res.status_code == 200:
                    warmed += 1
                else:
                    logger.debug(f"  {aid}: status {res.status_code}")
            except Exception as e:
                logger.debug(f"  {aid}: {e}")

    logger.info(f"Cache warm complete: {warmed} warmed, {skipped} already cached, {len(rows) - warmed - skipped} failed")
