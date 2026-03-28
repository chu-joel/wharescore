"""Credit check service — verifies user has active credits or Pro limits.

Provides require_paid_user dependency for endpoints that require payment.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, Request

from .. import db
from .auth import require_user, optional_user

logger = logging.getLogger(__name__)


@dataclass
class CreditInfo:
    user_id: str
    plan: str
    credit_id: Optional[int]  # report_credits.id for deduction
    credits_remaining: Optional[int]
    daily_limit: Optional[int]
    monthly_limit: Optional[int]
    downloads_today: int
    downloads_this_month: int
    report_tier: str = "full"  # "quick" or "full"

    @property
    def is_pro(self) -> bool:
        return self.plan == "pro"


async def require_paid_user(
    request: Request,
    user_id: str = Depends(optional_user),
) -> CreditInfo:
    """FastAPI dependency — returns CreditInfo or raises 403 if no credits."""
    from ..config import settings

    # Dev mode: bypass credit + auth check entirely (localhost only)
    if settings.ENVIRONMENT == "development":
        client_ip = request.client.host if request.client else ""
        if client_ip in ("127.0.0.1", "::1", "localhost"):
            return CreditInfo(
                user_id=user_id or "dev-local-user",
                plan="promo",
                credit_id=None,
                credits_remaining=99,
                daily_limit=None,
                monthly_limit=None,
                downloads_today=0,
                downloads_this_month=0,
            )

    # Normal flow: require authentication
    if not user_id:
        raise HTTPException(401, "Authentication required")

    async with db.pool.connection() as conn:
        # Get user plan
        cur = await conn.execute(
            "SELECT plan FROM users WHERE user_id = %s", [user_id]
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(403, "User account not found")

        plan = user["plan"]

        # Get active credits (check BEFORE blocking free plan — user may have promo/purchased credits)
        cur = await conn.execute(
            """
            SELECT id, credit_type, credits_remaining, daily_limit, monthly_limit, report_tier
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

        if not credit:
            if plan == "free":
                raise HTTPException(403, "Upgrade required to download reports")
            raise HTTPException(403, "No active credits. Purchase a report or upgrade your plan.")

        # Get download counts
        cur_today = await conn.execute(
            "SELECT count_user_downloads_today(%s) AS cnt", [user_id]
        )
        downloads_today = cur_today.fetchone()["cnt"]

        cur_month = await conn.execute(
            "SELECT count_user_downloads_month(%s) AS cnt", [user_id]
        )
        downloads_this_month = cur_month.fetchone()["cnt"]

        # Pro plan — check limits
        if credit["credit_type"] == "pro":
            daily_limit = credit["daily_limit"] or 10
            monthly_limit = credit["monthly_limit"] or 30
            if downloads_today >= daily_limit:
                raise HTTPException(
                    403,
                    f"Daily limit reached ({daily_limit} reports). Resets at midnight.",
                )
            if downloads_this_month >= monthly_limit:
                raise HTTPException(
                    403,
                    f"Monthly limit reached ({monthly_limit} reports). Resets next month.",
                )

        return CreditInfo(
            user_id=user_id,
            plan=plan,
            credit_id=credit["id"],
            credits_remaining=credit["credits_remaining"],
            daily_limit=credit["daily_limit"],
            monthly_limit=credit["monthly_limit"],
            downloads_today=downloads_today,
            downloads_this_month=downloads_this_month,
            report_tier=credit.get("report_tier", "full"),
        )
