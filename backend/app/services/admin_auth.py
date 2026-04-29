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
    """FastAPI dependency. checks if the signed-in user's email is in the admin allowlist."""
    admin_emails = settings.get_admin_emails()

    # Dev mode: allow all authenticated users when no ADMIN_EMAILS configured
    if not admin_emails and settings.ENVIRONMENT == "development":
        return email

    if email not in admin_emails:
        logger.warning(f"ADMIN_AUDIT: access_denied for {email}")
        raise HTTPException(403, "You don't have admin access")

    return email


async def require_admin_or_service_token(request: Request):
    """Like `require_admin`, but ALSO accepts a service token via the
    `Authorization: Bearer <token>` header. Used by cron / automation
    endpoints (e.g. the daily data-refresh GH Actions workflow) where
    OAuth flow isn't available.

    Token is validated against `settings.ADMIN_API_TOKEN` — set this in
    the prod env (`ADMIN_API_TOKEN` GitHub secret + `.env.prod`). When
    unset, the service-token path is disabled and only OAuth admins can
    reach the endpoint."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer ") and settings.ADMIN_API_TOKEN:
        token = auth_header[len("Bearer "):].strip()
        if token and _constant_time_eq(token, settings.ADMIN_API_TOKEN):
            client_ip = request.client.host if request.client else "unknown"
            logger.info(f"ADMIN_AUDIT: service_token_accepted from {client_ip}")
            return "service-token"

    # Fall back to OAuth admin path. Reuse `require_admin` semantics.
    from .auth import optional_user
    user_id = await optional_user(request)
    if not user_id:
        raise HTTPException(401, "Sign in required (or provide a valid Bearer token)")

    from .. import db
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT email FROM users WHERE user_id = %s", [user_id]
        )
        row = cur.fetchone()
    email = (row["email"] if row else user_id).lower().strip()

    admin_emails = settings.get_admin_emails()
    if not admin_emails and settings.ENVIRONMENT == "development":
        return email
    if email not in admin_emails:
        logger.warning(f"ADMIN_AUDIT: access_denied for {email}")
        raise HTTPException(403, "You don't have admin access")
    return email


def _constant_time_eq(a: str, b: str) -> bool:
    """Constant-time string equality. Avoids timing attacks against the
    service token. Python's `hmac.compare_digest` does the right thing."""
    import hmac
    return hmac.compare_digest(a.encode(), b.encode())
