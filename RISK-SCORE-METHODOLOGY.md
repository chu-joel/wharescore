# WhareScore Risk Score Methodology

**Last Updated:** 2026-03-04
**Status:** Research complete, methodology reviewed and corrected

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Score Architecture — Not One Score, Five](#score-architecture)
3. [Layer Classification](#layer-classification)
4. [Normalization Per Layer](#normalization-per-layer)
5. [Category Aggregation Methods](#category-aggregation-methods)
6. [Weighting Rationale](#weighting-rationale)
7. [Overall Composite Score](#overall-composite-score)
8. [Missing Data & Confidence](#missing-data--confidence)
9. [Context Signals](#context-signals)
10. [Score Presentation](#score-presentation)
11. [Sensitivity & Robustness](#sensitivity--robustness)
12. [What We Learned From Existing Platforms](#what-we-learned-from-existing-platforms)
13. [Key References](#key-references)

---

## Design Philosophy

### Lessons from the Industry

**First Street Foundation** (the gold standard for property risk scoring) deliberately does NOT produce a single composite number. They publish four separate hazard scores (Flood, Fire, Wind, Heat), each peer-reviewed independently, on a 1-10 scale. This is intentional — collapsing heterogeneous hazards into one number creates false precision and hides critical information.

**Zillow** licensed First Street data and displayed it on listings. They removed it in November 2025 after pushback from the California MLS and real estate agents complaining of lost sales. Lesson: **risk transparency is politically sensitive** — present scores as informational, not definitive.

**FEMA National Risk Index** produces composite scores but only after extensive peer review of their methodology. They use cube root transformation + min-max normalization + K-means clustering for ratings. Their key insight: raw dollar-loss values are meaningless for comparison across regions — normalization is everything.

**INFORM Global Risk Index** (UNDRR/EU) uses geometric mean of three dimensions, deliberately making the score partially compensatory — a country cannot fully offset high hazard exposure with low vulnerability.

**CoreLogic NZ** sells property-level natural hazard and climate risk data to insurers and lenders via API. They are your closest existing competitor in NZ — but they sell to institutions, not consumers.

**RiskScape** (GNS Science + NIWA + NHC) is an open-source NZ risk modelling engine using Hazard × Assets × Vulnerability framework. Designed for government/professional use, not consumer-facing.

### WhareScore Design Principles

1. **Five category scores, one optional composite.** Never hide critical risk behind a good lifestyle score.
2. **Non-compensatory for safety.** A flood zone property is high-risk regardless of its school score.
3. **Compensatory for amenity.** Poor transit access can be offset by great schools — that's a valid preference.
4. **Transparent methodology.** Every score links to "How is this calculated?" showing factors and weights.
5. **Honest about uncertainty.** Missing data = "unknown," never "safe." Show confidence/coverage percentage.
6. **Coarse bins over false precision.** 5 rating levels (Very Low → Very High), not continuous 0-100. Internal calculation uses 0-100 for math; display uses bins.
7. **Context over absolutes.** "72% of nearby properties share this risk" matters more than the number itself.

---

## Score Architecture

### Five Category Scores + Composite

```
                        ┌──────────────────┐
                        │  COMPOSITE SCORE │  ← optional, geometric mean of categories
                        │    42 / 100      │
                        │    "Low Risk"    │
                        └────────┬─────────┘
                                 │
          ┌──────────┬───────────┼───────────┬──────────┐
          ▼          ▼           ▼           ▼          ▼
   ┌────────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐
   │  NATURAL   │ │ ENVIRO │ │ LIVEA-   │ │ MARKET │ │  PLANNING  │
   │  HAZARDS   │ │ MENT   │ │ BILITY   │ │        │ │ & REGUL.   │
   │  25/100    │ │ 38/100 │ │ 55/100   │ │ 48/100 │ │  45/100    │
   │ "Very Low" │ │ "Low"  │ │"Moderate"│ │ "Low"  │ │  "Low"     │
   └────────────┘ └────────┘ └──────────┘ └────────┘ └────────────┘
       softmax       WAM         WAM         WAM        WAM
    (worst hazard  (trade-offs  (trade-offs  (trade-offs (trade-offs
     dominates)     allowed)    allowed)     allowed)   allowed)
```

### Category Definitions

| Category | What It Answers | Aggregation | Why |
|----------|----------------|-------------|-----|
| **Natural Hazards** | "Am I physically safe here?" | Softmax (worst dominates) | Being in a flood zone is dangerous regardless of earthquake score |
| **Environment** | "Is the air/water/noise liveable?" | Weighted arithmetic mean | Environmental factors are additive nuisances |
| **Liveability** | "Is this a good place to live day-to-day?" | Weighted arithmetic mean | Schools, transit, crime are trade-offable personal preferences |
| **Market** | "Am I getting fair value?" | Weighted arithmetic mean | Price indicators are complementary signals |
| **Planning & Regulatory** | "What constraints/opportunities exist?" | Weighted arithmetic mean | Zoning and consents are contextual, not strictly "risk" |

---

## Layer Classification

Of your 35 PostGIS tables, not all are scoreable risk indicators. Some are **property context** (building outlines, titles, parcels, meshblocks, addresses) and some are **market data** (bonds, RBNZ housing). Here is the complete classification:

### Scoring Layers (27 indicators across 5 categories)

#### Natural Hazards (8 indicators) — Weight: 30% of composite

| # | Indicator | Table | Data Type | Direction | Raw Range | Normalization | Category Weight |
|---|-----------|-------|-----------|-----------|-----------|---------------|-----------------|
| 1 | **Flood zone** | `flood_zones` | Binary/categorical | Higher = worse | Zone type or none | Expert severity | **18%** |
| 2 | **Tsunami zone** | `tsunami_zones` | Categorical (red/orange/yellow/none) | Higher = worse | Zone colour | Expert severity | **15%** |
| 3 | **Liquefaction susceptibility** | `liquefaction_zones` | Categorical (high/moderate/low/none) | Higher = worse | Susceptibility class | Expert severity | **15%** |
| 4 | **Earthquake proximity** | `earthquakes` | Count (M4+ within 30km, 10yr) | Higher = worse | 0–50+ | Expert-range min-max | **12%** |
| 5 | **Coastal erosion exposure** | `coastal_erosion` | Categorical (CSI rating) | Higher = worse | CSI categories | Expert severity | **12%** |
| 6 | **Wind zone** | `wind_zones` | Categorical (Low/Med/High/Very High) | Higher = worse | 4 levels | Ordinal mapping | **10%** |
| 7 | **Wildfire risk** | `wildfire_risk` | Continuous (VHE days/yr) | Higher = worse | 0–40+ | Expert-range min-max | **10%** |
| 8 | **Earthquake-prone buildings** | `earthquake_prone_buildings` | Count (within 300m) | Higher = worse | 0–20+ | Expert-range min-max | **8%** |

**Why these weights:** Flood, tsunami, and liquefaction are the three hazards with the most direct property damage and life safety impact in NZ. The Canterbury and Kaikoura earthquakes demonstrated that liquefaction and tsunami are not theoretical risks. Flood zones directly affect insurance, property values, and are the most common natural hazard claim (NHC data). Earthquake proximity is lower-weighted because NZ is seismically active nationwide — proximity to past quakes is less discriminating than being in a specific hazard zone. Wind and wildfire are lower because they are less acutely property-damaging in the NZ context (unlike Australia/California where wildfire dominates).

#### Environment (5 indicators) — Weight: 15% of composite

| # | Indicator | Table | Data Type | Direction | Raw Range | Normalization | Category Weight |
|---|-----------|-------|-----------|-----------|-----------|---------------|-----------------|
| 9 | **Road noise** | `noise_contours` | Continuous (dB LAeq24h) | Higher = worse | 50–75 dB | Expert-range min-max | **30%** |
| 10 | **Air quality trend** | `air_quality_sites` | Categorical (Improving/Stable/Degrading) | Degrading = worse | 3 levels | Ordinal mapping | **25%** |
| 11 | **Water quality** | `water_quality_sites` | Categorical (NPS-FM A–E) | E = worse | 5 bands | Ordinal mapping | **20%** |
| 12 | **Climate exposure** | `climate_projections` | Continuous (projected temp/precip change) | Higher change = worse | Varies by SSP | Expert-range min-max | **15%** |
| 13 | **Contaminated land proximity** | `contaminated_land` | Distance + category | Closer = worse | 0–5000m + ANZECC cat | Inverse distance + severity | **10%** |

**Why these weights:** Road noise has the most direct daily impact on quality of life and is the most spatially precise data (polygon contours vs point stations). Air quality affects health directly but the data is coarse (72 stations nationally — nearest-station proxy). Water quality is relevant but indirect (proximity to monitored stream, not tap water quality). Climate projections are long-term (30-year horizon) and less immediately actionable. Contaminated land is weighted lower here because it overlaps with the Planning category (regulatory constraint) and the contamination may already be remediated.

#### Liveability (6 indicators) — Weight: 25% of composite

| # | Indicator | Table | Data Type | Direction | Raw Range | Normalization | Category Weight |
|---|-----------|-------|-----------|-----------|-----------|---------------|-----------------|
| 14 | **Crime density** | `crime` | Rate (victimisations/km²/yr) | Higher = worse | 0–5000+ | Percentile rank | **25%** |
| 15 | **Deprivation** | `nzdep` | Ordinal (1-10 decile) | Higher = worse | 1–10 | Direct mapping ×10 | **20%** |
| 16 | **School quality** | `schools` | Composite (count + EQI within 1.5km) | More good schools = better | 0–20 schools | Inverse, quality-weighted | **20%** |
| 17 | **Transit access** | `transit_stops` | Count (within 400m) | More = better | 0–30+ | Inverse, log-scaled | **15%** |
| 18 | **Crash hotspot** | `crashes` | Count (serious/fatal within 300m, 5yr) | Higher = worse | 0–100+ | Expert-range min-max | **10%** |
| 19 | **Heritage density** | `heritage_sites` | Count (within 500m) | More = better (inverted) | 0–100+ | `100 - log_normalize(count, 100)` | **10%** |

**Why these weights:** Crime is the #1 concern for both renters and buyers across every property platform user survey. Deprivation (NZDep) is a strong proxy for neighbourhood quality encompassing income, employment, housing, and health. Schools are critical for families (the largest demographic segment in property search). Transit matters most in cities. Crash hotspots and heritage are secondary signals. Heritage is scored as **positive** — more heritage sites nearby generally indicates a desirable established neighbourhood.

#### Market (3 indicators) — Weight: 15% of composite

| # | Indicator | Table | Data Type | Direction | Raw Range | Normalization | Category Weight |
|---|-----------|-------|-----------|-----------|-----------|---------------|-----------------|
| 20 | **Rental fairness** | `bonds_detailed` | Continuous (median rent vs asking) | Over-median = worse | Ratio 0.5–2.0 | Expert-range min-max | **40%** |
| 21 | **Rental trend** | `bonds_detailed` | Continuous (YoY % change) | Higher increase = worse for renters | -10% to +20% | Expert-range min-max | **35%** |
| 22 | **Market heat** | `rbnz_housing` | Continuous (HPI trend) | Context (informational) | Index values | Percentile rank | **25%** |

**Why these weights:** Rental fairness is the direct "am I getting ripped off?" answer — the core of the Fair Price Engine. Rental trend signals whether the area is getting more or less expensive. Market heat (HPI) is broader economic context. Note: these are **renter-weighted** for MVP because renters are the primary user. For buyers, the weights would shift toward HPI and capital value comparisons (V2 when council RV/CV data is integrated).

#### Planning & Regulatory (5 indicators) — Weight: 15% of composite

| # | Indicator | Table | Data Type | Direction | Raw Range | Normalization | Category Weight |
|---|-----------|-------|-----------|-----------|-----------|---------------|-----------------|
| 23 | **Zone permissiveness** | `district_plan_zones` | Categorical (14 zone types) | Varies by user intent | Zone type | Context-dependent | **25%** |
| 24 | **Height limit** | `height_controls` | Continuous (metres) | Varies by user intent | 4–95m | Context-dependent | **20%** |
| 25 | **Nearby resource consents** | `resource_consents` | Count (granted, within 500m, 2yr) | More = more development activity | 0–50+ | Log-scaled | **20%** |
| 26 | **Infrastructure investment** | `infrastructure_projects` | Count + value (within 5km) | More = generally positive | 0–50 projects | Log-scaled, positive | **20%** |
| 27 | **School zone** | `school_zones` | Binary (in/out of desirable zone) | In zone = positive | Yes/no | Binary positive | **15%** |

**Why these weights:** Planning indicators are unusual because **direction depends on user intent**. A buyer may want a permissive zone (development potential) while a neighbour may want restrictive zoning (character protection). For MVP, these are scored as **informational context** rather than strict risk — they contribute to the composite but with clearly labelled "this could be positive or negative depending on your goals."

**MVP default direction:** Until user preference sliders are available (V2), zone permissiveness and height limit are scored as **neutral 50** (no impact on composite). Resource consents, infrastructure investment, and school zones use their defined positive/log-scaled directions. This prevents Planning from distorting the composite with arbitrary polarity assumptions.

### Non-Scoring Layers (9 tables — property context & infrastructure)

These tables provide essential context for the property report but do NOT feed into risk scores:

| Table | Role |
|-------|------|
| `addresses` | Address lookup, geocoding, spatial anchor |
| `meshblocks` | Spatial join unit for NZDep + crime |
| `parcels` | Property boundary display, land area |
| `building_outlines` | Building footprint display |
| `property_titles` | Ownership type, title reference |
| `bonds_tla` | Superseded by `bonds_detailed` for scoring (kept for regional context) |
| `bonds_region` | Regional rental context |
| `climate_grid` | Spatial lookup grid for climate projections |
| `transmission_lines` | Displayed on map as contextual layer, not scored (proximity is a concern but data is too coarse — lines, not easements) |

---

## Normalization Per Layer

All 27 scoring indicators are normalized to a **0–100 risk scale** where **0 = best possible (no risk / ideal)** and **100 = worst possible (extreme risk / worst case)**.

### Method 1: Expert-Range Min-Max (for continuous indicators)

```
normalize(raw_value, range_min, range_max):
    clamped = clamp(raw_value, range_min, range_max)
    return (clamped - range_min) / (range_max - range_min) * 100
```

For **inverse** indicators (more = better), apply `100 - result`.

**Spatial distance note:** All proximity-based indicators ("within 300m," "within 1.5km," etc.) use **Euclidean distance** via PostGIS `ST_DWithin`. This is a known simplification — a school 1km as-the-crow-flies but 3km by road (across a motorway) is scored as 1km away. Network distance analysis is a V2 enhancement.

#### Defined Ranges

| Indicator | range_min | range_max | Source / Rationale |
|-----------|-----------|-----------|-------------------|
| Earthquake count (M4+, 30km, 10yr) | 0 | 50 | GeoNet data: >50 is extremely unusual even for Wellington |
| Road noise (dB LAeq24h) | 40 | 75 | WHO: 40dB = quiet residential. 75dB = major arterial frontage. NZS 6806 |
| Wildfire VHE days/yr | 0 | 30 | Stats NZ data: highest station ~25 VHE days |
| EPB count (within 300m) | 0 | 15 | WCC data: max cluster in CBD ~10-12 |
| ~~Crime density~~ | — | — | **Removed:** uses percentile rank (Method 3), not min-max. See below. |
| Transit stops (within 400m) | 0 | 25 | Metlink data: CBD has ~20+, suburban has 0-5 |
| Crash count (serious/fatal, 300m, 5yr) | 0 | 50 | CAS data: busy intersections ~30-40 over 5 years |
| Heritage count (within 500m) | 0 | 100 | Heritage NZ: Wellington CBD has ~90+ within 500m |
| Rental fairness ratio | 0.5 | 2.0 | Ratio of asking price to area median. 1.0 = fair, 2.0 = double median. Note: ratios below 0.7 may indicate data quality issues and should be flagged separately |
| Rental YoY trend | -10% | +20% | MBIE bond data: typical range nationally |
| Climate temp change (°C, SSP2-4.5, 2050) | 0 | 3.0 | MfE projections: NZ range ~0.5-2.5°C under SSP2-4.5 |
| Contaminated land distance | 0m | 2000m | Expert: >2000m negligible impact. Inverted (closer = worse) |
| School count (within 1.5km) | 0 | 15 | MoE data: urban areas have 5-12 schools within 1.5km |
| Resource consents (granted, 500m, 2yr) | 0 | 30 | GWRC data: active urban areas ~15-25 |
| Infrastructure projects (5km) | 0 | 40 | Te Waihanga: Wellington CBD has ~34 |

### Method 2: Expert Severity Mapping (for binary/categorical indicators)

Binary and categorical indicators are mapped to fixed scores based on hazard severity:

#### Flood Zones

| Zone Type | Risk Score | Rationale |
|-----------|-----------|-----------|
| No flood zone | 0 | Not in any mapped flood extent |
| Flood zone (0.2% AEP / 500-yr) | 35 | Rare event, minimal insurance impact |
| Flood zone (0.5% AEP / 200-yr) | 55 | Moderate recurrence, may affect insurance |
| Flood zone (1% AEP / 100-yr) | 75 | Standard planning threshold in NZ, significant insurance impact |
| Flood zone (2% AEP / 50-yr) | 90 | Frequent flooding, likely affects property value + insurability |

#### Tsunami Zones

| Zone Type | Risk Score | Rationale |
|-----------|-----------|-----------|
| No tsunami zone | 0 | Outside all evacuation zones |
| Yellow (long/distant) | 30 | Hours of warning time, walk-out evacuation |
| Orange (regional) | 60 | Less warning, but usually time to evacuate |
| Red (near-source) | 85 | Minutes of warning. Life safety risk. |

#### Liquefaction Zones

| Susceptibility | Risk Score | Rationale |
|----------------|-----------|-----------|
| None / not mapped | 0 | Solid ground or outside mapped area |
| Low | 20 | Minor ground settlement possible in large earthquake |
| Moderate | 50 | Significant damage possible. Canterbury experience: moderate zones had real damage |
| High | 80 | Severe ground failure expected. Canterbury red zone equivalent |

#### Wind Zones

| Zone | Risk Score | Rationale |
|------|-----------|-----------|
| Low | 10 | Sheltered, minimal wind damage risk |
| Medium | 30 | Standard NZ wind exposure |
| High | 55 | Elevated damage risk, affects building design requirements |
| Very High | 80 | Severe exposure, significant building cost and maintenance impact |

#### Coastal Erosion (CSI)

| CSI Rating | Risk Score | Rationale |
|------------|-----------|-----------|
| Very Low / Accreting | 0 | Coastline is stable or growing |
| Low | 20 | Minimal erosion trend |
| Moderate | 45 | Some erosion, long-term concern |
| High | 70 | Active erosion, may affect property within 50-100 years |
| Very High | 90 | Severe erosion, imminent risk |

#### Air Quality Trend

| Trend | Risk Score | Rationale |
|-------|-----------|-----------|
| Improving | 10 | Getting better |
| Indeterminate/Stable | 30 | No clear trend |
| Degrading | 70 | Getting worse, health concern |

#### Water Quality (NPS-FM)

| Band | Risk Score | Rationale |
|------|-----------|-----------|
| A (Excellent) | 5 | Swimmable, healthy ecosystem |
| B (Good) | 20 | Good condition |
| C (Fair) | 40 | Some degradation |
| D (Poor) | 65 | Significantly degraded |
| E (Very Poor) | 85 | Severely degraded |

#### Deprivation (NZDep)

| NZDep Decile | Risk Score | Rationale |
|-------------|-----------|-----------|
| 1 (least deprived) | 5 | Direct 10→100 mapping with slight compression at extremes |
| 2 | 12 | |
| 3 | 22 | |
| 4 | 33 | |
| 5 | 44 | |
| 6 | 55 | |
| 7 | 66 | |
| 8 | 77 | |
| 9 | 88 | |
| 10 (most deprived) | 95 | Capped below 100 — even decile 10 has liveable areas |

#### Contaminated Land (combined distance + severity)

```
contamination_score(distance_m, anzecc_category):
    // Distance component (0-100, closer = worse)
    dist_score = max(0, (1 - distance_m / 2000)) * 100

    // Severity multiplier based on ANZECC category
    severity = {
        "Verified contaminated":   1.0,
        "Contaminated - remediated": 0.4,
        "Potentially contaminated": 0.7,
        "Land use investigation":  0.5,
    }

    return dist_score * severity[anzecc_category]

// Multiple contaminated sites: take the maximum score across all sites within 2000m.
// A property near two contaminated sites is not meaningfully "double contaminated" —
// the worst nearby site dominates the risk.
contamination_score_final(property_geom):
    nearby_sites = query sites within 2000m of property_geom
    if no sites: return 0
    return max(contamination_score(site.distance, site.anzecc_category) for site in nearby_sites)
```

### Method 3: Percentile Rank (for crime density)

Crime density is best normalized via percentile rank because the distribution is heavily skewed (CBD vs suburbs) and we want to answer "how does this compare to all NZ neighbourhoods?"

```
crime_risk_score = percentile_rank(crime_density, all_area_units_nationally)
// 0 = safest area unit nationally, 100 = highest crime nationally
```

Pre-compute the empirical CDF from all area unit crime densities and store as a lookup table.

### Method 4: Log-Scaled Count (for transit, heritage, consents, infrastructure)

For count-based indicators where the difference between 0→1 matters more than 10→11:

```
log_normalize(count, max_meaningful):
    if count == 0: return 0 (or 100 for inverse)
    return min(100, ln(1 + count) / ln(1 + max_meaningful) * 100)
```

For **inverse** indicators (transit stops — more is better):
```
transit_risk = 100 - log_normalize(stop_count, 25)
```

### Method 5: Quality-Weighted Count (for schools)

Schools aren't just a count — a property near 10 low-EQI schools is worse than one near 3 high-EQI schools:

```
school_quality_score(schools_within_1_5km):
    if no schools: return 100  // no nearby schools = worst case

    // Weight each school by EQI (higher EQI = more advantaged intake = better school outcome)
    // EQI range: ~400-520. Normalize to 0-1 using the full range.
    quality_points = sum(
        (1 / distance_km) * ((school.eqi - 400) / 120)  // closer + higher EQI = better
        for school in schools_within_1_5km
    )

    // Normalize against expert range
    return 100 - min(100, quality_points / max_meaningful_quality * 100)
```

---

## Category Aggregation Methods

### Natural Hazards: Softmax (Worst Hazard Dominates)

Standard weighted average would allow "no flood risk" to dilute a high tsunami score. For safety, the worst hazard should dominate:

```
softmax_aggregate(scores, weights, beta=0.08):
    // Weighted log-sum-exp approximation to weighted max
    // beta controls "hardness": 0 → weighted arithmetic mean, ∞ → pure max
    // 0.08 works well for 0-100 scale: all-zeros→0, all-100s→100
    // Weights are mixture coefficients (must sum to 1), NOT scale factors on scores

    assert abs(sum(weights) - 1.0) < 0.001
    result = (1/beta) * ln(sum(w * exp(beta * s) for s, w in zip(scores, weights)))
    return clamp(result, 0, 100)
```

**Why softmax over pure max:** Pure max ignores all other hazards — a property with high flood risk and high tsunami risk should score worse than one with only high flood risk. Softmax captures this while still letting the worst hazard dominate.

**Practical behaviour with beta=0.08** (simplified 4-indicator example with equal weights for clarity; actual implementation uses all 8 indicators with their assigned weights):

| Flood | Tsunami | Liquefaction | Earthquake | Softmax | Simple Mean |
|-------|---------|-------------|------------|---------|-------------|
| 75 | 0 | 0 | 15 | ~58 | 22.5 |
| 75 | 60 | 0 | 15 | ~61 | 37.5 |
| 0 | 0 | 0 | 15 | ~6 | 3.75 |
| 75 | 85 | 80 | 40 | ~77 | 70 |

The softmax result is pulled toward the highest score. Key behaviours:
- Row 1 vs Row 2: adding tsunami=60 bumps the score from 58→61 — the worst hazard (flood) still dominates, but compounding hazards are not ignored
- Row 3: low scores across the board — softmax is close to the simple mean
- Row 4: multiple high scores compound to 77, well above the simple mean of 70

### All Other Categories: Weighted Arithmetic Mean (WAM)

```
wam_aggregate(scores, weights):
    return sum(s * w for s, w in zip(scores, weights)) / sum(weights)
```

Trade-offs are acceptable in environment, liveability, market, and planning. Bad transit access genuinely is partially offset by great school access — that is a real consumer preference.

---

## Weighting Rationale

### Cross-Category Weights (Composite Score)

| Category | Weight | Rationale |
|----------|--------|-----------|
| **Natural Hazards** | **30%** | Physical safety is non-negotiable. NZ is among the most hazard-exposed developed countries (EQC, NIWA). Canterbury/Kaikoura earthquakes and Cyclone Gabrielle demonstrated real, devastating impact. Also: hazard zones directly affect insurance premiums and property values. |
| **Liveability** | **25%** | Day-to-day quality of life is the primary concern for most property searchers. Crime, deprivation, schools, and transit are the factors people ask about most (per user research from Zillow, Redfin, Domain AU). |
| **Environment** | **15%** | Environmental quality matters but is less immediately impactful than hazards or liveability. Noise is an exception (high daily impact) which is why it's weighted highest within this category. |
| **Market** | **15%** | Financial fairness is core to the "consumer advocate" positioning. Weighted equal to environment because it answers a different question ("am I being ripped off?") that is immediately actionable. |
| **Planning & Regulatory** | **15%** | Important for informed decisions but highly context-dependent (good or bad depending on user goals). Kept at 15% so it contributes without dominating. |

**Why Natural Hazards is 30%, not 50%:** While safety is the highest priority, weighting it too heavily would make the composite score effectively a hazard-only score. Most NZ properties outside flood/tsunami zones would all score similarly (low), reducing the composite's ability to differentiate on other factors. At 30%, hazards still dominate when present (a flood zone pushes the composite up significantly) but the composite remains useful for comparing two hazard-free properties on other dimensions.

**Why not equal weights?** Equal weighting (20% each) is a valid baseline and we will test it in sensitivity analysis. However, equal weighting implicitly says "crime matters as much as flood risk" and "heritage density matters as much as earthquake proximity," which does not reflect consumer priorities or actual impact on property decisions.

### Within-Category Weight Justification

See the indicator tables in [Layer Classification](#layer-classification) above. Key principles:

1. **Higher spatial precision = higher weight.** Flood zone polygons (specific to the property) are weighted higher than wildfire risk (nearest station proxy, 30+ km away).
2. **Higher direct impact = higher weight.** Road noise affects every day; climate projections affect 30 years from now.
3. **More actionable = higher weight.** Crime density helps you decide now; climate change is informational.
4. **NZ-specific relevance.** Liquefaction is weighted high because Canterbury proved it's a real and devastating risk in NZ. Wildfire is lower because NZ's fire risk profile is much lower than Australia/California.

### User-Adjustable Weights (V2)

Allow users to set priorities via preference sliders:

```
Presets:
  "Safety first"    → Hazards 45%, Liveability 20%, Environment 15%, Market 10%, Planning 10%
  "Family focused"  → Hazards 25%, Liveability 35%, Environment 15%, Market 15%, Planning 10%
  "Renter value"    → Hazards 20%, Liveability 20%, Environment 10%, Market 40%, Planning 10%
  "Investor"        → Hazards 15%, Liveability 15%, Environment 10%, Market 25%, Planning 35%
  "Balanced"        → 20% each (equal weights)
```

---

## Overall Composite Score

### Weighted Geometric Mean of Category Scores

```
composite = exp(
    0.30 * ln(hazards + 1) +
    0.15 * ln(environment + 1) +
    0.25 * ln(liveability + 1) +
    0.15 * ln(market + 1) +
    0.15 * ln(planning + 1)
) - 1
```

**Why geometric mean, not arithmetic?** The UNDP switched the Human Development Index from arithmetic to geometric mean in 2010 for exactly the same reason we need it: **partial compensability**. A property with a Natural Hazards score of 90 (extreme risk) should not be pulled down to "moderate" by excellent liveability scores. The geometric mean ensures that one bad category dimension drags the composite down more than a simple average would.

**The +1 shift:** Scores of 0 would make the geometric mean 0 regardless of other scores. Adding 1 before the calculation (and subtracting 1 after) prevents this while preserving the partial-compensability property. Without it, a single category at 0 would zero out the entire composite.

### Rating Bins

| Score Range | Rating | Color | Description |
|-------------|--------|-------|-------------|
| 0–20 | Very Low | `#0D7377` teal | Minimal concerns across measured factors |
| 21–40 | Low | `#56B4E9` sky blue | Some minor factors present, generally favourable |
| 41–60 | Moderate | `#E69F00` amber | Notable factors present, worth investigating |
| 61–80 | High | `#D55E00` vermillion | Significant concerns in one or more areas |
| 81–100 | Very High | `#C42D2D` coral | Serious concerns, investigate thoroughly before committing |

Bins apply to both category scores and the composite. Use the same 5-level scale everywhere for consistency.

---

## Missing Data & Confidence

### The Rules

1. **Missing data ≠ zero risk.** A property with no flood data gets "Unknown," not "No flood risk."
2. **Minimum coverage threshold per category:** At least 2 indicators in a category must be present to produce a category score. If only 1 of 8 Natural Hazard indicators is available, that category shows "Insufficient data" rather than a misleading score.
3. **Minimum composite threshold:** At least 3 of 5 categories must have valid scores to show a composite.
4. **Confidence score** is always displayed alongside the composite.

### Confidence Calculation

```
confidence = category_aware_confidence(available_indicators):
    category_scores = []
    for each category:
        available = count of indicators with data in this category
        total = count of all indicators in this category

        if available < 2:
            category_scores.append(0)  // Below minimum threshold
            continue

        category_coverage = available / total
        category_scores.append(category_coverage)

    return mean(category_scores) * 100
```

**Design notes:**
- Uses `available / total` directly so that Market with 2/3 indicators = 67% coverage, not 100%
- Categories with fewer than 2 available indicators contribute 0% coverage (and show "Insufficient data" per the rules above)
- This prevents small categories (Market=3, Environment=5) from inflating confidence when data is missing

### Available-Weight Renormalization

When indicators are missing within a category, renormalize the remaining weights:

```
category_score = sum(w_i * s_i for available indicators) / sum(w_i for available indicators)
```

This is the standard approach from the OECD Handbook — missing indicators are assumed to be at the population mean of the available indicators.

### Score Interval for Low Coverage

When confidence is below 70%, show a range instead of a point estimate:

```
C_low  = (sum_available_weighted + sum_missing_weights * 0)   / total_weight
C_high = (sum_available_weighted + sum_missing_weights * 100) / total_weight
```

Display: "Composite: 35–72 (limited data — 12 of 27 indicators available)"

### Bayesian Shrinkage (V2)

For properties with very low coverage, shrink the score toward the regional average:

```
alpha = n_available / (n_available + 10)  // 10 is the prior strength
adjusted = alpha * observed + (1 - alpha) * regional_average
```

This prevents a single available indicator from producing an extreme score. With only 3 indicators available: alpha = 3/13 ≈ 0.23, so the score is 77% the regional average and 23% the observed.

---

## Context Signals

These are displayed alongside scores but are NOT inputs to the score calculation:

### 1. Local Prevalence

"**X% of properties within 2km share this flood zone classification.**"

```sql
-- For binary/categorical indicators
SELECT
    COUNT(*) FILTER (WHERE fz.flood_category IS NOT NULL) * 100.0 / COUNT(*)
    AS pct_in_flood_zone
FROM addresses a
LEFT JOIN LATERAL (
    SELECT flood_zone_category AS flood_category
    FROM flood_zones WHERE ST_Intersects(geom, a.geom) LIMIT 1
) fz ON true
WHERE ST_DWithin(a.geom::geography, target_geom::geography, 2000);
```

**Purpose:** Normalizes risk perception. If 60% of nearby properties are in the same flood zone, it is a systemic regional issue — concerning but not property-specific. If only 3% are, this property is an outlier — more actionable for the individual.

### 2. National Percentile

"**This property's natural hazard exposure is higher than X% of NZ properties.**"

Pre-computed from the materialized view of all property scores. Stored as a column in `mv_property_scores`.

### 3. Trend Direction

"**Crime in this area is ↓ decreasing (down 12% over 3 years).**"

For indicators with time-series data (crime, bonds, air quality, climate), show the trend alongside the current score.

### 4. Data Vintage

"**Source: GWRC | Updated: Jan 2026 | Resolution: Property-level polygon**"

Always show when the data was last refreshed and its spatial resolution.

---

## Score Presentation

### Primary Display: Score Strip + Category Breakdown

```
Composite: 42/100 — Low Risk    Confidence: 85%
[Hazards: 25] [Environ: 38] [Live: 55] [Market: 48] [Planning: 45]
   teal          teal        amber       teal          teal

▸ Natural Hazards (Very Low — 25/100)
    Flood zone:        No risk detected     ✓    0
    Tsunami zone:      Yellow (distant)          30
    Liquefaction:      Not in zone          ✓    0
    Earthquake (10yr): 14 events M4+ (30km)      28
    Coastal erosion:   Not coastal          ✓    0
    Wind zone:         Medium                    30
    Wildfire:          12 VHE days/yr            40
    EPB nearby:        10 within 300m            67
```

### What Gets Highlighted

- **Outlier risks** (score ≥ 60 in any individual indicator): highlighted with vermillion/coral chip
- **Data coverage gaps**: shown with grey dashed border + "Data not available" message
- **Trend changes**: shown with ↑↓ arrows when data supports it
- **Prevalence context**: shown for any indicator where the property differs significantly from its neighbourhood (above 75th or below 25th percentile of nearby properties)

---

## Sensitivity & Robustness

Before launch, run these checks:

### 1. Weight Perturbation Test

Vary each category weight by ±30% and measure how many properties change rating bins (e.g., from "Low" to "Moderate"). If >20% of properties change bins, the scoring is too sensitive to weight choice and needs revision.

### 2. Equal-Weight Comparison

Run the full scoring with equal weights (20% per category, equal within categories) and compare to expert weights. Report the rank correlation (Spearman's rho). If rho > 0.85, the expert weights aren't adding much — consider using equal weights for simplicity and transparency.

### 3. Leave-One-Out Test

Remove each indicator one at a time and check whether property rankings change materially. If a single indicator drives most of the score variation, the weighting may need rebalancing.

### 4. Regional Fairness Check

Compare score distributions across Wellington, Canterbury, and Hawke's Bay (regions with tsunami data). Ensure that Wellington properties don't systematically score worse than Canterbury just because Wellington has more data layers — that's a data availability artifact, not a real risk difference.

### 5. Known-Property Validation

Score 10 well-known Wellington properties where you can independently verify the risk profile:
- A Cuba Street CBD property (should score: moderate hazards from EPB, high liveability, moderate market)
- A Petone property in flood zone (should score: high hazards from flood)
- A Karori suburban property (should score: low hazards, moderate liveability)
- A Miramar property near airport (should score: environment concerns from noise)
- Etc.

Compare the score output to what a human expert would assign. If they diverge significantly, recalibrate.

---

## What We Learned From Existing Platforms

| Platform | Key Lesson for WhareScore |
|----------|--------------------------|
| **First Street** | Keep hazard scores separate. Use 1-10 or 1-5 bins, not continuous scores. Peer-review methodology. |
| **ClimateCheck** | "Property Resilience Measures" concept — scoring mitigation, not just exposure. (V2 idea.) |
| **Zillow** | Risk transparency is politically sensitive. Position as informational, not definitive. |
| **CoreLogic NZ** | They exist but sell to institutions. Consumer-facing is the gap. |
| **FEMA NRI** | Cube root transformation for skewed data. K-means clustering for rating bins. Community resilience adjusts raw risk. |
| **INFORM** | Geometric mean prevents full compensability across dimensions. |
| **RiskScape NZ** | Hazard × Assets × Vulnerability is the gold standard framework. We simplify by focusing on Hazard × Exposure (no individual building vulnerability modelling in MVP). |

### Common Pitfalls Avoided

1. **Single number fallacy** → We have 5 category scores + optional composite
2. **Full compensability** → Geometric mean for composite, softmax for hazards
3. **Absence of data = absence of risk** → Explicit "Unknown" vs "No risk detected" distinction
4. **False precision** → 5 rating bins, not continuous scores
5. **Ecological fallacy** → Every indicator shows its spatial resolution
6. **Ignoring temporal dimension** → Data vintage always displayed, trend arrows where available
7. **No robustness testing** → 5 sensitivity checks planned before launch

---

## Key References

### Platforms
- First Street Foundation Methodology — https://firststreet.org/methodology
- ClimateCheck Methodology — https://climatecheck.com/our-methodologies
- CoreLogic NZ Climate Risk — https://www.corelogic.co.nz/software-solutions/climate-risk-solutions-lenders
- RiskScape (GNS/NIWA/NHC) — https://www.riskscape.org.nz/
- NZ Natural Hazards Portal — https://www.naturalhazardsportal.govt.nz/

### Methodology
- FEMA National Risk Index — https://hazards.fema.gov/nri/determining-risk
- INFORM Global Risk Index — https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Methodology
- OECD Handbook on Constructing Composite Indicators (Nardo et al., 2005) — https://www.oecd.org/en/publications/handbook-on-constructing-composite-indicators-methodology-and-user-guide_9789264043466-en.html
- EU JRC 10-Step Guide to Composite Indicators — https://knowledge4policy.ec.europa.eu/composite-indicators/10-step-guide
- COINr Framework (normalization, weighting, aggregation) — https://bluefoxr.github.io/COINrDoc/

### NZ Hazard Science
- GNS National Seismic Hazard Model — https://www.gns.cri.nz
- NIWA Coastal & Flood Hazards — https://niwa.co.nz/hazards
- NZ Natural Hazards Commission — https://www.naturalhazards.govt.nz/

### Academic
- Kappes et al. (2012). "Challenges of analyzing multi-hazard risk: a review." Natural Hazards, 64(2), 1925–1958.
- Nardo, M. et al. (2005). Handbook on Constructing Composite Indicators. OECD Working Paper.
- UNDP (2010). Human Development Report — Technical Notes on geometric mean aggregation.
- Saaty, T.L. (1980). The Analytic Hierarchy Process. McGraw-Hill.
