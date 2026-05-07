"""Public content endpoints — admin-managed values that need to be readable by anonymous visitors.

Currently exposes the announcement banner. Reads from the same `admin_content` table the admin panel
writes to (see admin.py § Content Management), but only returns the banner when its `active` flag is true,
and strips fields that the public doesn't need to see.
"""
from __future__ import annotations

import orjson
from fastapi import APIRouter, Request

from .. import db as _db
from .. import redis as _redis_module
from ..deps import limiter

router = APIRouter(tags=["content"])

BANNER_CACHE_KEY = "public:banner"
BANNER_CACHE_TTL = 60  # seconds — short so admin toggles take effect quickly


def _redis():
    return _redis_module.redis_client


@router.get("/public/banner")
@limiter.limit("120/minute")
async def get_public_banner(request: Request):
    """Return the active announcement banner, or null if none is active.

    Cached in Redis for 60s. Cache is busted by admin.py on banner update so changes propagate
    within at most a few seconds across the cluster.
    """
    rc = _redis()
    if rc is not None:
        cached = await rc.get(BANNER_CACHE_KEY)
        if cached is not None:
            # `null` is a valid cached value — means "no active banner"
            return orjson.loads(cached)

    async with _db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT value FROM admin_content WHERE key = 'banner'"
        )
        row = cur.fetchone()

    payload = None
    if row:
        cfg = row["value"] if isinstance(row, dict) else row[0]
        if isinstance(cfg, dict) and cfg.get("active") and cfg.get("text"):
            # Only expose what the client needs — never expose `active` (implementation detail)
            payload = {"text": cfg["text"], "type": cfg.get("type", "info")}

    if rc is not None:
        await rc.setex(BANNER_CACHE_KEY, BANNER_CACHE_TTL, orjson.dumps(payload).decode())

    return payload
