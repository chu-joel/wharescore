# Indicator Wording: Market

Owns the **market** slice of the wording matrix: 25 indicators sourced from MBIE Tenancy Bonds (per-SA2 rents and trends), REINZ House Price Index (national/TA), RBNZ housing series (national HPI/sales used in the snapshot HPI chart), and SA2/TA comparator materialised views. (`_INVENTORY.md` category-count header previously said 26; corrected to 25, the rows-under-Market total has always been 25.)

Conventions:
- `report.market.*` is produced by `get_property_report()` in `backend/migrations/0054_flood_nearest_m.sql` (lines 1016-1065).
- `report.comparisons.*` is produced in the same SQL function (lines 987-1013) and lives under Market in the inventory because it is the SA2/TA comparator that hosted Market and Neighbourhood narratives lean on.
- `snapshot.rent_history` and `snapshot.hpi_data` are produced by `snapshot_generator.generate_snapshot()` in `backend/app/services/snapshot_generator.py` (lines 285-313, returned at 928-929).
- "ALL/ALL row" = the `dwelling_type='ALL', beds='ALL'` row of `rental_overview` / `trends`. Risk scoring and Insights pull this row; HostedRentAdvisor renders the per-type/per-bed grid.
- No `market.*` source_keys exist in `SOURCE_CATALOG` (`report_html.py:637-676`); every Market Insight today is rendered without a source attribution.

## Changes in this pass

- Audit-fix pass (post-`_AUDIT-market.md`). Concrete changes applied:
  - **bonds TCL corrected.** Audit flagged the `bonds/200 cap` as unverified. Re-read `risk_score.py:760-790`: line 772 is literally `depth_fraction = min(1.0, bonds / 200.0)` feeding `rental_fairness` at line 773; market_heat uses `/500` at line 789. Wording now cites both lines and both caps explicitly (200 for fairness, 500 for heat).
  - **mv_rental_trends location verified.** `CREATE MATERIALIZED VIEW mv_rental_trends` exists at `sql/06-materialized-views.sql:93` (audit said line 92, off by 1 because line 92 is the `DROP MATERIALIZED VIEW IF EXISTS` line). Updated trends.dwelling_type Table reference to `:93`. Other trends references (`yoy_pct` 110-112, `cagr_3yr` 114-116, `cagr_5yr` 118-120, `cagr_10yr` 122-124) re-verified against the file and left intact; yoy_pct band tightened from `:110` to `:110-112`.
  - **bonds_detailed table source located.** Created via `scripts/load_bonds_detailed.py:28` (loader script CREATE, not a backend migration). Wording for `rent_history (snapshot)` now cites this path.
  - **rbnz_housing table source located.** Created via `scripts/load_rbnz_housing.py:28`. Wording for `hpi_data (snapshot)` now cites this path. `snapshot_generator.py:307` reference in gap list corrected to `:308`.
  - **SA2 code / SA2 name DK consistency.** Both rows now carry the `(loader name UNKNOWN, not present in data_loader.py DataSource registry)` parenthetical that the other 23 indicators use.
  - **comparisons.city query path widened** from `0054_flood_nearest_m.sql:1001-1009` to `:1001-1012` to include the `WHERE tc.ta_name = v_ta_name` join clause at line 1011.
  - **`_INVENTORY.md:256` reference removed.** That line is in the liveability section; the pointer was bogus. Replaced with "per `_INVENTORY.md` Market section".
  - **Inventory category-count fixed.** Header now says 25 (rows-under-Market total). Audit flagged the `_INVENTORY.md:30` "Market | 26" cell as inventory bookkeeping noise, wording-file count is now the source of truth.
- **SOURCE_CATALOG additions documented.** Four new keys (`tenancy_bonds`, `reinz_hpi_national`, `reinz_hpi_ta`, `rbnz_housing`) were added to `report_html.py` SOURCE_CATALOG (lines 637-676) in a separate pass. Status of each Market Insight is therefore "source_key available in SOURCE_CATALOG but not yet wired via `_src(...)` on the Insight", documented in the local coverage audit and gap list. SOURCE_CATALOG presence is independent of DataSource registry presence; loader names remain UNKNOWN.
- **Earlier-pass refs preserved (re-verified):** `report_html.py:637-676` SOURCE_CATALOG band; `1989/1993/1996/1999` median yield branches; `2006` yoy_pct insight; `2010/2013` cagr_5yr gate/text; `2029` supply-relief; `risk_score.py:284-285,773,785,789`; `snapshot_generator.py:285,301,308`.

### Editorial pass (this commit)

- **Renter out-of-scope on long-window CAGR.** `trends.cagr_5yr` and `trends.cagr_10yr` Renter Hosted Full cells converted to `(out of scope: long-window trend, not a renewal signal)` / `(out of scope: decade-long trend, not a renewal signal)`. Renters care about rent fairness vs comparables, not historical compound growth.
- **Severity demotions.** `trends.yoy_pct` Notable → Context (no own finding rule, mirrors rental_overview). `sa2_name` Context → Background (label only). `rental_overview.beds` Context → Background (bucket label only). Severity-tier audit table re-counted: 4 Notable / 13 Context / 8 Background.
- **Em-dashes inside Renter / Buyer / Pro cells confirmed clean.** Surface column structural identifiers (`On-screen, label` etc.) preserved as before.
- **No new fear words, no length regressions.** Re-checked the matrix; all cells stay within ≤60 char labels and ≤2 sentences for full+tech.

### Tone polish pass (prior commit)

- **Em-dashes removed from every wording cell.** Surface-label column headers (`On-screen, label`, `Hosted Full, narrative + tech`) preserved as structural identifiers; every other em-dash inside Renter / Buyer / Pro cells replaced with comma, full stop, colon or parens. Reason: house tone rule (no em-dashes); sentence breaks read better on small-screen narrative slots.
- **Placeholder normalised.** Bare em-dash placeholders normalised: `(em-dash) (out of scope: ...)` becomes `(out of scope: ...)`; `(em-dash) (no on-screen finding wired today)` and `(em-dash) (out of scope: no finding rule)` both become `(no rule)`. Reason: drops a redundant em-dash and shortens the placeholder.
- **Severity line added to every Meaning block.** 25 indicators now carry a `User-care severity:` bullet calibrated to the spec's Critical / Notable / Context / Background tiers. Reason: lets downstream finding-rule work see at a glance which indicators deserve a Critical rule and which never should.
- **No Critical wording added to any cell, because no Critical finding rule exists yet for Market.** The spec's Critical-Renter ("paying ~$X/wk above the local median") and Critical-Buyer ("X% above suburb median") templates would naturally attach to `rental_overview.median` and (for buyers) a not-yet-wired suburb-median-sale-price comparator. The matrix has no rule for either today, so wording was left at Notable. Flagged in gap list.
- **Renter on-screen finding for `rental_overview.yoy_pct` lightly expanded** to nudge "compare 3-5 alternatives before re-signing", consistent with the Critical-Renter template's negotiation framing without claiming the user is over-paying.
- **No fear words used.** Re-checked for "warning", "caution", "danger", "alarming", "catastrophic", "deadly" and exclamation marks; none present (none were before either, but verified post-edit).
- **NZ English preserved.** "neighbourhood", "quietness", "negotiation"; "$" left as the universal weekly-rent prefix readers expect.
- **No new findings invented.** Every cell that previously said "no rule wired" still says `(no rule)`. The matrix is the source of truth on which indicators have Insights wired in `report_html.py`.

### Critical-tier indicators that lack a finding rule (call-out to coordination)

- `rental_overview.median`: Critical-Renter wording would fire when a user-entered rent sits >10% above the SA2 median; today only the yield-Insight at `report_html.py:1989-1999` reads this field, which is a buyer signal not a renter one. Adding a `RentComparisonFlow`-driven over-LQ/over-median Insight would unlock the Critical-Renter template.
- Buyer-side "asking price vs suburb median": Critical wording has no source field at all in the Market category today. Would require a new SQL field (suburb median sale price from REINZ/QV) before any finding rule could exist.

---

### SA2 code (`market.sa2_code`)
- What it measures: Statistical Area 2 code (Stats NZ 2023) used as the join key for rental, comparator and demographic data.
- Source authority: Stats NZ Statistical Standard for Geographic Areas (SA2 2023).
- Dataset / endpoint: SA2 boundaries loaded from Stats NZ; populated as `v_sa2_code` in the SQL via address point-in-polygon against `sa2_2023`.
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN, not present in `data_loader.py` DataSource registry; MBIE bond lodgement file uses SA2 as `location_id`).
- Table(s): `mv_rental_market`, joined back to `sa2_2023`.
- Query path: `get_property_report()` step "MARKET" (0054_flood_nearest_m.sql:1019).
- Rendered by:, (not displayed; used as a join key in `HostedRentAdvisor.tsx`).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National wherever the address resolves to an SA2 polygon.
- Common misreading: Mistaking the SA2 code for a suburb name; SA2 boundaries do not align 1:1 with named suburbs.
- What it does NOT tell you: Nothing about the property itself, purely a geographic key.
- source_key status: N/A (not a user-facing finding).
- User-care severity: Background, internal join key not surfaced to users.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not rendered on-screen) | (out of scope: not rendered on-screen) | (out of scope: not rendered on-screen) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | (out of scope: internal join key) | (out of scope: internal join key) | SA2 code |
| Hosted Full, narrative + tech | (out of scope: internal join key) | (out of scope: internal join key) | Statistical Area 2 (Stats NZ 2023) used as the join key for MBIE bond and Stats NZ comparator data. |

---

### SA2 name (`market.sa2_name`)
- What it measures: Human-readable name of the Statistical Area 2 the address falls inside.
- Source authority: Stats NZ Statistical Standard for Geographic Areas (SA2 2023).
- Dataset / endpoint: `sa2_2023.sa2_name`.
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN, not present in `data_loader.py` DataSource registry; joined to SA2 boundaries).
- Table(s): `mv_rental_market`, `sa2_2023`.
- Query path: `get_property_report()` step "MARKET" (0054_flood_nearest_m.sql:1020).
- Rendered by: `HostedRentAdvisor.tsx` (header text), `HostedRentHistory.tsx` (chart title context).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National wherever the address resolves to an SA2 polygon.
- Common misreading: Treating SA2 names as suburb names (e.g. "Te Aro West" can split or merge real estate suburbs).
- What it does NOT tell you: The marketed suburb a real estate listing might use.
- source_key status: N/A (label only).
- User-care severity: Background, area label.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not on-screen) | (out of scope: not on-screen) | (out of scope: not on-screen) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Your area | Comparison area | SA2 area |
| Hosted Full, narrative + tech | Rents and trends below are for your statistical area: {sa2_name}. | Bond and rent comparisons below are for the SA2 {sa2_name}, not the marketed suburb. | Stats NZ SA2 2023 boundary {sa2_name}, not equivalent to a real estate suburb. |

---

### Rental overview, dwelling type (`market.rental_overview[].dwelling_type`)
- What it measures: Dwelling-type bucket of a row in the SA2 rental overview (House, Flat, Apartment, ALL).
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `bonds_detailed.dwelling_type`, materialised in `mv_rental_market`.
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN, not present in `data_loader.py` DataSource registry; bond data is ingested outside that registry).
- Table(s): `bonds_detailed` → `mv_rental_market`.
- Query path: `get_property_report()` step "MARKET" lateral on `mv_rental_market` (0054_flood_nearest_m.sql:1029).
- Rendered by: `HostedRentAdvisor.tsx` (per-type rows in the rent grid).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National wherever MBIE has SA2-level bonds.
- Common misreading: Treating "Flat" and "Apartment" as the same; MBIE separates them.
- What it does NOT tell you: Build quality, age, or stand-alone vs unit-title specifics within a type.
- source_key status: N/A.
- User-care severity: Background, dwelling-type bucket label only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not on-screen) | (out of scope: not on-screen) | (out of scope: not on-screen) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Type | Dwelling | Dwelling type |
| Hosted Full, narrative + tech | Rents shown for {dwelling_type} homes. | Rents shown by dwelling type ({dwelling_type}). | MBIE dwelling-type bucket ({dwelling_type}) from the Bond Lodgement file. |

---

### Rental overview, beds (`market.rental_overview[].beds`)
- What it measures: Bedroom count bucket of a row in the SA2 rental overview (1, 2, 3, 4, 5+, ALL).
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `bonds_detailed.number_of_beds` → `mv_rental_market`.
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN, not in `data_loader.py` registry).
- Table(s): `mv_rental_market`.
- Query path: `get_property_report()` step "MARKET" (0054_flood_nearest_m.sql:1030).
- Rendered by: `MarketSection.tsx` (per-bed rent grid via `RentComparisonFlow`); `HostedRentAdvisor.tsx`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National wherever bonds exist for the bed count.
- Common misreading: Reading a small-cell median (e.g. 5+ beds with <10 bonds) as representative.
- What it does NOT tell you: Whether the bedroom count of the subject property matches the marketed listing.
- source_key status: N/A.
- User-care severity: Background, bedroom bucket label.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Beds | Beds | Beds |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Bedrooms | Bedrooms | Bedrooms |
| Hosted Full, narrative + tech | Rents below are for {beds}-bedroom homes in your area. | Rents below are grouped by {beds}-bedroom homes in this SA2. | MBIE bedroom bucket {beds} from `bonds_detailed.number_of_beds`. |

---

### Rental overview, median rent (`market.rental_overview[].median` → `rent_assessment.median`)
- What it measures: Median weekly rent (NZD/week) for the dwelling type and bed count in this SA2, latest available quarter.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `bonds_detailed.median_rent` → `mv_rental_market.median_rent` (per-SA2 latest quarter, see migration 0047).
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN, not in `data_loader.py` registry).
- Table(s): `mv_rental_market`.
- Query path: `get_property_report()` step "MARKET" (0054_flood_nearest_m.sql:1031).
- Rendered by: `MarketSection.tsx:109` (rent comparison flow); `HostedRentAdvisor.tsx`. Drives Insights at `report_html.py:1989-1993` (yield ≥5% branch) and `1996-1999` (yield <3% branch).
- Threshold / classification logic: Insight thresholds, yield ≥ 5% → "ok" (`report_html.py:1990`); yield < 3% → "info" (`report_html.py:1996`). Yield is computed `median*52/cv*100` at line 1989.
- Score contribution:, (the median itself isn't scored; depth/yoy from the same row are).
- Coverage: National wherever MBIE has SA2-level bonds in that quarter (small SA2s may be missing some bed/type combos).
- Common misreading: Treating median bond rent as today's asking rent; bonds lodge weeks-to-months after the lease starts, so the median lags the active market.
- What it does NOT tell you: Asking-rent distribution, condition, fixed term vs periodic, or whether utilities are included.
- source_key status: TODO (no `mbie_tenancy_bonds` entry in `SOURCE_CATALOG`).
- User-care severity: Notable for renters and buyers (anchors rent fairness and yield), but no Critical finding rule is wired today; should escalate to Critical-Renter when a user's entered rent sits >10% above the SA2 median.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Median rent in your area | Suburb rent (median) | SA2 median rent |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Typical weekly rent | Median weekly rent | Median weekly rent |
| Hosted Full, narrative + tech | Half of recent {beds}-bed bonds in your area were lodged at or below ${median}/week. | Median weekly rent for {beds}-bed {dwelling_type} in this SA2 is ${median}; pair with yield to read the buy case. | Median bond rent ${median}/week, MBIE Tenancy Bond Lodgement, latest quarter per SA2 × type × beds (mv_rental_market, migration 0047). |

---

### Rental overview, lower quartile (`market.rental_overview[].lq` → `lower_quartile`)
- What it measures: 25th-percentile weekly rent (NZD/week) for the SA2 × dwelling × beds slice.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `bonds_detailed.lower_quartile_rent` → `mv_rental_market`.
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN).
- Table(s): `mv_rental_market`.
- Query path: `get_property_report()` step "MARKET" (0054_flood_nearest_m.sql:1032).
- Rendered by: `MarketSection.tsx` rent grid; `HostedRentAdvisor.tsx`.
- Threshold / classification logic: Used by `RentComparisonFlow` to flag if a user-entered rent sits below LQ ("under-market").
- Score contribution: not applicable.
- Coverage: National wherever MBIE has SA2-level bonds with enough cells to publish quartiles.
- Common misreading: Reading LQ as "the cheapest available"; it is the bottom 25% of recent bond lodgements.
- What it does NOT tell you: Why a tenancy lodged below LQ (could be sub-let, family, condition, or noise/hazard discount).
- source_key status: TODO.
- User-care severity: Context, useful negotiation floor for renters but not decision-critical on its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Cheaper end | Bottom-quartile rent | LQ rent (P25) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Cheaper-end rent | Lower-quartile rent | Lower-quartile weekly rent |
| Hosted Full, narrative + tech | A quarter of recent bonds in your area lodged at or below ${lq}/week, a useful floor for negotiation. | One-in-four recent bonds lodged at or below ${lq}/week; sets the low-rent yield scenario. | P25 weekly rent ${lq} from MBIE bond lodgements (mv_rental_market, latest quarter per SA2 × dwelling × beds). |

---

### Rental overview, upper quartile (`market.rental_overview[].uq` → `upper_quartile`)
- What it measures: 75th-percentile weekly rent (NZD/week) for the SA2 × dwelling × beds slice.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `bonds_detailed.upper_quartile_rent` → `mv_rental_market`.
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN).
- Table(s): `mv_rental_market`.
- Query path: `get_property_report()` step "MARKET" (0054_flood_nearest_m.sql:1033).
- Rendered by: `MarketSection.tsx`; `HostedRentAdvisor.tsx`.
- Threshold / classification logic: `RentComparisonFlow` uses it to flag rents above UQ as "over-market".
- Score contribution: not applicable.
- Coverage: National wherever cells are dense enough.
- Common misreading: Treating UQ as a ceiling; it is the 75th percentile of recent lodgements, not the legal maximum.
- What it does NOT tell you: Whether the upper quartile reflects newer/renovated stock vs older stock at the same bed count.
- source_key status: TODO.
- User-care severity: Context, signals pricier comparable stock but not decision-critical alone.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Pricier end | Top-quartile rent | UQ rent (P75) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Pricier-end rent | Upper-quartile rent | Upper-quartile weekly rent |
| Hosted Full, narrative + tech | A quarter of recent bonds in your area lodged at or above ${uq}/week. | One-in-four recent bonds lodged at or above ${uq}/week, pricier comparable stock. | P75 rent ${uq}/week from MBIE bond lodgements (mv_rental_market). |

---

### Rental overview, bonds (`market.rental_overview[].bonds`)
- What it measures: Total bonds lodged for that SA2 × dwelling × beds combination in the latest available quarter (sample-size signal).
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `bonds_detailed.total_bonds` → `mv_rental_market.total_bonds`.
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN).
- Table(s): `mv_rental_market`.
- Query path: `get_property_report()` step "MARKET" (0054_flood_nearest_m.sql:1034).
- Rendered by: `HostedRentAdvisor.tsx`. Drives Insight at `report_html.py:2029` ("supply relief" combined with consents).
- Threshold / classification logic: `risk_score.py:772-773, 789`, `depth_fraction = min(1.0, bonds / 200.0)` (line 772) then `rental_fairness = round(100 * (1 - depth_fraction))` (line 773); `market_heat = min(100, (bonds/500)*100)` (line 789). Higher bond count → thicker market → lower fairness-risk score (caps at 200 bonds → 0 risk; 0 bonds → 100 risk).
- Score contribution: `rental_fairness` (WEIGHTS_MARKET 0.40); `market_heat` (WEIGHTS_MARKET 0.25).
- Coverage: National wherever MBIE publishes the cell.
- Common misreading: Reading bond count as transaction volume, it counts new tenancies lodged with bonds, not all rentals or all moves.
- What it does NOT tell you: Vacancy rate, lease length, rent-free deals, or the share of stock that is owner-occupied vs rented.
- source_key status: TODO.
- User-care severity: Context, sample-size signal that controls how much weight to place on the median.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Recent bonds nearby | Bond sample size | Bonds (latest quarter) |
| On-screen, finding | Only {bonds} {beds}-bed bonds lodged in your area last quarter, expect thin choice. | {bonds} recent bonds for this slice; read the median with care on small samples. | Latest-quarter bond count {bonds} for SA2 × {dwelling_type} × {beds}. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | How many homes like this rented | Recent bond volume | Bond lodgements (latest quarter) |
| Hosted Full, narrative + tech | About {bonds} similar homes had a new tenancy lodged in your area last quarter. That's the sample these figures are built on. | {bonds} bonds underpin the median above; thin samples (<30) widen the error bars on suburb rent. | {bonds} bonds in latest quarter for SA2 × {dwelling_type} × {beds}; MBIE Bond Lodgement file via mv_rental_market. |

---

### Rental overview, year-on-year change (`market.rental_overview[].yoy_pct`)
- What it measures: Year-on-year change in median weekly rent (%), latest quarter vs the same quarter one year earlier, for this SA2 × dwelling × beds.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `mv_rental_market.yoy_pct`, derived in migration 0047 by joining current and 1-year-prior rows from `bonds_detailed`.
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN).
- Table(s): `mv_rental_market`.
- Query path: `get_property_report()` step "MARKET" (0054_flood_nearest_m.sql:1035).
- Rendered by: `HostedRentAdvisor.tsx`. Drives Insight at `report_html.py:2006` ("Rents rising X% year-on-year") and the supply-relief Insight at 2029.
- Threshold / classification logic: `risk_score.py:785`, `rental_trend = normalize_min_max(max(0, yoy), 0, 20)`. Falling rents clamp to 0; ≥+20% maps to 100. Insight rule fires only when `yoy_pct >= 5` (`report_html.py:2005-2006`).
- Score contribution: `rental_trend` (WEIGHTS_MARKET 0.35).
- Coverage: National wherever both the current and prior-year cell exist.
- Common misreading: Reading YoY as a forecast or as inflation-adjusted; it's a nominal change between two bond medians on a thin SA2 sample.
- What it does NOT tell you: Whether the change came from quality mix shift (e.g. new builds entering the bond pool), not pure rent inflation.
- source_key status: TODO.
- User-care severity: Notable, fast-rising YoY directly affects renewal negotiations and yield checks.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Rent change this year | Rent YoY (suburb) | Rent YoY % (SA2) |
| On-screen, finding | Local rents are {yoy_pct:+}% on a year ago, worth comparing 3-5 alternatives before renewing. | Rents up {yoy_pct}% YoY here; supports yield, but check for quality-mix shift. | Median rent {yoy_pct:+}% YoY, MBIE bonds latest quarter vs same quarter prior. |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Rent change in 12 months | YoY rent change | Median rent YoY % |
| Hosted Full, narrative + tech | Median rent in your area is {yoy_pct:+}% on a year ago. A renewal at the old rent is worth pushing for. | YoY median rent change is {yoy_pct:+}% in this SA2; helpful for a yield check but nominal and unadjusted for stock mix. | YoY {yoy_pct:+}% derived in mv_rental_market (migration 0047) from MBIE bonds, current vs prior-year same quarter. |

---

### Trends, dwelling type (`market.trends[].dwelling_type`)
- What it measures: Dwelling-type bucket (House, Flat, Apartment, ALL) of a row in the rental trends series.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `bonds_detailed.dwelling_type` → `mv_rental_trends.dwelling_type`.
- DataSource key(s): `tenancy_bonds` (loader name UNKNOWN).
- Table(s): `mv_rental_trends` (defined in `sql/06-materialized-views.sql:93`).
- Query path: `get_property_report()` step "MARKET" lateral on `mv_rental_trends` (0054_flood_nearest_m.sql:1043).
- Rendered by: `HostedRentHistory.tsx` (series picker / label).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National wherever MBIE has bonds.
- Common misreading: Comparing "Apartment" CAGR to "House" CAGR without noting that apartment supply has changed faster than house supply.
- What it does NOT tell you: Build-quality mix changes within a type.
- source_key status: N/A (label only).
- User-care severity: Background, series picker label.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not on-screen) | (out of scope: not on-screen) | (out of scope: not on-screen) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Type | Dwelling | Dwelling type (trends) |
| Hosted Full, narrative + tech | Trend below is for {dwelling_type} homes. | Trend series segmented by {dwelling_type}. | Series key {dwelling_type}; mv_rental_trends row from MBIE bonds. |

---

### Trends, beds (`market.trends[].beds`)
- What it measures: Bedroom-count bucket of a row in the rental trends series.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `mv_rental_trends.number_of_beds`.
- DataSource key(s): `tenancy_bonds`.
- Table(s): `mv_rental_trends`.
- Query path: 0054_flood_nearest_m.sql:1044.
- Rendered by: `HostedRentHistory.tsx`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National.
- Common misreading: Reading `5+` as a homogeneous group; it pools mansions and large flats.
- What it does NOT tell you: Floor area or condition.
- source_key status: N/A.
- User-care severity: Background, series picker label.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not on-screen) | (out of scope: not on-screen) | (out of scope: not on-screen) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Bedrooms | Bedrooms | Bedrooms (trends) |
| Hosted Full, narrative + tech | Trend below is for {beds}-bedroom homes. | Trend series segmented by {beds}-bedroom homes in this SA2. | Series key beds={beds}; mv_rental_trends row from MBIE bonds. |

---

### Trends, current median (`market.trends[].current_median`)
- What it measures: Most recent quarter's median weekly rent (NZD/week) for the SA2 × type × beds, used as the anchor of the CAGR series.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `mv_rental_trends.current_median`.
- DataSource key(s): `tenancy_bonds`.
- Table(s): `mv_rental_trends`.
- Query path: 0054_flood_nearest_m.sql:1045.
- Rendered by: `HostedRentHistory.tsx` (chart endpoint label).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National wherever the SA2 cell is published in the latest quarter.
- Common misreading: Reading this as today's asking rent; it's the latest published bond median (typically a quarter behind).
- What it does NOT tell you: Whether the latest quarter sits inside or outside the long-run trend channel.
- source_key status: TODO.
- User-care severity: Context, latest anchor for the rent trend chart.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not on-screen) | (out of scope: not on-screen) | (out of scope: not on-screen) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Latest typical rent | Current median | Current median rent |
| Hosted Full, narrative + tech | The latest figure on the chart: ${current_median}/week. | Latest-quarter median is ${current_median}/week, the anchor for the CAGR figures below. | mv_rental_trends.current_median (latest quarter), MBIE bonds. |

---

### Trends, year-on-year change (`market.trends[].yoy_pct`)
- What it measures: Year-on-year change (%) in the SA2 × type × beds median rent, computed inside `mv_rental_trends`.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `mv_rental_trends.yoy_pct` (`sql/06-materialized-views.sql:110-112`).
- DataSource key(s): `tenancy_bonds`.
- Table(s): `mv_rental_trends`.
- Query path: 0054_flood_nearest_m.sql:1046.
- Rendered by: `HostedRentHistory.tsx`.
- Threshold / classification logic:, (no Insight rule directly; the parallel `rental_overview[].yoy_pct` drives the score).
- Score contribution:, (the rental_overview path feeds the score; this trends-row mirror is informational).
- Coverage: National wherever both quarters exist.
- Common misreading: Comparing trend YoY against rental_overview YoY, they're computed on the same source but slightly different aggregations; small differences are noise.
- What it does NOT tell you: Whether change is mix-driven.
- source_key status: TODO.
- User-care severity: Context, mirrors the score-driving rental_overview.yoy_pct but without its own finding rule.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: not on-screen) | (out of scope: not on-screen) | (out of scope: not on-screen) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Last 12 months | YoY change | YoY % (trends series) |
| Hosted Full, narrative + tech | Rents in your area are {yoy_pct:+}% on a year ago. | Trend YoY {yoy_pct:+}% on a like-for-like SA2 × type × beds basis. | mv_rental_trends.yoy_pct, MBIE bonds latest vs prior year. |

---

### Trends, 3-year CAGR (`market.trends[].cagr_3yr` → `trend.cagr_1yr`/`trend.cagr_3yr`)
- What it measures: 3-year compound annual growth rate of the median weekly rent for this SA2 × type × beds (% per year).
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `mv_rental_trends.cagr_3yr` (`sql/06-materialized-views.sql:114-116`, `POWER(c.median_rent / y3.median_rent, 1.0/3) - 1`).
- DataSource key(s): `tenancy_bonds`.
- Table(s): `mv_rental_trends`.
- Query path: 0054_flood_nearest_m.sql:1047.
- Rendered by: `MarketSection.tsx:123` (1yr column when transformed); `HostedRentHistory.tsx`.
- Threshold / classification logic:, (no Insight rule on cagr_3yr).
- Score contribution: not applicable.
- Coverage: National wherever both endpoint quarters exist.
- Common misreading: Reading a CAGR as a guarantee of next year's rent; it's a backward-looking smoothed rate, not a forecast.
- What it does NOT tell you: Volatility along the path or whether growth concentrated in a single year.
- source_key status: TODO.
- User-care severity: Context, short-window trend; informational without a finding rule.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (renamed to 1yr in transform) | (renamed to 1yr in transform) | (renamed to 1yr in transform) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Rent growth, last 3 years | 3-year rent CAGR | 3-yr CAGR (median rent) |
| Hosted Full, narrative + tech | Rents have grown about {cagr_3yr:+.1f}% per year over 3 years. | Three-year compound growth in median rent: {cagr_3yr:+.1f}% per year. | 3-yr CAGR {cagr_3yr:+.1f}%/yr from mv_rental_trends (MBIE bonds, t vs t-3). |

---

### Trends, 5-year CAGR (`market.trends[].cagr_5yr`)
- What it measures: 5-year compound annual growth rate (%/yr) of median weekly rent for this SA2 × type × beds.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `mv_rental_trends.cagr_5yr` (`sql/06-materialized-views.sql:118-120`).
- DataSource key(s): `tenancy_bonds`.
- Table(s): `mv_rental_trends`.
- Query path: 0054_flood_nearest_m.sql:1048.
- Rendered by: `MarketSection.tsx:131`; `HostedRentHistory.tsx`. Drives Insight at `report_html.py:2013` ("X% annualised rental growth over 5 years") when ≥4%.
- Threshold / classification logic: Insight fires when `cagr_5yr >= 4` (`report_html.py:2010`); referenced again in HPI sales footer at 2297-2301 and recommendation at 3415-3418.
- Score contribution: not applicable.
- Coverage: National wherever five-year-prior quarter exists.
- Common misreading: Annualising and projecting forward; CAGR is the closed-form rate between two points and hides volatility.
- What it does NOT tell you: Real (CPI-adjusted) growth, figures are nominal.
- source_key status: TODO.
- User-care severity: Notable, the only CAGR with an Insight rule wired today (≥4%).

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Rent growth, 5 years | 5-year rent CAGR | 5-yr CAGR (median rent) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | (out of scope: long-window trend, not a renewal signal) | 5-year rent CAGR | 5-yr CAGR (median rent) |
| Hosted Full, narrative + tech | (out of scope: long-window trend, not a renewal signal) | 5-year compound growth in median rent is {cagr_5yr:+.1f}%/yr (nominal, not inflation-adjusted). | 5-yr CAGR {cagr_5yr:+.1f}%/yr from mv_rental_trends (MBIE bonds, t vs t-5). |

---

### Trends, 10-year CAGR (`market.trends[].cagr_10yr`)
- What it measures: 10-year compound annual growth rate (%/yr) of median weekly rent for this SA2 × type × beds.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `mv_rental_trends.cagr_10yr` (`sql/06-materialized-views.sql:122-124`).
- DataSource key(s): `tenancy_bonds`.
- Table(s): `mv_rental_trends`.
- Query path: 0054_flood_nearest_m.sql:1049.
- Rendered by: `MarketSection.tsx:139`; `HostedRentHistory.tsx`.
- Threshold / classification logic:, (no Insight rule).
- Score contribution: not applicable.
- Coverage: National wherever ten-year-prior quarter exists; thinner than the 5-yr cell because some SA2 boundaries changed in 2018/2023 reclassifications.
- Common misreading: Comparing 10-yr CAGR across SA2s without noting boundary changes.
- What it does NOT tell you: Real (CPI-adjusted) growth or whether the boundary stayed constant over the decade.
- source_key status: TODO.
- User-care severity: Context, decade-long backdrop; SA2 boundary changes can dilute the signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | Rent growth, 10 years | 10-year rent CAGR | 10-yr CAGR (median rent) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | (out of scope: decade-long trend, not a renewal signal) | 10-year rent CAGR | 10-yr CAGR (median rent) |
| Hosted Full, narrative + tech | (out of scope: decade-long trend, not a renewal signal) | 10-year compound growth in median rent is {cagr_10yr:+.1f}%/yr (nominal). SA2 boundary changes can affect older endpoints. | 10-yr CAGR {cagr_10yr:+.1f}%/yr from mv_rental_trends (MBIE bonds, t vs t-10). |

---

### HPI, quarter end (`market.hpi_latest.quarter`)
- What it measures: Quarter-end date (yyyy-mm-dd) of the latest national House Price Index point.
- Source authority: REINZ (Real Estate Institute of NZ) / RBNZ housing series, the SQL pulls from `hpi_national`, which is the REINZ-derived national HPI (admin upload pipeline mirrored from RBNZ housing for the live snapshot HPI chart).
- Dataset / endpoint: `hpi_national.quarter_end`.
- DataSource key(s): `reinz_hpi_national` (per `_INVENTORY.md` Market section; not present in `data_loader.py` registry, UNKNOWN whether this is a registered DataSource or admin-uploaded only).
- Table(s): `hpi_national`.
- Query path: `get_property_report()` step "MARKET", `ORDER BY quarter_end DESC LIMIT 1` (0054_flood_nearest_m.sql:1057,1062-1063).
- Rendered by: `HostedHPIChart.tsx`. Referenced for context in the buyer recommendation footer (`report_html.py:2287-2301`).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National (single time series); listed as `Y` for all 14 cities in WIRING-TRACES § City-coverage-matrix.
- Common misreading: Treating a national index quarter as a suburb price.
- What it does NOT tell you: Anything suburb-specific.
- source_key status: TODO.
- User-care severity: Background, methodology timestamp on a national index.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: HPI is buyer-gated, on-screen renderer renders chart only) | (out of scope: chart axis label, no separate text label) | (out of scope: chart axis label, no separate text label) |
| On-screen, finding | (out of scope: HPI not surfaced as a finding) | (out of scope: HPI not surfaced as a finding) | (out of scope: HPI not surfaced as a finding) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | (out of scope: HPI is buyer-relevant only) | As at | HPI quarter |
| Hosted Full, narrative + tech | (out of scope: HPI is buyer-relevant only) | National HPI shown as at quarter ending {quarter}. | hpi_national.quarter_end = {quarter} (latest row). |

---

### HPI, index value (`market.hpi_latest.hpi`)
- What it measures: Latest value of the national House Price Index (unitless, base period set by source).
- Source authority: REINZ HPI (admin-uploaded; mirrors RBNZ housing snapshot for chart rendering).
- Dataset / endpoint: `hpi_national.house_price_index`.
- DataSource key(s): `reinz_hpi_national` (UNKNOWN, not in `data_loader.py` registry).
- Table(s): `hpi_national`.
- Query path: 0054_flood_nearest_m.sql:1058.
- Rendered by: `HostedHPIChart.tsx` (chart series).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National.
- Common misreading: Treating the index level as a price; HPI tracks change against a base period, not absolute value.
- What it does NOT tell you: Median sale price, regional dispersion, or whether national trends apply locally.
- source_key status: TODO.
- User-care severity: Context, national index level; useful as backdrop, not a buy/sell trigger.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: HPI is buyer-only, gated behind PremiumGate) | (out of scope: chart axis only) | (out of scope: chart axis only) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | (out of scope: buyer-only chart) | NZ HPI level | HPI (REINZ national) |
| Hosted Full, narrative + tech | (out of scope: buyer-only chart) | National HPI sits at {hpi}; HPI is an index of price change, not a dollar value. | REINZ HPI level {hpi} (hpi_national, latest quarter). |

---

### HPI, sales volume (`market.hpi_latest.sales`)
- What it measures: Number of recorded house sales in the latest quarter (national).
- Source authority: REINZ.
- Dataset / endpoint: `hpi_national.house_sales`.
- DataSource key(s): `reinz_hpi_national` (UNKNOWN, not in `data_loader.py` registry).
- Table(s): `hpi_national`.
- Query path: 0054_flood_nearest_m.sql:1059.
- Rendered by: `HostedHPIChart.tsx`. Referenced in buyer recommendation footer at `report_html.py:2299` ("national sales volume last quarter: …").
- Threshold / classification logic:, (used as descriptive context, not a threshold).
- Score contribution: not applicable.
- Coverage: National.
- Common misreading: Reading national sales count as a suburb-level liquidity signal.
- What it does NOT tell you: Local turnover or days-on-market.
- source_key status: TODO.
- User-care severity: Context, national activity backdrop, not a suburb-level liquidity signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: HPI buyer-only) | (out of scope: HPI buyer-only) | (out of scope: HPI buyer-only) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | (out of scope: buyer-only) | National sales last quarter | National sales (REINZ) |
| Hosted Full, narrative + tech | (out of scope: buyer-only) | About {sales:,} homes sold across NZ last quarter, context for how active the wider market is. | hpi_national.house_sales = {sales:,} for {quarter}, REINZ. |

---

### HPI, stock value (`market.hpi_latest.stock_value_m`)
- What it measures: Total estimated value of NZ housing stock at quarter end, in millions of NZD.
- Source authority: REINZ / RBNZ housing aggregate.
- Dataset / endpoint: `hpi_national.housing_stock_value_m`.
- DataSource key(s): `reinz_hpi_national` (UNKNOWN, not in `data_loader.py` registry).
- Table(s): `hpi_national`.
- Query path: 0054_flood_nearest_m.sql:1060.
- Rendered by: `HostedHPIChart.tsx`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National.
- Common misreading: Mistaking aggregate stock value for total transaction value.
- What it does NOT tell you: Anything about a specific property or suburb.
- source_key status: TODO.
- User-care severity: Background, aggregate stock value used for scale context only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: HPI buyer-only) | (out of scope: HPI buyer-only) | (out of scope: HPI buyer-only) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | (out of scope: buyer-only) | NZ housing stock value | NZ housing stock value (NZD m) |
| Hosted Full, narrative + tech | (out of scope: buyer-only) | NZ housing stock is worth about NZ${stock_value_m:,}m at quarter end (wider-market scale). | hpi_national.housing_stock_value_m = {stock_value_m:,}m NZD, REINZ aggregate. |

---

### Market heat (`market.market_heat`)
- What it measures: Bond-volume-derived 0–100 demand signal for the SA2 (the higher, the more bonds being lodged relative to a 500-bonds-per-quarter reference).
- Source authority: WhareScore-computed on top of MBIE Tenancy Bond Lodgement.
- Dataset / endpoint: Computed in `risk_score.py:789` as `min(100, (bonds / 500) * 100)` from the ALL/ALL `rental_overview` row; surfaced in the snapshot via `snapshot_generator` (no SQL field).
- DataSource key(s): `tenancy_bonds`.
- Table(s): `mv_rental_market` (input).
- Query path: `risk_score.enrich_with_scores()` then attached to the report indicators payload.
- Rendered by: `MarketSection.tsx:36` (MarketHeatBadge); `HostedRentAdvisor.tsx`.
- Threshold / classification logic: 0 bonds → 50 (neutral fallback); >0 bonds → `min(100, bonds/500·100)`; ≥500 bonds → 100; linear in between (`risk_score.py:789`).
- Score contribution: `market_heat` (WEIGHTS_MARKET 0.25).
- Coverage: National wherever a bond row exists for the ALL/ALL slice.
- Common misreading: Treating "high heat" as a price-rise signal, it's a tenancy-volume proxy and is just as high in cheap, high-turnover SA2s.
- What it does NOT tell you: Whether demand is for renting or buying; whether prices are rising; vacancy.
- source_key status: TODO.
- User-care severity: Notable, weighted 25% in the market score and shapes the rental-market badge.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | How busy is this rental market? | Rental market heat | Market heat (0–100) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | How busy is the market here | Rental market heat | Market heat index (0–100) |
| Hosted Full, narrative + tech | Lots of new tenancies are being signed in your area. Expect competition at viewings. | Market-heat reading of {market_heat}/100 is a tenancy-volume proxy, not a price-rise signal. | market_heat = min(100, bonds/500·100) on ALL/ALL bond row from mv_rental_market (risk_score.py:789). |

---

### Rent history (snapshot) (`rent_history`)
- What it measures: 10-year time series of quarterly median, lower-quartile, upper-quartile rent and active bonds for the address's SA2.
- Source authority: MBIE Tenancy Services Bond Lodgement.
- Dataset / endpoint: `bonds_detailed` filtered to `location_id = sa2_code` and the last 10 years.
- DataSource key(s): `tenancy_bonds`.
- Table(s): `bonds_detailed` (CREATE TABLE in `scripts/load_bonds_detailed.py:28`, not in `backend/migrations/`, table created by the loader script on first run).
- Query path: `snapshot_generator._q_rent_history()` (`backend/app/services/snapshot_generator.py:285`).
- Rendered by: `HostedRentHistory.tsx` (chart). On-screen `RentHistoryChart` calls a separate API (not the snapshot field).
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National wherever the SA2 has a 10-year bond history; narrower than per-quarter median because it requires a continuous series.
- Common misreading: Treating gaps in the line as "rents fell to zero"; gaps mean MBIE didn't publish that quarter for that cell.
- What it does NOT tell you: Real (CPI-adjusted) levels; quality-mix shifts.
- source_key status: TODO.
- User-care severity: Context, 10-year backdrop chart; useful for spotting recent jumps, not a finding source.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: on-screen chart pulls from a different endpoint) | (out of scope: on-screen chart pulls from a different endpoint) | (out of scope: on-screen chart pulls from a different endpoint) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Rent history (10 years) | 10-year rent series | Bond-rent series, last 10 years |
| Hosted Full, narrative + tech | How rents in your area have moved over 10 years. Useful for spotting recent jumps. | Quarterly median, LQ and UQ rent for this SA2 over the last 10 years; gaps indicate quarters MBIE didn't publish. | Quarterly bonds_detailed slice, location_id = SA2, last 10 years (snapshot_generator.py:285). |

---

### HPI data (snapshot) (`hpi_data`)
- What it measures: 10-year quarterly time series of national House Price Index value and house sales count.
- Source authority: RBNZ housing series (`rbnz_housing` table), note the snapshot reads from `rbnz_housing`, not `hpi_national`.
- Dataset / endpoint: `rbnz_housing.quarter_end / house_price_index / house_sales` filtered to last 10 years.
- DataSource key(s): UNKNOWN, `_INVENTORY.md` lists `reinz_hpi_national, reinz_hpi_ta` as the keys, but `snapshot_generator.py:308` queries `rbnz_housing`. Only one is correct; the inventory likely needs updating. Neither `rbnz_housing` nor `reinz_hpi_national` is registered in `data_loader.py`.
- Table(s): `rbnz_housing` (CREATE TABLE in `scripts/load_rbnz_housing.py:28`, not in `backend/migrations/`, table created by the loader script on first run).
- Query path: `snapshot_generator._q_hpi()` (`backend/app/services/snapshot_generator.py:301`; `FROM rbnz_housing` at line 308).
- Rendered by: `HostedHPIChart.tsx:12`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National (single series).
- Common misreading: Reading the chart as a suburb price line.
- What it does NOT tell you: Local price trajectories.
- source_key status: TODO.
- User-care severity: Context, national HPI chart; backdrop for the buyer narrative.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: HPI is buyer-only on-screen, served from `/hpi` endpoint not the snapshot) | (out of scope: on-screen pulls a separate endpoint) | (out of scope: on-screen pulls a separate endpoint) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | (out of scope: buyer-only) | NZ house price trend (10 years) | National HPI series (10 years) |
| Hosted Full, narrative + tech | (out of scope: buyer-only) | The national house-price index over the last 10 years; useful for context, not a suburb signal. | rbnz_housing latest 10 years of quarter_end / house_price_index / house_sales (snapshot_generator.py:301-313). |

---

### Suburb comparators (`comparisons.suburb.*`)
- What it measures: SA2-level baselines for the address's neighbourhood, `label` (SA2 name), `avg_nzdep`, `school_count_1500m`, `transit_count_400m`, `max_noise_db`, `epb_count_300m`.
- Source authority: NZDep / Stats NZ (deprivation), Ministry of Education (schools), regional GTFS feeds (transit), Waka Kotahi noise contours, MBIE EPB register, pre-aggregated to SA2.
- Dataset / endpoint: `mv_sa2_comparisons` materialised view, joined on `sa2_code = v_sa2_code`.
- DataSource key(s): UNKNOWN (composite of `nzdep`, `moe_schools`, GTFS keys, `nzta_noise`, `epb_mbie`; the comparator view itself has no DataSource key).
- Table(s): `mv_sa2_comparisons`.
- Query path: `get_property_report()` step "COMPARISONS" (0054_flood_nearest_m.sql:989-998).
- Rendered by: `HostedNeighbourhoodStats.tsx` (lines 129-130).
- Threshold / classification logic:, (used as comparator bars in the hosted neighbourhood section).
- Score contribution: not applicable.
- Coverage: National wherever the SA2 has all five inputs; missing inputs render as blank bars.
- Common misreading: Reading "avg_nzdep" as a percentile of deprivation; NZDep is a 1–10 decile per meshblock and the SA2 average smooths within-SA2 variation.
- What it does NOT tell you: Within-SA2 variation between streets.
- source_key status: TODO (each underlying source has a key in `SOURCE_CATALOG`, `nzdep`, `moe_schools`, `gtfs_transit`, `nzta_noise`, but the comparator object itself has no attribution).
- User-care severity: Context, comparator bars set the suburb-vs-city baseline readers calibrate against.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: comparisons are hosted-only) | (out of scope: comparisons are hosted-only) | (out of scope: comparisons are hosted-only) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Your neighbourhood vs the rest | Suburb baselines | SA2 comparators |
| Hosted Full, narrative + tech | How your area compares to the rest of the city on schools, transit, noise and deprivation. | Suburb averages for schools-within-1500m, transit stops, noise, NZDep and EPB count, used as context bars in the neighbourhood section. | mv_sa2_comparisons row for {label}: avg_nzdep, school_count_1500m, transit_count_400m, max_noise_db, epb_count_300m (NZDep, MoE, GTFS, Waka Kotahi noise, MBIE EPB). |

---

### City comparators (`comparisons.city.*`)
- What it measures: Territorial-Authority-level averages for the same five indicators above (`label`, `avg_nzdep`, `avg_school_count_1500m`, `avg_transit_count_400m`, `avg_noise_db`, `avg_epb_count_300m`).
- Source authority: Same composite as suburb comparators, aggregated to TA.
- Dataset / endpoint: `mv_ta_comparisons` materialised view, joined on `ta_name = v_ta_name`.
- DataSource key(s): UNKNOWN (composite).
- Table(s): `mv_ta_comparisons`.
- Query path: `get_property_report()` step "COMPARISONS" (0054_flood_nearest_m.sql:1001-1012, join `WHERE tc.ta_name = v_ta_name` at line 1011).
- Rendered by: `HostedNeighbourhoodStats.tsx:131`.
- Threshold / classification logic: not applicable.
- Score contribution: not applicable.
- Coverage: National wherever the TA boundary resolves.
- Common misreading: Reading the TA average as the experience of any particular suburb in the city.
- What it does NOT tell you: Variation between suburbs inside the same TA.
- source_key status: TODO.
- User-care severity: Context, city-wide baseline pair to the suburb comparators.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label | (out of scope: comparisons are hosted-only) | (out of scope: comparisons are hosted-only) | (out of scope: comparisons are hosted-only) |
| On-screen, finding | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Quick, narrative | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) | (out of scope: not in HostedQuickReport) |
| Hosted Full, label | Your area vs the wider city | City baselines | TA comparators |
| Hosted Full, narrative + tech | How your suburb compares against the rest of the city on schools, transit and quietness. | Council-area averages (schools, transit stops, noise, NZDep, EPB count) used as the wider-city baseline in the neighbourhood section. | mv_ta_comparisons row for {label}: avg_nzdep, avg_school_count_1500m, avg_transit_count_400m, avg_noise_db, avg_epb_count_300m. |

---

## Local coverage audit

| Indicators in category | With findings | With source_key | Missing on hosted-full |
|---|---|---|---|
| 25 | 5 (rental_overview.median, rental_overview.bonds, rental_overview.yoy_pct, trends.cagr_5yr, hpi_latest.quarter, counted by inventory `finding?` column being non-blank) | 0 today; SOURCE_CATALOG (`report_html.py:637-676`) now contains `tenancy_bonds`, `reinz_hpi_national`, `reinz_hpi_ta`, `rbnz_housing`, ready for `_src(...)` wiring on Market Insights, but not yet attached to any Insight call | 0 (every indicator has at least one Pro hosted-full cell; on-screen and hosted-quick gaps are flagged as out-of-scope) |

### Severity-tier audit (this pass)

| Indicators | Critical | Notable | Context | Background |
|---|---|---|---|---|
| 25 | 0 | 4 (rental_overview.median, rental_overview.yoy_pct, trends.cagr_5yr, market_heat) | 13 (lq, uq, bonds, current_median, trends.yoy_pct, cagr_3yr, cagr_10yr, hpi_latest.hpi, hpi_latest.sales, rent_history, hpi_data, comparisons.suburb, comparisons.city) | 8 (sa2_code, sa2_name, rental_overview.dwelling_type, rental_overview.beds, trends.dwelling_type, trends.beds, hpi_latest.quarter, hpi_latest.stock_value_m) |

## Local gap list (UNKNOWN entries or missing source_key)

- `tenancy_bonds`, DataSource loader name is referenced throughout migrations and `_INVENTORY.md` but is not present in `data_loader.py`'s `DataSource(...)` registry. UNKNOWN whether ingestion uses an admin upload or an out-of-registry script.
- `reinz_hpi_national`, Listed in `_INVENTORY.md` as the DataSource key for `market.hpi_latest.*`, but not in `data_loader.py` and the snapshot HPI series actually reads from `rbnz_housing`. UNKNOWN which is authoritative.
- `hpi_data` (snapshot), `_INVENTORY.md` says `hpi_national, hpi_ta`, but `snapshot_generator.py:308` queries `rbnz_housing`. The two paths disagree.
- All 25 Market indicators, no `source_key` attribution wired today. SOURCE_CATALOG (`report_html.py:637-676`) DOES now contain `tenancy_bonds` ("MBIE Tenancy Services bond data"), `reinz_hpi_national` ("REINZ House Price Index (national)"), `reinz_hpi_ta` ("REINZ House Price Index (territorial authority)"), and `rbnz_housing` ("RBNZ housing statistics"), these source_keys are ready for `_src(...)` wiring on Market Insights but no Insight call uses them yet. (Loader registration in `data_loader.py` remains UNKNOWN/absent for all four, SOURCE_CATALOG presence is independent of DataSource registry presence.)
- `comparisons.suburb.*` and `comparisons.city.*`, composite indicators with no single DataSource key; need a wrapper source like `wharescore_comparators` or per-component attribution.

## Local conflict list (same field labelled inconsistently across surfaces today)

- `market.rental_overview[].median` is labelled as `Median rent` in `MarketSection.tsx` (rent grid via `RentComparisonFlow`, file:line UNKNOWN, inventory points at `MarketSection.tsx` only) and as `Typical rent` / `Indicative gross yield: …%` in `report_html.py:1991,1999`. The Insight wording "Indicative gross yield" describes a *derived* number (rent × 52 / CV) but uses the median rent field as input, risk of users reading the gross-yield Insight as a property of the median itself.
- `market.rental_overview[].yoy_pct` and `market.trends[].yoy_pct` are both labelled "YoY rent change" but are computed in two different materialised views (`mv_rental_market.yoy_pct` migration 0047 line 50-54, and `mv_rental_trends.yoy_pct` `sql/06-materialized-views.sql:110-112`); small numeric differences between them will surface as inconsistencies in the same hosted page.
- `market.hpi_latest.*` reads from `hpi_national` (0054_flood_nearest_m.sql:1062) while the snapshot field `hpi_data` reads from `rbnz_housing` (snapshot_generator.py:308). Both are labelled "NZ HPI" / "House Price Index" in the UI but come from different tables, risk of the at-a-glance number and the chart trace disagreeing on the same hosted full report.
- `market.market_heat` is used as a 0–100 risk-style score (`risk_score.py:789`) but is rendered on-screen via a `MarketHeatBadge` (`MarketSection.tsx:36`) where higher reads as "hotter"/positive. Same number, two interpretive directions depending on surface.
