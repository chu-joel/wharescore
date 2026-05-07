# Indicator Wording: Demographics

Per-indicator Meaning blocks and wording matrix (6 surfaces x 3 personas) for every Demographics row in `docs/wording/_INVENTORY.md` (lines 317-366). Verified against `backend/app/services/snapshot_generator.py`, `backend/app/services/data_loader.py`, and `frontend/src/components/report/HostedDemographics.tsx`.


## Changes in this pass

- **`crime_trend` Meaning block rewritten:** prior block fabricated a `police_crime_history` DataSource, an `mv_crime_density_history` materialised view, and a `HostedNeighbourhoodStats.tsx` render, none of which exist. Verified facts: the `crime` table (loaded outside `data_loader.py`'s DataSource registry) is queried directly by `_q_crime_trend()` at `snapshot_generator.py:315`, and the snapshot field is rendered by `frontend/src/components/property/CrimeTrendSparkline.tsx`, mounted in `QuestionContent.tsx:261, 264`. source_key is `nz_police_crime` (registered in `report_html.py:656`).
- **Stale `data_loader.py:NNNN` line refs replaced with key-only citations** (e.g. `data_loader.py:3923` → `data_loader.py load_census_demographics`). Line numbers in `data_loader.py` drift across edits; key/function-name citations are stable. This applies to every previously cited `data_loader.py` line in this file.
- **Self-stale citation fixed:** "Lines 1116-1122" updated to actual range 1122-1131. Previous "Conflict list updated" claim retracted (the citation in the previous pass referenced its own stale line range).
- **Wording cells unchanged.** This pass is corrections to the Meaning blocks (citations + the `crime_trend` row) only.

Tone polish pass (this iteration):

- **Severity line added to all 44 Meaning blocks.** Current tally (after the strict-demotion pass): 0 Critical, 1 Notable, 30 Context, 13 Background. Reason: pure demographic mix (age, ethnicity, household composition, tenure, commute mode, business counts) is neutral context, not a finding. The only Notable retained is `crime_trend` (police-recorded victimisations, area-level safety signal). Earlier passes had marked employee_count_2024, employee_growth_pct as Notable; demoted to Context as workplace-economy signals do not change a tenancy or purchase decision within a year on their own. Background covers denominators and identifier labels.
- **Em-dashes stripped from the entire file** (Meaning blocks now included, where the prior pass had left them). All 80+ remaining em-dashes replaced with commas. The single `,` glyph that remains is on the next line, inside backticks, documenting the earlier placeholder swap.
- **Placeholder `,` swapped for explicit text.** `, (out of scope)` -> `(out of scope)`; bare `,` finding cells -> `(no rule)`; `Score contribution: ,` -> `Score contribution: N/A`; `What it does NOT tell you: ,` -> `N/A`.
- **Editorialising trimmed from Buyer/Renter narratives.** Phrases like "useful for" demoted to neutral statements; "useful for sense-checking what neighbours can afford" reworded to "Useful for sense-checking affordability against the area"; "warning of this" prose untouched in Meaning blocks but no comparable phrasing remains in user-facing cells. Loaded class language ("warning", "alarming", "deadly", etc.) audited and not present.
- **NZ English check.** "neighbours", "favour", "behaviour" not introduced; existing "neighbourhood" preserved; "Maori" written without macron (matches existing convention in the file and Stats NZ field aliases) - flag for cross-category tone call if other categories adopt macrons.
- **Stray `�` mojibake on line 1177 fixed** while editing the conflict-list closer (was a U+FFFD that crept in during a previous save).
- **No code edits, no file paths or dot paths changed, no indicator names changed, no findings invented.** All 44 indicators remain `(no rule)` in the On-screen finding row.

NB: the prior pass's claim "all file:line references grep-confirmed" was false for `data_loader.py` line numbers; they had drifted by 150-500 lines and one (3974) pointed at unrelated `contaminated_land` code. That claim is removed.

Editorial / strict-demotion pass (this iteration):

- **Severity demoted on two business indicators.** `business_demography.employee_count_2024` and `business_demography.employee_growth_pct` moved from Notable to Context. Demographics rarely warrants Notable; only crime_trend retains it.
- **Severity tally corrected.** Prior tally claimed 0 / 11 / 19 / 14 but only 3 cells in the file actually carried Notable. Real distribution is 0 / 1 / 30 / 13.
- **Neutrality fix on age 65+ buyer cell.** Removed phrase "Relevant for noise levels, school demand and resale audience"; population characteristics should not be framed as noise or resale audience considerations. Cell now states the share without commentary.
- **Em-dashes stripped from the whole file.** Previous pass deliberately spared Meaning blocks; this pass strips them everywhere except the single literal-glyph reference inside backticks on line 17.
- **No new indicators, no dot-path changes, no rewrites of already-neutral cells, no fabricated finding rules.**

Category-wide notes (apply to every indicator below unless overridden):

- **Source authority:** Stats NZ (Tatauranga Aotearoa).
- **Vintage:** Census 2023 for census_demographics / census_households / census_commute. Business Demography 2024 for business_demography.
- **Geography:** Statistical Area 2 (SA2). The SA2 used is the SA2 the address geocodes into, joined via `addresses.sa2_code` (see `migrations/0054_flood_nearest_m.sql:53-54`). Resolution is SA2 (around 2,000 to 4,000 people), never block- or street-level.
- **Query path:** All Demographics fields are produced by `snapshot_generator.generate_snapshot()`; they live in `report_snapshots.snapshot_json`, NOT in `get_property_report()`. Specifically `_q_census_demographics` (snapshot_generator.py:590-607), `_q_census_households` (609-625), `_q_census_commute` (627-643), `_q_business_demography` (748-758). Returned at snapshot_generator.py:941-945.
- **Inventory inconsistency (table column):** Inventory rows for `census_demographics.*` list table `census_population` or `census_ethnicity`. Code shows ALL `census_demographics.*` fields (population, age, ethnicity, birthplace) live in a single table named `census_demographics` (see `INSERT INTO census_demographics` in `load_census_demographics()` in `data_loader.py`). I record the verified table name in each Meaning block.
- **Inventory inconsistency (DataSource keys):** Inventory writes `stats_census_2023`, `stats_census_2018`, `stats_census_commute`, `stats_business_demography`. The actual `DataSource(...)` keys registered at the bottom of `data_loader.py` are `census_demographics`, `census_households`, `census_commute`, `business_demography` (grep `DataSource("census_demographics"`). There is no separate 2018 DataSource; `population_2018` is loaded by `census_demographics` from the same Stats NZ ArcGIS endpoint (VAR_1_2). I record the verified keys.
- **Findings:** None of the 44 Demographics rows drive an `Insight(...)` rule in `report_html.py` (`finding?` column = `N/A` for every row). On-screen render is `N/A` for every row (Demographics is hosted-only). source_key is therefore N/A for all rows.
- **Score contribution:** None. No Demographics field is referenced in `risk_score.py`.
- **Coverage:** National. Census 2023 covers all NZ SA2 areas (~2,400). Business Demography 2024 covers all SA2 areas with ANZSIC employment. Cells may suppress for `-999` privacy floors (handled by `_v()` → `None` in loaders). See WIRING-TRACES § City-coverage-matrix; Demographics is uniformly available.

---

## census_demographics.*

### Area name (`census_demographics.sa2_name`)
- What it measures: Stats NZ official SA2 name (e.g. "Mount Victoria") for the area the address sits in.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: `2023_Census_totals_by_topic_for_individuals_by_SA2/FeatureServer/0` (`load_census_demographics()` in `data_loader.py`), field `SA22023_V1_00_NAME_ASCII`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics` (column `sa2_name`). Inventory says `census_population`, table is actually `census_demographics`.
- Query path: `snapshot_generator._q_census_demographics()` → `snapshot.census_demographics.sa2_name`.
- Rendered by: `frontend/src/components/report/HostedDemographics.tsx:67` (page subtitle "Census 2023 data for {areaName}"). Falls back to `census_households.sa2_name` then "this area".
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: All NZ SA2s (national).
- Common misreading: Conflating SA2 with suburb. SA2s are statistical units that often span or split named suburbs.
- What it does NOT tell you: Suburb identity, council ward, school zone. See `address.sa2_code` (Property category) for the code itself.
- source_key status: N/A (no finding).
- User-care severity: Background, area label rather than a metric.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: Demographics is hosted-only) | (out of scope: Demographics is hosted-only) | (out of scope: Demographics is hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Area | Statistical area | SA2 (Stats NZ) |
| Hosted Quick narrative | Census stats for {sa2_name}. | Census stats below cover {sa2_name}. | Stats below are for SA2 {sa2_name} (Stats NZ Census 2023). |
| Hosted Full label | Area | Statistical area | SA2 (Stats NZ Census 2023) |
| Hosted Full narrative + tech | The Census figures below describe {sa2_name}, not just this street. | All neighbourhood Census stats below describe {sa2_name} (Stats NZ's standard reporting unit). | All Census stats are reported at SA2 {sa2_name} (Stats NZ Census 2023, around 2,000 to 4,000 people, not block-level). |

### Population in 2018 (`census_demographics.population_2018`)
- What it measures: Usually-resident population count for this SA2 at the 2018 Census.
- Source authority: Stats NZ Census 2018 (re-published in the 2023 individuals topic dataset, field `VAR_1_2`).
- Dataset / endpoint: same FeatureServer as 2023 (VAR_1_2 in `out_fields` literal in `load_census_demographics()` in `data_loader.py`).
- DataSource key(s): `census_demographics` (one DataSource loads both years).
- Table(s): `census_demographics.population_2018`.
- Query path: snapshot_generator.py:590 → `snapshot.census_demographics.population_2018`.
- Rendered by: `HostedDemographics.tsx:68-70` (used to compute `popChange` only, the 2018 raw value is not displayed; only the % delta vs 2023).
- Threshold / classification logic: Comparison only, `(pop_2023 - pop_2018) / pop_2018`. Negative shown red, non-negative green (HostedDemographics.tsx:130).
- Score contribution: N/A
- Coverage: National. `-999` suppressed → `None`.
- Common misreading: Treating change as a trend extrapolation (it's two snapshots 5 years apart).
- What it does NOT tell you: Whether growth is from new dwellings, household size change, or boundary change. SA2 boundaries between 2018 and 2023 are mostly stable but not identical.
- source_key status: N/A.
- User-care severity: Background, used only as a baseline behind the displayed 5-year delta.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Area in 2018 | Population baseline (2018) | 2018 usual residents |
| Hosted Quick narrative | Used to show how this area has grown. | Used as the 5-year baseline behind the population change figure. | 2018 baseline used to derive 5-year delta vs 2023 (Stats NZ VAR_1_2). |
| Hosted Full label | 2018 population | 2018 population (baseline) | Population 2018 (Stats NZ) |
| Hosted Full narrative + tech | The area had this many people 5 years ago. | Five-year growth is calculated against this 2018 figure. | Usually-resident population at 2018 Census. SA2 boundaries are largely stable across the two censuses but minor edge changes can affect raw deltas (Stats NZ VAR_1_2). |

### Population in 2023 (`census_demographics.population_2023`)
- What it measures: Usually-resident population count for this SA2 at the 2023 Census.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_3` (in `out_fields` literal in `load_census_demographics()` in `data_loader.py`).
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.population_2023`.
- Query path: snapshot_generator.py:590 → `snapshot.census_demographics.population_2023`.
- Rendered by: `HostedDemographics.tsx:127` ("Population" tile, large indigo number) and used as denominator for `age_65_plus` percentage (line 140).
- Threshold / classification logic: None on the value itself; growth tile colour-codes the % change green/red.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Treating SA2 population as suburb population, SA2s often only cover part of a named suburb.
- What it does NOT tell you: Density, age skew, or the address's specific block.
- source_key status: N/A.
- User-care severity: Context, neutral count of how many people live in the SA2.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | People in this area | Area population | Population (2023 Census) |
| Hosted Quick narrative | About {pop} people live in {sa2_name}. | {sa2_name} has ~{pop} usually-resident people, up/down {popChange}% since 2018. | {sa2_name} population {pop} at Census 2023 ({popChange}% vs 2018; Stats NZ VAR_1_3). |
| Hosted Full label | People living here | Population in this SA2 | Usually-resident population (2023) |
| Hosted Full narrative + tech | About {pop} people live in this area, {popChange}% more or fewer than five years ago. | {sa2_name} has ~{pop} usually-resident people, a {popChange}% change since 2018. Useful for gauging whether the area is growing or stable. | Usually-resident population for SA2 {sa2_name} is {pop} (Stats NZ Census 2023, VAR_1_3); 5-year change {popChange}% vs 2018. |

### Median age (`census_demographics.median_age`)
- What it measures: Median age in years of usually-resident population in this SA2.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_69`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.median_age`.
- Query path: snapshot_generator.py:590 → `snapshot.census_demographics.median_age`.
- Rendered by: `HostedDemographics.tsx:136` (amber tile "Median Age").
- Threshold / classification logic: None, raw integer years displayed.
- Score contribution: N/A
- Coverage: National. Suppressed to `None` if `-999`.
- Common misreading: Reading median age as "average resident". Median is the midpoint; mean and skew differ.
- What it does NOT tell you: Whether the area is age-mixed or bimodal (e.g. students + retirees produce a midrange median that masks both).
- source_key status: N/A.
- User-care severity: Context, demographic mix indicator without decision impact on its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Typical age | Median age | Median age (years) |
| Hosted Quick narrative | Half of locals are older than {age}, half younger. | Median age in {sa2_name} is {age}. Useful for picturing the neighbourhood mix. | SA2 median age {age} years (Stats NZ VAR_1_69, Census 2023). |
| Hosted Full label | Typical age in this area | Median age (years) | Median age, SA2 (2023) |
| Hosted Full narrative + tech | Half of locals are older than {age} and half younger. | The median resident here is {age}. A quick read on whether this is a younger or more established neighbourhood. | Median age of usually-resident population is {age} years for SA2 {sa2_name} (Stats NZ Census 2023, VAR_1_69); does not capture distribution shape. |

### Aged 65 plus (`census_demographics.age_65_plus`)
- What it measures: Count of usually-resident people aged 65+ in this SA2.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_83`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.age_65_plus`.
- Query path: snapshot_generator.py:590 → `snapshot.census_demographics.age_65_plus`.
- Rendered by: `HostedDemographics.tsx:138-141`, displayed only as a percentage of `population_2023` ("X% aged 65+" subtitle on the median-age tile).
- Threshold / classification logic: None; raw share rounded to whole percent.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Equating "% aged 65+" with retiree concentration; some 65+ residents are still in paid work.
- What it does NOT tell you: Mobility needs, household type, or proportion living alone (see `hh_one_person`).
- source_key status: N/A.
- User-care severity: Context, age-mix factual share with no rule attached.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Older neighbours | Share aged 65 plus | Population 65+ (count) |
| Hosted Quick narrative | About {pct} of people here are 65 or older. | {pct} of {sa2_name} residents are 65+, vs the NZ average around 17%. | SA2 share aged 65+ is {pct} (Stats NZ VAR_1_83 / VAR_1_3, Census 2023). |
| Hosted Full label | Share aged 65 or older | Share of residents aged 65+ | Age 65+ share, SA2 (2023) |
| Hosted Full narrative + tech | About {pct} of locals are 65 or older. | {pct} of residents in {sa2_name} are 65 or older. | {pct} of usually-resident population is aged 65+ (Stats NZ Census 2023, VAR_1_83 / VAR_1_3); count not age-distribution. |

### Ethnicity total responses (`census_demographics.ethnicity_total`)
- What it measures: Sum of ethnic-group responses for this SA2 (denominator for ethnicity shares). Each person can list multiple ethnicities, so this exceeds population.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_167`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.ethnicity_total`. Inventory says `census_ethnicity`, actual table is `census_demographics`.
- Query path: snapshot_generator.py:590 → `snapshot.census_demographics.ethnicity_total`.
- Rendered by: `HostedDemographics.tsx:91`, used as denominator only; not displayed.
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Reading the total as population, it's response count and exceeds population because of multi-response.
- What it does NOT tell you: How many people identify with multiple ethnicities.
- source_key status: N/A.
- User-care severity: Background, denominator only, not user-visible.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) | (out of scope: not rendered on Quick) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | (denominator only, not labelled to user) | (denominator only, not labelled to user) | Ethnicity total responses (denominator) |
| Hosted Full narrative + tech | (used to convert counts into percentages in the chart above) | (used to convert counts into percentages in the chart above) | Total ethnic-group responses (multi-response, exceeds population) used as denominator for the ethnicity bars (Stats NZ VAR_1_167). |

### European ethnicity (`census_demographics.ethnicity_european`)
- What it measures: Count of usual residents who identified as European in the SA2 (multi-response: people can also identify with other groups).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_158`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.ethnicity_european`.
- Query path: snapshot_generator.py:590.
- Rendered by: `HostedDemographics.tsx:93` (Full only) as a bar in the "Ethnic Composition" chart, expressed as `count / ethnicity_total`.
- Threshold / classification logic: None; share rounded to whole percent. Bar hidden if 0%.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Treating shares as exclusive, they sum to >100% because Census ethnicity is multi-response (the chart caption "People may identify with multiple ethnicities" warns of this, HostedDemographics.tsx:249).
- What it does NOT tell you: Country of origin (see born_overseas), language, or migration recency.
- source_key status: N/A.
- User-care severity: Context, neutral demographic share.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full to avoid surface-level demographic profiling) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | European | European | European (Census ethnic group) |
| Hosted Full narrative + tech | About {pct} of locals identify as European. People can choose more than one ethnicity. | {pct} of responses in {sa2_name} identify as European (Census ethnicity is multi-response, so totals exceed 100%). | European share {pct} of total ethnic-group responses in SA2 {sa2_name} (Stats NZ VAR_1_158 / VAR_1_167, Census 2023; multi-response). |

### Maori ethnicity (`census_demographics.ethnicity_maori`)
- What it measures: Count of usual residents who identified as Maori in this SA2 (multi-response).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_159`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.ethnicity_maori`.
- Query path: snapshot_generator.py:590.
- Rendered by: `HostedDemographics.tsx:94` as bar in "Ethnic Composition" (Full only).
- Threshold / classification logic: Share = `count / ethnicity_total`, rounded.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Reading 100% sum into the chart, multi-response means totals exceed 100%.
- What it does NOT tell you: Iwi, marae, or te reo speaking proficiency (see `lang_maori` in source table, not exposed).
- source_key status: N/A.
- User-care severity: Context, neutral demographic share.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Maori | Maori | Maori (Census ethnic group) |
| Hosted Full narrative + tech | About {pct} of locals identify as Maori. | {pct} of responses in {sa2_name} identify as Maori; Census ethnicity is multi-response. | Maori share {pct} of total ethnic-group responses in SA2 {sa2_name} (Stats NZ VAR_1_159 / VAR_1_167, Census 2023; multi-response). |

### Asian ethnicity (`census_demographics.ethnicity_asian`)
- What it measures: Count of usual residents who identified as Asian in this SA2 (multi-response).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_161`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.ethnicity_asian`.
- Query path: snapshot_generator.py:590.
- Rendered by: `HostedDemographics.tsx:95` (Full only).
- Threshold / classification logic: Share = `count / ethnicity_total`.
- Score contribution: N/A
- Coverage: National.
- Common misreading: "Asian" is a Stats NZ Level-1 group covering many heritages (Chinese, Indian, Filipino, etc.).
- What it does NOT tell you: Country-of-origin breakdown, Stats NZ's Level-2 detail is not loaded.
- source_key status: N/A.
- User-care severity: Context, neutral demographic share.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Asian | Asian | Asian (Census ethnic group) |
| Hosted Full narrative + tech | About {pct} of locals identify as Asian. People may identify with more than one group. | {pct} of responses in {sa2_name} identify as Asian. This is a Level-1 grouping that includes Chinese, Indian, Filipino and other heritages. | Asian share {pct} of total ethnic-group responses (Stats NZ Level-1 grouping VAR_1_161 / VAR_1_167; multi-response). |

### Pacific ethnicity (`census_demographics.ethnicity_pacific`)
- What it measures: Count of usual residents who identified as a Pacific peoples ethnicity in this SA2 (multi-response).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_160`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.ethnicity_pacific`.
- Query path: snapshot_generator.py:590.
- Rendered by: `HostedDemographics.tsx:96` (Full only).
- Threshold / classification logic: Share = `count / ethnicity_total`.
- Score contribution: N/A
- Coverage: National.
- Common misreading: "Pacific" aggregates several ethnic groups (Samoan, Tongan, Cook Islands Maori, Niuean, Fijian, etc.), not a single identity.
- What it does NOT tell you: Specific Pacific ethnic-group breakdown.
- source_key status: N/A.
- User-care severity: Context, neutral demographic share.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Pacific peoples | Pacific peoples | Pacific peoples (Level 1) |
| Hosted Full narrative + tech | About {pct} of locals identify as Pacific peoples. People may pick more than one group. | {pct} of responses in {sa2_name} identify as Pacific peoples. This is a Level-1 grouping covering Samoan, Tongan, Cook Islands Maori, Niuean, Fijian and others. | Pacific peoples share {pct} of total ethnic-group responses (Stats NZ VAR_1_160 / VAR_1_167; Level-1 multi-response). |

### MELAA ethnicity (`census_demographics.ethnicity_melaa`)
- What it measures: Count of usual residents identifying as Middle Eastern, Latin American or African.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_162`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.ethnicity_melaa`.
- Query path: snapshot_generator.py:590.
- Rendered by: `HostedDemographics.tsx:97` (Full only).
- Threshold / classification logic: Share = `count / ethnicity_total`. Bar hidden if 0% (filter at line 98).
- Score contribution: N/A
- Coverage: National. In most SA2s this is a small absolute count and may suppress to 0.
- Common misreading: Treating MELAA as one community, it spans three distinct continental groupings.
- What it does NOT tell you: Country-of-origin or migration recency.
- source_key status: N/A.
- User-care severity: Context, neutral demographic share.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | MELAA | Middle Eastern, Latin American, African | MELAA (Stats NZ Level 1) |
| Hosted Full narrative + tech | About {pct} of locals identify as Middle Eastern, Latin American or African. | {pct} of responses identify as Middle Eastern, Latin American or African (three distinct groupings reported together at Level 1). | MELAA share {pct} of total ethnic-group responses (Stats NZ Level-1 VAR_1_162 / VAR_1_167; multi-response). |

### Born in New Zealand (`census_demographics.born_nz`)
- What it measures: Count of usual residents whose birthplace is New Zealand.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_95`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.born_nz`. Inventory says `census_ethnicity`, actual table is `census_demographics`.
- Query path: snapshot_generator.py:590.
- Rendered by: `HostedDemographics.tsx:253` (Full only), used together with `born_overseas` to compute the "X% born overseas" caption (denominator = `born_nz + born_overseas`).
- Threshold / classification logic: None on raw value.
- Score contribution: N/A
- Coverage: National.
- Common misreading: "Born in NZ" is birthplace, not citizenship or ethnicity.
- What it does NOT tell you: Time-since-migration for the overseas-born share.
- source_key status: N/A.
- User-care severity: Background, denominator basis, not user-visible directly.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | (used internally; only the overseas share is shown) | (used internally; only the overseas share is shown) | Birthplace NZ (denominator basis) |
| Hosted Full narrative + tech | (combines with overseas-born to show "{pct} born overseas") | (combines with overseas-born to show "{pct} born overseas") | NZ-born count used with VAR_1_96 to derive the overseas-born share displayed below the ethnicity chart (Stats NZ VAR_1_95). |

### Born overseas (`census_demographics.born_overseas`)
- What it measures: Count of usual residents born outside New Zealand.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_1_96`.
- DataSource key(s): `census_demographics`.
- Table(s): `census_demographics.born_overseas`.
- Query path: snapshot_generator.py:590.
- Rendered by: `HostedDemographics.tsx:251-254` (Full only), appears as caption "{pct} born overseas" beneath the ethnicity chart, where `pct = born_overseas / (born_nz + born_overseas)`.
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Conflating overseas birth with non-citizenship or "recent migration", many overseas-born residents have lived in NZ for decades.
- What it does NOT tell you: Country of origin, time-since-arrival, or visa status.
- source_key status: N/A.
- User-care severity: Context, neutral migration share without rule attached.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Born overseas | Share born overseas | Birthplace overseas (share) |
| Hosted Full narrative + tech | About {pct} of locals were born outside New Zealand. | {pct} of residents in {sa2_name} were born outside NZ; this includes everyone from new arrivals to long-settled residents. | {pct} of usual residents born outside NZ (VAR_1_96 / (VAR_1_95+VAR_1_96), Stats NZ Census 2023); does not capture time-since-migration. |

---

## census_households.*

### Household area name (`census_households.sa2_name`)
- What it measures: SA2 name on the household record (same SA2 as `census_demographics.sa2_name`, duplicated for fallback).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: `2023_Census_totals_by_topic_for_households_by_SA2/FeatureServer/0` (`load_census_households()` in `data_loader.py`).
- DataSource key(s): `census_households`.
- Table(s): `census_households.sa2_name`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:67` as fallback when `census_demographics.sa2_name` is null.
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Same as `census_demographics.sa2_name`.
- What it does NOT tell you: N/A
- source_key status: N/A.
- User-care severity: Background, fallback label only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Area | Statistical area | SA2 (fallback) |
| Hosted Quick narrative | Census stats for {sa2_name}. | Census stats below describe {sa2_name}. | Fallback SA2 label used when individuals topic returns null (Stats NZ households topic). |
| Hosted Full label | Area | Statistical area | SA2 (households topic, fallback) |
| Hosted Full narrative + tech | These housing stats describe {sa2_name}. | All housing stats below describe {sa2_name}. | SA2 name from Stats NZ households-by-SA2 dataset, used only when the individuals topic name is null. |

### Median household income (`census_households.income_median`)
- What it measures: Median total household income (annual, NZD) for households in this SA2.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_225` (in `out_fields` literal in `load_census_households()` in `data_loader.py`).
- DataSource key(s): `census_households`.
- Table(s): `census_households.income_median`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:184-193` (Full only), large green tile "Median Household Income".
- Threshold / classification logic: None on the value; raw NZD shown.
- Score contribution: N/A
- Coverage: National. May suppress to `None` for very small SA2s.
- Common misreading: Confusing household with individual income (this is total household, multiple earners).
- What it does NOT tell you: Income distribution skew, source mix (wages vs benefits vs investment).
- source_key status: N/A.
- User-care severity: Context, area income anchor for affordability sense-check; no finding rule attached.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full to avoid steering renters by neighbour income) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Typical household income | Median household income | Median household income (2023) |
| Hosted Full narrative + tech | The middle household here brings in about ${income} a year. | Half of households in {sa2_name} earn under ${income} and half over. Useful for sense-checking affordability against the area. | Median household income ${income} for SA2 {sa2_name} (Stats NZ Census 2023, VAR_4_225); total household, not individual; not adjusted for household size. |

### Income brackets (`census_households.income_under_20k..income_200k_plus`, 8 brackets)
- What it measures: Count of households in each of 8 income bands (under $20k, $20-30k, $30-50k, $50-70k, $70-100k, $100-150k, $150-200k, $200k+).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer fields `VAR_4_214`..`VAR_4_221` (in `out_fields` literal in `load_census_households()` in `data_loader.py`).
- DataSource key(s): `census_households`.
- Table(s): `census_households.income_under_20k`, `income_20k_30k`, `income_30k_50k`, `income_50k_70k`, `income_70k_100k`, `income_100k_150k`, `income_150k_200k`, `income_200k_plus`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:107-110` (Full only), collapsed into 4 grouped bars: `<$30k`, `$30-70k`, `$70-150k`, `$150k+`.
- Threshold / classification logic: Bracket sums divided by computed `incomeTotal` (sum of all 8); rounded percent.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Reading bracket shares as the chance any one neighbour falls in that band, they are household shares.
- What it does NOT tell you: Per-person income, household size context, deprivation index.
- source_key status: N/A.
- User-care severity: Context, distribution shape supplements the median.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Household income mix | Income distribution | Household income brackets (8 bands grouped to 4) |
| Hosted Full narrative + tech | The chart shows what households here earn. Most fall in the {top-band} group. | {top-band-pct} of households in {sa2_name} earn {top-band}. Compare with the median to sense-check the distribution. | 8 Stats NZ household income bands (VAR_4_214-221) collapsed to 4 buckets (<$30k, $30-70k, $70-150k, $150k+) for chart display. |

### Owner-occupied tenure (`census_households.tenure_owned`)
- What it measures: Count of households who own (with or without a mortgage) the dwelling they occupy.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_184`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.tenure_owned`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:206` (Full only), "Homeownership rate" StatRow as `tenure_owned / tenure_total`.
- Threshold / classification logic: None; rounded percent.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Treating "Homeownership rate" as the resale demographic, owners may be landlords' families, family trusts are counted separately.
- What it does NOT tell you: Mortgage vs freehold split, owner-occupier vs investor.
- source_key status: N/A.
- User-care severity: Context, ownership composition is descriptive, not decision-changing on its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Owners on this street type | Homeownership rate | Owner-occupied tenure (Census 2023) |
| Hosted Full narrative + tech | About {pct} of households here own the home they live in. | {pct} of households in {sa2_name} own their dwelling (with or without a mortgage). A high figure usually means more owner-occupiers than landlords. | Owner-occupied share of households is {pct} (Stats NZ VAR_4_184 / VAR_4_189, Census 2023); does not separate mortgaged vs freehold. |

### Not-owned tenure (`census_households.tenure_not_owned`)
- What it measures: Count of households who do not own their dwelling (rentals, private, social, other).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_185`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.tenure_not_owned`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:207` (Full only), "Renting" StatRow.
- Threshold / classification logic: Share = `tenure_not_owned / tenure_total`.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Equating "Renting" with private market only, includes social housing.
- What it does NOT tell you: Private vs Kainga Ora vs council split (see `landlord_*`).
- source_key status: N/A.
- User-care severity: Context, complement to ownership share.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Renters in this area | Renting share | Non-owner-occupied tenure share |
| Hosted Full narrative + tech | About {pct} of households here rent their home. | {pct} of households in {sa2_name} rent (private market plus social housing). | Non-owner-occupied share is {pct} (Stats NZ VAR_4_185 / VAR_4_189); landlord breakdown shown separately. |

### Family-trust tenure (`census_households.tenure_family_trust`)
- What it measures: Count of households where the dwelling is held in a family trust.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_186`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.tenure_family_trust`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:208` (Full only), "Family trust" StatRow.
- Threshold / classification logic: Share = `tenure_family_trust / tenure_total`.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Treating trust-held homes as rentals, they are typically owner-occupiers using a trust structure.
- What it does NOT tell you: Whether the trust is for tax, asset-protection, or estate-planning purposes.
- source_key status: N/A.
- User-care severity: Context, secondary tenure category that fills out the picture.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Held in family trust | Family trust ownership | Family-trust tenure share |
| Hosted Full narrative + tech | About {pct} of households here have the home held in a family trust. | {pct} of households in {sa2_name} hold their dwelling in a family trust (typically owner-occupiers using a trust structure). | Family-trust tenure share {pct} (Stats NZ VAR_4_186 / VAR_4_189, Census 2023). |

### Tenure total (`census_households.tenure_total`)
- What it measures: Total households with stated tenure status (denominator for tenure_owned / tenure_not_owned / tenure_family_trust).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_189`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.tenure_total`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:206` (Full only), denominator for the ownership / renting / trust StatRows; not displayed.
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Reading as total households (it's tenure-stated only, non-stated tenure is excluded).
- What it does NOT tell you: How many households did not state tenure.
- source_key status: N/A.
- User-care severity: Background, denominator only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not rendered) | (out of scope: not rendered) | (out of scope: not rendered) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | (denominator only, not labelled) | (denominator only, not labelled) | Tenure-stated households (denominator) |
| Hosted Full narrative + tech | (used internally to convert tenure counts to percentages) | (used internally to convert tenure counts to percentages) | Stats NZ VAR_4_189: tenure-stated household denominator (excludes "not stated"). |

### Census median rent (`census_households.rent_median`)
- What it measures: Median weekly rent paid by renting households, in NZD per week.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_261`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.rent_median`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:209` (Full only), "Census median (2023)" StatRow showing `${rent_median}/wk`.
- Threshold / classification logic: None on the raw value.
- Score contribution: N/A
- Coverage: National. May suppress to `None`.
- Common misreading: Confusing this 2023 Census median with current MBIE Bond Centre or asking-rent figures (see Market category for the live rent advisor).
- What it does NOT tell you: Current market rent. Census 2023 was 7 March 2023; rents have moved since.
- source_key status: N/A.
- User-care severity: Context, dated rent reference, sanity check against the live Rent Advisor.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full; live advisor is shown elsewhere) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Census rent (2023) | Census 2023 median rent | Median weekly rent, Census 2023 |
| Hosted Full narrative + tech | The middle renter here paid about ${rent} a week at the 2023 Census. Current market rents may differ. | Census-night median rent in {sa2_name} was ${rent}/wk on 7 March 2023; today's market rent will differ. See the Rent Advisor section for current asking rents. | Census 2023 median weekly rent ${rent} (Stats NZ VAR_4_261, snapshot 7 Mar 2023); use Bond Centre / Trade Me data for live market signal. |

### Crowded households (`census_households.hh_crowded`)
- What it measures: Count of households defined as crowded under Stats NZ's Canadian National Occupancy Standard (people-per-bedroom thresholds).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_48`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.hh_crowded`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:211` (Full only), "Crowded households" StatRow as `hh_crowded / hh_total`.
- Threshold / classification logic: Stats NZ classifies crowding using the Canadian Standard (need 1+ extra bedroom). Share rounded to whole percent.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Equating crowding with poverty, large multigenerational households may be by choice and well-resourced.
- What it does NOT tell you: Reasons for crowding (multigenerational, flatting, financial).
- source_key status: N/A.
- User-care severity: Context, area-level housing-stress signal; no finding rule attached.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Crowded households | Crowded households | Crowded households (Canadian Standard) |
| Hosted Full narrative + tech | About {pct} of households here are classed as crowded, meaning they need at least one more bedroom. | {pct} of households in {sa2_name} are classed as crowded under Stats NZ's Canadian National Occupancy Standard. | {pct} of households crowded under the Canadian National Occupancy Standard (Stats NZ VAR_4_48 / VAR_4_80, Census 2023). |

### One-person households (`census_households.hh_one_person`)
- What it measures: Count of single-person (sole-occupant) households.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_78`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.hh_one_person`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:213` (Full only), "Single-person households" StatRow as `hh_one_person / hh_total`.
- Threshold / classification logic: Share rounded.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Equating sole-occupancy with loneliness or temporary tenancy.
- What it does NOT tell you: Age skew of solo dwellers (combine with `age_65_plus` for inference).
- source_key status: N/A.
- User-care severity: Context, household-type composition signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | People living alone | Solo-occupant households | One-person households (share) |
| Hosted Full narrative + tech | About {pct} of homes here have just one person living in them. | {pct} of households in {sa2_name} are single-person. Useful for picking the right dwelling-type mix. | One-person household share {pct} (Stats NZ VAR_4_78 / VAR_4_80, Census 2023). |

### Total households (`census_households.hh_total`)
- What it measures: Total households in the SA2 (denominator for hh_crowded / hh_one_person).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_80`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.hh_total`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:211` (Full only), denominator only; not displayed.
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Confusing households with dwellings or with population.
- What it does NOT tell you: Average household size, divide pop_2023 by hh_total to estimate.
- source_key status: N/A.
- User-care severity: Background, denominator only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not rendered) | (out of scope: not rendered) | (out of scope: not rendered) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | (denominator only, not labelled) | (denominator only, not labelled) | Total households (denominator) |
| Hosted Full narrative + tech | (used to convert household counts into percentages) | (used to convert household counts into percentages) | Stats NZ VAR_4_80: total households used as denominator for crowding and household-type rows. |

### Kainga Ora landlord (`census_households.landlord_kainga_ora`)
- What it measures: Count of renting households whose landlord is Kainga Ora (state public housing provider).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_165`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.landlord_kainga_ora`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:215` (Full only), "Kainga Ora tenants" StatRow as `landlord_kainga_ora / landlord_total` (only shown when both > 0).
- Threshold / classification logic: Share rounded; row hidden if either denominator or value missing.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Reading the Kainga Ora share as the share of all households, denominator is renting households only.
- What it does NOT tell you: Iwi/community housing provider share (see `landlord_other`, not exposed); waiting-list demand.
- source_key status: N/A.
- User-care severity: Context, public-housing presence, neutral.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Kainga Ora rentals | Kainga Ora share of renters | Kainga Ora landlord share (of renters) |
| Hosted Full narrative + tech | About {pct} of renters here rent from Kainga Ora (state housing). | {pct} of renting households in {sa2_name} have Kainga Ora as landlord, a marker of public-housing presence. | Kainga Ora share is {pct} of renting households with stated landlord (Stats NZ VAR_4_165 / VAR_4_171, Census 2023). |

### Landlord total (`census_households.landlord_total`)
- What it measures: Total renting households with stated landlord (denominator for landlord_kainga_ora).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_171`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.landlord_total`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:215` (Full only), denominator only; not displayed.
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Conflating with `tenure_not_owned`, `landlord_total` excludes households that did not state a landlord.
- What it does NOT tell you: Private vs council vs other split, those columns exist (`landlord_private`, `landlord_council`, `landlord_other`) but are not surfaced in the UI.
- source_key status: N/A.
- User-care severity: Background, denominator only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not rendered) | (out of scope: not rendered) | (out of scope: not rendered) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | (denominator only, not labelled) | (denominator only, not labelled) | Renters with stated landlord (denominator) |
| Hosted Full narrative + tech | (used internally to derive the Kainga Ora share above) | (used internally to derive the Kainga Ora share above) | Stats NZ VAR_4_171: renting households with stated landlord (denominator for landlord_kainga_ora share). |

### Internet access (`census_households.internet_access`)
- What it measures: Count of households with access to the Internet at home.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_24`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.internet_access`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:228` (Full only), small "Internet access" tile showing percent.
- Threshold / classification logic: Share = `internet_access / internet_total`.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Equating Census internet access with fibre availability or speed (Fibre availability is a separate field, `community_facilities.fibre_available`, not Demographics).
- What it does NOT tell you: Connection type (fibre/wireless/satellite), speed, or affordability.
- source_key status: N/A.
- User-care severity: Context, broad connectivity share, neutral.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Households online | Internet access at home | Internet access (Census 2023) |
| Hosted Full narrative + tech | About {pct} of homes here have internet access. | {pct} of households in {sa2_name} reported home internet access. See fibre availability for connection type. | {pct} of households reported home internet access (Stats NZ VAR_4_24 / VAR_4_27, Census 2023); does not capture connection type or speed. |

### Internet total (`census_households.internet_total`)
- What it measures: Total households with internet-access status stated (denominator).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_27`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.internet_total`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:228` (Full only), denominator only; not displayed.
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Confusing with hh_total (this excludes "not stated").
- What it does NOT tell you: N/A
- source_key status: N/A.
- User-care severity: Background, denominator only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not rendered) | (out of scope: not rendered) | (out of scope: not rendered) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | (denominator only, not labelled) | (denominator only, not labelled) | Internet-status-stated households (denominator) |
| Hosted Full narrative + tech | (used to convert internet_access to a percentage) | (used to convert internet_access to a percentage) | Stats NZ VAR_4_27: internet-status-stated household denominator (excludes "not stated"). |

### No vehicles (`census_households.vehicles_none`)
- What it measures: Count of households with no motor vehicle.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_136`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.vehicles_none`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:237` (Full only), small "No vehicle" tile as `vehicles_none / vehicles_total`.
- Threshold / classification logic: Share rounded.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Reading high "no vehicle" as poverty signal, in central CBD SA2s it is often a transit / walkability signal.
- What it does NOT tell you: Whether the household chose to be car-free or could not afford a car.
- source_key status: N/A.
- User-care severity: Context, parking-demand and walkability proxy.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: hidden until Full) | (out of scope: hidden until Full) | (out of scope: hidden until Full) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | Car-free households | Car-free household share | Households with no motor vehicle |
| Hosted Full narrative + tech | About {pct} of homes here have no car. | {pct} of households in {sa2_name} have no motor vehicle. High in central or transit-rich SA2s, a parking-demand signal in others. | {pct} of households reported zero motor vehicles (Stats NZ VAR_4_136 / VAR_4_144, Census 2023); cannot distinguish choice vs financial constraint. |

### Vehicles total (`census_households.vehicles_total`)
- What it measures: Total households with vehicle count stated (denominator).
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: FeatureServer field `VAR_4_144`.
- DataSource key(s): `census_households`.
- Table(s): `census_households.vehicles_total`.
- Query path: snapshot_generator.py:609.
- Rendered by: `HostedDemographics.tsx:237` (Full only), denominator only.
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: National.
- Common misreading: N/A
- What it does NOT tell you: N/A
- source_key status: N/A.
- User-care severity: Background, denominator only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: not rendered) | (out of scope: not rendered) | (out of scope: not rendered) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | (denominator only, not labelled) | (denominator only, not labelled) | Vehicle-count-stated households (denominator) |
| Hosted Full narrative + tech | (used internally to derive the no-car percentage) | (used internally to derive the no-car percentage) | Stats NZ VAR_4_144: vehicle-count-stated household denominator (excludes "not stated"). |

---

## census_commute.*

### Commute total stated (`census_commute.total_stated`)
- What it measures: Total responses where main means of travel-to-work was stated, aggregated by usual-residence SA2.
- Source authority: Stats NZ Census 2023 commute origin-destination dataset.
- Dataset / endpoint: ArcGIS item id `fedc12523d4f4da08f094cf13bb21807` CSV (`load_census_commute()` in `data_loader.py`). Aggregated from origin-destination matrix to residence SA2.
- DataSource key(s): `census_commute`.
- Table(s): `census_commute.total_stated`.
- Query path: snapshot_generator.py:627 (with fallback to `v_census_commute_by_boundary` view).
- Rendered by: `HostedDemographics.tsx:74`, denominator for every commute-mode bar; not displayed directly.
- Threshold / classification logic: None.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Treating as "people who work", it's "people who stated a means of travel" (excludes non-stated; includes work-at-home).
- What it does NOT tell you: Multi-mode commutes (Census records main mode only), commute distance, or trip frequency.
- source_key status: N/A.
- User-care severity: Background, denominator only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (denominator only, not labelled) | (denominator only, not labelled) | Commute-mode-stated responses (denominator) |
| Hosted Quick narrative | (used to convert each mode count into a percentage in the bar chart) | (used to convert each mode count into a percentage in the bar chart) | Aggregated commute-stated count by residence SA2 (Stats NZ Census 2023 OD matrix). |
| Hosted Full label | (denominator only, not labelled) | (denominator only, not labelled) | Commute-mode-stated responses (denominator) |
| Hosted Full narrative + tech | (used to compute mode shares in the chart above) | (used to compute mode shares in the chart above) | Aggregated by usual-residence SA2 from the Stats NZ Census 2023 commute OD CSV; main-mode only. |

### Drive a private car (`census_commute.drive_private`)
- What it measures: Count of residents whose main means of travel to work was driving a private car/truck/van.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: column `2023_Drive_a_private_car_truck_or_van` in the OD CSV.
- DataSource key(s): `census_commute`.
- Table(s): `census_commute.drive_private`.
- Query path: snapshot_generator.py:627.
- Rendered by: `HostedDemographics.tsx:76`, combined with `drive_company` into "Drive" bar (`(drive_private+drive_company)/total_stated`).
- Threshold / classification logic: Combined Drive bar; rounded percent. Modes with 0% are filtered out (line 85). Remainder is bucketed into "Other" (line 84-88).
- Score contribution: N/A
- Coverage: National.
- Common misreading: Confusing private + company drive shares with car ownership (see `vehicles_*`). A household with 2 cars where one person works from home will have lower "Drive" share.
- What it does NOT tell you: Commute distance, parking availability, congestion exposure.
- source_key status: N/A.
- User-care severity: Context, mode-share signal feeding the chart.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Drive to work | Drive share (private + company) | Drive (private+company) commute share |
| Hosted Quick narrative | About {pct} of locals drive to work. | {pct} of {sa2_name} workers drive to work (private and company vehicles combined). | Drive share {pct} of commute-stated workers (Stats NZ Census 2023, private + company vehicle). |
| Hosted Full label | Drive to work | Drive (private + company car) | Drive: private vehicle commute share |
| Hosted Full narrative + tech | About {pct} of locals drive to work. Useful for predicting morning traffic. | {pct} of workers in {sa2_name} drive to work (private + company vehicles); high shares correlate with peak-hour congestion and parking demand. | Drive share {pct} of main-mode commute-stated population (Stats NZ Census 2023 OD CSV, private + company vehicle). |

### Drive a company car (`census_commute.drive_company`)
- What it measures: Count of residents whose main means of travel to work was driving a company car/truck/van.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: column `2023_Drive_a_company_car_truck_or_van`.
- DataSource key(s): `census_commute`.
- Table(s): `census_commute.drive_company`.
- Query path: snapshot_generator.py:627.
- Rendered by: `HostedDemographics.tsx:76`, combined into the single "Drive" bar with `drive_private`.
- Threshold / classification logic: Same as drive_private, not displayed independently.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Treated as a separate mode by viewer, the chart aggregates with private drive.
- What it does NOT tell you: Whether the company vehicle is also used for personal travel.
- source_key status: N/A.
- User-care severity: Background, folded into the Drive bar, not surfaced separately.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (folded into "Drive") | (folded into "Drive") | Company vehicle (component of Drive) |
| Hosted Quick narrative | (out of scope: rolled into the Drive bar) | (out of scope: rolled into the Drive bar) | Company-vehicle drivers, summed with private-vehicle drivers into the Drive bar (Stats NZ Census 2023). |
| Hosted Full label | (folded into "Drive") | (folded into "Drive") | Company-vehicle commute (component of Drive) |
| Hosted Full narrative + tech | (out of scope: rolled into the Drive bar) | (out of scope: rolled into the Drive bar) | Company-vehicle drivers (Stats NZ Census 2023), aggregated into the Drive bar with private-vehicle drivers; not displayed separately. |

### Work at home (`census_commute.work_at_home`)
- What it measures: Count of residents whose main means of travel to work was working from home.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: column `2023_Work_at_home`.
- DataSource key(s): `census_commute`.
- Table(s): `census_commute.work_at_home`.
- Query path: snapshot_generator.py:627.
- Rendered by: `HostedDemographics.tsx:77`, "WFH" bar (green).
- Threshold / classification logic: Share = `work_at_home / total_stated`.
- Score contribution: N/A
- Coverage: National. Pre-COVID 2018 baseline (`work_at_home_2018`) is loaded but not surfaced in this section.
- Common misreading: Reading high WFH as low transit demand, these workers may still travel for shopping, school drop-off etc.
- What it does NOT tell you: Hybrid arrangements (Census captures main mode only).
- source_key status: N/A.
- User-care severity: Context, weekday quietness and daytime-demand proxy.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Work from home | Work-from-home share | WFH commute share |
| Hosted Quick narrative | About {pct} of locals work from home. | {pct} of {sa2_name} workers report working from home as their main mode. | WFH share {pct} of main-mode commute-stated population (Stats NZ Census 2023). |
| Hosted Full label | Work from home | Working-from-home share | Work-from-home: main-mode share |
| Hosted Full narrative + tech | About {pct} of locals work from home, generally a quieter weekday neighbourhood. | {pct} of workers in {sa2_name} list WFH as their main mode. Relevant for daytime retail demand and quietness. | WFH main-mode share {pct} (Stats NZ Census 2023 OD CSV); main-mode capture, hybrid arrangements not distinguished. |

### Public bus (`census_commute.public_bus`)
- What it measures: Count of residents whose main means of travel to work was a public bus.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: column `2023_Public_bus`.
- DataSource key(s): `census_commute`.
- Table(s): `census_commute.public_bus`.
- Query path: snapshot_generator.py:627.
- Rendered by: `HostedDemographics.tsx:78`, "Bus" bar (yellow).
- Threshold / classification logic: Share = `public_bus / total_stated`.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Equating commute-bus share with overall transit access, see Transport category for service-level metrics.
- What it does NOT tell you: Service frequency, route reliability, fare cost.
- source_key status: N/A.
- User-care severity: Context, revealed-preference share for bus usability.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Catch the bus | Bus commute share | Public-bus commute share |
| Hosted Quick narrative | About {pct} of locals take the bus to work. | {pct} of {sa2_name} workers commute by public bus, a real-world test of the bus network here. | Public-bus main-mode share {pct} (Stats NZ Census 2023 OD CSV). |
| Hosted Full label | Catch the bus | Bus commute share | Public-bus: main-mode share |
| Hosted Full narrative + tech | About {pct} of locals take the bus to work. | {pct} of workers in {sa2_name} report public bus as main mode, a revealed-preference signal of bus usability from this SA2. | Public-bus main-mode share {pct} (Stats NZ Census 2023 OD CSV); revealed preference, not service quality. |

### Walk or jog (`census_commute.walk_or_jog`)
- What it measures: Count of residents whose main means of travel to work was walking or jogging.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: column `2023_Walk_or_jog`.
- DataSource key(s): `census_commute`.
- Table(s): `census_commute.walk_or_jog`.
- Query path: snapshot_generator.py:627.
- Rendered by: `HostedDemographics.tsx:79`, "Walk" bar (purple).
- Threshold / classification logic: Share = `walk_or_jog / total_stated`.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Equating walking with proximity to all amenities, captures workplace proximity only.
- What it does NOT tell you: Footpath quality, route safety.
- source_key status: N/A.
- User-care severity: Context, walkability and job-proximity proxy.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Walk to work | Walk-to-work share | Walk/jog commute share |
| Hosted Quick narrative | About {pct} of locals walk to work. | {pct} of {sa2_name} workers walk or jog to work, a sign jobs are within reach of home. | Walk/jog main-mode share {pct} (Stats NZ Census 2023). |
| Hosted Full label | Walk to work | Walk-to-work share | Walk/jog: main-mode commute share |
| Hosted Full narrative + tech | About {pct} of locals walk to work, usually meaning jobs are nearby. | {pct} of workers in {sa2_name} walk or jog to work, implying workplaces are close to home (proximity, not footpath quality). | Walk/jog main-mode share {pct} (Stats NZ Census 2023 OD CSV); proximity-revealing, not infrastructure-quality. |

### Train (`census_commute.train`)
- What it measures: Count of residents whose main means of travel to work was train.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: column `2023_Train`.
- DataSource key(s): `census_commute`.
- Table(s): `census_commute.train`.
- Query path: snapshot_generator.py:627.
- Rendered by: `HostedDemographics.tsx:80`, "Train" bar (red).
- Threshold / classification logic: Share = `train / total_stated`.
- Score contribution: N/A
- Coverage: National. In SA2s without rail (most of NZ), this share will be ~0.
- Common misreading: Reading 0% as "no rail option nearby", many SA2s have rail access but most workers drive.
- What it does NOT tell you: Distance to station, service frequency.
- source_key status: N/A.
- User-care severity: Context, rail-mode share, only material in Auckland and Wellington.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Catch the train | Train commute share | Rail commute share |
| Hosted Quick narrative | About {pct} of locals take the train to work. | {pct} of {sa2_name} workers commute by train, only meaningful in the Auckland and Wellington commuter belts. | Train main-mode share {pct} (Stats NZ Census 2023). |
| Hosted Full label | Catch the train | Train commute share | Rail: main-mode commute share |
| Hosted Full narrative + tech | About {pct} of locals take the train to work. | {pct} of workers in {sa2_name} commute by rail, only relevant in the Auckland and Wellington commuter belts. | Rail main-mode share {pct} (Stats NZ Census 2023 OD CSV); revealed preference, not a measure of station distance (see Transport section). |

### Bicycle (`census_commute.bicycle`)
- What it measures: Count of residents whose main means of travel to work was a bicycle.
- Source authority: Stats NZ Census 2023.
- Dataset / endpoint: column `2023_Bicycle`.
- DataSource key(s): `census_commute`.
- Table(s): `census_commute.bicycle`.
- Query path: snapshot_generator.py:627.
- Rendered by: `HostedDemographics.tsx:81`, "Cycle" bar (teal).
- Threshold / classification logic: Share = `bicycle / total_stated`.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Conflating cycle commute share with cycleway km nearby (`community_facilities.cycleway_km_2km`).
- What it does NOT tell you: e-bike vs traditional bike split, route safety.
- source_key status: N/A.
- User-care severity: Context, cycle-mode share, correlates with separated cycleway km.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Bike to work | Cycle-to-work share | Bicycle commute share |
| Hosted Quick narrative | About {pct} of locals bike to work. | {pct} of {sa2_name} workers cycle to work, typically high near separated cycleways. | Bicycle main-mode share {pct} (Stats NZ Census 2023). |
| Hosted Full label | Bike to work | Cycle-to-work share | Bicycle: main-mode commute share |
| Hosted Full narrative + tech | About {pct} of locals bike to work. | {pct} of workers in {sa2_name} cycle to work, strongly correlated with separated cycleway km nearby. | Bicycle main-mode share {pct} (Stats NZ Census 2023 OD CSV); does not distinguish e-bike from traditional bike. |

---

## business_demography.*

### Employee count 2024 (`business_demography.employee_count_2024`)
- What it measures: Total filled jobs (employees) in this SA2 as at February 2024.
- Source authority: Stats NZ Business Demography 2024.
- Dataset / endpoint: ArcGIS `2024_Business_Demography_employee_count_by_SA2/FeatureServer/0`, field `ec2024` (`load_business_demography()` in `data_loader.py`).
- DataSource key(s): `business_demography`.
- Table(s): `business_demography.employee_count_2024`.
- Query path: snapshot_generator.py:748 → `snapshot.business_demography.employee_count_2024`.
- Rendered by: `HostedDemographics.tsx:166`, blue tile "Jobs in area" in "Local Economy" panel.
- Threshold / classification logic: None on the value; growth tile colour-coded green/red.
- Score contribution: N/A
- Coverage: National. Suppressed to `None` for SA2s with confidentiality risk.
- Common misreading: Reading SA2 jobs as the local labour market for residents, many workers commute in from other SA2s.
- What it does NOT tell you: Industry mix, job types, full-time vs part-time.
- source_key status: N/A.
- User-care severity: Context, local-economy presence; daytime-activity proxy, no finding rule.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Jobs in this area | Jobs based in this SA2 | Filled jobs in SA2 (Feb 2024) |
| Hosted Quick narrative | About {jobs} jobs are based in this area. | {sa2_name} hosts ~{jobs} filled jobs as at Feb 2024 (workers may live in other SA2s). | SA2 employee count {jobs} (Stats NZ Business Demography 2024, ec2024). |
| Hosted Full label | Jobs in this area | Jobs based in this SA2 (2024) | Filled jobs, Business Demography Feb 2024 |
| Hosted Full narrative + tech | About {jobs} jobs are based in this area; many workers may live elsewhere. | {sa2_name} hosts ~{jobs} filled jobs as at February 2024. This counts workplaces, not residents, so commercial SA2s skew high. | SA2 employee count {jobs} (Stats NZ Business Demography 2024, ec2024); workplace-based, not residence-based. |

### Employee count 2019 (`business_demography.employee_count_2019`)
- What it measures: Total filled jobs in this SA2 as at February 2019 (5-year baseline).
- Source authority: Stats NZ Business Demography 2019 series, re-published in the 2024 dataset.
- Dataset / endpoint: ArcGIS field `ec2019`.
- DataSource key(s): `business_demography`.
- Table(s): `business_demography.employee_count_2019`.
- Query path: snapshot_generator.py:748.
- Rendered by: `HostedDemographics.tsx:60`, destructured for type, but not displayed directly (used as baseline behind growth %).
- Threshold / classification logic: None; comparison only.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Treating the 5-year delta as a smooth trend (5-year endpoint comparison; pandemic shock in middle).
- What it does NOT tell you: Year-by-year path; industry composition change.
- source_key status: N/A.
- User-care severity: Background, baseline behind the displayed growth percentage.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Jobs five years ago | 2019 employment baseline | Filled jobs 2019 (baseline) |
| Hosted Quick narrative | Used to show whether jobs in the area are growing. | Used as the 2019 baseline behind the job-growth figure. | 2019 baseline used to compute 5-year employee growth (Stats NZ Business Demography ec2019). |
| Hosted Full label | Jobs five years ago | 2019 employee baseline | Employee count Feb 2019 (baseline) |
| Hosted Full narrative + tech | The number of jobs based here five years ago, used to show change. | 2019 baseline behind the job-growth percentage; the period spans pandemic disruption. | Stats NZ Business Demography ec2019 (Feb 2019); 5-year endpoint comparison spans the COVID-19 disruption. |

### Employee growth % (`business_demography.employee_growth_pct`)
- What it measures: Average percent change in filled jobs per year between 2019 and 2024 (Stats NZ field `ec_avperinc`).
- Source authority: Stats NZ Business Demography 2024.
- Dataset / endpoint: ArcGIS field `ec_avperinc`, average per-annum increase.
- DataSource key(s): `business_demography`.
- Table(s): `business_demography.employee_growth_pct`.
- Query path: snapshot_generator.py:748.
- Rendered by: `HostedDemographics.tsx:174`, third tile in "Local Economy", showing `{value}%` with green/red bg by sign.
- Threshold / classification logic: Sign determines colour (>=0 green, <0 red, line 173). Display rounded to 1 dp.
- Score contribution: N/A
- Coverage: National. Suppressed for confidentiality.
- Common misreading: Reading as a single recent year's growth rate, it is the 2019-2024 annualised average (Stats NZ uses "average per-annum increase").
- What it does NOT tell you: Whether growth was steady or jumped post-pandemic; industry attribution.
- source_key status: N/A.
- User-care severity: Context, employment trajectory; area momentum signal, no finding rule.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Jobs trend per year | Job growth per year | Annualised job growth 2019-2024 |
| Hosted Quick narrative | Jobs here changed by about {pct}% per year. | Filled jobs in {sa2_name} grew/shrank ~{pct}% per year on average since 2019. | Annualised employee growth {pct}% per year 2019-2024 (Stats NZ Business Demography ec_avperinc). |
| Hosted Full label | Jobs trend per year | Job growth per year (2019-2024) | Annualised employee growth (2019-2024) |
| Hosted Full narrative + tech | Jobs based in this area changed by about {pct}% per year. | Filled jobs in {sa2_name} grew or shrank ~{pct}% per year on average from 2019 to 2024. The period includes the pandemic disruption. | Annualised employee growth {pct}% per year 2019-2024 (Stats NZ Business Demography ec_avperinc); endpoint method, not log-trend. |

### Business count 2024 (`business_demography.business_count_2024`)
- What it measures: Total geographic units (business locations) in this SA2 as at February 2024.
- Source authority: Stats NZ Business Demography 2024.
- Dataset / endpoint: ArcGIS field `gc2024`.
- DataSource key(s): `business_demography`.
- Table(s): `business_demography.business_count_2024`.
- Query path: snapshot_generator.py:748.
- Rendered by: `HostedDemographics.tsx:170`, purple tile "Businesses".
- Threshold / classification logic: None on raw value.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Treating geographic units as enterprises, one enterprise can have multiple geographic units (locations).
- What it does NOT tell you: Industry mix, enterprise size distribution.
- source_key status: N/A.
- User-care severity: Context, count of business locations; complements employment count.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | Businesses here | Business locations in SA2 | Geographic units (businesses) Feb 2024 |
| Hosted Quick narrative | About {biz} businesses operate in {sa2_name}. | {biz} business locations operate in {sa2_name} (geographic units; one enterprise can run several). | SA2 geographic unit count {biz} (Stats NZ Business Demography 2024, gc2024). |
| Hosted Full label | Businesses here | Business locations | Geographic units, Business Demography Feb 2024 |
| Hosted Full narrative + tech | About {biz} businesses are based in this area. | {biz} business locations operate in {sa2_name}. Stats NZ counts geographic units, so one enterprise with three branches counts as three. | SA2 geographic unit count {biz} (Stats NZ Business Demography 2024, gc2024); workplace locations not enterprises. |

### Business growth % (`business_demography.business_growth_pct`)
- What it measures: Average percent change in geographic units (business locations) per year between 2019 and 2024 (Stats NZ field `gc_avperinc`).
- Source authority: Stats NZ Business Demography 2024.
- Dataset / endpoint: ArcGIS field `gc_avperinc`.
- DataSource key(s): `business_demography`.
- Table(s): `business_demography.business_growth_pct`.
- Query path: snapshot_generator.py:748.
- Rendered by: `HostedDemographics.tsx:62`, destructured for typing; the JSX at line 62 references it but only `employee_growth_pct` is shown in the green/red tile (the explicit "Job growth/yr" label, line 177). `business_growth_pct` is loaded into the snapshot but not currently displayed in HostedDemographics.tsx.
- Threshold / classification logic: None displayed; loaded but not rendered.
- Score contribution: N/A
- Coverage: National.
- Common misreading: Reading the displayed +X%/yr as business growth, it is employee growth. Business growth is collected but not rendered.
- What it does NOT tell you: Anything user-visible (verified not rendered).
- source_key status: N/A.
- User-care severity: Background, dead-data candidate (loaded but no UI surface).

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | (out of scope: hosted-only) | (out of scope: hosted-only) | (out of scope: hosted-only) |
| On-screen finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick label | (out of scope: loaded but not currently displayed in HostedDemographics.tsx) | (out of scope: loaded but not currently displayed) | (out of scope: loaded but not currently displayed) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | (out of scope: loaded but not currently displayed) | (out of scope: loaded but not currently displayed) | (out of scope: loaded but not currently displayed) |
| Hosted Full narrative + tech | (out of scope) | (out of scope) | (out of scope: field is in the snapshot but no UI surface; dead-data candidate. Stats NZ Business Demography gc_avperinc.) |

---

## Other (Demographics-tagged in inventory)

### Crime trend (`crime_trend` snapshot)
- What it measures: Monthly count of police-recorded victimisations for the area over the past ~3 years, used to draw a sparkline of the recent trend.
- Source authority: NZ Police victimisations data (source_key `nz_police_crime`, registered in `report_html.py` `SOURCE_CATALOG`).
- Dataset / endpoint: NZ Police victimisations time series. Loaded into the `crime` table (year_month, area_unit, victimisations). The loader is NOT a `DataSource(...)` registration in `data_loader.py` (grep `crime` in `data_loader.py` returns 0 hits), population path TBD; see DATA-CATALOG § Crime.
- DataSource key(s): UNVERIFIED, no `DataSource(...)` for the `crime` table is registered in `data_loader.py`. Inventory's claim of `police_crime_history` is fabricated (0 hits).
- Table(s): `crime` (queried directly; no `mv_crime_density_history` materialised view exists, that was a prior wording fabrication).
- Query path: `snapshot_generator._q_crime_trend()` at `snapshot_generator.py:315` (reads `FROM crime` with month-aggregation over last 3 years, line 323), emitted on the `crime_trend` snapshot key at `snapshot_generator.py:930`.
- Rendered by: `frontend/src/components/property/CrimeTrendSparkline.tsx`, mounted by `frontend/src/components/property/QuestionContent.tsx:261, 264` (renter and buyer branches). NB: this is on-screen (under the Property report's question content), NOT in any `frontend/src/components/report/Hosted*.tsx`. Inventory's `HostedNeighbourhoodStats.tsx` claim is fabricated.
- Threshold / classification logic: None, sparkline shows the raw monthly counts. Empty-result fallback returns `[]` (no error surfaced; `snapshot_generator.py:332`).
- Score contribution: N/A (the `crime_trend` field itself is not in `risk_score.py`; risk_score consumes the separate `crime_pct` percentile from `get_property_report()`).
- Coverage: National in principle (any SA2/area_unit with `crime` rows). Match is by ILIKE on `sa2_name` OR address suburb (`snapshot_generator.py:329`); coverage gaps possible where neither name string matches `area_unit`.
- Common misreading: Equating reported-crime trend with risk to a specific address (it's an area-level tally with police-recording bias).
- What it does NOT tell you: Property-specific risk; unreported crime; severity mix; offence type breakdown.
- source_key status: `nz_police_crime` (used by Insights in `report_html.py:1869, 1877`; the snapshot field itself does not currently drive an Insight; the source_key applies to the underlying authority).
- User-care severity: Notable, area-level victimisation trend that informs perception but is not address-specific and does not on its own carry a finding rule.

NOTE: This row is tagged Demographics in `_INVENTORY.md` but is conceptually a crime/safety indicator. It is included here for completeness against the inventory; deeper wording will live with the Crime/Liveability category if reclassified.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label | Crime over time | Reported-crime trend | Reported victimisations (NZ Police) |
| On-screen finding | (sparkline only; no Insight rule) | (sparkline only; no Insight rule) | (sparkline only; no Insight rule) |
| Hosted Quick label | (out of scope: not rendered in any hosted component) | (out of scope: not rendered in any hosted component) | (out of scope: not rendered in any hosted component) |
| Hosted Quick narrative | (out of scope) | (out of scope) | (out of scope) |
| Hosted Full label | (out of scope: not rendered in any hosted component) | (out of scope: not rendered in any hosted component) | (out of scope: not rendered in any hosted component) |
| Hosted Full narrative + tech | (out of scope) | (out of scope) | (out of scope: snapshot field exists but no Hosted* component renders it. The sparkline is on-screen via CrimeTrendSparkline.tsx in QuestionContent.tsx.) |

---

## Local coverage audit

| Indicators in category | With findings | With source_key | Missing on hosted-full |
|---|---|---|---|
| 44 (covers all 44 inventory rows; the 8-bracket income row counts as 1) | 0 | 0 | 1 (`business_demography.business_growth_pct`, loaded into snapshot but not rendered in HostedDemographics.tsx) |

### Severity tally

| Indicators | Critical | Notable | Context | Background |
|---|---|---|---|---|
| 44 | 0 | 1 | 30 | 13 |

Critical: none. Demographics describe area populations and almost never reach Critical or Notable. The single Notable is `crime_trend` (police-recorded victimisations, an area-level safety signal that may show a real change worth flagging). All pure demographic mix (age, ethnicity, household type, tenure, commute mode, business counts) is Context. Denominators and identifier labels are Background.

## Local gap list

UNKNOWN entries (need follow-up):
- `business_demography.business_growth_pct`: present in snapshot, not rendered. Either surface it (e.g. dual tile alongside job growth) or remove from snapshot.
- `crime_trend`: exact NZ Police endpoint, classification logic, and coverage matrix not verified in this read. Owner: Crime category author.

Missing source_key (every Demographics indicator):
- All 44 indicators have no `Insight(...)` rule in `report_html.py`, so source_key is N/A by definition. If findings are added later (e.g. "ownership rate {pct}%, {x}pp below NZ"), each rule will need a `source_key` per `docs/DATA-PROVENANCE.md`.

## Local conflict list

Inventory vs code mismatches (file:line for each):

- `_INVENTORY.md:323,324,325,326,327` list table = `census_population` for `census_demographics.sa2_name|population_2018|population_2023|median_age|age_65_plus`. Actual table is `census_demographics` (`INSERT INTO census_demographics` in `load_census_demographics()` in `data_loader.py`). No table named `census_population` exists.
- `_INVENTORY.md:328-335` list table = `census_ethnicity` for `census_demographics.ethnicity_*` and `born_*`. Actual table is `census_demographics` (same INSERT in `load_census_demographics()` in `data_loader.py` includes ethnicity_* and born_* columns). No table named `census_ethnicity` exists.
- `_INVENTORY.md:323-335` list DataSource key = `stats_census_2023` (and `stats_census_2018` for population_2018). Actual key is `census_demographics` (`DataSource("census_demographics", ...)` in `data_loader.py`). No DataSource named `stats_census_2023`/`stats_census_2018` is registered.
- `_INVENTORY.md:353-360` list DataSource key = `stats_census_commute`. Actual key is `census_commute` (`DataSource("census_commute", ...)` in `data_loader.py`).
- `_INVENTORY.md:361-365` list DataSource key = `stats_business_demography`. Actual key is `business_demography` (`DataSource("business_demography", ...)` in `data_loader.py`).
- `_INVENTORY.md:365` `business_demography.business_growth_pct` claims hosted-full render at HostedDemographics.tsx but the field is only destructured (HostedDemographics.tsx:62), never rendered into the DOM. The displayed "Job growth/yr" tile uses `employee_growth_pct` (HostedDemographics.tsx:174-177).

Inventory total claim (line 366): "Demographics 45". Actual row count between lines 323-366 is 44 data rows + 1 header. The 8-bracket income row (line 338) is one inventory row that maps to 8 SQL columns, so depending on counting convention, total distinct dot-paths is 51. This file produces a Meaning block per inventory row (44 blocks).
