# WhareScore — Database Schema Reference

**Database:** `wharescore` (PostgreSQL 18.2 + PostGIS 3.6.1)
**Last Updated:** 2026-03-08
**Tables:** 44 (+ 5 materialized views + 17 views)
**Total Records:** ~18.8M+
**Indexes:** 30 GIST + 105 B-tree + 2 GIN

---

## Table of Contents

1. [SQL File Execution Order](#sql-file-execution-order)
2. [Core Property Data](#1-core-property-data) — addresses, parcels, property_titles, building_outlines
3. [Valuations & Rates](#2-valuations--rates) — council_valuations, wcc_rates_cache
4. [Rental Market](#3-rental-market) — bonds_detailed, bonds_tla, bonds_region, market_rent_cache, rbnz_housing
5. [Natural Hazards](#4-natural-hazards) — flood_zones, tsunami_zones, liquefaction_zones, earthquakes, coastal_erosion, wind_zones, wildfire_risk
6. [Environment](#5-environment) — noise_contours, air_quality_sites, water_quality_sites, climate_grid, climate_projections, contaminated_land, conservation_land
7. [Liveability](#6-liveability) — crime, nzdep, schools, school_zones, transit_stops, crashes, heritage_sites, osm_amenities
8. [Planning & Infrastructure](#7-planning--infrastructure) — district_plan_zones, height_controls, resource_consents, infrastructure_projects, earthquake_prone_buildings, transmission_lines
9. [Geographic Boundaries](#8-geographic-boundaries) — meshblocks, sa2_boundaries
10. [AI & Cache](#9-ai--cache) — area_profiles
11. [Application Tables](#10-application-tables) — user_rent_reports, feedback, email_signups, data_sources, admin_content
12. [Materialized Views](#11-materialized-views)
13. [Views](#12-views)
14. [Report Function](#13-report-function) — get_property_report()
15. [TOAST & Performance](#14-toast--performance)
16. [Spatial Strategy Reference](#15-spatial-strategy-reference)

---

## SQL File Execution Order

SQL files must be run in numbered order. Steps 01-04 are the initial bootstrap; 05-09 are the application layer.

| File | Purpose | Depends On |
|------|---------|------------|
| `01-create-database.sql` | Create DB + PostGIS extension | PostgreSQL installed |
| `02-create-tables.sql` | Manual table creation (nzdep only) | 01 |
| *(ogr2ogr data loads)* | Load ~35 spatial/CSV tables from GeoPackage/Shapefile/CSV | 01 |
| `03-create-indexes-views.sql` | Core GIST indexes + meshblock_deprivation view | Data loaded |
| `04-validation-query.sql` | Test queries (not schema changes) | 03 |
| `05-views.sql` | 16 spatial lookup views | All data tables |
| `06-materialized-views.sql` | 5 materialized views + area_profiles table | 05, data tables |
| `07-report-function.sql` | `get_property_report()` PL/pgSQL function | 05, 06 |
| `08-toast-and-cleanup.sql` | TOAST optimization, index dedup, pg_trgm | All spatial tables |
| `09-application-tables.sql` | App feature tables (rent reports, feedback, email signups, WCC rates cache) | 01 |

---

## 1. Core Property Data

### addresses
**Source:** LINZ Layer 105689 | **Records:** 2,403,583 | **Geometry:** Point (WGS84)

The master address table. Every property lookup starts here.

| Column | Type | Description |
|--------|------|-------------|
| fid | int4 PK | Auto-increment primary key |
| geom | geometry | Point location (EPSG:4326) |
| address_id | int4 UNIQUE | LINZ address ID — used as property identifier throughout the app |
| full_address | varchar(400) | Display address: "162 Cuba Street, Te Aro, Wellington" |
| full_address_ascii | varchar(250) | ASCII-folded for search indexes |
| search_vector | tsvector | Generated column for full-text search |
| suburb_locality | varchar(80) | Suburb name |
| town_city | varchar(80) | City name |
| territorial_authority | varchar(80) | Council/TLA name |
| address_number | int4 | Street number |
| address_number_suffix | varchar(10) | e.g. "A", "B" |
| road_name | varchar(100) | Street name only |
| road_type_name | varchar(100) | "Street", "Avenue", etc. |
| full_road_name | varchar(250) | Full road name with type |
| unit_type | varchar(100) | "Flat", "Unit", "Apartment", etc. |
| unit_value | varchar(70) | Unit number |
| gd2000_xcoord | float8 | Longitude |
| gd2000_ycoord | float8 | Latitude |
| address_class | varchar(20) | "Street", "Water", etc. |
| address_lifecycle | varchar(20) | "Current", "Retired" |

**Indexes:** `idx_addresses_address_id` (UNIQUE btree), `idx_addresses_geom` (GIST), `idx_addresses_full_address_btree` (btree text_pattern_ops on lower(full_address_ascii)), `idx_addresses_full_address_trgm` (GIN trigram), `idx_addresses_search_vector` (GIN)

---

### parcels
**Source:** LINZ Layer 51571 | **Records:** 4,254,821 | **Geometry:** Polygon (WGS84)

Land parcel boundaries. Joined to addresses via `ST_Within(address.geom, parcel.geom)`.

| Column | Type | Description |
|--------|------|-------------|
| fid | int4 PK | Auto-increment primary key |
| geom | geometry | Parcel boundary polygon |
| id | int4 | LINZ parcel ID |
| appellation | varchar(2048) | Legal description (e.g. "Lot 1 DP 12345") |
| parcel_intent | varchar(100) | "Fee Simple Title", "Road", etc. |
| topology_type | varchar(100) | "Primary", "Non-Primary" |
| status | varchar(25) | "Current", "Historic" |
| titles | varchar(32768) | Associated title references |
| survey_area | float8 | Surveyed area (m²) |
| calc_area | float8 | Calculated area (m²) |
| land_district | varchar(100) | Land registration district |

**Indexes:** `idx_parcels_geom` (GIST)

---

### property_titles
**Source:** LINZ Layer 50804 | **Records:** 2,436,931 | **Geometry:** Polygon (WGS84)

Property title extents. Provides ownership count, estate type, title number.

| Column | Type | Description |
|--------|------|-------------|
| fid | int4 PK | Auto-increment primary key |
| geom | geometry | Title extent polygon |
| id | int4 | LINZ title ID |
| title_no | varchar(20) | Title reference (e.g. "WN50A/123") |
| status | varchar(4) | "LIVE", "HIST" |
| type | varchar(100) | "Freehold", "Leasehold", etc. |
| land_district | varchar(100) | Land registration district |
| issue_date | timestamptz | Title issue date |
| guarantee_status | varchar(100) | Title guarantee status |
| estate_description | varchar(4096) | Estate type and details |
| number_owners | int8 | Number of registered owners |
| spatial_extents_shared | varchar(2) | Whether extents are shared ("Y"/"N") |

**Indexes:** `idx_property_titles_geom` (GIST)

---

### building_outlines
**Source:** LINZ Layer 101290 | **Records:** 3,228,445 | **Geometry:** Polygon (WGS84)

Building footprints. Used for footprint area calculation via `ST_Area()`.

| Column | Type | Description |
|--------|------|-------------|
| fid | int4 PK | Auto-increment primary key |
| geom | geometry | Building footprint polygon |
| building_id | int4 | LINZ building ID |
| name | varchar(250) | Building name (if known) |
| use | varchar(40) | "Residential", "Commercial", etc. |
| suburb_locality | varchar(80) | Suburb |
| town_city | varchar(80) | City |
| territorial_authority | varchar(100) | Council |
| capture_method | varchar(40) | How footprint was captured |
| last_modified | date | Last update date |

**Indexes:** `idx_building_outlines_geom` (GIST)

---

## 2. Valuations & Rates

### council_valuations
**Source:** WCC ArcGIS REST API (bulk download) | **Records:** 87,819 | **Geometry:** Polygon (WGS84)

Bulk-downloaded council rating valuations with property boundaries. Wellington City only.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| council | text | Council code (default "wcc") |
| valuation_id | text | Council valuation reference |
| full_address | text | Property address |
| legal_description | text | Legal description |
| title | text | Title reference |
| land_area | numeric | Land area (m²) |
| capital_value | int4 | Capital value ($) |
| land_value | int4 | Land value ($) |
| improvements_value | int4 | Improvements value ($) — CV minus LV |
| valuation_date | date | Date of last revaluation |
| geom | geometry | Property boundary polygon |

**Indexes:** `idx_cv_geom` (GIST), `idx_cv_full_address`, `idx_cv_valuation_id`, `idx_cv_suburb`, `idx_cv_capital_value`, `idx_cv_council`

---

### wcc_rates_cache
**Source:** WCC Property Search API (live, on-demand) | **Records:** 77,352 | **Geometry:** None

Live-fetched rates data from WCC Property Search API. Updated on every property view. Contains detailed levy breakdowns not available in `council_valuations`.

| Column | Type | Description |
|--------|------|-------------|
| valuation_number | text PK | WCC valuation reference (e.g. "15650-100") |
| rate_account_number | int4 | WCC rate account number |
| address | text NOT NULL | Full address from WCC |
| identifier | text | Opaque WCC API token for direct lookups |
| rating_category | text | "Base", "Commercial", etc. |
| billing_code | text | e.g. "A1N" (residential non-metro), "A1C" (residential CBD) |
| legal_description | text | Legal description |
| valued_land_area | int4 | Land area (m²) |
| has_water_meter | bool | Whether property has a water meter |
| capital_value | int4 | Current capital value ($) |
| land_value | int4 | Current land value ($) |
| improvements_value | int4 | CV minus LV ($) |
| valuation_date | date | Last revaluation date |
| total_rates | numeric(10,2) | Total annual rates ($) |
| rates_period | text | Rating period (e.g. "2026") |
| valuations | jsonb | Full valuation history array (current + previous) |
| levies | jsonb | Full levy breakdown array (13-15 items: WCC, GWRC, SMF) |
| fetched_at | timestamptz | When WCC API was last called |
| created_at | timestamptz | When first cached |

**Indexes:** `idx_wcc_rates_address` (btree on lower(address)), `idx_wcc_rates_account` (btree)

**Levies JSONB structure:**
```json
[
  {"description": "Base General Rate - Full", "displayOrder": 50, "method": "Capital Value", "category": "Wellington City Council Rates (WCC)", "ratesAmount": 2080.30},
  {"description": "GWRC Base Transport Rate - Full", "displayOrder": 380, "method": "Capital Value", "category": "Greater Wellington Regional Council Rates (GWRC)", "ratesAmount": 467.75}
]
```

---

## 3. Rental Market

### bonds_detailed
**Source:** MBIE Tenancy Services | **Records:** 1,189,834 | **Geometry:** None

SA2-level quarterly rental bond data. Primary source for rental market analysis.

| Column | Type | Description |
|--------|------|-------------|
| time_frame | date | Quarter end date |
| location_id | text | SA2 2018 code (joins to sa2_boundaries) |
| dwelling_type | text | "House", "Flat", "Apartment", "Not Stated" |
| number_of_beds | text | "1", "2", "3", "4", "5+", "Not Stated" |
| total_bonds | int4 | Bonds lodged in period |
| active_bonds | int4 | Currently active bonds |
| closed_bonds | int4 | Bonds closed in period |
| median_rent | numeric | Median weekly rent ($) |
| geometric_mean_rent | numeric | Geometric mean weekly rent |
| upper_quartile_rent | numeric | Upper quartile (75th percentile) |
| lower_quartile_rent | numeric | Lower quartile (25th percentile) |
| log_std_dev_weekly_rent | numeric | Log standard deviation |

**Indexes:** `idx_bonds_det_location`, `idx_bonds_det_timeframe`, `idx_bonds_det_dwelling`

**Note:** No primary key — composite of (time_frame, location_id, dwelling_type, number_of_beds) is unique.

---

### bonds_tla
**Source:** MBIE Tenancy Services | **Records:** 26,417 | **Geometry:** None

TLA-level (council area) monthly rental bond aggregates. Fallback when SA2 data is sparse.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| time_frame | date | Month end date |
| location_id | int4 | TLA numeric ID |
| location | text | TLA name (e.g. "Wellington City") |
| lodged_bonds | int4 | Bonds lodged |
| active_bonds | int4 | Active bonds |
| closed_bonds | int4 | Closed bonds |
| median_rent | int4 | Median weekly rent ($) |
| upper_quartile_rent | int4 | Upper quartile rent |
| lower_quartile_rent | int4 | Lower quartile rent |
| log_std_dev | float8 | Log standard deviation |

**Indexes:** `idx_bonds_tla_location`, `idx_bonds_tla_time`

---

### bonds_region
**Source:** MBIE Tenancy Services | **Records:** 7,110 | **Geometry:** None

Regional-level monthly rental bond aggregates. Second fallback tier.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| time_frame | date | Month end date |
| location_id | int4 | Region numeric ID |
| location | text | Region name (e.g. "Wellington Region") |
| lodged_bonds – log_std_dev | | Same fields as bonds_tla |

---

### market_rent_cache
**Source:** MBIE Market Rent API v2 (live, on-demand) | **Records:** 14,646 | **Geometry:** None

Cached responses from the MBIE Market Rent API. Rolling 6-month window, SA2-level.

| Column | Type | Description |
|--------|------|-------------|
| sa2_code | text PK | SA2 2018 code |
| dwelling_type | text PK | Dwelling type filter used |
| num_bedrooms | text PK | Bedroom count filter used |
| period_covered | text PK | Period string (e.g. "2025-07-01 to 2025-12-31") |
| num_months | int4 | Number of months in period |
| area_name | text | SA2 area name from API |
| n_lodged | int4 | Bonds lodged in period |
| n_closed | int4 | Bonds closed |
| n_current | int4 | Currently active bonds |
| mean_rent | numeric | Mean weekly rent |
| median_rent | numeric | Median weekly rent |
| lower_quartile | numeric | Lower quartile rent |
| upper_quartile | numeric | Upper quartile rent |
| std_dev | numeric | Standard deviation |
| bond_rent_ratio | numeric | Bond-to-rent ratio |
| log_mean | numeric | Log-normal mean |
| log_std_dev | numeric | Log-normal std dev |
| synthetic_lq | numeric | Synthetic lower quartile |
| synthetic_uq | numeric | Synthetic upper quartile |
| fetched_at | timestamptz | When API was called |
| raw_response | jsonb | Full API response JSON |

**Indexes:** `idx_mrc_sa2`, `idx_mrc_fetched`

---

### rbnz_housing
**Source:** RBNZ / CoreLogic | **Records:** 143 | **Geometry:** None

National quarterly house price index and sales volumes (1990-2025).

| Column | Type | Description |
|--------|------|-------------|
| quarter_end | date PK | Quarter end date |
| house_sales | int4 | Number of house sales nationally |
| house_price_index | numeric | RBNZ House Price Index |
| housing_stock_value_m | numeric | Total housing stock value ($M) |
| residential_investment_real_m | numeric | Real residential investment ($M) |

---

## 4. Natural Hazards

### flood_zones
**Source:** GWRC ArcGIS REST API | **Records:** 14 | **Geometry:** Polygon

Wellington region flood hazard zones.

| Column | Type | Description |
|--------|------|-------------|
| objectid | int4 PK | Primary key |
| geom | geometry | Flood zone polygon |
| label | varchar(255) | Zone label |
| title | varchar(250) | Zone title (e.g. "Hutt River 2300m3/s") |
| description | varchar(500) | Zone description |
| hectares | float8 | Zone area |

**Indexes:** `idx_flood_zones_geom` (GIST)

---

### tsunami_zones
**Source:** GWRC ArcGIS + GNS shapefiles | **Records:** 60 | **Geometry:** Polygon

Tsunami evacuation zones for Wellington, Canterbury, Hawke's Bay.

| Column | Type | Description |
|--------|------|-------------|
| objectid | int4 PK | Primary key |
| geom | geometry | Zone polygon |
| zone_class | int2 | Zone severity class (1=highest risk, 2=medium, 3=lowest) |
| evac_zone | varchar(50) | Evacuation zone name (e.g. "Red", "Orange") |
| location | varchar(50) | Geographic area |
| heights | varchar(100) | Expected wave heights |

**Indexes:** `idx_tsunami_zones_geom` (GIST)

---

### liquefaction_zones
**Source:** GWRC ArcGIS REST API | **Records:** 502 | **Geometry:** Polygon

Wellington region liquefaction susceptibility.

| Column | Type | Description |
|--------|------|-------------|
| objectid | int4 PK | Primary key |
| geom | geometry | Zone polygon |
| liquefaction | varchar(50) | Susceptibility class ("Low", "Moderate", "High", "Very High") |
| simplified | varchar(50) | Simplified classification |

**Indexes:** `liquefaction_zones_geom_geom_idx` (GIST, ogr2ogr-created)

---

### earthquakes
**Source:** GeoNet FDSN API | **Records:** 20,029 | **Geometry:** Point

Historical earthquakes M3+ (2015-2026).

| Column | Type | Description |
|--------|------|-------------|
| event_id | text PK | GeoNet event ID |
| event_time | timestamptz | Event timestamp |
| latitude | float8 | Latitude |
| longitude | float8 | Longitude |
| depth_km | float8 | Depth (km) |
| magnitude | float8 | Magnitude |
| mag_type | text | Magnitude type |
| location_name | text | Location description |
| geom | geometry | Point location |

**Indexes:** `idx_earthquakes_geom` (GIST), `idx_earthquakes_magnitude`

---

### coastal_erosion
**Source:** NIWA ArcGIS/GeoJSON | **Records:** 1,811 | **Geometry:** LineString

National Coastal Sensitivity Index (CSI) shore segments.

| Column | Type | Description |
|--------|------|-------------|
| ogc_fid | int4 PK | Primary key |
| geom | geometry | Shore segment line |
| exposure | varchar | Exposure class ("S", "E", "S-PB", "E-PB") |
| shore_type | varchar | Shore type classification |
| csi_in | int4 | CSI score (current) |
| csi_cc | int4 | CSI score (with climate change) |

**Indexes:** `idx_coastal_erosion_geom` (GIST)

---

### wind_zones
**Source:** GWRC ArcGIS REST API | **Records:** 171 | **Geometry:** Polygon

Wellington region wind zone classifications.

| Column | Type | Description |
|--------|------|-------------|
| ogc_fid | int4 PK | Primary key |
| geom | geometry | Zone polygon |
| zone_name | varchar | Zone classification ("M", "H", "VH", "EH", "SED") |
| ta | varchar | Territorial authority |
| zone_title | varchar | Full zone name |

**Indexes:** `idx_wind_zones_geom` (GIST)

---

### wildfire_risk
**Source:** Stats NZ CSVs | **Records:** 60 | **Geometry:** Point

Fire weather station data — VHE (Very High/Extreme) fire danger days per year.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| site | text | Weather station name |
| fuel_type | text | "Forest" or "Grassland" |
| ten_year_mean | float4 | 10-year mean VHE days/year |
| quantile | text | Quantile classification |
| slope_decade | float4 | Trend slope per decade |
| trend_likelihood | text | "Very likely increasing/decreasing" |
| geom | geometry | Station location point |

**Indexes:** `idx_wildfire_geom` (GIST)

---

## 5. Environment

### noise_contours
**Source:** Waka Kotahi/NZTA ArcGIS | **Records:** 19,517 | **Geometry:** Polygon

Road traffic noise contours for Wellington region (50-70 dB LAeq24h). Some multipolygons have up to 394K points (~6.4MB each) — performance floor of ~164ms for spatial queries.

| Column | Type | Description |
|--------|------|-------------|
| ogc_fid | int4 PK | Primary key |
| geom | geometry | Noise contour polygon |
| laeq24h | int4 | 24-hour noise level in dB |

**Indexes:** `idx_noise_contours_geom` (GIST), `idx_noise_contours_laeq`

---

### air_quality_sites
**Source:** LAWA Excel (2016-2024) | **Records:** 72 | **Geometry:** Point

National air quality monitoring sites with PM10/PM2.5 trends.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| lawa_id | text UNIQUE | LAWA site identifier |
| site_name | text | Monitoring site name |
| town | text | Town/city |
| region | text | Region |
| pm10_trend | text | PM10 trend ("Improving", "Degrading", "Indeterminate") |
| pm25_trend | text | PM2.5 trend |
| geom | geometry | Site location point |

**Indexes:** `idx_air_quality_geom` (GIST)

---

### water_quality_sites
**Source:** LAWA Excel (state & trend) | **Records:** 1,175 | **Geometry:** Point

National river water quality sites with NPS-FM band ratings.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| lawa_id | text UNIQUE | LAWA site identifier |
| site_name | text | Site name |
| catchment | text | River catchment |
| region | text | Region |
| ecoli_band | text | E.coli NPS-FM band (A-E) |
| ammonia_band | text | Ammonia band |
| nitrate_band | text | Nitrate band |
| drp_band | text | DRP (dissolved reactive phosphorus) band |
| clarity_band | text | Clarity band |
| geom | geometry | Site location point |

**Indexes:** `idx_water_quality_geom` (GIST)

---

### climate_grid
**Source:** MfE / VCSN grid | **Records:** 11,491 | **Geometry:** Point

National 5km climate grid points. Joined to `climate_projections` via `agent_no`.

| Column | Type | Description |
|--------|------|-------------|
| fid | int4 PK | Primary key |
| geom | geometry | Grid point location |
| longitude | float8 | Longitude |
| latitude | float8 | Latitude |
| agent_no | int8 | VCSN agent number (joins to climate_projections.vcsn_agent) |

**Indexes:** `idx_climate_grid_geom` (GIST)

---

### climate_projections
**Source:** MfE climate change data | **Records:** 2,642,930 | **Geometry:** None

Climate change projections for each grid point. ~40 indicators x multiple scenarios/seasons.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| model | text | Climate model name |
| base_period | text | Baseline period |
| future_period | text | Future period (e.g. "2031-2050") |
| scenario | text | SSP scenario (e.g. "ssp245", "ssp585") |
| season | text | Season ("ANNUAL", "DJF", "MAM", "JJA", "SON") |
| vcsn_agent | int4 | Grid point ID (joins to climate_grid.agent_no) |
| T_value_change | float4 | Mean temperature change (C) |
| PR_value_change | float4 | Precipitation change (%) |
| FD_value_change | float4 | Frost days change |
| TX30_value_change | float4 | Hot days (>30C) change |
| *...40+ indicator columns...* | float4 | Each with _change, _base_period, _future values |

**Indexes:** `idx_climate_proj_scenario` (btree on scenario, future_period, season), `idx_climate_proj_vcsn`

---

### contaminated_land
**Source:** GWRC ArcGIS REST API | **Records:** 2,391 | **Geometry:** Polygon

Wellington region SLUR (Selected Land Use Register) contaminated sites.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| site_name | text | Site name |
| anzecc_category | text | ANZECC contamination category (HAIL activity strings) |
| anzecc_subcategory | text | ANZECC subcategory |
| category | text | Site status category |
| local_authority | text | Relevant council |
| site_history | text | Historical use description |
| geom | geometry | Site boundary polygon |

**Indexes:** `idx_cl_geom` (GIST), `idx_cl_category`, `idx_cl_la`

---

### conservation_land
**Source:** DOC Open Data GeoJSON | **Records:** 11,025 | **Geometry:** Polygon

National DOC conservation land areas.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| name | text | Area name |
| land_type | text | "Reserve", "Conservation Area", "National Park", "Marginal Strip" |
| land_status | text | Legal status |
| managing_agency | text | Managing agency |
| area_ha | numeric | Area in hectares |
| legal_name | text | Legal name |
| geom | geometry | Area boundary polygon (reprojected NZTM to WGS84) |

**Indexes:** `idx_conservation_geom` (GIST), `idx_conservation_type`

---

## 6. Liveability

### crime
**Source:** NZ Police policedata.nz | **Records:** 1,153,994 | **Geometry:** None

Victimisation data at meshblock level (2022-2025). Joined via `area_unit` name, not meshblock code (2018 vs 2023 meshblock code mismatch).

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| year_month | date | Crime period |
| day_of_week | text | Day of week |
| hour_of_day | int4 | Hour (0-23) |
| territorial_authority | text | TLA name |
| area_unit | text | Area unit name (approx SA2 name, used for joins) |
| meshblock | text | Census 2018 meshblock code |
| anzsoc_division | text | Crime type division |
| anzsoc_subdivision | text | Crime type subdivision |
| anzsoc_group | text | Crime type group |
| location_type | text | Location type |
| weapon | text | Weapon involved |
| victimisations | int4 | Number of victimisations |

**Indexes:** `idx_crime_meshblock`, `idx_crime_ta`, `idx_crime_year_month`, `idx_crime_division`

---

### nzdep
**Source:** Otago University (Excel) | **Records:** 56,382 | **Geometry:** None

NZ Deprivation Index 2023 scores by meshblock. Joined via meshblocks table spatial lookup.

| Column | Type | Description |
|--------|------|-------------|
| mb2023_code | varchar(7) PK | Meshblock 2023 code |
| nzdep2023 | int4 | Deprivation decile (1=least, 10=most deprived) |
| nzdep2023_score | numeric | Raw deprivation score |
| sa12023_code | varchar(9) | SA1 2023 code |

---

### schools
**Source:** Ministry of Education | **Records:** 2,568 | **Geometry:** Point

NZ schools directory with quality indicators and demographics.

| Column | Type | Description |
|--------|------|-------------|
| school_id | int4 PK | MoE school ID |
| org_name | text | School name |
| org_type | text | "Full Primary", "Secondary", etc. |
| authority | text | "State", "State Integrated", "Private" |
| eqi_index | int4 | Equity Index (replaces decile, 1=most disadvantaged) |
| total_roll | int4 | Total student roll |
| coed_status | text | "Co-Ed", "Boys", "Girls" |
| enrolment_scheme | text | "Has scheme" or null |
| latitude | float8 | Latitude |
| longitude | float8 | Longitude |
| geom | geometry | School location point |
| *...30+ demographic/contact columns...* | | See raw schema |

**Indexes:** `idx_schools_geom` (GIST)

---

### school_zones
**Source:** MoE via ArcGIS FeatureServer | **Records:** 1,317 | **Geometry:** Polygon

School enrolment zone boundaries. Used with `ST_Contains()` to check if a property is in a school's zone.

| Column | Type | Description |
|--------|------|-------------|
| ogc_fid | int4 PK | Primary key |
| geom | geometry | Zone boundary polygon |
| school_id | int4 | MoE school ID (joins to schools table) |
| school_name | varchar | School name |
| institution_type | varchar | School type |

**Indexes:** `idx_school_zones_geom` (GIST), `idx_school_zones_school_id`

---

### transit_stops
**Source:** Greater Wellington GTFS | **Records:** 3,119 | **Geometry:** Point

Metlink public transport stops (bus, rail, ferry) for Wellington region.

| Column | Type | Description |
|--------|------|-------------|
| stop_id | text PK | GTFS stop ID |
| stop_name | text | Stop name |
| stop_lat | float8 | Latitude |
| stop_lon | float8 | Longitude |
| zone_id | text | Fare zone |
| location_type | int4 | 0=stop, 1=station |
| geom | geometry | Stop location point |

**Indexes:** `idx_transit_stops_geom` (GIST)

---

### crashes
**Source:** Waka Kotahi NZTA CAS | **Records:** 903,973 | **Geometry:** Point

NZ crash analysis system data. Reprojected from NZTM to WGS84.

| Column | Type | Description |
|--------|------|-------------|
| objectid | int4 PK | CAS object ID |
| crash_year | int4 | Year of crash |
| crash_severity | text | "Fatal Crash", "Serious Crash", "Minor Crash", "Non-Injury Crash" |
| fatal_count | int4 | Fatal casualties |
| serious_injury_count | int4 | Serious injuries |
| speed_limit | int4 | Posted speed limit |
| urban | text | "Urban" or "Open" |
| geom | geometry | Crash location point |
| *...20+ vehicle/road/weather columns...* | | See raw schema |

**Indexes:** `idx_crashes_geom` (GIST), `idx_crashes_severity`, `idx_crashes_year`

**Warning:** Large table — always use `&& ST_Expand()` bbox pre-filter before `ST_DWithin()`.

---

### heritage_sites
**Source:** Heritage NZ Algolia API | **Records:** 7,360 | **Geometry:** Point

Heritage NZ listed places.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| list_number | int4 UNIQUE | Heritage NZ list number |
| name | text | Heritage place name |
| list_entry_type | text | "Historic Place Category 1/2", "Historic Area", "Wahi Tapu" |
| list_entry_status | text | Listing status |
| address | text | Address |
| district_council | text | Relevant council |
| region | text | Region |
| geom | geometry | Location point |

**Indexes:** `idx_heritage_geom` (GIST), `idx_heritage_type`

---

### osm_amenities
**Source:** Geofabrik NZ PBF (osmium extract) | **Records:** 94,991 | **Geometry:** Point

OpenStreetMap points of interest — restaurants, shops, parks, healthcare, etc.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| osm_id | int8 | OpenStreetMap node ID |
| name | text | Amenity name |
| category | text | "amenity", "shop", "tourism", "leisure", "healthcare" |
| subcategory | text | Specific type (e.g. "restaurant", "supermarket", "pharmacy") |
| brand | text | Brand name |
| opening_hours | text | Opening hours |
| phone | text | Phone number |
| website | text | Website URL |
| geom | geometry | Location point |

**Indexes:** `idx_osm_amenities_geom` (GIST), `idx_osm_amenities_category`, `idx_osm_amenities_subcategory`

---

## 7. Planning & Infrastructure

### district_plan_zones
**Source:** WCC 2024 District Plan ArcGIS | **Records:** 2,683 | **Geometry:** Polygon

Wellington City 2024 NPS-UD compliant zoning. 14 zone types.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| zone_name | text | Zone name (e.g. "City Centre Zone", "Medium Density Residential Zone") |
| zone_code | text | Zone code (e.g. "CCZ", "MRZ") |
| category | text | Zone category |
| chapter | text | District plan chapter reference |
| eplan_url | text | Link to district plan |
| council | text | Council code (default "WCC") |
| geom | geometry | Zone polygon |

**Indexes:** `idx_dpz_geom` (GIST), `idx_dpz_zone`, `idx_dpz_code`

---

### height_controls
**Source:** WCC 2024 District Plan ArcGIS | **Records:** 2,365 | **Geometry:** Polygon

Maximum building height limits per area. Wellington City only.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| height_metres | float8 | Maximum allowed height (m) |
| zone_name | text | Associated zone name |
| zone_code | text | Zone code |
| name | text | Control area name |
| council | text | Council code (default "WCC") |
| geom | geometry | Control area polygon |

**Indexes:** `idx_hc_geom` (GIST), `idx_hc_height`, `idx_hc_zone`

---

### resource_consents
**Source:** GWRC ArcGIS REST API | **Records:** 26,507 | **Geometry:** Point

Wellington region RMA resource consents (nightly updates).

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| consent_id | text | Consent reference |
| consent_type | text | "Land Use", "Discharge", "Water", "Coastal" |
| status | text | Consent status |
| commencement_date | text | Start date |
| expired_date | text | Expiry date |
| purpose_desc | text | Purpose description |
| geom | geometry | Location point |

**Indexes:** `idx_rc_geom` (GIST), `idx_rc_type`, `idx_rc_status`

---

### infrastructure_projects
**Source:** Te Waihanga Pipeline (10 quarterly files) | **Records:** 13,944 | **Geometry:** Point (where geocoded)

National infrastructure project pipeline. 1,935 geocoded with lat/lng.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| primary_key | text UNIQUE | Te Waihanga project key |
| project_name | text | Project name |
| description | text | Project description |
| project_status | text | Status (e.g. "Under Construction", "Planning") |
| sector | text | Infrastructure sector |
| region | text | Region |
| city | text | City |
| value_range | text | Cost range (e.g. "$100M-$250M", "$1B-$5B") |
| geom | geometry | Project location (null if not geocoded) |
| *...15+ scheduling/procurement columns...* | | See raw schema |

**Indexes:** `idx_infra_geom` (GIST), `idx_infra_region`, `idx_infra_sector`, `idx_infra_status`, `idx_infra_city`, `idx_infra_suburb`

---

### earthquake_prone_buildings
**Source:** WCC ForwardWorks ArcGIS | **Records:** 544 | **Geometry:** Point

Wellington City earthquake-prone buildings with MBIE register links.

| Column | Type | Description |
|--------|------|-------------|
| id | int4 PK | Auto-increment primary key |
| address | text | Building address |
| epbr_url | text | Link to MBIE EPB register |
| council | text | Council code (default "WCC") |
| geom | geometry | Building location point |

**Indexes:** `idx_epb_geom` (GIST)

---

### transmission_lines
**Source:** Transpower ArcGIS/GeoJSON | **Records:** 227 | **Geometry:** LineString

National high-voltage transmission lines.

| Column | Type | Description |
|--------|------|-------------|
| ogc_fid | int4 PK | Primary key |
| geom | geometry | Line geometry |
| designvolt | varchar | Design voltage (e.g. "220kV", "110kV") |
| status | varchar | Line status |
| description | varchar | Line description |
| type | varchar | Line type |

**Indexes:** `idx_transmission_lines_geom` (GIST)

---

## 8. Geographic Boundaries

### meshblocks
**Source:** Stats NZ datafinder | **Records:** 57,539 | **Geometry:** Polygon

Census 2023 meshblock boundaries. Smallest geographic unit. Joined to `nzdep` for deprivation scoring.

| Column | Type | Description |
|--------|------|-------------|
| fid | int4 PK | Primary key |
| geom | geometry | Meshblock polygon |
| mb2023_code | varchar(7) | Meshblock 2023 code |
| landwater | varchar(10) | "Inland water", "Land", etc. |
| land_area_sq_km | float8 | Land area (km2) |
| area_sq_km | float8 | Total area (km2) |

**Indexes:** `idx_meshblocks_geom` (GIST)

---

### sa2_boundaries
**Source:** Eagle Technology / Stats NZ ArcGIS | **Records:** 2,171 | **Geometry:** Polygon

SA2 (Statistical Area 2) 2018 boundaries. The geographic unit for rental market data.

| Column | Type | Description |
|--------|------|-------------|
| ogc_fid | int4 PK | Primary key |
| geom | geometry | SA2 polygon |
| sa2_code | varchar UNIQUE | SA2 2018 code (joins to bonds_detailed.location_id) |
| sa2_name | varchar | SA2 name |
| regc_code | varchar | Regional council code |
| regc_name | varchar | Regional council name |
| ta_code | varchar | TLA code |
| ta_name | varchar | TLA name |
| land_area_sq_km | float8 | Land area (km2) |

**Indexes:** `idx_sa2_code` (UNIQUE), `sa2_boundaries_geom_geom_idx` (GIST), `idx_sa2_ta`, `idx_sa2_regc`

---

## 9. AI & Cache

### area_profiles
**Source:** Azure OpenAI GPT-4o-mini (batch generated) | **Records:** 0 (not yet populated) | **Geometry:** None

Pre-generated AI suburb descriptions. One per SA2.

| Column | Type | Description |
|--------|------|-------------|
| sa2_code | text PK | SA2 code (FK to sa2_boundaries) |
| sa2_name | text | SA2 name |
| ta_name | text | TLA name |
| profile | text | AI-generated suburb description (3-5 sentences) |
| data_snapshot | jsonb | Data fed to the model (for regeneration) |
| model_used | text | Model name (default "gpt-4o-mini") |
| generated_at | timestamptz | Generation timestamp |

---

## 10. Application Tables

Created by `09-application-tables.sql`. Not spatial data — these support user features.

### user_rent_reports
Crowdsourced per-building rent data submitted by users.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| address_id | BIGINT NOT NULL | FK to addresses(address_id) |
| building_address | TEXT | Base street address (e.g. "30 Taranaki Street") |
| sa2_code | VARCHAR(10) | For area-level fallback |
| dwelling_type | VARCHAR(20) NOT NULL | House/Flat/Apartment/Room |
| bedrooms | VARCHAR(5) NOT NULL | 1/2/3/4/5+ |
| reported_rent | INTEGER NOT NULL | $/week |
| is_outlier | BOOLEAN | Default FALSE |
| reported_at | TIMESTAMPTZ | Default NOW() |
| ip_hash | VARCHAR(64) | SHA-256 of IP for rate limiting only |
| source | VARCHAR(20) | web/share/api (default 'web') |

**Indexes:** `idx_rent_reports_address`, `idx_rent_reports_building`, `idx_rent_reports_sa2`, `idx_rent_reports_reported_at`

---

### feedback
Bug reports, feature requests, general feedback.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| type | VARCHAR(20) NOT NULL | bug/feature/general |
| description | TEXT NOT NULL | Feedback content |
| context | TEXT | What user was doing |
| page_url | TEXT | Page URL |
| property_address | TEXT | Related property |
| importance | VARCHAR(20) | low/medium/high/critical (for bugs) |
| satisfaction | INTEGER | 1-5 (for general feedback) |
| email | VARCHAR(255) | Optional contact email |
| browser_info | JSONB | User agent, screen size, etc. |
| screenshot_url | TEXT | Screenshot |
| created_at | TIMESTAMPTZ | Default NOW() |
| status | VARCHAR(20) | new/reviewed/resolved/wontfix |

**Indexes:** `idx_feedback_type`, `idx_feedback_status`, `idx_feedback_created`

---

### email_signups
Out-of-coverage region notification signups.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| email | VARCHAR(255) NOT NULL | Email address |
| requested_region | TEXT | e.g. "Auckland", "Christchurch" |
| created_at | TIMESTAMPTZ | Default NOW() |

**Index:** `idx_email_signups_email`

---

### data_sources
Metadata for DataSourceBadge.tsx — tracks provenance, license, and freshness per dataset.

| Column | Type | Description |
|--------|------|-------------|
| table_name | TEXT PK | Table name in wharescore DB |
| source_name | TEXT NOT NULL | Data provider name |
| source_url | TEXT | Provider URL |
| license | TEXT | License (e.g. "CC BY 4.0") |
| last_updated | DATE | When the data was last refreshed |
| update_frequency | TEXT | 'daily', 'monthly', 'quarterly', 'annually', 'static' |

**Seed data:** 9 rows (addresses, parcels, building_outlines, flood_zones, crime, bonds_detailed, council_valuations, schools, osm_amenities)

---

### admin_content
Editable application content managed via admin portal (banner messages, demo addresses, FAQ).

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PK | Content key (e.g. "banner", "demo_addresses", "faq") |
| value | JSONB NOT NULL | Content payload (structure varies by key) |
| updated_at | TIMESTAMPTZ | Last modification time |

**Seed data:** 3 rows (banner, demo_addresses, faq)

---

## 11. Materialized Views

All materialized views should be refreshed when underlying data changes:

```sql
REFRESH MATERIALIZED VIEW mv_crime_density;
REFRESH MATERIALIZED VIEW mv_crime_ta;
REFRESH MATERIALIZED VIEW mv_rental_market;
REFRESH MATERIALIZED VIEW mv_rental_trends;
REFRESH MATERIALIZED VIEW mv_sa2_valuations;
```

### mv_crime_density
**Records:** 1,926 | **Refresh:** Manual / pg_cron weekly

Crime density per area unit. Primary crime indicator for risk scoring.

| Column | Type | Description |
|--------|------|-------------|
| area_unit | text | Area unit name (joins to crime.area_unit) |
| ta | text | Territorial authority |
| crime_count_3yr | int4 | Distinct crime records (3 years) |
| victimisations_3yr | int4 | Total victimisations (3 years) |
| crime_count_1yr | int4 | Distinct crime records (1 year) |
| percentile_rank | float8 | Percentile rank within TA (0-1) |

**Indexes:** `idx_mv_crime_au` (UNIQUE on area_unit, ta), `idx_mv_crime_ta`

---

### mv_crime_ta
**Records:** 67

TA-level crime aggregates for context/comparison.

| Column | Type | Description |
|--------|------|-------------|
| ta | text | Territorial authority |
| victimisations_3yr | int4 | Total victimisations (3 years) |
| area_count | int4 | Number of area units |
| avg_victimisations_per_au | numeric | Average per area unit |
| median_victimisations_per_au | float8 | Median per area unit |

**Index:** `idx_mv_crime_ta_pk` (UNIQUE on ta)

---

### mv_rental_market
**Records:** 8,442

Latest quarter rental market snapshot per SA2/dwelling/beds combination.

| Column | Type | Description |
|--------|------|-------------|
| sa2_code | text | SA2 code |
| dwelling_type | text | Dwelling type |
| number_of_beds | text | Bedroom count |
| median_rent | numeric | Median weekly rent |
| lower_quartile_rent | numeric | Lower quartile |
| upper_quartile_rent | numeric | Upper quartile |
| geometric_mean_rent | numeric | Geometric mean rent |
| total_bonds | int4 | Bond count |
| active_bonds | int4 | Active bonds |
| quarter | date | Data quarter |
| prev_year_median | numeric | Previous year median |
| yoy_pct | numeric | Year-on-year change (%) |
| sa2_name | varchar | SA2 name |
| ta_name | varchar | TLA name |

**Indexes:** `idx_mv_rental_sa2`, `idx_mv_rental_type` (dwelling_type, number_of_beds)

---

### mv_rental_trends
**Records:** 26,459

CAGR (Compound Annual Growth Rate) trends for each SA2/dwelling/beds combination.

| Column | Type | Description |
|--------|------|-------------|
| sa2_code | text | SA2 code |
| dwelling_type | text | Dwelling type |
| number_of_beds | text | Bedroom count |
| current_median | numeric | Current median rent |
| current_quarter | date | Latest data quarter |
| yoy_pct | numeric | Year-on-year change (%) |
| cagr_3yr | numeric | 3-year compound annual growth rate |
| cagr_5yr | numeric | 5-year CAGR |
| cagr_10yr | numeric | 10-year CAGR |

**Indexes:** `idx_mv_trends_sa2`, `idx_mv_trends_combo` (sa2_code, dwelling_type, number_of_beds)

---

### mv_sa2_valuations
**Records:** 78

Wellington City SA2-level valuation statistics from council_valuations.

| Column | Type | Description |
|--------|------|-------------|
| sa2_code | varchar | SA2 code |
| sa2_name | varchar | SA2 name |
| ta_name | varchar | TLA name |
| property_count | int8 | Properties in SA2 |
| with_cv | int8 | Properties with CV data |
| cv_q1 | float8 | Capital value 25th percentile |
| cv_median | float8 | Capital value median |
| cv_q3 | float8 | Capital value 75th percentile |
| cv_mean | numeric | Capital value mean |
| lv_median | float8 | Land value median |
| lv_per_sqm_median | float8 | Land value per m2 median |
| avg_improvement_ratio | numeric | Average (CV-LV)/CV ratio |

**Index:** `idx_mv_sa2_val_code`

---

## 12. Views

16 spatial lookup views + 1 deprivation join view. Each spatial view uses LATERAL subqueries hitting GIST indexes. Designed for single-address lookups via `WHERE address_id = ?`.

| View | Key Columns | Spatial Join |
|------|-------------|-------------|
| `v_address_hazards` | flood_label, tsunami_zone_class, tsunami_evac_zone, liquefaction_class, wind_zone, coastal_exposure | ST_Intersects + ST_DWithin |
| `v_address_earthquakes` | earthquake_count_30km | ST_DWithin 30km, M4+, 10yr |
| `v_address_epb` | epb_count_300m | ST_DWithin 300m + bbox |
| `v_address_wildfire` | vhe_days, wildfire_trend | KNN nearest station |
| `v_address_noise` | road_noise_db | ST_Intersects |
| `v_address_air_quality` | air_site_name, pm10_trend, pm25_trend, air_distance_m | KNN nearest site |
| `v_address_water_quality` | water_site_name, ecoli_band, ammonia_band, nitrate_band, drp_band, clarity_band, water_distance_m | KNN nearest site |
| `v_address_climate` | temp_change, precip_change_pct, frost_day_change, hot_day_change | KNN nearest grid point, then climate_projections |
| `v_address_nzdep` | nzdep_decile | ST_Within meshblock |
| `v_address_planning` | zone_name, zone_code, zone_category, max_height_m | ST_Intersects |
| `v_address_sa2` | sa2_code, sa2_name, ta_name | ST_Within |
| `v_address_title` | title_no, estate_description, title_type, number_owners | ST_DWithin 15m |
| `v_address_valuation` | capital_value, land_value, improvements_value, cv_land_area, cv_date, cv_council | ST_DWithin 30m |
| `v_address_building` | building_use, footprint_sqm | ST_DWithin 15m |
| `v_address_contamination` | contam_site_name, anzecc_category, contam_distance_m, contam_count_2km | ST_DWithin 2km |
| `v_address_transmission` | designvolt, line_description, transmission_distance_m | ST_DWithin 200m |
| `meshblock_deprivation` | mb2023_code, nzdep2023, nzdep2023_score | Inner join meshblocks x nzdep |

---

## 13. Report Function

### get_property_report(p_address_id BIGINT) -> JSONB

Single PL/pgSQL function returning a full property report as JSONB. Defined in `07-report-function.sql`.

**Performance:** ~289ms warm (noise contours are the bottleneck at ~164ms due to complex multipolygons)

**Key optimizations:**
- `ST_Contains(geom, point)` for building outlines and property titles (3.2M and 2.4M rows) — avoids geography cast
- `geom && addr.geom` bounding-box pre-filter before `ST_Contains`
- All queries use LATERAL subqueries — each hits its own GIST index independently
- `STABLE` function marking allows query planner caching within a transaction

### JSON Output Structure

```json
{
  "address": {
    "address_id", "full_address", "suburb", "city", "unit_type",
    "sa2_code", "sa2_name", "ta_name", "lng", "lat"
  },
  "property": {
    "footprint_sqm", "building_use", "title_no", "estate_description",
    "title_type", "capital_value", "land_value", "improvements_value",
    "cv_land_area", "cv_date", "cv_council", "multi_unit"
  },
  "hazards": {
    "flood", "tsunami_zone_class", "tsunami_evac_zone", "liquefaction",
    "wind_zone", "coastal_exposure", "earthquake_count_30km",
    "wildfire_vhe_days", "wildfire_trend", "epb_count_300m"
  },
  "environment": {
    "road_noise_db",
    "air_site_name", "air_pm10_trend", "air_pm25_trend", "air_distance_m",
    "water_site_name", "water_ecoli_band", "water_ammonia_band",
    "water_nitrate_band", "water_drp_band", "water_clarity_band", "water_distance_m",
    "climate_temp_change", "climate_precip_change_pct",
    "contam_nearest_name", "contam_nearest_category",
    "contam_nearest_distance_m", "contam_count_2km"
  },
  "liveability": {
    "nzdep_decile",
    "crime_area_unit", "crime_victimisations", "crime_percentile",
    "crime_city_median_vics", "crime_city_total_vics", "crime_city_area_count",
    "schools_1500m": [{"name", "type", "eqi", "roll", "distance_m", "in_zone"}],
    "transit_stops_400m", "nearest_train_name", "nearest_train_distance_m",
    "cbd_distance_m",
    "crashes_300m_serious", "crashes_300m_fatal", "crashes_300m_total",
    "heritage_count_500m",
    "amenities_500m": {"cafe": N, "restaurant": N, ...},
    "nearest_supermarket" (brand-priority: Woolworths/New World/PAK'nSAVE/FreshChoice/SuperValue/Four Square, 5km radius),
    "nearest_gp", "nearest_pharmacy",
    "conservation_nearest", "conservation_nearest_type", "conservation_nearest_distance_m"
  },
  "planning": {
    "zone_name", "zone_code", "zone_category", "max_height_m",
    "heritage_listed", "contaminated_listed", "epb_listed",
    "resource_consents_500m_2yr",
    "infrastructure_5km": [{"name", "sector", "status", "value_range", "distance_m"}],
    "transmission_line_distance_m"
  },
  "market": {
    "sa2_code", "sa2_name",
    "rental_overview": [{"dwelling_type", "beds", "median", "lq", "uq", "bonds", "yoy_pct"}],
    "trends": [{"dwelling_type", "beds", "current_median", "yoy_pct", "cagr_3yr", "cagr_5yr", "cagr_10yr"}],
    "hpi_latest": {"quarter", "hpi", "sales", "stock_value_m"}
  }
}
```

---

## 14. TOAST & Performance

Defined in `08-toast-and-cleanup.sql`. Forces EXTERNAL (inline, uncompressed) TOAST storage on polygon geometry columns for faster spatial joins (~5x per Paul Ramsey's benchmarks):

**Tables with TOAST EXTERNAL:** parcels, building_outlines, flood_zones, tsunami_zones, liquefaction_zones, district_plan_zones, council_valuations, conservation_land, noise_contours, wind_zones, school_zones, meshblocks, sa2_boundaries

**GIST indexes created (replacements for ogr2ogr duplicates):**

| Index | Table |
|-------|-------|
| `idx_building_outlines_geom` | building_outlines |
| `idx_property_titles_geom` | property_titles |
| `idx_tsunami_zones_geom` | tsunami_zones |
| `idx_flood_zones_geom` | flood_zones |

**13 ogr2ogr duplicate indexes dropped:** `*_geom_geom_idx` for addresses, meshblocks, noise_contours, coastal_erosion, wind_zones, tsunami_zones, transmission_lines, school_zones, climate_grid, parcels, property_titles, building_outlines, flood_zones

**Remaining ogr2ogr GIST indexes (not dropped):** `liquefaction_zones_geom_geom_idx`, `sa2_boundaries_geom_geom_idx`

**Extensions:** `postgis` (spatial), `pg_trgm` (trigram fuzzy search)

---

## 15. Spatial Strategy Reference

| Strategy | Used By | Why |
|----------|---------|-----|
| `ST_Intersects(geom, point)` | Flood, tsunami, liquefaction, wind, noise, district plan, height | Polygon containment — exact overlay |
| `ST_Within(point, geom)` | Meshblocks, SA2, school zones | Point-in-polygon — equivalent for these |
| `ST_DWithin(geography, geography, distance)` | Coastal (2km), EPB (300m), contaminated (2km), transmission (200m), crashes (300m), transit (400m), schools (1.5km), buildings (15m), titles (15m), valuations (30m) | Proximity search with distance threshold |
| `ST_Contains(geom, point)` | Building outlines, property titles (in report function only) | Optimized point-in-polygon for large tables (3.2M, 2.4M rows) |
| `ORDER BY geom <-> point LIMIT 1` | Air quality, water quality, wildfire, climate grid, conservation | Nearest-neighbour using GIST KNN operator |
| `geom && ST_Expand(point, N)` | All proximity queries | Bounding-box pre-filter for GIST index hit |
