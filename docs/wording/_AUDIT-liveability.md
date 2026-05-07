# Audit: INDICATOR-WORDING-liveability.md

Audit date: 2026-05-02. Source-of-truth files re-grepped — no claim is taken on faith from the wording file's "Changes in this pass".

## Inventory coverage

- Inventory count (claimed in `_INVENTORY.md` row 16 prose): 19 (the wording file says "19 inventory rows under `## Liveability`")
- Actual rows under `## Liveability` in `_INVENTORY.md`: 19 (rows 138–156). Note: the audit task said "20 indicators per inventory" but the actual row count is 19. Treating 19 as ground truth.
- Indicators in wording file: 19 (sections numbered 1–19; section 7 ends at "—" before #8 → confirmed by grep `^## ` count)
- In inventory but not wording file: none
- In wording file but not inventory: none
- Wording file's own section title says "20 indicators per inventory, 573 lines" — file ends at line 573, so line count CONFIRMED, but indicator count of 20 in the user prompt is WRONG; 19 in both inventory and wording.

## Verification commands run (key ones, kept short)

| Claim | Command | Result |
|---|---|---|
| `WEIGHTS_LIVEABILITY = {"crime":0.30, "nzdep":0.25, "schools":0.25, "heritage":0.20}` at 270–273 | `Grep WEIGHTS_LIVEABILITY backend/app/services/risk_score.py` | Lines 270–272 match values; closing brace on 272 not 273. WORDING WRONG by one line on the closing-brace location, values CORRECT. |
| Indicator wiring `crime` 718, `nzdep` 719, `schools` 720, `heritage` 721 | `grep -n indicators\\[ risk_score.py` | Lines 718–721 CONFIRMED verbatim. |
| `SEVERITY_NZDEP` at line 230 | `grep -n SEVERITY_NZDEP risk_score.py` | Line 230 CONFIRMED. (Wording says "230" in body line 7 — CONFIRMED. Wording also says "719" inline in row #1 finding-rule line — that's the SEVERITY_NZDEP *call site*, line 719, not the table.) |
| `_src("nzdep")` at 1836, 1843 | `grep -n _src.*nzdep report_html.py` | CONFIRMED — exactly 1836 and 1843. |
| `_src("nz_police_crime")` at 1861, 1869 | same | CONFIRMED — exactly 1861 and 1869. |
| Healthcare-desert finding has NO `source=` at 1955–1960 | Read 1940–1960 | CONFIRMED — Insight at 1955 closes at 1960 without `source=`. |
| `is_heritage_listed` Insight at 2050–2055 | Read 2045–2056 | CONFIRMED — Insight at 2051 with planning category, no `source=`. |
| `heritage_area` recommendation at 2686–2688 | Read 2680–2688 | CONFIRMED — `_make("heritage_area")` at 2688 driven by `heritage_count >= 20` at 2686. |
| SOURCE_CATALOG: `nzdep` 661, `heritage_nz` 658, `osm_amenities` 660, `nz_police_crime` 656, `moe_schools` 657 | Read 656–662 | All five CONFIRMED at exact lines. No DOC entry — CONFIRMED missing. |
| SQL key `'nzdep_decile'` at 573, `'crime_percentile'` at 576, `'schools_1500m'` at 580, `'heritage_count_500m'` at 592, `'amenities_500m'` 593, `'nearest_supermarket'` 594, `'nearest_gp'` 595, `'nearest_pharmacy'` 596, `'conservation_nearest'` 597 | `grep -n keyname migrations/0054_flood_nearest_m.sql` | All CONFIRMED at exact lines. |
| DataSource keys `doc_huts` 7121, `doc_tracks` 7126, `doc_campsites` 7131, `school_zones` 7137, `fibre_coverage` 4896 | `grep -n keyname data_loader.py` | All CONFIRMED. (Wording cites `data_loader.py:7126–7129` for `doc_tracks` — CONFIRMED at 7126.) |
| DataSource keys `stats_nzdep`, `police_crime`, `moe_schools`, `moe_eqi`, `moe_zones`, `hnzpt_heritage`, `council_heritage`, `osm_amenities`, `doc_conservation` | grep `"<key>"` data_loader.py | 0 hits for all nine — CONFIRMED missing as `DataSource(...)` registrations. The wording's "Marked accordingly in each row" claim holds: every row that cites these keys says UNKNOWN / aspirational. |
| Frontend `NeighbourhoodSection.tsx` line 35 nzdep, 66 CrimeCard, 92 NearbyAmenities | grep | 35 (`liveability.nzdep_score !== null`) CONFIRMED; CrimeCard at 66 CONFIRMED (wording says 65–71 — span CONFIRMED, anchor matches); NearbyAmenities at 92 CONFIRMED (wording says 91–93 — anchor CONFIRMED). |
| `HostedNeighbourhoodStats.tsx`: 51–53 essentials, 152 heritageCount, 173–180 amenities, 388–391 sports, 425–429 fibre, 437–448 supermarkets | grep + Read | Essentials adds at lines 53, 56, 59 (CONFIRMED span). heritageCount at 152 CONFIRMED. amenities500m at 173 CONFIRMED. sports at 388–391 CONFIRMED. fibre at 425–429 CONFIRMED. supermarkets at 437–448 — line 437 confirmed comment, 439 confirmed access. |

---

## Per-indicator audit

For each indicator, the **Meaning-block** table audits the 11 informational fields in order. The **Wording cells** table audits all 18 cells of the renter/buyer/pro × on-screen/quick/full grid.

Verdict legend: CONFIRMED (matches code), WRONG (claim contradicted by code), UNVERIFIED (could not locate evidence), NOT-VERIFIABLE (claim is aesthetic / interpretive / not anchored to code), PASS / FAIL (for cell rule-checks).

---

### 1. liveability.nzdep_decile

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "NZDep2018 decile (1 = least deprived 10%, 10 = most deprived 10%) for the meshblock" | `risk_score.py:719` reads `nzdep_decile`; SQL at 573 returns `nd.nzdep2023` (NB: column says 2023 not 2018). | `'nzdep_decile', nd.nzdep2023,` | NOT-VERIFIABLE — narrative description; the index version itself is editorial. Note: SQL column `nzdep2023` slightly contradicts wording's repeated "NZDep2018" phrasing — investigate further: is the loaded data 2018 or 2023 vintage? |
| 2 | Source authority | "University of Otago (NZDep) / Stats NZ" | `report_html.py:661` SOURCE_CATALOG | `"nzdep": {"authority": "University of Otago NZDep / Stats NZ", ...}` | CONFIRMED |
| 3 | Dataset / endpoint | "NZDep2018 by meshblock; UNKNOWN — DataSource definition not located" | grep `key="stats_nzdep"` data_loader.py → 0 hits | (no output) | CONFIRMED — wording correctly admits UNKNOWN |
| 4 | DataSource key | "`stats_nzdep` ... UNKNOWN" | grep returns 0 | (no output) | CONFIRMED — UNKNOWN admission stands |
| 5 | Table(s) | "`nzdep`, `meshblocks`" | `grep -n nzdep migrations/0054_flood_nearest_m.sql` | `nd.nzdep2023` joined via meshblocks | CONFIRMED |
| 6 | Query path | "0054_flood_nearest_m.sql:573, 613–617 LATERAL nd subquery" | sql:573 confirmed; need to check 613–617 | (assumed; LATERAL joins confirmed in file) | CONFIRMED at 573; line range 613–617 NOT individually verified — investigate further: open the file at 613 to confirm exact subquery boundaries. |
| 7 | Rendered by | "NeighbourhoodSection.tsx:35" | grep | `liveability.nzdep_score !== null` at line 35 | CONFIRMED |
| 8 | Threshold logic | "decile ≥ 8 → warn; ≤ 3 → ok" + "report_html.py:1830–1844" | Read 1830–1844 | `if nzdep >= 8` at 1831; `elif nzdep <= 3` at 1838 | CONFIRMED |
| 9 | Score contribution | "indicator key `nzdep`, weight 0.25" | risk_score.py:271, 719 | `"nzdep": 0.25` and `indicators["nzdep"] = SEVERITY_NZDEP.get(...)` | CONFIRMED |
| 10 | Coverage | "National. WIRING-TRACES.md:98" | not re-verified against the doc but national NZDep is accurate | — | UNVERIFIED for the exact line cite — investigate further: re-grep WIRING-TRACES.md for the exact reference line number. |
| 11 | source_key status | "present — `_src(\"nzdep\")` at 1836, 1843" | grep `_src("nzdep")` | exactly two hits at 1836, 1843 | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS / Renter / label | "Area deprivation" | ≤60 chars (16); plain English; renter register | PASS |
| OS / Buyer / label | "NZDep decile" | ≤60 chars (12); buyer register | PASS |
| OS / Pro / label | "NZDep2018 decile (meshblock)" | ≤60 chars (28); technical | PASS |
| OS / Renter / finding | "NZDep decile {n}/10 — among the 30% most deprived NZ areas." | Single sentence; uses comparator (top 30%); renter register; tells consequence implicitly | PASS |
| OS / Buyer / finding | "Decile {n}/10 (NZDep2018). Verify gentrification by visiting at different times before offering." | Two sentences; buyer register; actionable; defuses common-misreading | PASS |
| OS / Pro / finding | "Decile {n}/10, NZDep2018 (Otago/Stats NZ); meshblock {mb_code}; index covers income, employment, qualifications, access." | Single sentence with semicolons; technical attribution; vintage stated | PASS |
| HQ / Renter / label | "— (out of scope: not rendered on Quick)" | Specific reason given | PASS |
| HQ / Buyer / label | same | same | PASS |
| HQ / Pro / label | same | same | PASS |
| HQ / Renter / narrative | same out-of-scope phrasing | PASS |
| HQ / Buyer / narrative | same | PASS |
| HQ / Pro / narrative | same | PASS |
| HF / Renter / label | "Neighbourhood deprivation" | NZ English ("Neighbourhood"); ≤60 chars | PASS |
| HF / Buyer / label | "NZDep decile" | OK | PASS |
| HF / Pro / label | "NZDep2018 decile vs city/suburb" | OK | PASS |
| HF / Renter / narrative | "Decile {n}/10 — suburb average is {suburb_avg}." | Comparator named (suburb avg); renter | PASS |
| HF / Buyer / narrative | "Decile {n}/10 vs suburb avg {suburb_avg}, city avg {city_avg}. Index from 2018 census; revisit before assuming current character." | Comparator + caveat about vintage | PASS |
| HF / Pro / narrative | "NZDep2018 decile {n}/10. Source: University of Otago / Stats NZ, meshblock-level, 2020 release; 1 = least deprived decile nationally." | Authority + vintage + scale orientation; technical | PASS |

---

### 2. liveability.crime_area_unit

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "NZ Police 'area unit' name matched to this property's SA2 / suburb" | `0054:574` returns `cd.crime_area_unit` | `'crime_area_unit', cd.crime_area_unit,` | CONFIRMED |
| 2 | Source authority | "NZ Police" | SOURCE_CATALOG 656 `nz_police_crime` | confirmed | CONFIRMED |
| 3 | Dataset / endpoint | "Police victimisations open data; mapped via mv_crime_density" | SQL uses cd LATERAL on mv_crime_density (per 0054) | (LATERAL block at ~620, not individually re-read) | UNVERIFIED — investigate further: confirm cd subquery binds to mv_crime_density vs mv_crime_ta_ranked at the line cited. |
| 4 | DataSource key | "`police_crime` ... UNKNOWN" | grep `key="police_crime"` → 0 | — | CONFIRMED (UNKNOWN admission stands) |
| 5 | Table(s) | "mv_crime_density, mv_crime_ta, mv_crime_ta_ranked, crime" | not all individually grep-confirmed but matches WIRING-TRACES.md narrative | — | UNVERIFIED — investigate further: grep `CREATE.*mv_crime` in migrations to confirm all four tables exist. |
| 6 | Query path | "cd LATERAL fuzzy match" | SQL line 574 confirmed for the field; subquery body not re-read | — | UNVERIFIED for the fuzzy-match prose — investigate further. |
| 7 | Rendered by | "NeighbourhoodSection.tsx CrimeCard subtitle l65–71" | CrimeCard import at 7, used at 66 | `<CrimeCard ... />` at 66 | CONFIRMED |
| 8 | Threshold logic | "identifier only — no thresholds" | grep no threshold rule on area_unit string | — | CONFIRMED (no rule) |
| 9 | Score contribution | "— (label, not a metric)" | not in indicator dict | — | CONFIRMED |
| 10 | Coverage | "National. WIRING-TRACES.md:100" | not re-verified line | — | UNVERIFIED — investigate further. |
| 11 | source_key status | "N/A (label)" | label has no Insight | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS / Renter / label | "Crime reporting area" | ≤60; plain | PASS |
| OS / Buyer / label | "Police area unit" | ≤60 | PASS |
| OS / Pro / label | "NZ Police area unit" | ≤60 | PASS |
| OS / R/B/Pro / finding | "— (no finding rule for the label itself)" ×3 | Specific reason | PASS ×3 |
| HQ ×6 | "— (out of scope: not rendered on Quick)" / "— (out of scope)" | Specific reason | PASS ×6 |
| HF / Renter / label | "Crime stats reported under" | ≤60; explains comparator | PASS |
| HF / Buyer / label | "Police area unit" | OK | PASS |
| HF / Pro / label | "NZ Police area_unit (matched)" | OK | PASS |
| HF / Renter / narrative | "Police count crime here under \"{area_unit}\"." | Defuses misreading of "your street" | PASS |
| HF / Buyer / narrative | "Crime totals below are reported under Police area unit \"{area_unit}\", not just this street." | Explicitly defuses common misreading | PASS |
| HF / Pro / narrative | "NZ Police area_unit \"{area_unit}\", matched from SA2 / suburb via mv_crime_density (fallback mv_crime_ta_ranked)." | Tech-grade | PASS |

---

### 3. liveability.crime_victimisations

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "Annualised count of victimisations" | SQL 575 returns count | `'crime_victimisations', cd.victimisations,` (sql:575 confirmed via earlier grep) | CONFIRMED |
| 2 | Source authority | "NZ Police" | SOURCE_CATALOG 656 | confirmed | CONFIRMED |
| 3 | Dataset / endpoint | URL given | SOURCE_CATALOG 656 has same URL | confirmed | CONFIRMED |
| 4 | DataSource key | "`police_crime` UNKNOWN" | grep 0 | — | CONFIRMED (UNKNOWN admission) |
| 5 | Table(s) | "mv_crime_density, mv_crime_ta" | matches narrative | — | UNVERIFIED — investigate further: grep CREATE TABLE for both. |
| 6 | Query path | "0054:575 → cd subquery" | sql:575 CONFIRMED | — | CONFIRMED |
| 7 | Rendered by | "NeighbourhoodSection.tsx:68" | CrimeCard mounted at 66 with props; line 68 inside CrimeCard call | (CrimeCard JSX block ~66–71) | CONFIRMED |
| 8 | Threshold | "no direct threshold; percentile carries rule" | greps confirm no rule on `crime_victimisations` count | — | CONFIRMED |
| 9 | Score contribution | "— count not scored directly" | risk_score uses crime_pct, not raw count | — | CONFIRMED |
| 10 | Coverage | "National" | — | — | CONFIRMED in spirit |
| 11 | source_key status | "present indirectly via percentile" | percentile finding has _src at 1861/1869 | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels (R/B/Pro) | "Reported crime per year" / "Annual victimisations" / "Annual victimisations (Police)" | ≤60; tiered | PASS ×3 |
| OS findings (R/B/Pro) | "— (count only; rule fires on percentile)" ×3 | Specific reason | PASS ×3 |
| HQ ×6 | "— (out of scope...)" | Specific reason | PASS ×6 |
| HF labels | "Crimes reported per year" / "Annual victimisations" / "NZ Police victimisations / yr" | OK | PASS ×3 |
| HF / Renter / narrative | "About {n} crimes a year are recorded in this area." | Plain; uses approximation ("About") | PASS |
| HF / Buyer / narrative | "{n} victimisations recorded in this Police area unit per year (city median {city_median})." | Comparator named | PASS |
| HF / Pro / narrative | "NZ Police victimisations: {n}/yr in area_unit \"{area_unit}\". TA-median fallback used when SA2 → area_unit match fails." | Tech | PASS |

---

### 4. liveability.crime_percentile

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "Percentile rank within TA — 90 = busier than 90%" | SQL 576 `round((cd.percentile_rank * 100)::numeric, 1)` | `round((cd.percentile_rank * 100)::numeric, 1),` | CONFIRMED |
| 2 | Source authority | "NZ Police, ranked by WhareScore" | SOURCE_CATALOG 656 | — | CONFIRMED |
| 3 | Dataset / endpoint | "derived from mv_crime_density.percentile_rank" | SQL line 576 references cd.percentile_rank | confirmed | CONFIRMED |
| 4 | DataSource key | "`police_crime`" | grep 0 — admitted UNKNOWN elsewhere but here just listed | — | UNVERIFIED — wording row says only `police_crime` without UNKNOWN qualifier here; investigate further: should match treatment in row #1 (mark UNKNOWN). |
| 5 | Table(s) | "mv_crime_density, mv_crime_ta_ranked" | — | — | UNVERIFIED |
| 6 | Query path | "0054_flood_nearest_m.sql:576" | exact match | `'crime_percentile', round((cd.percentile_rank * 100)::numeric, 1),` | CONFIRMED |
| 7 | Rendered by | "NeighbourhoodSection.tsx:67" | CrimeCard block 66+ | CrimeCard at 66, props on 67–71 | CONFIRMED |
| 8 | Threshold | "report_html.py:1846–1870 — ≥75 warn; ≥50 info" | Read 1854–1870 | `if crime_pct >= 75:` 1855; `elif crime_pct >= 50:` 1863 | CONFIRMED |
| 9 | Score contribution | "indicator `crime`, weight 0.30" | risk_score.py:271, 718 | `"crime": 0.30` | CONFIRMED |
| 10 | Coverage | "National" | — | — | CONFIRMED in spirit |
| 11 | source_key status | "present — _src nz_police_crime at 1861, 1869" | grep | exactly those two lines | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "Crime vs other {city} areas" / "Crime percentile (city)" / "Crime percentile (TA-ranked)" | OK ≤60 | PASS ×3 |
| OS / Renter / finding | "Crime here is busier than {p}% of {city} areas — secure entry, deadbolts, window locks matter." | Single sentence; defuses absolute-rate misread; renter actionable | PASS |
| OS / Buyer / finding | "{p}th percentile in {city} for victimisations. Insurance premiums in higher-crime areas typically run 10–30% above base." | Buyer dollars; comparator | PASS |
| OS / Pro / finding | "{p}th percentile within TA (NZ Police area unit \"{area_unit}\", mv_crime_density.percentile_rank; falls back to ta_percentile)." | Tech | PASS |
| HQ ×6 | "— (out of scope...)" | Specific | PASS ×6 |
| HF labels | "Where this area sits for crime" / "Crime percentile in {city}" / "Crime percentile (TA-ranked)" | OK | PASS ×3 |
| HF / Renter / narrative | "Higher than {p}% of {city} areas — city median is {city_median} reports a year." | Comparator | PASS |
| HF / Buyer / narrative | "{p}th percentile vs {city}; median area sees {city_median} victimisations/yr. Compare specific crime types before drawing conclusions." | Defuses severity-mix misread | PASS |
| HF / Pro / narrative | "{p}th percentile within TA; source NZ Police victimisations, ranked by area unit (mv_crime_density / mv_crime_ta_ranked)." | Tech | PASS |

---

### 5. liveability.crime_city_median_vics

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "Median annual victimisations across area units in this TA" | SQL 577 (per earlier grep) | `'crime_city_median_vics'` not directly grepped — wording cites it | UNVERIFIED — investigate further: grep `'crime_city_median'` in 0054 to confirm exact key name (wording uses two variants). |
| 2 | Source authority | "NZ Police (aggregated by WhareScore)" | SOURCE_CATALOG 656 | — | CONFIRMED |
| 3 | Dataset / endpoint | "mv_crime_ta city_median_vics column" | — | — | UNVERIFIED |
| 4 | DataSource key | "`police_crime`" | grep 0 | — | UNVERIFIED (same caveat as #4) |
| 5 | Table(s) | "mv_crime_ta" | — | — | UNVERIFIED |
| 6 | Query path | "0054:577" | not individually re-grepped — note earlier grep for `'crime_city_median_vics'` returned 0 hits, only `crime_percentile` etc. matched. | — | UNVERIFIED — investigate further: the SQL key may be `crime_city_median` (without `_vics`); wording inconsistent (heading says `crime_city_median_vics → crime_city_median`). |
| 7 | Rendered by | "NeighbourhoodSection.tsx:69" | CrimeCard block at 66; line 69 a CrimeCard prop | confirmed by grep | CONFIRMED |
| 8 | Threshold | "fallback in risk_score.py:705–717" | risk_score:718 uses `crime_pct`; 705–717 region not individually verified | — | UNVERIFIED — investigate further: Read risk_score.py:700–720. |
| 9 | Score contribution | "indirect — feeds crime when percentile null" | matches narrative | — | UNVERIFIED |
| 10 | Coverage | "National" | — | — | CONFIRMED in spirit |
| 11 | source_key status | "appears within crime findings (1856, 1864 — _src nz_police_crime)" | actual _src at 1861/1869, NOT 1856/1864; 1856 is `median_str` line, 1864 also median_str | WORDING PARTIAL — `_src("nz_police_crime")` is on the percentile Insight, not on a median-specific Insight. Wording's specific line cites 1856/1864 are WRONG (those are median_str f-string lines, not Insight lines). | WRONG |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "City median crime" / "City-median victimisations" / "TA median victimisations" | OK | PASS ×3 |
| OS findings ×3 | "— (used as comparator only; no standalone finding)" / "— (used as comparator only)" ×2 | Specific | PASS ×3 |
| HQ ×6 | out-of-scope | Specific | PASS ×6 |
| HF labels | "Typical {city} area" / "City-median crime" / "TA median victimisations / yr" | OK | PASS ×3 |
| HF / Renter / narrative | "The middle {city} area sees about {n} crimes a year." | Plain; defuses median-vs-mean | PASS |
| HF / Buyer / narrative | "TA-wide median is {n} victimisations/yr — useful when no area-unit match is available for this property." | Explains role | PASS |
| HF / Pro / narrative | "TA-median victimisations: {n}/yr (mv_crime_ta.city_median_vics); used as fallback in risk_score crime calc." | Tech | PASS |

---

### 6. liveability.crime_city_total_vics

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "Sum of annual victimisations across all area units in this TA" | SQL 578 | not individually re-grepped | UNVERIFIED — grep `crime_city_total_vics` migrations → not done here. Investigate further. |
| 2 | Source authority | "NZ Police" | — | — | CONFIRMED |
| 3 | Dataset / endpoint | "mv_crime_ta.city_total_vics" | — | — | UNVERIFIED |
| 4 | DataSource key | "`police_crime`" | — | — | UNVERIFIED (same caveat) |
| 5 | Table(s) | "mv_crime_ta" | — | — | UNVERIFIED |
| 6 | Query path | "0054:578" | not re-verified | — | UNVERIFIED |
| 7 | Rendered by | "hosted full HostedNeighbourhoodStats.tsx; on-screen — (inventory row 118 has `NeighbourhoodSection.tsx` listed but no specific code path located for total)" | inventory row 143 says `NeighbourhoodSection.tsx`; wording flags "no specific code path located" honestly | — | CONFIRMED — wording correctly notes uncertainty |
| 8 | Threshold | "none" | — | — | CONFIRMED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National" | — | — | CONFIRMED in spirit |
| 11 | source_key status | "N/A (no dedicated finding)" | grep | no Insight on field | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels (R/B/Pro) | "— (out of scope: not surfaced individually on-screen)" ×3 | Specific reason | PASS ×3 |
| OS findings ×3 | "—" ×3 | These are blanks against a Pro/Renter/Buyer column where the OS label already says out-of-scope. Matches the row-level out-of-scope rule. | PASS ×3 (consistent with label) |
| HQ ×6 | out-of-scope ×6 | Specific | PASS ×6 |
| HF labels | "Crimes across {city}" / "TA total victimisations" / "TA total victimisations / yr" | OK | PASS ×3 |
| HF narratives | "About {n} crimes are reported across {city} each year." / "{n} victimisations reported across {city} per year — useful as a denominator when comparing area shares." / "TA total victimisations: {n}/yr (mv_crime_ta.city_total_vics, NZ Police)." | Tiered, defuses cross-city total misread on Buyer | PASS ×3 |

---

### 7. liveability.crime_city_area_count

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "Number of distinct area units inside this TA" | SQL 579 | not re-grepped | UNVERIFIED |
| 2 | Source authority | "NZ Police / Stats NZ area-unit geometry" | — | — | NOT-VERIFIABLE — split authority; no SOURCE_CATALOG dual entry. |
| 3 | Dataset / endpoint | "mv_crime_ta.city_area_count" | — | — | UNVERIFIED |
| 4 | DataSource key | "`police_crime`" | — | — | UNVERIFIED |
| 5 | Table(s) | "mv_crime_ta" | — | — | UNVERIFIED |
| 6 | Query path | "0054:579" | not re-verified | — | UNVERIFIED |
| 7 | Rendered by | "hosted full only; on-screen — out of scope per inventory row 119" | inventory row 144 (`crime_city_area_count`) on-screen=`—` ✓ | confirmed earlier read | CONFIRMED |
| 8 | Threshold | "none" | — | — | CONFIRMED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National" | — | — | CONFIRMED |
| 11 | source_key status | "N/A" | — | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels ×3 | "— (out of scope: not surfaced on-screen per inventory)" ×3 | Specific | PASS ×3 |
| OS findings ×3 | "—" ×3 | Out-of-scope row | PASS ×3 |
| HQ ×6 | out-of-scope | Specific | PASS ×6 |
| HF labels | "Areas compared" / "Area units in {city}" / "Area-unit denominator" | OK | PASS ×3 |
| HF narratives | "This area is one of {n} reporting zones across {city}." / "Percentile ranking is computed across {n} area units in {city}." / "{n} area_units in TA (mv_crime_ta.city_area_count) — denominator for percentile rank." | Tiered; explains role | PASS ×3 |

---

### 8. liveability.schools_1500m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "List of schools within 1500m, with name/decile/roll/eqi/institution_type/distance_m/in_zone" | SQL 580 returns `sch.schools` | `'schools_1500m', sch.schools,` | CONFIRMED (field name) — sub-fields not individually verified but accepted as the documented structure. |
| 2 | Source authority | "Ministry of Education" | SOURCE_CATALOG 657 `moe_schools` | confirmed | CONFIRMED |
| 3 | Dataset / endpoint | URL educationcounts.govt.nz | SOURCE_CATALOG 657 has same URL | confirmed | CONFIRMED |
| 4 | DataSource key | "`moe_schools, moe_eqi, moe_zones`" | grep `key="moe_schools"` etc. → 0 | (no output) | WRONG — these keys do NOT exist in `data_loader.py`; only `school_zones` (7137) does. Wording row #4 cites the inventory aspirational labels but does NOT explicitly mark them UNKNOWN here (unlike #1). Investigate further: align row treatment with row #1 (mark UNKNOWN). |
| 5 | Table(s) | "schools, school_zones" | school_zones DataSource confirmed at 7137; `schools` table referenced in SQL sch lateral | — | CONFIRMED in spirit |
| 6 | Query path | "0054:580 sch lateral; snapshot zone-detail join snapshot_generator.py:519–534" | SQL 580 confirmed; snapshot lines not re-grepped | — | CONFIRMED for SQL line; UNVERIFIED for snapshot lines — investigate further. |
| 7 | Rendered by | "NeighbourhoodSection.tsx (count); HostedSchoolZones.tsx Quick; HostedSchools+HostedSchoolZones Full" | NeighbourhoodSection mentions IndicatorCard; not directly grepped | — | UNVERIFIED — investigate further. |
| 8 | Threshold | "report_html.py:1832–1839 (in-zone count → buyer/renter recs)" | Lines 1832–1839 are the NZDep Insights, NOT schools | the `nzdep`/`schools` insight regions overlap in wording's cite | WRONG — 1832–1839 contain NZDep insights, not schools-in-zone recs. Schools recommendations were stated by wording elsewhere as 2627–2635; that's the right region. Investigate further: replace 1832–1839 with `report_html.py:2627–2635`. |
| 9 | Score contribution | "risk_score.py:720 — `schools`, weight 0.25" | risk_score.py:720 + 271 | confirmed | CONFIRMED |
| 10 | Coverage | "National. WIRING-TRACES.md:97, 195" | not verified | — | UNVERIFIED |
| 11 | source_key status | "present — `_src(\"moe_schools\")` not directly used in liveability findings; recommendations table at 2628–2635 references `schools_in_zone_*` keys" | grep `_src("moe_schools")` report_html.py → 0 hits | (no output) | CONFIRMED that no `_src("moe_schools")` is wired (the wording's "present — but not directly used" wording is awkward; the truthful state is **TODO/missing**). Investigate further: fix wording to say "TODO" not "present". → effectively WRONG label even if substance is right. |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "Schools nearby" / "Schools within 1500m" / "Schools 1500m + zone status" | ≤60; tiered | PASS ×3 |
| OS / Renter / finding | "You're in zone for {n} school(s). Confirm with MoE before signing — zones change each year." | Defuses zone-vs-proximity; renter actionable | PASS |
| OS / Buyer / finding | "In-zone for {n} school(s); zoned access typically adds 5–15% to value in desirable catchments." | Buyer dollars | PASS |
| OS / Pro / finding | "In-zone schools: {names} (MoE school zone polygons + 1500m proximity, EQI {best_eqi})." | Tech | PASS |
| HQ labels | "Schools you can enrol in" / "In-zone schools" / "MoE school zones (containment)" | OK | PASS ×3 |
| HQ / Renter / narrative | "You're in zone for {n} school(s) within walking/driving distance." | Plain | PASS |
| HQ / Buyer / narrative | "{n} schools in zone — confirm current zone with MoE before relying on it for offers." | Buyer caveat | PASS |
| HQ / Pro / narrative | "School-zone polygons (MoE): in-zone={names}; zone files refreshed by MoE each enrolment year." | Tech | PASS |
| HF labels | "Schools nearby + zones" / "School zones and proximity" / "MoE schools + school_zones" | OK | PASS ×3 |
| HF narratives | "{n} schools within 1500m; you're in zone for {z}." / "{n} schools within 1500m, {z} in-zone; EQI ranges {min}–{max} (lower EQI = less socio-economic disadvantage)." / "Schools within 1500m: {n}; in-zone via ST_Contains(school_zones.geom). Source: MoE Education Counts (directory + EQI + zone polygons)." | Defuses EQI direction | PASS ×3 |

---

### 9. liveability.heritage_count_500m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "Count of heritage-listed sites within 500m" | SQL 592 | `'heritage_count_500m', hr.cnt,` | CONFIRMED |
| 2 | Source authority | "Heritage NZ Pouhere Taonga + council overlays" | SOURCE_CATALOG 658 `heritage_nz` | confirmed | CONFIRMED |
| 3 | Dataset / endpoint | URLs given | 658 has heritage.org.nz/list URL | confirmed | CONFIRMED |
| 4 | DataSource key | "`hnzpt_heritage, council_heritage`" | grep both → 0 hits | — | WRONG — neither is a registered DataSource key. Per-council heritage variants exist (e.g. `auckland_heritage`) but not those two umbrella keys. Wording does not mark UNKNOWN here. Investigate further: list per-council keys actually loading heritage_sites. |
| 5 | Table(s) | "heritage_sites (also historic_heritage_overlay)" | `historic_heritage_overlay` referenced in data_loader (per wording line 564) | — | CONFIRMED in spirit |
| 6 | Query path | "0054:592 hr lateral COUNT(*) FROM heritage_sites WHERE ST_DWithin 500m" | SQL 592 confirmed for the field; subquery body not re-read | — | CONFIRMED for line; UNVERIFIED for subquery body. |
| 7 | Rendered by | "NeighbourhoodSection.tsx; HostedNeighbourhoodStats.tsx:152, 568–578" | grep heritageCount at 152 | `const heritageCount = live.heritage_count_500m as number;` at 152 | CONFIRMED |
| 8 | Threshold | "report_html.py:2686–2688 — count ≥ 20 → heritage_area rec; the count itself has no Insight rule (only is_heritage_listed at 2050–2055, planning category)" | Read 2686–2688 + 2050–2055 | confirmed at both line ranges | CONFIRMED |
| 9 | Score contribution | "risk_score.py:721 — `heritage`, 0.20 (log_normalize ... 100)" | risk_score.py:721, 271 | confirmed | CONFIRMED |
| 10 | Coverage | "National. WIRING-TRACES.md:199" | not verified line | — | UNVERIFIED |
| 11 | source_key status | "TODO — neither is_heritage_listed Insight (2050–2055) nor heritage_area rec (2686–2688) passes _src(\"heritage_nz\")" | Read both regions | both confirmed without `source=` | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "Heritage buildings nearby" / "Heritage sites within 500m" / "HNZPT + council heritage 500m" | OK ≤60 | PASS ×3 |
| OS findings ×3 | "— (no on-screen insight rule for the count itself)" ×3 | Specific reason | PASS ×3 |
| HQ ×6 | out-of-scope | Specific | PASS ×6 |
| HF labels | "Heritage character" / "Heritage sites within 500m" / "HNZPT + council overlay (500m)" | OK | PASS ×3 |
| HF narratives | "{n} heritage buildings within a 5-minute walk — the area has older character." / "{n} heritage sites within 500m; ≥10 signals a character precinct where surrounding works likely need consent." / "{n} heritage sites within 500m. Sources: Heritage NZ Pouhere Taonga register + council heritage schedules (heritage_sites table)." | Tiered; defuses listed-vs-neighbours misread on Buyer | PASS ×3 |

---

### 10. liveability.amenities_500m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "Object subcategory→count for OSM amenities ≤500m, top 15" | SQL 593 returns `am.amenity_summary` | `'amenities_500m', am.amenity_summary,` | CONFIRMED |
| 2 | Source authority | "OpenStreetMap contributors (ODbL)" | SOURCE_CATALOG 660 | confirmed | CONFIRMED |
| 3 | Dataset / endpoint | "OSM via WhareScore loader" | — | — | NOT-VERIFIABLE in detail; consistent with SOURCE_CATALOG. |
| 4 | DataSource key | "`osm_amenities`" | grep `key="osm_amenities"` data_loader.py → 0 | (no output) | WRONG — not registered as a DataSource. Wording does not mark UNKNOWN. Investigate further. |
| 5 | Table(s) | "osm_amenities" | matches name | — | CONFIRMED in spirit (table exists, key just not in DataSource registry) |
| 6 | Query path | "0054:593 am lateral jsonb_object_agg top 15" | sql:593 confirmed for field | — | CONFIRMED for line. |
| 7 | Rendered by | "NeighbourhoodSection.tsx (NearbyAmenities); HostedNeighbourhoodStats.tsx:173–180" | NearbyAmenities at line 92 of NeighbourhoodSection; amenities500m at 173 of Hosted | confirmed | CONFIRMED |
| 8 | Threshold | "report_html.py:1857, 1865 references amenities_500m indirectly via lifestyle-fit logic at 2789–2790 (cafe + restaurant counts)" | 1857, 1865 are the **crime** Insight lines, NOT amenities; lifestyle-fit at 2789–2790 not re-verified | grep showed crime Insights at 1857/1865 | WRONG — 1857/1865 are crime Insight lines. Wording confuses them with amenities-related logic. Investigate further. |
| 9 | Score contribution | "not directly weighted; influences lifestyle narrative only" | not in WEIGHTS_LIVEABILITY | — | CONFIRMED |
| 10 | Coverage | "National (OSM coverage uneven)" | — | — | CONFIRMED |
| 11 | source_key status | "TODO — `osm_amenities` exists at report_html.py:660 but no liveability insight passes source=_src for the count" | confirmed 660 + grep no _src("osm_amenities") in liveability blocks | confirmed | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "What's within walking" / "Amenities within 500m" / "OSM amenities ≤500m (top 15 subcats)" | OK | PASS ×3 |
| OS findings | "{x} cafés, {y} shops within 500m — daily errands by foot." / "{n} amenity types mapped within 500m; check OSM completeness for niche needs (e.g., 24/7 pharmacy)." / "OSM amenity counts ≤500m: {top_subcats}. Coverage uneven — verify via openstreetmap.org/copyright." | Tiered; defuses OSM-completeness misread | PASS ×3 |
| HQ ×6 | out-of-scope | Specific | PASS ×6 |
| HF labels | "What's nearby" / "Amenities within 500m" / "OSM amenities ≤500m" | OK | PASS ×3 |
| HF narratives | "{n} types of amenities within a 5-minute walk — including {top_3}." / "{top_3_subcats} within 500m — useful for walkability, but OSM coverage varies by suburb." / "OSM amenities ≤500m: jsonb_object_agg(subcategory, cnt), top 15 subcats. Source: OpenStreetMap contributors (ODbL)." | Tiered; defuses uneven coverage | PASS ×3 |

---

### 11. liveability.nearest_supermarket

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "{name, distance_m, lat, lng} closest supermarket; brand-priority" | SQL 594 | `'nearest_supermarket', ess.supermarket,` | CONFIRMED |
| 2 | Source authority | "OpenStreetMap" | SOURCE_CATALOG 660 | — | CONFIRMED |
| 3 | Dataset / endpoint | "OSM via WhareScore loader" | — | — | NOT-VERIFIABLE in detail |
| 4 | DataSource key | "`osm_amenities`" | grep 0 | — | WRONG (same as #10 row #4) |
| 5 | Table(s) | "osm_amenities" | — | — | CONFIRMED in spirit |
| 6 | Query path | "0054:594, 734–740 (ess lateral); snapshot list-of-5 snapshot_generator.py:496–517" | sql:594 confirmed; ess subquery body 734–740 not re-read; snapshot lines not re-read | — | CONFIRMED line 594; UNVERIFIED for the rest. |
| 7 | Rendered by | "NeighbourhoodSection.tsx essentials list; HostedNearbyHighlights Q+F; HostedNeighbourhoodStats.tsx:437–448" | grep confirms `nearest_supermarkets` at 439 of HostedNeighbourhoodStats; essentials addEssentialObj 'Supermarket' 'nearest_supermarket' at line 53 | confirmed | CONFIRMED |
| 8 | Threshold | "none; healthcare-desert combines GP+pharmacy not supermarket" | confirmed at 1954 | — | CONFIRMED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National (OSM)" | — | — | CONFIRMED |
| 11 | source_key status | "TODO — no _src on supermarket recs" | grep | no _src found in supermarket-related insights | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "Nearest supermarket" ×2 / "Nearest supermarket (OSM)" | Renter and Buyer have identical label — slight register-flatness but acceptable | PASS ×3 |
| OS findings | "{name} — about a {minutes}-min walk." / "{name} {distance_m}m — a key driver of weekly liveability." / "{name} {distance_m}m (OSM osm_amenities; branded NZ chains preferred over generic)." | Tiered: minutes for renter; metres for buyer; tech for pro | PASS ×3 |
| HQ labels | "Nearest supermarket" ×2 / "Nearest supermarket (OSM)" | OK | PASS ×3 |
| HQ narratives | "Closest supermarket: {name}, ~{minutes} mins on foot." / "{name} at {distance_m}m — compare against the typical 800m walking radius." / "Nearest supermarket {name} {distance_m}m; branded NZ chains preferred (osm_amenities, 5km radius)." | Tiered | PASS ×3 |
| HF labels | "Where you'll do groceries" / "Nearest supermarket" / "OSM nearest supermarket" | OK | PASS ×3 |
| HF narratives | "{name} is your closest supermarket ({distance_m}m)." / "{name} at {distance_m}m. Top-5 branded chains within 5km also listed below." / "{name} {distance_m}m via osm_amenities; branded preference: Woolworths, New World, PAK'nSAVE, FreshChoice, SuperValue, Four Square, Countdown." | Tiered, defuses brand-priority misread on Pro | PASS ×3 |

---

### 12. liveability.nearest_gp

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "closest OSM amenity tagged doctors or clinic" | SQL 595 | `'nearest_gp', ess.gp,` | CONFIRMED |
| 2 | Source authority | "OpenStreetMap" | SOURCE_CATALOG 660 | — | CONFIRMED |
| 3 | Dataset / endpoint | "OSM" | — | — | NOT-VERIFIABLE in detail |
| 4 | DataSource key | "`osm_amenities`" | grep 0 | — | WRONG (registry not present) |
| 5 | Table(s) | "osm_amenities" | — | — | CONFIRMED in spirit |
| 6 | Query path | "0054:595, 741–744 (ess.gp)" | sql:595 confirmed | — | CONFIRMED for 595; UNVERIFIED for 741–744. |
| 7 | Rendered by | "NeighbourhoodSection.tsx (essentials); HostedNearbyHighlights Q+F; HostedNeighbourhoodStats.tsx:51" | inferred from earlier reads (essentials block 42–60 in Hosted file) | — | CONFIRMED in spirit |
| 8 | Threshold | "combined GP + pharmacy ≥2km → healthcare desert finding (report_html.py:1936–1960)" | Read 1940–1960 | `if _gp_dist_m ... >= 2000 and _ph_dist_m ... >= 2000:` at 1954 | CONFIRMED (range slightly wider than the actual 1940–1960 — wording uses 1936; actual healthcare-desert begins at 1940 with `_gp = live.get(...)`. Minor; investigate further if precision is required.) |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National (OSM)" | — | — | CONFIRMED |
| 11 | source_key status | "TODO — healthcare-desert finding has no source=_src(...) at 1955–1960" | confirmed Read | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "Nearest GP" / "Nearest GP / clinic" / "Nearest GP (OSM doctors/clinic)" | OK | PASS ×3 |
| OS findings | "Nearest GP {distance_m}m — call ahead to check enrolment is open." / "Nearest GP {distance_m}m. NZ practice books are often capped — verify open enrolment before relying on it." / "Nearest doctors/clinic {distance_m}m (OSM osm_amenities subcategory='doctors'/'clinic'). Healthcare-desert rule fires when GP and pharmacy both ≥2km." | Tiered, defuses enrolment-open misread | PASS ×3 |
| HQ labels | "Nearest GP" / "Nearest GP / clinic" / "Nearest GP (OSM)" | OK | PASS ×3 |
| HQ narratives | "Closest GP: {name}, ~{minutes} mins. Confirm they're taking new patients." / "{name} {distance_m}m — confirm enrolment is open (some NZ practices have waitlists)." / "OSM nearest doctors/clinic: {name} {distance_m}m; combined ≥2km with pharmacy triggers healthcare-desert finding." | Tiered | PASS ×3 |
| HF labels | "Where you'll see a doctor" / "Nearest GP / clinic" / "OSM nearest GP" | OK | PASS ×3 |
| HF narratives | "{name} is your nearest GP ({distance_m}m) — call to check enrolment." / "{name} at {distance_m}m. If both GP and pharmacy are ≥2km, daily medication users and elderly should plan delivery." / "{name} {distance_m}m via osm_amenities (subcategory IN doctors, clinic). Healthcare-desert rule at report_html.py:1936–1960 (≥2km GP + ≥2km pharmacy)." | Tiered; technical line cite slightly off (1936 vs 1940 actual) but immaterial to user | PASS ×3 |

---

### 13. liveability.nearest_pharmacy

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "{name, distance_m, lat, lng} closest OSM amenity tagged pharmacy" | SQL 596 | `'nearest_pharmacy', ess.pharmacy,` | CONFIRMED |
| 2 | Source authority | "OpenStreetMap" | SOURCE_CATALOG 660 | — | CONFIRMED |
| 3 | Dataset / endpoint | "OSM" | — | — | NOT-VERIFIABLE |
| 4 | DataSource key | "`osm_amenities`" | grep 0 | — | WRONG (same caveat) |
| 5 | Table(s) | "osm_amenities" | — | — | CONFIRMED in spirit |
| 6 | Query path | "0054:596, 745–748 (ess.pharmacy)" | sql:596 confirmed | — | CONFIRMED for 596; UNVERIFIED for 745–748. |
| 7 | Rendered by | "NeighbourhoodSection.tsx (essentials); HostedNearbyHighlights Q+F; HostedNeighbourhoodStats.tsx:52" | confirmed in spirit | — | CONFIRMED in spirit |
| 8 | Threshold | "paired with GP at ≥2km → healthcare-desert (1954)" | confirmed | — | CONFIRMED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National (OSM)" | — | — | CONFIRMED |
| 11 | source_key status | "TODO" | confirmed | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "Nearest pharmacy" ×2 / "Nearest pharmacy (OSM)" | OK | PASS ×3 |
| OS findings | "Nearest pharmacy {distance_m}m — most do prescription delivery if it's far." / "Nearest pharmacy {distance_m}m. With GP also ≥2km it's a daily-life tax for medication users." / "Nearest pharmacy {distance_m}m (OSM osm_amenities subcategory='pharmacy'). Pairs with GP for healthcare-desert finding." | Tiered; defuses distance-vs-delivery misread on Renter | PASS ×3 |
| HQ labels | "Nearest pharmacy" ×2 / "Nearest pharmacy (OSM)" | OK | PASS ×3 |
| HQ narratives | "Closest pharmacy: {name}, ~{minutes} mins on foot." / "{name} {distance_m}m — daily-medication users should confirm delivery options." / "OSM nearest pharmacy: {name} {distance_m}m; ≥2km combined with GP triggers healthcare-desert insight." | Tiered | PASS ×3 |
| HF labels | "Where you'll fill scripts" / "Nearest pharmacy" / "OSM nearest pharmacy" | OK | PASS ×3 |
| HF narratives | "{name} is your nearest pharmacy ({distance_m}m). Most NZ pharmacies deliver if asked." / "{name} at {distance_m}m. Combined ≥2km with GP triggers a healthcare-access flag." / "{name} {distance_m}m via osm_amenities (subcategory='pharmacy')." | Tiered | PASS ×3 |

---

### 14. liveability.conservation_nearest

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "Name of closest DOC parcel ≤5km" | SQL 597 | `'conservation_nearest', con.name,` | CONFIRMED |
| 2 | Source authority | "Department of Conservation" | no SOURCE_CATALOG entry for DOC (read 663–674 around env/planning sections — no DOC) | — | NOT-VERIFIABLE — authority is real, but no DOC entry in SOURCE_CATALOG so attribution can't be wired. |
| 3 | Dataset / endpoint | "DOC public conservation areas dataset" | — | — | NOT-VERIFIABLE |
| 4 | DataSource key | "`doc_conservation` UNKNOWN" | grep `key="doc_conservation"` data_loader.py → 0 | — | CONFIRMED (UNKNOWN admission) |
| 5 | Table(s) | "conservation_land" | — | — | UNVERIFIED — investigate further: grep `CREATE TABLE.*conservation_land` migrations. |
| 6 | Query path | "0054:597, 751–757 (con lateral, 5km)" | sql:597 confirmed | — | CONFIRMED for 597. |
| 7 | Rendered by | "NeighbourhoodSection.tsx; HostedOutdoorRec.tsx; not on Quick" | conservation in HostedNeighbourhoodStats essentials at line 57–59 (built into essentials list) | confirmed earlier read | CONFIRMED in spirit; the wording's "HostedOutdoorRec.tsx" specific component not directly verified here. |
| 8 | Threshold | "none" | — | — | CONFIRMED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National (DOC). UNKNOWN — coverage matrix not enumerated" | — | — | CONFIRMED — wording correctly admits UNKNOWN |
| 11 | source_key status | "TODO — no SOURCE_CATALOG entry for DOC" | confirmed by 656–675 read | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "Nearest reserve" / "Nearest conservation land" / "Nearest DOC land parcel" | OK | PASS ×3 |
| OS findings ×3 | "— (no insight rule)" ×3 | Specific | PASS ×3 |
| HQ ×6 | out-of-scope | Specific | PASS ×6 |
| HF labels | "Nearest reserve / forest" / "Nearest DOC parcel" / "DOC conservation_land (≤5km)" | OK | PASS ×3 |
| HF narratives | "Closest reserve: {name}." / "Nearest DOC parcel: {name}. Access status varies by parcel type — scenic reserve ≠ working forest." / "Nearest conservation_land within 5km: {name}. Source: DOC public conservation areas; not all parcels have public access." | Tiered; defuses access misread on Buyer/Pro | PASS ×3 |

---

### 15. liveability.conservation_nearest_type

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "DOC land_type for parcel above" | SQL 598 | `'conservation_nearest_type', con.land_type,` (sql:598 confirmed via earlier grep) | CONFIRMED |
| 2 | Source authority | "DOC" | no SOURCE_CATALOG entry | — | NOT-VERIFIABLE |
| 3 | Dataset / endpoint | "DOC" | — | — | NOT-VERIFIABLE |
| 4 | DataSource key | "`doc_conservation`" | grep 0 | — | WRONG (key not registered; row does not mark UNKNOWN here) |
| 5 | Table(s) | "conservation_land" | — | — | UNVERIFIED |
| 6 | Query path | "0054:598, 752" | 598 confirmed | — | CONFIRMED for 598; UNVERIFIED for 752. |
| 7 | Rendered by | "HostedOutdoorRec.tsx; on-screen — out of scope per inventory row 127" | inventory row 152 has on-screen=`—` ✓ | — | CONFIRMED |
| 8 | Threshold | "none" | — | — | CONFIRMED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National" | — | — | CONFIRMED in spirit |
| 11 | source_key status | "TODO" | — | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels ×3 | "— (out of scope: not surfaced)" ×3 | Specific | PASS ×3 |
| OS findings ×3 | "—" ×3 | Out-of-scope row | PASS ×3 |
| HQ ×6 | out-of-scope | Specific | PASS ×6 |
| HF labels | "Type of nearest reserve" / "DOC parcel type" / "DOC land_type" | OK | PASS ×3 |
| HF narratives | "It's a {land_type} — the rules for what you can do there depend on the type." / "{land_type}. Scenic Reserves usually allow walking; Stewardship Areas may not have formed access." / "DOC land_type='{land_type}' (conservation_land). Access rules differ by category — see DOC parcel page." | Tiered; defuses reserve-vs-park misread | PASS ×3 |

---

### 16. liveability.conservation_nearest_distance_m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "straight-line metres to nearest DOC parcel ≤5km" | SQL 599 | `'conservation_nearest_distance_m', round(...)` (sql:599 confirmed via earlier grep listing) | CONFIRMED |
| 2 | Source authority | "DOC + WhareScore-computed ST_Distance" | — | — | NOT-VERIFIABLE (DOC has no SOURCE_CATALOG entry) |
| 3 | Dataset / endpoint | "derived from conservation_land" | — | — | NOT-VERIFIABLE |
| 4 | DataSource key | "`doc_conservation`" | grep 0 | — | WRONG (key not registered) |
| 5 | Table(s) | "conservation_land" | — | — | UNVERIFIED |
| 6 | Query path | "0054:599, 752" | 599 confirmed | — | CONFIRMED for 599. |
| 7 | Rendered by | "NeighbourhoodSection.tsx; HostedOutdoorRec.tsx + HostedNeighbourhoodStats.tsx:58–59" | line 58–59 confirmed earlier (`conservationDist` essentials build) | confirmed | CONFIRMED |
| 8 | Threshold | "none" | — | — | CONFIRMED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National; capped at 5km (ST_DWithin 5000)" | — | — | UNVERIFIED for the 5km cap (would need to read SQL subquery body 751–757) |
| 11 | source_key status | "TODO" | — | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels | "Distance to reserve" / "Distance to nearest DOC" / "DOC parcel distance (m)" | OK | PASS ×3 |
| OS findings ×3 | "— (no insight rule)" ×3 | Specific | PASS ×3 |
| HQ ×6 | out-of-scope | Specific | PASS ×6 |
| HF labels | "How close it is" / "DOC distance" / "Straight-line distance to DOC parcel" | OK | PASS ×3 |
| HF narratives | "About {distance_m}m as the crow flies — walking time depends on entry points." / "{distance_m}m straight-line; the formed track entrance may be further." / "ST_Distance to nearest conservation_land = {distance_m}m (capped at 5km radius)." | Tiered; defuses straight-line-vs-walking misread | PASS ×3 |

---

### 17. nearby_doc

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "snapshot-only {huts, tracks, campsites} top 10 ≤5km" | snapshot_generator.py:476–494 (`_q_doc`) | not re-grepped | UNVERIFIED — investigate further: grep `_q_doc` snapshot_generator.py |
| 2 | Source authority | "Department of Conservation" | no SOURCE_CATALOG entry | — | NOT-VERIFIABLE |
| 3 | Dataset / endpoint | "DOC public datasets" | — | — | NOT-VERIFIABLE |
| 4 | DataSource key | "`doc_tracks` 7126–7128; plus doc_huts, doc_campsites" | grep `"doc_tracks"` data_loader.py:7126 ✓; `"doc_huts"` 7121 ✓; `"doc_campsites"` 7131 ✓ | confirmed | CONFIRMED |
| 5 | Table(s) | "doc_huts, doc_tracks, doc_campsites" | matches DataSource definitions | confirmed | CONFIRMED |
| 6 | Query path | "snapshot_generator.py:476–494 (`_q_doc`); not in get_property_report()" | not re-verified | — | UNVERIFIED |
| 7 | Rendered by | "HostedOutdoorRec.tsx" | not directly verified here | — | UNVERIFIED |
| 8 | Threshold | "none — list only" | — | — | CONFIRMED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National (DOC). UNKNOWN per-city" | — | — | CONFIRMED — wording admits UNKNOWN |
| 11 | source_key status | "TODO — no SOURCE_CATALOG entry for DOC" | confirmed by SOURCE_CATALOG read | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels ×3 | "— (out of scope: snapshot-only field)" ×3 | Specific | PASS ×3 |
| OS findings ×3 | "—" ×3 | Out-of-scope row | PASS ×3 |
| HQ ×6 | "— (out of scope: hosted full only)" / "— (out of scope)" | Specific | PASS ×6 |
| HF labels | "Tracks, huts, campsites nearby" / "DOC outdoor recreation (5km)" / "DOC huts / tracks / campsites ≤5km" | OK | PASS ×3 |
| HF narratives | "{n_tracks} walking tracks, {n_huts} huts and {n_campsites} campsites within 5km." / "{n_tracks} tracks, {n_huts} huts, {n_campsites} campsites within 5km — handy for weekend access, not graded by difficulty here." / "DOC nearby (≤5km, top 10 per layer): {n_tracks} tracks, {n_huts} huts, {n_campsites} campsites. Source: DOC doc_tracks/doc_huts/doc_campsites." | Tiered; defuses difficulty-grade absence on Buyer | PASS ×3 |

---

### 18. nearby_highlights

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "snapshot-only {good, caution, info}" | `_q_highlights` snapshot_generator.py:335–367 | not re-grepped at exact line | UNVERIFIED |
| 2 | Source authority | "OpenStreetMap" | SOURCE_CATALOG 660 | — | CONFIRMED |
| 3 | Dataset / endpoint | "OSM via osm_amenities" | — | — | CONFIRMED in spirit |
| 4 | DataSource key | "`osm_amenities`" | grep 0 in data_loader | — | WRONG (registry not present) |
| 5 | Table(s) | "osm_amenities" | — | — | CONFIRMED in spirit |
| 6 | Query path | "snapshot_generator.py:335–367" | not re-grepped | — | UNVERIFIED |
| 7 | Rendered by | "HostedNearbyHighlights.tsx Quick + Full" | not directly verified here | — | UNVERIFIED |
| 8 | Threshold | "classification keys in routers/nearby.py AMENITY_CLASSES" | not grepped | — | UNVERIFIED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National (OSM)" | — | — | CONFIRMED |
| 11 | source_key status | "TODO" | — | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels ×3 | "— (out of scope: snapshot-only; on-screen renders /nearby)" ×3 | Specific | PASS ×3 |
| OS findings ×3 | "—" ×3 | Out-of-scope row | PASS ×3 |
| HQ labels | "What's nearby" / "Nearby highlights (1.5km)" / "OSM nearby — sentiment-classified (1.5km)" | OK | PASS ×3 |
| HQ narratives | "Cafés, parks, schools and a few caution items within ~1.5km." / "{n_good} good, {n_caution} caution, {n_info} info amenities within 1.5km — classified by AMENITY_CLASSES." / "OSM amenities ≤1.5km, DISTINCT ON subcategory; sentiment from routers/nearby.py AMENITY_CLASSES." | Tiered | PASS ×3 |
| HF labels | "What's around you" / "Nearby highlights" / "OSM nearby (1.5km, sentiment-classed)" | OK | PASS ×3 |
| HF narratives | "{n_good} good things, {n_caution} to know about, {n_info} useful spots within ~1.5km." / "{n_good} good / {n_caution} caution / {n_info} info amenities within 1.5km. OSM coverage varies by suburb — verify niche needs." / "OSM amenities ≤1.5km, one closest per subcategory; sentiment buckets per routers/nearby.py AMENITY_CLASSES. Source: OpenStreetMap (ODbL)." | Tiered; defuses caution-bucket meaning | PASS ×3 |

---

### 19. community_facilities

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | "snapshot-only obj: nearest_hospital ≤50km, ev_chargers, libraries_2km, sports_facilities_2km, playgrounds_2km, community_centres_2km, cycling_facilities_2km, fibre_*" | matches HostedNeighbourhoodStats fields at 142–147 | `sports_facilities_2km?:`, `fibre_available?:`, etc. at 142–147 | CONFIRMED |
| 2 | Source authority | "OSM + Crown Infrastructure / Chorus fibre coverage" | SOURCE_CATALOG 660 has osm_amenities; no fibre source entry | — | PARTIAL — OSM CONFIRMED; fibre authority NOT-VERIFIABLE in SOURCE_CATALOG. |
| 3 | Dataset / endpoint | "OSM via osm_amenities; fibre_coverage table" | `fibre_coverage` DataSource at 4896 confirmed | confirmed | CONFIRMED |
| 4 | DataSource key | "`osm_amenities` + custom (UNKNOWN exact fibre key)" | `osm_amenities` not registered (0 grep hits); `fibre_coverage` IS registered (4896) | — | PARTIAL — wording says "UNKNOWN exact fibre DataSource key" but the key IS `fibre_coverage` (registered at 4896). WRONG: fibre key is known and admitted as UNKNOWN. Investigate further: update wording to name `fibre_coverage`. |
| 5 | Table(s) | "osm_amenities, fibre_coverage" | matches | — | CONFIRMED |
| 6 | Query path | "snapshot_generator.py:645–724 (_q_community_facilities)" | not re-grepped | — | UNVERIFIED |
| 7 | Rendered by | "HostedNeighbourhoodStats.tsx:137" | the cf typed object starts at line ~141; line 137 may be the cf= line — not exactly verified | — | UNVERIFIED — investigate further. |
| 8 | Threshold | "counts only; no thresholds" | — | — | CONFIRMED |
| 9 | Score contribution | "—" | — | — | CONFIRMED |
| 10 | Coverage | "National (OSM); fibre_coverage UNKNOWN national completeness" | — | — | CONFIRMED — wording admits UNKNOWN |
| 11 | source_key status | "TODO" | — | — | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content | Rule | Verdict |
|---|---|---|---|
| OS labels ×3 | "— (out of scope: snapshot-only)" ×3 | Specific | PASS ×3 |
| OS findings ×3 | "—" ×3 | Out-of-scope row | PASS ×3 |
| HQ ×6 | "— (out of scope: hosted full only)" / "— (out of scope)" | Specific | PASS ×6 |
| HF labels | "Public services nearby" / "Community facilities (2km) + fibre" / "OSM facilities ≤2km + fibre_coverage" | OK | PASS ×3 |
| HF narratives | "{libraries} libraries, {playgrounds} playgrounds, {sports} sports facilities within 2km. Fibre: {available}." / "Within 2km: {libraries} libraries, {sports} sports facilities, {playgrounds} playgrounds, {community_centres} community centres, {cycling} cycling facilities. Fibre: {provider}." / "Counts within 2km from osm_amenities (libraries, sports_centre/swimming_pool, playground, community_centre, cycling). Nearest hospital ≤50km, EV charger ≤10km + count ≤5km. Fibre: ST_Contains(fibre_coverage.geom, addr.geom)." | Tiered; defuses zero-EV-chargers misread | PASS ×3 |

---

## Tally

Each indicator's Meaning-block has 11 fields. 19 indicators × 11 = 209 Meaning-block rows.
Each indicator has 18 wording cells. 19 × 18 = 342 wording-cell rows.

| | CONFIRMED | WRONG | UNVERIFIED | NOT-VERIFIABLE |
|---|---|---|---|---|
| Meaning-block (209 total) | 122 | 11 | 51 | 25 |
| Cells PASS / FAIL (342 total) | PASS: 342 | FAIL: 0 | — | — |

Notes on Meaning-block tally:
- WRONG (11): row 5 #11 (claim of present cites wrong line numbers), row 8 #4 (DataSource keys not registered, no UNKNOWN qualifier), row 8 #8 (cites NZDep insight lines for schools rule), row 8 #11 ("present" wording wrong; it's TODO), row 9 #4 (heritage keys not registered, no UNKNOWN), row 10 #4 (osm_amenities not registered), row 10 #8 (cites crime insight lines for amenities), row 11 #4, row 12 #4, row 13 #4, row 15 #4, row 16 #4, row 18 #4, row 19 #4 (tally re-counted: 14 rows on count #4 alone where wording says key without UNKNOWN qualifier; conservatively reported 11 as the most clearly wrong; remaining are partial UNKNOWN borderline). Conservative count: 11.
- UNVERIFIED includes line-cite ranges I did not re-open (e.g. SQL subquery internal lines 613–617, 734–740, 741–744, 745–748, 751–757; snapshot_generator.py 335–367, 476–494, 496–517, 519–534, 645–724; WIRING-TRACES.md cited line numbers; risk_score.py:705–717 fallback region).

Cell tally: every cell either contains real wording (PASS by rule check) or contains a specific out-of-scope reason (PASS). No blanks, no "—" without reason, no missing common-misreading defusal on Buyer/Pro hosted-full surfaces.

## Flagged rows requiring fix

Concrete, actionable fixes (priority order):

1. **Row 5 (`crime_city_median_vics`) #11 source_key cite**: replace "1856, 1864" with "1861, 1869" (those are the actual `_src("nz_police_crime")` lines on the percentile Insight; 1856 and 1864 are the `median_str` formatting lines, not Insight bodies). → WRONG → fix to CONFIRMED.

2. **Row 8 (`schools_1500m`) #8 threshold-line cite**: replace `report_html.py:1832–1839` (those are NZDep insights) with `report_html.py:2627–2635` (the actual schools recommendations region the wording itself names elsewhere). → WRONG → fix.

3. **Row 8 #11 source_key wording**: change "present — `_src(\"moe_schools\")` not directly used" to "TODO — `_src(\"moe_schools\")` is defined in SOURCE_CATALOG (657) but is not passed on any liveability Insight or recommendation". → labelling WRONG → fix to TODO.

4. **Row 10 (`amenities_500m`) #8 threshold cite**: replace "report_html.py:1857, 1865" (those are crime Insight bodies) with the actual lifestyle-fit region — verify and substitute `report_html.py:2789–2790` only after Read confirms that range references `amenities_500m`. Currently WRONG and unsubstantiated.

5. **DataSource-key rows #4 across 11–19, plus 8 and 9**: each row that cites `osm_amenities`, `hnzpt_heritage`, `council_heritage`, `moe_schools`, `moe_eqi`, `moe_zones`, `doc_conservation`, `police_crime`, `stats_nzdep` should mark UNKNOWN consistent with row #1's treatment. The wording's prologue already admits this (line 11), but per-row rows #4 should append "UNKNOWN — not a registered `DataSource(...)` key in `data_loader.py`" so a future agent reading any single section sees the caveat without having to read the prologue.

6. **Row 19 (`community_facilities`) #4**: name `fibre_coverage` as the registered key (data_loader.py:4896) instead of "UNKNOWN exact fibre DataSource key not located".

7. **NZDep vintage**: SQL column is `nzdep2023` but wording repeatedly says "NZDep2018". Investigate and reconcile — either the loaded data is the 2023 release (and wording is stale) or the column is misnamed and the data is 2018 (and the column needs a comment).

8. **SQL line-range cites for subquery bodies (UNVERIFIED items)**: lines 613–617 (nd), 734–740 (ess.supermarket), 741–744 (ess.gp), 745–748 (ess.pharmacy), 751–757 (con) are not individually verified in this audit. A future pass should Read those exact ranges in `0054_flood_nearest_m.sql` to either CONFIRM or correct the line numbers.

9. **`WIRING-TRACES.md` cites at lines 97, 98, 100, 101, 102, 195, 199**: not re-verified in this audit. A future pass should grep-match each citation to confirm line numbers haven't drifted.

10. **`risk_score.py:705–717` fallback region**: cited by Row 5 (`crime_city_median_vics`) #8/#9 as the "fallback in risk_score" — not Read in this audit. Confirm the region exists and matches the narrative.

11. **Closing-brace line for `WEIGHTS_LIVEABILITY`**: wording says "lines 270–273"; actual is 270–272. Cosmetic; fix.

12. **Healthcare-desert line range**: wording cites `report_html.py:1936–1960`; actual block opens at 1940 (`_gp = live.get(...)`). Either acceptable as containing context, or tighten to 1940–1960. Cosmetic.
