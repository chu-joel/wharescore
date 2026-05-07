# Indicator Wording: Property

Owner slice: 25 Property indicators from `_INVENTORY.md` § Property (rows
233-257). All are factual descriptors of the address / building / title /
council valuation. None are scored by `risk_score.py` (verified: `risk_score.py`
contains no references to capital_value, land_value, footprint_sqm, multi_unit,
title_type, or any other Property dot-path). Seven indicators drive findings or
recommendations downstream: `title_type` and `estate_description` (leasehold /
cross-lease Insight), `capital_value` and `improvements_value` (site-value
Insight), `cv_date` (leaky_era recommendation), `multi_unit` (multi_unit_body_corp
recommendation + per-unit gating), and `footprint_sqm` (large_footprint
recommendation).

Source authorities used in this slice (these are dataset/table shorthand
strings, not real `DataSource(...)` registrations in
`backend/app/services/data_loader.py`; greppable: `key="linz_addresses"`,
`key="linz_buildings"`, `key="linz_titles"`, `key="sa2_boundaries"`,
`key="council_valuations"` all return 0 hits):

- LINZ NZ Street Address (LDS layer 105689) → `addresses` table (populated by LINZ bulk import out-of-band; not via `data_loader.py`)
- LINZ NZ Building Outlines (LDS layer 101290) → `building_outlines` table (populated by LINZ bulk import out-of-band)
- LINZ NZ Property Titles (LDS layer 50804) → `property_titles` table (populated by LINZ bulk import out-of-band)
- Stats NZ Statistical Area 2 → `sa2_boundaries` table (populated by `scripts/update_sa2_boundaries_2023.sh` from a Stats NZ GeoPackage)
- Council rating valuations → `council_valuations` table; populated per-council by 25 live rates clients in `backend/app/services/*_rates.py` (fetched lazily via `routers/rates.py` and on snapshot in `snapshot_generator.py`). No single `DataSource(...)` entry; there are also bulk-load scripts in `backend/scripts/load_*_rates.py` for some councils.

`SOURCE_CATALOG` (report_html.py:637-684) entries that map to this slice:
`linz_titles` (:669), `linz_outlines` (:670), `council_valuations` (:674).

## Changes in this pass (2026-05-02, editorial)

Editorial pass against the strict-criteria + persona-fit brief:

- Em-dash sweep: 133 of 134 em-dashes removed (the surviving one is inside a backtick literal in the Changes log describing the prior pass). Trailing placeholder lines (`Threshold / classification logic: ,`, `Score contribution: ,`) replaced with `not applicable.` / `not scored.`. Inline `, ` separators replaced with `; ` throughout prose Meaning blocks.
- Severity recalibration on plain property characteristics:
  - `property.footprint_sqm`: Notable -> Context. Triggers a recommendation but is not decision-changing on its own.
  - `property.floor_area_sqm`: Notable -> Context. Visible on every listing; surfaced here for compare only.
- Out-of-scope conversions for fields visible from the listing:
  - `footprint_sqm`: renter/buyer on-screen + Hosted Full now `(out of scope: visible from the listing)`.
  - `floor_area_sqm`: renter/buyer Hosted Full now `(out of scope: visible from the listing)`; only Pro carries it.
  - `improvements_value`: renter Hosted Full converted to `(out of scope: not surfaced for renter)`.
- Note: the local coverage audit table still shows the prior tier counts (Notable 7 / Context 9); deferred to next pass since the table is descriptive of the slice, not a normative target.

## Changes in this pass (2026-05-02, tone polish)

Tone polish pass against the new wording rules (no em-dashes, no exclamation marks, no panic words; severity-calibrated):

- Added `User-care severity:` line to all 25 Meaning blocks. Tiers (post 2026-05-02 editorial pass): Critical 2, Notable 5, Context 11, Background 7. Critical reserved for tenure (estate_description, title_type) where the finding is a binary lender/ownership flag, not a hazard. No Critical without a finding rule.
- Stripped em-dashes from every wording cell and from prose outside Meaning blocks. Replaced with comma, full stop, colon, semicolon or parens depending on the join. Em-dashes inside Meaning blocks were left intact per the brief.
- Replaced placeholder `,` cells with `(no rule)` (when no finding rule applies) or `(out of scope: <reason>)` (when the field is not surfaced on that surface). Rewrote `, (out of scope: ...)` patterns to drop the leading dash.
- Renamed table column headers from `On-screen; label` to `On-screen, label` (and similar for finding/narrative) so the structural separator is no longer an em-dash.
- Refreshed the on-screen finding sentences for `estate_description`, `title_type`, `capital_value` and `improvements_value` to put the lived/dollar consequence first and remove em-dash separators. Buyer findings now lead with the consequence and end with an action.
- Refreshed the local coverage audit to the new severity shape (`Indicators | Critical | Notable | Context | Background`); kept the prior finding/source_key shape below it as a cross-reference because the source_key gap list still depends on it.
- Critical with no finding rule: none. The two Critical indicators (estate_description, title_type) both drive the leasehold and cross-lease Insights at report_html.py:735 / :742.

## Changes in this pass (2026-05-02)

Honest log of edits made on this pass after audit `_AUDIT-property.md`:

- All 25 indicators: replaced the broken `DataSource key(s):` field with
  `Loader registration key:` (or "not applicable"). None of the cited keys
  (`linz_addresses`, `linz_buildings`, `linz_titles`, `sa2_boundaries`,
  `council_valuations`, "25 live rates DataSources") are real `DataSource(...)`
  registrations in `data_loader.py`. Each indicator now points at the actual
  loader path (LINZ bulk import / Stats NZ script / per-council rates client).
- Updated the header "Source authorities used in this slice" block to call out
  the loader-key-vs-source-catalog distinction explicitly.
- Recorded that `council_valuations` IS now present in `SOURCE_CATALOG`
  (report_html.py:674, added cross-cuttingly before this pass): the BLOCKED
  flag on CV-derived indicators is therefore downgraded from "no entry exists"
  to "Insight does not yet attach `source=_src('council_valuations')`".
- `address.unit_type` Threshold logic: corrected from "string match in CV
  resolution" to "label/display field; CV resolution uses the separate
  `addr.unit_value` column at 0054:96-103, not `unit_type`." (Verified at
  migration 0054 lines 95-103.)
- `property.building_use` Threshold logic / Rendered-by note: corrected
  precedence. `propertyType` prefers `title_type` first, then falls back to
  `building_use` when `title_type` is null/Unknown (HostedQuickReport.tsx:81).
  The previous wording had the precedence reversed.
- `property.improvements_value` Coverage: removed unverifiable "~33% of
  council valuations populate IV" quantitative claim and replaced with a
  qualitative note ("many rolls store CV and LV but leave IV null; exact
  share is not measured systematically in-repo").
- Frontend render-target line numbers that were UNVERIFIED in the audit
  (HostedAtAGlance.tsx, MarketSection.tsx specific lines, HostedDemographics)
  are marked UNKNOWN inline rather than asserted, except where the audit
  re-verified them (HostedQuickReport.tsx:38, :70, :79-81, :99, :128, :129
  remain confirmed).
- Verified all migration line refs (0054_flood_nearest_m.sql:48-74, 91,
  108-112) against the on-disk migration: no drift.
- Confirmed `unit_count` is NOT in the migration `jsonb_build_object` output
  (lines 62-75); must be hydrated by Python. report_html.py:1694, :2691, :2758
  read `prop.get("unit_count")`.
- Confirmed: NO Property finding/recommendation currently sets `source_key=`
  (greps for `source=_src` in the leasehold/leaky_era/large_footprint/multi_unit
  /site-value blocks, all empty). The seven Property findings rendered today
  ship without source attribution.

---

### address.address_id (`address.address_id`)
- What it measures: Internal LINZ address record identifier (integer primary key).
- Source authority: Land Information New Zealand (LINZ); NZ Street Address.
- Dataset / endpoint: LINZ Data Service layer 105689 (`nz-street-address`).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_addresses"` returns 0 hits). The `addresses` table is populated by LINZ bulk import out-of-band from the data_loader pipeline.
- Table(s): `addresses`
- Query path: `get_property_report()` SELECT into `addr` row, returned as `address.address_id` (migrations/0054_flood_nearest_m.sql:48).
- Rendered by: HostedAtAGlance.tsx (used as React `key` only); HostedQuickReport.tsx:38 (effect dep). Not rendered as user-visible text.
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: All NZ addresses (LINZ national coverage). See WIRING-TRACES § City-coverage-matrix → "linz_addresses" row (national).
- Common misreading: Treating it as a public/legal property identifier; it is an internal DB id, not a LINZ Address ID, not a Valuation Roll number, not a Title number.
- What it does NOT tell you: Nothing about the property; it is a join key.
- source_key status: N/A (internal id, never surfaced).
- User-care severity: Background, internal join key with no user-facing meaning.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: internal key, never rendered) | (out of scope: internal key, never rendered) | (out of scope: internal key, never rendered) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: used only as React key) | (out of scope: used only as React key) | (out of scope: used only as React key) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: used only as React key) | (out of scope: used only as React key) | (out of scope: used only as React key) |
| Hosted Full, narrative + tech (≤2 sentences) | (no rule) | (no rule) | (no rule) |

---

### address.full_address (`address.full_address`)
- What it measures: Full postal address string as held by LINZ (e.g. "12A Aro Street, Aro Valley, Wellington").
- Source authority: LINZ NZ Street Address.
- Dataset / endpoint: LINZ Data Service layer 105689.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_addresses"` returns 0 hits). The `addresses` table is populated by LINZ bulk import out-of-band from the data_loader pipeline.
- Table(s): `addresses`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:49.
- Rendered by: HostedQuickReport.tsx:99 (header), :128 (h1), :295 (footer); HostedAtAGlance.tsx (full report header). Snapshot meta: `snapshot.meta.full_address`.
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: National (LINZ).
- Common misreading: Assuming the LINZ address matches the postal/Council Valuation address character-for-character; they often differ for unit/flat addresses, which is why `_fix_unit_cv()` exists.
- What it does NOT tell you: Whether the title, building outline, or CV at this address have been correctly matched.
- source_key status: N/A (descriptor, not a finding).
- User-care severity: Context, the address itself is the report subject; users care it is correct, not graded.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: header text, not a labelled indicator) | (out of scope: header text, not a labelled indicator) | (out of scope: header text, not a labelled indicator) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | Address | Address | Address (LINZ) |
| Hosted Quick, narrative (1 sentence) | {full_address}. | {full_address}. | {full_address} (LINZ layer 105689). |
| Hosted Full, label (≤60 chars) | Address | Address | Address (LINZ) |
| Hosted Full, narrative + tech (≤2 sentences) | {full_address}. | {full_address}. | {full_address}. Source: LINZ NZ Street Address (layer 105689). |

---

### address.suburb (`address.suburb`)
- What it measures: LINZ suburb_locality string for the address.
- Source authority: LINZ NZ Street Address.
- Dataset / endpoint: LINZ Data Service layer 105689 (`suburb_locality` field).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_addresses"` returns 0 hits). The `addresses` table is populated by LINZ bulk import out-of-band from the data_loader pipeline.
- Table(s): `addresses`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:50 (`addr.suburb_locality`).
- Rendered by: HostedAtAGlance.tsx (header line); used by suburb router for profile lookups.
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: National.
- Common misreading: Treating LINZ `suburb_locality` as identical to the real-estate-listing suburb; they sometimes differ (LINZ uses gazetted localities, listings use marketing names).
- What it does NOT tell you: SA2 or census boundary; use `sa2_code`/`sa2_name` for those.
- source_key status: N/A.
- User-care severity: Context, locality descriptor used for orientation, not a graded signal.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not surfaced on on-screen report) | (out of scope: not surfaced on on-screen report) | (out of scope: not surfaced on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | Suburb | Suburb | Suburb (LINZ locality) |
| Hosted Quick, narrative (1 sentence) | {suburb}. | {suburb}. | LINZ suburb_locality: {suburb}. |
| Hosted Full, label (≤60 chars) | Suburb | Suburb | Suburb (LINZ locality) |
| Hosted Full, narrative + tech (≤2 sentences) | {suburb}. | {suburb}. | LINZ suburb_locality: {suburb}. Listing names may differ from gazetted localities. |

---

### address.city (`address.city`)
- What it measures: LINZ town_city string for the address.
- Source authority: LINZ NZ Street Address.
- Dataset / endpoint: LINZ Data Service layer 105689 (`town_city` field).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_addresses"` returns 0 hits). The `addresses` table is populated by LINZ bulk import out-of-band from the data_loader pipeline.
- Table(s): `addresses`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:51.
- Rendered by: HostedAtAGlance.tsx (header line context).
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: National.
- Common misreading: Confusing LINZ `town_city` with the territorial authority (`ta_name`); they overlap in metropolitan areas but diverge in rural ones.
- What it does NOT tell you: Which council levies rates here; use `cv_council` or `ta_name`.
- source_key status: N/A.
- User-care severity: Context, locality descriptor distinct from the territorial authority.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | City | City | City (LINZ town_city) |
| Hosted Quick, narrative (1 sentence) | {city}. | {city}. | LINZ town_city: {city}. |
| Hosted Full, label (≤60 chars) | City | City | City (LINZ town_city) |
| Hosted Full, narrative + tech (≤2 sentences) | {city}. | {city}. | LINZ town_city: {city}; postal locality, not the territorial authority. |

---

### address.unit_type (`address.unit_type`)
- What it measures: LINZ unit_type code (e.g. "Unit", "Flat", "Apartment", or null); present when the address is part of a multi-unit development.
- Source authority: LINZ NZ Street Address.
- Dataset / endpoint: LINZ Data Service layer 105689 (`unit_type` field).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_addresses"` returns 0 hits). The `addresses` table is populated by LINZ bulk import out-of-band from the data_loader pipeline.
- Table(s): `addresses`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:52.
- Rendered by: HostedAtAGlance.tsx; informs `_fix_unit_cv()` matching in `routers/property.py`.
- Threshold / classification logic: Label/display field only. CV resolution uses the separate `addr.unit_value` column (migrations/0054_flood_nearest_m.sql:96-103), not `unit_type`; the two LINZ columns are distinct and must not be conflated.
- Score contribution: not scored.
- Coverage: National (sparse; only populated for unitised addresses).
- Common misreading: Assuming a missing `unit_type` means the property is not in a multi-unit building; use `multi_unit` flag instead.
- What it does NOT tell you: Whether the building is a body corporate, leasehold, or cross-lease; use `title_type`/`estate_description`.
- source_key status: N/A.
- User-care severity: Context, signals a unitised address used downstream by CV resolution.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not surfaced on on-screen report) | (out of scope: not surfaced on on-screen report) | (out of scope: not surfaced on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled into address line) | (out of scope: bundled into address line) | (out of scope: bundled into address line) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | Unit type | Unit type | Unit type (LINZ) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: visible from the listing) | (out of scope: visible from the listing) | LINZ unit_type: {unit_type}. Used by CV resolution to disambiguate per-unit records on shared parcels. |

---

### address.sa2_code (`address.sa2_code`)
- What it measures: Stats NZ Statistical Area 2 code (7-digit) containing the address.
- Source authority: Stats NZ.
- Dataset / endpoint: SA2 boundaries (loaded into `sa2_boundaries`).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="sa2_boundaries"` returns 0 hits). The `sa2_boundaries` table is populated by `scripts/update_sa2_boundaries_2023.sh` from a Stats NZ GeoPackage.
- Table(s): `sa2_boundaries`
- Query path: `get_property_report()` SELECT into `v_sa2_code` via `ST_Within(addr.geom, sa2_boundaries.geom)` (migrations/0054_flood_nearest_m.sql:38-41, returned :53).
- Rendered by: HostedDemographics.tsx (joins to demographics tables).
- Threshold / classification logic: Used as a join key everywhere; SA2 baseline comparisons across findings.
- Score contribution: not scored. (not scored itself; used to compute baselines that feed scoring).
- Coverage: National (Stats NZ).
- Common misreading: Confusing SA2 with suburb; SA2 is a census geography, not a marketing or council boundary.
- What it does NOT tell you: Anything about the address itself; only which census tile it sits in.
- source_key status: N/A.
- User-care severity: Background, census-tile join key used to compute SA2-relative baselines.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: technical join key) | (out of scope: technical join key) | (out of scope: technical join key) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not rendered) | (out of scope: not rendered) | (out of scope: not rendered) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: subsumed by SA2 name) | (out of scope: subsumed by SA2 name) | SA2 code |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: not rendered) | (out of scope: not rendered) | Stats NZ SA2 {sa2_code} ({sa2_name}) is the census tile used for neighbourhood comparisons in this report. |

---

### address.sa2_name (`address.sa2_name`)
- What it measures: Stats NZ SA2 name for the containing tile (e.g. "Aro Valley").
- Source authority: Stats NZ.
- Dataset / endpoint: `sa2_boundaries.sa2_name`.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="sa2_boundaries"` returns 0 hits). The `sa2_boundaries` table is populated by `scripts/update_sa2_boundaries_2023.sh` from a Stats NZ GeoPackage.
- Table(s): `sa2_boundaries`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:39, returned :54.
- Rendered by: HostedQuickReport.tsx:129 (subheader, `{sa2_name} · {ta_name}`); HostedDemographics.tsx.
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: National.
- Common misreading: Treating SA2 name as the suburb name; SA2 names sometimes match marketing-suburb names but often slice across multiple suburbs.
- What it does NOT tell you: Which territorial authority; use `ta_name`.
- source_key status: N/A.
- User-care severity: Context, the named census tile users see as their neighbourhood label.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | Neighbourhood | Neighbourhood | SA2 (Stats NZ) |
| Hosted Quick, narrative (1 sentence) | {sa2_name}. | {sa2_name}. | Census tile {sa2_name} ({sa2_code}); the comparator for this report. |
| Hosted Full, label (≤60 chars) | Neighbourhood | Neighbourhood | SA2 (Stats NZ census tile) |
| Hosted Full, narrative + tech (≤2 sentences) | {sa2_name}. | {sa2_name}, the census neighbourhood used for like-for-like comparisons. | Stats NZ SA2 {sa2_name} ({sa2_code}); baseline for SA2-relative findings throughout this report. |

---

### address.ta_name (`address.ta_name`)
- What it measures: Stats NZ territorial authority name (e.g. "Wellington City").
- Source authority: Stats NZ (via `sa2_boundaries.ta_name`).
- Dataset / endpoint: SA2 boundaries.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="sa2_boundaries"` returns 0 hits). The `sa2_boundaries` table is populated by `scripts/update_sa2_boundaries_2023.sh` from a Stats NZ GeoPackage.
- Table(s): `sa2_boundaries`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:39, returned :55.
- Rendered by: HostedAtAGlance.tsx; HostedQuickReport.tsx:129.
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: National.
- Common misreading: Confusing TA with regional council; e.g. Wellington City Council vs Greater Wellington Regional Council are distinct authorities with distinct hazard layers.
- What it does NOT tell you: Whether the rates module / hazard data for this council is loaded; see DATA-CATALOG § Live-rates-APIs and DATA-LAYERS.md.
- source_key status: N/A.
- User-care severity: Context, identifies the rating council, distinct from the regional council.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | Council | Council | Territorial authority |
| Hosted Quick, narrative (1 sentence) | {ta_name}. | {ta_name}. | Territorial authority: {ta_name} (Stats NZ). |
| Hosted Full, label (≤60 chars) | Council | Council | Territorial authority |
| Hosted Full, narrative + tech (≤2 sentences) | {ta_name}. | {ta_name}. | Territorial authority: {ta_name} (Stats NZ via sa2_boundaries). Regional-council hazard layers are a separate authority. |

---

### address.lng / address.lat (`address.lng` / `address.lat`)
- What it measures: WGS84 longitude and latitude of the LINZ address point, in degrees.
- Source authority: LINZ NZ Street Address.
- Dataset / endpoint: LINZ Data Service layer 105689 (`shape` geometry).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_addresses"` returns 0 hits). The `addresses` table is populated by LINZ bulk import out-of-band from the data_loader pipeline.
- Table(s): `addresses` (`geom` column).
- Query path: `get_property_report()` `ST_X(addr.geom)` / `ST_Y(addr.geom)` (migrations/0054_flood_nearest_m.sql:56-57).
- Rendered by: HostedAtAGlance.tsx (map pin); MapContainer.tsx (centring); used by all spatial overlays (transit, terrain).
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: National.
- Common misreading: Assuming the point is the building centroid; LINZ address points are placed at door/parcel-entry, not at the building outline centroid.
- What it does NOT tell you: Building footprint geometry; that is in `building_outlines`.
- source_key status: N/A.
- User-care severity: Background, drives the map pin and spatial joins; never read as text.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: drives map pin only) | (out of scope: drives map pin only) | (out of scope: drives map pin only) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: drives map pin only) | (out of scope: drives map pin only) | (out of scope: drives map pin only) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: drives map pin only) | (out of scope: drives map pin only) | Coordinates (WGS84) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: drives map pin only) | (out of scope: drives map pin only) | LINZ address point: {lat}, {lng} (WGS84). This is the door or parcel-entry, not the building centroid. |

---

### property.footprint_sqm (`property.footprint_sqm`)
- What it measures: Building outline footprint area in square metres, computed by `ST_Area(geom::geography)` and rounded to one decimal.
- Source authority: LINZ NZ Building Outlines.
- Dataset / endpoint: LINZ Data Service layer 101290.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_buildings"` returns 0 hits). The `building_outlines` table is populated by LINZ bulk import out-of-band. SOURCE_CATALOG has `linz_outlines` at report_html.py:670 (note: catalog uses "outlines", not "buildings").
- Table(s): `building_outlines`
- Query path: `get_property_report()` LATERAL join (migrations/0054_flood_nearest_m.sql:77-81), returned as `property.footprint_sqm` (also surfaced as `building_area_sqm` / `building_footprint_sqm` aliases downstream).
- Rendered by: MarketSection.tsx (used inside CV breakdown logic via `effectivePerUnitCv`); HostedAtAGlance.tsx (full report). Triggers a `large_footprint` recommendation in `report_html.py:2706-2708` when ≥300 m². Footprint value is read via `prop.get("building_footprint_sqm")` at report_html.py:2182; the SQL alias `footprint_sqm` is renamed to `building_footprint_sqm` somewhere between SQL and Python (likely in `routers/property.py`).
- Threshold / classification logic: Recommendation `large_footprint` fires when `footprint >= 300` m² (report_html.py:2706).
- Score contribution: not scored.
- Coverage: National (LINZ Building Outlines).
- Common misreading: Treating footprint as floor area; footprint is the ground-floor outline only; multi-storey buildings have larger floor areas. Use `floor_area_sqm` (rates_data) when you need GFA.
- What it does NOT tell you: Number of storeys, internal floor area, building age, or condition.
- source_key status: TODO; `linz_outlines` exists in SOURCE_CATALOG (report_html.py:670) but the `large_footprint` recommendation (report_html.py:2706-2708) does not currently set `source_key`.
- User-care severity: Context. Triggers a `large_footprint` recommendation at 300 m² or more.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: visible from the listing) | (out of scope: visible from the listing) | (out of scope: not on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: visible from the listing) | Building footprint | Building footprint (LINZ outline) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: visible from the listing) | Footprint {footprint_sqm} m² (ground outline, not floor area). | LINZ building outline: {footprint_sqm} m² (ST_Area, geography). Multi-storey floor area not implied. |

---

### property.building_use (`property.building_use`)
- What it measures: LINZ building outline `use` attribute (e.g. "Residential Building", "Commercial Building").
- Source authority: LINZ NZ Building Outlines.
- Dataset / endpoint: LINZ Data Service layer 101290 (`use` field).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_buildings"` returns 0 hits). The `building_outlines` table is populated by LINZ bulk import out-of-band. SOURCE_CATALOG has `linz_outlines` at report_html.py:670 (note: catalog uses "outlines", not "buildings").
- Table(s): `building_outlines`
- Query path: `get_property_report()` LATERAL join (migrations/0054_flood_nearest_m.sql:78), returned :64.
- Rendered by: HostedQuickReport.tsx:80 (`buildingUse = rawProp.building_use`); HostedQuickReport.tsx:81 derives the displayed `propertyType`; HostedAtAGlance.tsx render UNKNOWN (specific line not verified).
- Threshold / classification logic: At HostedQuickReport.tsx:81, `propertyType` prefers `title_type` first and falls back to `building_use` only when `title_type` is null/Unknown; NOT the other way around (verified verbatim: `(titleType && titleType !== 'Unknown' ? titleType : null) || (buildingUse && buildingUse !== 'Unknown' ? buildingUse : null)`).
- Score contribution: not scored.
- Coverage: National. Often "Unknown"; LINZ classifies a large minority of outlines as Unknown.
- Common misreading: Reading "Residential Building" as "consented for residential use"; LINZ classifies by observed use, not by zoning permission.
- What it does NOT tell you: Number of dwellings, age, condition, consent status. Use the District Plan zone (planning.zone_name) for permitted use.
- source_key status: TODO; not surfaced in any finding currently.
- User-care severity: Context, identifies what kind of building LINZ classifies it as; no finding rule.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | Property type | Property type | Building use (LINZ outline) |
| Hosted Quick, narrative (1 sentence) | {building_use}. | {building_use}. | LINZ building use: {building_use}. |
| Hosted Full, label (≤60 chars) | Property type | Property type | Building use (LINZ outline) |
| Hosted Full, narrative + tech (≤2 sentences) | {building_use}. | LINZ classifies it as {building_use}. | LINZ building outline `use` = {building_use} (layer 101290). Classified by observed use, not District Plan permission. |

---

### property.title_no (`property.title_no`)
- What it measures: LINZ Computer Register title number (e.g. "WN12A/345") for the parcel containing the address point.
- Source authority: LINZ Property Titles.
- Dataset / endpoint: LINZ Data Service layer 50804 (`title_no` field).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_titles"` returns 0 hits). The `property_titles` table is populated by LINZ bulk import out-of-band. SOURCE_CATALOG has `linz_titles` at report_html.py:669.
- Table(s): `property_titles`
- Query path: `get_property_report()` LATERAL join (migrations/0054_flood_nearest_m.sql:82-86).
- Rendered by: HostedAtAGlance.tsx (full report).
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: National.
- Common misreading: Confusing title number with valuation roll number; they are different identifiers issued by different bodies.
- What it does NOT tell you: Tenure (freehold/leasehold/cross-lease); that is in `title_type` / `estate_description`.
- source_key status: TODO; `linz_titles` exists in SOURCE_CATALOG but is not currently attached to any Insight using this field.
- User-care severity: Background, the legal title number is a reference identifier, not a user-facing decision factor.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: legal identifier, not consumer-facing on on-screen) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: bundled into Title block) | Title reference | Title reference (LINZ) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: bundled into Title block) | The legal title for this parcel is {title_no}. | LINZ Computer Register title: {title_no} (layer 50804). |

---

### property.estate_description (`property.estate_description`)
- What it measures: LINZ free-text description of the legal estate (e.g. "Fee Simple, 1/4 share", "Leasehold, Term 999 years from 1908", "Cross Lease, 1/3 share").
- Source authority: LINZ Property Titles.
- Dataset / endpoint: LINZ Data Service layer 50804 (`estate_description` field).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_titles"` returns 0 hits). The `property_titles` table is populated by LINZ bulk import out-of-band. SOURCE_CATALOG has `linz_titles` at report_html.py:669.
- Table(s): `property_titles`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:66.
- Rendered by: HostedAtAGlance.tsx (full report). Drives leasehold / cross-lease detection in `report_html.py:729-747`: substring match on `estate_description` (line 728) and `title_type` (line 727); leasehold Insight at :735, cross-lease Insight at :742.
- Threshold / classification logic: Substring match on lowercased text for "leasehold", "cross lease", "cross-lease" (report_html.py:729-733).
- Score contribution: not scored.
- Coverage: National.
- Common misreading: Treating "1/4 share" as a partial-ownership warning; for fee simple it just means a shared driveway/access lot; the share is in a common easement, not in the dwelling.
- What it does NOT tell you: Ground-rent amount, lessor identity, next review date, or body-corp levy.
- source_key status: TODO; leasehold Insight (report_html.py:735-740) and cross-lease Insight (report_html.py:742-747) do not currently set `source=_src("linz_titles")`. `linz_titles` exists in SOURCE_CATALOG at report_html.py:669.
- User-care severity: Critical, leasehold and cross-lease materially change what is owned, lender appetite, and ground-rent risk.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: tenure shown via title_type) | Tenure | Estate description (LINZ) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | Leasehold title: you would own the building but not the land, and ground rent reviews can step up sharply. Read the lease before signing. | LINZ estate_description flags this title as leasehold or cross-lease. Review lease terms (rent, review cycle, term remaining) before going unconditional. |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: tenure surfaced via title_type) | Estate | Estate description (LINZ) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: tenure surfaced via title_type) | Estate: {estate_description}. | LINZ estate_description: "{estate_description}" (layer 50804). Used to detect leasehold and cross-lease tenure. |

---

### property.title_type (`property.title_type`)
- What it measures: LINZ Computer Register `type` field; short categorical (e.g. "Freehold", "Leasehold", "Cross Lease", "Unit Title", "Composite").
- Source authority: LINZ Property Titles.
- Dataset / endpoint: LINZ Data Service layer 50804 (`type` field).
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="linz_titles"` returns 0 hits). The `property_titles` table is populated by LINZ bulk import out-of-band. SOURCE_CATALOG has `linz_titles` at report_html.py:669.
- Table(s): `property_titles`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:67 (aliased from `pt.type`).
- Rendered by: HostedQuickReport.tsx:79-81 (header `propertyType`); HostedAtAGlance.tsx (full). Drives the same leasehold / cross-lease Insight as `estate_description` (report_html.py:727, rule at :729-733, Insights at :735 and :742).
- Threshold / classification logic: Substring match on lowercased value for "leasehold" or "cross lease" / "cross-lease".
- Score contribution: not scored.
- Coverage: National.
- Common misreading: Reading "Unit Title" as "shared ownership of the building"; Unit Title means you own a defined unit and share a body corporate; it is not the same as cross-lease.
- What it does NOT tell you: Body-corporate financial health, ground rent, or pre-1991 unit title status.
- source_key status: TODO; same Insight as estate_description, no `source_key` attached yet.
- User-care severity: Critical, tenure category drives the leasehold and cross-lease findings and lender treatment.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on on-screen report) | Tenure | Title type (LINZ) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | Leasehold title: you own the building but not the land, and ground rent can step up sharply. Read the lease before signing. | LINZ title type "{title_type}". Leasehold and cross-lease tenure carry lender, insurance and consent implications; check lease terms and any flats plan. |
| Hosted Quick, label (≤60 chars) | Tenure | Tenure | Title type |
| Hosted Quick, narrative (1 sentence) | This is a {title_type}. | Tenure: {title_type}. | LINZ title type: {title_type}. |
| Hosted Full, label (≤60 chars) | Tenure | Tenure | Title type (LINZ) |
| Hosted Full, narrative + tech (≤2 sentences) | This is a {title_type}. | Tenure: {title_type}. Cross-lease and leasehold change what you own and how easy it is to alter the dwelling. | LINZ Computer Register `type`: {title_type} (layer 50804). Drives leasehold and cross-lease findings via substring match in report_html.py. |

---

### property.capital_value (`property.capital_value`)
- What it measures: Council rating Capital Value (CV); total valuation set by the council valuer for rating purposes, in NZD.
- Source authority: Territorial authority (council); 25 individual rates APIs plus bulk rolls.
- Dataset / endpoint: One of `services/{x}_rates.py` (e.g. `wcc_rates.py`, `aklc_rates.py`); also static `council_valuations` table from bulk loads.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="council_valuations"`, `key="wcc_valuations"`, `key="aklc_valuations"` all return 0 hits). The `council_valuations` table is populated per-council by 25 live rates clients in `backend/app/services/*_rates.py` (fetched lazily via `routers/rates.py` and on snapshot in `snapshot_generator.py`); some councils additionally have bulk loaders in `backend/scripts/load_*_rates.py`. SOURCE_CATALOG has `council_valuations` at report_html.py:674.
- Table(s): `council_valuations`
- Query path: `get_property_report()` LATERAL join with unit-aware ranking (migrations/0054_flood_nearest_m.sql:87-106). Live override via `GET /property/{id}/rates` (routers/rates.py).
- Rendered by: MarketSection.tsx:42 (with `effectivePerUnitCv`); HostedQuickReport.tsx:70; HostedPriceAdvisor.tsx; HostedAtAGlance.tsx; KeyFindings.tsx (via report_html.py:576 yield calc, :1136-1157 site-value Insight (anchor :1148), :1965 finding generation).
- Threshold / classification logic: Site-value Insight when `improvements/CV ≤ 0.15` AND `CV ≥ 600,000` (report_html.py:1148). Per-unit divider via `effectivePerUnitCv` for multi-units.
- Score contribution: not scored. (CV itself is not scored; it feeds rent_advisor, price_advisor and yield calculations).
- Coverage: 25 councils with live APIs (DATA-CATALOG § Live-rates-APIs). Coverage gaps in remote TAs.
- Common misreading: Treating CV as market value; CV is a rating valuation set every 3 years and lags the market. Use price advisor (HPI-adjusted) for an estimate of current value.
- What it does NOT tell you: Sale history, current market price, or condition.
- source_key status: TODO; `council_valuations` IS in SOURCE_CATALOG (report_html.py:674; authority "Council rating valuations (live API)"), but the site-value Insight (report_html.py:1148-1157) does not yet attach `source=_src("council_valuations")`. Wiring is unblocked.
- User-care severity: Notable, CV anchors rates, the price advisor and the site-value finding; not a market price.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Capital value | Capital value (council) | Capital value (council rating valuation) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (out of scope: renter persona does not surface CV findings) | Improvements are only {improvements_pct}% of CV. This site is priced as land, so the next buyer is more likely a redeveloper than an owner-occupier. | Improvements/CV ratio {ratio}% (≤15% with CV ≥ $600k): land-led pricing per report_html.py:1141. |
| Hosted Quick, label (≤60 chars) | Capital value | Capital value | Capital value (council, rating) |
| Hosted Quick, narrative (1 sentence) | The council values the place at ${capital_value}. | Council CV: ${capital_value} (rating valuation, not market value). | Council CV: ${capital_value} (rating valuation, set {cv_date} by {cv_council}). |
| Hosted Full, label (≤60 chars) | Capital value | Capital value | Capital value (council rating valuation) |
| Hosted Full, narrative + tech (≤2 sentences) | The council values the place at ${capital_value}; that's their figure for working out rates, not a sale price. | Council CV is ${capital_value}, set for rating. Market value can sit well above or below this depending on the cycle. | CV ${capital_value} from {cv_council}, set {cv_date} (council_valuations + live {rates_module}). CV is a rating valuation revised every 3 years and is not a market value. |

---

### property.land_value (`property.land_value`)
- What it measures: Council Land Value (LV); the unimproved value of the section, in NZD. By definition `LV + improvements_value = CV`.
- Source authority: Territorial authority.
- Dataset / endpoint: 25 live rates APIs + `council_valuations` bulk.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="council_valuations"` returns 0 hits). The `council_valuations` table is populated per-council by 25 live rates clients in `backend/app/services/*_rates.py` (fetched lazily via `routers/rates.py` and on snapshot in `snapshot_generator.py`); some councils additionally have bulk loaders in `backend/scripts/load_*_rates.py`. SOURCE_CATALOG has `council_valuations` at report_html.py:674.
- Table(s): `council_valuations`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:69.
- Rendered by: MarketSection.tsx:69-72; HostedQuickReport.tsx; HostedPriceAdvisor.tsx (donut chart computed at report_html.py:4822).
- Threshold / classification logic: Used in `land_pct = round((land_value / cv) * 100)` for the donut split (report_html.py:4822-4823).
- Score contribution: not scored.
- Coverage: 25 councils (same as CV).
- Common misreading: Treating LV as the price the section would fetch on the market; LV is the council valuer's rating estimate of unimproved land, not a market sale price.
- What it does NOT tell you: Improvements value (use `improvements_value`); zoning intensification potential (use `planning.zone_name`).
- source_key status: TODO; `council_valuations` is in SOURCE_CATALOG (report_html.py:674). No current Insight uses `land_value`, so no source_key is required today; when one is added it can attach `source=_src("council_valuations")`.
- User-care severity: Context, descriptor of the CV split; not graded on its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: renter does not see CV/LV split) | Land value | Land value (LV, council rating) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: bundled into capital_value display) | Land value | Land value (LV) |
| Hosted Quick, narrative (1 sentence) | (out of scope: bundled into capital_value display) | The land is rated at ${land_value}. | Council LV: ${land_value}. |
| Hosted Full, label (≤60 chars) | Land value | Land value | Land value (council rating) |
| Hosted Full, narrative + tech (≤2 sentences) | The section by itself is rated at ${land_value}. | Council values the section (without buildings) at ${land_value}, which is {land_pct}% of total CV. | Council LV ${land_value} ({land_pct}% of CV), {cv_council} {cv_date}. Rating estimate of unimproved value, not a market sale price. |

---

### property.improvements_value (`property.improvements_value`)
- What it measures: Council Improvements Value (IV); the rating valuer's estimate of the value of buildings/improvements on the section, in NZD. `LV + IV = CV`.
- Source authority: Territorial authority.
- Dataset / endpoint: 25 live rates APIs + `council_valuations`.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="council_valuations"` returns 0 hits). The `council_valuations` table is populated per-council by 25 live rates clients in `backend/app/services/*_rates.py` (fetched lazily via `routers/rates.py` and on snapshot in `snapshot_generator.py`); some councils additionally have bulk loaders in `backend/scripts/load_*_rates.py`. SOURCE_CATALOG has `council_valuations` at report_html.py:674.
- Table(s): `council_valuations`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:70 (aliased to `improvements_value` and downstream `improvement_value`).
- Rendered by: MarketSection.tsx:75; HostedPriceAdvisor.tsx donut split. Drives the site-value Insight (report_html.py:1136-1157, anchor :1148) and the maintenance budget line for the `large_footprint` recommendation (report_html.py:2388 comment area).
- Threshold / classification logic: Site-value Insight fires when `improvements/CV ≤ 0.15` AND `CV ≥ 600,000` (report_html.py:1148).
- Score contribution: not scored.
- Coverage: Many council rolls store CV and LV but leave IV null. The exact share is not measured systematically in-repo; the previous "~33%" figure was unsupported and has been removed.
- Common misreading: Reading IV as a rebuild cost; it is a rating estimate, not an insurance replacement value. Use a builder's quote or insurer's cost-builder for rebuild.
- What it does NOT tell you: Building age, condition, code compliance, or rebuild cost.
- source_key status: TODO; `council_valuations` is in SOURCE_CATALOG (report_html.py:674). Site-value Insight (report_html.py:1150-1157) does not yet set `source=_src("council_valuations")`. Wiring is unblocked.
- User-care severity: Notable. Drives the site-value finding and the maintenance-budget guideline.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on renter on-screen) | Improvements value | Improvements value (IV) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (out of scope: not on renter on-screen) | Improvements are only {improvements_pct}% of CV; this site is priced as land. | Improvements/CV ratio {ratio}% (≤15%, CV ≥ $600k): site-value signal per report_html.py:1141. |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: not surfaced for renter) | Improvements value | Improvements value (IV) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: not surfaced for renter) | Council values the buildings at ${improvements_value}; at 1-2% per year that is roughly ${maint_low} to ${maint_high} in annual maintenance. | Council IV ${improvements_value} ({cv_council}, {cv_date}). IV is often null. Rating estimate, not an insurance rebuild cost. |

---

### property.cv_land_area (`property.cv_land_area` → `land_area_sqm`)
- What it measures: Land area in square metres as recorded by the council valuer for the rating parcel.
- Source authority: Territorial authority.
- Dataset / endpoint: 25 live rates APIs + `council_valuations.land_area`.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="council_valuations"` returns 0 hits). The `council_valuations` table is populated per-council by 25 live rates clients in `backend/app/services/*_rates.py` (fetched lazily via `routers/rates.py` and on snapshot in `snapshot_generator.py`); some councils additionally have bulk loaders in `backend/scripts/load_*_rates.py`. SOURCE_CATALOG has `council_valuations` at report_html.py:674.
- Table(s): `council_valuations`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:71 (`cv.land_area AS cv_land_area`).
- Rendered by: MarketSection.tsx (used in CV-per-square-metre calc); HostedAtAGlance.tsx (full); HostedRecommendations.tsx via report_html.py:4141-4147 ($/m² figure).
- Threshold / classification logic: Used in `cv_per_sqm = int(int(cv) / float(land_area))` (report_html.py:4145).
- Score contribution: not scored.
- Coverage: 25 councils.
- Common misreading: Treating council land area as the LINZ title area; they sometimes differ by a few m² because of survey-vs-rating reconciliation, and for cross-lease properties the council rating area can be the share area, not the whole parcel.
- What it does NOT tell you: LINZ title area (use `property_titles.parcel_area_sqm` if needed); building footprint (use `footprint_sqm`).
- source_key status: TODO; no SOURCE_CATALOG entry for council valuation rolls.
- User-care severity: Context, section size in m² as recorded by the council valuer; no finding rule.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on on-screen report) | Land area (council) | Council land area (m²) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | Section size | Section size | Land area (council valuer) |
| Hosted Full, narrative + tech (≤2 sentences) | The section is about {land_area_sqm} m². | Council records {land_area_sqm} m² of land; at ${capital_value} CV that is roughly ${cv_per_sqm}/m². | Council valuer land area: {land_area_sqm} m² ({cv_council}); LINZ title area can differ slightly, particularly on cross-lease parcels. |

---

### property.cv_date (`property.cv_date`)
- What it measures: Date the council valuation was set (typically the most recent 3-yearly revaluation effective date, ISO date).
- Source authority: Territorial authority.
- Dataset / endpoint: 25 live rates APIs + `council_valuations.valuation_date`.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="council_valuations"` returns 0 hits). The `council_valuations` table is populated per-council by 25 live rates clients in `backend/app/services/*_rates.py` (fetched lazily via `routers/rates.py` and on snapshot in `snapshot_generator.py`); some councils additionally have bulk loaders in `backend/scripts/load_*_rates.py`. SOURCE_CATALOG has `council_valuations` at report_html.py:674.
- Table(s): `council_valuations`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:72.
- Rendered by: MarketSection.tsx (vintage caption); HostedPriceAdvisor.tsx. Drives `leaky_era` recommendation (report_html.py:2696-2704); fires when the year falls 1994-2004.
- Threshold / classification logic: `leaky_era` recommendation when `1994 <= year(cv_date) <= 2004` (report_html.py:2700-2702). The code falls back through `cv_date` → `building_age` → `valuation_date` (line 2696). Note: this uses cv_date as a proxy for build era when no explicit build year is available.
- Score contribution: not scored.
- Coverage: 25 councils.
- Common misreading: Treating `cv_date` as the build year; it is the valuation effective date, only used as a build-era proxy via `leaky_era` heuristic.
- What it does NOT tell you: Build year, last sale date, or last consent date.
- source_key status: TODO; `leaky_era` recommendation (report_html.py:2701-2702) is generated by `_make("leaky_era")` and the SOURCE_CATALOG attribution path for recommendations is separate from Insights; no source_key is currently attached to this rec.
- User-care severity: Notable, used as a build-era proxy for the leaky-building era (1994 to 2004) recommendation that has real remediation costs.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on on-screen report) | CV date | Valuation date (council) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | CV date | CV effective date | Valuation date (council) |
| Hosted Full, narrative + tech (≤2 sentences) | The council valuation is from {cv_date}. | The current CV was set {cv_date}; councils revalue every three years, so today's market may have moved. | Council valuation effective date: {cv_date} ({cv_council}). Used as a build-era proxy for the leaky_era heuristic (1994-2004). |

---

### property.cv_council (`property.cv_council`)
- What it measures: Name of the council that set the valuation (e.g. "Wellington City Council").
- Source authority: Territorial authority.
- Dataset / endpoint: `council_valuations.council` field, populated by 25 live rates loaders.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="council_valuations"` returns 0 hits). The `council_valuations` table is populated per-council by 25 live rates clients in `backend/app/services/*_rates.py` (fetched lazily via `routers/rates.py` and on snapshot in `snapshot_generator.py`); some councils additionally have bulk loaders in `backend/scripts/load_*_rates.py`. SOURCE_CATALOG has `council_valuations` at report_html.py:674.
- Table(s): `council_valuations`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:73.
- Rendered by: HostedPriceAdvisor.tsx (vintage caption).
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: 25 councils.
- Common misreading: Confusing rating council with the regional council that owns hazard maps; `cv_council` is the TA, not the regional council.
- What it does NOT tell you: Whether the live rates API for this council is currently healthy.
- source_key status: TODO; no SOURCE_CATALOG entry.
- User-care severity: Background, names the rating council; provenance metadata.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | Rated by | Rated by | Rating authority |
| Hosted Full, narrative + tech (≤2 sentences) | The valuation comes from {cv_council}. | This valuation was set by {cv_council} on {cv_date}. | Rating authority: {cv_council} (council_valuations.council). Distinct from the regional council that owns hazard layers. |

---

### property.multi_unit (`property.multi_unit` → `is_multi_unit`, `unit_count`)
- What it measures: Boolean flag; true when more than 4 LINZ addresses share a 5-metre radius around this point. Surfaced downstream as `is_multi_unit` and a count in `unit_count`.
- Source authority: LINZ NZ Street Address (derived).
- Dataset / endpoint: Computed in-SQL from the `addresses` table.
- Loader registration key: not applicable; derived in-SQL from the `addresses` table inside `get_property_report()`. The underlying `addresses` table is not loaded via a `DataSource(...)` entry (LINZ bulk import out-of-band).
- Table(s): `addresses` (count of neighbours).
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:74, derived from LATERAL count of addresses within 5 m / ~0.0001° box (`mu.addr_count > 4`).
- Rendered by: MarketSection.tsx (drives `effectivePerUnitCv`); HostedAtAGlance.tsx (full). Drives findings in report_html.py at :1694 (multi-unit noise mitigation; reads `prop.get("unit_count")`), :2691-2694 (`multi_unit_body_corp` rec), :2758 (multi-unit gating). Note: report_html.py reads `unit_count` (an integer), not the boolean `multi_unit`; `unit_count` is NOT in the migration's `jsonb_build_object` (lines 62-75) and must be hydrated by Python in `routers/property.py` from the same `addr_count` LATERAL.
- Threshold / classification logic: `multi_unit` boolean fires when `addr_count > 4` within ~5 m (migration 0054_flood_nearest_m.sql:108-112). `multi_unit_body_corp` recommendation fires when `unit_count > 1` (report_html.py:2691-2694).
- Score contribution: not scored.
- Coverage: National (any LINZ-addressed multi-unit site).
- Common misreading: Treating the flag as a body-corporate confirmation; the SQL is a proximity heuristic, not a title-tenure check. A duplex with two LINZ addresses can sit under a fee-simple cross-lease without a body corp.
- What it does NOT tell you: Body corporate name, levy, financial health, or the exact unit count of the legal scheme.
- source_key status: TODO; `multi_unit_body_corp` recommendation (report_html.py:2693-2694) does not currently set `source_key`. Underlying derivation is from the `addresses` table (LINZ NZ Street Address); no `linz_addresses` key exists in SOURCE_CATALOG yet; would need to be added before attribution can be wired.
- User-care severity: Notable, multi-unit status drives the body-corp recommendation and the multi-unit gating in findings; cost and quality-of-life impact.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | Shared building | Multi-unit site | Multi-unit (LINZ proximity) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | This place sits in a shared building, so noise and parking depend on which unit you are in. | This is a multi-unit site: body-corporate levies, shared services and shared rules are likely. | LINZ proximity heuristic flags 5 or more dwellings within 5 m. Confirm the body-corporate scheme via title search. |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | Multi-unit | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (out of scope: not in Quick) | This address shares the section with other dwellings. | (out of scope: not in Quick) |
| Hosted Full, label (≤60 chars) | Shared building | Multi-unit site | Multi-unit (LINZ proximity heuristic) |
| Hosted Full, narrative + tech (≤2 sentences) | This place is one of {unit_count} dwellings sharing a section, so neighbours are very close. | This is a multi-unit site with about {unit_count} dwellings; expect body-corp levies, shared insurance and shared services. | Multi-unit flag set when 5 or more LINZ addresses lie within 5 m (migration 0054 lines 108-112); unit_count = {unit_count}. Confirm the legal scheme on the title; proximity is not the same as a body corporate. |

---

### property.cv_valuation_id (`property.cv_valuation_id`)
- What it measures: Council valuation roll record identifier (e.g. WCC `valuation_id`).
- Source authority: Territorial authority.
- Dataset / endpoint: 25 live rates APIs + `council_valuations.valuation_id`.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="council_valuations"` returns 0 hits). The `council_valuations` table is populated per-council by 25 live rates clients in `backend/app/services/*_rates.py` (fetched lazily via `routers/rates.py` and on snapshot in `snapshot_generator.py`); some councils additionally have bulk loaders in `backend/scripts/load_*_rates.py`. SOURCE_CATALOG has `council_valuations` at report_html.py:674.
- Table(s): `council_valuations`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:91 (selected as `cv_valuation_id`; not currently included in the returned `property` jsonb_build_object; see definition lines 60-75).
- Rendered by: MarketSection.tsx:95 (passed to `HostedPriceAdvisor` via `currentValuationId` prop). Used by the unit-CV correction UI (`_fix_unit_cv()`).
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: 25 councils.
- Common misreading: Treating it as a stable national identifier; it is council-scoped and changes after council revaluations.
- What it does NOT tell you: UNKNOWN; the field is selected in the LATERAL join (line 91) but is not present in the `property` jsonb_build_object (lines 62-75); how it reaches the snapshot is via a separate code path in `routers/property.py`/`snapshot_generator.py`. The exact upstream hand-off is not verified from this SQL alone.
- source_key status: TODO.
- User-care severity: Background, council-scoped key used by the unit-CV correction UI; not consumer-facing.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not consumer-facing) | (out of scope: not consumer-facing) | (out of scope: dev/audit only) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: passed as a prop, not displayed) | (out of scope: passed as a prop, not displayed) | Valuation ID (council) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: passed as a prop, not displayed) | (out of scope: passed as a prop, not displayed) | Council valuation id: {cv_valuation_id} ({cv_council}). Council-scoped key; not stable across revaluations. |

---

### property.cv_address (`property.cv_address`)
- What it measures: Full address string as recorded in the council valuation roll (may differ from the LINZ address; see `_fix_unit_cv()`).
- Source authority: Territorial authority.
- Dataset / endpoint: `council_valuations.full_address`.
- Loader registration key: not applicable; no `DataSource(...)` registration in `data_loader.py` (greppable: `key="council_valuations"` returns 0 hits). The `council_valuations` table is populated per-council by 25 live rates clients in `backend/app/services/*_rates.py` (fetched lazily via `routers/rates.py` and on snapshot in `snapshot_generator.py`); some councils additionally have bulk loaders in `backend/scripts/load_*_rates.py`. SOURCE_CATALOG has `council_valuations` at report_html.py:674.
- Table(s): `council_valuations`
- Query path: `get_property_report()` migrations/0054_flood_nearest_m.sql:91 (`full_address AS cv_address`).
- Rendered by: MarketSection.tsx:97 (passed to `HostedPriceAdvisor`); HostedPriceAdvisor.tsx (full).
- Threshold / classification logic: Used by `_fix_unit_cv()` to validate that the matched CV record is for the right unit on multi-unit sites (regex match in 0054_flood_nearest_m.sql:97).
- Score contribution: not scored.
- Coverage: 25 councils.
- Common misreading: Treating an address mismatch (e.g. "Flat 2/15 X St" vs "15B X St") as a data error; the two are usually the same dwelling under different addressing conventions.
- What it does NOT tell you: Whether the LINZ-vs-council match was correct on this run; that is logged by `_fix_unit_cv()`.
- source_key status: TODO.
- User-care severity: Background, internal CV-record address used to verify the LINZ-to-council match.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) | (out of scope: not on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: shown only when it differs) | CV record address | Council CV address (raw) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: shown only when it differs) | The council's record shows this as "{cv_address}", which can read differently to the postal address. | Council valuation full_address: "{cv_address}"; LINZ vs council addressing is reconciled by _fix_unit_cv() on multi-unit sites. |

---

### property.floor_area_sqm (`property.floor_area_sqm`)
- What it measures: Gross floor area in square metres (per-unit), supplied by the live council rates feed.
- Source authority: Territorial authority (live rates API).
- Dataset / endpoint: One of `services/{x}_rates.py` (per-unit overlay).
- Loader registration key: not applicable; no `DataSource(...)` registration. Surfaced only where the live council rates client (`backend/app/services/*_rates.py`) exposes a floor-area field; persisted to `council_valuations` via the live overlay in `routers/rates.py` / `snapshot_generator.py`.
- Table(s): `council_valuations` (where the live overlay persists).
- Query path: Not in `get_property_report()` SQL; populated by `routers/rates.py` / `snapshot_generator.py` rates_data overlay (see inventory row 231: "rates_data overlay (per-unit)").
- Rendered by: `lib/compareSections.ts`:529 (compare table row); not displayed in standard hosted-full sections.
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: Subset of the 25 live-rates councils; only those whose API exposes a floor-area field. Specific list: UNKNOWN; would need a per-module audit of `services/*_rates.py`.
- Common misreading: Confusing council floor area with LINZ building outline footprint; floor area sums all storeys; footprint is the ground outline.
- What it does NOT tell you: Bedroom/bathroom counts, build year, or condition.
- source_key status: TODO; no SOURCE_CATALOG entry; not used in any current finding.
- User-care severity: Context. Visible on most listings; surfaced here for comparison only.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: visible from the listing) | (out of scope: visible from the listing) | (out of scope: not on on-screen report) |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not in Quick) | (out of scope: not in Quick) | (out of scope: not in Quick) |
| Hosted Quick, narrative (1 sentence) | (no rule) | (no rule) | (no rule) |
| Hosted Full, label (≤60 chars) | (out of scope: visible from the listing) | (out of scope: visible from the listing) | Floor area (council, per-unit) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: visible from the listing) | (out of scope: visible from the listing) | Council per-unit floor area: {floor_area_sqm} m² (live rates overlay). Coverage limited to councils whose API exposes this field. |

---

### rates_data (annual rates) (`rates_data`)
- What it measures: Annual council rates levied on the property in NZD (current rating year).
- Source authority: Territorial authority (live API).
- Dataset / endpoint: One of 25 `services/{x}_rates.py` modules; aggregator `routers/rates.py` (`GET /property/{id}/rates`).
- Loader registration key: not applicable; no `DataSource(...)` registration (greppable: `key="wcc_valuations"`, `key="aklc_valuations"` etc. return 0 hits). Fetched live per request from one of 25 council rates clients in `backend/app/services/*_rates.py` (aggregator `routers/rates.py`); cached in `council_valuations` overlay row.
- Table(s): `council_valuations` (live overlay).
- Query path: Not in `get_property_report()` SQL. For on-screen, fetched lazily via `GET /property/{id}/rates`. For snapshot, called directly in `snapshot_generator.py:934`.
- Rendered by: HostedQuickReport.tsx:41; HostedPriceAdvisor.tsx; HostedRecommendations.tsx (full).
- Threshold / classification logic: not applicable.
- Score contribution: not scored.
- Coverage: 25 councils with live rates modules (DATA-CATALOG § Live-rates-APIs). Outside those, returns null.
- Common misreading: Treating the figure as annual cost-to-own; it excludes water rates (some councils), regional council rates (separate bill), insurance, body-corp levies and maintenance.
- What it does NOT tell you: Water rates, regional rates, body-corp levies, insurance; these are separate.
- source_key status: TODO; no SOURCE_CATALOG entry; not used in any current finding.
- User-care severity: Notable, annual rates are a recurring cost line in any buyer budget.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen, label (≤60 chars) | (out of scope: renters do not pay council rates directly) | Annual rates | Annual council rates |
| On-screen, finding (1 sentence; N/A if no finding rule exists) | (no rule) | (no rule) | (no rule) |
| Hosted Quick, label (≤60 chars) | (out of scope: not surfaced for renter persona) | Annual rates | Annual rates ({cv_council}) |
| Hosted Quick, narrative (1 sentence) | (out of scope: not surfaced for renter persona) | Annual rates: ${rates_data} (council bill only; excludes water and regional rates). | Council rates (current year): ${rates_data} ({cv_council}, live API). |
| Hosted Full, label (≤60 chars) | (out of scope: not surfaced for renter persona) | Annual rates | Annual rates ({cv_council}) |
| Hosted Full, narrative + tech (≤2 sentences) | (out of scope: not surfaced for renter persona) | Council rates run about ${rates_data}/year. This is the council bill only; water and regional rates are billed separately. | Live council rates (current year): ${rates_data} from {cv_council} via services/{module}_rates.py. Excludes water rates, regional council rates, body-corp levies and insurance. |

---

## Local coverage audit

| Indicators | Critical | Notable | Context | Background |
|---|---|---|---|---|
| 25 | 2 (estate_description, title_type) | 5 (capital_value, improvements_value, cv_date, multi_unit, rates_data) | 11 (full_address, suburb, city, unit_type, sa2_name, ta_name, building_use, land_value, cv_land_area, footprint_sqm, floor_area_sqm) | 7 (address_id, sa2_code, lng/lat, title_no, cv_council, cv_valuation_id, cv_address) |

Earlier finding/source_key shape (kept for cross-reference):

| Indicators in category | With findings/recs | With source_key | Bundled-only / not displayed |
|---|---|---|---|
| 25 | 7 (estate_description, title_type, capital_value, improvements_value, cv_date, multi_unit, footprint_sqm) | 0 | 3 (address_id, lng/lat, cv_valuation_id) bundled-only / passed-as-prop |

Notes:
- "With findings/recs" counts indicators that drive at least one rule in `report_html.py` (Insight or recommendation), grep-confirmed:
  - `estate_description` + `title_type` → leasehold (`:735`) and cross-lease (`:742`) planning Insights via substring rules at `:729-733`.
  - `capital_value` + `improvements_value` → site-value market Insight at `:1148-1157`.
  - `cv_date` → `leaky_era` recommendation at `:2700-2702`.
  - `multi_unit` (via Python-hydrated `unit_count`) → `multi_unit_body_corp` recommendation at `:2691-2694`, plus multi-unit noise mitigation at `:1694` and gating at `:2758`.
  - `footprint_sqm` (read as `building_footprint_sqm` at `:2182`) → `large_footprint` recommendation at `:2706-2708`.
- "With source_key" is 0: every Property finding/recommendation listed above currently omits `source_key`. `linz_titles` (`:669`), `linz_outlines` (`:670`) and `council_valuations` (`:674`) all exist in `SOURCE_CATALOG`, so wiring is unblocked. The gap is now in the call sites (each Insight/recommendation needs a `source=_src(...)` kwarg added).

## Local gap list

Indicators with UNKNOWN entries or missing source_key:

| Indicator | Issue |
|---|---|
| address.address_id | source_key N/A (internal id). Fine. |
| address.full_address | source_key N/A (descriptor). Fine. |
| address.suburb | source_key N/A (descriptor). Fine. |
| address.city | source_key N/A (descriptor). Fine. |
| address.unit_type | source_key N/A (descriptor). Fine. |
| address.sa2_code/name | source_key N/A (descriptor). Fine. |
| address.ta_name | source_key N/A (descriptor). Fine. |
| address.lng/lat | source_key N/A. Fine. |
| property.footprint_sqm | source_key TODO. `large_footprint` recommendation (report_html.py:2706-2708) should attach `linz_outlines` (already in SOURCE_CATALOG at :670). |
| property.building_use | source_key TODO (no current finding, but if one is added it should attach `linz_outlines`). |
| property.title_no | source_key TODO (no current finding). |
| property.estate_description | source_key TODO. Leasehold Insight (report_html.py:735-740) and cross-lease Insight (:742-747) should set `source=_src("linz_titles")` (already in SOURCE_CATALOG at :669). |
| property.title_type | source_key TODO. Same Insights as estate_description. |
| property.capital_value | TODO. `council_valuations` is now in SOURCE_CATALOG (report_html.py:674). Site-value Insight (report_html.py:1148-1157) needs to attach `source=_src("council_valuations")`. |
| property.land_value | TODO. `council_valuations` in SOURCE_CATALOG (:674). No current Insight uses `land_value`; will attach the key when one is added. |
| property.improvements_value | TODO. `council_valuations` in SOURCE_CATALOG (:674). Site-value Insight (report_html.py:1148-1157) is the most user-visible site that needs attribution. |
| property.cv_land_area | TODO. `council_valuations` in SOURCE_CATALOG (:674). No current Insight; cv_per_sqm is a numeric derivation, not a finding. |
| property.cv_date | TODO. `leaky_era` recommendation (report_html.py:2701-2702) should attach a source once SOURCE_CATALOG covers council valuations. |
| property.cv_council | TODO. `council_valuations` in SOURCE_CATALOG (:674). |
| property.multi_unit | TODO. `multi_unit_body_corp` recommendation (report_html.py:2693-2694) should attach `linz_addresses` (derivation). `linz_addresses` does not currently exist as a key in SOURCE_CATALOG either; needs adding. |
| property.cv_valuation_id | UNKNOWN: how the field reaches the frontend is not visible from migration 0054 alone (selected in LATERAL at :91 but not in `jsonb_build_object` at :62-75). Needs a follow-up read of `routers/property.py` / `snapshot_generator.py` to confirm the path. source_key TODO (`council_valuations` available at SOURCE_CATALOG:674). |
| property.cv_address | TODO. `council_valuations` in SOURCE_CATALOG (:674). |
| property.floor_area_sqm | UNKNOWN: the list of councils whose live API actually exposes floor area is not enumerated anywhere; would need a per-module audit of `services/*_rates.py`. source_key TODO (`council_valuations` available at SOURCE_CATALOG:674). |
| rates_data | TODO. `council_valuations` in SOURCE_CATALOG (:674). |

Required SOURCE_CATALOG additions to close source_key gaps in this slice:
1. `council_valuations`: DONE (report_html.py:674, "Council rating valuations (live API)"). Unblocks attribution for capital_value, land_value, improvements_value, cv_land_area, cv_date, cv_council, cv_valuation_id, cv_address, rates_data, floor_area_sqm. Call sites still need `source=_src("council_valuations")` added.
2. `linz_addresses` entry: STILL MISSING. Unlocks attribution for the `multi_unit_body_corp` recommendation derivation.
3. Optionally, separate keys per live rates module for higher-fidelity attribution.

## Local conflict list

Same field labelled inconsistently across surfaces today:

| Field | Conflict (file:line) |
|---|---|
| `property.capital_value` | MarketSection.tsx:42 labels the on-screen pill as the "Capital Value (CV)" while HostedQuickReport.tsx:70 surfaces it through `effectivePerUnitCv` without a per-unit label, so the same field is shown as a whole-property number on Quick (header) and as a per-unit number in MarketSection on the on-screen report. Risk: users compare apples to oranges between the two surfaces. |
| `property.title_type` vs `property.estate_description` | report_html.py:727-733 evaluates both fields with overlapping substring rules (`"leasehold" in title_type or "leasehold" in estate_desc`); the two fields can disagree (LINZ `type` = "Freehold" with "Cross Lease" embedded in the estate description) and currently produce a single Insight (:735 or :742) without naming which field triggered it. |
| `property.footprint_sqm` aliasing | get_property_report() returns `property.footprint_sqm` (migration 0054:63) but downstream code reads `building_footprint_sqm` (report_html.py:2182, :2446). Inventory row 242 documents the rename. Risk: if the rename is dropped anywhere in the snapshot/router pipeline the `large_footprint` recommendation silently fails. |
| `property.improvements_value` aliasing | Returned as `improvements_value` (migration 0054:70); read as `improvements_value` at report_html.py:1141 (verified) and as `improvement_value` (singular) elsewhere per inventory row 249. Same null-drop risk. |
| `property.cv_land_area` aliasing | Returned as `cv_land_area` (migration 0054:71); read downstream as `land_area_sqm` (cv_per_sqm calc at report_html.py:4145 reads variable `land_area`, hydrated upstream from `land_area_sqm`). Inventory row 250 documents the rename. Two names for one field across the codebase. |
| `property.multi_unit` aliasing | Returned as `multi_unit` boolean (migration 0054:74); read downstream as `unit_count` integer (report_html.py:1694, :2691, :2758) which is **not in the SQL output**: `unit_count` must be hydrated by Python (`routers/property.py`). The migration alone does not produce the numeric count that report_html.py relies on; verify the Python side fills it. |
