# WhareScore Fair Price Engine — Research & Design

**Last Updated:** 2026-03-05
**Status:** Research complete, ready for implementation (merged from two research sessions)

---

## Table of Contents

1. [Overview](#overview)
2. [Available Data Sources](#available-data-sources)
3. [SA2 Geography Mapping](#sa2-geography-mapping)
4. [Fair Rent Estimation](#fair-rent-estimation)
5. [Trend Analysis](#trend-analysis)
6. [Market Heat Signals](#market-heat-signals)
7. [Fair Purchase Price Estimation](#fair-purchase-price-estimation)
8. [Confidence & Data Quality](#confidence--data-quality)
9. [Comparable Properties ("Comps")](#comparable-properties-comps)
10. [MBIE Market Rent API Integration](#mbie-market-rent-api-integration)
11. [Database Schema & Pipeline](#database-schema--pipeline)
12. [API Design](#api-design)
13. [UX Presentation](#ux-presentation)
14. [Competitive Analysis](#competitive-analysis)
15. [Implementation Priority](#implementation-priority)

---

## Overview

The fair price engine answers two questions for any NZ address:
1. **"Is this rent fair?"** — Compare a property's rent against market data for similar properties in the same area
2. **"What's this property likely worth?"** — Estimate current value using council valuations + market indices

**Design principles:**
- Always show a **range**, never a single number — we don't have individual property data
- Be **transparent** about methodology and data sources
- Clearly communicate **confidence levels** based on data quality
- Use **multiple methods** and cross-validate; flag divergences
- Include legally required disclaimer: "This is not a registered valuation or appraisal"

---

## Available Data Sources

### In PostGIS (static, loaded)

| Source | Table | Granularity | Key Fields | Records |
|--------|-------|-------------|------------|---------|
| MBIE quarterly bonds | `bonds_detailed` | SA2 × dwelling type × beds | median_rent, LQ, UQ, geometric_mean, log_std_dev, total_bonds | 1,189,834 |
| MBIE monthly bonds | `bonds_tla` | TLA (city) level | median_rent, LQ, UQ, lodged/active/closed bonds | 26,417 |
| MBIE monthly bonds | `bonds_region` | Regional council level | Same as TLA | 7,110 |
| RBNZ M10 housing | `rbnz_housing` | **National only** | house_price_index (SPAR), house_sales, housing_stock_value | 143 |

### Live APIs (query on-demand)

| Source | Endpoint | Granularity | Key Fields |
|--------|----------|-------------|------------|
| MBIE Market Rent API v2 | `api.business.govt.nz/gateway/tenancy-services/market-rent/v2/statistics` | SA2 (SAU2019) | mean, median, LQ, UQ, log-normal params, bond counts |
| WCC Property Valuations | `gis.wcc.govt.nz/.../Property/MapServer/0` | Per-property | CV, LV, IV, land_area, valuation_date |
| CCC Rating Values | `gis.ccc.govt.nz/.../Rating/MapServer/0` | Per-property | CV, LV, IV (no address — join layer 1) |
| Taranaki Property Rating | `services.arcgis.com/.../Property_Rating/FeatureServer/0` | Per-property | CV, LV, address, land_area, valuation_date, rates |

### Implemented (cache-on-demand)

| Source | Table | Status |
|--------|-------|--------|
| MBIE Market Rent API v2 | `market_rent_cache` | ✅ Working — key obtained, 92 rows cached for 4 Wellington SA2s. Script: `fetch_market_rent.py` |

### Not Yet Available

| Source | Status | Action Needed |
|--------|--------|---------------|
| SA2 2018 boundaries | Not downloaded | Download from datafinder.stats.govt.nz (or concordance CSV) — **NEXT BLOCKER** |
| Other council valuation APIs | Not discovered | Auckland (needs DevTools research), Hutt, Porirua, Upper Hutt |

---

## SA2 Geography Mapping

### The Problem

Bond rental data (`bonds_detailed`) is keyed by **SA2 2018 codes** (6-digit, e.g. `252500`). Our addresses table has no SA2 column. We need to map: **address → meshblock → SA2 → rental data**.

### Confirmed: bonds_detailed uses 2018 SA2 codes

The MBIE API uses area definition `SAU2019` which refers to 2018 SA2 boundaries (unchanged in 2019). There are ~2,144 SA2 areas nationally in the 2018 classification vs ~2,395 in 2023. Most codes are identical between years; some were split or merged.

### Solution: Two-step join

**Step 1: Address → Meshblock** (already works via spatial join)
```sql
-- Tested: 162 Cuba St → meshblock 4016363 (< 1ms with GIST index)
SELECT mb.mb2023_code
FROM addresses a
JOIN meshblocks mb ON ST_Within(a.geom, mb.geom)
WHERE a.address_id = 1753062;
```

**Step 2: Meshblock → SA2** (needs concordance table)

**Option A — Geographic Areas File 2018 (concordance CSV, recommended):**
- URL: https://datafinder.stats.govt.nz/table/104680-geographic-areas-file-2018/
- Free download, requires Stats NZ Datafinder account
- Contains: `MB2018_V1_00` → `SA22018_V1_00` mapping for all meshblocks
- Load as a simple lookup table (no geometry needed)

**Option B — SA2 2018 boundaries (spatial polygons):**
- URL: https://datafinder.stats.govt.nz/layer/92212-statistical-area-2-2018-generalised/
- Direct spatial join: `ST_Within(address.geom, sa2.geom)`
- Advantage: works even without meshblock step
- Disadvantage: heavier spatial join (but only ~2,144 polygons, very fast)

**Problem: Meshblock version mismatch.** Our meshblocks table has 2023 codes. The concordance has 2018 codes. We'd need EITHER:
1. Load SA2 2018 boundaries and do direct spatial join (simpler, recommended)
2. Load both 2018 concordance AND 2018→2023 meshblock concordance (more complex)

**Recommendation:** Download SA2 2018 generalised boundaries GeoPackage and load into PostGIS as `sa2_boundaries`. Then:
```sql
-- Direct spatial join: address → SA2 (< 1ms per address with GIST index)
SELECT sa2.sa22018_v1_00_code AS sa2_code, sa2.sa22018_v1_00_name AS sa2_name
FROM addresses a
JOIN sa2_boundaries sa2 ON ST_Within(a.geom, sa2.geom)
WHERE a.address_id = 1753062;
```

### Also needed: Geographic Areas Table 2023

For future-proofing and for mapping between 2018 and 2023 geographies:
- URL: https://datafinder.stats.govt.nz/table/111243-geographic-areas-table-2023/
- Contains full hierarchy: MB2023 → SA1 → SA2 → SA3 → TA → Regional Council

---

## Fair Rent Estimation

### Method A: Direct SA2 Lookup (Primary — MVP)

For a given property's SA2 area, dwelling type, and bedroom count:

```
fair_rent_low   = lower_quartile_rent (25th percentile)
fair_rent_mid   = median_rent (50th percentile)
fair_rent_high  = upper_quartile_rent (75th percentile)
```

The IQR naturally captures variation due to unobserved property characteristics (age, condition, features). A property in good condition should be near Q3; average near the median; lower condition near Q1.

**IQR guardrails on the adjustment-derived band:**

After the rent advisor computes a band from median × stacked adjustments, the IQR is used as a reality check:

1. **Band width cap:** The band cannot be wider than the IQR. We can't claim more spread than the market actually exhibits for this SA2 + dwelling type + bedroom count.
2. **Minimum band width:** If few adjustment factors have been analysed, the band is widened to reflect ignorance. Formula: `min_width = IQR × (1 - factors_analysed / factors_available)`. With 0/27 factors → full IQR width. With 27/27 → no minimum.
3. **Confidence reduction:** If the band midpoint falls more than 1 IQR beyond Q1 or Q3, confidence stars are reduced by 1 (min 1★). The estimate is preserved but flagged as uncertain.

These guardrails don't change the point estimate — they constrain uncertainty width and signal confidence.

**Example — 2-bed flat in SA2 252500 (Te Aro), Q3 2025:**
- Lower quartile: $550/week
- Median: $610/week
- Upper quartile: $650/week
- Based on 12 bonds

**Fallback hierarchy for insufficient data:**
1. SA2 + dwelling type + beds (finest)
2. SA2 + dwelling type + ALL beds
3. SA2 + ALL types + beds
4. TLA level (from `bonds_tla`)
5. Regional level (from `bonds_region`)

### Method B: Yield-Based Cross-Validation (Secondary)

When council CV is available, estimate rent from capital value:

```
yield_estimated_weekly_rent = (CV × gross_yield) / 52
```

**Regional gross yield benchmarks (2024-2025):**

| Region | Low | Typical | High |
|--------|-----|---------|------|
| Auckland | 3.0% | 3.5% | 4.0% |
| Wellington | 3.0% | 4.5% | 5.5% |
| Christchurch | 4.0% | 4.8% | 5.5% |
| Hamilton | 4.0% | 4.5% | 5.0% |
| Dunedin | 4.5% | 5.0% | 5.5% |
| National average | 3.5% | 4.2% | 5.0% |

**Use as cross-check:** If yield-estimated rent diverges >20% from bond data median, flag it. Possible causes: stale CV, unusual property, gentrifying/declining area.

### Method C: Trend Analysis

**Year-over-year change:**
```sql
-- YoY rent trend for an SA2/dwelling/beds combo
SELECT
  current.median_rent AS current_median,
  previous.median_rent AS year_ago_median,
  ROUND(((current.median_rent - previous.median_rent)::numeric
    / previous.median_rent) * 100, 1) AS yoy_pct_change
FROM bonds_detailed current
JOIN bonds_detailed previous
  ON current.location_id = previous.location_id
  AND current.dwelling_type = previous.dwelling_type
  AND current.number_of_beds = previous.number_of_beds
  AND previous.time_frame = current.time_frame - INTERVAL '1 year'
WHERE current.location_id = '252500'
  AND current.dwelling_type = 'Flat'
  AND current.number_of_beds = '2'
  AND current.time_frame = '2025-07-01';
```

**Smoothed trend (4-quarter rolling):**
```sql
SELECT time_frame,
  AVG(median_rent) OVER (ORDER BY time_frame ROWS BETWEEN 3 PRECEDING AND CURRENT ROW)
    AS rolling_4q_median
FROM bonds_detailed
WHERE location_id = '252500' AND dwelling_type = 'Flat' AND number_of_beds = '2';
```

**Observed trend for Te Aro 2-bed flat (2024-2025):**
- Range: $540-$610/week over last 8 quarters
- Pattern: Stable with seasonal variation (higher in Q1 Jan-Mar, lower in Q4)
- Wellington City TLA median: $550-$670/week (shows same seasonal pattern)

### Percentile Estimation (Log-Normal)

`bonds_detailed` includes `geometric_mean_rent` and `log_std_dev_weekly_rent`, which define a log-normal distribution. This lets us compute the exact percentile position of any asking rent — much more precise than quartile interpolation.

```python
def compute_percentile(asking_rent, geo_mean, log_sd, lq, median, uq):
    """Estimate where the asking rent sits in the local distribution."""
    if geo_mean and log_sd and log_sd > 0:
        # Log-normal CDF using the parameters MBIE already provides
        import math
        from scipy.stats import norm
        z_score = (math.log(asking_rent) - math.log(geo_mean)) / log_sd
        return norm.cdf(z_score) * 100
    else:
        # Fallback: linear interpolation between quartiles
        if asking_rent <= lq:
            return 25 * (asking_rent / lq) if lq > 0 else 25
        elif asking_rent <= median:
            return 25 + 25 * (asking_rent - lq) / (median - lq)
        elif asking_rent <= uq:
            return 50 + 25 * (asking_rent - median) / (uq - median)
        else:
            return min(99, 75 + 25 * (asking_rent - uq) / (uq - median))
```

### Risk Score Integration

For RISK-SCORE-METHODOLOGY.md Market category (rental fairness = 40% weight):

```python
def rental_fairness_risk_score(ratio):
    """Ratio of asking rent to median. Range 0.5-2.0, mapped to 0-100."""
    clamped = max(0.5, min(2.0, ratio))
    return round(((clamped - 0.5) / (2.0 - 0.5)) * 100, 1)
```

### Rent Assessment Logic

Given a user-provided asking rent and the property's SA2/type/beds:

```
If asking_rent < lower_quartile:     "Below market" (green, good for renters)
If LQ ≤ asking_rent < median:        "Below average" (light green)
If median - 5% ≤ asking ≤ median + 5%: "At market rate" (neutral)
If median < asking_rent ≤ UQ:        "Above average" (light amber)
If asking_rent > upper_quartile:     "Above market" (amber, expensive)
If asking_rent > UQ × 1.3:           "Well above market" (red, investigate)
```

### Outlier Detection

Flag ratios outside 0.3-3.0:

```python
if ratio < 0.3:
    warning = "This rent is unusually low. May indicate a special arrangement or data issue."
elif ratio > 3.0:
    warning = "This rent is unusually high relative to the area median. Please verify."
```

### Seasonal Adjustment (V2)

NZ rents vary by quarter (higher Q1 Jan-Mar, lower Q2-Q3). The YoY same-quarter comparison inherently controls for this. For the current fairness comparison, always use the most recent quarter with a note:

> "Market rent data is from Q3 2025 (July-September). Rents in Wellington typically vary 3-5% between quarters."

**Advanced (V2):** Compute seasonal factors from 3+ years of history:

```sql
WITH quarterly_medians AS (
    SELECT location_id, dwelling_type, number_of_beds,
           EXTRACT(QUARTER FROM time_frame) AS quarter,
           AVG(median_rent) AS avg_median
    FROM bonds_detailed
    WHERE time_frame >= CURRENT_DATE - INTERVAL '3 years'
      AND location_id IS NOT NULL AND median_rent IS NOT NULL
    GROUP BY location_id, dwelling_type, number_of_beds, EXTRACT(QUARTER FROM time_frame)
),
annual_avg AS (
    SELECT location_id, dwelling_type, number_of_beds,
           AVG(avg_median) AS annual_median
    FROM quarterly_medians
    GROUP BY location_id, dwelling_type, number_of_beds
)
SELECT qm.location_id, qm.quarter,
       qm.avg_median / aa.annual_median AS seasonal_factor
FROM quarterly_medians qm
JOIN annual_avg aa USING (location_id, dwelling_type, number_of_beds);
```

---

## Trend Analysis

### YoY Trend (Primary)

Already covered in Method C above. Same-quarter comparison inherently controls for seasonality.

### Multi-Year CAGR (Deeper Context)

A single YoY number can be misleading. Compute 3-year and 5-year compound annual growth rates:

```sql
CREATE MATERIALIZED VIEW mv_rental_trends AS
WITH ranked AS (
    SELECT location_id AS sa2_code, dwelling_type, number_of_beds,
           time_frame, median_rent, active_bonds,
           ROW_NUMBER() OVER (
               PARTITION BY location_id, dwelling_type, number_of_beds
               ORDER BY time_frame DESC
           ) AS q_rank
    FROM bonds_detailed
    WHERE location_id IS NOT NULL AND median_rent IS NOT NULL AND median_rent > 0
)
SELECT
    c.sa2_code, c.dwelling_type, c.number_of_beds,
    c.median_rent AS current_median,
    c.time_frame AS current_quarter,

    -- YoY (4 quarters back)
    y1.median_rent AS median_1yr_ago,
    CASE WHEN y1.median_rent > 0 THEN
        ROUND(((c.median_rent - y1.median_rent) / y1.median_rent * 100)::numeric, 1)
    END AS yoy_pct,

    -- 3-year CAGR (12 quarters back)
    CASE WHEN y3.median_rent > 0 THEN
        ROUND((POWER(c.median_rent::numeric / y3.median_rent, 1.0/3) - 1) * 100, 1)
    END AS cagr_3yr_pct,

    -- 5-year CAGR (20 quarters back)
    CASE WHEN y5.median_rent > 0 THEN
        ROUND((POWER(c.median_rent::numeric / y5.median_rent, 1.0/5) - 1) * 100, 1)
    END AS cagr_5yr_pct,

    -- Acceleration: is YoY growth speeding up or slowing down?
    CASE WHEN y1.median_rent > 0 AND y2.median_rent > 0 THEN
        ROUND((
            ((c.median_rent - y1.median_rent) / y1.median_rent) -
            ((y1.median_rent - y2.median_rent) / y2.median_rent)
        ) * 100, 1)
    END AS acceleration_pct

FROM ranked c
LEFT JOIN ranked y1 ON c.sa2_code = y1.sa2_code AND c.dwelling_type = y1.dwelling_type
    AND c.number_of_beds = y1.number_of_beds AND y1.q_rank = c.q_rank + 4
LEFT JOIN ranked y2 ON c.sa2_code = y2.sa2_code AND c.dwelling_type = y2.dwelling_type
    AND c.number_of_beds = y2.number_of_beds AND y2.q_rank = c.q_rank + 8
LEFT JOIN ranked y3 ON c.sa2_code = y3.sa2_code AND c.dwelling_type = y3.dwelling_type
    AND c.number_of_beds = y3.number_of_beds AND y3.q_rank = c.q_rank + 12
LEFT JOIN ranked y5 ON c.sa2_code = y5.sa2_code AND c.dwelling_type = y5.dwelling_type
    AND c.number_of_beds = y5.number_of_beds AND y5.q_rank = c.q_rank + 20
WHERE c.q_rank = 1;

CREATE INDEX idx_mv_trends_sa2 ON mv_rental_trends(sa2_code);
CREATE INDEX idx_mv_trends_combo ON mv_rental_trends(sa2_code, dwelling_type, number_of_beds);
```

### Smoothed Trend (Rolling 4-Quarter Average)

For trend charts, show a trailing 1-year rolling average instead of raw quarterly jumps:

```sql
SELECT time_frame, median_rent,
    AVG(median_rent) OVER (
        PARTITION BY location_id, dwelling_type, number_of_beds
        ORDER BY time_frame ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
    ) AS rolling_4q_avg
FROM bonds_detailed
WHERE location_id = '252500' AND dwelling_type = 'Flat' AND number_of_beds = '2'
  AND time_frame >= '2020-01-01'
ORDER BY time_frame;
```

### Trend Risk Score

For RISK-SCORE-METHODOLOGY.md Market category (rental trend = 35% weight):

```python
def trend_risk_score(yoy_change_pct):
    """Higher rent increases = worse for renters. Range: -10% to +20% → 0-100."""
    if yoy_change_pct is None: return None
    clamped = max(-10, min(20, yoy_change_pct))
    return round(((clamped + 10) / 30) * 100, 1)
```

### Trend Presentation

| YoY Change | Arrow | Label |
|-----------|-------|-------|
| Down 5%+ | Large green down | "Rents are falling" |
| Down 1-5% | Small green down | "Rents are easing" |
| -1% to +1% | Grey horizontal | "Rents are stable" |
| Up 1-5% | Small amber up | "Rents are rising" |
| Up 5-10% | Large amber up | "Rents are rising moderately" |
| Up 10%+ | Large red up | "Rents are rising sharply" |

---

## Market Heat Signals

### National HPI (RBNZ)

The `rbnz_housing` table provides macro context. Compute where current HPI sits relative to history:

```sql
WITH hpi_stats AS (
    SELECT hpi, PERCENT_RANK() OVER (ORDER BY hpi) AS pct_rank
    FROM rbnz_housing WHERE hpi IS NOT NULL
)
SELECT pct_rank FROM hpi_stats
WHERE hpi = (SELECT hpi FROM rbnz_housing ORDER BY quarter DESC LIMIT 1);
```

### Local Market Heat from Bond Data

We can derive local demand signals from `bonds_detailed` without needing national HPI:

**Signal 1: Active bond growth** — YoY change in active bonds (growing = more supply or demand)

**Signal 2: Turnover rate** — `closed_bonds / active_bonds` (higher = renters moving more frequently)

**Signal 3: New bond lodgements** — Combined with price trends:
- Rising lodgements + rising rents = demand-driven heat
- Rising lodgements + stable/falling rents = supply increase (good for renters)

### Composite Market Heat Score

```python
def local_market_heat(yoy_rent_change, active_bonds_yoy, turnover_rate, hpi_percentile):
    """Combine local and national signals. Returns 0-100."""
    rent_heat = max(0, min(40, (yoy_rent_change or 0) * 2))       # 0-40 points
    bond_heat = max(0, min(30, (active_bonds_yoy or 0) + 15))     # 0-30 points
    hpi_heat = (hpi_percentile or 0.5) * 30                       # 0-30 points
    return round(rent_heat + bond_heat + hpi_heat, 1)
```

---

## Fair Purchase Price Estimation

### Method 1: CV + HPI Adjustment (Primary)

Council valuations are point-in-time snapshots. Adjust forward using the RBNZ House Price Index:

```
estimated_value = CV × (HPI_current / HPI_at_valuation_date)
```

**RBNZ HPI is national only** (our `rbnz_housing` table has no regional breakdown). The SPAR methodology (Sale Price to Appraisal Ratio) inherently controls for property quality.

**Current HPI trajectory (national):**

| Quarter | HPI | Change from Q1 2024 |
|---------|-----|---------------------|
| Q1 2024 | 3470 | — |
| Q2 2024 | 3398 | -2.1% |
| Q3 2024 | 3381 | -2.6% |
| Q4 2024 | 3414 | -1.6% |
| Q1 2025 | 3412 | -1.7% |
| Q2 2025 | 3375 | -2.7% |
| Q3 2025 | 3374 | -2.8% |

Market essentially flat to slightly declining since early 2024.

**Uncertainty bands based on CV age:**

| Months Since Revaluation | Uncertainty | Display |
|--------------------------|-------------|---------|
| 0-12 months | ±8% | High confidence |
| 12-24 months | ±12% | Good confidence |
| 24-36 months | ±18% | Moderate confidence |
| 36+ months | ±25% | Low confidence — wide range |

**Known revaluation dates:**

| Council | Effective Date | CV Age (as of Mar 2026) |
|---------|---------------|------------------------|
| Wellington City | 1 September 2024 | 18 months (good) |
| Christchurch | ~August 2022 | 43 months (low confidence) |
| Taranaki (New Plymouth) | 1 August 2025 | 7 months (high confidence) |

### Method 2: Gross Rental Yield Inversion (Cross-Check)

```
estimated_value = (median_weekly_rent × 52) / gross_yield
```

**Example — 2-bed flat in Te Aro:**
```
Median rent: $610/week
Wellington typical yield: 4.5%

Estimated value = ($610 × 52) / 0.045 = $704,889
Range at 3.0%-5.5% yield: $576,727 - $1,057,333
```

This is a wide range — useful only as a cross-check, not primary estimate.

### Method 3: Land Value per sqm Comparison

```sql
-- For properties in the same SA2 with council data:
-- Compare target property's LV/sqm against SA2 median
SELECT
  p.land_value / p.land_area AS property_lv_per_sqm,
  sa2_stats.median_lv_per_sqm,
  ROUND(((p.land_value / p.land_area - sa2_stats.median_lv_per_sqm)
    / sa2_stats.median_lv_per_sqm) * 100, 1) AS pct_above_median
FROM property_valuation p
CROSS JOIN LATERAL (
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY land_value / NULLIF(land_area, 0))
    AS median_lv_per_sqm
  FROM property_valuation
  WHERE sa2_code = p.sa2_code AND land_area > 0
) sa2_stats;
```

Useful for detecting outliers — a property 40%+ above the SA2 median LV/sqm may be a premium site (corner, views) or an anomaly.

### Ensemble Value Estimate

Combine methods with confidence weighting:

```python
def estimate_property_value(cv, valuation_date, sa2_median_rent,
                            dwelling_type, region, land_area, sa2_bond_count):
    estimates = {}
    weights = {}

    # Method 1: CV + HPI adjustment
    months_old = months_since(valuation_date)
    hpi_ratio = get_hpi_ratio(valuation_date)  # national HPI only
    cv_adjusted = cv * hpi_ratio
    estimates['cv_hpi'] = cv_adjusted
    weights['cv_hpi'] = max(0.3, 1.0 - (months_old / 48))  # decays over 4 years

    # Method 2: Yield inversion
    if sa2_median_rent and sa2_bond_count >= 10:
        annual_rent = sa2_median_rent * 52
        yield_rate = YIELD_TABLE[region]['typical']
        estimates['yield'] = annual_rent / yield_rate
        weights['yield'] = 0.3 if sa2_bond_count >= 20 else 0.15

    # Weighted average
    total_weight = sum(weights.values())
    mid_estimate = sum(estimates[k] * weights[k] for k in estimates) / total_weight

    # Uncertainty from method agreement + CV age
    if len(estimates) > 1:
        spread = (max(estimates.values()) - min(estimates.values())) / mid_estimate
        uncertainty = max(0.10, spread * 0.75)
    else:
        uncertainty = 0.08 + (months_old / 48) * 0.17  # 8% to 25%

    return {
        'low': round(mid_estimate * (1 - uncertainty), -3),   # round to nearest $1K
        'mid': round(mid_estimate, -3),
        'high': round(mid_estimate * (1 + uncertainty), -3),
        'confidence': confidence_tier(months_old, sa2_bond_count, len(estimates)),
    }
```

---

## Confidence & Data Quality

### SA2 Bond Count Distribution (Q3 2025, all types/beds combined)

| Tier | Bond Count | SA2 Areas | % of Total | Approach |
|------|-----------|-----------|-----------|----------|
| High confidence | 30+ | 424 | 26% | Direct SA2 median & quartiles |
| Good confidence | 15-29 | 670 | 41% | Direct SA2, note limited data |
| Limited | 5-14 | 555 | 34% | Blend with TLA-level data |
| Suppressed | <5 | ~500+ | — | Fall back to TLA or region |

**Blending formula for low-count SA2s:**
```
blended_median = (bond_count / 20) × SA2_median + (1 - bond_count / 20) × TLA_median
```
Full weight to SA2 at 20+ bonds; linearly blends toward TLA average below that.

### Confidence Stars

| Stars | Criteria | Rent Display | Value Display |
|-------|----------|-------------|---------------|
| ★★★★★ | 30+ bonds, CV <12mo old, methods agree <10% | Tight IQR range | ±8-10% |
| ★★★★ | 15-29 bonds, CV <24mo old, methods agree <15% | IQR + note | ±12-15% |
| ★★★ | 5-14 bonds, CV <36mo old | "Limited data" flag | ±15-20% |
| ★★ | <5 bonds (using TLA), CV >36mo old | "Wider area data" | ±20-25% |
| ★ | Missing key inputs | "Indicative only" | "Insufficient data" |

### Required Disclaimer

> "This estimate is based on publicly available government data including MBIE bond records, council rating valuations, and the RBNZ House Price Index. It is **not** a registered valuation, appraisal, or market assessment. Individual property values depend on specific features, condition, market timing, and other factors this estimate cannot account for. Data sourced from MBIE Tenancy Services and [council name]."

### Regional Data Quality Profiles

| Region | Typical SA2 Active Bonds | Data Quality | Notes |
|--------|-------------------------|-------------|-------|
| Auckland CBD | 200-500+ | Excellent | Fine-grained analysis possible |
| Wellington City | 50-200 | Good | Most SA2s have adequate data |
| Regional cities | 20-100 | Moderate | May need type/beds fallback |
| Small towns | 5-30 | Low | SA2 aggregate likely needed |
| Rural | 0-10 | Very low | TA or Region fallback required |

### Historical SA2 Code Changes

Stats NZ updates SA2 boundaries with each Census (2013, 2018, 2023). MBIE bond data uses SA2 2018 codes (area definition `SAU2019`). An SA2 that was split between Census years will have a code change.

**Mitigation:**
1. **MVP:** Use codes as-is in the latest data (2020-2025 quarters use consistent 2018 codes)
2. **Trend analysis:** Ensure both quarters use the same SA2 coding. If codes changed mid-series, return NULL for that transition.
3. **V2:** Load Stats NZ SA2 2018→2023 concordance for seamless long-term comparison.

---

## Comparable Properties ("Comps")

### What Comps Mean with Bond Data

We cannot identify individual comparable properties — bonds are anonymized and aggregated. "Comps" means the statistical cohort of similar properties in the same area.

**What we CAN show:**
- "Based on **45 active bonds** for 3-bedroom flats in Te Aro"
- "These bonds have a median rent of $620/wk (range $540-$720)"
- "In the last quarter, 12 new bonds were lodged and 8 were closed"

**What we CANNOT show:**
- Individual comparable addresses (privacy protected)
- Specific rents of individual properties

### Expanding Search Radius

When local data is insufficient, the fallback cascade in [Fair Rent Estimation](#fair-rent-estimation) applies. The match level determines the explainer text:

| Match Level | Display Text |
|------------|-------------|
| `sa2_exact` | "Based on 45 active bonds for **3-bed flats** in **Te Aro**" |
| `sa2_type` | "Based on 120 active bonds for **flats** (all sizes) in **Te Aro**" |
| `sa2_all` | "Based on 350 active bonds for **all property types** in **Te Aro**" |
| `ta` | "Based on Wellington City-wide data (limited local data available)" |
| `region` | "Based on Wellington Region data (very limited local data)" |

### Neighbouring SA2 Aggregation (V2)

For SA2s with thin data, aggregate neighbouring SA2s using spatial adjacency:

```sql
SELECT b.sa2_code, b.sa2_name
FROM sa2_boundaries a
JOIN sa2_boundaries b ON ST_Touches(a.geom, b.geom)
WHERE a.sa2_code = '252500';
-- Returns SA2s bordering Te Aro: Wellington Central, Mt Cook, Newtown, etc.
```

Display as: "Based on Te Aro and surrounding suburbs (320 active bonds)."

---

## MBIE Market Rent API Integration

### API Details

| Field | Value |
|-------|-------|
| Base URL | `https://api.business.govt.nz/gateway/tenancy-services/market-rent/v2/statistics` |
| Sandbox URL | `https://api.business.govt.nz/sandbox/tenancy-services/market-rent/v2/statistics` |
| Auth | Header: `Ocp-Apim-Subscription-Key: YOUR_KEY` |
| Format | `Accept: application/json` or `text/csv` |
| Cost | Free (government API) |
| Timeout | Up to 2 minutes for complex queries |

### Key Parameters

| Parameter | Required | Values |
|-----------|----------|--------|
| `period-ending` | Yes | `yyyy-mm` (must be before last month) |
| `num-months` | Yes | 1-24 (aggregation window) |
| `area-definition` | Yes | `SAU2019` (SA2 level), `territorial-authority-2019`, `regional-council-2019`, `user-defined` |
| `area-codes` | No | Comma-separated SA2 codes |
| `dwelling-type` | No | `Apartment`, `Flat`, `House`, `Room`, `ALL` |
| `num-bedrooms` | No | `1`, `2`, `3`, `4`, `5+`, `NA` |
| `include-aggregates` | No | `true`/`false` |

### Response Fields

| Field | Description |
|-------|-------------|
| `nLodged` | Bonds lodged in period (randomly rounded to nearest 3) |
| `nCurr` | Active bonds at period end |
| `mean` | Mean weekly rent |
| `med` | Median weekly rent |
| `lq` | Lower quartile (25th percentile) |
| `uq` | Upper quartile (75th percentile) |
| `sd` | Standard deviation |
| `lmean` | Log-transformed mean (better for modelling) |
| `lsd` | Log-transformed std dev |
| `slq` | Synthetic lower quartile: `exp(lmean + qnorm(0.25) × lsd)` |
| `suq` | Synthetic upper quartile: `exp(lmean + qnorm(0.75) × lsd)` |
| `brr` | Bond/Rent Ratio (typically 3-4) |

Privacy: All stats suppressed when <5 bonds. Counts randomly rounded to multiples of 3.

### Integration Strategy

**Use MBIE API for real-time "current market" signal; use bonds_detailed for historical trends.**

```python
async def get_current_market_rent(sa2_code: str, dwelling_type: str, beds: str):
    """Query MBIE API for trailing 6-month rent stats."""
    params = {
        "period-ending": last_complete_month(),  # e.g. "2026-02"
        "num-months": "6",
        "area-definition": "SAU2019",
        "area-codes": sa2_code,
        "dwelling-type": dwelling_type,
        "num-bedrooms": beds,
    }
    headers = {
        "Ocp-Apim-Subscription-Key": MBIE_API_KEY,
        "Accept": "application/json",
    }
    response = await httpx.get(MBIE_BASE_URL, params=params, headers=headers, timeout=120)
    return response.json()
```

**Cache strategy:** Cache MBIE API responses for 24 hours per SA2/type/beds combo (data updates monthly, not real-time).

---

## Database Schema & Pipeline

### New Table: SA2 Boundaries

```sql
-- Load SA2 2018 generalised boundaries from Stats NZ GeoPackage
-- ~2,144 polygons nationally
CREATE TABLE sa2_boundaries (
    sa2_code TEXT PRIMARY KEY,
    sa2_name TEXT,
    ta_code TEXT,
    ta_name TEXT,
    rc_code TEXT,
    rc_name TEXT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX idx_sa2_geom ON sa2_boundaries USING GIST(geom);
```

### Materialized View: Rental Market Summary

```sql
CREATE MATERIALIZED VIEW mv_rental_market AS
WITH latest AS (
    SELECT MAX(time_frame) AS latest_quarter FROM bonds_detailed
),
yoy AS (
    SELECT
        b.location_id AS sa2_code,
        b.dwelling_type,
        b.number_of_beds,
        b.median_rent AS current_median,
        b.lower_quartile_rent AS current_lq,
        b.upper_quartile_rent AS current_uq,
        b.geometric_mean_rent AS current_gmean,
        b.total_bonds AS current_bonds,
        prev.median_rent AS prev_year_median,
        prev.total_bonds AS prev_year_bonds,
        CASE WHEN prev.median_rent > 0 THEN
            ROUND(((b.median_rent - prev.median_rent)::numeric / prev.median_rent) * 100, 1)
        END AS yoy_pct_change
    FROM bonds_detailed b
    CROSS JOIN latest l
    LEFT JOIN bonds_detailed prev
        ON b.location_id = prev.location_id
        AND b.dwelling_type = prev.dwelling_type
        AND b.number_of_beds = prev.number_of_beds
        AND prev.time_frame = b.time_frame - INTERVAL '1 year'
    WHERE b.time_frame = l.latest_quarter
        AND b.location_id NOT IN ('', '-99')
        AND b.median_rent IS NOT NULL
)
SELECT
    y.*,
    sa2.sa2_name,
    sa2.ta_name,
    sa2.geom
FROM yoy y
LEFT JOIN sa2_boundaries sa2 ON y.sa2_code = sa2.sa2_code;

CREATE INDEX idx_mv_rental_sa2 ON mv_rental_market(sa2_code);
CREATE INDEX idx_mv_rental_type_beds ON mv_rental_market(dwelling_type, number_of_beds);
CREATE INDEX idx_mv_rental_geom ON mv_rental_market USING GIST(geom);
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rental_market; (after bonds data update)
```

### PL/pgSQL Function: Get Market Report for Address

```sql
CREATE OR REPLACE FUNCTION get_market_report(p_address_id BIGINT)
RETURNS JSON
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_geom GEOMETRY;
    v_sa2_code TEXT;
    v_sa2_name TEXT;
    v_ta_name TEXT;
    v_result JSON;
BEGIN
    -- Step 1: Get address geometry
    SELECT geom INTO v_geom FROM addresses WHERE address_id = p_address_id;
    IF v_geom IS NULL THEN RETURN NULL; END IF;

    -- Step 2: Find SA2 area
    SELECT sa2_code, sa2_name, ta_name
    INTO v_sa2_code, v_sa2_name, v_ta_name
    FROM sa2_boundaries
    WHERE ST_Within(v_geom, geom)
    LIMIT 1;

    -- Step 3: Get rental market data for this SA2
    SELECT json_build_object(
        'sa2_code', v_sa2_code,
        'sa2_name', v_sa2_name,
        'ta_name', v_ta_name,
        'rental_data', (
            SELECT json_agg(json_build_object(
                'dwelling_type', dwelling_type,
                'beds', number_of_beds,
                'median_rent', current_median,
                'lower_quartile', current_lq,
                'upper_quartile', current_uq,
                'bond_count', current_bonds,
                'yoy_change_pct', yoy_pct_change
            ))
            FROM mv_rental_market
            WHERE sa2_code = v_sa2_code
                AND dwelling_type != 'ALL'
                AND number_of_beds != 'ALL'
        ),
        'area_summary', (
            SELECT json_build_object(
                'overall_median', current_median,
                'overall_lq', current_lq,
                'overall_uq', current_uq,
                'total_bonds', current_bonds,
                'yoy_change_pct', yoy_pct_change
            )
            FROM mv_rental_market
            WHERE sa2_code = v_sa2_code
                AND dwelling_type = 'ALL'
                AND number_of_beds = 'ALL'
        ),
        'tla_fallback', (
            SELECT json_build_object(
                'median_rent', median_rent,
                'lodged_bonds', lodged_bonds
            )
            FROM bonds_tla
            WHERE location = v_ta_name
            ORDER BY time_frame DESC
            LIMIT 1
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;
```

### Valuation Cache Table

```sql
-- Cache council valuation API responses to avoid repeated queries
CREATE TABLE valuation_cache (
    address_id BIGINT PRIMARY KEY,
    council TEXT NOT NULL,              -- 'wcc', 'ccc', 'taranaki'
    capital_value INTEGER,
    land_value INTEGER,
    improvements_value INTEGER,
    land_area NUMERIC,
    valuation_date DATE,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    raw_response JSONB
);
CREATE INDEX idx_val_cache_fetched ON valuation_cache(fetched_at);
-- Evict entries older than 7 days
```

---

## API Design

### Endpoint: `/api/v1/property/{address_id}/market`

```json
{
  "sa2": {
    "code": "252500",
    "name": "Te Aro",
    "ta": "Wellington City"
  },
  "rental": {
    "fair_rent_range": {
      "low": 550,
      "mid": 610,
      "high": 650,
      "unit": "week"
    },
    "dwelling_type": "Flat",
    "bedrooms": 2,
    "bond_count": 12,
    "confidence": 3,
    "yoy_change_pct": 5.2,
    "trend_direction": "stable",
    "data_quarter": "2025-Q3",
    "source": "MBIE Tenancy Services bond data"
  },
  "valuation": {
    "capital_value": 750000,
    "land_value": 350000,
    "improvements_value": 400000,
    "valuation_date": "2024-09-01",
    "council": "Wellington City Council",
    "estimated_current_value": {
      "low": 690000,
      "mid": 738000,
      "high": 787000
    },
    "hpi_adjustment_pct": -1.6,
    "confidence": 4,
    "source": "Wellington City Council rating valuations"
  },
  "yield": {
    "gross_yield_pct": 4.3,
    "yield_estimated_rent": 623,
    "rent_to_value_ratio": "market_average"
  },
  "disclaimer": "This is an estimate based on publicly available data. It is not a registered valuation or appraisal."
}
```

### Query Logic (FastAPI)

```python
@router.get("/api/v1/property/{address_id}/market")
async def get_market_data(address_id: int, dwelling_type: str = None, beds: int = None):
    # 1. Get SA2 rental market data from materialized view
    rental = await db.fetch_market_report(address_id)

    # 2. Try to get council valuation (check cache first, then live API)
    valuation = await get_or_fetch_valuation(address_id)

    # 3. If MBIE API key available, get fresh market rent data
    if MBIE_API_KEY and rental['sa2_code']:
        mbie_live = await get_mbie_market_rent(
            rental['sa2_code'], dwelling_type, beds
        )
        # Prefer live data over static if more recent
        if mbie_live and mbie_live['period_end'] > rental['data_quarter']:
            rental = merge_with_live_data(rental, mbie_live)

    # 4. Cross-validate: yield-based estimate
    if valuation and rental.get('median_rent'):
        yield_data = calculate_yield_metrics(valuation, rental)

    # 5. Compute confidence
    confidence = compute_confidence(rental, valuation)

    return MarketResponse(rental=rental, valuation=valuation, yield_data=yield_data)
```

---

## UX Presentation

### Market & Rental Section in Property Report

```
┌─────────────────────────────────────────────┐
│ Market & Rental                    ★★★★ [?] │
│                                              │
│ Fair Rent Range (2-bed flat in Te Aro)       │
│ ├──────────●──────────────────┤              │
│ $550      $610               $650  /week     │
│ Lower     Median             Upper quartile  │
│                                              │
│ 📈 +5.2% year-on-year  ·  12 bonds (Q3 2025)│
│                                              │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                              │
│ Estimated Property Value                     │
│ $690,000 — $787,000                          │
│ Based on CV $750,000 (Sep 2024) adjusted     │
│ for market movement (-1.6% since valuation)  │
│                                              │
│ Rating Valuation                             │
│ Capital Value:  $750,000                     │
│ Land Value:     $350,000                     │
│ Improvements:   $400,000                     │
│ Valued:         1 September 2024             │
│                                              │
│ Gross Yield: 4.3% (market average)           │
│                                              │
│ ⓘ Not a formal valuation. Based on MBIE     │
│   bond data and WCC rating valuations.       │
└─────────────────────────────────────────────┘
```

### Rent Assessment Widget (when user enters asking rent)

```
┌─────────────────────────────────────────────┐
│ Is $650/week fair for this property?         │
│                                              │
│  ◄ Below market ─── At market ─── Above ►   │
│        [$550]    [$610]  [▲$650]   [$650]   │
│         Q1       Median   You      Q3       │
│                                              │
│  Your rent is above the median but within    │
│  the normal range for 2-bed flats in Te Aro. │
│  Rating: ABOVE AVERAGE (amber)               │
└─────────────────────────────────────────────┘
```

### Fair Price Card (Full Property Report View)

```
+============================================+
|  FAIR PRICE ANALYSIS                [?]   |
|                                            |
|  3-bedroom flat in Te Aro                  |
|                                            |
|  MEDIAN RENT        $620/wk               |
|  Your rent           $680/wk               |
|                                            |
|  ┌────────────────────────────────────┐    |
|  │  $540    $620      $680   $720     │    |
|  │   LQ     MED       YOU    UQ      │    |
|  │   |-------[===|======]------|      │    |
|  └────────────────────────────────────┘    |
|                                            |
|  Your rent is 10% above the median.        |
|  You are at the 72nd percentile --         |
|  72% of similar properties pay less.       |
|                                            |
|  Confidence: Good (45 active bonds)        |
|                                            |
|  --- TREND ---                             |
|  Rents in Te Aro are rising moderately.    |
|  +6.9% over the past year.                |
|  3-year CAGR: +4.2%/yr                    |
|  [Sparkline chart: 8 quarters]             |
|                                            |
|  --- MARKET SIGNALS ---                    |
|  345 active rental bonds in Te Aro.        |
|  12 new bonds lodged last quarter.         |
|  National HPI at 85th percentile.          |
|                                            |
|  Source: MBIE Tenancy Services, Q3 2025    |
|  "Is this helpful?" [Yes] [No]             |
+============================================+
```

---

## Competitive Analysis

### NZ Platforms

| Platform | What They Show | Our Advantage |
|----------|---------------|---------------|
| **Tenancy Services** | Median rent by region/TLA, table format, no SA2 consumer UI | We present the same data at SA2 granularity, anchored to a specific address, with trends and percentile positioning |
| **Trade Me** | Rental Price Index (asking rents, not actual rents), regional reports | We use actual agreed rents (bond data). Property-level, not just regional reports |
| **homes.co.nz** | Per-property RentEstimate, but derived from sale price × yield — not actual rental data | We use real government bond data with statistical backing (median, quartiles, sample sizes, confidence) |
| **realestate.co.nz** | Suburb-level asking rent medians, supply metrics | Not property-specific. No hazard/liveability integration. No "is my rent fair?" tool |
| **OneRoof** | AVM-powered value + rental estimates, opaque methodology | We focus specifically on rental fairness with transparent government data |
| **UnitHub** | Simple MBIE API calculator, median rents by location/type/beds | We integrate rental data with 27 other data layers (hazards, environment, liveability, planning) |

### International Platforms

| Platform | Key Lesson |
|----------|-----------|
| **Zillow Rent Zestimate** | ML-powered, 500+ data points per estimate. We can't replicate this (no MLS access). Our strength is transparent statistical comparison, not opaque ML. |
| **Redfin Rental Estimate** | Comp-based with full MLS access. We approximate with SA2 cohort statistics — honest about being aggregate. |
| **Rentometer** | Closest analog to what we're building. Simple: address + rent + beds → how does your rent compare? Our differentiator: hazard/liveability context + government bond data instead of listing scrapes. |
| **Domain.com.au** | AVM estimates known to be inaccurate for unique properties. Transparency about limitations builds trust. |

### Gap Analysis

| Capability | Tenancy Services | Trade Me | homes.co.nz | Rentometer | **WhareScore** |
|-----------|:---:|:---:|:---:|:---:|:---:|
| SA2-level rent data | API only | No | No | N/A | **Yes** |
| Property-specific comparison | No | No | Yes (estimated) | Yes | **Yes** |
| Real bond data (not asking rents) | Yes | No | No | No | **Yes** |
| Statistical distribution (LQ/UQ) | API only | No | Range | Yes | **Yes** |
| YoY + multi-year trend analysis | No | Report only | No | No | **Yes** |
| Confidence/sample size shown | No | No | No | Yes | **Yes** |
| Hazard + liveability integration | No | No | No | No | **Yes** |
| Risk score integration | No | No | No | No | **Yes** |
| Fallback cascade (SA2→TA→Region) | No | N/A | N/A | Radius | **Yes** |

**The gap we fill:** No NZ platform presents MBIE SA2-level bond data in a consumer-friendly, property-specific context with statistical transparency, trend analysis, AND integrated risk/liveability scoring.

---

## Implementation Priority

### Phase 1: MVP (bonds_detailed only — Sprint 1-2)
1. Download and load SA2 2018 boundaries into PostGIS
2. Create `mv_rental_market` materialized view (current stats + YoY)
3. Create `mv_rental_trends` materialized view (CAGR + acceleration)
4. Build `get_market_report()` PL/pgSQL function with fallback cascade
5. Implement `/api/v1/property/{address_id}/market` endpoint
6. Build Fair Price card frontend component (distribution strip + trend arrow)
7. Integrate with risk score engine: Market category (fairness 40%, trend 35%, heat 25%)

### Phase 2: Council Valuations + Rent Assessment
1. Build WCC valuation API client (with caching via `valuation_cache` table)
2. Implement CV + HPI adjustment logic with uncertainty bands
3. Add yield cross-validation and divergence flagging
4. Build rent assessment widget (user enters asking rent → percentile + label)
5. Add log-normal percentile estimation

### Phase 3: MBIE Live API + Enhanced Trends
1. Complete API key registration
2. Build MBIE Market Rent API client (6-month trailing window)
3. Merge live data with static bonds data (prefer fresher)
4. Add trend sparkline chart (8 quarters, rolling average, LQ/UQ band)
5. Add seasonal adjustment factors

### Phase 4: Multi-Council + Comps
1. Research Auckland Council API endpoint (DevTools)
2. Add CCC, Taranaki valuation clients
3. Build council-agnostic valuation abstraction
4. Neighbouring SA2 aggregation for thin-data areas
5. Census income data for rent-to-income affordability ratio (V2)

---

## Key References

### Data Sources
- **MBIE Market Rent**: https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/
- **MBIE API Portal**: https://portal.api.business.govt.nz/
- **MBIE vs Trade Me Rental Figures**: https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/difference-between-mbie-and-trade-me-rental-figures/
- **SA2 2018 Boundaries**: https://datafinder.stats.govt.nz/layer/92212-statistical-area-2-2018-generalised/
- **Geographic Areas File 2018**: https://datafinder.stats.govt.nz/table/104680-geographic-areas-file-2018/
- **Geographic Areas Table 2023**: https://datafinder.stats.govt.nz/table/111243-geographic-areas-table-2023/
- **RBNZ M10 Housing**: https://www.rbnz.govt.nz/statistics/series/economic-indicators/housing
- **NZ Treasury "What Drives Rents"**: https://www.treasury.govt.nz/publications/jp/what-drives-rents-new-zealand-national-and-regional-analysis
- **NZ Gross Rental Yields**: https://www.opespartners.co.nz/gross-yield
- **WCC Valuation API**: https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/Property/MapServer/0

### Competitive Platforms
- **Tenancy Services Market Rent**: https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/
- **Trade Me Rental Price Index**: https://www.trademe.co.nz/c/property/news/rental-price-index
- **homes.co.nz RentEstimate**: https://homes.co.nz/rentestimate
- **realestate.co.nz Market Insights**: https://www.realestate.co.nz/insights
- **OneRoof Property Estimates**: https://www.oneroof.co.nz/estimate/map/region_all-new-zealand-1
- **UnitHub Rent Estimate**: https://www.unithub.ai/tools/rent-estimate
- **finngreig/rentcheck** (open source, MBIE API): https://github.com/finngreig/rentcheck
- **Zillow Rent Zestimate**: https://www.zillow.com/rent/what-is-a-rent-zestimate/
- **Rentometer**: https://www.rentometer.com/
- **HUD Fair Market Rent**: https://www.huduser.gov/portal/datasets/fmr.html
