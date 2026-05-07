# Indicator Wording: Planning

Owner slice: 33 Planning indicators from `_INVENTORY.md` § Planning. Source of
truth for what each field means, where it comes from, and how it should read
on each surface (on-screen report, Hosted Quick, Hosted Full) for each
persona (Renter / Buyer / Pro).

Re-derived from scratch on 2026-05-02. All file:line refs grep-confirmed
against the live tree (migration `0054_flood_nearest_m.sql`,
`backend/app/services/risk_score.py`, `backend/app/services/report_html.py`,
`frontend/src/components/property/sections/PlanningSection.tsx`,
`backend/app/services/data_loader.py`, `docs/DATA-PROVENANCE.md`).

Source authorities used in this slice:
- Individual councils, District / Unitary Plan zones, height controls, viewshafts, character precincts, heritage overlays, special character areas, ecological areas, notable trees, mana whenua sites, parks, resource consents.
- MBIE, Earthquake-Prone Building Register (`mbie_epb`).
- Heritage NZ Pouhere Taonga, National heritage register, surfaced via per-council heritage loaders writing to `heritage_sites` (no standalone `heritage_nz_register` DataSource key in this codebase).
- Regional councils, SLUR / HAIL contaminated land registers (GWRC, ECan, etc.).
- Te Waihanga (NZ Infrastructure Commission), National infrastructure pipeline (`infrastructure_projects`).
- Transpower, National transmission lines (static historical snapshot).
- Ministry of Education, School enrolment zones (`school_zones`).
- LINZ + DOC + OSM, Park / reserve extents.

## Changes in this pass

- File created from scratch on 2026-05-02. There was no existing planning category file in `docs/wording/`; only `_INVENTORY.md` listed the category.
- Verified all 33 indicator dot-paths against `migrations/0054_flood_nearest_m.sql` (lines 801-838). Every key is still produced by the SQL function.
- Verified `risk_score.py` weights: `WEIGHTS_PLANNING = {zone_permissiveness 0.25, height_limit 0.20, resource_consents 0.20, infrastructure 0.20, school_zone 0.15}` at lines 288-291. Two indicators are hard-coded neutral (50): `zone_permissiveness` (line 749) and `height_limit` (line 750), flagged in their cells.
- Verified planning Insights in `report_html.py` at lines 1402-1506 (overlay set) and 2034-2081 (rules engine). **None of the planning Insights in those two ranges pass `source=`**, so every `source_key status` cell below reads "TODO, no `source=` parameter on the Insight call". Note: `_src("mbie_epb")` IS attached at `report_html.py:849, 887` and `_src("council_slur")` at `:1797, 1805, 1813`. These are EPB and contamination Insights elsewhere in the file (not in the planning rules engine), so the gap is local to the two ranges audited.
- Verified `SOURCE_CATALOG` keys (`report_html.py:637-676`): planning-relevant keys present are `council_zones`, `council_heritage_overlay`, `transpower`, `mbie_epb`, `heritage_nz`. **Missing**: dedicated keys for `te_waihanga` (infrastructure), `moe_zones` (school zones), `osm_amenities` / `linz_parks` for parks (osm_amenities exists but is generic), `council_viewshafts`, `council_character`, `council_special_character`, `council_ecological`, `council_mana_whenua`, `council_notable_trees`, `council_height_controls`, `council_height_variation`, `council_resource_consents`, council `contaminated_land`. These need adding to SOURCE_CATALOG before planning Insights can attach attribution.
- Wording rules applied: 6 surfaces × 3 personas, NZ English, ≤60 char labels, defuse common misreading, name comparators when relevant, Renter ~grade 2 / Buyer ~grade 3 / Pro ~grade 4.

### 2026-05-02 audit-fix pass

- Applied fixes from `_AUDIT-planning.md`. All edits doc-only; no code changes.
- Trimmed `planning.contaminated_listed` Hosted Full Pro narrative from 3 sentences to 2 (merged sentences 2 and 3).
- Trimmed `planning.epb_listed` Hosted Full Pro narrative from 3 sentences to 2 (dropped loader-detail sentence; loader detail belongs in the meaning-block "Dataset / endpoint" row, not the narrative).
- Removed fabricated `heritage_nz_register` DataSource key in source-authority header and in `planning.heritage_listed` Dataset/endpoint row. Replaced with explicit "no standalone `heritage_nz_register` key, surfaced via per-council heritage loaders writing to `heritage_sites`". Verified by `Grep heritage_nz_register backend/app/services` returns 0 hits.
- Replaced bogus `contaminated_land` DataSource key in `planning.contaminated_listed` row 4 with the actual per-council loader keys (`contaminated_land` GWRC `:4944`, `nrc_contaminated_land` `:7149`, `uhcc_contaminated_land` `:9297`, plus inline DataSources for Otago, Hawke's Bay, Southland, Taranaki, Bay of Plenty, Wairarapa, Gisborne). `contaminated_land` clarified as a table name, not a single key.
- Corrected document-level claim about planning Insights and `source=`. The original wording ("None of the planning Insights pass `source=`") was technically scoped to the two ranges (1402-1506, 2034-2081). Re-grep confirms `_src("mbie_epb")` attached at `report_html.py:849, 887` and `_src("council_slur")` at `:1797, 1805, 1813` (EPB and contamination Insights elsewhere in the file). Reworded for accuracy.
- Note: audit suggested example DataSource key `whangarei_zones_residential` was wrong. Re-grep proves it IS the literal DataSource key (`data_loader.py:7156`); `whangarei_residential` is the `source_council` tag on line 7160. No change required.

### 2026-05-02 editorial recalibration pass

- Renter persona scope conversions: `zone_name`, `zone_category` (where still in-scope on Quick/Full), `heritage_listed`, `in_viewshaft` reworked to `(out of scope)` across surfaces. All four are build-side rules a renter cannot act on. `(out of scope)` placed in the label cell, `(no rule)` in finding/narrative cells.
- Severity downgrades, applied scepticism to Critical tier per "almost never for planning" rule:
  - `zone_name`: Notable → Context (foundational background, not decision-changing on its own).
  - `in_ecological_area`: Critical → Notable (consent risk for landscape work, but ordinary residential use unaffected).
  - `in_special_character`: Critical → Notable (design and demolition controls add cost, but not decision-changing).
- Reconciled coverage audit roll-up against actual cell severities. Roll-up previously claimed `zone_name`, `heritage_listed`, `in_heritage_overlay` were Critical when their cells already said Notable. Final tally: Critical 2, Notable 12, Context 6, Background 12.
- Removed em-dash from `zone_name` user-care severity line.

### 2026-05-02 polish pass (task #4)

- Added `User-care severity:` line to every Meaning block (Critical / Notable / Context / Background per the polish brief).
- Removed em-dash separators throughout. Replaced with commas, full stops, colons, or parentheses. Bare em-dash placeholders inside Meaning blocks replaced with `N/A`. Bare em-dash placeholders inside wording cells (where no finding rule exists) replaced with `(no rule)` for finding cells, and left bundled cells as `(out of scope: ...)` per existing convention. Wording-cell em-dashes used as conjunctions rewritten as two clauses.
- Replaced one "substantially" with "a lot" in `nearest_park_distance_m` Pro narrative.
- Plain words pass: "approximately" left absent (was already not present); "expenditure" not present; minor calibrations of "About {n}" phrasing left in place where it best matches the renter register.
- No exclamation marks present before or after this pass.
- Critical indicators that lack a finding rule today (worth raising for a future findings pass): none. Every Critical-tier indicator below has at least one Insight or recommendation in `report_html.py`. The gap is `source=` attribution, not rule existence.

---

### planning.zone_name (`planning.zone_name`)
- What it measures: District / Unitary Plan zone name at the address (e.g. "Medium Density Residential", "Single House", "Town Centre").
- Source authority: Individual councils (their published District / Unitary Plan zone GIS feed).
- Dataset / endpoint: ~25 council ArcGIS / WFS endpoints, see `DATA-CATALOG.md` § DataSources-by-region.
- DataSource key(s): `district_plan` (WCC), `auckland_plan_zones`, plus per-council zone loaders (`whangarei_zones_residential`, etc.). All write to the same target table.
- Table(s): `district_plan_zones`
- Query path: `get_property_report()` LATERAL `dpz`, `SELECT zone_name, zone_code, category FROM district_plan_zones … ORDER BY zone_name IS NULL, zone_code IS NULL, ST_Area … LIMIT 1` (migrations/0054_flood_nearest_m.sql:842-848). Returned as `planning.zone_name` at :801.
- Rendered by: `frontend/src/components/property/sections/PlanningSection.tsx:75-81` (zone pill); `frontend/src/components/report/HostedExecutiveSummary.tsx:90` (executive summary line); `frontend/src/components/property/ActionCard.tsx:291-297` (recommendation copy); `frontend/src/lib/compareSections.ts:452` (compare row).
- Threshold / classification logic: `_derive_zone_category()` in `data_loader.py` maps free-text zone names → category (residential / business / rural / open space / etc.) using substring rules (e.g. "open space"/"recreation"/"reserve"/"park" → open space at line 233).
- Score contribution: Drives `zone_permissiveness` indicator (`WEIGHTS_PLANNING = 0.25`). Currently hard-coded to neutral 50, `risk_score.py:749 indicators["zone_permissiveness"] = 50`. So today the field is rendered but does NOT yet move the planning sub-score.
- Coverage: 20+ councils. See `WIRING-TRACES.md` § Planning-traces row 131.
- Common misreading: Treating the zone string as a permission to build whatever you want, zones grant permitted activities only; most modifications still need design / building consent and may trigger overlay rules.
- What it does NOT tell you: Specific permitted activities, density limits, setbacks, design controls, or whether overlays add restrictions on top of the base zone, those live in the District Plan chapter, not in this field.
- source_key status: TODO, no `source=` on planning Insights yet. `council_zones` exists in `SOURCE_CATALOG` (report_html.py:672) and should be attached to the leasehold / zone-derived recommendations.
- User-care severity: Context. The zone shapes what can be built or run from the site and feeds resale value, but on its own it is foundational context, not a hazard.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: zone rules are about what can be built) | District plan zone | District plan zone |
| On-screen, finding | (no rule) | Zone is {zone_name}. Check what's permitted before assuming you can extend or subdivide. | Zone {zone_name} (council {ta_name}); category {zone_category}; permitted-activity rules in council DP chapter. |
| Hosted Quick, label (≤60 chars) | (out of scope: zone permissiveness is build-side) | Zone | District plan zone |
| Hosted Quick, narrative | (no rule) | This site sits in the {zone_name} zone, which controls what's allowed without a resource consent. | District Plan zone: {zone_name} ({zone_category}). |
| Hosted Full, label (≤60 chars) | (out of scope) | District plan zone | District plan zone ({ta_name}) |
| Hosted Full, narrative + tech | (no rule) | This property is zoned {zone_name}. Permitted activities, height, density and setbacks all depend on this zone, so read the council District Plan chapter before planning work. | Zone {zone_name} (code {zone_code}, category {zone_category}); see {ta_name} District Plan. Zone alone does not capture overlays. Check viewshaft, character, heritage and SEA fields below. |

---

### planning.zone_code (`planning.zone_code`)
- What it measures: Short zone code (e.g. "MRZ", "R2", "HRZ") published by some councils alongside the zone name.
- Source authority: Individual councils.
- Dataset / endpoint: Same council DP feeds as `zone_name`.
- DataSource key(s): Same as `planning.zone_name`.
- Table(s): `district_plan_zones`
- Query path: Same LATERAL `dpz` selection, migrations/0054_flood_nearest_m.sql:842-848, returned at :801.
- Rendered by: `PlanningSection.tsx:92-96` (rendered only when distinct from `zone_name`).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Subset of councils, null where the upstream feed has no distinct short code (e.g. QLDC). See `WIRING-TRACES.md` row 132.
- Common misreading: Using the code as a national identifier, codes are NOT standardised across councils; "R2" in WCC ≠ "R2" in CCC.
- What it does NOT tell you: Anything `zone_name` doesn't already say. It is just a shorthand.
- source_key status: TODO, no `source=` on related Insights. `council_zones` would apply.
- User-care severity: Background, technical shorthand fully redundant with `zone_name` for non-Pro readers.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: shorthand, redundant with zone name for renter) | Zone code | Zone code |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: redundant with zone name) | (out of scope: bundled with zone name) | Zone code |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | Council zone code: {zone_code}. |
| Hosted Full, label (≤60 chars) | (out of scope: redundant) | Zone code | Zone code (council shorthand) |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The council shorthand for this zone is {zone_code}. | Council zone code {zone_code}. Codes are not standardised; the same code in different councils does not mean the same rules. |

---

### planning.zone_category (`planning.zone_category`)
- What it measures: Derived high-level category for the zone (residential / business / commercial / rural / open space / industrial / special purpose / road).
- Source authority: Individual councils (raw zone name) + WhareScore derivation.
- Dataset / endpoint: Auckland Unitary Plan provides this directly via the GROUPZONE domain; for other councils it is derived by `_derive_zone_category()` in `data_loader.py` from `zone_name` text.
- DataSource key(s): Same as `planning.zone_name`.
- Table(s): `district_plan_zones` (column `category`).
- Query path: Same LATERAL `dpz` row, migrations/0054_flood_nearest_m.sql:842, returned at :801.
- Rendered by: `PlanningSection.tsx:83-90` (rendered only when distinct from `zone_name` and not just "Zone"); `HostedExecutiveSummary.tsx:91`.
- Threshold / classification logic: `_derive_zone_category()` substring rules, e.g. "open space"/"recreation"/"reserve"/"park" → open space (`data_loader.py:233`).
- Score contribution:, (intermediate; intended for `zone_permissiveness` once that indicator is real, currently neutral 50).
- Coverage: All councils with zones loaded, but quality varies, Auckland is authoritative (council-supplied), others are pattern-derived.
- Common misreading: Trusting the category in a borderline case, pattern-derived categories misclassify novel zone names. Always cross-read with `zone_name`.
- What it does NOT tell you: The actual rule set; the category is a navigation aid, not a control.
- source_key status: TODO, `council_zones` would apply.
- User-care severity: Context, useful navigation aid for grouping zones but not itself a control.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled with zone name) | Zone category | Zone category (derived) |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled with zone name) | Zone category | Zone category (derived) |
| Hosted Quick, narrative (1 sentence) | (no rule) | This is a {zone_category} zone, which shapes the kind of buildings around you. | Category {zone_category} (Auckland: council-supplied; elsewhere derived from zone name). |
| Hosted Full, label (≤60 chars) | (out of scope: bundled with zone name) | Zone category | Zone category (derived) |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The zone is broadly {zone_category}. That's useful when comparing this place with another address in a different zone. | Category {zone_category}. For Auckland this comes from the Unitary Plan GROUPZONE field; for other councils it is derived from zone_name text by `_derive_zone_category()` and may misclassify novel names. |

---

### planning.max_height_m → height_limit (`planning.max_height_m`)
- What it measures: Maximum building height (metres) at the address from council height-control overlay.
- Source authority: Wellington City Council 2024 District Plan + select other councils.
- Dataset / endpoint: WCC DP height controls layer (others vary by council).
- DataSource key(s): `height_controls` (WCC), plus implicit via Auckland Unitary Plan zone attributes.
- Table(s): `height_controls`
- Query path: `get_property_report()` LATERAL `hc`, `SELECT height_metres FROM height_controls … LIMIT 1` (migrations/0054_flood_nearest_m.sql:851), returned as `max_height_m` at :802. Frontend/snapshot reads it as `height_limit`.
- Rendered by: `PlanningSection.tsx:98-103` (reads `planning.height_limit`); `ActionCard.tsx:296` (recommendation text).
- Threshold / classification logic: not applicable.
- Score contribution: Drives `height_limit` indicator (`WEIGHTS_PLANNING = 0.20`). Currently hard-coded neutral 50 (`risk_score.py:750`).
- Coverage: WCC + select councils. See `DATA-PROVENANCE.md:193`.
- Common misreading: Treating the figure as the height a buyer can build to, height variation overlays, viewshafts, character precincts, and design rules can all reduce it below the base limit.
- What it does NOT tell you: Whether a viewshaft or height variation overlay overrides this; whether the rule is metres-above-ground or absolute RL; whether it is a permitted-activity height or a discretionary cap.
- source_key status: TODO, `council_zones` is the closest existing key; a dedicated `council_height_controls` would be more precise.
- User-care severity: Notable, the height ceiling materially affects what a buyer can extend or build, though renters are unaffected.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not material to renting) | Height limit (council) | Permitted height (district plan) |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | Base height limit here is {height_limit}m. Overlays may pull it lower. | Base zone height {height_limit}m; height-variation and view-shaft overlays may override. Read combined controls. |
| Hosted Quick, label (≤60 chars) | (out of scope) | Height limit | Base height limit |
| Hosted Quick, narrative (1 sentence) | (no rule) | The council height limit is {height_limit}m as of right. | Permitted height: {height_limit}m (council District Plan). |
| Hosted Full, label (≤60 chars) | (out of scope) | Council height limit | Permitted height ({ta_name}) |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | A new build can rise to about {height_limit}m without a special consent. Overlays can bring this down. | Base zone permitted height: {height_limit}m. Always check `height_variation_limit`, viewshaft and character overlays; these stack on top and can reduce the effective limit. |

---

### planning.height_variation_limit (`planning.height_variation_limit`)
- What it measures: Height variation control text/value where an overlay overrides the base zone height (e.g. "16m", "Volcanic cone, 9m").
- Source authority: Auckland Council (currently the only loaded source).
- Dataset / endpoint: Auckland Unitary Plan Height Variation Control overlay.
- DataSource key(s): `auckland_height_variation`
- Table(s): `height_variation_control`
- Query path: `get_property_report()` LATERAL `hvc`, `SELECT height_limit FROM height_variation_control …` (migrations/0054_flood_nearest_m.sql:961), returned as `height_variation_limit` at :831.
- Rendered by: `PlanningSection.tsx:104-108`; `report_html.py:1500-1506` Insight (info level): "Height variation control applies: **{hv_limit}** maximum."
- Threshold / classification logic: Presence of any value triggers the Insight at report_html.py:1500.
- Score contribution: not applicable.
- Coverage: Auckland only. See `WIRING-TRACES.md:142`.
- Common misreading: Reading the value as the base zone limit, it is an overlay that REPLACES the base limit, often more restrictive (e.g. volcanic cones).
- What it does NOT tell you: Why the variation exists, the rationale (volcanic cone, pre-1944 character, viewshaft) lives in the Unitary Plan chapter.
- source_key status: TODO, no `source=` on the Insight at report_html.py:1500. Needs a `council_height_variation` entry in SOURCE_CATALOG (or reuse `council_zones`).
- User-care severity: Notable, an overlay that overrides the base zone height can change what a buyer can build by metres.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope) | Height variation overlay | Height variation control |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | A height variation overlay applies. The limit is {height_variation_limit}, not the base zone figure. | Height variation overlay: {height_variation_limit} (overrides base zone height_limit). |
| Hosted Quick, label (≤60 chars) | (out of scope) | Height variation | Height variation control |
| Hosted Quick, narrative (1 sentence) | (no rule) | A council overlay caps height at {height_variation_limit} here. | Auckland Unitary Plan Height Variation Control: {height_variation_limit}. |
| Hosted Full, label (≤60 chars) | (out of scope) | Height variation overlay | Height variation control (Auckland) |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | An overlay sets the height limit at {height_variation_limit}, replacing the base zone figure for this site. | Auckland Unitary Plan Height Variation Control: {height_variation_limit}. Overrides the base zone permitted height. The rationale (volcanic cone, character, viewshaft) is in the AUP chapter. |

---

### planning.heritage_listed (`planning.heritage_listed`)
- What it measures: Whether a Heritage NZ Pouhere Taonga listed heritage place exists at or very near the address.
- Source authority: Heritage NZ Pouhere Taonga + council heritage schedules.
- Dataset / endpoint: HNZPT national register, loaded into NZ via per-council heritage loaders writing to `heritage_sites`. No standalone `heritage_nz_register` DataSource key exists in `data_loader.py`.
- DataSource key(s): Per-council loaders writing to `heritage_sites` (e.g. Tauranga at data_loader.py:3664-3701; Whanganui at :10789-10793).
- Table(s): `heritage_sites`
- Query path: `get_property_report()` LATERAL `hr_flag`, `SELECT TRUE … FROM heritage_sites WHERE ST_DWithin(...)` (migrations/0054_flood_nearest_m.sql:858), returned as `heritage_listed` at :803. Surfaced downstream as `is_heritage_listed`.
- Rendered by: `PlanningSection.tsx` (heritage_count checklist row at :140-142); `report_html.py:2050-2055` Insight; `report_html.py:2678-2680` recommendation.
- Threshold / classification logic: Boolean, true if any heritage site within the threshold distance.
- Score contribution: not applicable.
- Coverage: National via HNZPT + select councils with overlay loaders.
- Common misreading: Assuming "listed" means alterations are forbidden, most heritage listings restrict EXTERNAL alterations and demolition; internal work is usually unrestricted.
- What it does NOT tell you: Which features are protected (façade only? whole envelope? interiors?), that requires reading the schedule entry.
- source_key status: TODO, Insight at report_html.py:2050 has no `source=`. `heritage_nz` exists in SOURCE_CATALOG (report_html.py:658) and should be attached.
- User-care severity: Notable. A heritage listing constrains exterior alterations and demolition and adds cost to any work, but ordinary occupation is unaffected.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: renters can't alter the building) | Heritage listed? | Heritage listing (HNZPT / council) |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | Heritage-listed: external alterations and demolition need resource consent and add cost to any work. | Heritage-listed; see schedule entry for protected features. |
| Hosted Quick, label (≤60 chars) | (out of scope) | Heritage listed | Heritage listing |
| Hosted Quick, narrative (1 sentence) | (no rule) | Heritage-listed: alterations and demolition need resource consent and cost more. | Heritage-listed (HNZPT or council schedule). |
| Hosted Full, label (≤60 chars) | (out of scope) | Heritage listed | Heritage listing (HNZPT / council) |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | This property is heritage-listed. External alterations and demolition typically require a resource consent, so read the schedule entry to see exactly which features are protected before budgeting any work. | Heritage-listed. Source: Heritage NZ Pouhere Taonga register and / or council District Plan heritage schedule. Schedule entry defines protected fabric (façade, envelope, interior). |

---

### planning.contaminated_listed (`planning.contaminated_listed`)
- What it measures: Whether the property sits on a council SLUR / HAIL contaminated-land schedule.
- Source authority: Regional councils (SLUR) + territorial authorities (HAIL).
- Dataset / endpoint: Per-council contaminated-land registers, see `data_loader.py:4944` (GWRC), `:5674` (Otago), `:5803` (Hawke's Bay), `:6330` (Southland), `:6346` (Taranaki), `:7150` (Northland), `:7571` (Bay of Plenty), `:9298` (Upper Hutt), `:9625` (Wairarapa), `:10608` (Gisborne).
- DataSource key(s): Per-council loaders all writing to the `contaminated_land` table, `contaminated_land` (GWRC, `data_loader.py:4944`), `nrc_contaminated_land` (Northland, `:7149`), `uhcc_contaminated_land` (Upper Hutt, `:9297`), plus inline DataSources for Otago, Hawke's Bay, Southland, Taranaki, Bay of Plenty, Wairarapa, Gisborne (region-tagged via `source_council`). `contaminated_land` is the table name, not a single DataSource key.
- Table(s): `contaminated_land`
- Query path: `get_property_report()` LATERAL `cl_flag`, `SELECT TRUE … FROM contaminated_land WHERE ST_DWithin(...)` (migrations/0054_flood_nearest_m.sql:866), returned as `contaminated_listed` at :804. Surfaced as `is_contaminated`.
- Rendered by: `PlanningSection.tsx` checklist row "Contaminated sites nearby" (uses `contamination_count`, :153-157); `report_html.py:2043-2048` Insight (warn).
- Threshold / classification logic: Boolean, true if any contaminated-land record within the threshold distance.
- Score contribution: not applicable.
- Coverage: 10+ regions loaded. Many regions still missing, `WIRING-TRACES.md` does not enumerate gaps by TA.
- Common misreading: Reading "listed" as "currently contaminated", many entries are HISTORICAL (former service stations, orchards, dry-cleaners) and may have been remediated; the schedule remains as a record.
- What it does NOT tell you: Whether the contamination has been remediated; the contaminant; the assessment status; whether a Site Investigation has been done.
- source_key status: TODO, Insight at report_html.py:2043 has no `source=`. `council_slur` exists in SOURCE_CATALOG (report_html.py:667) and should be attached.
- User-care severity: Critical. A SLUR or HAIL listing can trigger Detailed Site Investigation costs at land-use change and affects lender and insurer appetite.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not material to renting decisions) | Contaminated land? | SLUR / HAIL listing |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | This site is on the contaminated-land register. Get a site report before buying; a Detailed Site Investigation can run several thousand dollars. | Listed on regional SLUR / HAIL register; commission a Detailed Site Investigation if changing land use. |
| Hosted Quick, label (≤60 chars) | (out of scope) | Contaminated land | SLUR / HAIL listing |
| Hosted Quick, narrative (1 sentence) | (no rule) | The property appears on the contaminated-land register, usually from older industrial or rural use. | On regional SLUR / HAIL register (council schedule). |
| Hosted Full, label (≤60 chars) | (out of scope) | Contaminated land schedule | SLUR / HAIL listing ({source_council}) |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | This address is on the council contaminated-land schedule, usually a record of past land use (orchard, service station, workshop). Get a site report before buying or before changing how the land is used; remediation can be a five- to six-figure cost. | Listed on regional SLUR (Selected Land Use Register) or TA HAIL schedule. Listing reflects historical or suspected use, not necessarily current contamination; land-use change (e.g. residential subdivision) typically triggers an NES-CS Detailed Site Investigation. |

---

### planning.epb_listed (`planning.epb_listed`)
- What it measures: Whether the address is on the MBIE national earthquake-prone building register.
- Source authority: MBIE, Earthquake-Prone Buildings Register.
- Dataset / endpoint: `https://epbr.building.govt.nz/api/public/buildings?export=all&filter.hideRemoved=false` (data_loader.py:749).
- DataSource key(s): `epb_mbie` (data_loader.py:4949).
- Table(s): `mbie_epb_history`, `earthquake_prone_buildings`.
- Query path: `get_property_report()` LATERAL `epb_flag`, `SELECT TRUE … FROM earthquake_prone_buildings WHERE ST_DWithin(…)` (migrations/0054_flood_nearest_m.sql:874), returned as `epb_listed` at :805. Surfaced as `is_epb_listed`.
- Rendered by: `PlanningSection.tsx:137` (`EpbListedItem`); `BuyerChecklistContent.tsx:23`; `HostedExecutiveSummary.tsx:139`; `report_html.py:2036-2041` Insight (warn); `report_html.py:2670-2672` recommendation.
- Threshold / classification logic: Boolean, true if any EPB record within ~20m of the building outline.
- Score contribution:, (separately, EPB count within 300m feeds `hazards.epb_count_300m` for risk score; the per-property listing itself is a flag, not a score).
- Coverage: National. 5,813 active EPBs as of post-2026-04-23 loader fix (see `WIRING-TRACES.md:43`).
- Common misreading: Treating "listed" as "the building is unsafe today", listing means the building has been assessed below 34% NBS and has a statutory deadline (typically 25 years from notice) to be strengthened. It can still be lawfully occupied during that window.
- What it does NOT tell you: %NBS rating, deadline date, what work is required, whether work is in progress, those are in the EPBR record (`epbr_url`).
- source_key status: TODO, Insight at report_html.py:2036 has no `source=`. `mbie_epb` exists in SOURCE_CATALOG (report_html.py:650) and should be attached.
- User-care severity: Critical. EPB listing carries a statutory strengthening deadline and the remaining work is a contingent cost on the buyer; renters need to know about the seismic risk while occupied.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | EPB listed? | EPB listed? | EPB register status |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | This building is on the earthquake-prone register. Ask the landlord what's happening with the strengthening work. | This building is on MBIE's earthquake-prone register. Ask for the EPB notice and strengthening deadline; remaining work can run into the hundreds of thousands. | On MBIE EPB register; statutory strengthening deadline applies (typically 25 years from notice). |
| Hosted Quick, label (≤60 chars) | Earthquake-prone? | EPB listed | MBIE EPB register |
| Hosted Quick, narrative (1 sentence) | The building is on the earthquake-prone list. Ask about strengthening plans before signing. | This building is on the MBIE earthquake-prone register. Request the EPB notice and remaining deadline. | Listed on MBIE EPB register (epbr.building.govt.nz). |
| Hosted Full, label (≤60 chars) | Earthquake-prone listed | EPB listed (MBIE) | EPB register status (MBIE) |
| Hosted Full, narrative + tech (≤2 sentences) | This building is on the earthquake-prone register. It can still be used, but the owner has to strengthen it by a deadline. Ask what they're planning. | This building is on MBIE's earthquake-prone register. There is a statutory deadline to strengthen, usually 25 years from the notice, and remaining work is your contingent cost. Insist on the EPB notice, %NBS rating, and any strengthening reports before going unconditional. | On MBIE EPB register. %NBS, notice date, deadline, and category are in the EPBR record (`epbr_url`). |

---

### planning.resource_consents_500m_2yr → consent_count (`planning.resource_consents_500m_2yr`)
- What it measures: Count of granted resource consents within 500m in the last 2 years.
- Source authority: GWRC (Wellington region) + ECan (Canterbury), only regions with active loaders.
- Dataset / endpoint: GWRC + ECan resource consent registers (data_loader.py:924).
- DataSource key(s): `resource_consents` (GWRC). ECan handled via separate loader.
- Table(s): `resource_consents`
- Query path: `get_property_report()` LATERAL `rc`, `SELECT COUNT(*)::int … FROM resource_consents WHERE ST_DWithin(…) AND granted_date >= now() - interval '2 years'` (migrations/0054_flood_nearest_m.sql:881), returned as `resource_consents_500m_2yr` at :806.
- Rendered by: `PlanningSection.tsx:166` (`consent_count` checklist row, `positive=true`); `HostedNeighbourhoodStats.tsx`; `report_html.py:2070-2081` Insight (info, threshold ≥ 10).
- Threshold / classification logic: Insight fires when `consents >= 10`.
- Score contribution: `resource_consents` indicator (`WEIGHTS_PLANNING = 0.20`). Log-normalised: `log_normalize(plan.get("resource_consents_500m_2yr"), 30)`, `risk_score.py:751-753`.
- Coverage: Wellington region + Canterbury only. See `WIRING-TRACES.md:136`.
- Common misreading: Reading high consent count as "bad", it usually signals an active development area, with potential amenity uplift (and short-term construction disruption); the on-screen UI marks it `positive=true`.
- What it does NOT tell you: The TYPE of consents (subdivision, alteration, change-of-use, infrastructure), that requires the council consent portal.
- source_key status: TODO, Insight at report_html.py:2077 has no `source=`. Needs a `council_resource_consents` entry in SOURCE_CATALOG.
- User-care severity: Context, helpful read on neighbourhood activity but not in itself decision-changing.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Building activity nearby (2 yr) | Resource consents (500m, 2 yr) | Resource consents (500m / 2yr) |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | {consent_count} consents granted within 500m in the last 2 years; expect some construction noise. | {consent_count} consents granted within 500m in 2 years; active development area with short-term disruption and longer-term uplift. | {consent_count} resource consents within 500m over 24 months (GWRC / ECan registers; "active" Insight threshold is 10). |
| Hosted Quick, label (≤60 chars) | Nearby building work | Consents nearby (2 yr) | Resource consents (500m, 2yr) |
| Hosted Quick, narrative (1 sentence) | About {consent_count} building consents have been granted nearby in the last two years; expect occasional noise. | {consent_count} resource consents granted within 500m in the past 2 years; active area. | {consent_count} consents (GWRC / ECan; 500m radius, 24-month window). |
| Hosted Full, label (≤60 chars) | Building activity (500m, 2 yr) | Resource consents (500m, 2 yr) | Resource consents (500m / 24mo) |
| Hosted Full, narrative + tech (≤2 sentences) | About {consent_count} consents have been granted nearby in the last two years. That's mostly other people's work, but expect some site noise. | {consent_count} resource consents have been granted within 500m in the past 2 years. That usually means short-term construction disruption with longer-term amenity uplift; pull the consent register if you want to see what's coming. | {consent_count} resource consents within 500m, granted in the last 24 months. Source: GWRC consent register (Wellington region) plus ECan (Canterbury). Coverage limited to those two regions; elsewhere this field is null. |

---

### planning.infrastructure_5km → infrastructure_count, infrastructure_projects (`planning.infrastructure_5km`)
- What it measures: List of major infrastructure projects within 5km from the Te Waihanga (NZ Infrastructure Commission) pipeline.
- Source authority: Te Waihanga (NZ Infrastructure Commission).
- Dataset / endpoint: National infrastructure pipeline. (No active DataSource key found in `data_loader.py`, table is populated but loader appears to be a one-off / external import; flag as gap.)
- DataSource key(s): UNKNOWN, grep for "infrastructure_pipeline" / "te_waihanga" / "infrastructure_projects" in data_loader.py returned no DataSource entry. Likely a static / out-of-band load.
- Table(s): `infrastructure_projects`
- Query path: `get_property_report()` LATERAL `infra`, `FROM infrastructure_projects ip … WHERE ST_DWithin(...)` (migrations/0054_flood_nearest_m.sql:895), returned as `infrastructure_5km` at :807.
- Rendered by: `PlanningSection.tsx:160` (`infrastructure_count`); `HostedInfrastructure.tsx:27` (reads `infrastructure_5km` or `infrastructure_projects`); `report_html.py:2021-2032` upper-section narrative (rent / amenity uplift).
- Threshold / classification logic: not applicable.
- Score contribution: `infrastructure` indicator (`WEIGHTS_PLANNING = 0.20`). Log-normalised: `log_normalize(len(infra) if infra else 0, 40)`, `risk_score.py:754-755`.
- Coverage: National, assuming the Te Waihanga pipeline is loaded at all.
- Common misreading: Treating listed projects as committed, the pipeline includes proposed, business-case and committed projects; only some are funded / dated.
- What it does NOT tell you: Whether the project will go ahead, when, or what the construction footprint will be.
- source_key status: TODO, no `source=` on the Insight at report_html.py:2021. **No `te_waihanga` key in SOURCE_CATALOG**, needs adding.
- User-care severity: Context, useful background on medium-term neighbourhood change; pipeline status does not equal funded or dated.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Big projects near you (5 km) | Infrastructure projects (5 km) | Te Waihanga infra projects (5km) |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | {infrastructure_count} big projects sit within 5 km, which can ease rent pressure later. | {infrastructure_count} infrastructure projects within 5 km; short-term disruption, medium-term amenity uplift. | {infrastructure_count} entries in the Te Waihanga pipeline within 5 km (mix of proposed, business-case, committed). |
| Hosted Quick, label (≤60 chars) | Big projects nearby | Infrastructure pipeline (5 km) | Te Waihanga pipeline (5 km) |
| Hosted Quick, narrative (1 sentence) | About {infrastructure_count} big projects are planned within 5 km. | {infrastructure_count} infrastructure projects within 5 km on the national pipeline. | {infrastructure_count} pipeline entries within 5 km (Te Waihanga). |
| Hosted Full, label (≤60 chars) | Projects near you (5 km) | Infrastructure pipeline (5 km) | Te Waihanga infrastructure pipeline (5km) |
| Hosted Full, narrative + tech (≤2 sentences) | About {infrastructure_count} big projects are planned within 5 km, things like new roads, schools, or transit lines. They take years to land. | {infrastructure_count} projects appear in the national infrastructure pipeline within 5 km. Most are years away, but they often shift rents and resale once delivered. | {infrastructure_count} entries within 5 km from the Te Waihanga (NZ Infrastructure Commission) pipeline. Includes proposed, business-case, and committed projects; pipeline status does not equal funded or dated. |

---

### planning.transmission_line_distance_m (`planning.transmission_line_distance_m`)
- What it measures: Distance (metres) to the nearest high-voltage transmission line.
- Source authority: Transpower transmission network.
- Dataset / endpoint: Static historical bulk import, DATA-PROVENANCE.md:203 explicitly notes "no active loader" (snapshot only).
- DataSource key(s): UNKNOWN, no active DataSource entry. Static load.
- Table(s): `transmission_lines`
- Query path: `get_property_report()` LATERAL `tl`, `SELECT … FROM transmission_lines …` (migrations/0054_flood_nearest_m.sql:903), returned as `transmission_line_distance_m` at :808.
- Rendered by: `HostedNeighbourhoodStats.tsx`; `report_html.py:2057-2068` Insight (warn when ≤ 100m); `report_html.py:2683-2685` recommendation.
- Threshold / classification logic: Insight fires when distance ≤ 100m.
- Score contribution: not applicable.
- Coverage: National (static snapshot).
- Common misreading: Reading the distance as "EMF exposure", the value is geometric distance only; actual EMF depends on voltage, configuration, and orientation, none of which are in this field.
- What it does NOT tell you: Whether the line is overhead or underground; voltage; whether a Transpower easement actually crosses the title (some easements extend beyond the line itself).
- source_key status: TODO, Insight at report_html.py:2064 has no `source=`. `transpower` exists in SOURCE_CATALOG (report_html.py:674) and should be attached.
- User-care severity: Notable, an easement near the line can restrict where a buyer can build and may affect lender appetite.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not material to most renters) | Transmission line distance | Distance to HV transmission line |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | Nearest power line is {transmission_line_distance_m} m. An easement may restrict development. | Nearest HV transmission line: {transmission_line_distance_m} m (Transpower). Insight threshold: ≤100m. |
| Hosted Quick, label (≤60 chars) | (out of scope) | Distance to power line | Distance to HV line (Transpower) |
| Hosted Quick, narrative (1 sentence) | (no rule) | The nearest high-voltage line is {transmission_line_distance_m} m away. | Nearest Transpower HV line: {transmission_line_distance_m} m. |
| Hosted Full, label (≤60 chars) | (out of scope) | Distance to power line | Distance to HV transmission line |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The nearest high-voltage transmission line is about {transmission_line_distance_m} m away. Easements can restrict where you build, so confirm with the title and your lender. | Distance to nearest HV transmission line: {transmission_line_distance_m} m (Transpower). Static snapshot, no active loader as of 2026-05. Easement footprint may extend beyond the line; check the title and the National Grid corridor rules. |

---

### planning.in_viewshaft (`planning.in_viewshaft`)
- What it measures: Whether the property sits inside a protected viewshaft.
- Source authority: Wellington City Council + Auckland Council.
- Dataset / endpoint: WCC DP viewshafts layer; AC viewshafts (local + volcanic).
- DataSource key(s): `viewshafts` (WCC), `auckland_viewshafts`.
- Table(s): `viewshafts`
- Query path: `get_property_report()` LATERAL `vs`, `SELECT TRUE AS in_viewshaft, name, significance FROM viewshafts WHERE ST_Intersects(...)` (migrations/0054_flood_nearest_m.sql:910), returned as `in_viewshaft` at :810.
- Rendered by: `PlanningSection.tsx:21-28`; `report_html.py:1402-1410` Insight (info).
- Threshold / classification logic: Boolean intersect.
- Score contribution: not applicable.
- Coverage: Wellington + Auckland only. See `WIRING-TRACES.md:138`.
- Common misreading: Treating "viewshaft" as a building ban, it caps height / bulk to keep a defined view corridor open; ordinary alterations within that envelope are usually fine.
- What it does NOT tell you: The view origin / target, the protected RL ceiling, or which neighbouring sites share the constraint.
- source_key status: TODO, Insight at report_html.py:1406 has no `source=`. Needs a `council_viewshafts` entry in SOURCE_CATALOG (or reuse `council_zones`).
- User-care severity: Notable, a viewshaft caps height and bulk and meaningfully limits what a buyer can extend.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: build-side rule) | In a viewshaft? | Inside viewshaft overlay |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | Inside a viewshaft. Any new build or addition has to keep the view corridor open. | Inside protected viewshaft `{viewshaft_name}` ({viewshaft_significance}); height and bulk capped to keep the protected sight-line. |
| Hosted Quick, label (≤60 chars) | (out of scope) | Viewshaft | Viewshaft overlay |
| Hosted Quick, narrative (1 sentence) | (no rule) | Inside a protected viewshaft, so height and bulk are limited. | Inside viewshaft `{viewshaft_name}` ({viewshaft_significance}). |
| Hosted Full, label (≤60 chars) | (out of scope) | Viewshaft overlay | Viewshaft overlay (council DP) |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | This site is inside a protected viewshaft. Height and bulk are capped to keep the view corridor clear, so additions and new builds must not obstruct the protected sight-line. | Inside viewshaft `{viewshaft_name}` ({viewshaft_significance}). Source: WCC 2024 DP viewshafts plus AC local and volcanic viewshafts. Protected RL ceiling and origin / target are in the DP schedule. |

---

### planning.viewshaft_name (`planning.viewshaft_name`)
- What it measures: Name of the viewshaft the property sits in.
- Source authority: WCC + AC.
- Dataset / endpoint: Same as `in_viewshaft`.
- DataSource key(s): `viewshafts`, `auckland_viewshafts`.
- Table(s): `viewshafts`
- Query path: Same LATERAL `vs`, migrations/0054_flood_nearest_m.sql:910, returned at :811.
- Rendered by: `PlanningSection.tsx:21,25`; `report_html.py:1403`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Wellington + Auckland.
- Common misreading: not applicable.
- What it does NOT tell you: The protected RL or origin / target, those live in the DP schedule.
- source_key status: TODO, bundled with `in_viewshaft` Insight.
- User-care severity: Background, an identifier shown only when a viewshaft applies; the rule sits on `in_viewshaft`.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled with in_viewshaft label) | (out of scope: bundled with in_viewshaft label) | Viewshaft name |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | Viewshaft: `{viewshaft_name}`. |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Viewshaft |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | Viewshaft `{viewshaft_name}`. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | Viewshaft name | Viewshaft name |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The viewshaft name is `{viewshaft_name}`. | Viewshaft: `{viewshaft_name}` (council DP schedule). |

---

### planning.viewshaft_significance (`planning.viewshaft_significance`)
- What it measures: Significance / classification of the viewshaft (e.g. "Local", "Volcanic Cone", or council-specific tier).
- Source authority: WCC + AC.
- Dataset / endpoint: Same as `in_viewshaft`.
- DataSource key(s): `viewshafts`, `auckland_viewshafts`.
- Table(s): `viewshafts`
- Query path: Same, migrations/0054_flood_nearest_m.sql:910, returned at :812.
- Rendered by: `PlanningSection.tsx:25` (parenthetical).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Wellington + Auckland.
- Common misreading: Reading "Local" as low-priority, local viewshafts still cap height; "significance" is a categorisation, not a strength tier.
- What it does NOT tell you: The actual height cap.
- source_key status: TODO, bundled with `in_viewshaft`.
- User-care severity: Background, a category label only; does not encode the cap.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Viewshaft significance |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Viewshaft significance |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | Significance: {viewshaft_significance}. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Viewshaft significance |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | (no rule) | Viewshaft significance category: {viewshaft_significance}. Categorisation only; does not encode the actual RL cap (that is in the DP schedule). |

---

### planning.in_character_precinct (`planning.in_character_precinct`)
- What it measures: Whether the property is inside a council character precinct.
- Source authority: Wellington City Council + Dunedin City Council + WCC heritage areas.
- Dataset / endpoint: Council character precinct GIS layers (data_loader.py:4999, :5596, :7816).
- DataSource key(s): `character_precincts` (WCC), per-council loaders.
- Table(s): `character_precincts`
- Query path: `get_property_report()` LATERAL `cp_flag`, `FROM character_precincts WHERE ST_Intersects(…)` (migrations/0054_flood_nearest_m.sql:917), returned as `in_character_precinct` at :814.
- Rendered by: `PlanningSection.tsx:29-35`; `compareSections.ts:483-484`; `report_html.py:1413-1419` Insight (info).
- Threshold / classification logic: Boolean intersect.
- Score contribution: not applicable.
- Coverage: Wellington + Dunedin (and WCC heritage areas via separate loader). See `DATA-PROVENANCE.md:195`.
- Common misreading: Confusing "character precinct" with "heritage listing", character precincts protect neighbourhood character (often pre-1930 streetscape) via demolition + design controls; they don't list specific buildings.
- What it does NOT tell you: Which design rules apply, those are in the DP chapter.
- source_key status: TODO, Insight at report_html.py:1415 has no `source=`. Needs a `council_character_precincts` entry in SOURCE_CATALOG.
- User-care severity: Notable, demolition and design controls add cost and time to alterations and constrain new builds.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | In a character area? | Character precinct? | Character precinct |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | This street is in a character area, so the look tends to stay similar over time. | Inside a character precinct, where design controls protect the streetscape. | Inside character precinct `{character_precinct_name}`; demolition and design controls per council DP. |
| Hosted Quick, label (≤60 chars) | Character area | Character precinct | Character precinct |
| Hosted Quick, narrative (1 sentence) | The street is in a character area, so houses look similar. | Inside a character precinct: additions must be sympathetic and demolition is controlled. | Inside character precinct `{character_precinct_name}`. |
| Hosted Full, label (≤60 chars) | Character area | Character precinct | Character precinct (council DP) |
| Hosted Full, narrative + tech (≤2 sentences) | This street is in a character area. The houses tend to look similar; that's what the rule protects. | This site is inside a character precinct. Demolition is usually controlled and additions must be sympathetic, so read the council design guide before planning anything visible from the street. | Inside character precinct `{character_precinct_name}`. Demolition controls and design rules per WCC / DCC DP chapter; not a specific-building heritage listing. |

---

### planning.character_precinct_name (`planning.character_precinct_name`)
- What it measures: Name of the character precinct.
- Source authority: WCC / DCC / heritage councils.
- Dataset / endpoint: Same as `in_character_precinct`.
- DataSource key(s): Same.
- Table(s): `character_precincts`
- Query path: migrations/0054_flood_nearest_m.sql:917, returned at :815.
- Rendered by: `PlanningSection.tsx:33`; `report_html.py:1414`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Wellington + Dunedin + WCC heritage.
- Common misreading: not applicable.
- What it does NOT tell you: The specific design controls; those are by precinct in the DP chapter.
- source_key status: TODO, bundled.
- User-care severity: Background, identifier only; the rule sits on `in_character_precinct`.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled with in_character_precinct) | (out of scope: bundled) | Precinct name |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Precinct |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | Precinct: `{character_precinct_name}`. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | Precinct | Precinct |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The character precinct here is `{character_precinct_name}`. | Precinct: `{character_precinct_name}` (per council DP). |

---

### planning.in_heritage_overlay (`planning.in_heritage_overlay`)
- What it measures: Whether the property is inside a council historic heritage overlay (area-based, vs. site-listed `heritage_listed`).
- Source authority: Individual councils.
- Dataset / endpoint: Auckland Historic Heritage Overlay (data_loader.py:5078-5081); other councils via heritage overlay loaders.
- DataSource key(s): `auckland_heritage`, plus `wellington_heritage` (`character_precincts` target), and other council heritage-overlay loaders.
- Table(s): `historic_heritage_overlay`
- Query path: `get_property_report()` LATERAL `hho`, `FROM historic_heritage_overlay WHERE ST_Intersects(…)` (migrations/0054_flood_nearest_m.sql:923), returned as `in_heritage_overlay` at :817.
- Rendered by: `PlanningSection.tsx:45-52`; `report_html.py:1453-1459` Insight (info).
- Threshold / classification logic: Boolean intersect.
- Score contribution: not applicable.
- Coverage: Auckland + select councils. See `WIRING-TRACES.md:139`.
- Common misreading: Reading the overlay as a listing of THIS building, overlays often cover an AREA where any new work triggers heritage assessment, regardless of whether the specific dwelling is itself listed.
- What it does NOT tell you: Whether THIS building is individually scheduled, `heritage_listed` covers that.
- source_key status: TODO, Insight at report_html.py:1455 has no `source=`. `council_heritage_overlay` exists in SOURCE_CATALOG (report_html.py:673) and should be attached.
- User-care severity: Notable. An area-based heritage overlay constrains exterior alterations and demolition and adds cost to any visible work; ordinary use is unaffected.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Heritage area? | Heritage overlay? | Historic heritage overlay |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (out of scope: renters can't change the building) | Inside a heritage overlay: external work can need a resource consent and add cost to any alteration. | Inside heritage overlay `{heritage_overlay_name}` ({heritage_overlay_type}); area-based control, separate from individual listing. |
| Hosted Quick, label (≤60 chars) | Heritage area | Heritage overlay | Heritage overlay |
| Hosted Quick, narrative (1 sentence) | The street is in a heritage area, so outside changes need a council okay. | Inside a heritage overlay: external alterations can need a resource consent. | Inside heritage overlay `{heritage_overlay_name}` ({heritage_overlay_type}). |
| Hosted Full, label (≤60 chars) | Heritage area | Heritage overlay | Historic heritage overlay (council) |
| Hosted Full, narrative + tech (≤2 sentences) | This street is in a heritage area. That mostly affects how the outside of buildings can change, not how you live there. | This site is inside a heritage overlay. Area-based controls protect streetscape character; external modifications often require resource consent. Check the council heritage schedule for site-specific rules. | Inside heritage overlay `{heritage_overlay_name}` ({heritage_overlay_type}). Area-based control, separate from a specific-building heritage listing (`heritage_listed`). External alterations typically need a resource consent. |

---

### planning.heritage_overlay_name (`planning.heritage_overlay_name`)
- What it measures: Name of the heritage overlay.
- Source authority: Individual councils.
- Dataset / endpoint: Same as `in_heritage_overlay`.
- DataSource key(s): Same.
- Table(s): `historic_heritage_overlay`
- Query path: migrations/0054_flood_nearest_m.sql:923, returned at :818.
- Rendered by: `PlanningSection.tsx:49`; `report_html.py:1454`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Auckland + select councils.
- Common misreading: not applicable.
- What it does NOT tell you: Specific controls.
- source_key status: TODO, bundled.
- User-care severity: Background, identifier only; the rule sits on `in_heritage_overlay`.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled with in_heritage_overlay) | (out of scope: bundled) | Overlay name |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Overlay |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | Overlay: `{heritage_overlay_name}`. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | Overlay name | Overlay name |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The heritage overlay here is `{heritage_overlay_name}`. | Overlay: `{heritage_overlay_name}` (council schedule). |

---

### planning.heritage_overlay_type (`planning.heritage_overlay_type`)
- What it measures: Type of heritage overlay (e.g. "Residential 1", "Business", "Historic Heritage Place").
- Source authority: Individual councils.
- Dataset / endpoint: Same.
- DataSource key(s): Same.
- Table(s): `historic_heritage_overlay`
- Query path: migrations/0054_flood_nearest_m.sql:923, returned at :819.
- Rendered by: `PlanningSection.tsx:48` (parenthetical).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Auckland (well-typed); other councils may leave null.
- Common misreading: not applicable.
- What it does NOT tell you: not applicable.
- source_key status: TODO, bundled.
- User-care severity: Background, council-specific classification only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Overlay type |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Type |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | Overlay type: {heritage_overlay_type}. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Overlay type |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | (no rule) | Heritage overlay type: {heritage_overlay_type} (varies by council schedule classification). |

---

### planning.notable_trees_50m → notable_tree_count_50m (`planning.notable_trees_50m`)
- What it measures: Count of council-scheduled notable / protected trees within 50m.
- Source authority: Individual councils (notable tree schedules in the District Plan).
- Dataset / endpoint: e.g. `auckland_notable_trees` (data_loader.py:5093-5096).
- DataSource key(s): `auckland_notable_trees`, plus per-council notable tree loaders.
- Table(s): `notable_trees`
- Query path: `get_property_report()` LATERAL `nt`, `SELECT COUNT(*) … FROM notable_trees WHERE ST_DWithin(addr.geom, nt.geom, 50)` (migrations/0054_flood_nearest_m.sql:931), returned as `notable_trees_50m` at :821.
- Rendered by: `PlanningSection.tsx:144-152` (`notable_tree_count_50m`); `HostedNeighbourhoodStats.tsx:62`; `report_html.py:1491-1497` Insight (info, fires when count > 0).
- Threshold / classification logic: Insight when `nt_count > 0`.
- Score contribution: not applicable.
- Coverage: Auckland + select councils. See `WIRING-TRACES.md:135`.
- Common misreading: Treating the count as "trees on this site", it covers a 50m buffer; trees can be on neighbouring lots.
- What it does NOT tell you: Whether the tree is on YOUR title, the species, or the schedule rules (often: removal / significant pruning needs resource consent; root protection zones can restrict building).
- source_key status: TODO, Insight at report_html.py:1493 has no `source=`. Needs a `council_notable_trees` entry in SOURCE_CATALOG.
- User-care severity: Notable, root protection zones can restrict where a buyer builds and removal needs consent.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Protected trees nearby | Notable trees within 50 m | Scheduled notable trees (50 m) |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | {notable_tree_count_50m} protected tree(s) within 50 m; they can't be cut without a council okay. | {notable_tree_count_50m} scheduled notable trees within 50 m: removal or major pruning needs consent and root zones can restrict building. | {notable_tree_count_50m} scheduled notable trees within 50 m of address point (council DP schedule). |
| Hosted Quick, label (≤60 chars) | Protected trees (50 m) | Notable trees (50 m) | Scheduled notable trees (50 m) |
| Hosted Quick, narrative (1 sentence) | About {notable_tree_count_50m} protected trees grow within 50 m. | {notable_tree_count_50m} scheduled trees within 50 m; removal needs consent. | {notable_tree_count_50m} notable trees within 50 m (council schedule). |
| Hosted Full, label (≤60 chars) | Protected trees nearby | Notable trees (50 m) | Scheduled notable trees (50 m) |
| Hosted Full, narrative + tech (≤2 sentences) | About {notable_tree_count_50m} protected trees stand within 50 m. They can't be cut down without permission. | {notable_tree_count_50m} scheduled notable trees within 50 m. Removal or major pruning needs a resource consent, and root protection zones can restrict where you build. Trees may be on neighbouring lots. | {notable_tree_count_50m} scheduled notable trees within 50 m buffer of the address point. Source: council DP notable tree schedule. Removal or significant pruning typically requires resource consent; check root protection zones before any earthworks. |

---

### planning.notable_tree_nearest (`planning.notable_tree_nearest`)
- What it measures: Name / species of the nearest notable tree (when count > 0).
- Source authority: Individual councils.
- Dataset / endpoint: Same as `notable_trees_50m`.
- DataSource key(s): Same.
- Table(s): `notable_trees`
- Query path: migrations/0054_flood_nearest_m.sql:941, returned at :822.
- Rendered by: `PlanningSection.tsx:148-152`.
- Threshold / classification logic: Rendered only when `notable_tree_count_50m > 0`.
- Score contribution: not applicable.
- Coverage: Auckland + select councils.
- Common misreading: not applicable.
- What it does NOT tell you: Species, age, or condition (some councils provide; the SQL only returns the schedule name).
- source_key status: TODO, bundled with `notable_trees_50m`.
- User-care severity: Background, identifier only; the rule sits on `notable_trees_50m`.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled with count) | (out of scope: bundled) | Nearest notable tree |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Nearest tree |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | Nearest scheduled tree: `{notable_tree_nearest}`. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | Nearest scheduled tree | Nearest scheduled tree |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The nearest scheduled tree is `{notable_tree_nearest}`. | Nearest notable tree: `{notable_tree_nearest}`. Identifier from the council schedule; species and condition are not in this field. |

---

### planning.in_ecological_area (`planning.in_ecological_area`)
- What it measures: Whether the property is inside a Significant Ecological Area (SEA).
- Source authority: Auckland Council + Hamilton City Council.
- Dataset / endpoint: `auckland_ecological` (data_loader.py:5098-5101).
- DataSource key(s): `auckland_ecological`, plus Hamilton equivalent.
- Table(s): `significant_ecological_areas`
- Query path: `get_property_report()` LATERAL `sea`, `FROM significant_ecological_areas WHERE ST_Intersects(...)` (migrations/0054_flood_nearest_m.sql:949), returned as `in_ecological_area` at :824.
- Rendered by: `PlanningSection.tsx:53-62`; `compareSections.ts:503-504`; `report_html.py:1471-1479` Insight (info).
- Threshold / classification logic: Boolean intersect.
- Score contribution: not applicable.
- Coverage: Auckland + Hamilton. See `WIRING-TRACES.md:140`.
- Common misreading: Reading SEA as a no-build zone, vegetation removal, earthworks and building MAY require ecological assessment + consent; permitted activities still exist.
- What it does NOT tell you: Which ecological values are protected (vegetation type, species, habitat), that lives in the schedule.
- source_key status: TODO, Insight at report_html.py:1474 has no `source=`. Needs a `council_ecological` entry in SOURCE_CATALOG.
- User-care severity: Notable. RMA permitted-activity rules are constrained for clearing, earthworks, and building footprint, which adds cost and consent risk for any landscape work; ordinary residential use is unaffected.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Eco-protected area? | In an SEA? | Significant Ecological Area |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | This place is in a protected nature area, so clearing trees can need a council okay. | Inside a Significant Ecological Area: clearing, earthworks, and building can need ecological consent and add cost. | Inside SEA `{ecological_area_name}` ({ecological_area_type}); RMA permitted-activity rules constrained. |
| Hosted Quick, label (≤60 chars) | Eco protected | SEA overlay | Significant Ecological Area |
| Hosted Quick, narrative (1 sentence) | The site is in a protected nature area, which limits clearing. | Inside an SEA: clearing and earthworks can need ecological consent. | Inside SEA `{ecological_area_name}` ({ecological_area_type}). |
| Hosted Full, label (≤60 chars) | Eco protected area | SEA overlay | Significant Ecological Area |
| Hosted Full, narrative + tech (≤2 sentences) | This site is in a protected nature area. Cutting trees or moving earth can need a council okay; that's what the rule protects. | This site is inside a Significant Ecological Area (SEA). Vegetation removal, earthworks, and building may require ecological assessment and resource consent, so read the schedule before planning any landscape work. | Inside SEA `{ecological_area_name}` ({ecological_area_type}). Source: AC / HCC ecological schedule. RMA permitted-activity rules constrained for clearing, earthworks, and building footprint. |

---

### planning.ecological_area_name (`planning.ecological_area_name`)
- What it measures: Name of the SEA.
- Source authority: AC / HCC.
- Dataset / endpoint: Same.
- DataSource key(s): Same.
- Table(s): `significant_ecological_areas`
- Query path: migrations/0054_flood_nearest_m.sql:949, returned at :825.
- Rendered by: `PlanningSection.tsx:57`; `report_html.py:1472`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Auckland + Hamilton.
- Common misreading: not applicable.
- What it does NOT tell you: not applicable.
- source_key status: TODO, bundled.
- User-care severity: Background, identifier only; the rule sits on `in_ecological_area`.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled with in_ecological_area) | (out of scope: bundled) | SEA name |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | SEA |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | SEA: `{ecological_area_name}`. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | SEA name | SEA name |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The SEA here is `{ecological_area_name}`. | SEA: `{ecological_area_name}` (council schedule). |

---

### planning.ecological_area_type (`planning.ecological_area_type`)
- What it measures: Classification of the SEA (e.g. "Terrestrial", "Wetland", "Marine 1").
- Source authority: AC / HCC.
- Dataset / endpoint: Same.
- DataSource key(s): Same.
- Table(s): `significant_ecological_areas`
- Query path: migrations/0054_flood_nearest_m.sql:949, returned at :826.
- Rendered by: `PlanningSection.tsx:58` (parenthetical).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Auckland + Hamilton.
- Common misreading: not applicable.
- What it does NOT tell you: not applicable.
- source_key status: TODO, bundled.
- User-care severity: Background, classification label only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | SEA type |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Type |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | Type: {ecological_area_type}. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | SEA type |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | (no rule) | SEA classification: {ecological_area_type} (terrestrial / wetland / marine, per council schedule). |

---

### planning.in_special_character → in_special_character_area (`planning.in_special_character`)
- What it measures: Whether the property is inside a Special Character Area (Auckland-specific overlay).
- Source authority: Auckland Council.
- Dataset / endpoint: `auckland_special_character` (data_loader.py:5089-5092).
- DataSource key(s): `auckland_special_character`
- Table(s): `special_character_areas`
- Query path: `get_property_report()` LATERAL `sca`, `FROM special_character_areas WHERE ST_Intersects(...)` (migrations/0054_flood_nearest_m.sql:955), returned as `in_special_character` at :828. Frontend reads it as `in_special_character_area`.
- Rendered by: `PlanningSection.tsx:37-44`; `compareSections.ts:493-494`; `report_html.py:1462-1468` Insight (info).
- Threshold / classification logic: Boolean intersect.
- Score contribution: not applicable.
- Coverage: Auckland only. See `WIRING-TRACES.md:141`.
- Common misreading: Confusing Special Character with heritage listing, SCA is an AREA-based overlay (often pre-1944 streetscape) controlling demolition + design; it does not list specific buildings.
- What it does NOT tell you: The actual demolition / design rules, those are in the AUP chapter.
- source_key status: TODO, Insight at report_html.py:1464 has no `source=`. Needs a `council_special_character` entry.
- User-care severity: Notable. AUP demolition and design controls add cost and time to alterations and constrain what a buyer can knock down, but ordinary use is unaffected.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Special character area? | In a Special Character Area? | Special Character Area (AUP) |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | This street is in a Special Character Area, so the look tends to stay similar. | Inside a Special Character Area: demolition and major alterations are controlled, which adds cost. | Inside SCA `{special_character_name}`; AUP demolition and design controls apply. |
| Hosted Quick, label (≤60 chars) | Special character | Special Character Area | Special Character Area |
| Hosted Quick, narrative (1 sentence) | The street is in a Special Character Area, so houses look similar. | Inside a Special Character Area: demolition and major alterations are controlled. | Inside SCA `{special_character_name}` (AUP). |
| Hosted Full, label (≤60 chars) | Special character area | Special Character Area | Special Character Area (AUP) |
| Hosted Full, narrative + tech (≤2 sentences) | This street is in a Special Character Area. That mostly affects what can be built or knocked down nearby. | This site is inside a Special Character Area. Demolition and major alterations are controlled, and design of new builds and additions must be sympathetic to neighbourhood character. | Inside SCA `{special_character_name}`. Source: Auckland Unitary Plan SCA overlay. Area-based control, separate from individual heritage listing. |

---

### planning.special_character_name (`planning.special_character_name`)
- What it measures: Name of the Special Character Area.
- Source authority: Auckland Council.
- Dataset / endpoint: Same.
- DataSource key(s): `auckland_special_character`
- Table(s): `special_character_areas`
- Query path: migrations/0054_flood_nearest_m.sql:955, returned at :829.
- Rendered by: `PlanningSection.tsx:41`; `report_html.py:1463`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Auckland only.
- Common misreading: not applicable.
- What it does NOT tell you: not applicable.
- source_key status: TODO, bundled.
- User-care severity: Background, identifier only; the rule sits on `in_special_character`.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled with in_special_character) | (out of scope: bundled) | SCA name |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | SCA |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | SCA: `{special_character_name}`. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | SCA name | SCA name |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The Special Character Area here is `{special_character_name}`. | SCA: `{special_character_name}` (AUP overlay). |

---

### planning.in_mana_whenua (`planning.in_mana_whenua`)
- What it measures: Whether the property is inside a Site of Significance to Mana Whenua.
- Source authority: Auckland Council (currently the only loaded source).
- Dataset / endpoint: `auckland_mana_whenua` (data_loader.py:5113-5116).
- DataSource key(s): `auckland_mana_whenua`
- Table(s): `mana_whenua_sites`
- Query path: `get_property_report()` LATERAL `mw`, `FROM mana_whenua_sites WHERE ST_Intersects(...)` (migrations/0054_flood_nearest_m.sql:967), returned as `in_mana_whenua` at :833.
- Rendered by: `PlanningSection.tsx:63-70`; `report_html.py:1482-1488` Insight (info).
- Threshold / classification logic: Boolean intersect.
- Score contribution: not applicable.
- Coverage: Auckland only. See `WIRING-TRACES.md:143`.
- Common misreading: Reading the overlay as a building ban, it triggers cultural heritage assessment and iwi / hapū engagement; ordinary residential use is not blocked.
- What it does NOT tell you: Which iwi / hapū to engage; the specific cultural values protected, those are in the schedule and require iwi consultation.
- source_key status: TODO, Insight at report_html.py:1484 has no `source=`. Needs a `council_mana_whenua` entry.
- User-care severity: Notable, development triggers cultural heritage assessment and early iwi or hapū engagement, which adds time and cost; ordinary residential use is unaffected.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Site of cultural significance? | Site of Significance to mana whenua? | Site of Significance, Mana Whenua |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | This place is on land of cultural significance, so major work needs early kōrero. | Inside a Site of Significance to Mana Whenua: cultural heritage assessment may be required for development. Engage early with iwi or hapū. | Inside Mana Whenua site `{mana_whenua_name}`; AUP cultural heritage assessment and early iwi or hapū engagement triggered for development. |
| Hosted Quick, label (≤60 chars) | Cultural significance | Mana Whenua site | Site of Significance, Mana Whenua |
| Hosted Quick, narrative (1 sentence) | The site is on land of cultural significance to mana whenua. | Inside a Site of Significance to Mana Whenua: engage early with iwi for any development. | Inside Mana Whenua site `{mana_whenua_name}` (AUP). |
| Hosted Full, label (≤60 chars) | Cultural significance | Mana Whenua site | Site of Significance, Mana Whenua (AUP) |
| Hosted Full, narrative + tech (≤2 sentences) | This site is on land of cultural significance to mana whenua. For ordinary living it changes nothing, but bigger work means early conversations with iwi. | This site is a Site of Significance to Mana Whenua. Development typically triggers a cultural heritage assessment, so engage early with iwi or hapū before lodging any consent. | Inside Mana Whenua site `{mana_whenua_name}`. Source: Auckland Unitary Plan Mana Whenua schedule. AUP cultural heritage assessment and early iwi or hapū engagement triggered for resource consents involving earthworks, structures, or land-use change. |

---

### planning.mana_whenua_name (`planning.mana_whenua_name`)
- What it measures: Name of the mana whenua site.
- Source authority: Auckland Council.
- Dataset / endpoint: Same.
- DataSource key(s): `auckland_mana_whenua`
- Table(s): `mana_whenua_sites`
- Query path: migrations/0054_flood_nearest_m.sql:967, returned at :834.
- Rendered by: `PlanningSection.tsx:67`; `report_html.py:1483`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: Auckland only.
- Common misreading: not applicable.
- What it does NOT tell you: Which iwi / hapū to engage.
- source_key status: TODO, bundled.
- User-care severity: Background, identifier only; the rule sits on `in_mana_whenua`.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled with in_mana_whenua) | (out of scope: bundled) | Site name |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Site |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | Site: `{mana_whenua_name}`. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | Site name | Site name |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | The mana whenua site here is `{mana_whenua_name}`. | Site: `{mana_whenua_name}` (AUP schedule). Iwi or hapū to engage are not in this field; consult the AUP Mana Whenua schedule chapter. |

---

### planning.park_count_500m (`planning.park_count_500m`)
- What it measures: Count of parks / reserves within 500m of the address.
- Source authority: Auckland Council parks (currently); LINZ + DOC for national.
- Dataset / endpoint: `auckland_parks` (data_loader.py:5128-5131); LINZ NZ Parks; DOC layers.
- DataSource key(s): `auckland_parks`, plus other council parks loaders feeding `park_extents`.
- Table(s): `park_extents`
- Query path: `get_property_report()` LATERAL `pk_count`, `SELECT COUNT(*) … FROM park_extents WHERE ST_DWithin(addr.geom, geom, 500)` (migrations/0054_flood_nearest_m.sql:972), returned as `park_count_500m` at :836.
- Rendered by: `PlanningSection.tsx:171-176`; `HostedNeighbourhoodStats.tsx`; `HostedOutdoorRec.tsx`; `compareSections.ts:355`.
- Threshold / classification logic: Rendered when count > 0; on-screen treated as positive.
- Score contribution: not applicable.
- Coverage: Select councils. See `WIRING-TRACES.md:144`.
- Common misreading: Treating count as quality, a count of 5 small road reserves is very different from one large regional park; this field doesn't separate them.
- What it does NOT tell you: Park size, type (neighbourhood / sports / regional), or facilities.
- source_key status: TODO, no Insight currently fires on this. If one is added, `osm_amenities` (report_html.py:660) is the closest existing key but a dedicated `council_parks` would be cleaner.
- User-care severity: Context, useful amenity background; count alone misses size and type.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Parks within 500 m | Parks within 500 m | Parks / reserves within 500 m |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | {park_count_500m} parks are inside an easy walk. | {park_count_500m} parks within 500 m. Green-space access factors into resale and rentability. | {park_count_500m} `park_extents` polygons within 500 m (count only; size and type not surfaced). |
| Hosted Quick, label (≤60 chars) | Parks (500 m) | Parks (500 m) | Parks / reserves (500 m) |
| Hosted Quick, narrative (1 sentence) | {park_count_500m} parks are within a 5-minute walk. | {park_count_500m} parks sit within 500 m: short walk, plus amenity for resale. | {park_count_500m} park_extents polygons within 500 m. |
| Hosted Full, label (≤60 chars) | Parks (500 m) | Parks (500 m) | Parks / reserves (500 m) |
| Hosted Full, narrative + tech (≤2 sentences) | About {park_count_500m} parks are inside an easy walk. Green space close to home is one of the things people miss most when it's gone. | {park_count_500m} parks within 500 m. Green-space access is one of the steadier amenity drivers for both rent and resale, but a count alone misses size and type, which differ a lot. | {park_count_500m} `park_extents` polygons within 500 m. Source: AC parks plus LINZ plus DOC layers. Count only; polygon area, hierarchy (neighbourhood, sports, regional), and facilities are not in this field. |

---

### planning.nearest_park_name (`planning.nearest_park_name`)
- What it measures: Name of the nearest park / reserve.
- Source authority: AC / LINZ / DOC (per loader).
- Dataset / endpoint: Same as `park_count_500m`.
- DataSource key(s): Same.
- Table(s): `park_extents`
- Query path: `get_property_report()` LATERAL `pk`, `FROM park_extents` ordered by distance, LIMIT 1 (migrations/0054_flood_nearest_m.sql:979), returned at :837.
- Rendered by: `PlanningSection.tsx:178-182`; `HostedNeighbourhoodStats.tsx:54`; `report_html.py:1509-1515` Insight (info, fires when distance ≤ 300m).
- Threshold / classification logic: Insight when `nearest_park_distance_m <= 300`.
- Score contribution: not applicable.
- Coverage: Select councils.
- Common misreading: not applicable.
- What it does NOT tell you: Whether the park is open to the public (some `park_extents` records are restricted reserves).
- source_key status: TODO, Insight at report_html.py:1509 has no `source=`.
- User-care severity: Context, named amenity reference at walkable distance.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Nearest park | Nearest park | Nearest park / reserve |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | The closest park is `{nearest_park_name}`. | Nearest park: `{nearest_park_name}` ({nearest_park_distance_m} m). | Nearest `park_extents` polygon: `{nearest_park_name}` at {nearest_park_distance_m} m. |
| Hosted Quick, label (≤60 chars) | Nearest park | Nearest park | Nearest park |
| Hosted Quick, narrative (1 sentence) | Closest park: `{nearest_park_name}`. | Nearest park is `{nearest_park_name}`, about {nearest_park_distance_m} m away. | Nearest park: `{nearest_park_name}` ({nearest_park_distance_m} m). |
| Hosted Full, label (≤60 chars) | Nearest park | Nearest park | Nearest park / reserve |
| Hosted Full, narrative + tech (≤2 sentences) | Your closest park is `{nearest_park_name}`. | The nearest park is `{nearest_park_name}`, about {nearest_park_distance_m} m away. Walkable green space is one of the steadier amenity factors for resale. | Nearest park: `{nearest_park_name}` at {nearest_park_distance_m} m. Source: AC parks plus LINZ plus DOC. Some `park_extents` records are restricted reserves; public access is not encoded in this field. |

---

### planning.nearest_park_distance_m (`planning.nearest_park_distance_m`)
- What it measures: Distance (metres) to the nearest park / reserve.
- Source authority: Same as `nearest_park_name`.
- Dataset / endpoint: Same.
- DataSource key(s): Same.
- Table(s): `park_extents`
- Query path: migrations/0054_flood_nearest_m.sql:979, returned at :838.
- Rendered by: `PlanningSection.tsx:180`; `HostedNeighbourhoodStats.tsx:55`.
- Threshold / classification logic: Used by `report_html.py:1509` (Insight when ≤ 300m).
- Score contribution: not applicable.
- Coverage: Select councils.
- Common misreading: Reading metres as walking time, this is straight-line, not a walking-network distance.
- What it does NOT tell you: Walking time / route; obstacles (motorway, river).
- source_key status: TODO, bundled with `nearest_park_name`.
- User-care severity: Background, technical metric; bundled with `nearest_park_name`.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: bundled with nearest_park_name) | (out of scope: bundled) | Nearest park distance (m) |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule) | (no rule) | Nearest park is {nearest_park_distance_m} m straight-line. |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Nearest park distance |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | {nearest_park_distance_m} m straight-line to nearest park. |
| Hosted Full, label (≤60 chars) | (out of scope: bundled) | (out of scope: bundled) | Nearest park distance (m) |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | (no rule) | {nearest_park_distance_m} m straight-line distance to nearest `park_extents` polygon. Not a walking-network distance; motorways, rivers, and rail corridors can lengthen the actual walk a lot. |

---

### school_zone (planning) (`planning.school_zone` indicator)
- What it measures: Whether the address is inside one or more Ministry of Education school enrolment zones.
- Source authority: Ministry of Education.
- Dataset / endpoint: National school enrolment zones (data_loader.py:3877 `load_school_zones`).
- DataSource key(s): `school_zones` (data_loader.py:7137-7140).
- Table(s): `school_zones`
- Query path: Tested via `EXISTS (SELECT 1 FROM school_zones sz WHERE ST_Intersects(...))` in migrations/0054_flood_nearest_m.sql:666 (used elsewhere). The `school_zone` indicator value itself is computed by `risk_score.py:756 indicators["school_zone"] = 50`, currently hard-coded neutral.
- Rendered by: `frontend/src/components/report/HostedSchoolZones.tsx`; risk score indicator only (no dedicated on-screen tile).
- Threshold / classification logic: Currently fixed at 50 (`risk_score.py:756`), no real implementation yet.
- Score contribution: `school_zone` indicator (`WEIGHTS_PLANNING = 0.15`, `risk_score.py:288-291`).
- Coverage: National (school zones loaded).
- Common misreading: Reading "in zone" as guaranteed enrolment, zoned schools must accept in-zone students, but enrolment caps and balloted out-of-zone places change yearly.
- What it does NOT tell you: Which school(s) the address is zoned for; current decile / EQI / academic data.
- source_key status: TODO, no Insight currently. **No `moe_zones` key in SOURCE_CATALOG**, `moe_schools` (report_html.py:657) exists for school directory but a dedicated `moe_zones` would be more specific.
- User-care severity: Notable, school-zone enrolment rights drive both renter family appeal and buyer price premium, though the risk-score indicator is currently a placeholder.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | School zone match | School zoning | School enrolment zone |
| On-screen, finding (1 sentence, "(no rule)" if none exists) | (no rule, indicator value is hard-coded neutral 50) | (no rule yet) | (indicator hard-coded neutral 50; `school_zone` indicator currently a placeholder per risk_score.py:756) |
| Hosted Quick, label (≤60 chars) | School zone | School zone | School enrolment zone (MoE) |
| Hosted Quick, narrative (1 sentence) | This address is in a school's home zone. | The address sits in a school enrolment zone; see the schools list for which one(s). | MoE enrolment-zone match (zoned school name in `HostedSchoolZones.tsx`). |
| Hosted Full, label (≤60 chars) | School zone | School enrolment zone | School enrolment zone (MoE) |
| Hosted Full, narrative + tech (≤2 sentences) | This address is in a school's home zone, so kids living here have a right to enrol there. | This address is in a school enrolment zone. In-zone students must be accepted; out-of-zone places are usually balloted and capped year-by-year. | Address intersects MoE `school_zones`. Source: Ministry of Education. The `school_zone` risk-score indicator (WEIGHTS_PLANNING 0.15) is currently a placeholder fixed at 50 (see risk_score.py:756). |

---

## Local coverage audit

| Indicators | Critical | Notable | Context | Background |
|---|---|---|---|---|
| 32 | 2 | 12 | 6 | 12 |

Severity roll-up:

- **Critical (2):** `contaminated_listed`, `epb_listed`.
- **Notable (12):** `max_height_m`, `height_variation_limit`, `heritage_listed`, `transmission_line_distance_m`, `in_viewshaft`, `in_character_precinct`, `in_heritage_overlay`, `in_ecological_area`, `in_special_character`, `notable_trees_50m`, `in_mana_whenua`, `school_zone`.
- **Context (6):** `zone_name`, `zone_category`, `resource_consents_500m_2yr`, `infrastructure_5km`, `park_count_500m`, `nearest_park_name`.
- **Background (12):** `zone_code`, `viewshaft_name`, `viewshaft_significance`, `character_precinct_name`, `heritage_overlay_name`, `heritage_overlay_type`, `notable_tree_nearest`, `ecological_area_name`, `ecological_area_type`, `special_character_name`, `mana_whenua_name`, `nearest_park_distance_m`.

Other coverage:

| Indicators | With findings | With source_key | Missing on hosted-full |
|---|---|---|---|
| 32 | 17 (zone_name, max_height_m via recommendation, height_variation_limit, heritage_listed, contaminated_listed, epb_listed, resource_consents_500m_2yr, infrastructure_5km, transmission_line_distance_m, in_viewshaft, in_character_precinct, in_heritage_overlay, in_special_character, in_ecological_area, in_mana_whenua, notable_trees_50m, nearest_park_name) | 0 | 0 (every primary indicator has at least a Pro hosted-full row; "name" / "type" sub-fields are deliberately bundled) |

Notes:
- "With findings" counts indicators that drive at least one rule in `report_html.py` (Insight, recommendation, or executive-summary line). Sub-fields (e.g. `viewshaft_name`) are bundled into the parent indicator's Insight, not counted separately.
- "With source_key" is **0** for the entire category. Every Planning Insight in `report_html.py` calls `Insight(...)` without `source=`, so no attribution is wired. This is the dominant provenance gap in this slice; see Local gap list below.
- **Critical indicators lacking a finding rule:** none. Both Critical-tier indicators (`contaminated_listed`, `epb_listed`) have at least one Insight or recommendation in `report_html.py` today; the gap is `source=` attribution, not rule existence.

## Local gap list

Indicators with UNKNOWN entries or missing source_key:

| Indicator | Issue |
|---|---|
| `planning.zone_name` | source_key TODO. `council_zones` exists in SOURCE_CATALOG (report_html.py:672); attach to leasehold / zone-derived findings. No Insight currently exists for the zone field by itself. |
| `planning.zone_code` | source_key TODO. Bundled with `zone_name`. |
| `planning.zone_category` | source_key TODO. Bundled with `zone_name`. |
| `planning.max_height_m` | source_key TODO. `council_zones` is closest existing key; a dedicated `council_height_controls` would be more precise. Also: `zone_permissiveness` and `height_limit` indicators are hard-coded to neutral 50 (`risk_score.py:749-750`), so the field is rendered but does not move the planning sub-score today. |
| `planning.height_variation_limit` | source_key TODO. Insight at report_html.py:1500 needs `source=`. Add `council_height_variation` to SOURCE_CATALOG (or reuse `council_zones`). Auckland-only. |
| `planning.heritage_listed` | source_key TODO. Insight at report_html.py:2050 should attach `heritage_nz` (already in SOURCE_CATALOG at :658). |
| `planning.contaminated_listed` | source_key TODO. Insight at report_html.py:2043 should attach `council_slur` (already in SOURCE_CATALOG at :667). |
| `planning.epb_listed` | source_key TODO. Insight at report_html.py:2036 should attach `mbie_epb` (already in SOURCE_CATALOG at :650). |
| `planning.resource_consents_500m_2yr` | source_key TODO. Insight at report_html.py:2077 needs `source=`. **No `council_resource_consents` key in SOURCE_CATALOG** (needs adding). |
| `planning.infrastructure_5km` | UNKNOWN: no DataSource key found in `data_loader.py` for `infrastructure_projects` table. Loader appears to be a one-off / external import. source_key TODO. **No `te_waihanga` key in SOURCE_CATALOG** (needs adding). |
| `planning.transmission_line_distance_m` | UNKNOWN: no active DataSource (table `transmission_lines` is a static historical snapshot per `DATA-PROVENANCE.md:203`). source_key TODO. `transpower` exists in SOURCE_CATALOG (report_html.py:674); attach to Insight at report_html.py:2064. |
| `planning.in_viewshaft` (+ name + significance) | source_key TODO. Insight at report_html.py:1406 needs `source=`. **No `council_viewshafts` key** (needs adding, or reuse `council_zones`). |
| `planning.in_character_precinct` (+ name) | source_key TODO. Insight at report_html.py:1415 needs `source=`. **No `council_character_precincts` key** (needs adding). |
| `planning.in_heritage_overlay` (+ name + type) | source_key TODO. Insight at report_html.py:1455 should attach `council_heritage_overlay` (already in SOURCE_CATALOG at :673). |
| `planning.in_special_character` (+ name) | source_key TODO. Insight at report_html.py:1464 needs `source=`. **No `council_special_character` key** (needs adding). |
| `planning.in_ecological_area` (+ name + type) | source_key TODO. Insight at report_html.py:1474 needs `source=`. **No `council_ecological` key** (needs adding). |
| `planning.in_mana_whenua` (+ name) | source_key TODO. Insight at report_html.py:1484 needs `source=`. **No `council_mana_whenua` key** (needs adding). |
| `planning.notable_trees_50m` (+ nearest) | source_key TODO. Insight at report_html.py:1493 needs `source=`. **No `council_notable_trees` key** (needs adding). |
| `planning.park_count_500m` | source_key TODO. No Insight currently. If added, `osm_amenities` is the closest existing key; a dedicated `council_parks` would be cleaner. |
| `planning.nearest_park_name` (+ distance_m) | source_key TODO. Insight at report_html.py:1509 needs `source=`. |
| `school_zone` (planning indicator) | source_key TODO. Indicator value hard-coded neutral 50 at `risk_score.py:756` (no real implementation). **No `moe_zones` key in SOURCE_CATALOG**; `moe_schools` (report_html.py:657) exists for the directory but a `moe_zones` key would be more specific. |

Required SOURCE_CATALOG additions to close source_key gaps in this slice:
1. `te_waihanga`, for the infrastructure pipeline.
2. `council_resource_consents`, distinct from generic `council_zones`.
3. `council_viewshafts`
4. `council_character_precincts`
5. `council_special_character`
6. `council_ecological`
7. `council_mana_whenua`
8. `council_notable_trees`
9. `council_height_controls` and `council_height_variation`
10. `council_parks`, distinct from generic `osm_amenities`.
11. `moe_zones`, distinct from `moe_schools`.

Required code additions (separate task, not for this doc):
- Wire `source=_src("…")` onto every planning `Insight(...)` call in `report_html.py` (lines 1402, 1413, 1453, 1462, 1471, 1482, 1493, 1500, 1509, 2036, 2043, 2050, 2064, 2077). Even where the SOURCE_CATALOG key already exists (e.g. `mbie_epb`, `heritage_nz`, `council_slur`, `council_heritage_overlay`, `transpower`), the `source=` parameter is currently absent.
- Implement real logic for `zone_permissiveness` (currently `risk_score.py:749 = 50`), `height_limit` (`:750 = 50`) and `school_zone` (`:756 = 50`); these three account for 0.60 of the planning sub-score weight but contribute zero variance today.

## Local conflict list

Same field labelled or read inconsistently across surfaces today:

| Field | Conflict (file:line) |
|---|---|
| `planning.notable_trees_50m` ↔ `notable_tree_count_50m` aliasing | SQL returns key `notable_trees_50m` (migration 0054:821) but downstream readers use either name: `HostedNeighbourhoodStats.tsx:62` reads `(planning.notable_trees_50m ?? planning.notable_tree_count_50m)`; `PlanningSection.tsx:145` uses `notable_tree_count_50m` only. If the alias rename is incomplete somewhere the field can silently drop to null. |
| `planning.infrastructure_5km` ↔ `infrastructure_projects` aliasing | SQL returns key `infrastructure_5km` (migration 0054:807) but `report_html.py:3967` and `HostedInfrastructure.tsx:27` read `(planning.infrastructure_5km ?? planning.infrastructure_projects ?? [])`. Two names for one field, silent-null risk. |
| `planning.transmission_line_distance_m` ↔ `transmission_distance_m` aliasing | `report_html.py:2057,2180` reads `(planning.transmission_distance_m or planning.transmission_line_distance_m)`. SQL only emits `transmission_line_distance_m` (migration 0054:808); `transmission_distance_m` is a frontend / Python alias that may not be set, causing a fallback chain. |
| `planning.in_special_character` ↔ `in_special_character_area` aliasing | SQL returns `in_special_character` (migration 0054:828); frontend reads `in_special_character_area` (`PlanningSection.tsx:37`, `compareSections.ts:493`). Migration name vs. frontend name diverge; the rename must be done in Python overlay code or both names risk reading null at different surfaces. |
| `planning.epb_listed` ↔ `is_epb_listed` divergence | SQL returns `epb_listed` (migration 0054:805); `report_html.py:2036` and `:4913` read `is_epb_listed`; `PlanningSection.tsx:137` reads `epb_listed`. Two names for one boolean; Python overlay must populate `is_epb_listed` from `epb_listed`, otherwise the Insight rule never fires while the on-screen pill does. |
| `planning.heritage_listed` ↔ `is_heritage_listed` divergence | Same pattern: SQL `heritage_listed` (migration 0054:803); `report_html.py:2050` reads `is_heritage_listed`. |
| `planning.contaminated_listed` ↔ `is_contaminated` divergence | Same pattern: SQL `contaminated_listed` (migration 0054:804); `report_html.py:2043` reads `is_contaminated`. |
| `planning.resource_consents_500m_2yr` ↔ `consent_count` aliasing | SQL emits `resource_consents_500m_2yr` (migration 0054:806); on-screen `PlanningSection.tsx:166` reads `consent_count`; report_html reads the SQL name. Same value, two names; if the Python alias step misses, the on-screen tile renders "No data". |
