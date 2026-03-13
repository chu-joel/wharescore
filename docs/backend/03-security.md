# Backend — Security & Hardening (Phase 2A continued)

**Creates:** Bot detection middleware, abuse logging service, Cloudflare WAF config notes
**Prerequisites:** `02-project-setup.md` complete (main.py has middleware stack, deps.py has limiter)
**Note:** Rate limiting (`@limiter.limit()`) is applied per-endpoint in each router file, not here. This file covers the middleware layer and security policies.

---

## Files to Create

```
backend/app/
├── middleware/
│   └── bot_detection.py    # UA filtering + scraping pattern detection
└── services/
    └── abuse_logger.py     # Structured logging for security events
```

---

## Per-Endpoint Rate Limits

These are applied in each router file using `@limiter.limit()`. This table is the reference:

| Endpoint Pattern | Limit | Rationale |
|-----------------|-------|-----------|
| `GET /health` | 60/min | Monitoring tools |
| `GET /search/address` | 30/min | Debounced 200ms on frontend, real users ~5-10/min |
| `GET /property/*/report` | 20/min | Heavy query (~300ms DB), cached 24h |
| `GET /property/*/market` | 20/min | Same as report |
| `GET /property/*/rates` | 10/min | Calls external WCC API |
| `GET /property/*/rent-history` | 20/min | Bonds query |
| `GET /market/hpi` | 30/min | Lightweight, globally cacheable |
| `GET /nearby/*` | 40/min | Multiple fire per report load |
| `POST /rent-reports` | 3/hour | Write endpoint |
| `POST /feedback` | 5/hour | Write endpoint |
| `POST /email-signups` | 3/hour | Write endpoint |
| `POST /admin/login` | 5/15min | Brute-force protection |
| `GET /admin/*` | 30/min | Auth required |
| `PATCH,PUT /admin/*` | 10/min | Auth required, write ops |

**Usage in routers:**
```python
from ..deps import limiter

@router.get("/search/address")
@limiter.limit("30/minute")
async def search_address(request: Request, ...):
    # request: Request is REQUIRED by slowapi — it reads the client IP from it
    ...
```

---

## Bot Detection Middleware

```python
# backend/app/middleware/bot_detection.py
import re
import logging

from fastapi import Request, HTTPException

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


async def bot_detection_middleware(request: Request, call_next):
    ua = request.headers.get("user-agent", "")

    # 1. Block empty User-Agent
    if not ua.strip():
        logger.warning("bot_blocked", extra={
            "ip": request.client.host, "reason": "empty_ua"})
        raise HTTPException(403, "Forbidden")

    # 2. Allow known good bots
    ua_lower = ua.lower()
    if any(bot in ua_lower for bot in ALLOWED_BOTS):
        return await call_next(request)

    # 3. Block known bad patterns (production only — allow curl/wget in dev)
    if settings.ENVIRONMENT == "production" and BLOCKED_RE.search(ua):
        logger.warning("bot_blocked", extra={
            "ip": request.client.host,
            "reason": "blocked_ua",
            "ua": ua[:200],
        })
        raise HTTPException(403, "Forbidden")

    # 4. Scraping pattern detection: >50 unique property lookups in 10min
    if "/property/" in request.url.path:
        ip = request.client.host
        count = await cache_incr(f"scrape_detect:{ip}", expire=600)
        if count > 50:
            logger.warning("scraping_detected", extra={
                "ip": ip, "unique_properties_10min": count})
            raise HTTPException(429, "Too many requests — suspected automated access")

    return await call_next(request)
```

**Register in main.py** (add after CORS middleware, before routers):
```python
from .middleware.bot_detection import bot_detection_middleware
app.middleware("http")(bot_detection_middleware)
```

---

## Abuse Logging Service

```python
# backend/app/services/abuse_logger.py
import logging

from fastapi import Request

abuse_logger = logging.getLogger("abuse")


def log_rate_limit(request: Request, endpoint: str):
    abuse_logger.warning("rate_limit_hit", extra={
        "ip": request.client.host,
        "endpoint": endpoint,
        "ua": request.headers.get("user-agent", "")[:200],
    })


def log_bot_block(request: Request, reason: str):
    abuse_logger.warning("bot_blocked", extra={
        "ip": request.client.host,
        "reason": reason,
        "ua": request.headers.get("user-agent", "")[:200],
    })


def log_scraping_pattern(request: Request, count: int):
    abuse_logger.warning("scraping_detected", extra={
        "ip": request.client.host,
        "unique_properties_10min": count,
    })


def log_admin_login(request: Request, success: bool):
    abuse_logger.info("admin_login", extra={
        "ip": request.client.host,
        "success": success,
    })
```

---

## Honeypot Pattern for Write Endpoints

All write-endpoint Pydantic schemas include a hidden `website` field that bots auto-fill. The router silently accepts (returns fake success) but does NOT store the data.

```python
# In any Pydantic schema for a write endpoint:
class SomeSubmission(BaseModel):
    # ... real fields ...
    website: str | None = Field(None, exclude=True)  # honeypot

# In the router:
@router.post("/some-endpoint", status_code=201)
async def submit(body: SomeSubmission):
    if body.website:  # bot triggered honeypot
        return {"status": "accepted"}  # fake success
    # ... real logic ...
```

---

## Input Validation Summary

Every endpoint validates inputs via Pydantic models or FastAPI `Query()` constraints:

| Parameter | Validation | Endpoints |
|-----------|-----------|-----------|
| `address_id` | `int` (path param — rejects non-numeric) | All `/property/*`, `/nearby/*` |
| `q` (search) | `str`, min 3, max 200 chars | `/search/address` |
| `limit` | `int`, `le=20` | `/search/address` |
| `radius` | `int`, `le=5000` (or `le=10000`) | `/nearby/*` |
| `asking_rent` | `int`, `ge=50, le=10000` | `/property/*/market` |
| `dwelling_type` | Regex: `^(House\|Flat\|Apartment\|Room)$` | `/rent-reports` |
| `bedrooms` | Regex: `^(1\|2\|3\|4\|5\+)$` | `/rent-reports` |
| `reported_rent` | `int`, `ge=50, le=5000` | `/rent-reports` |
| `type` (feedback) | Regex: `^(bug\|feature\|general)$` | `/feedback` |
| `description` | `str`, min 10, max 5000 | `/feedback` |
| `email` | Pydantic `EmailStr`, max 255 | `/feedback`, `/email-signups` |

---

## OWASP Top 10 Coverage

| # | Category | How It's Covered |
|---|----------|-----------------|
| A01 | Broken Access Control | Admin routes behind `Depends(require_admin)`. CORS strict. `X-Frame-Options: DENY`. |
| A02 | Crypto Failures | HTTPS via HSTS. IPs SHA-256 hashed. Admin pw bcrypt. No PII stored. |
| A03 | Injection | Parameterized queries everywhere (`%s` placeholders). CSP header. React auto-escapes. |
| A04 | Insecure Design | Rate limiting. Honeypot fields. Pydantic validation. |
| A05 | Misconfiguration | Debug off in prod. No default creds. No `CORS *`. Stack traces hidden. |
| A06 | Vulnerable Components | Pin versions. `pip-audit` in CI. Dependabot alerts. |
| A07 | Auth Failures | bcrypt + timing-safe compare + Redis sessions + httpOnly cookies + login rate limit. |
| A08 | Data Integrity | No untrusted deserialization. Pydantic validates all inputs. orjson (no eval/pickle). |
| A09 | Logging | Structured JSON logging for 4xx/5xx, rate limits, bot blocks, admin logins. |
| A10 | SSRF | WCC API uses hardcoded base URL. No user-controlled URLs trigger server-side fetches. |

---

## Error Leakage Prevention

The global exception handler in `main.py` (from `02-project-setup.md`) ensures:
- **Server-side:** Full stack trace logged with path and method
- **Client-side:** Generic `{"error": "Internal server error"}` — no SQL errors, file paths, or stack traces

---

## Cloudflare WAF (Production)

Configure in Cloudflare dashboard when deploying:

1. **SSL/TLS** → Full (strict), minimum TLS 1.2
2. **Security** → Bot Fight Mode → On
3. **Security** → WAF → Managed Rules → On (OWASP Core Ruleset)
4. **Security** → Rate Limiting → `URI path contains /api/` → 100 req/10s per IP → Block
5. **Caching** → `/api/v1/market/hpi` cache 1h, `.pbf` tiles cache 7d
6. **SSL** → Always Use HTTPS → On

---

## Verification

After adding bot detection middleware:

```bash
# Should work (browser UA):
curl -H "User-Agent: Mozilla/5.0" http://localhost:8000/health

# Should return 403 in production (but pass in dev):
curl http://localhost:8000/health  # curl UA
```
