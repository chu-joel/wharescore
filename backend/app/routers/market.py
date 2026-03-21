from __future__ import annotations
from typing import Optional

# backend/app/routers/market.py
from datetime import date

import orjson
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from .. import db
from ..deps import limiter
from ..redis import cache_get, cache_set
from ..services.market import (
    YIELD_TABLE,
    blend_sa2_tla,
    cv_uncertainty,
    estimate_percentile,
    market_confidence_stars,
)
from ..services.rent_advisor import compute_rent_advice

router = APIRouter()

class RentAdvisorRequest(BaseModel):
    dwelling_type: str = Field(pattern=r"^(House|Flat|Apartment|Room)$")
    bedrooms: str = Field(pattern=r"^(Studio|1|2|3|4|5\+)$")
    weekly_rent: int = Field(ge=50, le=10000)
    finish_tier: str | None = Field(None, pattern=r"^(basic|standard|modern|premium|luxury)$")
    bathrooms: str | None = Field(None, pattern=r"^(1|2|3\+)$")
    has_parking: bool | None = None
    has_insulation: bool | None = None
    is_furnished: bool | None = None
    shared_kitchen: bool | None = None
    utilities_included: bool | None = None


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
    asking_rent: Optional[int] = Query(None, ge=50, le=10000),
    dwelling_type: str = Query("ALL", pattern=r"^(ALL|House|Flat|Apartment|Room)$"),
    bedrooms: str = Query("ALL", pattern=r"^(ALL|1|2|3|4|5\+|NA)$"),
):
    """Fair price analysis: rental median, percentile, yield check, purchase estimate."""

    cache_key = f"market:{address_id}:{dwelling_type}:{bedrooms}:{asking_rent or 0}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    async with db.pool.connection() as conn:
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
        sa2 = cur.fetchone()
        if not sa2:
            raise HTTPException(404, "Address not found or outside SA2 coverage")

        # 2. Method A: direct SA2 lookup from bonds_detailed (latest quarter)
        bonds_query = """
            SELECT bd.median_rent, bd.lower_quartile_rent, bd.upper_quartile_rent,
                   bd.active_bonds, bd.time_frame, bd.log_std_dev_weekly_rent
            FROM bonds_detailed bd
            WHERE bd.location_id = %s
        """
        bonds_params = [sa2["sa2_code"]]
        if dwelling_type != "ALL":
            bonds_query += " AND bd.dwelling_type = %s"
            bonds_params.append(dwelling_type)
        if bedrooms != "ALL":
            bonds_query += " AND bd.number_of_beds = %s"
            bonds_params.append(bedrooms)
        bonds_query += " ORDER BY bd.time_frame DESC LIMIT 1"

        cur = await conn.execute(bonds_query, bonds_params)
        bonds = cur.fetchone()

        # 3. SA2→TLA fallback if bond count < 5
        # Note: PostgreSQL returns Decimal for numeric columns — cast to float
        # early so all downstream arithmetic (yield * float, HPI ratio, etc.) works.
        sa2_median = float(bonds["median_rent"]) if bonds and bonds["median_rent"] else None
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
            tla = cur.fetchone()
            if tla:
                tla_median = float(tla["median_rent"]) if tla["median_rent"] else None
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
        tr = cur.fetchone()
        trends = dict(tr) if tr else {}

        # 5. Council valuation (988K properties across 6 councils)
        cv_data = None
        cur = await conn.execute(
            """
            SELECT cv.capital_value, cv.land_value, cv.valuation_date,
                   cv.suburb, cv.full_address, cv.council
            FROM council_valuations cv, addresses a
            WHERE a.address_id = %s
              AND ST_Contains(cv.geom, a.geom)
            LIMIT 1
            """,
            [address_id],
        )
        cv = cur.fetchone()
        if cv:
            # Use stored valuation_date, or fall back to known revaluation dates
            val_date = cv.get("valuation_date")
            if not val_date:
                from ..services.market import REVALUATION_DATES
                # Try TA name first, then council name
                for key in [sa2["ta_name"], cv.get("council", "")]:
                    for reval_key, reval_date_str in REVALUATION_DATES.items():
                        if reval_key.lower() in (key or "").lower() or (key or "").lower() in reval_key.lower():
                            val_date = date.fromisoformat(reval_date_str)
                            break
                    if val_date:
                        break

            cv_age_months = None
            if val_date:
                cv_age_months = (date.today() - val_date).days // 30
            cv_data = {
                "capital_value": cv["capital_value"],
                "land_value": cv["land_value"],
                "valuation_date": str(val_date) if val_date else None,
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
                lq = float(bonds["lower_quartile_rent"]) if bonds.get("lower_quartile_rent") else None
                uq = float(bonds["upper_quartile_rent"]) if bonds.get("upper_quartile_rent") else None
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
            current_hpi_row = cur.fetchone()
            if current_hpi_row:
                current_hpi = float(current_hpi_row["house_price_index"])
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
                    hpi_val = cur.fetchone()
                    if hpi_val:
                        hpi_at_val = float(hpi_val["house_price_index"])

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

        # 8b. Yield-only fallback when no CV exists but we have rent data
        if not purchase_estimate and blended_median:
            region = sa2["ta_name"].split(" ")[0]
            yields = YIELD_TABLE.get(region, YIELD_TABLE["DEFAULT"])
            yield_value = round((blended_median * 52) / yields["typical"])
            yield_low = round((blended_median * 52) / yields["high"])
            yield_high = round((blended_median * 52) / yields["low"])
            purchase_estimate = {
                "estimated_value": yield_value,
                "low": yield_low,
                "high": yield_high,
                "hpi_adjusted": None,
                "yield_inversion": yield_value,
                "methods_agree_pct": None,
                "method": "yield_only",
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
# POST /property/{address_id}/rent-advisor — Personalised rent advice
# =============================================================================

@router.post("/property/{address_id}/rent-advisor")
@limiter.limit("20/minute")
async def rent_advisor(request: Request, address_id: int, body: RentAdvisorRequest):
    """Personalised rent advice with property-specific adjustments."""

    # Studio maps to 1-bed for bond data (MBIE has no studio category)
    is_studio = body.bedrooms == "Studio"
    bond_bedrooms = "1" if is_studio else body.bedrooms

    async with db.pool.connection() as conn:
        result = await compute_rent_advice(
            conn,
            address_id=address_id,
            weekly_rent=body.weekly_rent,
            dwelling_type=body.dwelling_type,
            bedrooms=bond_bedrooms,
            finish_tier=body.finish_tier,
            bathrooms=body.bathrooms,
            has_parking=body.has_parking,
            has_insulation=body.has_insulation,
            is_studio=is_studio,
            is_furnished=body.is_furnished,
            shared_kitchen=body.shared_kitchen,
            utilities_included=body.utilities_included,
        )

    if not result:
        raise HTTPException(404, "Address not found or insufficient rental data")

    return result


# =============================================================================
# GET /property/{address_id}/rent-history — Time series for chart
# =============================================================================

@router.get("/property/{address_id}/rent-history")
@limiter.limit("20/minute")
async def rent_history(
    request: Request,
    address_id: int,
    dwelling_type: str = Query("ALL", pattern=r"^(ALL|House|Flat|Apartment|Room)$"),
    beds: str = Query("ALL", pattern=r"^(ALL|1|2|3|4|5\+|NA)$"),
    years: int = Query(10, ge=1, le=33),
):
    """SA2-level rent time series from bonds_detailed.
    Separate endpoint because it returns 40-130 data points — too heavy for /market.
    Frontend lazy-loads when Market section is expanded."""

    cache_key = f"rent_history:{address_id}:{dwelling_type}:{beds}:{years}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    async with db.pool.connection() as conn:
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
        sa2 = cur.fetchone()
        if not sa2:
            raise HTTPException(404, "Address not found or outside SA2 coverage")

        # Query bonds_detailed time series
        history_query = """
            SELECT time_frame, median_rent, lower_quartile_rent,
                   upper_quartile_rent, active_bonds
            FROM bonds_detailed
            WHERE location_id = %s
        """
        params = [sa2["sa2_code"]]
        if dwelling_type != "ALL":
            history_query += " AND dwelling_type = %s"
            params.append(dwelling_type)
        if beds != "ALL":
            history_query += " AND number_of_beds = %s"
            params.append(beds)
        history_query += " AND time_frame >= (CURRENT_DATE - %s * interval '1 year') ORDER BY time_frame ASC"
        params.append(years)

        cur = await conn.execute(history_query, params)
        data = cur.fetchall()

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
        start_rent = float(recent[cutoff_idx]["median_rent"])
        end_rent = float(recent[-1]["median_rent"])
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

    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT quarter_end, house_price_index, house_sales
            FROM rbnz_housing
            WHERE quarter_end >= (CURRENT_DATE - %s * interval '1 year')
            ORDER BY quarter_end ASC
            """,
            [years],
        )
        data = cur.fetchall()

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
