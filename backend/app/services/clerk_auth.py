"""Clerk JWT verification for FastAPI.

Fetches JWKS from Clerk (cached 6h), verifies RS256 tokens.
Provides FastAPI dependencies: require_user, optional_user.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Request

from ..config import settings

logger = logging.getLogger(__name__)

# JWKS client with built-in caching (lifespan=6h)
_jwks_client: Optional[PyJWKClient] = None
_jwks_client_init_time: float = 0
_JWKS_CACHE_SECONDS = 6 * 3600


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client, _jwks_client_init_time
    now = time.time()
    if _jwks_client is None or (now - _jwks_client_init_time) > _JWKS_CACHE_SECONDS:
        if not settings.CLERK_JWKS_URL:
            raise HTTPException(500, "Clerk JWKS URL not configured")
        _jwks_client = PyJWKClient(settings.CLERK_JWKS_URL, cache_keys=True)
        _jwks_client_init_time = now
    return _jwks_client


def verify_clerk_jwt(token: str) -> dict:
    """Decode and verify a Clerk RS256 JWT. Returns the decoded payload."""
    client = _get_jwks_client()
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk doesn't set aud by default
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid Clerk JWT: {e}")
        raise HTTPException(401, "Invalid token")


def _extract_bearer(request: Request) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


async def require_user(request: Request) -> str:
    """FastAPI dependency — returns clerk_id or raises 401."""
    token = _extract_bearer(request)
    if not token:
        raise HTTPException(401, "Authentication required")
    payload = verify_clerk_jwt(token)
    clerk_id = payload.get("sub")
    if not clerk_id:
        raise HTTPException(401, "Invalid token: missing sub")
    return clerk_id


async def optional_user(request: Request) -> Optional[str]:
    """FastAPI dependency — returns clerk_id or None (no error if unauthenticated)."""
    token = _extract_bearer(request)
    if not token:
        return None
    try:
        payload = verify_clerk_jwt(token)
        return payload.get("sub")
    except HTTPException:
        return None
