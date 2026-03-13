# Backend — User Endpoints (Phase 2I + 2J)

**Creates:** User rent reports (with 5-layer validation), feedback submission, email signups
**Prerequisites:** `02-project-setup.md` complete. Application tables exist (`sql/09-application-tables.sql`).
**These are write endpoints** — all have strict rate limits, honeypot fields, and IP hashing.

---

## Files to Create

```
backend/app/
├── routers/
│   ├── rent_reports.py      # POST /rent-reports, GET /rent-reports/{address_id}
│   ├── feedback.py          # POST /feedback
│   └── email_signups.py     # POST /email-signups
├── schemas/
│   ├── rent_reports.py      # Pydantic models
│   ├── feedback.py
│   └── email_signups.py
└── services/
    └── rent_reports.py       # 5-layer validation pipeline
```

---

## Step 1: Rent Report Schemas

```python
# backend/app/schemas/rent_reports.py
from pydantic import BaseModel, Field


class RentReportSubmit(BaseModel):
    address_id: int
    dwelling_type: str = Field(pattern=r"^(House|Flat|Apartment|Room)$")
    bedrooms: str = Field(pattern=r"^(1|2|3|4|5\+)$")
    reported_rent: int = Field(ge=50, le=5000)
    website: str | None = Field(None, exclude=True)  # honeypot — must be empty


class RentReportResponse(BaseModel):
    building_address: str
    report_count: int
    median_rent: float | None
    reports: list[dict]
```

---

## Step 2: Rent Report Service (5-Layer Validation)

```python
# backend/app/services/rent_reports.py
"""
User-contributed rent report validation pipeline.
5 layers: hard bounds → SA2 deviation → bedroom coherence → rate limit → dedup.
"""

from fastapi import HTTPException


async def _get_sa2_for_address(conn, address_id: int) -> str | None:
    """Spatial join: address point → SA2 code."""
    cur = await conn.execute(
        """
        SELECT sa2.sa2_code FROM addresses a
        JOIN LATERAL (
            SELECT sa2_code FROM sa2_boundaries WHERE ST_Within(a.geom, geom) LIMIT 1
        ) sa2 ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    r = await cur.fetchone()
    return r["sa2_code"] if r else None


async def _get_sa2_median(
    conn, sa2_code: str | None, dwelling_type: str, bedrooms: str
) -> float | None:
    """Get current SA2 median rent for this type+beds from bonds_detailed."""
    if not sa2_code:
        return None
    cur = await conn.execute(
        """
        SELECT median_rent FROM bonds_detailed
        WHERE location_id = %s AND dwelling_type = %s AND number_of_beds = %s
        ORDER BY time_frame DESC LIMIT 1
        """,
        [sa2_code, dwelling_type, bedrooms],
    )
    r = await cur.fetchone()
    return float(r["median_rent"]) if r and r["median_rent"] else None


async def _get_building_address(conn, address_id: int) -> str:
    """Get base street address (without unit info) for grouping multi-unit reports."""
    cur = await conn.execute(
        """
        SELECT address_number || ' ' || road_name ||
               COALESCE(' ' || road_type_name, '') AS building_address
        FROM addresses WHERE address_id = %s
        """,
        [address_id],
    )
    r = await cur.fetchone()
    return r["building_address"] if r else "Unknown"


async def submit(conn, body, ip_hash: str) -> dict:
    """Submit a rent report with 5-layer validation."""

    # 1. Hard bounds — already enforced by Pydantic (50-5000)

    # 2. SA2 deviation check — flag if >3x or <0.25x SA2 median
    sa2 = await _get_sa2_for_address(conn, body.address_id)
    sa2_median = await _get_sa2_median(conn, sa2, body.dwelling_type, body.bedrooms)
    is_outlier = False
    if sa2_median and (
        body.reported_rent > sa2_median * 3 or body.reported_rent < sa2_median * 0.25
    ):
        is_outlier = True

    # 3. Bedroom coherence — national maxima
    BED_MAX = {"1": 800, "2": 1200, "3": 1800, "4": 2500, "5+": 3500}
    if body.reported_rent > BED_MAX.get(body.bedrooms, 5000) * 1.5:
        is_outlier = True

    # 4. Rate limiting — max 3 per IP per 24h
    cur = await conn.execute(
        """
        SELECT COUNT(*) AS cnt FROM user_rent_reports
        WHERE ip_hash = %s AND reported_at > NOW() - interval '24 hours'
        """,
        [ip_hash],
    )
    if (await cur.fetchone())["cnt"] >= 3:
        raise HTTPException(429, "Maximum 3 reports per day")

    # 5. Duplicate dedup — same address+type+beds within 7 days
    cur = await conn.execute(
        """
        SELECT id FROM user_rent_reports
        WHERE address_id = %s AND dwelling_type = %s AND bedrooms = %s
          AND ip_hash = %s AND reported_at > NOW() - interval '7 days'
        """,
        [body.address_id, body.dwelling_type, body.bedrooms, ip_hash],
    )
    if await cur.fetchone():
        raise HTTPException(409, "You already reported rent for this property recently")

    # Insert
    building_addr = await _get_building_address(conn, body.address_id)
    await conn.execute(
        """
        INSERT INTO user_rent_reports
            (address_id, building_address, sa2_code, dwelling_type, bedrooms,
             reported_rent, is_outlier, ip_hash)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        [
            body.address_id, building_addr, sa2, body.dwelling_type,
            body.bedrooms, body.reported_rent, is_outlier, ip_hash,
        ],
    )
    await conn.commit()

    return {"status": "accepted", "is_outlier": is_outlier}


async def get_building_reports(conn, address_id: int) -> dict:
    """Return crowd-sourced rent data for a building address.
    Only displayed if 3+ non-outlier reports exist."""
    building_addr = await _get_building_address(conn, address_id)
    cur = await conn.execute(
        """
        SELECT dwelling_type, bedrooms, reported_rent, reported_at
        FROM user_rent_reports
        WHERE building_address = %s AND is_outlier = FALSE
        ORDER BY reported_at DESC
        """,
        [building_addr],
    )
    reports = await cur.fetchall()

    if len(reports) < 3:
        return {
            "building_address": building_addr,
            "report_count": len(reports),
            "median_rent": None,
            "reports": [],  # below display threshold
        }

    rents = sorted(r["reported_rent"] for r in reports)
    median = rents[len(rents) // 2]

    return {
        "building_address": building_addr,
        "report_count": len(reports),
        "median_rent": median,
        "reports": reports,
    }
```

---

## Step 3: Rent Reports Router

```python
# backend/app/routers/rent_reports.py
import hashlib

from fastapi import APIRouter, Request

from ..db import pool
from ..deps import limiter
from ..schemas.rent_reports import RentReportSubmit
from ..services import rent_reports as rent_reports_service

router = APIRouter()


@router.post("/rent-reports", status_code=201)
@limiter.limit("3/hour")
async def submit_rent_report(request: Request, body: RentReportSubmit):
    """Submit a user rent report. 5-layer validation pipeline."""
    if body.website:  # honeypot triggered — bot
        return {"status": "accepted"}

    ip_hash = hashlib.sha256(request.client.host.encode()).hexdigest()

    async with pool.connection() as conn:
        result = await rent_reports_service.submit(conn, body, ip_hash)
    return result


@router.get("/rent-reports/{address_id}")
@limiter.limit("40/minute")
async def get_rent_reports(request: Request, address_id: int):
    """Get crowd-sourced rent data for a building. Requires 3+ reports to display."""
    async with pool.connection() as conn:
        return await rent_reports_service.get_building_reports(conn, address_id)
```

---

## Step 4: Feedback Schema + Router

```python
# backend/app/schemas/feedback.py
from pydantic import BaseModel, Field


class FeedbackSubmit(BaseModel):
    type: str = Field(pattern=r"^(bug|feature|general)$")
    description: str = Field(min_length=10, max_length=5000)
    context: str | None = Field(None, max_length=1000)
    page_url: str | None = Field(None, max_length=500)
    property_address: str | None = Field(None, max_length=500)
    importance: str | None = Field(None, pattern=r"^(low|medium|high|critical)$")
    satisfaction: int | None = Field(None, ge=1, le=5)
    email: str | None = Field(None, max_length=255)
    browser_info: dict | None = None
    website: str | None = Field(None, exclude=True)  # honeypot
```

```python
# backend/app/routers/feedback.py
import orjson
from fastapi import APIRouter, Request

from ..db import pool
from ..deps import limiter
from ..schemas.feedback import FeedbackSubmit

router = APIRouter()


@router.post("/feedback", status_code=201)
@limiter.limit("5/hour")
async def submit_feedback(request: Request, body: FeedbackSubmit):
    """Submit user feedback (bug report, feature request, general)."""
    if body.website:
        return {"status": "submitted"}

    async with pool.connection() as conn:
        await conn.execute(
            """
            INSERT INTO feedback
                (type, description, context, page_url, property_address,
                 importance, satisfaction, email, browser_info)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            [
                body.type, body.description, body.context, body.page_url,
                body.property_address, body.importance, body.satisfaction,
                body.email,
                orjson.dumps(body.browser_info).decode() if body.browser_info else None,
            ],
        )
        await conn.commit()

    return {"status": "submitted"}
```

---

## Step 5: Email Signup Schema + Router

**Note:** The actual `email_signups` table has `requested_region` (not `source`). Schema matches the real table.

```python
# backend/app/schemas/email_signups.py
from pydantic import BaseModel, EmailStr, Field


class EmailSignupSubmit(BaseModel):
    email: EmailStr
    requested_region: str | None = Field(None, max_length=100)
    website: str | None = Field(None, exclude=True)  # honeypot
```

```python
# backend/app/routers/email_signups.py
from fastapi import APIRouter, Request

from ..db import pool
from ..deps import limiter
from ..schemas.email_signups import EmailSignupSubmit

router = APIRouter()


@router.post("/email-signups", status_code=201)
@limiter.limit("3/hour")
async def email_signup(request: Request, body: EmailSignupSubmit):
    """Sign up for email updates when a region becomes available."""
    if body.website:
        return {"status": "subscribed"}

    async with pool.connection() as conn:
        # Check for existing signup
        cur = await conn.execute(
            "SELECT id FROM email_signups WHERE email = %s", [body.email]
        )
        if await cur.fetchone():
            return {"status": "already_subscribed"}

        await conn.execute(
            "INSERT INTO email_signups (email, requested_region) VALUES (%s, %s)",
            [body.email, body.requested_region],
        )
        await conn.commit()

    return {"status": "subscribed"}
```

---

## Register in main.py

```python
from .routers import rent_reports, feedback, email_signups
app.include_router(rent_reports.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")
app.include_router(email_signups.router, prefix="/api/v1")
```

---

## Verification

```bash
# Submit rent report:
curl -X POST http://localhost:8000/api/v1/rent-reports \
  -H "Content-Type: application/json" \
  -d '{"address_id": 1753062, "dwelling_type": "Flat", "bedrooms": "2", "reported_rent": 590}'
# Expected: {"status": "accepted", "is_outlier": false}

# Submit feedback:
curl -X POST http://localhost:8000/api/v1/feedback \
  -H "Content-Type: application/json" \
  -d '{"type": "bug", "description": "Map tiles not loading on mobile Safari"}'
# Expected: {"status": "submitted"}

# Email signup:
curl -X POST http://localhost:8000/api/v1/email-signups \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "requested_region": "Auckland"}'
# Expected: {"status": "subscribed"}

# Honeypot test (bot fills website field):
curl -X POST http://localhost:8000/api/v1/feedback \
  -H "Content-Type: application/json" \
  -d '{"type": "bug", "description": "fake bug", "website": "http://spam.com"}'
# Expected: {"status": "submitted"} (fake success, nothing stored)
```
