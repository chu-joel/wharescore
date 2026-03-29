# backend/app/services/admin_auth.py
"""
Admin authentication: email-based allowlist via OAuth/JWT.
Admin users are defined in the ADMIN_EMAILS environment variable.
"""
from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, Request

from ..config import settings
from .auth import optional_user

logger = logging.getLogger(__name__)


async def get_admin_email(request: Request, user_id: str = Depends(optional_user)) -> str:
    """Extract email from the authenticated user. Returns email or raises 401."""
    if not user_id:
        raise HTTPException(401, "Sign in required")

    # user_id in our system is the email from OAuth
    # But let's also check the DB to be safe
    from .. import db
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT email FROM users WHERE user_id = %s", [user_id]
        )
        row = cur.fetchone()

    email = (row["email"] if row else user_id).lower().strip()
    if not email:
        raise HTTPException(401, "Sign in required")
    return email


async def require_admin(request: Request, email: str = Depends(get_admin_email)):
    """FastAPI dependency — checks if the signed-in user's email is in the admin allowlist."""
    admin_emails = settings.get_admin_emails()

    # Dev mode: allow all authenticated users when no ADMIN_EMAILS configured
    if not admin_emails and settings.ENVIRONMENT == "development":
        return email

    if email not in admin_emails:
        logger.warning(f"ADMIN_AUDIT: access_denied for {email}")
        raise HTTPException(403, "You don't have admin access")

    return email
