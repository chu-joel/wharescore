"""Budget calculator + property-descriptor data collection endpoint.

Captures both renter and buyer inputs from across the on-screen report
flows (BuyerBudgetCalculator, PriceAdvisorCard, BudgetCalculator on the
renter side). Multiple POSTs from the same user/address in a 24h window
upsert into one row using COALESCE so partial submissions enrich rather
than overwrite. See migration 0060 for the schema.
"""
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

    # Buyer financial fields (from BuyerBudgetCalculator)
    purchase_price: int | None = None
    deposit_pct: float | None = None
    interest_rate: float | None = None
    loan_term: int | None = None
    rates_override: float | None = None
    insurance_override: float | None = None
    utilities_override: float | None = None
    maintenance_override: float | None = None

    # Buyer property descriptors (from PriceAdvisorCard, migration 0060)
    asking_price: int | None = None
    bedrooms: str | None = None
    bathrooms: str | None = None
    finish_tier: str | None = None
    has_parking: bool | None = None

    # Renter fields (optional)
    weekly_rent: int | None = None
    room_only: bool | None = None
    household_size: int | None = None
    contents_insurance_override: float | None = None
    transport_override: float | None = None
    food_override: float | None = None

    # Shared
    annual_income: int | None = None

    # Audit
    source_context: str | None = Field(None, max_length=40)
    notice_version: str | None = Field(None, max_length=20)


def _ip_hash(request: Request) -> str:
    ip = request.client.host if request.client else "unknown"
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


@router.post("/budget-inputs")
@limiter.limit("60/minute")
async def save_budget_input(request: Request, body: BudgetInput):
    """Save anonymous budget calculator + property-descriptor data.

    Upserts into one row per (address_id, persona, ip_hash) within a 24h
    window. Multiple POSTs from the same user (e.g. PriceAdvisorCard
    fires once for asking_price + bedrooms + finish_tier; minutes later
    BuyerBudgetCalculator fires with deposit_pct + interest_rate)
    enrich the same row using COALESCE — they don't overwrite each
    other and they don't create duplicates.
    """
    ip_h = _ip_hash(request)

    async with db.pool.connection() as conn:
        # Find any recent row from this user for this address+persona.
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        cur = await conn.execute(
            """SELECT id FROM user_budget_inputs
               WHERE address_id = %s AND persona = %s AND ip_hash = %s
                 AND reported_at > %s
               ORDER BY reported_at DESC LIMIT 1""",
            (body.address_id, body.persona, ip_h, cutoff),
        )
        existing = cur.fetchone()

        # Look up sa2_code via spatial join (only when no existing row).
        sa2 = None
        if not existing:
            sa2_row = await conn.execute(
                """SELECT s.sa2_code FROM addresses a
                   JOIN sa2_boundaries s ON ST_Within(a.geom, s.geom)
                   WHERE a.address_id = %s LIMIT 1""",
                (body.address_id,),
            )
            r = sa2_row.fetchone()
            if r:
                sa2 = r["sa2_code"]

        if existing:
            await conn.execute(
                """UPDATE user_budget_inputs SET
                    purchase_price = COALESCE(%s, purchase_price),
                    deposit_pct = COALESCE(%s, deposit_pct),
                    interest_rate = COALESCE(%s, interest_rate),
                    loan_term = COALESCE(%s, loan_term),
                    rates_override = COALESCE(%s, rates_override),
                    insurance_override = COALESCE(%s, insurance_override),
                    utilities_override = COALESCE(%s, utilities_override),
                    maintenance_override = COALESCE(%s, maintenance_override),
                    asking_price = COALESCE(%s, asking_price),
                    bedrooms = COALESCE(%s, bedrooms),
                    bathrooms = COALESCE(%s, bathrooms),
                    finish_tier = COALESCE(%s, finish_tier),
                    has_parking = COALESCE(%s, has_parking),
                    weekly_rent = COALESCE(%s, weekly_rent),
                    room_only = COALESCE(%s, room_only),
                    household_size = COALESCE(%s, household_size),
                    contents_insurance_override = COALESCE(%s, contents_insurance_override),
                    transport_override = COALESCE(%s, transport_override),
                    food_override = COALESCE(%s, food_override),
                    annual_income = COALESCE(%s, annual_income),
                    source_context = COALESCE(%s, source_context),
                    notice_version = COALESCE(%s, notice_version),
                    reported_at = NOW()
                   WHERE id = %s""",
                (
                    body.purchase_price, body.deposit_pct, body.interest_rate, body.loan_term,
                    body.rates_override, body.insurance_override, body.utilities_override, body.maintenance_override,
                    body.asking_price, body.bedrooms, body.bathrooms, body.finish_tier, body.has_parking,
                    body.weekly_rent, body.room_only, body.household_size,
                    body.contents_insurance_override, body.transport_override, body.food_override,
                    body.annual_income, body.source_context, body.notice_version,
                    existing["id"],
                ),
            )
        else:
            await conn.execute(
                """INSERT INTO user_budget_inputs (
                    address_id, sa2_code, persona,
                    purchase_price, deposit_pct, interest_rate, loan_term,
                    rates_override, insurance_override, utilities_override, maintenance_override,
                    asking_price, bedrooms, bathrooms, finish_tier, has_parking,
                    weekly_rent, room_only, household_size,
                    contents_insurance_override, transport_override, food_override,
                    annual_income, ip_hash,
                    source_context, notice_version
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s
                )""",
                (
                    body.address_id, sa2, body.persona,
                    body.purchase_price, body.deposit_pct, body.interest_rate, body.loan_term,
                    body.rates_override, body.insurance_override, body.utilities_override, body.maintenance_override,
                    body.asking_price, body.bedrooms, body.bathrooms, body.finish_tier, body.has_parking,
                    body.weekly_rent, body.room_only, body.household_size,
                    body.contents_insurance_override, body.transport_override, body.food_override,
                    body.annual_income, ip_h,
                    body.source_context, body.notice_version,
                ),
            )

    return JSONResponse({"status": "ok"}, status_code=201)
