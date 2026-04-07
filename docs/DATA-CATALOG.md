# WhareScore Data Catalog

> Source of truth for all datasets, tables, and data integrations.
> Agents: search by table name, council name, or category. Update this file when adding/changing data.

---

## Live Rates APIs
<!-- UPDATE: When adding a new council rates module, add a row here. -->

25 councils. Live rates are now fetched lazily via `GET /property/{id}/rates` (unified router in `routers/rates.py`). CV no longer blocks the report endpoint — DB value shown first, live value updates inline. `snapshot_generator.py` (~line 309-470) still calls rates directly for snapshot generation.

| # | Council | Module file | City match (lowercase) | Endpoint type | CV | LV | IV | Rates |
|---|---------|------------|----------------------|--------------|:--:|:--:|:--:|:-----:|
| 1 | Wellington | `rates.py` | wellington | WCC API + wcc_rates_cache | Y | Y | Y | Y |
| 2 | Auckland | `auckland_rates.py` | auckland | AC rates API | Y | Y | Y | Y |
| 3 | Lower Hutt | `hcc_rates.py` | lower hutt | ArcGIS MapServer | Y | Y | Y | Y |
| 4 | Upper Hutt | `uhcc_rates.py` | upper hutt | ArcGIS Online | Y | - | - | Y |
| 5 | Porirua | `pcc_rates.py` | porirua | ArcGIS MapServer | Y | Y | Y | - |
| 6 | Kapiti Coast | `kcdc_rates.py` | kapiti, paraparaumu, waikanae, otaki | ArcGIS MapServer | Y | Y | Y | - |
| 7 | Horowhenua | `hdc_rates.py` | horowhenua, levin, foxton | ArcGIS MapServer | Y | Y | Y | - |
| 8 | Hamilton | `hamilton_rates.py` | hamilton | ArcGIS FeatureServer | Y | Y | Y | - |
| 9 | Dunedin | `dcc_rates.py` | dunedin | ArcGIS MapServer | Y | - | - | - |
| 10 | Christchurch | `ccc_rates.py` | christchurch | CCC API + cache | Y | Y | Y | Y |
| 11 | New Plymouth | `taranaki_rates.py` | new plymouth | ArcGIS FeatureServer | Y | Y | Y | - |
| 12 | Tasman | `tasman_rates.py` | richmond, motueka, takaka, mapua | ArcGIS MapServer | Y | Y | Y | - |
| 13 | Tauranga | `tcc_rates.py` | tauranga, mount maunganui | ArcGIS 2-step | Y | Y | Y | Y |
| 14 | Western BOP | `wbop_rates.py` | katikati, te puke, waihi beach, ōmokoroa, paengaroa, western bay | ArcGIS 3-layer | Y | Y | Y | - |
| 15 | Palmerston Nth | `pncc_rates.py` | palmerston | ArcGIS Online | Y | Y | - | Y |
| 16 | Whangarei | `wdc_rates.py` | whangarei, whangārei | ArcGIS MapServer | Y | Y | Y | - |
| 17 | Queenstown | `qldc_rates.py` | queenstown, wanaka, arrowtown, frankton, cromwell, alexandra | ArcGIS FeatureServer | Y | Y | Y | - |
| 18 | Invercargill | `icc_rates.py` | invercargill | ArcGIS MapServer | Y | Y | Y | - |
| 19 | Hastings | `hastings_rates.py` | hastings, havelock north, flaxmere | ArcGIS MapServer | Y | Y | Y | - |
| 20 | Gisborne | `gdc_rates.py` | gisborne | ArcGIS Online | Y | Y | Y | Y |
| 21 | Nelson | `ncc_rates.py` | nelson | MagiqCloud scraping | Y | Y | Y | Y |
| 22 | Rotorua | `rlc_rates.py` | rotorua | ArcGIS Online | Y | Y | Y | Y |
| 23 | Timaru | `timaru_rates.py` | timaru, temuka, geraldine | ArcGIS MapServer | Y | Y | Y | - |
| 24 | Marlborough | `mdc_rates.py` | blenheim, marlborough, picton, renwick | ArcGIS MapServer | Y | Y | Y | - |
| 25 | Whanganui | `wdc_whanganui_rates.py` | whanganui, wanganui | GeoServer WFS 2-step | Y | Y | Y | - |

**Not covered:** Napier (no public API — uses bulk council_valuations fallback)

---

## GTFS Transit
<!-- UPDATE: When adding a new GTFS city, add a row here and update REGIONAL_DESTINATIONS in data_loader.py. -->

12 cities. Data in `transit_stops` + `transit_travel_times` + `transit_stop_frequency` (regional), `at_stops/*` (Auckland), `metlink_stops` (Wellington). Query chain: `get_property_report()` SQL → metlink only → `_overlay_transit_data()` Python → `get_transit_data()` SQL → metlink → AT → regional.

| City | DataSource key | GTFS URL | Stops | Destinations | Travel times |
|------|---------------|----------|-------|-------------|-------------|
| Auckland | `at_gtfs` | `https://gtfs.at.govt.nz/gtfs.zip` | 7,023 | 11 | ~6,800 |
| Wellington | `metlink_gtfs` | `https://static.opendata.metlink.org.nz/v1/gtfs/full.zip` | 3,154 | 12 | ~7,200 |
| Hamilton | `hamilton_gtfs` | `https://wrcscheduledata.blob.core.windows.net/wrcgtfs/busit-nz-public.zip` | 1,570 | 9 | 2,568 |
| Tauranga/BOP | `tauranga_bop_gtfs` | `https://data.trilliumtransit.com/gtfs/boprc-nz/boprc-nz.zip` | 1,198 | 10 | 1,130 |
| Dunedin | `dunedin_gtfs` | `https://www.orc.govt.nz/transit/google_transit.zip` | 907 | 8 | 2,374 |
| Hawke's Bay | `hawkes_bay_gtfs` | `https://data.trilliumtransit.com/gtfs/hbrc-nz/hbrc-nz.zip` | 461 | 8 | 868 |
| Palmerston Nth | `palmerston_north_gtfs` | `https://www.horizons.govt.nz/HRC/media/Data/files/tranzit/HRC_GTFS_Production.zip` | 885 | 6 | 808 |
| Nelson | `nelson_gtfs` | `https://data.trilliumtransit.com/gtfs/nsn-nz/nsn-nz.zip` | 231 | 6 | 580 |
| Rotorua | `rotorua_gtfs` | `https://data.trilliumtransit.com/gtfs/boprc-nz/boprc-nz.zip` | 1,198 | 6 | 376 |
| Whangarei | `whangarei_gtfs` | `https://data.trilliumtransit.com/gtfs/nrc-nz/nrc-nz.zip` | 273 | 6 | 354 |
| Taranaki | `taranaki_gtfs` | `https://data.trilliumtransit.com/gtfs/trc-nz/trc-nz.zip` | 386 | 6 | 326 |
| Queenstown | `queenstown_gtfs` | `https://www.orc.govt.nz/transit/google_transit.zip` | 907 | 7 | 248 |

**Not covered:** Christchurch (GTFS needs API key from apidevelopers.metroinfo.co.nz), Invercargill (no GTFS feed)

---

## Major Database Tables
<!-- UPDATE: When creating a new table, add it here with columns and source. -->

**126 tables total.** Only tables with >100 rows or referenced by report function listed. Full schema: `docs/table_schemas.txt`. Note: `_fetch_url()` returns bytes — decode with `utf-8-sig` for CSV sources (BOM handling). Martin tile functions use `ST_TileEnvelope` (EPSG:3857) — filter with `ST_Transform(bounds, 4326)` and output with `ST_Transform(geom, 3857)` since our tables store 4326. Functions are `CREATE OR REPLACE` — editing the migration file alone won't update prod. Must re-run the SQL manually or restart after re-applying. Notable places limits cafes/restaurants to 15 per tile. Includes schools from `schools` table (2,568), museums, galleries, cinemas, theatres, fuel, banks, fitness centres. Priority tiers: essentials(1) > health(2) > culture/green(3) > community(4) > services(5) > food(6).

| Table | ~Rows | Key columns | Populated by | Queried by |
|-------|-------|------------|-------------|-----------|
| addresses | 2.4M | address_id, full_address, suburb_locality, town_city, geom, search_vector | LINZ bulk | Everything (PK for all spatial) |
| flood_hazard | 6.1M | hazard_type, hazard_ranking, source_council, geom | 63 council DataSources | `get_property_report()` → hazards.council_flood_* |
| parcels | 4.3M | geom | LINZ Parcels | Parcel boundary rendering |
| building_outlines | 3.2M | use, geom (footprint) | LINZ Building Outlines | `get_property_report()` → property.footprint_sqm |
| climate_projections | 2.6M | 61 climate variables per grid cell | NIWA | `get_property_report()` → environment.climate_* |
| property_titles | 2.4M | title_no, estate_description, geom | LINZ Titles | `get_property_report()` → property.title_* |
| council_valuations | 1.7M | capital_value, land_value, improvements_value, geom | 40+ council DataSources | `get_property_report()` → property.capital_value (base, before live API override) |
| bonds_detailed | 1.2M | sa2_code, dwelling_type, bedrooms, median_rent, quarter_end | MBIE Tenancy Bonds | Market endpoint, rent advisor, snapshot rent_baselines |
| crime | 1.2M | year_month, meshblock, anzsoc_*, victimisations | NZ Police | `get_property_report()` → liveability.crime_*, crime-trend |
| crashes | 904K | crash_year, crash_severity, geom | Waka Kotahi CAS | `get_property_report()` → liveability.crashes_300m |
| slope_failure | 470K | lskey, severity, source_council, geom | GWRC + ~6 council DataSources | `get_property_report()` → hazards.council_slope_severity (all cities) + hazards.gwrc_slope_severity (Wellington) |
| liquefaction_detail | ~50K | liquefaction, simplified, source_council, geom | GWRC + ~16 council DataSources | `get_property_report()` → hazards.council_liquefaction (all cities) + hazards.gwrc_liquefaction (Wellington) |
| tsunami_hazard | ~10K | name, hazard_ranking, scenario, return_period, layer_id, source_council, geom | WCC + ~12 council DataSources | `get_property_report()` → hazards.council_tsunami_ranking (all cities) + hazards.wcc_tsunami_return_period (Wellington) |
| landslide_susceptibility | ~5K | accuracy, type, source_council, geom | GWRC + Auckland DataSources | `get_property_report()` → hazards.landslide_susceptibility_rating (worst rating) |
| district_plan_zones | 198K | zone_name, zone_code, category, source_council, geom | 20+ council DataSources | `get_property_report()` → planning.zone_* |
| noise_contours | 228K | laeq24h, geom | Waka Kotahi NZTA | `get_property_report()` → liveability.noise_db |
| osm_amenities | 95K | name, subcategory, brand, geom | OpenStreetMap | nearby/highlights, snapshot nearby_highlights |
| schools | 2,568 | name, type, decile, eqi_rating, roll, geom | MoE | `get_property_report()` → liveability.school_count |
| active_faults | 10.3K | fault_name, fault_class, slip_rate, geom | GNS Science | `get_property_report()` → hazards.active_fault_nearest |
| heritage_sites | 7,360 | name, category, geom | Heritage NZ + councils | `get_property_report()` → planning.heritage_count |
| transit_stops | 11.1K | stop_id, stop_name, mode_type, source, geom | Regional GTFS | `get_transit_data()` → liveability.bus/rail/ferry_stops |
| transit_travel_times | 16.2K | stop_id, destination, min_minutes, route_names, peak_window | Regional GTFS | `get_transit_data()` → liveability.transit_travel_times |
| metlink_stops | 3,154 | stop_id, route_types[], geom | Metlink GTFS | `get_property_report()` SQL (Wellington direct) |
| census_demographics | ~2,400 | sa2_code, population_2023, median_age, ethnicity_*, born_* | Stats NZ Census 2023 ArcGIS | `prefetch_property_data()` → snapshot.census_demographics |
| census_households | ~2,400 | sa2_code, income_median, tenure_*, vehicles_*, internet_*, rent_median | Stats NZ Census 2023 ArcGIS | `prefetch_property_data()` → snapshot.census_households |
| census_commute | ~2,300 | sa2_code, work_at_home, drive_private, public_bus, train, bicycle, walk_or_jog | Stats NZ Census 2023 CSV | `prefetch_property_data()` → snapshot.census_commute |
| climate_normals | ~720 | location_name, ta_name, month, temp_mean/max/min, precipitation_mm, rain_days, wind_speed_mean | Open-Meteo Climate API (2010-2019 daily → monthly avg). sunshine_hours not available. | `prefetch_property_data()` → snapshot.climate_normals |
| business_demography | ~2,300 | sa2_code, employee_count_2024, business_count_2024, employee_growth_pct | Stats NZ Business Demography 2024 ArcGIS | `prefetch_property_data()` → snapshot.business_demography |
| fibre_coverage | ~2,000 | sfa_name, provider, geom (bbox polygon) | Commerce Commission SFA 2025 GPKG | `community_facilities` snapshot → fibre_available, fibre_provider |
| cycleways | ~TBD | name, surface, geom (linestring) | OSM Overpass API (16 cities). WKT uses comma-separated coords. Uses SAVEPOINT per insert for error isolation. | `community_facilities` snapshot → cycleway_km_2km |
| at_stops | 7,023 | stop_id, route_types[], geom | AT GTFS | `get_transit_data()` (Auckland fallback) |
| report_snapshots | per-report | snapshot_json (JSONB), share_token_hash, inputs_at_purchase, report_tier ('quick'/'full') | `create_report_snapshot()` | `/report/{token}` endpoint, `POST /report/{token}/upgrade` |
| hpi_national | 143 | quarter_end, house_price_index, house_sales | RBNZ M10 | Report market section, price advisor |
| rbnz_housing | 143 | quarter_end, house_price_index, house_sales, housing_stock_value_m | RBNZ M10 | Source for hpi_national |
| data_versions | 366 | source, loaded_at | data_loader.py | Track which DataSources loaded |
| srtm_elevation | 0 (until loaded via `load_srtm_postgis.py`) | rast (raster), rid | SRTM 30m tiles (68 .hgt files) | `walking_isochrone.py` → snapshot terrain |
| app_events | growing | event_type, created_at, user_id, session_id, ip_hash, properties (JSONB) | `event_writer.py` | Admin analytics dashboard (90-day retention) |
| perf_metrics | growing | method, path, path_template, status_code, duration_ms, request_id | `request_metrics.py` middleware | Admin performance dashboard (30-day retention) |
| error_log | growing | category, level, message, traceback, request_id, path, properties (JSONB) | `event_writer.py` log_error() | Admin error tracking (90-day retention) |
| daily_metrics | growing | day (PK), metric_name (PK), metric_value, properties (JSONB) | `event_writer.py` midnight aggregation | Pre-aggregated rollups for admin dashboard (2-year retention) |
| suburb_guide_pages | ~2,200 | sa2_code (UK), slug (UK), suburb_name, ta_name, title, meta_description, h1, intro, sections (JSONB), faqs (JSONB), key_stats (JSONB), internal_links (JSONB), data_hash, status | `scripts/generate_suburb_guides.py` (local Qwen via Ollama) | `GET /suburbs/guide/{slug}`, `GET /suburbs/guides`, `sitemap.ts` |

---

## DataSources by Region
<!-- UPDATE: When adding a DataSource to data_loader.py, add it to the appropriate region section below. -->

530 total in `data_loader.py`. Full machine-readable list: `docs/datasources_raw.txt`. Below grouped by region with target table.

### National
| Key | Description | Target table(s) |
|-----|------------|----------------|
| linz_waterways | LINZ NZ Waterways (Topo50 rivers, streams, drains) | nz_waterways |
| gns_active_faults | GNS Active Faults 1:250K | active_faults, fault_avoidance_zones |
| gns_landslides | GNS Landslide Database | landslide_events, landslide_areas |
| nzta_noise_contours | Waka Kotahi road noise | noise_contours |
| school_zones | MoE enrolment schemes | school_zones |
| coastal_elevation | Coastal elevation grid | coastal_elevation |
| erosion_prone_land | GWRC erosion prone | erosion_prone_land |
| corrosion_zones | Corrosion zone map | corrosion_zones |
| coastal_inundation | National coastal inundation | coastal_inundation |

### Wellington Region (~25 DataSources)
| Key | Target table |
|-----|-------------|
| wcc_hazards | fault_zones, flood_hazard, tsunami_hazard |
| wcc_solar | wcc_solar_radiation |
| contaminated_land | contaminated_land |
| epb_wcc | earthquake_prone_buildings |
| district_plan | district_plan_zones |
| height_controls | height_controls |
| gwrc_earthquake | earthquake_hazard, ground_shaking, liquefaction_detail, slope_failure |
| gwrc_landslide | landslide_susceptibility |
| gwrc_flood_extents | flood_extent |
| gwrc_flood_1pct | flood_hazard |
| gwrc_tsunami | tsunami_hazard |
| gwrc_storm_surge_* | coastal_inundation |
| viewshafts | viewshafts |
| character_precincts | character_precincts |
| rail_vibration | rail_vibration |
| metlink_gtfs | metlink_stops, transit_travel_times, transit_stop_frequency |
| wcc_heritage, wcc_heritage_areas | heritage_sites |
| wcc_notable_trees | notable_trees |
| kapiti_*, porirua_* | flood_hazard, district_plan_zones, heritage_sites |

### Auckland (~30 DataSources)
| Key | Target table |
|-----|-------------|
| auckland_flood, auckland_flood_sensitive | flood_hazard |
| auckland_coastal | coastal_inundation |
| auckland_liquefaction | liquefaction_detail |
| auckland_landslide | landslide_susceptibility |
| auckland_tsunami | tsunami_hazard |
| auckland_plan_zones | district_plan_zones |
| auckland_heritage, auckland_heritage_extent | historic_heritage_overlay, heritage_extent |
| auckland_aircraft_noise | aircraft_noise_overlay |
| auckland_notable_trees | notable_trees |
| auckland_ecological | significant_ecological_areas |
| auckland_special_character | special_character_areas |
| auckland_overland_flow | overland_flow_paths |
| auckland_stormwater | stormwater_management_area |
| auckland_parks | park_extents |
| auckland_mana_whenua | mana_whenua_sites |
| auckland_geotech | geotechnical_reports |
| auckland_coastal_erosion | coastal_erosion |
| at_gtfs | at_stops, at_travel_times, at_stop_frequency |

### Canterbury/Christchurch (~25 DataSources)
Keys: `chch_*`, `ecan_*`, `waimakariri_*`. Tables: flood_hazard, coastal_erosion, coastal_inundation, district_plan_zones, heritage_sites, notable_trees, liquefaction (9 district-level).

### Waikato/Hamilton (~15 DataSources)
Keys: `hamilton_*`, `waikato_*`, `waipa_*`. Tables: flood_hazard, district_plan_zones, heritage_sites, notable_trees, liquefaction.

### Bay of Plenty/Tauranga (~12 DataSources)
Keys: `tauranga_*`, `bop_*`. Tables: flood_hazard, coastal_erosion, district_plan_zones, heritage_sites, liquefaction, tsunami_hazard, contaminated_land.

### Otago/Dunedin/Queenstown (~17 DataSources)
Keys: `dunedin_*`, `qldc_*`, `orc_*`, `otago_*`. Tables: flood_hazard, coastal_erosion, district_plan_zones, heritage_sites, liquefaction_detail (`orc_liquefaction_otago`), avalanche, debris, tsunami_zones.

### Hawke's Bay (~20 DataSources)
Keys: `hbrc_*`. Tables: flood_hazard, coastal_erosion, coastal_inundation, district_plan_zones, liquefaction_detail, tsunami_hazard, contaminated_land, earthquake amplification, earthflow, gully, landslide.

### Nelson/Tasman (~20 DataSources)
Keys: `nelson_*`, `tasman_*`. Tables: flood_hazard, coastal_inundation, district_plan_zones, heritage_sites, liquefaction_detail, slope_failure, notable_trees, tsunami_hazard.

### Southland/Invercargill (~12 DataSources)
Keys: `southland_*`, `invercargill_*`. Tables: flood_hazard, coastal_erosion, coastal_inundation, district_plan_zones, heritage_sites, liquefaction_detail (`invercargill_liquefaction`), tsunami_zones.

### Marlborough/Blenheim (~12 DataSources)
Keys: `marlborough_*`. Tables: flood_hazard, liquefaction_detail (zones A-F), tsunami_hazard, coastal_inundation, district_plan_zones (`marlborough_plan_zones`), notable_trees (`marlborough_notable_trees`), slope_failure (`marlborough_steep_erosion`).

### Whanganui (~16 DataSources, via GeoServer WFS)
Keys: `whanganui_*`. Base: `https://data.whanganui.govt.nz/geoserver/ows`. Tables: flood_hazard (risk areas A/B), liquefaction_detail (high/moderate/low), tsunami_hazard (red/orange/yellow zones), slope_failure (land stability A/B), district_plan_zones, heritage_sites, notable_trees, coastal_erosion. Uses `_load_council_wfs()` helper (not ArcGIS).

### Horizons/Manawatu (~10 DataSources)
Keys: `horizons_*`, `pncc_*`. Tables: flood_hazard (200yr modelled + observed + floodways + lahar), coastal_erosion, liquefaction_detail, tsunami_hazard. Covers Whanganui + Palmerston North + surrounding region.

### Other Regions
Northland/Whangarei (~10), Gisborne (~7), Taranaki (~8), West Coast (~5). Each follows same pattern → flood_hazard + district_plan_zones + heritage + regional hazards.

### Rates/Valuations (~45 DataSources)
Keys: `*_rates`. All write to `council_valuations` table. Separate from live rates APIs above — these are bulk-loaded spatial datasets used as fallback when no live API exists.
