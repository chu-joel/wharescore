from __future__ import annotations

# backend/app/deps.py
import logging

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

logger = logging.getLogger(__name__)


def user_or_ip_key(request: Request) -> str:
    """Rate-limit key: `user:{sub}` for authenticated requests (verified JWT),
    IP address otherwise. Used by endpoints where signed-in users should get
    their own bucket distinct from anonymous callers sharing an IP (e.g. the
    browser extension hitting from a corporate NAT)."""
    # Local import avoids a circular deps ↔ services.auth import at startup.
    from .services.auth import _extract_bearer, verify_jwt

    token = _extract_bearer(request)
    if token:
        try:
            payload = verify_jwt(token)
            sub = payload.get("sub")
            if sub:
                return f"user:{sub}"
        except Exception:
            pass
    return get_remote_address(request)


def _get_storage_uri() -> str | None:
    """Use Redis for rate limiting if available, otherwise in-memory."""
    if not settings.REDIS_URL:
        return None
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=1)
        r.ping()
        logger.info("Rate limiter using Redis")
        return settings.REDIS_URL
    except Exception:
        logger.info("Rate limiter using in-memory storage (Redis unavailable)")
        return None


# Rate limiter — shared across all routers
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_get_storage_uri(),
    default_limits=["120/minute"],
    headers_enabled=False,  # True breaks with newer FastAPI/Starlette
)
