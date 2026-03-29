# backend/app/middleware/bot_detection.py
from __future__ import annotations
import re
import logging

from fastapi import Request
from starlette.responses import JSONResponse

from ..config import settings
from ..redis import cache_incr

logger = logging.getLogger("abuse")

# Known bot patterns to BLOCK (scrapers, headless browsers)
BLOCKED_UA_PATTERNS = [
    r"python-requests",
    r"scrapy",
    r"wget",
    r"phantomjs",
    r"headlesschrome",
    r"selenium",
    r"puppeteer",
]
BLOCKED_RE = re.compile("|".join(BLOCKED_UA_PATTERNS), re.IGNORECASE)

# Known GOOD bots to ALLOW (SEO crawlers)
ALLOWED_BOTS = ["googlebot", "bingbot", "duckduckbot", "facebookexternalhit"]


def _get_client_ip(request: Request) -> str:
    """Get real client IP from proxy headers, falling back to direct connection."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host


async def bot_detection_middleware(request: Request, call_next):
    ua = request.headers.get("user-agent", "")
    ip = _get_client_ip(request)

    # 1. Block empty User-Agent
    if not ua.strip():
        logger.warning("bot_blocked", extra={"ip": ip, "reason": "empty_ua"})
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})

    # 2. Allow known good bots
    ua_lower = ua.lower()
    if any(bot in ua_lower for bot in ALLOWED_BOTS):
        return await call_next(request)

    # 3. Block known bad patterns (production only — allow curl/wget in dev)
    if settings.ENVIRONMENT == "production" and BLOCKED_RE.search(ua):
        logger.warning("bot_blocked", extra={
            "ip": ip,
            "reason": "blocked_ua",
            "ua": ua[:200],
        })
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})

    # 4. Scraping pattern detection: >200 property API calls in 10min
    #    Exclude PDF status polling (fires every 1s) and export endpoints
    path = request.url.path
    if "/property/" in path and "/export/" not in path:
        count = await cache_incr(f"scrape_detect:{ip}", expire=600)
        if count > 200:
            logger.warning("scraping_detected", extra={
                "ip": ip, "unique_properties_10min": count})
            return JSONResponse(status_code=429, content={"detail": "Too many requests — suspected automated access"})

    return await call_next(request)
