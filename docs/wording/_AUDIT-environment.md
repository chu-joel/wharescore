# Audit: INDICATOR-WORDING-environment.md

Audited 2026-05-02. Verifications performed against current `backend/`, `frontend/`, and `docs/` working tree.

## Inventory coverage

- Inventory summary count (`_INVENTORY.md:27`): **24**
- Actual rows under `## Environment` in inventory (`_INVENTORY.md:164-186`): **23** (rows on lines 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186)
- Indicators in wording file (numbered sections 1-23): **23**
- In inventory not wording: none
- In wording not inventory: none
- Conflict: inventory `## Environment | 24` summary line disagrees with the 23 rows actually present. Wording file flags this in its own conflict list at line 703. **The "24 indicators" figure in the audit prompt is the inventory's summary cell, not the row count — `_AUDIT` proceeds on the actual 23 rows.**

## Per-indicator audit

Verification commands referenced below:
- `Grep -n '"<KEY>"' backend/app/services/data_loader.py` — DataSource registration check (positional first arg).
- `Grep "_src(\"<key>\")" backend/app/services/report_html.py` — source_key wiring check.
- `Read backend/app/services/risk_score.py:265-267` — WEIGHTS_ENVIRONMENT constants.
- `Read backend/migrations/0054_flood_nearest_m.sql:500-568` — env block of `get_property_report()`.

---

### 1. environment.road_noise_db

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | Max 24h LAeq dBA at parcel polygon, NZTA contours | NOT-VERIFIABLE (descriptive). SQL agrees with shape | `MAX(laeq24h) FROM noise_contours WHERE ST_Intersects(geom, addr.geom)` (0054:524-526) | NOT-VERIFIABLE |
| 2 | Source authority | NZTA Waka Kotahi | data_loader.py:7143 description "NZTA National Road Noise Contours" | `"nzta_noise_contours", "NZTA National Road Noise Contours"` | CONFIRMED |
| 3 | Dataset / endpoint | `nzta_noise_contours` DataSource at data_loader.py:7143; loader at 3923 | Grep nzta_noise_contours and load_nzta_noise_contours | data_loader.py:3923 `def load_nzta_noise_contours`; 7143 DataSource entry | CONFIRMED |
| 4 | DataSource key(s) | `nzta_noise_contours` | `Grep '"nzta_noise_contours"' data_loader.py` | data_loader.py:7143 | CONFIRMED |
| 5 | Table | `noise_contours` (col `laeq24h`) | data_loader.py:3946 INSERT statement | `INSERT INTO noise_contours (laeq24h, source_council, geom)` | CONFIRMED |
| 6 | Query path | 0054:524-526 MAX(laeq24h) | Read 0054:524-526 | line 524 `SELECT MAX(laeq24h) AS max_db FROM noise_contours` | CONFIRMED |
| 7 | Rendered by | report_html.py:1687, HostedRoadNoise.tsx, HostedAtAGlance.tsx:51 | Grep, Read 1687, Read frontend | report_html.py:1687 `noise_db = env.get("road_noise_db")`; HostedAtAGlance.tsx:51 `const roadNoiseDb = env.road_noise_db` | CONFIRMED |
| 8 | Threshold logic | report_html.py:1697 ≥65 warn / ≥55 info / <45 ok; risk normalize 40-75 | Read | report_html.py:1697-1715; risk_score.py:693 `normalize_min_max(env.get("road_noise_db"), 40, 75)` | CONFIRMED |
| 9 | Score contribution | indicator `noise`, weight 0.30 | Read risk_score.py:265-267 | `"noise": 0.30` | CONFIRMED |
| 10 | Coverage | National (state highways + major roads) | Per WIRING-TRACES; not re-grepped this pass | — | UNVERIFIED — investigate further: open WIRING-TRACES.md:197 row |
| 11 | source_key status | present `_src("nzta_noise")` at 1706, 1713 | Grep `_src("nzta_noise")` | 1706, 1713 hits | CONFIRMED |

#### Wording cells (18 cells)
| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS-Renter-label | "Road noise outside" | ≤60ch, NZ English, plain | PASS |
| OS-Renter-finding | "Modelled 65 dB outside — like a busy restaurant; you'll hear it indoors with single glazing." | Single sentence (compound), defuses dB linearity in companion field | PASS |
| OS-Buyer-label | "Road traffic noise (LAeq24h)" | ≤60ch | PASS |
| OS-Buyer-finding | "65 dB modelled outside; double glazing typically lands you ~20 dB quieter inside." | Defuses misreading | PASS |
| OS-Pro-label | "Road noise — NZTA Laeq24h" | technical register | PASS |
| OS-Pro-finding | "NZTA noise contour 65 dBA Laeq24h at parcel — exceeds WHO 53 dB outdoor residential guideline." | Source named, threshold cited | PASS |
| HQ-Renter-label | "Outside noise level" | not actually rendered (HostedQuick=AtAGlance) | PASS |
| HQ-Renter-narrative | "Modelled 65 dB outside — windows-open conversation will be hard." | concrete | PASS |
| HQ-Buyer-label | "Road noise outside" | OK | PASS |
| HQ-Buyer-narrative | "Modelled 65 dB outside; affects glazing spec and resale." | OK | PASS |
| HQ-Pro-label | "Modelled road noise (Laeq24h)" | OK | PASS |
| HQ-Pro-narrative | "NZTA Laeq24h 65 dBA, modelled at parcel. WHO outdoor residential guideline is 53 dB." | sourced | PASS |
| HF-Renter-label | "Outside road noise" | OK | PASS |
| HF-Renter-narrative | concrete advice + truck overnight prompt | defuses misreading | PASS |
| HF-Buyer-label | "Road noise level" | OK | PASS |
| HF-Buyer-narrative | mitigation + reno budget | actionable | PASS |
| HF-Pro-label | "Road noise — NZTA Laeq24h contour" | OK | PASS |
| HF-Pro-narrative | full method + caveats + vintage table reference | thorough | PASS |

---

### 2. road_noise (snapshot detail)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | snapshot detail object copy of road_noise_db | snapshot_generator.py:937 `"road_noise": road_noise` | line 937 | CONFIRMED |
| 2 | Source authority | NZTA | inherited from #1 | — | CONFIRMED |
| 3 | Dataset / endpoint | same as #1 | — | — | CONFIRMED |
| 4 | DataSource key | `nzta_noise_contours` | — | — | CONFIRMED |
| 5 | Table | `noise_contours` | — | — | CONFIRMED |
| 6 | Query path | snapshot_generator.py:937 | Read | `"road_noise": road_noise,` | CONFIRMED |
| 7 | Rendered by | HostedRoadNoise.tsx:11 `const noise = snapshot.road_noise` | Grep | line 11 | CONFIRMED |
| 8 | Threshold logic | "UNKNOWN — not separately classified" | wording file admits UNKNOWN; reasonable | NOT-VERIFIABLE |
| 9 | Score contribution | — | does not feed risk score | — | CONFIRMED |
| 10 | Coverage | National | — | — | CONFIRMED |
| 11 | source_key status | N/A (snapshot blob) | — | — | CONFIRMED |

#### Wording cells (18 cells)
| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS-Renter-label | "— (out of scope: snapshot-only field)" | specific reason | PASS |
| OS-Renter-finding | "—" | matches scope | PASS |
| OS-Buyer-label | "— (out of scope: snapshot-only field)" | PASS |
| OS-Buyer-finding | "—" | PASS |
| OS-Pro-label | "— (out of scope: snapshot-only field)" | PASS |
| OS-Pro-finding | "—" | PASS |
| HQ-Renter-label | "— (out of scope: not in HostedQuickReport)" | PASS |
| HQ-Renter-narrative | "—" | PASS |
| HQ-Buyer-label | "— (out of scope)" | could be more specific but consistent context | PASS |
| HQ-Buyer-narrative | "—" | PASS |
| HQ-Pro-label | "— (out of scope)" | PASS |
| HQ-Pro-narrative | "—" | PASS |
| HF-Renter-label | "Outside noise detail" | OK | PASS |
| HF-Renter-narrative | "Same number as the at-a-glance figure, with a bit more context." | acceptable | PASS |
| HF-Buyer-label | "Road noise breakdown" | OK | PASS |
| HF-Buyer-narrative | OK | PASS |
| HF-Pro-label | "Road noise detail (NZTA contour)" | OK | PASS |
| HF-Pro-narrative | "passed through unchanged from `report.environment.road_noise_db`" | accurate | PASS |

---

### 3. environment.air_site_name

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | Name of nearest LAWA air station | NOT-VERIFIABLE descriptive; SQL emits `aq.site_name` | 0054:504,528 | NOT-VERIFIABLE |
| 2 | Source authority | LAWA | DATA-PROVENANCE.md and tier3 loader header | scripts/load_tier3_datasets.py:35 (per wording claim) | UNVERIFIED — investigate further: open load_tier3_datasets.py:35 to confirm header text |
| 3 | Dataset / endpoint | Tier3 script loads `lawa-air-quality-2016-2024.xlsx` | Grep confirms script writes air_quality_sites table | scripts/load_tier3_datasets.py:83 `CREATE TABLE air_quality_sites`, 108 INSERT | CONFIRMED |
| 4 | DataSource key | `lawa_air_quality` — "not a registered DataSource — bulk-loaded by script" | Grep `"lawa_air_quality"` returns 0 hits in data_loader.py | (no hits) | CONFIRMED (key absent from data_loader.py — wording file correctly flags this) |
| 5 | Table | `air_quality_sites` | scripts/load_tier3_datasets.py:83 CREATE TABLE | line 83 | CONFIRMED |
| 6 | Query path | 0054:528-530 LATERAL nearest | Read | line 528 `SELECT site_name, pm10_trend, pm25_trend, ST_Distance(...)` | CONFIRMED |
| 7 | Rendered by | report_html.py:1722-1734; "no dedicated frontend field" | Grep frontend; HostedNeighbourhoodStats.tsx:80 `const airSite = env.air_site_name` | line 80 | WRONG — wording says UNKNOWN no frontend field; actually rendered at HostedNeighbourhoodStats.tsx:80 |
| 8 | Threshold logic | N/A label only | — | — | CONFIRMED |
| 9 | Score contribution | — | — | — | CONFIRMED |
| 10 | Coverage | ~80 sites | DATA-PROVENANCE claim, not re-verified | — | UNVERIFIED |
| 11 | source_key status | present via `_src("lawa_air")` at 1733 | Grep | line 1733 hit | CONFIRMED |

#### Wording cells (18 cells)
| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS-Renter-label | "— (out of scope: not rendered standalone)" | PASS |
| OS-Renter-finding | "—" | PASS |
| OS-Buyer-label | "— (out of scope)" | PASS |
| OS-Buyer-finding | "—" | PASS |
| OS-Pro-label | "— (out of scope)" | PASS |
| OS-Pro-finding | "—" | PASS |
| HQ-Renter-label | "— (out of scope: not in HostedQuickReport)" | PASS |
| HQ-Renter-narrative | "—" | PASS |
| HQ-Buyer-label | "— (out of scope)" | PASS |
| HQ-Buyer-narrative | "—" | PASS |
| HQ-Pro-label | "— (out of scope)" | PASS |
| HQ-Pro-narrative | "—" | PASS |
| HF-Renter-label | "Nearest air monitor" | OK | PASS |
| HF-Renter-narrative | "The nearest station the trend below comes from." | concrete | PASS |
| HF-Buyer-label | "Nearest LAWA air station" | OK | PASS |
| HF-Buyer-narrative | regional benchmark frame | defuses misreading | PASS |
| HF-Pro-label | "LAWA air station (nearest)" | OK | PASS |
| HF-Pro-narrative | full method | OK | PASS |

---

### 4. environment.air_pm10_trend

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | LAWA 10-yr PM10 Mann-Kendall trend | NOT-VERIFIABLE (descriptive) | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA | as #3 | — | CONFIRMED |
| 3 | Dataset / endpoint | LAWA Annual Air Quality 2016-2024 | scripts/load_tier3_datasets.py:108 INSERT pm10_trend | line 108 | CONFIRMED |
| 4 | DataSource key | `lawa_air_quality` | not registered; wording file correctly notes | — | CONFIRMED |
| 5 | Table | `air_quality_sites` (col `pm10_trend`) | scripts/load_tier3:108 | INSERT lists `pm10_trend` | CONFIRMED |
| 6 | Query path | 0054:528 | Read | `SELECT site_name, pm10_trend, pm25_trend` | CONFIRMED |
| 7 | Rendered by | report_html.py:1722-1734; "HostedClimate.tsx only renders climate_normals — UNKNOWN no dedicated component" | Grep HostedNeighbourhoodStats.tsx:81 `const airPm10 = env.air_pm10_trend` | line 81 | WRONG — wording claims UNKNOWN; actually rendered at HostedNeighbourhoodStats.tsx:81. Wording file's own conflict list (line 698) acknowledges this contradiction yet the per-indicator block was not corrected. |
| 8 | Threshold logic | risk_score.py:204-210 SEVERITY_AIR_QUALITY Improving=10/Indeterminate=30/Degrading=70 | Not re-read this pass | — | UNVERIFIED — investigate further: open risk_score.py:204-210 |
| 9 | Score contribution | indicator `air_quality`, weight 0.25 | risk_score.py:266 | `"air_quality": 0.25` | CONFIRMED |
| 10 | Coverage | ~80 sites | inherited claim | — | UNVERIFIED |
| 11 | source_key status | present `_src("lawa_air")` at 1733 | Grep | line 1733 | CONFIRMED |

#### Wording cells (18 cells)
| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS-Renter-label | "Air pollution trend" | OK | PASS |
| OS-Renter-finding | "...PM10 has been getting worse over the last decade." | defuses trend≠current | PASS |
| OS-Buyer-label | "PM10 trend (10-yr)" | OK | PASS |
| OS-Buyer-finding | "LAWA flags PM10 as degrading...wood-burner density and any nearby industry." | actionable | PASS |
| OS-Pro-label | "PM10 trend (LAWA)" | OK | PASS |
| OS-Pro-finding | "LAWA `pm10_trend = Degrading` at nearest site (LAWA 10-yr Mann-Kendall); regional, not parcel-specific." | sourced | PASS |
| HQ-Renter-label | "— (out of scope: not in HostedQuickReport)" | PASS |
| HQ-Renter-narrative | "—" | PASS |
| HQ-Buyer-label | "— (out of scope)" | PASS |
| HQ-Buyer-narrative | "—" | PASS |
| HQ-Pro-label | "— (out of scope)" | PASS |
| HQ-Pro-narrative | "—" | PASS |
| HF-Renter-label | "PM10 dust trend" | OK | PASS |
| HF-Renter-narrative | "winter wood smoke is the usual culprit" | concrete | PASS |
| HF-Buyer-label | "PM10 trend (10-year)" | OK | PASS |
| HF-Buyer-narrative | HEPA + chimney action | actionable | PASS |
| HF-Pro-label | "PM10 trend — LAWA 10-yr" | OK | PASS |
| HF-Pro-narrative | full method | thorough | PASS |

---

### 5. environment.air_pm25_trend

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | PM2.5 trend | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA | as #3 | — | CONFIRMED |
| 3 | Dataset / endpoint | same as #4 | — | — | CONFIRMED |
| 4 | DataSource key | `lawa_air_quality` | as #4 | — | CONFIRMED |
| 5 | Table | `air_quality_sites` (col `pm25_trend`) | scripts/load_tier3:108 INSERT | INSERT lists `pm25_trend` | CONFIRMED |
| 6 | Query path | 0054:528 | Read | `pm25_trend` returned | CONFIRMED |
| 7 | Rendered by | report_html.py:1722 fallback | Grep `pm25_trend` in report_html.py:1722 `air_trend = env.get("air_pm10_trend") or env.get("air_pm25_trend")` | line 1722 | CONFIRMED. ALSO rendered at HostedNeighbourhoodStats.tsx:82 (not mentioned by wording file) | WRONG — incomplete (frontend surface omitted) |
| 8 | Threshold logic | same SEVERITY_AIR_QUALITY map | — | — | UNVERIFIED |
| 9 | Score contribution | `air_quality` fallback | risk_score.py:694-695 only reads `air_pm10_trend` | line 694 `if env.get("air_pm10_trend") is not None` | WRONG — risk_score.py only consults pm10_trend; pm25 does NOT feed score as fallback. report_html finding falls back, scoring does not. |
| 10 | Coverage | "UNKNOWN — exact site count for PM2.5 not stated" | reasonable | NOT-VERIFIABLE |
| 11 | source_key status | present via `_src("lawa_air")` (shared finding) | line 1733 | CONFIRMED |

#### Wording cells (18 cells)
| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS-Renter-label | "Fine smoke trend" | plain language | PASS |
| OS-Renter-finding | concrete + winter fires | defuses misreading | PASS |
| OS-Buyer-label | "PM2.5 trend (10-yr)" | OK | PASS |
| OS-Buyer-finding | "PM2.5 is the size that matters most for health" | defuses PM10≠PM2.5 | PASS |
| OS-Pro-label | "PM2.5 trend (LAWA)" | OK | PASS |
| OS-Pro-finding | WHO 5 µg/m³ cited | sourced | PASS |
| HQ-Renter-label | "— (out of scope: not in HostedQuickReport)" | PASS |
| HQ-Renter-narrative | "—" | PASS |
| HQ-Buyer-label | "— (out of scope)" | PASS |
| HQ-Buyer-narrative | "—" | PASS |
| HQ-Pro-label | "— (out of scope)" | PASS |
| HQ-Pro-narrative | "—" | PASS |
| HF-Renter-label | "Fine smoke (PM2.5) trend" | OK | PASS |
| HF-Renter-narrative | "deepest into your lungs" | concrete | PASS |
| HF-Buyer-label | "PM2.5 trend (10-year)" | OK | PASS |
| HF-Buyer-narrative | HEPA action | OK | PASS |
| HF-Pro-label | "PM2.5 trend — LAWA 10-yr" | OK | PASS |
| HF-Pro-narrative | full method + WHO | thorough | PASS |

---

### 6. environment.air_distance_m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | metres to nearest LAWA air site | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA | — | — | CONFIRMED |
| 3 | Dataset / endpoint | as #3 | — | — | CONFIRMED |
| 4 | DataSource key | `lawa_air_quality` | as #3 | — | CONFIRMED |
| 5 | Table | `air_quality_sites` | — | — | CONFIRMED |
| 6 | Query path | 0054:529 ST_Distance | Read | `ST_Distance(geom::geography, addr.geom::geography) AS air_dist` | CONFIRMED |
| 7 | Rendered by | report_html.py:1724,1728 in finding | Read | line 1724 `air_dist = env.get("air_pm10_distance_m") or ... or env.get("air_distance_m")` | CONFIRMED (also HostedNeighbourhoodStats.tsx:83 fallback chain — not mentioned by wording file) |
| 8 | Threshold logic | N/A | — | — | CONFIRMED |
| 9 | Score contribution | — | — | — | CONFIRMED |
| 10 | Coverage | National | — | — | CONFIRMED |
| 11 | source_key status | present via parent `_src("lawa_air")` | line 1733 | CONFIRMED |

#### Wording cells (18 cells)
| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS-Renter-label | "Distance to air monitor" | OK | PASS |
| OS-Renter-finding | "— (no standalone finding rule; surfaced inside the air trend line)" | specific reason | PASS |
| OS-Buyer-label | "Air monitor distance" | OK | PASS |
| OS-Buyer-finding | "— (same)" | PASS |
| OS-Pro-label | "LAWA air site distance (m)" | OK | PASS |
| OS-Pro-finding | "— (same)" | PASS |
| HQ-Renter-label | "— (out of scope: not in HostedQuickReport)" | PASS |
| HQ-Renter-narrative | "—" | PASS |
| HQ-Buyer-label | "— (out of scope)" | PASS |
| HQ-Buyer-narrative | "—" | PASS |
| HQ-Pro-label | "— (out of scope)" | PASS |
| HQ-Pro-narrative | "—" | PASS |
| HF-Renter-label | "Air monitor — how far" | OK | PASS |
| HF-Renter-narrative | "closer means the reading is more relevant" | defuses misreading | PASS |
| HF-Buyer-label | "Distance to nearest air station" | OK | PASS |
| HF-Buyer-narrative | regional indicator framing | OK | PASS |
| HF-Pro-label | "Distance to LAWA air site" | OK | PASS |
| HF-Pro-narrative | "Straight-line geodesic distance...No upwind/downwind weighting." | thorough | PASS |

---

### 7. environment.water_site_name

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | nearest LAWA freshwater site name | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA | — | — | CONFIRMED |
| 3 | Dataset / endpoint | "UNKNOWN — exact loader" | scripts/load_tier3_datasets.py:168 `CREATE TABLE water_quality_sites`, 194 INSERT | line 168, 194 | WRONG — loader IS visible: scripts/load_tier3_datasets.py around line 168-194. Replace UNKNOWN with this citation. |
| 4 | DataSource key | `lawa_water_quality` (per DATA-PROVENANCE) | Grep `"lawa_water_quality"` returns 0 hits in data_loader.py | (no hits) | CONFIRMED (key absent from data_loader.py, loaded via tier3 script) |
| 5 | Table | `water_quality_sites` | line 168 | CONFIRMED |
| 6 | Query path | 0054:533-535 | Read | line 533 `SELECT site_name, ecoli_band, ammonia_band, nitrate_band, drp_band, clarity_band` | CONFIRMED |
| 7 | Rendered by | report_html.py:1738 | Read | line 1738 `water_site = env.get("water_site_name") or env.get("water_site")` | CONFIRMED. Also HostedNeighbourhoodStats.tsx:87 (not mentioned). |
| 8 | Threshold logic | N/A | — | — | CONFIRMED |
| 9 | Score contribution | — | — | — | CONFIRMED |
| 10 | Coverage | ~300 sites (DATA-PROVENANCE) | not re-verified | — | UNVERIFIED |
| 11 | source_key status | present via `_src("lawa_water")` | line 1750 | CONFIRMED |

#### Wording cells (18 cells)
All 18 cells reviewed. OS rows correctly mark surfaced-in-parent. HF labels and narratives address drinking-water-vs-recreational misreading explicitly. PASS for all 18.

---

### 8. environment.water_ecoli_band

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | NPS-FM E.coli band A-E | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA + MfE NPS-FM | — | — | CONFIRMED |
| 3 | Dataset / endpoint | LAWA Water Quality | tier3 script | — | CONFIRMED |
| 4 | DataSource key | `lawa_water_quality` | as #7 | — | CONFIRMED |
| 5 | Table | `water_quality_sites` (col `ecoli_band`) | tier3:194 INSERT | line 194 | CONFIRMED |
| 6 | Query path | 0054:533-535 | Read | line 533 emits `ecoli_band` | CONFIRMED |
| 7 | Rendered by | report_html.py:1736-1751 D/E warn | Read | lines 1736-1751 confirmed | CONFIRMED. NOT consumed in HostedNeighbourhoodStats (only drp_band + ammonia_band are surfaced) — wording file inventory column claim of HostedClimate.tsx is incorrect; actual hosted-full surface is the parent finding text only. |
| 8 | Threshold logic | risk_score.py:212 SEVERITY_WATER_BAND A=5/B=20/C=40/D=65/E=85; report_html:1737 D or E warn | not re-read | — | UNVERIFIED — investigate further: open risk_score.py:212-227 |
| 9 | Score contribution | indicator `water_quality`, weight 0.20, worst-of-five | risk_score.py:266 0.20; risk_score.py:696 `worst_water_band(env)` | line 266, 696 | CONFIRMED |
| 10 | Coverage | ~300 sites | not re-verified | — | UNVERIFIED |
| 11 | source_key status | present `_src("lawa_water")` at 1750 | Grep | line 1750 | CONFIRMED |

#### Wording cells (18 cells)
All 18 cells reviewed. OS-Renter-finding "rated D for E.coli — usually too contaminated to swim in" defuses both drinking-water and band-letter misreadings. PASS all 18.

---

### 9. environment.water_ammonia_band

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | NPS-FM ammoniacal-N toxicity band | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA / MfE NPS-FM | — | — | CONFIRMED |
| 3 | Dataset / endpoint | LAWA Water Quality | — | — | CONFIRMED |
| 4 | DataSource key | `lawa_water_quality` | — | — | CONFIRMED |
| 5 | Table | `water_quality_sites` (col `ammonia_band`) | tier3:194 | INSERT lists `ammonia_band` | CONFIRMED |
| 6 | Query path | 0054:533 | Read | line 533 emits `ammonia_band` | CONFIRMED |
| 7 | Rendered by | "No dedicated finding rule...UNKNOWN — not surfaced as text. HostedClimate.tsx renders only climate_normals" | Grep HostedNeighbourhoodStats.tsx:89 `const waterAmmonia = env.water_ammonia_band` | line 89 | WRONG — IS surfaced at HostedNeighbourhoodStats.tsx:89. Wording file says it is not surfaced; actual frontend reads it. |
| 8 | Threshold logic | `worst_water_band()` risk_score.py:220 | not re-read | — | UNVERIFIED — investigate further: open risk_score.py:212-227 |
| 9 | Score contribution | feeds via worst_water_band | confirmed by risk_score.py:696 call | line 696 | CONFIRMED |
| 10 | Coverage | ~300 sites with attribute variation | UNKNOWN per wording, reasonable | NOT-VERIFIABLE |
| 11 | source_key status | TODO — no dedicated finding line | Grep `_src("lawa_water")` only on parent ecoli rule | confirmed parent only | CONFIRMED (TODO state) |

#### Wording cells (18 cells)
OS rows correctly out-of-scope. HF labels acknowledge ecosystem-toxicity context. However given field 7 (WRONG), HF rows are accurate ("nearest stream") but HQ rows mark out-of-scope despite the field being read by HostedNeighbourhoodStats which is hosted-full not hosted-quick — so HQ out-of-scope is still correct. PASS for all 18 cells **content-wise**, but cells were authored on a false premise about frontend rendering.

---

### 10. environment.water_nitrate_band

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | NPS-FM nitrate-N band | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA/MfE | — | — | CONFIRMED |
| 3 | Dataset / endpoint | LAWA Water Quality | — | — | CONFIRMED |
| 4 | DataSource key | `lawa_water_quality` | — | — | CONFIRMED |
| 5 | Table | `water_quality_sites` (col `nitrate_band`) | tier3:194 | INSERT lists `nitrate_band` | CONFIRMED |
| 6 | Query path | 0054:533 | Read | line 533 emits `nitrate_band` | CONFIRMED |
| 7 | Rendered by | "UNKNOWN — not surfaced standalone" | Grep `nitrate_band` in frontend returns no hits | (no frontend hits) | CONFIRMED — genuinely not surfaced standalone (unlike #9 ammonia which IS surfaced at HostedNeighbourhoodStats) |
| 8 | Threshold logic | `worst_water_band()` risk_score.py:221 | not re-read | — | UNVERIFIED — investigate further |
| 9 | Score contribution | via worst-band | line 696 | CONFIRMED |
| 10 | Coverage | ~300 sites | — | UNVERIFIED |
| 11 | source_key status | TODO — no dedicated finding | confirmed | CONFIRMED |

#### Wording cells (18 cells)
All 18 PASS. HF-Pro narrative correctly distinguishes ecological band from drinking-water 11.3 mg/L MAV.

---

### 11. environment.water_drp_band

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | NPS-FM DRP band | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA/MfE | — | — | CONFIRMED |
| 3 | Dataset / endpoint | LAWA | — | — | CONFIRMED |
| 4 | DataSource key | `lawa_water_quality` | — | — | CONFIRMED |
| 5 | Table | `water_quality_sites` (col `drp_band`) | tier3:194 | INSERT lists `drp_band` | CONFIRMED |
| 6 | Query path | 0054:533 | Read | emits `drp_band` | CONFIRMED |
| 7 | Rendered by | "UNKNOWN — not surfaced standalone" | Grep `waterDrp` in HostedNeighbourhoodStats.tsx:88 `const waterDrp = env.water_drp_band` | line 88 | WRONG — IS surfaced at HostedNeighbourhoodStats.tsx:88 |
| 8 | Threshold logic | `worst_water_band()` risk_score.py:222 | not re-read | — | UNVERIFIED |
| 9 | Score contribution | via worst-band | line 696 | CONFIRMED |
| 10 | Coverage | ~300 sites | — | UNVERIFIED |
| 11 | source_key status | TODO | — | CONFIRMED |

#### Wording cells (18 cells)
HQ rows mark out-of-scope which is correct (drp_band not in HostedQuick); HF rows are written with care. Content-wise PASS, but authored on false premise (drp_band IS surfaced on hosted full, so wording file inventory column for DRP is wrong).

---

### 12. environment.water_clarity_band

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | NPS-FM visual clarity band | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA/MfE | — | — | CONFIRMED |
| 3 | Dataset / endpoint | LAWA | — | — | CONFIRMED |
| 4 | DataSource key | `lawa_water_quality` | — | — | CONFIRMED |
| 5 | Table | `water_quality_sites` (col `clarity_band`) | tier3:194 | INSERT lists `clarity_band` | CONFIRMED |
| 6 | Query path | 0054:533 | Read | emits `clarity_band` | CONFIRMED |
| 7 | Rendered by | "UNKNOWN — not surfaced standalone" | Grep returns no frontend hits for `clarity_band` | (no hits) | CONFIRMED |
| 8 | Threshold logic | `worst_water_band()` risk_score.py:223 | not re-read | — | UNVERIFIED |
| 9 | Score contribution | via worst-band | — | CONFIRMED |
| 10 | Coverage | ~300 sites | — | UNVERIFIED |
| 11 | source_key status | TODO | — | CONFIRMED |

#### Wording cells (18 cells)
All 18 PASS. Narratives defuse "clarity ≠ cleanliness" misreading.

---

### 13. environment.water_distance_m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | metres to nearest LAWA freshwater site | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | LAWA | — | — | CONFIRMED |
| 3 | Dataset / endpoint | as #7 | — | — | CONFIRMED |
| 4 | DataSource key | `lawa_water_quality` | — | — | CONFIRMED |
| 5 | Table | `water_quality_sites` | — | — | CONFIRMED |
| 6 | Query path | 0054:534-535 | Read | `ST_Distance(...) AS water_dist` | CONFIRMED |
| 7 | Rendered by | report_html.py:1739,1745 | Read | line 1739 `water_dist = env.get("water_distance_m")` | CONFIRMED. Also HostedNeighbourhoodStats.tsx:90. |
| 8 | Threshold logic | N/A | — | — | CONFIRMED |
| 9 | Score contribution | — | — | — | CONFIRMED |
| 10 | Coverage | National | — | — | CONFIRMED |
| 11 | source_key status | present via parent `_src("lawa_water")` | line 1750 | CONFIRMED |

#### Wording cells (18 cells)
All 18 PASS. Sub-catchment caveat in HF-Pro narrative is accurate.

---

### 14. environment.climate_temp_change

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | ΔT 2041-60 SSP2-4.5 ensemble mean | NOT-VERIFIABLE descriptive; SQL agrees | — | NOT-VERIFIABLE |
| 2 | Source authority | NIWA + MfE | — | — | CONFIRMED |
| 3 | Dataset / endpoint | scripts/load_climate_projections.py:1 | Grep | line 41 `CREATE TABLE climate_projections` | CONFIRMED |
| 4 | DataSource key | `niwa_climate_projections` (per DATA-PROVENANCE; not registered) | Grep `"niwa_climate_projections"` in data_loader.py returns 0 hits | (no hits) | CONFIRMED (not a registered DataSource — wording correctly notes) |
| 5 | Table | `climate_projections` joined to `climate_grid` on `vcsn_agent=agent_no` | 0054:540-543 | line 540-543 | CONFIRMED |
| 6 | Query path | 0054:537-544 AVG(T_value_change) ssp245 ANNUAL | Read | line 538 `AVG("T_value_change") AS temp_change` | CONFIRMED |
| 7 | Rendered by | report_html.py:1808-1820, RiskHazardsSection.tsx:127 ClimateForecastCard | Read 1808; Grep RiskHazardsSection.tsx:126-127 `<ClimateForecastCard projection={{ temp_change: environment.climate_temp_change, ...}} />` | line 1808, 1819; RiskHazardsSection.tsx:126-127 | CONFIRMED. Also HostedNeighbourhoodStats.tsx:94 (not mentioned). |
| 8 | Threshold logic | report_html.py:1814 ≥2.0; risk normalize_min_max(0, 3.0) | Read | line 1814 `if climate_change is not None and climate_change >= 2.0`; risk_score.py:697 `normalize_min_max(env.get("climate_temp_change"), 0, 3.0)` | CONFIRMED |
| 9 | Score contribution | indicator `climate`, weight 0.15 | risk_score.py:267 | `"climate": 0.15` | CONFIRMED |
| 10 | Coverage | National VCSN ~2.6M cells | DATA-PROVENANCE; graph.json:785 confirms ~2.6M rows | "climate_projections (2.6M)" | CONFIRMED |
| 11 | source_key status | present `_src("niwa_climate")` at 1819 | Grep | line 1819 | CONFIRMED |

#### Wording cells (18 cells)
All 18 PASS. SSP2-4.5 framed as middle-of-road; 20-year mean projection caveat present in renter narrative.

---

### 15. environment.climate_precip_change_pct

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | %ΔP 2041-60 SSP2-4.5 | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | NIWA + MfE | — | — | CONFIRMED |
| 3 | Dataset / endpoint | as #14 | — | — | CONFIRMED |
| 4 | DataSource key | `niwa_climate_projections` | as #14 | — | CONFIRMED |
| 5 | Table | `climate_projections` (col `PR_value_change`) | scripts/load_climate_projections.py:41 CREATE TABLE includes column | line 58 column list | CONFIRMED |
| 6 | Query path | 0054:539 AVG(PR_value_change) | Read | line 539 `AVG("PR_value_change") AS precip_change` | CONFIRMED |
| 7 | Rendered by | report_html.py:2219; RiskHazardsSection.tsx:127 ClimateForecastCard `precip_change_pct` | Read 2219; Read RiskHazardsSection.tsx:127 confirmed | line 2219, RiskHazardsSection.tsx:127 | CONFIRMED. Also HostedNeighbourhoodStats.tsx:95. |
| 8 | Threshold logic | "UNKNOWN — no explicit threshold" | Read 2219-2235: actually thresholds ARE explicit (`>= 5` warn rising; `<= -5` warn drying; else skip) | line 2220 `if climate_precip_pct is not None and climate_precip_pct >= 5` | WRONG — wording claims UNKNOWN; threshold IS explicit at ±5%. Also branch is bidirectional (rise vs fall), wording does not capture drying branch. |
| 9 | Score contribution | not directly scored | risk_score.py: not in WEIGHTS_ENVIRONMENT loop | not present | CONFIRMED |
| 10 | Coverage | National | — | CONFIRMED |
| 11 | source_key status | "TODO — line 2219 not confirmed to attach `_src(niwa_climate)`. UNKNOWN — needs verification." | Read 2220-2235: no `_src(...)` call attached; line is composed into a flood_minor rec, not a standalone Insight | confirmed no _src call | CONFIRMED — verdict TODO is correct (no _src attached); but wording's hedge "UNKNOWN — needs verification" should be updated to a definitive "TODO — line 2219 produces narrative for flood rec, no Insight emitted" |

#### Wording cells (18 cells)
All 18 cells use rising +4% example. The actual code branches on direction (could be drying). HF-Pro narrative correctly notes "no extreme-rainfall metric". OS-Renter correctly defuses annual-vs-extreme. PASS for content; consider adding a drying-branch counterpart sentence given report_html.py:2226-2231 emits a different narrative when ≤ -5%.

---

### 16. climate_normals (snapshot)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | 1991-2020 monthly normals | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | NIWA | — | — | CONFIRMED |
| 3 | Dataset / endpoint | DataSource `climate_normals` at data_loader.py:4886 (60 cities) | Grep `"climate_normals"` data_loader.py:4886 | line 4886 `"climate_normals", "Climate Normals 1991-2020 (60 cities. temp, rain, sun, wind)"` | CONFIRMED |
| 4 | DataSource key | `climate_normals` | Grep | line 4886 | CONFIRMED |
| 5 | Table | `climate_normals` | migrations/0035:25 CREATE TABLE | confirmed | CONFIRMED |
| 6 | Query path | snapshot_generator.py:944; not in get_property_report | Read | line 944 `"climate_normals": climate_normals,` | CONFIRMED |
| 7 | Rendered by | HostedClimate.tsx:24-... | Grep `HostedClimate.tsx:25 const data = snapshot.climate_normals` | line 25 | CONFIRMED |
| 8 | Threshold logic | N/A | — | — | CONFIRMED |
| 9 | Score contribution | — | not scored | — | CONFIRMED |
| 10 | Coverage | 60 cities | DataSource description string | line 4886 | CONFIRMED |
| 11 | source_key status | TODO — snapshot blob, no Insight wired | confirmed | — | CONFIRMED |

#### Wording cells (18 cells)
All 18 PASS. HF narratives correctly distinguish historical normals from projections.

---

### 17. environment.contam_nearest_name

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | nearest contam-register entry name within 2 km | NOT-VERIFIABLE descriptive | — | NOT-VERIFIABLE |
| 2 | Source authority | regional councils (SLUR) + MfE; HAIL | DATA-PROVENANCE; data_loader.py:4944 GWRC SLUR (claim) | (need verify) | UNVERIFIED — investigate further: confirm data_loader.py:4944 is GWRC SLUR DataSource |
| 3 | Dataset / endpoint | "contaminated_land DataSource at data_loader.py:4944" + 9 regional loaders at listed lines | Grep `"contaminated_land"` returns multiple hits but exact line numbers not re-grepped this pass | — | UNVERIFIED — investigate further: re-grep `"contaminated_land"` against listed lines (5678, 5807, 6334, 6350, 7574, 9301, 9628, 9741, 10611) |
| 4 | DataSource key(s) | `contaminated_land` (GWRC) + per-region keys, "varies" | data_loader.py:4008 INSERT `contaminated_land (northland)` confirms region-tagged loader pattern | line 4008 | CONFIRMED (pattern); per-region key list UNVERIFIED |
| 5 | Table | `contaminated_land` | scripts/load_tier4_datasets.py:261 CREATE TABLE | line 261 | CONFIRMED |
| 6 | Query path | 0054:545-552 LATERAL nearest within 2 km | Read | line 545-552 confirmed | CONFIRMED |
| 7 | Rendered by | report_html.py:1760, RiskHazardsSection.tsx (HazardCards), HostedHazardAdvice.tsx | Read 1760; Grep HostedNeighbourhoodStats.tsx:70 `const contamName = env.contam_nearest_name` | line 70 | CONFIRMED for report_html and HostedNeighbourhoodStats. Wording cites HostedHazardAdvice.tsx — UNVERIFIED — investigate further: grep HostedHazardAdvice.tsx for contam_nearest_name |
| 8 | Threshold logic | "2 km radius envelope; finding triggers ≤500m or ≤200m — see #19" | Read | confirmed at 1759 | CONFIRMED |
| 9 | Score contribution | — label only | — | — | CONFIRMED |
| 10 | Coverage | "Wellington, Upper Hutt, Hawke's Bay, BOP, Gisborne, Taranaki, Southland, Wairarapa, Northland (per WIRING-TRACES:249); Auckland/Christchurch UNKNOWN" | not re-verified this pass | — | UNVERIFIED |
| 11 | source_key status | present `_src("council_slur")` at 1789, 1797, 1805 | Grep | three hits | CONFIRMED |

#### Wording cells (18 cells)
All 18 PASS. OS-Renter defuses regulatory-listing-vs-active-hazard misreading.

---

### 18. environment.contam_nearest_category

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | ANZECC A/B/C/D or full HAIL string | report_html.py:1770-1773 comments confirm full HAIL strings | comment block | CONFIRMED |
| 2 | Source authority | councils (SLUR) + MfE | — | — | CONFIRMED |
| 3 | Dataset / endpoint | as #17 | — | — | UNVERIFIED |
| 4 | DataSource key | varies (as #17) | — | — | UNVERIFIED |
| 5 | Table | `contaminated_land` (col `anzecc_category`) | scripts/load_tier4:261 schema; report_html cat = env.get("contam_nearest_category") | confirmed | CONFIRMED |
| 6 | Query path | 0054:546 | Read | line 546 `anzecc_category AS cat` | CONFIRMED |
| 7 | Rendered by | report_html.py:1761,1765 (ANZECC_EXPLANATIONS) | Read | line 1761 `cat = env.get("contam_nearest_category")`, 1765 `(ANZECC Category {cat}. {cat_exp})` | CONFIRMED. Also HostedNeighbourhoodStats.tsx:72 |
| 8 | Threshold logic | risk_score.py:98-111 contamination_score(); HIGH_RISK keywords; cemetery/waste 0.6 | report_html.py:1774-1781 keywords match — confirmed for finding gating | line 1774 HIGH_RISK_KEYWORDS | CONFIRMED for report_html; risk_score.py:98-111 UNVERIFIED — investigate further |
| 9 | Score contribution | indicator `contaminated_land`, weight 0.10, distance × severity | risk_score.py:267 `"contaminated_land": 0.10`; line 698-700 `contamination_score(env.get("contam_nearest_distance_m"), env.get("contam_nearest_category"))` | confirmed | CONFIRMED |
| 10 | Coverage | as #17 | — | UNVERIFIED |
| 11 | source_key status | present `_src("council_slur")` | three hits at 1789/1797/1805 | CONFIRMED |

#### Wording cells (18 cells)
All 18 PASS. Cat A/D inversion misreading defused in OS-Renter.

---

### 19. environment.contam_nearest_distance_m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | metres to nearest contam entry within 2 km | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | as #17 | — | — | CONFIRMED |
| 3 | Dataset / endpoint | as #17 | — | — | UNVERIFIED |
| 4 | DataSource key(s) | varies | — | — | UNVERIFIED |
| 5 | Table | `contaminated_land` | — | — | CONFIRMED |
| 6 | Query path | 0054:547 | Read | line 547 `ST_Distance(geom::geography, addr.geom::geography) AS dist` | CONFIRMED |
| 7 | Rendered by | report_html.py:1753-1806; RiskHazardsSection.tsx:230 | Read 1753; Grep RiskHazardsSection.tsx | line 1753 | CONFIRMED for report_html; RiskHazardsSection.tsx:230 UNVERIFIED — investigate further: open RiskHazardsSection.tsx:230 |
| 8 | Threshold logic | report_html.py:1759 ≤500 envelope; tiers: ≤500+high-hazard warn, ≤200+cemetery/waste info, ≤200 otherwise warn | Read | lines 1759-1806 confirm three branches | CONFIRMED |
| 9 | Score contribution | `contamination_score(distance_m, category)` linear decay 0..2000 × severity | risk_score.py:698 confirms call | line 698 | CONFIRMED. Linear-decay claim UNVERIFIED — investigate further (open risk_score.py:98-111) |
| 10 | Coverage | as #17 | — | UNVERIFIED |
| 11 | source_key status | present `_src("council_slur")` at 1789/1797/1805 | Grep | confirmed | CONFIRMED |

#### Wording cells (18 cells)
All 18 PASS. OS-Pro narrative computes example score `(1-180/2000)×100×0.8≈73` which assumes the documented linear-decay formula — UNVERIFIED until risk_score.py:98-111 is read. Marking content PASS but flagging the math example as derived.

---

### 20. environment.contam_count_2km

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | count within 2 km | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | as #17 | — | — | CONFIRMED |
| 3 | Dataset / endpoint | as #17 | — | — | UNVERIFIED |
| 4 | DataSource key(s) | varies | — | — | UNVERIFIED |
| 5 | Table | `contaminated_land` | — | — | CONFIRMED |
| 6 | Query path | 0054:553-557 COUNT(*) ST_DWithin 2000 | Read | line 553-557 confirmed | CONFIRMED |
| 7 | Rendered by | report_html.py:1763, RiskHazardsSection.tsx:230 | Read 1763 `count_2km = env.get("contam_count_2km")`; HostedNeighbourhoodStats.tsx:69 also reads it | confirmed | CONFIRMED for report_html and HostedNeighbourhoodStats; RiskHazardsSection.tsx:230 UNVERIFIED |
| 8 | Threshold logic | "no standalone threshold" | confirmed (only used as supporting context) | — | CONFIRMED |
| 9 | Score contribution | — does not feed risk score independently | confirmed; nearest distance + category drives indicator | risk_score.py:698 | CONFIRMED |
| 10 | Coverage | as #17 | — | UNVERIFIED |
| 11 | source_key status | present via parent `_src("council_slur")` | confirmed | CONFIRMED |

#### Wording cells (18 cells)
All 18 PASS. Severity-not-equal-count caveat present.

---

### 21. environment.in_corrosion_zone

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | boolean inside WCC mapped corrosion zone | NOT-VERIFIABLE descriptive | — | NOT-VERIFIABLE |
| 2 | Source authority | Wellington City Council | data_loader.py:4989 description "WCC Corrosion Zones" | line 4989 | CONFIRMED |
| 3 | Dataset / endpoint | WCC ArcGIS; loader at data_loader.py:1169; DataSource at 4989 | Grep load_corrosion_zones — line 1169; "corrosion_zones" — line 4989 | confirmed | CONFIRMED |
| 4 | DataSource key | `corrosion_zones` | Grep `"corrosion_zones"` | line 4989 | CONFIRMED |
| 5 | Table | `corrosion_zones` | data_loader.py:1186 INSERT | line 1186 `INSERT INTO corrosion_zones (contour, buff_dist, geom)` | CONFIRMED |
| 6 | Query path | 0054:559-562 ST_Intersects | Read | line 559-562 | CONFIRMED |
| 7 | Rendered by | RiskHazardsSection.tsx; HostedNeighbourhoodStats.tsx:134; HostedHazardAdvice.tsx | Grep HostedNeighbourhoodStats.tsx:134 confirmed | line 134 `const inCorrosionZone = env.in_corrosion_zone as boolean` | CONFIRMED for HostedNeighbourhoodStats; RiskHazardsSection + HostedHazardAdvice UNVERIFIED — investigate further: grep these files for `in_corrosion_zone` |
| 8 | Threshold logic | boolean | — | — | CONFIRMED |
| 9 | Score contribution | "no risk_score indicator; not in WEIGHTS_ENVIRONMENT" | risk_score.py:265-267 list does not include corrosion | confirmed | CONFIRMED |
| 10 | Coverage | Wellington City only; default `coalesce(...,false)` at SQL line 517 | Read 0054:517 `'in_corrosion_zone', coalesce(corr.in_zone, false)` | line 517 | CONFIRMED |
| 11 | source_key status | TODO — no `_src("wcc_corrosion")` Insight | Grep returns 0 hits | confirmed | CONFIRMED |

#### Wording cells (18 cells)
All 18 reviewed. OS-Renter correctly out-of-scope (no rule fires). HF narratives defuse `false`-outside-Wellington = "no data, not no risk" misreading. PASS all 18.

---

### 22. environment.in_rail_vibration_area

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | boolean inside WCC rail-vibration overlay | NOT-VERIFIABLE | — | NOT-VERIFIABLE |
| 2 | Source authority | WCC DP 2024 | data_loader.py:5009 "WCC Rail Vibration Advisory" | line 5009 | CONFIRMED |
| 3 | Dataset / endpoint | WCC DP layer; loader at 1293; DataSource at 5009 | Grep load_rail_vibration line 1293; "rail_vibration" line 5009 | confirmed | CONFIRMED |
| 4 | DataSource key | `rail_vibration` (not `wcc_rail_vibration`) | Grep `"rail_vibration"` | line 5009 (key is `rail_vibration`, NOT `wcc_rail_vibration`) | CONFIRMED — wording correctly notes inventory's `wcc_rail_vibration` claim is informal |
| 5 | Table | `rail_vibration` | data_loader.py:1310 INSERT | line 1310 `INSERT INTO rail_vibration (noise_area, noise_area_type, eplan_category, geom)` | CONFIRMED |
| 6 | Query path | 0054:564-567 ST_Intersects | Read | line 564-567 | CONFIRMED |
| 7 | Rendered by | report_html.py:2336 (noise stack rec); RiskHazardsSection.tsx; HostedHazardAdvice.tsx | Read 2336 confirmed `_rail_vib = env.get("in_rail_vibration_area")`; Grep RiskHazardsSection — no hits found in this audit | line 2336 confirmed | WRONG — RiskHazardsSection.tsx hit not confirmed; only report_html.py:2336 verified. HostedHazardAdvice.tsx UNVERIFIED. |
| 8 | Threshold logic | boolean; no standalone Insight; line 2346 adds string into cumulative noise rec | Read 2346 confirmed `_noise_extras.append("rail vibration advisory area")` | line 2346 | CONFIRMED |
| 9 | Score contribution | no risk_score indicator | confirmed | — | CONFIRMED |
| 10 | Coverage | Wellington City only; "no `ac_rail_vibration` DataSource was found" | Grep `"ac_rail_vibration"` returns 0 hits in data_loader.py | (no hits) | CONFIRMED |
| 11 | source_key status | TODO — no dedicated `_src("wcc_rail_vibration")` Insight | Grep returns 0 hits | confirmed | CONFIRMED |

#### Wording cells (18 cells)
OS-Renter out-of-scope correct (rule does not fire standalone). HF narratives correctly characterise it as a planning trigger, not a measured intensity. PASS all 18.

---

### 23. environment.rail_vibration_type

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | WCC `noise_area_type` sub-zone | data_loader.py:1310 INSERT lists `noise_area_type` | line 1310 | CONFIRMED |
| 2 | Source authority | WCC | as #22 | — | CONFIRMED |
| 3 | Dataset / endpoint | as #22 | — | — | CONFIRMED |
| 4 | DataSource key | as #22 (`rail_vibration`) | — | — | CONFIRMED |
| 5 | Table | `rail_vibration` (col `noise_area_type`) | line 1310 | CONFIRMED |
| 6 | Query path | 0054:565 | Read | line 565 `noise_area_type` | CONFIRMED |
| 7 | Rendered by | hosted-full via HostedHazardAdvice.tsx; "Not surfaced standalone in report_html.py" | Grep `rail_vibration_type` returns no frontend hits in this audit | (no hits) | UNVERIFIED — investigate further: HostedHazardAdvice.tsx not opened; if no hits, the inventory column is wrong and indicator is not surfaced anywhere. |
| 8 | Threshold logic | "UNKNOWN — exact noise_area_type enumeration not visible" | reasonable | — | NOT-VERIFIABLE |
| 9 | Score contribution | — | — | — | CONFIRMED |
| 10 | Coverage | Wellington City only | — | CONFIRMED |
| 11 | source_key status | TODO | — | CONFIRMED |

#### Wording cells (18 cells)
OS-row out-of-scope correct. HF rows are speculative since rendering surface is unverified. PASS all 18 cells content-wise; HF rows depend on field 7 verification.

---

## Tally

Counting Meaning-block fields across 23 indicators × 11 fields = **253 rows**.

| | Confirmed | Wrong | Unverified | Not-verifiable |
|---|---|---|---|---|
| Meaning-block (253) | 161 | 8 | 39 | 45 |

WRONG row breakdown (8):
1. #3 field 7 — air_site_name claimed UNKNOWN frontend; actually rendered HostedNeighbourhoodStats.tsx:80
2. #4 field 7 — air_pm10_trend claimed UNKNOWN frontend; rendered at HostedNeighbourhoodStats.tsx:81
3. #5 field 7 — air_pm25_trend missing HostedNeighbourhoodStats.tsx:82
4. #5 field 9 — pm25 falsely described as scoring fallback; risk_score.py only reads pm10
5. #7 field 3 — water site loader marked UNKNOWN; visible at scripts/load_tier3_datasets.py:168
6. #9 field 7 — water_ammonia_band claimed not surfaced; HostedNeighbourhoodStats.tsx:89
7. #11 field 7 — water_drp_band claimed UNKNOWN; HostedNeighbourhoodStats.tsx:88
8. #15 field 8 — climate_precip threshold marked UNKNOWN; explicitly ±5% at report_html.py:2220-2231

UNVERIFIED row breakdown (39): primarily Coverage rows (10), Threshold-logic rows that cite risk_score.py:204-227 / 98-111 not re-read this pass (5), per-region contam loader line numbers (3 indicators × 2-3 fields = 9), HostedHazardAdvice.tsx / RiskHazardsSection.tsx hits not verified (8), data_loader.py:4944 GWRC SLUR specific line (3), and a handful of inherited-from-#7 / #17 cascades (4).

NOT-VERIFIABLE row breakdown (45): every "What it measures" descriptive field (23) plus several "Coverage" / "Threshold logic" / "What it does NOT tell you" entries that are inherently inferential.

| | PASS | FAIL |
|---|---|---|
| Cells (23 × 18 = 414) | 414 | 0 |

No FAIL on cells: every out-of-scope cell carries a specific reason, every in-scope cell is a single sentence in the right register with at least one defusal of the documented misreading. (However note that 6 indicators have content authored on a false rendering premise — see WRONG findings — which means HF rows in those indicators may need re-grounding once the inventory is corrected.)

## Flagged rows requiring fix

| Indicator | Field | Current claim | Required fix |
|---|---|---|---|
| #3 air_site_name | Rendered by | "UNKNOWN — no dedicated frontend field" | Replace with `HostedNeighbourhoodStats.tsx:80` (and report_html.py:1722-1734 already noted) |
| #4 air_pm10_trend | Rendered by | "UNKNOWN — frontend HostedClimate.tsx only renders climate_normals" | Replace with `HostedNeighbourhoodStats.tsx:81`; remove the (already self-contradicted at line 698) UNKNOWN |
| #5 air_pm25_trend | Rendered by | "fallback when pm10_trend is null" only | Add `HostedNeighbourhoodStats.tsx:82`; ALSO note that risk_score.py only reads pm10 — pm25 is NOT a scoring fallback (only a finding-text fallback) |
| #5 air_pm25_trend | Score contribution | "indicator air_quality (fallback when pm10 missing)" | Correct to: pm25 does not feed risk_score; only `air_pm10_trend` is read at risk_score.py:694. The fallback is in report_html only (finding text). |
| #7 water_site_name | Dataset / endpoint | "UNKNOWN — exact loader for water_quality_sites; structurally analogous" | Replace with `scripts/load_tier3_datasets.py:168` (CREATE TABLE) and `:194` (INSERT) |
| #9 water_ammonia_band | Rendered by | "UNKNOWN — not surfaced as text. HostedClimate.tsx renders only climate_normals" | Replace with `HostedNeighbourhoodStats.tsx:89` |
| #11 water_drp_band | Rendered by | "UNKNOWN — not surfaced standalone" | Replace with `HostedNeighbourhoodStats.tsx:88` |
| #15 climate_precip_change_pct | Threshold | "UNKNOWN — no explicit threshold lives in the env-rule block" | Replace with: `report_html.py:2220` ≥+5% rising-rainfall narrative; `:2226` ≤-5% drying narrative; otherwise skipped. Bidirectional. |
| #15 climate_precip_change_pct | source_key status | "TODO ... UNKNOWN — needs verification" | Sharpen to definitive TODO: line 2219-2235 emits narrative inside flood_minor recommendation, not a standalone Insight, so no `_src(...)` is attached by design. |
| #17 contam_nearest_name | Dataset / endpoint regional list | 9 regional loader lines (5678, 5807, 6334, 6350, 7574, 9301, 9628, 9741, 10611) | Re-grep each line against current `data_loader.py` and either confirm or correct. Line numbers were not re-verified this pass. |
| #19 contam_nearest_distance_m | Score contribution | "linear decay 0..2000 m × severity multiplier" | Investigate further: open `risk_score.py:98-111` to confirm linear-decay formula. The OS-Pro example math `(1-180/2000)×100×0.8≈73` depends on this. |
| #22 in_rail_vibration_area | Rendered by | "RiskHazardsSection.tsx; hosted-full via HostedHazardAdvice.tsx" | Investigate further: this audit only verified `report_html.py:2336`. Grep both frontend files for `in_rail_vibration_area` to confirm or remove. |
| #23 rail_vibration_type | Rendered by | "hosted-full via HostedHazardAdvice.tsx" | Investigate further: grep returned no frontend hits for `rail_vibration_type` in this audit. If genuinely none, the indicator is unrendered and the wording file should mark all six HF cells out-of-scope. |
| Inventory header | section count summary | inventory line 27 "Environment | 24" | Acknowledge in `_INVENTORY.md`: 23 actual rows, 24 claimed. Either add the missing indicator (none currently identified) or correct the summary to 23. The wording file already flags this in its conflict list. |

## Cross-cutting notes

1. **HostedNeighbourhoodStats.tsx is the actual hosted-full surface for env.air_*/water_*/contam/in_corrosion_zone/climate_temp_change/climate_precip_change_pct.** The wording file's conflict list at line 698 acknowledges this but the per-indicator Rendered-by fields have not been updated to match. This affects 6 indicators directly (#3, #4, #5, #9, #11, plus secondary mentions in #14, #15) and is the largest single category of WRONG findings.

2. **lawa_air_quality and lawa_water_quality are NOT registered DataSources** — they are bulk-loaded by `scripts/load_tier3_datasets.py`. The wording file correctly flags this, but agents reading the audit should not expect a `Grep '"lawa_air_quality"'` against `data_loader.py` to succeed. Source attribution still works through the `_src("lawa_air")` / `_src("lawa_water")` keys in `report_html.py`, which are independent from the DataSource registry.

3. **niwa_climate_projections is NOT a registered DataSource** either — bulk-loaded by `scripts/load_climate_projections.py`. The `_src("niwa_climate")` key at `report_html.py:1819` is the only source attribution surface.

4. **Inventory column "DataSource key(s)" disagrees with code in 3 places** that the wording file captures correctly: (a) `branz_corrosion` should be `corrosion_zones`, (b) `wcc_rail_vibration` should be `rail_vibration`, (c) `ac_rail_vibration` does not exist in `data_loader.py`. These are inventory-level fixes, not wording-file fixes.

5. **`environment.water_ecoli_band`, `_nitrate_band`, `_clarity_band` are NOT consumed in any frontend component** — only `_drp_band` and `_ammonia_band` are read in `HostedNeighbourhoodStats.tsx:88-89`. The wording file's HF narratives for ecoli/nitrate/clarity describe an experience that is currently delivered only through report_html.py finding text (which itself only fires for ecoli, not the other two). Either the frontend should be extended, or the HF cells for nitrate/clarity should be marked out-of-scope until a hosted-full surface exists.
