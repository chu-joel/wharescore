# Backend — Admin & Property Detection (Phase 2K + 2L)

**Creates:** Admin auth, dashboard, feedback management, email export, content management, multi-unit detection
**Prerequisites:** `02-project-setup.md` complete. Application tables exist. Redis running (for admin sessions). `ADMIN_PASSWORD_HASH` set in `.env`.

---

## Files to Create

```
backend/app/
├── routers/
│   └── admin.py              # 8 admin endpoints
├── services/
│   ├── admin_auth.py          # bcrypt auth + Redis session tokens
│   └── property_detection.py  # Multi-unit auto-detection
```

---

## Step 1: Admin Auth Service

```python
# backend/app/services/admin_auth.py
"""
Admin authentication: bcrypt password verification + Redis session tokens.
No user accounts in MVP — single admin password.
"""

import secrets

import bcrypt
from fastapi import HTTPException, Request

from ..redis import cache_get, cache_set

ADMIN_SESSION_DURATION = 86400  # 24h


async def verify_admin(password: str, hashed_password: str) -> str | None:
    """Timing-safe password comparison. Returns session token or None."""
    if bcrypt.checkpw(password.encode(), hashed_password.encode()):
        token = secrets.token_urlsafe(32)
        await cache_set(f"admin_session:{token}", "1", ex=ADMIN_SESSION_DURATION)
        return token
    return None


async def require_admin(request: Request):
    """FastAPI dependency — validates admin session token from cookie.
    Use as: router = APIRouter(dependencies=[Depends(require_admin)])"""
    token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(401, "Admin authentication required")
    session = await cache_get(f"admin_session:{token}")
    if not session:
        raise HTTPException(401, "Session expired — please log in again")
```

---

## Step 2: Admin Router

```python
# backend/app/routers/admin.py
import csv
import io

import orjson
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..config import settings
from ..db import pool
from ..deps import limiter
from ..redis import redis_client
from ..services.admin_auth import (
    ADMIN_SESSION_DURATION,
    require_admin,
    verify_admin,
)

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])


# --- Login (no auth dependency — override with dependencies=[]) ---

@router.post("/login", dependencies=[])
@limiter.limit("5/15minutes")
async def admin_login(request: Request, password: str = Body(..., embed=True)):
    """Authenticate admin. Returns session cookie (httpOnly, secure, sameSite)."""
    token = await verify_admin(password, settings.ADMIN_PASSWORD_HASH)
    if not token:
        raise HTTPException(401, "Invalid password")
    response = JSONResponse({"status": "authenticated"})
    response.set_cookie(
        "admin_token",
        token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=ADMIN_SESSION_DURATION,
    )
    return response


# --- Dashboard ---

@router.get("/dashboard")
@limiter.limit("30/minute")
async def admin_dashboard(request: Request):
    """Summary stats: rent report counts, feedback counts, email signups."""
    async with pool.connection() as conn:
        stats = {}
        for label, interval in [("24h", "24 hours"), ("7d", "7 days"), ("30d", "30 days")]:
            cur = await conn.execute(
                f"SELECT COUNT(*) AS cnt FROM user_rent_reports WHERE reported_at > NOW() - interval '{interval}'"
            )
            stats[f"rent_reports_{label}"] = (await cur.fetchone())["cnt"]

        cur = await conn.execute(
            "SELECT COUNT(*) AS cnt FROM feedback WHERE created_at > NOW() - interval '7 days'"
        )
        stats["feedback_7d"] = (await cur.fetchone())["cnt"]

        cur = await conn.execute("SELECT COUNT(*) AS cnt FROM email_signups")
        stats["total_email_signups"] = (await cur.fetchone())["cnt"]

        cur = await conn.execute(
            "SELECT COUNT(*) AS cnt FROM feedback WHERE status = 'new'"
        )
        stats["unresolved_feedback"] = (await cur.fetchone())["cnt"]

    return stats


# --- Data Health ---

@router.get("/data-health")
@limiter.limit("30/minute")
async def admin_data_health(request: Request):
    """Per-table row counts + service health checks."""
    # Table names are hardcoded — NOT from user input (safe for f-string)
    tables = [
        "addresses", "parcels", "building_outlines", "property_titles",
        "flood_zones", "tsunami_zones", "liquefaction_zones", "earthquakes",
        "schools", "crashes", "transit_stops", "crime", "heritage_sites",
        "wind_zones", "noise_contours", "air_quality_sites", "water_quality_sites",
        "climate_grid", "climate_projections", "infrastructure_projects",
        "district_plan_zones", "height_controls", "contaminated_land",
        "earthquake_prone_buildings", "resource_consents", "sa2_boundaries",
        "council_valuations", "bonds_detailed", "bonds_tla", "bonds_region",
        "market_rent_cache", "wcc_rates_cache", "osm_amenities",
        "conservation_land", "area_profiles", "user_rent_reports",
        "feedback", "email_signups", "data_sources",
    ]
    table_stats = {}
    async with pool.connection() as conn:
        for t in tables:
            try:
                cur = await conn.execute(f"SELECT COUNT(*) AS cnt FROM {t}")
                table_stats[t] = (await cur.fetchone())["cnt"]
            except Exception:
                table_stats[t] = "error"

    # Service health
    services = {"db": True, "redis": False}
    if redis_client:
        try:
            await redis_client.ping()
            services["redis"] = True
        except Exception:
            pass

    return {"tables": table_stats, "services": services}


# --- Feedback Management ---

@router.get("/feedback")
@limiter.limit("30/minute")
async def admin_feedback_list(
    request: Request,
    type: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Paginated feedback list with optional type/status filters."""
    offset = (page - 1) * limit
    async with pool.connection() as conn:
        where_clauses = []
        params = []
        if type:
            where_clauses.append("type = %s")
            params.append(type)
        if status:
            where_clauses.append("status = %s")
            params.append(status)
        where = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cur = await conn.execute(f"SELECT COUNT(*) AS cnt FROM feedback {where}", params)
        total = (await cur.fetchone())["cnt"]

        cur = await conn.execute(
            f"""
            SELECT id, type, description, context, page_url, property_address,
                   importance, satisfaction, email, status, created_at
            FROM feedback {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            params + [limit, offset],
        )
        items = await cur.fetchall()

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.patch("/feedback/{feedback_id}")
@limiter.limit("10/minute")
async def admin_feedback_update(
    request: Request,
    feedback_id: int,
    status: str = Body(..., embed=True),
):
    """Update feedback status."""
    if status not in ("new", "reviewed", "resolved", "wontfix"):
        raise HTTPException(400, "Invalid status")
    async with pool.connection() as conn:
        cur = await conn.execute(
            "UPDATE feedback SET status = %s WHERE id = %s RETURNING id",
            [status, feedback_id],
        )
        if not await cur.fetchone():
            raise HTTPException(404, "Feedback not found")
        await conn.commit()
    return {"status": "updated"}


# --- Email Signups ---

@router.get("/emails")
@limiter.limit("30/minute")
async def admin_emails(
    request: Request,
    format: str = Query("json"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    """Email signup list. Supports JSON (paginated) and CSV (full export)."""
    async with pool.connection() as conn:
        if format == "csv":
            cur = await conn.execute(
                "SELECT email, requested_region, created_at FROM email_signups ORDER BY created_at DESC"
            )
            all_rows = await cur.fetchall()
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["email", "requested_region", "created_at"])
            for r in all_rows:
                writer.writerow([r["email"], r["requested_region"], str(r["created_at"])])
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=email_signups.csv"},
            )

        offset = (page - 1) * limit
        cur = await conn.execute("SELECT COUNT(*) AS cnt FROM email_signups")
        total = (await cur.fetchone())["cnt"]
        cur = await conn.execute(
            """
            SELECT id, email, requested_region, created_at FROM email_signups
            ORDER BY created_at DESC LIMIT %s OFFSET %s
            """,
            [limit, offset],
        )
        items = await cur.fetchall()

    return {"items": items, "total": total, "page": page, "limit": limit}


# --- Content Management ---

@router.get("/content")
@limiter.limit("30/minute")
async def admin_content_get(request: Request):
    """Return admin-editable content (banner, demo addresses, FAQ)."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT key, value FROM admin_content ORDER BY key"
        )
        rows = await cur.fetchall()
        content = {r["key"]: r["value"] for r in rows}
    return content


@router.put("/content/{key}")
@limiter.limit("10/minute")
async def admin_content_update(
    request: Request, key: str, body: dict = Body(...)
):
    """Update banner, demo_addresses, or FAQ content."""
    if key not in ("banner", "demo_addresses", "faq"):
        raise HTTPException(400, "Invalid content key")
    async with pool.connection() as conn:
        await conn.execute(
            """
            INSERT INTO admin_content (key, value, updated_at)
            VALUES (%s, %s::jsonb, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """,
            [key, orjson.dumps(body).decode()],
        )
        await conn.commit()
    return {"status": "updated"}
```

**Admin content table** (verify exists in `sql/09-application-tables.sql`):
```sql
CREATE TABLE IF NOT EXISTS admin_content (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO admin_content (key, value) VALUES
    ('banner', '{"text": "WhareScore is in beta — data may be incomplete.", "variant": "info", "active": true}'),
    ('demo_addresses', '["162 Cuba Street, Te Aro, Wellington", "1 Te Ara O Paetutu, Petone, Lower Hutt"]'),
    ('faq', '[]')
ON CONFLICT (key) DO NOTHING;
```

---

## Step 3: Multi-Unit Property Detection

```python
# backend/app/services/property_detection.py
"""
Auto-detect dwelling type from address metadata + spatial signals.
Used by: report endpoint, BuildingInfoBanner, market auto-select.
"""


async def detect_property_type(conn, address_id: int) -> dict | None:
    """Returns {detected_type, unit_count, is_multi_unit, building_address, footprint_m2}."""

    # Get address details + title info
    cur = await conn.execute(
        """
        SELECT a.full_address, a.unit_type, a.unit_value,
               a.address_number, a.road_name, a.road_type_name,
               a.gd2000_xcoord, a.gd2000_ycoord,
               pt.estate_description
        FROM addresses a
        LEFT JOIN LATERAL (
            SELECT estate_description FROM property_titles pt
            WHERE ST_Contains(pt.geom, a.geom) LIMIT 1
        ) pt ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    addr = await cur.fetchone()
    if not addr:
        return None

    # Count addresses at same coordinates (multi-unit indicator)
    cur = await conn.execute(
        """
        SELECT COUNT(*) AS cnt FROM addresses
        WHERE gd2000_xcoord = %s AND gd2000_ycoord = %s
          AND address_lifecycle = 'Current'
        """,
        [addr["gd2000_xcoord"], addr["gd2000_ycoord"]],
    )
    unit_count = (await cur.fetchone())["cnt"]

    # Get building footprint area
    cur = await conn.execute(
        """
        SELECT round(ST_Area(b.geom::geography)::numeric, 1) AS area_m2
        FROM building_outlines b, addresses a
        WHERE a.address_id = %s
          AND b.geom && ST_Expand(a.geom, 0.0005)
          AND ST_Contains(b.geom, a.geom)
        LIMIT 1
        """,
        [address_id],
    )
    bld = await cur.fetchone()
    footprint = float(bld["area_m2"]) if bld else None

    # Detection rules (priority order)
    detected = "House"
    is_multi = False

    if unit_count > 4:
        detected = "Apartment"
        is_multi = True
    elif addr.get("estate_description") and "Unit Title" in addr["estate_description"]:
        detected = "Apartment"
        is_multi = True
    elif addr.get("unit_type") and addr["unit_type"].lower() in ("flat", "unit"):
        detected = "Flat"
        is_multi = True
    elif addr.get("unit_type") and addr["unit_type"].lower() == "apartment":
        detected = "Apartment"
        is_multi = True
    elif not addr.get("unit_type") and footprint and footprint < 300:
        detected = "House"

    # Build base street address (strip unit info)
    building_address = f"{addr['address_number']} {addr['road_name']}"
    if addr.get("road_type_name"):
        building_address += f" {addr['road_type_name']}"

    # For multi-unit buildings, fetch sibling unit valuations (for "Compare units" UI)
    sibling_valuations = None
    if is_multi:
        cur = await conn.execute(
            """
            SELECT full_address, capital_value, land_value, valuation_id
            FROM council_valuations
            WHERE geom && ST_Expand(
                (SELECT geom FROM addresses WHERE address_id = %s), 0.0005)
              AND ST_DWithin(geom::geography,
                (SELECT geom FROM addresses WHERE address_id = %s)::geography, 30)
              AND capital_value IS NOT NULL
              AND full_address ~* '^(Unit|Flat|Apartment)\s'
            ORDER BY full_address
            LIMIT 20
            """,
            [address_id, address_id],
        )
        rows = await cur.fetchall()
        if len(rows) > 1:
            sibling_valuations = [
                {
                    "address": r["full_address"],
                    "capital_value": r["capital_value"],
                    "land_value": r["land_value"],
                    "valuation_id": r["valuation_id"],
                }
                for r in rows
            ]

    return {
        "detected_type": detected,
        "unit_count": unit_count,
        "is_multi_unit": is_multi,
        "building_address": building_address,
        "footprint_m2": footprint,
        "sibling_valuations": sibling_valuations,
    }
```

**Integration in report endpoint** — add to `routers/property.py` inside `get_report()`:

```python
from ..services.property_detection import detect_property_type

# Inside get_report(), after enrich_with_scores():
    async with pool.connection() as conn:
        detection = await detect_property_type(conn, address_id)
        if detection:
            report["property_detection"] = detection
```

---

## Register in main.py

```python
from .routers import admin
app.include_router(admin.router, prefix="/api/v1")
```

---

## Verification

```bash
# Admin login:
curl -X POST http://localhost:8000/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password": "yourpassword"}' -c cookies.txt
# Expected: {"status": "authenticated"} + Set-Cookie header

# Dashboard (with cookie):
curl http://localhost:8000/api/v1/admin/dashboard -b cookies.txt
# Expected: {"rent_reports_24h": 0, "feedback_7d": 0, ...}

# Data health:
curl http://localhost:8000/api/v1/admin/data-health -b cookies.txt
# Expected: {"tables": {"addresses": 2403583, ...}, "services": {"db": true, "redis": true}}

# Without auth:
curl http://localhost:8000/api/v1/admin/dashboard
# Expected: 401 "Admin authentication required"

# Email CSV export:
curl http://localhost:8000/api/v1/admin/emails?format=csv -b cookies.txt -o emails.csv
```
