# backend/app/routers/search.py
from __future__ import annotations
from fastapi import APIRouter, Query, Request

from ..deps import limiter
from ..services.abbreviations import expand_abbreviations
from ..services.search import search as search_service

router = APIRouter()


@router.get("/search/address")
@limiter.limit("30/minute")
async def search_address(
    request: Request,
    q: str = Query(..., min_length=3, max_length=200),
    limit: int = Query(8, le=20),
):
    """Search NZ addresses. Three-tier: prefix → full-text → fuzzy.
    Returns up to `limit` results sorted by relevance."""
    expanded = expand_abbreviations(q)
    results = await search_service(expanded, limit)
    return {"results": results}
