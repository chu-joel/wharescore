"""Auth.js JWT verification for FastAPI.

Verifies HS256 tokens signed with AUTH_SECRET (shared with Next.js Auth.js).
Provides FastAPI dependencies: require_user, optional_user.
Auto-creates user in DB on first authenticated request.
"""
from __future__ import annotations

import logging
from typing import Optional

import jwt
from fastapi import HTTPException, Request

from .. import db
from ..config import settings

logger = logging.getLogger(__name__)


def verify_jwt(token: str) -> dict:
    """Decode and verify an HS256 JWT signed with AUTH_SECRET."""
    if not settings.AUTH_SECRET:
        raise HTTPException(500, "AUTH_SECRET not configured")
    try:
        payload = jwt.decode(
            token,
            settings.AUTH_SECRET,
            algorithms=["HS256"],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        logger.warning("Invalid JWT received")
        raise HTTPException(401, "Invalid token")


def _extract_bearer(request: Request) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


async def _ensure_user_exists(user_id: str, email: str | None, name: str | None):
    """Auto-create user on first authenticated request."""
    try:
        async with db.pool.connection() as conn:
            await conn.execute(
                """
                INSERT INTO users (user_id, email, display_name, plan)
                VALUES (%s, %s, %s, 'free')
                ON CONFLICT (user_id) DO UPDATE
                SET email = COALESCE(EXCLUDED.email, users.email),
                    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
                    updated_at = now()
                """,
                [user_id, email or "", name],
            )
            # Link any guest purchases made with this email
            if email:
                await conn.execute(
                    """
                    UPDATE guest_purchases SET user_id = %s
                    WHERE email = %s AND user_id IS NULL
                    """,
                    [user_id, email],
                )
    except Exception as e:
        # Don't fail the request if user creation fails (table might not exist yet)
        logger.warning(f"Failed to ensure user exists: {e}")


async def require_user(request: Request) -> str:
    """FastAPI dependency. returns user_id or raises 401."""
    # Dev mode bypass. allow unauthenticated access on localhost
    from ..config import settings
    if settings.ENVIRONMENT == "development":
        token = _extract_bearer(request)
        if not token:
            client_ip = request.client.host if request.client else ""
            if client_ip in ("127.0.0.1", "::1", "localhost"):
                await _ensure_user_exists("dev-local-user", "dev@localhost", "Dev User")
                return "dev-local-user"

    token = _extract_bearer(request)
    if not token:
        raise HTTPException(401, "Authentication required")
    payload = verify_jwt(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid token: missing sub")

    # Auto-create user on first request
    await _ensure_user_exists(user_id, payload.get("email"), payload.get("name"))

    return user_id


async def optional_user(request: Request) -> Optional[str]:
    """FastAPI dependency. returns user_id or None (no error if unauthenticated)."""
    token = _extract_bearer(request)
    if not token:
        return None
    try:
        payload = verify_jwt(token)
        user_id = payload.get("sub")
        if user_id:
            await _ensure_user_exists(user_id, payload.get("email"), payload.get("name"))
        return user_id
    except HTTPException:
        return None
