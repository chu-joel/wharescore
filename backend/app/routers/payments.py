"""Stripe Checkout session creation endpoint."""
from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .. import db
from .. import redis as app_redis
from ..config import settings
from ..deps import limiter
from ..services.auth import require_user
from ..services.event_writer import track_event, log_error

logger = logging.getLogger(__name__)
router = APIRouter(tags=["payments"])


class CheckoutRequest(BaseModel):
    plan: str  # "quick_single" | "full_single" | "pro" (legacy: "single" | "pack3")
    address_id: int | None = None


class GuestCheckoutRequest(BaseModel):
    address_id: int
    persona: str = "buyer"
    plan: str = "quick_single"  # "quick_single" | "full_single"


@router.post("/checkout/session")
@limiter.limit("15/minute")
async def create_checkout_session(
    request: Request,
    body: CheckoutRequest,
    user_id: str = Depends(require_user),
):
    """Create a Stripe Checkout session. Returns checkout_url for redirect."""
    valid_plans = ("quick_single", "full_single", "pro", "single", "pack3")
    if body.plan not in valid_plans:
        raise HTTPException(400, "Invalid plan. Must be quick_single, full_single, or pro.")

    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(500, "Stripe not configured")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    # Get or create Stripe customer for this user
    customer_id = await _get_or_create_customer(user_id)

    # Map plan to Stripe price
    price_map = {
        "quick_single": settings.STRIPE_PRICE_QUICK_SINGLE,
        "full_single": settings.STRIPE_PRICE_FULL_SINGLE,
        "pro": settings.STRIPE_PRICE_PRO,
    }
    price_id = price_map.get(body.plan)
    if not price_id:
        raise HTTPException(500, f"Stripe price not configured for plan: {body.plan}")

    # Determine report tier from plan
    plan_tier_map = {
        "quick_single": "quick",
        "full_single": "full",
        "pro": "full",
    }

    mode = "subscription" if body.plan == "pro" else "payment"
    metadata = {"user_id": user_id, "plan": body.plan, "report_tier": plan_tier_map[body.plan]}
    if body.address_id:
        metadata["address_id"] = str(body.address_id)

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode=mode,
            line_items=[{"price": price_id, "quantity": 1}],
            metadata=metadata,
            success_url=f"{settings.FRONTEND_URL}/account/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/account/payment-cancelled",
            currency="nzd",
        )
    except stripe.StripeError as e:
        logger.error(f"Stripe checkout creation failed: {e}")
        log_error("payment", f"Checkout creation failed: {e}", user_id=user_id,
                  properties={"plan": body.plan})
        raise HTTPException(500, "Failed to create checkout session")

    track_event("payment_started", user_id=user_id,
                properties={"plan": body.plan, "address_id": body.address_id})
    return {"checkout_url": session.url}


async def _get_or_create_customer(user_id: str) -> str:
    """Get existing Stripe customer ID or create one."""
    stripe.api_key = settings.STRIPE_SECRET_KEY

    # Check if we already have a Stripe customer for this user
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT DISTINCT stripe_customer_id FROM report_credits
            WHERE user_id = %s AND stripe_customer_id IS NOT NULL
            LIMIT 1
            """,
            [user_id],
        )
        row = cur.fetchone()
        if row:
            return row["stripe_customer_id"]

        # Get user email for Stripe
        cur = await conn.execute(
            "SELECT email, display_name FROM users WHERE user_id = %s", [user_id]
        )
        user = cur.fetchone()

    email = user["email"] if user else None
    name = user["display_name"] if user else None

    customer = stripe.Customer.create(
        email=email,
        name=name,
        metadata={"user_id": user_id},
    )
    return customer.id


# =============================================================================
# Guest Checkout (no auth required)
# =============================================================================

@router.post("/checkout/guest-session")
@limiter.limit("5/minute")
async def create_guest_checkout_session(request: Request, body: GuestCheckoutRequest):
    """Create a Stripe Checkout session for guest (no-account) purchase."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(500, "Stripe not configured")

    guest_tier = "quick" if body.plan == "quick_single" else "full"
    if guest_tier == "quick":
        price_id = settings.STRIPE_PRICE_QUICK_SINGLE
    else:
        price_id = settings.STRIPE_PRICE_FULL_SINGLE
    if not price_id:
        raise HTTPException(500, "Stripe price not configured for report")

    # Validate address exists
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT 1 FROM addresses WHERE address_id = %s", [body.address_id]
        )
        if not cur.fetchone():
            raise HTTPException(404, "Address not found")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    metadata = {
        "plan": "guest_single",
        "address_id": str(body.address_id),
        "persona": body.persona,
        "report_tier": guest_tier,
    }

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": price_id, "quantity": 1}],
            metadata=metadata,
            success_url=f"{settings.FRONTEND_URL}/guest/download?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}",
            currency="nzd",
        )
    except stripe.StripeError as e:
        logger.error(f"Guest checkout creation failed: {e}")
        raise HTTPException(500, "Failed to create checkout session")

    return {"checkout_url": session.url}


@router.get("/checkout/guest-token")
@limiter.limit("5/minute")
async def exchange_guest_token(request: Request, session_id: str):
    """Exchange a Stripe session ID for a one-time download token. 5-minute window."""
    if not session_id:
        raise HTTPException(400, "session_id required")

    # Try Redis first (plaintext token available for 5 minutes)
    token = None
    if app_redis.redis_client:
        try:
            token = await app_redis.redis_client.get(f"guest_token:{session_id}")
            if token:
                # Delete immediately — one-time exchange
                await app_redis.redis_client.delete(f"guest_token:{session_id}")
        except Exception as e:
            logger.warning(f"Redis guest token lookup failed: {e}")

    if token:
        # Look up DB record for address_id and persona
        async with db.pool.connection() as conn:
            cur = await conn.execute(
                "SELECT address_id, persona FROM guest_purchases WHERE stripe_session_id = %s",
                [session_id],
            )
            row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Purchase not found")
        return {"token": token, "address_id": row["address_id"], "persona": row["persona"]}

    # Token not in Redis — check if DB record exists (token already exchanged)
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT 1 FROM guest_purchases WHERE stripe_session_id = %s",
            [session_id],
        )
        if cur.fetchone():
            raise HTTPException(410, "Token already retrieved. Check your email or contact support.")

    raise HTTPException(404, "Purchase not found. Payment may still be processing — try again in a few seconds.")
