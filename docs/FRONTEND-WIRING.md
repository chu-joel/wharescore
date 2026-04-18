# WhareScore Frontend Wiring Map

> Source of truth for what data is displayed where and how it gets there.
> Agents: search by component name, report field, or snapshot key. Update when adding/changing UI.
> Note: report endpoint strips premium detail (terrain, walking_reach, event_history, area_profile, property_detection) for unauthenticated users.

---

## Report Fields → Components
<!-- UPDATE: When adding a report field, add the row. When adding a component, add its fields. -->

### On-screen report (`/property/{id}`, component: `PropertyReport.tsx`)

**Report flow: Verdict → Evidence → Action → Upgrade → Deep Dive.** ScoreGauge and ScoreStrip removed from on-screen report (Snapshots provide the verdict). CategoryRadar removed (visual noise). IndicatorCards no longer show numeric score bars — plain-English descriptions only. Indicator grids hidden for renters (buyers still see them). Deleted orphaned components: HealthyHomesSummary, RentAffordabilitySnap, RentMarketPower, BuyerPropertyInsights (all superseded by Snapshot components).

| Report field path | Component | Section | Gated? |
|---|---|---|---|
| `address.full_address, .suburb, .city, .lat, .lng` | PropertySummaryCard | 0. Header — duplicate "suburb, city" subheading is suppressed when `full_address` already contains both (most LINZ addresses) | No |
| `property.capital_value, .land_value, .building_area_sqm, .title_ref` | PropertySummaryCard | 0. Header | No |
| `property.title_type, .estate_description` | KeyFindings via `generateFindings()` | 2. EVIDENCE — fires a **critical** leasehold finding or a **warning** cross-lease finding. Field comes from `property_titles` via `get_property_report()`. | First 2 free |
| `hazards.active_fault_nearest.{name,distance_m,slip_rate_mm_yr}` | KeyFindings via `generateFindings()` | 2. EVIDENCE — fires a **critical** fault-rupture finding when distance ≤200m **and** slip ≥1 mm/yr; **warning** when ≤2km. Only fires when `fault_zone_name` (Wellington council layer) is absent — national fallback. | First 2 free |
| `liveability.peak_trips_per_hour` | KeyFindings via `generateFindings()` | 2. EVIDENCE — qualifies the transit-stops positive finding. ≥5 stops **and** ≤3 peak trips/hour downgrades to **info** ("stops aren't services"). | First 2 free |
| `terrain.aspect_label, .slope_degrees` | KeyFindings via `generateFindings()` | 2. EVIDENCE — north/NE/NW on slope ≥3° = **positive**. South/SE/SW on slope ≥3° = **info** (heating/mould implication). | First 2 free |
| `property.cv_is_per_unit, property_detection.is_multi_unit, .unit_count` | PropertySummaryCard | 0. Header (per-unit CV via `effectivePerUnitCv` helper — ignores `cv_is_per_unit` when the value is >$5M on a multi-unit address; land/building area pills hidden for multi-unit). Same helper used by MonthlyCostEstimate, BuyerBudgetCalculator, InvestmentMetrics, HostedExecutiveSummary, QuestionSummary, ReportCTABanner — don't read `report.property.capital_value` directly in new components. | No |
| `terrain.elevation_m, .slope_degrees, .slope_category` | PropertySummaryCard | 0. Header (elevation pill + slope pill) | No |
| `market.rent_assessment.*, market.trend.*, market.market_heat, hazards.*, environment.wind_zone, terrain.aspect_label, terrain.is_depression` | RenterSnapshot | 1. VERDICT (renter only) — overall verdict + rent/market power/healthy homes/mould risk/sun sections | No |
| `hazards.*, planning.*, market.trend.*, terrain.elevation_m, property_detection.*` | BuyerSnapshot | 1. VERDICT (buyer only) — insurability, building era risk, renovation potential, climate/managed retreat, capital growth, title type. Verdict headlines ("Strong fundamentals", "Worth extra due diligence", etc.) deliberately avoid the word "risk" so they can't collide with the score-badge label. | No |
| `comparisons.suburb.*, comparisons.city.*, liveability.nzdep_score, .school_count, .transit_count, environment.noise_db, hazards.epb_count` | ComparisonBars | 1b. COMPARISON — property vs suburb vs city horizontal bar charts with contextual labels | No |
| All hazards + liveability + planning | KeyFindings | 2. EVIDENCE — key findings. Summary line must sum to `findings.length` — include `info` count alongside critical/warning/positive. BlurredFindingCards takes an explicit `totalCount` prop for the "See all N findings" CTA. | First 2 free |
| `hazards.*, environment.*, planning.epb_listed, terrain.*, address.city, address.ta` | LandlordChecklist | 3. ACTION (renter hero) — personalized "What to ask the landlord" with climate zone insulation R-values, heating kW, HH compliance, dampness, aspect, elevation, wind, noise, construction type | No |
| `hazards.*, planning.*, environment.*, coverage.*, property_detection.*` | BuyerDueDiligence | 3. ACTION (buyer hero) — "We've covered X of Y due diligence checks. Here's what you still need" with costs and property-specific notes | No |
| `market.rent_assessment.median, hazards.earthquake_count, hazards.active_fault_nearest` | KnowYourRights | 3. ACTION (inside renter checklist accordion) — bond max, rent increase rules, modification rights, fibre rights, HH compliance, quiet enjoyment, letting fee ban | No |
| `hazards.*` (all) | RiskHazardsSection | 5. DEEP DIVE accordion "Is it Safe?" — persona-aware: renters see critical alerts + summary count only; buyers see full detail incl. fault/landslide/climate/solar | No |
| `hazards.active_fault_nearest` | ActiveFaultDetailCard | 5. DEEP DIVE (buyers only) | No |
| `hazards.contamination_count` | ContaminatedLandCard | 5. DEEP DIVE | No |
| `hazards.landslide_nearest, .landslide_count_500m` | LandslideDetailCard | 5. DEEP DIVE (buyers only) | No |
| `environment.climate_temp_change, .climate_precip_change_pct` | ClimateForecastCard | 5. DEEP DIVE (buyers only) | No |
| `liveability.crime_rate, .crime_city_median` | CrimeCard | 5. DEEP DIVE — buyers: inside "neighbourhood" via NeighbourhoodSection. Renters: inside "safety" only (hidden from neighbourhood to avoid duplication). Humanized: "Safer than X% of areas" (no raw victimisation count). | No |
| `liveability.nzdep_score` | NeighbourhoodSection | 5. DEEP DIVE "neighbourhood" — CrimeCard hidden for renters (already in safety). Buyers see full indicator grid + CrimeCard. | No |
| `liveability.cbd_distance_m, .nearest_train_m` | TransportSection | 5. DEEP DIVE "daily life" — persona-aware: renters see distances/commute only; buyers also see indicator grid | No |
| `walking_reach.bus, .rail, .ferry` | TransportSection | 5. DEEP DIVE "daily life" | No |
| `liveability.transit_travel_times[]` | TransportSection | 5. DEEP DIVE "daily life" | Top 3 free, rest gated |
| `terrain.aspect_label` | SunAspectCard | 5. DEEP DIVE "daily life" (renter only) | No |
| `hazards.aircraft_noise_name, .aircraft_noise_dba, .aircraft_noise_category` | NoiseLevelGauge | 5. DEEP DIVE "daily life" — aircraft noise shown prominently alongside road noise | No |
| `property.capital_value, .land_value` | MarketSection | 5. DEEP DIVE "investment" (buyer only — CV card hidden for renters). PriceAdvisorCard removed from MarketSection; buyers get it in `true-cost` only to avoid duplication. | No |
| `market.market_heat, .trend.cagr_*` | MarketSection | 5. DEEP DIVE — HPI chart hidden for renters (not relevant to rental decisions) | No |
| `property_detection.detected_bedrooms, .is_multi_unit, .detected_type, property.building_area_sqm` | FlatmateFriendly | 5. DEEP DIVE "rent fair" (renter only) | No |
| `planning.zone_name, .zone_category, .height_limit, overlays` | PlanningSection | 5. DEEP DIVE "restrictions" (buyers). The "Category" row is hidden when `zone_category` equals `zone_name` or is the literal string "Zone" (WCC ArcGIS feed returns that for MRZ). EPB checklist row asks "This building on the EPB register? Yes — listed / No" instead of the old "Earthquake-prone building / Not listed" phrasing. | No |
| `coverage.available, .total, .per_category, .bonus_features` | DataLayersAccordion | 6. Below fold (compact mode) | No |
| (live API call) | AISummaryCard | 6. Below fold (after accordion) | No |

**Mobile input zoom rule:** any raw `<input type="text|number">` in on-screen report components must use `text-base md:text-sm` (or larger at mobile). Safari zooms on focus when the computed font-size is < 16px. PriceAdvisorCard, BuyerBudgetCalculator, RenterBudgetCalculator, BudgetSlider inline editors all follow this pattern. The shared `<Input>` primitive (`components/ui/input.tsx`) already bakes this in — prefer it over raw `<input>` where possible.

**Renter accordion sections:** `rent-fair`, `safety`, `daily-life`, `neighbourhood` (merges old `neighbourhood-improving` + `neighbourhood`), `renter-checklist` (hero, skipped from accordion). Default expanded: `rent-fair`, `daily-life`.

**Buyer accordion sections:** `deal-breakers`, `investment`, `true-cost`, `daily-life`, `neighbourhood`, `restrictions`, `buyer-checklist` (hero, skipped). Default expanded: `deal-breakers`, `true-cost`.

**Accordion trigger deduplication:** When preview chips are present, the text summary is hidden (they showed identical information). Chips use color-coded pills; text shown as fallback only when no chips exist.

### Hosted report (`/report/{token}`, component: `HostedReport.tsx`)

**Layout:** Two tabs — "Your Property" (default, Building2 icon) and "The Area" (MapPin icon). Pill-style tab bar (rounded, bg-muted/60, `min-h-[44px]` touch targets). Cover + score strip + orientation text + coverage badge above tabs. Methodology + disclaimer below tabs. Sidebar stays fixed across both (inputs use `text-base` to prevent iOS zoom). Tab navigation footer at bottom of each tab ("Continue to The Area" / "Back to Your Property"). URL hash sync (`#property` / `#area`). Print CSS shows both tabs with section headers ("Part 1: Your Property" / "Part 2: The Area") and page breaks. Header: Share button shows "Copied!" feedback + label on desktop; Print button (was "Save PDF"). Share/Print buttons are 44×44 min with `aria-label` so screen readers can identify them on mobile. Quick report (HostedQuickReport.tsx) has no tabs, same share/print buttons. Coverage badge shows `"{N} sources checked"` from `report.coverage.available` on BOTH tiers (Full + Quick). H1 address is visible at all breakpoints (no `hidden sm:block`). ReportSidebar takes an `instanceId` prop so the mobile inline copy and desktop floating copy don't share input IDs.

| Snapshot field | Component | Hosted-only? |
|---|---|---|
| `report.scores.categories` | HostedAtAGlance | Yes |
| `report.property, report.scores, meta` | HostedExecutiveSummary | Yes |
| `ai_insights` | HostedAISummary | Yes (on-screen fetches live) |
| `report.scores.categories` | CategoryRadar | Yes (hosted only — removed from on-screen report) |
| `report.*` (all) | KeyFindings (all, no gating) | No (shared, but ungated) |
| `hazard_advice, weather_history` | HostedAreaFeed | Yes. Top Events grid: 1 col mobile, 3 col sm+. Cards use overflow-hidden + break-words. |
| `rent_baselines` | HostedRentAdvisor | Yes (renter only) |
| `rent_history` | HostedRentHistory | Yes |
| `price_advisor, deltas` | HostedPriceAdvisor | Yes (buyer only) |
| `hpi_data` | HostedHPIChart | Yes (buyer persona only — renters don't see it) |
| `report.*` (questions) | QuestionContent (loop) | No (shared) |
| `nearby_highlights` | HostedNearbyHighlights | Yes |
| `school_zones` | HostedSchoolZones | Yes. Filtered to schools ≤5 km so private schools with country-wide enrolment zones (e.g. St Oran's 15 km, Hutt International 27 km) don't appear as "in-zone". |
| `report.liveability.schools` | HostedSchools | Yes. Shows **only out-of-zone nearby schools** (in-zone ones live in HostedSchoolZones above). Decile column dropped — deciles were retired 2023 and the column rendered as "–" for every row. |
| `road_noise` | HostedRoadNoise | Yes |
| `terrain`, `isochrone`, `terrain_insights` | HostedTerrain | Yes |
| `report.liveability` (crime, deprivation, transit modes, AM+PM travel times, peak_trips_per_hour, nearest_stop_name, crashes, amenities_500m) | HostedNeighbourhoodStats | Yes. Peak frequency shown with Excellent/Good/Limited badge. |
| `report.environment` (air, water, climate, contamination, corrosion) | HostedNeighbourhoodStats | Yes |
| `report.planning` (notable trees, parks, heritage, overlays, geotech, transmission_line_distance_m) | HostedNeighbourhoodStats | Yes. Transmission line warning if ≤500m. Heritage: context labels for 50+/10+ items. Cycle paths: quality labels (excellent ≥10km, good ≥3km). Amenities: shows fallback message when 0. |
| `report.comparisons` (suburb + city benchmarks) | HostedNeighbourhoodStats | Yes |
| `rates_data` (total_rates, rates_breakdown) | HostedNeighbourhoodStats | Yes (Full only). Annual rates card with breakdown. |
| `census_demographics, census_households, census_commute` | HostedDemographics (isFull=true) | Yes. Population, age, commute (free), income, tenure, ethnicity, internet (Full). |
| `climate_normals` | HostedClimate | Yes. Monthly temp range chart, seasonal table, highlight cards. |
| `nearby_doc` | HostedOutdoorRec | Yes |
| `report.planning` | HostedInfrastructure | Yes |
| `report.hazards` | HostedHealthyHomes | Yes (renter only). Rows marked "Not verified — ask at viewing" by default (not "No issues detected"), since the Healthy Homes standards can only be verified in person. Moisture/draught can still flag "Area hazard" when flood / liquefaction / coastal / wind zone data fires. Moved to after Rent Advisor (was after questions). |
| `report.hazards, terrain, environment` | MouldDampnessRisk | Yes (renter only, Full + Quick). After HealthyHomes in Full, after Rent Verdict in Quick. |
| `report.terrain.aspect_label` | SunAspectCard | Yes (renter only, Full). After MouldDampnessRisk. |
| `report.hazards, environment, planning, terrain, address` | LandlordChecklist | Yes (renter only, Full + Quick). In Full: standalone after questions (filtered from QuestionContent to avoid duplication), before hazard advice. In Quick: after rent verdict. |
| `report.market.rent_assessment, hazards.earthquake_count` | KnowYourRights | Yes (renter only, Full + Quick). Accepts a `userRent` prop — bond max is computed from the user's weekly rent first, falling back to area median only if the sidebar input is empty. Standalone after LandlordChecklist (filtered from QuestionContent to avoid duplication). |
| `hazard_advice` | HostedHazardAdvice | Yes |
| `recommendations` | HostedRecommendations | Yes |
| (persona template) | HostedNextSteps | Yes |
| (static) | HostedMethodology | Yes |
| `meta, rent_baselines, price_advisor, report.property` | ReportSidebar | Yes. Takes an `instanceId` prop (`"mobile"` / `"desktop"`) so the two responsive copies generate unique input IDs for `<label htmlFor>` bindings. Inline labels say "Your details" (was "Property details") to avoid colliding with the "Your Property" tab label. |

### Quick Report (`/report/{token}`, component: `HostedQuickReport.tsx`, tier=quick)

Rendered when `report_tier === 'quick'`. **Free with sign-in.** Single-column, no sidebar, 8 sections. Same snapshot data, curated lightweight view. Free on-screen=2 findings, Quick=3, Full=all. **Expires after 30 days** (`expires_at` on snapshot). Expiry warning shown in last 7 days (amber 4-7d, red ≤3d). Upgrading to Full clears `expires_at` (permanent).

<!-- UPDATE: When adding a Quick Report section, add a row here. -->
| Snapshot field | Component | Reused from Full? |
|---|---|---|
| `report.scores` | ScoreGauge + ScoreStrip | Yes (shared) |
| `ai_insights.bottom_line, key_takeaways` | (inline in HostedQuickReport) | Subset (3 takeaways) |
| `report.scores.categories` | HostedAtAGlance | Yes |
| `report` | KeyFindings (maxFree=3) | Yes (capped at 3, Full shows all) |
| `rent_baselines` / `price_advisor` | QuickVerdict | New (simplified) |
| `report.hazards, terrain, environment` | MouldDampnessRisk | Renter only — dampness risk with viewing tips |
| `report.hazards, environment, planning, terrain, address` | LandlordChecklist | Renter only — personalized landlord questions |
| `report.market.rent_assessment, hazards` | KnowYourRights | Renter only — tenant rights (bond max, rent rules, modifications) |
| `report.hazards` | QuickHazardSummary | New (traffic lights) |
| `school_zones` | HostedSchoolZones | Yes |
| `nearby_highlights` | HostedNearbyHighlights | Yes |
| `recommendations` | QuickActions | Shows all critical + important items first, then fills with advisory up to 5 total (was hard-capped at 3, which left renters with a lone "Contaminated Land" bullet on sparse properties). |
| — | QuickUpgradeBanner | POST /report/{token}/upgrade → uses credit if available (instant reload), else Stripe checkout |

---

## Snapshot Structure
<!-- UPDATE: When adding a key to generate_snapshot() return dict, add it here. -->

Generated by `snapshot_generator.py` `generate_snapshot()` (~line 1077). Stored in `report_snapshots.snapshot_json`.

| Key | Type | Source | Used by |
|-----|------|--------|---------|
| `report` | Full PropertyReport JSON | `get_property_report()` SQL + scores enrichment + transit overlay (Auckland/regional via `get_transit_data()`) + rates fix | All question sections, findings, scores |
| `rent_baselines` | Dict keyed by "House:3BD" etc | `compute_rent_baselines()` from bonds_detailed | HostedRentAdvisor, ReportSidebar |
| `price_advisor` | PriceAdvice object | `compute_price_snapshot()` from CV + HPI + yield | HostedPriceAdvisor, ReportSidebar |
| `deltas` | Adjustment tables | `build_delta_tables()` constants | Client-side recalculation in hostedReportStore |
| `recommendations` | Array of recs | `build_recommendations()` rule engine | HostedRecommendations |
| `insights` | Dict by category | `build_insights()` rule engine | HostedExecutiveSummary |
| `ai_insights` | String or null | `generate_pdf_insights()` Claude/OpenAI | HostedAISummary |
| `lifestyle_personas` | Array | `build_lifestyle_fit()[0]` | (not currently rendered) |
| `lifestyle_tips` | Array of strings | `build_lifestyle_fit()[1]` | (not currently rendered) |
| `rent_history` | Array {time_frame, median_rent, lq, uq, bonds} | bonds_detailed 10yr query | HostedRentHistory |
| `hpi_data` | Array {quarter_end, house_price_index, house_sales} | rbnz_housing table | HostedHPIChart |
| `crime_trend` | Array {month, count} | crime table 3yr | (embedded in neighbourhood) |
| `nearby_highlights` | {good: [], caution: [], info: []} | osm_amenities 1500m | HostedNearbyHighlights |
| `nearby_supermarkets` | Array {name, brand, distance_m} | osm_amenities 10km | (embedded in highlights) |
| `nearest_supermarkets` | Array {name, brand, distance_m, latitude, longitude} (top 5, NZ brand priority) | osm_amenities 5km, brand-first sort | HostedNeighbourhoodStats (Full only — stripped from Quick). Was missing from generate_snapshot until fixed — old snapshots won't have it. |
| `rates_data` | Council rates response | Live council API (25 councils) | ReportSidebar |
| `nearby_doc` | {huts: [], tracks: [], campsites: []} | doc_* tables 5km | HostedOutdoorRec |
| `school_zones` | Array {school_name, school_id, institution_type, distance_m, eqi, roll, suburb, city} | school_zones JOIN schools table | HostedSchoolZones (shows distance, EQI, roll) |
| `road_noise` | {laeq24h: number} | noise_contours table | HostedRoadNoise |
| `terrain` | {elevation_m, slope_degrees, aspect_label, aspect_degrees, is_depression, depression_depth_m, relative_position, wind_exposure, wind_exposure_score, flood_terrain_risk, flood_terrain_score, nearest_waterway_m, nearest_waterway_name, nearest_waterway_type, waterways_within_500m} | SRTM raster via `walking_isochrone.py` + `_classify_terrain_inferences()` + `nz_waterways` table | HostedTerrain |
| `isochrone` | {geojson, transit_within: {bus, rail, ferry}} | Valhalla walking isochrone + `count_transit_in_polygon()` | HostedTerrain |
| `terrain_insights` | Array {type, title, detail, severity} | `_build_terrain_insights()` rule engine | HostedTerrain |
| `weather_history` | Array of extreme weather events | weather_events 50km 5yr | HostedAreaFeed |
| `hazard_advice` | Array {hazard, severity, title, actions[], source} | `_build_hazard_advice()` | HostedHazardAdvice, HostedAreaFeed |
| `meta` | {schema_version, generated_at, address_id, full_address, persona, dwelling_type, inputs_at_purchase, sa2_name, ta_name} | Computed | Cover page, ReportSidebar |
| `census_demographics` | Object or null | `census_demographics` table via SA2 join, falls back to `v_census_by_boundary` concordance view for 2023→2018 SA2 code mapping. Population, age, ethnicity, birthplace, gender, languages. | HostedDemographics (Full only) |
| `census_households` | Object or null | `census_households` table via SA2 join, falls back to `v_census_households_by_boundary` concordance view. Income, tenure, crowding, vehicles, internet, rent, landlord. | HostedDemographics (Full only) |
| `census_commute` | Object or null | `census_commute` table via SA2 join, falls back to `v_census_commute_by_boundary` concordance view. Work at home, drive, bus, train, bike, walk counts. | HostedDemographics (Full only) |
| `business_demography` | Object or null | `business_demography` table via SA2 join. Employee count, business count, growth %. | HostedDemographics (both Quick + Full) |
| `community_facilities` | Object | `osm_amenities` + `fibre_coverage` (SRID fixed 2026-04-08, migration 0043) + `cycleways` spatial queries. Nearest hospital, EV charger, library/sports/playground/community centre/cycling counts, fibre availability + provider, cycleway km within 2km. | HostedNeighbourhoodStats |
| `climate_normals` | Array of 12 or null | `climate_normals` table via TA name join. Monthly temp/rain/sun/wind normals 1991-2020. | HostedClimate (Full only) |
| `report_tier` | `'quick'` or `'full'` | `report_snapshots.report_tier` (injected by API, not in JSONB) | Page routing, QuickUpgradeBanner |
| `expires_at` | ISO string or null | `report_snapshots.expires_at` (injected by API). Quick=30 days, Full=null (permanent). Cleared on upgrade. | Expiry warning in HostedQuickReport, account page |

---

## User Input Stores
<!-- UPDATE: When adding a new store or input field, document it here. -->

| Store | File | Key fields | Persisted | Sent to backend |
|-------|------|-----------|-----------|----------------|
| personaStore | `stores/personaStore.ts` | `persona: 'buyer'\|'renter'` | localStorage | Yes (persona param on export) |
| rentInputStore | `stores/rentInputStore.ts` | dwellingType, bedrooms, weeklyRent, finishTier, bathrooms, hasParking, isFurnished, hasOutdoorSpace, isCharacterProperty, sharedKitchen, utilitiesIncluded, notInsulated | No | Yes (rent_inputs in export + snapshot inputs_at_purchase) |
| buyerInputStore | `stores/buyerInputStore.ts` | askingPrice, bedrooms, finishTier, bathrooms, hasParking | No | Yes (buyer_inputs in export + snapshot inputs_at_purchase) |
| budgetStore | `stores/budgetStore.ts` | Buyer: purchasePrice, depositPct, interestRate, loanTerm, rates, insurance, utilities, maintenance, bodyCorpFee, annualIncome. Renter: weeklyRent, roomOnly, householdSize, utilities, contentsInsurance, transport, food, annualIncome | localStorage | Yes (budget_inputs in export) |
| hostedReportStore | `stores/hostedReportStore.ts` | bedrooms, bathrooms, finishTier, weeklyRent, askingPrice, hasParking, isFurnished etc. | No | No (client-side delta recalculation only) |
| downloadGateStore | `stores/downloadGateStore.ts` | isAuthenticated, credits {plan, creditsRemaining, quickCredits, fullCredits, dailyLimit, downloadsToday}, showUpgradeModal | No | No (reads from /account/credits) |
| pdfExportStore | `stores/pdfExportStore.ts` | isGenerating, downloadUrl, shareUrl, addressId, persona, error, _pendingToken | No | Yes (triggers export API). _doExport always fetches fresh JWT before API call to avoid stale tokens from confirm modal delay. 401 with credits → "session expired" toast, not plan selector. |
| mapStore | `stores/mapStore.ts` | selectedAddressId, mapStyle, layerVisibility, viewState | No | No (map UI state only) |
| searchStore | `stores/searchStore.ts` | query, results, isSearching, selectedResult | No | No (search UI state) |

---

## API Endpoints
<!-- UPDATE: When adding an endpoint, add a row here. -->

| Method | Path | Auth | Rate | Purpose | Key tables/services |
|--------|------|:----:|------|---------|-------------------|
| GET | `/property/{id}/report` | No | 20/min | Full property report. `?fast=true` skips Valhalla terrain (~5-15s) for progressive loading — frontend fetches fast first (deferred), then full in background | get_property_report() SQL, _overlay_transit_data() (AM+PM split, fixes nearest_train), _overlay_event_history(), _overlay_terrain_data() (skipped when fast=true) |
| GET | `/property/{id}/summary` | No | 60/min | Lightweight popup summary. Fast path: address+CV+rent query (~50ms). Pre-warms full report cache in background. | addresses, council_valuations, mv_rental_market, sa2_boundaries |
| GET | `/property/{id}/ai-summary` | No | 20/min | AI narrative (30s timeout) | generate_property_summary() |
| GET | `/property/{id}/rates` | No | 10/min | Live council rates for all 25 councils. Called lazily by frontend after report load; 404 = city has no integration. CV shown from DB first, updated inline when this resolves. City matched via `town_city` column (aliased as `city`). | 25 council APIs via `routers/rates.py` unified router |
| GET | `/property/{id}/area-feed` | No | 20/min | GeoNet + NEMA + MetService | External APIs |
| GET | `/property/{id}/crime-trend` | No | 30/min | Monthly crime 3yr | crime table |
| GET | `/property/{id}/earthquake-timeline` | No | 30/min | Annual quakes 10yr | earthquakes table |
| GET | `/property/{id}/rent-history` | No | 20/min | Rent trends | bonds_detailed |
| GET | `/property/{id}/market` | No | 20/min | Fair price analysis | bonds_*, council_valuations, rbnz_housing |
| POST | `/property/{id}/rent-advisor` | No | 20/min | Rent fairness | compute_rent_advice() |
| POST | `/property/{id}/price-advisor` | No | 20/min | Price fairness | compute_price_advice() |
| GET | `/nearby/{id}/highlights` | No | 40/min | Nearby amenities | osm_amenities |
| GET | `/nearby/{id}/schools` | No | 40/min | Schools + zones. `school_type` uses `org_type` column (Full Primary, Contributing, Secondary, etc.) | schools, school_zones |
| GET | `/nearby/{id}/transit` | No | 40/min | Transit stops | transit_stops |
| GET | `/nearby/{id}/crashes` | No | 40/min | Crashes 5yr | crashes |
| GET | `/nearby/{id}/heritage` | No | 40/min | Heritage sites | heritage_sites |
| GET | `/nearby/{id}/consents` | No | 40/min | Resource consents 2yr | resource_consents |
| GET | `/nearby/{id}/earthquakes` | No | 40/min | M4+ earthquakes 10yr 30km | earthquakes |
| GET | `/nearby/{id}/infrastructure` | No | 40/min | Infrastructure projects | infrastructure_projects |
| GET | `/nearby/{id}/buildings` | No | 40/min | Building outlines | building_outlines |
| GET | `/nearby/{id}/supermarkets` | No | 40/min | Supermarkets + grocers | osm_amenities |
| GET | `/nearby/{id}/amenities` | No | 40/min | Classified amenities (sentiment) | osm_amenities |
| GET | `/nearby/{id}/conservation` | No | 40/min | Conservation + eco + trees | conservation_land, significant_ecological_areas, notable_trees |
| POST | `/property/{id}/export/pdf/start?report_tier=quick\|full` | Yes | 20/hr | Start PDF gen (deducts credit matching requested tier) | _generate_pdf_background() |
| POST | `/property/{id}/export/pdf/guest-start` | Token | 20/hr | Guest PDF gen | guest_purchases |
| GET | `/property/{id}/export/pdf/status/{job}` | No | 120/min | Poll job status | pdf_jobs (Redis) |
| GET | `/property/{id}/export/pdf/download/{job}` | No | 20/min | Download HTML report | pdf_jobs (Redis) |
| GET | `/report/{token}` | No | 30/min | Hosted report snapshot (includes report_tier) | report_snapshots |
| POST | `/report/{token}/upgrade` | Optional | 10/min | Upgrade Quick→Full. Uses credit first (returns `{upgraded:true}`), else Stripe checkout ($9.99/$4.99 Pro). Quick response data is server-side stripped — full data only returned for tier='full'. | report_snapshots, report_credits, Stripe |
| GET | `/search/address` | No | 30/min | Address autocomplete (3-tier) | addresses (tsvector + trigram) |
| GET | `/search/suburb` | No | 30/min | Suburb search | sa2_boundaries |
| GET | `/suburb/{sa2_code}` | No | 20/min | Suburb profile | area_profiles, sa2_boundaries |
| GET | `/suburbs/guides` | No | 60/min | List published SEO suburb guides (sitemap + /suburbs index) | suburb_guide_pages |
| GET | `/suburbs/guide/{slug}` | No | 60/min | Full SEO guide for one suburb (1h Redis cache) | suburb_guide_pages |
| GET | `/account/credits` | Yes | — | Plan + credit balance (returns quick_credits, full_credits, credits_remaining) | users, report_credits |
| GET | `/account/saved-reports` | Yes | — | User's saved report list | saved_reports |
| GET | `/account/saved-reports/{id}/download` | Yes | — | Re-download saved report | saved_reports |
| POST | `/account/saved-properties` | Yes | — | Bookmark a property | saved_properties |
| POST | `/account/email-summary` | Yes | — | Queue email summary | users, addresses |
| POST | `/account/manage-subscription` | Yes | — | Stripe portal URL | report_credits, Stripe API |
| POST | `/account/redeem-promo` | Yes | 15/min | Redeem promo code (returns report_tier: quick\|full) | promo_redemptions, report_credits |
| POST | `/checkout/session` | Yes | 15/min | Stripe checkout (auth). Plans: full_single ($9.99), pro_extra ($4.99 Pro over-limit), pro ($140/mo). Promotion codes enabled. Verifies stored Stripe customer ID exists (handles test→live switch). | Stripe API |
| POST | `/checkout/guest-session` | No | 5/min | Stripe checkout (guest). Plan: full_single ($9.99) | guest_purchases, Stripe API |
| GET | `/checkout/guest-token` | No | 5/min | Exchange session for download token | guest_purchases, Redis |
| POST | `/webhooks/stripe` | Sig | 60/min | Stripe events | report_credits, users, guest_purchases |
| POST | `/rent-reports` | No | 3/hr | Submit crowdsourced rent | rent_reports |
| GET | `/rent-reports/{id}` | No | 40/min | Building rent data (3+ reports) | rent_reports |
| POST | `/budget-inputs` | No | 3/hr | Save budget calculator data | user_budget_inputs |
| POST | `/email-signups` | No | 3/hr | Region availability signup | email_signups |
| POST | `/auth/send-code` | No | 5/min, 10/hr | Send 6-digit OTP to email via Brevo | Redis (otp:{email}, 5 min TTL) |
| POST | `/auth/verify-code` | No | 10/min | Verify OTP code, return user info for NextAuth | Redis (otp:{email}) |
| POST | `/feedback` | No | 5/hr | Submit feedback | feedback |
| GET | `/health` | No | — | Health check | DB + Redis ping |
| POST | `/events` | No | 60/min | Frontend event ingestion (allowlisted types) | app_events |
| GET | `/admin/check` | Admin | 30/min | Check if signed-in user has admin access (email in ADMIN_EMAILS) | users |
| GET | `/admin/users` | Admin | 30/min | List users with per-tier credit balances (searchable, paginated) | users, report_credits, saved_reports |
| POST | `/admin/users/{id}/credits?amount=N&tier=quick\|full` | Admin | 30/min | Add (positive) or remove (negative) credits for a user | report_credits |
| GET | `/admin/analytics/overview` | Admin | 30/min | Analytics dashboard: today stats, trends, top endpoints, slow requests, errors | app_events, perf_metrics, error_log, daily_metrics |
| GET | `/admin/analytics/events` | Admin | 30/min | Paginated event browser (filterable by type, days) | app_events |
| GET | `/admin/analytics/errors` | Admin | 30/min | Paginated error browser (filterable by category, days) | error_log |
| POST | `/admin/analytics/errors/{id}/resolve` | Admin | 30/min | Mark error as resolved | error_log |

**Admin UI note:** All admin hooks (`useAdmin*.ts`) and `AnalyticsPanel` use `useAuthToken()` to send Bearer tokens. Hooks must be called before any early returns in components — never conditionally.

**TypeScript note:** `ReportSnapshot` cannot be cast directly to `Record<string, unknown>` — use `as unknown as Record<string, unknown>` for dynamic field access on snapshot objects. This applies when accessing snapshot fields not yet in the `ReportSnapshot` interface (e.g. newly added data like `business_demography`).

**Admin note:** New tables must be added to `ALLOWED_TABLES` in `admin.py` (line ~28) for the admin data health dashboard to count them.

**Mobile text rule:** No text below 12px (`text-xs`). All `text-[10px]` and `text-[11px]` were replaced with `text-xs` across 73+ files. Touch targets minimum 44px. Search overlay results py-4, cancel button min-h-[44px], drawer handle pt-4/pb-4.

**Property type note:** All three report covers (Full, Quick, on-screen) show a property type badge from `report.property.title_type` or `report.property.building_use` (first non-"Unknown" value). Helps users understand what the CV/data applies to (e.g. "Unit Title" vs "Freehold" vs "Commercial car parking").

**Security note:** `/property/{id}/report` strips premium data (terrain, event_history, area_profile, council-specific hazard detail) for unauthenticated users. `/report/{token}` Quick tier uses `_QUICK_ALLOWED_KEYS` allowlist + strips inner report detail. Authenticated users get full data. When adding new premium fields, add to Quick allowlist only if rendered by HostedQuickReport.

**SQL note:** In snapshot_generator.py queries, use explicit `CROSS JOIN addr` instead of implicit `FROM table, addr` when also using `LEFT JOIN` — PostgreSQL can't reference the implicit join alias from the LEFT JOIN clause.

## SEO Suburb Guide Pages
<!-- UPDATE: When adding an SEO landing-page route, add a row here. -->

| Route | File | Source | SSR | Indexed |
|-------|------|--------|:---:|:-------:|
| `/suburbs` | `frontend/src/app/suburbs/page.tsx` | `GET /api/v1/suburbs/guides` | Yes | Yes |
| `/suburbs/{slug}` | `frontend/src/app/suburbs/[slug]/page.tsx` | `GET /api/v1/suburbs/guide/{slug}` | Yes | Yes |
| `sitemap.xml` entries for guides | `frontend/src/app/sitemap.ts` | `GET /api/v1/suburbs/guides?limit=5000` | Yes | — |

Guide content lives in `suburb_guide_pages` and is generated by `scripts/generate_suburb_guides.py` (local Qwen via Ollama). JSON-LD Article + BreadcrumbList + FAQPage schemas are emitted server-side. Metadata (title/description/canonical/og) is computed in `generateMetadata()`.

---

**Performance note:** Report endpoint has `[PERF]` timing logs via `print()`. Cold cache ~1s after index fix (was 9-12s). Migration 0031 adds index on `addresses(gd2000_xcoord, gd2000_ycoord)`. Quick Report snapshots skip Valhalla terrain (~60s saving) — `skip_terrain` passed from `create_report_snapshot` → `generate_snapshot` → `prefetch_property_data`. Terrain backfilled async via `_backfill_terrain()` and merged into snapshot JSONB. Background generation has `[PERF-BG]` timing logs. Transit access label uses score thresholds (not risk rating). Nearest train capped at 50km (migration 0033 replaces `get_property_report()` — do NOT edit 0022 in place). 48 cities in `cbd_points` (migration 0032). Snapshot generation uses `preloaded` dict to skip re-fetching data the background task already has (report, rent_history, hpi_data, rates_data, supermarkets, highlights). `prefetch_property_data` runs 16 independent queries in parallel via `asyncio.gather` with separate DB connections. Rent baselines (5 bedroom variants) also parallelized.
