# backend/app/services/price_advisor.py
"""
Price advisor engine: estimates fair market value for a property using
CV + HPI + yield-inversion ensemble, applies property-specific adjustments,
and shows hazard ownership cost flags.

Methodology (transparent to user):
1. Start with CV
2. Adjust forward with HPI (national house price index since revaluation date)
3. Cross-check with yield inversion (SA2 median rent × 52 / regional yield)
4. Ensemble blend (weight HPI more for fresh CVs)
5. Apply property-specific adjustments (finish, bathrooms, quality per room)
6. Band = inner ±1%, outer ±3%

Key insight: CVs already price in hazards. Council valuations are based on
sales evidence. flood zone properties sell for less, so the CV reflects that.
Hazards are shown as COST FLAGS (insurance, strengthening, rates), not percentage
adjustments, to avoid double-counting.
"""
from __future__ import annotations

from datetime import date

from .market import (
    HPI_CGR_PROXY,
    REVALUATION_DATES,
    YIELD_TABLE,
    blend_sa2_tla,
    cv_uncertainty,
    market_confidence_stars,
)
from .rent_advisor import (
    BATHROOM_ADJ,
    FINISH_TIERS,
    TYPICAL_FOOTPRINT,
    _clamp,
    _compute_prevalence,
    _detect_hazards,
    _get_area_context,
    _get_location_metrics,
    _get_unit_cv_from_rates,
    _location_adjustment,
    get_sa2_rental_baseline,
)

# ---------------------------------------------------------------------------
# Hazard cost flags. ownership cost impact, NOT percentage adjustments
# ---------------------------------------------------------------------------

HAZARD_COST_FLAGS = {
    "flood": {
        "label": "Flood zone",
        "insurance_uplift_pct": (30, 80),
        "description": "Flood zone properties face significantly higher insurance premiums. Some insurers may decline cover.",
        "action": "Get insurance quotes before making an offer. Check EQC flood cover eligibility.",
    },
    "liquefaction": {
        "label": "High liquefaction risk",
        "insurance_uplift_pct": (15, 40),
        "strengthening_cost": None,
        "description": "High liquefaction risk can increase insurance costs and may require geotechnical assessment.",
        "action": "Commission a geotechnical report. Check foundation type.",
    },
    "tsunami": {
        "label": "Tsunami zone",
        "insurance_uplift_pct": (5, 20),
        "description": "Tsunami zone designation. Risk is low-probability but high-impact.",
        "action": "Check council evacuation routes. Consider in your risk tolerance.",
    },
    "epb": {
        "label": "Earthquake-prone building",
        "insurance_uplift_pct": (50, 150),
        "strengthening_cost_per_sqm": (800, 3000),
        "description": "EPB status means mandatory strengthening within timeframe set by council. "
                       "Commercial buildings average 45% discount (Motu study). Residential estimated 15-25%.",
        "action": "Get engineering assessment. Check council deadline. Budget for strengthening costs.",
    },
    "contamination": {
        "label": "Near contaminated site",
        "insurance_uplift_pct": (0, 10),
        "description": "Proximity to contaminated land. May affect future consent applications.",
        "action": "Check HAIL list status. Review council LIM report.",
    },
    "overland_flow": {
        "label": "Overland flow path",
        "insurance_uplift_pct": (10, 30),
        "description": "Property on or near an overland flow path. surface flooding risk during heavy rain.",
        "action": "Check floor level relative to flow path. Consider drainage improvements.",
    },
    "slope_failure": {
        "label": "Landslide risk",
        "insurance_uplift_pct": (20, 60),
        "description": "High slope failure risk. May require retaining or stabilisation work.",
        "action": "Get geotechnical assessment. Check for existing retaining walls.",
    },
    "noise_high": {
        "label": "High traffic noise",
        "insurance_uplift_pct": (0, 0),
        "description": "High traffic noise (65+ dB). Not an insurance issue but affects liveability and resale.",
        "action": "Visit at different times of day. Check double-glazing.",
    },
    "aircraft_noise": {
        "label": "Aircraft noise zone",
        "insurance_uplift_pct": (0, 0),
        "description": "Aircraft noise overlay (60+ dBA). Affects liveability. May restrict future development.",
        "action": "Check district plan rules for noise-sensitive activities.",
    },
    "wind_high": {
        "label": "High wind zone",
        "insurance_uplift_pct": (5, 15),
        "description": "High/extreme wind zone. Higher maintenance costs and insurance.",
        "action": "Check roof condition and cladding. Budget for higher maintenance.",
    },
    "coastal_erosion": {
        "label": "Coastal erosion risk",
        "insurance_uplift_pct": (20, 60),
        "description": "Within 500m of coastal erosion zone. May face managed retreat in future.",
        "action": "Check council coastal hazard maps. Review long-term council plans for this area.",
    },
}

# NZ average annual rates as % of CV (by council type)
RATES_PCT_OF_CV = {
    "Auckland": 0.0030,
    "Wellington": 0.0055,
    "Christchurch": 0.0040,
    "Hamilton": 0.0045,
    "Tauranga": 0.0035,
    "Dunedin": 0.0050,
    "DEFAULT": 0.0045,
}

# Base insurance as % of replacement value (improvements)
BASE_INSURANCE_PCT = 0.003  # ~$3 per $1000 of improvements per year


# ---------------------------------------------------------------------------
# Main computation
# ---------------------------------------------------------------------------

async def compute_price_advice(
    conn,
    address_id: int,
    asking_price: int | None = None,
    bedrooms: str | None = None,
    finish_tier: str | None = None,
    bathrooms: str | None = None,
    has_parking: bool | None = None,
) -> dict | None:
    """Compute personalised price advice with band output."""

    # 1. SA2 lookup
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
        return None

    # 2. Property data (footprint + CV + bedrooms from building)
    cur = await conn.execute(
        """
        SELECT
            a.unit_value, a.road_name, a.road_type_name, a.address_number,
            (SELECT round(ST_Area(b.geom::geography)::numeric, 1)
             FROM building_outlines b
             WHERE b.geom && ST_Expand(a.geom, 0.0005)
               AND ST_Contains(b.geom, a.geom) LIMIT 1) AS footprint_m2,
            (SELECT COUNT(*)::int FROM addresses a2
             WHERE a2.gd2000_xcoord = a.gd2000_xcoord
               AND a2.gd2000_ycoord = a.gd2000_ycoord
               AND a2.address_lifecycle = 'Current') AS unit_count,
            cv.capital_value, cv.land_value, cv.valuation_date, cv.council,
            a.full_address, a.town_city
        FROM addresses a
        LEFT JOIN LATERAL (
            SELECT capital_value, land_value, valuation_date, council
            FROM council_valuations cv
            WHERE ST_Contains(cv.geom, a.geom) LIMIT 1
        ) cv ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    prop = cur.fetchone()
    if not prop:
        return None

    # For units, try rates cache for accurate per-unit CV
    capital_value = None
    land_value = None
    valuation_date = None
    improvements_value = None

    if prop.get("unit_value"):
        prop_dict = dict(prop)
        rates_cv = await _get_unit_cv_from_rates(conn, prop_dict)
        if rates_cv:
            capital_value = rates_cv["capital_value"]
            land_value = rates_cv["land_value"]
            improvements_value = rates_cv.get("improvements_value") or (capital_value - land_value)

    if capital_value is None and prop.get("capital_value"):
        capital_value = int(prop["capital_value"])
        land_value = int(prop["land_value"]) if prop.get("land_value") else 0
        improvements_value = capital_value - land_value

    if capital_value is None:
        # Fall back to the live council rates API. council_valuations has
        # capital_value populated only for a subset of councils (Auckland,
        # WCC, KCDC etc). For the other ~41 councils (including CCC) the
        # CV only comes via the live rates API that _q_rates in
        # snapshot_generator also uses. Without this fallback, /price-advisor
        # returns a yield-only band for Chch/Dunedin/Taranaki/etc.
        try:
            from ..routers.rates import _fetch_rates_for_address
            rates = await _fetch_rates_for_address(
                prop.get("full_address") or "", prop.get("town_city") or "",
                address_id, conn,
            )
            cv_block = (rates or {}).get("current_valuation") or {}
            if cv_block.get("capital_value"):
                capital_value = int(cv_block["capital_value"])
                land_value = int(cv_block.get("land_value") or 0)
                improvements_value = (
                    int(cv_block.get("improvements_value") or 0)
                    or (capital_value - land_value)
                )
        except Exception:
            pass

    # Valuation date
    valuation_date = prop.get("valuation_date")
    if not valuation_date:
        for key in [sa2["ta_name"], prop.get("council", "")]:
            for reval_key, reval_date_str in REVALUATION_DATES.items():
                if reval_key.lower() in (key or "").lower() or (key or "").lower() in reval_key.lower():
                    valuation_date = date.fromisoformat(reval_date_str)
                    break
            if valuation_date:
                break

    # 3. Rental baseline (for yield inversion)
    baseline = await get_sa2_rental_baseline(conn, sa2["sa2_code"], sa2["ta_name"], "ALL", "ALL")
    blended_median = baseline["median"] if baseline else None
    bond_count = baseline["bond_count"] if baseline else 0

    # 4. HPI adjustment. Uses REGIONAL HPI (reinz_hpi_ta) with 5yr-CGR
    # back-calculation to the reval date. National rbnz_housing previously
    # used here misrepresents regional markets — Chch was +4.7%/5yr CGR while
    # national was -0.6%, producing ~15% underestimates on CCC properties.
    # If reval is within 6 months, skip HPI entirely (drift negligible,
    # anchor to CV). If no regional movement data for this TA, fall through.
    hpi_adjusted = None
    cv_age_months = None
    unc = 0.25

    if capital_value and valuation_date:
        cv_age_months = (date.today() - valuation_date).days // 30 if isinstance(valuation_date, date) else None
        if cv_age_months is not None:
            unc = cv_uncertainty(cv_age_months)

        # Skip HPI step entirely for fresh revals — the CV IS the current market.
        if cv_age_months is None or cv_age_months >= 6:
            ta = sa2["ta_name"]
            cur = await conn.execute(
                """
                SELECT hpi, change_5y_cgr_pct, change_1y_pct, month_end
                FROM reinz_hpi_ta
                WHERE ta_name = %s
                ORDER BY month_end DESC LIMIT 1
                """,
                [ta],
            )
            reg = cur.fetchone()
            cgr = None
            if reg and reg.get("change_5y_cgr_pct") is not None:
                cgr = float(reg["change_5y_cgr_pct"]) / 100.0
            elif reg and reg.get("change_1y_pct") is not None:
                # No 5y CGR for this TA; use 1y as a rough annual rate.
                cgr = float(reg["change_1y_pct"]) / 100.0
            else:
                # TA isn't in the page-6 summary table. Fall back to a
                # geographic-neighbour proxy's CGR (market.HPI_CGR_PROXY).
                proxy_ta = HPI_CGR_PROXY.get(ta)
                if proxy_ta:
                    cur = await conn.execute(
                        """
                        SELECT change_5y_cgr_pct FROM reinz_hpi_ta
                        WHERE ta_name = %s
                        ORDER BY month_end DESC LIMIT 1
                        """,
                        [proxy_ta],
                    )
                    proxy_row = cur.fetchone()
                    if proxy_row and proxy_row.get("change_5y_cgr_pct") is not None:
                        cgr = float(proxy_row["change_5y_cgr_pct"]) / 100.0
            if cgr is not None and cv_age_months:
                years = cv_age_months / 12.0
                # Back-calc HPI at reval: hpi_today = hpi_reval * (1+cgr)^years
                # So ratio hpi_today/hpi_reval = (1+cgr)^years.
                hpi_adjusted = round(capital_value * (1 + cgr) ** years)

    # 5. Yield inversion
    yield_value = None
    region = sa2["ta_name"].split(" ")[0]
    yields = YIELD_TABLE.get(region, YIELD_TABLE["DEFAULT"])

    if blended_median:
        yield_value = round((blended_median * 52) / yields["typical"])

    # 6. Ensemble blend
    estimated_value = None
    method = None
    methods_agree_pct = None
    methodology_steps: list[dict] = []

    if capital_value:
        methodology_steps.append({
            "step": 1,
            "label": "Council Valuation (CV)",
            "value": capital_value,
            "detail": f"Rated {valuation_date}" if valuation_date else "Valuation date unknown",
        })

    if hpi_adjusted:
        methodology_steps.append({
            "step": 2,
            "label": "HPI-adjusted value",
            "value": hpi_adjusted,
            "detail": f"CV × HPI ratio since {valuation_date}",
        })

    if yield_value:
        methodology_steps.append({
            "step": 3 if hpi_adjusted else 2,
            "label": "Yield inversion",
            "value": yield_value,
            "detail": f"${blended_median}/wk × 52 ÷ {yields['typical']*100:.1f}% yield",
        })

    if hpi_adjusted and yield_value:
        # Weight HPI more for newer CVs
        hpi_weight = max(0.3, 1.0 - unc)
        estimated_value = round(hpi_weight * hpi_adjusted + (1 - hpi_weight) * yield_value)
        methods_agree_pct = round(abs(hpi_adjusted - yield_value) / max(hpi_adjusted, 1) * 100, 1)
        method = "ensemble"
        methodology_steps.append({
            "step": len(methodology_steps) + 1,
            "label": "Blended estimate",
            "value": estimated_value,
            "detail": f"HPI weight {hpi_weight:.0%}, yield weight {1-hpi_weight:.0%}. Methods {'agree' if methods_agree_pct < 10 else 'diverge'} ({methods_agree_pct}%)",
        })
    elif hpi_adjusted:
        estimated_value = hpi_adjusted
        method = "hpi_only"
    elif yield_value:
        estimated_value = yield_value
        method = "yield_only"
    elif capital_value:
        estimated_value = capital_value
        method = "cv_only"

    if not estimated_value:
        return None

    # 7. Property-specific adjustments (same approach as rent advisor)
    adjustments: list[dict] = []
    factors_analysed = 0
    is_multi_unit = (prop["unit_count"] or 1) > 1 or bool(prop.get("unit_value"))

    # Bedrooms from user input or default
    bedrooms_num = 3  # default
    if bedrooms:
        bedrooms_str = bedrooms
        bedrooms_num = int(bedrooms.replace("+", ""))
    else:
        bedrooms_str = "3"
    baths_num = int(bathrooms.replace("+", "")) if bathrooms else 1
    rooms = bedrooms_num + baths_num

    # Size adjustment (skip for multi-unit)
    if prop.get("footprint_m2") and not is_multi_unit:
        factors_analysed += 1
        footprint = float(prop["footprint_m2"])
        typical = TYPICAL_FOOTPRINT.get("House", 140)
        if typical > 0:
            ratio = (footprint - typical) / typical
            adj_low = _clamp(ratio * 0.3, -0.03, 0.10)
            adj_high = _clamp(ratio * 0.5, -0.08, 0.20)
            if adj_low > adj_high:
                adj_low, adj_high = adj_high, adj_low
            if abs(adj_high) >= 0.01:
                adjustments.append({
                    "factor": "size",
                    "label": "Property size",
                    "pct_low": round(adj_low * 100, 1),
                    "pct_high": round(adj_high * 100, 1),
                    "dollar_low": round(estimated_value * adj_low),
                    "dollar_high": round(estimated_value * adj_high),
                    "reason": f"{round(footprint)}m² vs typical {typical}m²",
                    "category": "property",
                })

    # (Removed: quality-per-room-vs-SA2 block. The subject used actual
    # beds+baths as the denominator while the SA2 median used a hardcoded
    # 3 or 4, so the ratio was systematically biased by property size .
    # bigger homes flagged "Below-average build", smaller ones "Above-average".
    # The imp_ratio age/renovation proxy below covers the same
    # "above/below local norm" signal without the room-count asymmetry.)

    # Age / renovation proxy: improvements share of CV vs SA2 p25/p75.
    # Recent builds and renovated homes carry higher imp/CV than old or
    # unrenovated stock in the same SA2. Skipped when CV is stale (>36 months)
    # because the SA2 distribution then spans multiple reval cycles and the
    # comparison is no longer apples-to-apples. Skipped for units (land_value=0
    # makes the ratio degenerate at 1.0).
    if (
        not is_multi_unit
        and capital_value and capital_value > 0
        and improvements_value and improvements_value > 0
        and land_value and land_value > 0
        and (cv_age_months is None or cv_age_months <= 36)
    ):
        imp_ratio = improvements_value / capital_value
        cur = await conn.execute(
            """
            SELECT
                percentile_cont(0.25) WITHIN GROUP (
                    ORDER BY (cv.capital_value - cv.land_value)::float / cv.capital_value
                ) AS p25,
                percentile_cont(0.75) WITHIN GROUP (
                    ORDER BY (cv.capital_value - cv.land_value)::float / cv.capital_value
                ) AS p75,
                COUNT(*)::int AS n
            FROM council_valuations cv, sa2_boundaries sa2
            WHERE ST_Contains(sa2.geom, cv.geom)
              AND sa2.sa2_code = %s
              AND cv.capital_value > cv.land_value
              AND cv.land_value > 0
            """,
            [sa2["sa2_code"]],
        )
        sa2_imp_row = cur.fetchone()
        if (
            sa2_imp_row
            and sa2_imp_row.get("n")
            and sa2_imp_row["n"] >= 20
            and sa2_imp_row.get("p25") is not None
            and sa2_imp_row.get("p75") is not None
        ):
            p25 = float(sa2_imp_row["p25"])
            p75 = float(sa2_imp_row["p75"])
            if p75 > p25:
                if imp_ratio > p75:
                    factors_analysed += 1
                    adjustments.append({
                        "factor": "age_proxy",
                        "label": "Likely recent build or renovation",
                        "pct_low": 2.0,
                        "pct_high": 6.0,
                        "dollar_low": round(estimated_value * 0.02),
                        "dollar_high": round(estimated_value * 0.06),
                        "reason": f"Improvements {imp_ratio*100:.0f}% of CV (area p75 {p75*100:.0f}%)",
                        "category": "property",
                    })
                elif imp_ratio < p25:
                    factors_analysed += 1
                    adjustments.append({
                        "factor": "age_proxy",
                        "label": "Older or unrenovated stock",
                        "pct_low": -8.0,
                        "pct_high": -3.0,
                        "dollar_low": round(estimated_value * -0.08),
                        "dollar_high": round(estimated_value * -0.03),
                        "reason": f"Improvements {imp_ratio*100:.0f}% of CV (area p25 {p25*100:.0f}%)",
                        "category": "property",
                    })

    # Finish tier
    if finish_tier and finish_tier in FINISH_TIERS:
        factors_analysed += 1
        lo, hi = FINISH_TIERS[finish_tier]
        if abs(hi) >= 0.01 or abs(lo) >= 0.01:
            adjustments.append({
                "factor": "finish",
                "label": "Finish & condition",
                "pct_low": round(lo * 100, 1),
                "pct_high": round(hi * 100, 1),
                "dollar_low": round(estimated_value * lo),
                "dollar_high": round(estimated_value * hi),
                "reason": f"{finish_tier.capitalize()} tier",
                "category": "property",
            })

    # Bathrooms
    bath_key = (bedrooms_str, bathrooms) if bathrooms else None
    if bath_key and bath_key in BATHROOM_ADJ:
        factors_analysed += 1
        lo, hi = BATHROOM_ADJ[bath_key]
        if abs(lo) >= 0.005 or abs(hi) >= 0.005:
            typical_b = "1" if bedrooms_str in ("1", "2") else "2"
            if lo >= 0:
                reason = f"{bathrooms} bath. above typical ({typical_b}) for {bedrooms_str}-bed"
            else:
                reason = f"{bathrooms} bath. below typical ({typical_b}) for {bedrooms_str}-bed"
            adjustments.append({
                "factor": "bathrooms",
                "label": f"{bathrooms} bathroom{'s' if bathrooms != '1' else ''}",
                "pct_low": round(lo * 100, 1),
                "pct_high": round(hi * 100, 1),
                "dollar_low": round(estimated_value * lo),
                "dollar_high": round(estimated_value * hi),
                "reason": reason,
                "category": "property",
            })

    # Parking (multi-unit only)
    if has_parking is not None and is_multi_unit:
        factors_analysed += 1
        if has_parking:
            lo, hi = 0.01, 0.03
        else:
            lo, hi = -0.03, -0.01
        adjustments.append({
            "factor": "parking",
            "label": "Parking included" if has_parking else "No parking",
            "pct_low": round(lo * 100, 1),
            "pct_high": round(hi * 100, 1),
            "dollar_low": round(estimated_value * lo),
            "dollar_high": round(estimated_value * hi),
            "reason": "Dedicated parking adds value for units",
            "category": "property",
        })

    # 8. Apply adjustments to estimate
    product_low = 1.0
    product_high = 1.0
    for adj in adjustments:
        product_low *= 1 + adj["pct_low"] / 100
        product_high *= 1 + adj["pct_high"] / 100

    # Inner band: ±1% for natural variance
    adjusted_value = estimated_value
    band_low = round(estimated_value * min(product_low, product_high) * 0.99)
    band_high = round(estimated_value * max(product_low, product_high) * 1.01)

    # Add final adjusted step
    if adjustments:
        methodology_steps.append({
            "step": len(methodology_steps) + 1,
            "label": "After property adjustments",
            "value": round(estimated_value * (product_low + product_high) / 2),
            "detail": f"{len(adjustments)} adjustment{'s' if len(adjustments) != 1 else ''} applied",
        })

    # Outer band: ±3%
    band_low_outer = round(band_low * 0.97)
    band_high_outer = round(band_high * 1.03)

    # 9. Hazard cost flags (NOT percentage adjustments)
    hazards = await _detect_hazards(conn, address_id)
    detected_keys: set[str] = set()

    if hazards.get("flood_zone"):
        detected_keys.add("flood")
    if hazards.get("liquefaction") and hazards["liquefaction"] in ("High", "Very High"):
        detected_keys.add("liquefaction")
    if hazards.get("tsunami_zone"):
        detected_keys.add("tsunami")
    if hazards.get("epb_count") and hazards["epb_count"] > 0:
        detected_keys.add("epb")
    if hazards.get("contam_count") and hazards["contam_count"] > 0:
        detected_keys.add("contamination")
    if hazards.get("on_overland_flow"):
        detected_keys.add("overland_flow")
    if hazards.get("slope_failure") and str(hazards["slope_failure"]).startswith("5"):
        detected_keys.add("slope_failure")
    if hazards.get("noise_db") and hazards["noise_db"] >= 65:
        detected_keys.add("noise_high")
    if hazards.get("aircraft_noise_dba") and hazards["aircraft_noise_dba"] >= 60:
        detected_keys.add("aircraft_noise")
    wz = hazards.get("wind_zone") or ""
    if any(wz.startswith(p) for p in ("VH", "EH", "SED", "Very high", "High Risk")):
        detected_keys.add("wind_high")
    if hazards.get("coastal_erosion_nearby"):
        detected_keys.add("coastal_erosion")

    # Build cost flags
    hazard_cost_flags: list[dict] = []
    total_insurance_uplift_low = 0
    total_insurance_uplift_high = 0

    for key in sorted(detected_keys):
        cfg = HAZARD_COST_FLAGS.get(key)
        if not cfg:
            continue

        uplift_low, uplift_high = cfg["insurance_uplift_pct"]
        total_insurance_uplift_low += uplift_low
        total_insurance_uplift_high += uplift_high

        flag: dict = {
            "hazard": key,
            "label": cfg["label"],
            "insurance_uplift_pct_low": uplift_low,
            "insurance_uplift_pct_high": uplift_high,
            "description": cfg["description"],
            "action": cfg["action"],
        }

        # EPB strengthening cost estimate
        if key == "epb" and prop.get("footprint_m2"):
            sqm = float(prop["footprint_m2"])
            lo_cost = round(sqm * 800)
            hi_cost = round(sqm * 3000)
            flag["strengthening_cost_low"] = lo_cost
            flag["strengthening_cost_high"] = hi_cost

        hazard_cost_flags.append(flag)

    # 10. Ownership costs
    improvements = improvements_value or (capital_value - (land_value or 0)) if capital_value else 0
    base_insurance_annual = round(improvements * BASE_INSURANCE_PCT) if improvements > 0 else 0

    insurance_annual_low = round(base_insurance_annual * (1 + total_insurance_uplift_low / 100))
    insurance_annual_high = round(base_insurance_annual * (1 + total_insurance_uplift_high / 100))

    rates_pct = RATES_PCT_OF_CV.get(region, RATES_PCT_OF_CV["DEFAULT"])
    rates_annual = round(capital_value * rates_pct) if capital_value else None

    ownership_costs = {
        "rates_annual": rates_annual,
        "insurance_annual_low": insurance_annual_low,
        "insurance_annual_high": insurance_annual_high,
        "insurance_base": base_insurance_annual,
        "insurance_hazard_uplift_pct": (total_insurance_uplift_low, total_insurance_uplift_high),
        "body_corp_annual": 4200 if is_multi_unit else None,  # ~$350/mo default
    }

    # 11. Asking price verdict
    asking_verdict = None
    asking_diff_pct = None
    if asking_price:
        mid_band = (band_low + band_high) / 2
        asking_diff_pct = round((asking_price - mid_band) / mid_band * 100, 1)

        if asking_price < band_low_outer:
            asking_verdict = "well-below"
        elif asking_price < band_low:
            asking_verdict = "below"
        elif asking_price <= band_high:
            asking_verdict = "fair"
        elif asking_price <= band_high_outer:
            asking_verdict = "above"
        else:
            asking_verdict = "well-above"

    # 12. Location adjustments (for context, not value adjustment)
    loc = await _get_location_metrics(conn, address_id, sa2["ta_name"])
    area_context = await _get_area_context(conn, sa2["sa2_code"], sa2["ta_name"])

    # 13. Confidence
    stars = market_confidence_stars(bond_count, cv_age_months, methods_agree_pct)

    # Sort adjustments: property features by magnitude
    adjustments.sort(key=lambda a: -abs(a["pct_high"]))

    return {
        "estimated_value": round((band_low + band_high) / 2),
        "band_low": band_low,
        "band_high": band_high,
        "band_low_outer": band_low_outer,
        "band_high_outer": band_high_outer,
        "cv": capital_value,
        "cv_date": str(valuation_date) if valuation_date else None,
        "cv_age_months": cv_age_months,
        "hpi_adjusted": hpi_adjusted,
        "yield_inversion": yield_value,
        "method": method,
        "methods_agree_pct": methods_agree_pct,
        "methodology_steps": methodology_steps,
        "adjustments": adjustments,
        "hazard_cost_flags": hazard_cost_flags,
        "hazard_count": len(detected_keys),
        "ownership_costs": ownership_costs,
        "asking_price": asking_price,
        "asking_verdict": asking_verdict,
        "asking_diff_pct": asking_diff_pct,
        "area_context": area_context,
        "factors_analysed": factors_analysed,
        "confidence": stars,
        "bond_count": bond_count,
        "sa2_name": sa2["sa2_name"],
        "ta_name": sa2["ta_name"],
        "is_multi_unit": is_multi_unit,
        "disclaimer": (
            "This estimate is based on publicly available government data including "
            "council rating valuations, MBIE bond records, and the RBNZ House Price "
            "Index. It is not a registered valuation, appraisal, or market assessment. "
            "Individual property values depend on specific features, condition, market "
            "timing, and other factors this estimate cannot account for."
        ),
    }
