# backend/app/main.py
from __future__ import annotations
import asyncio
import logging
import sys
from contextlib import asynccontextmanager

# Windows Python 3.14 fix: force SelectorEventLoop for psycopg3 compatibility
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import settings
from . import db
from .migrate import run_migrations
from . import redis as app_redis
from .deps import limiter

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: validate secrets, run migrations, open DB pool + Redis. Shutdown: close both."""
    settings.validate_secrets()
    run_migrations(settings.DATABASE_URL)
    await db.init_pool(settings.DATABASE_URL)
    await app_redis.init_redis(settings.REDIS_URL)
    yield
    await app_redis.close_redis()
    await db.close_pool()


app = FastAPI(
    title="WhareScore API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT == "development" else None,
)

# --- Middleware stack (order matters — outermost runs first) ---

# 1. Trusted Host — reject requests with spoofed Host header
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

# 2. Security headers — applied to ALL responses
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self), payment=(self), interest-cohort=()"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
    return response

# 3. CORS — strict origin list
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "PUT"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
    max_age=3600 if settings.ENVIRONMENT == "production" else 0,
)

# 4. Bot detection — block scrapers, detect scraping patterns
from .middleware.bot_detection import bot_detection_middleware
app.middleware("http")(bot_detection_middleware)

# 5. Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Global exception handlers ---

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True,
                 extra={"path": request.url.path, "method": request.method})
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# --- Health check ---

@app.get("/health")
async def health():
    checks = {"status": "ok", "db": False, "redis": False}
    try:
        async with db.pool.connection() as conn:
            await conn.execute("SELECT 1")
            checks["db"] = True
    except Exception:
        checks["status"] = "degraded"
    try:
        if app_redis.redis_client:
            await app_redis.redis_client.ping()
            checks["redis"] = True
    except Exception:
        checks["status"] = "degraded"
    return checks


# --- Router registration (add as each router is implemented) ---
from .routers import search, property as property_router, nearby, market, rates
app.include_router(search.router, prefix="/api/v1")
app.include_router(property_router.router, prefix="/api/v1")
app.include_router(nearby.router, prefix="/api/v1")
app.include_router(market.router, prefix="/api/v1")
app.include_router(rates.router, prefix="/api/v1")

from .routers import admin, reports
app.include_router(admin.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")

from .routers import suburb
app.include_router(suburb.router, prefix="/api/v1")

from .routers import rent_reports, feedback, email_signups
app.include_router(rent_reports.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")
app.include_router(email_signups.router, prefix="/api/v1")

from .routers import webhooks, payments, account
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(account.router, prefix="/api/v1")

from .routers import budget
app.include_router(budget.router, prefix="/api/v1")
