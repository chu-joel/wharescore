"""Budget calculator data collection endpoint."""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .. import db
from ..deps import limiter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["budget"])


class BudgetInput(BaseModel):
    address_id: int
    persona: str = Field(pattern=r"^(buyer|renter)$")

    # Buyer fields (optional)
    purchase_price: int | None = None
    deposit_pct: float | None = None
    interest_rate: float | None = None
    loan_term: int | None = None
    rates_override: float | None = None
    insurance_override: float | None = None
    utilities_override: float | None = None
    maintenance_override: float | None = None

    # Renter fields (optional)
    weekly_rent: int | None = None
    room_only: bool | None = None
    household_size: int | None = None
    contents_insurance_override: float | None = None
    transport_override: float | None = None
    food_override: float | None = None

    # Shared
    annual_income: int | None = None


def _ip_hash(request: Request) -> str:
    ip = request.client.host if request.client else "unknown"
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


@router.post("/budget-inputs")
@limiter.limit("30/hour")
async def save_budget_input(request: Request, body: BudgetInput):
    """Save anonymous budget calculator data. Deduped: 1 per address/persona/IP/24h."""
    ip_h = _ip_hash(request)

    async with db.pool.connection() as conn:
        # Dedup check
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        row = await conn.execute(
            """SELECT 1 FROM user_budget_inputs
               WHERE address_id = %s AND persona = %s AND ip_hash = %s AND reported_at > %s
               LIMIT 1""",
            (body.address_id, body.persona, ip_h, cutoff),
        )
        if row.fetchone():
            return JSONResponse({"status": "duplicate"}, status_code=200)

        # Look up sa2_code via spatial join
        sa2_row = await conn.execute(
            """SELECT s.sa2_code FROM addresses a
               JOIN sa2_boundaries s ON ST_Within(a.geom, s.geom)
               WHERE a.address_id = %s LIMIT 1""",
            (body.address_id,)
        )
        sa2 = None
        r = sa2_row.fetchone()
        if r:
            sa2 = r["sa2_code"]

        await conn.execute(
            """INSERT INTO user_budget_inputs (
                address_id, sa2_code, persona,
                purchase_price, deposit_pct, interest_rate, loan_term,
                rates_override, insurance_override, utilities_override, maintenance_override,
                weekly_rent, room_only, household_size,
                contents_insurance_override, transport_override, food_override,
                annual_income, ip_hash
            ) VALUES (
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )""",
            (
                body.address_id, sa2, body.persona,
                body.purchase_price, body.deposit_pct, body.interest_rate, body.loan_term,
                body.rates_override, body.insurance_override, body.utilities_override, body.maintenance_override,
                body.weekly_rent, body.room_only, body.household_size,
                body.contents_insurance_override, body.transport_override, body.food_override,
                body.annual_income, ip_h,
            ),
        )

    return JSONResponse({"status": "ok"}, status_code=201)
