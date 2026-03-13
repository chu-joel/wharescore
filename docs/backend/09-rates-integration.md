# Backend — WCC Rates Integration (Phase 2H)

**Creates:** WCC Property Search API service, rates endpoint, DB cache upsert
**Prerequisites:** `02-project-setup.md` complete. `wcc_rates_cache` table exists (`sql/09-application-tables.sql`).
**Coverage:** Wellington City only. Other councils return 404.

---

## Files to Create

```
backend/app/
├── routers/
│   └── rates.py            # GET /property/{address_id}/rates
└── services/
    └── rates.py             # WCC API client + cache logic
```

---

## Background

The WCC Property Search API was reverse-engineered in session 21. It provides:
- Rate account number, valuation number, address, legal description
- Land area (m²), rating category, billing code, water meter status
- Capital value, land value (current + previous), valuation dates
- Total annual rates + full levy breakdown (13-15 items)

**No bedrooms, bathrooms, or floor area** — confirmed across all WCC API endpoints.

**API endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `/property-search/api/property-info/address-search?address=...` | Search → identifier + rateAccountNumber |
| `/property-search/api/property-info/account-search?account=...` | Full data by account number |

---

## Step 1: Rates Service

```python
# backend/app/services/rates.py
"""
WCC Property Search API client.
Always calls the live API for fresh data, upserts into wcc_rates_cache.
Falls back to cached data if API is unavailable.
"""

import asyncio
import json
import logging
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

WCC_BASE = "https://services.wellington.govt.nz/property-search"
WCC_SEARCH_URL = f"{WCC_BASE}/api/property-info/address-search"
WCC_ACCOUNT_URL = f"{WCC_BASE}/api/property-info/account-search"


async def fetch_wcc_rates(address: str, conn) -> dict | None:
    """Fetch rates from WCC API, upsert into cache, return formatted data.
    On API failure, falls back to cached data."""
    try:
        # 1. Search by address to get account number
        search_url = f"{WCC_SEARCH_URL}?address={urllib.parse.quote(address)}&page=1&pageSize=3"
        search_data = await _fetch_json(search_url)

        if not search_data or not search_data.get("results"):
            return await _get_cached(address, conn)

        result = search_data["results"][0]
        account = result.get("rateAccountNumber")

        # 2. Get full property data by account number
        account_url = f"{WCC_ACCOUNT_URL}?account={account}"
        account_data = await _fetch_json(account_url)

        if not account_data or not account_data.get("results"):
            return await _get_cached(address, conn)

        prop = account_data["results"][0]

        # 3. Extract current valuation
        current_val = next(
            (v for v in prop.get("valuations", []) if v.get("periodStatus") == "C"),
            prop.get("valuations", [{}])[0] if prop.get("valuations") else {},
        )

        # 4. Upsert into cache
        await conn.execute(
            """
            INSERT INTO wcc_rates_cache (
                valuation_number, rate_account_number, address, identifier,
                rating_category, billing_code, legal_description, valued_land_area,
                has_water_meter, capital_value, land_value, improvements_value,
                valuation_date, total_rates, rates_period, valuations, levies, fetched_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s::date, %s, %s, %s::jsonb, %s::jsonb, NOW()
            )
            ON CONFLICT (valuation_number) DO UPDATE SET
                rate_account_number = EXCLUDED.rate_account_number,
                address = EXCLUDED.address,
                capital_value = EXCLUDED.capital_value,
                land_value = EXCLUDED.land_value,
                improvements_value = EXCLUDED.improvements_value,
                valuation_date = EXCLUDED.valuation_date,
                total_rates = EXCLUDED.total_rates,
                rates_period = EXCLUDED.rates_period,
                valuations = EXCLUDED.valuations,
                levies = EXCLUDED.levies,
                fetched_at = NOW()
            """,
            [
                prop.get("valuationNumber"),
                prop.get("rateAccountNumber"),
                prop.get("address"),
                prop.get("identifier"),
                prop.get("ratingCategory"),
                prop.get("billingCode"),
                prop.get("legalDescription"),
                prop.get("valuedLandArea"),
                prop.get("hasWaterMeter", False),
                current_val.get("capitalValue"),
                current_val.get("landValue"),
                (current_val.get("capitalValue", 0) or 0) - (current_val.get("landValue", 0) or 0),
                current_val.get("valuationDate"),
                current_val.get("ratesAmount"),
                current_val.get("period"),
                json.dumps(prop.get("valuations", [])),
                json.dumps(prop.get("levies", [])),
            ],
        )
        await conn.commit()

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"WCC API error for {address}: {e}")
        return await _get_cached(address, conn)


def _format_response(prop: dict) -> dict:
    """Format WCC API data for the frontend."""
    current_val = next(
        (v for v in prop.get("valuations", []) if v.get("periodStatus") == "C"),
        prop.get("valuations", [{}])[0] if prop.get("valuations") else {},
    )
    prev_val = next(
        (v for v in prop.get("valuations", []) if v.get("periodStatus") == "P"),
        None,
    )

    # Group levies by category
    levies_by_category = {}
    for levy in prop.get("levies", []):
        cat = levy.get("category", "Other")
        if cat not in levies_by_category:
            levies_by_category[cat] = {"category": cat, "items": [], "subtotal": 0}
        levies_by_category[cat]["items"].append(levy)
        levies_by_category[cat]["subtotal"] += levy.get("ratesAmount", 0)

    return {
        "valuation_number": prop.get("valuationNumber"),
        "address": prop.get("address"),
        "rating_category": prop.get("ratingCategory"),
        "billing_code": prop.get("billingCode"),
        "legal_description": prop.get("legalDescription"),
        "land_area_m2": prop.get("valuedLandArea"),
        "has_water_meter": prop.get("hasWaterMeter"),
        "current_valuation": {
            "capital_value": current_val.get("capitalValue"),
            "land_value": current_val.get("landValue"),
            "improvements_value": (current_val.get("capitalValue", 0) or 0)
            - (current_val.get("landValue", 0) or 0),
            "valuation_date": current_val.get("valuationDate"),
            "total_rates": current_val.get("ratesAmount"),
            "period": current_val.get("header"),
        },
        "previous_valuation": {
            "capital_value": prev_val.get("capitalValue"),
            "land_value": prev_val.get("landValue"),
            "total_rates": prev_val.get("ratesAmount"),
            "valuation_date": prev_val.get("valuationDate"),
            "period": prev_val.get("header"),
        }
        if prev_val
        else None,
        "levy_breakdown": list(levies_by_category.values()),
        "source": "wcc_live",
    }


async def _fetch_json(url: str, timeout: int = 5) -> dict | None:
    """Fetch JSON from URL with timeout. Returns None on failure."""
    try:
        return await asyncio.to_thread(_sync_fetch, url, timeout)
    except Exception:
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    """Synchronous HTTP fetch (run in thread pool)."""
    req = urllib.request.Request(url, headers={"User-Agent": "WhareScore/1.0"})
    resp = urllib.request.urlopen(req, timeout=timeout)
    return json.loads(resp.read())


async def _get_cached(address: str, conn) -> dict | None:
    """Fall back to cached data if WCC API is unavailable."""
    cur = await conn.execute(
        """
        SELECT capital_value, land_value, improvements_value, total_rates,
               rates_period, valuation_date, address, rating_category,
               billing_code, legal_description, valued_land_area,
               has_water_meter, valuations, levies
        FROM wcc_rates_cache WHERE lower(address) LIKE %s LIMIT 1
        """,
        [f"%{address.lower()}%"],
    )
    r = await cur.fetchone()
    if not r:
        return None

    return {
        "valuation_number": None,
        "address": r.get("address"),
        "rating_category": r.get("rating_category"),
        "billing_code": r.get("billing_code"),
        "legal_description": r.get("legal_description"),
        "land_area_m2": r.get("valued_land_area"),
        "has_water_meter": r.get("has_water_meter"),
        "current_valuation": {
            "capital_value": r.get("capital_value"),
            "land_value": r.get("land_value"),
            "improvements_value": r.get("improvements_value"),
            "valuation_date": str(r["valuation_date"]) if r.get("valuation_date") else None,
            "total_rates": float(r["total_rates"]) if r.get("total_rates") else None,
            "period": r.get("rates_period"),
        },
        "previous_valuation": None,
        "levy_breakdown": r.get("levies") if isinstance(r.get("levies"), list) else [],
        "source": "cache",
    }
```

---

## Step 2: Rates Router

```python
# backend/app/routers/rates.py
from fastapi import APIRouter, HTTPException, Request

from ..db import pool
from ..deps import limiter
from ..services.rates import fetch_wcc_rates

router = APIRouter()


@router.get("/property/{address_id}/rates")
@limiter.limit("10/minute")
async def get_rates(request: Request, address_id: int):
    """Fetch WCC rates data. Calls WCC API live, caches result.
    Wellington City only — returns 404 for other councils."""
    async with pool.connection() as conn:
        # 1. Look up address
        cur = await conn.execute(
            "SELECT full_address FROM addresses WHERE address_id = %s",
            [address_id],
        )
        addr = await cur.fetchone()
        if not addr:
            raise HTTPException(404, "Address not found")

        # 2. Call WCC API + upsert cache
        rates = await fetch_wcc_rates(addr["full_address"], conn)

    if not rates:
        raise HTTPException(404, "No rates data available for this address")

    return rates
```

---

## Register in main.py

```python
from .routers import rates
app.include_router(rates.router, prefix="/api/v1")
```

---

## Verification

```bash
# Wellington address:
curl "http://localhost:8000/api/v1/property/1753062/rates" | python -m json.tool
# Expected: valuation_number, capital_value, land_value, total_rates, levy_breakdown

# Non-Wellington address:
curl "http://localhost:8000/api/v1/property/123456/rates"
# Expected: 404 "No rates data available for this address"

# Rate limiting (10/min — stricter because it calls external API):
# 11th request within a minute → 429
```
