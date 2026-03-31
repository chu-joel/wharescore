# backend/app/services/risk_score.py
"""
Risk score computation engine.

Takes raw report JSON from get_property_report(), normalizes all indicators
to 0-100 scale, aggregates per category, computes composite score.

Reference: RISK-SCORE-METHODOLOGY.md
"""
from __future__ import annotations

import math


# =============================================================================
# Rating Bins (composite score → label + color)
# =============================================================================

RATING_BINS = [
    (0, 20, "Very Low", "#0D7377"),
    (21, 40, "Low", "#56B4E9"),
    (41, 60, "Moderate", "#E69F00"),
    (61, 80, "High", "#D55E00"),
    (81, 100, "Very High", "#C42D2D"),
]


# =============================================================================
# Normalization Functions
# =============================================================================

def normalize_min_max(
    raw: float | None, range_min: float, range_max: float, inverse: bool = False
) -> float | None:
    """Expert-range min-max normalization to 0-100.
    Ref: RISK-SCORE-METHODOLOGY.md Method 1.
    inverse=True means higher raw = LOWER risk (e.g., transit stops)."""
    if raw is None:
        return None
    clamped = max(range_min, min(range_max, raw))
    score = ((clamped - range_min) / (range_max - range_min)) * 100
    return 100 - score if inverse else score


# Expert ranges — values from RISK-SCORE-METHODOLOGY.md §4
EXPERT_RANGES = {
    "earthquake_count": (0, 50),     # M4+, 30km, 10yr
    "road_noise_db": (40, 75),       # WHO: 40 quiet, 75 arterial
    "wildfire_vhe_days": (0, 30),    # highest station ~25
    "epb_count": (0, 15),            # WCC CBD max ~10-12
    "transit_stops": (0, 25),        # CBD ~20+, inverse
    "crash_count": (0, 50),          # serious/fatal, 300m, 5yr
    "heritage_count": (0, 100),      # Wellington CBD ~90+
    "climate_temp": (0, 3.0),        # °C SSP2-4.5 2050
    "contaminated_dist": (0, 2000),  # metres, inverse (closer=worse)
    "school_count": (0, 15),         # within 1.5km
    "resource_consents": (0, 30),    # granted, 500m, 2yr
    "infrastructure": (0, 40),       # projects within 5km
}


def log_normalize(count: int | None, max_meaningful: int) -> float:
    """Log-scaled count normalization to 0-100.
    Ref: RISK-SCORE-METHODOLOGY.md Method 4.
    Used for transit, heritage, consents, infrastructure."""
    if count is None or count == 0:
        return 0
    return min(100, math.log(1 + count) / math.log(1 + max_meaningful) * 100)


def school_quality_score(schools: list[dict]) -> float:
    """Quality-weighted school scoring.
    Ref: RISK-SCORE-METHODOLOGY.md Method 5.
    Each school: {distance_m, eqi, name, school_type, in_zone, total_roll}.
    EQI range 400-520. Returns 0-100 (100 = worst, 0 = best schools nearby)."""
    if not schools:
        return 100  # no nearby schools = worst score
    MAX_QUALITY = 8.0
    quality_points = sum(
        (1 / max(s.get("distance_m", 1000) / 1000, 0.1))
        * ((s.get("eqi", 460) - 400) / 120)
        for s in schools
        if s.get("eqi")
    )
    # Clamp to 0-100: quality_score starts at 0 (worst), increases with good schools nearby
    quality_score = max(0, min(100, (quality_points / MAX_QUALITY) * 100))
    # Invert: 100 = no good schools (worst), 0 = excellent schools nearby (best)
    return 100 - quality_score


def contamination_score(distance_m: float | None, category: str | None) -> float:
    """Combined distance + severity score.
    Closer and more hazardous = higher score (worse)."""
    if distance_m is None:
        return 0
    HIGH_RISK = ["chemical", "metal extraction", "explosives", "vehicle refuelling"]
    severity = 0.5
    if category:
        cat_lower = category.lower()
        if any(k in cat_lower for k in HIGH_RISK):
            severity = 0.8
        elif "cemetery" in cat_lower or "waste" in cat_lower:
            severity = 0.6
    return max(0, (1 - distance_m / 2000)) * 100 * severity


# =============================================================================
# Severity Mapping Dictionaries (Method 2 — ordinal/categorical → 0-100)
# All values verified against actual DB content (session 23)
# =============================================================================

def severity_flood(label: str | None) -> float:
    """Actual labels: '1% AEP flood hazard', '0.23% AEP flood hazard'."""
    if label is None:
        return 0
    if "0.2" in label:
        return 35   # ~430-yr return period
    if "1%" in label:
        return 75   # 100-yr planning threshold
    return 60        # unknown flood zone


SEVERITY_TSUNAMI = {None: 0, 1: 30, 2: 60, 3: 85}

SEVERITY_LIQUEFACTION = {
    None: 0, "Low": 20, "Moderate": 50, "High": 80, "Very High": 95,
}

SEVERITY_SLOPE_FAILURE = {
    None: 0, "Very Low": 5, "Low": 20, "Medium": 45, "High": 75, "Very High": 90,
}

# Wellington-specific: GWRC slope failure severity (format: "1 Low" → "5 High")
SEVERITY_GWRC_SLOPE = {
    None: None, "1 Low": 10, "2": 25, "3 Moderate": 45, "4": 70, "5 High": 90,
}

# Wellington-specific: GWRC ground shaking (format: "1 Low" → "5 High")
SEVERITY_GWRC_GROUND_SHAKING = {
    None: None, "1 Low": 10, "2": 25, "3 Moderate": 45, "4": 70, "5 High": 90,
}


def severity_wind(zone_name: str | None) -> float:
    """Actual DB values: 'M', 'H', 'VH', 'EH', 'SED', 'Low Risk', 'High Risk'."""
    if zone_name is None:
        return 10
    z = zone_name.strip().upper()
    if "LOW" in z:
        return 10
    if z in ("M",) or "MEDIUM" in z:
        return 30
    if z in ("H",) or (z.startswith("HIGH") and "VERY" not in z):
        return 55
    if z in ("VH",) or "VERY HIGH" in z or "VH" in z:
        return 75
    if "EH" in z:
        return 85
    if "SED" in z:
        return 90
    if "DESIGN" in z or "INDEPENDENT" in z:
        return 80
    return 40


SEVERITY_COASTAL_EXPOSURE = {
    None: 0, "S": 10, "S-PB": 15, "E": 65, "E-PB": 70,
}

SEVERITY_LANDSLIDE_SUSCEPTIBILITY = {
    None: 0, "Very Low": 5, "Low": 15, "Moderate": 45, "Medium": 45,
    "High": 75, "Very High": 90,
}

SEVERITY_COASTAL_EROSION_EXPOSURE = {
    None: 0, "Very Low": 5, "Low": 15, "Moderate": 40, "High": 70, "Very High": 90,
}

SEVERITY_AIR_QUALITY = {
    None: 30,
    "Improving": 10,
    "Indeterminate": 30,
    "Not available (not enough data available)": 30,
    "Degrading": 70,
}

SEVERITY_WATER_BAND = {"A": 5, "B": 20, "C": 40, "D": 65, "E": 85}


def worst_water_band(env: dict) -> float | None:
    """Score based on worst NPS-FM band across ecoli/ammonia/nitrate/drp/clarity."""
    order = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}
    worst = None
    for key in [
        "water_ecoli_band", "water_ammonia_band", "water_nitrate_band",
        "water_drp_band", "water_clarity_band",
    ]:
        b = env.get(key)
        if b and b in order:
            if worst is None or order[b] > order[worst]:
                worst = b
    return SEVERITY_WATER_BAND[worst] if worst else None


SEVERITY_NZDEP = {
    1: 5, 2: 12, 3: 22, 4: 33, 5: 44, 6: 55, 7: 66, 8: 77, 9: 88, 10: 95,
}

SEVERITY_WILDFIRE_TREND = {
    None: 30, "None": 30, "Very likely decreasing": 10, "Likely decreasing": 20,
    "Indeterminate": 40, "Likely increasing": 70, "Very likely increasing": 85,
}


# =============================================================================
# Within-Category Weights (RISK-SCORE-METHODOLOGY.md §3)
# =============================================================================

WEIGHTS_HAZARDS = {          # Sum = 1.0 (base), softmax aggregation
    "flood": 0.14, "tsunami": 0.11, "liquefaction": 0.11,
    "slope_failure": 0.11, "earthquake": 0.09, "coastal_erosion": 0.08,
    "wind": 0.07, "wildfire": 0.07, "epb": 0.05,
    # Council-specific (only present when data available)
    "landslide_susceptibility": 0.10, "overland_flow": 0.04,
    "aircraft_noise": 0.05, "coastal_erosion_council": 0.08,
    # Wellington-specific (only present when GWRC/WCC data available)
    "ground_shaking": 0.12, "fault_zone": 0.10,
}

WEIGHTS_ENVIRONMENT = {      # Sum = 1.0, WAM
    "noise": 0.30, "air_quality": 0.25, "water_quality": 0.20,
    "climate": 0.15, "contaminated_land": 0.10,
}

WEIGHTS_LIVEABILITY = {      # Sum = 1.0, WAM (transit/crashes moved to transport)
    "crime": 0.30, "nzdep": 0.25, "schools": 0.25,
    "heritage": 0.20,
}

WEIGHTS_TRANSPORT = {        # Sum = 1.0, WAM — higher = worse access (consistent with other categories)
    "transit_access": 0.25,       # stops within 400m (0=many, 100=none)
    "cbd_proximity": 0.20,       # distance to CBD (0=close, 100=far)
    "commute_frequency": 0.15,   # peak services/hour (0=frequent, 100=none)
    "rail_proximity": 0.15,      # nearest train station (0=close, 100=far)
    "bus_density": 0.10,         # bus stops within 800m (0=many, 100=none)
    "road_safety": 0.15,         # crash rate (0=safe, 100=dangerous)
}

WEIGHTS_MARKET = {           # Sum = 1.0, WAM
    "rental_fairness": 0.40, "rental_trend": 0.35, "market_heat": 0.25,
}

WEIGHTS_PLANNING = {         # Sum = 1.0, WAM
    "zone_permissiveness": 0.25, "height_limit": 0.20,
    "resource_consents": 0.20, "infrastructure": 0.20,
    "school_zone": 0.15,
}

# Cross-category composite weights
COMPOSITE_WEIGHTS = {
    "hazards": 0.25, "environment": 0.10, "liveability": 0.20,
    "transport": 0.15, "market": 0.15, "planning": 0.15,
}


# =============================================================================
# Aggregation Functions
# =============================================================================

def softmax_aggregate(scores: list[float], weights: list[float], beta: float = 0.08) -> float:
    """Worst-hazard-dominates aggregation for Natural Hazards.
    Higher beta = more dominated by worst score."""
    total = sum(w * math.exp(beta * s) for s, w in zip(scores, weights))
    return max(0, min(100, (1 / beta) * math.log(total)))


def wam_aggregate(scores: list[float | None], weights: list[float]) -> float | None:
    """Weighted arithmetic mean. Skips None values.
    Returns None if fewer than 2 indicators available."""
    available = [(s, w) for s, w in zip(scores, weights) if s is not None]
    if len(available) < 2:
        return None
    return sum(s * w for s, w in available) / sum(w for _, w in available)


def composite_score(categories: dict[str, float], weights: dict[str, float]) -> float | None:
    """Weighted geometric mean of category scores.
    Returns None if fewer than 3 categories available."""
    available = {k: v for k, v in categories.items() if v is not None}
    if len(available) < 3:
        return None
    log_sum = sum(weights[k] * math.log(v + 1) for k, v in available.items())
    weight_sum = sum(weights[k] for k in available)
    return math.exp(log_sum / weight_sum) - 1


# =============================================================================
# Confidence & Coverage
# =============================================================================

CATEGORY_INDICATOR_COUNTS = {
    "hazards": 11, "environment": 5, "liveability": 4, "transport": 6, "market": 3, "planning": 5,
}


def confidence_score(available_per_category: dict[str, int]) -> float:
    """Category-aware confidence. Returns 0-100.
    Categories with <2 available indicators contribute 0%."""
    cat_scores = []
    for cat, total in CATEGORY_INDICATOR_COUNTS.items():
        avail = available_per_category.get(cat, 0)
        cat_scores.append(avail / total if avail >= 2 else 0)
    return (sum(cat_scores) / len(cat_scores)) * 100


_CATEGORY_WEIGHTS = {
    "hazards": WEIGHTS_HAZARDS, "environment": WEIGHTS_ENVIRONMENT,
    "liveability": WEIGHTS_LIVEABILITY, "transport": WEIGHTS_TRANSPORT,
    "market": WEIGHTS_MARKET, "planning": WEIGHTS_PLANNING,
}


def coverage_summary(
    available_per_category: dict[str, int],
    indicators: dict[str, float | None],
) -> dict:
    """Returns {available, total, label, per_category} for DataLayersAccordion."""
    total = sum(CATEGORY_INDICATOR_COUNTS.values())
    available = sum(available_per_category.values())
    per_category = {}
    for cat, weights in _CATEGORY_WEIGHTS.items():
        avail_keys = [k for k in weights if indicators.get(k) is not None]
        per_category[cat] = {
            "available": len(avail_keys),
            "total": CATEGORY_INDICATOR_COUNTS[cat],
            "indicators": avail_keys,
        }
    return {
        "available": available,
        "total": total,
        "label": f"{available} of {total} layers",
        "per_category": per_category,
    }


def score_interval(
    available_scores: list[tuple[float, float]],
    missing_weights: list[float],
) -> tuple[float, float]:
    """When confidence < 70%, compute [low, high] range.
    available_scores: list of (score, weight).
    missing_weights: weights for missing indicators.
    Returns (low, high) bounds."""
    total_weight = sum(w for _, w in available_scores) + sum(missing_weights)
    sum_available = sum(s * w for s, w in available_scores)
    c_low = sum_available / total_weight
    c_high = (sum_available + sum(missing_weights) * 100) / total_weight
    return (round(c_low, 1), round(c_high, 1))


# =============================================================================
# Main Entry Point
# =============================================================================

def enrich_with_scores(report: dict) -> dict:
    """Takes raw report from get_property_report(), adds 'scores' key."""
    haz = report.get("hazards") or {}
    env = report.get("environment") or {}
    liv = report.get("liveability") or {}
    plan = report.get("planning") or {}

    # --- 1. Normalize each indicator ---
    indicators = {}

    # Hazards — only include indicators where we have actual data.
    # NULL raw data = "no data for this location", not "confirmed safe".
    indicators["flood"] = severity_flood(haz.get("flood"))
    if haz.get("tsunami_zone_class") is not None:
        indicators["tsunami"] = SEVERITY_TSUNAMI.get(haz["tsunami_zone_class"], 0)
    if haz.get("liquefaction") is not None:
        indicators["liquefaction"] = SEVERITY_LIQUEFACTION.get(haz["liquefaction"], 0)
    indicators["earthquake"] = normalize_min_max(haz.get("earthquake_count_30km"), 0, 50)
    if haz.get("coastal_exposure") is not None:
        indicators["coastal_erosion"] = SEVERITY_COASTAL_EXPOSURE.get(haz["coastal_exposure"], 0)
    indicators["wind"] = severity_wind(haz.get("wind_zone"))
    indicators["wildfire"] = normalize_min_max(haz.get("wildfire_vhe_days"), 0, 30)
    indicators["epb"] = normalize_min_max(haz.get("epb_count_300m"), 0, 15)
    if haz.get("slope_failure") is not None:
        indicators["slope_failure"] = SEVERITY_SLOPE_FAILURE.get(haz["slope_failure"], 0)

    # GNS landslide database (national) — refine slope_failure with historical events
    ls_count = haz.get("landslide_count_500m") or 0
    ls_in_area = haz.get("landslide_in_area")
    if ls_in_area:
        # Property is inside a mapped landslide area polygon — significant risk
        gns_score = 75
    elif ls_count >= 3:
        gns_score = 65
    elif ls_count >= 1:
        gns_score = 40
    else:
        gns_score = 0
    if gns_score > (indicators.get("slope_failure") or 0):
        indicators["slope_failure"] = gns_score

    # Wellington-specific: refine indicators with higher-resolution regional data
    # GWRC ground shaking amplification → new indicator
    gwrc_gs = SEVERITY_GWRC_GROUND_SHAKING.get(haz.get("ground_shaking_severity"))
    if gwrc_gs is not None:
        indicators["ground_shaking"] = gwrc_gs

    # GWRC combined earthquake hazard grade (1-5) → supplements earthquake count
    eq_grade = haz.get("earthquake_hazard_grade")
    if eq_grade is not None:
        try:
            grade_score = normalize_min_max(float(eq_grade), 1, 5)
            # Take the worse of national earthquake count score and regional grade
            if indicators.get("earthquake") is not None and grade_score is not None:
                indicators["earthquake"] = max(indicators["earthquake"], grade_score)
            elif grade_score is not None:
                indicators["earthquake"] = grade_score
        except (TypeError, ValueError):
            pass

    # GWRC liquefaction → refine national liquefaction with geology detail
    gwrc_liq = haz.get("gwrc_liquefaction")
    gwrc_geo = haz.get("gwrc_liquefaction_geology")
    if gwrc_liq:
        regional_score = SEVERITY_LIQUEFACTION.get(gwrc_liq, 0)
        # Reclaimed land gets a boost — especially vulnerable
        if gwrc_geo and "fill" in str(gwrc_geo).lower():
            regional_score = max(regional_score, 85)
        if regional_score > (indicators.get("liquefaction") or 0):
            indicators["liquefaction"] = regional_score

    # GWRC slope failure → refine national with regional
    gwrc_sf = SEVERITY_GWRC_SLOPE.get(haz.get("gwrc_slope_severity"))
    if gwrc_sf is not None and gwrc_sf > (indicators.get("slope_failure") or 0):
        indicators["slope_failure"] = gwrc_sf

    # WCC fault zone → new indicator
    fault_name = haz.get("fault_zone_name")
    if fault_name:
        ranking = str(haz.get("fault_zone_ranking") or "").lower()
        if "high" in ranking:
            indicators["fault_zone"] = 85
        elif "medium" in ranking:
            indicators["fault_zone"] = 60
        else:
            indicators["fault_zone"] = 45  # any mapped fault zone is notable

    # WCC flood hazard → refine national flood score
    wcc_flood = haz.get("wcc_flood_ranking")
    if wcc_flood:
        wcc_flood_score = {"High": 80, "Medium": 55, "Low": 30}.get(wcc_flood, 40)
        if wcc_flood_score > (indicators.get("flood") or 0):
            indicators["flood"] = wcc_flood_score

    # Council flood AEP (all cities — from flood_hazard table)
    council_flood_aep = haz.get("flood_extent_aep")
    if council_flood_aep and not wcc_flood:
        # AEP-based: lower AEP % = more frequent = worse
        aep_str = str(council_flood_aep).lower()
        if "0.5%" in aep_str or "1 in 200" in aep_str:
            council_flood_score = 45
        elif "1%" in aep_str or "1 in 100" in aep_str:
            council_flood_score = 75
        elif "2%" in aep_str or "1 in 50" in aep_str:
            council_flood_score = 85
        elif "10%" in aep_str or "1 in 10" in aep_str:
            council_flood_score = 90
        else:
            council_flood_score = 60  # unknown flood zone
        if council_flood_score > (indicators.get("flood") or 0):
            indicators["flood"] = council_flood_score

    # WCC tsunami return period → refine national tsunami score
    wcc_tsunami = haz.get("wcc_tsunami_return_period")
    if wcc_tsunami:
        tsunami_score = {"1:100yr": 80, "1:500yr": 55, "1:1000yr": 25}.get(wcc_tsunami, 30)
        if tsunami_score > (indicators.get("tsunami") or 0):
            indicators["tsunami"] = tsunami_score

    # Council tsunami (all cities — from tsunami_hazard table)
    council_tsunami_ranking = haz.get("council_tsunami_ranking")
    if council_tsunami_ranking and not wcc_tsunami:
        tsunami_score = {"High": 80, "Medium": 55, "Low": 30}.get(
            council_tsunami_ranking, 40
        )
        if tsunami_score > (indicators.get("tsunami") or 0):
            indicators["tsunami"] = tsunami_score

    # Council liquefaction (all cities — from liquefaction_detail table)
    council_liq = haz.get("council_liquefaction")
    if council_liq:
        council_liq_score = SEVERITY_LIQUEFACTION.get(council_liq, 0)
        # Also check geology — reclaimed/fill land is especially vulnerable
        council_liq_geo = haz.get("council_liquefaction_geology")
        if council_liq_geo and "fill" in str(council_liq_geo).lower():
            council_liq_score = max(council_liq_score, 85)
        if council_liq_score > (indicators.get("liquefaction") or 0):
            indicators["liquefaction"] = council_liq_score

    # Council slope failure (all cities — from slope_failure table)
    council_slope = haz.get("council_slope_severity")
    if council_slope:
        # Handle both GWRC format ("1 Low"..."5 High") and generic ("Low"..."Very High")
        council_slope_score = SEVERITY_GWRC_SLOPE.get(council_slope)
        if council_slope_score is None:
            council_slope_score = SEVERITY_SLOPE_FAILURE.get(council_slope, 0)
        if council_slope_score and council_slope_score > (indicators.get("slope_failure") or 0):
            indicators["slope_failure"] = council_slope_score

    # Council landslide susceptibility (Auckland etc.)
    ls_rating = haz.get("landslide_susceptibility_rating")
    if ls_rating:
        ls_score = SEVERITY_LANDSLIDE_SUSCEPTIBILITY.get(ls_rating, 0)
        # Take the worse of slope_failure and landslide_susceptibility
        if ls_score > (indicators.get("slope_failure") or 0):
            indicators["landslide_susceptibility"] = ls_score
        else:
            indicators["landslide_susceptibility"] = ls_score

    # Overland flow path proximity (within 50m of polyline flow path)
    if haz.get("overland_flow_within_50m"):
        indicators["overland_flow"] = 45  # moderate risk — surface flooding possible

    # Aircraft noise
    aircraft_dba = haz.get("aircraft_noise_dba")
    if aircraft_dba is not None:
        try:
            indicators["aircraft_noise"] = normalize_min_max(float(aircraft_dba), 50, 75)
        except (TypeError, ValueError):
            pass

    # Council coastal erosion (separate from NIWA national)
    cce = haz.get("council_coastal_erosion")
    if isinstance(cce, dict):
        cce_dist = cce.get("distance_m")
        if cce_dist is not None:
            try:
                # Closer = worse, 0m = 100, 500m+ = ~0
                indicators["coastal_erosion_council"] = normalize_min_max(
                    float(cce_dist), 0, 500, inverse=True
                )
            except (TypeError, ValueError):
                pass
    else:
        ce_exp = haz.get("coastal_erosion_exposure")
        if ce_exp:
            ce_score = SEVERITY_COASTAL_EROSION_EXPOSURE.get(ce_exp, 0)
            if ce_score > 0:
                indicators["coastal_erosion_council"] = ce_score

    # ── Terrain-inferred risk boosts ──
    # These are soft signals from elevation/slope data — only boost when no
    # council-provided hazard data exists for this indicator.
    terrain = report.get("terrain") or {}
    flood_terrain_score = terrain.get("flood_terrain_score")
    wind_exposure_score = terrain.get("wind_exposure_score")

    # Terrain-inferred flood: flat depression at low elevation suggests flood-prone
    if flood_terrain_score and flood_terrain_score >= 3 and (indicators.get("flood") or 0) == 0:
        indicators["flood"] = {3: 25, 4: 35}.get(flood_terrain_score, 25)

    # Waterway proximity: nearby river/stream compounds flood risk
    waterway_m = terrain.get("nearest_waterway_m")
    if waterway_m is not None:
        current_flood = indicators.get("flood") or 0
        if waterway_m <= 50 and current_flood < 45:
            # Very close to waterway — significant flood risk even without council data
            indicators["flood"] = max(current_flood, 45)
        elif waterway_m <= 100 and current_flood < 35:
            indicators["flood"] = max(current_flood, 35)
        elif waterway_m <= 200 and current_flood < 25:
            indicators["flood"] = max(current_flood, 25)

    # Terrain-inferred wind: exposed ridgeline/hilltop suggests high wind
    if wind_exposure_score and wind_exposure_score >= 4 and (indicators.get("wind") or 0) <= 10:
        indicators["wind"] = {4: 35, 5: 50}.get(wind_exposure_score, 35)

    # ── Event-history risk boosts ──
    # Historical weather/earthquake events provide evidence even when council
    # hazard maps don't exist for an area.
    event_hist = report.get("event_history") or {}
    rain_events = event_hist.get("heavy_rain_events") or 0
    wind_events = event_hist.get("extreme_wind_events") or 0
    quake_count = event_hist.get("earthquakes_30km_10yr") or 0

    # Repeated heavy rain near a property with no flood zone → soft boost
    if rain_events >= 3 and (indicators.get("flood") or 0) < 30:
        indicators["flood"] = max(indicators.get("flood") or 0, 15 + min(rain_events, 6) * 3)

    # Repeated extreme wind near a property with low/default wind score → boost
    if wind_events >= 2 and (indicators.get("wind") or 0) <= 15:
        indicators["wind"] = max(indicators.get("wind") or 0, 20 + min(wind_events, 5) * 3)

    # High seismic activity → slight boost if earthquake score is low
    if quake_count >= 5 and (indicators.get("earthquake") or 0) < 30:
        indicators["earthquake"] = max(indicators.get("earthquake") or 0, 20 + min(quake_count, 10) * 2)

    # Environment
    indicators["noise"] = normalize_min_max(env.get("road_noise_db"), 40, 75)
    indicators["air_quality"] = SEVERITY_AIR_QUALITY.get(env.get("air_pm10_trend"), 30)
    indicators["water_quality"] = worst_water_band(env)
    indicators["climate"] = normalize_min_max(env.get("climate_temp_change"), 0, 3.0)
    indicators["contaminated_land"] = contamination_score(
        env.get("contam_nearest_distance_m"), env.get("contam_nearest_category")
    )

    # Liveability (transit/crashes moved to transport category)
    indicators["crime"] = normalize_min_max(liv.get("crime_percentile"), 0, 100)
    indicators["nzdep"] = SEVERITY_NZDEP.get(liv.get("nzdep_decile"))
    indicators["schools"] = school_quality_score(liv.get("schools_1500m") or [])
    indicators["heritage"] = log_normalize(liv.get("heritage_count_500m"), 100)

    # Transport — ALL scores: higher = worse access (consistent with other categories)
    # Transit access: 0 stops = 100 (bad — no transit), 25+ stops = 0 (good)
    indicators["transit_access"] = normalize_min_max(
        liv.get("transit_stops_400m"), 0, 25, inverse=True
    )
    # CBD proximity: 0m = 0 (good — close), 10km+ = 100 (bad — far)
    cbd_m = liv.get("cbd_distance_m")
    if cbd_m is not None:
        indicators["cbd_proximity"] = min(100, (float(cbd_m) / 10000) * 100)
    # Commute frequency: 30+ services/hr = 0 (good), 0 = 100 (bad)
    peak = liv.get("peak_trips_per_hour")
    if peak is not None:
        indicators["commute_frequency"] = normalize_min_max(float(peak), 0, 30, inverse=True)
    # Rail proximity: 0m = 0 (good — close), 5km+ = 100 (bad — far)
    rail_m = liv.get("nearest_train_distance_m")
    if rail_m is not None:
        indicators["rail_proximity"] = min(100, (float(rail_m) / 5000) * 100)
    # Bus density: 30+ stops within 800m = 0 (good), 0 = 100 (bad)
    bus_800 = liv.get("bus_stops_800m")
    if bus_800 is not None:
        indicators["bus_density"] = normalize_min_max(bus_800, 0, 30, inverse=True)
    # Road safety: more serious+fatal crashes = higher score (worse)
    serious = (liv.get("crashes_300m_serious") or 0) + (liv.get("crashes_300m_fatal") or 0)
    indicators["road_safety"] = normalize_min_max(serious, 0, 20)

    # Planning (mostly neutral for MVP — no user preference context yet)
    indicators["zone_permissiveness"] = 50
    indicators["height_limit"] = 50
    indicators["resource_consents"] = log_normalize(
        plan.get("resource_consents_500m_2yr"), 30
    )
    infra = plan.get("infrastructure_5km")
    indicators["infrastructure"] = log_normalize(len(infra) if infra else 0, 40)
    indicators["school_zone"] = 50

    # Market — derive from rental overview data in report
    market = report.get("market") or {}
    rental_overview = market.get("rental_overview") or []
    # Find ALL/ALL row for overall market signal
    all_row = next((r for r in rental_overview if isinstance(r, dict) and r.get("dwelling_type") == "ALL" and r.get("beds") == "ALL"), None)
    if all_row:
        # rental_fairness: bond count as data richness signal (more bonds = more liquid market)
        bonds = all_row.get("bonds") or all_row.get("active_bonds") or 0
        indicators["rental_fairness"] = min(100, (bonds / 200) * 100) if bonds else None
        # rental_trend: YoY% mapped to 0-100 (negative = rents falling = good for renters, bad for investors)
        yoy = all_row.get("yoy_pct")
        if yoy is not None:
            indicators["rental_trend"] = normalize_min_max(abs(float(yoy)), 0, 20)
        else:
            indicators["rental_trend"] = 50  # neutral
        # market_heat: bond count relative to typical (indicates demand)
        indicators["market_heat"] = min(100, (bonds / 500) * 100) if bonds else 50

    # --- 2. Aggregate per category ---
    cat_scores = {}

    # Hazards: softmax (worst-dominates)
    haz_pairs = [
        (indicators[k], WEIGHTS_HAZARDS[k])
        for k in WEIGHTS_HAZARDS
        if indicators.get(k) is not None
    ]
    if len(haz_pairs) >= 2:
        cat_scores["hazards"] = softmax_aggregate(
            [s for s, _ in haz_pairs], [w for _, w in haz_pairs]
        )

    # All others: weighted arithmetic mean
    for cat, weights in [
        ("environment", WEIGHTS_ENVIRONMENT),
        ("liveability", WEIGHTS_LIVEABILITY),
        ("transport", WEIGHTS_TRANSPORT),
        ("market", WEIGHTS_MARKET),
        ("planning", WEIGHTS_PLANNING),
    ]:
        cat_scores[cat] = wam_aggregate(
            [indicators.get(k) for k in weights],
            [weights[k] for k in weights],
        )

    # Drop market if no data available
    if cat_scores.get("market") is None:
        cat_scores.pop("market", None)

    # --- 3. Composite score ---
    comp = composite_score(cat_scores, COMPOSITE_WEIGHTS)

    # --- 4. Rating bin ---
    rating = None
    if comp is not None:
        for lo, hi, label, color in RATING_BINS:
            if lo <= comp <= hi:
                rating = {"label": label, "color": color}
                break

    # --- 5. Confidence & coverage ---
    available_per_cat = {}
    for cat, weights in [
        ("hazards", WEIGHTS_HAZARDS),
        ("environment", WEIGHTS_ENVIRONMENT),
        ("liveability", WEIGHTS_LIVEABILITY),
        ("transport", WEIGHTS_TRANSPORT),
        ("market", WEIGHTS_MARKET),
        ("planning", WEIGHTS_PLANNING),
    ]:
        available_per_cat[cat] = sum(
            1 for k in weights if indicators.get(k) is not None
        )

    conf = confidence_score(available_per_cat)
    coverage = coverage_summary(available_per_cat, indicators)

    report["scores"] = {
        "composite": round(comp, 1) if comp else None,
        "rating": rating,
        "categories": {k: round(v, 1) for k, v in cat_scores.items() if v is not None},
        "indicators": {k: round(v, 1) for k, v in indicators.items() if v is not None},
        "confidence": round(conf, 1),
        "coverage": coverage,
    }
    return report
