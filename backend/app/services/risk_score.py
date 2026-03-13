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
    quality_score = min(100, (quality_points / MAX_QUALITY) * 100)
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

WEIGHTS_HAZARDS = {          # Sum = 1.0, softmax aggregation
    "flood": 0.16, "tsunami": 0.13, "liquefaction": 0.13,
    "slope_failure": 0.13, "earthquake": 0.11, "coastal_erosion": 0.10,
    "wind": 0.09, "wildfire": 0.09, "epb": 0.06,
}

WEIGHTS_ENVIRONMENT = {      # Sum = 1.0, WAM
    "noise": 0.30, "air_quality": 0.25, "water_quality": 0.20,
    "climate": 0.15, "contaminated_land": 0.10,
}

WEIGHTS_LIVEABILITY = {      # Sum = 1.0, WAM
    "crime": 0.25, "nzdep": 0.20, "schools": 0.20,
    "transit": 0.15, "crashes": 0.10, "heritage": 0.10,
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
    "hazards": 0.30, "environment": 0.15, "liveability": 0.25,
    "market": 0.15, "planning": 0.15,
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
    "hazards": 9, "environment": 5, "liveability": 6, "market": 3, "planning": 5,
}


def confidence_score(available_per_category: dict[str, int]) -> float:
    """Category-aware confidence. Returns 0-100.
    Categories with <2 available indicators contribute 0%."""
    cat_scores = []
    for cat, total in CATEGORY_INDICATOR_COUNTS.items():
        avail = available_per_category.get(cat, 0)
        cat_scores.append(avail / total if avail >= 2 else 0)
    return (sum(cat_scores) / len(cat_scores)) * 100


def coverage_summary(available_per_category: dict[str, int]) -> dict:
    """Returns {available, total, label} for CoverageBadge.tsx."""
    total = sum(CATEGORY_INDICATOR_COUNTS.values())  # 27
    available = sum(available_per_category.values())
    return {"available": available, "total": total, "label": f"{available} of {total} layers"}


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

    # Hazards
    indicators["flood"] = severity_flood(haz.get("flood"))
    indicators["tsunami"] = SEVERITY_TSUNAMI.get(haz.get("tsunami_zone_class"), 0)
    indicators["liquefaction"] = SEVERITY_LIQUEFACTION.get(haz.get("liquefaction"), 0)
    indicators["earthquake"] = normalize_min_max(haz.get("earthquake_count_30km"), 0, 50)
    indicators["coastal_erosion"] = SEVERITY_COASTAL_EXPOSURE.get(
        haz.get("coastal_exposure"), 0
    )
    indicators["wind"] = severity_wind(haz.get("wind_zone"))
    indicators["wildfire"] = normalize_min_max(haz.get("wildfire_vhe_days"), 0, 30)
    indicators["epb"] = normalize_min_max(haz.get("epb_count_300m"), 0, 15)
    indicators["slope_failure"] = SEVERITY_SLOPE_FAILURE.get(haz.get("slope_failure"), 0)

    # Environment
    indicators["noise"] = normalize_min_max(env.get("road_noise_db"), 40, 75)
    indicators["air_quality"] = SEVERITY_AIR_QUALITY.get(env.get("air_pm10_trend"), 30)
    indicators["water_quality"] = worst_water_band(env)
    indicators["climate"] = normalize_min_max(env.get("climate_temp_change"), 0, 3.0)
    indicators["contaminated_land"] = contamination_score(
        env.get("contam_nearest_distance_m"), env.get("contam_nearest_category")
    )

    # Liveability
    indicators["crime"] = normalize_min_max(liv.get("crime_percentile"), 0, 100)
    indicators["nzdep"] = SEVERITY_NZDEP.get(liv.get("nzdep_decile"))
    indicators["schools"] = school_quality_score(liv.get("schools_1500m") or [])
    indicators["transit"] = normalize_min_max(
        liv.get("transit_stops_400m"), 0, 25, inverse=True
    )
    indicators["crashes"] = normalize_min_max(
        (liv.get("crashes_300m_serious") or 0) + (liv.get("crashes_300m_fatal") or 0),
        0, 50,
    )
    indicators["heritage"] = log_normalize(liv.get("heritage_count_500m"), 100)

    # Planning (mostly neutral for MVP — no user preference context yet)
    indicators["zone_permissiveness"] = 50
    indicators["height_limit"] = 50
    indicators["resource_consents"] = log_normalize(
        plan.get("resource_consents_500m_2yr"), 30
    )
    infra = plan.get("infrastructure_5km")
    indicators["infrastructure"] = log_normalize(len(infra) if infra else 0, 40)
    indicators["school_zone"] = 50

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
        ("market", WEIGHTS_MARKET),
        ("planning", WEIGHTS_PLANNING),
    ]:
        cat_scores[cat] = wam_aggregate(
            [indicators.get(k) for k in weights],
            [weights[k] for k in weights],
        )

    # Market scores need asking_rent (not in base report) — leave None for now
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
        ("market", WEIGHTS_MARKET),
        ("planning", WEIGHTS_PLANNING),
    ]:
        available_per_cat[cat] = sum(
            1 for k in weights if indicators.get(k) is not None
        )

    conf = confidence_score(available_per_cat)
    coverage = coverage_summary(available_per_cat)

    report["scores"] = {
        "composite": round(comp, 1) if comp else None,
        "rating": rating,
        "categories": {k: round(v, 1) for k, v in cat_scores.items() if v is not None},
        "indicators": {k: round(v, 1) for k, v in indicators.items() if v is not None},
        "confidence": round(conf, 1),
        "coverage": coverage,
    }
    return report
