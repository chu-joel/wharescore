# WhareScore — Data Audit: What We Have vs What We Show

**Last Updated:** 2026-03-26 (session 65)
**Purpose:** Track what data exists in the database, what's displayed in the free/paid reports, and what gaps exist.

---

## Table of Contents

1. [Free Report — What's Displayed](#1-free-report--whats-displayed)
2. [Paid Hosted Report — What's Added](#2-paid-hosted-report--whats-added)
3. [Data Source Tracing](#3-data-source-tracing)
4. [Data We Have But Don't Display](#4-data-we-have-but-dont-display)
5. [Data in DB But Not in API Response](#5-data-in-db-but-not-in-api-response)
6. [Known Data Gaps (Not Available)](#6-known-data-gaps-not-available)
7. [Free vs Paid Comparison Matrix](#7-free-vs-paid-comparison-matrix)

---

## 1. Free Report — What's Displayed

**Page:** `/property/[id]`
**API:** `GET /api/v1/property/{address_id}/report` (cached 24h in Redis)
**Source:** `get_property_report()` PL/pgSQL function → JSONB

### Section 1: Risk & Hazards (FREE — fully visible)
**Component:** `RiskHazardsSection.tsx`

| Field | DB Table.Column | Original Source | Coverage |
|-------|----------------|-----------------|----------|
| Flood Zone | `flood_zones.label` | Regional councils (30 loaders) | ~500K polygons |
| Tsunami Zone | `tsunami_zones.zone_class` | GNS/councils (15 loaders) | ~200K polygons |
| Liquefaction | `liquefaction_zones.liquefaction` | GNS district studies (25 loaders) | ~350K polygons |
| Slope Failure | `slope_failure_zones.severity` | GNS/councils (15 loaders) | National + regional |
| Earthquakes (30km, M3+, 10yr) | `earthquakes.magnitude` | GeoNet | ~50K events |
| Wind Zone | `wind_zones.zone_name` | NIWA | National |
| Wildfire Risk (VHE days) | `wildfire_risk.quantile, ten_year_mean` | NIWA/Fire & Emergency | 30 stations |
| Road Noise (dB) | `noise_contours.laeq24h` | Waka Kotahi | ~488K polygons |
| EPB Count (300m) | `earthquake_prone_buildings` | Building Safety NZ | ~15K buildings |
| Air Quality (nearest site) | `air_quality_sites.site_name, pm10_trend` | LAWA | 72 sites |
| Water Quality (nearest site) | `water_quality_sites.ecoli_band, nitrate_band, clarity_band` | LAWA | 1,175 sites |
| Coastal Erosion | `coastal_erosion_national.sensitivity` | MfE/CSI + councils | ~12K polygons |
| Active Fault (nearest, distance) | `active_faults.fault_data` | GNS | ~10K faults |
| Aircraft Noise | `aircraft_noise_overlay.name, noise_level_dba` | Regional councils | ~10 airports |
| Landslide Count | `landslide_areas / landslide_events` | GNS | ~8K events |

**Regional-Specific (Wellington/Auckland):** earthquake_hazard_index, ground_shaking, gwrc_liquefaction, fault_zones, wcc_flood_type, wcc_tsunami_return_period — used in scoring but not individually displayed.

### Section 2: Neighbourhood & Liveability (FREE — fully visible)
**Component:** `NeighbourhoodSection.tsx`

| Field | DB Table.Column | Original Source | Coverage |
|-------|----------------|-----------------|----------|
| NZDep Decile (1-10) | `nzdep.nzdep2023` | Stats NZ | ~5K SA2s |
| Crime Victimisations (3yr) | `mv_crime_density.victimisations_3yr` | NZ Police | ~3K area units |
| Crime Percentile (SA2) | `mv_crime_density.percentile_rank` | NZ Police | National |
| Crime City Median | `mv_crime_ta.median_victimisations_per_au` | NZ Police | National |
| Schools Count (1500m) | `schools` (count) | MoE | ~2,500 schools |
| Transit Stops (400m count) | `transit_stops` | GTFS (8 cities) | ~2,800 stops |
| Transit Mode Breakdown (800m) | `metlink_stops / at_stops` | Regional transport | 8 cities |
| Nearest Train Station + Distance | `transit_stops (location_type=1)` | GTFS | 8 cities |
| CBD Distance | SQL `get_nearest_cbd_point()` | 55+ towns | National |
| Nearby Amenities (cafes, shops, parks) | OSM API | OpenStreetMap | Real-time client-side |

### Section 3: Market & Valuations (PARTIALLY GATED)
**Component:** `MarketSection.tsx`

| Field | DB Table.Column | Source | Free? |
|-------|----------------|--------|-------|
| Council Capital Value | `council_valuations.capital_value` | 32+ councils | YES |
| Land Value | `council_valuations.land_value` | 32+ councils | YES |
| Improvements Value | `council_valuations.improvements_value` | 32+ councils | YES |
| Valuation Date | `council_valuations.valuation_date` | 32+ councils | YES |
| Multi-Unit Detection | Spatial count at same coords | Derived | YES |
| Unit Comparison Table | Sibling unit CVs | Derived | YES |
| Median Rent (SA2) | `bonds_detailed.median_rent` | MBIE bonds | YES |
| Rent Quartiles (LQ/UQ) | `bonds_detailed.lower/upper_quartile_rent` | MBIE bonds | YES |
| Market Heat Badge | TLA rental trend CAGR | Derived | YES |
| Rent Trend (1yr, 5yr, 10yr CAGR) | `bonds_tla / bonds_region` | MBIE bonds | YES |
| Rent Advisor (fair rent analysis) | Computed by `rent_advisor.py` | Multiple inputs | **GATED** |
| Price Advisor (fair value estimate) | Computed by `price_advisor.py` | Multiple inputs | **GATED** |
| HPI Trend Chart | `rbnz_housing` | RBNZ | **GATED** |

### Section 4: Transport & Distance (PARTIALLY GATED)
**Component:** `TransportSection.tsx`

| Field | Source | Free? |
|-------|--------|-------|
| CBD Distance | SQL function | YES |
| Nearest Train Distance | SQL function | YES |
| Transit Mode Counts (400m-800m) | GTFS | YES |
| Nearby Stop List (name, mode, distance) | `transit_stops` | YES |
| Transit Travel Times (AM/PM routes) | `metlink/at_travel_times` | **GATED** (first 3 AM free) |
| Commute Time to Destinations | Google Transit API | **GATED** |

### Section 5: Planning & Districts (FREE — fully visible)
**Component:** `PlanningSection.tsx`

| Field | DB Table.Column | Source | Coverage |
|-------|----------------|--------|----------|
| District Plan Zone | `district_plan_zones.zone_name` | 20 councils | ~200K zones |
| Zone Code | `district_plan_zones.zone_code` | 20 councils | ~200K zones |
| Height Limit (m) | `height_controls.height_limit` | Most councils | ~100K zones |
| Heritage Sites Count (500m) | `heritage_sites` | Heritage NZ + 9 councils | ~7.4K sites |
| Resource Consents Count (500m, 2yr) | `resource_consents` | Councils | ~50K recent |
| Infrastructure Projects Count (5km) | `infrastructure_projects` | Te Waihanga | ~14K projects |
| EPB Listed | `earthquake_prone_buildings.epb_listed` | Building Safety | National |
| Conservation Land | `conservation_land` | DOC | ~12K areas |

---

## 2. Paid Hosted Report — What's Added

**Page:** `/report/{share_token}`
**Storage:** `report_snapshots` table (pre-computed JSONB snapshot, immutable)
**Generator:** `snapshot_generator.py`

Everything from the free report, PLUS:

| Premium Feature | Source | Notes |
|----------------|--------|-------|
| Rent Advisor (all variants) | `rent_advisor.py` | All dwelling_type:bedroom combos pre-computed |
| Price Advisor (fair value) | `price_advisor.py` | Full fair value analysis |
| Delta Tables (finish, bathroom, toggle) | Pre-computed | For client-side customization sliders |
| Full Transit Travel Times (AM + PM) | All routes | No gating |
| HPI Trend Chart | `rbnz_housing` | Full historical data |
| Crime Trend Timeline | `/crime-trend` endpoint | Historical sparkline |
| AI Insights | LLM-generated | Property-specific commentary |
| Lifestyle Personas | Pre-computed | Buyer persona matching |
| Recommendations | Pre-computed | Lifestyle recommendations |

---

## 3. Data Source Tracing

### Flow: UI → API → DB → Original Source

```
Frontend Component
  → usePropertyReport hook
    → GET /api/v1/property/{id}/report
      → Redis cache (24h TTL)
        → get_property_report() PL/pgSQL function
          → ST_Intersects / ST_DWithin spatial queries
            → 44 tables + 5 materialized views
              → Original data loaded via data_loader.py (281 DataSource entries)
```

### Scoring Pipeline
```
Raw hazard data → risk_score.py
  → Per-indicator normalization (min-max, log scaling)
  → 5 category scores (Risk, Liveability, Market, Transport, Planning)
  → Weighted composite score → 0-100 → rating bin
```

---

## 4. Data We Have But Don't Display

### Category B: In API Response But NOT Rendered in Frontend

#### Hazard Detail (returned but hidden)

| # | Field | API Path | DB Source | Why Not Shown |
|---|-------|----------|-----------|---------------|
| B1 | Coastal Elevation (cm) | `hazards.coastal_elevation_cm` | `coastal_elevation` | No UI component |
| B2 | Flood Extent AEP | `hazards.flood_extent_aep, flood_extent_label` | `flood_extent` | Generic flood label shown instead |
| B3 | Overland Flow (50m) | `hazards.overland_flow_within_50m` | `overland_flow_paths` | No UI for overflow risk |
| B4 | Solar Radiation (Wellington) | `hazards.solar_mean_kwh, solar_max_kwh` | `wcc_solar_radiation` | SolarPotentialCard.tsx exists but not integrated |
| B5 | Active Fault Detail | `hazards.active_fault_nearest` → `fault_name, fault_class, slip_rate_mm_yr, recurrence_interval` | `active_faults` | Only distance shown via score |
| B6 | Fault Avoidance Zone | `hazards.fault_avoidance_zone` → `fault_name, zone_type, setback_m` | `fault_avoidance_zones` | No component handles it |
| B7 | Landslide Events (1km) | `hazards.landslide_events_1km` | `landslide_events` | No breakdown UI |
| B8 | Contaminated Land Detail | `hazards.contam_nearest, contam_nearest_category, contam_nearest_distance_m` | `contaminated_land` | Only count shown in Planning checklist |
| B9 | Climate Projections | `hazards.climate_temp_change, climate_rainfall_change` | `climate_grid + climate_projections` | ClimateForecastCard.tsx exists but not integrated |
| B10 | Earthquake Max Magnitude | `hazards.earthquake_max_mag` | `earthquakes` | Only count is scored |
| B11 | Council-Specific Hazard Detail | `wcc_flood_type, wcc_tsunami_return_period, gwrc_liquefaction, ground_shaking_zone, earthquake_hazard_index` | Various regional tables | Used in scoring only, not displayed individually |

#### Planning/Character Data (returned but hidden)

| # | Field | API Path | DB Source | Why Not Shown |
|---|-------|----------|-----------|---------------|
| B12 | Infrastructure Project Detail | `planning.infrastructure_5km` array → `name, sector, status, value_range, distance_m` | `infrastructure_projects` | Only count shown |
| B13 | Notable Trees (50m) | `planning.notable_trees_50m` | `notable_trees` | Count exists but not displayed |
| B14 | Mana Whenua | `planning.in_mana_whenua, mana_whenua_name` | `mana_whenua_boundaries` | No component |
| B15 | Ecological Areas | `planning.in_ecological_area, ecological_area_name, ecological_area_type` | `significant_ecological_areas` | No component |
| B16 | Special Character Areas | `planning.in_special_character_area, special_character_name` | Council overlays | No component |
| B17 | Character Precincts | `planning.in_character_precinct, character_precinct_name` | `character_precincts` | No component |
| B18 | Heritage Overlay Detail | `planning.in_heritage_overlay, heritage_overlay_name` | Heritage NZ + councils | Only count shown |
| B19 | Viewshaft Protection | `planning.in_viewshaft, viewshaft_name, viewshaft_significance` | `viewshafts` | No component |
| B20 | Height Variation Control | `planning.height_variation_limit` | Council overlays | Only main height_limit shown |

#### School/Amenity Data (returned but underused)

| # | Field | API Path | DB Source | Why Not Shown |
|---|-------|----------|-----------|---------------|
| B21 | School List (full array) | `liveability.schools_1500m[]` → `name, type, decile, roll, authority, eqi, distance_m, in_zone` | `schools` | Only count displayed, full list ignored |
| B22 | Nearest Essentials Coordinates | `liveability.nearest_supermarket/gp/pharmacy` → `latitude, longitude` | OSM | Only name + distance shown, no map |
| B23 | Amenity Raw Breakdown | `liveability.amenities_500m` full subcategory counts | OSM | Filtered to curated categories only |

#### Market Data (returned but underused)

| # | Field | API Path | DB Source | Why Not Shown |
|---|-------|----------|-----------|---------------|
| B24 | Rental Overview (all types) | `market.rental_overview[]` → all dwelling_type/beds combos | `bonds_detailed` | Only "House ALL beds" headline extracted |
| B25 | Rental Trend by Type | `market.trends[]` → per dwelling type CAGRs | `bonds_tla` | Only aggregated 1yr/5yr/10yr shown |

#### Property Detail (returned but hidden)

| # | Field | API Path | DB Source | Why Not Shown |
|---|-------|----------|-----------|---------------|
| B26 | Building Footprint (sqm) | `property.footprint_sqm` | `building_outlines` | No component |
| B27 | Building Use Classification | `property.building_use` | `building_outlines.use` | No component |
| B28 | Estate Description | `property.estate_description` | `property_titles` | Available but not rendered |
| B29 | Owners Count | `property.owners_count` | `property_titles` | Not displayed |

**Total: 29 items returned by API but not displayed in frontend.**

---

## 5. Data in DB But Not in API Response

### Category C: In Database But Not Queried/Returned by Report Function

| # | Data | DB Table | Columns Available But Not Returned | Why |
|---|------|----------|-----------------------------------|-----|
| C1 | School Metadata | `schools` | `phone, website, coed_status, enrolment_scheme, org_type` (30+ cols) | Report only returns: name, type, decile, roll, authority, distance, in_zone, eqi |
| C2 | Transit Stop Coords | `metlink_stops / at_stops` | `stop_lat, stop_lon, zone_id, location_type` | Coordinates not extracted for map |
| C3 | Amenity Business Detail | `osm_amenities` | `opening_hours, phone, website, brand` | Report aggregates to name + distance only |
| C4 | Transmission Line Detail | `transmission_lines` | `type, status, description` | Only distance + voltage returned |
| C5 | Resource Consent Detail | `resource_consents` | `consent_id, consent_type, purpose_desc, status, dates` | Only count (500m, 2yr, granted) returned |
| C6 | Crash Detail | `crashes` | `crash_year, fatal_count, serious_injury_count, speed_limit, urban` | Only summary counts returned |
| C7 | Heritage Site Detail | `heritage_sites` | `list_number, list_entry_type, list_entry_status, list_entry_date` | Only count + existence check |
| C8 | Rates Account Detail | `wcc_rates_cache` | `valuation_history, levies_breakdown, has_water_meter, rating_category` | Used for CV fix only |
| C9 | Bonds Historical Detail | `bonds_detailed` | Full quarterly history per SA2/dwelling/beds | Only latest quarter via materialized views |
| C10 | NZDep Raw Score | `nzdep` | `nzdep2023_score` (raw), `sa12023_code` | Only decile (1-10) returned |
| C11 | Parcel Legal Description | `parcels` (4.2M rows) | `appellation, survey_area, parcel_intent, status, land_district` | Not queried by report function at all |
| C12 | Data Source Metadata | `data_sources` | `source_name, license, last_updated, update_frequency` | Not integrated into report |

**Total: 12 data groups in DB but not returned by API.**

---

## 6. Known Data Gaps (Not Available At All)

| Data | Reason | Impact |
|------|--------|--------|
| Solar Potential (national) | GeoTIFF format incompatible with current stack | High — popular feature request |
| Wind Zones (outside Wellington) | Only GWRC has spatial data | Medium |
| Auckland Contaminated Land | Council charges $128-228/report | High — largest city |
| Canterbury LLUR (contaminated) | Custom web app, not ArcGIS REST | Medium |
| Waikato Contaminated Land | Per-property request only | Medium |
| Marlborough Contaminated Land | Not exposed as GIS layer | Low |
| Christchurch GTFS | API key required (register at apidevelopers.metroinfo.co.nz) | Medium |
| Rotorua Hazards | On-premise server unreachable | Low |
| Queenstown Airport Noise | Polylines only (not polygons) | Low |
| Sale Price History | Not publicly available in NZ | Very High — would be killer feature |
| Building Consent History | Per-council access, no national API | High |
| Body Corporate Details | Not available as open data | Medium |
| Tenancy Tribunal History | Not geocoded | Low |

---

## 7. Free vs Paid Comparison Matrix

| Data Element | Free Report | Paid Report | Section |
|--------------|:-----------:|:-----------:|---------|
| **Address + Geolocation** | FULL | FULL | Header |
| **Composite Score (0-100)** | FULL | FULL | Score gauge |
| **5 Category Scores** | FULL | FULL | Score strip |
| **All Hazards (20+ indicators)** | FULL | FULL | Risk & Hazards |
| **NZDep, Crime Percentile** | FULL | FULL | Neighbourhood |
| **Schools Count** | FULL | FULL | Neighbourhood |
| **Transit Stops Count** | FULL | FULL | Neighbourhood |
| **CBD Distance** | FULL | FULL | Transport |
| **Council CV/LV/Improvements** | FULL | FULL | Market |
| **Median Rent + Quartiles** | FULL | FULL | Market |
| **Rent Trend (1yr/5yr/10yr)** | FULL | FULL | Market |
| **District Plan Zone** | FULL | FULL | Planning |
| **Height Limit** | FULL | FULL | Planning |
| **Heritage/EPB/Consents Counts** | FULL | FULL | Planning |
| **Planning Overlays** (viewshaft, character, ecological, mana whenua) | FULL | FULL | Planning |
| **Notable Trees (50m)** | FULL | FULL | Planning |
| **Active Fault Detail** (name, slip rate, recurrence) | In findings only | FULL | Risk & Hazards |
| **Fault Avoidance Zone** | In findings only | FULL | Risk & Hazards |
| **Contaminated Land Detail** | In findings only | FULL | Risk & Hazards |
| **Landslide Detail** (nearest event) | In findings only | FULL | Risk & Hazards |
| **Climate Projections** (2050 temp/rainfall) | In findings only | FULL | Risk & Hazards |
| **Solar Potential** (Wellington) | In findings only | FULL | Risk & Hazards |
| **Title Reference** | FULL | FULL | Header |
| Rent Advisor (fair rent) | **LOCKED** | FULL | Market |
| Price Advisor (fair value) | **LOCKED** | FULL | Market |
| HPI Trend Chart | **LOCKED** | FULL | Market |
| Transit Travel Times (full) | **LOCKED** (3 AM free) | FULL | Transport |
| Commute Time Routing | **LOCKED** | FULL | Transport |
| Crime Trend Timeline | **HIDDEN** | FULL | Neighbourhood |
| AI Insights | **HIDDEN** | FULL | Summary |
| Lifestyle Personas | **HIDDEN** | FULL | Summary |
| Recommendations | **HIDDEN** | FULL | Summary |

---

## Priority Actions: Quick Wins to Display More Data

### DONE (session 65)

1. ~~**Active Fault Detail**~~ — Now shows fault name, class, type, slip rate, recurrence interval, distance in RiskHazardsSection (B5) **DONE**
2. ~~**Fault Avoidance Zone**~~ — Warning card with fault name, zone type, setback requirement (B6) **DONE**
3. ~~**Climate Projections**~~ — ClimateForecastCard now wired into safety/deal-breakers sections (B9) **DONE**
4. ~~**Solar Potential**~~ — SolarPotentialCard now wired into safety/deal-breakers sections (B4) **DONE**
5. ~~**Contaminated Land Detail**~~ — Detail card showing count + SLUR link (B8) **DONE**
6. ~~**Landslide Nearest Detail**~~ — Shows name, trigger, type, severity, date, damage, distance (B7) **DONE**
7. ~~**Planning Overlays**~~ — New "Planning Overlays" section showing viewshaft, character precinct, heritage overlay, ecological area, mana whenua (B14-B19) **DONE**
8. ~~**Notable Trees**~~ — Now shown in Planning checklist with nearest tree name (B13) **DONE**
9. ~~**Zone Code + Height Variation**~~ — Zone code and height variation limit now shown in Planning zone card (B20) **DONE**
10. ~~**Parks Detail**~~ — Park count + nearest park name/distance in Planning checklist **DONE**
11. ~~**Title Reference**~~ — Now shown as pill in PropertySummaryCard (B28) **DONE**

### Still TODO — High Priority

1. **School List** — Show full school array in free report NeighbourhoodSection (B21) — already shown in hosted report via HostedSchools
2. **Infrastructure Projects** — Show detail in free report PlanningSection (B12) — already shown in hosted report via HostedInfrastructure

### Still TODO — Medium Priority (needs backend + UI)

3. **Resource Consent Detail** — Return and display recent consent purposes (C5)
4. **Crash Detail** — Show serious/fatal crash breakdown (C6)
5. **Rental by Dwelling Type** — Show rent comparison across flat/house/apartment (B24)
6. **Parcel Legal Description** — Show lot/DP details (C11)

### Still TODO — Lower Priority (nice-to-have)
17. **Character Precincts** — Heritage character zones (B17)
18. **Flood Extent AEP** — Detailed return period info (B2)
19. **Data Source Attribution** — Show data provenance per indicator (C12)

---

## Scoring Expert Ranges (from risk_score.py)

| Indicator | Min | Max | Scale | Notes |
|-----------|-----|-----|-------|-------|
| earthquake_count | 0 | 50 | Linear | M4+ within 30km, 10yr |
| road_noise_db | 40 | 75 | Linear | dB LAeq24h |
| wildfire_vhe_days | 0 | 30 | Linear | Very High Extreme days/yr |
| epb_count | 0 | 15 | Linear | Within 300m |
| transit_stops | 0 | 25 | Log | Inverse (more = better) |
| crash_count | 0 | 50 | Linear | Serious/fatal, 300m, 5yr |
| heritage_count | 0 | 100 | Log | Within 500m |
| climate_temp | 0 | 3.0 | Linear | °C by 2050 SSP2-4.5 |
| contaminated_dist | 0 | 2000 | Linear | Metres, inverse |
| school_count | 0 | 15 | Linear | Within 1.5km |
| resource_consents | 0 | 30 | Log | Granted, 500m, 2yr |
| infrastructure | 0 | 40 | Log | Projects within 5km |

---

*This document should be updated whenever new data layers are added or new UI components are built.*
