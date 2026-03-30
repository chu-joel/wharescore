# backend/app/routers/reports.py
"""
Hosted interactive report endpoints.

GET /report/{share_token} — public, no auth. Returns pre-computed snapshot JSON.
POST /report/{share_token}/upgrade — upgrade Quick→Full report tier.
"""
from __future__ import annotations

import hashlib
import logging

import orjson
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from .. import db
from ..config import settings
from ..deps import limiter
from ..redis import cache_get, cache_set, cache_del
from ..services.auth import optional_user
from ..services.event_writer import track_event

logger = logging.getLogger(__name__)

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
            SELECT snapshot_json, created_at, expires_at, report_tier
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
    report_tier = row.get("report_tier", "full")

    # Inject tier + expiry into response (not into snapshot JSONB itself)
    response_data = snapshot if isinstance(snapshot, dict) else {}
    response_data["report_tier"] = report_tier
    if row.get("expires_at"):
        response_data["expires_at"] = row["expires_at"].isoformat()

    # Strip full-only fields from Quick Reports — the data stays in the DB
    # but never leaves the server until the tier is 'full'. Prevents
    # Postman/devtools access to paid data.
    if report_tier == "quick":
        _strip_full_only_fields(response_data)

    # Cache in Redis for 1 hour (snapshots are immutable)
    await cache_set(cache_key, orjson.dumps(response_data, default=str).decode(), ex=3600)

    return response_data


# Fields that Quick Report sections actually need (allowlist)
_QUICK_ALLOWED_KEYS = {
    "report", "meta", "report_tier", "expires_at",
    "ai_insights", "rent_baselines", "price_advisor",
    "school_zones", "nearby_highlights", "recommendations", "deltas",
}

# Fields inside ai_insights to keep for Quick (strip full narrative)
_QUICK_AI_KEYS = {"bottom_line", "key_takeaways"}


def _strip_full_only_fields(data: dict) -> None:
    """Remove full-report-only fields from the response dict in place."""
    keys_to_remove = [k for k in data if k not in _QUICK_ALLOWED_KEYS]
    for k in keys_to_remove:
        del data[k]

    # Strip AI insights to just bottom_line + key_takeaways
    ai = data.get("ai_insights")
    if isinstance(ai, dict):
        data["ai_insights"] = {k: v for k, v in ai.items() if k in _QUICK_AI_KEYS}

    # Trim recommendations to top 3
    recs = data.get("recommendations")
    if isinstance(recs, list) and len(recs) > 3:
        data["recommendations"] = recs[:3]

    # Strip PM transit times from liveability (full report only)
    report = data.get("report")
    if isinstance(report, dict):
        live = report.get("liveability")
        if isinstance(live, dict):
            live.pop("transit_travel_times_pm", None)


@router.post("/report/{share_token}/upgrade")
@limiter.limit("10/minute")
async def upgrade_report_tier(
    request: Request,
    share_token: str,
    user_id: str = Depends(optional_user),
):
    """Upgrade a Quick report to Full. Uses credit if available, otherwise Stripe checkout.
    Returns {upgraded: true} if credit was used, or {checkout_url} for Stripe redirect."""

    if not share_token or len(share_token) < 8:
        raise HTTPException(400, "Invalid token")

    token_hash = hashlib.sha256(share_token.encode()).hexdigest()

    # Verify snapshot exists and is currently 'quick'
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, report_tier FROM report_snapshots WHERE share_token_hash = %s",
            [token_hash],
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Report not found")

    if row["report_tier"] == "full":
        raise HTTPException(400, "Report is already a Full Report")

    snapshot_id = row["id"]

    # Try to use a credit first (if user is signed in and has full credits)
    if user_id:
        async with db.pool.connection() as conn:
            cur_credit = await conn.execute(
                """
                SELECT id, credits_remaining FROM report_credits
                WHERE user_id = %s
                  AND report_tier = 'full'
                  AND credits_remaining > 0
                  AND cancelled_at IS NULL
                  AND (expires_at IS NULL OR expires_at > now())
                ORDER BY
                  CASE credit_type WHEN 'pro' THEN 0 ELSE 1 END,
                  purchased_at DESC
                LIMIT 1
                """,
                [user_id],
            )
            credit = cur_credit.fetchone()

            if credit:
                # Deduct credit and upgrade immediately
                if credit["credits_remaining"] is not None:
                    await conn.execute(
                        "UPDATE report_credits SET credits_remaining = credits_remaining - 1 WHERE id = %s AND credits_remaining > 0",
                        [credit["id"]],
                    )
                await conn.execute(
                    "UPDATE report_snapshots SET report_tier = 'full', expires_at = NULL WHERE id = %s AND report_tier = 'quick'",
                    [snapshot_id],
                )

                # Invalidate Redis cache
                try:
                    from ..redis import cache_del
                    await cache_del(f"snapshot:{token_hash[:16]}")
                except Exception:
                    pass

                track_event("upgrade_with_credit", user_id=user_id,
                            properties={"snapshot_id": snapshot_id, "credit_id": credit["id"]})
                logger.info(f"Upgraded snapshot {snapshot_id} using credit {credit['id']} for user {user_id}")
                return {"upgraded": True, "method": "credit"}

    # No credits — create Stripe checkout
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(500, "Stripe not configured")

    price_id = settings.STRIPE_PRICE_UPGRADE or settings.STRIPE_PRICE_FULL_SINGLE
    if not price_id:
        raise HTTPException(500, "Upgrade price not configured")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    metadata = {
        "plan": "upgrade_quick_to_full",
        "snapshot_id": str(snapshot_id),
        "share_token_hash": token_hash,
    }
    if user_id:
        metadata["user_id"] = user_id

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": price_id, "quantity": 1}],
            metadata=metadata,
            success_url=f"{settings.FRONTEND_URL}/report/{share_token}?upgraded=1",
            cancel_url=f"{settings.FRONTEND_URL}/report/{share_token}",
            currency="nzd",
            allow_promotion_codes=True,
        )
    except Exception as e:
        logger.error(f"Upgrade checkout creation failed: {type(e).__name__}: {e}")
        raise HTTPException(500, "Failed to create checkout session")

    track_event("upgrade_started", user_id=user_id,
                properties={"snapshot_id": snapshot_id})

    return {"checkout_url": session.url}
