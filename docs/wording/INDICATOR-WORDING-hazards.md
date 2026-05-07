# Indicator Wording, Hazards

Source matrix for every Hazards indicator listed in `_INVENTORY.md` (rows 54–130, 77 indicators; the inventory's "Summary" cell mis-reports this as 78, but the actual row count is 77 by `diff` of the row labels). One Meaning block + one Wording table per indicator.

## Changes in this pass

- Re-derived the indicator list from `_INVENTORY.md § Hazards` (rows 54–130, 77 indicators), full coverage confirmed by `diff`-ing the dot-paths against this file; no missing or stray indicators.
- Verified all `migrations/0054_flood_nearest_m.sql:NNN` query-path refs by re-grep against the current source, line numbers in 118–195 range all confirmed accurate.
- Verified actual `report_html.py` `_src(...)` source_key wiring by grepping `source_key|_src\(`, only six hazard-relevant keys are wired today: `council_flood`, `council_tsunami`, `council_liquefaction`, `geonet_earthquakes`, `mbie_epb`, `gns_landslides`. All other indicators correctly listed as `TODO` or `N/A` source_key.
- Updated stale `risk_score.py:NNN` line refs to current source (verified by re-grep of indicator assignments at lines 245–690).
- Fixed `coastal.tier` and `coastal.score_impact.delta` query paths to `property.py:333 _overlay_coastal_data` + `services/coastal_timeline.py build_coastal_exposure`.

### Hazards audit pass (2026-05-02)

Verifications run against `data_loader.py`, `0054_flood_nearest_m.sql`, `report_html.py`, `risk_score.py`. Fixes applied:

- **DataSource key fabrications corrected.** The previous pass routinely cited DataSource keys that do not exist in `data_loader.py`. Each was replaced with either the real registered key (verified by grep) or `UNKNOWN, <reason>` where no candidate could be found. Affected indicators (key → fix):
  - `flood_zones`, `tsunami_zones`, `liquefaction_zones`, `slope_failure_zones`, `airport_noise_overlay`, these are target tables, not DataSource keys. Replaced with the constituent loaders (e.g. `auckland_flood`, `gwrc_tsunami`, `auckland_liquefaction`, `auckland_aircraft_noise`) where verifiable, or marked UNKNOWN.
  - `wcc_floodplains`, `wcc_tsunami` → real registered key is `wcc_hazards` (4929).
  - `gwrc_flood_1pct` → real key is `gwrc_flood_extents` (4984).
  - `bop_tsunami`, `tasman_tsunami` → real keys are `bop_tsunami_evac` (6691), `nelson_tasman_tsunami` (8187).
  - `auckland_ascie`, `tauranga_coastal` → real keys are `auckland_coastal_erosion` (5104), `tauranga_coastal_erosion` (5562).
  - `linz_coastal_dem` → real key is `coastal_elevation` (4979, GWRC).
  - `mfe_coastal_inundation`, `hbrc_inundation` → real key is `coastal_inundation` (5004, WCC).
  - `gwrc_erosion_prone` → real key is `erosion_prone_land` (5014).
  - `wcc_overland_flow`, `ac_overland_flow` → only `auckland_overland_flow` (5062) is registered.
  - `wcc_geotech`, `ac_geotech` → only `auckland_geotech` (5119) is registered.
  - `branz_wind_zones`, `scion_wildfire`, `niwa_coastal_erosion`, `linz_8m_dem`, `searise_points`, `open_meteo_history`, `geonet_earthquakes` → no matching DataSource registration found. Marked UNKNOWN.
- **`mbie_epb` vs `epb_mbie` separated.** The `_src(...)` source-catalog key in `report_html.py` is `mbie_epb` (kept as-is). The actual registered DataSource is `epb_mbie` at `data_loader.py:4949`, the wording file now distinguishes the two for `epb_count_300m` and `epb_nearest`.
- **Wrong line refs corrected.** `hazards.flood` Rendered-by line `RiskHazardsSection.tsx:55` was actually the active-fault card; replaced with a description of the indicator-card grid driver. `HostedHazardAdvice.tsx:992` was end-of-file; replaced with file-level reference. `hazards.coastal_exposure` Rendered-by `report_html.py:4363` actually reads `coastal_erosion`, not `coastal_exposure`, flagged as such with a note. `hazards.ground_shaking_zone` Rendered-by `report_html.py:1212` actually reads `ground_shaking_severity`, corrected to "no Insight rule keyed on this field" (source_key revised from TODO to N/A).
- **`hazards.slope_failure` Rendered-by `report_html.py:921`** actually fires on `landslide_in_area`, not `slope_failure`, added a note.
- **`hazards.council_tsunami_ranking` source_key claim** was "present" via tsunami rule, but the `_src("council_tsunami")` Insights at 778/785 fire on `tsunami_zone_class`, not on `council_tsunami_ranking`. Status revised to UNVERIFIED.
- **Items still UNVERIFIED in this pass** (would need additional verification): `lib/hazards.ts` helper function existence (`getFloodTier`, `floodLabel`, `liquefactionRating`, `isInTsunamiZone`, `hasHighCoastalErosionRisk`, `hasHighWildfireRisk`, etc.); WIRING-TRACES city-coverage cells; `CREATE TABLE` existence for ~15 tables referenced via SQL alias; secondary `report_html.py` line refs (302, 318, 353, 379, 380, 390, 406, 422, 452, 973, 977, 1124, 2240, 2581, 4312, 5037).
- **Wording cells unchanged.** Audit found 1386/1386 wording cells PASS (≤60-char labels, NZ English, single-sentence findings, specific out-of-scope reasons, misreading defusal in HF Buyer/Pro). No edits to wording cells in this pass.

### Editorial polish pass (this pass)

- **Persona reach corrections.** Renter cells on `hazards.council_coastal_erosion` and `hazards.coastal_erosion_exposure` (long-horizon SLR projection) reframed to `(out of scope: long-horizon projection)`, renters do not act on multi-decade erosion lines. Renter cell on `hazards.coastal_exposure` rewritten to focus on present-day storm tides instead of sea-level-rise framing.
- **One-sentence trims.** `hazards.flood`, `hazards.tsunami_zone_class`, `hazards.liquefaction`, `hazards.slope_failure`, `hazards.landslide_in_area`, `hazards.flood_nearest_m`, `hazards.coastal_elevation_cm`, `hazards.epb_count_300m` On-screen findings split into one short sentence with optional second-clause separated by full stop or semicolon. "Essential" replaced with "Get a geotech report" on `landslide_in_area` Buyer cell, calmer.
- **Phrase tightening.** Removed redundant openers ("This place is", "The section is only", "The property sits", "There've been"); compressed "ask the landlord whether storm runoff has ever reached the section" to "ask the landlord whether runoff has reached the section"; "Storm tides matter here" replaces "The sea has a real say here, storm surges and rising sea levels matter".
- **Severity tier review.** Re-checked all 77 tiers against the realism rules (Critical = decision-changing, Notable = visible within a year, Context = useful background, Background = technical). No tier reassignments required, the previous pass calibrated correctly.
- **Em-dash sweep verified.** `grep ','` returns 0 matches in the file.
- **Panic words verified.** `warning|caution|danger|alarming|catastrophic|deadly|!` only appears in legitimate domain contexts (warning time, fire danger, evacuation warning). No edits required.
- **Files NOT touched in this pass:** Meaning blocks (kept as-is), code, other category files, source line refs, severity tier counts.

### Wording polish + severity calibration pass (prior pass)

- **Removed every em-dash from wording cells.** All 462 table rows that previously used em-dashes as separators were rewritten. Em-dashes between clauses became commas; em-dashes after a noun phrase introducing a placeholder (e.g. `Liquefaction class, <rating>`) became commas; bare em-dash cells (the empty placeholder) became `(no rule)`; bare em-dash before `(out of scope: …)` was dropped, leaving just `(out of scope: …)`. Reason: per the tone rules, em-dash separators are out and explicit placeholder strings (`(no rule)`, `(out of scope: <reason>)`) are in.
- **Surface-tag cells re-formatted.** First-column cells like `On-screen, finding` / `Hosted Quick, narrative` now read as `On-screen finding` / `Hosted Quick narrative`. Reason: the previous form used em-dashes as label separators and was the dominant em-dash source in the file.
- **Tone-word substitutions.** `approximately` → `about`, `substantial` → `big`, `expenditure` → `cost`, `in the order of` → `roughly`, `catastrophic` → `severe`, `deadly` → `serious`, `alarming` → `notable`. Exclamation marks replaced with full stops. Reason: plain-NZ-English calibration; calm wording lands harder than alarm wording.
- **Added `User-care severity:` line to all 77 Meaning blocks.** Each indicator now carries `Critical / Notable / Context / Background` plus a one-sentence justification. Tier counts: 22 Critical, 34 Notable, 12 Context, 9 Background. The Critical-tier indicators that lack a finding rule today are listed below the audit table for the next code pass to address.
- **Audit table refreshed** with severity counts column.
- **Files NOT touched in this pass:** Meaning blocks (other than the new severity line), code, other category files, source line refs.

Conventions:
- Surfaces: On-screen (`PropertyReport.tsx` + `RiskHazardsSection.tsx`), Hosted Quick (`HostedQuickReport.tsx`, 8 sections), Hosted Full (`HostedReport.tsx` + `HostedHazardAdvice.tsx`).
- Personas: Renter / Buyer / Pro.
- `(no rule)` in a wording cell = legitimately not surfaced on that surface (no Insight rule fires there).
- `(out of scope: <why>)` = surface intentionally does not carry this datum.
- Findings relative to the SA2 baseline where applicable, never absolute.
- NZ English (organisation, neighbourhood, kerb, metres).
- No em-dashes in wording cells; commas, colons or parentheses do the work.
- User-care severity tiers (`Critical / Notable / Context / Background`) recorded on every Meaning block.

---

## hazards.flood (`hazards.flood`)
- What it measures: Whether the property sits inside a national-layer flood-zone polygon, and the polygon's label (e.g. "1% AEP", "1-in-100yr").
- Source authority: GWRC `flood_zones` national layer (sparse, conservative-only when set) plus regional council flood overlays.
- Dataset / endpoint: `flood_zones` national table populated by multiple loaders + `wcc_hazards` (WCC), `gwrc_flood_extents` (GWRC), `auckland_flood` (Auckland), plus other regional council flood loaders.
- DataSource key(s): `wcc_hazards` (4929), `gwrc_flood_extents` (4984), `auckland_flood` (5020), +regional. (`flood_zones` is the target table, NOT a DataSource key.)
- Table(s): `flood_zones`, `flood_hazard`, `flood_extent`.
- Query path: `get_property_report()` step in `migrations/0054_flood_nearest_m.sql:118`.
- Rendered by: `RiskHazardsSection.tsx` (rendered via the indicator-card grid driven by the `flood` indicator score); `HostedQuickReport.tsx:196` (HostedAtAGlance); `HostedHazardAdvice.tsx` (file is 992 lines, Hosted Full hazard advice block); `HostedReport.tsx:366`.
- Threshold / classification logic: `lib/hazards.ts` `getFloodTier()` (severe / moderate / low / nearby / none), `floodLabel()`, `isInFloodZone()`. String matching on "1%" / "100" in `report_html.py:751`.
- Score contribution: `flood` indicator, weight 0.14, `risk_score.py:435`.
- Coverage: All 22 cities in WIRING-TRACES § Council-specific hazard data show flood = Y; national `flood_zones` is sparse (mostly Wellington).
- Common misreading: "1-in-100-year" sounds like "once a century", it's actually ~26% chance over a 30-year mortgage.
- What it does NOT tell you: Floor level, drainage, freeboard, or whether the dwelling has been raised to consent.
- source_key status: present, `_src("council_flood")` at `report_html.py:757,764`.
- User-care severity: Critical, In a mapped flood zone, direct safety, insurance and property-value exposure.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | In a flood zone | Inside a 1% AEP flood zone | 1% AEP flood zone (council layer) |
| On-screen finding | In a mapped flood zone. Ask the landlord what happens in heavy rain. | In a 1% AEP flood zone. Request the LIM and confirm floor levels meet consent. | 1% AEP polygon hit. Verify floor level vs design flood level on consent file. |
| Hosted Quick label | Flood zone | Flood zone (1% AEP) | Flood zone, council layer |
| Hosted Quick narrative | Council maps put this address in a flood zone, so heavy rain matters here. | Inside a 1% AEP flood zone, roughly 1-in-4 chance of inundation over a 30-year hold. | Address intersects council flood polygon (1% AEP). Lender flood-cover loading likely. |
| Hosted Full label | Flood-zone exposure | Flood-zone exposure and insurance flag | Flood polygon hit (council) |
| Hosted Full narrative + tech | Council maps say this place gets flood water in big storms. Ask about past flooding and where water goes. | 1% annual chance of inundation, ~26% over 30 years. Banks may require flood cover, quote it before going unconditional. | 1% AEP intersect on `flood_zones` / regional council overlay (vintage per loader). Reconcile with floor-level survey and District Plan freeboard. |

---

## hazards.flood_extent_aep (`hazards.flood_extent_aep`)
- What it measures: Annual Exceedance Probability label of the regional council flood extent the property sits inside (e.g. "1%", "2%", "0.5%", "Flood Sensitive").
- Source authority: Regional councils (Auckland, Wellington, Christchurch, etc.).
- Dataset / endpoint: Council flood-hazard ArcGIS layers; AC `Flood_Prone_Areas` is 1% AEP, AC `Flood-Sensitive Areas` is a screening tag.
- DataSource key(s): `auckland_flood`, council flood loaders.
- Table(s): `flood_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:187` (`fh_council.aep`).
- Rendered by: `RiskHazardsSection.tsx` (HazardCards); `HostedHazardAdvice.tsx`; finding `report_html.py:1442`.
- Threshold / classification logic: `getFloodTier()`, `1%`/`0.23%` → severe, `2%` → moderate, "sensitive" → low (never severe).
- Score contribution: `flood` indicator refinement, `risk_score.py:545` (council fallback set at line 545–546). 1%→75, 2%→85, 0.5%→45, "sensitive"→30.
- Coverage: All 22 cities (council flood loaders run nationally).
- Common misreading: Treating "Flood-Sensitive Area" as a validated flood zone, it's a future-scenario screening layer.
- What it does NOT tell you: Depth, velocity, time-to-peak, or whether floor level clears the design flood level.
- source_key status: N/A (no Insight at line 1442 sets `source_key`; finding is generic).
- User-care severity: Critical, AEP labels the design flood event; 1% AEP triggers insurer pricing and council consent rules.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Mapped flood extent | Flood extent (1% AEP) | Flood extent, council AEP |
| On-screen finding | Council maps put this address in a flood-extent zone. | In a 1% AEP flood extent, roughly 1 in 100 each year, ~1 in 4 over 30 years. | 1% AEP council flood extent. Validate against floor-level survey and design flood level. |
| Hosted Quick label | (out of scope: Quick covers tier from `hazards.flood` only) | (out of scope: Quick uses tier label) | (out of scope: Quick uses tier label) |
| Hosted Quick narrative | (out of scope: Quick uses tier label) | (out of scope: Quick uses tier label) | (out of scope: Quick uses tier label) |
| Hosted Full label | Flood extent | Flood extent, AEP | Council AEP flood extent |
| Hosted Full narrative + tech | The address sits inside a flood extent the council has mapped. | Council maps the property inside a 1% AEP extent, that's the standard "design flood" in NZ. Confirm freeboard above design flood level. | Within `flood_hazard` polygon, AEP = `<value>`. Source: regional council ArcGIS loader; vintage per `data_source_health`. |

---

## hazards.flood_extent_label (`hazards.flood_extent_label`)
- What it measures: Council's free-text label for the flood extent polygon (e.g. "Floodway", "Ponding area").
- Source authority: Regional councils.
- Dataset / endpoint: Council flood ArcGIS layers.
- DataSource key(s): Council flood loaders.
- Table(s): `flood_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:188` (`fh_council.label`).
- Rendered by: `HostedHazardAdvice.tsx`; finding text `report_html.py:1443`.
- Threshold / classification logic: Used in `lib/hazards.ts` `floodLabel()` preference order; presence promotes tier to "moderate" in `getFloodTier()`.
- Score contribution:, (label only, not scored).
- Coverage: All cities with council flood loaders.
- Common misreading: "Ponding area" sounds benign, it still means standing water in heavy rain.
- What it does NOT tell you: Depth, frequency, or AEP.
- source_key status: N/A.
- User-care severity: Context, Free-text label clarifies the flood mechanism but is not decision-changing on its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | (out of scope: free-text label only) | (out of scope: free-text) | (out of scope: free-text) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Flood extent type | Flood extent type | Council flood-extent label |
| Hosted Full narrative + tech | The council calls this a "<label>" area, water collects or moves through here in storms. | Mapped as "<label>" by council, affects how water behaves on site (overland vs ponding vs floodway). | Council label `<label>` on `flood_hazard` row. Cross-reference with overland flow path layer for hydraulic context. |

---

## hazards.flood_nearest_m (`hazards.flood_nearest_m`)
- What it measures: Distance in metres to the nearest flood polygon across `flood_zones`, `flood_hazard`, `flood_extent`. NULL when nothing is within 500m. 0 when inside a polygon.
- Source authority: Aggregate of all flood loaders (national + council).
- Dataset / endpoint: PostGIS `ST_Distance` over the three flood tables, capped 500m.
- DataSource key(s): UNKNOWN, `flood_zones` is a target table, not a DataSource. Aggregated across many council flood loaders (`auckland_flood`, `gwrc_flood_extents`, `wcc_hazards`, +regional).
- Table(s): `flood_zones`, `flood_hazard`, `flood_extent`.
- Query path: `migrations/0054_flood_nearest_m.sql:192` (`flood_near.dist_m`).
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`. Drives the "nearby" tier in `getFloodTier()` and `floodProximityM()`.
- Threshold / classification logic: `lib/hazards.ts` `FLOOD_PROXIMITY_THRESHOLD_M = 100`; `isNearFloodZone()` true when 0 < dist ≤ 100.
- Score contribution:, (drives tier, not a separate indicator).
- Coverage: All cities (derived from union of flood tables).
- Common misreading: "200m away" feels safe, but a flood zone boundary is an imprecise mapped line; runoff and overland flow may still reach the property.
- What it does NOT tell you: Direction, elevation difference, or whether intervening land actually blocks water.
- source_key status: N/A.
- User-care severity: Notable, Near-zone distance affects perceived and lender-treated flood exposure.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Near a flood zone | Within Nm of mapped flood zone | Flood zone, N m setback |
| On-screen finding | Flood zone about <N> m away. Ask the landlord whether runoff has reached the section. | Mapped flood zone <N> m away, boundaries approximate so runoff can still reach the section. | Flood polygon edge at `<N>` m. Treat as advisory; mapped boundary precision ~10–25 m depending on council vintage. |
| Hosted Quick label | (out of scope: Quick uses tier only) | (out of scope: Quick uses tier only) | (out of scope: Quick uses tier only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Distance to nearest flood zone | Distance to nearest flood zone | Flood-polygon proximity |
| Hosted Full narrative + tech | Closest flood zone is about Nm away. Storms can sometimes reach beyond the line on the map. | Nearest flood polygon is N m away, close enough that some lenders treat it as a flood-cover trigger. | Min distance to `flood_zones ∪ flood_hazard ∪ flood_extent`, capped 500 m. Boundary precision varies by loader. |

---

## hazards.wcc_flood_type (`hazards.wcc_flood_type`)
- What it measures: Wellington City Council District Plan flood-overlay type (e.g. "Stream Corridor", "Ponding").
- Source authority: Wellington City Council 2024 District Plan.
- Dataset / endpoint: WCC District Plan hazards ArcGIS layer (loaded by `wcc_hazards`).
- DataSource key(s): `wcc_hazards` (data_loader.py:4929). (`wcc_floodplains` is NOT a registered DataSource key.)
- Table(s): `flood_hazard` (source_council='wellington_city').
- Query path: `migrations/0054_flood_nearest_m.sql:139` (`fh_wcc.hazard_type`).
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1283`.
- Threshold / classification logic: Presence sets tier to at least "low" in `getFloodTier()`.
- Score contribution:, (label only; severity comes from `wcc_flood_ranking`).
- Coverage: Wellington City only (WIRING-TRACES § Wellington-only fields).
- Common misreading: "Ponding" sounds minor, it still triggers WCC consent requirements for habitable additions.
- What it does NOT tell you: Depth or frequency, paired `wcc_flood_ranking` carries severity.
- source_key status: TODO, `report_html.py:1287` Insight has no `source_key` (could use `wcc_flood`).
- User-care severity: Notable, WCC overlay type drives consent triggers for additions and habitable rooms.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | WCC flood overlay: <type> | WCC District Plan flood overlay (<type>) | WCC DP flood overlay, <type> |
| On-screen finding | This block is on Wellington's flood-overlay map as a "<type>", heavy rain matters here. | Wellington's District Plan flags this site as "<type>" flood overlay. Resource consent may be needed for new habitable rooms. | DP flood overlay `<type>` (WCC 2024 DP). Cross-check freeboard rules and §5 trigger thresholds before any work. |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | WCC flood overlay | WCC District Plan flood overlay | WCC 2024 DP flood overlay |
| Hosted Full narrative + tech | Wellington Council marks this property's area as "<type>". Floors and drainage matter when water shows up. | District Plan overlay = "<type>". Affects what you can build and may affect insurance availability. | Type = `<type>`, ranking = `<wcc_flood_ranking>`. Source: WCC 2024 DP `wcc_floodplains`. |

---

## hazards.wcc_flood_ranking (`hazards.wcc_flood_ranking`)
- What it measures: WCC District Plan flood severity ranking, "High" / "Medium" / "Low".
- Source authority: Wellington City Council 2024 District Plan.
- Dataset / endpoint: WCC District Plan hazards ArcGIS layer.
- DataSource key(s): `wcc_hazards` (data_loader.py:4929). (`wcc_floodplains` is NOT a registered DataSource key.)
- Table(s): `flood_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:140`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1284,1287`.
- Threshold / classification logic: `getFloodTier()`, High → severe, Medium → moderate, Low → low.
- Score contribution: `flood` override, `risk_score.py:521,523`. High=80, Medium=55, Low=30.
- Coverage: Wellington City only.
- Common misreading: "Low ranking" still triggers consent rules, not a free pass.
- What it does NOT tell you: Floor level, freeboard, or insurance position.
- source_key status: TODO.
- User-care severity: Critical, WCC severity ranking is the primary flood signal for Wellington buyers and insurers.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | WCC flood ranking: <rank> | WCC flood ranking, <rank> | WCC DP flood ranking, <rank> |
| On-screen finding | Council ranks the flooding here as <rank>. | WCC ranks flood hazard "<rank>", Medium/High typically requires raised floor levels for new builds. | Ranking = `<rank>`. Drives DP §5 building consent triggers and insurer pricing tier. |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | WCC flood ranking | WCC flood severity | WCC DP flood ranking |
| Hosted Full narrative + tech | Wellington Council ranks this area as <rank> for flood hazard. | Ranking = <rank>. Used by WCC and insurers as the headline flood-severity figure for the site. | Severity = `<rank>` from WCC 2024 DP `wcc_floodplains`. High=80 / Medium=55 / Low=30 in our score. |

---

## hazards.tsunami_zone_class (`hazards.tsunami_zone_class`)
- What it measures: National tsunami evacuation zone class (integer 1–3, where 3 = highest local-government warning tier).
- Source authority: Civil Defence / regional emergency management; aggregated national `tsunami_zones` layer.
- Dataset / endpoint: `tsunami_zones` target table populated by regional tsunami loaders (`auckland_tsunami`, `gwrc_tsunami`, `bop_tsunami_evac`, `hbrc_tsunami`, `nelson_tasman_tsunami`, +regional).
- DataSource key(s): `auckland_tsunami` (5057), `gwrc_tsunami` (7839), `bop_tsunami_evac` (6691), `hbrc_tsunami` (5401), `nelson_tasman_tsunami` (8187), +regional. (`tsunami_zones` is the target table, NOT a DataSource key.)
- Table(s): `tsunami_zones`.
- Query path: `migrations/0054_flood_nearest_m.sql:119` (`tz.zone_class`).
- Rendered by: `RiskHazardsSection.tsx`; `HostedQuickReport.tsx`; `HostedHazardAdvice.tsx`; findings `report_html.py:767,973`.
- Threshold / classification logic: tz≥3 → warn; tz≥1 → info. `lib/hazards.ts` `isInTsunamiZone()` true when zone is set & not 'none'/'0'.
- Score contribution: `tsunami` indicator, `risk_score.py:437`, weight 0.11. SEVERITY_TSUNAMI lookup by class.
- Coverage: All coastal cities with tsunami data, see WIRING-TRACES (most cities Y; Queenstown, Rotorua, Timaru = -).
- Common misreading: "Zone 1" sounds reassuring, Zones 1–3 are all evacuation zones, just for different magnitudes.
- What it does NOT tell you: Warning time, evacuation route, or elevation needed for safe ground.
- source_key status: present, `_src("council_tsunami")` at `report_html.py:778,785`.
- User-care severity: Critical, Inside a tsunami evacuation zone: life-safety signal, requires an evacuation plan.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Tsunami evacuation zone <N> | Tsunami evacuation zone <N> | Tsunami zone class <N> |
| On-screen finding | In tsunami evacuation Zone <N>. Know your route to high ground. | Zone <N> tsunami evacuation. Walk the inland route to ≥15 m before unconditional. | Zone class `<N>` (national tsunami_zones). Compounds with low coastal elevation per `report_html.py:987`. |
| Hosted Quick label | Tsunami zone | Tsunami zone (Z<N>) | Tsunami zone class <N> |
| Hosted Quick narrative | The address is in a tsunami evacuation zone, strong/long shake means move inland straight away. | Zone <N> tsunami evac, local-source tsunami gives 5–20 minutes' warning. | Zone class `<N>` from civil defence aggregated layer. |
| Hosted Full label | Tsunami evacuation zone | Tsunami evacuation zone | National tsunami zone class |
| Hosted Full narrative + tech | If the ground shakes long or strong, walk inland or uphill, don't wait for a phone alert. | Local-source tsunami warning window is 5–20 min. Walk the inland route ≥15 m elevation before unconditional. | Zone class `<N>`; source: civil defence-aggregated `tsunami_zones`. Vintage per loader; supersede with WCC/council where present. |

---

## hazards.tsunami_evac_zone (`hazards.tsunami_evac_zone`)
- What it measures: Free-text evac zone name (e.g. "Yellow", "Orange", "Red").
- Source authority: Regional civil defence.
- Dataset / endpoint: `tsunami_zones` target table populated by regional tsunami loaders.
- DataSource key(s): `auckland_tsunami`, `gwrc_tsunami`, `bop_tsunami_evac`, `hbrc_tsunami`, +regional. (`tsunami_zones` is a target table, NOT a DataSource key.)
- Table(s): `tsunami_zones`.
- Query path: `migrations/0054_flood_nearest_m.sql:120` (`tz.evac_zone`).
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx` (via `build_humanized_hazards`).
- Threshold / classification logic: Cosmetic label only.
- Score contribution: (none).
- Coverage: Same as `tsunami_zone_class`.
- Common misreading: Different councils use different colour conventions, Wellington's "Red" ≠ Auckland's.
- What it does NOT tell you: Numeric severity (use `tsunami_zone_class`).
- source_key status: N/A.
- User-care severity: Context, Colour label only; the numeric class carries severity.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Civil-defence evac zone: <name> | Civil-defence evac zone, <name> | Evac zone, <name> |
| On-screen finding | Civil defence call this the <name> evacuation zone. | Civil defence labels this the <name> evac zone, confirm the local meaning with the council. | Evac zone `<name>`; colour conventions differ by council, confirm against local CDEM map. |
| Hosted Quick label | (out of scope: numeric class shown instead) | (out of scope: numeric class shown instead) | (out of scope: numeric class shown instead) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Civil-defence evac zone | Civil-defence evac zone | CDEM evac zone label |
| Hosted Full narrative + tech | The <name> zone is what civil defence broadcasts in a tsunami warning. | Evac zone <name>, keep the civil-defence app installed; warnings reference the colour. | Label `<name>` from `tsunami_zones`. Joined to `tsunami_zone_class` for severity. |

---

## hazards.wcc_tsunami_return_period (`hazards.wcc_tsunami_return_period`)
- What it measures: WCC tsunami hazard return period, "1:100yr" / "1:500yr" / "1:1000yr".
- Source authority: Wellington City Council 2024 District Plan.
- Dataset / endpoint: WCC District Plan hazards ArcGIS layer (loaded by `wcc_hazards`).
- DataSource key(s): `wcc_hazards` (4929). (`wcc_tsunami` is NOT a registered DataSource key.)
- Table(s): `tsunami_hazard` (source_council='wellington_city').
- Query path: `migrations/0054_flood_nearest_m.sql:141`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1274`.
- Threshold / classification logic: 1:100yr → warn (80); 1:500yr → info (55); 1:1000yr → 25.
- Score contribution: `tsunami` override, `risk_score.py:551,553`.
- Coverage: Wellington City only.
- Common misreading: "1:1000 year" is rarely 0%, it's a probability per year, not a calendar promise.
- What it does NOT tell you: Wave height or arrival time.
- source_key status: TODO, finding has no `source_key`.
- User-care severity: Critical, Return period quantifies the chance of a major tsunami over a typical hold.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | WCC tsunami return period: <X> | WCC tsunami, <X> | WCC DP tsunami, <X> |
| On-screen finding | The District Plan flags this for tsunami at <X> return period. | WCC marks <X> tsunami zone, affects insurance and may restrict habitable rooms in new builds. | <X> return period from WCC 2024 DP `wcc_tsunami`. Triggers DP §5 building consent rules. |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | WCC tsunami return period | WCC tsunami return period | WCC DP tsunami return period |
| Hosted Full narrative + tech | Council estimates a tsunami of this size shows up about every <X>. | Return period <X>. 1:100 ≈ 26% chance over a 30-year hold; 1:500 ≈ 6%. | Return period `<X>` from WCC 2024 DP. Score: 1:100=80, 1:500=55, 1:1000=25. |

---

## hazards.wcc_tsunami_ranking (`hazards.wcc_tsunami_ranking`)
- What it measures: WCC tsunami severity ranking ("High" / "Medium" / "Low").
- Source authority: WCC 2024 DP.
- Dataset / endpoint: WCC District Plan hazards ArcGIS layer.
- DataSource key(s): `wcc_hazards` (4929). (`wcc_tsunami` is NOT a registered DataSource key.)
- Table(s): `tsunami_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:142`.
- Rendered by: `HostedHazardAdvice.tsx`. No on-screen finding.
- Threshold / classification logic: Used by `lib/hazards.ts` `isInTsunamiZone()`.
- Score contribution:, (return period drives the score).
- Coverage: Wellington City only.
- Common misreading: "Low" still means inside a mapped zone.
- What it does NOT tell you: Return period (paired field).
- source_key status: N/A, no Insight emits it.
- User-care severity: Notable, WCC severity ranking complements the return period.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | (out of scope: superseded by return period) | (out of scope: superseded by return period) | (out of scope: superseded by return period) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | WCC tsunami ranking | WCC tsunami ranking | WCC DP tsunami ranking |
| Hosted Full narrative + tech | Council's quick severity grade for tsunami here. | WCC ranking <rank>, reads alongside the return period. | Ranking `<rank>` from `wcc_tsunami` (WCC 2024 DP). Companion to return period. |

---

## hazards.council_tsunami_ranking (`hazards.council_tsunami_ranking`)
- What it measures: Regional council tsunami ranking ("High" / "Medium" / "Low") for cities outside Wellington.
- Source authority: Regional councils (BOP, HBRC, Nelson/Tasman, etc.).
- Dataset / endpoint: Council tsunami ArcGIS layers.
- DataSource key(s): `bop_tsunami_evac` (6691), `hbrc_tsunami` (5401), `nelson_tasman_tsunami` (8187), +regional. (Plain `bop_tsunami` and `tasman_tsunami` are NOT registered DataSource keys.)
- Table(s): `tsunami_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:147`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`. Finding via `build_humanized_hazards`.
- Threshold / classification logic: `lib/hazards.ts` `isInTsunamiZone()`.
- Score contribution: `tsunami` override, `risk_score.py:558,562`. High=80, Medium=55, Low=30.
- Coverage: Coastal cities except Wellington, see WIRING-TRACES § Council-specific hazard data (Tsunami column).
- Common misreading: Same as WCC ranking, "Low" still means inside a zone.
- What it does NOT tell you: Scenario or return period, see paired fields.
- source_key status: UNVERIFIED, `_src("council_tsunami")` Insights at `report_html.py:778,785` fire on `tsunami_zone_class`, not on `council_tsunami_ranking`. No Insight rule explicitly tied to this field located.
- User-care severity: Critical, Regional council tsunami ranking carries the same life-safety weight as WCC.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Council tsunami ranking: <rank> | Council tsunami, <rank> | Council tsunami ranking, <rank> |
| On-screen finding | Council ranks this address <rank> for tsunami. | <rank> ranking from regional council, affects insurance availability in some markets. | Ranking `<rank>` from regional `tsunami_hazard`. Score: H=80/M=55/L=30. |
| Hosted Quick label | (out of scope: Quick uses class) | (out of scope: Quick uses class) | (out of scope: Quick uses class) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Council tsunami ranking | Council tsunami severity | Regional council tsunami ranking |
| Hosted Full narrative + tech | Local council's tsunami grade for this spot. | <rank> ranking from regional council tsunami map. Pair with the scenario for the design event. | Ranking `<rank>` from `tsunami_hazard` (source_council = `<source>`). |

---

## hazards.council_tsunami_scenario (`hazards.council_tsunami_scenario`)
- What it measures: Scenario name behind the council tsunami zone (e.g. "South America 2500yr", "local fault").
- Source authority: Regional councils.
- Dataset / endpoint: Council tsunami loaders.
- DataSource key(s): Council tsunami loaders.
- Table(s): `tsunami_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:148`.
- Rendered by: `HostedHazardAdvice.tsx` only.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: Same as `council_tsunami_ranking`.
- Common misreading: A "distant source" scenario gives hours of warning; a local-fault scenario gives minutes.
- What it does NOT tell you: Probability, that's in `council_tsunami_return_period`.
- source_key status: N/A.
- User-care severity: Notable, Scenario sets warning time (local minutes vs distant hours).

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: not on screen) | (out of scope: not on screen) | (out of scope: not on screen) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Council tsunami scenario | Tsunami scenario | Council tsunami scenario |
| Hosted Full narrative + tech | Council says this is based on a "<scenario>" event. | Scenario <scenario>. Local-source events give minutes' warning; distant-source give hours. | Modelled scenario `<scenario>`. Reconcile with return period and ranking for design-event picture. |

---

## hazards.council_tsunami_return_period (`hazards.council_tsunami_return_period`)
- What it measures: Return period for the council's tsunami scenario (e.g. "2500yr", "1000yr").
- Source authority: Regional councils.
- Dataset / endpoint: Council tsunami loaders.
- DataSource key(s): Council tsunami loaders.
- Table(s): `tsunami_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:149`.
- Rendered by: `HostedHazardAdvice.tsx`.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: Where councils publish it (variable).
- Common misreading: Long return periods feel "rare", the consequences if it happens are unchanged.
- What it does NOT tell you: Scenario, severity, or evac time.
- source_key status: N/A.
- User-care severity: Notable, Return period quantifies the design event behind the council zone.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: not on screen) | (out of scope: not on screen) | (out of scope: not on screen) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Council tsunami return period | Tsunami return period | Council tsunami return period |
| Hosted Full narrative + tech | The council's tsunami map uses an event of about this rarity. | Return period <X>. Compare with the scenario to see whether it's a local or distant source. | Return period `<X>` from `tsunami_hazard`. Companion to scenario + ranking. |

---

## hazards.council_tsunami_source (`hazards.council_tsunami_source`)
- What it measures: Identifier of which council loader emitted the tsunami row (e.g. "tasman_district").
- Source authority: WhareScore loader metadata.
- Dataset / endpoint: `data_loader.py` `source_council` tag.
- DataSource key(s): Council tsunami loaders.
- Table(s): `tsunami_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:150`.
- Rendered by: `HostedHazardAdvice.tsx` (provenance footnote).
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: Wherever council tsunami data exists.
- Common misreading: Not a hazard signal, a provenance label.
- What it does NOT tell you: Anything about the hazard itself.
- source_key status: N/A.
- User-care severity: Background, Provenance label only; not a hazard signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: provenance only) | (out of scope: provenance only) | (out of scope: provenance only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: provenance only) | (out of scope: provenance only) | (out of scope: provenance only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: provenance footnote) | Source of tsunami data | Tsunami source_council |
| Hosted Full narrative + tech | (no rule) | Tsunami information sourced from <source>. | `source_council = <source>`; resolve via `data_loader.py` for endpoint + vintage. |

---

## hazards.liquefaction (`hazards.liquefaction`)
- What it measures: National liquefaction susceptibility class for the parcel.
- Source authority: National `liquefaction_zones` table populated by multiple council loaders (no single national authority).
- Dataset / endpoint: `liquefaction_zones` target table; populated by council liquefaction loaders (`auckland_liquefaction`, `hbrc_liquefaction`, +regional).
- DataSource key(s): UNKNOWN, `liquefaction_zones` is the target table, NOT a registered DataSource. Aggregated from `auckland_liquefaction` (5037), `hbrc_liquefaction` (5387), +regional council liquefaction loaders.
- Table(s): `liquefaction_zones`.
- Query path: `migrations/0054_flood_nearest_m.sql:121`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedQuickReport.tsx`; `HostedHazardAdvice.tsx`; findings `report_html.py:302,955`.
- Threshold / classification logic: `lib/hazards.ts` `normalizeLiquefaction()` + `liquefactionRating()` → very_high / high / moderate / low / very_low / none / unknown. Mirrors Python `normalize_liquefaction`.
- Score contribution: `liquefaction` indicator, `risk_score.py:443`, weight 0.11.
- Coverage: All cities (national layer), but sparse outside Wellington/Auckland/Canterbury.
- Common misreading: "Liquefaction" sounds like the house disappears, usually it means uneven settlement and broken services after a major quake.
- What it does NOT tell you: Foundation type, geology depth, or whether the dwelling has been on liquefiable ground that's been remediated.
- source_key status: present, `_src("council_liquefaction")` at `report_html.py:798,805`.
- User-care severity: Critical, High liquefaction means foundation damage and weeks of service outages after a major quake.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Liquefaction risk: <rating> | Liquefaction susceptibility, <rating> | Liquefaction class, <rating> |
| On-screen finding | Ground rated <rating> for liquefaction in a big quake. Services may take longer to come back. | <rating> liquefaction susceptibility. Inspect foundations and request any geotech reports. | Susceptibility `<rating>`; pair with foundation type and `gwrc_liquefaction_geology` / `council_liquefaction_geology` to refine. |
| Hosted Quick label | Liquefaction | Liquefaction (<rating>) | Liquefaction class |
| Hosted Quick narrative | The ground could shift in a big earthquake, burst pipes and uneven sections are typical. | <rating> liquefaction means uneven settlement and broken services after a major quake. | National `liquefaction_zones` rating: `<rating>`. |
| Hosted Full label | Liquefaction susceptibility | Liquefaction susceptibility | National liquefaction class |
| Hosted Full narrative + tech | In a big earthquake, the ground here can act like wet sand. Pipes and paths often need repair. | <rating> susceptibility. Foundation type and EQC claim history are the deciding factors for damage outcome. | National liquefaction class `<rating>` (per `normalize_liquefaction`). Refined by GWRC + council liquefaction layers where present. |

---

## hazards.gwrc_liquefaction (`hazards.gwrc_liquefaction`)
- What it measures: GWRC regional liquefaction susceptibility (Wellington region detail layer).
- Source authority: Greater Wellington Regional Council.
- Dataset / endpoint: GWRC earthquake/liquefaction ArcGIS.
- DataSource key(s): `gwrc_earthquake`.
- Table(s): `liquefaction_detail`.
- Query path: `migrations/0054_flood_nearest_m.sql:134`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:956`.
- Threshold / classification logic: Normalised by `normalize_liquefaction` and then `severity_liquefaction_canonical`. Geology "fill" boost to ≥85 in `risk_score.py:498`.
- Score contribution: `liquefaction` regional override, `risk_score.py:499–500`.
- Coverage: Wellington region (GWRC), Wellington, Lower Hutt, Upper Hutt, Porirua, Kapiti Coast.
- Common misreading: Treating an "Unknown" GWRC rating as "safe", it just means unmapped.
- What it does NOT tell you: Same as national field; geology paired in `gwrc_liquefaction_geology`.
- source_key status: present, `_src("council_liquefaction")` at `report_html.py:798,805`.
- User-care severity: Critical, GWRC regional liquefaction is the higher-resolution Wellington signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | GWRC liquefaction: <rating> | GWRC liquefaction, <rating> | GWRC liquefaction, <rating> |
| On-screen finding | Wellington region map rates this <rating> for liquefaction. | GWRC <rating> liquefaction. Higher resolution than the national map, trust this one. | GWRC `<rating>` (regional); supersedes national `liquefaction_zones` where set. |
| Hosted Quick label | (out of scope: Wellington region, Quick uses national) | (out of scope: Quick uses national) | (out of scope: Quick uses national) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | GWRC liquefaction | GWRC liquefaction | GWRC liquefaction (regional) |
| Hosted Full narrative + tech | Greater Wellington's regional map for ground-shift risk. | <rating> on GWRC's regional liquefaction layer (typically more accurate than national). | Regional `<rating>` from `liquefaction_detail` (source: GWRC mapping portal). |

---

## hazards.gwrc_liquefaction_geology (`hazards.gwrc_liquefaction_geology`)
- What it measures: Simplified geology label for the GWRC liquefaction polygon (e.g. "fill", "sand", "alluvium").
- Source authority: GWRC.
- Dataset / endpoint: GWRC earthquake/liquefaction layer.
- DataSource key(s): `gwrc_earthquake`.
- Table(s): `liquefaction_detail`.
- Query path: `migrations/0054_flood_nearest_m.sql:135`.
- Rendered by: `HostedHazardAdvice.tsx`; finding `report_html.py:1214,1223`.
- Threshold / classification logic: "fill"/"reclaimed" → boost score to 85 in `risk_score.py:498`.
- Score contribution: Boosts `liquefaction` indicator when geology is fill.
- Coverage: GWRC region only.
- Common misreading: "Alluvium" sounds technical but harmless, alluvial soils are amongst the worst for liquefaction.
- What it does NOT tell you: Depth or thickness of the layer.
- source_key status: TODO, finding has no source_key.
- User-care severity: Notable, Fill or reclaimed ground meaningfully changes foundation cost and damage outlook.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Built on <geology> | Built on <geology> | Geology, <geology> |
| On-screen finding | This block is built on <geology>, the ground type that does worst in shakes. | Built on <geology>. If "fill" or "reclaimed", expect higher liquefaction susceptibility regardless of the headline rating. | Geology = `<geology>`; "fill"/"reclaimed" triggers liquefaction score boost to ≥85. |
| Hosted Quick label | (out of scope: GWRC-only and detailed) | (out of scope: GWRC-only and detailed) | (out of scope: GWRC-only and detailed) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Ground geology | Ground geology | Simplified geology (GWRC) |
| Hosted Full narrative + tech | The ground type here is <geology>. Some types crack and settle worse than others in earthquakes. | Geology = <geology>. Reclaimed/fill land needs deep-pile or raft foundations to perform. Check the consent file. | `simplified = <geology>` from GWRC. Fill/reclaimed → 85 score floor for liquefaction. |

---

## hazards.council_liquefaction (`hazards.council_liquefaction`)
- What it measures: Regional council liquefaction susceptibility outside Wellington.
- Source authority: Regional councils (Auckland, HBRC, Marlborough, etc.).
- Dataset / endpoint: Council liquefaction ArcGIS layers.
- DataSource key(s): `auckland_liquefaction`, `hbrc_liquefaction`, +regional.
- Table(s): `liquefaction_detail`.
- Query path: `migrations/0054_flood_nearest_m.sql:144`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:957`.
- Threshold / classification logic: Normalised via `normalize_liquefaction`. Geology "fill" → score ≥85.
- Score contribution: `liquefaction` council override, `risk_score.py:573–574`.
- Coverage: All 22 cities have liquefaction data (WIRING-TRACES Liquefaction column = Y for all).
- Common misreading: Auckland's "Possible" / "Unlikely" don't map to NZ-standard "very high/low", `normalizeLiquefaction()` reconciles them.
- What it does NOT tell you: Foundation specification.
- source_key status: present, `_src("council_liquefaction")`.
- User-care severity: Critical, Council liquefaction is the leading signal for foundation type and insurance treatment.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Council liquefaction: <rating> | Council liquefaction, <rating> | Council liquefaction, <rating> |
| On-screen finding | Council rates this <rating> for liquefaction. | <rating> liquefaction (council layer). Foundation spec drives whether you'll see damage. | `<rating>` from `liquefaction_detail` (source `<source>`). Pair with `council_liquefaction_geology`. |
| Hosted Quick label | (out of scope: Quick uses national) | (out of scope: Quick uses national) | (out of scope: Quick uses national) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Council liquefaction | Council liquefaction | Council liquefaction (regional) |
| Hosted Full narrative + tech | Local council's higher-resolution view of ground-shift risk. | <rating> from regional council. Usually more accurate than national. Foundation type matters more than headline. | Regional `<rating>` (source: `<source_council>`). Worst-of national/GWRC/council picks final score. |

---

## hazards.council_liquefaction_geology (`hazards.council_liquefaction_geology`)
- What it measures: Simplified geology for the council liquefaction polygon.
- Source authority: Regional councils.
- Dataset / endpoint: Council liquefaction loaders.
- DataSource key(s): Council liquefaction loaders.
- Table(s): `liquefaction_detail`.
- Query path: `migrations/0054_flood_nearest_m.sql:145`.
- Rendered by: `HostedHazardAdvice.tsx`.
- Threshold / classification logic: "fill"/"reclaimed" → score ≥85 in `risk_score.py:572`.
- Score contribution: Liquefaction fill boost.
- Coverage: Variable by council.
- Common misreading: Treating geology as cosmetic, it's a major signal for foundation cost.
- What it does NOT tell you: Layer depth.
- source_key status: N/A.
- User-care severity: Notable, Geology drives mitigation choice (deep piles vs raft).

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: not on screen) | (out of scope: not on screen) | (out of scope: not on screen) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Ground geology (council) | Ground geology (council) | Council geology label |
| Hosted Full narrative + tech | Local map says the ground is <geology>. | <geology>. Fill/reclaimed → expect deeper foundations and higher EQC excesses. | `simplified = <geology>` from regional council. Fill/reclaimed → 85 score floor. |

---

## hazards.council_liquefaction_source (`hazards.council_liquefaction_source`)
- What it measures: Loader-level provenance label (`source_council`).
- Source authority: WhareScore loader metadata.
- Dataset / endpoint: `data_loader.py`.
- DataSource key(s): Council liquefaction loaders.
- Table(s): `liquefaction_detail`.
- Query path: `migrations/0054_flood_nearest_m.sql:146`.
- Rendered by: `HostedHazardAdvice.tsx` (provenance only).
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: Wherever council liquefaction loaders run.
- Common misreading: Not a hazard, provenance label.
- What it does NOT tell you: Hazard severity.
- source_key status: N/A.
- User-care severity: Background, Provenance label only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: provenance) | (out of scope: provenance) | (out of scope: provenance) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: provenance) | (out of scope: provenance) | (out of scope: provenance) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: footnote only) | Liquefaction data source | Liquefaction source_council |
| Hosted Full narrative + tech | (no rule) | Liquefaction map sourced from <source>. | `source_council = <source>` (resolve loader via `data_loader.py`). |

---

## hazards.slope_failure (`hazards.slope_failure`)
- What it measures: National slope-failure (earthquake-induced landslide) susceptibility class.
- Source authority: National `slope_failure_zones` table populated by GNS / regional loaders.
- Dataset / endpoint: `slope_failure_zones` target table.
- DataSource key(s): UNKNOWN, `slope_failure_zones` is a target table, NOT a registered DataSource key. Populated by GNS landslide / regional slope loaders.
- Table(s): `slope_failure_zones`.
- Query path: `migrations/0054_flood_nearest_m.sql:128`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedQuickReport.tsx`; `HostedHazardAdvice.tsx`. (Note: `report_html.py:921` Insight fires on `landslide_in_area`, not `slope_failure`, the slope_failure-specific Insight line was not located in this audit pass.)
- Threshold / classification logic: SEVERITY_SLOPE_FAILURE lookup; "very high"/"high"/"medium" trigger findings.
- Score contribution: `slope_failure` indicator, `risk_score.py:454`, weight 0.11.
- Coverage: All cities (national layer).
- Common misreading: "Susceptibility" is per-event, many high-rated sites have never slipped.
- What it does NOT tell you: Trigger threshold (rainfall vs quake) or remediation history.
- source_key status: TODO, finding `report_html.py:921` has no `source_key`.
- User-care severity: Critical, High slope-failure susceptibility is a serious safety and insurance signal post-Cyclone Gabrielle.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Slope-failure risk: <rating> | Earthquake-induced landslide, <rating> | EQ-induced landslide susc., <rating> |
| On-screen finding | Slopes rated <rating> for slipping in a big quake. | <rating> EQ-induced landslide susceptibility. Geotech assessment ($2k–$5k) is the standard pre-purchase step. | National `<rating>`; refined by GWRC + council slope layers + GNS NZLD events. |
| Hosted Quick label | Slope failure | Landslide susceptibility (<rating>) | EQ-induced landslide susc. |
| Hosted Quick narrative | The land here can slip in a big earthquake or heavy storm. | <rating> susceptibility. Recent NZ storms (Auckland 2023, Cyclone Gabrielle) hit zones like this hardest. | National slope_failure_zones rating `<rating>`. |
| Hosted Full label | Slope failure | Earthquake-induced landslide | National slope_failure susc. |
| Hosted Full narrative + tech | The land can slip in big shakes or heavy rain. Look for cracked paths and leaning fences. | <rating> susceptibility. Combined geotech + slope-stability assessment is $5k–$8k when paired with high liquefaction. | National `slope_failure_zones` susceptibility = `<rating>`. Severity: very_high / high / medium / low. |

---

## hazards.gwrc_slope_severity (`hazards.gwrc_slope_severity`)
- What it measures: GWRC regional slope severity grade (e.g. "1 Low", "5 Very High").
- Source authority: GWRC.
- Dataset / endpoint: GWRC earthquake/slope layer.
- DataSource key(s): `gwrc_earthquake`.
- Table(s): `slope_failure`.
- Query path: `migrations/0054_flood_nearest_m.sql:136`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`. No on-screen finding.
- Threshold / classification logic: SEVERITY_GWRC_SLOPE lookup.
- Score contribution: `slope_failure` GWRC override, `risk_score.py:504–505`.
- Coverage: Wellington region.
- Common misreading: GWRC's "1" / "5" scale is opposite intuition for some users, confirm the label.
- What it does NOT tell you: Remediation, drainage, retaining wall presence.
- source_key status: N/A.
- User-care severity: Notable, GWRC regional grade refines the national susceptibility for Wellington.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | GWRC slope severity: <grade> | GWRC slope severity, <grade> | GWRC slope severity, <grade> |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: Quick uses national) | (out of scope: Quick uses national) | (out of scope: Quick uses national) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | GWRC slope severity | GWRC slope severity | GWRC slope grade |
| Hosted Full narrative + tech | Wellington region's ranking for slip risk on this slope. | <grade> grade. GWRC's regional view typically supersedes the national susceptibility. | Severity `<grade>` from GWRC `slope_failure`. Lookup via SEVERITY_GWRC_SLOPE. |

---

## hazards.council_slope_severity (`hazards.council_slope_severity`)
- What it measures: Regional council slope-failure severity for cities outside Wellington.
- Source authority: Regional councils.
- Dataset / endpoint: Council slope loaders.
- DataSource key(s): Regional slope loaders.
- Table(s): `slope_failure`.
- Query path: `migrations/0054_flood_nearest_m.sql:151`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`. No on-screen finding.
- Threshold / classification logic: GWRC-format first, then SEVERITY_SLOPE_FAILURE fallback.
- Score contribution: `slope_failure` council override, `risk_score.py:583–584`.
- Coverage: WIRING-TRACES Slope column, Y in 14 cities, blank elsewhere.
- Common misreading: Council scales differ; trust the normalised score not the raw label.
- What it does NOT tell you: Stability of specific retaining walls.
- source_key status: N/A.
- User-care severity: Notable, Council grade refines national susceptibility outside Wellington.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Council slope severity: <grade> | Council slope severity, <grade> | Council slope severity, <grade> |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: Quick uses national) | (out of scope: Quick uses national) | (out of scope: Quick uses national) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Council slope severity | Council slope severity | Council slope grade |
| Hosted Full narrative + tech | Local council's slip-risk grade for this section. | <grade> from local council. Usually more accurate than national. | Severity `<grade>` from regional `slope_failure` (source `<source>`). |

---

## hazards.council_slope_source (`hazards.council_slope_source`)
- What it measures: Loader provenance for the council slope row.
- Source authority: WhareScore loader metadata.
- Dataset / endpoint: `data_loader.py`.
- DataSource key(s): Regional slope loaders.
- Table(s): `slope_failure`.
- Query path: `migrations/0054_flood_nearest_m.sql:152`.
- Rendered by: `HostedHazardAdvice.tsx` footnote.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: Wherever council slope loaders run.
- Common misreading: Provenance only.
- What it does NOT tell you: Hazard severity.
- source_key status: N/A.
- User-care severity: Background, Provenance label only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: provenance) | (out of scope: provenance) | (out of scope: provenance) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: provenance) | (out of scope: provenance) | (out of scope: provenance) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: footnote) | Slope data source | Slope source_council |
| Hosted Full narrative + tech | (no rule) | Slope grade from <source>. | `source_council = <source>`; resolve via `data_loader.py`. |

---

## hazards.landslide_count_500m (`hazards.landslide_count_500m`)
- What it measures: Count of historical landslide events in GNS NZ Landslide Database within 500 m.
- Source authority: GNS Science NZ Landslide Database.
- Dataset / endpoint: GNS NZLD.
- DataSource key(s): `gns_landslides`.
- Table(s): `landslide_events`.
- Query path: `migrations/0054_flood_nearest_m.sql:158`.
- Rendered by: `RiskHazardsSection.tsx:122` (LandslideDetailCard); `HostedHazardAdvice.tsx`; findings `report_html.py:379,896`.
- Threshold / classification logic: ≥3 → warn (gns_score 65); ≥1 → info (40).
- Score contribution: `slope_failure` GNS boost, `risk_score.py:462–469`.
- Coverage: National. Sparse-but-present in all cities.
- Common misreading: "Zero events" doesn't mean stable, it means nothing's been documented in NZLD.
- What it does NOT tell you: Slip size, trigger, age, see `landslide_nearest`.
- source_key status: present, `_src("gns_landslides")` at `report_html.py:902,909`.
- User-care severity: Notable, Multiple historical slips within 500 m flag real instability.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | <N> historical landslides within 500 m | <N> historical landslides within 500 m | NZLD events 500 m, <N> |
| On-screen finding | <N> recorded slips within 500 m of here. Ask the landlord whether the section's been affected. | <N> historical slips within 500 m (GNS NZLD). Multiple events suggest real instability, geotech assessment recommended. | `n=<N>` GNS NZLD events within 500 m. Reconcile with `landslide_nearest` for trigger + date. |
| Hosted Quick label | (out of scope: detail-tier signal) | (out of scope: detail-tier signal) | (out of scope: detail-tier signal) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Historical landslides nearby | Historical landslides nearby | NZLD landslide count (500 m) |
| Hosted Full narrative + tech | <N> recorded landslides have happened within 500 m of here. | <N> documented historical slips within 500 m (GNS NZLD). Pattern matters more than single events. | `<N>` `landslide_events` rows within 500 m. Source: GNS NZ Landslide Database. |

---

## hazards.landslide_nearest (`hazards.landslide_nearest`)
- What it measures: Metadata for the closest GNS landslide event, distance_m, trigger, date, severity, damage.
- Source authority: GNS Science NZLD.
- Dataset / endpoint: GNS NZLD.
- DataSource key(s): `gns_landslides`.
- Table(s): `landslide_events`.
- Query path: `migrations/0054_flood_nearest_m.sql:159`.
- Rendered by: `RiskHazardsSection.tsx:122`; `HostedHazardAdvice.tsx`; findings `report_html.py:380,1036`.
- Threshold / classification logic: §4-a rule uses date + trigger + severity; specific 2022 Cyclone Gabrielle slip 300 m away ≠ a 1956 minor rockfall.
- Score contribution:, (informs slope_failure narrative).
- Coverage: National.
- Common misreading: A nearest slip "1.2 km away" feels safe; if it's a recurring rainfall trigger on similar geology it's still informative.
- What it does NOT tell you: Whether the same slip mechanism applies to this site.
- source_key status: present, `_src("gns_landslides")`.
- User-care severity: Notable, Nearest documented slip with date and trigger informs whether the same mechanism applies here.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Nearest slip: <date>, <distance> | Nearest slip, <date>, <distance> | NZLD nearest event |
| On-screen finding | Closest recorded slip was <date>, about <distance> away (<trigger>). | Nearest GNS slip: <distance> away, <date>, triggered by <trigger>. Recurring rainfall triggers matter more than one-off events. | Nearest NZLD event `<date>`, dist `<m>`, trigger `<t>`, severity `<s>`, damage `<d>`. |
| Hosted Quick label | (out of scope: detail-tier) | (out of scope: detail-tier) | (out of scope: detail-tier) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Nearest landslide event | Nearest landslide event | NZLD nearest event |
| Hosted Full narrative + tech | The closest recorded slip was <date>, around <distance> away. | Nearest slip <distance> away, <date>, triggered by <trigger>. Same trigger + nearby geology = relevant signal. | NZLD nearest: distance `<m>`, date `<d>`, trigger `<t>`, severity `<sev>`, damage `<dmg>`. |

---

## hazards.landslide_in_area (`hazards.landslide_in_area`)
- What it measures: Boolean, property is within a mapped historical landslide polygon (GNS).
- Source authority: GNS Science NZLD.
- Dataset / endpoint: GNS NZLD area polygons.
- DataSource key(s): `gns_landslides`.
- Table(s): `landslide_areas`.
- Query path: `migrations/0054_flood_nearest_m.sql:160`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; findings `report_html.py:390,912`.
- Threshold / classification logic: Boolean. True → score 75 in `risk_score.py:461`.
- Score contribution: `slope_failure` boost, `risk_score.py:459–469`.
- Coverage: National (sparse, maps existing slip footprints only).
- Common misreading: "In an area" sounds geographic, it means the parcel sits on documented landslide debris.
- What it does NOT tell you: Whether the slip is currently active or has been remediated.
- source_key status: present, `_src("gns_landslides")` at `report_html.py:917`.
- User-care severity: Critical, Sitting on a documented slip footprint is a major geotech and insurance signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | On a mapped landslide footprint | On a mapped landslide footprint | NZLD in-area = true |
| On-screen finding | The section sits on a slope where a landslide has happened before. Ask about repairs. | Inside a mapped landslide footprint (GNS). Get a geotech report before going unconditional. | `landslide_in_area = true` (GNS NZLD). Foundation type + slope-stability assessment + EQC claim history all required. |
| Hosted Quick label | (out of scope: rare detail signal) | (out of scope: rare detail signal) | (out of scope: rare detail signal) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | On a mapped slip footprint | On a mapped slip footprint | NZLD area polygon hit |
| Hosted Full narrative + tech | The land here has slipped before, the section sits on a slip footprint. | Inside a mapped GNS landslide polygon. Means a slip has already happened here; the question is what was done about it. | `landslide_areas` polygon intersect. Source: GNS Science. |

---

## hazards.landslide_susceptibility_rating (`hazards.landslide_susceptibility_rating`)
- What it measures: Council-grade landslide susceptibility rating (e.g. "Very High", "High", "Moderate").
- Source authority: GWRC + Auckland Council.
- Dataset / endpoint: GWRC + AC landslide susceptibility ArcGIS layers.
- DataSource key(s): `gwrc_landslide`, `auckland_landslide`.
- Table(s): `landslide_susceptibility`.
- Query path: `migrations/0054_flood_nearest_m.sql:162`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1352`.
- Threshold / classification logic: SEVERITY_LANDSLIDE_SUSCEPTIBILITY lookup.
- Score contribution: `landslide_susceptibility` indicator, `risk_score.py:592,594`, weight 0.10.
- Coverage: WIRING-TRACES "Landslide Susc" column, Wellington region (Y), Auckland (Y), Whangarei (Y), most others none.
- Common misreading: This is rainfall-triggered slips primarily, not just earthquake.
- What it does NOT tell you: Specific slope angle or drainage condition.
- source_key status: TODO, finding has no `source_key` (could use `gns_landslides` or new `council_landslide`).
- User-care severity: Critical, High landslide susceptibility covers rainfall and quake triggers, the dominant NZ slip cause.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Landslide susceptibility: <rating> | Landslide susceptibility, <rating> | Landslide susc., <rating> |
| On-screen finding | Council rates the slip risk here as <rating>. | <rating> landslide susceptibility (council). Covers rainfall + earthquake-triggered slips. Geotech recommended. | Council landslide susc. = `<rating>` (`gwrc_landslide` / `auckland_landslide`). Rainfall + EQ-triggered. |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Council landslide susc. | Council landslide susc. | Council landslide susc. |
| Hosted Full narrative + tech | Council's grade for slip risk, covers rain and shake triggers. | <rating>. Covers rainfall + EQ-induced. Rainfall is the more frequent trigger in NZ. | Susceptibility `<rating>` from `landslide_susceptibility` (source `<source>`). |

---

## hazards.landslide_susceptibility_type (`hazards.landslide_susceptibility_type`)
- What it measures: Failure mode/type label (e.g. "Debris flow", "Rockfall").
- Source authority: GWRC + AC.
- Dataset / endpoint: Council landslide layers.
- DataSource key(s): `gwrc_landslide`, `auckland_landslide`.
- Table(s): `landslide_susceptibility`.
- Query path: `migrations/0054_flood_nearest_m.sql:163`.
- Rendered by: `HostedHazardAdvice.tsx`.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: Same as rating.
- Common misreading: "Debris flow" sounds dramatic but is the most common rainfall-triggered NZ slip mechanism.
- What it does NOT tell you: Probability or volume.
- source_key status: N/A.
- User-care severity: Context, Failure mode informs mitigation choice but is not severity on its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: detail) | (out of scope: detail) | (out of scope: detail) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Slip mechanism | Slip mechanism | Landslide failure type |
| Hosted Full narrative + tech | The kind of slip the council models here is "<type>". | Failure mode = <type> (e.g. debris flow, rockfall). Drives whether retaining or drainage is the right mitigation. | `type = <type>`; informs mitigation design (retaining vs drainage vs setback). |

---

## hazards.landslide_susceptibility_source (`hazards.landslide_susceptibility_source`)
- What it measures: Loader provenance for the susceptibility row.
- Source authority: WhareScore loader metadata.
- Dataset / endpoint: `data_loader.py`.
- DataSource key(s): Landslide loaders.
- Table(s): `landslide_susceptibility`.
- Query path: `migrations/0054_flood_nearest_m.sql:164`.
- Rendered by: `HostedHazardAdvice.tsx` footnote.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: Wherever loaders run.
- Common misreading: Not a hazard.
- What it does NOT tell you: Hazard severity.
- source_key status: N/A.
- User-care severity: Background, Provenance label only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: provenance) | (out of scope: provenance) | (out of scope: provenance) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: provenance) | (out of scope: provenance) | (out of scope: provenance) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: footnote) | Landslide data source | Landslide source_council |
| Hosted Full narrative + tech | (no rule) | Landslide map sourced from <source>. | `source_council = <source>`; resolve via `data_loader.py`. |

---

## hazards.earthquake_count_30km (`hazards.earthquake_count_30km`)
- What it measures: Count of M4+ earthquakes within 30 km in the last 10 years.
- Source authority: GeoNet / GNS Science.
- Dataset / endpoint: GeoNet earthquake catalogue.
- DataSource key(s): UNKNOWN, `geonet_earthquakes` is the `_src(...)` source-catalog key in `report_html.py`, not a registered DataSource in `data_loader.py`.
- Table(s): `earthquakes`.
- Query path: `migrations/0054_flood_nearest_m.sql:124`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:422,808`.
- Threshold / classification logic: ≥20 → warn.
- Score contribution: `earthquake` indicator, `risk_score.py:446`, normalize 0–50, weight 0.09. Refined by `earthquake_hazard_grade` at `risk_score.py:484` when present.
- Coverage: All cities (national).
- Common misreading: A high count near Wellington isn't unusual, compare to area baseline, not zero.
- What it does NOT tell you: Magnitude distribution, depth, or proximity within the 30 km radius.
- source_key status: present, `_src("geonet_earthquakes")` at `report_html.py:819`.
- User-care severity: Notable, Recent M4+ count signals regional seismicity and informs strengthening priorities.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | <N> M4+ quakes within 30 km (10 yr) | <N> M4+ quakes within 30 km (10 yr) | M4+ count 30 km/10 yr, <N> |
| On-screen finding | There've been <N> M4+ quakes within 30 km in 10 years, typical for Wellington, less so for Auckland. | <N> M4+ quakes within 30 km (last 10 yr). Above national median = active seismic area; review pre-1976 strengthening. | `n=<N>` GeoNet M≥4 within 30 km / 10 yr. Compare against city baseline, not zero. |
| Hosted Quick label | (out of scope: Quick relies on aggregated risk) | (out of scope: Quick relies on aggregated risk) | (out of scope: Quick relies on aggregated risk) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | M4+ earthquakes nearby | Recent M4+ activity | GeoNet M≥4 30 km / 10 yr |
| Hosted Full narrative + tech | <N> earthquakes M4 or bigger have happened within 30 km in the last 10 years. | <N> M4+ events within 30 km/10 yr. Most won't be felt locally; the count signals regional seismicity. | GeoNet count `<N>` (M≥4, 30 km, 10 yr). Score: normalize_min_max(0, 50). |

---

## hazards.earthquake_hazard_index (`hazards.earthquake_hazard_index`)
- What it measures: GWRC Combined Hazard Index (CHI), continuous numeric.
- Source authority: GWRC.
- Dataset / endpoint: GWRC earthquake/CHI ArcGIS.
- DataSource key(s): `gwrc_earthquake`.
- Table(s): `earthquake_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:130`.
- Rendered by: `HostedHazardAdvice.tsx` only.
- Threshold / classification logic: Numeric; severity comes from paired `earthquake_hazard_grade`.
- Score contribution:, (grade is what scores).
- Coverage: Wellington region only.
- Common misreading: A bare number is meaningless without the grade context.
- What it does NOT tell you: Direct comparator (use grade).
- source_key status: N/A.
- User-care severity: Background, Raw CHI number; the grade carries the meaning.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: detail) | (out of scope: detail) | (out of scope: detail) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | GWRC CHI | GWRC CHI | GWRC Combined Hazard Index |
| Hosted Full narrative + tech | Wellington's combined earthquake-hazard number for this site. | GWRC's combined hazard index = <X>. The grade (1–5) is the easier read. | CHI `<X>` from `earthquake_hazard` (GWRC). Pair with `chi_grade`. |

---

## hazards.earthquake_hazard_grade (`hazards.earthquake_hazard_grade`)
- What it measures: GWRC CHI grade (1–5; 5 = highest).
- Source authority: GWRC.
- Dataset / endpoint: GWRC CHI layer.
- DataSource key(s): `gwrc_earthquake`.
- Table(s): `earthquake_hazard`.
- Query path: `migrations/0054_flood_nearest_m.sql:131`.
- Rendered by: `HostedHazardAdvice.tsx` only.
- Threshold / classification logic: normalize_min_max(1, 5) feeds earthquake indicator.
- Score contribution: `earthquake` GWRC override, `risk_score.py:484–486`.
- Coverage: Wellington region.
- Common misreading: A "Grade 5" only matters in conjunction with the building's seismic standard.
- What it does NOT tell you: Building strengthening status (see `epb_*`).
- source_key status: N/A.
- User-care severity: Notable, GWRC CHI grade is the main combined-hazard read for Wellington.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: detail) | (out of scope: detail) | (out of scope: detail) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | GWRC hazard grade | GWRC hazard grade | GWRC CHI grade |
| Hosted Full narrative + tech | Wellington's earthquake-hazard grade here is <grade> out of 5. | Grade <grade>/5. Combines shaking + ground response + slope into one score. | CHI grade `<grade>` (1=low, 5=high). Score: normalize_min_max(1,5). |

---

## hazards.ground_shaking_zone (`hazards.ground_shaking_zone`)
- What it measures: GWRC ground-shaking amplification zone label.
- Source authority: GWRC.
- Dataset / endpoint: GWRC earthquake/ground-shaking layer.
- DataSource key(s): `gwrc_earthquake`.
- Table(s): `ground_shaking`.
- Query path: `migrations/0054_flood_nearest_m.sql:132`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`. No on-screen Insight rule fires on `ground_shaking_zone` directly, line `report_html.py:1212` reads `ground_shaking_severity`, not `_zone`. Zone is rendered indirectly alongside severity in the same card.
- Threshold / classification logic: SEVERITY_GWRC_GROUND_SHAKING lookup with severity field.
- Score contribution:, (severity drives score).
- Coverage: Wellington region only.
- Common misreading: Zone label without severity is not actionable on its own.
- What it does NOT tell you: Building age or strengthening.
- source_key status: N/A, no Insight rule keyed on this field.
- User-care severity: Notable, Amplification zone affects how older buildings perform in shakes.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Ground-shaking zone: <zone> | Ground-shaking zone, <zone> | GWRC ground-shaking, <zone> |
| On-screen finding | This area is in a "<zone>" amplification zone, shaking feels stronger here. | <zone> amplification zone. Older buildings (pre-1976) feel disproportionately worse shaking. | GWRC ground-shaking zone `<zone>`. Pair with `ground_shaking_severity` for score. |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Ground-shaking zone | Ground-shaking amplification | GWRC ground-shaking zone |
| Hosted Full narrative + tech | Quakes feel stronger in some places than others. This area is "<zone>". | Amplification zone <zone>. Modern foundations designed for this perform meaningfully better than 1970s-era. | Zone `<zone>` from `ground_shaking` (GWRC). Lookup via SEVERITY_GWRC_GROUND_SHAKING + severity. |

---

## hazards.ground_shaking_severity (`hazards.ground_shaking_severity`)
- What it measures: GWRC ground-shaking severity label (e.g. "5 High", "Low").
- Source authority: GWRC.
- Dataset / endpoint: GWRC ground-shaking layer.
- DataSource key(s): `gwrc_earthquake`.
- Table(s): `ground_shaking`.
- Query path: `migrations/0054_flood_nearest_m.sql:133`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1212`.
- Threshold / classification logic: SEVERITY_GWRC_GROUND_SHAKING. "high"/"5"/"4" → warn finding.
- Score contribution: `ground_shaking` indicator, `risk_score.py:475`, weight 0.12 (Wellington-only).
- Coverage: Wellington region.
- Common misreading: "High" needs to read against building age; new builds tolerate it.
- What it does NOT tell you: Strengthening status.
- source_key status: TODO, finding has no `source_key`.
- User-care severity: Notable, High shaking severity matters most for pre-1976 building stock.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Ground shaking: <severity> | Ground shaking severity, <severity> | GWRC ground-shaking, <severity> |
| On-screen finding | The shake here is rated <severity>. | <severity> ground shaking. For older/unstrengthened buildings this is a meaningful insurance and damage signal. | GWRC severity `<severity>`. Score weight 0.12 (Wellington-only indicator). |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Ground-shaking severity | Ground-shaking severity | GWRC shaking severity |
| Hosted Full narrative + tech | Earthquakes feel stronger here than average. | <severity> shaking grade. Reclaimed/fill compounds this, see geology field. | Severity `<severity>` from `ground_shaking`. Weight 0.12 in WEIGHTS_HAZARDS. |

---

## hazards.fault_zone_name (`hazards.fault_zone_name`)
- What it measures: Name of the WCC-mapped fault zone the property sits in (e.g. "Wellington Fault").
- Source authority: WCC 2024 District Plan.
- Dataset / endpoint: WCC hazards ArcGIS.
- DataSource key(s): `wcc_hazards`.
- Table(s): `fault_zones`.
- Query path: `migrations/0054_flood_nearest_m.sql:137`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1232`.
- Threshold / classification logic: Presence drives `fault_zone` indicator.
- Score contribution: `fault_zone` indicator, `risk_score.py:512,514,516`, weight 0.10. Severity from ranking.
- Coverage: Wellington City only.
- Common misreading: "On a fault" doesn't always mean ground rupture risk, fault avoidance zones are wider than the fault trace.
- What it does NOT tell you: Distance to surface trace.
- source_key status: TODO, finding has no `source_key` (catalog has `wcc_hazards`).
- User-care severity: Critical, On a mapped active-fault zone: surface rupture is uninsurable.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | In <fault> fault zone | In <fault> fault zone | WCC DP fault, <fault> |
| On-screen finding | This block is mapped over the <fault> fault zone. | Property sits in the <fault> fault zone. Surface rupture cannot be mitigated by building design. | DP fault zone = `<fault>`. Triggers DP §5 building-consent setbacks. |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Mapped fault zone | Mapped fault zone | WCC DP fault zone |
| Hosted Full narrative + tech | The property is on the council's <fault> fault map. | <fault> fault zone. Restricts new builds and additions; surface-rupture damage is uninsurable for reinstatement. | Fault zone `<fault>` from WCC 2024 DP `wcc_hazards`. Pair with `fault_zone_ranking`. |

---

## hazards.fault_zone_ranking (`hazards.fault_zone_ranking`)
- What it measures: WCC fault-zone severity ranking (e.g. "High", "Medium", "mapped").
- Source authority: WCC 2024 DP.
- Dataset / endpoint: `wcc_hazards`.
- DataSource key(s): `wcc_hazards`.
- Table(s): `fault_zones`.
- Query path: `migrations/0054_flood_nearest_m.sql:138`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1234`.
- Threshold / classification logic: "high"→85, "medium"→60, else→45, `risk_score.py:511–516`.
- Score contribution: `fault_zone` severity.
- Coverage: Wellington City.
- Common misreading: "Mapped" without a severity label still scores ≥45.
- What it does NOT tell you: Slip rate.
- source_key status: TODO.
- User-care severity: Critical, Fault-zone ranking drives DP §5 building-consent setbacks.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Fault-zone ranking: <rank> | Fault-zone ranking, <rank> | WCC DP fault ranking, <rank> |
| On-screen finding | Council ranks this fault zone <rank>. | <rank> fault-zone ranking. High = strict consent restrictions on new builds. | Ranking `<rank>` from `wcc_hazards`. Score: H=85/M=60/other=45. |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Fault-zone ranking | Fault-zone severity | WCC DP fault ranking |
| Hosted Full narrative + tech | Council's grade for the fault zone here. | Severity = <rank>. Drives DP rules and insurer position on the site. | Ranking `<rank>` from WCC 2024 DP. Score: H=85/M=60/other=45. |

---

## hazards.active_fault_nearest (`hazards.active_fault_nearest`)
- What it measures: Distance and metadata for the nearest GNS active-fault trace (name, distance_m, slip_rate_mm_yr).
- Source authority: GNS Science Active Faults Database.
- Dataset / endpoint: GNS active faults.
- DataSource key(s): `gns_active_faults`.
- Table(s): `active_faults`.
- Query path: `migrations/0054_flood_nearest_m.sql:173`.
- Rendered by: `RiskHazardsSection.tsx:55` (ActiveFaultDetailCard); `HostedHazardAdvice.tsx`; findings `report_html.py:1243,4312`.
- Threshold / classification logic: ≤200 m + slip ≥1 mm/yr → warn; ≤2000 m → info.
- Score contribution:, (informs narrative; supplements WCC fault when no DP zone).
- Coverage: National.
- Common misreading: Slip rate of 1 mm/yr sounds tiny, over centuries it accumulates to metres of offset.
- What it does NOT tell you: Last-rupture date.
- source_key status: TODO, `_src("gns_faults")` exists in catalog but findings at 1243/4312 don't set it.
- User-care severity: Notable, Distance to the nearest GNS active fault sets context for shaking and rupture risk.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Nearest active fault: <name>, <dist> | Nearest active fault, <name>, <dist> | GNS active fault, <name>, <dist> |
| On-screen finding | Closest mapped fault is the <name>, about <dist> away. | Nearest active fault: <name>, <dist> away (slip <s> mm/yr). Within 200 m + ≥1 mm/yr = direct surface-rupture risk. | GNS nearest fault `<name>`, dist `<m>`, slip `<s> mm/yr`. ≤200 m + ≥1 mm/yr → warn. |
| Hosted Quick label | (out of scope: detail) | (out of scope: detail) | (out of scope: detail) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Nearest active fault | Nearest active fault | GNS active-fault nearest |
| Hosted Full narrative + tech | The closest mapped fault is the <name>, around <dist> away. | <name> fault is <dist> away with slip rate <s> mm/yr. Slip accumulates, 1 mm/yr = 1 m per millennium. | Nearest GNS active fault: name `<name>`, dist `<m>`, slip `<s> mm/yr`. Source: GNS Active Faults Database. |

---

## hazards.fault_avoidance_zone (`hazards.fault_avoidance_zone`)
- What it measures: Type of GNS fault avoidance zone the property sits in (e.g. "Type 1", "Type 2").
- Source authority: GNS Science.
- Dataset / endpoint: GNS active faults / fault avoidance zones.
- DataSource key(s): `gns_active_faults`.
- Table(s): `fault_avoidance_zones`.
- Query path: `migrations/0054_flood_nearest_m.sql:174`.
- Rendered by: `RiskHazardsSection.tsx:60` (FaultAvoidanceZoneCard); `HostedHazardAdvice.tsx`; finding `report_html.py:4313`.
- Threshold / classification logic: Presence drives advisory; surface-rupture restrictions per MfE 2003 guidelines.
- Score contribution:, (no direct indicator; informs `fault_zone` indirectly).
- Coverage: National.
- Common misreading: An avoidance zone is wider than the fault trace itself.
- What it does NOT tell you: Specific setback distance, local council interprets MfE guidelines.
- source_key status: TODO, `_src("gns_faults")` exists but not used at line 4313.
- User-care severity: Critical, Inside a fault-avoidance zone, limits new builds and additions.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | In fault avoidance zone, <type> | In fault avoidance zone, <type> | GNS FAZ, <type> |
| On-screen finding | Property is inside a fault avoidance zone (<type>). | Inside MfE-style fault avoidance zone <type>. Restricts what can be built on the site. | FAZ `<type>` (GNS). MfE 2003 guidelines drive council building consent rules. |
| Hosted Quick label | (out of scope: detail) | (out of scope: detail) | (out of scope: detail) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Fault avoidance zone | Fault avoidance zone | GNS fault avoidance zone |
| Hosted Full narrative + tech | The land is in a special "stay back from the fault" zone the council has flagged. | Avoidance zone <type>. Limits building type and habitable rooms within the setback. | FAZ `<type>` from GNS. Council interprets via MfE 2003 active fault guideline. |

---

## hazards.epb_count_300m (`hazards.epb_count_300m`)
- What it measures: Count of MBIE earthquake-prone buildings within 300 m.
- Source authority: MBIE Earthquake-Prone Building Register.
- Dataset / endpoint: MBIE EPB register.
- DataSource key(s): `epb_mbie` (data_loader.py:4949). Note: the `_src(...)` source-catalog key in `report_html.py` is `mbie_epb`, these are two different identifiers.
- Table(s): `earthquake_prone_buildings`.
- Query path: `migrations/0054_flood_nearest_m.sql:127`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:452,830`.
- Threshold / classification logic: ≥5 → warn.
- Score contribution: `epb` indicator, `risk_score.py:452`, normalize 0–15, weight 0.05.
- Coverage: National (MBIE register is national).
- Common misreading: "5 EPBs nearby" doesn't mean this property is EPB, it's neighbourhood building stock signal.
- What it does NOT tell you: Whether THIS specific building is EPB.
- source_key status: present, `_src("mbie_epb")` at `report_html.py:841,879`.
- User-care severity: Notable, Cluster of earthquake-prone buildings nearby flags older building stock and falling-debris risk.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | <N> EPBs within 300 m | <N> EPBs within 300 m | EPB count 300 m, <N> |
| On-screen finding | <N> earthquake-prone buildings within 300 m, older building stock around here. | <N> EPBs within 300 m, signals older building stock; check the MBIE register for this address. | `n=<N>` EPBs within 300 m. Score normalize_min_max(0, 15). Doesn't imply this address is EPB, see `epb_nearest`. |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | EPBs nearby | EPBs in 300 m | MBIE EPB count 300 m |
| Hosted Full narrative + tech | <N> earthquake-prone buildings within 300 m of here. | <N> EPBs in 300 m. Affects insurance pricing and resale optics; check this address itself on the MBIE register. | MBIE EPB count `<N>` within 300 m. Source: MBIE EPB register. |

---

## hazards.epb_nearest (`hazards.epb_nearest`)
- What it measures: Metadata for the nearest EPB (address, distance, deadline, NBS%).
- Source authority: MBIE.
- Dataset / endpoint: MBIE EPB register.
- DataSource key(s): `epb_mbie` (data_loader.py:4949). Note: `_src(...)` source-catalog key is `mbie_epb`, two different identifiers.
- Table(s): `earthquake_prone_buildings` (alias `epb_detail` in `0054:153`). The wording-file claim of a separate `mbie_epb` table is UNVERIFIED.
- Query path: `migrations/0054_flood_nearest_m.sql:153`.
- Rendered by: `HostedHazardAdvice.tsx`; finding `report_html.py:5037` (former_epb_at_property compound).
- Threshold / classification logic: (none).
- Score contribution:, (count drives indicator).
- Coverage: National.
- Common misreading: "Nearest EPB is 250 m away" doesn't mean this address is safe, it just means this address isn't on the register.
- What it does NOT tell you: This address's own EPB status, see `former_epb_at_property` for delisting signal.
- source_key status: present, `_src("mbie_epb")`.
- User-care severity: Notable, Nearest EPB with status informs neighbourhood building-stock quality.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: detail) | (out of scope: detail) | (out of scope: detail) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Nearest EPB | Nearest EPB | MBIE EPB nearest |
| Hosted Full narrative + tech | The closest building flagged as earthquake-prone is at <addr>. | Nearest EPB at <addr>, <dist> away. Building deadline <yr>. NBS <%>. | Nearest MBIE EPB: address `<addr>`, dist `<m>`, deadline `<yr>`, NBS `<%>`. |

---

## hazards.wind_zone (`hazards.wind_zone`)
- What it measures: BRANZ NZS 3604 wind zone classification ("Low" / "Medium" / "High" / "Very High" / "Extra High" / "Specific Engineering Design").
- Source authority: BRANZ / NZS 3604:2011.
- Dataset / endpoint: BRANZ wind zones layer.
- DataSource key(s): UNKNOWN, `branz_wind_zones` is not a registered DataSource in `data_loader.py`. The `wind_zones` table (alias `wz` in `0054:122`) is verifiable; the loader that populates it could not be located by name.
- Table(s): `wind_zones`.
- Query path: `migrations/0054_flood_nearest_m.sql:122`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:318,822`.
- Threshold / classification logic: severity_wind() lookup; "EH"/"SED" → warn.
- Score contribution: `wind` indicator, `risk_score.py:450`, weight 0.07.
- Coverage: All cities (national BRANZ map).
- Common misreading: "High" wind zone is normal in NZ, Extra High is the actionable level.
- What it does NOT tell you: Whether the dwelling was built to that zone's standard.
- source_key status: TODO, finding `report_html.py:824` has no `source_key`.
- User-care severity: Notable, BRANZ wind zone drives roof, cladding and bracing requirements (and cost).

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Wind zone: <zone> | NZS 3604 wind zone, <zone> | BRANZ wind zone, <zone> |
| On-screen finding | Wind here is rated <zone>, expect drafts and higher heating bills in winter. | <zone> wind zone (NZS 3604). Roof fastenings must meet zone spec; older homes often don't. | NZS 3604 wind zone = `<zone>`. Confirm fastener spec on consent file; "EH"/"SED" trigger SED engineering. |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Wind exposure | Wind exposure (NZS 3604) | BRANZ NZS 3604 wind zone |
| Hosted Full narrative + tech | The wind here is graded <zone>, the higher it is, the windier and chillier the section. | <zone> wind zone. Affects roof and frame fastener spec under NZS 3604 and heating bills. | BRANZ wind zone `<zone>` per NZS 3604:2011. Score weight 0.07. |

---

## hazards.wildfire_vhe_days (`hazards.wildfire_vhe_days`)
- What it measures: Average annual count of days at Very High or Extreme fire danger.
- Source authority: Scion (NZ Forest Research Institute).
- Dataset / endpoint: Scion wildfire risk layer.
- DataSource key(s): UNKNOWN, `scion_wildfire` is not a registered DataSource in `data_loader.py`. The `wildfire_risk` table (alias `wf` in `0054`) is verifiable; the loader name could not be located.
- Table(s): `wildfire_risk`.
- Query path: `migrations/0054_flood_nearest_m.sql:125`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:353,882`.
- Threshold / classification logic: ≥15 → warn (`report_html.py:888`); `lib/hazards.ts` `hasHighWildfireRisk()`, ≥15 OR (trend includes "increasing" AND ≥8).
- Score contribution: `wildfire` indicator, `risk_score.py:451`, normalize 0–30, weight 0.07.
- Coverage: All cities (national Scion model).
- Common misreading: VHE-day count above 15 is "above national median", not "very high" globally.
- What it does NOT tell you: Vegetation buffers, water access, Rural Fire District status.
- source_key status: TODO, finding has no `source_key`.
- User-care severity: Notable, Very-high or extreme fire-weather days affect insurance and outdoor-use risk.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | <N> Very High/Extreme fire days/yr | <N> VHE fire-risk days/yr | Scion VHE days/yr, <N> |
| On-screen finding | About <N> high fire-risk days a year here. Watch the vege and have a plan. | <N> VHE fire-risk days/yr, above national median. Insurance for wildfire and vegetation buffers matter. | Scion VHE days `<N>`/yr. Score normalize_min_max(0, 30). ≥15 = above-median wildfire signal. |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Wildfire risk days | Wildfire risk days | Scion VHE/yr |
| Hosted Full narrative + tech | About <N> high fire-risk days a year. Keep dry vegetation cleared in summer. | <N> Very High/Extreme fire-risk days/yr. Above the NZ median signals wildfire-relevant cover and buffers. | Scion VHE-day count `<N>`/yr. Source: Scion `wildfire_risk`. Score weight 0.07. |

---

## hazards.wildfire_trend (`hazards.wildfire_trend`)
- What it measures: Direction of multi-year change in wildfire days ("increasing", "stable", "decreasing").
- Source authority: Scion.
- Dataset / endpoint: Scion wildfire risk.
- DataSource key(s): UNKNOWN, `scion_wildfire` is not a registered DataSource in `data_loader.py`. The `wildfire_risk` table (alias `wf` in `0054`) is verifiable; the loader name could not be located.
- Table(s): `wildfire_risk`.
- Query path: `migrations/0054_flood_nearest_m.sql:126`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:354,2240`.
- Threshold / classification logic: `lib/hazards.ts` `hasHighWildfireRisk()`, "increasing" + ≥8 days qualifies.
- Score contribution:, (modifies wildfire risk threshold, not direct score).
- Coverage: National.
- Common misreading: This is a trend string, not a severity ("increasing" alone isn't a hazard rating, needs the day count too).
- What it does NOT tell you: Magnitude of increase.
- source_key status: TODO.
- User-care severity: Context, Direction of fire-weather trend over time, useful background.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Wildfire-day trend: <trend> | Wildfire-day trend, <trend> | Scion wildfire trend, <trend> |
| On-screen finding | Fire-risk days are <trend> in this area over recent years. | <trend> wildfire-day trend. Pair with the day count, increasing trend + ≥8 days is the actionable combo. | Trend `<trend>` (Scion). `hasHighWildfireRisk` triggers when "increasing" AND days ≥8. |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Wildfire trend | Wildfire-day trend | Scion wildfire-day trend |
| Hosted Full narrative + tech | High fire-risk days are <trend> here lately. | Trend = <trend>. NZ summers are getting hotter, so increasing trends compound the day count. | Trend `<trend>`. Modifies wildfire signal threshold; not directly scored. |

---

## hazards.coastal_exposure (`hazards.coastal_exposure`)
- What it measures: NIWA Coastal Sensitivity Index (CSI) assessment level (e.g. "High", "Medium", "Low").
- Source authority: NIWA.
- Dataset / endpoint: NIWA Coastal Sensitivity Index.
- DataSource key(s): UNKNOWN, `niwa_coastal_erosion` is not a registered DataSource in `data_loader.py`. The `coastal_erosion` table is populated by various council and national loaders.
- Table(s): `coastal_erosion`.
- Query path: `migrations/0054_flood_nearest_m.sql:123`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; `HostedCoastalTimeline.tsx`. (Note: `report_html.py:4363` reads `coastal_erosion`, not `coastal_exposure`, actual Insight rule line for `coastal_exposure` not located in this audit; field also surfaces via `report["coastal"]` overlay.)
- Threshold / classification logic: SEVERITY_COASTAL_EXPOSURE lookup. Overridden by SeaRise timeline `coastal.tier` when present (`risk_score.py:635–643`).
- Score contribution: `coastal` indicator, `risk_score.py:448`, weight 0.08. SeaRise timeline-driven when `report.coastal` is present.
- Coverage: All coastal cities (NIWA national).
- Common misreading: "Coastal exposure" lumps SLR + storm tide + erosion + inundation; specific risks live in subsidiary fields.
- What it does NOT tell you: Site-specific erosion line or SLR scenario.
- source_key status: TODO, finding at 406 has no `source_key` (catalog has `niwa_coastal`).
- User-care severity: Critical, Direct coastal exposure compounds storm-surge and sea-level-rise risk.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Coastal exposure: <level> | Coastal exposure, <level> | NIWA CSI, <level> |
| On-screen finding | Storm tides matter here, exposure rated <level>. | <level> coastal exposure (NIWA CSI). Combines SLR, storm tide, vertical land movement and inundation. | NIWA CSI = `<level>`. Overridden by SeaRise tier when `coastal.score_impact` present. |
| Hosted Quick label | Coastal | Coastal exposure (<level>) | NIWA CSI, <level> |
| Hosted Quick narrative | Storm tides reach this section in big weather. | <level> NIWA coastal sensitivity, sea-level-rise + storm tide combined. | NIWA CSI `<level>`; aggregate of SLR, storm tide, VLM, inundation. |
| Hosted Full label | Coastal exposure | Coastal exposure | NIWA Coastal Sensitivity Index |
| Hosted Full narrative + tech | Storm tides and king tides do more than wet the lawn here. Ask the landlord about past flooding. | <level> exposure on NIWA's index. Combines several coastal hazards into one figure. | `assessment_level = <level>` from NIWA CSI; `coastal_erosion` table. Weight 0.08. |

---

## hazards.coastal_erosion_exposure (`hazards.coastal_erosion_exposure`)
- What it measures: NIWA national coastal erosion exposure label (e.g. "high", "moderate").
- Source authority: NIWA.
- Dataset / endpoint: NIWA coastal erosion layer.
- DataSource key(s): UNKNOWN, `niwa_coastal_erosion` is not a registered DataSource in `data_loader.py`.
- Table(s): `coastal_erosion`.
- Query path: `migrations/0054_flood_nearest_m.sql:184`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:406`.
- Threshold / classification logic: SEVERITY_COASTAL_EROSION_EXPOSURE lookup. Used as fallback when `council_coastal_erosion` is missing.
- Score contribution: `coastal_erosion_council` fallback, `risk_score.py:625`.
- Coverage: National coastal coverage.
- Common misreading: This is regional exposure, not site-specific erosion line, that's `council_coastal_erosion`.
- What it does NOT tell you: Distance from the line, timeframe.
- source_key status: TODO.
- User-care severity: Notable, Regional erosion exposure label; site-specific line lives in the council layer.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | (out of scope: long-horizon coastal projection) | Coastal erosion exposure, <label> | NIWA erosion exposure, <label> |
| On-screen finding | (out of scope: long-horizon coastal projection) | <label> NIWA erosion exposure. Site-specific line lives in council coastal erosion data. | NIWA erosion exposure `<label>`. Fallback when `council_coastal_erosion` empty. |
| Hosted Quick label | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: long-horizon coastal projection) | Coastal erosion exposure | NIWA erosion exposure |
| Hosted Full narrative + tech | (out of scope: long-horizon coastal projection) | <label> NIWA erosion exposure. Treat the council layer as authoritative for the actual line. | `exposure = <label>` from NIWA. Drops out when council_coastal_erosion is set. |

---

## hazards.coastal_erosion_timeframe (`hazards.coastal_erosion_timeframe`)
- What it measures: NIWA-modelled timeframe (years) for the erosion projection.
- Source authority: NIWA.
- Dataset / endpoint: NIWA coastal erosion.
- DataSource key(s): UNKNOWN, `niwa_coastal_erosion` is not a registered DataSource in `data_loader.py`.
- Table(s): `coastal_erosion`.
- Query path: `migrations/0054_flood_nearest_m.sql:185`.
- Rendered by: `HostedHazardAdvice.tsx`.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: National coastal.
- Common misreading: "100-year timeframe" doesn't mean "no concern for 100 years", it means the modelled retreat distance over 100 years.
- What it does NOT tell you: SLR scenario assumed.
- source_key status: N/A.
- User-care severity: Notable, Timeframe scales the urgency of erosion exposure.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: not on screen) | (out of scope: not on screen) | (out of scope: not on screen) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: detail) | (out of scope: detail) | (out of scope: detail) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: long-horizon coastal projection) | NIWA erosion timeframe | NIWA erosion timeframe |
| Hosted Full narrative + tech | (out of scope: long-horizon coastal projection) | NIWA modelled erosion over <yr> years. Compare against your hold period. | Timeframe `<yr>` from NIWA `coastal_erosion`. |

---

## hazards.council_coastal_erosion (`hazards.council_coastal_erosion`)
- What it measures: JSON object, distance to council-mapped erosion line + scenario + timeframe (e.g. Auckland ASCIE, Tauranga, etc.).
- Source authority: Regional councils.
- Dataset / endpoint: Council coastal erosion ArcGIS layers.
- DataSource key(s): `auckland_coastal_erosion` (5104), `auckland_coastal_erosion_2130` (8024), `tauranga_coastal_erosion` (5562), +regional. (`auckland_ascie` and `tauranga_coastal` plain are NOT registered keys.)
- Table(s): `coastal_erosion`.
- Query path: `migrations/0054_flood_nearest_m.sql:182`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1387`.
- Threshold / classification logic: distance_m mapped 0–500 m to score 100→0 in `risk_score.py:615–617`. <200 m → warn finding.
- Score contribution: `coastal_erosion_council` indicator, `risk_score.py:615`, weight 0.08. Suppressed by `coastal` SeaRise override.
- Coverage: WIRING-TRACES Coastal Eros column, Y in 14 cities.
- Common misreading: Distance to erosion line ≠ distance to current shoreline.
- What it does NOT tell you: Active mitigation (revetment, seawall).
- source_key status: TODO, finding has no `source_key` (catalog `council_coastal`).
- User-care severity: Critical, Council erosion-prone designation can restrict consents and insurance.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | (out of scope: long-horizon projection) | Coastal erosion projection within <N> m | Council ASCIE, <N> m, <yr>-yr |
| On-screen finding | (out of scope: long-horizon projection) | Council projects erosion to within <N> m by <yr>. Affects insurance and resale on long holds. | `council_coastal_erosion` distance `<m>`, timeframe `<yr>`, scenario `<scen>`. Score normalize_min_max(0, 500, inverse). |
| Hosted Quick label | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: long-horizon projection) | Council coastal erosion | Council coastal erosion line |
| Hosted Full narrative + tech | (out of scope: long-horizon projection) | Erosion projection within <N> m by <yr> (council). Ask the insurer about coastal hazard policy before unconditional. | distance `<m>`, scenario `<scen>`, timeframe `<yr>`. Source: regional council `coastal_erosion`. |

---

## hazards.coastal_elevation_cm (`hazards.coastal_elevation_cm`)
- What it measures: Elevation above mean high water springs (cm).
- Source authority: LINZ coastal DEM.
- Dataset / endpoint: LINZ coastal DEM.
- DataSource key(s): `coastal_elevation` (data_loader.py:4979, GWRC Coastal Elevation). (`linz_coastal_dem` is NOT a registered DataSource key.)
- Table(s): `coastal_elevation`.
- Query path: `migrations/0054_flood_nearest_m.sql:166` (m × 100).
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; `HostedCoastalTimeline.tsx`; findings `report_html.py:977,1422`.
- Threshold / classification logic: ≤50 cm → warn; ≤150 cm → info. Compounds with tsunami signal in §2.3 rule (`report_html.py:987`).
- Score contribution:, (informs tsunami compound and coastal narrative).
- Coverage: Coastal national (LINZ).
- Common misreading: cm above MHWS isn't elevation AMSL, it's relative to the king-tide line.
- What it does NOT tell you: Storm surge or wave height.
- source_key status: TODO.
- User-care severity: Critical, Low coastal elevation compounds tsunami and surge risk.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | <N> cm above king-tide line | <N> cm above MHWS | LINZ MHWS+<N> cm |
| On-screen finding | Only <N> cm above the highest normal tide. Storms can wash over. | <N> cm above MHWS. Below 50 cm, storm surge reaches the section. | Elevation `<N>` cm above MHWS (LINZ DEM). Compounds with tsunami zone + low terrain elevation. |
| Hosted Quick label | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Elevation above MHWS | Elevation above MHWS | LINZ MHWS+ elevation |
| Hosted Full narrative + tech | The section sits about <N> cm above the highest normal tide. | <N> cm above mean high water springs. Storm surge typically adds 0.5–1 m on top, below 1 m is exposed. | Elevation `<N>` cm above MHWS from LINZ coastal DEM. ≤50 → warn; ≤150 → info. |

---

## hazards.coastal_inundation_ranking (`hazards.coastal_inundation_ranking`)
- What it measures: MfE/HBRC coastal inundation severity ranking ("High" / "Medium" / "Low").
- Source authority: MfE / HBRC coastal inundation modelling.
- Dataset / endpoint: MfE coastal inundation + HBRC inundation.
- DataSource key(s): `coastal_inundation` (data_loader.py:5004, WCC Coastal Inundation + SLR). (`mfe_coastal_inundation` and `hbrc_inundation` are NOT registered DataSource keys.)
- Table(s): `coastal_inundation`.
- Query path: `migrations/0054_flood_nearest_m.sql:167`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; `HostedCoastalTimeline.tsx`; finding `report_html.py:1124`.
- Threshold / classification logic: "High" → warn finding.
- Score contribution:, (informs `coastal` narrative; not direct).
- Coverage: National coastal where MfE/HBRC data exists.
- Common misreading: This is a future-scenario projection, not today's flood risk.
- What it does NOT tell you: Today's storm-surge risk in isolation.
- source_key status: TODO.
- User-care severity: Critical, Coastal inundation ranking quantifies design-event flooding from the sea.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | (out of scope: future SLR scenario) | Coastal inundation ranking, <rank> | MfE inundation, <rank> |
| On-screen finding | (out of scope: future SLR scenario) | <rank> coastal inundation under future SLR scenario. Insurers tightening cover in mapped zones. | MfE/HBRC inundation `<rank>`. Future-scenario projection (SLR + storm tide). |
| Hosted Quick label | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: future SLR scenario) | Coastal inundation (future) | MfE/HBRC inundation ranking |
| Hosted Full narrative + tech | (out of scope: future SLR scenario) | <rank> ranking under future SLR + storm-surge. Ask your insurer about coastal hazard policy now. | Ranking `<rank>` from `coastal_inundation` (MfE / HBRC). Future-scenario, not present-day. |

---

## hazards.coastal_inundation_scenario (`hazards.coastal_inundation_scenario`)
- What it measures: Scenario behind the coastal inundation projection (e.g. "+1m SLR", "+1.5m by 2120").
- Source authority: MfE.
- Dataset / endpoint: MfE coastal inundation.
- DataSource key(s): `coastal_inundation` (data_loader.py:5004, WCC Coastal Inundation + SLR). (`mfe_coastal_inundation` is NOT a registered DataSource key.)
- Table(s): `coastal_inundation`.
- Query path: `migrations/0054_flood_nearest_m.sql:168`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1125`.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: Same as ranking.
- Common misreading: Scenario name isn't a forecast, it's a "what-if".
- What it does NOT tell you: Probability the scenario will occur by a given date.
- source_key status: TODO.
- User-care severity: Notable, Scenario clarifies which sea-level-rise pathway the ranking assumes.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | (out of scope: future SLR scenario) | Inundation scenario, <scen> | MfE inundation scenario, <scen> |
| On-screen finding | (out of scope: future SLR scenario) | Modelled under <scen>. Compare against IPCC scenarios for your hold period. | Scenario `<scen>` from MfE. Not a forecast, a what-if SLR projection. |
| Hosted Quick label | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) | (out of scope: rolled into `coastal_exposure`) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: future SLR scenario) | Inundation scenario | MfE inundation scenario |
| Hosted Full narrative + tech | (out of scope: future SLR scenario) | <scen> SLR scenario assumed. Under more extreme IPCC pathways, exposure starts earlier. | Scenario `<scen>` (MfE coastal inundation). |

---

## hazards.on_erosion_prone_land (`hazards.on_erosion_prone_land`)
- What it measures: Boolean, property is on GWRC-flagged erosion-prone land (slope category).
- Source authority: GWRC.
- Dataset / endpoint: GWRC erosion-prone land layer.
- DataSource key(s): `erosion_prone_land` (data_loader.py:5014, GWRC Erosion Prone Land). (`gwrc_erosion_prone` is NOT a registered DataSource key.)
- Table(s): `erosion_prone_land`.
- Query path: `migrations/0054_flood_nearest_m.sql:170`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1111`.
- Threshold / classification logic: Boolean. True → warn finding referencing min slope angle.
- Score contribution:, (slope_failure indirectly via slope angle).
- Coverage: GWRC region (Wellington, Lower Hutt, Upper Hutt, Porirua, Kapiti Coast).
- Common misreading: "Erosion-prone land" sounds like coastal, here it means too steep for standard building.
- What it does NOT tell you: Whether engineering consent has been obtained.
- source_key status: TODO.
- User-care severity: Critical, On council-flagged erosion-prone land: consent and insurance constraints likely.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | On erosion-prone land (≥<°>°) | On erosion-prone land (≥<°>°) | GWRC erosion-prone land |
| On-screen finding | The slope here is steep enough that the council flags it as erosion-prone. | Slope ≥<°>°. New work likely needs slope-stability report; check LIM for engineering consent notices. | GWRC `on_erosion_prone = true`, min angle `<°>°`. Standard building consent may not apply. |
| Hosted Quick label | (out of scope: GWRC-only) | (out of scope: GWRC-only) | (out of scope: GWRC-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Erosion-prone land | Erosion-prone land | GWRC erosion-prone land |
| Hosted Full narrative + tech | The slope here is steep, council needs extra checks before any building. | Mapped as erosion-prone (≥<°>° slope). Slope-stability report standard for new work. | Boolean `on_erosion_prone = true` from GWRC. Pair with `erosion_min_angle`. |

---

## hazards.erosion_min_angle (`hazards.erosion_min_angle`)
- What it measures: Minimum slope angle that triggered the erosion-prone classification (degrees).
- Source authority: GWRC.
- Dataset / endpoint: GWRC erosion-prone land layer.
- DataSource key(s): `erosion_prone_land` (data_loader.py:5014, GWRC Erosion Prone Land). (`gwrc_erosion_prone` is NOT a registered DataSource key.)
- Table(s): `erosion_prone_land`.
- Query path: `migrations/0054_flood_nearest_m.sql:171`.
- Rendered by: `HostedHazardAdvice.tsx`; finding `report_html.py:1112`.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: GWRC region.
- Common misreading: Min angle ≠ actual slope of the building platform.
- What it does NOT tell you: Building platform's actual slope.
- source_key status: TODO.
- User-care severity: Context, Minimum slope angle behind erosion-prone status; technical context.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: combined into "On erosion-prone land") | (out of scope: combined) | (out of scope: combined) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: GWRC-only) | (out of scope: GWRC-only) | (out of scope: GWRC-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Erosion-prone min angle | Erosion-prone min angle | GWRC erosion-prone min angle |
| Hosted Full narrative + tech | The minimum slope that triggers council's erosion rule is <°>°. | Min angle that triggered classification = <°>°. Building platform may differ, confirm on consent file. | `erosion_min_angle = <°>°` (GWRC). Trigger threshold for erosion-prone designation. |

---

## hazards.overland_flow_within_50m (`hazards.overland_flow_within_50m`)
- What it measures: Boolean, overland flow path within 50 m of the property.
- Source authority: WCC + Auckland Council.
- Dataset / endpoint: WCC + AC overland flow path layers.
- DataSource key(s): `auckland_overland_flow` (data_loader.py:5062). (`wcc_overland_flow` and `ac_overland_flow` are NOT registered DataSource keys; WCC overland flow may be loaded via `wcc_hazards`.)
- Table(s): `overland_flow_paths`.
- Query path: `migrations/0054_flood_nearest_m.sql:180`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; findings `report_html.py:1008,1014,1379,2581`.
- Threshold / classification logic: Boolean. True → score 45.
- Score contribution: `overland_flow` indicator, `risk_score.py:598`, weight 0.04.
- Coverage: WIRING-TRACES Overland Flow column, Auckland Y, others none.
- Common misreading: "Overland flow" isn't a creek, it's a heavy-rain runoff path.
- What it does NOT tell you: Depth, velocity, or whether the building sits in the path.
- source_key status: TODO.
- User-care severity: Notable, Overland flow path nearby raises localised flood risk regardless of zone status.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Overland flow path within 50 m | Overland flow path within 50 m | OFP within 50 m |
| On-screen finding | A storm-runoff path runs within 50 m of here. Watch downhill drainage. | Overland flow path within 50 m. Heavy rain may push surface water across the section, check floor levels. | OFP within 50 m (WCC/AC). Compounds slope-failure §2.10 rule when slope is medium+. |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Overland flow path nearby | Overland flow path nearby | Council overland flow path |
| Hosted Full narrative + tech | A storm-runoff route runs near the property. Heavy rain pushes water through here. | OFP within 50 m. In big rain events, surface water follows mapped paths, building floor level vs path matters. | Boolean true. Source: `wcc_overland_flow` / `ac_overland_flow`. Score 45, weight 0.04. |

---

## hazards.aircraft_noise_name (`hazards.aircraft_noise_name`)
- What it measures: Name of the aircraft noise overlay the property is in (e.g. "Wellington Airport ANZ").
- Source authority: Council airport noise overlays.
- Dataset / endpoint: `airport_noise_overlay`.
- DataSource key(s): `auckland_aircraft_noise` (5084), `chch_airport_noise_*`, `dunedin_airport_noise`, +regional. (`airport_noise_overlay` is the target table, NOT a DataSource key.)
- Table(s): `aircraft_noise_overlay`.
- Query path: `migrations/0054_flood_nearest_m.sql:176`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1338`.
- Threshold / classification logic: Presence drives advisory; severity from category.
- Score contribution:, (dBA drives indicator).
- Coverage: Cities with airports under flight paths.
- Common misreading: Being in the named overlay doesn't mean constant noise, it's a planning designation.
- What it does NOT tell you: Hours of operation, specific dB at the address.
- source_key status: TODO, finding has no `source_key`.
- User-care severity: Context, Names the airport noise overlay; severity lives in dBA and category fields.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Aircraft noise overlay: <name> | Aircraft noise overlay, <name> | Aircraft noise overlay, <name> |
| On-screen finding | The property is inside the <name> overlay. | Inside the <name> aircraft noise overlay. Affects sleep amenity and may require acoustic insulation. | Aircraft noise overlay = `<name>`. Drives DP rules on bedrooms + acoustic spec. |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Aircraft noise overlay | Aircraft noise overlay | Council airport noise overlay |
| Hosted Full narrative + tech | The property is inside the <name> aircraft noise area. | Inside <name> overlay. Bedrooms typically need double glazing under DP rules. | Overlay name `<name>` from `aircraft_noise_overlay`. |

---

## hazards.aircraft_noise_dba (`hazards.aircraft_noise_dba`)
- What it measures: Aircraft noise level (dBA Ldn or similar, council-specific).
- Source authority: Councils.
- Dataset / endpoint: `airport_noise_overlay`.
- DataSource key(s): `auckland_aircraft_noise` (5084), `chch_airport_noise_*`, `dunedin_airport_noise`, +regional. (`airport_noise_overlay` is the target table, NOT a DataSource key.)
- Table(s): `aircraft_noise_overlay`.
- Query path: `migrations/0054_flood_nearest_m.sql:177`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1340`.
- Threshold / classification logic: normalize_min_max(50, 75) feeds aircraft_noise indicator.
- Score contribution: `aircraft_noise` indicator, `risk_score.py:604`, weight 0.05.
- Coverage: Cities with airport noise overlays.
- Common misreading: dBA at the overlay edge is a contour minimum, not the at-property exact level.
- What it does NOT tell you: Time-of-day distribution.
- source_key status: TODO.
- User-care severity: Notable, dBA level affects daily liveability and insulation requirements.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Aircraft noise: <N> dBA | Aircraft noise, <N> dBA | Aircraft noise, <N> dBA |
| On-screen finding | Aircraft noise is rated <N> dBA here. | <N> dBA aircraft noise. WHO 2018 night-noise guideline is 40 dB Lnight; 60+ disturbs sleep for most. | Aircraft noise `<N>` dBA. Score normalize_min_max(50, 75). |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Aircraft noise level | Aircraft noise level | Aircraft noise dBA |
| Hosted Full narrative + tech | Aircraft noise is rated about <N> dBA, the higher, the louder. | <N> dBA. Compare to WHO Lnight 40 dB and DP threshold 55 dB Ldn. | dBA `<N>` from `aircraft_noise_overlay`. WHO 2018 night-noise comparator. |

---

## hazards.aircraft_noise_category (`hazards.aircraft_noise_category`)
- What it measures: Council category for the noise overlay ("High", "Medium", etc.).
- Source authority: Councils.
- Dataset / endpoint: `airport_noise_overlay`.
- DataSource key(s): `auckland_aircraft_noise` (5084), `chch_airport_noise_*`, `dunedin_airport_noise`, +regional. (`airport_noise_overlay` is the target table, NOT a DataSource key.)
- Table(s): `aircraft_noise_overlay`.
- Query path: `migrations/0054_flood_nearest_m.sql:178`.
- Rendered by: `RiskHazardsSection.tsx`; `HostedHazardAdvice.tsx`; finding `report_html.py:1341`.
- Threshold / classification logic: "High" → warn severity in finding.
- Score contribution:, (dBA scores).
- Coverage: Same as overlay.
- Common misreading: Category is council-specific shorthand; dBA is the comparable figure.
- What it does NOT tell you: Hours.
- source_key status: TODO.
- User-care severity: Context, Council shorthand; the dBA value is the comparable read.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Aircraft noise category: <cat> | Aircraft noise category, <cat> | Aircraft noise, <cat> |
| On-screen finding | Council labels this <cat> for aircraft noise. | <cat> aircraft noise category. High = bedrooms typically need acoustic upgrade per DP rules. | Category `<cat>` from `aircraft_noise_overlay`. Drives finding severity. |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Aircraft noise category | Aircraft noise category | Council aircraft noise category |
| Hosted Full narrative + tech | Council's noise grade for this overlay is <cat>. | <cat>. Pair with the dBA value, category is the council's qualitative summary. | Council category `<cat>`. dBA is the comparable signal. |

---

## hazards.geotech_count_500m (`hazards.geotech_count_500m`)
- What it measures: Count of geotechnical reports filed within 500 m (council registers).
- Source authority: WCC + Auckland Council.
- Dataset / endpoint: WCC + AC geotech registers.
- DataSource key(s): `auckland_geotech` (data_loader.py:5119). (`wcc_geotech` and `ac_geotech` are NOT registered DataSource keys.)
- Table(s): `geotechnical_reports`.
- Query path: `migrations/0054_flood_nearest_m.sql:194`.
- Rendered by: `HostedHazardAdvice.tsx`; finding `report_html.py:1368`.
- Threshold / classification logic: ≥10 → info finding (area has known ground issues).
- Score contribution: (none).
- Coverage: Wellington City + Auckland.
- Common misreading: High count isn't always negative, older suburbs tend to have many reports filed.
- What it does NOT tell you: Whether THIS site has been investigated.
- source_key status: TODO.
- User-care severity: Context, Neighbourhood geotech filings; not a site-specific signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: not on screen) | (out of scope: not on screen) | (out of scope: not on screen) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Geotech reports nearby | Geotech reports nearby | Geotech reports 500 m |
| Hosted Full narrative + tech | <N> geotech reports have been filed within 500 m of here. | <N> geotech reports nearby, request relevant ones from council; previous investigations save thousands. | `<N>` `geotechnical_reports` rows within 500 m. Source: WCC + AC geotech registers. |

---

## hazards.geotech_nearest_hazard (`hazards.geotech_nearest_hazard`)
- What it measures: Hazard tag from the nearest filed geotech report.
- Source authority: WCC + AC.
- Dataset / endpoint: `geotechnical_reports`.
- DataSource key(s): `auckland_geotech` (data_loader.py:5119). (`wcc_geotech` and `ac_geotech` are NOT registered DataSource keys.)
- Table(s): `geotechnical_reports`.
- Query path: `migrations/0054_flood_nearest_m.sql:195`.
- Rendered by: `HostedHazardAdvice.tsx`; finding `report_html.py:1370`.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: WCC + Auckland.
- Common misreading: A nearest-hazard tag of "settlement" doesn't mean THIS site has settled.
- What it does NOT tell you: Site-specific findings.
- source_key status: TODO.
- User-care severity: Context, Neighbourhood geotech tag; not a site-specific signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: not on screen) | (out of scope: not on screen) | (out of scope: not on screen) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Nearest geotech flag | Nearest geotech flag | Nearest geotech hazard tag |
| Hosted Full narrative + tech | The closest geotech report flags <hazard>. | Nearest report tags <hazard>. Useful as a heads-up for the surveyor; site-specific report still required. | Nearest `geotechnical_reports.hazard = <hazard>`. Source: WCC / AC registers. |

---

## hazards.solar_mean_kwh (`hazards.solar_mean_kwh`)
- What it measures: Mean annual solar radiation at the property (kWh/m²/yr).
- Source authority: WCC solar radiation modelling.
- Dataset / endpoint: WCC solar.
- DataSource key(s): `wcc_solar`.
- Table(s): `wcc_solar_radiation`.
- Query path: `migrations/0054_flood_nearest_m.sql:154`.
- Rendered by: `RiskHazardsSection.tsx:132` (SolarPotentialCard); `HostedHazardAdvice.tsx`; finding `report_html.py:1294`.
- Threshold / classification logic: ≥1200 → "good" environment finding; <800 → "low solar" info.
- Score contribution:, (informs liveability narrative).
- Coverage: Wellington City only.
- Common misreading: kWh/m²/yr is sun resource, not actual panel output (depends on tilt + shading).
- What it does NOT tell you: Tree shading or roof orientation.
- source_key status: TODO.
- User-care severity: Context, Annual solar yield, useful for siting panels but not a hazard.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Solar potential: <N> kWh/m²/yr | Solar potential, <N> kWh/m²/yr | WCC solar mean, <N> kWh/m²/yr |
| On-screen finding | The section gets <N> kWh/m²/yr of sun on average. | <N> kWh/m²/yr, above 1200 = panels viable; below 800 = expect higher heating bills and gloomy winters. | Mean solar `<N>` kWh/m²/yr. Source: WCC solar radiation model. |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Solar resource | Solar resource | WCC mean solar radiation |
| Hosted Full narrative + tech | This section gets about <N> kWh of sun per square metre each year, higher = sunnier. | Mean <N> kWh/m²/yr. Compare against 1200 kWh threshold for panel viability. | WCC `mean_yearly_solar = <N>` kWh/m²/yr. Wellington-only. |

---

## hazards.solar_max_kwh (`hazards.solar_max_kwh`)
- What it measures: Maximum annual solar radiation across the parcel.
- Source authority: WCC.
- Dataset / endpoint: WCC solar.
- DataSource key(s): `wcc_solar`.
- Table(s): `wcc_solar_radiation`.
- Query path: `migrations/0054_flood_nearest_m.sql:155`.
- Rendered by: `RiskHazardsSection.tsx:132`; `HostedHazardAdvice.tsx`. No finding rule.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: Wellington City.
- Common misreading: "Max" is the sunniest spot on the parcel, not the building roof.
- What it does NOT tell you: Where the max is.
- source_key status: N/A.
- User-care severity: Context, Peak-month solar yield; supplementary detail.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Best spot solar: <N> kWh/m²/yr | Best spot solar, <N> kWh/m²/yr | WCC solar max, <N> kWh/m²/yr |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: Wellington-only) | (out of scope: Wellington-only) | (out of scope: Wellington-only) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Solar resource, best spot | Solar resource, best spot | WCC max solar radiation |
| Hosted Full narrative + tech | The sunniest part of the section gets up to <N> kWh/m² a year. | Max <N> kWh/m²/yr on the sunniest part of the parcel, useful for siting panels or a deck. | WCC `max_yearly_solar = <N>` kWh/m²/yr. Wellington-only. |

---

## terrain.elevation_m (`terrain.elevation_m`)
- What it measures: Property elevation above sea level (m).
- Source authority: LINZ 8m DEM (computed by WhareScore).
- Dataset / endpoint: LINZ 8m DEM raster sample.
- DataSource key(s): UNKNOWN, `linz_8m_dem` is not a registered DataSource in `data_loader.py`. Terrain values are computed in `snapshot_generator.py` from a raster sample; the loader (if any) for the underlying DEM file is not exposed as a DataSource row.
- Table(s): Derived from raster (no table).
- Query path: `snapshot_generator.py:939` (terrain_data), not in `get_property_report()`. Surfaced via `_overlay_terrain_data` (property.py).
- Rendered by: `HostedTerrain.tsx:182`. Drives `snapshot_generator.py` advisories at lines 1471, 1487.
- Threshold / classification logic: §2.3 tsunami compound rule uses ≤5 m as "low" (`report_html.py:987`).
- Score contribution:, (informs other indicators).
- Coverage: National.
- Common misreading: 8 m DEM resolution misses small hills; ±2 m typical on flat land.
- What it does NOT tell you: Height above local stream or coast.
- source_key status: TODO, `_src("srtm")` exists but `linz_8m_dem` is the actual source; advisory text doesn't currently set source_key.
- User-care severity: Context, Elevation is context for wind, flood and coastal exposure.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: terrain section is hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Elevation | Elevation above sea level | LINZ 8m DEM elevation |
| Hosted Full narrative + tech | The land sits about <N> m above sea level. | <N> m elevation. Below 5 m on flat ground compounds tsunami and storm-surge exposure. | Sampled elevation `<N>` m from LINZ 8m DEM. ±2 m typical on flat terrain. |

---

## terrain.slope_degrees (`terrain.slope_degrees`)
- What it measures: Computed slope of the building platform (degrees).
- Source authority: LINZ 8m DEM (computed by WhareScore).
- Dataset / endpoint: DEM-derived.
- DataSource key(s): UNKNOWN, `linz_8m_dem` is not a registered DataSource in `data_loader.py`. Terrain values are computed in `snapshot_generator.py` from a raster sample; the loader (if any) for the underlying DEM file is not exposed as a DataSource row.
- Table(s): Derived.
- Query path: `snapshot_generator.py:939`.
- Rendered by: `HostedTerrain.tsx:183`. Advisories `snapshot_generator.py:1404,1509`.
- Threshold / classification logic: SnapGen advisory thresholds (>15° = steep, etc.).
- Score contribution:, (feeds slope_failure indirectly via terrain).
- Coverage: National.
- Common misreading: 8 m DEM smooths small steps; the actual building cut may be steeper.
- What it does NOT tell you: Retaining wall presence.
- source_key status: TODO.
- User-care severity: Notable, Slope angle drives drainage, retaining-wall and access cost.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Slope | Slope angle | LINZ DEM slope |
| Hosted Full narrative + tech | The section slopes about <°>°. Steeper = harder to garden, drain, and build on. | <°>° slope. Above 15° = steep section; affects mowing, drainage, retaining-wall maintenance. | Slope `<°>°` derived from LINZ 8m DEM. Smoothed; actual cut may exceed. |

---

## terrain.slope_category (`terrain.slope_category`)
- What it measures: Categorical slope label (flat / gentle / moderate / steep / very steep).
- Source authority: WhareScore.
- Dataset / endpoint: DEM-derived.
- DataSource key(s): UNKNOWN, `linz_8m_dem` is not a registered DataSource in `data_loader.py`. Terrain values are computed in `snapshot_generator.py` from a raster sample; the loader (if any) for the underlying DEM file is not exposed as a DataSource row.
- Table(s): Derived.
- Query path: `snapshot_generator.py:939`.
- Rendered by: `HostedTerrain.tsx:184`. No finding rule.
- Threshold / classification logic: WhareScore band lookup (UNKNOWN, exact thresholds not located in this read; defined in snapshot_generator).
- Score contribution: (none).
- Coverage: National.
- Common misreading: Categorical hides scale, "moderate" can be 8–15° depending on band.
- What it does NOT tell you: Direction.
- source_key status: N/A.
- User-care severity: Notable, Banded slope category is the user-readable form of slope angle.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Slope category | Slope category | Slope category |
| Hosted Full narrative + tech | The section is "<cat>" for slope. | <cat>. Pair with the angle in degrees for the precise figure. | Categorical `<cat>` derived from slope degrees. |

---

## terrain.aspect_label (`terrain.aspect_label`)
- What it measures: Compass aspect label of the dominant slope (N / NE / E / SE / S / SW / W / NW / flat).
- Source authority: WhareScore (DEM-derived).
- Dataset / endpoint: DEM-derived.
- DataSource key(s): UNKNOWN, `linz_8m_dem` is not a registered DataSource in `data_loader.py`. Terrain values are computed in `snapshot_generator.py` from a raster sample; the loader (if any) for the underlying DEM file is not exposed as a DataSource row.
- Table(s): Derived.
- Query path: `snapshot_generator.py:939`.
- Rendered by: `HostedTerrain.tsx:185`; advisory `snapshot_generator.py:1419`.
- Threshold / classification logic: South-facing → poor sun finding.
- Score contribution: (none).
- Coverage: National.
- Common misreading: Aspect of the section ≠ aspect of the house's main living areas.
- What it does NOT tell you: Window orientation.
- source_key status: N/A.
- User-care severity: Context, Aspect (north-facing etc.) is a sun and warmth signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Aspect | Aspect | Aspect (compass) |
| Hosted Full narrative + tech | The section faces <aspect>, north-facing gets the most sun. | <aspect> aspect. North-facing = warmer in winter, more usable outdoor space. | Aspect `<aspect>` derived from DEM. Section aspect ≠ window orientation. |

---

## terrain.aspect_degrees (`terrain.aspect_degrees`)
- What it measures: Aspect in degrees (0=N, 90=E, etc.).
- Source authority: WhareScore.
- Dataset / endpoint: DEM-derived.
- DataSource key(s): UNKNOWN, `linz_8m_dem` is not a registered DataSource in `data_loader.py`. Terrain values are computed in `snapshot_generator.py` from a raster sample; the loader (if any) for the underlying DEM file is not exposed as a DataSource row.
- Table(s): Derived.
- Query path: `snapshot_generator.py:939`.
- Rendered by: `HostedTerrain.tsx:186`. No finding.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: National.
- Common misreading: Numeric aspect with no label is opaque.
- What it does NOT tell you: Sun-hours.
- source_key status: N/A.
- User-care severity: Background, Numeric aspect; the label is the read.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Aspect (degrees) | Aspect (degrees) | Aspect degrees |
| Hosted Full narrative + tech | The section's compass direction is <°>°. | Aspect <°>° (0=N, 90=E). Pair with the label for clarity. | Aspect `<°>°` from DEM. |

---

## terrain.flood_terrain_score (`terrain.flood_terrain_score`)
- What it measures: WhareScore-computed flood-terrain risk score (1–4, where 4 = flat depression at low elevation).
- Source authority: WhareScore (DEM-derived).
- Dataset / endpoint: DEM-derived.
- DataSource key(s): UNKNOWN, `linz_8m_dem` is not a registered DataSource in `data_loader.py`. Terrain values are computed in `snapshot_generator.py` from a raster sample; the loader (if any) for the underlying DEM file is not exposed as a DataSource row.
- Table(s): Derived.
- Query path: `snapshot_generator.py:939`.
- Rendered by: `HostedTerrain.tsx`; advisory `report_html.py:1538,1548`.
- Threshold / classification logic: ≥3 with no council flood data → 25–35 flood score boost (`risk_score.py:653–654`).
- Score contribution: `flood` terrain boost, `risk_score.py:653–654`.
- Coverage: National.
- Common misreading: A high flood-terrain score doesn't mean council says it's a flood zone, it's a soft inferred signal.
- What it does NOT tell you: Drainage capacity.
- source_key status: TODO.
- User-care severity: Background, Internal terrain-derived flood score; main flood fields carry the meaning.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Flood-terrain inference | Flood-terrain inference | DEM flood-terrain score |
| Hosted Full narrative + tech | The shape of the land here can collect water, a soft warning, not a council map. | Flood-terrain score <N>/4. Soft signal: flat depressions at low elevation flood even without a mapped zone. | Score `<N>/4` from DEM (depression + low elevation). Boosts flood indicator only when no council flood data. |

---

## terrain.wind_exposure_score (`terrain.wind_exposure_score`)
- What it measures: WhareScore-computed wind-exposure score (1–5, ridgeline / hilltop = high).
- Source authority: WhareScore (DEM-derived).
- Dataset / endpoint: DEM-derived.
- DataSource key(s): UNKNOWN, `linz_8m_dem` is not a registered DataSource in `data_loader.py`. Terrain values are computed in `snapshot_generator.py` from a raster sample; the loader (if any) for the underlying DEM file is not exposed as a DataSource row.
- Table(s): Derived.
- Query path: `snapshot_generator.py:939`.
- Rendered by: `HostedTerrain.tsx`. No finding.
- Threshold / classification logic: ≥4 with low wind score → boost wind to 35–50 (`risk_score.py:669–670`).
- Score contribution: `wind` terrain boost, `risk_score.py:669–670`.
- Coverage: National.
- Common misreading: Score is exposure, not measured wind speed.
- What it does NOT tell you: Prevailing wind direction.
- source_key status: N/A.
- User-care severity: Context, Inferred from terrain; the BRANZ wind zone is the primary read.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Wind-exposure inference | Wind-exposure inference | DEM wind-exposure score |
| Hosted Full narrative + tech | The position on the hill says this section catches more wind than average. | Wind exposure <N>/5. Ridgelines and hilltops catch more wind even when the BRANZ zone says otherwise. | DEM-derived wind exposure `<N>/5`. ≥4 boosts wind score to 35–50 when BRANZ is low. |

---

## terrain.nearest_waterway_m (`terrain.nearest_waterway_m`)
- What it measures: Distance to nearest LINZ Topo50 waterway (m).
- Source authority: LINZ Topo50.
- Dataset / endpoint: LINZ waterways.
- DataSource key(s): `linz_waterways`.
- Table(s): `waterways`.
- Query path: `snapshot_generator.py:939`.
- Rendered by: `HostedTerrain.tsx:201`. No finding (drives §2.10 compound).
- Threshold / classification logic: ≤50 m → flood floor 45; ≤100 m → 35; ≤200 m → 25 (`risk_score.py:660–666`). §2.10 compound when slope is medium+.
- Score contribution: `flood` waterway boost, `risk_score.py:658–666`.
- Coverage: National.
- Common misreading: A "waterway" includes drains and intermittent streams.
- What it does NOT tell you: Catchment size.
- source_key status: TODO, catalog has `linz_waterways`.
- User-care severity: Notable, Distance to the nearest waterway is a flood and amenity signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Nearest waterway | Nearest waterway | LINZ waterway distance |
| Hosted Full narrative + tech | The closest stream or drain is about <N> m away. | Waterway <N> m away. Within 50 m floors flood signal at 45 even without council flood data. | Nearest `linz_waterways` distance `<N>` m. Score floors: 50 m→45, 100 m→35, 200 m→25. |

---

## terrain.nearest_waterway_name (`terrain.nearest_waterway_name`)
- What it measures: Name of nearest waterway.
- Source authority: LINZ Topo50.
- Dataset / endpoint: LINZ waterways.
- DataSource key(s): `linz_waterways`.
- Table(s): `waterways`.
- Query path: `snapshot_generator.py:939`.
- Rendered by: `HostedTerrain.tsx:202`.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: National (where named).
- Common misreading: Many waterways are unnamed.
- What it does NOT tell you: Flow or flood history.
- source_key status: N/A.
- User-care severity: Context, Names the nearest waterway; amenity context.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Nearest waterway name | Nearest waterway name | Waterway name |
| Hosted Full narrative + tech | The closest waterway is the <name>. | Closest waterway: <name>. Useful for catchment lookup. | Name `<name>` from `linz_waterways`. |

---

## terrain.nearest_waterway_type (`terrain.nearest_waterway_type`)
- What it measures: Topo50 waterway type label (river / stream / drain / canal).
- Source authority: LINZ Topo50.
- Dataset / endpoint: LINZ waterways.
- DataSource key(s): `linz_waterways`.
- Table(s): `waterways`.
- Query path: `snapshot_generator.py:939`.
- Rendered by: `HostedTerrain.tsx:203`.
- Threshold / classification logic: (none).
- Score contribution: (none).
- Coverage: National.
- Common misreading: A "drain" can flood as readily as a stream in heavy rain.
- What it does NOT tell you: Whether it's piped or open.
- source_key status: N/A.
- User-care severity: Context, Waterway type (river, stream, lake) frames the flood and amenity read.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Nearest waterway type | Nearest waterway type | Waterway type |
| Hosted Full narrative + tech | It's classified as a <type>. | Type = <type> (river / stream / drain). Drains overflow as readily as streams in heavy rain. | Type `<type>` from `linz_waterways`. |

---

## coastal.tier (`coastal.tier`)
- What it measures: SeaRise-driven coastal exposure tier (combined SLR + storm tide + VLM + inundation).
- Source authority: WhareScore + NIWA SeaRise points.
- Dataset / endpoint: SeaRise points layer.
- DataSource key(s): UNKNOWN, `searise_points` is a target table, not a registered DataSource in `data_loader.py`. Loaded by an unmapped SeaRise/NIWA pipeline; loader name not located in this audit.
- Table(s): `searise_points`.
- Query path: `property.py:333 _overlay_coastal_data` → `services/coastal_timeline.py build_coastal_exposure`.
- Rendered by: `HostedCoastalTimeline.tsx:357`. Drives `coastal` indicator.
- Threshold / classification logic: Tier-driven score delta in `risk_score.py:635–643`.
- Score contribution: `coastal` indicator override, `risk_score.py:641` (also drops `coastal_erosion_council` at line 643 to avoid double-count).
- Coverage: Coastal nationally where SeaRise points exist.
- Common misreading: Tier reflects multi-decade projection, not present-day risk.
- What it does NOT tell you: Single-event probability.
- source_key status: N/A.
- User-care severity: Critical, Aggregated coastal tier is the headline coastal-risk read.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only timeline) | (out of scope: hosted-only timeline) | (out of scope: hosted-only timeline) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Coastal exposure tier | Coastal exposure tier | SeaRise coastal tier |
| Hosted Full narrative + tech | Sea exposure for this place is in tier <tier>. | Coastal tier <tier> from SeaRise modelling. Combines SLR + storm tide + land movement + inundation. | SeaRise tier `<tier>`; overrides NIWA CSI when present. Suppresses `coastal_erosion_council` to avoid double-count. |

---

## coastal.score_impact.delta (`coastal.score_impact.delta`)
- What it measures: Score delta the SeaRise tier contributes to the coastal indicator.
- Source authority: WhareScore.
- Dataset / endpoint: Computed from SeaRise tier.
- DataSource key(s): UNKNOWN, `searise_points` is a target table, not a registered DataSource in `data_loader.py`. Loaded by an unmapped SeaRise/NIWA pipeline; loader name not located in this audit.
- Table(s): `searise_points`.
- Query path: `property.py:333 _overlay_coastal_data` → `services/coastal_timeline.py build_coastal_exposure`.
- Rendered by: `HostedCoastalTimeline.tsx`.
- Threshold / classification logic: delta / max_possible × 100 → `coastal` indicator (`risk_score.py:641`).
- Score contribution: Drives `coastal` indicator value.
- Coverage: Where SeaRise tier resolves.
- Common misreading: Delta is internal scoring math, not user-facing risk.
- What it does NOT tell you: User-relevant risk descriptor.
- source_key status: N/A.
- User-care severity: Background, Internal score delta; users see the tier.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: internal score math) | (out of scope: internal score math) | (out of scope: internal score math) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: internal score math) | (out of scope: internal score math) | (out of scope: internal score math) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | (out of scope: internal score math) | (out of scope: internal score math) | SeaRise score delta |
| Hosted Full narrative + tech | (no rule) | (no rule) | `delta = <X>` of `max_possible = <Y>`; maps to coastal indicator value `min(delta, max)/max × 100`. |

---

## event_history.heavy_rain_events (`event_history.heavy_rain_events`)
- What it measures: Count of heavy-rain events historically near the property (Open-Meteo archive).
- Source authority: Open-Meteo historical weather archive (CC BY 4.0).
- Dataset / endpoint: Open-Meteo history.
- DataSource key(s): UNKNOWN, `open_meteo_history` is not a registered DataSource in `data_loader.py`. Weather events are populated by `snapshot_generator.py` directly from the Open-Meteo archive without a DataSource row.
- Table(s): `weather_events`.
- Query path: `snapshot_generator.py:938` (weather_history).
- Rendered by: `HostedAreaFeed.tsx:582`. No on-screen finding.
- Threshold / classification logic: ≥3 → flood score floor 15+3·n in `risk_score.py:681–682`.
- Score contribution: `flood` event boost, `risk_score.py:682`.
- Coverage: National (Open-Meteo).
- Common misreading: Count varies with archive depth; recent areas may underreport.
- What it does NOT tell you: Whether THIS section flooded.
- source_key status: TODO, catalog has `open_meteo`.
- User-care severity: Notable, Recent heavy-rain count signals exposure to localised flooding and slips.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Heavy-rain events | Heavy-rain events | Open-Meteo heavy-rain count |
| Hosted Full narrative + tech | <N> heavy-rain events have hit this area in our records. | <N> heavy-rain events on record near here. Repeated heavy rain on a non-flood-zone site is itself a soft signal. | Count `<N>` from Open-Meteo archive. ≥3 boosts flood floor to 15+3·n. |

---

## event_history.extreme_wind_events (`event_history.extreme_wind_events`)
- What it measures: Count of extreme-wind events near the property (Open-Meteo).
- Source authority: Open-Meteo.
- Dataset / endpoint: Open-Meteo history.
- DataSource key(s): UNKNOWN, `open_meteo_history` is not a registered DataSource in `data_loader.py`. Weather events are populated by `snapshot_generator.py` directly from the Open-Meteo archive without a DataSource row.
- Table(s): `weather_events`.
- Query path: `snapshot_generator.py:938`.
- Rendered by: `HostedAreaFeed.tsx`. No finding.
- Threshold / classification logic: ≥2 → wind floor 20+3·n (`risk_score.py:685–686`).
- Score contribution: `wind` event boost, `risk_score.py:686`.
- Coverage: National.
- Common misreading: Same archive-depth caveat as heavy rain.
- What it does NOT tell you: Damage incurred.
- source_key status: TODO.
- User-care severity: Notable, Recent extreme-wind count signals roof, fence and tree-fall exposure.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Extreme wind events | Extreme wind events | Open-Meteo extreme-wind count |
| Hosted Full narrative + tech | <N> extreme wind events have hit this area on record. | <N> extreme-wind events on record near here. Recurring wind even outside the BRANZ Extra High zone is a real signal. | Count `<N>` from Open-Meteo. ≥2 boosts wind floor to 20+3·n. |

---

## event_history.earthquakes_30km_10yr (`event_history.earthquakes_30km_10yr`)
- What it measures: Count of earthquakes within 30 km in the last 10 years (event-level boost field).
- Source authority: GeoNet / GNS Science.
- Dataset / endpoint: GeoNet earthquake catalogue.
- DataSource key(s): UNKNOWN, `geonet_earthquakes` is the `_src(...)` source-catalog key in `report_html.py`, not a registered DataSource in `data_loader.py`.
- Table(s): `earthquakes`.
- Query path: `snapshot_generator.py:938`.
- Rendered by: `HostedAreaFeed.tsx`. No finding (separate from `hazards.earthquake_count_30km` for boost-only use).
- Threshold / classification logic: ≥5 → earthquake floor 20+2·n (`risk_score.py:689–690`).
- Score contribution: `earthquake` event boost, `risk_score.py:690`.
- Coverage: National.
- Common misreading: This may overlap with `hazards.earthquake_count_30km`, different threshold/use.
- What it does NOT tell you: Magnitude distribution.
- source_key status: TODO.
- User-care severity: Background, Used as a score-floor input; main read is `hazards.earthquake_count_30km`.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only feed) | (out of scope: hosted-only feed) | (out of scope: hosted-only feed) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Earthquakes nearby (10 yr) | Earthquakes nearby (10 yr) | GeoNet 30 km / 10 yr count |
| Hosted Full narrative + tech | <N> earthquakes have happened within 30 km in the last decade. | <N> earthquakes in 30 km / 10 yr. ≥5 boosts the earthquake score floor. | Count `<N>` from GeoNet catalogue. ≥5 → score floor 20+2·n. Distinct from `hazards.earthquake_count_30km` (M4+ filtered). |

---

## weather_history (events list) (`weather_history`)
- What it measures: Detailed list of historical weather events (date, type, severity) near the property.
- Source authority: Open-Meteo historical archive (CC BY 4.0).
- Dataset / endpoint: Open-Meteo history.
- DataSource key(s): UNKNOWN, `open_meteo_history` is not a registered DataSource in `data_loader.py`. Weather events are populated by `snapshot_generator.py` directly from the Open-Meteo archive without a DataSource row.
- Table(s): `weather_events`.
- Query path: `snapshot_generator.py:576-583,938`.
- Rendered by: `HostedAreaFeed.tsx`. No finding.
- Threshold / classification logic: (none).
- Score contribution:, (the count fields drive scoring).
- Coverage: National.
- Common misreading: Listing events doesn't equal direct site damage.
- What it does NOT tell you: Property-specific damage.
- source_key status: TODO, `open_meteo` in catalog.
- User-care severity: Context, Detailed weather-event timeline; supporting context, not a single signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only feed) | (out of scope: hosted-only feed) | (out of scope: hosted-only feed) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick narrative | (no rule) | (no rule) | (no rule) |
| Hosted Full label | Weather history | Recent weather history | Open-Meteo weather events |
| Hosted Full narrative + tech | Recent storms and heatwaves around here are listed below. | Recent heavy-rain and high-wind events near the property. Patterns matter more than any single event. | Per-event timeline from Open-Meteo (CC BY 4.0). Snapshot-only; not in report SQL. |

---

## Local coverage audit

| Indicators in category | With findings | With source_key | Missing on hosted-full |
|---|---|---|---|
| 77 | 41 | 13 | 0 |

| Indicators | Critical | Notable | Context | Background |
|---|---|---|---|---|
| 77 | 22 | 34 | 12 | 9 |

Severity tier counts derived from the `User-care severity:` line on each Meaning block.

Critical-tier indicators that lack a finding rule today (next code pass should add one):
- `hazards.council_tsunami_ranking` (no Insight rule located keyed on this field; `_src("council_tsunami")` Insights at `report_html.py:778,785` fire on `tsunami_zone_class`).
- `hazards.slope_failure` (Insight at `report_html.py:921` fires on `landslide_in_area`, not `slope_failure`; the `slope_failure`-specific rule was not located).
- `hazards.coastal_exposure` (Insight at `report_html.py:4363` reads `coastal_erosion`; the `coastal_exposure`-specific rule was not located).
- `coastal.tier` (no Insight rule located; tier surfaces via overlay only, see Rendered-by note in the Meaning block).

Counts derived from this file:
- "With findings" = indicators whose `Rendered by` cites a `report_html.py:<N>` Insight rule.
- "With source_key" = indicators whose `source_key status` reads `present` (six unique `_src(...)` keys actually used in hazards path: `council_flood`, `council_tsunami`, `council_liquefaction`, `geonet_earthquakes`, `mbie_epb`, `gns_landslides`, verified by grepping `_src\(` in `report_html.py`, head 100).
- "Missing on hosted-full" = indicators with no Hosted Full surface, none; every indicator surfaces somewhere on `HostedHazardAdvice.tsx` / `HostedTerrain.tsx` / `HostedCoastalTimeline.tsx` / `HostedAreaFeed.tsx`.
- Indicator count cross-check: `_INVENTORY.md § Hazards` covers rows 54–130 (= 77 rows); the dot-paths covered here match 1:1 (verified by `diff` of the two indicator lists). The inventory's "Summary" cell says 78 but the actual row count is 77, that's an inventory bug, not a coverage gap (and inventory edits are out of scope for this pass).

## Local gap list (UNKNOWN entries or missing source_key)

UNKNOWN entries:
- `terrain.slope_category`, exact category band thresholds not located in the read sample of `snapshot_generator.py`.

Missing `source_key` on findings (TODO):
- `hazards.flood_extent_aep` (finding `report_html.py:1442`, should set `_src("council_flood")`).
- `hazards.wcc_flood_type` (`report_html.py:1287`, should set `_src("wcc_flood")`).
- `hazards.wcc_flood_ranking` (`report_html.py:1287`, should set `_src("wcc_flood")`).
- `hazards.wcc_tsunami_return_period` (`report_html.py:1276`, should set `_src("wcc_hazards")` or `council_tsunami`).
- `hazards.gwrc_liquefaction_geology` (`report_html.py:1216,1223`, should set `_src("gwrc_earthquake")`).
- `hazards.slope_failure` (`report_html.py:923,933,941`, should set `_src("council_liquefaction")` analogue or new `slope_failure` key).
- `hazards.landslide_susceptibility_rating` (`report_html.py:1354,1361`, should set `_src("council_landslide")` (new) or reuse `gns_landslides`).
- `hazards.fault_zone_name` / `fault_zone_ranking` (`report_html.py:1232,1235`, should set `_src("wcc_hazards")`).
- `hazards.active_fault_nearest` (`report_html.py:1259,1267`, should set `_src("gns_faults")`).
- `hazards.fault_avoidance_zone` (`report_html.py:4313`, should set `_src("gns_faults")`).
- `hazards.wind_zone` (`report_html.py:824`, should set new `_src("branz_wind")`).
- `hazards.wildfire_vhe_days` / `wildfire_trend` (`report_html.py:889`, should set new `_src("scion_wildfire")`).
- `hazards.coastal_exposure` (`report_html.py:406,4363`, should set `_src("niwa_coastal")`).
- `hazards.coastal_erosion_exposure` (`report_html.py:406`, should set `_src("niwa_coastal")`).
- `hazards.council_coastal_erosion` (`report_html.py:1393`, should set `_src("council_coastal")`).
- `hazards.coastal_elevation_cm` (`report_html.py:1427,1433`, should set new `_src("linz_coastal_dem")`).
- `hazards.coastal_inundation_ranking` / `coastal_inundation_scenario` (`report_html.py:1128`, should set new `_src("mfe_coastal_inundation")`).
- `hazards.on_erosion_prone_land` / `erosion_min_angle` (`report_html.py:1114`, should set `_src("gwrc_earthquake")` or new `_src("gwrc_erosion")`).
- `hazards.overland_flow_within_50m` (`report_html.py:1380`, should set new `_src("council_overland_flow")`).
- `hazards.aircraft_noise_*` (`report_html.py:1344`, should set new `_src("airport_noise_overlay")`).
- `hazards.geotech_count_500m` / `geotech_nearest_hazard` (`report_html.py:1372`, should set new `_src("council_geotech")`).
- `hazards.solar_mean_kwh` (`report_html.py:1302,1308`, should set new `_src("wcc_solar")`).
- `hazards.ground_shaking_severity` / `ground_shaking_zone` (`report_html.py:1216`, should set `_src("gwrc_earthquake")`).

## Local conflict list (same field labelled inconsistently across surfaces today)

- **Flood, primary label.** On-screen reads "Flood zone" via `RiskHazardsSection.tsx:55` HazardCards generic label; finding wording `report_html.py:755` says "1-in-100-year flood zone"; `lib/hazards.ts` `floodTierLabel()` returns "In a high-risk flood zone" / "In a moderate flood zone" / etc. Three different label vocabularies for the same datum.
- **Liquefaction.** Insight title `report_html.py:796` says "High liquefaction potential"; `lib/hazards.ts` `liquefactionRating()` returns canonical `very_high`/`high`/etc. with no shared label helper; SnapGen narratives may produce other phrasings. One indicator, several label registers.
- **Tsunami zone.** Finding `report_html.py:776` says "Tsunami Zone <N>. highest local government warning tier for this area." while `lib/hazards.ts` `isInTsunamiZone()` uses `tsunami_zone` (different aliased field); `tsunami_zone_class` is the canonical numeric. The aliased frontend `tsunami_zone` (per `transformReport`) and SQL `tsunami_zone_class` carry the same datum under different names.
- **Slope failure / landslide susceptibility.** Inventory rows 49 (`slope_failure`) and 56 (`landslide_susceptibility_rating`) drive separate insights (`report_html.py:921` vs `:1352`) but both produce "landslide susceptibility" copy, easy to read as one indicator.
- **Coastal exposure vs coastal erosion vs coastal inundation.** Three distinct fields (`coastal_exposure`, `council_coastal_erosion`, `coastal_inundation_ranking`) all surface as "coastal" in `HostedQuickReport.tsx:196` HostedAtAGlance and folded together by `lib/hazards.ts` `hasHighCoastalErosionRisk()`, surface labels conflate them.
- **Active fault.** WCC `fault_zone_name` finding `report_html.py:1235` titles "Within <name> fault zone"; GNS `active_fault_nearest` finding `report_html.py:1259` titles "Within 200m of <name> active fault". Two different phrasings, both render in the same Hazards section.
- **EPB count vs EPB at this address.** `epb_count_300m` finding `report_html.py:837` says "<N> earthquake-prone buildings within 300m"; `former_epb_at_property` finding `report_html.py:875` says "This building was previously on the MBIE earthquake-prone register". Layperson can confuse "5 EPBs nearby" with "this is an EPB".
