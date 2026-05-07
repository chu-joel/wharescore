# Indicator Wording: Environment

Slice owner: Environment category of `_INVENTORY.md` (23 indicators, rows at `_INVENTORY.md:164-186`). One Meaning block + Wording table per indicator. Wording polished for the 6 surfaces × 3 personas grid.

Conventions:
- "report SQL" = `backend/migrations/0054_flood_nearest_m.sql` `get_property_report()`.
- "snapshot" = `backend/app/services/snapshot_generator.py generate_snapshot()`.
- "finding rules" = `backend/app/services/report_html.py` `build_humanized_*` builders.
- Renter register grade ~2 (lived experience, cost). Buyer ~3 (decision, dollars). Pro ~4 (source, vintage, dataset).
- NZ English. Show, don't classify. Name the comparator.
- Em-dash separators avoided. Placeholder `N/A` or `(no rule)` or `(out of scope: <reason>)` replaces literal `,`.

## Changes in this pass

| Date | Change |
|---|---|
| 2026-05-02 | Verified all DataSource line refs against current `data_loader.py`. Corrected stale refs: `load_nzta_noise_contours` 3703 to 3923, DataSource `climate_normals` 4666 to 4886, GWRC `contaminated_land` 4724 to 4944, `corrosion_zones` 4769 to 4989, `rail_vibration` 4789 to 5009. NZTA DataSource registered at 7143. |
| 2026-05-02 | Corrected slice count 22 to 23 (matches `_INVENTORY.md:164-186`). |
| 2026-05-02 | Re-confirmed every `report_html.py` source_key reference (lines 1706, 1713, 1733, 1750, 1789, 1797, 1805, 1819). All live. Confirmed `climate_precip_change_pct` line 2219 still carries no `_src(...)` (blended into flood rec) and `in_rail_vibration_area` at 2336 carries no `_src(...)` (blended into noise stack). |
| 2026-05-02 | Re-confirmed risk_score weights at `risk_score.py:265-267` (noise 0.30, air_quality 0.25, water_quality 0.20, climate 0.15, contaminated_land 0.10) and indicator wiring at lines 693-700. |
| 2026-05-02 | Re-confirmed frontend rendering: env.air_*/water_*/contam_*/in_corrosion_zone consumed by `HostedNeighbourhoodStats.tsx:69-134` (NOT `HostedClimate.tsx`). `HostedClimate.tsx:25` consumes only `snapshot.climate_normals`. `HostedAtAGlance.tsx:51` consumes `env.road_noise_db`. ClimateForecastCard at `RiskHazardsSection.tsx:127` consumes `climate_temp_change` + `climate_precip_change_pct`. |
| 2026-05-02 | Audit pass. Applied `_AUDIT-environment.md` fixes: corrected stale "UNKNOWN frontend" / "HostedClimate.tsx" Rendered-by entries on indicators #3, #4, #5, #9, #11 to cite `HostedNeighbourhoodStats.tsx:80-89`. Corrected #5 (`air_pm25_trend`) score-contribution claim. `risk_score.py:694` reads only `air_pm10_trend`; pm25 is a finding-text fallback only, not a scoring fallback. Replaced #7 (`water_site_name`) UNKNOWN loader with `scripts/load_tier3_datasets.py:168` (CREATE) and `:194` (INSERT). Corrected #15 (`climate_precip_change_pct`) threshold from UNKNOWN to bidirectional ±5% per `report_html.py:2228-2243`; sharpened source_key TODO; added drying-branch counterpart sentence to HF narratives. Updated inventory-conflict note (inventory now corrected to 23). Re-grounded HF narratives on indicators that read from HostedNeighbourhoodStats now that the rendering surface is verified. |
| 2026-05-02 | Tone polish pass. Removed all em-dash separators from wording cells (commas, colons, parens, full stops instead). Replaced `,` placeholders with `N/A`, `(no rule)`, or `(out of scope: …)`. Replaced "substantial" with plain wording on coverage line for #8. Added `User-care severity:` line to every Meaning block, calibrated per persona register. Refreshed bottom audit. Critical-tier indicators with no finding rule of their own: contam_nearest_name (#17) is composed via parent finding text only; contam_nearest_category (#18) and contam_nearest_distance_m (#19) drive the parent finding directly. No critical-tier indicator is silent. |
| 2026-05-02 | Editorial pass. Length: collapsed two-sentence on-screen findings to single sentences on #14 (climate ΔT buyer), #21 (corrosion buyer), #22 (rail vibration buyer). Stripped "etc." from #8 hosted-full buyer narrative (replaced with direct campylobacter reference) per doc-writing rule 5. Fixed factual slip in #16 buyer hosted-full ("Decade-of-records" → "30-year baseline", Climate Normals are 1991-2020). No tier reclassifications: existing tiers (3 Critical contam, 8 Notable, 2 Context, 10 Background) hold up to the environment-tier definition. No out-of-scope conversions needed: every persona-irrelevant cell already carries `(out of scope: <reason>)`. No em-dashes found inside wording cells (only structural `On-screen, label` column headers, which are framing not separators). |

---

## 1. environment.road_noise_db (→ noise_db)

### environment.road_noise_db (`environment.road_noise_db`)
- What it measures: Maximum modelled 24-hour LAeq road traffic noise (dBA) at the property polygon, taken from NZTA Waka Kotahi's national road noise contours.
- Source authority: NZ Transport Agency Waka Kotahi (NZTA).
- Dataset / endpoint: NZTA National Road Noise Contours. DataSource `nzta_noise_contours` (`backend/app/services/data_loader.py:7143`); load function `load_nzta_noise_contours()` at `data_loader.py:3923`.
- DataSource key(s): `nzta_noise_contours`.
- Table(s): `noise_contours` (column `laeq24h`).
- Query path: SQL `MAX(laeq24h) FROM noise_contours WHERE ST_Intersects(geom, addr.geom)` (`0054_flood_nearest_m.sql:524-526`).
- Rendered by: `backend/app/services/report_html.py:1687` (Insight rules), `frontend/src/components/report/HostedRoadNoise.tsx` (full hosted), `frontend/src/components/report/HostedAtAGlance.tsx:51` (hosted quick at-a-glance).
- Threshold / classification logic: `report_html.py:1697` >=65 dB warn, >=55 dB info, <45 dB ok. Risk score `normalize_min_max(road_noise_db, 40, 75)` at `risk_score.py:693`.
- Score contribution: indicator `noise`, weight 0.30 of WEIGHTS_ENVIRONMENT (`risk_score.py:266`).
- Coverage: National. Every city in the coverage matrix marked Y for `noise_db (road)` (`docs/WIRING-TRACES.md:197`). State highways and major roads only.
- Common misreading: dBA is logarithmic, not linear. 65 dB is twice as loud as 55 dB. Layperson reads "65" as small.
- What it does NOT tell you: Aircraft, rail or industrial noise (separate fields). Modelled, not measured. Indoor levels with closed double-glazing typically 20-25 dB lower.
- source_key status: present (`_src("nzta_noise")` at `report_html.py:1706,1713`).
- User-care severity: Notable. Affects sleep, conversation and glazing spec; rarely changes a buy/rent decision on its own but feeds renovation budgets.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Road noise outside | Road traffic noise (LAeq24h) | Road noise (NZTA Laeq24h) |
| On-screen, finding | Modelled 65 dB outside, about as loud as a busy restaurant; you'll hear it indoors with single glazing. | 65 dB modelled outside; double glazing typically lands you about 20 dB quieter inside. | NZTA noise contour 65 dBA Laeq24h at parcel; exceeds WHO 53 dB outdoor residential guideline. |
| Hosted Quick, label | Outside noise level | Road noise outside | Modelled road noise (Laeq24h) |
| Hosted Quick, narrative | Modelled 65 dB outside. Windows-open conversation will be hard. | Modelled 65 dB outside; affects glazing spec and resale. | NZTA Laeq24h 65 dBA, modelled at parcel. WHO outdoor residential guideline is 53 dB. |
| Hosted Full, label | Outside road noise | Road noise level | Road noise (NZTA Laeq24h contour) |
| Hosted Full, narrative + tech | Modelled 65 dB outside, about as loud as a busy restaurant. Shut the bedroom window facing the road and check whether trucks run overnight. | Modelled 65 dB outside; double glazing plus sealed mechanical ventilation are the proven mitigations and should be priced into any reno budget. | NZTA national road noise contour; LAeq24h modelled, parcel-intersect MAX. Ground-floor exterior facade level; does not capture facade reflections, terrain shadow, or rail/aircraft. Source: NZTA noise contours, vintage per `data_source_health`. |

---

## 2. road_noise (snapshot detail)

### road_noise (`road_noise`)
- What it measures: Snapshot detail object for hosted-full road noise rendering. Typically the same `road_noise_db` value plus any nearest-road metadata included by snapshot generator at write time.
- Source authority: NZTA Waka Kotahi.
- Dataset / endpoint: Same as #1 (NZTA noise contours).
- DataSource key(s): `nzta_noise_contours`.
- Table(s): `noise_contours`.
- Query path: `snapshot_generator.py:937` packs the report's environment block into `snapshot.road_noise` for the hosted page.
- Rendered by: `frontend/src/components/report/HostedRoadNoise.tsx`.
- Threshold / classification logic: N/A. Not separately classified; same dB used by HostedRoadNoise as #1.
- Score contribution: N/A (does not feed risk score independently of `road_noise_db`).
- Coverage: National (same as #1).
- Common misreading: User assumes a separate measurement; it is the same NZTA contour.
- What it does NOT tell you: Same limits as #1.
- source_key status: N/A (snapshot blob; finding source attached to #1).
- User-care severity: Background. Duplicate of #1 packaged for hosted rendering; not decision-relevant on its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: snapshot-only field) | (out of scope: snapshot-only field) | (out of scope: snapshot-only field) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Outside noise detail | Road noise breakdown | Road noise detail (NZTA contour) |
| Hosted Full, narrative + tech | Same number as the at-a-glance figure, with a bit more context. | Detail panel for the road noise number, useful when comparing two homes a few streets apart. | NZTA Laeq24h contour intersecting parcel; passed through unchanged from `report.environment.road_noise_db`. |

---

## 3. environment.air_site_name

### environment.air_site_name (`environment.air_site_name`)
- What it measures: Name of the nearest LAWA air-quality monitoring station to the property.
- Source authority: LAWA (Land Air Water Aotearoa). Regional council monitoring network aggregated by LAWA.
- Dataset / endpoint: `data/air-quality/lawa-air-quality-2016-2024.xlsx` (LAWA Annual Air Quality data) loaded by `scripts/load_tier3_datasets.py:35`.
- DataSource key(s): `lawa_air_quality` (per `docs/DATA-PROVENANCE.md:154`; not a registered DataSource, bulk-loaded by script).
- Table(s): `air_quality_sites`.
- Query path: `0054_flood_nearest_m.sql:528-530` LATERAL nearest-neighbour on `air_quality_sites`.
- Rendered by: `backend/app/services/report_html.py:1722-1734` (in air-trend finding); `frontend/src/components/report/HostedNeighbourhoodStats.tsx:80` (`const airSite = env.air_site_name`).
- Threshold / classification logic: N/A (label only).
- Score contribution: N/A (label only).
- Coverage: About 80 national sites (DATA-PROVENANCE). Coverage radius reaches every populated city, but distance can be tens of km.
- Common misreading: User assumes a reading at the property; it is the nearest monitoring site, often kilometres away.
- What it does NOT tell you: Indoor air quality, distance to the site, whether the site type matches the local context (urban, peak, industrial).
- source_key status: present via `_src("lawa_air")` on the parent finding (`report_html.py:1733`).
- User-care severity: Background. Label only; relevance carried by the trend reading it sits beside.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not rendered standalone) | (out of scope) | (out of scope) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Nearest air monitor | Nearest LAWA air station | LAWA air station (nearest) |
| Hosted Full, narrative + tech | The nearest station the trend below comes from. | Reading is from this station, not the property. Useful as a regional benchmark. | LAWA air-quality monitoring site; nearest-neighbour by `geom <-> addr.geom`. Vintage 2024 trend window per LAWA Annual Air Quality dataset. |

---

## 4. environment.air_pm10_trend

### environment.air_pm10_trend (`environment.air_pm10_trend`)
- What it measures: LAWA-published 10-year PM10 trend categorisation at the nearest monitoring site (Improving / Indeterminate / Degrading / Not available).
- Source authority: LAWA, methodology per LAWA Air Quality.
- Dataset / endpoint: LAWA Annual Air Quality 2016-2024 (same source as #3).
- DataSource key(s): `lawa_air_quality`.
- Table(s): `air_quality_sites` (column `pm10_trend`).
- Query path: `0054_flood_nearest_m.sql:528` returned by nearest-site LATERAL.
- Rendered by: `report_html.py:1722-1734` (warn finding when "Degrading"); `frontend/src/components/report/HostedNeighbourhoodStats.tsx:81` (`const airPm10 = env.air_pm10_trend`).
- Threshold / classification logic: `risk_score.py:204-210` `SEVERITY_AIR_QUALITY` Improving=10, Indeterminate=30, Degrading=70.
- Score contribution: indicator `air_quality`, weight 0.25 (`risk_score.py:266`).
- Coverage: About 80 sites nationally; nearest-site model means signal weakens with distance (no distance threshold cut-off in SQL).
- Common misreading: Treating "Degrading" as bad current air; it is a trend over years and the absolute level may still be acceptable. Also: PM10 is not PM2.5 (different particle sizes, different health implications).
- What it does NOT tell you: Absolute PM10 concentration, exceedances of NES-AQ thresholds, indoor exposure, or whether the trend is local vs regional.
- source_key status: present via `_src("lawa_air")` (`report_html.py:1733`).
- User-care severity: Notable. A worsening trend points to wood-smoke or traffic build-up that may shape filtration and heating choices.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Air pollution trend | PM10 trend (10-yr) | PM10 trend (LAWA) |
| On-screen, finding | Dust pollution at the nearest monitor has been getting worse over the last decade. | LAWA flags PM10 as degrading at the nearest station; check wood-burner density and any nearby industry. | LAWA `pm10_trend = Degrading` at nearest site (LAWA 10-yr Mann-Kendall); regional, not parcel-specific. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | PM10 dust trend | PM10 trend (10-year) | PM10 trend (LAWA 10-yr) |
| Hosted Full, narrative + tech | Tiny dust particles have been getting worse at the nearest monitor. Winter wood smoke is the usual culprit. | LAWA 10-yr PM10 trend at nearest site is Degrading; indoor HEPA filtration and a good chimney choice for any wood-burner help. | LAWA Annual Air Quality 2016-2024, PM10 Mann-Kendall trend at nearest site (often >1 km away). Coverage about 80 sites; signal is regional, not parcel. |

---

## 5. environment.air_pm25_trend

### environment.air_pm25_trend (`environment.air_pm25_trend`)
- What it measures: LAWA 10-year PM2.5 trend categorisation at the nearest air monitoring site.
- Source authority: LAWA.
- Dataset / endpoint: Same as #4.
- DataSource key(s): `lawa_air_quality`.
- Table(s): `air_quality_sites` (column `pm25_trend`).
- Query path: `0054_flood_nearest_m.sql:528`.
- Rendered by: `report_html.py:1722` (used as finding-text fallback when `pm10_trend` is null in the same finding rule); `frontend/src/components/report/HostedNeighbourhoodStats.tsx:82` (`const airPm25 = env.air_pm25_trend`).
- Threshold / classification logic: Same `SEVERITY_AIR_QUALITY` map as #4 governs the finding-text branch only.
- Score contribution: N/A (no direct contribution; surfaced in finding text only). `risk_score.py:694` only reads `air_pm10_trend` for the `air_quality` indicator. PM2.5 is NOT a scoring fallback. The fallback chain is finding-text-only inside `report_html.py:1722`.
- Coverage: PM2.5 monitoring is sparser than PM10. PM2.5 was only routinely added at LAWA sites in recent years. UNKNOWN, exact site count for PM2.5 not stated in code.
- Common misreading: PM2.5 and PM10 are not interchangeable. PM2.5 is the smaller, more health-significant fraction (penetrates deeper into lungs).
- What it does NOT tell you: Absolute PM2.5, WHO 2021 PM2.5 annual mean of 5 µg/m³, indoor exposure, whether the trend is from wood-burning vs traffic vs industry.
- source_key status: present via `_src("lawa_air")` (shared finding).
- User-care severity: Notable. PM2.5 is the health-relevant fraction; a worsening trend feeds filtration choices and asthma planning.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Fine smoke trend | PM2.5 trend (10-yr) | PM2.5 trend (LAWA) |
| On-screen, finding | Fine smoke particles have been getting worse at the nearest monitor, usually winter fires. | LAWA flags PM2.5 as degrading at the nearest station; PM2.5 is the size that matters most for health. | LAWA `pm25_trend = Degrading`; nearest-site only, no parcel-level PM2.5. WHO 2021 annual guideline is 5 µg/m³. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Fine smoke (PM2.5) trend | PM2.5 trend (10-year) | PM2.5 trend (LAWA 10-yr) |
| Hosted Full, narrative + tech | Fine smoke is the stuff that gets deepest into your lungs. The trend nearby is heading the wrong way. | PM2.5 is the most health-relevant fraction; a degrading trend nearby justifies HEPA filtration in main living areas. | LAWA Annual Air Quality 10-yr PM2.5 trend, nearest site. PM2.5 monitoring sparser than PM10; site may be tens of km away. WHO 2021 annual mean 5 µg/m³. |

---

## 6. environment.air_distance_m

### environment.air_distance_m (`environment.air_distance_m`)
- What it measures: Straight-line distance in metres from the property to the nearest LAWA air-quality monitoring site.
- Source authority: LAWA.
- Dataset / endpoint: Same as #3.
- DataSource key(s): `lawa_air_quality`.
- Table(s): `air_quality_sites`.
- Query path: `0054_flood_nearest_m.sql:529` `ST_Distance(geom::geography, addr.geom::geography)`.
- Rendered by: `report_html.py:1724,1728` (formatted `dist_km` inside the air-trend finding).
- Threshold / classification logic: N/A (raw metres).
- Score contribution: N/A (informational only).
- Coverage: National. Every property gets a value, but the distance can be very large where the network is sparse.
- Common misreading: Small number means relevant reading; large number, quietly ignore. The reading is regional whatever the distance, but the further away, the weaker the parcel relevance.
- What it does NOT tell you: Whether the site is upwind or downwind, whether it sits on a major road, whether the site type matches your context.
- source_key status: present via parent finding `_src("lawa_air")`.
- User-care severity: Background. Caveat for the trend reading; not decision-changing alone.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Distance to air monitor | Air monitor distance | LAWA air site distance (m) |
| On-screen, finding | (no standalone rule; surfaced inside the air trend line) | (same) | (same) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Air monitor: how far | Distance to nearest air station | Distance to LAWA air site |
| Hosted Full, narrative + tech | The nearest air monitor is X km away. Closer means the reading is more relevant to you. | Reading is X km away. Useful as a regional indicator, not a parcel measurement. | Straight-line geodesic distance to nearest `air_quality_sites` row; metres. No upwind/downwind weighting. |

---

## 7. environment.water_site_name

### environment.water_site_name (`environment.water_site_name`)
- What it measures: Name of the nearest LAWA freshwater (river/stream/lake) monitoring site to the property.
- Source authority: LAWA.
- Dataset / endpoint: LAWA Water Quality monitoring sites; bulk-loaded by `scripts/load_tier3_datasets.py:168` (CREATE TABLE `water_quality_sites`) and `:194` (INSERT). Not a registered DataSource.
- DataSource key(s): `lawa_water_quality` (per `docs/DATA-PROVENANCE.md:157`).
- Table(s): `water_quality_sites`.
- Query path: `0054_flood_nearest_m.sql:533-535`.
- Rendered by: `report_html.py:1738` (formatted into water-band finding text); `frontend/src/components/report/HostedNeighbourhoodStats.tsx:87` (`const waterSite = env.water_site_name`).
- Threshold / classification logic: N/A (label only).
- Score contribution: N/A (label only).
- Coverage: About 300 national sites (DATA-PROVENANCE). All cities effectively reach a site, but distance varies.
- Common misreading: Reader assumes the named river is the property's drinking water. LAWA freshwater sites are recreational/ecological, not drinking-water network.
- What it does NOT tell you: Drinking-water quality (separate Taumata Arowai dataset, not loaded), bore water on the property, marine/beach swim quality (separate dataset).
- source_key status: present via `_src("lawa_water")` on the parent finding.
- User-care severity: Background. Label only; supports the band reading.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Nearest river/stream | Nearest LAWA water site | LAWA freshwater site (nearest) |
| On-screen, finding | (surfaced inside water-band finding when band is D/E) | (same) | (same) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Nearest waterway monitor | Nearest LAWA freshwater site | LAWA freshwater site (nearest) |
| Hosted Full, narrative + tech | Where the water-quality reading below comes from. | Bands are read off this site; it indicates the local catchment, not your tap. | LAWA freshwater monitoring site (river/stream/lake); nearest-neighbour. Not drinking water; not coastal swim spots. |

---

## 8. environment.water_ecoli_band

### environment.water_ecoli_band (`environment.water_ecoli_band`)
- What it measures: NPS-FM 5-class band (A best, E worst) for E. coli at the nearest LAWA freshwater monitoring site, indicating swimmability/recreational risk.
- Source authority: LAWA, methodology per Ministry for the Environment NPS-FM.
- Dataset / endpoint: LAWA Water Quality (per-attribute bands).
- DataSource key(s): `lawa_water_quality`.
- Table(s): `water_quality_sites` (column `ecoli_band`).
- Query path: `0054_flood_nearest_m.sql:533-535`.
- Rendered by: `report_html.py:1736-1751` warn finding when band is D or E. NOT consumed in `HostedNeighbourhoodStats.tsx` directly (only `_drp_band` and `_ammonia_band` are read on hosted-full at lines 88-89); the band reaches the user only when the D/E rule fires inside the water-quality finding.
- Threshold / classification logic: `report_html.py:1737` triggers when band is D or E. Risk score `SEVERITY_WATER_BAND` A=5 / B=20 / C=40 / D=65 / E=85 (`risk_score.py:212`); `worst_water_band()` uses worst across all 5 attribute bands (`risk_score.py:215-227`).
- Score contribution: indicator `water_quality`, weight 0.20 (`risk_score.py:266`); contributes the worst band across all 5 water columns.
- Coverage: About 300 sites nationally; effectively every populated area has a site within reach, but distance can be large.
- Common misreading: Assuming this is drinking water (it is not; it is the nearest river/stream's faecal indicator). Confusing E.coli (faecal) with E (the worst band letter).
- What it does NOT tell you: Drinking water (Taumata Arowai), bore quality, beach swim safety, your reticulated supply.
- source_key status: present via `_src("lawa_water")` (`report_html.py:1750`).
- User-care severity: Notable. Recreational-swim signal; meaningful for households who use the nearby river but not a buy/rent dealbreaker.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Nearby river: E.coli | Freshwater E.coli band (NPS-FM) | LAWA E.coli band (NPS-FM) |
| On-screen, finding | The nearest river is rated D for E.coli, usually too contaminated to swim in. | Nearest freshwater monitor rated D for E.coli (NPS-FM); swim risk, not your tap water. | LAWA E.coli band D at nearest site (NPS-FM 5-band scale, A best to E worst); freshwater not drinking-water. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Local stream: swim safety | Freshwater E.coli (NPS-FM A-E) | LAWA E.coli band (NPS-FM) |
| Hosted Full, narrative + tech | If you swim in this stream, the bug count is regularly above the safe-to-swim threshold. | Band D/E means modelled campylobacter risk exceeds NPS-FM "primary contact" thresholds at the nearest river; separate from your reticulated tap supply. | NPS-FM National Objectives Framework E.coli band; worst-of-five attribute drives risk score. Source: LAWA freshwater monitoring; vintage per LAWA annual cycle. |

---

## 9. environment.water_ammonia_band

### environment.water_ammonia_band (`environment.water_ammonia_band`)
- What it measures: NPS-FM band A-E for total ammoniacal-nitrogen (toxicity attribute) at nearest LAWA freshwater site.
- Source authority: LAWA / MfE NPS-FM.
- Dataset / endpoint: LAWA Water Quality.
- DataSource key(s): `lawa_water_quality`.
- Table(s): `water_quality_sites` (column `ammonia_band`).
- Query path: `0054_flood_nearest_m.sql:533`.
- Rendered by: No dedicated finding rule (only contributes to `worst_water_band` scoring); `frontend/src/components/report/HostedNeighbourhoodStats.tsx:89` (`const waterAmmonia = env.water_ammonia_band`).
- Threshold / classification logic: `worst_water_band()` (`risk_score.py:220`).
- Score contribution: indicator `water_quality`, contributes via worst band across 5 attributes.
- Coverage: About 300 sites; varies by attribute coverage at each site (UNKNOWN, site-by-site availability).
- Common misreading: This is an ecosystem-toxicity attribute (fish), not a direct human health metric. Layperson reads "ammonia" as cleaning-product smell.
- What it does NOT tell you: Human drinking water safety. Site-specific bore water.
- source_key status: TODO. No dedicated finding line, but parent `worst_water_band` finding inherits `_src("lawa_water")` if any band fires the D/E rule.
- User-care severity: Background. Ecological proxy for fish toxicity, not a household decision input.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: no standalone finding) | (out of scope) | (out of scope) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | (out of scope: ecological proxy, not a household input) | (out of scope: ecological proxy) | NPS-FM ammoniacal-N band (LAWA) |
| Hosted Full, narrative + tech | (no rule) | (no rule) | NPS-FM total ammoniacal-N attribute band at nearest LAWA site; toxicity attribute. Feeds composite `worst_water_band()`. |

---

## 10. environment.water_nitrate_band

### environment.water_nitrate_band (`environment.water_nitrate_band`)
- What it measures: NPS-FM band A-E for nitrate-nitrogen toxicity at nearest LAWA freshwater site.
- Source authority: LAWA / MfE NPS-FM.
- Dataset / endpoint: LAWA Water Quality.
- DataSource key(s): `lawa_water_quality`.
- Table(s): `water_quality_sites` (column `nitrate_band`).
- Query path: `0054_flood_nearest_m.sql:533`.
- Rendered by: No dedicated finding rule; not consumed by any frontend component (verified, `HostedNeighbourhoodStats.tsx` reads only `_drp_band` and `_ammonia_band`). Contributes to scoring only; never surfaced to the user as text.
- Threshold / classification logic: `worst_water_band()` (`risk_score.py:221`).
- Score contribution: indicator `water_quality`, via worst-band aggregation.
- Coverage: About 300 sites; nitrate trends matter most in dairy catchments.
- Common misreading: Conflating with drinking-water nitrate MAV (11.3 mg/L NO3-N). This is the NPS-FM ecological band, different scale, different purpose.
- What it does NOT tell you: Whether bore water is safe to drink. Whether the property's drinking supply is treated.
- source_key status: TODO. No dedicated finding line.
- User-care severity: Background. Scoring-only; never shown to the user as text.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: no standalone finding) | (out of scope) | (out of scope) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | (out of scope: not consumed by any frontend component; scoring-only) | (out of scope) | (out of scope: feeds `worst_water_band()` only) |
| Hosted Full, narrative + tech | (no rule) | (no rule) | (no rule) |

---

## 11. environment.water_drp_band

### environment.water_drp_band (`environment.water_drp_band`)
- What it measures: NPS-FM band A-E for dissolved reactive phosphorus at nearest LAWA freshwater site.
- Source authority: LAWA / MfE NPS-FM.
- Dataset / endpoint: LAWA Water Quality.
- DataSource key(s): `lawa_water_quality`.
- Table(s): `water_quality_sites` (column `drp_band`).
- Query path: `0054_flood_nearest_m.sql:533`.
- Rendered by: No dedicated finding rule; `frontend/src/components/report/HostedNeighbourhoodStats.tsx:88` (`const waterDrp = env.water_drp_band`).
- Threshold / classification logic: `worst_water_band()` (`risk_score.py:222`).
- Score contribution: indicator `water_quality`, via worst-band aggregation.
- Coverage: About 300 sites.
- Common misreading: "DRP" is opaque; a layperson cannot decode it without a gloss.
- What it does NOT tell you: Whether algal blooms occur on this water body in summer (related but separate metric).
- source_key status: TODO. No dedicated finding.
- User-care severity: Background. Algal-bloom proxy; not a household decision input.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: no standalone finding) | (out of scope) | (out of scope) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | (out of scope: ecological proxy, not a household input) | (out of scope: ecological proxy) | NPS-FM DRP band (LAWA) |
| Hosted Full, narrative + tech | (no rule) | (no rule) | NPS-FM dissolved reactive phosphorus attribute band at nearest LAWA site. Source: LAWA freshwater. |

---

## 12. environment.water_clarity_band

### environment.water_clarity_band (`environment.water_clarity_band`)
- What it measures: NPS-FM band A-E for water clarity (visual clarity / Secchi-style) at nearest LAWA freshwater site.
- Source authority: LAWA / MfE NPS-FM.
- Dataset / endpoint: LAWA Water Quality.
- DataSource key(s): `lawa_water_quality`.
- Table(s): `water_quality_sites` (column `clarity_band`).
- Query path: `0054_flood_nearest_m.sql:533`.
- Rendered by: No dedicated finding rule; not consumed by any frontend component (verified, `HostedNeighbourhoodStats.tsx` reads only `_drp_band` and `_ammonia_band`). Contributes to scoring only; never surfaced to the user as text.
- Threshold / classification logic: `worst_water_band()` (`risk_score.py:223`).
- Score contribution: indicator `water_quality`, via worst-band aggregation.
- Coverage: About 300 sites.
- Common misreading: User confuses clarity with cleanliness. Turbid water is not necessarily contaminated, and clear water can still have nitrate or E.coli issues.
- What it does NOT tell you: Microbial safety, chemical contamination.
- source_key status: TODO. No dedicated finding.
- User-care severity: Background. Scoring-only; never shown to the user.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: no standalone finding) | (out of scope) | (out of scope) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | (out of scope: not consumed by any frontend component; scoring-only) | (out of scope) | (out of scope: feeds `worst_water_band()` only) |
| Hosted Full, narrative + tech | (no rule) | (no rule) | (no rule) |

---

## 13. environment.water_distance_m

### environment.water_distance_m (`environment.water_distance_m`)
- What it measures: Straight-line distance in metres from the property to the nearest LAWA freshwater monitoring site.
- Source authority: LAWA.
- Dataset / endpoint: Same as #7.
- DataSource key(s): `lawa_water_quality`.
- Table(s): `water_quality_sites`.
- Query path: `0054_flood_nearest_m.sql:534-535`.
- Rendered by: `report_html.py:1739,1745` (formatted into water-band finding text).
- Threshold / classification logic: N/A (raw metres).
- Score contribution: N/A (informational).
- Coverage: National. Always populated, distance varies widely.
- Common misreading: Treating a distant site (>10 km) as relevant to the property's micro-catchment.
- What it does NOT tell you: Whether the site is in the same sub-catchment as the property.
- source_key status: present via parent finding `_src("lawa_water")`.
- User-care severity: Background. Caveat for the band reading.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Distance to river monitor | Water-monitor distance | LAWA water site distance (m) |
| On-screen, finding | (surfaced inside parent water-band finding) | (same) | (same) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Water site: how far away | Distance to freshwater site | Distance to LAWA water site |
| Hosted Full, narrative + tech | The freshwater bands above are read off this distance. Closer is more relevant. | Distance to nearest LAWA freshwater monitor; large distances weaken parcel relevance. | Geodesic distance to nearest `water_quality_sites` row; metres. No catchment-boundary filter. |

---

## 14. environment.climate_temp_change

### environment.climate_temp_change (`environment.climate_temp_change`)
- What it measures: Projected mean annual temperature change (°C) at the property between baseline and 2041-2060 under SSP2-4.5 emissions, averaged across CMIP6 GCMs in the MfE/NIWA downscaled VCSN grid.
- Source authority: NIWA + Ministry for the Environment (MfE) climate change projections programme.
- Dataset / endpoint: MfE climate projections Parquet, ingested by `scripts/load_climate_projections.py:1` ("Load MfE climate projections Parquet into PostGIS").
- DataSource key(s): `niwa_climate_projections` (per `docs/DATA-PROVENANCE.md:166`; not a registered DataSource, bulk loader script).
- Table(s): `climate_projections`, joined to `climate_grid` on `vcsn_agent = agent_no` (`0054_flood_nearest_m.sql:540-543`).
- Query path: SQL averages `T_value_change` for the nearest VCSN grid cell where `scenario='ssp245' AND season='ANNUAL'` (`0054_flood_nearest_m.sql:537-544`).
- Rendered by: `report_html.py:1808-1820` (info finding when ≥2.0 °C); `frontend/src/components/property/sections/RiskHazardsSection.tsx:127` `<ClimateForecastCard>`.
- Threshold / classification logic: `report_html.py:1814` triggers when ≥ 2.0 °C. Risk score `normalize_min_max(0, 3.0)` (`risk_score.py:697`).
- Score contribution: indicator `climate`, weight 0.15 (`risk_score.py:266`).
- Coverage: National. VCSN grid covers all NZ (about 2.6M cells per DATA-PROVENANCE).
- Common misreading: Reading "+2.5 °C" as today's weather. It is a 20-year mean projection 15-35 years away. Also: SSP2-4.5 is a middle-of-road scenario, not a worst case.
- What it does NOT tell you: Heatwave intensity, summer maxima, frost loss specifically (annual mean masks seasonal variation), other SSPs.
- source_key status: present via `_src("niwa_climate")` (`report_html.py:1819`).
- User-care severity: Notable. Shapes insulation, glazing and cooling spec on any reno; mostly relevant to buyers and pros over a long hold.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Projected warming by 2050s | Projected warming 2041-60 | Annual ΔT 2041-60, SSP2-4.5 |
| On-screen, finding | The area is projected to warm by 2.3 °C by the 2050s, warmer winters, hotter summer afternoons. | +2.3 °C by 2041-60 under SSP2-4.5; factor it into insulation, glazing and any cooling spec. | NIWA/MfE downscaled VCSN, SSP2-4.5 ensemble mean ΔT 2041-60 vs 1995 baseline = +2.3 °C; annual mean. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Warmer winters, hotter summers | Projected warming 2041-60 | Annual ΔT 2041-60 (SSP2-4.5, NIWA) |
| Hosted Full, narrative + tech | The neighbourhood is on track to warm by about 2.3 °C by the 2050s. Heat-pump cooling on the north side will earn its keep. | +2.3 °C ensemble mean for 2041-60 under SSP2-4.5; insulation R-values designed for today's climate become marginal. Worth pricing at reno. | NIWA/MfE downscaled VCSN climate projections, CMIP6 SSP2-4.5 multi-model mean, annual ΔT 2041-60 vs 1986-2005 baseline; nearest VCSN cell. |

---

## 15. environment.climate_precip_change_pct

### environment.climate_precip_change_pct (`environment.climate_precip_change_pct`)
- What it measures: Projected percent change in mean annual precipitation at the property between baseline and 2041-2060 under SSP2-4.5.
- Source authority: NIWA + MfE.
- Dataset / endpoint: Same as #14.
- DataSource key(s): `niwa_climate_projections`.
- Table(s): `climate_projections` (column `PR_value_change`).
- Query path: `0054_flood_nearest_m.sql:539` `AVG(PR_value_change)` for the same grid cell as #14.
- Rendered by: `report_html.py:2228-2243` (composed into flood_minor recommendation); `frontend/src/components/property/sections/RiskHazardsSection.tsx:127` `<ClimateForecastCard>` (uses `precip_change_pct`); `frontend/src/components/report/HostedNeighbourhoodStats.tsx:95` (`const climatePrecip = env.climate_precip_change_pct`).
- Threshold / classification logic: Bidirectional. `report_html.py:2228` triggers a "rising rainfall" narrative when projected change ≥ +5 %; `:2234` triggers a "drying" narrative when ≤ -5 %; otherwise the climate line is skipped entirely (no zero-narrative fallback). Both narratives are composed inside the flood_minor recommendation, not a standalone Insight.
- Score contribution: N/A (not directly scored; complementary signal to `climate`).
- Coverage: National.
- Common misreading: A "5 % wetter" annual figure hides much larger swings between dry summers and heavier rainfall events. Annual mean change does not equal extreme-rainfall change. Equally, a "drying" projection does not mean fewer extreme storms; extreme-rainfall intensity can rise even when the annual mean falls.
- What it does NOT tell you: Change in rainfall intensity (RX1day), drought frequency, snow vs rain split.
- source_key status: TODO. `report_html.py:2228-2243` composes narrative into a flood_minor recommendation, not a standalone Insight, so no `_src(...)` is attached by design. If a dedicated climate-precip Insight is added later, attach `_src("niwa_climate")`.
- User-care severity: Notable. Shapes guttering, soakaways and stormwater spec; matters more for buyers planning renovations.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Future rainfall change | Annual rainfall change 2041-60 | Annual ΔP 2041-60 (%, SSP2-4.5) |
| On-screen, finding | About 4 % wetter on average by the 2050s, but the annual figure hides bigger one-off storms. | +4 % annual rainfall by 2041-60 (SSP2-4.5); design storm intensities rise faster than the mean either way. | NIWA/MfE VCSN ensemble mean ΔP 2041-60 = +4 % (annual); does not represent RX1day intensities. Narrative branches at ±5 % per `report_html.py:2228-2243`. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Wetter or drier by 2050s? | Annual rainfall change 2041-60 | Annual ΔP 2041-60 (%, SSP2-4.5) |
| Hosted Full, narrative + tech | About 4 % wetter on average by the 2050s, but storms are projected to dump more in one go, which matters for guttering and drains. | Annual mean +4 %, but extreme-event rainfall intensities rise faster either way; guttering, soakaways and retaining-wall drainage worth derisking. | NIWA/MfE VCSN downscaled CMIP6 SSP2-4.5 multi-model mean annual precipitation change 2041-60 vs 1986-2005 baseline; ANNUAL aggregation, no extreme-rainfall metric. Northern/eastern cells trend dry, southern/western trend wet; narrative branches at ±5 % per `report_html.py:2228-2243`. |

---

## 16. climate_normals (snapshot)

### climate_normals (`climate_normals`)
- What it measures: 1991-2020 monthly climate normals (temperature mean/max/min, precipitation mm, rain days, mean wind speed, etc.) for the property's nearest NIWA station.
- Source authority: NIWA.
- Dataset / endpoint: NIWA Climate Normals 1991-2020. DataSource `climate_normals` (`data_loader.py:4886`); 60 cities (per DataSource description "Climate Normals 1991-2020 (60 cities. temp, rain, sun, wind)").
- DataSource key(s): `climate_normals`.
- Table(s): `climate_normals`.
- Query path: snapshot built at `snapshot_generator.py:944`; not part of `get_property_report()`.
- Rendered by: `frontend/src/components/report/HostedClimate.tsx:24-…`.
- Threshold / classification logic: N/A (descriptive monthly).
- Score contribution: N/A (not scored).
- Coverage: 60 cities (DataSource description). Outside those cities, HostedClimate renders an empty state ("Climate data not available for this location").
- Common misreading: Reader assumes these are forecasts; they are 30-year historical normals.
- What it does NOT tell you: Climate change projection (see #14, #15). Microclimate variation across a city.
- source_key status: TODO. Snapshot blob, no Insight wired.
- User-care severity: Context. Useful background for orientation/cooling decisions; not decision-changing alone.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: snapshot-only field) | (out of scope) | (out of scope) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | What the year usually looks like | Monthly climate normals | NIWA 1991-2020 climate normals |
| Hosted Full, narrative + tech | A typical year (temperatures, rain days, wind by month) based on 30 years of records. | 30-year baseline for cooling/heating, deck orientation and gutter-sizing decisions. | NIWA Climate Normals 1991-2020, nearest of 60 station-cities; monthly temperature, precipitation, rain days, wind. Vintage 30-yr period (does not reflect projected ΔT). |

---

## 17. environment.contam_nearest_name

### environment.contam_nearest_name (`environment.contam_nearest_name`)
- What it measures: Site name of the nearest contaminated-land register entry within 2 km of the property.
- Source authority: Regional councils (SLUR, Selected Land Use Register) + MfE national contaminated-land sites; HAIL activities (Hazardous Activities and Industries List).
- Dataset / endpoint: Multiple per region. `contaminated_land` DataSource (`data_loader.py:4944` GWRC SLUR), plus per-region loaders that all UPSERT into the same `contaminated_land` table with a region tag (otago `data_loader.py:5678`, hawkes_bay 5807, southland 6334 + 9741, taranaki 6350, bay_of_plenty 7574, upper_hutt 9301, wairarapa 9628, gisborne 10611). Nine regional loaders, all keyed `contaminated_land` with a region argument.
- DataSource key(s): `contaminated_land` (GWRC) plus per-region keys; aggregate "varies".
- Table(s): `contaminated_land`.
- Query path: `0054_flood_nearest_m.sql:545-552` LATERAL nearest within 2 km.
- Rendered by: `report_html.py:1760` (in finding text); `frontend/src/components/property/sections/RiskHazardsSection.tsx` (HazardCards path); hosted-full via `HostedHazardAdvice.tsx`.
- Threshold / classification logic: 2 km radius envelope; finding triggers at distance ≤ 500 m (high-risk) or ≤ 200 m (any). See #19.
- Score contribution: N/A (label only; severity comes from #18 / #19).
- Coverage: Wellington, Upper Hutt, Hawke's Bay, BOP, Gisborne, Taranaki, Southland, Wairarapa, Northland (per `docs/WIRING-TRACES.md:249` `contamination_count` row). Auckland and Christchurch NOT in that list (UNKNOWN coverage).
- Common misreading: User reads "100 m from a contaminated site" as immediate health hazard. Many register entries are regulatory listings (cemeteries, closed waste) without an active exposure pathway.
- What it does NOT tell you: Whether contamination is still active, has migrated, or has been remediated. Whether groundwater plumes reach the property.
- source_key status: present via `_src("council_slur")` on parent contam findings (`report_html.py:1789,1797,1805`).
- User-care severity: Critical. Identifying a former petrol station or chemical site close by drives Phase 1 ESA spend (about $1.5-3k), can flag lender flood/contam loadings, and can change a buy decision.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Nearest contaminated site | Nearest contaminated site | Nearest SLUR/HAIL entry |
| On-screen, finding | A flagged contaminated site sits 180 m away, often a former petrol station or dry cleaner; ask the landlord whether soil has been tested. | Nearest contaminated site 180 m away (former petrol station); Phase 1 ESA at offer stage is standard practice, budget about $1.5-3k. | SLUR/HAIL register entry "Caltex Site 12" 180 m, ANZECC Cat A; council Selected Land Use Register, regional dataset. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Closest flagged site | Nearest contaminated site | Nearest SLUR/HAIL site |
| Hosted Full, narrative + tech | The closest officially-flagged dirty site to your address. Worth asking the landlord whether soil has been tested, especially if you grow veg. | Identifying the site lets you check whether it has been remediated and whether your lender has flagged it before. Phase 1 ESA scope ($1.5-3k) hinges on which activity sat there. | SLUR/HAIL register row name; council Selected Land Use Register. Listing alone is not evidence of active contamination. |

---

## 18. environment.contam_nearest_category

### environment.contam_nearest_category (`environment.contam_nearest_category`)
- What it measures: ANZECC category (A/B/C/D) or full HAIL activity description for the nearest contaminated-land site.
- Source authority: Regional councils (SLUR) + MfE; ANZECC = Australian and New Zealand Environment Conservation Council.
- Dataset / endpoint: Same as #17.
- DataSource key(s): As #17 (varies).
- Table(s): `contaminated_land` (column `anzecc_category`).
- Query path: `0054_flood_nearest_m.sql:546`.
- Rendered by: `report_html.py:1761,1765` (decoded via `ANZECC_EXPLANATIONS`).
- Threshold / classification logic: `risk_score.py:98-111` `contamination_score()` upweights HIGH_RISK keywords (chemical, metal extraction, explosives, vehicle refuelling) to severity 0.8; cemetery/waste 0.6; else 0.5.
- Score contribution: indicator `contaminated_land`, weight 0.10 (`risk_score.py:266,698`); combined distance × severity.
- Coverage: Same as #17.
- Common misreading: Reading "Cat D" as "moderate". In this context Cat D often means cemetery/waste (low active exposure), and Cat A is petrol/chemicals (high active exposure). The letters do not follow alphabetical-severity intuition.
- What it does NOT tell you: Whether the activity ceased, was remediated, or whether contamination has migrated.
- source_key status: present via `_src("council_slur")`.
- User-care severity: Critical. Determines whether a Phase 1 ESA is needed and roughly how expensive remediation could be.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | What kind of contamination | Activity type (HAIL/ANZECC) | ANZECC category / HAIL activity |
| On-screen, finding | A former petrol station (Category A); fuel residues can persist in soil for decades, so ask before growing veg. | ANZECC Cat A activity (petrol/chemicals); Phase 1 ESA at offer stage is standard practice. | ANZECC Category A; HAIL activity "Vehicle refuelling, service and repair". `contamination_score` severity = 0.8. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Type of contamination | ANZECC category / HAIL activity | ANZECC Cat / HAIL activity |
| Hosted Full, narrative + tech | A description of what was once at that site. A petrol station is treated very differently to a closed cemetery. | ANZECC/HAIL describe the past activity; petrol stations and chemical plants drive Phase-1 ESA scope; cemeteries and waste rarely require action. | ANZECC Category (A-D) or full HAIL activity string; severity classified by `contamination_score()` keyword match in `risk_score.py:98`. Source: council SLUR / MfE national contaminated sites. |

---

## 19. environment.contam_nearest_distance_m

### environment.contam_nearest_distance_m (`environment.contam_nearest_distance_m`)
- What it measures: Distance in metres from the property to the nearest contaminated-land register entry within 2 km.
- Source authority: As #17.
- Dataset / endpoint: As #17.
- DataSource key(s): As #17 (varies).
- Table(s): `contaminated_land`.
- Query path: `0054_flood_nearest_m.sql:547`.
- Rendered by: `report_html.py:1753-1806`; `RiskHazardsSection.tsx:230`.
- Threshold / classification logic: `report_html.py:1759` 500 m envelope to fire any finding; ≤500 m + high-hazard category fires warn; ≤200 m + cemetery/waste fires info; ≤200 m otherwise fires warn.
- Score contribution: `contamination_score(distance_m, category)` (`risk_score.py:98-111`); linear decay 0..2000 m × severity multiplier.
- Coverage: Coverage as #17, limited to councils with loaded SLUR data.
- Common misreading: Distance is straight-line, not a hydrogeological pathway distance. Groundwater plumes follow gradient, not straight lines.
- What it does NOT tell you: Direction of migration, depth of contamination, presence of an active source.
- source_key status: present via `_src("council_slur")` (`report_html.py:1789,1797,1805`).
- User-care severity: Critical. Drives the size and need for Phase 1 ESA and lender disclosure.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | How close is it | Distance to nearest contam site | Distance to SLUR/HAIL entry (m) |
| On-screen, finding | A flagged site sits just 180 m away, close enough to ask about soil testing if you garden. | Nearest contaminated site 180 m; ANZECC Cat A plumes can travel 300-2,000 m, so Phase 1 ESA is sensible at offer (about $1.5-3k). | 180 m straight-line; ANZECC Cat A. `contamination_score` = (1 - 180/2000) × 100 × 0.8 ≈ 73. Hydrogeological pathway not modelled. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Distance to flagged site | Distance to nearest contam site | Distance to SLUR/HAIL site (m) |
| Hosted Full, narrative + tech | The closer a flagged site sits, the more it's worth knowing what was once there. | 180 m. ANZECC Cat A plumes can reach 300-2,000 m by groundwater; Phase 1 ESA (about $1.5-3k) is often called for by lenders. | Geodesic 180 m; severity-distance combined in `contamination_score()`. Pathway analysis (gradient, soil type) NOT modelled here. |

---

## 20. environment.contam_count_2km (→ contamination_count)

### environment.contam_count_2km (`environment.contam_count_2km`)
- What it measures: Count of contaminated-land register entries within 2 km of the property.
- Source authority: As #17.
- Dataset / endpoint: As #17.
- DataSource key(s): As #17 (varies).
- Table(s): `contaminated_land`.
- Query path: `0054_flood_nearest_m.sql:553-557` `COUNT(*) FROM contaminated_land WHERE ST_DWithin … 2000`.
- Rendered by: `report_html.py:1763` (formatted into contam findings), `RiskHazardsSection.tsx:230`.
- Threshold / classification logic: No standalone threshold; surfaced as supporting context (e.g. "12 contaminated sites within 2km").
- Score contribution: N/A (does not feed risk score independently; the nearest distance + category drives `contaminated_land` indicator).
- Coverage: As #17. Only meaningful where regional council SLUR data is loaded; otherwise zero.
- Common misreading: Treating count as severity. Twelve cemeteries are not equivalent to twelve petrol stations.
- What it does NOT tell you: Severity mix; how many have been remediated.
- source_key status: present via parent finding `_src("council_slur")`.
- User-care severity: Context. Useful framing for the LIM review; the nearest-site distance + category drive any decision.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Flagged sites in 2 km | Contaminated sites within 2 km | SLUR/HAIL count <2 km |
| On-screen, finding | 12 flagged sites listed within a 2 km walk, many old, some still relevant. | 12 register entries within 2 km; review the SLUR map at LIM stage for any with active groundwater concerns. | n=12 within 2 km; mix of ANZECC categories, count not severity-weighted. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Flagged sites within 2 km | Contaminated sites <2 km | SLUR/HAIL count <2 km |
| Hosted Full, narrative + tech | A rough count of all the flagged sites within walking distance. Context only. | 12 entries. Context for the LIM review; not all are equivalent risks. | `COUNT(*)` in 2 km buffer; not severity-weighted. Source: council SLUR registers; coverage limited to regions with loaded data. |

---

## 21. environment.in_corrosion_zone

### environment.in_corrosion_zone (`environment.in_corrosion_zone`)
- What it measures: Boolean for whether the property polygon falls inside Wellington City Council's mapped high-corrosion (coastal salt-spray) zone.
- Source authority: Wellington City Council.
- Dataset / endpoint: WCC ArcGIS corrosion zones layer (per DATA-PROVENANCE: `https://gis.wcc.govt.nz/arcgis/rest/services/.../CorrosionZones`); load function `load_corrosion_zones()` (`data_loader.py:1169`); DataSource registered at `data_loader.py:4989` ("WCC Corrosion Zones").
- DataSource key(s): `corrosion_zones`.
- Table(s): `corrosion_zones`.
- Query path: `0054_flood_nearest_m.sql:559-562` `ST_Intersects` test.
- Rendered by: `frontend/src/components/property/sections/RiskHazardsSection.tsx`; `frontend/src/components/report/HostedNeighbourhoodStats.tsx:134`; hosted-full via `HostedHazardAdvice.tsx`.
- Threshold / classification logic: Boolean, in or out of zone.
- Score contribution: N/A (no risk_score indicator; not in WEIGHTS_ENVIRONMENT).
- Coverage: Wellington City only (per `docs/DATA-PROVENANCE.md:180`). Reads `false` everywhere else (default `coalesce(... , false)` at SQL line 517).
- Common misreading: A `false` outside Wellington means "no corrosion risk". In fact it means "no data": many other coastal NZ cities have salt-spray exposure but no mapped zone in our data.
- What it does NOT tell you: Severity gradient within the zone. Distance to coast for properties outside Wellington.
- source_key status: TODO. No Insight emits a corrosion-specific finding (no `_src("wcc_corrosion")` grep'd).
- User-care severity: Notable. Lifts NZS 3604 corrosion class; budget galvanised or stainless on fixings and earlier reroofing intervals.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: no finding rule fires) | Coastal corrosion zone (WCC) | WCC corrosion zone |
| On-screen, finding | (no rule) | Inside WCC's mapped salt-spray zone, so budget galvanised or stainless fixings on any new build or reroof. | WCC corrosion zone = TRUE (`ST_Intersects`); B2 corrosion class implied. Wellington City only. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Coastal salt damage | Coastal corrosion zone (WCC) | WCC corrosion zone |
| Hosted Full, narrative + tech | This block sits where sea spray eats through standard nails and roof iron faster. Budget for stainless fittings and earlier reroofing. | Inside WCC's mapped salt-spray zone. NZS 3604 corrosion class lifts; budget galvanised or stainless on fixings, earlier reroofing intervals. | `ST_Intersects(corrosion_zones.geom, addr.geom)` = TRUE. WCC ArcGIS CorrosionZones layer; vintage per `data_source_health`. Wellington City only; `false` outside means "no mapped zone", not "no salt-spray risk". |

---

## 22. environment.in_rail_vibration_area

### environment.in_rail_vibration_area (`environment.in_rail_vibration_area`)
- What it measures: Boolean for whether the property polygon sits inside WCC's rail-vibration advisory zone (proximity to KiwiRail track, where new dwellings need vibration mitigation under the District Plan).
- Source authority: Wellington City Council (DP 2024 noise/vibration overlay).
- Dataset / endpoint: WCC 2024 District Plan rail vibration layer; load function `load_rail_vibration()` (`data_loader.py:1293`); DataSource registered at `data_loader.py:5009` ("WCC Rail Vibration Advisory").
- DataSource key(s): `rail_vibration` (`data_loader.py:5009`). DATA-PROVENANCE refers to it as `wcc_rail_vibration` informally; the actual registered key is `rail_vibration`.
- Table(s): `rail_vibration`.
- Query path: `0054_flood_nearest_m.sql:564-567` `ST_Intersects` test.
- Rendered by: `report_html.py:2336` (used inside the noise-stack rec); `RiskHazardsSection.tsx`; hosted-full via `HostedHazardAdvice.tsx`.
- Threshold / classification logic: Boolean, in or out of advisory area. No standalone Insight rule; `report_html.py:2346` adds "rail vibration advisory area" string into the cumulative noise rec.
- Score contribution: N/A (no risk_score indicator).
- Coverage: Wellington City only. Inventory references `ac_rail_vibration` but no `ac_rail_vibration` DataSource was found in `data_loader.py`; only WCC.
- Common misreading: "Vibration" sounds dramatic. In practice the zone is a planning-trigger overlay, not a measurement of perceptible vibration on the property today.
- What it does NOT tell you: Whether you'll feel the trains. Frequency or intensity of services. Day-vs-night exposure.
- source_key status: TODO. Surfaced inside the noise stack rec; no dedicated `_src("wcc_rail_vibration")` Insight.
- User-care severity: Notable. Triggers a vibration assessment on new dwellings or major renos; price into reno scope.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: surfaced inside noise stack rec, not standalone) | Rail vibration advisory zone | WCC rail vibration advisory area |
| On-screen, finding | (no rule) | Inside WCC's rail-vibration overlay, so any new build or major reno needs an acoustic/vibration assessment. | WCC DP 2024 rail vibration advisory area = TRUE; planning trigger for vibration assessment on new dwellings. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Trains nearby: feel the rumble | Rail vibration advisory area | WCC rail vibration overlay |
| Hosted Full, narrative + tech | Inside a council zone next to the rail line. Passing trains can be felt indoors at lower floors; ask a current tenant about night services. | Inside WCC's rail-vibration advisory overlay. DP triggers a vibration assessment for new dwellings; price into renovation scope. | `ST_Intersects(rail_vibration.geom, addr.geom)` = TRUE; WCC DP 2024 rail vibration noise area overlay. Planning trigger, not a measured vibration intensity. |

---

## 23. environment.rail_vibration_type

### environment.rail_vibration_type (`environment.rail_vibration_type`)
- What it measures: WCC `noise_area_type` classification (sub-zone) for properties inside the rail vibration overlay (e.g. inner / outer band).
- Source authority: Wellington City Council.
- Dataset / endpoint: Same as #22.
- DataSource key(s): Same as #22.
- Table(s): `rail_vibration` (column `noise_area_type`).
- Query path: `0054_flood_nearest_m.sql:565`.
- Rendered by: hosted-full via `HostedHazardAdvice.tsx`. Not surfaced standalone in `report_html.py` insights (no grep hit).
- Threshold / classification logic: UNKNOWN. Exact `noise_area_type` enumeration not visible from the SQL alone; values come from WCC source attributes.
- Score contribution: N/A (no risk_score indicator).
- Coverage: Wellington City only.
- Common misreading: The label looks technical and councilly; without context the user cannot decode it.
- What it does NOT tell you: Vibration magnitude, frequency, time-of-day distribution.
- source_key status: TODO. No Insight wired.
- User-care severity: Background. Sub-zone classification; only useful inside #22's planning-trigger framing.

(Note: the inventory listed 22 environment indicators in the table at `_INVENTORY.md:139-161`. `rail_vibration_type` IS row 22; this section's heading numbering reflects the per-indicator order, with `road_noise (snapshot detail)` as a sibling reference. Total inventory rows covered = 22.)

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not rendered on-screen) | (out of scope) | (out of scope) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full, label | Rail zone: which band | Rail vibration sub-zone (WCC) | WCC rail vibration noise_area_type |
| Hosted Full, narrative + tech | Which slice of the rail zone the property sits in. Closer bands generally feel the trains more. | WCC sub-zone within the rail vibration overlay. Closer bands trigger stricter vibration assessment requirements. | `noise_area_type` from WCC `rail_vibration` overlay; sub-classification of the advisory area. Vintage per `data_source_health`. |

---

## Local coverage audit

| Indicators | Critical | Notable | Context | Background |
|---|---|---|---|---|
| 23 (rows `_INVENTORY.md:164-186`) | 3 (#17 contam_nearest_name, #18 contam_nearest_category, #19 contam_nearest_distance_m) | 8 (#1 road_noise_db, #4 air_pm10_trend, #5 air_pm25_trend, #8 water_ecoli_band, #14 climate_temp_change, #15 climate_precip_change_pct, #21 in_corrosion_zone, #22 in_rail_vibration_area) | 2 (#16 climate_normals, #20 contam_count_2km) | 10 (#2 road_noise snapshot, #3 air_site_name, #6 air_distance_m, #7 water_site_name, #9 water_ammonia_band, #10 water_nitrate_band, #11 water_drp_band, #12 water_clarity_band, #13 water_distance_m, #23 rail_vibration_type) |

| Indicators in category | Distinct finding rule blocks | Indicators surfaced in finding text | source_key wired (live `_src` calls) | Notes on hosted-full coverage |
|---|---|---|---|---|
| 23 (rows `_INVENTORY.md:164-186`) | 5 (road noise `report_html.py:1687`; air trend 1722; water E.coli 1736; contam tier ladder 1759; climate ΔT 1808) | 11 (road_noise_db; air_pm10_trend, air_pm25_trend, air_site_name, air_distance_m via parent; water_ecoli_band, water_site_name, water_distance_m via parent; contam_nearest_name, contam_nearest_category, contam_nearest_distance_m, contam_count_2km via parent; climate_temp_change) | 5 distinct keys: `nzta_noise` (1706, 1713), `lawa_air` (1733), `lawa_water` (1750), `council_slur` (1789, 1797, 1805), `niwa_climate` (1819) | env.air_*/water_*/contam_* render in `HostedNeighbourhoodStats.tsx:69-90`; in_corrosion_zone in `HostedNeighbourhoodStats.tsx:134`; `HostedClimate.tsx:25` consumes only `snapshot.climate_normals`; `HostedRoadNoise.tsx:11` consumes `snapshot.road_noise`; `ClimateForecastCard` at `RiskHazardsSection.tsx:127` consumes `climate_temp_change` + `climate_precip_change_pct`. |

## Local gap list (UNKNOWN entries / missing source_key)

| Indicator | Gap |
|---|---|
| `road_noise (snapshot detail)` | UNKNOWN, separate classification logic vs `road_noise_db`. source_key N/A (snapshot blob). |
| `environment.water_ammonia_band` | TODO. No dedicated Insight, no source_key wired (only contributes to worst-band score via `worst_water_band`). Surfaced on hosted-full at `HostedNeighbourhoodStats.tsx:89`. |
| `environment.water_nitrate_band` | TODO. No dedicated Insight, no source_key wired. NOT consumed by any frontend component (verified by grep, only `_drp_band` and `_ammonia_band` are read in HostedNeighbourhoodStats); surfaces only inside finding text when D/E rule fires. |
| `environment.water_drp_band` | TODO. No dedicated Insight, no source_key wired. Surfaced on hosted-full at `HostedNeighbourhoodStats.tsx:88`. |
| `environment.water_clarity_band` | TODO. No dedicated Insight, no source_key wired. NOT consumed by any frontend component. |
| `environment.water_ecoli_band` | NOT consumed by any frontend component standalone (only `_drp_band` and `_ammonia_band` are read in `HostedNeighbourhoodStats.tsx:88-89`); only surfaced inside the parent water-band finding text. |
| `environment.climate_precip_change_pct` | TODO. `report_html.py:2228-2243` composes narrative into flood_minor recommendation, not a standalone Insight; no `_src(...)` attached by design. Threshold IS explicit: bidirectional ±5 %. |
| `climate_normals` | TODO. Snapshot blob, no Insight wired. source_key not applicable. |
| `environment.in_corrosion_zone` | TODO. No Insight rule; `HostedNeighbourhoodStats.tsx:134` surfaces it but no source attribution. |
| `environment.in_rail_vibration_area` | TODO. Surfaced inside cumulative noise stack rec; no dedicated Insight or source_key. |
| `environment.rail_vibration_type` | UNKNOWN. Sub-zone enumeration values not visible in code; no Insight wired. Frontend rendering surface unverified, grep for `rail_vibration_type` returns no frontend hits, so the indicator may not be rendered anywhere standalone. |
| `environment.air_site_name` | Surfaced via finding text at `report_html.py:1722-1734` and on hosted-full at `HostedNeighbourhoodStats.tsx:80`. |
| `environment.water_site_name` | Surfaced via finding text at `report_html.py:1738` and on hosted-full at `HostedNeighbourhoodStats.tsx:87`. |
| `environment.air_distance_m` | Surfaced inside finding text at `report_html.py:1724,1728`; HostedNeighbourhoodStats also reads it at line 83 via fallback chain. |

## Local conflict list

| Conflict | Citations |
|---|---|
| Inventory rows for `environment.air_pm10_trend`, `air_pm25_trend`, `air_site_name`, `air_distance_m`, `water_*` and `climate_temp_change` mark hosted-full render = `HostedClimate.tsx`, but `frontend/src/components/report/HostedClimate.tsx:25` only consumes `snapshot.climate_normals`. The actual frontend consumers of `env.air_*` / `env.water_*` / contam / corrosion fields are `HostedNeighbourhoodStats.tsx:69-134`. Climate temp/precip change is consumed by `ClimateForecastCard` (`RiskHazardsSection.tsx:127`), not `HostedClimate.tsx`. | `_INVENTORY.md:166-178`; `frontend/src/components/report/HostedClimate.tsx:25`; `frontend/src/components/report/HostedNeighbourhoodStats.tsx:69-134`. |
| Inventory `environment.in_rail_vibration_area` lists DataSource keys `wcc_rail_vibration, ac_rail_vibration` but no `ac_rail_vibration` DataSource exists in `backend/app/services/data_loader.py`; only the WCC loader at `data_loader.py:5009` (registered key `rail_vibration`, not `wcc_rail_vibration`). | `_INVENTORY.md:185`; `backend/app/services/data_loader.py:5009`. |
| Inventory `environment.in_corrosion_zone` lists DataSource key `branz_corrosion`; the actual loader is registered as `corrosion_zones` (WCC, not BRANZ) at `data_loader.py:4989` with description "WCC Corrosion Zones". DATA-PROVENANCE corroborates this as a WCC-only field. | `_INVENTORY.md:184`; `backend/app/services/data_loader.py:4989`; `docs/DATA-PROVENANCE.md:180`. |
| Inventory `environment.road_noise_db` marks on-screen render = `RiskHazardsSection.tsx:127 (ClimateForecastCard)`, but `RiskHazardsSection.tsx:127` is the ClimateForecastCard, which renders climate, not road noise. Road noise is rendered into `HostedAtAGlance.tsx:51` (hosted quick) and `HostedRoadNoise.tsx:11` (hosted full) via `snapshot.road_noise`; on-screen surfacing is via the noise Insight at `report_html.py:1687-1713` only. | `_INVENTORY.md:164`; `frontend/src/components/property/sections/RiskHazardsSection.tsx:127`; `frontend/src/components/report/HostedAtAGlance.tsx:51`; `frontend/src/components/report/HostedRoadNoise.tsx:11`. |
| `environment.air_pm10_trend` and `environment.air_pm25_trend` both attribute their "trend degrading" finding to the same Insight at `report_html.py:1722-1734` (PM2.5 is fallback when PM10 is null); agents reading inventory rows might assume distinct findings. There is exactly one finding per property regardless of which trend column fired it. | `_INVENTORY.md:167-168`; `backend/app/services/report_html.py:1722`. |
| Resolved 2026-05-02. Inventory summary previously read "Environment | 24" but only 23 rows existed at `_INVENTORY.md:164-186`; inventory has been corrected to 23. | `_INVENTORY.md:27`; `_INVENTORY.md:164-186`. |
