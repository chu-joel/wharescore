# backend/app/services/report_html.py
"""
Premium property report renderer.

Orchestrates: insight rule engine → lifestyle fit engine → Jinja2 template.
Used by the /export/pdf endpoint — browser renders and prints to PDF.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader

from .map_renderer import generate_map_image

logger = logging.getLogger(__name__)


# =============================================================================
# Jinja2 Environment
# =============================================================================

def _get_env() -> Environment:
    template_dir = Path(__file__).parent.parent / "templates" / "report"
    return Environment(loader=FileSystemLoader(str(template_dir)), autoescape=True, trim_blocks=True, lstrip_blocks=True)


# =============================================================================
# ANZECC Category Explanations
# =============================================================================

ANZECC_EXPLANATIONS: dict[str, str] = {
    "A": "confirmed contamination requiring investigation/remediation",
    "B": "potentially contaminated — likely historic industrial or commercial use",
    "C": "possibly affected — land use history suggests possible contamination",
    "D": "unlikely to be contaminated but included in register precautionarily",
}


# =============================================================================
# Hazard Humanizer Lookups
# =============================================================================

WIND_ZONE_LABELS: dict[str, tuple[str, str]] = {
    # key → (human label, risk_class)
    "EH":  ("Extra High (EH) — most exposed NZ wind classification", "warn"),
    "SED": ("Semi-Exposed Design (SED) — very high wind exposure area", "warn"),
    "VH":  ("Very High — significantly above average wind exposure", "warn"),
    "H":   ("High — above average wind exposure", "info"),
    "M":   ("Medium — typical sheltered exposure", "ok"),
    "L":   ("Low — well-sheltered location", "ok"),
}

LIQUEFACTION_LABELS: dict[str, tuple[str, str]] = {
    "very high": ("Very High — ground highly likely to deform in a major earthquake", "warn"),
    "high":      ("High — significant liquefaction potential", "warn"),
    "moderate":  ("Moderate — partial settlement possible in significant seismic event", "info"),
    "low":       ("Low — limited liquefaction risk", "ok"),
    "very low":  ("Very Low — minimal liquefaction risk", "ok"),
    "none":      ("None — outside known liquefaction zone", "ok"),
    "not applicable": ("Not applicable for this land type", "ok"),
}

WILDFIRE_TREND_LABELS: dict[str, tuple[str, str]] = {
    "very likely increasing": ("Very likely increasing — strong upward trend in fire danger days", "warn"),
    "likely increasing":      ("Likely increasing — moderate upward trend", "info"),
    "unclear":                ("Unclear — no significant trend detected", "info"),
    "likely decreasing":      ("Likely decreasing — fire danger trending down", "ok"),
    "very likely decreasing": ("Very likely decreasing — significant reduction in fire danger days", "ok"),
}

COASTAL_EROSION_LABELS: dict[str, tuple[str, str]] = {
    "extreme": ("Extreme — high likelihood of coastal retreat within 50 years", "warn"),
    "high":    ("High erosion risk", "warn"),
    "medium":  ("Medium erosion risk", "info"),
    "low":     ("Low erosion risk", "ok"),
    "stable":  ("Stable coastline — low erosion risk", "ok"),
}

TSUNAMI_CLASS_LABELS: dict[int, tuple[str, str]] = {
    3: ("Zone 3 — highest local government warning tier (evacuate immediately)", "warn"),
    2: ("Zone 2 — moderate risk, evacuation area for distant events", "info"),
    1: ("Zone 1 — low probability, mainly coastal flooding risk", "info"),
}


def _humanize_wind(raw: str | None) -> tuple[str, str]:
    if not raw:
        return "No wind zone data", "none"
    key = str(raw).strip().upper()
    return WIND_ZONE_LABELS.get(key, (f"{raw} wind zone", "info"))


def _humanize_liquefaction(raw: str | None) -> tuple[str, str]:
    if not raw:
        return "No liquefaction data", "none"
    key = str(raw).strip().lower()
    for k, v in LIQUEFACTION_LABELS.items():
        if k in key:
            return v
    return (f"{raw}", "info")


def _humanize_wildfire_trend(raw: str | None) -> tuple[str, str]:
    if not raw:
        return "No wildfire trend data", "none"
    key = str(raw).strip().lower()
    for k, v in WILDFIRE_TREND_LABELS.items():
        if k in key:
            return v
    return (f"{raw}", "info")


# =============================================================================
# Noise Context String
# =============================================================================

def noise_context(db: float | None) -> str:
    if db is None:
        return ""
    if db >= 70:
        return "very loud street — comparable to a loud restaurant or busy factory floor"
    if db >= 65:
        return "busy restaurant or open-plan office"
    if db >= 60:
        return "conversational speech at close range"
    if db >= 55:
        return "moderate — quiet office environment"
    if db >= 50:
        return "quiet residential hum"
    return "very quiet"


# =============================================================================
# Humanized Hazard Rows (comprehensive — all 8 hazards always shown)
# =============================================================================

def build_humanized_hazards(hazards: dict) -> list[dict]:
    """Return a list of 9 standardised hazard row dicts for the template table.
    Every hazard is always listed — absent data shown as 'Not detected / No data'.
    Each dict: {label, status, detail, risk_class, detected}
    """
    rows: list[dict] = []

    # 1. Flood
    flood_raw = hazards.get("flood")
    flood_str = str(flood_raw or "").lower()
    if "1%" in flood_str or "100-year" in flood_str or "100 year" in flood_str:
        rows.append({"label": "Flood Zone", "status": "1-in-100-year flood zone",
                     "detail": "1% annual chance of inundation. Request LIM and check floor level elevation.",
                     "risk_class": "warn", "detected": True})
    elif "0.2%" in flood_str or "430" in flood_str:
        rows.append({"label": "Flood Zone", "status": "Low-probability flood zone (1-in-430 years)",
                     "detail": "Mainly affects mortgage eligibility rather than day-to-day risk.",
                     "risk_class": "info", "detected": True})
    elif flood_raw and str(flood_raw).strip() not in ("", "None", "0"):
        rows.append({"label": "Flood Zone", "status": str(flood_raw),
                     "detail": "Review LIM for flood hazard details.",
                     "risk_class": "info", "detected": True})
    else:
        rows.append({"label": "Flood Zone", "status": "Outside mapped flood zones",
                     "detail": "Property not within any GWRC-mapped flood hazard zone.",
                     "risk_class": "ok", "detected": False})

    # 2. Liquefaction
    liq_raw = hazards.get("liquefaction")
    if liq_raw and str(liq_raw).strip() not in ("", "None", "0"):
        status, risk_class = _humanize_liquefaction(str(liq_raw))
        detail_map = {
            "warn": "Inspect foundations carefully. Consider requesting a geotechnical report.",
            "info": "Standard building inspection should note any existing foundation movement cracks.",
            "ok":   "Low geological risk from earthquake-induced ground movement.",
        }
        rows.append({"label": "Liquefaction", "status": status,
                     "detail": detail_map.get(risk_class, ""), "risk_class": risk_class, "detected": True})
    else:
        rows.append({"label": "Liquefaction", "status": "No liquefaction data",
                     "detail": "Liquefaction mapping not available for this location.",
                     "risk_class": "none", "detected": False})

    # 3. Wind Zone
    wind_raw = hazards.get("wind_zone")
    if wind_raw and str(wind_raw).strip() not in ("", "None"):
        status, risk_class = _humanize_wind(str(wind_raw))
        detail_map = {
            "warn": "Confirm roof fastening meets NZS 3604 for wind zone. Expect higher heating bills from draughts.",
            "info": "Above-average wind exposure — standard construction applies.",
            "ok":   "Sheltered location — no special wind zone requirements.",
        }
        rows.append({"label": "Wind Zone", "status": status,
                     "detail": detail_map.get(risk_class, ""), "risk_class": risk_class, "detected": True})
    else:
        rows.append({"label": "Wind Zone", "status": "No wind zone data",
                     "detail": "", "risk_class": "none", "detected": False})

    # 4. Tsunami
    tz_class = hazards.get("tsunami_zone_class")
    if tz_class is not None:
        try:
            tz_int = int(tz_class)
        except (TypeError, ValueError):
            tz_int = 0
        if tz_int > 0:
            status, risk_class = TSUNAMI_CLASS_LABELS.get(tz_int,
                (f"Tsunami Zone {tz_int}", "info"))
            detail = "Identify your inland evacuation route before occupying." if risk_class == "warn" else ""
            rows.append({"label": "Tsunami", "status": status,
                         "detail": detail, "risk_class": risk_class, "detected": True})
        else:
            rows.append({"label": "Tsunami", "status": "Outside tsunami inundation zone",
                         "detail": "", "risk_class": "ok", "detected": False})
    else:
        rows.append({"label": "Tsunami", "status": "No tsunami zone data",
                     "detail": "", "risk_class": "none", "detected": False})

    # 5. Wildfire
    wf_days = hazards.get("wildfire_vhe_days")
    wf_trend = hazards.get("wildfire_trend")
    if wf_days is not None or wf_trend is not None:
        days_str = f"{float(wf_days):.0f} Very High/Extreme fire danger days/yr" if wf_days is not None else ""
        trend_human, trend_class = _humanize_wildfire_trend(str(wf_trend) if wf_trend else None)
        if wf_days is not None:
            try:
                days_f = float(wf_days)
            except (TypeError, ValueError):
                days_f = 0
            risk_class = "warn" if days_f >= 15 else ("info" if days_f >= 8 else "ok")
        else:
            risk_class = trend_class
        status_parts = []
        if days_str:
            status_parts.append(days_str)
        if wf_trend:
            status_parts.append(f"Trend: {trend_human}")
        detail = "Review home and contents insurance for wildfire. Consider vegetation buffers." if risk_class == "warn" else ""
        rows.append({"label": "Wildfire", "status": " · ".join(status_parts) if status_parts else str(wf_trend or wf_days),
                     "detail": detail, "risk_class": risk_class, "detected": True})
    else:
        rows.append({"label": "Wildfire", "status": "No wildfire data",
                     "detail": "", "risk_class": "none", "detected": False})

    # Landslides (GNS NZLD)
    ls_count = hazards.get("landslide_count_500m") or 0
    ls_nearest = hazards.get("landslide_nearest") or {}
    if ls_count > 0:
        trigger = ls_nearest.get("trigger", "unknown") if isinstance(ls_nearest, dict) else "unknown"
        dist = ls_nearest.get("distance_m", "?") if isinstance(ls_nearest, dict) else "?"
        rows.append({
            "label": "Landslide History",
            "status": f"{ls_count} documented event{'s' if ls_count != 1 else ''} within 500m",
            "detail": f"Nearest: {dist}m away ({trigger}-triggered)" if dist != "?" else "",
            "risk_class": "warn" if ls_count < 3 else "warn",
        })
    elif hazards.get("landslide_in_area"):
        rows.append({
            "label": "Landslide History",
            "status": "Property within mapped landslide area",
            "detail": "GNS Science has mapped a historical landslide boundary intersecting this property",
            "risk_class": "warn",
        })
    else:
        rows.append({
            "label": "Landslide History",
            "status": "No documented landslides within 500m",
            "detail": "",
            "risk_class": "ok",
        })

    # 6. Coastal Erosion
    erosion_raw = hazards.get("coastal_erosion")
    if erosion_raw and str(erosion_raw).strip() not in ("", "None", "0"):
        key = str(erosion_raw).strip().lower()
        for k, (status, risk_class) in COASTAL_EROSION_LABELS.items():
            if k in key:
                break
        else:
            status, risk_class = str(erosion_raw), "info"
        detail = "Review NZCOASTS erosion maps. May affect insurance and future consents." if "warn" in risk_class else ""
        rows.append({"label": "Coastal Erosion", "status": status,
                     "detail": detail, "risk_class": risk_class, "detected": True})
    else:
        rows.append({"label": "Coastal Erosion", "status": "Not in a mapped erosion-risk zone",
                     "detail": "", "risk_class": "ok", "detected": False})

    # 7. Earthquakes (30km count)
    eq_count = hazards.get("earthquake_count_30km")
    if eq_count is not None:
        try:
            eq_int = int(eq_count)
        except (TypeError, ValueError):
            eq_int = 0
        if eq_int >= 30:
            risk_class = "warn"
            label_desc = "very active seismic area"
        elif eq_int >= 15:
            risk_class = "info"
            label_desc = "moderately active seismic area"
        elif eq_int >= 5:
            risk_class = "info"
            label_desc = "occasional seismic activity"
        else:
            risk_class = "ok"
            label_desc = "low seismic activity"
        rows.append({
            "label": "Earthquakes (30km, 10yr)",
            "status": f"{eq_int} M4+ earthquakes recorded — {label_desc}",
            "detail": "Review earthquake strengthening for any pre-1976 masonry structures." if risk_class in ("warn", "info") else "",
            "risk_class": risk_class,
            "detected": True,
        })
    else:
        rows.append({"label": "Earthquakes (30km, 10yr)", "status": "No earthquake data",
                     "detail": "", "risk_class": "none", "detected": False})

    # 8. Earthquake-Prone Buildings (300m)
    epb_count = hazards.get("epb_count_300m")
    if epb_count is not None:
        try:
            epb_int = int(epb_count)
        except (TypeError, ValueError):
            epb_int = 0
        if epb_int >= 5:
            risk_class = "warn"
            context = "This is a concentration of older building stock — walk the area and note building age and condition."
        elif epb_int >= 1:
            risk_class = "info"
            context = "Check the MBIE EPB register to see if the subject property itself is listed."
        else:
            risk_class = "ok"
            context = "No earthquake-prone buildings recorded within 300m."
        rows.append({
            "label": "Earthquake-Prone Buildings (300m)",
            "status": f"{epb_int} building{'s' if epb_int != 1 else ''} on the MBIE EPB register within 300m",
            "detail": context,
            "risk_class": risk_class if epb_int > 0 else "ok",
            "detected": epb_int > 0,
        })
    else:
        rows.append({"label": "Earthquake-Prone Buildings (300m)", "status": "No EPB data",
                     "detail": "", "risk_class": "none", "detected": False})

    # 9. Slope Failure / Landslide Susceptibility
    sf_raw = hazards.get("slope_failure")
    if sf_raw and str(sf_raw).strip() not in ("", "None", "0"):
        sf_str = str(sf_raw).strip().lower()
        if "very high" in sf_str:
            rows.append({"label": "Slope Stability", "status": "Very High landslide susceptibility",
                         "detail": "This property sits in a zone where earthquake-induced slope failure is very likely. "
                                   "Commission a geotechnical assessment before purchase. Check for retaining wall condition, "
                                   "drainage adequacy, and signs of historic ground movement (cracked paths, leaning fences, "
                                   "bowing retaining walls).",
                         "risk_class": "warn", "detected": True})
        elif "high" in sf_str:
            rows.append({"label": "Slope Stability", "status": "High landslide susceptibility",
                         "detail": "Elevated risk of slope failure during earthquakes. Inspect retaining walls, "
                                   "check for ground movement signs (cracked concrete, shifted fence lines). "
                                   "Consider geotechnical report — especially if hillside property.",
                         "risk_class": "warn", "detected": True})
        elif "medium" in sf_str:
            rows.append({"label": "Slope Stability", "status": "Medium landslide susceptibility",
                         "detail": "Moderate slope failure risk. During building inspection, ask about drainage, "
                                   "retaining wall maintenance, and any history of ground movement on the property.",
                         "risk_class": "info", "detected": True})
        elif "low" in sf_str and "very" not in sf_str:
            rows.append({"label": "Slope Stability", "status": "Low landslide susceptibility",
                         "detail": "Below-average slope failure risk for this region.",
                         "risk_class": "ok", "detected": True})
        else:
            rows.append({"label": "Slope Stability", "status": "Very Low landslide susceptibility",
                         "detail": "Minimal slope failure risk — flat or gently sloping terrain.",
                         "risk_class": "ok", "detected": True})
    else:
        rows.append({"label": "Slope Stability", "status": "No slope failure data",
                     "detail": "Slope stability mapping not available for this location.",
                     "risk_class": "none", "detected": False})

    return rows


def build_exec_summary_fallback(report: dict, insights: dict) -> str:
    """Python-generated executive summary used when AI is unavailable."""
    addr    = report.get("address") or {}
    scores  = report.get("scores") or {}
    market  = report.get("market") or {}
    prop    = report.get("property") or {}
    live    = report.get("liveability") or {}

    composite = scores.get("composite")
    rating_obj = scores.get("rating") or {}
    rating = rating_obj.get("label", "Unknown") if isinstance(rating_obj, dict) else "Unknown"
    suburb = addr.get("suburb") or addr.get("sa2_name") or ""
    city   = addr.get("city") or ""

    parts: list[str] = []

    # Lead: score
    if composite is not None:
        level_context = {
            "Very Low":  "an excellent risk profile",
            "Low":       "a low-risk profile",
            "Moderate":  "a moderate risk profile — some issues warrant attention",
            "High":      "a high-risk profile — multiple issues require careful review",
            "Very High": "a very high risk profile — significant due diligence required",
        }.get(rating, "a risk profile that warrants review")
        loc_str = f" in {suburb}" if suburb else ""
        parts.append(
            f"This property{loc_str} scores {composite:.0f}/100 overall ({rating}), indicating {level_context}."
        )

    # Worst category
    cats = scores.get("categories") or {}
    worst_name, worst_score = None, 0.0
    for name, data in cats.items():
        s = data.get("score") if isinstance(data, dict) else (data if isinstance(data, (int, float)) else None)
        if s is not None and s > worst_score:
            worst_score = s
            worst_name = name
    if worst_name and worst_score >= 50:
        parts.append(
            f"{worst_name.replace('_',' ').title()} is the primary concern at {worst_score:.0f}/100."
        )

    # Warn count
    warn_count = sum(len([i for i in v if i.get("level") == "warn"]) for v in insights.values())
    if warn_count >= 3:
        parts.append(f"{warn_count} issues were flagged across hazards, environment, and planning — review each section carefully.")
    elif warn_count > 0:
        parts.append(f"{warn_count} issue{'s' if warn_count != 1 else ''} flagged — see highlighted sections below.")
    else:
        parts.append("No critical issues flagged — a clean result across all categories.")

    # Market note
    rental_list = (market.get("rental_overview") or [])
    if isinstance(rental_list, list):
        all_rental = next(
            (r for r in rental_list if isinstance(r, dict) and r.get("beds") == "ALL"), None
        )
        if all_rental and all_rental.get("median"):
            median = all_rental["median"]
            cv = prop.get("capital_value") or prop.get("cv_capital")
            if cv and cv > 0:
                yld = round((median * 52 / cv) * 100, 1)
                parts.append(
                    f"Median rent is ${median}/week with an indicative gross yield of {yld}%."
                )
            else:
                parts.append(f"Median rent for this area is ${median}/week.")

    # Transit note
    transit = live.get("transit_stops_400m")
    supermarket = live.get("nearest_supermarket_name")
    supermarket_dist = live.get("nearest_supermarket_distance_m")
    if transit is not None and transit >= 8 and supermarket and supermarket_dist is not None:
        parts.append(
            f"Day-to-day living is practical: {transit} transit stops within 400m and "
            f"{supermarket} {int(supermarket_dist)}m away."
        )

    return " ".join(parts)


def build_map_url(addr: dict) -> str | None:
    """Build a Mapbox Static API URL for the property location.
    Returns None if MAPBOX_ACCESS_TOKEN is not configured or coords missing."""
    try:
        from ..config import settings
        token = settings.MAPBOX_ACCESS_TOKEN
    except Exception:
        return None
    if not token:
        return None

    lat = addr.get("latitude") or addr.get("lat")
    lng = addr.get("longitude") or addr.get("lng") or addr.get("lon")
    if lat is None or lng is None:
        return None

    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return None

    # Large pin, teal colour, light style for PDFs, zoom 15, 700×350 retina
    pin = f"pin-l-home+0D7377({lng},{lat})"
    return (
        f"https://api.mapbox.com/styles/v1/mapbox/light-v11/static/"
        f"{pin}/{lng},{lat},15,0/700x350@2x"
        f"?access_token={token}&attribution=false&logo=false"
    )


# =============================================================================
# Insight Rule Engine
# =============================================================================

class Insight:
    __slots__ = ("level", "text", "action")

    def __init__(self, level: str, text: str, action: str = ""):
        self.level = level   # "warn" | "info" | "ok"
        self.text = text
        self.action = action

    def to_dict(self) -> dict:
        return {"level": self.level, "text": self.text, "action": self.action}


def build_insights(report: dict) -> dict[str, list[dict]]:
    """Run the insight rule engine over all sections.
    Returns {section: [insight_dict, ...]} — Jinja2 templates consume dicts."""
    hazards = report.get("hazards") or {}
    env = report.get("environment") or {}
    live = report.get("liveability") or {}
    market = report.get("market") or {}
    planning = report.get("planning") or {}
    prop = report.get("property") or {}

    result: dict[str, list[dict]] = {
        "hazards": [],
        "environment": [],
        "liveability": [],
        "market": [],
        "planning": [],
    }

    # ── Tenure / Title Rules ──────────────────────────────────────────────────
    title_type = str(prop.get("title_type") or "").lower()
    estate_desc = str(prop.get("estate_description") or "").lower()
    is_leasehold = "leasehold" in title_type or "leasehold" in estate_desc
    is_cross_lease = (
        "cross lease" in title_type or "cross-lease" in title_type
        or "cross lease" in estate_desc or "cross-lease" in estate_desc
    )
    if is_leasehold:
        result["planning"].append(Insight(
            "warn",
            "Leasehold title — you own the building, not the land. Ground rent reviews (typically every 7–21 years) can jump 20–50%.",
            "Ask for current ground rent, next review date, and lessor identity. Not every bank lends on leasehold; "
            "confirm mortgage eligibility before unconditional. A property lawyer should review the ground lease clauses.",
        ).to_dict())
    elif is_cross_lease:
        result["planning"].append(Insight(
            "info",
            "Cross-lease title — shared land ownership with the other flats. Any structural change outside the flat plan needs co-owner consent.",
            "Compare as-built to the flats plan. Unapproved additions (decks, extensions, garages) are the most common "
            "cross-lease pitfall and routinely block sale or refinance until remedied.",
        ).to_dict())

    # ── Hazard Rules ──────────────────────────────────────────────────────────

    flood = str(hazards.get("flood") or "").lower()
    if "1%" in flood or "100" in flood:
        result["hazards"].append(Insight(
            "warn",
            "1-in-100-year flood zone — 1% annual chance of inundation.",
            "Request LIM. Check floor level was elevated to consent. Ask lender about flood insurance requirement.",
        ).to_dict())
    elif "0.2%" in flood or "430" in flood:
        result["hazards"].append(Insight(
            "info",
            "Low-probability flood zone (1-in-430 years) — mainly affects mortgage eligibility.",
            "Check with your lender — some banks require flood insurance for any mapped zone.",
        ).to_dict())

    tsunami = hazards.get("tsunami_zone_class")
    if tsunami is not None:
        try:
            tz = int(tsunami)
        except (TypeError, ValueError):
            tz = 0
        if tz >= 3:
            result["hazards"].append(Insight(
                "warn",
                f"Tsunami Zone {tz} — highest local government warning tier for this area.",
                "Identify your inland evacuation route. Zone 3 affects resale times in some coastal suburbs.",
            ).to_dict())
        elif tz >= 1:
            result["hazards"].append(Insight(
                "info",
                f"Tsunami Zone {tz} — low-to-moderate wave inundation risk from distant events.",
                "",
            ).to_dict())

    liquefaction = str(hazards.get("liquefaction") or "").lower()
    if "very high" in liquefaction or "high" in liquefaction:
        result["hazards"].append(Insight(
            "warn",
            f"High liquefaction potential — ground likely to deform in a major earthquake.",
            "Inspect foundations carefully. Request geotechnical report if available.",
        ).to_dict())
    elif "moderate" in liquefaction:
        result["hazards"].append(Insight(
            "info",
            "Moderate liquefaction — partial settlement possible in significant seismic event.",
            "Standard building inspection should note any existing foundation movement cracks.",
        ).to_dict())

    eq_count = hazards.get("earthquake_count_30km")
    if eq_count is not None:
        try:
            eq_count = int(eq_count)
        except (TypeError, ValueError):
            eq_count = None
    if eq_count is not None and eq_count >= 20:
        result["hazards"].append(Insight(
            "warn",
            f"{eq_count} M4+ earthquakes within 30km in 10 years — active seismic area.",
            "Review earthquake strengthening, especially pre-1976 unreinforced masonry.",
        ).to_dict())

    wind = str(hazards.get("wind_zone") or "").upper()
    if wind in ("EH", "SED", "EXTRA HIGH", "SEMI-EXPOSED DESIGN"):
        result["hazards"].append(Insight(
            "warn",
            f"Extreme wind zone ({wind}) — one of NZ's most exposed classifications.",
            "Confirm roof fastening meets NZS 3604 for wind zone. Expect higher heating bills.",
        ).to_dict())

    epb_count = hazards.get("epb_count_300m")
    if epb_count is not None:
        try:
            epb_count = int(epb_count)
        except (TypeError, ValueError):
            epb_count = None
    if epb_count is not None and epb_count >= 5:
        result["hazards"].append(Insight(
            "warn",
            f"{epb_count} earthquake-prone buildings within 300m — older building stock nearby.",
            "Check MBIE EPB register for this specific property. EPB status affects insurance.",
        ).to_dict())

    wildfire_days = hazards.get("wildfire_vhe_days")
    if wildfire_days is not None:
        try:
            wildfire_days = float(wildfire_days)
        except (TypeError, ValueError):
            wildfire_days = None
    if wildfire_days is not None and wildfire_days >= 15:
        result["hazards"].append(Insight(
            "warn",
            f"{wildfire_days:.0f} Very High/Extreme fire danger days/yr — above national median.",
            "Review home and contents insurance for wildfire. Clear vegetation buffers.",
        ).to_dict())

    # GNS Landslide Database (NZLD) — historical landslide events
    ls_count = hazards.get("landslide_count_500m") or 0
    if ls_count >= 3:
        result["hazards"].append(Insight(
            "warn",
            f"{ls_count} historical landslides documented within 500m (GNS NZLD). Multiple events indicate significant slope instability.",
            "Commission a geotechnical assessment. Check retaining walls, drainage, and ground movement indicators.",
        ).to_dict())
    elif ls_count > 0:
        result["hazards"].append(Insight(
            "info",
            f"{ls_count} historical landslide{'s' if ls_count > 1 else ''} recorded within 500m. Check property for signs of ground movement.",
            "Review retaining wall condition and drainage adequacy during your viewing.",
        ).to_dict())

    if hazards.get("landslide_in_area"):
        result["hazards"].append(Insight(
            "warn",
            "This property is within a mapped historical landslide boundary (GNS Science).",
            "A geotechnical report is essential. Consider foundation type and any ground movement history.",
        ).to_dict())

    # Slope Failure / Landslide
    slope_failure = str(hazards.get("slope_failure") or "").lower()
    if "very high" in slope_failure:
        result["hazards"].append(Insight(
            "warn",
            "Very High earthquake-induced landslide susceptibility — steep terrain in this area "
            "is highly prone to slope failure. Recent storms have caused significant slips "
            "across NZ in zones like this.",
            "Commission geotechnical assessment ($2,000-5,000). Check retaining walls, drainage, "
            "and any signs of historic ground movement (cracked paths, leaning fences, bowing walls). "
            "Ask neighbours about slip history. Review EQC claim history via LIM.",
        ).to_dict())
    elif "high" in slope_failure:
        result["hazards"].append(Insight(
            "warn",
            "High landslide susceptibility — this area is prone to slope failure during earthquakes "
            "and heavy rainfall events.",
            "During building inspection, specifically check retaining walls, subfloor drainage, and "
            "any evidence of ground movement. Request LIM for landslide/slip history on the property.",
        ).to_dict())
    elif "medium" in slope_failure:
        result["hazards"].append(Insight(
            "info",
            "Medium landslide susceptibility — moderate slope failure risk that increases during "
            "heavy rainfall and seismic events.",
            "Ask about drainage and retaining wall maintenance during inspection.",
        ).to_dict())

    # ── Compound Hazard Rules (Section 2 — combinations the data supports) ───

    # 2.1 — Compounding seismic vulnerability. A site that's both slope-prone AND
    # liquefaction-prone can fail two ways in a single quake; the geotech bill
    # to assess both is meaningfully higher than for either alone.
    _slope_high = "high" in slope_failure  # catches "high" and "very high"
    _liq_sources = [
        str(hazards.get("liquefaction") or "").lower(),
        str(hazards.get("gwrc_liquefaction") or "").lower(),
        str(hazards.get("council_liquefaction") or "").lower(),
    ]
    _liq_high = any("high" in s for s in _liq_sources)
    if _slope_high and _liq_high:
        result["hazards"].append(Insight(
            "warn",
            "Double seismic vulnerability — slope failure AND liquefaction are both rated High here. "
            "A single significant earthquake can trigger both ground-failure modes.",
            "Combined geotechnical + slope-stability assessment costs $5,000–$8,000, not the usual $2,000–$3,000. "
            "Get this BEFORE going unconditional, not after.",
        ).to_dict())

    # 2.3 — Tsunami evacuation feasibility. Mapped tsunami zone is one signal;
    # being on low, flat ground with the nearest high ground far away is what
    # makes the evacuation window genuinely tight.
    _tsunami_signal = (
        (isinstance(hazards.get("tsunami_zone_class"), (int, float)) and hazards.get("tsunami_zone_class") >= 2)
        or (hazards.get("wcc_tsunami_return_period") in ("1:100yr", "1:500yr"))
        or (hazards.get("council_tsunami_ranking") in ("High", "Medium"))
    )
    _coastal_cm = hazards.get("coastal_elevation_cm")
    try:
        _coastal_cm_f = float(_coastal_cm) if _coastal_cm is not None else None
    except (TypeError, ValueError):
        _coastal_cm_f = None
    _terrain_elev_m = (report.get("terrain") or {}).get("elevation_m")
    try:
        _terrain_elev_m_f = float(_terrain_elev_m) if _terrain_elev_m is not None else None
    except (TypeError, ValueError):
        _terrain_elev_m_f = None
    if _tsunami_signal and _coastal_cm_f is not None and _coastal_cm_f <= 300 and _terrain_elev_m_f is not None and _terrain_elev_m_f <= 5:
        result["hazards"].append(Insight(
            "warn",
            f"Tsunami zone on low, flat ground — {int(_coastal_cm_f)}cm above MHWS, {_terrain_elev_m_f:.1f}m elevation. "
            "A local tsunami gives 5–20 minutes' warning.",
            "Walk the evacuation route to high ground (≥15m elevation) BEFORE you sign — at average walking pace, "
            "every 100m of horizontal distance is roughly a minute lost from your evacuation budget. "
            "Long or strong shaking = move immediately, don't wait for the official alert.",
        ).to_dict())

    # 2.10 — Saturated slope. A slope-prone site is materially more dangerous when
    # it also has a water source nearby (overland flow, depression, waterway) because
    # rainfall-saturated soil is the #1 NZ slip trigger (NZ Fire Service / GNS).
    _slope_med_or_high = ("medium" in slope_failure) or _slope_high
    _terrain_block = report.get("terrain") or {}
    _waterway_m = _terrain_block.get("nearest_waterway_m")
    try:
        _waterway_m_f = float(_waterway_m) if _waterway_m is not None else None
    except (TypeError, ValueError):
        _waterway_m_f = None
    _has_surface_water = (
        bool(hazards.get("overland_flow_within_50m"))
        or bool(_terrain_block.get("is_depression"))
        or (_waterway_m_f is not None and _waterway_m_f <= 50)
    )
    if _slope_med_or_high and _has_surface_water:
        _trigger_parts = []
        if hazards.get("overland_flow_within_50m"):
            _trigger_parts.append("overland flow path within 50m")
        if _terrain_block.get("is_depression"):
            _trigger_parts.append("natural depression collects water")
        if _waterway_m_f is not None and _waterway_m_f <= 50:
            _trigger_parts.append(f"waterway {int(_waterway_m_f)}m away")
        _trigger_text = " · ".join(_trigger_parts)
        result["hazards"].append(Insight(
            "warn",
            f"Slip-susceptible slope with surface water nearby ({_trigger_text}). "
            "Rainfall-saturated soil is the most common slip trigger in NZ.",
            "Geotech assessment should specifically cover subfloor drainage, cut-slope retaining walls, "
            "and any geotextile treatments — ask the builder's report to document them. "
            "Recent NZ events (Auckland 2023, Cyclone Gabrielle) hit slopes like this hardest.",
        ).to_dict())

    # ── Regional Hazard Rules (from source_council-based layers) ────────────

    gs_severity = str(hazards.get("ground_shaking_severity") or "").lower()
    if "high" in gs_severity or gs_severity.startswith("5") or gs_severity.startswith("4"):
        geology = hazards.get("gwrc_liquefaction_geology")
        geo_str = f" Built on **{geology}**." if geology else ""
        result["hazards"].append(Insight(
            "warn",
            f"High ground shaking amplification zone — earthquake shaking is amplified here.{geo_str}",
            "Older buildings (pre-1976) are most at risk. Ask about seismic strengthening history. "
            "Modern foundations designed for amplification zones perform significantly better.",
        ).to_dict())

    gwrc_geology = str(hazards.get("gwrc_liquefaction_geology") or "").lower()
    if "fill" in gwrc_geology or "reclaimed" in gwrc_geology:
        result["hazards"].append(Insight(
            "warn",
            "Built on reclaimed/fill land — very high liquefaction and ground deformation risk.",
            "Commission geotechnical assessment. Check foundation type — raft/deep pile foundations "
            "perform best on fill. Review EQC claim history. Insurance excesses may be higher.",
        ).to_dict())

    fault_name = hazards.get("fault_zone_name")
    if fault_name:
        ranking = hazards.get("fault_zone_ranking") or "mapped"
        result["hazards"].append(Insight(
            "warn",
            f"Within **{fault_name}** fault zone (ranking: {ranking}) — risk of surface rupture.",
            "District Plan rules restrict building in fault avoidance zones. Check if resource consent "
            "is required for modifications. Surface rupture cannot be mitigated by building design.",
        ).to_dict())
    else:
        # GNS national active fault — falls back when no council-specific fault_zone_name is set
        af = hazards.get("active_fault_nearest")
        if isinstance(af, dict) and af.get("name") and af.get("distance_m") is not None:
            try:
                af_dist = float(af.get("distance_m"))
            except (TypeError, ValueError):
                af_dist = None
            try:
                af_slip = float(af.get("slip_rate_mm_yr")) if af.get("slip_rate_mm_yr") is not None else None
            except (TypeError, ValueError):
                af_slip = None
            af_dist_str = (
                f"{int(af_dist)}m" if af_dist is not None and af_dist < 1000
                else f"{(af_dist / 1000):.1f}km" if af_dist is not None
                else "nearby"
            )
            if af_dist is not None and af_dist <= 200 and af_slip is not None and af_slip >= 1.0:
                result["hazards"].append(Insight(
                    "warn",
                    f"Within 200m of the **{af['name']}** active fault (slip rate {af_slip} mm/yr) — direct surface-rupture risk.",
                    "Fault rupture can cause 1–6m of ground offset — not mitigable by building design. "
                    "Check the title for any fault-avoidance consent notice and confirm MBIE/GNS setback compliance before offer.",
                ).to_dict())
            elif af_dist is not None and af_dist <= 2000:
                slip_str = f" Slip rate {af_slip} mm/yr." if af_slip is not None else ""
                result["hazards"].append(Insight(
                    "info",
                    f"Nearest active fault: **{af['name']}**, {af_dist_str} away.{slip_str}",
                    "Proximity to an active fault raises expected earthquake shaking at this site. "
                    "Modern code-compliant design mitigates this — verify the building consent file and any seismic assessments.",
                ).to_dict())

    wcc_tsunami = hazards.get("wcc_tsunami_return_period")
    if wcc_tsunami and wcc_tsunami in ("1:100yr", "1:500yr"):
        result["hazards"].append(Insight(
            "warn" if wcc_tsunami == "1:100yr" else "info",
            f"District Plan tsunami zone ({wcc_tsunami} return period).",
            "Know your evacuation route to high ground. Long or strong earthquake = move immediately. "
            "Zone affects insurance and may restrict future building consent for habitable rooms.",
        ).to_dict())

    wcc_flood_type = hazards.get("wcc_flood_type")
    wcc_flood_rank = hazards.get("wcc_flood_ranking")
    if wcc_flood_type and wcc_flood_rank:
        severity = "warn" if wcc_flood_rank in ("High", "Medium") else "info"
        result["hazards"].append(Insight(
            severity,
            f"District Plan flood overlay: **{wcc_flood_type}** ({wcc_flood_rank} ranking).",
            "Stream corridor = highest risk. Check floor level relative to estimated flood level. "
            "Resource consent may be needed for new buildings/additions in flood overlay areas.",
        ).to_dict())

    solar_kwh = hazards.get("solar_mean_kwh")
    if solar_kwh is not None:
        try:
            solar_kwh = float(solar_kwh)
        except (TypeError, ValueError):
            solar_kwh = None
    if solar_kwh is not None:
        if solar_kwh >= 1200:
            result["environment"].append(Insight(
                "ok",
                f"Good solar exposure: {solar_kwh:.0f} kWh/m²/yr — above average. Solar panels viable.",
                "",
            ).to_dict())
        elif solar_kwh < 800:
            result["environment"].append(Insight(
                "info",
                f"Low solar exposure: {solar_kwh:.0f} kWh/m²/yr — expect higher heating costs and less natural light in winter.",
                "Check north-facing window area. Passive solar design matters more in low-sun locations.",
            ).to_dict())

    # Metlink mode breakdown
    bus_800 = live.get("bus_stops_800m") or 0
    rail_800 = live.get("rail_stops_800m") or 0
    ferry_800 = live.get("ferry_stops_800m") or 0
    cable_800 = live.get("cable_car_stops_800m") or 0
    if rail_800 > 0 or ferry_800 > 0 or cable_800 > 0:
        modes = []
        if rail_800 > 0:
            modes.append(f"{rail_800} rail")
        if ferry_800 > 0:
            modes.append(f"{ferry_800} ferry")
        if cable_800 > 0:
            modes.append(f"{cable_800} cable car")
        if bus_800 > 0:
            modes.append(f"{bus_800} bus")
        result["liveability"].append(Insight(
            "ok",
            f"Multi-modal transit within 800m: {', '.join(modes)} stops.",
            "",
        ).to_dict())

    # ── New Overlay Insights ────────────────────────────────────────────────

    # Aircraft noise
    aircraft_noise = hazards.get("aircraft_noise_name")
    if aircraft_noise:
        dba = hazards.get("aircraft_noise_dba")
        cat = hazards.get("aircraft_noise_category") or ""
        dba_str = f" ({dba} dBA)" if dba else ""
        severity = "warn" if cat == "High" else "info"
        result["environment"].append(Insight(
            severity,
            f"Aircraft noise overlay: **{aircraft_noise}**{dba_str}.",
            "Check noise levels during peak flight times. This may affect outdoor amenity and sleep quality. "
            "Double glazing is recommended for bedrooms facing the flight path.",
        ).to_dict())

    # Council landslide susceptibility (Auckland etc.)
    ls_rating = str(hazards.get("landslide_susceptibility_rating") or "").lower()
    if "very high" in ls_rating or "high" in ls_rating:
        result["hazards"].append(Insight(
            "warn",
            f"{'Very high' if 'very' in ls_rating else 'High'} landslide susceptibility zone (council assessment).",
            "Commission a geotechnical assessment. Check retaining walls, drainage, and slope stability. "
            "This rating considers rainfall-triggered landslides as well as earthquake-induced failures.",
        ).to_dict())
    elif "moderate" in ls_rating or "medium" in ls_rating:
        result["hazards"].append(Insight(
            "info",
            "Moderate landslide susceptibility — some slope instability risk during heavy rain or earthquakes.",
            "Check retaining wall condition and drainage during inspection.",
        ).to_dict())

    # Geotechnical reports nearby
    geotech_count = hazards.get("geotech_count_500m") or 0
    if geotech_count >= 10:
        nearest_hazard = hazards.get("geotech_nearest_hazard")
        hazard_str = f" Nearest report flags: **{nearest_hazard}**." if nearest_hazard else ""
        result["hazards"].append(Insight(
            "info",
            f"{geotech_count} geotechnical reports filed within 500m — this area has known ground issues.{hazard_str}",
            "Request copies of relevant geotech reports from the council. Previous investigations can save you thousands.",
        ).to_dict())

    # Overland flow path proximity
    if hazards.get("overland_flow_within_50m"):
        result["hazards"].append(Insight(
            "info",
            "Overland flow path within 50m — surface water may flow through or near this property during heavy rain.",
            "Check ground levels, drainage, and whether the building floor is raised above surrounding grade.",
        ).to_dict())

    # Council coastal erosion
    cce = hazards.get("council_coastal_erosion")
    if cce and isinstance(cce, dict):
        tf = cce.get("timeframe")
        dist = cce.get("distance_m")
        scenario = cce.get("scenario") or ""
        if dist is not None and dist < 200:
            result["hazards"].append(Insight(
                "warn",
                f"Coastal erosion projection within {int(dist)}m"
                + (f" (timeframe: {tf}yr)" if tf else "")
                + (f" — {scenario}" if scenario else "") + ".",
                "Review coastal hazard assessment before purchase. Erosion may affect insurance and resale value.",
            ).to_dict())

    # Viewshaft
    if planning.get("in_viewshaft"):
        vs_name = planning.get("viewshaft_name") or "viewshaft"
        vs_sig = planning.get("viewshaft_significance") or ""
        sig_str = f" ({vs_sig})" if vs_sig else ""
        result["planning"].append(Insight(
            "info",
            f"Property is within a protected **viewshaft**{sig_str}: {vs_name}.",
            "Height and bulk restrictions apply. New buildings and additions must not obstruct the protected view.",
        ).to_dict())

    # Character precinct
    if planning.get("in_character_precinct"):
        cp_name = planning.get("character_precinct_name") or "character precinct"
        result["planning"].append(Insight(
            "info",
            f"Within a **character precinct** ({cp_name}). Design controls protect neighbourhood character.",
            "Additions and new builds must be sympathetic. Demolition may require resource consent.",
        ).to_dict())

    # Coastal elevation
    celev = hazards.get("coastal_elevation_cm")
    if celev is not None:
        try:
            cm = float(celev)
            if cm <= 50:
                result["hazards"].append(Insight(
                    "warn",
                    f"Property is only {cm:.0f}cm above mean high water springs — very low coastal elevation.",
                    "High risk of coastal inundation during storm surges. Check insurance and future sea level rise projections.",
                ).to_dict())
            elif cm <= 150:
                result["hazards"].append(Insight(
                    "info",
                    f"Coastal elevation: {cm:.0f}cm above mean high water springs.",
                    "Some exposure to coastal flooding during extreme events. Review with sea level rise scenarios.",
                ).to_dict())
        except (TypeError, ValueError):
            pass

    # Flood extent (AEP)
    fe_aep = hazards.get("flood_extent_aep")
    fe_label = hazards.get("flood_extent_label")
    if fe_aep:
        result["hazards"].append(Insight(
            "warn" if fe_aep in ("2%", "1%") else "info",
            f"Within regional flood extent ({fe_aep} AEP)"
            + (f" — {fe_label}" if fe_label else "") + ".",
            "Annual Exceedance Probability indicates likelihood of flooding in any given year. Check floor levels.",
        ).to_dict())

    # Heritage overlay
    if planning.get("in_heritage_overlay"):
        name = planning.get("heritage_overlay_name") or "heritage overlay"
        result["planning"].append(Insight(
            "info",
            f"Property is within a council heritage overlay (**{name}**). External modifications may require resource consent.",
            "Check the district/unitary plan heritage schedule for specific controls on this site.",
        ).to_dict())

    # Special character area
    if planning.get("in_special_character"):
        name = planning.get("special_character_name") or "special character area"
        result["planning"].append(Insight(
            "info",
            f"Within a **Special Character Area** ({name}). Demolition and major alterations are controlled.",
            "Design of new builds and additions must be sympathetic to neighbourhood character.",
        ).to_dict())

    # Significant ecological area
    if planning.get("in_ecological_area"):
        name = planning.get("ecological_area_name") or "ecological area"
        eco_type = planning.get("ecological_area_type") or ""
        result["planning"].append(Insight(
            "info",
            f"Within a **Significant Ecological Area** ({name})"
            + (f" — {eco_type}" if eco_type else "") + ".",
            "Vegetation removal, earthworks, and building may require ecological assessment and resource consent.",
        ).to_dict())

    # Mana whenua
    if planning.get("in_mana_whenua"):
        name = planning.get("mana_whenua_name") or "a site of significance"
        result["planning"].append(Insight(
            "info",
            f"Within a **Site of Significance to Mana Whenua** ({name}).",
            "Cultural heritage assessment may be required for development. Engage early with iwi/hapū.",
        ).to_dict())

    # Notable trees
    nt_count = planning.get("notable_trees_50m") or 0
    if nt_count > 0:
        result["planning"].append(Insight(
            "info",
            f"{nt_count} notable/scheduled tree{'s' if nt_count != 1 else ''} within 50m — protected under the district/unitary plan.",
            "Removal or significant pruning requires resource consent. Root protection zones may restrict building.",
        ).to_dict())

    # Height variation control
    hv_limit = planning.get("height_variation_limit")
    if hv_limit:
        result["planning"].append(Insight(
            "info",
            f"Height variation control applies: **{hv_limit}** maximum.",
            "This overrides the base zone height limit. Check the district/unitary plan for specific rules.",
        ).to_dict())

    # Nearest park
    park_name = planning.get("nearest_park_name")
    park_dist = planning.get("nearest_park_distance_m")
    if park_name and park_dist is not None:
        try:
            d = float(park_dist)
            if d <= 300:
                result["liveability"].append(Insight(
                    "ok",
                    f"**{park_name}** is just {int(d)}m away — excellent green space access.",
                    "",
                ).to_dict())
            elif d <= 800:
                result["liveability"].append(Insight(
                    "info",
                    f"Nearest park (**{park_name}**) is {int(d)}m away.",
                    "",
                ).to_dict())
        except (TypeError, ValueError):
            pass

    # ── Terrain-Inferred Hazard Rules ────────────────────────────────────────
    terrain = report.get("terrain") or {}
    flood_terrain = terrain.get("flood_terrain_risk", "none")
    wind_exp = terrain.get("wind_exposure", "unknown")
    rel_pos = terrain.get("relative_position", "unknown")
    is_depression = terrain.get("is_depression")
    depression_depth = terrain.get("depression_depth_m")

    # Depression → water pooling risk (only if no council flood data already flagged)
    if is_depression and not hazards.get("flood") and not hazards.get("wcc_flood_ranking"):
        depth_str = f" ({abs(depression_depth):.1f}m below surrounding terrain)" if depression_depth else ""
        result["hazards"].append(Insight(
            "warn" if flood_terrain in ("high", "moderate") else "info",
            f"This property sits in a natural low point{depth_str} — water may collect here during heavy rain.",
            "Check for signs of past ponding (staining on foundations, soft ground). Ensure stormwater "
            "drainage is adequate and not relying solely on soakage. Ask the council about overland flow paths.",
        ).to_dict())

    # Flat + low elevation → poor drainage (only if no existing flood finding)
    if flood_terrain in ("moderate", "high") and not is_depression and not hazards.get("flood"):
        elev = terrain.get("elevation_m")
        elev_str = f" at {elev:.0f}m elevation" if elev else ""
        result["hazards"].append(Insight(
            "info",
            f"Flat, low-lying terrain{elev_str} with limited natural drainage — terrain suggests flood susceptibility.",
            "No council flood zone is mapped here, but flat low-lying ground is inherently vulnerable to "
            "surface flooding. Check floor levels relative to surrounding ground and nearest waterways.",
        ).to_dict())

    # Wind exposure
    if wind_exp == "very_exposed":
        result["hazards"].append(Insight(
            "warn",
            f"{'Hilltop' if rel_pos == 'hilltop' else 'Ridgeline'} position — expect significantly "
            "stronger winds, especially from the prevailing westerly/northwesterly direction.",
            "Check roof fixings and cladding meet wind zone requirements. BRANZ recommends specific "
            "detailing for exposed sites. Budget for higher maintenance on external finishes.",
        ).to_dict())
    elif wind_exp == "exposed":
        result["hazards"].append(Insight(
            "info",
            "Elevated, exposed site — wind speeds are likely above average for this area.",
            "Consider wind when planning outdoor spaces. Check cladding and roof condition during inspection.",
        ).to_dict())

    # Sheltered valley (positive)
    if wind_exp == "sheltered" and rel_pos in ("depression", "valley"):
        result["liveability"].append(Insight(
            "ok",
            f"Naturally sheltered {'valley' if rel_pos == 'valley' else 'low-lying'} position — wind exposure is low.",
            "",
        ).to_dict())

    # Aspect / solar orientation — only meaningful when the site has slope.
    # In NZ (southern hemisphere) north-facing captures winter sun; south-facing is shaded.
    aspect_label = terrain.get("aspect_label")
    slope_deg = terrain.get("slope_degrees")
    try:
        slope_deg_f = float(slope_deg) if slope_deg is not None else None
    except (TypeError, ValueError):
        slope_deg_f = None
    if aspect_label and aspect_label not in ("unknown", "flat") and slope_deg_f is not None and slope_deg_f >= 3:
        if aspect_label in ("north", "northeast", "northwest"):
            result["liveability"].append(Insight(
                "ok",
                f"{aspect_label.capitalize()}-facing slope — captures winter sun, warmer and drier interiors, solar panels perform well.",
                "",
            ).to_dict())
        elif aspect_label in ("south", "southeast", "southwest"):
            result["liveability"].append(Insight(
                "info",
                f"{aspect_label.capitalize()}-facing slope — limited winter sun. Heating costs typically 10–20% higher than a north-facing equivalent.",
                "Confirm heating capacity is adequate for the main living area and that bedrooms have ventilation. "
                "South-facing sites need good insulation and moisture control to avoid mould in winter.",
            ).to_dict())

    # ── Waterway Proximity Rules ─────────────────────────────────────────────
    waterway_m = terrain.get("nearest_waterway_m")
    waterway_name = terrain.get("nearest_waterway_name")
    waterway_type = terrain.get("nearest_waterway_type", "")
    waterway_count = terrain.get("waterways_within_500m") or 0
    type_label = "river" if waterway_type == "river_cl" else "stream" if waterway_type == "drain_cl" else "waterway"

    if waterway_m is not None and waterway_m <= 50:
        name_str = f" (**{waterway_name}**)" if waterway_name else ""
        result["hazards"].append(Insight(
            "warn",
            f"A {type_label}{name_str} is just {waterway_m}m away — very close proximity increases flood risk.",
            "Check floor levels relative to the waterway. Ask the council about flood history for this "
            "specific location. Ensure building and contents insurance covers riverine flooding.",
        ).to_dict())
    elif waterway_m is not None and waterway_m <= 100:
        name_str = f" ({waterway_name})" if waterway_name else ""
        result["hazards"].append(Insight(
            "info",
            f"{type_label.capitalize()}{name_str} within {waterway_m}m — proximity to waterways increases flood exposure.",
            "Properties near waterways face higher flood risk during heavy rain. Check council flood maps "
            "and whether the property has flooded before.",
        ).to_dict())
    elif waterway_m is not None and waterway_m <= 200 and waterway_count >= 2:
        result["hazards"].append(Insight(
            "info",
            f"{waterway_count} waterways within 500m, nearest {waterway_m}m away — moderate proximity to water.",
            "Multiple nearby waterways increase flood exposure during extreme rainfall events.",
        ).to_dict())

    # ── Event History Rules ───────────────────────────────────────────────────
    event_hist = report.get("event_history") or {}
    total_weather = event_hist.get("extreme_weather_5yr") or 0
    rain_count = event_hist.get("heavy_rain_events") or 0
    wind_count = event_hist.get("extreme_wind_events") or 0
    worst_rain = event_hist.get("worst_rain_mm")
    worst_wind = event_hist.get("worst_wind_kmh")
    quake_count = event_hist.get("earthquakes_30km_10yr") or 0
    largest_quake = event_hist.get("largest_quake_magnitude")

    if total_weather >= 5:
        rain_str = f" including {rain_count} heavy rain events" if rain_count >= 2 else ""
        result["hazards"].append(Insight(
            "warn",
            f"{total_weather} extreme weather events recorded within 50km in the last 5 years{rain_str}.",
            "Frequent severe weather increases risk of flooding, slips, and property damage. "
            "Check insurance covers weather-related damage without excessive excesses.",
        ).to_dict())
    elif total_weather >= 2:
        result["hazards"].append(Insight(
            "info",
            f"{total_weather} extreme weather events recorded within 50km in the last 5 years.",
            "Review property for weather resilience — drainage, roof condition, and tree proximity.",
        ).to_dict())

    if worst_rain and worst_rain >= 80:
        result["hazards"].append(Insight(
            "warn" if worst_rain >= 120 else "info",
            f"Heaviest recorded rainfall nearby: {worst_rain:.0f}mm in a single event — "
            + ("extreme" if worst_rain >= 120 else "very heavy") + " for NZ conditions.",
            "Intense rainfall events overwhelm stormwater systems. Check the property's "
            "drainage capacity and whether the floor level is raised above surrounding ground.",
        ).to_dict())

    if quake_count >= 5:
        mag_str = f", largest M{largest_quake:.1f}" if largest_quake else ""
        result["hazards"].append(Insight(
            "warn" if quake_count >= 10 else "info",
            f"{quake_count} earthquakes M4+ within 30km in the last 10 years{mag_str} — seismically active area.",
            "Check the building's earthquake resilience. Older buildings (pre-1976) may not meet "
            "current seismic standards. Review EQC claim history via LIM.",
        ).to_dict())
    elif quake_count >= 2 and largest_quake and largest_quake >= 5.0:
        result["hazards"].append(Insight(
            "info",
            f"M{largest_quake:.1f} earthquake recorded within 30km in the last 10 years.",
            "Ask about any earthquake damage history. Check for cosmetic damage (cracks in plaster, "
            "gaps in window frames) that may indicate structural movement.",
        ).to_dict())

    # ── Environment Rules ─────────────────────────────────────────────────────

    noise_db = env.get("road_noise_db")
    if noise_db is not None:
        try:
            noise_db = float(noise_db)
        except (TypeError, ValueError):
            noise_db = None

    is_multi_unit = bool(prop.get("unit_count") and prop.get("unit_count", 1) > 1)

    if noise_db is not None:
        if noise_db >= 65:
            action = (
                "Visit at peak traffic. Ask about glazing — double/triple glazing reduces noise significantly."
                + (" **If multi-unit: higher floors may be meaningfully quieter; ask which floor.**" if is_multi_unit else "")
            )
            result["environment"].append(Insight(
                "warn",
                f"{noise_db:.0f} dB — equivalent to a busy restaurant. Audible indoors with standard windows.",
                action,
            ).to_dict())
        elif noise_db >= 55:
            result["environment"].append(Insight(
                "info",
                f"{noise_db:.0f} dB — moderate road noise, similar to a conversational voice at close range.",
                "Consider room orientation — bedrooms away from the road will be quieter.",
            ).to_dict())
        elif noise_db < 45:
            result["environment"].append(Insight(
                "ok",
                f"{noise_db:.0f} dB — quiet. Well below WHO recommended 53 dB outdoor residential limit.",
                "",
            ).to_dict())

    air_trend = env.get("air_pm10_trend") or env.get("air_pm25_trend")
    air_site = env.get("air_pm10_site") or env.get("air_pm25_site")
    air_dist = env.get("air_pm10_distance_m") or env.get("air_pm25_distance_m")
    if air_trend and str(air_trend).lower() == "degrading":
        dist_km = f"{air_dist / 1000:.1f} km" if air_dist else ""
        site_str = f" at {air_site}" if air_site else ""
        dist_note = f" ({dist_km} away)" if dist_km else ""
        result["environment"].append(Insight(
            "warn",
            f"Regional air quality is degrading{site_str}{dist_note}.",
            "This is regional LAWA data, not a property-specific reading. HEPA filtration effective indoors. Check if wood burners are the dominant source.",
        ).to_dict())

    water_band = env.get("water_ecoli_band")
    if water_band and str(water_band).upper() in ("D", "E"):
        result["environment"].append(Insight(
            "warn",
            f"Nearest water monitoring site rated {water_band} for E.coli — below NPS-FM standards.",
            "Surface water only, not drinking water. If property has bore water, test before use.",
        ).to_dict())

    contam_dist = env.get("contam_nearest_distance_m")
    if contam_dist is not None:
        try:
            contam_dist = float(contam_dist)
        except (TypeError, ValueError):
            contam_dist = None
    if contam_dist is not None and contam_dist <= 500:
        name = env.get("contam_nearest_name", "unknown site")
        cat = env.get("contam_nearest_category", "")
        cat_exp = ANZECC_EXPLANATIONS.get(str(cat).upper(), "")
        count_2km = env.get("contam_count_2km")
        count_str = f" {count_2km} contaminated sites within 2km." if count_2km is not None else ""
        cat_str = f" (ANZECC Category {cat} — {cat_exp})" if cat and cat_exp else ""
        # Severity tracks the ANZECC hazard class used in risk_score.py:98 — Cat A
        # covers chemical/refuelling/metal-extraction/explosives sites, which carry
        # real groundwater-plume and soil-disturbance risk. Cat D (cemetery, general
        # waste) is almost always regulatory listing only.
        # Real values in contaminated_land.anzecc_category are full HAIL activity
        # strings: "Chemical manufacture, application and bulk storage", "Vehicle
        # refuelling, service and repair", "Cemeteries and waste recycling,
        # treatment and disposal", etc. These keywords catch those verbatim.
        HIGH_RISK_KEYWORDS = ("chemical", "metal extraction", "explosives", "vehicle refuelling", "refuelling", "petrol", "fuel")
        cat_lower = str(cat).lower()
        name_lower = str(name).lower()
        is_high = any(k in cat_lower or k in name_lower for k in HIGH_RISK_KEYWORDS) or str(cat).upper() == "A"
        is_cemetery_waste = (
            "cemeter" in cat_lower or "cemeter" in name_lower
            or "waste" in cat_lower or "landfill" in cat_lower
        )
        if is_high and contam_dist <= 500:
            result["environment"].append(Insight(
                "warn",
                f"High-hazard contaminated site {int(contam_dist)}m away: **{name}**{cat_str}.{count_str}",
                "ANZECC Category A covers former petrol stations, chemical plants, galvanisers. Groundwater plumes can travel "
                "300–2,000m. A Phase-1 Environmental Site Assessment (~$1,500–3,000) should explicitly address the pathway "
                "from this site to yours, not just proximity. Lender may require clearance before mortgage.",
            ).to_dict())
        elif contam_dist <= 200 and is_cemetery_waste:
            result["environment"].append(Insight(
                "info",
                f"Contaminated-land register entry {int(contam_dist)}m away: **{name}**{cat_str}.{count_str}",
                "Cemeteries and closed landfills carry a regulatory listing but rarely have active soil/water-contact exposure. "
                "Still worth a LIM disclosure check if you plan earthworks or food gardens.",
            ).to_dict())
        elif contam_dist <= 200:
            result["environment"].append(Insight(
                "warn",
                f"Contaminated site {int(contam_dist)}m away: **{name}**{cat_str}.{count_str}",
                "Check the regional council SLUR register for full site history. For purchase: a Phase 1 Environmental Site "
                "Assessment (~$1,500–3,000) is standard practice and may be required by your lender.",
            ).to_dict())

    climate_change = env.get("climate_temp_change")
    if climate_change is not None:
        try:
            climate_change = float(climate_change)
        except (TypeError, ValueError):
            climate_change = None
    if climate_change is not None and climate_change >= 2.0:
        result["environment"].append(Insight(
            "info",
            f"+{climate_change:.1f}°C projected warming 2041–2060 (SSP2-4.5) — warmer winters, higher summer cooling loads.",
            "Review home insulation rating.",
        ).to_dict())

    # ── Liveability Rules ─────────────────────────────────────────────────────

    nzdep = live.get("nzdep_decile")
    if nzdep is not None:
        try:
            nzdep = int(nzdep)
        except (TypeError, ValueError):
            nzdep = None
    if nzdep is not None:
        if nzdep >= 8:
            result["liveability"].append(Insight(
                "warn",
                f"NZDep decile {nzdep}/10 — among the 30% most deprived NZ areas (2018 index covering income, employment, qualifications, access).",
                "Decile does not reflect gentrification since 2018. Visit at different times to assess character.",
            ).to_dict())
        elif nzdep <= 3:
            result["liveability"].append(Insight(
                "ok",
                f"NZDep decile {nzdep}/10 — among the least deprived areas in NZ.",
                "",
            ).to_dict())

    crime_pct = live.get("crime_percentile")
    crime_median = live.get("crime_city_median")
    city = (report.get("address") or {}).get("city", "the city")
    if crime_pct is not None:
        try:
            crime_pct = float(crime_pct)
        except (TypeError, ValueError):
            crime_pct = None
    if crime_pct is not None:
        if crime_pct >= 75:
            median_str = f" City median: {crime_median} victimisations." if crime_median else ""
            result["liveability"].append(Insight(
                "warn",
                f"{crime_pct:.0f}th percentile for crime victimisations — higher than {crime_pct:.0f}% of {city} areas.{median_str}",
                "Check the specific crime categories — property crime and violent crime have different implications for insurance vs personal safety.",
            ).to_dict())
        elif crime_pct >= 50:
            median_str = f" City median: {crime_median}." if crime_median else ""
            result["liveability"].append(Insight(
                "info",
                f"{crime_pct:.0f}th percentile — above {city} median for crime victimisations.{median_str}",
                "",
            ).to_dict())

    crashes_serious = live.get("crashes_300m_serious") or 0
    crashes_fatal = live.get("crashes_300m_fatal") or 0
    try:
        crashes_serious = int(crashes_serious)
        crashes_fatal = int(crashes_fatal)
    except (TypeError, ValueError):
        crashes_serious = crashes_fatal = 0
    if crashes_serious + crashes_fatal >= 3:
        result["liveability"].append(Insight(
            "warn",
            f"{crashes_serious + crashes_fatal} serious/fatal crashes within 300m in 5 years.",
            "Check intersection geometry. If households have children, assess pedestrian crossing availability.",
        ).to_dict())

    transit = live.get("transit_stops_400m")
    if transit is not None:
        try:
            transit = int(transit)
        except (TypeError, ValueError):
            transit = None
    peak_trips_raw = live.get("peak_trips_per_hour")
    try:
        peak_trips = float(peak_trips_raw) if peak_trips_raw is not None else None
    except (TypeError, ValueError):
        peak_trips = None
    if transit is not None:
        if transit <= 2:
            result["liveability"].append(Insight(
                "info",
                f"Only {transit} transit stop{'s' if transit != 1 else ''} within 400m — car-dependent location.",
                "Factor in vehicle running costs. Check bus frequency before committing if car-free.",
            ).to_dict())
        elif transit >= 10 and (peak_trips is None or peak_trips >= 6):
            peak_str = f" Peak service: {int(peak_trips)} trips/hour." if peak_trips is not None else ""
            result["liveability"].append(Insight(
                "ok",
                f"{transit} public transport stops within 400m — excellent transit access.{peak_str}",
                "",
            ).to_dict())
        elif transit >= 5 and peak_trips is not None and peak_trips <= 3:
            # Many stops, sparse services — the count-only rule reads "excellent"
            # and mis-sells the commute. Surface the frequency caveat explicitly.
            result["liveability"].append(Insight(
                "info",
                f"{transit} stops within 400m, but peak service at the busiest stop runs only {peak_trips:.0f} trips/hour.",
                "Stops aren't services. Check the actual routes on your region's journey planner (AT/Metlink/ECan) "
                "against your commute before treating this as a 'good transit' location.",
            ).to_dict())

    train_dist = live.get("nearest_train_distance_m")
    train_name = live.get("nearest_train_name")
    if train_dist is not None and train_name:
        try:
            train_dist = float(train_dist)
        except (TypeError, ValueError):
            train_dist = None
        if train_dist is not None and train_dist <= 500:
            result["liveability"].append(Insight(
                "ok",
                f"Train station ({train_name}) is {int(train_dist)}m — strong commuter connectivity.",
                "",
            ).to_dict())

    # 2.19 — Healthcare desert. Both GP and pharmacy ≥2km is a real daily-life
    # tax for elderly, daily-medication users, families, and car-free households.
    # Existing gp_far rule fires on GP distance only — combining with pharmacy
    # makes the message specific (it's not just "no GP", it's "no healthcare").
    _gp = live.get("nearest_gp")
    _ph = live.get("nearest_pharmacy")
    _gp_dist_m = None
    _ph_dist_m = None
    if isinstance(_gp, dict):
        try:
            _gp_dist_m = float(_gp.get("distance_m")) if _gp.get("distance_m") is not None else None
        except (TypeError, ValueError):
            pass
    if isinstance(_ph, dict):
        try:
            _ph_dist_m = float(_ph.get("distance_m")) if _ph.get("distance_m") is not None else None
        except (TypeError, ValueError):
            pass
    if _gp_dist_m is not None and _gp_dist_m >= 2000 and _ph_dist_m is not None and _ph_dist_m >= 2000:
        result["liveability"].append(Insight(
            "info",
            f"Healthcare 20+ minutes' walk away — nearest GP {int(_gp_dist_m)}m, nearest pharmacy {int(_ph_dist_m)}m.",
            "Daily medication users, elderly, and car-free households should plan for pharmacy delivery services "
            "and confirm GP enrolment is open at your nearest practice (some are capped).",
        ).to_dict())

    # ── Market Rules ──────────────────────────────────────────────────────────

    rental_list = (market.get("rental_overview") or [])
    cv = prop.get("capital_value") or prop.get("cv_capital")
    if isinstance(rental_list, list):
        all_rental = next(
            (r for r in rental_list if isinstance(r, dict)
             and r.get("dwelling_type") == "House" and r.get("beds") == "ALL"),
            next((r for r in rental_list if isinstance(r, dict) and r.get("beds") == "ALL"), None),
        )
        median_rent = all_rental.get("median") if all_rental else None
        yoy_pct = None
        cagr_5yr = None
        # Pull from trends list
        trends_list = market.get("trends") or []
        if isinstance(trends_list, list):
            all_trend = next(
                (t for t in trends_list if isinstance(t, dict)
                 and t.get("dwelling_type") == "ALL" and t.get("beds") == "ALL"),
                None,
            )
            if all_trend:
                yoy_pct = all_trend.get("yoy_pct")
                cagr_5yr = all_trend.get("cagr_5yr")

        yield_pct: float | None = None
        if cv and median_rent and cv > 0:
            yield_pct = round((median_rent * 52 / cv) * 100, 1)
            if yield_pct >= 5:
                result["market"].append(Insight(
                    "ok",
                    f"Indicative gross yield: {yield_pct}% — above NZ metro average (~3.5–4%).",
                    "",
                ).to_dict())
            elif yield_pct < 3:
                result["market"].append(Insight(
                    "info",
                    f"Indicative gross yield: {yield_pct}% — below typical NZ metro averages. Elevated price-to-rent ratio.",
                    "",
                ).to_dict())

        if yoy_pct is not None and yoy_pct >= 5:
            result["market"].append(Insight(
                "info",
                f"Rents rising {yoy_pct:+.1f}% year-on-year — above general inflation.",
                "Buyers: rising rents support yield. Renters: factor likely increase on renewal.",
            ).to_dict())

        if cagr_5yr is not None and cagr_5yr >= 4:
            result["market"].append(Insight(
                "info",
                f"{cagr_5yr:.1f}% annualised rental growth over 5 years — ahead of CPI.",
                "",
            ).to_dict())

        # 2.13 — Supply relief. When yoy_pct is rising AND there's significant
        # construction pipeline nearby, rent pressure should ease as units land.
        # The only positive market signal we currently produce for the renter
        # persona — important for retention.
        _consents_count = planning.get("resource_consents_500m_2yr")
        try:
            _consents_count_i = int(_consents_count) if _consents_count is not None else 0
        except (TypeError, ValueError):
            _consents_count_i = 0
        if yoy_pct is not None and yoy_pct >= 5 and _consents_count_i >= 15:
            result["market"].append(Insight(
                "ok",
                f"Rents rising {yoy_pct:+.1f}% YoY, but {_consents_count_i} resource consents granted within 500m in 2 years — significant new supply pipeline.",
                "Renters: expect rent pressure to ease as units land — useful leverage at your next renewal. "
                "Buyers: short-term construction disruption, medium-term amenity uplift; weigh the timing.",
            ).to_dict())

    # ── Planning Rules ────────────────────────────────────────────────────────

    if planning.get("is_epb_listed"):
        result["planning"].append(Insight(
            "warn",
            "This building is on the MBIE earthquake-prone register. Seismic work has a statutory deadline.",
            "Request EPB assessment from vendor. Calculate remaining deadline (typically 25yr from notice).",
        ).to_dict())

    if planning.get("is_contaminated"):
        result["planning"].append(Insight(
            "warn",
            "Property appears on District Plan contaminated land schedule.",
            "Commission geotechnical/environmental report before purchase. May restrict land-use changes.",
        ).to_dict())

    if planning.get("is_heritage_listed"):
        result["planning"].append(Insight(
            "info",
            "Heritage-listed — external alterations and demolition require resource consent.",
            "Review the District Plan schedule entry for protected features.",
        ).to_dict())

    trans_dist = planning.get("transmission_distance_m") or planning.get("transmission_line_distance_m")
    if trans_dist is not None:
        try:
            trans_dist = float(trans_dist)
        except (TypeError, ValueError):
            trans_dist = None
    if trans_dist is not None and trans_dist <= 100:
        result["planning"].append(Insight(
            "warn",
            f"High-voltage transmission line {int(trans_dist)}m away — easement may restrict development.",
            "Confirm easement in title. Some lenders restrict LVR on properties near lines.",
        ).to_dict())

    consents = planning.get("resource_consents_500m_2yr")
    if consents is not None:
        try:
            consents = int(consents)
        except (TypeError, ValueError):
            consents = None
    if consents is not None and consents >= 10:
        result["planning"].append(Insight(
            "info",
            f"{consents} resource consents granted within 500m in 2 years — active development area.",
            "Check WCC consent portal for project types. Nearby construction may affect short-term liveability.",
        ).to_dict())

    return result


# =============================================================================
# "Before You Buy" Recommendations Engine
# =============================================================================

@dataclass
class Recommendation:
    """A single actionable recommendation for the 'Before You Buy' section."""
    id: str
    severity: str  # "critical" | "important" | "advisory"
    title: str
    actions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {"id": self.id, "severity": self.severity, "title": self.title, "actions": self.actions}


# Severity sort order: critical first, then important, then advisory
_SEVERITY_ORDER = {"critical": 0, "important": 1, "advisory": 2}


class _SafeFormatDict(dict):
    """Dict subclass for str.format_map() that preserves unknown {placeholders}."""
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def build_recommendations(report: dict, overrides: dict | None = None) -> list[dict]:
    """Run ~40+ rules to generate actionable 'Before You Buy' recommendations.

    Action text comes from DEFAULT_RECOMMENDATIONS templates (admin-editable).
    Templates use {placeholder} syntax, interpolated with live property data.
    Admin overrides can: disable rules, change severity/title, replace actions, add extra actions.
    """
    from ..routers.admin import DEFAULT_RECOMMENDATIONS

    hazards = report.get("hazards") or {}
    env = report.get("environment") or {}
    live = report.get("liveability") or {}
    market = report.get("market") or {}
    planning = report.get("planning") or {}
    prop = report.get("property") or {}

    def _int(v: Any) -> int | None:
        if v is None:
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    def _float(v: Any) -> float | None:
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    # ── Build template context from live property data ────────────────────────

    eq_count = _int(hazards.get("earthquake_count_30km"))
    wf_days = _float(hazards.get("wildfire_vhe_days"))
    noise_db = _float(env.get("road_noise_db"))
    contam_dist = _float(env.get("contam_nearest_distance_m"))
    climate_change = _float(env.get("climate_temp_change"))
    nzdep = _int(live.get("nzdep_decile"))
    crime_pct = _float(live.get("crime_percentile"))
    crashes_serious = _int(live.get("crashes_300m_serious")) or 0
    crashes_fatal = _int(live.get("crashes_300m_fatal")) or 0
    transit = _int(live.get("transit_stops_400m"))
    gp_dist = _float(live.get("nearest_gp_distance_m"))
    if gp_dist is None:
        gp_data = live.get("nearest_gp")
        if isinstance(gp_data, dict):
            gp_dist = _float(gp_data.get("distance_m"))

    schools = live.get("schools_1500m") or live.get("schools") or []
    in_zone_schools_list = [s for s in schools if s.get("in_zone")] if schools else []
    in_zone_count = len(in_zone_schools_list)
    school_names = ", ".join(s.get("name", "Unknown") for s in in_zone_schools_list[:5])

    rental_list = market.get("rental_overview") or []
    cv = _float(prop.get("capital_value") or prop.get("cv_capital"))
    median_rent = None
    if isinstance(rental_list, list):
        all_rental = next(
            (r for r in rental_list if isinstance(r, dict)
             and r.get("dwelling_type") == "House" and r.get("beds") == "ALL"),
            next((r for r in rental_list if isinstance(r, dict) and r.get("beds") == "ALL"), None),
        )
        median_rent = all_rental.get("median") if all_rental else None
    yield_pct = round((median_rent * 52 / cv) * 100, 1) if cv and median_rent and cv > 0 else None

    consents = _int(planning.get("resource_consents_500m_2yr"))
    trans_dist = _float(planning.get("transmission_distance_m") or planning.get("transmission_line_distance_m"))
    heritage_count = _int(planning.get("heritage_count_500m"))
    footprint = _float(prop.get("building_footprint_sqm"))

    # Contamination severity note — tracks the ANZECC hazard class used in
    # risk_score.py:98. Cat A (chemical/refuelling/metal/explosives) is the only
    # class that typically triggers a mandatory Phase-1 ESA for lenders.
    _contam_name_lower = str(env.get("contam_nearest_name") or "").lower()
    _contam_cat_lower = str(env.get("contam_nearest_category") or "").lower()
    _HIGH_RISK_CONTAM = ("chemical", "metal extraction", "explosives", "refuelling", "petrol", "fuel")
    _is_high_contam = (
        any(k in _contam_cat_lower or k in _contam_name_lower for k in _HIGH_RISK_CONTAM)
        or str(env.get("contam_nearest_category") or "").upper() == "A"
    )
    _is_cemetery_waste = (
        "cemeter" in _contam_cat_lower or "cemeter" in _contam_name_lower
        or "waste" in _contam_cat_lower or "landfill" in _contam_cat_lower
    )
    if _is_high_contam:
        contam_severity_note = (
            "This is a high-hazard category site (chemical / refuelling / metals / explosives). "
            "Groundwater plumes can travel 300–2,000m. A Phase-1 ESA is effectively mandatory for mortgage approval."
        )
    elif _is_cemetery_waste:
        contam_severity_note = (
            "This is a low-hazard register entry (cemetery or closed landfill). "
            "These rarely have active soil or groundwater exposure. Informational — LIM check is usually sufficient."
        )
    else:
        contam_severity_note = (
            "Severity depends on the historic land use. Treat as moderate hazard until the Phase-1 ESA clarifies."
        )

    # Climate precipitation projection — used in flood_minor rec so users see
    # how the rainfall-intensity trajectory reshapes a low-probability flood zone.
    # Value is % change in annual precipitation by 2041-2060 (SSP2-4.5) and is
    # genuinely bidirectional in NZ: northern/eastern sites dry slightly, southern/
    # western sites wet. So we compose a directional sentence instead of a single
    # placeholder number.
    climate_precip_pct = _float(env.get("climate_precip_change_pct"))
    if climate_precip_pct is not None and climate_precip_pct >= 5:
        climate_precip_line = (
            f"Climate projections for this SA2 show annual rainfall rising {climate_precip_pct:.0f}% by 2041-2060 "
            f"(SSP2-4.5) — at that trajectory, today's 0.2% AEP zone is projected to behave like a 0.5-1% AEP zone "
            f"within 20-30 years. Reclassification affects insurance and lender treatment."
        )
    elif climate_precip_pct is not None and climate_precip_pct <= -5:
        climate_precip_line = (
            f"Climate projections for this SA2 show annual rainfall falling {abs(climate_precip_pct):.0f}% by 2041-2060 "
            f"(SSP2-4.5). Overall drying reduces average-year flood risk, but extreme storm intensity can still rise "
            f"independently — don't treat this as a safety margin."
        )
    else:
        # Small or null precipitation change — skip the climate line entirely rather
        # than print a misleading "0% change" sentence.
        climate_precip_line = ""

    # Wildfire trend — 'Likely increasing' / 'Very likely increasing' / etc.
    # Skip entirely when raw is missing rather than emit "No wildfire trend data"
    # as a faux-confident bullet in the rec.
    wildfire_trend_raw = hazards.get("wildfire_trend")
    if wildfire_trend_raw:
        wildfire_trend_human, _wft_class = _humanize_wildfire_trend(str(wildfire_trend_raw))
        wildfire_trend_line = f"Trend: {wildfire_trend_human}. This shapes how much the risk compounds over your holding period."
    else:
        wildfire_trend_line = ""

    # 3.1 — Active fault detail line for earthquake_moderate rec. Names the
    # fault and gives slip rate so users see WHICH fault and HOW active.
    _af = hazards.get("active_fault_nearest")
    if isinstance(_af, dict) and _af.get("name") and _af.get("distance_m") is not None:
        try:
            _af_dist = float(_af["distance_m"])
        except (TypeError, ValueError):
            _af_dist = None
        _af_slip = _af.get("slip_rate_mm_yr")
        _af_dist_str = (
            f"{int(_af_dist)}m" if _af_dist is not None and _af_dist < 1000
            else f"{(_af_dist / 1000):.1f}km" if _af_dist is not None else "nearby"
        )
        _af_slip_str = f", slip rate {_af_slip} mm/yr" if _af_slip is not None else ""
        active_fault_line = (
            f"Nearest active fault: {_af['name']}, {_af_dist_str} away{_af_slip_str}. "
            f"Modern code-compliant design mitigates fault-driven shaking — "
            f"verify the original consent file and any seismic assessments on record."
        )
    else:
        active_fault_line = ""

    # 3.3 — Crime context line. Reader-friendly comparison instead of a percentile.
    _crime_vics = live.get("crime_victimisations")
    _crime_med = live.get("crime_city_median_vics") or live.get("crime_city_median")
    try:
        _crime_vics_f = float(_crime_vics) if _crime_vics is not None else None
        _crime_med_f = float(_crime_med) if _crime_med is not None else None
    except (TypeError, ValueError):
        _crime_vics_f = _crime_med_f = None
    if _crime_vics_f is not None and _crime_med_f and _crime_med_f > 0:
        _crime_ratio = _crime_vics_f / _crime_med_f
        crime_vics_line = (
            f"{int(_crime_vics_f)} recorded victimisations in this area unit vs the city median of "
            f"{int(_crime_med_f)} — that's {_crime_ratio:.1f}× the city norm. NZ Police crime maps "
            f"at police.govt.nz/statistics break this into property vs violent crime."
        )
    else:
        crime_vics_line = ""

    # 3.7 — HPI sales volume + 5yr CAGR context for yield_low rec. Yield alone
    # under-prices the capital-gain assumption; pair it with growth + sales to
    # show the real return picture.
    _hpi_latest = (market.get("hpi_latest") or {}) if isinstance(market.get("hpi_latest"), dict) else {}
    _hpi_sales = _hpi_latest.get("sales")
    _trends_list = market.get("trends") or []
    _all_trend = next(
        (t for t in _trends_list if isinstance(t, dict) and t.get("dwelling_type") == "ALL" and t.get("beds") == "ALL"),
        None,
    )
    _cagr_5 = _all_trend.get("cagr_5yr") if _all_trend else None
    if _cagr_5 is not None:
        _sales_str = f" (national sales volume last quarter: {int(_hpi_sales):,})" if _hpi_sales else ""
        hpi_sales_line = (
            f"5-year rental growth in this area averaged {_cagr_5:.1f}%/yr{_sales_str}. "
            f"Yield alone doesn't price the capital-gain assumption — if growth reverts to long-run NZ "
            f"3-4% real, this deal needs leverage or rent growth to make sense."
        )
    else:
        hpi_sales_line = ""

    # 3.9 — Pharmacy line for gp_far rec. Combining GP + pharmacy distance is
    # the more useful signal than GP alone.
    _ph = live.get("nearest_pharmacy")
    _ph_dist_m = None
    if isinstance(_ph, dict):
        try:
            _ph_dist_m = float(_ph.get("distance_m")) if _ph.get("distance_m") is not None else None
        except (TypeError, ValueError):
            pass
    if _ph_dist_m is not None:
        if _ph_dist_m >= 2000:
            pharmacy_line = (
                f"Pharmacy is also {int(_ph_dist_m)}m away — with neither GP nor pharmacy in walking range, "
                f"a car or pharmacy delivery service is essential for daily medication users."
            )
        elif _ph_dist_m <= 500:
            pharmacy_line = (
                f"Pharmacy is closer ({int(_ph_dist_m)}m) — useful for repeats even when the GP visit means a drive."
            )
        else:
            pharmacy_line = ""
    else:
        pharmacy_line = ""

    # 3.10 — Noise stack: aircraft + rail vibration context for noise_high rec.
    # Three noise datasets exist; the existing rec only speaks about road.
    _aircraft_dba = hazards.get("aircraft_noise_dba")
    _aircraft_name = hazards.get("aircraft_noise_name")
    _rail_vib = env.get("in_rail_vibration_area")
    _noise_extras = []
    try:
        _aircraft_dba_f = float(_aircraft_dba) if _aircraft_dba is not None else None
    except (TypeError, ValueError):
        _aircraft_dba_f = None
    if _aircraft_dba_f is not None and _aircraft_dba_f >= 55:
        _noise_extras.append(
            f"aircraft noise overlay ({_aircraft_name or 'mapped'}, {int(_aircraft_dba_f)} dBA)"
        )
    if _rail_vib:
        _noise_extras.append("rail vibration advisory area")
    if _noise_extras:
        noise_stack_line = (
            f"This site also sits within {' and '.join(_noise_extras)}. Cumulative exposure can exceed "
            f"WHO sleep-disturbance thresholds on most nights — double glazing alone may not be enough; "
            f"factor in mechanical ventilation so windows can stay closed without overheating."
        )
    else:
        noise_stack_line = ""

    # 3.6 — Transmission line tier line. Current rec fires the same text for a
    # property 15m from the line (inside easement — title-level restriction,
    # lender LVR cap) and 195m away (awareness only). Split into three tiers:
    #   ≤25m  easement-probable (Transpower easement corridors are typically
    #          ~25m each side of the line centreline)
    #   ≤100m NPSET setback-buffer (National Policy Statement on Electricity
    #          Transmission — council may impose conditions on new builds)
    #   ≤200m awareness-only (EMF falls off ~1/d²; no legal restriction)
    if trans_dist is not None:
        if trans_dist <= 25:
            transmission_tier_line = (
                f"Line is {int(trans_dist)}m away — within the typical Transpower easement corridor. "
                f"The certificate of title will almost certainly carry an easement: development, tree planting, "
                f"and building alterations inside the corridor are all restricted. Some lenders apply LVR caps "
                f"or decline to lend altogether on easement properties."
            )
        elif trans_dist <= 100:
            transmission_tier_line = (
                f"Line is {int(trans_dist)}m away — outside the usual easement but inside the NPSET "
                f"setback buffer. New builds and major alterations here may trigger council conditions. "
                f"EMF measurement is available from the property boundary (Transpower publishes it on request)."
            )
        else:
            transmission_tier_line = (
                f"Line is {int(trans_dist)}m away — outside both the easement and the NPSET setback buffer. "
                f"No legal development restriction at this distance; EMF falls off rapidly with distance. "
                f"Informational only — Transpower's EMF info is public if you want baseline numbers."
            )
    else:
        transmission_tier_line = ""

    # 3.11 — Maintenance line for large_footprint rec. Use improvements_value
    # (the bit that depreciates) instead of full CV when available — gives a
    # more honest annual maintenance budget. Fall back to a CV-based estimate
    # when improvements_value is null (only ~33% of council valuations carry it).
    _imp_value = _float(prop.get("improvements_value"))
    if _imp_value and _imp_value > 0:
        _maint_low = int(_imp_value * 0.01)
        _maint_high = int(_imp_value * 0.02)
        maintenance_line = (
            f"Building improvements are valued at ${int(_imp_value):,} — at 1-2% maintenance per year "
            f"that's ${_maint_low:,}-${_maint_high:,}. Land doesn't depreciate; the improvements value "
            f"is what actually wears out."
        )
    elif cv and cv > 0:
        # Estimate building portion at ~50% of CV — typical for NZ residential where
        # land often makes up a large share of value. Conservative range.
        _est_imp = cv * 0.5
        _maint_low = int(_est_imp * 0.01)
        _maint_high = int(_est_imp * 0.02)
        maintenance_line = (
            f"Building improvements aren't separately valued for this property, but estimating ~50% of "
            f"the ${int(cv):,} CV as building gives a 1-2% maintenance budget of "
            f"${_maint_low:,}-${_maint_high:,}/year."
        )
    else:
        maintenance_line = ""

    ctx = _SafeFormatDict({
        "earthquake_count": eq_count or 0,
        "active_fault_line": active_fault_line,
        "crime_vics_line": crime_vics_line,
        "hpi_sales_line": hpi_sales_line,
        "pharmacy_line": pharmacy_line,
        "noise_stack_line": noise_stack_line,
        "maintenance_line": maintenance_line,
        "transmission_tier_line": transmission_tier_line,
        "wildfire_days": int(wf_days) if wf_days else 0,
        "wildfire_trend_line": wildfire_trend_line,
        "epb_count_300m": _int(hazards.get("epb_count_300m")) or 0,
        "noise_db": int(noise_db) if noise_db else 0,
        "contam_name": env.get("contam_nearest_name", "unknown site"),
        "contam_category": env.get("contam_nearest_category", ""),
        "contam_distance_m": int(contam_dist) if contam_dist else 0,
        "contam_severity_note": contam_severity_note,
        "climate_temp_change": f"{climate_change:.1f}" if climate_change else "0",
        "climate_precip_line": climate_precip_line,
        "nzdep_decile": nzdep or 0,
        "crime_percentile": int(crime_pct) if crime_pct else 0,
        "total_serious_fatal_crashes": crashes_serious + crashes_fatal,
        "in_zone_school_count": in_zone_count,
        "school_names": school_names or "none",
        "transit_stops_400m": transit or 0,
        "transit_s": "s" if transit != 1 else "",
        "gp_distance_m": int(gp_dist) if gp_dist else 0,
        "yield_pct": yield_pct or 0,
        "resource_consents_500m": consents or 0,
        "transmission_distance_m": int(trans_dist) if trans_dist else 0,
        "heritage_count_500m": heritage_count or 0,
        "building_footprint_sqm": int(footprint) if footprint else 0,
        "slope_failure_class": str(hazards.get("slope_failure") or "None"),
    })

    # ── Build defaults lookup ─────────────────────────────────────────────────

    defaults_by_id = {r["id"]: r for r in DEFAULT_RECOMMENDATIONS}

    def _make(rule_id: str) -> Recommendation:
        """Create a Recommendation using template actions, with override support."""
        dflt = defaults_by_id.get(rule_id, {})
        ovr = (overrides or {}).get(rule_id, {})

        severity = ovr.get("severity") or dflt.get("severity", "advisory")
        title = ovr.get("title") or dflt.get("title", rule_id)

        # Resolve action templates
        if ovr.get("actions"):
            templates = list(ovr["actions"])
        else:
            templates = list(dflt.get("default_actions", []))
            extra = ovr.get("extra_actions") or []
            if extra:
                templates.extend(extra)

        # Interpolate placeholders safely. Drop any action that resolves to an
        # empty string — rec templates can carry conditional placeholders (e.g.
        # climate_precip_line) that compute to "" when the signal isn't applicable.
        actions = []
        for t in templates:
            try:
                resolved = t.format_map(ctx)
            except (KeyError, ValueError, IndexError):
                resolved = t
            if resolved and resolved.strip():
                actions.append(resolved)

        return Recommendation(id=rule_id, severity=severity, title=title, actions=actions)

    def _is_disabled(rule_id: str) -> bool:
        return bool((overrides or {}).get(rule_id, {}).get("disabled"))

    # ── Rule trigger logic (unchanged) ────────────────────────────────────────

    recs: list[Recommendation] = []

    # A. UNIVERSAL (always shown)
    for uid in ("universal_lim", "universal_builders_report", "universal_conveyancing", "universal_insurance"):
        if not _is_disabled(uid):
            recs.append(_make(uid))

    # B. HAZARDS
    flood = str(hazards.get("flood") or "").lower()
    if "1%" in flood or "100" in flood:
        if not _is_disabled("flood_zone"):
            recs.append(_make("flood_zone"))
    elif "0.2%" in flood or "430" in flood:
        if not _is_disabled("flood_minor"):
            recs.append(_make("flood_minor"))

    liq_raw = str(hazards.get("liquefaction") or "").lower()
    if "very high" in liq_raw or ("high" in liq_raw and "very" not in liq_raw.replace("very high", "")):
        if not _is_disabled("liquefaction_high"):
            recs.append(_make("liquefaction_high"))
    elif "moderate" in liq_raw:
        if not _is_disabled("liquefaction_mod"):
            recs.append(_make("liquefaction_mod"))

    if eq_count is not None and eq_count >= 20:
        if not _is_disabled("earthquake_active"):
            recs.append(_make("earthquake_active"))
    elif eq_count is not None and eq_count >= 10:
        if not _is_disabled("earthquake_moderate"):
            recs.append(_make("earthquake_moderate"))

    wind = str(hazards.get("wind_zone") or "").upper()
    if wind in ("EH", "SED", "VH"):
        if not _is_disabled("wind_extreme"):
            recs.append(_make("wind_extreme"))

    tz_class = _int(hazards.get("tsunami_zone_class"))
    if tz_class is not None and tz_class >= 2:
        if not _is_disabled("tsunami_zone"):
            recs.append(_make("tsunami_zone"))

    if wf_days is not None and wf_days >= 15:
        if not _is_disabled("wildfire_high"):
            recs.append(_make("wildfire_high"))

    epb_count = _int(hazards.get("epb_count_300m"))
    if epb_count is not None and epb_count >= 5:
        if not _is_disabled("epb_nearby"):
            recs.append(_make("epb_nearby"))

    erosion_raw = str(hazards.get("coastal_erosion") or "").lower()
    if "extreme" in erosion_raw or "high" in erosion_raw:
        if not _is_disabled("coastal_erosion_high"):
            recs.append(_make("coastal_erosion_high"))
    elif "medium" in erosion_raw:
        if not _is_disabled("coastal_erosion_mod"):
            recs.append(_make("coastal_erosion_mod"))

    # Slope failure
    sf = str(hazards.get("slope_failure") or "").lower()
    if "very high" in sf or ("high" in sf and "very" not in sf):
        if not _is_disabled("slope_failure_high"):
            recs.append(_make("slope_failure_high"))
    elif "medium" in sf:
        if not _is_disabled("slope_failure_moderate"):
            recs.append(_make("slope_failure_moderate"))

    # 2.1 — Compounding seismic vulnerability (slope + liquefaction both High).
    # Fires IN ADDITION to slope_failure_high or liquefaction_high — the combined
    # geotech assessment cost ($5k–$8k) is the new information.
    _slope_high_rec = "high" in sf
    _liq_high_rec = any(
        "high" in str(hazards.get(k) or "").lower()
        for k in ("liquefaction", "gwrc_liquefaction", "council_liquefaction")
    )
    if _slope_high_rec and _liq_high_rec and not _is_disabled("compounding_seismic"):
        recs.append(_make("compounding_seismic"))

    # 2.10 — Saturated slope (slope medium+ + nearby surface water).
    # Fires IN ADDITION to the slope_failure rec — adds the drainage-focused
    # action checklist that a generic slope report wouldn't necessarily include.
    _slope_med_or_high_rec = ("medium" in sf) or _slope_high_rec
    _terrain_for_rec = report.get("terrain") or {}
    _waterway_for_rec = _terrain_for_rec.get("nearest_waterway_m")
    try:
        _waterway_close = (
            _waterway_for_rec is not None and float(_waterway_for_rec) <= 50
        )
    except (TypeError, ValueError):
        _waterway_close = False
    _surface_water = (
        bool(hazards.get("overland_flow_within_50m"))
        or bool(_terrain_for_rec.get("is_depression"))
        or _waterway_close
    )
    if _slope_med_or_high_rec and _surface_water and not _is_disabled("saturated_slope"):
        recs.append(_make("saturated_slope"))

    # C. ENVIRONMENT
    if noise_db is not None and noise_db >= 65:
        if not _is_disabled("noise_high"):
            recs.append(_make("noise_high"))
    elif noise_db is not None and noise_db >= 55:
        if not _is_disabled("noise_moderate"):
            recs.append(_make("noise_moderate"))

    air_trend = env.get("air_pm10_trend") or env.get("air_pm25_trend")
    if air_trend and str(air_trend).lower() == "degrading":
        if not _is_disabled("air_degrading"):
            recs.append(_make("air_degrading"))

    water_band = env.get("water_ecoli_band")
    if water_band and str(water_band).upper() in ("D", "E"):
        if not _is_disabled("water_poor"):
            recs.append(_make("water_poor"))

    if contam_dist is not None and contam_dist <= 200:
        if not _is_disabled("contamination_nearby"):
            recs.append(_make("contamination_nearby"))

    if climate_change is not None and climate_change >= 2.0:
        if not _is_disabled("climate_warming"):
            recs.append(_make("climate_warming"))

    # D. LIVEABILITY
    if nzdep is not None and nzdep >= 8:
        if not _is_disabled("deprivation_high"):
            recs.append(_make("deprivation_high"))

    if crime_pct is not None and crime_pct >= 75:
        if not _is_disabled("crime_high"):
            recs.append(_make("crime_high"))

    if crashes_serious + crashes_fatal >= 3:
        if not _is_disabled("crashes_nearby"):
            recs.append(_make("crashes_nearby"))

    if in_zone_count >= 3:
        if not _is_disabled("schools_in_zone_many"):
            recs.append(_make("schools_in_zone_many"))
    elif in_zone_count >= 1:
        if not _is_disabled("schools_in_zone_few"):
            recs.append(_make("schools_in_zone_few"))
    elif in_zone_count == 0 and schools:
        if not _is_disabled("schools_no_zone"):
            recs.append(_make("schools_no_zone"))

    if transit is not None and transit <= 2:
        if not _is_disabled("transit_poor"):
            recs.append(_make("transit_poor"))
    elif transit is not None and transit >= 10:
        if not _is_disabled("transit_good"):
            recs.append(_make("transit_good"))

    if gp_dist is not None and gp_dist >= 2000:
        if not _is_disabled("gp_far"):
            recs.append(_make("gp_far"))

    # E. MARKET
    if yield_pct is not None and yield_pct < 3.0:
        if not _is_disabled("yield_low"):
            recs.append(_make("yield_low"))
    elif yield_pct is not None and yield_pct >= 5.0:
        if not _is_disabled("yield_good"):
            recs.append(_make("yield_good"))

    if isinstance(rental_list, list):
        for r in rental_list:
            if isinstance(r, dict) and r.get("yoy_pct") is not None:
                yoy = _float(r.get("yoy_pct"))
                if yoy is not None and yoy >= 5.0:
                    if not _is_disabled("rents_rising"):
                        recs.append(_make("rents_rising"))
                    break

    if consents is not None and consents >= 15:
        if not _is_disabled("market_active_development"):
            recs.append(_make("market_active_development"))

    # F. PLANNING
    if planning.get("is_epb_listed"):
        if not _is_disabled("epb_listed"):
            recs.append(_make("epb_listed"))

    if planning.get("is_contaminated"):
        if not _is_disabled("contaminated_land"):
            recs.append(_make("contaminated_land"))

    if planning.get("is_heritage_listed"):
        if not _is_disabled("heritage_listed"):
            recs.append(_make("heritage_listed"))

    if trans_dist is not None and trans_dist <= 200:
        if not _is_disabled("transmission_lines"):
            recs.append(_make("transmission_lines"))

    if heritage_count is not None and heritage_count >= 20:
        if not _is_disabled("heritage_area"):
            recs.append(_make("heritage_area"))

    # G. PROPERTY-SPECIFIC
    is_multi_unit = bool(prop.get("unit_count") and _int(prop.get("unit_count")) and _int(prop.get("unit_count")) > 1)
    if is_multi_unit:
        if not _is_disabled("multi_unit_body_corp"):
            recs.append(_make("multi_unit_body_corp"))

    cv_date = prop.get("cv_date") or prop.get("building_age") or prop.get("valuation_date")
    if cv_date:
        try:
            year = int(str(cv_date)[:4])
            if 1994 <= year <= 2004:
                if not _is_disabled("leaky_era"):
                    recs.append(_make("leaky_era"))
        except (TypeError, ValueError):
            pass

    if footprint is not None and footprint >= 300:
        if not _is_disabled("large_footprint"):
            recs.append(_make("large_footprint"))

    # Sort: critical → important → advisory, stable within same severity
    recs.sort(key=lambda r: _SEVERITY_ORDER.get(r.severity, 99))

    return [r.to_dict() for r in recs]


# =============================================================================
# Lifestyle Fit Engine
# =============================================================================

def build_lifestyle_fit(report: dict) -> tuple[list[dict], list[str]]:
    """Returns (persona_cards, practical_tips) from existing data — no fabrication."""
    live = report.get("liveability") or {}
    env = report.get("environment") or {}
    market = report.get("market") or {}
    planning = report.get("planning") or {}
    prop = report.get("property") or {}
    addr = report.get("address") or {}

    def _int(v: Any) -> int | None:
        if v is None:
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    def _float(v: Any) -> float | None:
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    transit = _int(live.get("transit_stops_400m"))
    cbd_dist = _float(live.get("cbd_distance_m")) or _float(addr.get("cbd_distance_m"))
    nzdep = _int(live.get("nzdep_decile"))
    noise_db = _float(env.get("road_noise_db"))
    schools = live.get("schools") or []
    gp_dist = _float(live.get("nearest_gp_distance_m"))
    supermarket_dist = _float(live.get("nearest_supermarket_distance_m"))
    supermarket_name = live.get("nearest_supermarket_name")
    train_dist = _float(live.get("nearest_train_distance_m"))
    train_name = live.get("nearest_train_name")
    crash_serious = _int(live.get("crashes_300m_serious")) or 0
    crash_fatal = _int(live.get("crashes_300m_fatal")) or 0
    amenities = live.get("amenities_500m") or {}
    is_multi_unit = bool(prop.get("unit_count") and _int(prop.get("unit_count", 1)) and _int(prop.get("unit_count", 1)) > 1)  # type: ignore[arg-type]
    zone = str(planning.get("zone_name") or "").lower()
    conservation_dist = _float(live.get("conservation_nearest_distance_m"))
    conservation_name = live.get("conservation_nearest_name")
    conservation_type = live.get("conservation_nearest_type")
    rental_list = market.get("rental_overview") or []
    cv = _float(prop.get("capital_value") or prop.get("cv_capital"))

    # best school EQI (lower = better)
    best_eqi = min((s.get("eqi") for s in schools if s.get("eqi")), default=None) if schools else None
    in_zone_school = any(s.get("in_zone") for s in schools) if schools else False

    # median rent & yield
    all_rental = None
    if isinstance(rental_list, list):
        all_rental = next(
            (r for r in rental_list if isinstance(r, dict) and r.get("beds") == "ALL"), None
        )
    median_rent = all_rental.get("median") if all_rental else None
    yoy_pct = None
    if isinstance(market.get("trends"), list):
        t = next(
            (x for x in market["trends"] if isinstance(x, dict)
             and x.get("dwelling_type") == "ALL" and x.get("beds") == "ALL"),
            None,
        )
        yoy_pct = t.get("yoy_pct") if t else None
    yield_pct: float | None = None
    if cv and median_rent and cv > 0:
        yield_pct = round((median_rent * 52 / cv) * 100, 1)

    cafe_count = _int(amenities.get("cafe")) or 0
    restaurant_count = _int(amenities.get("restaurant")) or 0

    # ── Personas ──────────────────────────────────────────────────────────────
    personas: list[dict] = []

    # Young professionals / couples
    yp_fits = []
    yp_caveats = []
    if cbd_dist is not None and cbd_dist <= 2000:
        yp_fits.append(f"{int(cbd_dist)}m to CBD")
    if transit is not None and transit >= 8:
        yp_fits.append(f"{transit} transit stops nearby")
    if cafe_count + restaurant_count >= 10:
        yp_fits.append(f"{cafe_count + restaurant_count} cafes/restaurants within 500m")
    if nzdep is not None and nzdep <= 6:
        yp_fits.append("low-moderate deprivation area")
    if noise_db is not None and noise_db >= 60:
        yp_caveats.append(f"{int(noise_db)} dB road noise")
    if yp_fits:
        personas.append({
            "persona": "Young Professionals / Couples",
            "fits": yp_fits,
            "caveats": yp_caveats,
        })

    # Families with children
    fam_fits = []
    fam_caveats = []
    if best_eqi is not None and best_eqi <= 460 and in_zone_school:
        fam_fits.append(f"In-zone school with EQI {best_eqi}")
    if crash_serious + crash_fatal <= 1:
        fam_fits.append("low serious crash history")
    if conservation_dist is not None and conservation_dist <= 1000:
        fam_fits.append(f"green space {int(conservation_dist)}m away")
    if nzdep is not None and nzdep > 5:
        fam_caveats.append(f"NZDep decile {nzdep}")
    if crash_serious + crash_fatal >= 3:
        fam_caveats.append(f"{crash_serious + crash_fatal} serious crashes nearby")
    if fam_fits or (best_eqi is not None):
        personas.append({
            "persona": "Families with Children",
            "fits": fam_fits,
            "caveats": fam_caveats,
        })

    # Investors
    inv_fits = []
    inv_caveats = []
    if yield_pct is not None and yield_pct >= 4:
        inv_fits.append(f"{yield_pct}% indicative gross yield")
    if yoy_pct is not None and yoy_pct > 0:
        inv_fits.append(f"rents up {yoy_pct:+.1f}% YoY")
    if "mixed use" in zone or "commercial" in zone or "city centre" in zone:
        inv_fits.append("zone allows intensification")
    if yield_pct is not None and yield_pct < 3:
        inv_caveats.append(f"low yield ({yield_pct}%)")
    if inv_fits or cv:
        personas.append({
            "persona": "Investors / Landlords",
            "fits": inv_fits,
            "caveats": inv_caveats,
        })

    # Retirees / downsizers
    ret_fits = []
    ret_caveats = []
    if transit is not None and transit >= 6:
        ret_fits.append(f"{transit} transit stops within 400m")
    if gp_dist is not None and gp_dist <= 1000:
        ret_fits.append(f"GP {int(gp_dist)}m away")
    if noise_db is not None and noise_db < 55:
        ret_fits.append(f"quiet ({int(noise_db)} dB)")
    if gp_dist is not None and gp_dist > 2000:
        ret_caveats.append(f"GP is {int(gp_dist)}m away")
    if noise_db is not None and noise_db >= 65:
        ret_caveats.append(f"{int(noise_db)} dB road noise")
    if ret_fits:
        personas.append({
            "persona": "Retirees / Downsizers",
            "fits": ret_fits,
            "caveats": ret_caveats,
        })

    # Car-free renters
    cf_fits = []
    cf_caveats = []
    if transit is not None and transit >= 6:
        cf_fits.append(f"{transit} transit stops within 400m")
    if supermarket_dist is not None and supermarket_dist <= 500:
        cf_fits.append(f"supermarket {int(supermarket_dist)}m away")
    if cbd_dist is not None and cbd_dist <= 2000:
        cf_fits.append(f"CBD {int(cbd_dist)}m")
    if transit is not None and transit <= 2:
        cf_caveats.append("limited public transport")
    if supermarket_dist is not None and supermarket_dist > 1000:
        cf_caveats.append(f"supermarket {int(supermarket_dist)}m")
    if cf_fits:
        personas.append({
            "persona": "Car-Free Renters",
            "fits": cf_fits,
            "caveats": cf_caveats,
        })

    # ── Practical Tips ────────────────────────────────────────────────────────
    tips: list[str] = []

    if noise_db is not None and noise_db >= 60 and is_multi_unit:
        tips.append(
            "Higher floors in this building are likely to be meaningfully quieter — "
            "ask which floor before committing."
        )

    if transit is not None and transit >= 8 and supermarket_dist is not None:
        tips.append(
            f"With {transit} bus stops within 400m, a car is optional for city errands. "
            f"The nearest supermarket is {int(supermarket_dist)}m away"
            + (" — manageable on foot." if supermarket_dist <= 600 else ".")
        )

    if cbd_dist is not None and cbd_dist <= 1500:
        tips.append(
            f"Being {int(cbd_dist)}m from the CBD, street parking is limited — "
            "if you have a car, factor in a parking space (~$200–350/month in central areas)."
        )

    if supermarket_dist is not None and supermarket_dist >= 1000:
        name_str = f" ({supermarket_name})" if supermarket_name else ""
        tips.append(
            f"The nearest supermarket{name_str} is {int(supermarket_dist)}m away — "
            "you'll want a car or regular delivery for the weekly shop."
        )

    if gp_dist is not None and gp_dist >= 2000:
        tips.append(
            f"Nearest GP is {int(gp_dist)}m away — consider this if healthcare access is important to your household."
        )

    if transit is not None and transit <= 2:
        stop_name = live.get("nearest_stop_name") or "nearest stop"
        tips.append(
            f"Limited public transport here. Nearest stop: {stop_name}. "
            "If car-free, check bus frequency before committing."
        )

    if train_dist is not None and train_name and train_dist <= 800:
        tips.append(
            f"Train station ({train_name}) is {int(train_dist)}m — commuting to the CBD by train is practical."
        )

    if conservation_dist is not None and conservation_name and conservation_dist <= 500:
        type_str = f" ({conservation_type})" if conservation_type else ""
        tips.append(
            f"{conservation_name}{type_str} is {int(conservation_dist)}m away — "
            "good access to green space for exercise and recreation."
        )

    return personas, tips


# =============================================================================
# Phase 4: Premium PDF Toolkit — Comparison Bars, Rent Bars, Checklist
# =============================================================================

def _build_comparison_bars(report: dict, suburb_name: str = "") -> list[dict]:
    """Build comparison bar data for property vs suburb vs city metrics."""
    comparisons = report.get("comparisons") or {}
    liveability = report.get("liveability") or {}
    hazards = report.get("hazards") or {}
    environment = report.get("environment") or {}
    area = suburb_name or "the suburb"

    suburb = comparisons.get("suburb") or {}
    city = comparisons.get("city") or {}

    def _safe_float(v: Any) -> float | None:
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    metrics = [
        {
            "label": "NZDep Score",
            "property_value": _safe_float(liveability.get("nzdep_score") or liveability.get("nzdep_decile")),
            "suburb_avg": _safe_float(suburb.get("avg_nzdep")),
            "city_avg": _safe_float(city.get("avg_nzdep")),
            "max_value": 10,
            "lower_is_better": True,
        },
        {
            "label": "Schools Nearby",
            "property_value": _safe_float(liveability.get("school_count") or (
                len(liveability.get("schools_1500m") or liveability.get("schools") or [])
            )),
            "suburb_avg": _safe_float(suburb.get("school_count_1500m")),
            "city_avg": _safe_float(city.get("school_count_1500m")),
            "max_value": 15,
            "lower_is_better": False,
        },
        {
            "label": "Transit Stops",
            "property_value": _safe_float(liveability.get("transit_count") or liveability.get("transit_stops_400m")),
            "suburb_avg": _safe_float(suburb.get("transit_count_400m")),
            "city_avg": _safe_float(city.get("transit_count_400m")),
            "max_value": 20,
            "lower_is_better": False,
        },
        {
            "label": "Road Noise (dB)",
            "property_value": _safe_float(environment.get("noise_db") or environment.get("road_noise_db")),
            "suburb_avg": _safe_float(suburb.get("max_noise_db")),
            "city_avg": _safe_float(city.get("max_noise_db")),
            "max_value": 80,
            "lower_is_better": True,
        },
        {
            "label": "EPBs (300m)",
            "property_value": _safe_float(hazards.get("epb_count") or hazards.get("epb_count_300m")),
            "suburb_avg": _safe_float(suburb.get("epb_count_300m")),
            "city_avg": _safe_float(city.get("epb_count_300m")),
            "max_value": 10,
            "lower_is_better": True,
        },
    ]

    bars: list[dict] = []
    for m in metrics:
        prop_val = m["property_value"]
        if prop_val is None:
            continue

        sub_val = m["suburb_avg"]
        cty_val = m["city_avg"]

        # Dynamic max: use the larger of the fixed max or any actual value
        max_val = m["max_value"]
        for v in (prop_val, sub_val, cty_val):
            if v is not None and v > max_val:
                max_val = v

        if max_val <= 0:
            max_val = 1  # prevent division by zero

        # Generate contextual insight sentence
        insight = ""
        sentiment = "neutral"
        if sub_val is not None and sub_val > 0:
            diff = prop_val - sub_val
            abs_diff = abs(diff)
            ratio = prop_val / sub_val
            pct_diff = abs(ratio - 1) * 100
            is_more = diff > 0
            lower_better = m["lower_is_better"]
            is_good = (not is_more) if lower_better else is_more
            sentiment = "positive" if is_good else "negative"

            if pct_diff < 15:
                insight = f"Typical for {area}"
                sentiment = "neutral"
            elif "school" in m["label"].lower():
                d = round(abs_diff)
                insight = f"{d} {'more' if is_more else 'fewer'} school{'s' if d != 1 else ''} than {area} average"
            elif "transit" in m["label"].lower():
                d = round(abs_diff)
                insight = f"{d} {'more' if is_more else 'fewer'} stop{'s' if d != 1 else ''} than {area} average"
            elif "noise" in m["label"].lower():
                d = round(abs_diff)
                insight = f"{d} dB {'louder' if is_more else 'quieter'} than {area} average"
            elif "nzdep" in m["label"].lower() or "deprivation" in m["label"].lower():
                if is_more:
                    insight = f"More deprived than {area} average"
                else:
                    insight = f"Less deprived than {area} average"
            elif "epb" in m["label"].lower():
                if prop_val == 0:
                    insight = f"None nearby — better than {area} average"
                    sentiment = "positive"
                else:
                    d = round(abs_diff)
                    insight = f"{d} {'more' if is_more else 'fewer'} than {area} average"
            else:
                pct_round = round(pct_diff)
                qual = "higher" if is_more else "lower"
                insight = f"{pct_round}% {qual} than {area} average"

        # Determine unit suffix
        unit = ""
        if "db" in m["label"].lower() or "noise" in m["label"].lower():
            unit = " dB"
        elif "nzdep" in m["label"].lower() or "deprivation" in m["label"].lower():
            unit = "/10"

        bars.append({
            "label": m["label"],
            "property_value": prop_val,
            "suburb_avg": sub_val,
            "city_avg": cty_val,
            "max_value": max_val,
            "property_pct": round((prop_val / max_val) * 100, 1),
            "suburb_pct": round((sub_val / max_val) * 100, 1) if sub_val is not None else None,
            "city_pct": round((cty_val / max_val) * 100, 1) if cty_val is not None else None,
            "lower_is_better": m["lower_is_better"],
            "insight": insight,
            "sentiment": sentiment,
            "unit": unit,
        })

    return bars


def _build_radar_chart(categories: dict) -> dict | None:
    """Build SVG data for a 5-axis radar/spider chart of category scores.

    Returns a dict with:
      - axes: list of {name, label, score, color, x_label, y_label}
      - polygon_points: SVG polygon points string for the score shape
      - grid_rings: list of {points, value} for concentric grid rings
    """
    import math

    LABELS = {
        "risk": "Risk",
        "liveability": "Neighbourhood",
        "market": "Market",
        "transport": "Transport",
        "planning": "Planning",
    }
    AXIS_ORDER = ["risk", "liveability", "market", "transport", "planning"]

    axes: list[dict] = []
    for name in AXIS_ORDER:
        data = categories.get(name)
        if not data or not isinstance(data, dict):
            continue
        s = data.get("score")
        if s is None:
            continue
        axes.append({
            "name": name,
            "label": LABELS.get(name, name.title()),
            "score": float(s),
            "color": data.get("color", "#0D7377"),
        })

    if len(axes) < 3:
        return None

    n = len(axes)
    cx, cy = 150, 150  # center of 300x300 viewBox
    max_r = 120         # radius of outermost ring

    def _point(axis_idx: int, value: float) -> tuple[float, float]:
        """Compute (x, y) for a value (0-100) on the given axis."""
        angle = (2 * math.pi * axis_idx / n) - (math.pi / 2)  # start from top
        r = (value / 100) * max_r
        return (round(cx + r * math.cos(angle), 1), round(cy + r * math.sin(angle), 1))

    # Build axis label positions (just outside the chart)
    label_r = max_r + 22
    for i, ax in enumerate(axes):
        angle = (2 * math.pi * i / n) - (math.pi / 2)
        ax["x_label"] = round(cx + label_r * math.cos(angle), 1)
        ax["y_label"] = round(cy + label_r * math.sin(angle), 1)
        # text-anchor hint
        if abs(math.cos(angle)) < 0.1:
            ax["anchor"] = "middle"
        elif math.cos(angle) > 0:
            ax["anchor"] = "start"
        else:
            ax["anchor"] = "end"

    # Grid rings at 20, 40, 60, 80, 100
    grid_rings = []
    for ring_val in [20, 40, 60, 80, 100]:
        pts = " ".join(f"{_point(i, ring_val)[0]},{_point(i, ring_val)[1]}" for i in range(n))
        grid_rings.append({"points": pts, "value": ring_val})

    # Grid spokes (lines from center to each axis at 100)
    spokes = []
    for i in range(n):
        x, y = _point(i, 100)
        spokes.append({"x": x, "y": y})

    # Score polygon
    score_pts = " ".join(f"{_point(i, ax['score'])[0]},{_point(i, ax['score'])[1]}" for i, ax in enumerate(axes))

    # Score dots (individual points on the polygon)
    score_dots = []
    for i, ax in enumerate(axes):
        x, y = _point(i, ax["score"])
        score_dots.append({"x": x, "y": y, "color": ax["color"], "score": round(ax["score"])})

    return {
        "axes": axes,
        "polygon_points": score_pts,
        "grid_rings": grid_rings,
        "spokes": spokes,
        "score_dots": score_dots,
        "cx": cx,
        "cy": cy,
    }


def _build_hazard_bars(report: dict) -> list[dict]:
    """Build horizontal bar chart data for individual hazard indicators."""
    scores_data = report.get("scores") or {}
    raw_cats = scores_data.get("categories") or {}

    risk_cat = raw_cats.get("risk")
    if not risk_cat or not isinstance(risk_cat, dict):
        return []

    indicators = risk_cat.get("indicators") or []
    bars = []
    for ind in indicators:
        if not isinstance(ind, dict):
            continue
        if not ind.get("is_available", True):
            continue
        score = ind.get("score")
        if score is None:
            continue
        score = float(score)

        # Color based on score
        if score <= 20:
            color = "#0D7377"
        elif score <= 40:
            color = "#56B4E9"
        elif score <= 60:
            color = "#E69F00"
        elif score <= 80:
            color = "#D55E00"
        else:
            color = "#C42D2D"

        bars.append({
            "name": ind.get("name", "Unknown"),
            "score": round(score),
            "value": ind.get("value", ""),
            "color": color,
            "pct": min(round(score), 100),
        })

    # Sort by score descending so highest risk is at top
    bars.sort(key=lambda b: b["score"], reverse=True)
    return bars


def _build_rent_bars(report: dict) -> list[dict]:
    """Build bar chart data from rent history — last 5 periods."""
    rent_history = report.get("rent_history") or {}
    data = rent_history.get("data") or []

    if not data:
        return []

    # Take last 5 entries
    recent = data[-5:] if len(data) > 5 else data

    # Find max median for percentage calculation
    max_median = max(
        (float(entry.get("median", 0)) for entry in recent if entry.get("median") is not None),
        default=0,
    )
    if max_median <= 0:
        return []

    bars: list[dict] = []
    for entry in recent:
        median = entry.get("median")
        if median is None:
            continue
        try:
            median_f = float(median)
        except (TypeError, ValueError):
            continue
        bars.append({
            "period": entry.get("period") or entry.get("date") or "—",
            "median": median_f,
            "pct": round((median_f / max_median) * 100, 1),
        })

    return bars


def _build_checklist(insights: list) -> dict:
    """Build a printable before-you-buy checklist grouped by priority."""
    # Static checklist items — the insights/red_flags inform which are most relevant
    # but we always show the full checklist for the PDF
    essential = [
        {"text": "Check MBIE earthquake-prone building register for this address", "checked": False},
        {"text": "Confirm property is not in a 1-in-100-year flood zone (or obtain flood risk assessment)", "checked": False},
        {"text": "Check GWRC contaminated land register (SLUR) for this property and surrounds", "checked": False},
    ]
    recommended = [
        {"text": "Obtain a current LIM (Land Information Memorandum) from the council", "checked": False},
        {"text": "Commission a registered building inspection / builder's report", "checked": False},
        {"text": "Obtain home and contents insurance quote before going unconditional", "checked": False},
        {"text": "Order a title search and check for easements, covenants, and caveats", "checked": False},
    ]
    optional = [
        {"text": "Conduct a noise assessment — visit at peak traffic times", "checked": False},
        {"text": "Verify school enrolment zone boundaries with the Ministry of Education", "checked": False},
        {"text": "Check public transport routes and frequency for your commute", "checked": False},
    ]

    return {
        "essential": essential,
        "recommended": recommended,
        "optional": optional,
    }


def _build_audience_callouts(report: dict) -> dict[str, list[dict]]:
    """Generate audience-specific insight callouts for renters and buyers."""
    hazards = report.get("hazards") or {}
    env = report.get("environment") or {}
    live = report.get("liveability") or {}
    market_data = report.get("market") or {}
    planning = report.get("planning") or {}

    result: dict[str, list[dict]] = {
        "hazards": [], "environment": [], "liveability": [],
        "market": [], "planning": [],
    }

    # HAZARDS
    if hazards.get("flood"):
        result["hazards"].append({"audience": "buyer", "text": "Flood zone affects mortgage eligibility. Some lenders refuse or require higher deposits for properties in mapped flood zones. Factor in higher insurance premiums."})
        result["hazards"].append({"audience": "renter", "text": "Flood zone doesn\u2019t affect your tenancy agreement, but ensure your contents insurance specifically covers flood damage \u2014 many basic policies exclude it."})

    if hazards.get("liquefaction") and "high" in str(hazards.get("liquefaction", "")).lower():
        result["hazards"].append({"audience": "buyer", "text": "High liquefaction susceptibility means foundation requirements are stricter. Budget for a geotechnical assessment ($2,000\u2013$5,000) before making an offer."})
        result["hazards"].append({"audience": "renter", "text": "Liquefaction risk doesn\u2019t affect your tenancy, but know your evacuation routes in case of a major earthquake."})

    if hazards.get("slope_failure") and any(w in str(hazards.get("slope_failure", "")).lower() for w in ["high", "very"]):
        result["hazards"].append({"audience": "buyer", "text": "Commission a geotechnical report before purchase. Check retaining wall condition \u2014 repairs can cost $20,000\u2013$100,000+."})
        result["hazards"].append({"audience": "renter", "text": "Not your financial risk, but be aware of slip-prone access routes in heavy rain. Check whether the driveway or paths are affected."})

    if hazards.get("tsunami_zone_class") or hazards.get("tsunami_evac_zone"):
        result["hazards"].append({"audience": "buyer", "text": "Tsunami zone designation may affect future insurance availability. Check with your insurer before committing."})
        result["hazards"].append({"audience": "renter", "text": "Know your evacuation route and assembly point. Check your local civil defence for tsunami alert systems."})

    epb_count = hazards.get("epb_count_300m") or 0
    if epb_count >= 3:
        result["hazards"].append({"audience": "buyer", "text": f"{epb_count} earthquake-prone buildings within 300m. These may be demolished or strengthened \u2014 check council records for planned works that could affect the streetscape."})

    # ENVIRONMENT
    noise = env.get("road_noise_db") or env.get("noise_db")
    if noise and float(noise) >= 60:
        noise_val = float(noise)
        if noise_val >= 65:
            result["environment"].append({"audience": "buyer", "text": "High road noise significantly reduces your buyer pool at resale. Budget $5,000\u2013$15,000 for acoustic glazing if not already installed."})
            result["environment"].append({"audience": "renter", "text": "Visit the property during peak traffic (7\u20139am, 4\u20136pm) before signing. Ask the landlord about window glazing type and whether ventilation works with windows closed."})
        else:
            result["environment"].append({"audience": "buyer", "text": "Moderate road noise is manageable with double glazing. Check window quality during your viewing."})
            result["environment"].append({"audience": "renter", "text": "Road noise at this level is noticeable but manageable. Bedrooms at the back of the house will be quieter."})

    contam_dist = env.get("contam_nearest_distance_m")
    if contam_dist is not None:
        try:
            d = float(contam_dist)
            if d < 200:
                result["environment"].append({"audience": "buyer", "text": f"Contaminated site only {int(d)}m away. Commission a Phase 1 Environmental Site Assessment ($1,500\u2013$3,000) \u2014 this affects future development potential and resale."})
                result["environment"].append({"audience": "renter", "text": "Registered contamination nearby doesn\u2019t typically affect daily living in established residential areas, but check if bore water is used."})
        except (TypeError, ValueError):
            pass

    # LIVEABILITY
    schools = live.get("schools_1500m") or []
    in_zone = [s for s in schools if isinstance(s, dict) and s.get("in_zone")]
    if len(in_zone) > 0:
        result["liveability"].append({"audience": "buyer", "text": f"This property is in-zone for {len(in_zone)} school{'s' if len(in_zone) != 1 else ''}. In-zone access adds significant value \u2014 families pay premiums of 5\u201315% for zoned properties in desirable school catchments."})
        result["liveability"].append({"audience": "renter", "text": f"You\u2019re in-zone for {len(in_zone)} school{'s' if len(in_zone) != 1 else ''}. However, school zones change annually \u2014 verify directly with the Ministry of Education before enrolling."})

    crime_pct = live.get("crime_percentile")
    if crime_pct is not None:
        try:
            cp = float(crime_pct)
            if cp >= 75:
                result["liveability"].append({"audience": "buyer", "text": "High crime area affects insurance premiums (+10\u201330%) and may extend time-to-sell. Factor these costs into your purchase decision."})
                result["liveability"].append({"audience": "renter", "text": "Check whether the property has secure entry, deadbolts, and window locks. Ask the landlord about break-in history and whether an alarm system is installed."})
            elif cp <= 25:
                result["liveability"].append({"audience": "buyer", "text": "Low crime area is a strong selling point. Properties in safe neighbourhoods consistently command higher prices and sell faster."})
                result["liveability"].append({"audience": "renter", "text": "This is one of the safest areas in the city \u2014 a significant quality-of-life advantage, especially for families."})
        except (TypeError, ValueError):
            pass

    nzdep = live.get("nzdep_decile")
    if nzdep is not None:
        try:
            nd = int(nzdep)
            if nd >= 8:
                result["liveability"].append({"audience": "buyer", "text": "High deprivation correlates with lower property values but higher rental yields. Good for investors, but capital growth may be slower."})
                result["liveability"].append({"audience": "renter", "text": "Higher deprivation areas often have more affordable rents. Check what local services are available \u2014 some areas have fewer GPs, pharmacies, and supermarkets."})
        except (TypeError, ValueError):
            pass

    # MARKET
    rental_overview = market_data.get("rental_overview") or []
    all_rent = None
    for r in rental_overview:
        if isinstance(r, dict) and r.get("dwelling_type") == "ALL" and r.get("number_of_beds") == "ALL":
            all_rent = r
            break

    if all_rent and all_rent.get("median_rent"):
        median = all_rent["median_rent"]
        yoy = all_rent.get("yoy_pct")
        yoy_suffix = " Rents rose " + str(round(yoy, 1)) + "% in the last year \u2014 budget for an increase at renewal." if yoy and yoy > 0 else ""
        result["market"].append({"audience": "renter", "text": f"Median rent in this area is ${int(median)}/week.{yoy_suffix}"})

    prop = report.get("property") or {}
    cv = prop.get("capital_value")
    if cv and all_rent and all_rent.get("median_rent"):
        gross_yield = (all_rent["median_rent"] * 52) / cv * 100
        above_below = "above" if gross_yield > 3.75 else "below"
        result["market"].append({"audience": "buyer", "text": f"Estimated gross yield of {gross_yield:.1f}% is {above_below} the NZ metro average (~3.5\u20134%). Remember to factor in rates, insurance, maintenance (typically 20\u201330% of gross rent), and vacancy periods."})

    trends = market_data.get("trends") or []
    for t in trends:
        if isinstance(t, dict) and t.get("dwelling_type") == "ALL" and t.get("number_of_beds") == "ALL":
            cagr5 = t.get("cagr_5yr")
            if cagr5 is not None and abs(cagr5) > 3:
                if cagr5 > 0:
                    result["market"].append({"audience": "buyer", "text": f"Rents growing {cagr5:.1f}% p.a. over 5 years signals strong demand. Good for rental income growth but may indicate supply constraints."})
                    result["market"].append({"audience": "renter", "text": f"Rents have been rising {cagr5:.1f}% per year. Negotiate a longer fixed-term lease (12\u201324 months) to lock in the current rate."})
            break

    # PLANNING
    consents = planning.get("resource_consents_500m_2yr") or 0
    if consents >= 5:
        result["planning"].append({"audience": "buyer", "text": f"{consents} resource consents granted nearby in the last 2 years signals active development. This typically supports property values long-term but expect construction disruption in the short term."})
        result["planning"].append({"audience": "renter", "text": f"{consents} building consents nearby means potential construction noise and dust. Check project timelines before committing to a long lease."})

    infra = planning.get("infrastructure_5km") or []
    if len(infra) >= 2:
        result["planning"].append({"audience": "buyer", "text": f"{len(infra)} major infrastructure projects within 5km. Government investment in transport, water, or community facilities typically drives property value growth over 5\u201310 years."})

    if planning.get("heritage_listed"):
        result["planning"].append({"audience": "buyer", "text": "Heritage listing restricts modifications. Any changes to the exterior require Heritage NZ approval, which adds cost and time to renovations."})
        result["planning"].append({"audience": "renter", "text": "Heritage listing means the landlord can\u2019t easily alter the building\u2019s character \u2014 good if you like the period features."})

    if planning.get("epb_listed"):
        result["planning"].append({"audience": "buyer", "text": "This building is earthquake-prone. The owner must strengthen or demolish it within the deadline \u2014 check with the council for the exact timeline and estimated cost."})
        result["planning"].append({"audience": "renter", "text": "This building is earthquake-prone. Your landlord is legally required to display an EPB notice. Consider whether you\u2019re comfortable with the seismic risk."})

    return result


# =============================================================================
# NEW SVG Chart Builders (Phase 6)
# =============================================================================

def _build_rent_trend_chart(rent_history: list) -> dict | None:
    """10-year rent trend line chart with quartile band + CAGR annotation.
    ViewBox 500×200. Returns SVG data for Jinja2."""
    if not rent_history or len(rent_history) < 3:
        return None

    # Extract valid data points
    points = []
    for row in rent_history:
        median = row.get("median_rent")
        if median is None:
            continue
        try:
            median_f = float(median)
        except (TypeError, ValueError):
            continue
        tf = row.get("time_frame")
        if tf is None:
            continue
        lq = row.get("lower_quartile_rent")
        uq = row.get("upper_quartile_rent")
        try:
            lq_f = float(lq) if lq is not None else None
        except (TypeError, ValueError):
            lq_f = None
        try:
            uq_f = float(uq) if uq is not None else None
        except (TypeError, ValueError):
            uq_f = None
        points.append({"tf": str(tf), "median": median_f, "lq": lq_f, "uq": uq_f})

    if len(points) < 3:
        return None

    # Chart dimensions
    w, h = 500, 200
    pad_l, pad_r, pad_t, pad_b = 50, 20, 15, 30
    chart_w = w - pad_l - pad_r
    chart_h = h - pad_t - pad_b

    all_vals = [p["median"] for p in points]
    for p in points:
        if p["lq"] is not None:
            all_vals.append(p["lq"])
        if p["uq"] is not None:
            all_vals.append(p["uq"])
    y_min = min(all_vals) * 0.9
    y_max = max(all_vals) * 1.05
    if y_max <= y_min:
        y_max = y_min + 50

    def _x(i: int) -> float:
        return pad_l + (i / max(len(points) - 1, 1)) * chart_w

    def _y(v: float) -> float:
        return pad_t + chart_h - ((v - y_min) / (y_max - y_min)) * chart_h

    # Build median line points
    median_pts = " ".join(f"{_x(i):.1f},{_y(p['median']):.1f}" for i, p in enumerate(points))

    # Build quartile band polygon (upper path forward, lower path backward)
    band_upper = []
    band_lower = []
    for i, p in enumerate(points):
        uq = p["uq"] if p["uq"] is not None else p["median"]
        lq = p["lq"] if p["lq"] is not None else p["median"]
        band_upper.append(f"{_x(i):.1f},{_y(uq):.1f}")
        band_lower.append(f"{_x(i):.1f},{_y(lq):.1f}")
    band_lower.reverse()
    polygon_band = " ".join(band_upper + band_lower)

    # X labels — show ~5 evenly spaced
    x_labels = []
    step = max(1, len(points) // 5)
    for i in range(0, len(points), step):
        tf = points[i]["tf"]
        label = tf[:7] if len(tf) >= 7 else tf  # YYYY-MM
        x_labels.append({"x": _x(i), "label": label})
    # Always include last
    if x_labels and x_labels[-1]["label"] != points[-1]["tf"][:7]:
        x_labels.append({"x": _x(len(points) - 1), "label": points[-1]["tf"][:7]})

    # Y labels
    y_labels = []
    y_step = (y_max - y_min) / 4
    for i in range(5):
        val = y_min + i * y_step
        y_labels.append({"y": _y(val), "label": f"${int(val)}"})

    # CAGR calculations
    latest = points[-1]["median"]
    cagr_5yr = None
    cagr_10yr = None
    if len(points) >= 20:  # quarterly, ~5yr = 20 pts
        old_5 = points[-20]["median"]
        if old_5 > 0:
            cagr_5yr = round(((latest / old_5) ** (1 / 5) - 1) * 100, 1)
    if len(points) >= 40:
        old_10 = points[-40]["median"]
        if old_10 > 0:
            cagr_10yr = round(((latest / old_10) ** (1 / 10) - 1) * 100, 1)

    return {
        "points_median": median_pts,
        "polygon_band": polygon_band,
        "x_labels": x_labels,
        "y_labels": y_labels,
        "cagr_5yr": cagr_5yr,
        "cagr_10yr": cagr_10yr,
        "latest_median": int(latest),
        "pad_t": pad_t,
        "pad_b": pad_b,
        "chart_h": chart_h,
        "pad_l": pad_l,
    }


def _build_rent_quartile_box(rental_overview: list) -> dict | None:
    """Box-whisker showing Q1/median/Q3 for ALL dwelling type.
    ViewBox 400×50."""
    if not isinstance(rental_overview, list):
        return None
    row = next(
        (r for r in rental_overview if isinstance(r, dict)
         and r.get("dwelling_type") == "ALL" and r.get("beds") == "ALL"),
        next((r for r in rental_overview if isinstance(r, dict) and r.get("beds") == "ALL"), None),
    )
    if not row:
        return None

    median = row.get("median")
    lq = row.get("lower_quartile")
    uq = row.get("upper_quartile")
    if median is None:
        return None

    try:
        median_f = float(median)
        lq_f = float(lq) if lq is not None else median_f * 0.8
        uq_f = float(uq) if uq is not None else median_f * 1.2
    except (TypeError, ValueError):
        return None

    # Scale: min/max with padding
    scale_min = lq_f * 0.85
    scale_max = uq_f * 1.15
    if scale_max <= scale_min:
        scale_max = scale_min + 100

    def _sx(v: float) -> float:
        return 40 + ((v - scale_min) / (scale_max - scale_min)) * 320

    return {
        "lq": int(lq_f),
        "median": int(median_f),
        "uq": int(uq_f),
        "scale_min": int(scale_min),
        "scale_max": int(scale_max),
        "box_x": round(_sx(lq_f), 1),
        "box_w": round(_sx(uq_f) - _sx(lq_f), 1),
        "median_x": round(_sx(median_f), 1),
        "label": f"${int(lq_f)} – ${int(median_f)} – ${int(uq_f)}/wk",
    }


def _build_transit_mode_bars(live: dict) -> dict | None:
    """Horizontal bars for bus/rail/ferry/cable car within 800m."""
    modes = [
        ("Bus", live.get("bus_stops_800m"), "#3B82F6"),
        ("Rail", live.get("rail_stops_800m"), "#22C55E"),
        ("Ferry", live.get("ferry_stops_800m"), "#06B6D4"),
        ("Cable Car", live.get("cable_car_stops_800m"), "#A855F7"),
    ]

    active_modes = []
    total = 0
    for name, count, color in modes:
        if count and int(count) > 0:
            c = int(count)
            active_modes.append({"name": name, "count": c, "color": color})
            total += c

    if not active_modes:
        return None

    for m in active_modes:
        m["pct"] = round((m["count"] / total) * 100, 1) if total > 0 else 0

    return {"modes": active_modes, "total": total}


def _build_amenity_breakdown(amenities_500m: dict) -> list[dict]:
    """Horizontal bar chart of amenity categories, top 10, sorted descending."""
    if not amenities_500m or not isinstance(amenities_500m, dict):
        return []

    # Exclude street furniture and non-useful categories
    _EXCLUDED_AMENITIES = {
        "bench", "waste_basket", "waste basket", "loading_dock", "loading dock",
        "bicycle_parking", "bicycle parking", "parking", "toilets", "telephone",
        "post_box", "post box", "recycling", "shelter", "drinking_water",
        "drinking water", "vending_machine", "vending machine", "clock",
        "hunting_stand", "hunting stand", "bbq", "fountain",
    }

    items = []
    for cat, cnt in amenities_500m.items():
        if cnt and isinstance(cnt, (int, float)) and cnt > 0:
            if cat.lower().strip() in _EXCLUDED_AMENITIES:
                continue
            items.append({"name": cat.replace("_", " ").title(), "count": int(cnt)})

    if not items:
        return []

    items.sort(key=lambda x: x["count"], reverse=True)
    items = items[:10]

    max_count = items[0]["count"] if items else 1
    for item in items:
        item["pct"] = round((item["count"] / max_count) * 100, 1)

    return items


def _build_monthly_cost(report: dict, rates_data: dict | None = None) -> dict | None:
    """Stacked bar: mortgage + rates + insurance estimate.
    Mortgage calc: CV × 0.8, 6.5% rate, 30yr P&I."""
    import math

    prop = report.get("property") or {}
    hazards = report.get("hazards") or {}
    cv = prop.get("capital_value") or prop.get("cv_capital")
    if not cv:
        return None

    try:
        cv = int(cv)
    except (TypeError, ValueError):
        return None

    if cv <= 0:
        return None

    # Mortgage: 80% LVR, 6.5% rate, 30yr
    loan = cv * 0.8
    rate_monthly = 0.065 / 12
    n_payments = 360
    if rate_monthly > 0:
        monthly_mortgage = loan * (rate_monthly * (1 + rate_monthly) ** n_payments) / (
            (1 + rate_monthly) ** n_payments - 1
        )
    else:
        monthly_mortgage = loan / n_payments

    # Rates — handle both flat and nested (current_valuation.total_rates) formats
    monthly_rates = cv * 0.004 / 12  # default estimate
    if rates_data and isinstance(rates_data, dict):
        annual_rates = (
            rates_data.get("total_rates")
            or rates_data.get("annual_rates")
            or (rates_data.get("current_valuation") or {}).get("total_rates")
        )
        if annual_rates:
            try:
                monthly_rates = float(annual_rates) / 12
            except (TypeError, ValueError):
                pass

    # Insurance estimate based on hazard count
    hazard_factors = 0
    if hazards.get("flood"):
        hazard_factors += 1
    if hazards.get("landslide_in_area"):
        hazard_factors += 1
    slope = str(hazards.get("slope_failure") or "").lower()
    if "high" in slope:
        hazard_factors += 1
    if hazards.get("tsunami_zone_class"):
        hazard_factors += 1

    if hazard_factors >= 3:
        annual_insurance = 4000
    elif hazard_factors >= 1:
        annual_insurance = 3000
    else:
        annual_insurance = 2000
    monthly_insurance = annual_insurance / 12

    total = monthly_mortgage + monthly_rates + monthly_insurance

    segments = [
        {"label": "Mortgage", "amount": int(monthly_mortgage), "color": "#0D7377", "pct": round(monthly_mortgage / total * 100)},
        {"label": "Rates", "amount": int(monthly_rates), "color": "#3B82F6", "pct": round(monthly_rates / total * 100)},
        {"label": "Insurance", "amount": int(monthly_insurance), "color": "#F59E0B", "pct": round(monthly_insurance / total * 100)},
    ]

    assumptions = f"Based on CV ${cv:,} at 80% LVR, 6.5% interest, 30yr term. Rates estimated{' from WCC data' if rates_data else ' at 0.4% of CV'}. Insurance ${annual_insurance:,}/yr."

    return {
        "segments": segments,
        "total": int(total),
        "assumptions_text": assumptions,
    }


def _build_budget_from_inputs(report: dict, budget_inputs: dict | None, rates_data: dict | None = None) -> dict | None:
    """Enhanced monthly cost with user budget calculator inputs. Falls back to defaults."""
    import math

    if not budget_inputs:
        return None

    persona = budget_inputs.get("persona", "buyer")
    prop = report.get("property") or {}
    hazards = report.get("hazards") or {}
    cv_raw = prop.get("capital_value") or prop.get("cv_capital")

    if persona == "buyer":
        cv = budget_inputs.get("purchase_price") or (int(cv_raw) if cv_raw else None)
        if not cv or cv <= 0:
            return None

        deposit_pct = budget_inputs.get("deposit_pct", 20)
        interest_rate = budget_inputs.get("interest_rate", 6.5)
        loan_term = budget_inputs.get("loan_term", 30)

        loan = cv * (1 - deposit_pct / 100)
        r = interest_rate / 100 / 12
        n = loan_term * 12
        if r > 0:
            mortgage = loan * (r * (1 + r) ** n) / ((1 + r) ** n - 1)
        else:
            mortgage = loan / n

        rates_monthly = budget_inputs.get("rates_override") or (cv * 0.004 / 12)
        if rates_data and not budget_inputs.get("rates_override"):
            annual = (rates_data.get("total_rates") or rates_data.get("annual_rates")
                      or (rates_data.get("current_valuation") or {}).get("total_rates"))
            if annual:
                try:
                    rates_monthly = float(annual) / 12
                except (TypeError, ValueError):
                    pass

        insurance_monthly = budget_inputs.get("insurance_override") or 250
        utilities_monthly = budget_inputs.get("utilities_override") or 250
        maintenance_monthly = budget_inputs.get("maintenance_override") or (cv * 0.005 / 12)

        total = mortgage + rates_monthly + insurance_monthly + utilities_monthly + maintenance_monthly
        segments = [
            {"label": "Mortgage", "amount": int(mortgage), "color": "#0D7377", "pct": round(mortgage / total * 100)},
            {"label": "Rates", "amount": int(rates_monthly), "color": "#3B82F6", "pct": round(rates_monthly / total * 100)},
            {"label": "Insurance", "amount": int(insurance_monthly), "color": "#F59E0B", "pct": round(insurance_monthly / total * 100)},
            {"label": "Utilities", "amount": int(utilities_monthly), "color": "#8B5CF6", "pct": round(utilities_monthly / total * 100)},
            {"label": "Maintenance", "amount": int(maintenance_monthly), "color": "#6B7280", "pct": round(maintenance_monthly / total * 100)},
        ]

        income = budget_inputs.get("annual_income")
        ratio = round((total / (income / 12)) * 100) if income and income > 0 else None

        return {
            "segments": segments,
            "total": int(total),
            "is_custom": True,
            "assumptions_text": f"Based on your inputs: ${cv:,} at {deposit_pct}% deposit, {interest_rate}% interest, {loan_term}yr term.",
            "affordability_ratio": ratio,
        }

    else:  # renter
        weekly_rent = budget_inputs.get("weekly_rent", 500)
        room_only = budget_inputs.get("room_only", False)
        household_size = budget_inputs.get("household_size", 1)
        divisor = household_size if room_only else 1

        rent_monthly = weekly_rent * 52 / 12
        utilities = (budget_inputs.get("utilities_override") or 250) / divisor
        insurance = (budget_inputs.get("contents_insurance_override") or 50) / divisor
        transport = budget_inputs.get("transport_override") or 240
        food = budget_inputs.get("food_override") or 300

        total = rent_monthly + utilities + insurance + transport + food
        rent_pct = round(rent_monthly / total * 100) if total > 0 else 0

        segments = [
            {"label": "Rent", "amount": int(rent_monthly), "color": "#0D7377", "pct": round(rent_monthly / total * 100)},
            {"label": "Utilities", "amount": int(utilities), "color": "#3B82F6", "pct": round(utilities / total * 100)},
            {"label": "Insurance", "amount": int(insurance), "color": "#F59E0B", "pct": round(insurance / total * 100)},
            {"label": "Transport", "amount": int(transport), "color": "#8B5CF6", "pct": round(transport / total * 100)},
            {"label": "Food", "amount": int(food), "color": "#22C55E", "pct": round(food / total * 100)},
        ]

        income = budget_inputs.get("annual_income")
        ratio = round((total / (income / 12)) * 100) if income and income > 0 else None

        label = f"${weekly_rent}/wk rent"
        if room_only:
            label += f" (room in {household_size}-person flat)"

        return {
            "segments": segments,
            "total": int(total),
            "is_custom": True,
            "rent_pct": rent_pct,
            "assumptions_text": f"Based on your inputs: {label}. Shared costs split by {household_size}." if room_only else f"Based on your inputs: {label}.",
            "affordability_ratio": ratio,
        }


def _build_walkability_gauge(live: dict) -> dict:
    """SVG arc gauge (270°) with score 0-100 and factor breakdown.
    ViewBox 140×140."""
    import math

    amenity_ct = sum(v for v in (live.get("amenities_500m") or {}).values() if isinstance(v, (int, float)))
    transit_ct = live.get("transit_stops_400m") or 0
    cbd_dist = live.get("cbd_distance_m") or 10000
    school_ct = len(live.get("schools_1500m") or [])

    # Same formula as render()
    amenity_pts = min(25, round((amenity_ct / 15) * 25))
    transit_pts = min(25, round((transit_ct / 10) * 25))
    cbd_pts = max(0, round(20 * (1 - min(cbd_dist, 5000) / 5000)))
    school_pts = min(15, round((school_ct / 5) * 15))
    baseline = 10

    score = min(100, amenity_pts + transit_pts + cbd_pts + school_pts + baseline)

    # Arc parameters
    total_angle = 270  # degrees
    arc_frac = score / 100
    arc_length = arc_frac * total_angle

    # Color
    if score >= 80:
        color = "#2D6A4F"
        label = "Walker's Paradise"
    elif score >= 60:
        color = "#0D7377"
        label = "Very Walkable"
    elif score >= 40:
        color = "#E69F00"
        label = "Somewhat Walkable"
    else:
        color = "#D55E00"
        label = "Car-Dependent"

    # SVG arc path
    cx, cy, r = 70, 70, 55
    start_angle = 135  # start at bottom-left
    end_angle_bg = start_angle + total_angle
    end_angle_fg = start_angle + arc_length

    def _arc_point(angle_deg: float) -> tuple[float, float]:
        rad = math.radians(angle_deg)
        return (round(cx + r * math.cos(rad), 1), round(cy + r * math.sin(rad), 1))

    # Background arc
    bg_start = _arc_point(start_angle)
    bg_end = _arc_point(end_angle_bg)
    bg_large = 1 if total_angle > 180 else 0
    bg_path = f"M {bg_start[0]} {bg_start[1]} A {r} {r} 0 {bg_large} 1 {bg_end[0]} {bg_end[1]}"

    # Foreground arc
    fg_end = _arc_point(end_angle_fg)
    fg_large = 1 if arc_length > 180 else 0
    fg_path = f"M {bg_start[0]} {bg_start[1]} A {r} {r} 0 {fg_large} 1 {fg_end[0]} {fg_end[1]}"

    factors = [
        {"name": "Amenities", "pts": amenity_pts},
        {"name": "Transit", "pts": transit_pts},
        {"name": "CBD Proximity", "pts": cbd_pts},
        {"name": "Schools", "pts": school_pts},
    ]

    return {
        "score": score,
        "bg_path": bg_path,
        "fg_path": fg_path,
        "color": color,
        "label": label,
        "factors": factors,
    }


def _build_trajectory_visual(report: dict) -> dict | None:
    """Signal bar + direction indicator for neighbourhood trajectory."""
    market = report.get("market") or {}
    planning = report.get("planning") or {}
    live = report.get("liveability") or {}

    signals = []

    # Rent trend signal
    trends = market.get("trends") or []
    all_trend = next(
        (t for t in trends if isinstance(t, dict)
         and t.get("dwelling_type") == "ALL" and t.get("beds") == "ALL"),
        None,
    )
    if all_trend:
        cagr5 = all_trend.get("cagr_5yr")
        if cagr5 is not None:
            if cagr5 > 3:
                signals.append({"name": "Rent Growth", "direction": "up", "color": "#22C55E"})
            elif cagr5 > 0:
                signals.append({"name": "Rent Growth", "direction": "stable", "color": "#E69F00"})
            else:
                signals.append({"name": "Rent Growth", "direction": "down", "color": "#D55E00"})

    # Development activity
    consents = planning.get("resource_consents_500m_2yr") or 0
    if consents >= 5:
        signals.append({"name": "Development", "direction": "up", "color": "#22C55E"})
    elif consents >= 2:
        signals.append({"name": "Development", "direction": "stable", "color": "#E69F00"})
    else:
        signals.append({"name": "Development", "direction": "down", "color": "#9CA3AF"})

    # Infrastructure projects
    infra = planning.get("infrastructure_5km") or planning.get("infrastructure_projects") or []
    if len(infra) >= 3:
        signals.append({"name": "Infrastructure", "direction": "up", "color": "#22C55E"})
    elif len(infra) >= 1:
        signals.append({"name": "Infrastructure", "direction": "stable", "color": "#E69F00"})
    else:
        signals.append({"name": "Infrastructure", "direction": "stable", "color": "#9CA3AF"})

    # Crime trend
    crime_pct = live.get("crime_percentile")
    if crime_pct is not None:
        try:
            cp = float(crime_pct)
            if cp <= 30:
                signals.append({"name": "Safety", "direction": "up", "color": "#22C55E"})
            elif cp <= 60:
                signals.append({"name": "Safety", "direction": "stable", "color": "#E69F00"})
            else:
                signals.append({"name": "Safety", "direction": "down", "color": "#D55E00"})
        except (TypeError, ValueError):
            pass

    if not signals:
        return None

    # Overall direction
    up_count = sum(1 for s in signals if s["direction"] == "up")
    down_count = sum(1 for s in signals if s["direction"] == "down")
    if up_count > down_count:
        direction = "improving"
        color = "#22C55E"
        label = "Neighbourhood is improving"
    elif down_count > up_count:
        direction = "declining"
        color = "#D55E00"
        label = "Neighbourhood may be declining"
    else:
        direction = "stable"
        color = "#E69F00"
        label = "Neighbourhood is stable"

    return {
        "direction": direction,
        "color": color,
        "signals": signals,
        "label": label,
    }


def _build_hpi_chart(hpi_data: list) -> dict | None:
    """National HPI area chart for buyer investment section.
    ViewBox 500×160."""
    if not hpi_data or len(hpi_data) < 4:
        return None

    points = []
    for row in hpi_data:
        hpi = row.get("house_price_index")
        qe = row.get("quarter_end")
        if hpi is None or qe is None:
            continue
        try:
            hpi_f = float(hpi)
        except (TypeError, ValueError):
            continue
        points.append({"qe": str(qe), "hpi": hpi_f})

    if len(points) < 4:
        return None

    w, h = 500, 160
    pad_l, pad_r, pad_t, pad_b = 50, 20, 10, 25
    chart_w = w - pad_l - pad_r
    chart_h = h - pad_t - pad_b

    hpi_vals = [p["hpi"] for p in points]
    y_min = min(hpi_vals) * 0.95
    y_max = max(hpi_vals) * 1.02
    if y_max <= y_min:
        y_max = y_min + 100

    def _x(i: int) -> float:
        return pad_l + (i / max(len(points) - 1, 1)) * chart_w

    def _y(v: float) -> float:
        return pad_t + chart_h - ((v - y_min) / (y_max - y_min)) * chart_h

    # Line points
    line_points = " ".join(f"{_x(i):.1f},{_y(p['hpi']):.1f}" for i, p in enumerate(points))

    # Area polygon (line + bottom edge)
    area_bottom = f"{_x(len(points)-1):.1f},{pad_t + chart_h} {_x(0):.1f},{pad_t + chart_h}"
    area_points = line_points + " " + area_bottom

    # X labels (~5)
    x_labels = []
    step = max(1, len(points) // 5)
    for i in range(0, len(points), step):
        qe = points[i]["qe"]
        label = qe[:4]  # year
        x_labels.append({"x": _x(i), "label": label})

    # Y labels
    y_labels = []
    y_step = (y_max - y_min) / 4
    for i in range(5):
        val = y_min + i * y_step
        y_labels.append({"y": _y(val), "label": f"{int(val)}"})

    latest = points[-1]["hpi"]
    earliest = points[0]["hpi"]
    change_pct = round(((latest - earliest) / earliest) * 100, 1) if earliest > 0 else 0

    return {
        "area_points": area_points,
        "line_points": line_points,
        "x_labels": x_labels,
        "y_labels": y_labels,
        "latest": round(latest, 1),
        "change_pct": change_pct,
    }


def _build_investment_cards(report: dict) -> dict | None:
    """Structured investment metrics for 2×2 card grid."""
    prop = report.get("property") or {}
    market = report.get("market") or {}
    scores = report.get("scores") or {}

    cv = prop.get("capital_value") or prop.get("cv_capital")
    land_area = prop.get("land_area_sqm")

    # Yield
    yield_pct = _compute_yield(report)
    if yield_pct is not None:
        if yield_pct > 5:
            yield_ctx = "Strong yield"
        elif yield_pct > 3.5:
            yield_ctx = "Average yield"
        else:
            yield_ctx = "Below average"
    else:
        yield_ctx = None

    # Rent growth
    rent_1yr = _get_cagr(report, 1)
    rent_5yr = _get_cagr(report, 5)

    # Market heat (based on rent growth + consents)
    planning = report.get("planning") or {}
    consents = planning.get("resource_consents_500m_2yr") or 0
    heat_score = 0
    if rent_5yr and rent_5yr > 3:
        heat_score += 2
    elif rent_5yr and rent_5yr > 0:
        heat_score += 1
    if consents >= 5:
        heat_score += 2
    elif consents >= 2:
        heat_score += 1

    if heat_score >= 3:
        heat = "Hot"
        heat_color = "#C42D2D"
    elif heat_score >= 2:
        heat = "Warm"
        heat_color = "#D55E00"
    elif heat_score >= 1:
        heat = "Moderate"
        heat_color = "#E69F00"
    else:
        heat = "Cool"
        heat_color = "#0D7377"

    # CV per sqm
    cv_per_sqm = None
    if cv and land_area and land_area > 0:
        try:
            cv_per_sqm = int(int(cv) / float(land_area))
        except (TypeError, ValueError, ZeroDivisionError):
            pass

    if yield_pct is None and rent_1yr is None and cv_per_sqm is None:
        return None

    return {
        "yield_pct": yield_pct,
        "yield_ctx": yield_ctx,
        "rent_1yr": rent_1yr,
        "rent_5yr": rent_5yr,
        "heat": heat,
        "heat_color": heat_color,
        "cv_per_sqm": cv_per_sqm,
    }


# =============================================================================
# RAG "At a Glance" Grid
# =============================================================================

def _build_rag_grid(
    report: dict, persona: str, insurance_risk: str, walkability: int,
) -> list[dict]:
    """Return list of {label, status, tooltip} for traffic-light grid on page 1."""
    hazards = report.get("hazards") or {}
    live = report.get("liveability") or {}
    env = report.get("environment") or {}
    market = report.get("market") or {}
    scores = report.get("scores") or {}

    items: list[dict] = []

    # Hazard Risk (composite score)
    composite = scores.get("composite")
    if composite is not None:
        if composite <= 30:
            items.append({"label": "Hazard Risk", "status": "green", "tooltip": f"Score {int(composite)}/100 — low risk"})
        elif composite <= 60:
            items.append({"label": "Hazard Risk", "status": "amber", "tooltip": f"Score {int(composite)}/100 — moderate risk"})
        else:
            items.append({"label": "Hazard Risk", "status": "red", "tooltip": f"Score {int(composite)}/100 — elevated risk"})
    else:
        items.append({"label": "Hazard Risk", "status": "grey", "tooltip": "No data"})

    # Insurance
    ins_map = {"green": "green", "amber": "amber", "red": "red"}
    ins_tip = {"green": "Standard premiums likely", "amber": "May face excess or exclusions", "red": "Significant premium loading likely"}
    items.append({"label": "Insurance", "status": ins_map.get(insurance_risk, "grey"), "tooltip": ins_tip.get(insurance_risk, "")})

    # Crime
    crime_pct = live.get("crime_percentile")
    if crime_pct is not None:
        if crime_pct <= 25:
            items.append({"label": "Crime", "status": "green", "tooltip": f"{int(crime_pct)}th percentile — low crime"})
        elif crime_pct <= 60:
            items.append({"label": "Crime", "status": "amber", "tooltip": f"{int(crime_pct)}th percentile — moderate"})
        else:
            items.append({"label": "Crime", "status": "red", "tooltip": f"{int(crime_pct)}th percentile — above average"})
    else:
        items.append({"label": "Crime", "status": "grey", "tooltip": "No data"})

    # Noise
    noise_db = env.get("road_noise_db")
    if noise_db is not None:
        try:
            db = float(noise_db)
        except (TypeError, ValueError):
            db = None
        if db is not None:
            if db < 55:
                items.append({"label": "Noise", "status": "green", "tooltip": f"{db:.0f} dB — quiet"})
            elif db <= 65:
                items.append({"label": "Noise", "status": "amber", "tooltip": f"{db:.0f} dB — moderate"})
            else:
                items.append({"label": "Noise", "status": "red", "tooltip": f"{db:.0f} dB — loud"})
        else:
            items.append({"label": "Noise", "status": "grey", "tooltip": "No data"})
    else:
        items.append({"label": "Noise", "status": "grey", "tooltip": "No data"})

    # Walkability
    if walkability >= 65:
        items.append({"label": "Walkability", "status": "green", "tooltip": f"Score {walkability} — very walkable"})
    elif walkability >= 40:
        items.append({"label": "Walkability", "status": "amber", "tooltip": f"Score {walkability} — somewhat walkable"})
    else:
        items.append({"label": "Walkability", "status": "red", "tooltip": f"Score {walkability} — car-dependent"})

    # Schools
    schools = live.get("schools_1500m") or []
    in_zone = sum(1 for s in schools if isinstance(s, dict) and s.get("in_zone"))
    if in_zone >= 2:
        items.append({"label": "Schools", "status": "green", "tooltip": f"{in_zone} in-zone schools"})
    elif in_zone == 1:
        items.append({"label": "Schools", "status": "amber", "tooltip": "1 in-zone school"})
    elif schools:
        items.append({"label": "Schools", "status": "red", "tooltip": "No in-zone schools nearby"})
    else:
        items.append({"label": "Schools", "status": "grey", "tooltip": "No data"})

    # Transport
    transit = live.get("transit_stops_400m")
    if transit is not None:
        try:
            stops = int(transit)
        except (TypeError, ValueError):
            stops = 0
        if stops >= 5:
            items.append({"label": "Transport", "status": "green", "tooltip": f"{stops} stops within 400m"})
        elif stops >= 2:
            items.append({"label": "Transport", "status": "amber", "tooltip": f"{stops} stops within 400m"})
        else:
            items.append({"label": "Transport", "status": "red", "tooltip": f"{stops} stop{'s' if stops != 1 else ''} within 400m"})
    else:
        items.append({"label": "Transport", "status": "grey", "tooltip": "No data"})

    # Persona-specific last item
    if persona == "buyer":
        yield_pct = _compute_yield(report)
        if yield_pct is not None:
            if yield_pct > 4:
                items.append({"label": "Yield", "status": "green", "tooltip": f"{yield_pct}% gross yield"})
            elif yield_pct >= 3:
                items.append({"label": "Yield", "status": "amber", "tooltip": f"{yield_pct}% gross yield"})
            else:
                items.append({"label": "Yield", "status": "red", "tooltip": f"{yield_pct}% gross yield"})
        else:
            items.append({"label": "Yield", "status": "grey", "tooltip": "No data"})
    else:
        # Renter: rent vs median
        rental_list = market.get("rental_overview") or []
        all_r = next(
            (r for r in rental_list if isinstance(r, dict)
             and r.get("dwelling_type") == "House" and r.get("beds") == "ALL"),
            next((r for r in rental_list if isinstance(r, dict) and r.get("beds") == "ALL"), None),
        )
        if all_r and all_r.get("median"):
            median = all_r["median"]
            uq = all_r.get("upper_quartile") or median * 1.2
            if median <= median:  # always true for the area median
                items.append({"label": "Rent", "status": "green", "tooltip": f"Median ${int(median)}/wk for area"})
            elif median <= uq:
                items.append({"label": "Rent", "status": "amber", "tooltip": f"${int(median)}/wk — near upper range"})
            else:
                items.append({"label": "Rent", "status": "red", "tooltip": f"Above upper quartile"})
        else:
            items.append({"label": "Rent", "status": "grey", "tooltip": "No rental data"})

    return items


# =============================================================================
# Active Fault Section
# =============================================================================

def _build_active_fault_section(hazards: dict) -> dict | None:
    """Build active fault display data from hazard dict.

    SQL shape (from migration 0022/0051): active_fault_nearest is a dict with
    keys {name, type, slip_rate_mm_yr, distance_m}. fault_avoidance_zone is a
    bare string (zone_type) when present, NOT a dict — the SQL only joins to
    fault_avoidance_zones.zone_type. Earlier code in this function read the
    wrong keys (fault_name, fault_class, recurrence_interval) and treated
    fault_avoidance_zone as a dict, so the entire box rendered empty in PDF.
    """
    fault_nearest = hazards.get("active_fault_nearest")
    faz = hazards.get("fault_avoidance_zone")

    if not fault_nearest and not faz:
        return None

    result: dict[str, Any] = {}

    if isinstance(fault_nearest, dict) and fault_nearest.get("name"):
        result["fault_name"] = fault_nearest.get("name") or "Unknown Fault"
        # `type` from SQL is a fault classification code (e.g. "1"), not free text.
        # Surface it under the existing template key fault_class so the PDF row stays useful.
        result["fault_class"] = fault_nearest.get("type") or ""
        result["distance_m"] = fault_nearest.get("distance_m")
        result["slip_rate"] = fault_nearest.get("slip_rate_mm_yr")
        # SQL doesn't provide recurrence interval — leave None and the template skips the row.
        result["recurrence"] = None

    if isinstance(faz, str) and faz.strip():
        result["in_avoidance_zone"] = True
        result["faz_fault_name"] = result.get("fault_name", "")
        result["faz_zone_type"] = faz
    else:
        result["in_avoidance_zone"] = False

    # Risk class
    dist = result.get("distance_m")
    if result.get("in_avoidance_zone"):
        result["risk_class"] = "warn"
    elif dist is not None and dist < 500:
        result["risk_class"] = "warn"
    elif dist is not None and dist < 2000:
        result["risk_class"] = "info"
    else:
        result["risk_class"] = "ok"

    return result if (result.get("fault_name") or result.get("in_avoidance_zone")) else None


# =============================================================================
# Healthy Homes Signals (Renter Page)
# =============================================================================

def _build_healthy_homes_signals(report: dict) -> list[dict]:
    """Build 5 Healthy Homes standard rows with status flags from hazard data."""
    hazards = report.get("hazards") or {}

    # Determine environmental flags
    flood = bool(hazards.get("flood"))
    liq_raw = str(hazards.get("liquefaction") or "").lower()
    high_liq = "high" in liq_raw or "very high" in liq_raw
    coastal_erosion = bool(hazards.get("coastal_erosion") and str(hazards.get("coastal_erosion")).strip().lower() not in ("", "none", "0", "stable"))
    wind_raw = str(hazards.get("wind_zone") or "").strip().upper()
    high_wind = wind_raw in ("H", "VH", "EH", "SED")

    rows = [
        {
            "area": "Heating",
            "check": "Fixed heater capable of ≥1.5kW in main living area",
            "status": "unknown",
            "flagged": False,
            "flag_reason": "",
        },
        {
            "area": "Insulation",
            "check": "Ceiling ≥R2.9, underfloor ≥R1.3",
            "status": "unknown",
            "flagged": False,
            "flag_reason": "",
        },
        {
            "area": "Ventilation",
            "check": "Extractor fans in kitchen & bathroom vent to outside",
            "status": "unknown",
            "flagged": False,
            "flag_reason": "",
        },
        {
            "area": "Moisture",
            "check": "No visible mould, condensation, or rising damp",
            "status": "flagged" if (flood or high_liq or coastal_erosion) else "unknown",
            "flagged": flood or high_liq or coastal_erosion,
            "flag_reason": ", ".join(filter(None, [
                "flood zone" if flood else "",
                "high liquefaction" if high_liq else "",
                "coastal erosion risk" if coastal_erosion else "",
            ])),
        },
        {
            "area": "Draught",
            "check": "Window and door seals intact, no draughts",
            "status": "flagged" if high_wind else "unknown",
            "flagged": high_wind,
            "flag_reason": f"Wind zone {wind_raw} — higher draught risk" if high_wind else "",
        },
    ]
    return rows


# =============================================================================
# Rent Verdict (Renter Page)
# =============================================================================

def _build_rent_verdict(report: dict, budget_inputs: dict | None, user_rent_context: dict | None = None) -> dict | None:
    """Compare user rent to area median. Returns verdict dict or None."""
    market = report.get("market") or {}
    addr = report.get("address") or {}
    rental_list = market.get("rental_overview") or []

    # Use user's dwelling/bed selection if available for more accurate median
    target_dw = (user_rent_context or {}).get("dwelling_type")
    target_beds = (user_rent_context or {}).get("bedrooms")

    # Try to find matching rental data for user's specific type
    all_r = None
    if target_dw and target_dw != "ALL":
        all_r = next(
            (r for r in rental_list if isinstance(r, dict)
             and r.get("dwelling_type") == target_dw
             and (r.get("beds") == target_beds if target_beds and target_beds != "ALL" else r.get("beds") == "ALL")),
            None,
        )
    if not all_r:
        all_r = next(
            (r for r in rental_list if isinstance(r, dict)
             and r.get("dwelling_type") == "House" and r.get("beds") == "ALL"),
            next((r for r in rental_list if isinstance(r, dict) and r.get("beds") == "ALL"), None),
        )
    if not all_r or not all_r.get("median"):
        return None

    median = float(all_r["median"])
    uq = float(all_r.get("upper_quartile") or median * 1.2)
    bond_count = all_r.get("bond_count")

    # User rent: prefer rent_context (from rent comparison flow), fall back to budget inputs
    user_rent = None
    if user_rent_context and user_rent_context.get("weekly_rent"):
        try:
            user_rent = float(user_rent_context["weekly_rent"])
        except (TypeError, ValueError):
            pass
    if user_rent is None and budget_inputs and budget_inputs.get("rent_weekly"):
        try:
            user_rent = float(budget_inputs["rent_weekly"])
        except (TypeError, ValueError):
            pass

    suburb = addr.get("suburb") or addr.get("sa2_name") or "this area"
    dwelling_type = all_r.get("dwelling_type") or "all types"

    result: dict[str, Any] = {
        "median": int(median),
        "uq": int(uq),
        "suburb": suburb,
        "dwelling_type": dwelling_type,
    }

    # Confidence stars based on bond count
    if bond_count:
        try:
            bc = int(bond_count)
        except (TypeError, ValueError):
            bc = 0
        if bc >= 50:
            result["confidence"] = 5
        elif bc >= 30:
            result["confidence"] = 4
        elif bc >= 15:
            result["confidence"] = 3
        elif bc >= 5:
            result["confidence"] = 2
        else:
            result["confidence"] = 1
    else:
        result["confidence"] = 0

    if user_rent is not None:
        result["user_rent"] = int(user_rent)
        pct_diff = ((user_rent - median) / median) * 100
        if pct_diff < -5:
            result["position"] = "below"
            result["color"] = "green"
        elif pct_diff > 5:
            result["position"] = "above"
            result["color"] = "red"
        else:
            result["position"] = "at"
            result["color"] = "amber"
    else:
        result["user_rent"] = None
        result["position"] = None
        result["color"] = None

    # Rental income potential (for buyer persona) — what could this property rent for?
    cv_raw = (report.get("property") or {}).get("capital_value")
    if cv_raw and median > 0:
        try:
            cv = float(cv_raw)
            annual_rent = median * 52
            gross_yield = (annual_rent / cv) * 100
            result["rental_potential"] = {
                "estimated_weekly_rent": int(median),
                "upper_estimate": int(uq),
                "annual_rent": int(annual_rent),
                "gross_yield_pct": round(gross_yield, 1),
                "net_yield_estimate_pct": round(gross_yield * 0.7, 1),  # ~30% expenses
            }
        except (TypeError, ValueError):
            pass

    return result


# =============================================================================
# Section Interpretations ("What This Means" one-liners)
# =============================================================================

def _build_section_interpretations(
    report: dict,
    persona: str,
    insights: dict,
    monthly_cost: dict | None,
    trajectory: dict | None,
    investment_cards: dict | None,
    hazard_rows: list[dict] | None = None,
    comparison_bars: list[dict] | None = None,
) -> dict[str, str]:
    """Return interpretation text keyed by section name."""
    interp: dict[str, str] = {}

    # Hazards
    if hazard_rows:
        warn_rows = [r for r in hazard_rows if r.get("risk_class") == "warn"]
        if warn_rows:
            worst = warn_rows[0]["label"]
            interp["hazards"] = (
                f"{len(warn_rows)} of {len(hazard_rows)} hazard checks flagged. "
                f"{worst} is the most significant concern."
            )
        else:
            interp["hazards"] = "No hazard concerns — clean safety profile."

    # Money
    if monthly_cost and isinstance(monthly_cost, dict):
        total = monthly_cost.get("total", 0)
        ratio = monthly_cost.get("affordability_ratio")
        if persona == "buyer":
            if ratio:
                if ratio < 30:
                    comfort = "comfortable"
                elif ratio <= 40:
                    comfort = "a stretch"
                else:
                    comfort = "stressful"
                interp["money"] = f"Total ${total:,}/mo. At {ratio}% of income, this is {comfort}."
            else:
                interp["money"] = f"Estimated ownership cost ${total:,}/mo."
        else:
            rent_pct = monthly_cost.get("rent_pct")
            if rent_pct:
                if rent_pct < 30:
                    health = "healthy"
                elif rent_pct <= 40:
                    health = "tight"
                else:
                    health = "stressed"
                interp["money"] = (
                    f"Rent takes {rent_pct}% of your monthly budget — {health}. "
                    f"The average NZ renter spends 32%."
                )
            elif total:
                interp["money"] = f"Estimated monthly cost ${total:,}/mo."

    # Neighbourhood
    if comparison_bars:
        above_count = sum(1 for bar in comparison_bars if bar.get("property_above_suburb"))
        interp["neighbourhood"] = f"Scores above average on {above_count} of {len(comparison_bars)} metrics."

    # Trajectory
    if trajectory and isinstance(trajectory, dict):
        direction = trajectory.get("direction", "stable")
        if direction == "improving":
            interp["trajectory"] = "Neighbourhood shows positive signals — improving trajectory."
        elif direction == "declining":
            interp["trajectory"] = "Neighbourhood shows negative signals — declining trajectory."
        else:
            interp["trajectory"] = "Neighbourhood shows mixed signals — stable trajectory."

    # Investment (buyer only)
    if persona == "buyer" and investment_cards and isinstance(investment_cards, dict):
        yld = investment_cards.get("yield_pct")
        heat = investment_cards.get("heat", "")
        if yld:
            if yld > 4 and heat in ("Hot", "Warm"):
                outlook = "promising fundamentals"
            elif yld < 3 and heat in ("Cool",):
                outlook = "needs careful analysis"
            else:
                outlook = "moderate outlook"
            interp["investment"] = f"At {yld}% yield and {heat.lower()} market, {outlook}."

    return interp


# =============================================================================
# Computed Values
# =============================================================================

def _compute_yield(report: dict) -> float | None:
    prop = report.get("property") or {}
    market = report.get("market") or {}
    cv = prop.get("capital_value") or prop.get("cv_capital")
    rental_list = market.get("rental_overview") or []
    if not isinstance(rental_list, list):
        return None
    all_rental = next(
        (r for r in rental_list if isinstance(r, dict)
         and r.get("dwelling_type") == "House" and r.get("beds") == "ALL"),
        next((r for r in rental_list if isinstance(r, dict) and r.get("beds") == "ALL"), None),
    )
    median_rent = all_rental.get("median") if all_rental else None
    if cv and median_rent and cv > 0:
        return round((median_rent * 52 / cv) * 100, 1)
    return None


def _get_cagr(report: dict, years: int) -> float | None:
    market = report.get("market") or {}
    trends_list = market.get("trends") or []
    if not isinstance(trends_list, list):
        return None
    t = next(
        (x for x in trends_list if isinstance(x, dict)
         and x.get("dwelling_type") == "ALL" and x.get("beds") == "ALL"),
        None,
    )
    if not t:
        return None
    return t.get(f"cagr_{years}yr")


def _count_available(report: dict) -> tuple[int, int]:
    """Count available vs total data indicators."""
    checks = [
        report.get("hazards"),
        report.get("environment"),
        report.get("liveability"),
        report.get("market"),
        report.get("planning"),
        report.get("property"),
        (report.get("scores") or {}).get("composite"),
        (report.get("environment") or {}).get("road_noise_db"),
        (report.get("liveability") or {}).get("nzdep_decile"),
        (report.get("liveability") or {}).get("crime_victimisations"),
        (report.get("liveability") or {}).get("transit_stops_400m"),
        (report.get("liveability") or {}).get("schools"),
        (report.get("market") or {}).get("rental_overview"),
        (report.get("planning") or {}).get("zone_name"),
        (report.get("environment") or {}).get("air_pm10_site"),
        (report.get("environment") or {}).get("water_site"),
        (report.get("environment") or {}).get("climate_temp_change"),
        (report.get("hazards") or {}).get("flood"),
        (report.get("hazards") or {}).get("liquefaction"),
        (report.get("hazards") or {}).get("earthquake_count_30km"),
    ]
    total = len(checks)
    available = sum(1 for c in checks if c is not None and c != "" and c != [] and c != {})
    return available, total


# =============================================================================
# Score → Rating Label Helper
# =============================================================================

# Matches RATING_BINS in risk_score.py
_RATING_BINS = [
    (0,  20, "Very Low",  "#0D7377"),
    (21, 40, "Low",       "#56B4E9"),
    (41, 60, "Moderate",  "#E69F00"),
    (61, 80, "High",      "#D55E00"),
    (81, 100, "Very High", "#C42D2D"),
]


def _score_to_rating(score: float | None) -> tuple[str, str]:
    """Return (label, color) for a 0–100 risk score."""
    if score is None:
        return "Unknown", "#666"
    for lo, hi, label, color in _RATING_BINS:
        if lo <= score <= hi:
            return label, color
    return "Unknown", "#666"


# =============================================================================
# Main Render Function
# =============================================================================

def render(
    report: dict,
    python_insights: dict | None = None,
    lifestyle_fit: tuple[list[dict], list[str]] | None = None,
    ai_insights: dict | None = None,
    recommendations: list[dict] | None = None,
    nearby_supermarkets: list[dict] | None = None,
    nearby_highlights: dict | None = None,
    nearby_parks: list[dict] | None = None,
    nearby_cafes: list[dict] | None = None,
    nearby_restaurants: list[dict] | None = None,
    nearby_playgrounds: list[dict] | None = None,
    nearby_zones: list[dict] | None = None,
    persona: str = "buyer",
    rent_history_data: list[dict] | None = None,
    hpi_data: list[dict] | None = None,
    rates_data: dict | None = None,
    user_display_name: str | None = None,
    budget_inputs: dict | None = None,
    user_rent_context: dict | None = None,
    rent_advisor_result: dict | None = None,
    rent_inputs: dict | None = None,
    price_advisor_result: dict | None = None,
    buyer_inputs: dict | None = None,
) -> str:
    """Generate premium HTML from a property report dict.

    python_insights      — output of build_insights(report)
    lifestyle_fit        — output of build_lifestyle_fit(report) → (personas, tips)
    ai_insights          — output of generate_pdf_insights() → parsed JSON dict
    recommendations      — output of build_recommendations(report) → list of rec dicts
    nearby_supermarkets  — list of up to 5 nearby supermarkets from OSM
    nearby_highlights    — {"good": [...], "caution": [...], "info": [...]} categorised amenities
    rent_history_data    — 10yr rent time series from bonds_detailed
    hpi_data             — national HPI trend from rbnz_housing
    rates_data           — WCC rates breakdown (Wellington only)
    """
    if python_insights is None:
        python_insights = build_insights(report)
    if lifestyle_fit is None:
        lifestyle_fit = build_lifestyle_fit(report)
    if recommendations is None:
        recommendations = build_recommendations(report)

    personas, tips = lifestyle_fit

    addr = report.get("address") or {}
    scores = report.get("scores") or {}
    hazards = report.get("hazards") or {}
    env = report.get("environment") or {}
    live = report.get("liveability") or {}
    market = report.get("market") or {}
    planning = report.get("planning") or {}
    prop = report.get("property") or {}

    full_address = addr.get("full_address", "Unknown Address")
    composite = scores.get("composite")
    rating_obj = scores.get("rating") or {}
    rating_label = rating_obj.get("label", "Unknown") if isinstance(rating_obj, dict) else str(rating_obj)
    badge_color = rating_obj.get("color", "#0D7377") if isinstance(rating_obj, dict) else "#0D7377"

    # Normalise categories: plain floats → {score, rating, color} dicts
    _raw_cats = scores.get("categories") or {}
    categories: dict = {}
    for cat_name, cat_data in _raw_cats.items():
        if isinstance(cat_data, dict):
            # Already a dict — ensure rating is populated
            cat_score = cat_data.get("score")
            if cat_score is not None and not cat_data.get("rating"):
                lbl, clr = _score_to_rating(cat_score)
                categories[cat_name] = {**cat_data, "rating": lbl, "color": clr}
            else:
                categories[cat_name] = cat_data
        elif isinstance(cat_data, (int, float)):
            lbl, clr = _score_to_rating(cat_data)
            categories[cat_name] = {"score": cat_data, "rating": lbl, "color": clr}
        else:
            categories[cat_name] = cat_data

    # Market data shortcuts
    rental_list = market.get("rental_overview") or []
    trends_list = market.get("trends") or []

    # Safe numeric helper
    def _safe_int(v: Any) -> int:
        if v is None:
            return 0
        try:
            return int(v)
        except (TypeError, ValueError):
            return 0

    def _safe_float_val(v: Any) -> float:
        if v is None:
            return 0.0
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0

    # Computed values
    yield_pct = _compute_yield(report)
    cagr_1yr = _get_cagr(report, 1)
    cagr_5yr = _get_cagr(report, 5)
    cv_raw = prop.get("capital_value") or prop.get("cv_capital")
    cv = _safe_int(cv_raw) if cv_raw is not None else None
    prop_cv = cv  # alias used in template

    # Phase 2: Land/Improvements split for donut chart
    land_value = _safe_int(prop.get("land_value"))
    improvements_value = _safe_int(prop.get("improvements_value"))
    land_pct = round((land_value / cv) * 100) if cv and cv > 0 and land_value else 0
    improvements_pct = 100 - land_pct if land_pct > 0 else 0

    # Phase 5: Crash dot data
    _crash_fatal = min(_safe_int(live.get("crashes_300m_fatal")), 5)
    _crash_serious = min(_safe_int(live.get("crashes_300m_serious")) - _crash_fatal, 10)
    _crash_minor = min(_safe_int(live.get("crashes_300m_total")) - _safe_int(live.get("crashes_300m_serious")), 10)
    crash_dots = []
    for _ in range(_crash_fatal): crash_dots.append({"color": "#C42D2D"})
    for _ in range(max(0, _crash_serious)): crash_dots.append({"color": "#D55E00"})
    for _ in range(max(0, _crash_minor)): crash_dots.append({"color": "#9CA3AF"})

    # Contamination explanation
    contam_cat = env.get("contam_nearest_category")
    contam_cat_exp = ANZECC_EXPLANATIONS.get(str(contam_cat).upper(), "") if contam_cat else ""

    # Noise context
    noise_db_val = env.get("road_noise_db")
    noise_ctx = noise_context(float(noise_db_val) if noise_db_val is not None else None)

    # Coverage counts
    available_indicators, total_indicators = _count_available(report)
    missing = total_indicators - available_indicators
    coverage_note = f"Covers {available_indicators}/{total_indicators} indicators. {missing} not available for this location." if missing > 0 else f"All {total_indicators} standard indicators available."

    # Consents count (for investment snapshot)
    consents_count = planning.get("resource_consents_500m_2yr")

    # Humanized hazard rows (all 8, always shown)
    hazard_rows = build_humanized_hazards(hazards)

    # Executive summary fallback (used when AI unavailable)
    exec_summary_fallback = build_exec_summary_fallback(report, python_insights)

    # In-zone schools first, then rest — for display
    all_schools = live.get("schools_1500m") or []
    in_zone_schools = [s for s in all_schools if s.get("in_zone")]
    other_schools   = [s for s in all_schools if not s.get("in_zone")]

    # Extract supermarket, GP, pharmacy data for easier template access
    supermarket_data = live.get("nearest_supermarket")
    supermarket_name = supermarket_data.get("name") if isinstance(supermarket_data, dict) else None
    supermarket_dist = supermarket_data.get("distance_m") if isinstance(supermarket_data, dict) else None

    gp_data = live.get("nearest_gp")
    gp_name = gp_data.get("name") if isinstance(gp_data, dict) else None
    gp_dist = gp_data.get("distance_m") if isinstance(gp_data, dict) else None

    pharmacy_data = live.get("nearest_pharmacy")
    pharmacy_name = pharmacy_data.get("name") if isinstance(pharmacy_data, dict) else None
    pharmacy_dist = pharmacy_data.get("distance_m") if isinstance(pharmacy_data, dict) else None

    # Generate map image with all landmarks
    lat = addr.get("lat") or addr.get("latitude")
    lng = addr.get("lng") or addr.get("longitude")
    if lat and lng:
        try:
            map_url = generate_map_image(
                lat=float(lat),
                lng=float(lng),
                schools_inzone=in_zone_schools,
                schools_other=other_schools,
                supermarkets=nearby_supermarkets if nearby_supermarkets else None,
                supermarket=live.get("nearest_supermarket") if isinstance(live.get("nearest_supermarket"), dict) else None,
                gp=live.get("nearest_gp") if isinstance(live.get("nearest_gp"), dict) else None,
                pharmacy=live.get("nearest_pharmacy") if isinstance(live.get("nearest_pharmacy"), dict) else None,
                transit_stops=live.get("transit_stops_list") or [],
                parks=nearby_parks,
                cafes=nearby_cafes,
                restaurants=nearby_restaurants,
                playgrounds=nearby_playgrounds,
                zones=nearby_zones,
            )
        except Exception as e:
            logger.warning(f"Map generation failed: {e}")
            map_url = None
    else:
        map_url = None

    env_jinja = Environment(loader=FileSystemLoader(
        str(Path(__file__).parent.parent / "templates" / "report")
    ), autoescape=True, trim_blocks=True, lstrip_blocks=True)
    template = env_jinja.get_template("property_report.html")

    # Persona-specific computed values
    persona_label = "Renter Report" if persona == "renter" else "Property Report"

    # Insurance risk assessment
    _insurance_factors = []
    if hazards.get("flood"):
        _insurance_factors.append("Flood zone")
    if planning.get("epb_listed"):
        _insurance_factors.append("Earthquake-prone building")
    _slope = (hazards.get("slope_failure") or "").lower()
    if "high" in _slope:
        _insurance_factors.append("Slope failure risk")
    if hazards.get("tsunami_evac_zone") or hazards.get("tsunami_zone_class"):
        _insurance_factors.append("Tsunami zone")
    if hazards.get("landslide_in_area"):
        _insurance_factors.append("Mapped landslide area")
    insurance_risk = "green" if len(_insurance_factors) == 0 else ("amber" if len(_insurance_factors) <= 2 else "red")
    insurance_message = {
        "green": "Standard insurance likely available at normal premiums.",
        "amber": f"May face excess or exclusions for {', '.join(f.lower() for f in _insurance_factors)}.",
        "red": "Likely to face significant premium loading or difficulty obtaining cover.",
    }[insurance_risk]

    # Walkability estimate
    _amenity_ct = sum(v for v in (live.get("amenities_500m") or {}).values() if isinstance(v, (int, float)))
    _transit_ct = live.get("transit_stops_400m") or 0
    _cbd_dist = live.get("cbd_distance_m") or 10000
    _school_ct = len(live.get("schools_1500m") or [])
    walkability = min(100, (
        min(25, round((_amenity_ct / 15) * 25))
        + min(25, round((_transit_ct / 10) * 25))
        + max(0, round(20 * (1 - min(_cbd_dist, 5000) / 5000)))
        + min(15, round((_school_ct / 5) * 15))
        + 10  # baseline
    ))

    # Phase 6: New SVG chart builders
    rent_trend_chart = _build_rent_trend_chart(rent_history_data or [])
    rent_quartile_box = _build_rent_quartile_box(rental_list)
    transit_mode_chart = _build_transit_mode_bars(live)
    amenity_breakdown = _build_amenity_breakdown(live.get("amenities_500m") or {})
    monthly_cost = _build_budget_from_inputs(report, budget_inputs, rates_data) or _build_monthly_cost(report, rates_data)
    walkability_gauge = _build_walkability_gauge(live)
    trajectory = _build_trajectory_visual(report)
    hpi_chart = _build_hpi_chart(hpi_data or [])
    investment_cards = _build_investment_cards(report)

    # Premium PDF overhaul builders
    comparison_bars = _build_comparison_bars(report, suburb_name=addr.get("suburb") or addr.get("sa2_name") or "")
    rag_grid = _build_rag_grid(report, persona, insurance_risk, walkability)
    active_fault_section = _build_active_fault_section(hazards)
    healthy_homes = _build_healthy_homes_signals(report)
    rent_verdict = _build_rent_verdict(report, budget_inputs, user_rent_context)
    section_interp = _build_section_interpretations(
        report, persona, python_insights, monthly_cost,
        trajectory, investment_cards,
        hazard_rows=hazard_rows, comparison_bars=comparison_bars,
    )

    return template.render(
        # Persona
        persona=persona,
        persona_label=persona_label,
        # Cover
        full_address=full_address,
        report_date=date.today().isoformat(),
        addr=addr,
        composite=composite,
        rating_label=rating_label,
        badge_color=badge_color,
        confidence_pct=None,  # placeholder for future confidence scoring
        available_indicators=available_indicators,
        total_indicators=total_indicators,
        coverage_note=coverage_note,
        # Score overview
        categories=categories,
        # Sections
        hazards=hazards,
        env=env,
        live=live,
        market=market,
        planning=planning,
        prop=prop,
        area_profile=report.get("area_profile"),
        # Insights
        insights=python_insights,
        audience_callouts=_build_audience_callouts(report),
        # Lifestyle
        lifestyle_fit=personas,
        lifestyle_tips=tips,
        # AI
        ai_insights=ai_insights or {},
        # Market helpers
        rental_list=rental_list if isinstance(rental_list, list) else [],
        trends_list=trends_list if isinstance(trends_list, list) else [],
        yield_pct=yield_pct,
        cagr_1yr=cagr_1yr,
        cagr_5yr=cagr_5yr,
        prop_cv=cv,
        land_pct=land_pct,
        improvements_pct=improvements_pct,
        land_value=land_value,
        improvements_value=improvements_value,
        crash_dots=crash_dots,
        consents_count=consents_count,
        # Environment helpers
        noise_context=noise_ctx,
        city_median_noise=58,   # NZ urban residential median
        contam_category_explanation=contam_cat_exp,
        # New additions
        hazard_rows=hazard_rows,
        exec_summary_fallback=exec_summary_fallback,
        map_url=map_url,
        in_zone_schools=in_zone_schools,
        other_schools=other_schools,
        supermarket_name=supermarket_name,
        supermarket_distance_m=supermarket_dist,
        gp_name=gp_name,
        gp_distance_m=gp_dist,
        pharmacy_name=pharmacy_name,
        pharmacy_distance_m=pharmacy_dist,
        # Nearby supermarkets (up to 5)
        nearby_supermarkets=nearby_supermarkets or [],
        # Categorised nearby amenities
        highlights_good=(nearby_highlights or {}).get("good", []),
        highlights_caution=(nearby_highlights or {}).get("caution", []),
        highlights_info=(nearby_highlights or {}).get("info", []),
        # Solar potential (from hazards/environment)
        solar_mean=hazards.get("solar_mean_kwh"),
        solar_max=hazards.get("solar_max_kwh"),
        # Nearest earthquake-prone building details
        epb_nearest=hazards.get("epb_nearest"),
        # Wildfire trend detail
        wildfire_trend=hazards.get("wildfire_trend"),
        wildfire_vhe_days=hazards.get("wildfire_vhe_days"),
        # Landslide data (GNS NZLD)
        landslide_count=hazards.get("landslide_count_500m"),
        landslide_nearest=hazards.get("landslide_nearest"),
        landslide_in_area=hazards.get("landslide_in_area"),
        # Before You Buy recommendations
        recommendations=recommendations,
        recs_critical=[r for r in recommendations if r["severity"] == "critical"],
        recs_important=[r for r in recommendations if r["severity"] == "important"],
        recs_advisory=[r for r in recommendations if r["severity"] == "advisory"],
        # Phase 4: Premium PDF Toolkit
        comparison_bars=comparison_bars,
        radar_chart=_build_radar_chart(categories),
        hazard_bars=_build_hazard_bars(report),
        rent_bars=_build_rent_bars(report),
        checklist=_build_checklist(python_insights),
        methodology_notes=(
            "WhareScore computes a composite risk score (0-100) using a weighted average of five category scores: "
            "Hazards (30%), Liveability (25%), Environment (15%), Market (15%), and Planning (15%). "
            "Higher scores indicate higher risk. Each category score is derived from normalised sub-indicators — "
            "for example, Hazards aggregates flood zone presence, liquefaction class, seismic activity, wind zone, "
            "tsunami zone, wildfire danger days, coastal erosion risk, earthquake-prone building proximity, and slope "
            "failure susceptibility. Liveability incorporates NZDep deprivation index, crime victimisation percentile, "
            "transit access, school quality (EQI), and road crash history. Environment covers road noise, air quality "
            "trends, water quality grades, contaminated land proximity, and climate projections. Market uses rental "
            "median, yield, and growth trends. Planning considers EPB status, heritage listing, contaminated land "
            "schedule, transmission line proximity, and development activity. Data freshness varies by source — most "
            "datasets are updated annually or quarterly. Scores are indicative and should not replace professional advice."
        ),
        data_quality=[
            {"source": "LINZ Property Titles & Valuations", "last_updated": "2025 Q4", "coverage_pct": 99},
            {"source": "GWRC Hazard Maps (Flood, Fault, Liquefaction)", "last_updated": "2024", "coverage_pct": 95},
            {"source": "MBIE Earthquake-Prone Buildings Register", "last_updated": "2025 Q1", "coverage_pct": 100},
            {"source": "NZTA Road Noise Atlas (LAeq24h)", "last_updated": "2024", "coverage_pct": 85},
            {"source": "MBIE Tenancy Bond Data (Rents)", "last_updated": "2025 Q4", "coverage_pct": 90},
            {"source": "Stats NZ NZDep 2018 Index", "last_updated": "2018", "coverage_pct": 100},
            {"source": "NZ Police Crime Victimisations", "last_updated": "2024", "coverage_pct": 95},
            {"source": "GTFS Public Transport Feeds", "last_updated": "2025", "coverage_pct": 90},
            {"source": "MoE School Directory & Zones", "last_updated": "2025", "coverage_pct": 98},
            {"source": "LAWA Water & Air Quality", "last_updated": "2024", "coverage_pct": 80},
            {"source": "NIWA Climate Projections (SSP2-4.5)", "last_updated": "2024", "coverage_pct": 100},
            {"source": "GWRC Contaminated Land (SLUR)", "last_updated": "2024", "coverage_pct": 90},
        ],
        # Phase 5: New computed sections
        insurance_risk=insurance_risk,
        insurance_factors=_insurance_factors,
        insurance_message=insurance_message,
        walkability_score=walkability,
        # Phase 6: New SVG charts + missing data fields
        rent_trend_chart=rent_trend_chart,
        rent_quartile_box=rent_quartile_box,
        transit_mode_chart=transit_mode_chart,
        amenity_breakdown=amenity_breakdown,
        monthly_cost=monthly_cost,
        walkability_gauge=walkability_gauge,
        trajectory=trajectory,
        hpi_chart=hpi_chart,
        investment_cards=investment_cards,
        rates_data=rates_data,
        # Missing data fields
        in_corrosion_zone=hazards.get("in_corrosion_zone"),
        in_rail_vibration_area=hazards.get("in_rail_vibration_area"),
        rail_vibration_type=hazards.get("rail_vibration_type"),
        on_erosion_prone_land=hazards.get("on_erosion_prone_land"),
        erosion_min_angle=hazards.get("erosion_min_angle"),
        coastal_elevation_m=hazards.get("coastal_elevation_m"),
        coastal_inundation_ranking=hazards.get("coastal_inundation_ranking"),
        in_viewshaft=planning.get("in_viewshaft"),
        viewshaft_name=planning.get("viewshaft_name"),
        in_character_precinct=planning.get("in_character_precinct"),
        character_precinct_name=planning.get("character_precinct_name"),
        conservation_nearest=live.get("conservation_nearest"),
        building_use=prop.get("building_use"),
        title_type=prop.get("title_type"),
        estate_description=prop.get("estate_description"),
        zone_category=planning.get("zone_category"),
        # Premium user personalisation
        is_premium=user_display_name is not None,
        user_display_name=user_display_name,
        # Premium PDF overhaul
        rag_grid=rag_grid,
        active_fault_section=active_fault_section,
        healthy_homes=healthy_homes,
        rent_verdict=rent_verdict,
        user_rent_context=user_rent_context,
        section_interp=section_interp,
        # Rent advisor (premium)
        rent_advisor=rent_advisor_result,
        rent_inputs=rent_inputs or {},
        # Price advisor (premium — buyer)
        price_advisor=price_advisor_result,
        buyer_inputs=buyer_inputs or {},
    )
