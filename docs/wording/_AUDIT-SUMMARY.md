# Audit Summary: INDICATOR-WORDING-*.md

Roll-up of the 8 per-category audits. See each `_AUDIT-{category}.md` for per-indicator evidence.

## Inventory header vs actual row count

The inventory summary table at `_INVENTORY.md:23-33` is wrong on 7 of 8 categories. Re-counted literally under each `## <Category>` heading:

| Category | Header claims | Actual rows | Match? |
|---|---|---|---|
| Hazards | 78 | 77 | NO (-1) |
| Liveability | 20 | 19 (18 pure + cross-tagged `school_zones`) | NO (-1) |
| Environment | 24 | 23 | NO (-1) |
| Planning | 33 | 33 | YES |
| Property | 26 | 25 | NO (-1) |
| Market | 26 | 25 | NO (-1) |
| Transport | 20 | 19 (18 pure + cross-tagged `school_zones`) | NO (-1) |
| Demographics | 45 | 44 | NO (-1) |
| **Total** | **272** | **265** (or 263 if `school_zones` is counted once) | **NO** |

`school_zones` is cross-tagged Transport/Liveability and counted in both columns; the wording files defer it to Liveability.

Action: fix `_INVENTORY.md:23-33` summary cells and the "Sum = 272 rows" line at `_INVENTORY.md:40`.

## Cross-category tally (absolute counts)

Meaning-block claims (each indicator × 11 fields):

| Category | Indicators | Rows | Confirmed | Wrong | Unverified | Not-verifiable |
|---|---|---|---|---|---|---|
| Transport | 18 | 200 | 158 | 11 | 8 | 23 |
| Hazards | 77 | 847 | ~437 | ~62 | ~234 | ~114 |
| Liveability | 19 | 209 | 122 | 11 | 51 | 25 |
| Environment | 23 | 253 | 161 | 8 | 39 | 45 |
| Planning | 33 | 363 | 287 | 2 | 41 | 33 |
| Property | 25 | 275 | ~150 | ~30 | ~95 | 0 |
| Market | 25 | 275 | ~177 | ~14 | ~26 | ~58 |
| Demographics | 44 | 495 | ~440 | 15 | ~30 | 5 |
| **Total** | **264** | **2917** | **~1932** | **~153** | **~524** | **~303** |

Wording cells (each indicator × 18 cells):

| Category | Cells | PASS | FAIL |
|---|---|---|---|
| Transport | 324 | 324 | 0 |
| Hazards | 1386 | 1386 | 0 |
| Liveability | 342 | 342 | 0 |
| Environment | 414 | 414 | 0 |
| Planning | 594 | 592 | 2 |
| Property | 450 | 450 | 0 |
| Market | 450 | 450 | 0 |
| Demographics | 810 (audit used 45-indicator denominator; should be 44 × 18 = 792) | 810 | 0 |
| **Total** | **4770** | **4768** | **2** |

## Meta-issues with the audit pass itself

1. **Approximate counts.** Hazards, Property, Market, Demographics report tilde-prefixed totals ("~437", "~30") rather than exact integers. The pilot (Transport) and Liveability/Planning/Environment reported exact counts. Re-counting the WRONG/UNVERIFIED rows for the four sloppy categories would give exact totals.
2. **Demographics cell denominator off.** Used 45 × 18 = 810 instead of 44 × 18 = 792. Either an extra indicator was reviewed (potential extras-in-wording-not-inventory miss) or the multiplier was applied without recounting. Investigate.
3. **Uniform 0 FAIL across cells (except 2 in Planning).** 4768/4770 cells passed the rule check. The rule check is mechanical (≤60-char labels, single-sentence findings, NZ English, specific out-of-scope reasons, common-misreading defusal in Buyer/Pro Hosted Full). Either the wording is genuinely uniformly clean, or the rules are too coarse to surface real editorial issues. A separate editorial-quality pass with stricter rules (register match, scope-creep, factual specificity) would be a different audit.

## Top 25 flagged rows by severity (WRONG > UNVERIFIED-blocking-fix)

### Phantom / fabricated data (highest severity)

1. **`demographics.crime_trend`** — DataSource key `police_crime_history`, table `mv_crime_density_history`, and `HostedNeighbourhoodStats.tsx` rendering all FABRICATED. 0 grep hits anywhere outside the wording file and inventory. The field appears in snapshot but is unrendered (dead-data candidate). → Investigate: is `crime_trend` consumed anywhere, or should it be removed from inventory?

2. **All 25 Property `DataSource key(s)` fields are broken.** `linz_addresses`, `linz_buildings`, `linz_titles`, `sa2_boundaries`, `council_valuations`, plus the "25 live rates DataSources" — none are real `DataSource(...)` registrations in `data_loader.py`. They are table/dataset shorthand. → Fix: replace with the real per-loader keys, or mark all 25 with the `(loader name UNKNOWN)` qualifier the wording uses elsewhere.

3. **Hazards: ~25 indicators cite fabricated DataSource keys.** `flood_zones`, `tsunami_zones`, `liquefaction_zones`, `slope_failure_zones`, `wcc_floodplains`, `wcc_tsunami`, `bop_tsunami`, `tasman_tsunami`, `gwrc_flood_1pct`, `gwrc_erosion_prone`, `auckland_ascie`, `tauranga_coastal`, `mfe_coastal_inundation`, `hbrc_inundation`, `linz_coastal_dem`, `branz_wind_zones`, `scion_wildfire`, `niwa_coastal_erosion`, `airport_noise_overlay`, `linz_8m_dem`, `searise_points`, `open_meteo_history`, `wcc_overland_flow`, `ac_overland_flow`, `wcc_geotech`, `ac_geotech` — all 0 grep hits. → Same fix as #2.

4. **Hazards: `mbie_epb` vs `epb_mbie` reversed.** Real DataSource key is `epb_mbie` at `data_loader.py:4949`; the SOURCE_CATALOG `_src` entry is keyed `mbie_epb`. The wording file uses `mbie_epb` for the DataSource field. → Fix: separate "DataSource key" from "source_key in SOURCE_CATALOG"; cite each correctly.

### SOURCE_CATALOG gaps (blocks attribution wiring)

5. **`council_valuations` missing from SOURCE_CATALOG** at `report_html.py:637-676`. Blocks attribution for 11 Property indicators (capital_value, land_value, improvements_value, cv_*, floor_area_sqm, rates_data, multi_unit). → Fix: add a SOURCE_CATALOG entry; decide on canonical authority string for council valuations.

6. **0 of 25 Market indicators carry a `source_key`.** `tenancy_bonds`, `reinz_hpi_national`, `reinz_hpi_ta`, `rbnz_housing` all absent from both `data_loader.py` and SOURCE_CATALOG. → Fix: register the source_keys + decide whether the underlying datasets need DataSource registrations.

7. **DOC entirely missing from SOURCE_CATALOG** (Liveability) — blocks `conservation_*` and `nearby_doc` attribution despite `doc_huts`, `doc_tracks`, `doc_campsites` being registered at `data_loader.py:7121/7126/7131`.

### Wrong line refs (non-fabricated but mislead readers)

8. **Demographics: every `data_loader.py:NNNN` cite is stale by 150-500 lines.** `3923→4143`, `3974→4194`, `4028→4248`, `4153→4373`, `4575→4795`, `4651→4871`, `4671→4891`. The "Changes in this pass" header asserts these were re-grep'd; that assertion is FALSE. → Fix: re-grep all keys, replace cites; remove the false attestation from the file header.

9. **Demographics self-reference `Lines 1116-1122` is stale** — actual range is 1122-1131.

10. **Liveability: `report_html.py` line refs swapped between Insights.** Crime Insight bodies (1856, 1864, 1865, 1857) are cited for schools/amenities thresholds. Schools recommendations actually live at 2627-2635. → Fix: re-grep each Insight by content, replace line cites.

11. **Liveability: `_src("moe_schools")` claim "present" — 0 grep hits.** The real status is TODO. → Fix: change "present" → "TODO" for `schools_1500m`.

12. **Liveability: `fibre_coverage` flagged UNKNOWN but registered at `data_loader.py:4896`.** → Fix: replace UNKNOWN with the real key.

13. **Liveability: NZDep vintage mismatch.** SQL uses `nd.nzdep2023` (line 573); wording repeatedly says "NZDep2018". → Investigate: which is the underlying loader's source vintage; reconcile both.

14. **Environment: 6 indicators have stale "UNKNOWN frontend" / "HostedClimate.tsx" Rendered-by.** Actual surface is `HostedNeighbourhoodStats.tsx:69-134`. Affected: `air_site_name` (80), `air_pm10_trend` (81), `air_pm25_trend` (82), `water_ammonia_band` (89), `water_drp_band` (88). The wording file's own conflict list at line 698 acknowledges this but per-indicator blocks weren't updated. → Fix: rewrite Rendered-by per indicator. After fix, re-review the HF narratives — they were authored on a false rendering premise.

15. **Environment: `air_pm25_trend` score-contribution wrong.** Claims fallback to `air_pm10_trend` for `air_quality`; `risk_score.py:694` only reads `air_pm10_trend`. pm25 is finding-text-only. → Fix: rewrite Score field.

16. **Environment: `climate_precip_change_pct` threshold marked UNKNOWN.** `report_html.py:2220-2231` has explicit bidirectional thresholds (≥+5% rising, ≤-5% drying). Wording HF/OS narratives only show the rising branch. → Fix: document both branches; expand narratives.

17. **Environment: `water_site_name` loader marked UNKNOWN.** Visible at `scripts/load_tier3_datasets.py:168` (CREATE) and 194 (INSERT). → Fix: cite the script.

18. **Planning: `heritage_nz_register` cited as DataSource key.** It's the inventory's row label, not a real key. → Fix: replace with `heritage_nz_listed_places` or whatever the real key is, or mark UNKNOWN.

19. **Planning: `contaminated_land` cited as DataSource key.** It's the table name. Real per-council keys (e.g. `gwrc_contaminated_land`) are not enumerated. → Fix: enumerate the per-council keys.

20. **Planning: document-level claim "no Planning Insights pass source=" is FALSE.** `mbie_epb`, `council_slur` are attached at `report_html.py:841, 879, 1789, 1797, 1805`. → Fix: remove or qualify the document-level claim; attribute the existing source_keys per-indicator.

21. **Planning: `whangarei_zones_residential` cited; actual key is `whangarei_residential`.**

22. **Property: `address.unit_type` threshold logic conflates `unit_type` and `unit_value` columns.** The CV resolution joins `addr.unit_value`, not `unit_type`. → Fix: separate the two columns in the wording.

23. **Property: `building_use` render precedence reversed.** Wording says HostedQuickReport.tsx:81 falls back to `title_type` when `building_use === 'Unknown'`. Actual code prefers `titleType` first, then `buildingUse`. → Fix: invert the rule description.

24. **Market: `rental_overview[].bonds` "depth_fraction = bonds/200 cap" likely wrong.** `risk_score.py:789` uses `/500`. → Investigate: read `risk_score.py:764-789` to confirm whether `/200` appears anywhere; if not, fix to `/500`.

25. **Market: `mv_rental_trends`, `bonds_detailed`, `rbnz_housing` CREATEs not in `backend/migrations/`.** Wording cites `sql/06-materialized-views.sql:92,110,…`. → Investigate: locate the canonical CREATE files; if out-of-tree, document the path.

### Hazards-specific WRONG line refs (subset)

26. `hazards.flood` Rendered-by `RiskHazardsSection.tsx:55` — line 55 is the active-fault card.
27. `hazards.flood` Rendered-by `HostedHazardAdvice.tsx:992` — file is exactly 992 lines (EOF, not a render target).
28. `hazards.coastal_exposure` Rendered-by `report_html.py:4363` — line 4363 reads `coastal_erosion`, not `coastal_exposure`.
29. `hazards.ground_shaking_zone` Rendered-by `report_html.py:1212` — 1212 reads `_severity`.

### Transport-specific WRONG (subset)

30. `crashes_300m_total` claim that `transformReport()` renames to `crash_total` — no such alias exists in `transformReport.ts`.
31. `crashes_300m_fatal` line refs `:1873`, `:1907`, `:1915` — 1873 is variable assignment; 1907/1915 are transit-access Insights.
32. `cbd_distance_m` migration filename `0023_get_transit_data.sql` — actual `0023_universal_transit.sql`.
33. `cbd_distance_m` "Coverage UNKNOWN" — `WIRING-TRACES.md:201` shows `cbd_distance_m: Y` for all 14 cities.

### Cell FAILs (Planning only)

34. `planning.contaminated_listed` HF Pro narrative — 3 sentences, exceeds the ≤2-sentence cap.
35. `planning.epb_listed` HF Pro narrative — 3 sentences, exceeds the ≤2 cap.

## Cross-cutting structural issues

A. **The wording files conflate four distinct identifiers** that should each have their own field:
   - `DataSource(...)` registration key (in `data_loader.py`)
   - SOURCE_CATALOG `_src(...)` key (in `report_html.py`)
   - PostgreSQL table name (in migrations)
   - Inventory row label (a human-readable category)
   
   Most "DataSource key" verdicts of WRONG across all 8 categories trace to citing one of the other three as the DataSource key. **Recommend**: split the Meaning block's "DataSource key" field into "Loader registration key" + "SOURCE_CATALOG key" + "Underlying table". Each must be greppable in its respective file.

B. **The "Changes in this pass" headers in each wording file are not trustworthy.** Demographics's claim "every line re-grep'd" is provably false; Planning's "no Planning Insights have source=" is provably false. Liveability's `moe_schools` "present" is provably false. → Recommend: drop the "Changes in this pass" sections; let `git log` and audit files carry that history.

C. **Inventory-summary header is the only file with a counting bug**, but it cascades — every wording file's coverage section quotes the bad number. → Fix `_INVENTORY.md:23-33` first; re-derive other files from it.

D. **No category surfaced a single FAIL on the "common misreading defusal" cell-pair check.** This rule is asserting that at least one of Buyer Hosted Full / Pro Hosted Full carries language addressing the indicator's "Common misreading". Either the wording uniformly delivers this, or the rule check was applied loosely. Spot-check a few indicators by hand to confirm.

## Per-category audit files

- `_AUDIT-transport.md`
- `_AUDIT-hazards.md`
- `_AUDIT-liveability.md`
- `_AUDIT-environment.md`
- `_AUDIT-planning.md`
- `_AUDIT-property.md`
- `_AUDIT-market.md`
- `_AUDIT-demographics.md`

## Recommended next pass

1. Fix `_INVENTORY.md:23-33` summary counts.
2. Investigate `crime_trend` (Demographics): is it consumed anywhere? If not, remove from inventory.
3. Add `council_valuations`, Market keys, DOC to SOURCE_CATALOG.
4. Replace fabricated DataSource keys across Property (25), Hazards (~25), Liveability (5), Planning (~3), Market (~4) — or mark UNKNOWN with the loader-name-unknown qualifier the wording uses elsewhere.
5. Re-grep all `data_loader.py` line refs in Demographics; remove the false "Changes in this pass" attestation.
6. Re-grep all `report_html.py` line refs in Liveability (Insight body misattributions).
7. Update Environment Rendered-by for the 6 indicators (HostedClimate.tsx → HostedNeighbourhoodStats.tsx); re-review their HF narratives.
8. Reconcile NZDep2023 vs NZDep2018 vintage mismatch (Liveability).
9. Trim 2 Planning HF Pro narratives to ≤2 sentences.
10. Re-count Hazards / Property / Market / Demographics tally exactly; replace the approximate `~` counts in their audit files.
