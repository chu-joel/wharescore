# Estimator Accuracy Audit — 2026-04-18

Audit of `backend/app/services/price_advisor.py` and `backend/app/services/rent_advisor.py`.
Goal: rank signals we could add/fix to improve rent and price estimate accuracy.
Reviewer: agent. Do-not-implement; this doc is the plan.

## 1. Current-signal audit

<!-- UPDATE: When a signal is added, removed, or reworked, add/edit a row. -->

### Price advisor (`price_advisor.py`)

| Signal | File:line | Strength (1-5) | Known issue |
|---|---|---|---|
| CV from `council_valuations` | `price_advisor.py:181-192` | 4 | `valuation_date` column not populated by loader (`data_loader.py:2980` INSERT omits it), so most councils fall back to `REVALUATION_DATES` dict which has only 7 entries |
| CV fallback to `wcc_rates_cache` | `price_advisor.py:202-208` via `rent_advisor._get_unit_cv_from_rates` | 3 | Only WCC — Auckland units with inaccurate spatial-match CVs never consult `auckland_rates_cache` |
| HPI adjustment (national) | `price_advisor.py:245-263` | 3 | National-only (`rbnz_housing`); Queenstown/rural diverge from national HPI considerably |
| Yield inversion | `price_advisor.py:266-271` | 3 | `YIELD_TABLE` has 6 cities + DEFAULT; no SA2/TA specificity; could derive empirically from bond×CV data we already have |
| Ensemble blend | `price_advisor.py:303-308` | 4 | HPI weight = `1 - cv_uncertainty`; when CV age unknown `unc=0.25` → HPI weight locked at 0.75, yield carries too little weight on stale CVs |
| Footprint size adj | `price_advisor.py:344-364` | 3 | Uses `building_outlines` ground footprint, not floor area; wrong for multi-storey; Auckland has `total_floor_area_sqm` but it's unused |
| ~~Improvements per room vs SA2 median~~ | Removed from `price_advisor.py` | — | **REMOVED**. Denominator-asymmetry bug (subject used actual beds+baths, SA2 median used hardcoded 3/4) made the ratio a size artefact, not a quality signal. imp_ratio (P0 #4) covers the same "above/below local norm" ground without the bug. |
| Finish tier (user input) | `price_advisor.py:428-442` | 3 | Self-reported; fine as-is |
| Bathrooms | `price_advisor.py:444-464` | 3 | Bedroom-aware lookup; fine |
| Parking (multi-unit only) | `price_advisor.py:467-482` | 2 | Binary; ok |
| Hazard cost flags (not % adj) | `price_advisor.py:509-568` | 3 | Correct approach (CVs already price hazards); `epb` uses count > 0, no self/nearby split like rent advisor does |
| Asking-price verdict | `price_advisor.py:592-605` | 4 | Fine |
| `cv_uncertainty` | `price_advisor.py:243` | 4 | Called; affects HPI weight only, not confidence stars |
| Confidence stars | `price_advisor.py:612` via `market_confidence_stars` | 3 | Needs CV age; since `valuation_date` is NULL for most councils, stars default to lower tier |

### Rent advisor (`rent_advisor.py`)

| Signal | File:line | Strength (1-5) | Known issue |
|---|---|---|---|
| SA2 bond median (`bonds_detailed`) | `rent_advisor.py:113-126` | 5 | `ORDER BY time_frame DESC LIMIT 1` picks latest quarter — correct |
| TLA fallback (`bonds_tla`) | `rent_advisor.py:136-149` | 4 | Triggered when SA2 bond_count < 5; blend logic (`blend_sa2_tla`) is fine |
| `log_std_dev_weekly_rent` (sigma) | `rent_advisor.py:167` | 4 | **Now consumed** — drives the inner-band pad (`rent_advisor.py:1238-1241`, clamped to [0.5%, 3%]) and feeds `estimate_percentile` to surface a `percentile` field in the return dict (`rent_advisor.py:1360-1363`). Falls back to ±1% when sigma missing. |
| Studio / 1-bed premium | `rent_advisor.py:698-721` | 3 | Hardcoded; fine |
| Townhouse/multi-unit discount | `rent_advisor.py:726-749` | 4 | Detects A/B/C addresses; good |
| Footprint size | `rent_advisor.py:753-773` | 3 | Same floor-area issue as price advisor |
| ~~Improvements per room vs SA2~~ | Removed from `rent_advisor.py` | — | **REMOVED**. Same denominator-asymmetry bug as price-advisor equivalent. Rent is less age-sensitive; no replacement signal added. (The parallel block in `snapshot_generator.py` was also removed — it drove the hosted-report pre-computed adjustments and had the same bug with `rooms = beds + 1`.) |
| Finish tier | `rent_advisor.py:852-865` | 3 | User input |
| Bathrooms | `rent_advisor.py:868-887` | 3 | Fine |
| Parking / insulation / furnished / outdoor / character / shared kitchen / utilities | `rent_advisor.py:892-1020` | 3 | User inputs, hardcoded % ranges |
| Hazards scaled by SA2 prevalence | `rent_advisor.py:1022-1095` | 4 | Good; `_prevalence_scale` thresholds 0.40/0.70 are untested |
| Location: transit, CBD, schools, park, rail | `rent_advisor.py:1099-1216` | 3 | CBD distance uses hardcoded `_CBD_COORDS` dict; school count unweighted by EQI |
| IQR guardrails | `rent_advisor.py:1237-1254` | 4 | Caps band to IQR, floors based on `factors_analysed / factors_available` — good |
| `cv_uncertainty` | — | 2 | `cv_uncertainty()` itself still not called in rent advisor, but `cv_age_months` is now computed (`rent_advisor.py:1328-1343`, with `REVALUATION_DATES` fallback for councils whose loader doesn't populate `valuation_date`) and passed into `market_confidence_stars` (`rent_advisor.py:1345`). Full `cv_uncertainty` integration (e.g. dampening quality-per-room adjustments on stale CVs) still pending. |
| `_detect_hazards` duplicates noise_db query | `rent_advisor.py:186-188` + `rent_advisor.py:410-413` | 2 | Perf, not accuracy |

### Shared / infrastructure

| Signal | File:line | Strength (1-5) | Known issue |
|---|---|---|---|
| `mv_sa2_comparisons` | `migrations/0048_sa2_comparisons_transit_noise.sql` | 3 | Columns: `avg_nzdep`, `school_count_1500m`, `transit_count_400m`, `max_noise_db`, `epb_count_300m`. No land_value, no median CV, no footprint median |
| `mv_sa2_valuations` | `migrations/0013_national_expansion_schema.sql:24` | 3 | Exposes `avg_cv`, `median_cv` per SA2 but no land_value split, no imp/room stats |
| `schools.eqi_index` | `migrations/0022_report_missing_layers.sql:610` | 3 | Nationally populated but both advisors only **count** schools within 1500m, not weight by EQI |
| `school_zones` | `migrations/0022_report_missing_layers.sql:616-619` | 2 | Zone-in flag available via report but not fed into price/rent |
| `auckland_rates_cache.total_floor_area_sqm` | `migrations/0015_auckland_rates_cache.sql` | 1 | Populated by Auckland rates loader; **completely unused** by both advisors |
| `auckland_rates_cache.building_coverage_pct` | same | 0 | Unused; could feed density/site-coverage signal |
| `wcc_rates_cache.valued_land_area` | `services/rates.py:79-99` | 0 | Unused |

## 2. Proposed additions

<!-- UPDATE: When a signal is proposed or implemented, add/edit a row. -->

| # | Signal | Data source (table/field) | Exists today? | Formula sketch | Expected accuracy gain | Effort (S/M/L) | Priority |
|---|---|---|---|---|---|---|---|
| 1 | CV valuation_date populated | `council_valuations.valuation_date` | Column exists, loader doesn't insert (`data_loader.py:2980`) | Per-council ArcGIS attribute mapping table; UPDATE populate from source API | High — unlocks real `cv_uncertainty`, real HPI weighting, real confidence stars for 25 councils | S per council × 25, M total | P0 |
| 2 | `cv_uncertainty` in rent advisor | `price_advisor:cv_uncertainty(cv_age_months)` | **IMPLEMENTED** `rent_advisor.py:1328-1345` | Stars wired: `cv_age_months` now computed (with `REVALUATION_DATES` fallback) and passed into `market_confidence_stars`. Band-centre dampening via `cv_uncertainty()` is now moot — the quality-per-room adjustment it would have dampened was deleted as structurally broken. | Med — mostly better confidence score, not shift in band centre | S | P0 — done |
| 3 | Sigma (`log_std_dev_weekly_rent`) → band width & verdict | `bonds_detailed.log_std_dev_weekly_rent` | **IMPLEMENTED** `rent_advisor.py:1238-1241, 1360-1375` | Inner band now uses `max(0.005, min(0.03, sigma × 0.5))`; falls back to 1% when sigma missing. `estimate_percentile` exposed as `percentile` in return dict. | Med — better-calibrated bands in thin and volatile SA2s | S | P0 — done |
| 4 | `improvements_value / capital_value` ratio as age/renovation proxy | `council_valuations.improvements_value`, `capital_value` | **IMPLEMENTED** `price_advisor.py:428-494` | `imp_ratio = imp / cv`; SA2 p25/p75 of same ratio via inline subquery (houses only — land_value > 0; units skipped because their ratio is degenerate). Prop ratio > SA2 p75 → `age_proxy: recent build/reno` +2% to +6%; < SA2 p25 → `age_proxy: older/unrenovated` -8% to -3%. Skipped entirely when `cv_age_months > 36`. Requires SA2 sample `n >= 20`. Not mirrored into `rent_advisor` — depends on QW1 (`cv_age_months` plumbing into rent advisor, P0 #2). | High — directly addresses user hypothesis 1; age is the missing #1 price driver | S-M (add SA2 subquery; optionally add col to `mv_sa2_valuations`) | P0 — done |
| 5 | Auckland floor area (replace footprint) | `auckland_rates_cache.total_floor_area_sqm` | Yes, populated | In `compute_price_advice`/`compute_rent_advice` size block: if council=Auckland and cache has `total_floor_area_sqm`, use that instead of `building_outlines` footprint. Fall back to footprint otherwise | Med-High for Auckland only (~33% of addresses) — fixes multi-storey under-sizing | S | P0 |
| 6 | School EQI weighting (replace count) | `schools.eqi_index` | Populated nationally | Use min(EQI) within 1500m as quality score. Adjustment: EQI ≤ 400 → +0.5% to +1.5%; EQI ≥ 520 → -0.5% to -1.5%. Keep count as secondary. For rent only | Med — schools materially move rent in family suburbs | S | P1 |
| 7 | School zones (in-zone premium) | `school_zones` + `schools.eqi_index` | Populated for ~all auck/wlg primary/secondary | If property is in-zone for school with EQI ≤ 400 → +1% to +3% rent, +1% to +4% price | Med — family-market-facing | S | P1 |
| 8 | EPB self vs nearby split in price advisor | `earthquake_prone_buildings` (5m/50m) | Already detected by rent advisor (`_detect_hazards`) | In price advisor uplift ranges: `epb_self` → (60, 200), `epb_nearby` → (5, 15). Current code doesn't distinguish | Low-Med — correctness fix | S | P1 |
| 9 | Land-value per m² vs SA2 median | `council_valuations.land_value` / land_area | `land_value` yes; land_area loaded only for Auckland+WCC | Where land_area exists, compute `land_value/land_area` and compare to SA2 median. Feeds "locational desirability" (user hypothesis 2) as price-only signal — rent already captured by bond medians | Med — better than hardcoded CBD dist for desirability | M (need land_area loaded for more councils) | P1 |
| 10 | SA2-specific typical footprint | Derived: `building_outlines` joined `sa2_boundaries` | No | New MV column `median_footprint_m2` in `mv_sa2_comparisons` per dwelling type. Replace `TYPICAL_FOOTPRINT` constants | Low — improves size adjustment in outlier SA2s only | M | P2 |
| 11 | Empirical SA2 yield table | `bonds_detailed` × `council_valuations` | Both exist | `median_weekly_rent × 52 / median_cv` per SA2 → replace `YIELD_TABLE` constants. Fallback to current table | Med for non-major-city SA2s where `DEFAULT` is wrong | M | P2 |
| 12 | Unit CV from `auckland_rates_cache` | `auckland_rates_cache` (has address + CV + floor area) | Table exists | Generalize `_get_unit_cv_from_rates` to try Auckland cache when `prop.council='auckland'` and unit_value set | Med for Auckland units only | S-M | P2 |
| 13 | Contamination count scaling | `contaminated_land` (count within 100m) | Already detected | Scale discount by count: 1-2 → current `(-1%, -2%)`; 3-5 → `(-2%, -4%)`; 5+ → `(-3%, -6%)` | Low | S | P2 |
| 14 | Confidence reduction on old CV in rent advisor | — | — | Already covered by P0 #2 | — | — | — |
| 15 | Recent sales (actual transactions) | `reinz_sales` | **NEW DATASET REQUIRED** — no sales table exists in any migration | Replace HPI adjustment with median comparable-sale price × distance-weighted kernel; also enables true backtest | Very High — is the gold-standard price signal | L (licensing + pipeline + schema) | P1 (data cost gate) |
| 16 | QV regional HPI (TA-level) | `qv_hpi_ta` | **NEW DATASET REQUIRED** | Per-TA HPI series; use `ta_name`-matched index instead of national in `price_advisor.py:245-263` | Med — fixes systematic bias in Queenstown, tourist towns, rural | L (QV licensing or scraper) | P2 |
| 17 | Healthy Homes compliance date | `healthy_homes_compliance` | **NEW DATASET REQUIRED** — no table | Rent adjustment: if non-compliant after 1 Jul 2025 → -3% to -6%; compliant-dated → baseline | Med — legal deadline passed; landlords pricing in | L (MBIE feed, if available; otherwise user input only) | P2 |
| 18 | Building consents (renovation signal) | `building_consents` per council | **NEW DATASET REQUIRED** per council | Consent > $50K in last 5 years → +1% to +4% price. Per-parcel join | Med | L (25 council feeds) | P3 |
| 19 | Year built / decade built | `council_valuations.year_built` | **NEW DATASET REQUIRED** — no council ArcGIS feed exposes it; QV/REINZ has it | Bucket: pre-1940 character (+2% to +6%), 1940-70 (-2% to -4% if low finish), 2000+ (+1% to +3%) | High — age is a first-class price driver | L (licensing) | P2 (after sales dataset) |
| 20 | Floor area for all councils | `council_valuations.floor_area` | **NEW DATASET REQUIRED** for 24 councils | Scrape or licence per council | High — fixes multi-storey sizing nationally | L | P3 |
| 21 | Prevalence threshold tuning | `_prevalence_scale` constants 0.40/0.70 | Code constants | Fit thresholds against sales-backtest residuals | Low-Med | S (after sales data lands) | P3 |

## 3. Quick wins (top 3)

### QW1 — Wire `cv_uncertainty` into rent advisor confidence (P0 #2)

**Location:** `backend/app/services/rent_advisor.py:1311`

**Current:**
```python
stars = market_confidence_stars(baseline["bond_count"], None, None)
```

**Change (5-line sketch):**
```python
cv_age_months = None
if prop and prop.get("capital_value"):
    val_date = prop.get("valuation_date") or _reval_date_for(sa2["ta_name"])
    if val_date:
        cv_age_months = (date.today() - val_date).days // 30
stars = market_confidence_stars(baseline["bond_count"], cv_age_months, None)
```

Requires pulling `valuation_date` into the `prop` SELECT at `rent_advisor.py:660-681` (add `cv.valuation_date`). No new tables. Also: depends on P0 #1 (valuation_date loader fix) actually populating the column — otherwise this falls back to the `REVALUATION_DATES` dict.

### QW2 — Use sigma for band width + percentile verdict (P0 #3)

**Location:** `backend/app/services/rent_advisor.py:1225-1227` (inner band) and anywhere we return the verdict.

**Current:**
```python
band_low = round(raw_median * min(product_low, product_high) * 0.99)
band_high = round(raw_median * max(product_low, product_high) * 1.01)
```

**Change (5-line sketch):**
```python
sigma = baseline.get("sigma") or 0.12
inner = max(0.005, min(0.03, sigma * 0.5))  # half-sigma, clamp 0.5-3%
band_low  = round(raw_median * min(product_low,  product_high) * (1 - inner))
band_high = round(raw_median * max(product_low,  product_high) * (1 + inner))
percentile = estimate_percentile(weekly_rent, raw_median, sigma) if weekly_rent else None
```

Expose `percentile` in return dict (new field). `estimate_percentile` already imported-ready in `market.py:46`.

### QW3 — Imp/CV ratio as age/renovation proxy (P0 #4)

**Location:** `backend/app/services/price_advisor.py` — add a new adjustment block after line 426 (quality-per-room block), before `finish_tier`.

**Change (5-line sketch):**
```python
if capital_value and improvements_value and capital_value > 0:
    imp_ratio = improvements_value / capital_value
    # SA2 p25/p50/p75 of imp_ratio for same dwelling class
    sa2_row = await conn.execute(SA2_IMP_RATIO_PCTILES_SQL, [sa2["sa2_code"]]).fetchone()
    if sa2_row and imp_ratio > (sa2_row["p75"] or 99):
        adjustments.append({"factor":"age_proxy","label":"Likely recent build/reno",
            "pct_low":2.0,"pct_high":6.0, ...})  # or -3 to -8 if below p25
```

`SA2_IMP_RATIO_PCTILES_SQL`: single query over `council_valuations` filtered to same SA2 and dwelling class, `percentile_cont(0.25|0.5|0.75)`. Consider adding these as columns to `mv_sa2_valuations` (M effort) if perf matters. Confidence penalty: skip/weaken this signal when `cv_age_months > 36` because SA2 ratios are then stale for different revaluation cycles.

## 4. Validation plan

<!-- UPDATE: When a validation approach is implemented, add a row. -->

| Step | Method | Blocker |
|---|---|---|
| 1. Rent held-out | Hold out 20% of `bonds_detailed` rows per SA2; recompute estimator against same (SA2, bedrooms, dwelling_type); measure MAPE and within-band rate | None — data already present |
| 2. Rent before/after | For each proposed change, run on ~1000 addresses across 5 cities; compute band centre shift, band width change, % of current "fair" verdicts that flip | None — can run in-process |
| 3. Price backtest | **Blocked** — no sales data. Would need `reinz_sales` (P1 #15). Without it, proxy via: compare estimate to CV at addresses whose CV was just refreshed (new valuation cycles). Systematic bias by improvement-ratio bucket = signal | Need recent-reval addresses cohort; list current councils with 2024+ reval cycles (see `REVALUATION_DATES`) |
| 4. Price residual vs age proxy | Check whether imp/CV ratio correlates with CV–mid-band residual after proposed adjustment applied | Depends on step 3 |
| 5. Sigma calibration | For a sample of bond rows with known sigma, check whether 50% of rents fall inside ±0.5σ (sanity check on log-normal assumption) | None |
| 6. Auckland floor-area win | Compare estimate vs CV for 500 Auckland properties with `total_floor_area_sqm` populated, before and after signal — measure MAPE delta | None |
| 7. EQI-weighted schools | Correlate residuals (bond median – SA2 fit) with min-EQI-within-1.5km; if |r| > 0.1 signal worth keeping | None |
| 8. Land-value/m² signal | Only verifiable for Auckland (`auckland_rates_cache`), WCC (`wcc_rates_cache`) in current state. Propose blocking P1 #9 rollout until at least 10 councils carry `land_area` | Land area coverage |
| 9. Long-term: tracking error | Once QW1-3 deployed, log estimate + mid-band for every generated report; when user provides actual rent (via `rent_reports`), compute rolling MAPE | Already have `rent_reports` router |

## Notes / known data gaps

- `council_valuations` loader (`data_loader.py:2925-2993`) does **not** store `valuation_date`, `land_area`, `floor_area`, `year_built`, or dwelling-type classification. These fields exist in most councils' ArcGIS feeds but are not mapped in `_load_rates`.
- No sales data (`reinz_sales`, `property_sales` — all **MISSING**). Biggest single gap for price accuracy and backtest.
- `healthy_homes_compliance`, `building_consents`, `year_built` — all **MISSING** tables.
- `schools.eqi_index` and `school_zones` exist but are under-used (count-only in advisors).
- Auckland ratescache carries `total_floor_area_sqm` and `building_coverage_pct` — both unused.
- HPI is national (`rbnz_housing`, `hpi_national`); no regional breakdown loaded.
