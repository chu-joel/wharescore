# Backend — Project Setup (Phase 2A)

**Creates:** FastAPI app scaffold, database pool, Redis cache, configuration
**Prerequisites:** PostgreSQL 18 running with `wharescore` database, all SQL files (01-09) executed
**Time estimate:** ~30 min

---

## Files to Create

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app, lifespan, middleware registration
│   ├── config.py         # pydantic-settings configuration
│   ├── db.py             # psycopg3 async connection pool
│   ├── redis.py          # Redis async client with graceful fallback
│   ├── deps.py           # Shared dependencies (limiter, rate limit key func)
│   ├── routers/
│   │   └── __init__.py
│   ├── schemas/
│   │   └── __init__.py
│   ├── services/
│   │   └── __init__.py
│   └── middleware/
│       └── __init__.py
├── .env                  # Environment variables (DO NOT commit)
├── .env.example          # Template for .env
└── requirements.txt      # Python dependencies
```

---

## Step 1: requirements.txt

```
# backend/requirements.txt
fastapi>=0.115
uvicorn[standard]>=0.32
psycopg[binary]>=3.2
psycopg_pool>=3.2
redis>=5.0
pydantic-settings>=2.6
orjson>=3.10
openai>=1.60
slowapi>=0.1.9
bcrypt>=4.2
python-dateutil>=2.9
pydantic[email]>=2.10
```

Create venv and install:
```bash
cd wharescore-poc/backend
py -3.14 -m venv .venv
.venv/Scripts/activate   # Windows
pip install -r requirements.txt
```

---

## Step 2: .env and .env.example

**`.env`** (create at `backend/.env`, never commit):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wharescore
REDIS_URL=redis://localhost:6379/0
MBIE_API_KEY=<your key from session 13>
LINZ_API_KEY=<get from basemaps.linz.govt.nz>
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com/openai/v1/
AZURE_OPENAI_API_KEY=<from Azure portal>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
ALLOWED_HOSTS=["localhost","127.0.0.1"]
ADMIN_PASSWORD_HASH=$2b$12$...
ENVIRONMENT=development
```

Generate admin password hash:
```bash
python -c "import bcrypt; print(bcrypt.hashpw(b'yourpassword', bcrypt.gensalt()).decode())"
```

**`.env.example`** (commit this):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wharescore
REDIS_URL=redis://localhost:6379/0
MBIE_API_KEY=
LINZ_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
CORS_ORIGINS=["http://localhost:3000"]
ALLOWED_HOSTS=["localhost","127.0.0.1"]
ADMIN_PASSWORD_HASH=
ENVIRONMENT=development
```

---

## Step 3: config.py

```python
# backend/app/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/wharescore"
    REDIS_URL: str = "redis://localhost:6379/0"
    MBIE_API_KEY: str = ""
    LINZ_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-4o-mini"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: list[str] = ["localhost", "127.0.0.1"]
    ADMIN_PASSWORD_HASH: str = ""
    ENVIRONMENT: str = "development"  # "production" enables HSTS, bot UA blocking

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

---

## Step 4: db.py — Async Connection Pool

```python
# backend/app/db.py
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row

pool: AsyncConnectionPool | None = None


async def init_pool(conninfo: str):
    """Create async connection pool. All connections use dict_row by default."""
    global pool
    pool = AsyncConnectionPool(
        conninfo,
        min_size=5,
        max_size=20,
        open=False,
        kwargs={"row_factory": dict_row},  # all queries return dicts, not tuples
    )
    await pool.open()


async def close_pool():
    if pool:
        await pool.close()
```

**Key design decisions:**
- `row_factory=dict_row` — every `fetchone()` / `fetchall()` returns dicts, not tuples. This means `row["column_name"]` works everywhere. No need for `dict(r)` casts.
- `min_size=5, max_size=20` — enough for concurrent requests without exhausting PostgreSQL connections.
- Pool is created closed (`open=False`) then explicitly opened in lifespan, ensuring clean startup/shutdown.

**Usage pattern in routers/services:**
```python
from ..db import pool

async with pool.connection() as conn:
    row = await (await conn.execute("SELECT ... WHERE id = %s", [some_id])).fetchone()
    # row is a dict: {"column_name": value, ...}
    # row is None if not found
```

**For write operations** (INSERT/UPDATE), psycopg3 defaults to autocommit=False. You must commit explicitly:
```python
async with pool.connection() as conn:
    await conn.execute("INSERT INTO ...", [...])
    await conn.commit()  # REQUIRED for writes
```

Or use a transaction block (auto-commits on success, auto-rolls-back on exception):
```python
async with pool.connection() as conn:
    async with conn.transaction():
        await conn.execute("INSERT INTO ...", [...])
        # auto-commits when block exits without exception
```

---

## Step 5: redis.py — Async Redis with Graceful Fallback

```python
# backend/app/redis.py
import logging
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

redis_client: aioredis.Redis | None = None


async def init_redis(redis_url: str):
    """Connect to Redis. If unavailable, app runs without cache (slower but functional)."""
    global redis_client
    try:
        redis_client = aioredis.from_url(redis_url, decode_responses=True)
        await redis_client.ping()
        logger.info("Redis connected")
    except Exception as e:
        logger.warning(f"Redis unavailable — running without cache: {e}")
        redis_client = None


async def close_redis():
    if redis_client:
        await redis_client.aclose()


async def cache_get(key: str) -> str | None:
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


async def cache_incr(key: str, expire: int | None = None) -> int:
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
```

**Redis is optional.** Every function gracefully returns a no-op/None on failure. The app runs without Redis — it just hits the database every time instead of serving from cache.

---

## Step 6: deps.py — Shared Dependencies

```python
# backend/app/deps.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from .config import settings

# Rate limiter — shared across all routers
# Uses Redis for distributed rate limiting; falls back to in-memory if Redis unavailable
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL,
    default_limits=["60/minute"],
    headers_enabled=True,  # adds X-RateLimit-* response headers
)
```

**Import pattern for routers:**
```python
from ..deps import limiter
```

---

## Step 7: main.py — FastAPI App

```python
# backend/app/main.py
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import settings
from .db import init_pool, close_pool, pool
from .redis import init_redis, close_redis, redis_client
from .deps import limiter

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: open DB pool + Redis. Shutdown: close both."""
    await init_pool(settings.DATABASE_URL)
    await init_redis(settings.REDIS_URL)
    yield
    await close_redis()
    await close_pool()


app = FastAPI(
    title="WhareScore API",
    version="1.0.0",
    lifespan=lifespan,
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
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
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
    max_age=3600,
)

# 4. Rate limiter
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
        async with pool.connection() as conn:
            await conn.execute("SELECT 1")
            checks["db"] = True
    except Exception:
        checks["status"] = "degraded"
    try:
        if redis_client:
            await redis_client.ping()
            checks["redis"] = True
    except Exception:
        checks["status"] = "degraded"
    return checks


# --- Router registration (add as each router is implemented) ---
# from .routers import search, property, nearby, market, rates
# from .routers import rent_reports, feedback, email_signups, admin
#
# app.include_router(search.router, prefix="/api/v1")
# app.include_router(property.router, prefix="/api/v1")
# app.include_router(nearby.router, prefix="/api/v1")
# app.include_router(market.router, prefix="/api/v1")
# app.include_router(rates.router, prefix="/api/v1")
# app.include_router(rent_reports.router, prefix="/api/v1")
# app.include_router(feedback.router, prefix="/api/v1")
# app.include_router(email_signups.router, prefix="/api/v1")
# app.include_router(admin.router, prefix="/api/v1")
```

---

## Step 8: Create Empty __init__.py Files

```bash
touch backend/app/__init__.py
touch backend/app/routers/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/services/__init__.py
touch backend/app/middleware/__init__.py
```

---

## Verification

After creating all files, run:

```bash
cd backend
.venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
```

Then test:
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","db":true,"redis":true}
# If Redis not installed: {"status":"degraded","db":true,"redis":false}

curl http://localhost:8000/docs
# Expected: Swagger UI with /health endpoint
```

---

## Next Steps

After this is working, implement in order:
1. **Security middleware** → `docs/backend/03-security.md`
2. **Search endpoint** → `docs/backend/04-search.md`
3. **Property report + scoring** → `docs/backend/05-report-and-scoring.md`
