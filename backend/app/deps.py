from __future__ import annotations

# backend/app/deps.py
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

logger = logging.getLogger(__name__)


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
    default_limits=["60/minute"],
    headers_enabled=False,  # True breaks with newer FastAPI/Starlette
)
