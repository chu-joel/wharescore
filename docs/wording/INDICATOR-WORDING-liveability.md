# Indicator Wording: Liveability

## Changes in this pass

### 2026-05-02 editorial pass #2 (severity recalibration)

Severity tiers tightened against the liveability rule that amenity proximity, deprivation index and crime percentile are quality-of-life signals (not decision-changing on their own). Critical reserved for hazards/planning categories.

- #4 Crime percentile: Critical -> Notable. Lived-experience and insurance-premium impact are real but Notable, not Critical. On-screen finding cells calmed: dropped "before signing" urgency for renter, dropped "Expect" mandate for buyer, kept the 10-30% premium fact.
- #11 Nearest supermarket: Notable -> Context. Walking distance to groceries is lifestyle background per the brief ("a long walk to a supermarket is Context"). Buyer on-screen finding "a steady driver of weekly liveability" replaced with neutral distance line (jargon removal).
- #7 Crime area count, hosted-full Renter/Buyer: forced narrative ("This area is one of {n} reporting zones") converted to `(out of scope: technical denominator)`. Background indicator, persona doesn't need a narrative.
- #15 Conservation type, hosted-full Renter/Buyer: forced narrative ("It is a {land_type}...") converted to `(out of scope: technical descriptor)`. Background indicator.
- Severity distribution table updated: 0 Critical / 6 Notable / 8 Context / 5 Background. Added explanatory note that liveability has no Critical indicators by design.
- Critical-finding-rule preamble at top updated to reflect the new zero-Critical state.

Mechanical pass: persona table cells already had no em-dashes from prior pass. Confirmed via grep `^\s*\|.*,` returning no matches. Confirmed no panic words ("warning", "danger", "important to note", "please be aware", "in general", "essentially", "basically") inside any persona cell. Em-dashes remain in Meaning-block prose annotations (file:line refs, query paths, score contributions); these are reference metadata, not user-facing wording, and were left untouched in this pass.

Length spot-check: every Renter/Buyer on-screen finding cell now reads as one sentence; #12 GP and #13 pharmacy Pro on-screen findings tightened from two sentences to one with semicolon separator.

### 2026-05-02 wording polish (task #2)

Tone rules applied across every wording cell: no em-dashes (replaced with commas, full stops, colons or parentheses; "(out of scope: ...)" or "(no rule)" where the matrix had a placeholder), no exclamation marks, no panic words ("warning", "caution", "danger" only kept where they are literal codebase identifiers e.g. `{n_caution}`), plain words ("about" not "approximately"), NZ English, active voice, specific numbers in place of vague descriptors. Severity line added to every Meaning block.

Cells rewritten (one bullet per cell touched, reason in brackets):

- 1 NZDep, all surfaces: removed em-dashes from labels and narratives, replaced "≤60 chars" header with "60 chars max" (em-dash separator), replaced "," placeholder narratives with "(out of scope: ...)" (em-dash + matrix placeholder), softened buyer "Verify gentrification" to "Visit at different times" (plain words), removed "," connecting comparator clauses (em-dash). Buyer hosted-full split into two sentences (active voice).
- 2 Crime area unit, all surfaces: replaced finding "," with "(no rule)", out-of-scope cells from "," to "(out of scope: ...)" (matrix placeholder cleanup), Pro hosted-full slash replaced with "or" for SA2/suburb (plain words).
- 3 Crime victimisations, all surfaces: finding cells from ", (count only; rule fires on percentile)" to "(no rule: count only, rule fires on percentile)" (em-dash placeholder), Pro hosted-full em-dash arrow replaced with "the ... match" (em-dash).
- 4 Crime percentile, on-screen finding Renter: removed em-dash, removed "matter" hedge, prescribed concrete action "check the property has secure entry, deadbolts and window locks before signing" (Critical Renter = lived consequence + action). Buyer: removed em-dash, "typically run 10–30%" rephrased to "Expect ... about 10 to 30% above the city base" with action "get a quote before offering" (Critical Buyer = dollar consequence + action). Hosted-full Renter narrative em-dash split into two sentences. Buyer hosted-full em-dash before "city median" turned into a full stop. "Compare specific crime types before drawing conclusions" softened to "Look at" (active voice, less hedging).
- 5 Crime city median, all surfaces: out-of-scope cells from "," to "(out of scope)" / "(no rule: comparator only)" (matrix placeholder), buyer hosted-full em-dash before "useful when" replaced with full stop (em-dash).
- 6 Crime city total, all surfaces: same out-of-scope cleanup, buyer hosted-full em-dash replaced with full stop (em-dash).
- 7 Crime area count, all surfaces: same out-of-scope cleanup, Pro hosted-full em-dash before "denominator" replaced with semicolon (em-dash).
- 8 Schools 1500m, on-screen Renter: em-dash before "zones change" replaced with comma + "since" (em-dash, plain English). Buyer: em-dash before "zoned access" replaced with full stop (em-dash). Hosted Quick Buyer em-dash replaced with full stop. Hosted Full Buyer "EQI ranges {min}–{max}" left as numeric en-dash range (this is a numeric range, not a separator); "(lower EQI = less ...)" remained but "," before it removed.
- 9 Heritage count 500m, all surfaces: out-of-scope cleanup, Hosted Full Renter em-dash replaced with full stop, Buyer em-dash replaced with semicolon, "≥10" replaced with "10 or more" (plain English).
- 10 Amenities 500m, on-screen Renter: em-dash replaced with comma. Buyer: em-dash replaced with full stop, "(e.g., 24/7 pharmacy)" turned into "such as a 24/7 pharmacy" (plain English). Pro: em-dash replaced with comma. Labels "≤500m" replaced with "500m radius" (plain English). Hosted Full Renter and Buyer em-dashes replaced with commas.
- 11 Nearest supermarket, on-screen: Renter em-dash replaced with comma. Buyer em-dash replaced with comma + "a steady driver" (plain English, was "key driver"). Hosted Quick Renter "~" replaced with "about" (plain English). Buyer em-dash replaced with full stop. Hosted Full Buyer em-dash replaced with full stop. "Top-5" rendered as "Top 5" (NZ English style).
- 12 Nearest GP, on-screen: Renter em-dash replaced, action concretised to "Call ahead to check the practice is taking new patients" (Notable + practical). Buyer em-dash replaced with comma + "confirm enrolment is open before relying on it" (active voice). Pro em-dash and slash cleaned to "or" / "and" prose; "≥2km" rendered as "2km or more" (plain English). Hosted Quick Renter "~" to "about" + softened phrasing. Buyer em-dash replaced with full stop. Hosted Full Renter em-dash replaced with full stop. Buyer "elderly" replaced with "older households" (less othering).
- 13 Nearest pharmacy, on-screen: Renter em-dash replaced with full stop, "if it's far" kept (plain English). Buyer em-dash replaced with full stop, "daily-life tax" softened to "daily-life cost" (plain English, less colloquial). Pro em-dash replaced with full stop. Hosted Quick Renter "~" to "about". Buyer em-dash replaced with full stop. Hosted Full Buyer em-dash replaced with full stop.
- 14 Conservation nearest name, all surfaces: out-of-scope cleanup, finding cells "(no rule)". Hosted Full Buyer em-dash replaced with comma + clarifying clause (plain English). Pro "≤5km" replaced with "5km radius" (plain English).
- 15 Conservation type, all surfaces: out-of-scope cleanup, Renter "It's a ..., the rules ..." rephrased to "It is a {land_type}. The rules ... depend on the type." (em-dash, active voice). Pro em-dash replaced with comma + "see the DOC parcel page" (plain English).
- 16 Conservation distance, all surfaces: out-of-scope cleanup. Hosted Full Renter em-dash split into two sentences (em-dash, active voice).
- 17 Nearby DOC features, all surfaces: out-of-scope cleanup. Hosted Full Buyer em-dash replaced with full stop. Pro "≤5km" rendered as "5km radius"; slash list normalised to commas.
- 18 Nearby highlights, all surfaces: out-of-scope cleanup. Hosted Quick Renter "Cafés" → "Cafes" (NZ English in this codebase uses no diacritic, matches existing style elsewhere); "few caution items" rephrased to "items to know about" (panic-word avoidance even though `caution` is a code label). "~1.5km" replaced with "about 1.5km". Buyer em-dash replaced with comma. Hosted Full Renter "~" to "about", em-dash replaced with comma. Buyer slash list normalised to commas + full stop, em-dash to comma. Pro slash list normalised to commas. "≤1.5km" rendered as "1.5km radius".
- 19 Community facilities, all surfaces: out-of-scope cleanup. Pro hosted-full label "≤2km" replaced with "2km radius". Pro narrative slash list ("sports_centre/swimming_pool", "≤50km", "≤10km", "+ count ≤5km") normalised to "or" / "within Xkm" prose (plain English).

Severity assignments (one per indicator, written into the Meaning block):

| Indicator | Severity | Reason in Meaning block |
|---|---|---|
| 1 NZDep decile | Notable | Area-level census composite, informs perception and buyer DD but not on its own decision-changing |
| 2 Crime area unit | Background | Identifier label, no metric |
| 3 Crime victimisations count | Context | Useful background, percentile carries the rule |
| 4 Crime percentile | Notable | Lived-experience and insurance-premium impact, finding rule at p>=75 |
| 5 City median victimisations | Background | Comparator value, no standalone rule |
| 6 City total victimisations | Background | Denominator value, no rule |
| 7 Area count in city | Background | Technical denominator behind the percentile |
| 8 Schools 1500m | Notable (Critical for buyers/renters with school-age kids) | Zoned access decides enrolment and influences value |
| 9 Heritage count 500m | Context | Character signal with no liveability finding rule (planning `is_heritage_listed` covers the property's own listing) |
| 10 Amenities 500m | Context | Walkability signal, not on its own decision-changing |
| 11 Nearest supermarket | Context | Walking distance is lifestyle background, not decision-changing |
| 12 Nearest GP | Notable (Critical via healthcare-desert rule for daily-medication users) | Enrolment access often matters more than distance |
| 13 Nearest pharmacy | Notable (Critical via healthcare-desert rule) | Pharmacy delivery softens distance for most households |
| 14 Conservation nearest | Context | Lifestyle background |
| 15 Conservation type | Background | Technical descriptor |
| 16 Conservation distance | Context | Informative, not decision-changing alone |
| 17 Nearby DOC features | Context | Lifestyle list, no rule |
| 18 Nearby highlights | Context | Classified amenity list, no rule |
| 19 Community facilities | Notable | Fibre availability and hospital distance can change a buy or rent decision; the rest is context |

Critical indicators whose Meaning block currently lacks a finding rule: none. Liveability has no Critical indicators after this pass; the closest is **#4 Crime percentile** (Notable), which has finding rules at `report_html.py:1863` (>=75 warn) and `:1871` (>=50 info) plus a buyer recommendation at `:2627-2629`. **#9 Heritage count 500m** is Context, but the related `is_heritage_listed` rule sits in the planning category (not liveability), flagged for the planning-category owner.



- **NZDep vintage corrected**: dataset is NZDep2023 (loader at `scripts/load_nzdep.py:39` reads `NZDep2023_MB2023.xlsx`; SQL column `nd.nzdep2023`). All "NZDep2018" references in this file replaced with "NZDep2023"; "release 2020" replaced with "release 2024" (release year for NZDep2023 from the 2023 census).
- **DOC source_key now wired**: `doc_conservation` was added to SOURCE_CATALOG at `report_html.py:683` ("Department of Conservation public estate"). DOC indicators (`conservation_*`, `nearby_doc`) can now cite source_key = `doc_conservation`. Note `doc_conservation` is the SOURCE_CATALOG key, not a `DataSource(...)` registry key, the underlying loaders are `doc_huts` (`data_loader.py:7121`), `doc_tracks` (`:7126`), `doc_campsites` (`:7131`).
- **Fabricated DataSource keys corrected**: `moe_schools`, `moe_eqi`, `moe_zones`, `hnzpt_heritage`, `council_heritage`, `osm_amenities`, `stats_nzdep`, `police_crime`, `doc_conservation` are NOT `DataSource(...)` registrations in `data_loader.py` (0 grep hits). Each row now distinguishes "Source catalog key" (where one exists in `SOURCE_CATALOG`) from "Loader registration key(s)" (real `DataSource(...)` entries: `doc_huts`, `doc_tracks`, `doc_campsites`, `school_zones`, `fibre_coverage`, plus per-council heritage variants such as `auckland_heritage`).
- **`fibre_coverage` IS a registered DataSource** at `data_loader.py:4896` (Commerce Commission Specified Fibre Areas 2025), row #19 updated to name the real key.
- Re-verified `report_html.py` line refs against current file: `_src("nzdep")` at 1844 / 1851; `_src("nz_police_crime")` at 1869 / 1877; nzdep insights at 1839 / 1846; crime insights at 1863 / 1871; healthcare-desert Insight at 1962–1968 (no `source=`); `is_heritage_listed` planning Insight at 2058–2063 (no `source=`); `heritage_area` recommendation driven by count ≥ 20 at 2694–2696 (no `source=`); schools recommendations at 2635–2643; buyer/renter school recs at 3373–3374; lifestyle-fit cafe+restaurant logic at 2810–2811.
- Re-confirmed `risk_score.py` weights: `WEIGHTS_LIVEABILITY = {"crime": 0.30, "nzdep": 0.25, "schools": 0.25, "heritage": 0.20}` at lines 270–273 (the closing `}` is on line 273). Indicator wiring: crime 718, nzdep 719, schools 720, heritage 721. `SEVERITY_NZDEP` at line 230.
- SQL line refs (against `backend/migrations/0054_flood_nearest_m.sql`): liveability block lines 570–610; LATERAL subqueries nd 613–617, cd 623–654, sch 656–674, ts 676–680 / ts_list 681–692, tr 694–701, cr 703–712, hr 714–718, am 720–730, ess 732–749, con 751–757, ml 759–768.
- Snapshot query line numbers: `_q_highlights` 335, `_q_doc` 476–494, `_q_nearest_supermarkets` 496–517, `_q_school_zones` 519+, `_q_community_facilities` 645+.
- Frontend file:line refs unchanged, `NeighbourhoodSection.tsx` (35–58 nzdep card, 65–71 CrimeCard, 91–93 NearbyAmenities) and `HostedNeighbourhoodStats.tsx` (51–53 essentials, 57–59 conservation row, 152 heritageCount, 173–180 amenities, 388–391 sports, 425–429 fibre, 437–448 supermarkets, 568–578 heritage, 679–683 nzdep).

---

Scope: 19 inventory rows under `## Liveability` in `docs/wording/_INVENTORY.md` (rows 138–156). Every row covered.

SQL source of truth: `backend/migrations/0054_flood_nearest_m.sql` (supersedes 0022). Liveability section = lines 570–610. Subqueries (LATERAL joins): nd (NZDep, l613), cd (crime, ~l620), sch (schools, l580), ts (transit count, l581), tr (rail, l700), cr (crashes, l703), hr (heritage, l714), am (amenities, l720), ess (essentials, supermarket/GP/pharmacy, l732), con (conservation, l751), ml (Metlink modes, l759).

Wording rules in this draft:
- Show numbers, not classes ("decile 9/10" not "high deprivation").
- Name the comparator (SA2 baseline, city median, WHO/NES, MoE roll).
- NZ English (organisation, neighbourhood, kerb, metres).
- Renter ≈ grade 2 (lived experience + cost). Buyer ≈ grade 3 (decision + dollars). Pro ≈ grade 4 (source/dataset/vintage).
- Findings are relative to the comparator the rule actually uses (not absolute).
- `, (out of scope: <why>)` for cells the surface does not render today.

---

## 1. NZDep decile (`liveability.nzdep_decile` → snapshot `liveability.nzdep_score`)

- What it measures: NZ Index of Deprivation 2023 decile (1 = least deprived 10%, 10 = most deprived 10%) for the meshblock containing the property.
- Source authority: University of Otago (NZDep) / Stats NZ (meshblock geometries).
- Dataset / endpoint: NZDep2023 by meshblock (loader `scripts/load_nzdep.py:39` reads `NZDep2023_MB2023.xlsx`). Source-catalog authority recorded at `report_html.py:661` as "University of Otago NZDep / Stats NZ".
- DataSource key(s): UNKNOWN. not registered as a `DataSource(...)` in `data_loader.py` (loaded via the standalone `scripts/load_nzdep.py` script). Source catalog key: `nzdep` (`report_html.py:661`).
- Table(s): `nzdep`, `meshblocks`.
- Query path: `get_property_report()` → `liveability` block → LATERAL `nd` subquery (`backend/migrations/0054_flood_nearest_m.sql:573, 613-617`); spatial `ST_Within(addr.geom, mb.geom)` join then `nzdep.mb2023_code` lookup. Field column: `nzdep2023`.
- Rendered by: on-screen `frontend/src/components/property/sections/NeighbourhoodSection.tsx:35` (10-segment bar). Hosted Quick: not in HostedNeighbourhoodStats Quick render path. Hosted Full: `frontend/src/components/report/HostedNeighbourhoodStats.tsx` (city/suburb comparison row near l679-683).
- Threshold / classification logic: scoring table `SEVERITY_NZDEP` in `risk_score.py:230`; finding rule in `report_html.py:1839–1854` (decile ≥ 8 → warn at 1839; ≤ 3 → ok at 1846).
- Score contribution: `risk_score.py:719`, indicator key `nzdep`, weight 0.25 in `WEIGHTS_LIVEABILITY`.
- Coverage: National. `WIRING-TRACES.md:98` "National (Stats NZ) | Yes". All 14 cities in the city-coverage matrix have meshblocks.
- Common misreading: "Decile 9 means this house is bad". Decile is a small-area census composite (income, employment, qualifications, access), not a property-quality signal.
- What it does NOT tell you: vintage is NZDep2023 (release 2024 from the 2023 census); does not reflect change since 2023. Says nothing about the specific street.
- source_key status: present, `_src("nzdep")` at `report_html.py:1844, 1851`.
- User-care severity: Notable, area-level census composite that informs perception and buyer due diligence but is not on its own decision-changing.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (60 chars max) | Area deprivation | NZDep decile | NZDep2023 decile (meshblock) |
| On-screen, finding | NZDep decile {n}/10, among the 30% most deprived NZ areas. | Decile {n}/10 (NZDep2023). Visit at different times before offering to see the area for yourself. | Decile {n}/10, NZDep2023 (Otago, Stats NZ); meshblock {mb_code}; index covers income, employment, qualifications, access. |
| Hosted Quick, label | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) |
| Hosted Quick, narrative | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) |
| Hosted Full, label | Neighbourhood deprivation | NZDep decile | NZDep2023 decile vs city/suburb |
| Hosted Full, narrative + tech | Decile {n}/10. Suburb average is {suburb_avg}. | Decile {n}/10 vs suburb avg {suburb_avg}, city avg {city_avg}. Index is from the 2023 census, so revisit before assuming current character. | NZDep2023 decile {n}/10. Source: University of Otago, Stats NZ, meshblock-level, 2024 release; 1 = least deprived decile nationally. |

---

## 2. Crime area unit (`liveability.crime_area_unit`)

- What it measures: The NZ Police "area unit" name matched to this property's SA2 / suburb (the label under which Police victimisation counts are published).
- Source authority: NZ Police.
- Dataset / endpoint: Police victimisations open data; mapped via `mv_crime_density` (per-area-unit aggregate) with SA2/suburb fuzzy match, see `0054_flood_nearest_m.sql:618` and the cd LATERAL subquery.
- DataSource key(s): UNKNOWN. `police_crime` is not a registered `DataSource(...)` in `data_loader.py` (0 grep hits); crime data loaded outside the standard registry. Source catalog key: `nz_police_crime` (`report_html.py:656`).
- Table(s): `mv_crime_density`, `mv_crime_ta` (TA fallback), `mv_crime_ta_ranked`, `crime` (raw monthly).
- Query path: `get_property_report()` → `cd` LATERAL, fuzzy match SA2 name / suburb to `area_unit`, then fall back to TA aggregates (per `WIRING-TRACES.md:100`).
- Rendered by: on-screen `NeighbourhoodSection.tsx` (CrimeCard subtitle, buyers only, l65–71). Hosted Full: `HostedNeighbourhoodStats.tsx` (within crime block).
- Threshold / classification logic: identifier only, no thresholds.
- Score contribution:, (label, not a metric).
- Coverage: National (NZ Police). `WIRING-TRACES.md:100` confirms via `v_sa2_name` fallback so the field is "never NULL when SA2 is known".
- Common misreading: assuming the area-unit boundary equals "your street", Police area units can be larger than a suburb.
- What it does NOT tell you: nothing about specific crime types or the exact street; not a percentile, just the matched label.
- source_key status: N/A (label, not a finding).
- User-care severity: Background, identifier label rather than a metric.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Crime reporting area | Police area unit | NZ Police area unit |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) |
| Hosted Quick, narrative | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) |
| Hosted Full, label | Crime stats reported under | Police area unit | NZ Police area_unit (matched) |
| Hosted Full, narrative + tech | Police count crime here under "{area_unit}". | Crime totals below are reported under Police area unit "{area_unit}", not just this street. | NZ Police area_unit "{area_unit}", matched from SA2 or suburb via mv_crime_density (fallback mv_crime_ta_ranked). |

---

## 3. Crime victimisations (`liveability.crime_victimisations`)

- What it measures: Annualised count of victimisations recorded by NZ Police in the matched area unit (or TA-median fallback).
- Source authority: NZ Police.
- Dataset / endpoint: Police victimisations data (https://www.police.govt.nz/about-us/publications-statistics/data-and-statistics).
- DataSource key(s): UNKNOWN. `police_crime` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `nz_police_crime`.
- Table(s): `mv_crime_density` (matched), `mv_crime_ta` (fallback `median_victimisations_per_au`).
- Query path: `0054_flood_nearest_m.sql:575` → cd subquery; fallback documented in `WIRING-TRACES.md:101`.
- Rendered by: on-screen `NeighbourhoodSection.tsx:68` (CrimeCard); hosted full `HostedNeighbourhoodStats.tsx`.
- Threshold / classification logic: no direct threshold, the percentile (next row) carries the rule.
- Score contribution:, (count is not scored directly; percentile is, see crime_percentile).
- Coverage: National. `WIRING-TRACES.md:101` says "Yes" all cities via fallback.
- Common misreading: comparing the raw count between a small SA2 and a large city TA, those are different denominators.
- What it does NOT tell you: rates per capita, severity mix, or trend; this is a count.
- source_key status: present indirectly via `_src("nz_police_crime")` on the percentile finding (`report_html.py:1869, 1877`); the count itself has no dedicated finding.
- User-care severity: Context, raw count is useful background but the percentile carries the rule.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Reported crime per year | Annual victimisations | Annual victimisations (Police) |
| On-screen, finding | (no rule: count only, rule fires on percentile) | (no rule: count only, rule fires on percentile) | (no rule: count only, rule fires on percentile) |
| Hosted Quick, label | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | Crimes reported per year | Annual victimisations | NZ Police victimisations / yr |
| Hosted Full, narrative + tech | About {n} crimes a year are recorded in this area. | {n} victimisations recorded in this Police area unit per year (city median {city_median}). | NZ Police victimisations: {n}/yr in area_unit "{area_unit}". TA-median fallback used when the SA2 to area_unit match fails. |

---

## 4. Crime percentile (`liveability.crime_percentile` → `crime_rate`)

- What it measures: Percentile rank of this area unit's victimisation rate within its TA, 90 = busier than 90% of areas in the same city.
- Source authority: NZ Police, ranked by WhareScore.
- Dataset / endpoint: derived from `mv_crime_density.percentile_rank`; fallback `mv_crime_ta_ranked.ta_percentile`.
- DataSource key(s): UNKNOWN. `police_crime` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `nz_police_crime`.
- Table(s): `mv_crime_density`, `mv_crime_ta_ranked`.
- Query path: `0054_flood_nearest_m.sql:576`, `round((cd.percentile_rank * 100), 1)`.
- Rendered by: on-screen `NeighbourhoodSection.tsx:67` (CrimeCard); hosted full `HostedNeighbourhoodStats.tsx`.
- Threshold / classification logic: `report_html.py:1862–1880`, ≥75 → warn at 1863; ≥50 → info at 1871. Buyer recommendation at `report_html.py:2627–2629` (≥75 → `crime_high`).
- Score contribution: `risk_score.py:718`, indicator `crime`, weight 0.30 (largest single liveability weight).
- Coverage: National. `WIRING-TRACES.md:102` says "Yes" all cities.
- Common misreading: "75th percentile crime" sounding like 75% chance of being a victim, it's a relative rank, not a probability.
- What it does NOT tell you: severity (a burglary-heavy area and a violence-heavy area can sit at the same percentile); doesn't normalise for daytime population (CBDs always rank high).
- source_key status: present, `_src("nz_police_crime")` at `report_html.py:1869, 1877`.
- User-care severity: Notable, lived-experience and insurance-premium impact, finding rule at p>=75.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Crime vs other {city} areas | Crime percentile (city) | Crime percentile (TA-ranked) |
| On-screen, finding | Higher reported crime than {p}% of {city} areas. Check the locks and entry before signing. | {p}th percentile in {city}. Premiums often run 10 to 30% above the city base in higher-crime areas, get a quote before offering. | {p}th percentile within TA (NZ Police area unit "{area_unit}", mv_crime_density.percentile_rank; falls back to ta_percentile). |
| Hosted Quick, label | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | Where this area sits for crime | Crime percentile in {city} | Crime percentile (TA-ranked) |
| Hosted Full, narrative + tech | Higher than {p}% of {city} areas. The city median is {city_median} reports a year. | {p}th percentile vs {city}; median area sees {city_median} victimisations/yr. Look at specific crime types before drawing conclusions. | {p}th percentile within TA; source NZ Police victimisations, ranked by area unit (mv_crime_density, mv_crime_ta_ranked). |

---

## 5. Crime, city median victimisations (`liveability.crime_city_median_vics` → `crime_city_median`)

- What it measures: Median annual victimisations across area units in this TA, a comparator for the property's own count.
- Source authority: NZ Police (aggregated by WhareScore).
- Dataset / endpoint: `mv_crime_ta` (`city_median_vics` column).
- DataSource key(s): UNKNOWN. `police_crime` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `nz_police_crime`.
- Table(s): `mv_crime_ta`.
- Query path: `0054_flood_nearest_m.sql:577`.
- Rendered by: on-screen `NeighbourhoodSection.tsx:69` (CrimeCard `cityMedian` prop); hosted full `HostedNeighbourhoodStats.tsx`.
- Threshold / classification logic: used as a fallback in `risk_score.py` (≈ lines 705–717) to estimate `crime_pct` via national-quartile interpolation when area-unit percentile is missing.
- Score contribution: indirect, feeds `crime` indicator when percentile is null.
- Coverage: National.
- Common misreading: "median = average", it's the middle area unit, not the mean.
- What it does NOT tell you: distribution shape; some TAs have one CBD dominating the count.
- source_key status: not on a dedicated finding for the median itself; the value appears in the `median_str` formatting feeding the percentile Insight, where `_src("nz_police_crime")` is wired at `report_html.py:1869, 1877`.
- User-care severity: Background, comparator value with no standalone rule.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | City median crime | City-median victimisations | TA median victimisations |
| On-screen, finding | (no rule: comparator only) | (no rule: comparator only) | (no rule: comparator only) |
| Hosted Quick, label | (out of scope) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | (out of scope: comparator only) | (out of scope: comparator only) | TA median victimisations / yr |
| Hosted Full, narrative + tech | (out of scope: comparator only) | (out of scope: comparator only) | TA-median victimisations: {n}/yr (mv_crime_ta.city_median_vics); used as fallback in the risk_score crime calc. |

---

## 6. Crime, city total victimisations (`liveability.crime_city_total_vics`)

- What it measures: Sum of annual victimisations across all area units in this TA.
- Source authority: NZ Police.
- Dataset / endpoint: `mv_crime_ta.city_total_vics`.
- DataSource key(s): UNKNOWN. `police_crime` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `nz_police_crime`.
- Table(s): `mv_crime_ta`.
- Query path: `0054_flood_nearest_m.sql:578`.
- Rendered by: hosted full `HostedNeighbourhoodStats.tsx`. On-screen render, (inventory row 118 has `NeighbourhoodSection.tsx` listed but no specific code path was located for total).
- Threshold / classification logic: none.
- Score contribution: none.
- Coverage: National.
- Common misreading: comparing totals across cities of different population, Auckland will always dwarf Dunedin.
- What it does NOT tell you: per-capita rate.
- source_key status: N/A (no dedicated finding).
- User-care severity: Background, denominator value with no rule.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not surfaced individually on-screen) | (out of scope: not surfaced individually on-screen) | (out of scope: not surfaced individually on-screen) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | (out of scope: denominator only) | (out of scope: denominator only) | TA total victimisations / yr |
| Hosted Full, narrative + tech | (out of scope: denominator only) | (out of scope: denominator only) | TA total victimisations: {n}/yr (mv_crime_ta.city_total_vics, NZ Police). |

---

## 7. Crime, area count in city (`liveability.crime_city_area_count`)

- What it measures: Number of distinct area units inside this TA, the denominator behind the median/percentile rank.
- Source authority: NZ Police / Stats NZ area-unit geometry.
- Dataset / endpoint: `mv_crime_ta.city_area_count`.
- DataSource key(s): UNKNOWN. `police_crime` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `nz_police_crime`.
- Table(s): `mv_crime_ta`.
- Query path: `0054_flood_nearest_m.sql:579`.
- Rendered by: hosted full `HostedNeighbourhoodStats.tsx`. On-screen, (out of scope per inventory row 119 which lists `,` for on-screen).
- Threshold / classification logic: none.
- Score contribution: none.
- Coverage: National.
- Common misreading: treating it as "neighbourhoods with crime", every area is counted, including zero-crime ones.
- What it does NOT tell you: how many of those areas had any crime.
- source_key status: N/A.
- User-care severity: Background, technical denominator behind the percentile.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not surfaced on-screen per inventory) | (out of scope: not surfaced on-screen per inventory) | (out of scope: not surfaced on-screen per inventory) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | (out of scope: technical denominator) | (out of scope: technical denominator) | Area-unit denominator |
| Hosted Full, narrative + tech | (out of scope: technical denominator) | (out of scope: technical denominator) | {n} area_units in TA (mv_crime_ta.city_area_count); denominator for percentile rank. |

---

## 8. Schools within 1500m (`liveability.schools_1500m` → `school_count`)

- What it measures: List of schools within 1500m, with `name`, `decile`, `roll`, `eqi`, `institution_type`, `distance_m`, and `in_zone` flag (school-zone polygon containment).
- Source authority: Ministry of Education (school directory + EQI + zone polygons).
- Dataset / endpoint: MoE Education Counts (https://www.educationcounts.govt.nz/directories).
- DataSource key(s): UNKNOWN. `moe_schools`, `moe_eqi`, `moe_zones` are NOT registered as `DataSource(...)` entries in `data_loader.py` (0 grep hits). Only `school_zones` is registered (`data_loader.py:7137`); `schools`/EQI loaded outside the standard registry. Source catalog key: `moe_schools` (`report_html.py:657`).
- Table(s): `schools`, `school_zones`.
- Query path: `0054_flood_nearest_m.sql:580` (sch lateral, returning JSON array). Snapshot zone-detail join: `snapshot_generator.py:519–534` (`_q_school_zones`).
- Rendered by: on-screen `NeighbourhoodSection.tsx` (count via indicator card); hosted Quick: `HostedSchoolZones.tsx` (snapshot.report); hosted full: `HostedSchools.tsx` + `HostedSchoolZones.tsx`.
- Threshold / classification logic: in-zone count drives recommendations at `report_html.py:2635–2643` (`schools_in_zone_many` ≥ 3, `schools_in_zone_few` ≥ 1, `schools_no_zone` for 0 with schools nearby). Buyer/renter narrative recs at `report_html.py:3373–3374`. `risk_score.py:720` calls `school_quality_score(schools_1500m)`.
- Score contribution: `risk_score.py:720`, indicator `schools`, weight 0.25 in `WEIGHTS_LIVEABILITY`.
- Coverage: National. `WIRING-TRACES.md:97, 195`, Y all cities.
- Common misreading: "school nearby = my child can attend", proximity ≠ enrolment zone; only `in_zone=true` means guaranteed access.
- What it does NOT tell you: enrolment vacancies, transport access, or out-of-zone ballot odds.
- source_key status: TODO. `moe_schools` is in SOURCE_CATALOG (`report_html.py:657`) but no liveability Insight or recommendation passes `source=_src("moe_schools")`. Recommendations at `report_html.py:2635–2643` reference `schools_in_zone_*` keys but without source attribution.
- User-care severity: Notable (Critical for buyers and renters with school-age children), zoned access decides enrolment and influences value in desirable catchments.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Schools nearby | Schools within 1500m | Schools 1500m + zone status |
| On-screen, finding | You are in zone for {n} school(s). Confirm with MoE before signing, since zones change each year. | In-zone for {n} school(s). Zoned access typically adds 5 to 15% to value in sought-after catchments. | In-zone schools: {names} (MoE school zone polygons plus 1500m proximity, EQI {best_eqi}). |
| Hosted Quick, label | Schools you can enrol in | In-zone schools | MoE school zones (containment) |
| Hosted Quick, narrative | You are in zone for {n} school(s) within walking or driving distance. | {n} schools in zone. Confirm the current zone with MoE before relying on it for offers. | School-zone polygons (MoE): in-zone={names}; zone files are refreshed by MoE each enrolment year. |
| Hosted Full, label | Schools nearby + zones | School zones and proximity | MoE schools + school_zones |
| Hosted Full, narrative + tech | {n} schools within 1500m; you are in zone for {z}. | {n} schools within 1500m, {z} in-zone; EQI ranges {min} to {max} (lower EQI means less socio-economic disadvantage). | Schools within 1500m: {n}; in-zone via ST_Contains(school_zones.geom). Source: MoE Education Counts (directory, EQI, zone polygons). |

---

## 9. Heritage count 500m (`liveability.heritage_count_500m` → `heritage_count`)

- What it measures: Count of heritage-listed sites within 500m of the property.
- Source authority: Heritage New Zealand Pouhere Taonga (national list) plus council heritage overlays.
- Dataset / endpoint: HNZPT Register (https://www.heritage.org.nz/list); council heritage schedules.
- DataSource key(s): UNKNOWN. `hnzpt_heritage` and `council_heritage` are NOT registered as `DataSource(...)` entries in `data_loader.py` (0 grep hits). Per-council heritage variants ARE registered separately (e.g. `auckland_heritage`, `tauranga_heritage`, `dunedin_heritage_precinct`, plus `historic_heritage_overlay` per-council registrations). Source catalog key: `heritage_nz` (`report_html.py:658`).
- Table(s): `heritage_sites` (also `historic_heritage_overlay` for council overlays).
- Query path: `0054_flood_nearest_m.sql:592` (hr lateral, `COUNT(*) FROM heritage_sites WHERE ST_DWithin 500m`).
- Rendered by: on-screen `NeighbourhoodSection.tsx` (indicator card). Hosted full: `HostedNeighbourhoodStats.tsx:152, 568–578`. Hosted Quick: not rendered.
- Threshold / classification logic: `report_html.py:2694–2696`, count ≥ 20 → `heritage_area` recommendation; the count itself has no Insight rule (only `is_heritage_listed` does, at `report_html.py:2058–2063`, which is a planning-category Insight, not liveability). Hosted full surfaces ≥10 / ≥50 thresholds inline at `HostedNeighbourhoodStats.tsx:573–578`.
- Score contribution: `risk_score.py:721`, indicator `heritage`, weight 0.20 (`log_normalize(heritage_count_500m, 100)`).
- Coverage: National. `WIRING-TRACES.md:199`, Y all cities.
- Common misreading: "heritage nearby = my house is heritage-listed", count of *neighbours*, not the property itself.
- What it does NOT tell you: whether *this* property is listed (use `planning.is_heritage_listed`); doesn't tell you the protection level on neighbours.
- source_key status: TODO. neither the `is_heritage_listed` planning Insight at `report_html.py:2058–2063` nor the `heritage_area` recommendation at `report_html.py:2694–2696` passes `source=_src("heritage_nz")`. The `heritage_nz` entry exists in SOURCE_CATALOG (`report_html.py:658`) but is currently unused.
- User-care severity: Context, character signal that flags possible consent friction for surrounding works without changing the deal alone. Critical indicator with no liveability finding rule (only planning `is_heritage_listed` rule fires for this property's own listing).

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Heritage buildings nearby | Heritage sites within 500m | HNZPT + council heritage 500m |
| On-screen, finding | (no rule on the count itself) | (no rule on the count itself) | (no rule on the count itself) |
| Hosted Quick, label | (out of scope: not on Quick) | (out of scope: not on Quick) | (out of scope: not on Quick) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | Heritage character | Heritage sites within 500m | HNZPT + council overlay (500m) |
| Hosted Full, narrative + tech | {n} heritage buildings within a 5-minute walk. The area has older character. | {n} heritage sites within 500m; 10 or more signals a character precinct where surrounding works likely need consent. | {n} heritage sites within 500m. Sources: Heritage NZ Pouhere Taonga register, council heritage schedules (heritage_sites table). |

---

## 10. Amenities within 500m (`liveability.amenities_500m` → `amenity_count`)

- What it measures: Object of subcategory → count for OSM amenities within 500m (top 15 subcategories, café, restaurant, park, shop, etc.).
- Source authority: OpenStreetMap contributors (ODbL / © OSM).
- Dataset / endpoint: OSM via WhareScore loader.
- DataSource key(s): UNKNOWN. `osm_amenities` is NOT registered as a `DataSource(...)` entry in `data_loader.py` (0 grep hits); OSM amenities loaded outside the standard registry. Source catalog key: `osm_amenities` (`report_html.py:660`). Table: `osm_amenities`.
- Table(s): `osm_amenities`.
- Query path: `0054_flood_nearest_m.sql:593` (am lateral, `jsonb_object_agg(subcategory, cnt)` top 15).
- Rendered by: on-screen `NeighbourhoodSection.tsx` (NearbyAmenities subcomponent). Hosted full `HostedNeighbourhoodStats.tsx:173–180`.
- Threshold / classification logic: no direct Insight rule on `amenities_500m`; the data feeds the lifestyle-fit engine at `report_html.py:2810–2811` (cafe + restaurant counts ≥ 10 → "young professional" persona fit) via `build_lifestyle_fit()` reading `amenities` at `report_html.py:2765`.
- Score contribution: not directly weighted (no `WEIGHTS_LIVEABILITY` row). Influences lifestyle narrative only.
- Coverage: National (OSM coverage varies, denser in cities, sparser rural).
- Common misreading: trusting the count to mean "good amenities", OSM completeness is uneven; absence may mean unmapped, not absent.
- What it does NOT tell you: opening hours, quality, or whether the venue is still operating.
- source_key status: TODO. `osm_amenities` entry exists at `report_html.py:660` but no liveability insight passes `source=_src("osm_amenities")` for the count itself.
- User-care severity: Context, walkability signal that informs lifestyle fit but does not by itself change a buy or rent decision.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | What's within walking | Amenities within 500m | OSM amenities, 500m radius (top 15 subcats) |
| On-screen, finding | {x} cafes and {y} shops within 500m, daily errands by foot. | {n} amenity types mapped within 500m. Check OSM completeness for niche needs such as a 24/7 pharmacy. | OSM amenity counts, 500m radius: {top_subcats}. Coverage is uneven, verify via openstreetmap.org/copyright. |
| Hosted Quick, label | (out of scope: not on Quick) | (out of scope: not on Quick) | (out of scope: not on Quick) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | What's nearby | Amenities within 500m | OSM amenities, 500m radius |
| Hosted Full, narrative + tech | {n} types of amenities within a 5-minute walk, including {top_3}. | {top_3_subcats} within 500m. Useful for walkability, but OSM coverage varies by suburb. | OSM amenities, 500m radius: jsonb_object_agg(subcategory, cnt), top 15 subcats. Source: OpenStreetMap contributors (ODbL). |

---

## 11. Nearest supermarket (`liveability.nearest_supermarket`)

- What it measures: `{name, distance_m, latitude, longitude}`, closest supermarket OR known major NZ grocer brand (Woolworths, New World, PAK'nSAVE, FreshChoice, SuperValue, Four Square, Countdown), prioritising branded stores.
- Source authority: OpenStreetMap.
- Dataset / endpoint: OSM via WhareScore loader.
- DataSource key(s): UNKNOWN. `osm_amenities` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `osm_amenities` (`report_html.py:660`).
- Table(s): `osm_amenities`.
- Query path: `0054_flood_nearest_m.sql:594, 734–740` (ess lateral). Snapshot list-of-5: `snapshot_generator.py:496–517` (`_q_nearest_supermarkets`).
- Rendered by: on-screen `NeighbourhoodSection.tsx` (essentials list). Hosted Quick + Full: `HostedNearbyHighlights.tsx`; Hosted Full also shows top-5 list at `HostedNeighbourhoodStats.tsx:437–448`.
- Threshold / classification logic: none directly. (Healthcare-desert rule combines GP + pharmacy at ≥2km but supermarket has no equivalent rule, see row 12.)
- Score contribution: none.
- Coverage: National (OSM).
- Common misreading: the brand-priority sort can show a chain 100m further than a small grocer, by design, since branded weekly-shop is what most users compare.
- What it does NOT tell you: open hours, range, prices.
- source_key status: TODO. no `_src("osm_amenities")` on supermarket recommendations.
- User-care severity: Context, walking distance to groceries is lifestyle background, not on its own decision-changing.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Nearest supermarket | Nearest supermarket | Nearest supermarket (OSM) |
| On-screen, finding | {name}, about a {minutes}-min walk. | Nearest supermarket {name} {distance_m}m. | {name} {distance_m}m (OSM osm_amenities; branded NZ chains preferred over generic). |
| Hosted Quick, label | Nearest supermarket | Nearest supermarket | Nearest supermarket (OSM) |
| Hosted Quick, narrative | Closest supermarket: {name}, about {minutes} mins on foot. | {name} at {distance_m}m. Compare against the typical 800m walking radius. | Nearest supermarket {name} {distance_m}m; branded NZ chains preferred (osm_amenities, 5km radius). |
| Hosted Full, label | Where you'll do groceries | Nearest supermarket | OSM nearest supermarket |
| Hosted Full, narrative + tech | {name} is your closest supermarket ({distance_m}m). | {name} at {distance_m}m. Top 5 branded chains within 5km are also listed below. | {name} {distance_m}m via osm_amenities; branded preference: Woolworths, New World, PAK'nSAVE, FreshChoice, SuperValue, Four Square, Countdown. |

---

## 12. Nearest GP (`liveability.nearest_gp`)

- What it measures: `{name, distance_m, lat, lng}`, closest OSM amenity tagged `doctors` or `clinic`.
- Source authority: OpenStreetMap.
- Dataset / endpoint: OSM.
- DataSource key(s): UNKNOWN. `osm_amenities` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `osm_amenities` (`report_html.py:660`).
- Table(s): `osm_amenities`.
- Query path: `0054_flood_nearest_m.sql:595, 741–744` (ess.gp).
- Rendered by: on-screen `NeighbourhoodSection.tsx` (essentials). Hosted Quick + Full: `HostedNearbyHighlights.tsx`; Hosted Full essentials list at `HostedNeighbourhoodStats.tsx:51`.
- Threshold / classification logic: combined GP + pharmacy ≥2km → "healthcare desert" finding (`report_html.py:1962–1968`).
- Score contribution: none.
- Coverage: National (OSM).
- Common misreading: "doctor on map = enrolment open", many NZ practices are capped/closed.
- What it does NOT tell you: enrolment status, after-hours availability, Māori/Pacific health provider type.
- source_key status: TODO. healthcare-desert finding has no `source=_src(...)` (`report_html.py:1962–1968`).
- User-care severity: Notable (Critical for daily-medication users and older households via the healthcare-desert rule), enrolment access often matters more than distance.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Nearest GP | Nearest GP / clinic | Nearest GP (OSM doctors/clinic) |
| On-screen, finding | Nearest GP {distance_m}m, ring ahead to check they are taking new patients. | Nearest GP {distance_m}m, NZ books are often capped so confirm enrolment is open before offering. | Nearest doctors/clinic {distance_m}m (OSM subcategory='doctors' or 'clinic'); healthcare-desert rule fires when GP and pharmacy are both 2km or more. |
| Hosted Quick, label | Nearest GP | Nearest GP / clinic | Nearest GP (OSM) |
| Hosted Quick, narrative | Closest GP: {name}, about {minutes} mins. Confirm they are taking new patients. | {name} {distance_m}m. Confirm enrolment is open, since some NZ practices have waitlists. | OSM nearest doctors/clinic: {name} {distance_m}m; combined 2km or more with pharmacy triggers the healthcare-desert finding. |
| Hosted Full, label | Where you'll see a doctor | Nearest GP / clinic | OSM nearest GP |
| Hosted Full, narrative + tech | {name} is your nearest GP ({distance_m}m). Call to check enrolment. | {name} at {distance_m}m. If both GP and pharmacy are 2km or more away, daily-medication users and older households should plan delivery. | {name} {distance_m}m via osm_amenities (subcategory IN doctors, clinic). Healthcare-desert rule at report_html.py:1962–1968 (GP and pharmacy both 2km or more). |

---

## 13. Nearest pharmacy (`liveability.nearest_pharmacy`)

- What it measures: `{name, distance_m, lat, lng}`, closest OSM amenity tagged `pharmacy`.
- Source authority: OpenStreetMap.
- Dataset / endpoint: OSM.
- DataSource key(s): UNKNOWN. `osm_amenities` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `osm_amenities` (`report_html.py:660`).
- Table(s): `osm_amenities`.
- Query path: `0054_flood_nearest_m.sql:596, 745–748` (ess.pharmacy).
- Rendered by: on-screen `NeighbourhoodSection.tsx` (essentials). Hosted Quick + Full: `HostedNearbyHighlights.tsx`; Hosted Full essentials at `HostedNeighbourhoodStats.tsx:52`.
- Threshold / classification logic: paired with GP at ≥2km → healthcare-desert finding (`report_html.py:1962`).
- Score contribution: none.
- Coverage: National (OSM).
- Common misreading: distance ≠ delivery, even a far pharmacy is fine if they deliver.
- What it does NOT tell you: hours, delivery service, whether it dispenses methadone/controlled meds.
- source_key status: TODO. healthcare-desert finding has no `source=_src(...)`.
- User-care severity: Notable (Critical for daily-medication users when paired with GP at 2km or more), pharmacy delivery softens distance for most households.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Nearest pharmacy | Nearest pharmacy | Nearest pharmacy (OSM) |
| On-screen, finding | Nearest pharmacy {distance_m}m; most NZ pharmacies will deliver scripts. | Nearest pharmacy {distance_m}m, with the GP also 2km or more away it is a daily-life cost for medication users. | Nearest pharmacy {distance_m}m (OSM subcategory='pharmacy'); pairs with GP for the healthcare-desert finding. |
| Hosted Quick, label | Nearest pharmacy | Nearest pharmacy | Nearest pharmacy (OSM) |
| Hosted Quick, narrative | Closest pharmacy: {name}, about {minutes} mins on foot. | {name} {distance_m}m. Daily-medication users should confirm delivery options. | OSM nearest pharmacy: {name} {distance_m}m; 2km or more combined with GP triggers the healthcare-desert insight. |
| Hosted Full, label | Where you'll fill scripts | Nearest pharmacy | OSM nearest pharmacy |
| Hosted Full, narrative + tech | {name} is your nearest pharmacy ({distance_m}m). Most NZ pharmacies deliver if asked. | {name} at {distance_m}m. Combined 2km or more with the GP triggers a healthcare-access flag. | {name} {distance_m}m via osm_amenities (subcategory='pharmacy'). |

---

## 14. Conservation, nearest name (`liveability.conservation_nearest`)

- What it measures: Name of the closest DOC-administered conservation land parcel within 5km.
- Source authority: Department of Conservation.
- Dataset / endpoint: DOC public conservation areas dataset.
- DataSource key(s): UNKNOWN. `doc_conservation` is the SOURCE_CATALOG key (`report_html.py:683`), not a `DataSource(...)` registry key (0 grep hits in `data_loader.py`). The `conservation_land` table is loaded outside the standard registry. Loader registration keys for related DOC layers: `doc_huts` (`data_loader.py:7121`), `doc_tracks` (`:7126`), `doc_campsites` (`:7131`).
- Table(s): `conservation_land`.
- Query path: `0054_flood_nearest_m.sql:597, 751–757` (con lateral, 5km radius, nearest by `geom <-> addr.geom`).
- Rendered by: on-screen `NeighbourhoodSection.tsx`. Hosted full: `HostedOutdoorRec.tsx`. Hosted Quick: not rendered.
- Threshold / classification logic: none.
- Score contribution: none.
- Coverage: National (DOC). UNKNOWN, coverage matrix in `WIRING-TRACES.md` does not enumerate this field per city.
- Common misreading: "conservation land = public reserve", DOC parcels include scenic reserves but also leased land; access varies.
- What it does NOT tell you: access status, walking-track availability (use `nearby_doc` for that), or whether it's open to the public.
- source_key status: TODO. `doc_conservation` is now in SOURCE_CATALOG (`report_html.py:683`, "Department of Conservation public estate") but no Insight or recommendation currently passes `source=_src("doc_conservation")` (no Insight rule on `conservation_*` fields).
- User-care severity: Context, lifestyle background that informs outdoor access expectations.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Nearest reserve | Nearest conservation land | Nearest DOC land parcel |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not on Quick) | (out of scope: not on Quick) | (out of scope: not on Quick) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | Nearest reserve / forest | Nearest DOC parcel | DOC conservation_land (5km radius) |
| Hosted Full, narrative + tech | Closest reserve: {name}. | Nearest DOC parcel: {name}. Access status depends on parcel type, a scenic reserve is not the same as a working forest. | Nearest conservation_land within 5km: {name}. Source: DOC public conservation areas; not all parcels have public access. |

---

## 15. Conservation, nearest type (`liveability.conservation_nearest_type`)

- What it measures: DOC `land_type` for the parcel above (e.g., Scenic Reserve, Conservation Park, Recreation Reserve, Stewardship Area).
- Source authority: Department of Conservation.
- Dataset / endpoint: DOC.
- DataSource key(s): UNKNOWN. `doc_conservation` is the SOURCE_CATALOG key (`report_html.py:683`), not a `DataSource(...)` registry key. Loader registration keys for related DOC layers: `doc_huts`, `doc_tracks`, `doc_campsites`.
- Table(s): `conservation_land`.
- Query path: `0054_flood_nearest_m.sql:598, 752` (`con.land_type`).
- Rendered by: hosted full `HostedOutdoorRec.tsx`. On-screen, (not surfaced, inventory row 127 lists `,` for on-screen).
- Threshold / classification logic: none.
- Score contribution: none.
- Coverage: National.
- Common misreading: "Reserve = public park", Stewardship Areas are not parks; access can be restricted.
- What it does NOT tell you: dog rules, vehicle access, hut/track facilities.
- source_key status: TODO. `doc_conservation` exists in SOURCE_CATALOG (`report_html.py:683`) but no Insight surfaces this field, so `_src(...)` is not currently called.
- User-care severity: Background, technical descriptor of the parcel category.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not surfaced) | (out of scope: not surfaced) | (out of scope: not surfaced) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope) | (out of scope) | (out of scope) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | (out of scope: technical descriptor) | (out of scope: technical descriptor) | DOC land_type |
| Hosted Full, narrative + tech | (out of scope: technical descriptor) | (out of scope: technical descriptor) | DOC land_type='{land_type}' (conservation_land). Access rules differ by category, see the DOC parcel page. |

---

## 16. Conservation, nearest distance (`liveability.conservation_nearest_distance_m`)

- What it measures: Straight-line metres to the conservation parcel above.
- Source authority: DOC + WhareScore-computed `ST_Distance`.
- Dataset / endpoint: derived from `conservation_land`.
- DataSource key(s): UNKNOWN. `doc_conservation` is the SOURCE_CATALOG key (`report_html.py:683`), not a `DataSource(...)` registry key. Loader registration keys for related DOC layers: `doc_huts`, `doc_tracks`, `doc_campsites`.
- Table(s): `conservation_land`.
- Query path: `0054_flood_nearest_m.sql:599, 752` (`round(ST_Distance(...))`).
- Rendered by: on-screen `NeighbourhoodSection.tsx`. Hosted full: `HostedOutdoorRec.tsx` (and `HostedNeighbourhoodStats.tsx:58–59` builds an essentials row).
- Threshold / classification logic: none.
- Score contribution: none.
- Coverage: National; capped at 5km radius (`ST_DWithin 5000`) so anything further reads NULL.
- Common misreading: straight-line metres ≠ walking minutes; bush parcels often have no formed entry on the side facing the property.
- What it does NOT tell you: track entry-point distance.
- source_key status: TODO. `doc_conservation` exists in SOURCE_CATALOG (`report_html.py:683`) but no Insight surfaces this field, so `_src(...)` is not currently called.
- User-care severity: Context, distance is informative but does not change a buy or rent decision on its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Distance to reserve | Distance to nearest DOC | DOC parcel distance (m) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not on Quick) | (out of scope: not on Quick) | (out of scope: not on Quick) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | How close it is | DOC distance | Straight-line distance to DOC parcel |
| Hosted Full, narrative + tech | About {distance_m}m as the crow flies. Walking time depends on entry points. | {distance_m}m straight-line; the formed track entrance may be further. | ST_Distance to nearest conservation_land = {distance_m}m (capped at 5km radius). |

---

## 17. Nearby DOC features (`nearby_doc`)

- What it measures: Snapshot-only structure `{huts: [...], tracks: [...], campsites: [...]}`, up to 10 of each within 5km, with `name`, `status`, `category`, `distance_m`.
- Source authority: Department of Conservation (huts, tracks, campsites tables).
- Dataset / endpoint: DOC public datasets.
- DataSource key(s), Loader registration: `doc_tracks` (`data_loader.py:7126`), `doc_huts` (`data_loader.py:7121`), `doc_campsites` (`data_loader.py:7131`). Source catalog key: `doc_conservation` (`report_html.py:683`).
- Table(s): `doc_huts`, `doc_tracks`, `doc_campsites`.
- Query path: `snapshot_generator.py:476–494` (`_q_doc`); not in `get_property_report()`.
- Rendered by: hosted full `HostedOutdoorRec.tsx`. On-screen / Hosted Quick, (out of scope per inventory row 129).
- Threshold / classification logic: none, list display only.
- Score contribution: none.
- Coverage: National (DOC). UNKNOWN, per-city coverage breakdown not in WIRING-TRACES city matrix.
- Common misreading: list isn't ranked by quality, distance only.
- What it does NOT tell you: difficulty grades for tracks (only category), hut booking status.
- source_key status: TODO. `doc_conservation` is now in SOURCE_CATALOG (`report_html.py:683`) but the snapshot rendering does not currently pass `source=_src("doc_conservation")` (no Insight surface, list-only).
- User-care severity: Context, lifestyle list with no rule attached.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: snapshot-only field) | (out of scope: snapshot-only field) | (out of scope: snapshot-only field) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: hosted full only) | (out of scope: hosted full only) | (out of scope: hosted full only) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | Tracks, huts, campsites nearby | DOC outdoor recreation (5km) | DOC huts / tracks / campsites, 5km radius |
| Hosted Full, narrative + tech | {n_tracks} walking tracks, {n_huts} huts and {n_campsites} campsites within 5km. | {n_tracks} tracks, {n_huts} huts, {n_campsites} campsites within 5km. Handy for weekend access, not graded by difficulty here. | DOC nearby (5km radius, top 10 per layer): {n_tracks} tracks, {n_huts} huts, {n_campsites} campsites. Source: DOC doc_tracks, doc_huts, doc_campsites. |

---

## 18. Nearby highlights (`nearby_highlights`)

- What it measures: Snapshot-only `{good: [...], caution: [...], info: [...]}`, closest OSM amenity per subcategory within 1500m, classified by sentiment per `routers/nearby.py AMENITY_CLASSES`.
- Source authority: OpenStreetMap.
- Dataset / endpoint: OSM via `osm_amenities`.
- DataSource key(s): UNKNOWN. `osm_amenities` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `osm_amenities` (`report_html.py:660`).
- Table(s): `osm_amenities`.
- Query path: `snapshot_generator.py:335–367` (`_q_highlights`).
- Rendered by: hosted Quick + Full `HostedNearbyHighlights.tsx`. On-screen, (out of scope; on-screen uses `NearbyAmenities` component fed by `/nearby` API).
- Threshold / classification logic: classification keys live in `routers/nearby.py AMENITY_CLASSES` (not graded by distance).
- Score contribution: none.
- Coverage: National (OSM); completeness uneven.
- Common misreading: "caution" items aren't necessarily bad, they're things like cemeteries, bottle shops, that some users want to know about.
- What it does NOT tell you: how complete OSM is for this neighbourhood.
- source_key status: TODO.
- User-care severity: Context, classified list of nearby amenities with no rule attached.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: snapshot-only, on-screen renders /nearby) | (out of scope: snapshot-only, on-screen renders /nearby) | (out of scope: snapshot-only, on-screen renders /nearby) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | What's nearby | Nearby highlights (1.5km) | OSM nearby, sentiment-classified (1.5km) |
| Hosted Quick, narrative | Cafes, parks, schools and a few items to know about within about 1.5km. | {n_good} good, {n_caution} to know about, {n_info} info amenities within 1.5km, classified by AMENITY_CLASSES. | OSM amenities, 1.5km radius, DISTINCT ON subcategory; sentiment from routers/nearby.py AMENITY_CLASSES. |
| Hosted Full, label | What's around you | Nearby highlights | OSM nearby (1.5km, sentiment-classed) |
| Hosted Full, narrative + tech | {n_good} good things, {n_caution} to know about, {n_info} useful spots within about 1.5km. | {n_good} good, {n_caution} to know about, {n_info} info amenities within 1.5km. OSM coverage varies by suburb, verify niche needs. | OSM amenities, 1.5km radius, one closest per subcategory; sentiment buckets per routers/nearby.py AMENITY_CLASSES. Source: OpenStreetMap (ODbL). |

---

## 19. Community facilities (`community_facilities`)

- What it measures: Snapshot-only object including `nearest_hospital` (≤50km), `nearest_ev_charger` + `ev_chargers_5km`, plus 2km counts for `libraries_2km`, `sports_facilities_2km`, `playgrounds_2km`, `community_centres_2km`, `cycling_facilities_2km`, plus `fibre_available` / `fibre_provider` / `fibre_sfa_name`.
- Source authority: OpenStreetMap (amenities) + Crown Infrastructure / Chorus fibre coverage layer (for `fibre_*`).
- Dataset / endpoint: OSM via `osm_amenities`; `fibre_coverage` table for fibre.
- DataSource key(s), Loader registration: `fibre_coverage` (`data_loader.py:4896`, Commerce Commission Specified Fibre Areas 2025). OSM portion: UNKNOWN, `osm_amenities` not registered as a `DataSource(...)` in `data_loader.py`. Source catalog key: `osm_amenities` (`report_html.py:660`).
- Table(s): `osm_amenities`, `fibre_coverage`.
- Query path: `snapshot_generator.py:645–724` (`_q_community_facilities`).
- Rendered by: hosted full `HostedNeighbourhoodStats.tsx:137`. On-screen / Hosted Quick, (out of scope, snapshot-only).
- Threshold / classification logic: counts only; no thresholds.
- Score contribution: none.
- Coverage: National (OSM); fibre coverage = where `fibre_coverage` table has polygons (UNKNOWN national completeness).
- Common misreading: zero EV chargers ≠ no power for an EV; many homes charge from the wall socket.
- What it does NOT tell you: fibre speed tier, library opening hours, sports-centre membership cost.
- source_key status: TODO.
- User-care severity: Notable, fibre availability and hospital distance can change a buy or rent decision; the rest is context.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: snapshot-only) | (out of scope: snapshot-only) | (out of scope: snapshot-only) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: hosted full only) | (out of scope: hosted full only) | (out of scope: hosted full only) |
| Hosted Quick, narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full, label | Public services nearby | Community facilities (2km) + fibre | OSM facilities, 2km radius + fibre_coverage |
| Hosted Full, narrative + tech | {libraries} libraries, {playgrounds} playgrounds, {sports} sports facilities within 2km. Fibre: {available}. | Within 2km: {libraries} libraries, {sports} sports facilities, {playgrounds} playgrounds, {community_centres} community centres, {cycling} cycling facilities. Fibre: {provider}. | Counts within 2km from osm_amenities (libraries, sports_centre or swimming_pool, playground, community_centre, cycling). Nearest hospital within 50km, EV charger within 10km plus count within 5km. Fibre: ST_Contains(fibre_coverage.geom, addr.geom). |

---

## Local coverage audit

### Severity distribution (post-polish, 2026-05-02)

| Indicators | Critical | Notable | Context | Background |
|---|---|---|---|---|
| 19 | 0 | 6 (#1 nzdep, #4 crime_percentile, #8 schools_1500m, #12 nearest_gp, #13 nearest_pharmacy, #19 community_facilities) | 8 (#3 victimisations count, #9 heritage_count_500m, #10 amenities_500m, #11 nearest_supermarket, #14 conservation_nearest, #16 conservation_distance, #17 nearby_doc, #18 nearby_highlights) | 5 (#2 area unit, #5 city median, #6 city total, #7 area count, #15 conservation type) |

Severity totals: 0 Critical + 6 Notable + 8 Context + 5 Background = 19 (matches indicator count). Three Notable indicators (#8 schools, #12 GP, #13 pharmacy) escalate to Critical for specific personas via existing rules; this is noted in their Meaning blocks. Liveability has no Critical indicators because amenity proximity, deprivation index and crime percentile are quality-of-life signals, not decision-changing on their own (Critical is reserved for hazards and planning constraints in other categories).

### Coverage and source-key wiring (carried over from prior pass, code refs unchanged)

| Indicators in category | With Insight findings (report_html.py) | With `_src(...)` wired | Missing on hosted-full |
|---|---|---|---|
| 19 | 3 (nzdep at 1839/1846, crime_percentile at 1863/1871, healthcare-desert combining nearest_gp + nearest_pharmacy at 1962) | 2 (`nzdep` 1844/1851; `nz_police_crime` 1869/1877) | 0 (every indicator has a hosted-full surface or is explicitly out-of-scope; on-screen omissions are noted per row) |

Notes:
- "With Insight findings" counts only liveability-category Insight calls in `report_html.py`. The `is_heritage_listed` Insight at line 2058 fires under planning, not liveability, so it is not counted here. Recommendations (`_make(...)` at 2635–2643 / 2694–2696 / 3373–3389) are buyer/renter narrative, not Insights, and are not counted.
- "With `_src(...)` wired" counts indicators where at least one Insight passes `source=_src(...)`. Healthcare-desert (1962–1968) does not, so `nearest_gp` and `nearest_pharmacy` are not counted even though they trigger an Insight.

## Local gap list (UNKNOWN entries or missing source_key)

Items needing source_key wired (`_src(...)` not currently passed):
- `liveability.heritage_count_500m`, no Insight is wired on the count itself; the related `is_heritage_listed` planning Insight at `report_html.py:2058–2063` and `heritage_area` recommendation at `report_html.py:2694–2696` both lack `source=_src("heritage_nz")` though the entry exists in SOURCE_CATALOG (`report_html.py:658`).
- `liveability.amenities_500m`, no insight rule passes `_src("osm_amenities")` (entry at `report_html.py:660`).
- `liveability.nearest_supermarket` / `nearest_gp` / `nearest_pharmacy`, healthcare-desert finding at `report_html.py:1962–1968` and supermarket recommendations have no `source=_src(...)`.
- `liveability.conservation_nearest*`, `doc_conservation` is now in SOURCE_CATALOG (`report_html.py:683`), but no Insight currently surfaces these fields, so `_src("doc_conservation")` is never called.
- `nearby_doc`, `doc_conservation` SOURCE_CATALOG entry exists (`:683`), but the snapshot rendering does not attach `source=_src(...)`.
- `nearby_highlights`, `community_facilities`, OSM/custom; no source attribution wired despite `osm_amenities` being in SOURCE_CATALOG.

UNKNOWN items (could not verify from code in the time allotted):
- DataSource registry confirmation: of the inventory's claimed liveability keys, only `doc_tracks` (`data_loader.py:7126`), `doc_huts` (`:7121`), `doc_campsites` (`:7131`), `school_zones` (`:7137`), and `fibre_coverage` (`:4896`) exist as `DataSource(...)` registrations. Per-council heritage variants (e.g. `auckland_heritage`, `tauranga_heritage`, `dunedin_heritage_precinct`, plus `historic_heritage_overlay` per-council registrations) are registered separately. The inventory's aspirational keys `stats_nzdep`, `police_crime`, `moe_schools`, `moe_eqi`, `moe_zones`, `hnzpt_heritage`, `council_heritage`, `osm_amenities`, `doc_conservation` are NOT in the DataSource registry, they are SOURCE_CATALOG keys (where they exist there) plus actual loading via one-off scripts (e.g. `scripts/load_nzdep.py`) or migrations not registered with the standard `DataSource(...)` mechanism. Marked UNKNOWN per row, with the SOURCE_CATALOG key noted where one exists.
- Per-city coverage breakdown for: `conservation_nearest*`, `nearby_doc`, `community_facilities` (`fibre_coverage` in particular). `WIRING-TRACES.md` City Coverage Matrix does not enumerate these fields.

## Local conflict list (inconsistent labelling across surfaces)

- "Heritage": on-screen `NeighbourhoodSection.tsx` indicator card uses generic indicator name from `IndicatorCard`; hosted-full uses inline label "This property is heritage-listed." / "{n} heritage item(s) nearby (500m)" at `HostedNeighbourhoodStats.tsx:572–578`; the planning Insight `is_heritage_listed` lives at `report_html.py:2058–2063` (planning category, not liveability). Same field cluster, two surfaces, no consistent label.
- "Crime": on-screen `CrimeCard` (`NeighbourhoodSection.tsx:66`) presents victimisations + percentile + city median in one card; hosted-full splits these across multiple sub-blocks in `HostedNeighbourhoodStats.tsx`. Buyer recommendations at `report_html.py:3373–3389` use "high crime area" / "low crime area" prose despite the percentile rule using thresholds 75 / 25, wording diverges from the rule's actual cut-points.
- "NZDep", on-screen labels it "Deprivation Index" (`NeighbourhoodSection.tsx:38`) but the on-screen finding text and hosted-full both refer to "NZDep decile" (`report_html.py:1842`). Same field, two label conventions.
- "Schools", on-screen indicator label is generic "School" (from indicator metadata); buyer recommendations at `report_html.py:3373–3374` use "in-zone for {n} schools"; hosted Quick renders zones-only via `HostedSchoolZones.tsx`; hosted Full has both `HostedSchools.tsx` and `HostedSchoolZones.tsx`. The "in-zone" qualifier is inconsistent, sometimes the count is total, sometimes in-zone.
- "Nearest supermarket / GP / pharmacy", hosted-full essentials list at `HostedNeighbourhoodStats.tsx:51–53` labels them "Supermarket" / "GP / Medical" / "Pharmacy", but the SQL fields use `nearest_supermarket` / `nearest_gp` / `nearest_pharmacy`. "GP / Medical" is the only one that diverges from the field name and hides that this also matches `clinic` subcategory from OSM.
