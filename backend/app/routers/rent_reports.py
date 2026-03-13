# backend/app/routers/rent_reports.py
from __future__ import annotations
import hashlib

from fastapi import APIRouter, Request

from .. import db
from ..deps import limiter
from ..schemas.rent_reports import RentReportSubmit
from ..services import rent_reports as rent_reports_service

router = APIRouter()


@router.post("/rent-reports", status_code=201)
@limiter.limit("3/hour")
async def submit_rent_report(request: Request, body: RentReportSubmit):
    """Submit a user rent report. 5-layer validation pipeline."""
    if body.website:  # honeypot triggered — bot
        return {"status": "accepted"}

    ip_hash = hashlib.sha256(request.client.host.encode()).hexdigest()

    async with db.pool.connection() as conn:
        result = await rent_reports_service.submit(conn, body, ip_hash)
    return result


@router.get("/rent-reports/{address_id}")
@limiter.limit("40/minute")
async def get_rent_reports(request: Request, address_id: int):
    """Get crowd-sourced rent data for a building. Requires 3+ reports to display."""
    async with db.pool.connection() as conn:
        return await rent_reports_service.get_building_reports(conn, address_id)
