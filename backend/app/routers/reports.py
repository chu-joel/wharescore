# backend/app/routers/reports.py
"""
Hosted interactive report endpoints.

GET /report/{share_token} — public, no auth. Returns pre-computed snapshot JSON.
"""
from __future__ import annotations

import hashlib

import orjson
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from .. import db
from ..deps import limiter
from ..redis import cache_get, cache_set

router = APIRouter()


@router.get("/report/{share_token}")
@limiter.limit("30/minute")
async def get_report_snapshot(request: Request, share_token: str):
    """Public endpoint — returns pre-computed report snapshot by share token.
    No auth required. Anyone with the URL can view."""

    if not share_token or len(share_token) < 8:
        raise HTTPException(400, "Invalid token")

    token_hash = hashlib.sha256(share_token.encode()).hexdigest()

    # Check Redis cache first
    cache_key = f"snapshot:{token_hash[:16]}"
    cached = await cache_get(cache_key)
    if cached:
        return JSONResponse(
            content=orjson.loads(cached),
            media_type="application/json",
        )

    # Look up in database
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT snapshot_json, created_at, expires_at
            FROM report_snapshots
            WHERE share_token_hash = %s
            """,
            [token_hash],
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Report not found")

    # Check expiry
    if row.get("expires_at"):
        from datetime import datetime, timezone
        if datetime.now(timezone.utc) > row["expires_at"]:
            raise HTTPException(410, "Report has expired")

    snapshot = row["snapshot_json"]

    # Cache in Redis for 1 hour (snapshots are immutable)
    await cache_set(cache_key, orjson.dumps(snapshot, default=str).decode(), ex=3600)

    return snapshot
