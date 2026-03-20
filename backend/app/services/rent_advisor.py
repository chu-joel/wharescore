# backend/app/services/rent_advisor.py
"""
Rent advisor engine: applies property-specific adjustments to SA2 median rent
to give personalised "is my rent fair?" advice.
"""
from __future__ import annotations

from .market import blend_sa2_tla, market_confidence_stars

# --- Typical footprints by dwelling type (m²) ---
TYPICAL_FOOTPRINT = {
    "House": 140,
    "Flat": 90,
    "Apartment": 65,
    "Room": 40,
}

# --- Typical improvements ratio (improvements_value / capital_value) ---
TYPICAL_IMP_RATIO = 0.45

# --- Finish tier multipliers ---
FINISH_TIERS = {
    "basic": -0.10,
    "standard": -0.03,
    "modern": 0.0,
    "premium": 0.08,
    "luxury": 0.15,
}

FINISH_DESCRIPTIONS = {
    "basic": "Dated kitchen/bathroom, older carpets, basic fittings. Functional but showing age.",
    "standard": "Clean and tidy, no frills. Standard fittings, adequate storage.",
    "modern": "Recently renovated or built. Good fixtures, modern kitchen/bathroom.",
    "premium": "High-end finishes, designer kitchen, quality materials throughout.",
    "luxury": "Architect-designed, top-of-the-line appliances, exceptional fit-out.",
}

# --- Bathroom multipliers ---
BATHROOM_ADJ = {"1": 0.0, "2": 0.05, "3+": 0.08}


async def get_sa2_rental_baseline(
    conn, sa2_code: str, ta_name: str, dwelling_type: str, bedrooms: str
) -> dict | None:
    """Shared helper: get SA2 median rent with TLA fallback.
    Returns {median, bond_count, lower_quartile, upper_quartile, sigma, data_source} or None."""

    bonds_query = """
        SELECT bd.median_rent, bd.lower_quartile_rent, bd.upper_quartile_rent,
               bd.active_bonds, bd.log_std_dev_weekly_rent
        FROM bonds_detailed bd
        WHERE bd.location_id = %s
    """
    params: list = [sa2_code]
    if dwelling_type != "ALL":
        bonds_query += " AND bd.dwelling_type = %s"
        params.append(dwelling_type)
    if bedrooms != "ALL":
        bonds_query += " AND bd.number_of_beds = %s"
        params.append(bedrooms)
    bonds_query += " ORDER BY bd.time_frame DESC LIMIT 1"

    cur = await conn.execute(bonds_query, params)
    bonds = cur.fetchone()

    sa2_median = float(bonds["median_rent"]) if bonds and bonds["median_rent"] else None
    sa2_bond_count = bonds["active_bonds"] if bonds else 0
    blended_median = sa2_median
    data_source = "sa2"

    if not bonds or sa2_bond_count < 5:
        cur = await conn.execute(
            "SELECT median_rent FROM bonds_tla WHERE location = %s ORDER BY time_frame DESC LIMIT 1",
            [ta_name],
        )
        tla = cur.fetchone()
        if tla:
            tla_median = float(tla["median_rent"]) if tla["median_rent"] else None
            if sa2_median and sa2_bond_count > 0 and tla_median:
                blended_median = blend_sa2_tla(sa2_median, tla_median, sa2_bond_count)
                data_source = "sa2_tla_blend"
            elif tla_median:
                blended_median = tla_median
                data_source = "tla_fallback"

    if blended_median is None:
        return None

    return {
        "median": blended_median,
        "bond_count": sa2_bond_count,
        "lower_quartile": float(bonds["lower_quartile_rent"]) if bonds and bonds.get("lower_quartile_rent") else None,
        "upper_quartile": float(bonds["upper_quartile_rent"]) if bonds and bonds.get("upper_quartile_rent") else None,
        "sigma": float(bonds["log_std_dev_weekly_rent"]) if bonds and bonds.get("log_std_dev_weekly_rent") else None,
        "data_source": data_source,
    }


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


async def compute_rent_advice(
    conn,
    address_id: int,
    weekly_rent: int,
    dwelling_type: str,
    bedrooms: str,
    finish_tier: str | None = None,
    bathrooms: str | None = None,
    has_parking: bool | None = None,
    has_insulation: bool | None = None,
) -> dict | None:
    """Main rent advisor computation. Returns full advice response or None."""

    # 1. Get SA2 + TA for this address
    cur = await conn.execute(
        """
        SELECT sa2.sa2_code, sa2.sa2_name, sa2.ta_name
        FROM addresses a
        JOIN LATERAL (
            SELECT sa2_code, sa2_name, ta_name
            FROM sa2_boundaries WHERE ST_Within(a.geom, geom) LIMIT 1
        ) sa2 ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    sa2 = cur.fetchone()
    if not sa2:
        return None

    # 2. Get baseline median
    baseline = await get_sa2_rental_baseline(
        conn, sa2["sa2_code"], sa2["ta_name"], dwelling_type, bedrooms
    )
    if not baseline:
        return None

    raw_median = baseline["median"]
    adjustments: list[dict] = []

    # 3. Size adjustment (from DB)
    cur = await conn.execute(
        """
        SELECT pd.footprint_m2, pd.unit_count, pd.is_multi_unit
        FROM (
            SELECT round(ST_Area(b.geom::geography)::numeric, 1) AS footprint_m2,
                   (SELECT COUNT(*) FROM addresses a2
                    WHERE a2.gd2000_xcoord = a.gd2000_xcoord
                      AND a2.gd2000_ycoord = a.gd2000_ycoord
                      AND a2.address_lifecycle = 'Current') AS unit_count,
                   CASE WHEN EXISTS(
                       SELECT 1 FROM addresses a2
                       WHERE a2.gd2000_xcoord = a.gd2000_xcoord
                         AND a2.gd2000_ycoord = a.gd2000_ycoord
                         AND a2.address_lifecycle = 'Current'
                         AND a2.address_id != a.address_id
                   ) THEN true ELSE false END AS is_multi_unit
            FROM addresses a
            LEFT JOIN building_outlines b
              ON b.geom && ST_Expand(a.geom, 0.0005)
              AND ST_Contains(b.geom, a.geom)
            WHERE a.address_id = %s
            LIMIT 1
        ) pd
        """,
        [address_id],
    )
    prop_data = cur.fetchone()

    if prop_data and prop_data["footprint_m2"]:
        footprint = float(prop_data["footprint_m2"])
        unit_count = prop_data["unit_count"] or 1
        if prop_data["is_multi_unit"] and unit_count > 1:
            footprint = footprint / unit_count

        typical = TYPICAL_FOOTPRINT.get(dwelling_type, 140)
        if typical > 0:
            size_adj = _clamp((footprint - typical) / typical * 0.5, -0.15, 0.20)
            if abs(size_adj) >= 0.01:
                adjustments.append({
                    "factor": "size",
                    "label": "Property size",
                    "pct": round(size_adj * 100, 1),
                    "dollar": round(raw_median * size_adj),
                    "reason": f"{round(footprint)}m² vs typical {typical}m²",
                })

    # 4. Quality adjustment (silent, from DB)
    cur = await conn.execute(
        """
        SELECT cv.capital_value, cv.land_value
        FROM council_valuations cv, addresses a
        WHERE a.address_id = %s
          AND ST_Contains(cv.geom, a.geom)
        LIMIT 1
        """,
        [address_id],
    )
    cv = cur.fetchone()
    if cv and cv["capital_value"] and cv["land_value"]:
        cap = float(cv["capital_value"])
        land = float(cv["land_value"])
        if cap > 0:
            imp_ratio = (cap - land) / cap
            quality_adj = _clamp((imp_ratio - TYPICAL_IMP_RATIO) / TYPICAL_IMP_RATIO * 0.3, -0.10, 0.15)
            if abs(quality_adj) >= 0.01:
                adjustments.append({
                    "factor": "quality",
                    "label": "Building quality",
                    "pct": round(quality_adj * 100, 1),
                    "dollar": round(raw_median * quality_adj),
                    "reason": "Based on council improvement-to-capital ratio",
                })

    # 5. Finish tier (user input)
    if finish_tier and finish_tier in FINISH_TIERS:
        tier_adj = FINISH_TIERS[finish_tier]
        if abs(tier_adj) >= 0.01:
            adjustments.append({
                "factor": "finish",
                "label": "Finish & condition",
                "pct": round(tier_adj * 100, 1),
                "dollar": round(raw_median * tier_adj),
                "reason": f"{finish_tier.capitalize()} tier",
            })

    # 6. Bathrooms (user input)
    if bathrooms and bathrooms in BATHROOM_ADJ:
        bath_adj = BATHROOM_ADJ[bathrooms]
        if bath_adj > 0:
            adjustments.append({
                "factor": "bathrooms",
                "label": "Bathrooms",
                "pct": round(bath_adj * 100, 1),
                "dollar": round(raw_median * bath_adj),
                "reason": f"{bathrooms} bathroom{'s' if bathrooms != '1' else ''}",
            })

    # 7. Parking (user input)
    if has_parking is not None and dwelling_type in ("Flat", "Apartment"):
        park_adj = 0.03 if has_parking else -0.03
        adjustments.append({
            "factor": "parking",
            "label": "Parking",
            "pct": round(park_adj * 100, 1),
            "dollar": round(raw_median * park_adj),
            "reason": "Parking included" if has_parking else "No parking",
        })

    # 8. Insulation (user input)
    if has_insulation is not None:
        ins_adj = 0.02 if has_insulation else -0.03
        adjustments.append({
            "factor": "insulation",
            "label": "Insulation",
            "pct": round(ins_adj * 100, 1),
            "dollar": round(raw_median * ins_adj),
            "reason": "Insulated" if has_insulation else "Not insulated",
        })

    # 9. Compute adjusted median
    product = 1.0
    for adj in adjustments:
        product *= 1 + adj["pct"] / 100
    adjusted_median = round(raw_median * product)

    # 10. Verdict
    diff_pct = (weekly_rent - adjusted_median) / adjusted_median * 100 if adjusted_median > 0 else 0
    if diff_pct < -10:
        verdict = "below-market"
    elif diff_pct <= 5:
        verdict = "fair"
    elif diff_pct <= 15:
        verdict = "slightly-high"
    elif diff_pct <= 25:
        verdict = "high"
    else:
        verdict = "very-high"

    # 11. Advice lines
    advice_lines = _generate_advice(verdict, diff_pct, weekly_rent, adjusted_median, raw_median, adjustments)

    # 12. Confidence
    stars = market_confidence_stars(baseline["bond_count"], None, None)

    return {
        "verdict": verdict,
        "adjusted_median": adjusted_median,
        "raw_median": round(raw_median),
        "your_rent": weekly_rent,
        "difference_pct": round(diff_pct, 1),
        "adjustments": adjustments,
        "advice_lines": advice_lines,
        "confidence": stars,
        "bond_count": baseline["bond_count"],
        "data_source": baseline["data_source"],
        "disclaimer": (
            "This estimate is based on MBIE bond records and council valuation data. "
            "It is not a registered valuation or market assessment. Actual market rents "
            "depend on specific property features, condition, and local demand."
        ),
    }


def _generate_advice(
    verdict: str,
    diff_pct: float,
    weekly_rent: int,
    adjusted_median: int,
    raw_median: int,
    adjustments: list[dict],
) -> list[str]:
    """Generate template-based advice lines."""
    lines: list[str] = []

    # Top 2 adjustments by magnitude
    sorted_adj = sorted(adjustments, key=lambda a: abs(a["pct"]), reverse=True)[:2]

    if verdict == "below-market":
        lines.append(
            f"Your rent of ${weekly_rent}/wk is {abs(round(diff_pct))}% below our adjusted estimate "
            f"of ${adjusted_median}/wk — you're getting good value."
        )
    elif verdict == "fair":
        lines.append(
            f"Your rent of ${weekly_rent}/wk is within {abs(round(diff_pct))}% of our adjusted estimate "
            f"of ${adjusted_median}/wk — this looks reasonable for the property."
        )
    elif verdict == "slightly-high":
        lines.append(
            f"Your rent of ${weekly_rent}/wk is {round(diff_pct)}% above our adjusted estimate "
            f"of ${adjusted_median}/wk. It's on the higher side but not unusual."
        )
    elif verdict in ("high", "very-high"):
        lines.append(
            f"Your rent of ${weekly_rent}/wk is {round(diff_pct)}% above our adjusted estimate "
            f"of ${adjusted_median}/wk. This is significantly above what we'd expect."
        )

    # Explain top adjustments
    if sorted_adj:
        parts = []
        for adj in sorted_adj:
            sign = "+" if adj["pct"] > 0 else ""
            parts.append(f"{adj['label'].lower()} ({sign}{adj['pct']}%, {sign}${adj['dollar']}/wk)")
        lines.append(f"Key factors: {', '.join(parts)}.")

    # Tenancy Services link for high verdicts
    if verdict in ("high", "very-high"):
        lines.append(
            "You may want to check Tenancy Services (tenancy.govt.nz) for guidance on "
            "market rent reviews and your rights as a tenant."
        )

    return lines
