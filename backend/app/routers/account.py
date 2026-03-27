"""Account endpoints — credits, saved reports, subscription management."""
from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse

from .. import db
from ..config import settings
from ..deps import limiter
from ..services.auth import require_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/account", tags=["account"])


@router.get("/credits")
async def get_credits(user_id: str = Depends(require_user)):
    """Get current user's plan and credit balance."""
    async with db.pool.connection() as conn:
        # User plan
        cur = await conn.execute(
            "SELECT plan, display_name FROM users WHERE user_id = %s", [user_id]
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(404, "User not found")

        plan = user["plan"]

        # Active credits (best available)
        cur = await conn.execute(
            """
            SELECT credit_type, credits_remaining, daily_limit, monthly_limit
            FROM report_credits
            WHERE user_id = %s
              AND (expires_at IS NULL OR expires_at > now())
              AND cancelled_at IS NULL
              AND (credits_remaining > 0 OR credit_type = 'pro')
            ORDER BY
              CASE credit_type WHEN 'pro' THEN 0 ELSE 1 END,
              purchased_at DESC
            LIMIT 1
            """,
            [user_id],
        )
        credit = cur.fetchone()

        # Download counts
        cur_today = await conn.execute(
            "SELECT count_user_downloads_today(%s) AS cnt", [user_id]
        )
        downloads_today = cur_today.fetchone()["cnt"]

        cur_month = await conn.execute(
            "SELECT count_user_downloads_month(%s) AS cnt", [user_id]
        )
        downloads_this_month = cur_month.fetchone()["cnt"]

    # Total remaining credits across all credit-based purchases
    credits_remaining = None
    daily_limit = None
    monthly_limit = None

    if credit:
        if credit["credit_type"] == "pro":
            daily_limit = credit["daily_limit"] or 10
            monthly_limit = credit["monthly_limit"] or 30
        else:
            # Sum all remaining credits for credit-based plans
            async with db.pool.connection() as conn:
                cur = await conn.execute(
                    """
                    SELECT COALESCE(SUM(credits_remaining), 0)::int AS total
                    FROM report_credits
                    WHERE user_id = %s
                      AND credit_type IN ('single', 'pack3', 'promo')
                      AND credits_remaining > 0
                      AND (expires_at IS NULL OR expires_at > now())
                      AND cancelled_at IS NULL
                    """,
                    [user_id],
                )
                credits_remaining = cur.fetchone()["total"]

    # Effective plan: if users.plan is 'free' but they have active credits, use the credit type
    effective_plan = plan
    if plan == "free" and credit:
        effective_plan = credit["credit_type"]  # 'single', 'pack3', 'promo', or 'pro'

    return {
        "plan": effective_plan,
        "display_name": user["display_name"],
        "credits_remaining": credits_remaining,
        "daily_limit": daily_limit,
        "monthly_limit": monthly_limit,
        "downloads_today": downloads_today,
        "downloads_this_month": downloads_this_month,
    }


@router.get("/saved-reports")
async def get_saved_reports(
    user_id: str = Depends(require_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get paginated list of user's saved reports."""
    offset = (page - 1) * per_page

    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT id, address_id, full_address, persona, generated_at, share_token
            FROM saved_reports
            WHERE user_id = %s
            ORDER BY generated_at DESC
            LIMIT %s OFFSET %s
            """,
            [user_id, per_page, offset],
        )
        reports = [dict(r) for r in cur.fetchall()]

        cur_count = await conn.execute(
            "SELECT COUNT(*) AS total FROM saved_reports WHERE user_id = %s",
            [user_id],
        )
        total = cur_count.fetchone()["total"]

    return {
        "reports": reports,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/saved-reports/{report_id}/download")
async def download_saved_report(
    report_id: int,
    user_id: str = Depends(require_user),
):
    """Download a previously saved report (original HTML snapshot, no credit charge)."""
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT report_html, full_address, generated_at
            FROM saved_reports
            WHERE id = %s AND user_id = %s
            """,
            [report_id, user_id],
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Report not found")

    return HTMLResponse(
        content=row["report_html"],
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-store",
        },
    )


@router.post("/saved-properties")
async def save_property(
    user_id: str = Depends(require_user),
    body: dict = {},
):
    """Save a property bookmark (free — no credit required)."""
    address_id = body.get("address_id")
    full_address = body.get("full_address", "")
    if not address_id:
        raise HTTPException(400, "address_id required")

    async with db.pool.connection() as conn:
        # Upsert — don't duplicate
        await conn.execute(
            """
            INSERT INTO saved_properties (user_id, address_id, full_address)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, address_id) DO NOTHING
            """,
            [user_id, address_id, full_address],
        )

    return {"status": "ok"}


@router.post("/email-summary")
async def email_summary(
    user_id: str = Depends(require_user),
    body: dict = {},
):
    """Record interest and queue email summary for a property.

    For now, records the interest in the saved_properties table
    (for abandoned-cart nurture emails) and returns success.
    Actual email sending will be added when email infrastructure
    (SendGrid/Resend) is configured.
    """
    address_id = body.get("address_id")
    if not address_id:
        raise HTTPException(400, "address_id required")

    async with db.pool.connection() as conn:
        # Get the user's email
        cur = await conn.execute(
            "SELECT email FROM users WHERE user_id = %s", [user_id]
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(404, "User not found")

        # Get the address details
        cur = await conn.execute(
            "SELECT full_address FROM addresses WHERE address_id = %s", [address_id]
        )
        addr = cur.fetchone()
        full_address = addr["full_address"] if addr else "Unknown"

        # Record interest (upsert into saved_properties)
        await conn.execute(
            """
            INSERT INTO saved_properties (user_id, address_id, full_address)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, address_id) DO NOTHING
            """,
            [user_id, address_id, full_address],
        )

    # TODO: Send email via SendGrid/Resend when configured
    # For now, just record the interest for future nurture emails
    logger.info(f"Email summary requested: user={user_id}, address={address_id}, email={user['email']}")

    return {"status": "ok", "email": user["email"]}


@router.post("/manage-subscription")
async def manage_subscription(user_id: str = Depends(require_user)):
    """Create a Stripe Customer Portal session for subscription management."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(500, "Stripe not configured")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    # Find Stripe customer ID
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

    if not row:
        raise HTTPException(400, "No Stripe account found. Make a purchase first.")

    try:
        session = stripe.billing_portal.Session.create(
            customer=row["stripe_customer_id"],
            return_url=f"{settings.FRONTEND_URL}/account",
        )
    except stripe.StripeError as e:
        logger.error(f"Stripe portal session failed: {e}")
        raise HTTPException(500, "Failed to create portal session")

    return {"portal_url": session.url}


# Valid promo codes: {code: {credits_per_use, max_uses_per_user}}
_PROMO_CODES = {
    "WHARESCOREJOEL": {"credits": 1, "max_uses_per_user": 999},
}


@router.post("/redeem-promo")
@limiter.limit("15/minute")
async def redeem_promo(request: Request, user_id: str = Depends(require_user)):
    """Redeem a promo code for free report credits."""
    body = await request.json()
    code = (body.get("code") or "").strip().upper()

    promo = _PROMO_CODES.get(code)
    if not promo:
        raise HTTPException(400, "Invalid promo code")

    async with db.pool.connection() as conn:
        # Ensure user exists (dev-local-user or first-time user)
        await conn.execute(
            """
            INSERT INTO users (user_id, email, display_name, plan)
            VALUES (%s, '', NULL, 'free')
            ON CONFLICT (user_id) DO NOTHING
            """,
            [user_id],
        )

        # Check how many times this user has redeemed this code
        cur = await conn.execute(
            "SELECT COUNT(*) AS cnt FROM promo_redemptions WHERE user_id = %s AND code = %s",
            [user_id, code],
        )
        used = cur.fetchone()["cnt"]
        if used >= promo["max_uses_per_user"]:
            raise HTTPException(400, "Promo code already used maximum times")

        # Record redemption
        await conn.execute(
            "INSERT INTO promo_redemptions (user_id, code) VALUES (%s, %s)",
            [user_id, code],
        )

        # Add credits
        await conn.execute(
            """
            INSERT INTO report_credits (user_id, credit_type, credits_remaining)
            VALUES (%s, 'promo', %s)
            """,
            [user_id, promo["credits"]],
        )

        # Fetch updated total
        cur = await conn.execute(
            """
            SELECT COALESCE(SUM(credits_remaining), 0)::int AS total
            FROM report_credits
            WHERE user_id = %s
              AND credits_remaining > 0
              AND (expires_at IS NULL OR expires_at > now())
              AND cancelled_at IS NULL
            """,
            [user_id],
        )
        total = cur.fetchone()["total"]

    logger.info(f"Promo redeemed: user={user_id}, code={code}, credits={promo['credits']}")
    return {"message": "1 free report unlocked!", "credits_remaining": total}
