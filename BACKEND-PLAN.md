# WhareScore — Backend Implementation Plan

**Split from:** IMPLEMENTATION-PLAN.md | **Phases covered:** 1 (Database) + 2 (FastAPI) + Security

**See also:** `IMPLEMENTATION-PLAN.md` (overview, project structure), `FRONTEND-PLAN.md` (Phases 3-5), `docs/DATABASE-SCHEMA.md` (table schemas)

---

## Status

**Phase 1 (Database Layer): COMPLETE** — All SQL files exist and are executed (`sql/05-views.sql` through `sql/09-application-tables.sql`). 16 spatial views, 4 materialized views, `get_property_report()` function (~289ms warm), TOAST optimization, all indexes.

**Phase 2 (FastAPI Backend): NOT STARTED** — `backend/` directory does not exist yet. All Phase 2 code is documented in the split files below.

---

## Document Map

Implementation is split into 10 files in `docs/backend/`. **Build in order** — each file lists its prerequisites.

| # | File | Phase | What It Creates | Lines |
|---|------|-------|----------------|-------|
| 1 | [`02-project-setup.md`](docs/backend/02-project-setup.md) | 2A | FastAPI scaffold, DB pool, Redis, config, main.py | ~210 |
| 2 | [`03-security.md`](docs/backend/03-security.md) | 2A+ | Bot detection middleware, rate limit table, OWASP coverage | ~190 |
| 3 | [`04-search.md`](docs/backend/04-search.md) | 2B | Three-tier address search, abbreviation expansion | ~180 |
| 4 | [`05-report-and-scoring.md`](docs/backend/05-report-and-scoring.md) | 2C+2D | Property report endpoint, risk score service (~350 lines of scoring) | ~400 |
| 5 | [`06-nearby-endpoints.md`](docs/backend/06-nearby-endpoints.md) | 2E | 10 GeoJSON FeatureCollection endpoints | ~290 |
| 6 | [`07-market-engine.md`](docs/backend/07-market-engine.md) | 2F+2G-0 | Fair price endpoint, rent history, HPI trend | ~370 |
| 7 | [`08-ai-features.md`](docs/backend/08-ai-features.md) | 2G | Area profile batch script, AI property summary service | ~210 |
| 8 | [`09-rates-integration.md`](docs/backend/09-rates-integration.md) | 2H | WCC rates live API + DB cache | ~220 |
| 9 | [`10-user-endpoints.md`](docs/backend/10-user-endpoints.md) | 2I+2J | Rent reports (5-layer validation), feedback, email signups | ~250 |
| 10 | [`11-admin-and-detection.md`](docs/backend/11-admin-and-detection.md) | 2K+2L | Admin auth/dashboard/CRUD, multi-unit property detection | ~280 |

**Phase 1 (Database) reference:** SQL files already exist — no separate doc needed. See `sql/05-views.sql`, `sql/06-materialized-views.sql`, `sql/07-report-function.sql`, `sql/08-toast-and-cleanup.sql`, `sql/09-application-tables.sql`.

---

## Recommended Build Order

### Phase A — Foundation (get a working API with core features)
1. **`02-project-setup.md`** — FastAPI scaffold, DB pool, Redis
2. **`03-security.md`** — Bot detection middleware (add to main.py)
3. **`04-search.md`** — Search endpoint (the entry point for all users)
4. **`05-report-and-scoring.md`** — Property report + risk scoring (the core feature)

### Phase B — Data Endpoints (complete the read-only API surface)
5. **`06-nearby-endpoints.md`** — 10 GeoJSON endpoints for map overlays
6. **`07-market-engine.md`** — Fair price, rent history, HPI
7. **`09-rates-integration.md`** — WCC rates (Wellington only)

### Phase C — User Features + Admin (write endpoints + management)
8. **`10-user-endpoints.md`** — Rent reports, feedback, email signups
9. **`11-admin-and-detection.md`** — Admin dashboard, multi-unit detection
10. **`08-ai-features.md`** — AI area profiles + property summary (requires Azure OpenAI)

---

## SQL Tables — All Created

All tables referenced in the backend code now exist in `sql/09-application-tables.sql`: user_rent_reports, feedback, email_signups, wcc_rates_cache, data_sources (9 seed rows), admin_content (3 seed rows).

---

## Key Technical Decisions

These apply across all backend files:

### psycopg3 Dict Rows
All connections use `row_factory=dict_row` (set in `db.py` pool config). Every `fetchone()` / `fetchall()` returns dicts. No need for `dict(r)` casts.

### Write Operations Need Explicit Commit
psycopg3 defaults to autocommit=False. All INSERT/UPDATE operations must call `await conn.commit()` or use `async with conn.transaction():`.

### Rate Limiter Sharing
The `limiter` instance is created in `deps.py` and imported by every router: `from ..deps import limiter`. Every rate-limited endpoint must include `request: Request` as a parameter (slowapi reads the client IP from it).

### Redis is Optional
All `cache_get`/`cache_set` calls gracefully return None/no-op if Redis is down. The app runs without Redis — just slower (no caching). Never return 500 for a Redis failure.

### Bounding Box Pre-Filter
Always use `&& ST_Expand()` before `ST_DWithin()` on large tables (crashes 904K, building_outlines 3.2M, addresses 2.4M). Without it, PostGIS OOMs. Degree conversions: `0.001 ≈ 100m`, `0.005 ≈ 500m`, `0.01 ≈ 1km`, `0.05 ≈ 5km`.

### JSON Serialization
Use `orjson` for all JSON serialization (faster than stdlib, handles bytes). For date/datetime objects, pass `default=str` to `orjson.dumps()`.

---

## Project Structure (when complete)

```
backend/
├── .env                      # secrets (never commit)
├── .env.example              # template
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI app, lifespan, middleware
│   ├── config.py             # pydantic-settings
│   ├── db.py                 # psycopg3 async pool
│   ├── redis.py              # Redis client with fallback
│   ├── deps.py               # shared limiter
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── bot_detection.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── search.py         # GET /search/address
│   │   ├── property.py       # GET /property/{id}/report
│   │   ├── nearby.py         # GET /nearby/{id}/*  (10 endpoints)
│   │   ├── market.py         # GET /property/{id}/market, /rent-history, /market/hpi
│   │   ├── rates.py          # GET /property/{id}/rates
│   │   ├── rent_reports.py   # POST + GET /rent-reports
│   │   ├── feedback.py       # POST /feedback
│   │   ├── email_signups.py  # POST /email-signups
│   │   └── admin.py          # /admin/* (8 endpoints)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── rent_reports.py
│   │   ├── feedback.py
│   │   └── email_signups.py
│   └── services/
│       ├── __init__.py
│       ├── search.py
│       ├── abbreviations.py
│       ├── risk_score.py
│       ├── geo_utils.py
│       ├── market.py
│       ├── ai_summary.py
│       ├── rates.py
│       ├── rent_reports.py
│       ├── admin_auth.py
│       ├── property_detection.py
│       └── abuse_logger.py
└── scripts/
    └── generate_area_profiles.py
```

**Total endpoints: 26**
- 1 health check
- 1 search
- 1 report
- 10 nearby
- 3 market (market, rent-history, hpi)
- 1 rates
- 2 rent reports (submit, get)
- 1 feedback
- 1 email signup
- 5 admin (login, dashboard, data-health, feedback CRUD, emails, content)
