# backend/app/services/admin_auth.py
"""
Admin authentication: bcrypt password verification + Redis session tokens.
Falls back to in-memory sessions when Redis is unavailable (dev mode).
No user accounts in MVP — single admin password.
"""
from __future__ import annotations


import secrets
import time

import bcrypt
from fastapi import HTTPException, Request

from ..redis import cache_get, cache_set

ADMIN_SESSION_DURATION = 86400  # 24h

# In-memory fallback when Redis is unavailable: {token: expiry_timestamp}
_memory_sessions: dict[str, float] = {}


async def verify_admin(password: str, hashed_password: str) -> str | None:
    """Timing-safe password comparison. Returns session token or None."""
    if bcrypt.checkpw(password.encode(), hashed_password.encode()):
        token = secrets.token_urlsafe(32)
        await cache_set(f"admin_session:{token}", "1", ex=ADMIN_SESSION_DURATION)
        # Also store in memory as fallback
        _memory_sessions[token] = time.time() + ADMIN_SESSION_DURATION
        return token
    return None


async def delete_admin_session(token: str):
    """Invalidate an admin session token."""
    from ..redis import redis_client as _rc
    try:
        if _rc:
            await _rc.delete(f"admin_session:{token}")
    except Exception:
        pass
    _memory_sessions.pop(token, None)


async def require_admin(request: Request):
    """FastAPI dependency — validates admin session token from cookie."""
    token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(401, "Admin authentication required")
    # Check Redis first, fall back to in-memory
    session = await cache_get(f"admin_session:{token}")
    if not session:
        expiry = _memory_sessions.get(token)
        if not expiry or time.time() > expiry:
            raise HTTPException(401, "Session expired — please log in again")
