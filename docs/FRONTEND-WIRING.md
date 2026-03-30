# WhareScore Frontend Wiring Map

> Source of truth for what data is displayed where and how it gets there.
> Agents: search by component name, report field, or snapshot key. Update when adding/changing UI.

---

## Report Fields → Components
<!-- UPDATE: When adding a report field, add the row. When adding a component, add its fields. -->

### On-screen report (`/property/{id}`, component: `PropertyReport.tsx`)

| Report field path | Component | Section | Gated? |
|---|---|---|---|
| `address.full_address, .suburb, .city, .lat, .lng` | PropertySummaryCard | Header | No |
| `scores.overall, .rating` | PropertySummaryCard, ScoreGauge | Header | No |
| `scores.categories[]` | ScoreStrip, CategoryRadar | Scores | No |
| `coverage.available, .total, .per_category, .bonus_features` | DataLayersAccordion | Scores (expandable accordion) | No |
| `property.capital_value, .land_value, .building_area_sqm, .title_ref` | PropertySummaryCard | Header | No |
| `property.cv_is_per_unit, property_detection.is_multi_unit, .unit_count` | PropertySummaryCard | Header (per-unit CV calc) | No |
| `terrain.elevation_m, .slope_degrees, .slope_category` | PropertySummaryCard | Header (elevation pill + slope pill) | No |
| `hazards.*` (all) | RiskHazardsSection | "Is it Safe?" | No |
| `hazards.council_liquefaction, .council_liquefaction_geology` | RiskHazardsSection | Risk section (all cities) | No |
| `hazards.council_tsunami_ranking, .council_tsunami_scenario` | RiskHazardsSection | Risk section (all cities) | No |
| `hazards.council_slope_severity` | RiskHazardsSection | Risk section (all cities) | No |
| `hazards.active_fault_nearest` | ActiveFaultDetailCard | Risk section | No |
| `hazards.contamination_count` | ContaminatedLandCard | Risk section | No |
| `hazards.landslide_nearest, .landslide_count_500m` | LandslideDetailCard | Risk section | No |
| `environment.climate_temp_change, .climate_precip_change_pct` | ClimateForecastCard | Risk section | No |
| `liveability.nzdep_score` | NeighbourhoodSection | "Daily Life" | No |
| `liveability.crime_rate, .crime_victimisations, .crime_city_median` | CrimeCard | "Daily Life" | No |
| `liveability.cbd_distance_m, .nearest_train_m` | TransportSection | "Transport" | No |
| `liveability.bus_stops_800m, .rail_stops_800m, .ferry_stops_800m` | TransportSection | "Transport" (falls back to 800m radius if no walking_reach) | No |
| `walking_reach.bus, .rail, .ferry` | TransportSection | "Transport" (hill-adjusted 10-min walk isochrone) | No |
| `liveability.transit_travel_times[]` | TransportSection | "Transport" | Top 3 free, rest gated |
| `liveability.transit_travel_times_pm[]` | TransportSection | "Transport" | PremiumGate |
| `liveability.peak_trips_per_hour, .nearest_stop_name` | TransportSection | "Transport" | No |
| `property.capital_value, .land_value` | MarketSection | "Affordable?" | No |
| `market.market_heat, .trend.cagr_*` | MarketSection | "Affordable?" | No. market_heat derived client-side in transformReport.ts from 1yr rent trend + bond volume (≥8%→hot, ≥4%→warm, ≤-4%→cold, ≤-1%→cool, else neutral) |
| `planning.zone_name, .zone_category, .zone_code` | PlanningSection | "Planning" | No |
| `planning.height_limit, .in_viewshaft, .in_heritage_overlay` | PlanningSection | "Planning" | No |
| `planning.in_ecological_area, .in_mana_whenua, .epb_listed` | PlanningSection | "Planning" | No |
| `planning.park_count_500m, .nearest_park_name` | PlanningSection | "Planning" | No |
| All hazards + liveability + planning | KeyFindings | Key findings | First 2 free |
| (live API call) | AISummaryCard | AI summary | No |

### Hosted report (`/report/{token}`, component: `HostedReport.tsx`)

**Layout:** Two tabs — "Your Property" (default) and "The Area". Cover + score strip above tabs. Methodology + disclaimer below tabs. Sidebar stays fixed across both. Tab navigation footer at bottom of each tab ("Continue to The Area" / "Back to Your Property"). URL hash sync (`#property` / `#area`). Print CSS shows both tabs. Quick report (HostedQuickReport.tsx) has no tabs.

| Snapshot field | Component | Hosted-only? |
|---|---|---|
| `report.scores.categories` | HostedAtAGlance | Yes |
| `report.property, report.scores, meta` | HostedExecutiveSummary | Yes |
| `ai_insights` | HostedAISummary | Yes (on-screen fetches live) |
| `report.scores.categories` | CategoryRadar | No (shared) |
| `report.*` (all) | KeyFindings (all, no gating) | No (shared, but ungated) |
| `hazard_advice, weather_history` | HostedAreaFeed | Yes |
| `rent_baselines` | HostedRentAdvisor | Yes (renter only) |
| `rent_history` | HostedRentHistory | Yes |
| `price_advisor, deltas` | HostedPriceAdvisor | Yes (buyer only) |
| `hpi_data` | HostedHPIChart | Yes |
| `report.*` (questions) | QuestionContent (loop) | No (shared) |
| `nearby_highlights` | HostedNearbyHighlights | Yes |
| `school_zones` | HostedSchoolZones | Yes |
| `report.liveability.schools` | HostedSchools | Yes |
| `road_noise` | HostedRoadNoise | Yes |
| `terrain`, `isochrone`, `terrain_insights` | HostedTerrain | Yes |
| `report.liveability` (crime, deprivation, transit modes, AM+PM travel times, peak_trips_per_hour, nearest_stop_name, crashes, amenities_500m) | HostedNeighbourhoodStats | Yes. Peak frequency shown with Excellent/Good/Limited badge. |
| `report.environment` (air, water, climate, contamination, corrosion) | HostedNeighbourhoodStats | Yes |
| `report.planning` (notable trees, parks, heritage, overlays, geotech, transmission_line_distance_m) | HostedNeighbourhoodStats | Yes. Transmission line warning if ≤500m (red/amber/info). |
| `report.comparisons` (suburb + city benchmarks) | HostedNeighbourhoodStats | Yes |
| `rates_data` (total_rates, rates_breakdown) | HostedNeighbourhoodStats | Yes (Full only). Annual rates card with breakdown. |
| `census_demographics, census_households, census_commute` | HostedDemographics (isFull=true) | Yes. Population, age, commute (free), income, tenure, ethnicity, internet (Full). |
| `climate_normals` | HostedClimate | Yes. Monthly temp range chart, seasonal table, highlight cards. |
| `nearby_doc` | HostedOutdoorRec | Yes |
| `report.planning` | HostedInfrastructure | Yes |
| `report.hazards` (flood_zone, liquefaction, coastal_erosion_exposure, wind_zone) | HostedHealthyHomes | Yes (renter only). Accesses raw snapshot via cast — uses SQL field names (flood, liquefaction, coastal_exposure), not transformed type names. |
| `hazard_advice` | HostedHazardAdvice | Yes |
| `recommendations` | HostedRecommendations | Yes |
| (persona template) | HostedNextSteps | Yes |
| (static) | HostedMethodology | Yes |
| `meta, rent_baselines, price_advisor, report.property` | ReportSidebar | Yes |

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
| `report.hazards` | QuickHazardSummary | New (traffic lights) |
| `school_zones` | HostedSchoolZones | Yes |
| `nearby_highlights` | HostedNearbyHighlights | Yes |
| `recommendations` | QuickActions | New (top 3 only) |
| — | QuickUpgradeBanner | POST /report/{token}/upgrade → uses credit if available (instant reload), else Stripe checkout |

---

## Snapshot Structure
<!-- UPDATE: When adding a key to generate_snapshot() return dict, add it here. -->

Generated by `snapshot_generator.py` `generate_snapshot()` (~line 1077). Stored in `report_snapshots.snapshot_json`.

| Key | Type | Source | Used by |
|-----|------|--------|---------|
| `report` | Full PropertyReport JSON | `get_property_report()` SQL + scores enrichment + rates fix | All question sections, findings, scores |
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
| `nearest_supermarkets` | Array {name, brand, distance_m, latitude, longitude} (top 5, NZ brand priority) | osm_amenities 5km, brand-first sort | HostedNeighbourhoodStats (Full only — stripped from Quick) |
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
| `census_demographics` | Object or null | `census_demographics` table via SA2 join. Population, age, ethnicity, birthplace, gender, languages. | HostedDemographics (Full only) |
| `census_households` | Object or null | `census_households` table via SA2 join. Income, tenure, crowding, vehicles, internet, rent, landlord. | HostedDemographics (Full only) |
| `census_commute` | Object or null | `census_commute` table via SA2 join. Work at home, drive, bus, train, bike, walk counts. | HostedDemographics (Full only) |
| `business_demography` | Object or null | `business_demography` table via SA2 join. Employee count, business count, growth %. | HostedDemographics (both Quick + Full) |
| `community_facilities` | Object | `osm_amenities` spatial queries. Nearest hospital, EV charger, library/sports/playground/community centre/cycling facility counts within 2km. | HostedNeighbourhoodStats |
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
| GET | `/property/{id}/summary` | No | 60/min | Lightweight popup summary | addresses, sa2_boundaries |
| GET | `/property/{id}/ai-summary` | No | 20/min | AI narrative (30s timeout) | generate_property_summary() |
| GET | `/property/{id}/rates` | No | 10/min | Live council rates for all 25 councils. Called lazily by frontend after report load; 404 = city has no integration. CV shown from DB first, updated inline when this resolves. | 25 council APIs via `routers/rates.py` unified router |
| GET | `/property/{id}/area-feed` | No | 20/min | GeoNet + NEMA + MetService | External APIs |
| GET | `/property/{id}/crime-trend` | No | 30/min | Monthly crime 3yr | crime table |
| GET | `/property/{id}/earthquake-timeline` | No | 30/min | Annual quakes 10yr | earthquakes table |
| GET | `/property/{id}/rent-history` | No | 20/min | Rent trends | bonds_detailed |
| GET | `/property/{id}/market` | No | 20/min | Fair price analysis | bonds_*, council_valuations, rbnz_housing |
| POST | `/property/{id}/rent-advisor` | No | 20/min | Rent fairness | compute_rent_advice() |
| POST | `/property/{id}/price-advisor` | No | 20/min | Price fairness | compute_price_advice() |
| GET | `/nearby/{id}/highlights` | No | 40/min | Nearby amenities | osm_amenities |
| GET | `/nearby/{id}/schools` | No | 40/min | Schools + zones | schools, school_zones |
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
| GET | `/account/credits` | Yes | — | Plan + credit balance (returns quick_credits, full_credits, credits_remaining) | users, report_credits |
| GET | `/account/saved-reports` | Yes | — | User's saved report list | saved_reports |
| GET | `/account/saved-reports/{id}/download` | Yes | — | Re-download saved report | saved_reports |
| POST | `/account/saved-properties` | Yes | — | Bookmark a property | saved_properties |
| POST | `/account/email-summary` | Yes | — | Queue email summary | users, addresses |
| POST | `/account/manage-subscription` | Yes | — | Stripe portal URL | report_credits, Stripe API |
| POST | `/account/redeem-promo` | Yes | 15/min | Redeem promo code (returns report_tier: quick\|full) | promo_redemptions, report_credits |
| POST | `/checkout/session` | Yes | 15/min | Stripe checkout (auth). Plans: full_single ($9.99), pro_extra ($4.99 Pro over-limit), pro ($140/mo). Promotion codes enabled. | Stripe API |
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

**SQL note:** In snapshot_generator.py queries, use explicit `CROSS JOIN addr` instead of implicit `FROM table, addr` when also using `LEFT JOIN` — PostgreSQL can't reference the implicit join alias from the LEFT JOIN clause.

**Performance note:** Report endpoint has `[PERF]` timing logs via `print()`. Cold cache ~1s after index fix (was 9-12s). Migration 0031 adds index on `addresses(gd2000_xcoord, gd2000_ycoord)`. Quick Report snapshots skip Valhalla terrain (~60s saving) — `skip_terrain` passed from `create_report_snapshot` → `generate_snapshot` → `prefetch_property_data`. Terrain backfilled async via `_backfill_terrain()` and merged into snapshot JSONB. Background generation has `[PERF-BG]` timing logs. Transit access label uses score thresholds (not risk rating). Nearest train capped at 50km (migration 0033 replaces `get_property_report()` — do NOT edit 0022 in place). 48 cities in `cbd_points` (migration 0032). Snapshot generation uses `preloaded` dict to skip re-fetching data the background task already has (report, rent_history, hpi_data, rates_data, supermarkets, highlights). `prefetch_property_data` runs 16 independent queries in parallel via `asyncio.gather` with separate DB connections. Rent baselines (5 bedroom variants) also parallelized.
