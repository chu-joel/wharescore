from __future__ import annotations
# backend/app/routers/suburb.py
import json
from fastapi import APIRouter, HTTPException, Query, Request

from ..deps import limiter
from ..services.suburb import search_suburbs, get_suburb_summary
from ..redis import cache_get, cache_set

router = APIRouter()


@router.get("/search/suburb")
@limiter.limit("30/minute")
async def search_suburb(
    request: Request,
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(5, le=10),
):
    """Search suburbs by name."""
    results = await search_suburbs(q, limit)
    return {"results": results}


@router.get("/suburb/{sa2_code}")
@limiter.limit("20/minute")
async def suburb_summary(
    request: Request,
    sa2_code: str,
):
    """Full suburb summary with 1h Redis cache."""
    cache_key = f"suburb:{sa2_code}"
    cached = await cache_get(cache_key)
    if cached:
        return json.loads(cached)

    data = await get_suburb_summary(sa2_code)
    if not data:
        raise HTTPException(status_code=404, detail="Suburb not found")

    await cache_set(cache_key, json.dumps(data, default=str), ex=3600)
    return data
