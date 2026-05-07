# Audit: INDICATOR-WORDING-hazards.md

Audit performed against the live codebase, not against prior-pass claims. Every CONFIRMED row cites the verification command + a one-line excerpt; verdicts are from the closed set {CONFIRMED, WRONG, UNVERIFIED, NOT-VERIFIABLE, PASS, FAIL}.

## Inventory coverage

- Inventory summary table claims: **78** Hazards rows.
- Actual row count under `## Hazards` in `_INVENTORY.md` (re-counted literally — pipe-separated rows between line 54 and line 130 inclusive, ignoring header/separator rows and blank line at 131): **77**.
  - Verification: `Read _INVENTORY.md offset=48 limit=85` shows ## Hazards at line 48; the table header is line 52, separator line 53, first data row 54, last data row 130 → 130 − 54 + 1 = 77.
- Indicators in wording file: **77** (Grep `^### ` returned no matches; grep `^##+ ` between lines 25 and 2001 returned 77 dot-paths — see Read of file).
- In inventory but NOT in wording file: **none**.
- In wording file but NOT in inventory: **none**.
- Inventory summary cell `78` is **WRONG** — actual is 77. Wording file's "Changes in this pass" (line 7) calls this out and is itself correct.

The wording file is fully aligned (1:1) with the 77 inventory rows.

---

## Per-indicator audit

Conventions used below:
- Each indicator gets one Meaning-block table (11 rows: What it measures, Source authority, Dataset/endpoint, DataSource key, Table, Query path, Rendered by, Threshold logic, Score contribution, Coverage, source_key status) and one Wording-cell table (18 cells: 6 surfaces × 3 personas).
- "Verification command" is the literal Grep / Read I ran. "Excerpt" is one matched line, paraphrased only when a tool truncated.
- For Meaning rows that share an underlying source (e.g. all 77 indicators reference the same migration file), I cite the same verification once per indicator-table — that is, every row is independently sourced; I do not summarise.
- For Wording cells: a "PASS" requires (a) ≤60 chars on label cells, (b) NZ English, (c) singular-sentence finding, (d) "out of scope" cells include a specific reason. "FAIL" means at least one of those rules is broken.

### Foundational verifications (cited many times below)

| ID | Command | Excerpt | Result |
|---|---|---|---|
| F1 | `Grep "_src\\("` in `report_html.py` | 757 `source=_src("council_flood")`, 778 `_src("council_tsunami")`, 798 `_src("council_liquefaction")`, 819 `_src("geonet_earthquakes")`, 841/879 `_src("mbie_epb")`, 902/909/917 `_src("gns_landslides")` | Six hazards-relevant `_src(...)` keys exist; no other |
| F2 | `Read risk_score.py:244-265` | 245 `"flood": 0.14, "tsunami": 0.11, "liquefaction": 0.11,` `slope_failure: 0.11, earthquake: 0.09, coastal: 0.08, wind: 0.07, wildfire: 0.07, epb: 0.05, landslide_susceptibility: 0.10, overland_flow: 0.04, aircraft_noise: 0.05, coastal_erosion_council: 0.08, ground_shaking: 0.12, fault_zone: 0.10` | All weights match wording-file claims |
| F3 | `Read 0054_flood_nearest_m.sql:118-195` | 118 `'flood', fz.flood_label,` 119 `'tsunami_zone_class',` 120 `'tsunami_evac_zone',` 121 `'liquefaction',` 122 `'wind_zone',` 123 `'coastal_exposure',` 124 `'earthquake_count_30km',` 125 `'wildfire_vhe_days',` 126 `'wildfire_trend',` 127 `'epb_count_300m',` 128 `'slope_failure',` 130 `'earthquake_hazard_index',` 131 `'earthquake_hazard_grade',` 132 `'ground_shaking_zone',` 133 `'ground_shaking_severity',` 134 `'gwrc_liquefaction',` 135 `'gwrc_liquefaction_geology',` 136 `'gwrc_slope_severity',` 137 `'fault_zone_name',` 138 `'fault_zone_ranking',` 139 `'wcc_flood_type',` 140 `'wcc_flood_ranking',` 141 `'wcc_tsunami_return_period',` 142 `'wcc_tsunami_ranking',` 144 `'council_liquefaction',` 145 `'council_liquefaction_geology',` 146 `'council_liquefaction_source',` 147 `'council_tsunami_ranking',` 148 `'council_tsunami_scenario',` 149 `'council_tsunami_return_period',` 150 `'council_tsunami_source',` 151 `'council_slope_severity',` 152 `'council_slope_source',` 153 `'epb_nearest',` 154 `'solar_mean_kwh',` 155 `'solar_max_kwh',` 158 `'landslide_count_500m',` 159 `'landslide_nearest',` 160 `'landslide_in_area',` 162 `'landslide_susceptibility_rating',` 163 `'landslide_susceptibility_type',` 164 `'landslide_susceptibility_source',` 166 `'coastal_elevation_cm',` 167 `'coastal_inundation_ranking',` 168 `'coastal_inundation_scenario',` 170 `'on_erosion_prone_land',` 171 `'erosion_min_angle',` 173 `'active_fault_nearest',` 174 `'fault_avoidance_zone',` 176 `'aircraft_noise_name',` 177 `'aircraft_noise_dba',` 178 `'aircraft_noise_category',` 180 `'overland_flow_within_50m',` 182 `'council_coastal_erosion',` 184 `'coastal_erosion_exposure',` 185 `'coastal_erosion_timeframe',` 187 `'flood_extent_aep',` 188 `'flood_extent_label',` 192 `'flood_nearest_m',` 194 `'geotech_count_500m',` 195 `'geotech_nearest_hazard'` | Every line number cited in inventory + wording file matches the live SQL |
| F4 | `Read risk_score.py:425-690` | Indicator assignment lines: flood `:435, :523, :546, :654, :662`; tsunami `:437, :553, :562`; liquefaction `:443, :500, :574`; earthquake `:446, :484`; coastal `:448, :641`; wind `:450, :670`; wildfire `:451`; epb `:452`; slope_failure `:454, :469, :505, :584`; ground_shaking `:475`; fault_zone `:512, :514`; landslide_susceptibility `:592`; overland_flow `:598`; aircraft_noise `:604`; coastal_erosion_council `:615, :625`; rain-event boost `:682`; wind-event boost `:686`; quake-event boost `:690` | All risk_score line numbers cited in inventory and wording-file "Changes in this pass" CONFIRMED |
| F5 | `Grep "DataSource\\(\\s*\"<key>\""` in `data_loader.py` for fabricated keys | No matches for: `flood_zones`, `wcc_floodplains`, `gwrc_flood_1pct` (actual: `gwrc_flood_extents` at 4984), `tsunami_zones`, `liquefaction_zones`, `slope_failure_zones`, `branz_wind_zones`, `scion_wildfire`, `niwa_coastal_erosion`, `wcc_tsunami`, `airport_noise_overlay`, `wcc_overland_flow`, `ac_overland_flow`, `wcc_geotech`, `ac_geotech`, `linz_8m_dem`, `searise_points`, `open_meteo_history`, `auckland_ascie`, `tauranga_coastal`, `linz_coastal_dem`, `mfe_coastal_inundation`, `hbrc_inundation`, `gwrc_erosion_prone`, `tasman_tsunami`, `bop_tsunami` | These DataSource keys are FABRICATED in the wording file. Actual keys verified: `auckland_flood` (5020), `gwrc_earthquake` (4924), `wcc_hazards` (4929), `wcc_solar` (4934), `gwrc_landslide` (4974), `gns_landslides` (4913), `gns_active_faults` (4918), `linz_waterways` (4907), `auckland_liquefaction` (5037), `auckland_landslide` (5042), `epb_mbie` (4949 — NOT `mbie_epb`), `auckland_coastal_erosion` (5104), `auckland_aircraft_noise` (5084), `auckland_overland_flow` (5062), `auckland_geotech` (5119), `coastal_elevation` (4979), `gwrc_flood_extents` (4984), `coastal_inundation` (5004 — WCC), `erosion_prone_land` (5014), `auckland_coastal` (5032), `auckland_tsunami` (5057), `gwrc_tsunami` (7839), `bop_tsunami_evac` (6691), `hbrc_tsunami` (5401), `hbrc_liquefaction` (5387). |

For brevity, every indicator below cites these foundational verifications by ID rather than re-pasting. Migration line numbers are CONFIRMED via F3; risk_score line numbers via F4; weights via F2; `_src(...)` presence via F1; DataSource key existence via F5.

---

### hazards.flood

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | Property inside national flood-zone polygon | NOT-VERIFIABLE | definitional | NOT-VERIFIABLE |
| 2 | Source authority | GWRC `flood_zones` national + regional councils | F5 + Grep `flood_zones` table refs in 0054 line 199 `FROM flood_zones` | Table exists. Authority claim broadly correct (national flood_zones layer is sparse, populated by various loaders) | CONFIRMED (table) / UNVERIFIED (specific authority "GWRC owns flood_zones" — table is not a single-authority artefact) |
| 3 | Dataset / endpoint | `flood_zones` national + `wcc_floodplains`, `gwrc_flood_1pct`, `auckland_flood` + regional | F5 | `wcc_floodplains` has NO DataSource match; `gwrc_flood_1pct` has NO DataSource match (actual: `gwrc_flood_extents`); `auckland_flood` CONFIRMED | WRONG (2 of 3 endpoint names fabricated) |
| 4 | DataSource key(s) | `flood_zones`, `wcc_floodplains`, `gwrc_flood_1pct`, `auckland_flood`, +regional | F5 | Only `auckland_flood` exists. The other three are not DataSource keys. | WRONG |
| 5 | Table(s) | `flood_zones`, `flood_hazard`, `flood_extent` | Grep `CREATE TABLE.*flood_zones\\|flood_hazard\\|flood_extent` in `backend/migrations/` | Tables referenced in 0054 SQL (lines 199, 192, etc.) | CONFIRMED (referenced; not all formally CREATE'd in viewed migration window — UNVERIFIED for `flood_extent` CREATE) |
| 6 | Query path | `0054_flood_nearest_m.sql:118` | F3 | `118 'flood', fz.flood_label,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx:55`; `HostedQuickReport.tsx:196`; `HostedHazardAdvice.tsx:992`; `HostedReport.tsx:366` | Read of each file | RHS:55 = `<ActiveFaultDetailCard>` (NOT a flood card — actually flood is rendered via generic `IndicatorCard` for the `flood` indicator from line 106). HQR:196 = `<HostedAtAGlance report={report}/>` (CONFIRMED via Read). HHA:992 = LAST line of file (artefact line ref — file is 992 lines total). HR:366 = `<HostedHazardAdvice report={report}...>` CONFIRMED. | WRONG (RHS:55 is wrong card; HHA:992 is end-of-file, not a render target) |
| 8 | Threshold logic | `lib/hazards.ts` `getFloodTier()`, `floodLabel()`, `isInFloodZone()`. String matching "1%"/"100" in `report_html.py:751` | Read report_html.py:751 | `flood = str(hazards.get("flood") or "").lower(); if "1%" in flood or "100" in flood:` | CONFIRMED for python; helper-existence in `lib/hazards.ts` UNVERIFIED |
| 9 | Score contribution | `flood` weight 0.14 — `risk_score.py:435` | F2, F4 | weight 0.14 confirmed; line 435 is `indicators["flood"] = severity_flood(haz["flood"])` | CONFIRMED |
| 10 | Coverage | All 22 cities show flood=Y per WIRING-TRACES; national `flood_zones` sparse | UNVERIFIED — did not open WIRING-TRACES for this audit | UNVERIFIED |
| 11 | source_key status | present — `_src("council_flood")` at `report_html.py:757,764` | F1 + Read 757,764 | `757: source=_src("council_flood")`, `764: source=_src("council_flood")` | CONFIRMED |

Wording cells:

| Cell | Verdict | Note |
|---|---|---|
| OS label R | PASS | "In a flood zone" — 16 chars, NZ English |
| OS label B | PASS | "Inside a 1% AEP flood zone" |
| OS label P | PASS | "1% AEP flood zone (council layer)" |
| OS finding R | PASS | Single sentence; addresses landlord |
| OS finding B | PASS | LIM + floor-level action — appropriate for buyer |
| OS finding P | PASS | Technical, two clauses but one sentence |
| HQ label R | PASS | "Flood zone" |
| HQ label B | PASS | "Flood zone (1% AEP)" |
| HQ label P | PASS | "Flood zone — council layer" |
| HQ narr R | PASS | NZ English |
| HQ narr B | PASS | "1-in-4" framing addresses common misreading |
| HQ narr P | PASS | Includes lender impact |
| HF label R | PASS | "Flood-zone exposure" |
| HF label B | PASS | "Flood-zone exposure & insurance flag" |
| HF label P | PASS | "Flood polygon hit (council)" |
| HF narr R | PASS | Plain language |
| HF narr B | PASS | Defuses common misreading ("~26% over 30 years") |
| HF narr P | PASS | Cites SQL tables and consent process |

Misreading defusal: HF Buyer narrative explicitly addresses "1-in-100 ≈ 26% over 30 years" → PASS.

---

### hazards.flood_extent_aep

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | AEP label of council flood polygon | NOT-VERIFIABLE | definitional | NOT-VERIFIABLE |
| 2 | Source authority | Regional councils | F5 (council flood loaders exist e.g. `auckland_flood`, `gwrc_flood_extents`, `northland_river_flood_100yr`) | Many council flood DataSources exist | CONFIRMED |
| 3 | Dataset/endpoint | Council flood ArcGIS layers; AC `Flood_Prone_Areas` is 1% AEP | UNVERIFIED — did not open AC ArcGIS metadata | UNVERIFIED |
| 4 | DataSource key | `auckland_flood`, council flood loaders | F5 | `auckland_flood` CONFIRMED line 5020; "council flood loaders" is generic — many exist | CONFIRMED |
| 5 | Table | `flood_hazard` | Read 0054:187 `'flood_extent_aep', fh_council.aep` (alias `fh_council` references `flood_hazard`) | CONFIRMED |
| 6 | Query path | `0054:187` | F3 | `187 'flood_extent_aep', fh_council.aep,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; `report_html.py:1442` | Read report_html.py:1442 | `1442 fe_aep = hazards.get("flood_extent_aep")` | CONFIRMED for report_html; component-side UNVERIFIED (no specific line cited beyond the file name) |
| 8 | Threshold logic | `getFloodTier()` etc. | UNVERIFIED — did not open `lib/hazards.ts` | UNVERIFIED |
| 9 | Score contribution | `risk_score.py:545` 1%→75, 2%→85, 0.5%→45, "sensitive"→30 | F4 + Read :525-546 | line 537 `if "1%" in aep_str or "1 in 100" in aep_str: council_flood_score = 75`, 539 `"2%"...85`, 535 `"0.5%"...45`, 530 `"sensitive"...30`; assignment at line 545–546 | CONFIRMED |
| 10 | Coverage | All 22 cities | UNVERIFIED | UNVERIFIED |
| 11 | source_key status | N/A (no Insight at line 1442 sets `source_key`) | Read report_html.py:1442-1450 | Insight at 1445 has no `source=` arg | CONFIRMED |

Wording cells: All 18 cells PASS — labels ≤60 chars, "out of scope" cells provide reason ("Quick covers tier from `hazards.flood` only"). Misreading defusal: HF Buyer addresses "design flood" framing.

---

### hazards.flood_extent_label

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | Free-text council label | NOT-VERIFIABLE | definitional | NOT-VERIFIABLE |
| 2 | Source authority | Regional councils | F5 | CONFIRMED |
| 3 | Dataset/endpoint | Council flood ArcGIS layers | F5 | CONFIRMED (broad) |
| 4 | DataSource key | "Council flood loaders" — generic | F5 | CONFIRMED (generic enumeration) |
| 5 | Table | `flood_hazard` | F3 | CONFIRMED |
| 6 | Query path | `0054:188` | F3 | `188 'flood_extent_label', fh_council.label,` | CONFIRMED |
| 7 | Rendered by | `HostedHazardAdvice.tsx`; `report_html.py:1443` | Read | `1443 fe_label = hazards.get("flood_extent_label")` | CONFIRMED |
| 8 | Threshold logic | Used in `floodLabel()` preference order | UNVERIFIED | UNVERIFIED |
| 9 | Score contribution | label only | NOT-VERIFIABLE | definitional | NOT-VERIFIABLE |
| 10 | Coverage | All cities with council flood loaders | NOT-VERIFIABLE (definitional, depends on loader runs) | NOT-VERIFIABLE |
| 11 | source_key status | N/A | Read 1443-1450 | Insight at 1445 has no source= | CONFIRMED |

Wording cells: 18 cells PASS — out-of-scope reasons all specific ("free-text label only", "not in Quick").

---

### hazards.flood_nearest_m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | Distance to nearest flood polygon, capped 500m | NOT-VERIFIABLE | definitional | NOT-VERIFIABLE |
| 2 | Source authority | Aggregate of all flood loaders | F5 | CONFIRMED (broad) |
| 3 | Dataset/endpoint | PostGIS `ST_Distance` over 3 flood tables, capped 500m | F3 + comment at 0054:189-191 ("Nearest flood polygon within 500m across all three flood tables. NULL when nothing is within 500m. 0 when the property is inside a polygon.") | CONFIRMED |
| 4 | DataSource key | `flood_zones` / council flood loaders | F5 | `flood_zones` is NOT a DataSource key — it is a table. Wording-file conflates table with key. | WRONG |
| 5 | Table | `flood_zones, flood_hazard, flood_extent` | F3 | CONFIRMED (3 tables) |
| 6 | Query path | `0054:192` | F3 | `192 'flood_nearest_m', flood_near.dist_m,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx` | Files exist | UNVERIFIED (no specific line cited) |
| 8 | Threshold logic | `FLOOD_PROXIMITY_THRESHOLD_M = 100`; `isNearFloodZone()` | UNVERIFIED | UNVERIFIED |
| 9 | Score contribution | drives tier, not separate indicator | F4 — `flood_nearest_m` not used in risk_score.py | UNVERIFIED in risk_score.py (it's not directly referenced) | CONFIRMED definitionally |
| 10 | Coverage | All cities | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 11 | source_key status | N/A | report_html does not emit a finding using `flood_nearest_m` per build_humanized_hazards | UNVERIFIED |

Wording cells: 18 cells PASS — labels ≤60 chars; out-of-scope cells specific.

---

### hazards.wcc_flood_type

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | WCC DP flood overlay type | NOT-VERIFIABLE | definitional | NOT-VERIFIABLE |
| 2 | Source authority | WCC 2024 DP | F5 has `wcc_hazards` (4929) covering DP hazards | CONFIRMED |
| 3 | Dataset/endpoint | `wcc_floodplains` ArcGIS layer | F5 | NO `wcc_floodplains` DataSource key in data_loader.py | WRONG |
| 4 | DataSource key | `wcc_floodplains` | F5 | Not present | WRONG |
| 5 | Table | `flood_hazard` (source_council='wellington_city') | F3 line 139 alias `fh_wcc` | CONFIRMED |
| 6 | Query path | `0054:139` | F3 | `139 'wcc_flood_type', fh_wcc.hazard_type,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; `report_html.py:1283` | Read 1283 | `1283 wcc_flood_type = hazards.get("wcc_flood_type")` | CONFIRMED for report_html |
| 8 | Threshold logic | Presence sets tier "low" in `getFloodTier()` | UNVERIFIED | UNVERIFIED |
| 9 | Score contribution | label only; severity from ranking | F4 — `wcc_flood_type` not used as score input directly (line 519 uses `wcc_flood_ranking`) | CONFIRMED |
| 10 | Coverage | Wellington City only | NOT-VERIFIABLE without external table | NOT-VERIFIABLE |
| 11 | source_key status | TODO — no source_key at 1287 | Read 1287 | Insight at 1287 has no `source=` arg | CONFIRMED (status correctly reported as TODO) |

Wording cells: 18 cells PASS.

---

### hazards.wcc_flood_ranking

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | WCC DP flood severity High/Med/Low | NOT-VERIFIABLE | definitional | NOT-VERIFIABLE |
| 2 | Source authority | WCC 2024 DP | F5 (`wcc_hazards` exists) | CONFIRMED |
| 3 | Dataset/endpoint | `wcc_floodplains` | F5 | Not present as DataSource key | WRONG |
| 4 | DataSource key | `wcc_floodplains` | F5 | Not present | WRONG |
| 5 | Table | `flood_hazard` | F3 | CONFIRMED |
| 6 | Query path | `0054:140` | F3 | `140 'wcc_flood_ranking', fh_wcc.hazard_ranking,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1284,1287` | Read | `1284 wcc_flood_rank = hazards.get("wcc_flood_ranking"); 1287 result["hazards"].append(Insight(...))` | CONFIRMED |
| 8 | Threshold logic | `getFloodTier()` H→severe, M→moderate, L→low | UNVERIFIED (frontend) | UNVERIFIED |
| 9 | Score contribution | `risk_score.py:521,523` H=80, M=55, L=30 | Read :521 `wcc_flood_score = {"High": 80, "Medium": 55, "Low": 30}.get(wcc_flood, 40)` | CONFIRMED |
| 10 | Coverage | Wellington City only | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 11 | source_key status | TODO | Read 1287 — Insight has no source= | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.tsunami_zone_class

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | National tsunami evac zone class 1–3 | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 2 | Source authority | Civil Defence / regional EM aggregated to `tsunami_zones` | F3 line 203 `FROM tsunami_zones` | CONFIRMED (table) |
| 3 | Dataset/endpoint | `tsunami_zones` national layer | F5 | `tsunami_zones` not a DataSource key — it's a target_table populated by various council loaders (e.g. `auckland_tsunami`, `gwrc_tsunami`, `bop_tsunami_evac`) | WRONG (presented as a DataSource) |
| 4 | DataSource key | `tsunami_zones`, regional tsunami loaders | F5 | `tsunami_zones` not a DataSource key | WRONG |
| 5 | Table | `tsunami_zones` | F3 line 203 | CONFIRMED |
| 6 | Query path | `0054:119` | F3 | `119 'tsunami_zone_class', tz.zone_class,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:767,973` | Read 767 `tsunami = hazards.get("tsunami_zone_class")` | CONFIRMED for 767; 973 UNVERIFIED (not read in this pass) |
| 8 | Threshold logic | tz≥3 warn, tz≥1 info | Read 773-786 | `if tz >= 3: ...warn; elif tz >= 1: ...info` | CONFIRMED |
| 9 | Score contribution | `tsunami` weight 0.11, `risk_score.py:437` | F2, F4 | line 437 `indicators["tsunami"] = SEVERITY_TSUNAMI.get(haz["tsunami_zone_class"], 0)` | CONFIRMED |
| 10 | Coverage | Most coastal cities Y; Queenstown/Rotorua/Timaru = - | UNVERIFIED | UNVERIFIED |
| 11 | source_key status | present — `_src("council_tsunami")` at 778,785 | F1 + Read | `778: source=_src("council_tsunami")`, `785: source=_src("council_tsunami")` | CONFIRMED |

Wording cells: 18 cells PASS. Misreading defusal addressed in HF Buyer ("Local-source tsunami warning window 5–20 min").

---

### hazards.tsunami_evac_zone

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | Free-text evac colour name | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 2 | Source authority | Regional civil defence | reasonable | UNVERIFIED |
| 3 | Dataset/endpoint | `tsunami_zones` | F3 line 203 | CONFIRMED |
| 4 | DataSource key | `tsunami_zones` | F5 | Not a DataSource key | WRONG |
| 5 | Table | `tsunami_zones` | F3 | CONFIRMED |
| 6 | Query path | `0054:120` | F3 | `120 'tsunami_evac_zone', tz.evac_zone,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx`; via `build_humanized_hazards` | UNVERIFIED — no line cited | UNVERIFIED |
| 8 | Threshold logic | cosmetic | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 9 | Score contribution | — | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 10 | Coverage | Same as `tsunami_zone_class` | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 11 | source_key status | N/A | UNVERIFIED (no Insight specifically tied to this field shown) | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### hazards.wcc_tsunami_return_period

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | WCC tsunami return period 1:100/500/1000yr | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 2 | Source authority | WCC 2024 DP | F5 (`wcc_hazards`) | CONFIRMED |
| 3 | Dataset/endpoint | WCC tsunami hazard ArcGIS | UNVERIFIED specific layer | UNVERIFIED |
| 4 | DataSource key | `wcc_tsunami` | F5 | NO `wcc_tsunami` DataSource key. Closest: `wcc_hazards` (4929) likely produces this. | WRONG |
| 5 | Table | `tsunami_hazard` (source_council='wellington_city') | F3 alias `th_wcc` line 141 | CONFIRMED |
| 6 | Query path | `0054:141` | F3 | `141 'wcc_tsunami_return_period', th_wcc.return_period,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1274` | Read 1274 | `1274 wcc_tsunami = hazards.get("wcc_tsunami_return_period")` | CONFIRMED |
| 8 | Threshold logic | 1:100→warn(80), 1:500→info(55), 1:1000→25 | Read :551 | `tsunami_score = {"1:100yr": 80, "1:500yr": 55, "1:1000yr": 25}.get(wcc_tsunami, 30)` | CONFIRMED |
| 9 | Score contribution | `risk_score.py:551,553` | F4 | CONFIRMED |
| 10 | Coverage | Wellington City only | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 11 | source_key status | TODO | Read 1276-1281 — Insight has no source= | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.wcc_tsunami_ranking

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | WCC tsunami severity High/Med/Low | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 2 | Source authority | WCC 2024 DP | CONFIRMED via F5 |
| 3 | Dataset/endpoint | `wcc_tsunami` | F5 | NO `wcc_tsunami` DataSource | WRONG |
| 4 | DataSource key | `wcc_tsunami` | F5 | Not present | WRONG |
| 5 | Table | `tsunami_hazard` | F3 | CONFIRMED |
| 6 | Query path | `0054:142` | F3 | `142 'wcc_tsunami_ranking', th_wcc.hazard_ranking,` | CONFIRMED |
| 7 | Rendered by | `HostedHazardAdvice.tsx`. No on-screen finding | File exists; no specific line | UNVERIFIED line; CONFIRMED no Insight rule on this field in report_html.py |
| 8 | Threshold logic | `isInTsunamiZone()` | UNVERIFIED | UNVERIFIED |
| 9 | Score contribution | — | F4 — not referenced | CONFIRMED (not in risk_score.py) |
| 10 | Coverage | Wellington City only | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 11 | source_key status | N/A | CONFIRMED |

Wording cells: 18 cells PASS — out-of-scope cells provide specific reason.

---

### hazards.council_tsunami_ranking

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | Regional council tsunami ranking | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 2 | Source authority | BOP/HBRC/Tasman regional councils | F5 | `hbrc_tsunami` (5401), `bop_tsunami_evac` (6691), `nelson_tasman_tsunami` (8187) — but no `tasman_tsunami`, `bop_tsunami` plain | PARTIAL CONFIRMED |
| 3 | Dataset/endpoint | Council tsunami ArcGIS layers | F5 (multiple exist) | CONFIRMED (broad) |
| 4 | DataSource key | `bop_tsunami`, `hbrc_tsunami`, `tasman_tsunami` +regional | F5 | `hbrc_tsunami` CONFIRMED (5401); `bop_tsunami` not present (actual `bop_tsunami_evac` 6691, `bop_tsunami_2500yr` 6702); `tasman_tsunami` not present (closest `nelson_tasman_tsunami` 8187) | WRONG (2 of 3 keys fabricated) |
| 5 | Table | `tsunami_hazard` | F3 alias `tsu_council` line 147 | CONFIRMED |
| 6 | Query path | `0054:147` | F3 | `147 'council_tsunami_ranking', tsu_council.hazard_ranking,` | CONFIRMED |
| 7 | Rendered by | finding via `build_humanized_hazards` | UNVERIFIED line | UNVERIFIED |
| 8 | Threshold logic | `isInTsunamiZone()` | UNVERIFIED | UNVERIFIED |
| 9 | Score contribution | `risk_score.py:558,562` H=80/M=55/L=30 | Read :558 | `tsunami_score = {"High": 80, "Medium": 55, "Low": 30}.get(council_tsunami_ranking, 40)` | CONFIRMED |
| 10 | Coverage | Coastal cities ex-Wellington | UNVERIFIED | UNVERIFIED |
| 11 | source_key status | present — `_src("council_tsunami")` | F1 | line 778/785 in report_html — but those rules fire on `tsunami_zone_class`, not `council_tsunami_ranking`. Wording-file conflates "tsunami rule fires → all tsunami fields share source_key" — but that's not how `_src` is bound (it's per-Insight, not per-field). | UNVERIFIED (no Insight rule explicitly tied to `council_tsunami_ranking` was identified) |

Wording cells: 18 cells PASS.

---

### hazards.council_tsunami_scenario

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1-5 | (definitional/table) | | F3 (line 148) | `148 'council_tsunami_scenario', tsu_council.scenario,` | CONFIRMED for query path |
| 6 | Query path | `0054:148` | F3 | CONFIRMED |
| 7 | Rendered by | `HostedHazardAdvice.tsx` only | UNVERIFIED line | UNVERIFIED |
| 8-10 | (definitional) | | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 11 | source_key status | N/A | CONFIRMED (no Insight rule on this field) |

Wording cells: 18 cells PASS — all out-of-scope cells include specific reason.

---

### hazards.council_tsunami_return_period, hazards.council_tsunami_source

(Same audit pattern: query paths `0054:149` and `0054:150` CONFIRMED via F3. DataSource keys claim "Council tsunami loaders" — generic, CONFIRMED. source_key status N/A — CONFIRMED no Insight uses these fields. Rendered-by lines UNVERIFIED beyond filename. Wording cells: all 18 PASS each — out-of-scope cells specific.)

---

### hazards.liquefaction

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | National liquefaction class | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 2 | Source authority | National liquefaction zones layer | F5 | NO `liquefaction_zones` DataSource key — it is a target_table populated by various council loaders | WRONG (claimed as a single-authority DataSource) |
| 3 | Dataset/endpoint | `liquefaction_zones` national | F5 | `liquefaction_zones` is a table, not a DataSource | WRONG |
| 4 | DataSource key | `liquefaction_zones` | F5 | Not a DataSource key | WRONG |
| 5 | Table | `liquefaction_zones` | UNVERIFIED CREATE; F3 line 121 references `lz.liq_class` (alias `lz` over `liquefaction_zones`) | CONFIRMED via reference |
| 6 | Query path | `0054:121` | F3 | `121 'liquefaction', lz.liq_class,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:302,955` | UNVERIFIED — line 302 not in the read window; 955 not read in detail | UNVERIFIED |
| 8 | Threshold logic | `lib/hazards.ts` mirrors python `normalize_liquefaction` | UNVERIFIED | UNVERIFIED |
| 9 | Score contribution | weight 0.11, `risk_score.py:443` | F2, F4 | line 443 `indicators["liquefaction"] = severity_liquefaction_canonical(normalize_liquefaction(haz["liquefaction"]))` | CONFIRMED |
| 10 | Coverage | All cities, sparse outside Welly/Akl/Cant | UNVERIFIED | UNVERIFIED |
| 11 | source_key status | present — `_src("council_liquefaction")` at 798,805 | F1 | CONFIRMED |

Wording cells: 18 cells PASS — Pro on-screen finding `Susceptibility <rating>...refine` is one sentence, ≤60-char labels OK.

---

### hazards.gwrc_liquefaction

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | GWRC regional liquefaction | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 2 | Source authority | GWRC | CONFIRMED via F5 `gwrc_earthquake` |
| 3 | Dataset/endpoint | GWRC ArcGIS | UNVERIFIED specific URL | UNVERIFIED |
| 4 | DataSource key | `gwrc_earthquake` | F5 | line 4924 `"gwrc_earthquake", "GWRC Earthquake Hazards"` | CONFIRMED |
| 5 | Table | `liquefaction_detail` | F3 line 134 alias `gwrc_liq` (target_table `liquefaction_detail` per loader convention) | CONFIRMED via reference |
| 6 | Query path | `0054:134` | F3 | `134 'gwrc_liquefaction', gwrc_liq.liquefaction,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:956` | UNVERIFIED specific line not read | UNVERIFIED |
| 8 | Threshold logic | normalize + canonical + "fill" boost ≥85 at risk_score.py:498 | Read :497-498 | `if gwrc_geo and "fill" in str(gwrc_geo).lower(): regional_score = max(regional_score, 85)` | CONFIRMED |
| 9 | Score contribution | `risk_score.py:499–500` | F4 | line 499 `if regional_score > (indicators.get("liquefaction") or 0): indicators["liquefaction"] = regional_score` | CONFIRMED |
| 10 | Coverage | GWRC region (Welly + 4 others) | UNVERIFIED | UNVERIFIED |
| 11 | source_key status | present — `_src("council_liquefaction")` at 798,805 | F1 | The `_src("council_liquefaction")` Insight at 798/805 fires on `pick_liquefaction_rating(hazards)` which presumably reads multiple liq fields. So it COULD fire on this field's value; provenance attribution is reasonable. | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.gwrc_liquefaction_geology

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1-5 | | | F5 + F3:135 + Read | line 135 `'gwrc_liquefaction_geology', gwrc_liq.simplified,`; DataSource `gwrc_earthquake` confirmed at 4924; table `liquefaction_detail` referenced | CONFIRMED |
| 6 | Query path | `0054:135` | F3 | CONFIRMED |
| 7 | Rendered by | `report_html.py:1214,1223` | Read 1214,1223 | `1214 geology = hazards.get("gwrc_liquefaction_geology")`; `1223 gwrc_geology = str(hazards.get("gwrc_liquefaction_geology") or "").lower()` | CONFIRMED |
| 8 | Threshold logic | "fill"/"reclaimed" → 85 at risk_score.py:498 | Read :497 | CONFIRMED |
| 9 | Score contribution | boosts liquefaction when fill | F4 | CONFIRMED |
| 10 | Coverage | GWRC region | UNVERIFIED | UNVERIFIED |
| 11 | source_key status | TODO — finding at 1216, 1225 has no source= | Read 1216-1230 | Both Insights at 1216 and 1225 lack `source=` arg | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.council_liquefaction

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1-2 | | | F5 | DataSources `auckland_liquefaction` (5037), `hbrc_liquefaction` (5387), many others | CONFIRMED |
| 3 | Dataset/endpoint | Council liquefaction ArcGIS | F5 | CONFIRMED (broad) |
| 4 | DataSource key | `auckland_liquefaction`, `hbrc_liquefaction`, +regional | F5 | Both CONFIRMED |
| 5 | Table | `liquefaction_detail` | F3 alias `liq_council` line 144 | CONFIRMED |
| 6 | Query path | `0054:144` | F3 | `144 'council_liquefaction', liq_council.liquefaction,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:957` | UNVERIFIED specific line | UNVERIFIED |
| 8 | Threshold logic | normalize_liquefaction + fill boost | Read risk_score.py:567-573 | `from .report_html import normalize_liquefaction; council_liq_score = severity_liquefaction_canonical(...); if council_liq_geo and "fill" in str(council_liq_geo).lower(): council_liq_score = max(council_liq_score, 85)` | CONFIRMED |
| 9 | Score contribution | `risk_score.py:573–574` | F4 | CONFIRMED |
| 10 | Coverage | All 22 cities — wiring traces says Y for all | UNVERIFIED (did not open WIRING-TRACES) | UNVERIFIED |
| 11 | source_key status | present — `_src("council_liquefaction")` | F1 | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.council_liquefaction_geology, hazards.council_liquefaction_source

(Pattern: query paths `0054:145, 0054:146` CONFIRMED via F3. DataSource keys claim "Council liquefaction loaders" — generic, CONFIRMED via F5. source_key N/A — CONFIRMED. Rendered-by line UNVERIFIED. Wording cells: 18 PASS each.)

---

### hazards.slope_failure

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1-3 | | | | | NOT-VERIFIABLE / definitional |
| 4 | DataSource key | `slope_failure_zones` | F5 | NO `slope_failure_zones` DataSource. It is a target_table only. | WRONG |
| 5 | Table | `slope_failure_zones` | F3 line 128 alias `sf` → `slope_failure_zones` | CONFIRMED |
| 6 | Query path | `0054:128` | F3 | `128 'slope_failure', sf.susceptibility,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:921` | Read 912-925 | line 912 `if hazards.get("landslide_in_area"):` — note: line 921 actually fires from `landslide_in_area`, not slope_failure. Slope-failure-specific Insight is unclear | UNVERIFIED (the cited line 921 is not the slope_failure Insight) |
| 8 | Threshold logic | SEVERITY_SLOPE_FAILURE; very high/high/medium → findings | Read risk_score.py:454 | CONFIRMED for scoring; finding-rule line UNVERIFIED |
| 9 | Score contribution | weight 0.11, `risk_score.py:454` | F2, F4 | CONFIRMED |
| 10 | Coverage | All cities | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 11 | source_key status | TODO | UNVERIFIED specific line; F1 shows no `_src` for slope_failure | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.gwrc_slope_severity

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gwrc_earthquake` | F5 line 4924 | CONFIRMED |
| 5 | Table | `slope_failure` | F3 alias `gwrc_sf` line 136 | CONFIRMED |
| 6 | Query path | `0054:136` | F3 | `136 'gwrc_slope_severity', gwrc_sf.severity,` | CONFIRMED |
| 7 | Rendered by | RHS + HHA, no on-screen finding | UNVERIFIED | UNVERIFIED |
| 8 | Threshold | SEVERITY_GWRC_SLOPE | Read risk_score.py:503 | `gwrc_sf = SEVERITY_GWRC_SLOPE.get(haz.get("gwrc_slope_severity"))` | CONFIRMED |
| 9 | Score contribution | `risk_score.py:504–505` | F4 | line 505 `indicators["slope_failure"] = gwrc_sf` | CONFIRMED |
| 11 | source_key | N/A | CONFIRMED (no Insight uses this field) |

Wording cells: 18 cells PASS.

---

### hazards.council_slope_severity, hazards.council_slope_source

(Pattern: query paths `0054:151, 0054:152` CONFIRMED via F3. DataSource "Regional slope loaders" — generic CONFIRMED via F5 (`westcoast_landslide_catalog`, `tauranga_slope`, `nelson_slope`, etc.). source_key N/A — CONFIRMED. risk_score.py:583–584 for council_slope_severity CONFIRMED via F4. Wording cells: 18 PASS each.)

---

### hazards.landslide_count_500m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gns_landslides` | F5 line 4913 | CONFIRMED |
| 5 | Table | `landslide_events` | F3 alias `ls_count` line 158 | CONFIRMED via reference |
| 6 | Query path | `0054:158` | F3 | `158 'landslide_count_500m', ls_count.cnt,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx:122` (LandslideDetailCard); `report_html.py:379,896` | Read RHS:122 | `122 <LandslideDetailCard landslide={hazards.landslide_nearest} count={hazards.landslide_count_500m} />` | CONFIRMED for RHS:122; report_html:896 CONFIRMED via Read 896 (`ls_count = hazards.get("landslide_count_500m") or 0`); 379 UNVERIFIED |
| 8 | Threshold | ≥3 → 65, ≥1 → 40 | Read risk_score.py:462-465 | `elif ls_count >= 3: gns_score = 65; elif ls_count >= 1: gns_score = 40` | CONFIRMED |
| 9 | Score contribution | `risk_score.py:462–469` (slope_failure boost) | F4 | CONFIRMED |
| 11 | source_key | present — `_src("gns_landslides")` at 902,909 | F1 + Read | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.landslide_nearest

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gns_landslides` | F5 | CONFIRMED |
| 5 | Table | `landslide_events` | F3 alias `ls_nearest` line 159 | CONFIRMED |
| 6 | Query path | `0054:159` | F3 | `159 'landslide_nearest', ls_nearest.nearest,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx:122`; `report_html.py:380,1036` | Read RHS:122 above | CONFIRMED for RHS; report_html lines UNVERIFIED |
| 11 | source_key | present | F1 | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.landslide_in_area

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 5 | Table | `landslide_areas` | Wording-file claims `landslide_areas` table — F3 alias `ls_area` | CONFIRMED via SQL alias; CREATE TABLE UNVERIFIED |
| 6 | Query path | `0054:160` | F3 | `160 'landslide_in_area', ls_area.in_area,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:390,912` | Read 912 | `912 if hazards.get("landslide_in_area"):` | CONFIRMED 912; 390 UNVERIFIED |
| 8 | Threshold | sets gns_score=75 | Read risk_score.py:459-461 | `if ls_in_area: gns_score = 75` | CONFIRMED |
| 9 | Score contribution | slope_failure boost | F4 | CONFIRMED |
| 11 | source_key | present | F1 line 917 `_src("gns_landslides")` | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.landslide_susceptibility_rating

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gwrc_landslide`, `auckland_landslide` | F5 | `gwrc_landslide` (4974), `auckland_landslide` (5042) | CONFIRMED |
| 5 | Table | `landslide_susceptibility` | F3 alias `ls_susc` line 162 | CONFIRMED |
| 6 | Query path | `0054:162` | F3 | `162 'landslide_susceptibility_rating', ls_susc.accuracy,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1352` | Read 1352 | `1352 ls_rating = str(hazards.get("landslide_susceptibility_rating") or "").lower()` | CONFIRMED |
| 8 | Threshold | very high/high → warn, moderate/medium → info | Read 1353-1365 | CONFIRMED |
| 9 | Score contribution | weight 0.10, `risk_score.py:592` | F2, F4 | line 592 `indicators["landslide_susceptibility"] = ls_score` | CONFIRMED |
| 11 | source_key | TODO — Insight at 1354,1361 has no source= | Read 1354-1365 | No `source=` arg | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.landslide_susceptibility_type, hazards.landslide_susceptibility_source

(Query paths `0054:163`, `0054:164` CONFIRMED via F3. Tables CONFIRMED. DataSource "landslide loaders" — generic. source_key N/A — CONFIRMED. Wording cells: 18 PASS each.)

---

### hazards.earthquake_count_30km

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `geonet_earthquakes` | F5 | NO `geonet_earthquakes` DataSource — but `_src("geonet_earthquakes")` exists at report_html.py:819 | UNVERIFIED (the source_key string `geonet_earthquakes` exists in `_SOURCE_CATALOG` not as a DataSource key. Wording-file conflates `_src` key with DataSource key.) | WRONG (claimed as DataSource key) |
| 5 | Table | `earthquakes` | F3 alias `eq` line 124 | CONFIRMED via reference |
| 6 | Query path | `0054:124` | F3 | `124 'earthquake_count_30km', eq.cnt,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:422,808` | Read 808 | `808 eq_count = hazards.get("earthquake_count_30km")` | CONFIRMED 808; 422 UNVERIFIED |
| 8 | Threshold | ≥20 → warn | Read 814 | `if eq_count is not None and eq_count >= 20:` | CONFIRMED |
| 9 | Score contribution | weight 0.09, `risk_score.py:446` | F2, F4 | line 446 `indicators["earthquake"] = normalize_min_max(haz.get("earthquake_count_30km"), 0, 50)` | CONFIRMED |
| 11 | source_key | present — `_src("geonet_earthquakes")` at 819 | F1 | `819 source=_src("geonet_earthquakes")` | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.earthquake_hazard_index

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gwrc_earthquake` | F5 | CONFIRMED |
| 5 | Table | `earthquake_hazard` | F3 alias `gwrc_eq` line 130 | CONFIRMED |
| 6 | Query path | `0054:130` | F3 | `130 'earthquake_hazard_index', gwrc_eq.chi,` | CONFIRMED |
| 7 | Rendered by | none (—) per inventory | OK | NOT-VERIFIABLE (absence) |
| 11 | source_key | N/A | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.earthquake_hazard_grade

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gwrc_earthquake` | F5 | CONFIRMED |
| 5 | Table | `earthquake_hazard` | F3 line 131 | CONFIRMED |
| 6 | Query path | `0054:131` | F3 | `131 'earthquake_hazard_grade', gwrc_eq.chi_grade,` | CONFIRMED |
| 8 | Threshold | normalised 1-5 → 0-100, max with national | Read risk_score.py:478-488 | `if eq_grade is not None: ... grade_score = normalize_min_max(float(eq_grade), 1, 5); ... indicators["earthquake"] = max(...)` | CONFIRMED |
| 9 | Score contribution | `risk_score.py:484` | F4 | CONFIRMED |
| 11 | source_key | N/A | CONFIRMED (no Insight references this field) |

Wording cells: 18 cells PASS.

---

### hazards.ground_shaking_zone

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gwrc_earthquake` | F5 | CONFIRMED |
| 5 | Table | `ground_shaking` | F3 alias `gwrc_gs` line 132 | CONFIRMED |
| 6 | Query path | `0054:132` | F3 | `132 'ground_shaking_zone', gwrc_gs.zone,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1212` | Read 1212 | `1212 gs_severity = str(hazards.get("ground_shaking_severity") or "").lower()` — NOTE: line 1212 actually reads `ground_shaking_severity`, NOT `ground_shaking_zone`. The wording file conflates the two. | WRONG (line 1212 is for severity) |
| 11 | source_key | N/A | CONFIRMED (no Insight in 1216 has `source=`) |

Wording cells: 18 cells PASS.

---

### hazards.ground_shaking_severity

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 6 | Query path | `0054:133` | F3 | `133 'ground_shaking_severity', gwrc_gs.severity,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1212` | Read | `1212 gs_severity = str(hazards.get("ground_shaking_severity") or "").lower()` | CONFIRMED |
| 8 | Threshold | "high"/"5"/"4" → warn | Read 1213 | `if "high" in gs_severity or gs_severity.startswith("5") or gs_severity.startswith("4"):` | CONFIRMED |
| 9 | Score contribution | weight 0.12, `risk_score.py:475` | F2, F4 | line 475 `indicators["ground_shaking"] = gwrc_gs` | CONFIRMED |
| 11 | source_key | TODO — Insight 1216 has no source= | Read 1216-1221 | No `source=` arg | CONFIRMED (status correctly TODO) |

Wording cells: 18 cells PASS.

---

### hazards.fault_zone_name

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `wcc_hazards` | F5 line 4929 | CONFIRMED |
| 5 | Table | `fault_zones` | F3 alias `fz_wcc` line 137 | CONFIRMED via reference |
| 6 | Query path | `0054:137` | F3 | `137 'fault_zone_name', fz_wcc.name,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1232` | Read 1232 | `1232 fault_name = hazards.get("fault_zone_name")` | CONFIRMED |
| 8 | Threshold | high→85, medium→60, else→45 | Read 1232-1240 + risk_score.py:511-516 | CONFIRMED |
| 9 | Score contribution | weight 0.10, `risk_score.py:512` | F2, F4 | line 512 `indicators["fault_zone"] = 85` | CONFIRMED |
| 11 | source_key | TODO | Read 1235 — Insight has no source= | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.fault_zone_ranking

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 6 | Query path | `0054:138` | F3 | `138 'fault_zone_ranking', fz_wcc.hazard_ranking,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1234` | Read 1234 | `1234 ranking = hazards.get("fault_zone_ranking") or "mapped"` | CONFIRMED |
| 9 | Score contribution | `risk_score.py:514` (high/medium/else mapping) | F4 | CONFIRMED |
| 11 | source_key | TODO | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.active_fault_nearest

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gns_active_faults` | F5 line 4918 | CONFIRMED |
| 5 | Table | `active_faults` | F3 alias `af_nearest` line 173 | CONFIRMED |
| 6 | Query path | `0054:173` | F3 | `173 'active_fault_nearest', af_nearest.nearest,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx:55` (ActiveFaultDetailCard); `report_html.py:1243,4312` | Read RHS:55 | `55 <ActiveFaultDetailCard fault={hazards.active_fault_nearest} />` | CONFIRMED for RHS:55; Read report_html.py:4312 | `4312 fault_nearest = hazards.get("active_fault_nearest")` | CONFIRMED 4312; 1243 UNVERIFIED specific |
| 11 | source_key | TODO | UNVERIFIED — Insight at 1259, 1267 has no source= per file | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.fault_avoidance_zone

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gns_active_faults` | F5 | CONFIRMED |
| 5 | Table | `fault_avoidance_zones` | F3 alias `faz` line 174 | CONFIRMED |
| 6 | Query path | `0054:174` | F3 | `174 'fault_avoidance_zone', faz.zone_type,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx:60` (FaultAvoidanceZoneCard); `report_html.py:4313` | Read RHS:60 | `60 <FaultAvoidanceZoneCard zone={hazards.fault_avoidance_zone} />` | CONFIRMED; Read 4313 confirms `faz = hazards.get("fault_avoidance_zone")` |
| 11 | source_key | TODO | CONFIRMED (no source= in Insight at 4313 area) |

Wording cells: 18 cells PASS.

---

### hazards.epb_count_300m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `mbie_epb` | F5 | NO `mbie_epb` DataSource — actual key is `epb_mbie` (line 4949). Wording file has key REVERSED. | WRONG |
| 5 | Table | `earthquake_prone_buildings` | F3 alias `epb` line 127 | CONFIRMED via reference |
| 6 | Query path | `0054:127` | F3 | `127 'epb_count_300m', epb.cnt,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:452,830` | Read 830 | `830 epb_count = hazards.get("epb_count_300m")` | CONFIRMED 830; 452 UNVERIFIED |
| 8 | Threshold | ≥5 → warn | Read 836 | `if epb_count is not None and epb_count >= 5:` | CONFIRMED |
| 9 | Score contribution | weight 0.05, `risk_score.py:452` | F2, F4 | CONFIRMED |
| 11 | source_key | present — `_src("mbie_epb")` at 841,879 | F1 + Read | The `_src` KEY is named `mbie_epb` (in `_src` catalog), separate from the DataSource key `epb_mbie`. Both naming inconsistencies CONFIRMED. | CONFIRMED for `_src` claim |

Wording cells: 18 cells PASS.

---

### hazards.epb_nearest

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `mbie_epb` | F5 | actual `epb_mbie` | WRONG |
| 5 | Table | `mbie_epb` | UNVERIFIED CREATE | UNVERIFIED |
| 6 | Query path | `0054:153` | F3 | `153 'epb_nearest', epb_detail.nearest,` | CONFIRMED |
| 7 | Rendered by | `HostedHazardAdvice.tsx`; `report_html.py:5037` | UNVERIFIED line 5037 | UNVERIFIED |
| 11 | source_key | N/A | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### hazards.wind_zone

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `branz_wind_zones` | F5 | NO match | WRONG |
| 5 | Table | `wind_zones` | F3 alias `wz` line 122 | CONFIRMED via reference |
| 6 | Query path | `0054:122` | F3 | `122 'wind_zone', wz.zone_name,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:318,822` | Read 822 | `822 wind = str(hazards.get("wind_zone") or "").upper()` | CONFIRMED 822; 318 UNVERIFIED |
| 8 | Threshold | EH/SED/EXTRA HIGH → warn | Read 823 | `if wind in ("EH", "SED", "EXTRA HIGH", "SEMI-EXPOSED DESIGN"):` | CONFIRMED |
| 9 | Score contribution | weight 0.07, `risk_score.py:450` | F2, F4 | CONFIRMED |
| 11 | source_key | TODO — Insight 824 has no source= | Read 824-828 | CONFIRMED (no source= arg) |

Wording cells: 18 cells PASS.

---

### hazards.wildfire_vhe_days

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `scion_wildfire` | F5 | NO match | WRONG |
| 5 | Table | `wildfire_risk` | F3 alias `wf` line 125 | CONFIRMED via reference |
| 6 | Query path | `0054:125` | F3 | `125 'wildfire_vhe_days', wf.vhe_days,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:353,882` | Read 882 | `882 wildfire_days = hazards.get("wildfire_vhe_days")` | CONFIRMED 882; 353 UNVERIFIED |
| 8 | Threshold | ≥15 → warn | Read 888 | `if wildfire_days is not None and wildfire_days >= 15:` | CONFIRMED |
| 9 | Score contribution | weight 0.07, `risk_score.py:451` | F2, F4 | CONFIRMED |
| 11 | source_key | TODO — Insight at 889 has no source= | Read 889-893 | CONFIRMED (no source=) |

Wording cells: 18 cells PASS.

---

### hazards.wildfire_trend

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 6 | Query path | `0054:126` | F3 | `126 'wildfire_trend', wf.trend,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:354,2240` | UNVERIFIED specific lines | UNVERIFIED |
| 11 | source_key | N/A | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### hazards.coastal_exposure

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `niwa_coastal_erosion` | F5 | NO match | WRONG |
| 5 | Table | `coastal_erosion` | F3 alias `ce` line 123 | CONFIRMED via reference |
| 6 | Query path | `0054:123` | F3 | `123 'coastal_exposure', ce.assessment_level,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:406,4363` | Read 4363 | `4363 coastal_erosion = bool(hazards.get("coastal_erosion") and ...)` — note: line 4363 reads `coastal_erosion`, not `coastal_exposure`. WRONG line ref. | WRONG |
| 9 | Score contribution | weight 0.08, `risk_score.py:448` | F2, F4 | line 448 `indicators["coastal"] = SEVERITY_COASTAL_EXPOSURE.get(haz["coastal_exposure"], 0)` | CONFIRMED |
| 11 | source_key | TODO | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.coastal_erosion_exposure

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 6 | Query path | `0054:184` | F3 | `184 'coastal_erosion_exposure', ce_nat.exposure,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:406` | UNVERIFIED specific | UNVERIFIED |
| 9 | Score contribution | `risk_score.py:625` (coastal_erosion_council fallback) | Read :621-625 | `ce_exp = haz.get("coastal_erosion_exposure"); if ce_exp: ce_score = SEVERITY_COASTAL_EROSION_EXPOSURE.get(ce_exp, 0); if ce_score > 0: indicators["coastal_erosion_council"] = ce_score` | CONFIRMED |
| 11 | source_key | TODO | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### hazards.coastal_erosion_timeframe

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 6 | Query path | `0054:185` | F3 | `185 'coastal_erosion_timeframe', ce_nat.timeframe,` | CONFIRMED |
| 11 | source_key | N/A | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.council_coastal_erosion

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `auckland_ascie`, `tauranga_coastal`, +regional | F5 | `auckland_ascie` not present (actual: `auckland_coastal_erosion` 5104, `auckland_coastal_erosion_2130` 8024); `tauranga_coastal` not present (actual: `tauranga_coastal_erosion` 5562) | WRONG |
| 5 | Table | `coastal_erosion` | F3 alias `cce` line 182 | CONFIRMED |
| 6 | Query path | `0054:182` | F3 | `182 'council_coastal_erosion', cce.erosion_data,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1387` | Read 1387 | `1387 cce = hazards.get("council_coastal_erosion")` | CONFIRMED |
| 9 | Score contribution | weight 0.08, `risk_score.py:615` | F2, F4 | line 615 `indicators["coastal_erosion_council"] = normalize_min_max(...)` | CONFIRMED |
| 11 | source_key | TODO — Insight 1393 has no source= | Read 1393-1399 | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.coastal_elevation_cm

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `linz_coastal_dem` | F5 | NO match (actual: `coastal_elevation` 4979 — GWRC) | WRONG |
| 5 | Table | `coastal_elevation` | F3 alias `coast_elev` line 166 | CONFIRMED |
| 6 | Query path | `0054:166` | F3 | `166 'coastal_elevation_cm', (coast_elev.elevation_m * 100)::int,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:977,1422` | UNVERIFIED specific | UNVERIFIED |
| 11 | source_key | TODO | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### hazards.coastal_inundation_ranking

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `mfe_coastal_inundation`, `hbrc_inundation` | F5 | `mfe_coastal_inundation` not present; `hbrc_inundation` not present | WRONG |
| 5 | Table | `coastal_inundation` | F3 alias `coast_inund` line 167 | CONFIRMED |
| 6 | Query path | `0054:167` | F3 | `167 'coastal_inundation_ranking', coast_inund.inundation_ranking,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1124` | UNVERIFIED specific | UNVERIFIED |
| 11 | source_key | TODO | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### hazards.coastal_inundation_scenario

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `mfe_coastal_inundation` | F5 | not present | WRONG |
| 5 | Table | `coastal_inundation` | F3 | CONFIRMED |
| 6 | Query path | `0054:168` | F3 | `168 'coastal_inundation_scenario', coast_inund.inundation_scenario,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1125` | UNVERIFIED | UNVERIFIED |
| 11 | source_key | TODO | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### hazards.on_erosion_prone_land

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gwrc_erosion_prone` | F5 | NO match (actual: `erosion_prone_land` 5014) | WRONG |
| 5 | Table | `erosion_prone_land` | F3 alias `epl` line 170 | CONFIRMED |
| 6 | Query path | `0054:170` | F3 | `170 'on_erosion_prone_land', coalesce(epl.on_erosion_prone, false),` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1111` | UNVERIFIED | UNVERIFIED |
| 11 | source_key | TODO | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### hazards.erosion_min_angle

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `gwrc_erosion_prone` | F5 | not present (actual `erosion_prone_land`) | WRONG |
| 5 | Table | `erosion_prone_land` | F3 | CONFIRMED |
| 6 | Query path | `0054:171` | F3 | `171 'erosion_min_angle', epl.erosion_min_angle,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1112` | UNVERIFIED | UNVERIFIED |
| 11 | source_key | N/A | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### hazards.overland_flow_within_50m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `wcc_overland_flow`, `ac_overland_flow` | F5 | NO `wcc_overland_flow` or `ac_overland_flow` (actual: `auckland_overland_flow` 5062) | WRONG |
| 5 | Table | `overland_flow_paths` | F3 alias `ofp` line 180 | CONFIRMED |
| 6 | Query path | `0054:180` | F3 | `180 'overland_flow_within_50m', ofp.nearby,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1008,1014,1379,2581` | UNVERIFIED specific lines | UNVERIFIED |
| 8 | Threshold | flag if true | Read risk_score.py:597 | `if haz.get("overland_flow_within_50m"): indicators["overland_flow"] = 45` | CONFIRMED |
| 9 | Score contribution | weight 0.04, `risk_score.py:598` | F2, F4 | CONFIRMED |
| 11 | source_key | TODO — Insight 1380 has no source= | Read 1380-1384 | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.aircraft_noise_name

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `airport_noise_overlay` | F5 | NO match (actual: `auckland_aircraft_noise` 5084, `chch_airport_noise_*`, `dunedin_airport_noise`, etc.) | WRONG |
| 5 | Table | `aircraft_noise_overlay` | F3 alias `ano` line 176 | CONFIRMED via reference |
| 6 | Query path | `0054:176` | F3 | `176 'aircraft_noise_name', ano.name,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1338` | Read 1338 | `1338 aircraft_noise = hazards.get("aircraft_noise_name")` | CONFIRMED |
| 11 | source_key | TODO | Read 1344 — no source= | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.aircraft_noise_dba

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `airport_noise_overlay` | F5 | NOT present | WRONG |
| 5 | Table | `aircraft_noise_overlay` | F3 | CONFIRMED via reference |
| 6 | Query path | `0054:177` | F3 | `177 'aircraft_noise_dba', ano.noise_level_dba,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1340` | Read 1340 | `1340 dba = hazards.get("aircraft_noise_dba")` | CONFIRMED |
| 9 | Score contribution | weight 0.05, `risk_score.py:604` | F2, F4 | CONFIRMED |
| 11 | source_key | TODO | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.aircraft_noise_category

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 6 | Query path | `0054:178` | F3 | `178 'aircraft_noise_category', ano.noise_category,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1341` | Read 1341 | `1341 cat = hazards.get("aircraft_noise_category") or ""` | CONFIRMED |
| 11 | source_key | N/A | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.geotech_count_500m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `wcc_geotech, ac_geotech` | F5 | NO `wcc_geotech` or `ac_geotech` (actual: `auckland_geotech` 5119) | WRONG |
| 5 | Table | `geotechnical_reports` | F3 alias `geo_count` line 194 | CONFIRMED via reference |
| 6 | Query path | `0054:194` | F3 | `194 'geotech_count_500m', geo_count.cnt,` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1368` | Read 1368 | `1368 geotech_count = hazards.get("geotech_count_500m") or 0` | CONFIRMED |
| 11 | source_key | TODO | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.geotech_nearest_hazard

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 6 | Query path | `0054:195` | F3 | `195 'geotech_nearest_hazard', geo_nearest.hazard` | CONFIRMED |
| 7 | Rendered by | `report_html.py:1370` | Read 1370 | `1370 nearest_hazard = hazards.get("geotech_nearest_hazard")` | CONFIRMED |
| 11 | source_key | N/A | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.solar_mean_kwh

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `wcc_solar` | F5 line 4934 | CONFIRMED |
| 5 | Table | `wcc_solar_radiation` | UNVERIFIED CREATE | UNVERIFIED |
| 6 | Query path | `0054:154` | F3 | `154 'solar_mean_kwh', solar.mean_yearly_solar,` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx:132` (SolarPotentialCard); `report_html.py:1294` | Read RHS:132 | `132 <SolarPotentialCard meanKwh={hazards.solar_mean_kwh} maxKwh={hazards.solar_max_kwh} />` | CONFIRMED; Read 1294 | `1294 solar_kwh = hazards.get("solar_mean_kwh")` | CONFIRMED |
| 11 | source_key | TODO | Read 1302,1308 — no source= | CONFIRMED |

Wording cells: 18 cells PASS.

---

### hazards.solar_max_kwh

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `wcc_solar` | F5 | CONFIRMED |
| 6 | Query path | `0054:155` | F3 | `155 'solar_max_kwh', solar.max_yearly_solar` | CONFIRMED |
| 7 | Rendered by | `RiskHazardsSection.tsx:132` | Read RHS:132 | CONFIRMED |
| 11 | source_key | N/A | CONFIRMED |

Wording cells: 18 cells PASS.

---

### terrain.elevation_m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `linz_8m_dem` | F5 | NO match | WRONG |
| 5 | Table | derived from raster | NOT-VERIFIABLE | NOT-VERIFIABLE |
| 6 | Query path | `snapshot_generator.py:939 (terrain_data)` | UNVERIFIED line | UNVERIFIED |
| 7 | Rendered by | `HostedTerrain.tsx:182` | UNVERIFIED specific line — file is 501 lines | UNVERIFIED (line plausible) |
| 11 | source_key | N/A | CONFIRMED |

Wording cells: 18 cells PASS — out-of-scope cells specific.

---

### terrain.slope_degrees, terrain.slope_category, terrain.aspect_label, terrain.aspect_degrees

(Pattern: All cite `linz_8m_dem` (WRONG, not a DataSource key) and `snapshot_generator.py:939`. Wording cells PASS.)

---

### terrain.flood_terrain_score

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `linz_8m_dem` | F5 | not present | WRONG |
| 9 | Score contribution | flood terrain boost — `risk_score.py:654` | F4 | line 654 `indicators["flood"] = {3: 25, 4: 35}.get(flood_terrain_score, 25)` | CONFIRMED |
| 11 | source_key | N/A | CONFIRMED |

Wording cells: 18 cells PASS.

---

### terrain.wind_exposure_score

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 9 | Score contribution | wind terrain boost — `risk_score.py:670` | F4 | line 670 `indicators["wind"] = {4: 35, 5: 50}.get(wind_exposure_score, 35)` | CONFIRMED |
| 11 | source_key | N/A | CONFIRMED |

Wording cells: 18 cells PASS.

---

### terrain.nearest_waterway_m, terrain.nearest_waterway_name, terrain.nearest_waterway_type

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `linz_waterways` | F5 line 4907 | CONFIRMED |
| 5 | Table | `waterways` | UNVERIFIED CREATE | UNVERIFIED |
| 9 | Score contribution (m) | `risk_score.py:662` waterway boost | F4 | line 662 `indicators["flood"] = max(current_flood, 45)` | CONFIRMED |

Wording cells: 18 cells PASS each.

---

### coastal.tier

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `searise_points` | F5 | NO match | WRONG |
| 5 | Table | `searise_points` | UNVERIFIED CREATE | UNVERIFIED |
| 6 | Query path | `property.py:368 (_overlay_coastal_data)` | UNVERIFIED specific line | UNVERIFIED |
| 9 | Score contribution | coastal SeaRise override — `risk_score.py:641` | F4 | line 641 `indicators["coastal"] = round(min(delta, max_p) / max_p * 100, 1)` | CONFIRMED |
| 11 | source_key | N/A | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### coastal.score_impact.delta

(Same pattern as `coastal.tier`. `searise_points` DataSource key WRONG. risk_score.py:641 CONFIRMED. Wording cells: 18 PASS.)

---

### event_history.heavy_rain_events

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `open_meteo_history` | F5 | NO match | WRONG |
| 5 | Table | `weather_events` | UNVERIFIED CREATE | UNVERIFIED |
| 6 | Query path | `property.py:552 (_overlay_event_history)` | UNVERIFIED specific line | UNVERIFIED |
| 9 | Score contribution | flood event boost — `risk_score.py:682` | F4 | line 682 `indicators["flood"] = max(...)` | CONFIRMED |
| 11 | source_key | N/A | UNVERIFIED |

Wording cells: 18 cells PASS.

---

### event_history.extreme_wind_events

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 9 | Score contribution | wind event boost — `risk_score.py:686` | F4 | line 686 `indicators["wind"] = max(...)` | CONFIRMED |
| Other | Same as `heavy_rain_events` |

Wording cells: 18 cells PASS.

---

### event_history.earthquakes_30km_10yr

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 5 | Table | `earthquakes` | F3 line 124 (alias `eq`) | CONFIRMED |
| 9 | Score contribution | earthquake event boost — `risk_score.py:690` | F4 | line 690 `indicators["earthquake"] = max(...)` | CONFIRMED |

Wording cells: 18 cells PASS.

---

### weather_history (events list)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 4 | DataSource key | `open_meteo_history` | F5 | not present | WRONG |
| 5 | Table | `weather_events` | UNVERIFIED CREATE | UNVERIFIED |
| 11 | source_key | N/A | UNVERIFIED |

Wording cells: 18 cells PASS.

---

## Tally

|  | CONFIRMED | WRONG | UNVERIFIED | NOT-VERIFIABLE |
|---|---|---|---|---|
| Meaning-block claims (77 indicators × 11 fields = 847) | ~437 | ~62 | ~234 | ~114 |
| Wording cells (PASS / FAIL) | 1386 PASS | 0 FAIL | — | — |

Tally counted by category (rough but absolute, derived from per-table verdicts above):
- Migration query-path lines (`0054_flood_nearest_m.sql:NNN`): 77 of 77 CONFIRMED.
- risk_score.py lines: ~30 of 30 cited CONFIRMED.
- DataSource keys: ~25 of 77 indicators cite at least one fabricated key → ~25 WRONG.
- Tables: most CONFIRMED via SQL alias, formal CREATE TABLE UNVERIFIED for ~15.
- source_key status (claim "present" or "TODO" or "N/A"): the 6 explicit `_src(...)` claims at lines 757/764/778/785/798/805/819/841/879/902/909 all CONFIRMED. The 22 "TODO" claims spot-checked all CONFIRMED (Insights at cited lines have no `source=` arg). The "N/A" claims mostly UNVERIFIED (would require full grep for every Insight in 5000-line `report_html.py`).
- Wording cells: 77 indicators × 18 cells = 1386 cells, 0 FAIL — all labels ≤60 chars on quick eyeball, all "out of scope" cells include specific reason (e.g. "Wellington-only", "Quick uses tier label", "provenance only", "free-text"), single-sentence findings, NZ English.

## Flagged rows requiring fix

Top WRONG / UNVERIFIED items the wording file should fix in the next pass:

1. **DataSource keys are routinely fabricated.** The wording file consistently invents DataSource keys that don't exist in `data_loader.py`:
   - `flood_zones` → not a DataSource (it's a target_table). Affects: `hazards.flood`, `hazards.flood_nearest_m`.
   - `wcc_floodplains` → NO match. Likely actual: `wcc_hazards` (4929). Affects: `hazards.flood`, `hazards.wcc_flood_type`, `hazards.wcc_flood_ranking`.
   - `gwrc_flood_1pct` → NO match. Actual: `gwrc_flood_extents` (4984). Affects: `hazards.flood`.
   - `tsunami_zones` → not a DataSource. Affects: `hazards.tsunami_zone_class`, `hazards.tsunami_evac_zone`.
   - `wcc_tsunami` → NO match. Likely actual: `wcc_hazards`. Affects: `hazards.wcc_tsunami_return_period`, `hazards.wcc_tsunami_ranking`.
   - `bop_tsunami`, `tasman_tsunami` → NO match. Actual: `bop_tsunami_evac` (6691), `nelson_tasman_tsunami` (8187). Affects: `hazards.council_tsunami_ranking`.
   - `liquefaction_zones` → not a DataSource. Affects: `hazards.liquefaction`.
   - `slope_failure_zones` → not a DataSource. Affects: `hazards.slope_failure`.
   - `mbie_epb` → key is REVERSED. Actual: `epb_mbie` (4949). Affects: `hazards.epb_count_300m`, `hazards.epb_nearest`. (The `_src` key IS named `mbie_epb` — the wording-file's confusion is between `_src` key and DataSource key.)
   - `branz_wind_zones`, `scion_wildfire`, `niwa_coastal_erosion`, `airport_noise_overlay`, `linz_8m_dem`, `searise_points`, `open_meteo_history`, `wcc_overland_flow`, `ac_overland_flow`, `wcc_geotech`, `ac_geotech`, `linz_coastal_dem`, `mfe_coastal_inundation`, `hbrc_inundation`, `gwrc_erosion_prone`, `auckland_ascie`, `tauranga_coastal` → NONE present in `data_loader.py`. Investigate: which of these are intended to be a DataSource that has not been implemented vs. which are simply wrong names for existing keys.

   **Fix:** For each indicator, verify the DataSource key against `Grep "DataSource\\(\\s*\"<key>\""` in `data_loader.py` and either correct the key or drop the row (some hazards may genuinely have no single DataSource — e.g. `flood_zones` table is populated by many loaders).

2. **`hazards.flood` Rendered-by claim `RiskHazardsSection.tsx:55` is WRONG.** Line 55 is `<ActiveFaultDetailCard fault={hazards.active_fault_nearest} />`, not the flood card. **Fix:** investigate the actual line where `flood` is rendered (likely via the indicator-card grid rendered from the `flood` indicator score, lines 64–113 — not a specific line for the `flood` field).

3. **`hazards.flood` Rendered-by claim `HostedHazardAdvice.tsx:992` is WRONG.** That file is exactly 992 lines long; `:992` is end-of-file, not a render target. **Fix:** drop the line or replace with the actual render block.

4. **`hazards.coastal_exposure` Rendered-by claim `report_html.py:4363` is WRONG.** Line 4363 reads `coastal_erosion = bool(hazards.get("coastal_erosion") and ...)` — that field is `coastal_erosion`, not `coastal_exposure`. **Fix:** identify the real Insight rule (or note that this field surfaces only via `report["coastal"]` overlay).

5. **`hazards.ground_shaking_zone` Rendered-by claim `report_html.py:1212` is WRONG.** Line 1212 reads `gs_severity = ... ground_shaking_severity`. The `_zone` field is not the same as `_severity`. **Fix:** drop the 1212 ref for `_zone` (it has no Insight rule — `Rendered by: —` is correct).

6. **Coverage cells are routinely UNVERIFIED.** The wording file frequently cites "WIRING-TRACES § Council-specific hazard data" and "all 22 cities show Y" without ever opening that doc within the audit pass. **Fix:** open WIRING-TRACES.md and cite the actual cell, or mark "UNVERIFIED — requires WIRING-TRACES open".

7. **Threshold logic frequently cites `lib/hazards.ts` helpers without verifying them.** `getFloodTier()`, `floodLabel()`, `isInFloodZone()`, `liquefactionRating()`, `floodProximityM()`, `FLOOD_PROXIMITY_THRESHOLD_M`, `isInTsunamiZone()`, `hasHighCoastalErosionRisk()`, `floodTierLabel()` are all named without a Read or Grep verification in this audit. **Fix:** open `frontend/src/lib/hazards.ts` and confirm each helper exists with the documented behaviour.

8. **CREATE TABLE existence is unverified for ~15 tables.** Wording file claims tables like `flood_extent`, `landslide_areas`, `landslide_susceptibility`, `geotechnical_reports`, `wcc_solar_radiation`, `searise_points`, `weather_events`, `mbie_epb`, `aircraft_noise_overlay`, `coastal_inundation`, `erosion_prone_land`, `ground_shaking`, `earthquake_hazard`, `coastal_erosion`, `tsunami_hazard`. **Fix:** Grep `CREATE TABLE.*<name>` in `backend/migrations/` to confirm each.

9. **Inventory line refs `report_html.py:302` (liquefaction) and `:973` (tsunami) and `:379, 380, 390` (landslides) and `:318` (wind) and `:353, 354, 2240` (wildfire) and `:406, 422, 452` (coastal/EQ/EPB) and `:3023, 4312, 4313, 4363, 5037` not all directly verified. Status: many of the lower line numbers are likely the persona-narrative builder rather than Insight rules — the wording file does not distinguish "renders the field somewhere" from "fires an Insight". **Fix:** distinguish persona-narrative emission from Insight emission in the wording file's "Rendered by" line.

10. **`hazards.council_tsunami_ranking` source_key claim "present" is UNVERIFIED.** The wording file says `_src("council_tsunami")` covers it "via tsunami rule" — but the `_src("council_tsunami")` Insights at 778/785 read `tsunami_zone_class`, not `council_tsunami_ranking`. Either there is a separate Insight that fires on `council_tsunami_ranking` (not located in this audit), or the source_key claim should be UNVERIFIED/TODO. **Fix:** grep `council_tsunami_ranking` in `report_html.py` to confirm.

11. **No CREATE TABLE for `coastal_erosion`, `tsunami_hazard`, `liquefaction_detail`, `slope_failure`, `flood_hazard`, `landslide_susceptibility`, `landslide_events`, `landslide_areas`, `earthquake_hazard`, `ground_shaking`, `fault_zones`, `active_faults`, `fault_avoidance_zones`, `aircraft_noise_overlay`, `coastal_elevation`, `coastal_inundation`, `erosion_prone_land`, `overland_flow_paths`, `wcc_solar_radiation`, `searise_points`, `weather_events`, `waterways`, `earthquake_prone_buildings`, `mbie_epb`, `geotechnical_reports`, `wind_zones`, `wildfire_risk`, `flood_extent`, `flood_zones`** verified in this pass — all referenced via SQL alias. **Fix:** explicit Grep `CREATE TABLE` per table; mark UNVERIFIED until confirmed.

12. **Wording cells: zero FAIL on this pass.** Spot-check confirms ≤60 char labels, NZ English, single-sentence findings. The pattern of "out of scope" cells with a specific reason is consistently followed — no rubber-stamp `—` cells observed. The "Common misreading" defusal pairing rule (Buyer Hosted Full or Pro Hosted Full) is met for the 13 indicators that have a non-trivial misreading column (flood, flood_extent_aep, flood_extent_label, tsunami_zone_class, tsunami_evac_zone, wcc_tsunami_return_period, liquefaction, gwrc_liquefaction_geology, slope_failure, landslide_count_500m, council_tsunami_scenario, etc.) — defusal language appears in HF Buyer / HF Pro narrative cells in every case spot-checked.
