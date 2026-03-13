# Backend — Property Report & Risk Scoring (Phase 2C + 2D)

**Creates:** Property report endpoint, risk score normalization/aggregation service
**Prerequisites:** `02-project-setup.md` complete. `get_property_report()` PL/pgSQL function exists (`sql/07-report-function.sql`).
**This is the core feature** — everything else builds on the report.

---

## Files to Create

```
backend/app/
├── routers/
│   └── property.py         # GET /property/{address_id}/report
└── services/
    └── risk_score.py        # Normalization, aggregation, composite scoring
```

---

## Report JSON Structure

The `get_property_report(address_id)` PL/pgSQL function returns a JSONB object with these top-level keys. The Python risk score service reads these keys to compute scores.

**Verified JSON keys from `sql/07-report-function.sql`:**

```
address:
  address_id, full_address, suburb, city, unit_type,
  sa2_code, sa2_name, ta_name, lng, lat

property:
  footprint_sqm, building_use, title_no, estate_description,
  title_type, capital_value, land_value, improvements_value,
  cv_land_area, cv_date, cv_council, multi_unit

hazards:
  flood, tsunami_zone_class, tsunami_evac_zone, liquefaction,
  wind_zone, coastal_exposure, earthquake_count_30km,
  wildfire_vhe_days, wildfire_trend, epb_count_300m

environment:
  road_noise_db, air_site_name, air_pm10_trend, air_pm25_trend,
  air_distance_m, water_site_name, water_ecoli_band, water_ammonia_band,
  water_nitrate_band, water_drp_band, water_clarity_band, water_distance_m,
  climate_temp_change, climate_precip_change_pct,
  contam_nearest_name, contam_nearest_category,
  contam_nearest_distance_m, contam_count_2km

liveability:
  nzdep_decile, crime_area_unit, crime_victimisations, crime_percentile,
  crime_city_median_vics, crime_city_total_vics, crime_city_area_count,
  schools_1500m (array of objects),
  transit_stops_400m, nearest_train_name, nearest_train_distance_m,
  cbd_distance_m, crashes_300m_serious, crashes_300m_fatal, crashes_300m_total,
  heritage_count_500m, amenities_500m (object by category),
  nearest_supermarket, nearest_gp, nearest_pharmacy,
  conservation_nearest, conservation_nearest_type, conservation_nearest_distance_m

planning:
  zone_name, zone_code, zone_category, max_height_m,
  heritage_listed, contaminated_listed, epb_listed,
  resource_consents_500m_2yr, infrastructure_5km (array),
  transmission_line_distance_m

market:
  sa2_code, sa2_name, rental_overview, trends, hpi_latest
```

---

## Step 1: Risk Score Service

```python
# backend/app/services/risk_score.py
"""
Risk score computation engine.

Takes raw report JSON from get_property_report(), normalizes all indicators
to 0-100 scale, aggregates per category, computes composite score.

Reference: RISK-SCORE-METHODOLOGY.md
"""

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
    EQI range 400-520. Returns 0-100 (100 = worst)."""
    if not schools:
        return 100  # no nearby schools = worst score
    MAX_QUALITY = 8.0
    quality_points = sum(
        (1 / max(s.get("distance_m", 1000) / 1000, 0.1))
        * ((s.get("eqi", 460) - 400) / 120)
        for s in schools
        if s.get("eqi")
    )
    return 100 - min(100, (quality_points / MAX_QUALITY) * 100)


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
    "flood": 0.18, "tsunami": 0.15, "liquefaction": 0.15,
    "earthquake": 0.12, "coastal_erosion": 0.12, "wind": 0.10,
    "wildfire": 0.10, "epb": 0.08,
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
    "hazards": 8, "environment": 5, "liveability": 6, "market": 3, "planning": 5,
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
    """Takes raw report from get_property_report(), adds 'scores' key.

    Reads from report JSON keys (verified against sql/07-report-function.sql):
      hazards.flood, hazards.tsunami_zone_class, hazards.liquefaction,
      hazards.wind_zone, hazards.coastal_exposure, hazards.earthquake_count_30km,
      hazards.wildfire_vhe_days, hazards.wildfire_trend, hazards.epb_count_300m,
      environment.road_noise_db, environment.air_pm10_trend,
      environment.climate_temp_change, environment.contam_nearest_distance_m,
      environment.contam_nearest_category, environment.water_*_band,
      liveability.crime_percentile, liveability.nzdep_decile,
      liveability.schools_1500m, liveability.transit_stops_400m,
      liveability.crashes_300m_serious, liveability.crashes_300m_fatal,
      liveability.heritage_count_500m,
      planning.resource_consents_500m_2yr, planning.infrastructure_5km
    """
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
```

---

## Step 2: Property Report Router

```python
# backend/app/routers/property.py
import orjson
from fastapi import APIRouter, HTTPException, Request

from ..db import pool
from ..deps import limiter
from ..redis import cache_get, cache_set
from ..services.risk_score import enrich_with_scores

router = APIRouter()


@router.get("/property/{address_id}/report")
@limiter.limit("20/minute")
async def get_report(request: Request, address_id: int):
    """Full property report with risk scores.
    Calls get_property_report() PL/pgSQL function, enriches with Python scoring.
    Cached 24h in Redis."""

    # 1. Check Redis cache
    cache_key = f"report:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    # 2. Call PL/pgSQL function — single DB round-trip
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT get_property_report(%s) AS report", [address_id]
        )
        row = await cur.fetchone()

    if not row or not row["report"]:
        raise HTTPException(404, "Address not found")

    result = row["report"]

    # 3. Compute risk scores (normalization + aggregation)
    report = enrich_with_scores(result)

    # 4. Cache 24h
    await cache_set(cache_key, orjson.dumps(report).decode(), ex=86400)

    return report
```

**Note:** The AI summary integration (from `08-ai-features.md`) and property type detection (from `11-admin-and-detection.md`) are added to this endpoint later. The base endpoint works without them.

---

## Register in main.py

```python
from .routers import property
app.include_router(property.router, prefix="/api/v1")
```

---

## Verification

```bash
# Get report for 162 Cuba Street (address_id = 1753062):
curl http://localhost:8000/api/v1/property/1753062/report | python -m json.tool

# Expected response structure:
# {
#   "address": {"address_id": 1753062, "full_address": "162 Cuba Street...", ...},
#   "hazards": {"flood": null, "wind_zone": "M", ...},
#   "environment": {"road_noise_db": 64, ...},
#   "liveability": {"nzdep_decile": 6, "transit_stops_400m": 17, ...},
#   "planning": {"zone_name": "City Centre Zone", "max_height_m": 24, ...},
#   "market": {"sa2_code": "251700", ...},
#   "scores": {
#     "composite": 42.3,
#     "rating": {"label": "Moderate", "color": "#E69F00"},
#     "categories": {"hazards": 28.5, "environment": 45.2, ...},
#     "indicators": {"flood": 0, "wind": 30, "noise": 68.6, ...},
#     "confidence": 85.0,
#     "coverage": {"available": 23, "total": 27, "label": "23 of 27 layers"}
#   }
# }

# Verify caching — second request should be instant:
curl http://localhost:8000/api/v1/property/1753062/report

# Non-existent address:
curl http://localhost:8000/api/v1/property/999999999/report
# Expected: 404 {"error": "Address not found"}
```
