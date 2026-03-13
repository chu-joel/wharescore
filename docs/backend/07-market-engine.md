# Backend — Market & Fair Price Engine (Phase 2F + 2G-0)

**Creates:** Fair price endpoint, rent history chart endpoint, HPI trend endpoint, market service helpers
**Prerequisites:** `02-project-setup.md` complete. Materialized views `mv_rental_market` and `mv_rental_trends` refreshed. `sa2_boundaries`, `bonds_detailed`, `council_valuations`, `rbnz_housing` tables loaded.
**Reference:** `FAIR-PRICE-ENGINE.md` for full methodology

---

## Files to Create

```
backend/app/
├── routers/
│   └── market.py           # GET /property/{id}/market, /property/{id}/rent-history, /market/hpi
└── services/
    └── market.py            # Yield table, CV uncertainty, percentile estimation, blending, confidence
```

---

## Step 1: Market Service Helpers

```python
# backend/app/services/market.py
"""
Market analysis helper functions.
Reference: FAIR-PRICE-ENGINE.md
"""

import math


# --- Regional Gross Yield Table (FAIR-PRICE-ENGINE.md §4 Method B) ---
YIELD_TABLE = {
    "Auckland":     {"low": 0.030, "typical": 0.035, "high": 0.040},
    "Wellington":   {"low": 0.030, "typical": 0.045, "high": 0.055},
    "Christchurch": {"low": 0.040, "typical": 0.048, "high": 0.055},
    "Hamilton":     {"low": 0.040, "typical": 0.050, "high": 0.060},
    "Tauranga":     {"low": 0.030, "typical": 0.040, "high": 0.048},
    "Dunedin":      {"low": 0.045, "typical": 0.055, "high": 0.065},
    "DEFAULT":      {"low": 0.040, "typical": 0.050, "high": 0.060},
}


def cv_uncertainty(months_since_valuation: int) -> float:
    """Returns ± uncertainty as decimal (e.g., 0.08 = ±8%).
    Ref: FAIR-PRICE-ENGINE.md §7"""
    if months_since_valuation <= 12:
        return 0.08
    if months_since_valuation <= 24:
        return 0.12
    if months_since_valuation <= 36:
        return 0.18
    return 0.25


REVALUATION_DATES = {
    "Wellington City": "2024-09-01",
    "Christchurch City": "2022-08-01",
    "Taranaki": "2025-08-01",
    "Auckland": "2024-06-01",
}


def estimate_percentile(asking_rent: int, median: float, sigma: float | None) -> float | None:
    """Compute percentile of asking_rent in log-normal distribution.
    sigma = log_std_dev_weekly_rent from bonds_detailed.
    Returns 0.0-1.0 or None if sigma unavailable."""
    if not sigma or sigma <= 0:
        return None
    mu = math.log(median)
    z = (math.log(asking_rent) - mu) / sigma
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def blend_sa2_tla(sa2_median: float, tla_median: float, sa2_bond_count: int) -> float:
    """Blend SA2 and TLA medians when SA2 has few bonds (5-20).
    At 5 bonds: 75% TLA, 25% SA2. At 20+ bonds: 100% SA2."""
    weight = min(sa2_bond_count / 20.0, 1.0)
    return weight * sa2_median + (1 - weight) * tla_median


def market_confidence_stars(
    bond_count: int, cv_age_months: int | None, methods_agree_pct: float | None
) -> int:
    """Returns 1-5 stars based on data quality.
    Ref: FAIR-PRICE-ENGINE.md §8"""
    agree = methods_agree_pct or 100
    cv_age = cv_age_months or 999
    if bond_count >= 30 and cv_age <= 12 and agree <= 10:
        return 5
    if bond_count >= 15 and cv_age <= 24 and agree <= 15:
        return 4
    if bond_count >= 5 and cv_age <= 36:
        return 3
    if bond_count >= 1:
        return 2
    return 1
```

---

## Step 2: Market Router

```python
# backend/app/routers/market.py
from datetime import date

import orjson
from fastapi import APIRouter, HTTPException, Query, Request

from ..db import pool
from ..deps import limiter
from ..redis import cache_get, cache_set
from ..services.market import (
    YIELD_TABLE,
    blend_sa2_tla,
    cv_uncertainty,
    estimate_percentile,
    market_confidence_stars,
)

router = APIRouter()

LEGAL_DISCLAIMER = (
    "This estimate is based on publicly available government data including "
    "MBIE bond records, council rating valuations, and the RBNZ House Price "
    "Index. It is not a registered valuation, appraisal, or market assessment. "
    "Individual property values depend on specific features, condition, market "
    "timing, and other factors this estimate cannot account for."
)


# =============================================================================
# GET /property/{address_id}/market — Fair price analysis
# =============================================================================

@router.get("/property/{address_id}/market")
@limiter.limit("20/minute")
async def get_market(
    request: Request,
    address_id: int,
    asking_rent: int | None = Query(None, ge=50, le=10000),
    dwelling_type: str = Query("ALL"),
    bedrooms: str = Query("ALL"),
):
    """Fair price analysis: rental median, percentile, yield check, purchase estimate."""

    cache_key = f"market:{address_id}:{dwelling_type}:{bedrooms}:{asking_rent or 0}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    async with pool.connection() as conn:
        # 1. Get SA2 + TA for this address
        cur = await conn.execute(
            """
            SELECT sa2.sa2_code, sa2.sa2_name, sa2.ta_name, sa2.ta_code
            FROM addresses a
            JOIN LATERAL (
                SELECT sa2_code, sa2_name, ta_name, ta_code
                FROM sa2_boundaries WHERE ST_Within(a.geom, geom) LIMIT 1
            ) sa2 ON true
            WHERE a.address_id = %s
            """,
            [address_id],
        )
        sa2 = await cur.fetchone()
        if not sa2:
            raise HTTPException(404, "Address not found or outside SA2 coverage")

        # 2. Method A: direct SA2 lookup from bonds_detailed (latest quarter)
        type_clause = "AND bd.dwelling_type = %s" if dwelling_type != "ALL" else "AND %s IS NULL"
        beds_clause = "AND bd.number_of_beds = %s" if bedrooms != "ALL" else "AND %s IS NULL"

        cur = await conn.execute(
            f"""
            SELECT bd.median_rent, bd.lower_quartile_rent, bd.upper_quartile_rent,
                   bd.active_bonds, bd.time_frame, bd.log_std_dev_weekly_rent
            FROM bonds_detailed bd
            WHERE bd.location_id = %s
              {type_clause} {beds_clause}
            ORDER BY bd.time_frame DESC
            LIMIT 1
            """,
            [
                sa2["sa2_code"],
                dwelling_type if dwelling_type != "ALL" else None,
                bedrooms if bedrooms != "ALL" else None,
            ],
        )
        bonds = await cur.fetchone()

        # 3. SA2→TLA fallback if bond count < 5
        sa2_median = bonds["median_rent"] if bonds else None
        sa2_bond_count = bonds["active_bonds"] if bonds else 0
        blended_median = sa2_median
        data_source = "sa2"

        if not bonds or sa2_bond_count < 5:
            cur = await conn.execute(
                """
                SELECT median_rent FROM bonds_tla
                WHERE location = %s
                ORDER BY time_frame DESC LIMIT 1
                """,
                [sa2["ta_name"]],
            )
            tla = await cur.fetchone()
            if tla:
                tla_median = tla["median_rent"]
                if sa2_median and sa2_bond_count > 0:
                    blended_median = blend_sa2_tla(sa2_median, tla_median, sa2_bond_count)
                    data_source = "sa2_tla_blend"
                else:
                    blended_median = tla_median
                    data_source = "tla_fallback"

        # 4. Rental trends (YoY, CAGR)
        cur = await conn.execute(
            """
            SELECT yoy_pct, cagr_3yr, cagr_5yr, cagr_10yr
            FROM mv_rental_trends
            WHERE sa2_code = %s
            LIMIT 1
            """,
            [sa2["sa2_code"]],
        )
        tr = await cur.fetchone()
        trends = dict(tr) if tr else {}

        # 5. Council valuation (Wellington only — other councils return None)
        cv_data = None
        cur = await conn.execute(
            """
            SELECT cv.capital_value, cv.land_value, cv.valuation_date,
                   cv.suburb, cv.full_address
            FROM council_valuations cv, addresses a
            WHERE a.address_id = %s
              AND ST_Contains(cv.geom, a.geom)
            LIMIT 1
            """,
            [address_id],
        )
        cv = await cur.fetchone()
        if cv:
            cv_age_months = None
            if cv.get("valuation_date"):
                cv_age_months = (date.today() - cv["valuation_date"]).days // 30
            cv_data = {
                "capital_value": cv["capital_value"],
                "land_value": cv["land_value"],
                "valuation_date": str(cv["valuation_date"]) if cv.get("valuation_date") else None,
                "cv_age_months": cv_age_months,
                "uncertainty": cv_uncertainty(cv_age_months) if cv_age_months else 0.25,
            }

        # 6. Method B: yield-based cross-validation
        yield_rent = None
        if cv_data and cv_data["capital_value"] and blended_median:
            region = sa2["ta_name"].split(" ")[0]
            yields = YIELD_TABLE.get(region, YIELD_TABLE["DEFAULT"])
            yield_rent = round((cv_data["capital_value"] * yields["typical"]) / 52)

        # 7. Asking rent percentile (if user provided asking_rent)
        percentile = None
        if asking_rent and blended_median:
            sigma = bonds.get("log_std_dev_weekly_rent") if bonds else None
            percentile = estimate_percentile(asking_rent, blended_median, sigma)
            if percentile is not None:
                percentile = round(percentile * 100, 1)
            elif bonds:
                # Linear interpolation fallback using quartiles
                lq = bonds.get("lower_quartile_rent")
                uq = bonds.get("upper_quartile_rent")
                if lq and uq and uq > lq:
                    if asking_rent <= lq:
                        percentile = round(25 * (asking_rent / lq), 1)
                    elif asking_rent <= blended_median:
                        percentile = round(25 + 25 * (asking_rent - lq) / (blended_median - lq), 1)
                    elif asking_rent <= uq:
                        percentile = round(50 + 25 * (asking_rent - blended_median) / (uq - blended_median), 1)
                    else:
                        percentile = min(99, round(75 + 25 * (asking_rent - uq) / (uq - lq), 1))

        # 8. Purchase price estimation (CV + HPI adjustment)
        purchase_estimate = None
        if cv_data and cv_data["capital_value"]:
            cur = await conn.execute(
                "SELECT house_price_index FROM rbnz_housing ORDER BY quarter_end DESC LIMIT 1"
            )
            current_hpi_row = await cur.fetchone()
            if current_hpi_row:
                current_hpi = current_hpi_row["house_price_index"]
                hpi_at_val = None
                if cv_data.get("valuation_date"):
                    cur = await conn.execute(
                        """
                        SELECT house_price_index FROM rbnz_housing
                        WHERE quarter_end <= %s
                        ORDER BY quarter_end DESC LIMIT 1
                        """,
                        [cv_data["valuation_date"]],
                    )
                    hpi_val = await cur.fetchone()
                    if hpi_val:
                        hpi_at_val = hpi_val["house_price_index"]

                if hpi_at_val and hpi_at_val > 0:
                    hpi_adjusted = round(cv_data["capital_value"] * (current_hpi / hpi_at_val))
                    unc = cv_data["uncertainty"]

                    # Method C: Yield inversion
                    yield_value = None
                    if blended_median:
                        region = sa2["ta_name"].split(" ")[0]
                        yields = YIELD_TABLE.get(region, YIELD_TABLE["DEFAULT"])
                        yield_value = round((blended_median * 52) / yields["typical"])

                    # Ensemble: weight HPI more for newer CVs
                    if yield_value:
                        hpi_weight = max(0.3, 1.0 - unc)
                        combined = round(hpi_weight * hpi_adjusted + (1 - hpi_weight) * yield_value)
                        agree_pct = abs(hpi_adjusted - yield_value) / max(hpi_adjusted, 1) * 100
                    else:
                        combined = hpi_adjusted
                        agree_pct = None

                    purchase_estimate = {
                        "estimated_value": combined,
                        "low": round(combined * (1 - unc)),
                        "high": round(combined * (1 + unc)),
                        "hpi_adjusted": hpi_adjusted,
                        "yield_inversion": yield_value,
                        "methods_agree_pct": round(agree_pct, 1) if agree_pct else None,
                    }

        # 9. Confidence stars
        cv_age = cv_data["cv_age_months"] if cv_data else None
        agree_pct = purchase_estimate["methods_agree_pct"] if purchase_estimate else None
        stars = market_confidence_stars(sa2_bond_count, cv_age, agree_pct)

        result = {
            "sa2_code": sa2["sa2_code"],
            "sa2_name": sa2["sa2_name"],
            "ta_name": sa2["ta_name"],
            "data_source": data_source,
            "rental": {
                "median": blended_median,
                "lower_quartile": bonds["lower_quartile_rent"] if bonds else None,
                "upper_quartile": bonds["upper_quartile_rent"] if bonds else None,
                "bond_count": sa2_bond_count,
                "period": str(bonds["time_frame"]) if bonds else None,
            },
            "trends": trends,
            "yield_cross_check": yield_rent,
            "asking_rent_percentile": percentile,
            "valuation": cv_data,
            "purchase_estimate": purchase_estimate,
            "confidence_stars": stars,
            "disclaimer": LEGAL_DISCLAIMER,
        }

    await cache_set(cache_key, orjson.dumps(result, default=str).decode(), ex=3600)
    return result


# =============================================================================
# GET /property/{address_id}/rent-history — Time series for chart
# =============================================================================

@router.get("/property/{address_id}/rent-history")
@limiter.limit("20/minute")
async def rent_history(
    request: Request,
    address_id: int,
    dwelling_type: str = Query("ALL"),
    beds: str = Query("ALL"),
    years: int = Query(10, le=33),
):
    """SA2-level rent time series from bonds_detailed.
    Separate endpoint because it returns 40-130 data points — too heavy for /market.
    Frontend lazy-loads when Market section is expanded."""

    cache_key = f"rent_history:{address_id}:{dwelling_type}:{beds}:{years}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    async with pool.connection() as conn:
        # Get SA2 for this address
        cur = await conn.execute(
            """
            SELECT sa2.sa2_code, sa2.sa2_name
            FROM addresses a
            JOIN LATERAL (
                SELECT sa2_code, sa2_name FROM sa2_boundaries
                WHERE ST_Within(a.geom, geom) LIMIT 1
            ) sa2 ON true
            WHERE a.address_id = %s
            """,
            [address_id],
        )
        sa2 = await cur.fetchone()
        if not sa2:
            raise HTTPException(404, "Address not found or outside SA2 coverage")

        # Query bonds_detailed time series
        type_clause = "AND dwelling_type = %s" if dwelling_type != "ALL" else "AND %s IS NULL"
        beds_clause = "AND number_of_beds = %s" if beds != "ALL" else "AND %s IS NULL"

        cur = await conn.execute(
            f"""
            SELECT time_frame, median_rent, lower_quartile_rent,
                   upper_quartile_rent, active_bonds
            FROM bonds_detailed
            WHERE location_id = %s
              {type_clause} {beds_clause}
              AND time_frame >= (CURRENT_DATE - %s * interval '1 year')
            ORDER BY time_frame ASC
            """,
            [
                sa2["sa2_code"],
                dwelling_type if dwelling_type != "ALL" else None,
                beds if beds != "ALL" else None,
                years,
            ],
        )
        data = await cur.fetchall()

    if len(data) < 4:
        return {
            "sa2_name": sa2["sa2_name"],
            "sa2_code": sa2["sa2_code"],
            "data": [],
            "message": "Insufficient data points",
        }

    def cagr(data_points, n_years):
        recent = [d for d in data_points if d.get("median_rent")]
        if len(recent) < 2:
            return None
        cutoff_idx = max(0, len(recent) - n_years * 4)
        if cutoff_idx >= len(recent) - 1:
            return None
        start_rent = recent[cutoff_idx]["median_rent"]
        end_rent = recent[-1]["median_rent"]
        if start_rent <= 0:
            return None
        actual_years = (len(recent) - cutoff_idx) / 4
        if actual_years < 0.5:
            return None
        return round(((end_rent / start_rent) ** (1 / actual_years) - 1) * 100, 1)

    result = {
        "sa2_name": sa2["sa2_name"],
        "sa2_code": sa2["sa2_code"],
        "dwelling_type": dwelling_type,
        "beds": beds,
        "data": data,
        "cagr_1yr": cagr(data, 1),
        "cagr_5yr": cagr(data, 5),
        "cagr_10yr": cagr(data, 10),
        "latest_active_bonds": data[-1].get("active_bonds") if data else None,
    }

    await cache_set(cache_key, orjson.dumps(result, default=str).decode(), ex=86400)
    return result


# =============================================================================
# GET /market/hpi — National House Price Index trend
# =============================================================================

@router.get("/market/hpi")
@limiter.limit("30/minute")
async def hpi_trend(request: Request, years: int = Query(10, le=35)):
    """National HPI from rbnz_housing (143 records, 1990-2025).
    Property-independent — globally cacheable.
    Frontend lazy-loads when Market section is expanded."""

    cache_key = f"hpi:{years}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT quarter_end, house_price_index, house_sales
            FROM rbnz_housing
            WHERE quarter_end >= (CURRENT_DATE - %s * interval '1 year')
            ORDER BY quarter_end ASC
            """,
            [years],
        )
        data = await cur.fetchall()

    if not data:
        return {"data": [], "message": "No HPI data available"}

    peak = max(data, key=lambda d: d.get("house_price_index") or 0)
    current = data[-1]
    current_hpi = current.get("house_price_index") or 0
    peak_hpi = peak.get("house_price_index") or 0
    pct_from_peak = round((current_hpi - peak_hpi) / peak_hpi * 100, 1) if peak_hpi else None

    result = {
        "data": data,
        "peak_quarter": str(peak.get("quarter_end")),
        "peak_hpi": peak_hpi,
        "current_hpi": current_hpi,
        "pct_from_peak": pct_from_peak,
        "latest_sales": current.get("house_sales"),
    }

    await cache_set(cache_key, orjson.dumps(result, default=str).decode(), ex=86400)
    return result
```

---

## Register in main.py

```python
from .routers import market
app.include_router(market.router, prefix="/api/v1")
```

---

## Verification

```bash
# Market analysis for Cuba St:
curl "http://localhost:8000/api/v1/property/1753062/market" | python -m json.tool
# Expected: sa2_code, rental median, trends, valuation, confidence_stars

# With asking rent:
curl "http://localhost:8000/api/v1/property/1753062/market?asking_rent=600&dwelling_type=Flat&bedrooms=2"
# Expected: asking_rent_percentile populated

# Rent history chart data:
curl "http://localhost:8000/api/v1/property/1753062/rent-history?years=5"
# Expected: array of quarterly data points with median_rent

# National HPI:
curl "http://localhost:8000/api/v1/market/hpi?years=10"
# Expected: quarterly HPI data, peak info, pct_from_peak
```
