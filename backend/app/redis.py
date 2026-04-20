# backend/app/redis.py
from __future__ import annotations
import logging
from typing import Optional
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

redis_client: Optional[aioredis.Redis] = None


async def init_redis(redis_url: str):
    """Connect to Redis. If unavailable, app runs without cache (slower but functional)."""
    global redis_client
    try:
        redis_client = aioredis.from_url(redis_url, decode_responses=True)
        await redis_client.ping()
        logger.info("Redis connected")
    except Exception as e:
        logger.warning(f"Redis unavailable. running without cache: {e}")
        redis_client = None


async def close_redis():
    if redis_client:
        await redis_client.aclose()


async def cache_get(key: str) -> Optional[str]:
    """Get cached value. Returns None if Redis unavailable or key missing."""
    if not redis_client:
        return None
    try:
        return await redis_client.get(key)
    except Exception:
        return None


async def cache_set(key: str, value: str, ex: int = 86400) -> None:
    """Set cached value with TTL (default 24h). No-op if Redis unavailable."""
    if not redis_client:
        return
    try:
        await redis_client.set(key, value, ex=ex)
    except Exception:
        pass  # cache write failure is non-fatal


async def cache_del(key: str) -> None:
    """Delete a cached key. No-op if Redis unavailable."""
    if not redis_client:
        return
    try:
        await redis_client.delete(key)
    except Exception:
        pass


async def cache_incr(key: str, expire: Optional[int] = None) -> int:
    """Increment counter. Returns 0 if Redis unavailable (disables rate features)."""
    if not redis_client:
        return 0
    try:
        val = await redis_client.incr(key)
        if val == 1 and expire:
            await redis_client.expire(key, expire)
        return val
    except Exception:
        return 0
