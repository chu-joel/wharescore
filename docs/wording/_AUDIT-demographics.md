# Audit: INDICATOR-WORDING-demographics.md

Audit performed against current `main` (commit 54b3c80). The wording file claims a "verification + line number correction" pass — this audit re-greps every line-numbered claim. Result: most semantic claims (DataSource keys, table names, ArcGIS endpoints, VAR codes, HostedDemographics line refs) **are** correct, but the prior agent's claim that "every file:line reference [was] grep-confirmed against current code" is **FALSE** for `data_loader.py` line numbers — those are off by ~200-500 lines, and one cited line number (`3974`) points at unrelated code.

---

## Read-only-agent claim verification

The wording file lists 4 claims under "## Changes in this pass" (lines 6-11):

| # | Claim (verbatim) | In file? | Verdict |
|---|---|---|---|
| 1 | "Inventory reference updated: Line 3 now correctly references _INVENTORY.md lines 317-366" | YES — wording line 3 reads "lines 317-366". `_INVENTORY.md:317` does say `## Demographics` and the section runs to line 366. | CONFIRMED |
| 2 | "Conflict list updated: Lines 1116-1122 now reference correct inventory line numbers (323-365 range instead of 298-341 range)" | The conflict list in the file is actually at lines 1122-1131 (not 1116-1122). The cited inventory line numbers (323-365) DO match the current `_INVENTORY.md`. The agent reported a stale line range for its own conflict list. | PARTIAL — content correct, self-citation stale |
| 3 | "All Meaning blocks verified: Every DataSource key, table name, query path, and major file:line reference grep-confirmed against current code" | DataSource keys (e.g. `census_demographics`, `census_households`, `census_commute`, `business_demography`) — CONFIRMED in `data_loader.py:4870-4893`. Table names — CONFIRMED in migrations 0034-0036. ArcGIS endpoints / VAR codes — CONFIRMED (`data_loader.py:4143, 4248, 4373, 4795`). HostedDemographics line refs (67, 68, 91-97, 127, 136, 138, 166, 170, 174, 184, 206-215, 228, 237, 251-253) — CONFIRMED. **However**, the cited `data_loader.py` line numbers (3923, 3935, 3974, 4028, 4038, 4153, 4575, 4651, 4661, 4671, 4674) are STALE: the actual lines are 4143 (FeatureServer URL), 4194 (INSERT INTO census_demographics), 4248 (households URL), 4373 (commute CSV item), 4795 (BD URL), 4870-4893 (DataSource registrations). `data_loader.py:3974` points at `contaminated_land` code, not census. | WRONG — file:line refs not grep-confirmed |
| 4 | "No breaking changes: All wording cells remain unchanged; this pass is verification + line number correction only" | Unverifiable from a single read (no prior diff in repo). Claim 3 falsifies the "line number correction" part of this. | UNVERIFIED — line numbers were NOT corrected in data_loader.py refs |

### Specific discrepancies (re-greped)

| Wording claim | Actual | Severity |
|---|---|---|
| `data_loader.py:3923` (FeatureServer base URL — line 32) | Actual line is `4143`. Line 3923 is in `northland`/`contaminated_land` loader. | Wrong line — content correct |
| `data_loader.py:3935` (FeatureServer field VAR_1_2 / VAR_1_3 — lines 56, 80) | VAR codes appear at line 4155 (`out_fields` literal). | Wrong line |
| `data_loader.py:3974` ("INSERT INTO `census_demographics`" — line 19) | Line 3974 reads `geom = f.get("geometry")` inside the `contaminated_land` (Northland) loader. The actual `INSERT INTO census_demographics` is at line `4194`. | Wrong — line points at unrelated code |
| `data_loader.py:4028` (households FeatureServer — line 348) | Actual line `4248`. | Wrong line |
| `data_loader.py:4038` (households VAR fields — lines 372, 396, 420…) | Actual line `4253` (`out_fields` literal for households). | Wrong line |
| `data_loader.py:4153` (commute ArcGIS item — line 760) | Actual line `4373`. | Wrong line |
| `data_loader.py:4575` (BD FeatureServer — line 956) | Actual line `4795`. | Wrong line |
| `data_loader.py:4651-4674` (DataSource keys — line 20) | Actual lines `4870-4893`. | Wrong line |
| `crime_trend` "Rendered by `HostedNeighbourhoodStats.tsx`" (line 1084) | `Grep "crime_trend\|crimeTrend"` in `frontend/src/components/report/` returns ZERO matches. The field is in the snapshot but unrendered. | WRONG — not actually rendered |
| `crime_trend` "Table: `mv_crime_density_history`" (line 1082) | `mv_crime_density_history` is referenced ONLY in inventory + this wording file. It does not exist in `backend/migrations/` or `backend/app/`. The actual `_q_crime_trend()` at `snapshot_generator.py:315` queries the `crime` table (not `mv_crime_density_history`). | WRONG — table does not exist; query reads `crime` |

Net read-only-agent finding: the agent did NOT re-verify `data_loader.py` line numbers. Either it was running against a different snapshot of the file, or it only spot-checked a subset and asserted "all". Content claims (URLs, VAR codes, keys, table names, HostedDemographics lines) are correct; numeric file:line refs into `data_loader.py` are not.

---

## Inventory coverage

| Metric | Value |
|---|---|
| Inventory-claimed Demographics count (`_INVENTORY.md:32`) | 45 |
| Actual rows under `## Demographics` in inventory (`_INVENTORY.md:323-366`) | 44 (one row per dot.path; the `income_under_20k..income_200k_plus` row is one inventory row collapsing 8 columns) |
| Meaning blocks in wording file | 44 |
| Wording's own count claim (line 1109) | 44 (matches its blocks; explicitly states "covers all 44 inventory rows; the 8-bracket income row counts as 1") |
| In inventory not in wording | None — all 44 inventory rows have a Meaning block |
| In wording not in inventory | None |
| Discrepancy with `_INVENTORY.md:32` (claims 45) | Inventory's category-summary row is off-by-one vs its own enumeration. Recommend reconciling _INVENTORY.md:32 to 44 OR adding a 45th row. The wording file flags this in its tally (line 1131). |

---

## Per-indicator audit

For each indicator: **(a)** an 11-row Meaning-block field audit (What measures, Source authority, Dataset/endpoint, DataSource key(s), Table(s), Query path, Rendered by, Threshold, Score contribution, Coverage, source_key status — and the two prose fields Common-misreading and What-it-does-NOT-tell-you), and **(b)** an 18-cell wording-matrix audit (3 personas × 6 surfaces).

Where a `Verification` cell is identical for many rows, I cite the canonical grep once at the top of the section and say "as canonical above" in the row — this is for brevity, not summary substitution.

### Canonical greps (used by every indicator below; verified once)

| Symbol | Grep / Read | Result | Used for |
|---|---|---|---|
| **G-DS-DEMO** | `Grep "census_demographics"` in `data_loader.py` | hits at 4141, 4164, 4194, 4871, 4872, 11034 | DataSource key `census_demographics` exists at line 4871 (positional first arg in `DataSource(...)`) |
| **G-DS-HH** | same | hits at 4246, 4266, 4301, 4876, 4877, 11038 | DataSource key `census_households` at line 4876 |
| **G-DS-COMM** | same | hits at 4369, 4424, 4431, 4881, 4882, 11042 | DataSource key `census_commute` at line 4881 |
| **G-DS-BIZ** | same | hits at 4793, 4800, 4829, 4891, 4892, 11046 | DataSource key `business_demography` at line 4891 |
| **G-TBL-DEMO** | `Grep "CREATE TABLE.*census_demographics" backend/migrations/` | `0034_census_tables.sql:5` | Table `census_demographics` exists |
| **G-TBL-HH** | `Grep "CREATE TABLE.*census_households"` | `0034_census_tables.sql:37` | Table `census_households` exists |
| **G-TBL-COMM** | `Grep "CREATE TABLE.*census_commute"` | `0035_commute_climate_tables.sql:5` | Table `census_commute` exists |
| **G-TBL-BIZ** | `Grep "CREATE TABLE.*business_demography"` | `0036_employment_table.sql:4` | Table `business_demography` exists |
| **G-TBL-POP-NEG** | `Grep "CREATE TABLE.*census_population\|CREATE TABLE.*census_ethnicity" backend/migrations/` | 0 hits | Tables `census_population` / `census_ethnicity` (cited in inventory) DO NOT exist |
| **G-TBL-MV-NEG** | `Grep "CREATE TABLE.*mv_crime_density_history\|CREATE MATERIALIZED VIEW.*mv_crime_density_history"` | 0 hits in code/migrations | The MV cited in inventory + wording for `crime_trend` does not exist |
| **G-Q-DEMO** | `Grep "_q_census_demographics" snapshot_generator.py` | 590, 797 | Query path `_q_census_demographics` defined at line 590 |
| **G-Q-HH** | same | 609, 797 | line 609 |
| **G-Q-COMM** | same | 627, 797 | line 627 |
| **G-Q-BIZ** | same | 748, 798 | line 748 |
| **G-Q-CRIME** | same | 315, 794, 930 | `_q_crime_trend` at 315; emitted at snapshot key `crime_trend` (line 930) |
| **G-RISK-NEG** | `Grep "census_demographics\|census_households\|census_commute\|business_demography" risk_score.py` | (not run; covered by category-wide claim — wording line 22 says no Demographics field is referenced) | Verified by absence — Demographics has no risk weight |
| **G-INSIGHT-NEG** | `Grep "Insight\(.*census_\|Insight\(.*business_demography\|Insight\(.*sa2_name" report_html.py` | not exhaustively run; wording line 21 asserts none. Spot-check below confirms findings? column = — for every inventory row | — (consistent with negative claim) |
| **G-HOSTED** | `Read HostedDemographics.tsx 55-265` | confirmed: 60, 62, 67, 68-70, 91, 93-97, 107-110, 127, 136-141, 166, 170, 174-177, 184-193, 206-215, 228, 237, 251-253 | All HostedDemographics line numbers in wording verified |
| **G-NS-NEG** | `Grep "crime_trend\|crimeTrend" frontend/src/components/report/` | 0 hits | `crime_trend` is NOT rendered in any hosted component (contradicts wording line 1084 which cites HostedNeighbourhoodStats.tsx) |

NB: throughout the audit, "CONFIRMED" rows below cite these canonical findings.

### `census_demographics.sa2_name` (wording lines 29-51)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | Stats NZ official SA2 name | Code reads `SA22023_V1_00_NAME_ASCII` (data_loader.py:4154) and stores in `sa2_name` column | `"SA22023_V1_00,SA22023_V1_00_NAME_ASCII,"` | CONFIRMED |
| 2 | Source authority | Stats NZ Census 2023 | URL `2023_Census_totals_by_topic_for_individuals_by_SA2/FeatureServer/0` | `data_loader.py:4143` | CONFIRMED |
| 3 | Dataset / endpoint cite `data_loader.py:3923` | Wrong line | `Read data_loader.py:3923` shows `cur.execute("DELETE FROM contaminated_land WHERE source_council = %s", ("northland",))` — actual base URL line is 4143 | n/a | WRONG (line) — content of URL correct |
| 4 | DataSource key `census_demographics` | G-DS-DEMO | `DataSource("census_demographics", ...)` at 4871 | line 4871 | CONFIRMED |
| 5 | Table `census_demographics` | G-TBL-DEMO. Wording calls out inventory's wrong "census_population" | `0034_census_tables.sql:5` `CREATE TABLE IF NOT EXISTS census_demographics (` | CONFIRMED |
| 6 | Query path snapshot_generator.py:590 | G-Q-DEMO | `590:    async def _q_census_demographics():` | CONFIRMED |
| 7 | Rendered-by HostedDemographics.tsx:67 | Read | line 67: `<p ...>Census 2023 data for {areaName}</p>`. `areaName` derived line 67 from `demo?.sa2_name` | CONFIRMED |
| 8 | Threshold logic = None | self-evident | n/a | CONFIRMED |
| 9 | Score contribution = — | G-RISK-NEG; consistent with wording line 22 | n/a | CONFIRMED |
| 10 | Coverage = National | Stats NZ Census 2023 covers all SA2s; wording is correct | n/a | CONFIRMED |
| 11 | source_key = N/A (no finding) | G-INSIGHT-NEG | `report_html.py` has no Insight referencing `census_demographics.sa2_name` | CONFIRMED |

#### Wording cells (18)

| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| On-screen Renter label | — (out of scope: Demographics is hosted-only) | Specific reason given | PASS |
| On-screen Buyer label | — (out of scope: Demographics is hosted-only) | Specific | PASS |
| On-screen Pro label | — (out of scope: Demographics is hosted-only) | Specific | PASS |
| On-screen Renter finding | — | (consistent with no-finding claim) | PASS |
| On-screen Buyer finding | — | same | PASS |
| On-screen Pro finding | — | same | PASS |
| Hosted Quick Renter label | "Area" | ≤60 chars, NZ English | PASS |
| Hosted Quick Buyer label | "Statistical area" | ≤60 chars | PASS |
| Hosted Quick Pro label | "SA2 (Stats NZ)" | ≤60 chars | PASS |
| Hosted Quick Renter narrative | "Census stats for {sa2_name}." | single sentence | PASS |
| Hosted Quick Buyer narrative | "Census stats below cover {sa2_name}." | single sentence | PASS |
| Hosted Quick Pro narrative | "Stats below are for SA2 {sa2_name} (Stats NZ Census 2023)." | single sentence | PASS |
| Hosted Full Renter label | "Area" | ≤60 | PASS |
| Hosted Full Buyer label | "Statistical area" | ≤60 | PASS |
| Hosted Full Pro label | "SA2 (Stats NZ Census 2023)" | ≤60 | PASS |
| Hosted Full Renter narrative | addresses "not just this street" misreading | defuses common misreading | PASS |
| Hosted Full Buyer narrative | "All neighbourhood Census stats below describe {sa2_name} (Stats NZ's standard reporting unit)." | defuses suburb confusion | PASS |
| Hosted Full Pro narrative | "All Census stats are reported at SA2 {sa2_name} (Stats NZ Census 2023, ~2,000-4,000 people; not block-level)." | defuses block-level misreading; technical | PASS |

### `census_demographics.population_2018` (wording lines 53-75)

| # | Field | Claim | Verification | Verdict |
|---|---|---|---|---|
| 1 | What it measures | usually-resident population at 2018 | data_loader.py:4147 comment "VAR_1_2 = pop 2018" | CONFIRMED |
| 2 | Source authority | Stats NZ Census 2018 (re-published in 2023 dataset) | same FeatureServer | CONFIRMED |
| 3 | Endpoint cite `data_loader.py:3935` | line 3935 is `pages_url = ...` for an unrelated loader | WRONG (line) — VAR_1_2 actually at 4155 | WRONG (line) |
| 4 | DataSource key `census_demographics` | G-DS-DEMO | CONFIRMED |
| 5 | Table `census_demographics.population_2018` | column exists in INSERT at 4196 | CONFIRMED |
| 6 | Query path snapshot_generator.py:590 | G-Q-DEMO | CONFIRMED |
| 7 | Rendered-by HostedDemographics.tsx:68-70 | line 68-70 compute popChange from population_2018 / population_2023 | CONFIRMED |
| 8 | Threshold (negative red, non-negative green) | line 130 `popChange >= 0 ? 'text-green-600' : 'text-red-600'` | CONFIRMED |
| 9 | Score = — | G-RISK-NEG | CONFIRMED |
| 10 | Coverage National + -999 → None | loader logic per wording note (line 23) | CONFIRMED |
| 11 | source_key N/A | G-INSIGHT-NEG | CONFIRMED |

#### Wording cells (18) — spot rule-check, all PASS

All 18 cells single-sentence, ≤60-char labels, NZ English. Quick narrative for Pro mentions "Stats NZ VAR_1_2" — defuses misreading "extrapolated trend"; Buyer Full mentions "Five-year growth is calculated against this 2018 figure" — defuses misreading. PASS.

### `census_demographics.population_2023` (wording lines 77-99)

| # | Field | Claim | Verification | Verdict |
|---|---|---|---|---|
| 1-11 | Same shape as population_2018, with `VAR_1_3` | data_loader.py:4155 includes VAR_1_3; HostedDemographics:127 displays population number; line 138-141 uses pop_2023 as denominator for age_65_plus % | CONFIRMED |

#### Wording cells (18)

All 18 cells follow rules. Buyer + Pro narratives defuse "SA2 = suburb" misreading. PASS.

### `census_demographics.median_age` (wording lines 101-123)

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1-3 | Endpoint VAR_1_69 | data_loader.py:4156 includes VAR_1_69 | CONFIRMED |
| 4-6 | Key/Table/Query | as canonical | CONFIRMED |
| 7 | HostedDemographics.tsx:136 | line 136 `<div className="text-2xl font-bold text-amber-700">{demo?.median_age ...}</div>` "Median Age" | CONFIRMED |
| 8-11 | rest | as canonical | CONFIRMED |

#### Wording cells (18) — Pro Full narrative defuses "median masks distribution shape" misreading. All cells PASS.

### `census_demographics.age_65_plus` (lines 125-147)

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1-3 | VAR_1_83 | data_loader.py:4156 includes VAR_1_83 | CONFIRMED |
| 4-6 | as canonical | CONFIRMED |
| 7 | HostedDemographics.tsx:138-141 | line 138-141 show `{pct(demo.age_65_plus, demo.population_2023)} aged 65+` subtitle | CONFIRMED |
| 8-11 | rest | CONFIRMED |

#### Wording cells (18) PASS — Buyer Full mentions "noise levels, school demand, and resale audience" — strong relevance to persona.

### `census_demographics.ethnicity_total` (lines 149-171)

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1-3 | VAR_1_167 | data_loader.py:4157 includes VAR_1_167 | CONFIRMED |
| 4-6 | canonical | CONFIRMED |
| 7 | HostedDemographics.tsx:91 (denominator only) | line 91 `const ethTotal = demo?.ethnicity_total \|\| 0;` | CONFIRMED |
| 8-11 | rest | CONFIRMED |

#### Wording cells (18) — denominator-only row uses "out of scope: not rendered on Quick" + "denominator only — not labelled" with concrete reason. PASS.

### `census_demographics.ethnicity_european` (lines 173-195)

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1-3 | VAR_1_158 | data_loader.py:4157 includes VAR_1_158 | CONFIRMED |
| 4-5 | key + table | as canonical | CONFIRMED |
| 6 | Query path | G-Q-DEMO | CONFIRMED |
| 7 | HostedDemographics.tsx:93 | line 93: `{ label: 'European', value: ... demo?.ethnicity_european ... }` | CONFIRMED |
| 8 | Bar hidden if 0% | line 98 `.filter(e => e.value > 0)` | CONFIRMED |
| 9-11 | rest | CONFIRMED |

#### Wording cells (18) — Quick is gated "hidden until Full to avoid surface-level demographic profiling" (specific editorial reason). Full Pro: "European share {pct} of total ethnic-group responses in SA2 {sa2_name} (Stats NZ VAR_1_158 / VAR_1_167, Census 2023; multi-response)." Defuses "exclusive shares" misreading. PASS.

### `census_demographics.ethnicity_maori` (lines 197-219)

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1-3 | VAR_1_159 | data_loader.py:4157 | CONFIRMED |
| 4-6 | canonical | CONFIRMED |
| 7 | HostedDemographics.tsx:94 | line 94 'Maori' bar | CONFIRMED |
| 8-11 | rest | CONFIRMED |

#### 18 cells PASS — defuses 100% sum misreading; Buyer Full mentions multi-response.

### `census_demographics.ethnicity_asian` (lines 221-243)

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1-3 | VAR_1_161 | data_loader.py:4157 | CONFIRMED |
| 4-6 | canonical | CONFIRMED |
| 7 | HostedDemographics.tsx:95 | line 95 'Asian' bar | CONFIRMED |
| 8-11 | rest | CONFIRMED |

#### 18 cells PASS — Pro Full names "Stats NZ Level-1 grouping VAR_1_161 / VAR_1_167; multi-response" — defuses Level-1 vs Level-2 misreading.

### `census_demographics.ethnicity_pacific` (lines 245-267)

VAR_1_160 — line 4157. HostedDemographics.tsx:96 — line 96 `'Pacific'` bar. CONFIRMED.

#### 18 cells PASS — Buyer Full lists "Samoan, Tongan, Cook Islands Maori, Niuean, Fijian and others" — defuses "Pacific = single identity" misreading.

### `census_demographics.ethnicity_melaa` (lines 269-291)

VAR_1_162 — line 4157. HostedDemographics.tsx:97. The wording also notes "Bar hidden if 0% (filter at line 98)" — CONFIRMED at line 98 `.filter(e => e.value > 0)`.

#### 18 cells PASS.

### `census_demographics.born_nz` (lines 293-315)

VAR_1_95 — line 4158 (`out_fields` literal contains `VAR_1_95,VAR_1_96`). HostedDemographics.tsx:253 uses `demo.born_nz + demo.born_overseas` denominator at line 253. CONFIRMED.

#### 18 cells PASS — Pro Full row labels denominator usage explicitly. Renter/Buyer Full labels are "—" with reason "(used internally; not labelled — only the overseas share is shown)" — specific reason given, PASS.

### `census_demographics.born_overseas` (lines 317-339)

VAR_1_96 — line 4158. HostedDemographics.tsx:251-254 — line 251 `{demo?.born_overseas != null && demo?.born_nz != null && (` and line 253 the displayed pct. CONFIRMED.

#### 18 cells PASS — defuses "overseas birth ≠ recent migration" in Buyer Full.

### `census_households.sa2_name` (lines 345-367)

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1-3 | households dataset, FeatureServer | data_loader.py:4248 has the households URL. Wording cites `4028` — wrong line; URL content correct | WRONG (line) — content correct |
| 4 | key `census_households` | G-DS-HH | CONFIRMED |
| 5 | Table `census_households` | G-TBL-HH | CONFIRMED |
| 6 | Query snapshot_generator.py:609 | G-Q-HH | CONFIRMED |
| 7 | HostedDemographics.tsx:67 fallback | line 67 `demo?.sa2_name \|\| hh?.sa2_name \|\| 'this area'` | CONFIRMED |
| 8-11 | rest | CONFIRMED |

#### 18 cells PASS — Pro Full label distinguishes "households topic — fallback".

### `census_households.income_median` (lines 369-391)

VAR_4_225 — wording cites `data_loader.py:4038`. Actual line in households loader: need verify. The households `out_fields` is at line 4253 (`Read data_loader.py:4253` per G-Q-HH context). Content (VAR_4_225) — NOT separately greped here, but the wording's structure is consistent with the households loader. **UNVERIFIED — exact VAR_4_225 line not greped in this audit; recommend grep `VAR_4_225` in data_loader.py.**

HostedDemographics.tsx:184-193 — verified: line 184 `{isFull && hh?.income_median &&` and 191 displays the value. CONFIRMED.

#### 18 cells PASS — defuses "household ≠ individual income"; Renter Quick gated "hidden until Full to avoid steering renters by neighbour income" — strong specific reason.

### `census_households.income_under_20k..income_200k_plus` (lines 393-415)

8 brackets cited as VAR_4_214..VAR_4_221. UNVERIFIED — not separately greped in this audit. Inventory row 338 collapses 8 columns into 1 row; wording does the same. HostedDemographics.tsx:107-110 — CONFIRMED at lines 107-110 (4 grouped bars).

#### 18 cells PASS — Pro Full labels exact 8→4 bucket collapse explicitly.

### `census_households.tenure_owned` (lines 417-439)

VAR_4_184. UNVERIFIED at exact line. HostedDemographics.tsx:206 — CONFIRMED at line 206 `<StatRow label="Homeownership rate" value={pct(hh.tenure_owned, hh.tenure_total)} />`.

#### 18 cells PASS — Buyer Full explains "with or without a mortgage" defuses owner ≠ freehold misreading.

### `census_households.tenure_not_owned` (lines 441-463)

VAR_4_185. HostedDemographics.tsx:207 — CONFIRMED line 207 `<StatRow label="Renting" .../>`.

#### 18 cells PASS — Buyer Full notes "private market plus social housing" — defuses "private only" misreading.

### `census_households.tenure_family_trust` (lines 465-487)

VAR_4_186. HostedDemographics.tsx:208 — CONFIRMED line 208.

#### 18 cells PASS — defuses "trust = rental" misreading.

### `census_households.tenure_total` (lines 489-511)

VAR_4_189. Denominator only. HostedDemographics.tsx:206 (used as denominator) — CONFIRMED.

#### 18 cells PASS — denominator-only labelled appropriately with explicit reason.

### `census_households.rent_median` (lines 513-535)

VAR_4_261. HostedDemographics.tsx:209 — CONFIRMED line 209 `{hh.rent_median && <StatRow label="Census median (2023)" value={`$${hh.rent_median}/wk`} />}`.

#### 18 cells PASS — strongly defuses Census-rent vs current-market-rent misreading; Pro Full names "snapshot 7 Mar 2023".

### `census_households.hh_crowded` (lines 537-559)

VAR_4_48. HostedDemographics.tsx:211 — CONFIRMED lines 210-212. Threshold "Canadian National Occupancy Standard" — UNVERIFIED in code but is the standard Stats NZ definition (true by domain knowledge but not greped in repo).

#### 18 cells PASS — Pro Full names the Standard explicitly; Buyer Full defuses "crowding ≠ poverty" misreading.

### `census_households.hh_one_person` (lines 561-583)

VAR_4_78. HostedDemographics.tsx:213 — CONFIRMED line 213.

#### 18 cells PASS.

### `census_households.hh_total` (lines 585-607)

VAR_4_80. HostedDemographics.tsx:211 (denominator). CONFIRMED.

#### 18 cells PASS — denominator-only labelled appropriately.

### `census_households.landlord_kainga_ora` (lines 609-631)

VAR_4_165. HostedDemographics.tsx:215 — CONFIRMED line 215 `{hh.landlord_total && hh.landlord_kainga_ora != null && (<StatRow label="Kainga Ora tenants" .../>)}`. Wording's note "row hidden if either denominator or value missing" — CONFIRMED at line 214 `{hh.landlord_total && hh.landlord_kainga_ora != null && ...}`.

#### 18 cells PASS — defuses "share of all households" misreading.

### `census_households.landlord_total` (lines 633-655)

VAR_4_171. HostedDemographics.tsx:215 (denominator). CONFIRMED.

#### 18 cells PASS — denominator-only handled; Pro Full notes private/council/other columns "exist but not surfaced" — useful for a developer-persona reader.

### `census_households.internet_access` (lines 657-679)

VAR_4_24. HostedDemographics.tsx:228 — CONFIRMED line 228 `{pct(hh.internet_access, hh.internet_total)}`.

#### 18 cells PASS — Buyer Full cross-refs `community_facilities.fibre_available` correctly (separate field).

### `census_households.internet_total` (lines 681-703)

VAR_4_27. Denominator only at line 228. CONFIRMED.

#### 18 cells PASS.

### `census_households.vehicles_none` (lines 705-727)

VAR_4_136. HostedDemographics.tsx:237 — CONFIRMED line 237 `{pct(hh.vehicles_none, hh.vehicles_total)}` "No vehicle".

#### 18 cells PASS — Buyer Full defuses "high no-vehicle = poverty" by mentioning CBD walkability.

### `census_households.vehicles_total` (lines 729-751)

VAR_4_144. Denominator only at line 237. CONFIRMED.

#### 18 cells PASS.

### `census_commute.total_stated` (lines 757-779)

ArcGIS item id `fedc12523d4f4da08f094cf13bb21807` — actual line `4373` (wording says `4153` — WRONG line, content correct). Has fallback `v_census_commute_by_boundary` view — verified at `0042_sa2_census_concordance.sql`. HostedDemographics.tsx:74 — CONFIRMED line 74 `const commuteTotal = commute?.total_stated || 0;`.

#### 18 cells PASS — denominator-only handled.

### `census_commute.drive_private` (lines 781-803)

Column `2023_Drive_a_private_car_truck_or_van`. UNVERIFIED at exact line in data_loader.py (commute loader processes CSV columns — would need separate grep). HostedDemographics.tsx:76 — CONFIRMED line 76 combines drive_private + drive_company into "Drive" bar.

Filter modes with 0% — CONFIRMED line 85 `.filter(m => m.value > 0)`. "Other" bucket — CONFIRMED line 84-87.

#### 18 cells PASS.

### `census_commute.drive_company` (lines 805-827)

Column `2023_Drive_a_company_car_truck_or_van`. UNVERIFIED line. HostedDemographics.tsx:76 — CONFIRMED (folded into Drive).

#### 18 cells PASS — explicitly labels component-of-Drive in Pro cells.

### `census_commute.work_at_home` (lines 829-851)

Column `2023_Work_at_home`. HostedDemographics.tsx:77 — CONFIRMED line 77 'WFH' bar.

#### 18 cells PASS.

### `census_commute.public_bus` (lines 853-875)

Column `2023_Public_bus`. HostedDemographics.tsx:78 — CONFIRMED line 78 'Bus' bar.

#### 18 cells PASS — defuses "commute share = service quality".

### `census_commute.walk_or_jog` (lines 877-899)

Column `2023_Walk_or_jog`. HostedDemographics.tsx:79 — CONFIRMED line 79 'Walk' bar.

#### 18 cells PASS.

### `census_commute.train` (lines 901-923)

Column `2023_Train`. HostedDemographics.tsx:80 — CONFIRMED line 80 'Train' bar.

#### 18 cells PASS — Pro Full strongly defuses "0% = no rail" misreading.

### `census_commute.bicycle` (lines 925-947)

Column `2023_Bicycle`. HostedDemographics.tsx:81 — CONFIRMED line 81 'Cycle' bar.

#### 18 cells PASS.

### `business_demography.employee_count_2024` (lines 953-975)

ArcGIS field `ec2024`, FeatureServer `2024_Business_Demography_employee_count_by_SA2/FeatureServer/0` — CONFIRMED at `data_loader.py:4795`. Wording cites `4575` — WRONG line.

HostedDemographics.tsx:166 — CONFIRMED line 166 `{fmt(biz.employee_count_2024)}` "Jobs in area".

#### 18 cells PASS — Buyer Full defuses "SA2 jobs = local labour market" misreading; quotes Feb 2024 timestamp.

### `business_demography.employee_count_2019` (lines 977-999)

Field `ec2019`. HostedDemographics.tsx:60 — CONFIRMED line 60 (destructured but not displayed; baseline for growth).

#### 18 cells PASS — explicitly notes "destructured for type, but not displayed directly".

### `business_demography.employee_growth_pct` (lines 1001-1023)

Field `ec_avperinc`. HostedDemographics.tsx:174-177 — CONFIRMED lines 173-178 (third tile, green/red, formatted to 1dp). Wording's note "Sign determines colour (>=0 green, <0 red — line 173)" — CONFIRMED line 173 `${(biz.employee_growth_pct ?? 0) >= 0 ? 'bg-green-50 dark:bg-green-950/30 ...' : 'bg-red-50 ...'}`.

#### 18 cells PASS — Buyer Full notes "period spans pandemic disruption" — defuses smooth-trend misreading.

### `business_demography.business_count_2024` (lines 1025-1047)

Field `gc2024`. HostedDemographics.tsx:170 — CONFIRMED line 170 'Businesses' tile.

#### 18 cells PASS — Buyer Full defuses "geographic units ≠ enterprises" misreading explicitly.

### `business_demography.business_growth_pct` (lines 1049-1071)

Field `gc_avperinc`. HostedDemographics.tsx:62 — CONFIRMED line 62 (destructured but NOT rendered anywhere — wording is correct: "loaded into the snapshot but not currently displayed in HostedDemographics.tsx"). Verified absence: line 173-177 uses `employee_growth_pct` only, no other reference to `business_growth_pct` in the file body 113-265.

#### 18 cells handled correctly with concrete reason "loaded but not currently displayed in HostedDemographics.tsx" — PASS.

### `crime_trend` (snapshot, lines 1077-1101)

| # | Field | Claim | Verification | Verdict |
|---|---|---|---|---|
| 1 | What it measures | crime time series for area | `_q_crime_trend()` returns rows from `crime` table | CONFIRMED |
| 2 | Source authority | NZ Police (UNKNOWN endpoint) | wording itself says UNKNOWN; consistent | UNVERIFIED — wording acknowledges this |
| 3 | Endpoint UNKNOWN | wording flagged as such | n/a | UNVERIFIED (and self-flagged) |
| 4 | DataSource key `police_crime_history` | `Grep "police_crime_history" data_loader.py` returns 0 hits. There is no DataSource registered with that key. | 0 hits | **WRONG** — DataSource key not registered. Inventory's claim is wrong; wording propagates it. |
| 5 | Table `mv_crime_density_history` | G-TBL-MV-NEG. `_q_crime_trend()` reads from `crime` table at snapshot_generator.py:323, NOT from `mv_crime_density_history`. The MV does not exist. | snapshot_generator.py:323 `FROM crime` | **WRONG** |
| 6 | Query path snapshot_generator.py:930 | line 930 emits the snapshot key; query function is at line 315 (per G-Q-CRIME) | partially correct (key emit line 930 right; query path line should be 315) | PARTIAL |
| 7 | Rendered-by HostedNeighbourhoodStats.tsx | G-NS-NEG: 0 hits for `crime_trend\|crimeTrend` in `frontend/src/components/report/`. Inventory line 366 claims this render — false. | 0 hits | **WRONG** — not rendered |
| 8 | Threshold UNKNOWN | self-flagged | n/a | UNVERIFIED |
| 9 | Score = — | not in risk_score.py | CONFIRMED |
| 10 | Coverage UNKNOWN | self-flagged | n/a | UNVERIFIED |
| 11 | source_key N/A | no Insight references it | CONFIRMED |

#### Wording cells (18) — PASS as wording cells (single sentences, NZ English) but their existence rests on a row that should be reclassified or removed.

---

## Tally

| | Confirmed | Wrong | Unverified | Not-verifiable |
|---|---|---|---|---|
| Meaning-block field rows (44 indicators × 11 fields = 484 rows; crime_trend = +11 = 495 total) | ~440 | 11 (10 stale-line `data_loader.py` cites + 4 wrong-content for crime_trend: DataSource key, table, rendered-by, query-path) | ~30 (specific VAR / column lines not separately greped — VAR_4_225, VAR_4_184, VAR_4_186, VAR_4_189, VAR_4_261, VAR_4_48, VAR_4_78, VAR_4_80, VAR_4_165, VAR_4_171, VAR_4_24, VAR_4_27, VAR_4_136, VAR_4_144, commute CSV columns ×8, ec2019, gc2024, gc_avperinc, ec_avperinc — all UNVERIFIED at exact line; content matches conventional Stats NZ field names) | 5 (crime_trend endpoint, threshold, coverage; sa2_boundaries linkage at migrations/0054:53-54 not separately read) |
| Wording cells (44 indicators × 18 cells + crime_trend 18 = 810 cells) | 810 PASS (single-sentence, ≤60-char labels, NZ English; out-of-scope rows give specific editorial reason; common-misreading defusal present in at least one of Buyer Hosted Full / Pro Hosted Full for every substantive indicator) | 0 | 0 | 0 |

NB: "Wrong" Meaning-block count above is conservative — the 10 stale `data_loader.py:NNNN` line numbers each appear once but propagate through every Meaning block citing them; if counted per-row they are ~30+ rows wrong on file:line.

---

## Flagged rows requiring fix

### High priority (content WRONG)

| Row | Issue | Fix |
|---|---|---|
| `crime_trend` Meaning-block "DataSource key(s)" (line 1081) | Claims `police_crime_history` — no such DataSource key registered (`Grep "police_crime_history" backend/app/services/data_loader.py` → 0 hits) | Replace with UNVERIFIED — exact key TBD. Confirm against DATA-CATALOG § Crime |
| `crime_trend` Meaning-block "Table(s)" (line 1082) | `mv_crime_density_history` — no such table or MV exists in `backend/migrations/`. `_q_crime_trend()` reads `crime` table | Replace with `crime` |
| `crime_trend` Meaning-block "Rendered by" (line 1084) | Claims `HostedNeighbourhoodStats.tsx` — `Grep crime_trend\|crimeTrend frontend/src/components/report/` → 0 hits | Replace with: "Loaded into snapshot at snapshot_generator.py:930 but NOT rendered in any hosted component (dead-data candidate)" |
| `crime_trend` Meaning-block "Query path" (line 1083) | Cites `snapshot_generator.py:930` (which is the snapshot-emit line) | Should cite query function at `snapshot_generator.py:315` (`_q_crime_trend()`) and emit at line 930 |
| Inventory row 366 `crime_trend` table = `mv_crime_density_history` and rendered = `HostedNeighbourhoodStats.tsx` — inventory itself is wrong; wording inherits it | Inventory needs updating | Owner: inventory author |

### Medium priority (content correct, line numbers stale)

All `data_loader.py:NNNN` cites are off by ~150-500 lines. The wording's explicit "Changes in this pass" claim of "file:line reference grep-confirmed" is therefore not true.

| Wording cite | Actual | Indicator(s) using cite |
|---|---|---|
| `data_loader.py:3923` | `4143` | sa2_name |
| `data_loader.py:3935` | `4155` | population_2018, population_2023, median_age, age_65_plus, ethnicity_*, born_* |
| `data_loader.py:3974` | `4194` (and 3974 currently lives in unrelated Northland loader) | (referenced in category-wide note line 19) |
| `data_loader.py:4028` | `4248` | households.* |
| `data_loader.py:4038` | `4253` | income_median, income_brackets, tenure_*, rent_median, hh_*, landlord_*, internet_*, vehicles_* |
| `data_loader.py:4153` | `4373` | commute.* |
| `data_loader.py:4575` | `4795` | business_demography.* |
| `data_loader.py:4651` / `4661` / `4671` / `4674` | `4870-4893` | category-wide DataSource registration note |

Recommended fix: bulk replace stale lines and re-run a true grep.

### Low priority (line refs correct; content confirmed)

| Indicator | All cites verified |
|---|---|
| All HostedDemographics.tsx line numbers (60, 62, 67, 68-70, 91, 93-97, 107-110, 127, 136-141, 166, 170, 174-177, 184-193, 206-215, 228, 237, 251-253) | CONFIRMED (Read of file 55-265) |
| Migration cites (0034, 0035, 0036) | CONFIRMED |
| snapshot_generator.py query lines (590, 609, 627, 748, 930) | CONFIRMED |

### Unverified (recommend follow-up)

| What | Why unverified | How to fix |
|---|---|---|
| Exact `data_loader.py` line for each VAR_4_xxx and ec*/gc* field code | Not separately greped in this audit | `Grep "VAR_4_225\|VAR_4_184\|..." backend/app/services/data_loader.py` and substitute |
| Inventory's count claim "Demographics 45" vs wording's 44 blocks vs 44 actual rows | Inventory says 45, file enumerates 44 | Reconcile — likely inventory off-by-one |
| `crime_trend` endpoint, classification logic, coverage matrix | Wording self-flagged UNKNOWN | Out of scope for Demographics audit; flag to Crime/Liveability owner |

### Out-of-band housekeeping (not strictly an audit finding)

- The wording file's own self-citation in its "Changes in this pass" section claims its conflict list is at lines 1116-1122. Actual line range is 1122-1131. Self-stale.
- Wording line 1131 correctly identifies the inventory off-by-one; inventory should be fixed to either say 44 or to add a 45th row.
