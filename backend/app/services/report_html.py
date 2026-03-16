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
    return Environment(loader=FileSystemLoader(str(template_dir)), autoescape=True)


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
                         "detail": "Below-average slope failure risk for the Wellington region.",
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
    city   = addr.get("city") or "Wellington"

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
                "Identify your inland evacuation route. Zone 3 affects resale times in some Wellington suburbs.",
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

    # Slope Failure / Landslide
    slope_failure = str(hazards.get("slope_failure") or "").lower()
    if "very high" in slope_failure:
        result["hazards"].append(Insight(
            "warn",
            "Very High earthquake-induced landslide susceptibility — Wellington's steep clay hillsides "
            "are among NZ's most slip-prone terrain. Recent storms (2022, 2024) caused hundreds of slips "
            "across the region in zones like this.",
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

    # ── Wellington-Specific Hazard Rules ─────────────────────────────────────

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
            "WCC District Plan restricts building in fault avoidance zones. Check if resource consent "
            "is required for modifications. Surface rupture cannot be mitigated by building design.",
        ).to_dict())

    wcc_tsunami = hazards.get("wcc_tsunami_return_period")
    if wcc_tsunami and wcc_tsunami in ("1:100yr", "1:500yr"):
        result["hazards"].append(Insight(
            "warn" if wcc_tsunami == "1:100yr" else "info",
            f"WCC District Plan tsunami zone ({wcc_tsunami} return period).",
            "Know your evacuation route to high ground. Long or strong earthquake = move immediately. "
            "Zone affects insurance and may restrict future building consent for habitable rooms.",
        ).to_dict())

    wcc_flood_type = hazards.get("wcc_flood_type")
    wcc_flood_rank = hazards.get("wcc_flood_ranking")
    if wcc_flood_type and wcc_flood_rank:
        severity = "warn" if wcc_flood_rank in ("High", "Medium") else "info"
        result["hazards"].append(Insight(
            severity,
            f"WCC District Plan flood overlay: **{wcc_flood_type}** ({wcc_flood_rank} ranking).",
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
                f"Good solar exposure: {solar_kwh:.0f} kWh/m²/yr — above Wellington average. Solar panels viable.",
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
        dist_str = f" ({int(air_dist)}m)" if air_dist else ""
        result["environment"].append(Insight(
            "warn",
            f"PM10 air quality is degrading at {air_site}{dist_str}.",
            "HEPA filtration effective indoors. Check if wood burners are the dominant source.",
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
    if contam_dist is not None and contam_dist <= 200:
        name = env.get("contam_nearest_name", "unknown site")
        cat = env.get("contam_nearest_category", "")
        cat_exp = ANZECC_EXPLANATIONS.get(str(cat).upper(), "")
        count_2km = env.get("contam_count_2km")
        count_str = f" {count_2km} contaminated sites within 2km." if count_2km is not None else ""
        cat_str = f" (ANZECC Category {cat} — {cat_exp})" if cat and cat_exp else ""
        result["environment"].append(Insight(
            "warn",
            f"Contaminated site {int(contam_dist)}m away: **{name}**{cat_str}.{count_str}",
            "ANZECC categories indicate likely historic use. Check GWRC SLUR register for full site history. "
            "For purchase: a Phase 1 Environmental Site Assessment (~$1,500–3,000) is standard practice and may be required by your lender.",
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
    if transit is not None:
        if transit <= 2:
            result["liveability"].append(Insight(
                "info",
                f"Only {transit} transit stop{'s' if transit != 1 else ''} within 400m — car-dependent location.",
                "Factor in vehicle running costs. Check bus frequency before committing if car-free.",
            ).to_dict())
        elif transit >= 10:
            result["liveability"].append(Insight(
                "ok",
                f"{transit} public transport stops within 400m — excellent transit access.",
                "",
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
                    f"Indicative gross yield: {yield_pct}% — above Wellington metro average (~3.5–4%).",
                    "",
                ).to_dict())
            elif yield_pct < 3:
                result["market"].append(Insight(
                    "info",
                    f"Indicative gross yield: {yield_pct}% — below typical Wellington averages. Elevated price-to-rent ratio.",
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

    ctx = _SafeFormatDict({
        "earthquake_count": eq_count or 0,
        "wildfire_days": int(wf_days) if wf_days else 0,
        "epb_count_300m": _int(hazards.get("epb_count_300m")) or 0,
        "noise_db": int(noise_db) if noise_db else 0,
        "contam_name": env.get("contam_nearest_name", "unknown site"),
        "contam_category": env.get("contam_nearest_category", ""),
        "contam_distance_m": int(contam_dist) if contam_dist else 0,
        "climate_temp_change": f"{climate_change:.1f}" if climate_change else "0",
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

        # Interpolate placeholders safely
        actions = []
        for t in templates:
            try:
                actions.append(t.format_map(ctx))
            except (KeyError, ValueError, IndexError):
                actions.append(t)

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
            "if you have a car, factor in a parking space (~$200–350/month in central Wellington)."
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
                    insight = "More deprived than {area} average"
                else:
                    insight = "Less deprived than {area} average"
            elif "epb" in m["label"].lower():
                if prop_val == 0:
                    insight = "None nearby — better than {area} average"
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


def _score_to_rating(score: float) -> tuple[str, str]:
    """Return (label, color) for a 0–100 risk score."""
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
) -> str:
    """Generate premium HTML from a property report dict.

    python_insights      — output of build_insights(report)
    lifestyle_fit        — output of build_lifestyle_fit(report) → (personas, tips)
    ai_insights          — output of generate_pdf_insights() → parsed JSON dict
    recommendations      — output of build_recommendations(report) → list of rec dicts
    nearby_supermarkets  — list of up to 5 nearby supermarkets from OSM
    nearby_highlights    — {"good": [...], "caution": [...], "info": [...]} categorised amenities
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

    # Computed values
    yield_pct = _compute_yield(report)
    cagr_1yr = _get_cagr(report, 1)
    cagr_5yr = _get_cagr(report, 5)
    cv = prop.get("capital_value") or prop.get("cv_capital")

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
            )
        except Exception as e:
            logger.warning(f"Map generation failed: {e}")
            map_url = None
    else:
        map_url = None

    env_jinja = Environment(loader=FileSystemLoader(
        str(Path(__file__).parent.parent / "templates" / "report")
    ), autoescape=True)
    template = env_jinja.get_template("property_report.html")

    return template.render(
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
        consents_count=consents_count,
        # Environment helpers
        noise_context=noise_ctx,
        city_median_noise=58,   # Wellington residential median
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
        # Before You Buy recommendations
        recommendations=recommendations,
        recs_critical=[r for r in recommendations if r["severity"] == "critical"],
        recs_important=[r for r in recommendations if r["severity"] == "important"],
        recs_advisory=[r for r in recommendations if r["severity"] == "advisory"],
        # Phase 4: Premium PDF Toolkit
        comparison_bars=_build_comparison_bars(report, suburb_name=addr.get("suburb") or addr.get("sa2_name") or ""),
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
    )
