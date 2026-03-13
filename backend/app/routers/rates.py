# backend/app/routers/rates.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Request

from .. import db
from ..deps import limiter
from ..services.rates import fetch_wcc_rates

router = APIRouter()


@router.get("/property/{address_id}/rates")
@limiter.limit("10/minute")
async def get_rates(request: Request, address_id: int):
    """Fetch WCC rates data. Calls WCC API live, caches result.
    Wellington City only — returns 404 for other councils."""
    async with db.pool.connection() as conn:
        # 1. Look up address
        cur = await conn.execute(
            "SELECT full_address FROM addresses WHERE address_id = %s",
            [address_id],
        )
        addr = cur.fetchone()
        if not addr:
            raise HTTPException(404, "Address not found")

        # 2. Call WCC API + upsert cache
        rates = await fetch_wcc_rates(addr["full_address"], conn)

    if not rates:
        raise HTTPException(404, "No rates data available for this address")

    return rates
