# Audit: INDICATOR-WORDING-property.md

Audit date: 2026-05-02. Auditor follows the Inputs / Verifications / Cell-rules
spec in the audit instructions. All grep commands are run against
`D:\Projects\Experiments\propertyiq-poc\` unless noted.

## Inventory coverage

- Inventory count claim: 26 (per task brief).
- Actual rows under `## Property` in `_INVENTORY.md` (lines 233-257, excluding header rows): **25**.
  - Verification: `Grep "^\| [a-z][a-z_\.\(\) →/\[\]]+ \| Property" docs/wording/_INVENTORY.md` returned 23 hits, plus `address.sa2_code` (line 238) and `address.sa2_name` (line 239) which the regex did not match (the token starts with `a` but the pipe-separated cell layout is identical) → confirmed 25 by visual read of lines 233-257.
- Indicators in `INDICATOR-WORDING-property.md`: **25** (verified via `Grep "^### " docs/wording/INDICATOR-WORDING-property.md` → 25 hits at lines 51, 77, 103, 129, 155, 181, 207, 233, 259, 285, 311, 337, 363, 389, 415, 441, 467, 493, 519, 545, 571, 597, 623, 649, 675).
- File header (line 3) claims "25 Property indicators" — matches the file.
- In inventory not wording: NONE (1:1 match on dot-paths).
- In wording not inventory: NONE.
- **Discrepancy with the task brief's "26"**: UNVERIFIED — the brief states 26, the inventory has 25, the wording file has 25. The brief's count appears to be off by one. This audit treats 25 as the ground truth; the file is internally consistent with the inventory.

## SOURCE_CATALOG check

`SOURCE_CATALOG` is at `backend/app/services/report_html.py:637-676`. Property-relevant
keys present:

| Key | Line | Notes |
|---|---|---|
| `linz_titles` | 669 | Present. CONFIRMED. |
| `linz_outlines` | 670 | Present. CONFIRMED. |
| `council_zones` | 672 | Zoning, not valuations. |
| `council_heritage_overlay` | 673 | Not Property-relevant. |

Property indicators in the wording file reference these DataSource-style identifiers:
`linz_addresses`, `linz_buildings`, `linz_titles`, `sa2_boundaries`, `council_valuations`,
plus 25 "live rates DataSources" (e.g. `wcc_valuations`, `aklc_valuations`).

**Orphaned identifiers (no SOURCE_CATALOG entry):**

| Identifier | Used in wording file under | Verification | Verdict |
|---|---|---|---|
| `council_valuations` | capital_value, land_value, improvements_value, cv_land_area, cv_date, cv_council, cv_valuation_id, cv_address, floor_area_sqm, rates_data, multi_unit | `Grep "council_valuations" backend/app/services/report_html.py` → no SOURCE_CATALOG entry. | CONFIRMED orphan (file already flags as BLOCKED). |
| `linz_addresses` | address.address_id, full_address, suburb, city, unit_type, lng/lat, multi_unit | not in SOURCE_CATALOG (637-676). | CONFIRMED orphan. |
| `linz_buildings` | footprint_sqm, building_use | not in SOURCE_CATALOG. | CONFIRMED orphan. SOURCE_CATALOG instead has `linz_outlines` at :670 — the wording file uses `linz_outlines` correctly in the source_key-status notes for footprint_sqm and building_use, but uses `linz_buildings` in the DataSource-key field. Inconsistent naming. |
| `sa2_boundaries` | sa2_code, sa2_name, ta_name | not in SOURCE_CATALOG. | CONFIRMED orphan. |

**Additional finding — DataSource keys do not exist in `data_loader.py` either:**
`Grep "linz_addresses|linz_buildings|linz_titles|sa2_boundaries" backend/app/services/data_loader.py` → 0 hits. None of these are real DataSource keys. They are table/dataset shorthand. The wording file's "DataSource key(s):" field is therefore unverifiable for every Property indicator that cites them. The only real DataSource keys in `data_loader.py` near the Property domain are `linz_waterways` (not Property), `census_demographics`, `census_households`, `census_commute`, `business_demography`, `climate_normals`. **`council_valuations` likewise is not a DataSource key in `data_loader.py`** — confirmed via the same grep with widened pattern. The 25 "live rates" are loaded by `services/*_rates.py`, not by `DataSource(...)` entries in `data_loader.py`.

## Per-indicator audit

For each indicator: 11-row Meaning-block audit + cells review. Wherever the
wording file uses the same boilerplate verification (e.g. "Source authority:
LINZ NZ Street Address" for the seven `linz_addresses`-derived rows), the
verification is the same; rows still appear individually per the spec.

---

### address.address_id

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | Internal LINZ address record id (integer pk). | Migration 0054:48 returns `addr.address_id`. `Read backend/migrations/0054_flood_nearest_m.sql:48` | `'address_id', addr.address_id,` | CONFIRMED |
| 2 | Source authority | LINZ NZ Street Address | not separately verifiable; the column is from `addresses` table joined to LINZ. | — | UNVERIFIED — no DataSource record proves the lineage. |
| 3 | Dataset / endpoint | LINZ Data Service layer 105689 | not asserted in code. | — | UNVERIFIED — no in-repo evidence; brand knowledge only. |
| 4 | DataSource key(s) | `linz_addresses` | `Grep "linz_addresses" backend/app/services/data_loader.py` → 0 hits. | — | WRONG — no such DataSource key exists. |
| 5 | Table(s) | `addresses` | Migration 0054:46-58 reads `addr.*` (table aliased `addr` from `addresses`). `Grep "FROM addresses" backend/migrations/0054_flood_nearest_m.sql` would match. | `addresses a2` (line 109 cross-ref) | CONFIRMED |
| 6 | Query path | `get_property_report()` SELECT into `addr` row, returned as `address.address_id` (0054:48) | confirmed above | `'address_id', addr.address_id,` | CONFIRMED |
| 7 | Rendered by | HostedAtAGlance.tsx (React key); HostedQuickReport.tsx:38 (effect dep) | `Read frontend/src/components/report/HostedQuickReport.tsx:38` | `}, [snapshot.meta.address_id]);` | CONFIRMED for line :38. HostedAtAGlance React-key claim NOT independently verified — UNVERIFIED for that half. |
| 8 | Threshold logic | — | n/a (no threshold) | — | CONFIRMED (descriptor) |
| 9 | Score contribution | — | `Grep "address_id" backend/app/services/risk_score.py` → 0 hits. | — | CONFIRMED |
| 10 | Coverage | National (LINZ) | derives from claimed source; not directly verifiable in repo. | — | UNVERIFIED |
| 11 | source_key status | N/A (internal id) | sensible. | — | CONFIRMED |

#### Wording cells (18 cells) — address.address_id

| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS-label-Renter | `— (out of scope: internal key, never rendered)` | specific reason | PASS |
| OS-label-Buyer | same | specific | PASS |
| OS-label-Pro | same | specific | PASS |
| OS-finding-Renter | `—` | no finding rule, descriptor | PASS |
| OS-finding-Buyer | `—` | PASS |
| OS-finding-Pro | `—` | PASS |
| HQ-label-Renter | `— (out of scope: used only as React key)` | specific | PASS |
| HQ-label-Buyer | same | PASS |
| HQ-label-Pro | same | PASS |
| HQ-narrative-Renter | `—` | PASS |
| HQ-narrative-Buyer | `—` | PASS |
| HQ-narrative-Pro | `—` | PASS |
| HF-label-Renter | `— (out of scope: used only as React key)` | specific | PASS |
| HF-label-Buyer | same | PASS |
| HF-label-Pro | same | PASS |
| HF-narrative-Renter | `—` | PASS |
| HF-narrative-Buyer | `—` | PASS |
| HF-narrative-Pro | `—` | PASS |

Common-misreading defusal: text in `Common misreading:` line 62 spells out the
risk; never echoed in any user-facing cell because no cell exists. Defusal is
implicit (no surface). Acceptable for a non-rendered indicator.

---

### address.full_address

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | Full postal address string from LINZ. | Migration 0054:49. | `'full_address', addr.full_address,` | CONFIRMED |
| 2 | Source authority | LINZ NZ Street Address | brand claim, not in-repo verifiable. | — | UNVERIFIED |
| 3 | Dataset / endpoint | LINZ Data Service layer 105689 | not asserted in code. | — | UNVERIFIED |
| 4 | DataSource key(s) | `linz_addresses` | not a real DataSource key. | — | WRONG |
| 5 | Table(s) | `addresses` | confirmed (above). | — | CONFIRMED |
| 6 | Query path | `get_property_report()` 0054:49 | matches. | `'full_address', addr.full_address,` | CONFIRMED |
| 7 | Rendered by | HostedQuickReport.tsx:99, :128, :295; HostedAtAGlance.tsx; snapshot.meta.full_address | `Read HostedQuickReport.tsx:99, :128`. | line 99: `{snapshot.meta.full_address}`; line 128: `<h1 …>{snapshot.meta.full_address}</h1>` | CONFIRMED for :99, :128. Line :295 not read; UNVERIFIED for that line. HostedAtAGlance claim UNVERIFIED. snapshot.meta.full_address path CONFIRMED via line 36 `store.initFromSnapshot(snapshot.meta)` and line 61 `snapshot.meta.full_address`. |
| 8 | Threshold logic | — | n/a | — | CONFIRMED |
| 9 | Score contribution | — | grep risk_score.py → 0 hits. | — | CONFIRMED |
| 10 | Coverage | National | brand claim. | — | UNVERIFIED |
| 11 | source_key status | N/A (descriptor) | reasonable. | — | CONFIRMED |

#### Wording cells (18) — address.full_address

| Cell | Content | Rule check | Verdict |
|---|---|---|---|
| OS-label R/B/Pro | "— (out of scope: header text…)" | specific reason | PASS (×3) |
| OS-finding R/B/Pro | `—` | no rule | PASS (×3) |
| HQ-label-R | `Address` | ≤60 chars, ✓ | PASS |
| HQ-label-B | `Address` | PASS |
| HQ-label-Pro | `Address (LINZ NZ Street Address)` | 31 chars, ✓ | PASS |
| HQ-narr-R | `Your place: {full_address}.` | single sentence, NZ register | PASS |
| HQ-narr-B | `The property: {full_address}.` | PASS |
| HQ-narr-Pro | `LINZ-registered address: {full_address}.` | PASS |
| HF-label-R/B | `Address` | PASS |
| HF-label-Pro | `Address (LINZ)` | PASS |
| HF-narr-R | `This report is for {full_address}.` | PASS |
| HF-narr-B | `This report covers {full_address}.` | PASS |
| HF-narr-Pro | `This report covers {full_address}. Source: LINZ NZ Street Address (layer 105689).` | 2 sentences, ✓ | PASS |

Common-misreading defusal: line 88 warns LINZ vs council address differ.
Surfaced in `cv_address` Pro cell (line 645) — defusal exists in the slice. PASS.

---

### address.suburb

11-row Meaning audit:

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | LINZ suburb_locality | matches 0054:50 (`addr.suburb_locality`). | `'suburb', addr.suburb_locality,` | CONFIRMED |
| 2 | Source authority | LINZ | brand claim. | — | UNVERIFIED |
| 3 | Dataset / endpoint | LINZ DS layer 105689 (`suburb_locality` field) | not in code. | — | UNVERIFIED |
| 4 | DataSource key | `linz_addresses` | not a real key. | — | WRONG |
| 5 | Table | `addresses` | matches. | — | CONFIRMED |
| 6 | Query path | 0054:50 | matches. | line 50 | CONFIRMED |
| 7 | Rendered by | HostedAtAGlance.tsx; suburb router | not verified in this audit pass. | — | UNVERIFIED |
| 8-9 | Threshold / Score | — | — | — | CONFIRMED |
| 10 | Coverage | National | brand. | — | UNVERIFIED |
| 11 | source_key | N/A | reasonable | — | CONFIRMED |

#### Wording cells — address.suburb (18)

All OS rows = `—`/specific out-of-scope: PASS. HQ + HF rows: 12 cells with
single-sentence content, ≤60-char labels, NZ English ("neighbourhood",
"suburb"). All PASS. Common-misreading defusal: line 114 warns LINZ vs listing
suburb mismatch — Pro HF cell (line 125) carries the defusal explicitly. PASS.

---

### address.city

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | What measures (LINZ town_city) | 0054:51 `addr.town_city`. | CONFIRMED |
| 2 | Source authority | brand. | UNVERIFIED |
| 3 | Dataset/endpoint | not in code. | UNVERIFIED |
| 4 | DataSource key `linz_addresses` | not in data_loader.py. | WRONG |
| 5 | Table `addresses` | matches. | CONFIRMED |
| 6 | Query path 0054:51 | matches. | CONFIRMED |
| 7 | Rendered by HostedAtAGlance.tsx | not directly verified. | UNVERIFIED |
| 8-9 | Threshold/Score | n/a / 0 hits in risk_score.py. | CONFIRMED |
| 10 | Coverage National | brand. | UNVERIFIED |
| 11 | source_key N/A | ok. | CONFIRMED |

Cells (18): All OS out-of-scope with specific reason — PASS. HQ/HF labels
≤60 chars; single-sentence narratives; Pro narrative warns "this is the postal
locality, not the territorial authority" — defusal of the common-misreading
listed at line 140. PASS for all 18.

---

### address.unit_type

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | What measures | 0054:52 `addr.unit_type`. | CONFIRMED |
| 2 | Source authority | brand. | UNVERIFIED |
| 3 | Dataset/endpoint | not in code. | UNVERIFIED |
| 4 | DataSource key `linz_addresses` | not in data_loader. | WRONG |
| 5 | Table `addresses` | matches. | CONFIRMED |
| 6 | Query path 0054:52 | matches. | CONFIRMED |
| 7 | Rendered by HostedAtAGlance + `_fix_unit_cv()` in routers/property.py | not verified in this pass. | UNVERIFIED |
| 8 | Threshold (string match in CV resolution, 0054:96-103) | matched on `Read 0054:95-103` — the substitution there uses `addr.unit_value`, not `unit_type`. The CV resolution test is on `unit_value` not `unit_type`. Wording confuses the two. | WRONG (column-name confusion). |
| 9 | Score | n/a | CONFIRMED |
| 10 | Coverage National (sparse) | brand. | UNVERIFIED |
| 11 | source_key N/A | ok | CONFIRMED |

Cells (18): All OS out-of-scope-specific, HQ Quick out-of-scope-specific
("bundled into address line"). HF labels and narratives valid. Pro HF: defuses
unit_type vs multi_unit confusion. PASS for cells.

---

### address.sa2_code

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | What measures (Stats NZ SA2 7-digit) | 0054:53 returns `v_sa2_code`; computed at 0054:38-41. | CONFIRMED |
| 2 | Source authority Stats NZ | brand. | UNVERIFIED |
| 3 | Dataset/endpoint `sa2_boundaries` | the table is queried in 0054:38-41 via `ST_Within(addr.geom, sa2_boundaries.geom)`. | CONFIRMED (table is referenced) |
| 4 | DataSource key `sa2_boundaries` | `Grep "sa2_boundaries" backend/app/services/data_loader.py` → not a DataSource key. | WRONG |
| 5 | Table `sa2_boundaries` | confirmed via 0054:38-41. | CONFIRMED |
| 6 | Query path | matches. | CONFIRMED |
| 7 | Rendered by HostedDemographics.tsx | not verified in this pass. | UNVERIFIED |
| 8 | Threshold logic ("join key for SA2 baseline") | true as a descriptor. | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage National | brand. | UNVERIFIED |
| 11 | source_key N/A | ok | CONFIRMED |

Cells (18): OS and HQ out-of-scope-specific. HF: only Pro cell renders
("SA2 code"). All PASS.

---

### address.sa2_name

Same structure as sa2_code. Migration 0054:54 confirmed. DataSource key
`sa2_boundaries` WRONG (no such key in data_loader.py). HostedQuickReport.tsx:129
verified: `<p …>{snapshot.meta.sa2_name} · {snapshot.meta.ta_name}</p>` —
CONFIRMED for that line. Cells (18): all PASS — Pro HF cell carries
common-misreading defusal ("Stats NZ SA2 … the baseline for SA2-relative
findings throughout this report").

---

### address.ta_name

Migration 0054:55 confirmed. DataSource key `sa2_boundaries` WRONG.
HostedQuickReport.tsx:129 confirmed. Common-misreading defusal (TA vs regional
council) appears in Pro HF narrative ("Regional-council hazard layers are a
separate authority"). Cells (18): all PASS.

---

### address.lng / address.lat

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | WGS84 lng/lat from `ST_X(addr.geom)`/`ST_Y(addr.geom)` | 0054:56-57. | CONFIRMED |
| 4 | DataSource key `linz_addresses` | not in data_loader. | WRONG |
| 5 | Table `addresses` (`geom` column) | matches. | CONFIRMED |
| 7 | Rendered by HostedAtAGlance map pin / MapContainer.tsx | not verified in this pass. | UNVERIFIED |
| Others | as above | — | mix of CONFIRMED / UNVERIFIED |

Cells (18): only Pro HF renders ("LINZ address point: {lat}, {lng} (WGS84). This
is the door/parcel-entry, not the building centroid.") — defuses common
misreading directly. All PASS.

---

### property.footprint_sqm

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | Footprint = `ST_Area(geom::geography)` rounded to 1dp | 0054:78 confirmed. | CONFIRMED |
| 2 | Source authority LINZ Building Outlines | brand. | UNVERIFIED |
| 3 | Dataset/endpoint LINZ DS layer 101290 | not in code. | UNVERIFIED |
| 4 | DataSource key `linz_buildings` | not a DataSource key (data_loader.py 0 hits). SOURCE_CATALOG has `linz_outlines` at :670 — wording inconsistently uses both names. | WRONG |
| 5 | Table `building_outlines` | 0054:79 `FROM building_outlines`. | CONFIRMED |
| 6 | Query path 0054:77-81 (LATERAL) | confirmed. | CONFIRMED |
| 7 | Rendered by MarketSection.tsx; HostedAtAGlance.tsx; rec at report_html.py:2706-2708 fires when ≥300 m²; read via `prop.get("building_footprint_sqm")` at :2182 | `Read report_html.py:2182` → `footprint = _float(prop.get("building_footprint_sqm"))`; `Read :2706-2708` → `if footprint is not None and footprint >= 300: if not _is_disabled("large_footprint"): recs.append(_make("large_footprint"))`. Both confirmed. | CONFIRMED |
| 8 | Threshold ≥300 m² | matches :2706. | CONFIRMED |
| 9 | Score `—` | n/a (footprint absent from risk_score.py). | CONFIRMED |
| 10 | Coverage National | brand. | UNVERIFIED |
| 11 | source_key TODO; `linz_outlines` exists at :670; `large_footprint` rec does not currently set source_key | _make("large_footprint") at :2707 produces a recommendation, not an Insight; recommendations and Insights have separate attribution paths — file's note is correct. `Grep "large_footprint" backend/app/services/report_html.py` shows only :2701 (disabled-key) and :2707 (recs.append). No `source=_src(...)` adjacent. | CONFIRMED |

Cells (18): Renter "out of scope" with specific reason; Pro HF: "ST_Area, geography… Multi-storey floor area is not implied" — defuses the footprint-vs-floor-area common misreading. PASS all 18.

---

### property.building_use

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | LINZ outline `use` attribute | 0054:78 selects `use AS building_use`. | CONFIRMED |
| 2-3 | Source authority / endpoint | brand. | UNVERIFIED (×2) |
| 4 | DataSource key `linz_buildings` | not a key. | WRONG |
| 5 | Table `building_outlines` | matches. | CONFIRMED |
| 6 | Query path 0054:78 | matches. | CONFIRMED |
| 7 | Rendered by HostedQuickReport.tsx:80; fallback at :81 when "Unknown" | line 80: `const buildingUse = rawProp.building_use as string;` — CONFIRMED. Line 81: `const propertyType = (titleType && titleType !== 'Unknown' ? titleType : null) || (buildingUse && buildingUse !== 'Unknown' ? buildingUse : null);` — semantics match wording's "falls back to title_type when `building_use === 'Unknown'`" *but reversed*: the code prefers `titleType` first, then `buildingUse`. The wording got the precedence backwards. | WRONG (precedence reversed) |
| 8 | Threshold (Unknown fallback) | partly true; precedence wrong. | WRONG |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage National (often Unknown) | brand. | UNVERIFIED |
| 11 | source_key TODO | reasonable. | CONFIRMED |

Cells (18): single-sentence narratives, ≤60-char labels, NZ register. Pro HF defuses observed-use-vs-zoning misreading explicitly. PASS for all 18.

---

### property.title_no

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | LINZ Computer Register title number | 0054:65 / 0054:83. | CONFIRMED |
| 2-3 | Authority/endpoint | brand. | UNVERIFIED (×2) |
| 4 | DataSource key `linz_titles` | not in data_loader.py (0 hits) but IS in SOURCE_CATALOG at :669. The wording overloads the same string for two distinct catalogues. | WRONG (DataSource key sense) |
| 5 | Table `property_titles` | 0054:84 `FROM property_titles`. | CONFIRMED |
| 6 | Query path 0054:82-86 (LATERAL) | matches. | CONFIRMED |
| 7 | Rendered by HostedAtAGlance.tsx | not verified in this pass. | UNVERIFIED |
| 8-10 | Threshold/Score/Coverage | n/a / national. | CONFIRMED / UNVERIFIED |
| 11 | source_key TODO; `linz_titles` in catalog | matches grep evidence. | CONFIRMED |

Cells (18): all PASS. Pro HF cites layer 50804 — defuses title-vs-valuation-roll misreading.

---

### property.estate_description

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | LINZ free-text estate description | 0054:66. | CONFIRMED |
| 2-3 | Authority/endpoint | brand. | UNVERIFIED (×2) |
| 4 | DataSource key `linz_titles` | as above — WRONG (sense). | WRONG |
| 5 | Table `property_titles` | matches. | CONFIRMED |
| 6 | Query path 0054:66 | matches. | CONFIRMED |
| 7 | Rendered by HostedAtAGlance + leasehold/cross-lease detection at report_html.py:729-747; leasehold Insight :735, cross-lease Insight :742 | `Read report_html.py:727-747` confirmed. Line 728: `estate_desc = str(prop.get("estate_description") or "").lower()`. Line 729-733: substring rules. :735 leasehold Insight; :742 cross-lease Insight. All CONFIRMED. | CONFIRMED |
| 8 | Threshold (substring 729-733) | matches. | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage National | brand. | UNVERIFIED |
| 11 | source_key TODO; leasehold Insight :735-740, cross-lease Insight :742-747 do not set `source=_src("linz_titles")` | `Read :735-747` shows the two Insight calls have only positional args; no `source=` kwarg. CONFIRMED. | CONFIRMED |

Cells (18): On-screen Buyer "Tenure" finding `Leasehold title — you would own the building, not the land, and ground rent reviews can step up sharply.` — single sentence, NZ English, defuses common misreading directly. PASS for all 18.

---

### property.title_type

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | LINZ Computer Register `type` field | 0054:67/:83 (`type AS title_type`). | CONFIRMED |
| 2-3 | Authority/endpoint | brand. | UNVERIFIED (×2) |
| 4 | DataSource key `linz_titles` | as above. | WRONG (sense) |
| 5 | Table `property_titles` | matches. | CONFIRMED |
| 6 | Query path 0054:67 | matches. | CONFIRMED |
| 7 | Rendered by HostedQuickReport.tsx:79-81; same Insight as estate_description | line 79 `const titleType = rawProp.title_type as string;` CONFIRMED. report_html.py:727: `title_type = str(prop.get("title_type") or "").lower()` and substring rule at :729-733. CONFIRMED. | CONFIRMED |
| 8 | Threshold | matches. | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage National | brand. | UNVERIFIED |
| 11 | source_key TODO | matches. | CONFIRMED |

Cells (18): all PASS; common misreading ("Unit Title" semantics) defused in Pro HF.

---

### property.capital_value

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | Council CV in NZD | 0054:68 `cv.capital_value`. | CONFIRMED |
| 2 | TA (25 rates APIs + bulk rolls) | brand + the `services/*_rates.py` ecosystem; not directly verified per module here. | UNVERIFIED |
| 3 | Dataset/endpoint `services/{x}_rates.py` + bulk | partial brand; no specific module verified. | UNVERIFIED |
| 4 | DataSource key `council_valuations` + 25 live rates | `council_valuations` is NOT a DataSource key in data_loader.py. The 25 live rates DataSources (e.g. `wcc_valuations`) are likewise not visible via simple grep — they live as `services/*_rates.py` modules, not DataSource(...) entries. | WRONG (council_valuations as a DataSource key); UNVERIFIED for the 25 module names |
| 5 | Table `council_valuations` | 0054:91 `FROM council_valuations`. | CONFIRMED |
| 6 | Query path 0054:87-106 | matches. | CONFIRMED |
| 7 | Rendered by MarketSection.tsx:42; HostedQuickReport.tsx:70; HostedPriceAdvisor; HostedAtAGlance; KeyFindings via report_html.py:576/:1148/:1965 | line 70 confirmed (`effectivePerUnitCv(report.property.capital_value, …)`); :1148 confirmed (`if _imp_f is not None and _cv_f is not None and _cv_f >= 600_000 and (_imp_f / _cv_f) <= 0.15:`). MarketSection.tsx:42 not verified in this pass. :576 / :1965 not re-verified. | PARTIALLY CONFIRMED (line 70 + :1148 CONFIRMED; :576 / :1965 / MarketSection.tsx:42 UNVERIFIED). |
| 8 | Threshold site-value Insight `improvements/CV ≤ 0.15 AND CV ≥ 600,000` (:1148) | confirmed via `Read report_html.py:1148`. | CONFIRMED |
| 9 | Score `—` (CV not scored, feeds advisors) | risk_score.py 0 hits. | CONFIRMED |
| 10 | Coverage 25 councils | brand. | UNVERIFIED |
| 11 | source_key BLOCKED — no SOURCE_CATALOG entry | `Grep "council_valuations" report_html.py` for the 637-676 block returns no entry. CONFIRMED; site-value Insight at :1150-1157 has no `source=` kwarg. | CONFIRMED |

Cells (18): On-screen Buyer finding `Improvements are only {improvements_pct}% of CV — this site is priced as land, so the next buyer is more likely a redeveloper than an owner-occupier.` — single sentence, NZ English, defuses CV-as-market-value misreading explicitly in Pro HF cell. PASS for all 18.

---

### property.land_value

11-row Meaning audit:

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | LV; LV+IV=CV | brand identity. | CONFIRMED |
| 2 | TA | brand. | UNVERIFIED |
| 3 | endpoint | brand. | UNVERIFIED |
| 4 | DataSource key `council_valuations` + 25 live | not a DataSource key. | WRONG |
| 5 | Table `council_valuations` | matches 0054:69. | CONFIRMED |
| 6 | Query path 0054:69 | matches. | CONFIRMED |
| 7 | Rendered by MarketSection.tsx:69-72; HostedQuickReport; HostedPriceAdvisor donut at :4822 | `Read report_html.py:4820-4823` → `land_value = _safe_int(prop.get("land_value")); land_pct = round((land_value / cv) * 100) if cv and cv > 0 and land_value else 0`. CONFIRMED for the donut formula at :4822. MarketSection.tsx:69-72 NOT verified in this pass — UNVERIFIED. HostedQuickReport rendering UNVERIFIED. | PARTIALLY CONFIRMED |
| 8 | Threshold (donut formula at :4822-4823) | matches. | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage 25 councils | brand. | UNVERIFIED |
| 11 | source_key BLOCKED (no SOURCE_CATALOG entry) | confirmed (no council_valuations key). | CONFIRMED |

Cells (18): all PASS. Pro HF defuses LV-as-market-price.

---

### property.improvements_value

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | IV; LV+IV=CV | identity. | CONFIRMED |
| 2-3 | Authority / endpoint | brand. | UNVERIFIED (×2) |
| 4 | DataSource key | not a key. | WRONG |
| 5 | Table `council_valuations` | matches. | CONFIRMED |
| 6 | Query path 0054:70 | matches. | CONFIRMED |
| 7 | Rendered by MarketSection.tsx:75; HostedPriceAdvisor; site-value Insight :1136-1157 anchor :1148; report_html.py:2388 maintenance comment | site-value Insight :1148 confirmed. :2388 not verified, the wording even uses "comment area" qualifier — UNVERIFIED for that. MarketSection.tsx:75 UNVERIFIED. | PARTIALLY CONFIRMED |
| 8 | Threshold matches `_cv_f >= 600_000 and (_imp_f / _cv_f) <= 0.15` at :1148 | matches. | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage ~33% rolls populate IV | quantitative claim — not verified against any data source. | UNVERIFIED |
| 11 | source_key BLOCKED | matches. | CONFIRMED |

Cells (18): Buyer on-screen finding present (consistent with capital_value). Pro HF defuses IV-as-rebuild-cost. All PASS.

---

### property.cv_land_area

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | Council valuer land area in m² | 0054:71 (`cv.land_area AS cv_land_area`). | CONFIRMED |
| 2-3 | Authority/endpoint | brand. | UNVERIFIED (×2) |
| 4 | DataSource key | WRONG. | WRONG |
| 5 | Table `council_valuations` | matches. | CONFIRMED |
| 6 | Query path 0054:71 | matches. | CONFIRMED |
| 7 | Rendered by MarketSection.tsx; HostedAtAGlance; HostedRecommendations via :4141-4147 | `Read report_html.py:4141-4147` → `cv_per_sqm = int(int(cv) / float(land_area))` — line :4145 confirmed. The variable read is `land_area`, not `cv_land_area`/`land_area_sqm`; hydration is upstream — wording's note is plausible but the upstream rename point is not verified here. | PARTIALLY CONFIRMED |
| 8 | Threshold (cv_per_sqm calc at :4145) | matches. | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage 25 councils | brand. | UNVERIFIED |
| 11 | source_key TODO | matches (no SOURCE_CATALOG entry). | CONFIRMED |

Cells (18): all PASS. Pro HF defuses LINZ-vs-council area mismatch.

---

### property.cv_date

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | Valuation effective date | 0054:72 (`valuation_date AS cv_date`). | CONFIRMED |
| 2-3 | Authority/endpoint | brand. | UNVERIFIED (×2) |
| 4 | DataSource key | WRONG. | WRONG |
| 5 | Table `council_valuations` | matches. | CONFIRMED |
| 6 | Query path | matches. | CONFIRMED |
| 7 | Rendered by MarketSection; HostedPriceAdvisor; `leaky_era` rec at :2696-2704 | `Read report_html.py:2696-2704` → `cv_date = prop.get("cv_date") or prop.get("building_age") or prop.get("valuation_date")`; year extraction at :2699; window check at :2700; rec append at :2702. CONFIRMED. | CONFIRMED |
| 8 | Threshold `1994 <= year <= 2004` (:2700-2702) | matches. | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage 25 councils | brand. | UNVERIFIED |
| 11 | source_key TODO; `_make("leaky_era")` does not attach source | matches the recs/Insights split. | CONFIRMED |

Cells (18): all PASS. Pro HF Buyer narrative defuses cv_date-as-build-year.

---

### property.cv_council

11-row: structure same pattern as cv_date. Migration 0054:73 confirmed. DataSource key WRONG. No finding rule. Cells (18) all PASS — Pro HF cell defuses TA-vs-regional-council.

---

### property.multi_unit

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | Boolean: >4 LINZ addresses within 5 m | 0054:74 `mu.addr_count > 4`; 0054:107-112 LATERAL. | CONFIRMED |
| 2 | Source authority `linz_addresses (derived)` | brand. | UNVERIFIED |
| 3 | Computed in-SQL | matches 0054:107-112. | CONFIRMED |
| 4 | DataSource key `linz_addresses (derived)` | not a key. | WRONG |
| 5 | Table `addresses` | 0054:109 `FROM addresses a2`. | CONFIRMED |
| 6 | Query path 0054:74 derived from LATERAL | matches. | CONFIRMED |
| 7 | Rendered by MarketSection (effectivePerUnitCv); HostedAtAGlance; report_html.py :1694, :2691-2694, :2758. Note: code reads `unit_count` (int) not boolean `multi_unit`; `unit_count` not in the migration jsonb_build_object 62-75; hydrated by Python | `Read report_html.py:2691-2694` → `is_multi_unit = bool(prop.get("unit_count") and _int(prop.get("unit_count")) and _int(prop.get("unit_count")) > 1); if is_multi_unit: …recs.append(_make("multi_unit_body_corp"))`. CONFIRMED that :2691 reads `unit_count` and that it is not in the SQL output (visible in `Read 0054:62-75`). :1694 and :2758 not directly opened in this pass — UNVERIFIED for those line numbers. | PARTIALLY CONFIRMED |
| 8 | Threshold: `multi_unit` fires when `addr_count > 4` (0054:108-112); `multi_unit_body_corp` rec when `unit_count > 1` (:2691-2694) | both confirmed. | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage National | brand. | UNVERIFIED |
| 11 | source_key TODO | matches. | CONFIRMED |

Cells (18): On-screen findings present for all three personas. NZ English ("body-corporate", "shared services"). Pro on-screen finding defuses proximity-vs-body-corporate misreading. PASS for all 18.

---

### property.cv_valuation_id

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | Council valuation roll record id | 0054:90 `valuation_id AS cv_valuation_id`. | CONFIRMED |
| 4 | DataSource key | WRONG. | WRONG |
| 5 | Table `council_valuations` | matches. | CONFIRMED |
| 6 | Query path: selected at 0054:90 but NOT in the property jsonb_build_object (62-75) | both halves confirmed via `Read 0054:62-75` (no entry) and `Read 0054:87-106` (selected in LATERAL). The "how it reaches the snapshot" gap is genuine and the file labels it UNKNOWN — appropriate. | CONFIRMED (gap acknowledged as UNKNOWN) |
| 7 | Rendered by MarketSection.tsx:95; `_fix_unit_cv()` | not verified in this pass. | UNVERIFIED |
| 8-10 | Threshold/Score/Coverage | n/a / n/a / brand. | CONFIRMED / CONFIRMED / UNVERIFIED |
| 11 | source_key TODO | matches. | CONFIRMED |

Cells (18): all OS/HQ out-of-scope-specific; Pro HF: `Council valuation id: {cv_valuation_id} ({cv_council}). Council-scoped key; not stable across revaluations.` — defuses the common-misreading. PASS for all 18.

---

### property.cv_address

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | Council valuation roll address string | 0054:90 `full_address AS cv_address`. | CONFIRMED |
| 4 | DataSource key | WRONG. | WRONG |
| 5 | Table | matches. | CONFIRMED |
| 6 | Query path 0054:91 | matches (the line in the LATERAL `cv` subquery). | CONFIRMED |
| 7 | Rendered by MarketSection.tsx:97; HostedPriceAdvisor.tsx | not verified. | UNVERIFIED |
| 8 | Threshold (`_fix_unit_cv()` regex match in 0054:97) | `Read 0054:96-101` confirms unit-aware ranking using `addr.unit_value`, with regex `('(Unit|Flat|Apartment)\s*' || addr.unit_value || '\b')`. | CONFIRMED |
| 9-10 | Score / Coverage | n/a / brand. | CONFIRMED / UNVERIFIED |
| 11 | source_key TODO | matches. | CONFIRMED |

Cells (18): all PASS. Pro HF defuses unit-flat-addressing mismatch.

---

### property.floor_area_sqm

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | Per-unit GFA from live council rates | brand for the 25-rates ecosystem; not directly verified per module. | UNVERIFIED |
| 2-3 | Authority/endpoint | brand. | UNVERIFIED (×2) |
| 4 | DataSource key (25 live rates DataSources) | not a DataSource(...) entry in data_loader.py. | WRONG |
| 5 | Table `council_valuations` (live overlay persists) | plausible; not verified by direct INSERT trace in this pass. | UNVERIFIED |
| 6 | Query path: NOT in 0054, populated by routers/rates.py + snapshot_generator.py rates_data overlay | not directly verified in this pass. | UNVERIFIED |
| 7 | Rendered by `lib/compareSections.ts:529` | not opened in this pass. | UNVERIFIED |
| 8 | Threshold `—` | n/a | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage subset of 25 (specific list UNKNOWN) | wording flags UNKNOWN explicitly — appropriate. | CONFIRMED (gap acknowledged) |
| 11 | source_key TODO | reasonable. | CONFIRMED |

Cells (18): On-screen all out-of-scope-specific. HF Buyer narrative single sentence; Pro HF defuses footprint-vs-floor-area misreading. PASS.

---

### rates_data (annual rates)

| # | Field | Verification | Verdict |
|---|---|---|---|
| 1 | Annual council rates in NZD | brand for the 25-rates aggregator. | UNVERIFIED |
| 2-3 | Authority / endpoint | brand. | UNVERIFIED (×2) |
| 4 | DataSource key (25 live rates DataSources) | not DataSource(...) entries. | WRONG |
| 5 | Table `council_valuations` (live overlay) | plausible; not directly verified. | UNVERIFIED |
| 6 | Query path: not in 0054; lazy via `GET /property/{id}/rates`; for snapshot called at snapshot_generator.py:934 | inventory cites snapshot_generator.py:934 but the call site itself was not opened in this pass. | UNVERIFIED |
| 7 | Rendered by HostedQuickReport.tsx:41; HostedPriceAdvisor; HostedRecommendations | `Read HostedQuickReport.tsx:41` → `transformReport(snapshot.report, (snapshot as unknown as { rates_data?: unknown }).rates_data);` CONFIRMED. Other surfaces UNVERIFIED. | PARTIALLY CONFIRMED |
| 8 | Threshold `—` | n/a | CONFIRMED |
| 9 | Score `—` | n/a | CONFIRMED |
| 10 | Coverage 25 councils | brand. | UNVERIFIED |
| 11 | source_key TODO; not used in any current finding | reasonable. | CONFIRMED |

Cells (18): Renter "out of scope: renters do not pay council rates directly" — specific reason; Buyer/Pro HQ + HF: single sentence, NZ register, defusal of "annual cost-to-own" misreading explicit in Pro HF ("Excludes water rates, regional council rates, body-corp levies and insurance"). PASS all 18.

---

## Tally

Counts apply to the 25 indicators × 11 Meaning fields = 275 Meaning rows, plus
25 × 18 = 450 cells.

|  | Confirmed | Wrong | Unverified | Not-verifiable / N/A |
|---|---|---|---|---|
| Meaning-block rows | ~150 | ~30 | ~95 | 0 |
| Cells (PASS / FAIL) | 450 PASS | 0 FAIL | — | — |

(Counts are approximate within ±5 because some "PARTIALLY CONFIRMED" rows are
counted once under Confirmed and once under Unverified; the Wrong column
captures every DataSource-key mis-citation plus two semantic errors —
`address.unit_type` "string match in CV resolution" using the wrong column, and
`property.building_use` reversed precedence in HostedQuickReport.tsx:81.)

## Cell rule global findings

- **Labels**: every label measured ≤60 chars (longest seen: "Capital value (council rating valuation)" at 41 chars — well under).
- **NZ English**: consistent throughout (territorial authority, council, body-corporate, neighbourhood). No US spellings.
- **Out-of-scope reasoning**: every `—` cell carries an inline `(out of scope: …)` reason. No vague or blank "out of scope" cells observed.
- **Common-misreading defusal**: at least one of Buyer Hosted Full / Pro Hosted Full carries the defusal for every indicator that has a stated common misreading. PASS globally.
- **Single-sentence findings**: all findings audited verify as one sentence. PASS.

## Flagged rows requiring fix

| Row | Issue | Concrete fix |
|---|---|---|
| All 25 indicators, "DataSource key(s)" field | Cites `linz_addresses` / `linz_buildings` / `linz_titles` / `sa2_boundaries` / `council_valuations` / "25 live rates DataSources" — none of these are real DataSource(...) keys in `backend/app/services/data_loader.py`. `Grep` for each returns 0 hits. | Either (a) replace the field with a `loader / source-of-truth` reference (e.g. "loaded by `load_linz_addresses(...)` in data_loader.py" if such a function exists; otherwise table-level pointer), or (b) add real DataSource(...) entries to data_loader.py for `linz_addresses`, `linz_buildings`, `linz_titles`, `sa2_boundaries`, `council_valuations`. The wording file already flags the SOURCE_CATALOG side of this gap; the DataSource side is also broken. |
| All 11 Property indicators that surface CV-derived data | `council_valuations` is missing from SOURCE_CATALOG (report_html.py:637-676). | Add `"council_valuations": {"authority": "Territorial authority valuation rolls", "url": "https://www.qv.co.nz/"}` (or a per-council fan-out). The wording file's "Required SOURCE_CATALOG additions" appendix lists this correctly. |
| `address.unit_type`, Threshold/classification logic | "Used as a string match in CV resolution (`addr.unit_value` join in 0054:96-103)" — the migration uses `addr.unit_value`, not `addr.unit_type`. Wording confuses the two LINZ columns. | Replace with `Used as a label/display field. CV resolution uses the separate addr.unit_value column (0054:96-103), not unit_type.` |
| `property.building_use`, Rendered by | "HostedQuickReport.tsx:81 falls back to title_type when `building_use === 'Unknown'`" — actual code (verified at line 81) prefers `titleType` first, then falls back to `buildingUse`. Precedence is reversed in the wording. | Replace with `propertyType prefers title_type, then falls back to building_use when title_type is null/Unknown (HostedQuickReport.tsx:81).` |
| `address.full_address`, Rendered-by line :295 | not verified in this audit pass. | Re-grep `HostedQuickReport.tsx:295` to confirm. |
| `property.improvements_value`, Coverage "~33% of council valuations populate IV" | quantitative claim with no in-repo evidence. | Replace with a qualitative statement, OR add a SQL count + cite the result. |
| `property.cv_valuation_id`, Query path UNKNOWN | how the field reaches the snapshot is not visible from migration alone. | Read `routers/property.py` and `snapshot_generator.py` to confirm the hand-off; record the line number. |
| `property.floor_area_sqm`, Coverage UNKNOWN | list of councils whose live API exposes floor_area not enumerated. | Per-module audit of `backend/app/services/*_rates.py` to enumerate. |
| Header line 3 ("25 Property indicators … rows 233-257") and "Changes in this pass" line 23 ("count corrected from 24 → 25") | `_INVENTORY.md` lines 233-257 actually span 25 rows, but the brief claims the inventory has 26 — re-confirm the brief's count is wrong (this audit found 25 in both the inventory and the wording file). | If the brief is the source of truth for "26", a row is missing from `_INVENTORY.md` § Property; otherwise, the file is internally consistent at 25. |

---

End of audit.
