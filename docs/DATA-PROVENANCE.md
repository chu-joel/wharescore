# WhareScore Data Provenance

> Source of truth for **user-facing datapoints** — who says so, what dataset, where to verify.
> Use this when a user asks "where did this risk come from?". For the upstream loader/table catalog, see `DATA-CATALOG.md`. For wiring into frontend components, see `FRONTEND-WIRING.md`.

**Scope:** every datapoint that surfaces as a finding, insight, recommendation, or scored signal on the on-screen or hosted report. Not every DataSource — just the ones a user sees. For the full loader catalog (25 council rates APIs, 12 GTFS feeds, 63 flood layers, etc.) see `DATA-CATALOG.md`.

**Conventions:**
- **Field path** — dotted path from the `report` JSON (e.g. `hazards.wcc_flood_ranking`).
- **Authority** — the organisation that owns the underlying data, not the council that hosts the API.
- **Dataset / endpoint** — exact URL where we fetch it, or a pointer to the catalog section.
- **DataSource key** — key in `backend/app/services/data_loader.py` (or `-` if no active loader).
- **Table** — DB table where the data lands.
- **Coverage** — which councils/cities have this; `-` means not applicable.

---

## Hazards
<!-- UPDATE: When adding a new hazard finding or field to get_property_report(), add a row here. -->

### Flood
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `hazards.wcc_flood_ranking` | Flood hazard ranking (High/Medium/Low) | Wellington City Council | `https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer` (layers 61-63) | `wcc_hazards` | `flood_hazard` (source_council='wellington_city') | Wellington only |
| `hazards.wcc_flood_type` | Flood type (Inundation / Overland Flowpath / Stream Corridor) | Wellington City Council | same as above | `wcc_hazards` | `flood_hazard` | Wellington only |
| `hazards.council_flood_ranking` | Council flood hazard ranking | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region (63 flood_hazard loaders) | varies | `flood_hazard` | 63 councils |
| `hazards.council_flood_type` | Council flood event type | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region | varies | `flood_hazard` | 63 councils |
| `hazards.flood_extent_aep` | Flood extent AEP (0.5% / 1% / 2% / 10%) | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region | varies | `flood_hazard` | 63 councils |
| `hazards.flood_nearest_m` | Distance to nearest mapped flood zone (m) | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region | varies | `flood_hazard` | 63 councils |
| `hazards.flood` | 1% or 0.2% AEP national flood zone | Greater Wellington Regional Council | `https://mapping.gw.govt.nz/arcgis/rest/services/.../flood_zones` | legacy national layer | `flood_zones` | Wellington region only |

### Tsunami
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `hazards.wcc_tsunami_return_period` | Tsunami return period (1:100 / 1:500 / 1:1000 yr) | Wellington City Council | `https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer` (layers 52-54) | `wcc_hazards` | `tsunami_hazard` (source_council='wellington_city') | Wellington only |
| `hazards.council_tsunami_ranking` | Council tsunami hazard ranking | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region (~12 tsunami loaders) | varies | `tsunami_hazard` | ~12 councils |
| `hazards.tsunami_zone_class` | Regional evacuation zone class (1 / 2 / 3) | Regional councils | `backend/scripts/load_regional_hazards.py` + `load_christchurch_hazards.py` (one-off bulk load) | `-` | `tsunami_zones` | Bulk — Wellington + Christchurch regions |

### Liquefaction
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `hazards.gwrc_liquefaction` | GWRC liquefaction detail | Greater Wellington Regional Council | `https://mapping.gw.govt.nz/arcgis/rest/services/GW/Emergencies_P/MapServer/10` | `gwrc_earthquake` | `liquefaction_detail` | Wellington region |
| `hazards.gwrc_liquefaction_geology` | GWRC liquefaction geology (fill / reclaimed / clay) | Greater Wellington Regional Council | same as above | `gwrc_earthquake` | `liquefaction_detail` | Wellington region |
| `hazards.council_liquefaction` | Council liquefaction rating (Very High / High / Moderate / Low) | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region (~16 loaders) | varies | `liquefaction_detail` | ~16 councils |
| `hazards.liquefaction` | National liquefaction zone class | Regional councils | `backend/scripts/load_regional_hazards.py` (bulk load) | `-` | `liquefaction_zones` | Bulk — Wellington region |

### Earthquake
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `hazards.ground_shaking_severity` | Ground shaking amplification (1 Low – 5 High) | GWRC / GNS Science | `https://mapping.gw.govt.nz/arcgis/rest/services/GW/Emergencies_P/MapServer/9` | `gwrc_earthquake` | `ground_shaking` | Wellington region |
| `hazards.active_fault_nearest` | Nearest active fault (name, type, slip rate, distance) | GNS Science | GNS Active Faults Database 1:250K | `gns_active_faults` | `active_faults` | National |
| `hazards.fault_zone_name` | WCC fault zone name | WCC / GNS Science | `https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer` (layers 56-59) | `wcc_hazards` | `fault_zones` | Wellington only |
| `hazards.fault_zone_ranking` | WCC fault zone ranking (High/Medium/Low) | WCC / GNS Science | same as above | `wcc_hazards` | `fault_zones` | Wellington only |
| `hazards.fault_avoidance_zone` | Property inside WCC fault avoidance zone | WCC / GNS Science | same as above | `wcc_hazards` | `fault_avoidance_zones` | Wellington only |
| `event_history.earthquakes_30km_10yr` | M4+ earthquakes within 30km (10 yr) | GeoNet / GNS Science | Historical bulk import; no active loader | `-` | `earthquakes` | National (static snapshot) |
| `event_history.largest_quake_magnitude` | Largest recorded quake magnitude nearby | GeoNet / GNS Science | same as above | `-` | `earthquakes` | National (static snapshot) |
| `hazards.epb_count_300m` | Earthquake-prone buildings within 300m | MBIE | MBIE EPB Register | `mbie_epb` | `earthquake_prone_buildings` | National |
| `hazards.epb_nearest` | Nearest EPB (name, rating, deadline, distance) | MBIE | MBIE EPB Register | `mbie_epb` | `earthquake_prone_buildings` | National |

### Landslide / slope
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `hazards.gwrc_slope_severity` | GWRC slope failure severity (1 Low – 5 High) | Greater Wellington Regional Council | `https://mapping.gw.govt.nz/arcgis/rest/services/GW/Emergencies_P/MapServer/11` | `gwrc_earthquake` | `slope_failure` | Wellington region |
| `hazards.council_slope_severity` | Council slope failure severity | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region (~7 loaders, incl. `nelson_slope_failure_register`) | varies | `slope_failure` | ~7 councils |
| `hazards.landslide_susceptibility_rating` | Landslide susceptibility (Very Low – Very High) | GWRC + Auckland | GWRC + Auckland Council ArcGIS feeds | `gwrc_landslide`, `auckland_landslide` | `landslide_susceptibility` | Wellington + Auckland |
| `hazards.landslide_nearest` | Nearest recorded landslide event (name, trigger, date, damage, distance) | GNS Science | GNS Landslide Database | `gns_landslides` | `landslide_events` | National |
| `hazards.landslide_count_500m` | Recorded landslides within 500m | GNS Science | GNS Landslide Database | `gns_landslides` | `landslide_events` | National |
| `hazards.landslide_in_area` | Inside mapped landslide area polygon | GNS Science | GNS Landslide Database | `gns_landslides` | `landslide_areas` | National |
| `hazards.on_erosion_prone_land` | On GWRC erosion-prone land | Greater Wellington Regional Council | `https://mapping.gw.govt.nz/arcgis/...` (erosion-prone layer) | `gwrc_erosion` | `erosion_prone_land` | Wellington region |

### Coastal
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `hazards.coastal_elevation_cm` | Coastal elevation (cm above MHWS) | NIWA | NIWA coastal elevation grid | `coastal_elevation` | `coastal_elevation` | Coastal NZ |
| `hazards.coastal_erosion_exposure` | National coastal erosion exposure rating | NIWA | NIWA national coastal erosion dataset | `coastal_erosion_national` | `coastal_erosion` | Coastal NZ |
| `hazards.council_coastal_erosion` | Council coastal erosion (name, timeframe, scenario, distance) | Auckland + Tauranga + others | See `DATA-CATALOG.md` § DataSources-by-region | varies | `coastal_erosion` | Auckland, Tauranga, select councils |
| `hazards.coastal_inundation_ranking` | Coastal inundation hazard under SLR scenarios | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region | varies | `coastal_inundation` | Select councils |

### Wind / weather / fire
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `hazards.wind_zone` | Wind zone classification (L / M / H / VH / EH / SED) | MBIE / NZS 3604 | Bulk import of NZS 3604 wind zone maps; no active loader | `-` | `wind_zones` | National (static) |
| `hazards.wildfire_vhe_days` | Very High / Extreme fire danger days per year | NIWA / FENZ | Wildfire risk model (hardcoded nearest-grid query) | `wildfire_risk` | `wildfire_risk` | National |
| `event_history.heavy_rain_events` | Heavy rain events within 50km (5 yr) | Open-Meteo Archive (CC BY 4.0) | `https://archive-api.open-meteo.com/v1/archive` — populated by `backend/app/services/weather_loader.py` | `-` (separate loader) | `weather_events` | National grid |
| `event_history.extreme_wind_events` | Extreme wind events within 50km (5 yr) | Open-Meteo Archive | same as above | `-` | `weather_events` | National grid |
| `event_history.worst_rain_mm` | Highest single-day rainfall nearby | Open-Meteo Archive | same as above | `-` | `weather_events` | National grid |
| `event_history.worst_wind_kmh` | Highest recorded wind gust nearby | Open-Meteo Archive | same as above | `-` | `weather_events` | National grid |

### Airport / rail / solar
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `hazards.aircraft_noise_name` | Aircraft noise overlay zone | Councils + airport operators | See `DATA-CATALOG.md` § DataSources-by-region (`auckland_aircraft_noise`, `dunedin_aircraft_noise`, etc.) | varies | `aircraft_noise_overlay` | Select cities with airports |
| `hazards.aircraft_noise_dba` | Aircraft noise level (dBA) | Councils + airport operators | same as above | varies | `aircraft_noise_overlay` | Select cities |
| `hazards.overland_flow_within_50m` | Property within 50m of mapped overland flow path | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region (`auckland_overland_flow` + others) | varies | `overland_flow_paths` | Select councils |
| `hazards.geotech_count_500m` | Geotechnical reports filed within 500m | Auckland Council | Auckland Council GeoServer | `auckland_geotech` | `geotechnical_reports` | Auckland only |
| `hazards.solar_mean_kwh` | Building mean solar radiation (kWh/m²/yr) | Wellington City Council | `https://services3.arcgis.com/zKATtxCTqU2pTs69/arcgis/rest/services/Solar_Potential_of_Wellington_Buildings_WFL1/FeatureServer/0` | `wcc_solar` | `wcc_solar_radiation` | Wellington only |
| `hazards.solar_max_kwh` | Building max solar radiation (kWh/m²/yr) | Wellington City Council | same as above | `wcc_solar` | `wcc_solar_radiation` | Wellington only |

---

## Liveability
<!-- UPDATE: When adding a new liveability finding or field, add a row here. -->

### Crime + safety
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `liveability.crime_percentile` | Crime victimisation percentile (by area unit) | NZ Police | NZ Police victimisations open data | `nz_police_crime` | `crime` | National (3-yr rolling) |
| `liveability.crime_city_median_vics` | City/TA median crime victimisations | NZ Police | same as above | `nz_police_crime` | `crime` + `mv_crime_ta` | National |
| `liveability.crashes_300m_serious` | Serious crashes within 300m (5 yr) | NZ Transport Agency Waka Kotahi | Crash Analysis System (CAS) | `nzta_crashes` | `crashes` | National |
| `liveability.crashes_300m_fatal` | Fatal crashes within 300m (5 yr) | NZ Transport Agency Waka Kotahi | Crash Analysis System (CAS) | `nzta_crashes` | `crashes` | National |
| `liveability.nzdep_decile` | NZDep2023 deprivation decile | University of Otago / Stats NZ | NZDep 2023 Index (by meshblock) | `stats_nz_nzdep` | `nzdep` | National |

### Transit (see `DATA-CATALOG.md` § GTFS-transit for full endpoint list)
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `liveability.bus_stops_800m` | Bus stops within 800m | Regional transit operators | See `DATA-CATALOG.md` § GTFS-transit | varies (12 GTFS feeds) | `transit_stops`, `metlink_stops`, `at_stops` | 12 cities |
| `liveability.rail_stops_800m` | Rail stops within 800m | Metlink + Auckland Transport | See `DATA-CATALOG.md` § GTFS-transit | `metlink_gtfs`, `at_gtfs` | `transit_stops`, `metlink_stops` | Wellington + Auckland |
| `liveability.ferry_stops_800m` | Ferry stops within 800m | Metlink + Auckland Transport | See `DATA-CATALOG.md` § GTFS-transit | `metlink_gtfs`, `at_gtfs` | `transit_stops` | Wellington + Auckland |
| `liveability.cable_car_stops_800m` | Cable car stops within 800m | Metlink | See `DATA-CATALOG.md` § GTFS-transit | `metlink_gtfs` | `metlink_stops` | Wellington only |
| `liveability.peak_trips_per_hour` | Peak service frequency at nearest stop | Regional transit operators | See `DATA-CATALOG.md` § GTFS-transit | varies | `transit_stop_frequency` | 12 cities |
| `liveability.nearest_train_name` | Nearest train station | Metlink + AT | See `DATA-CATALOG.md` § GTFS-transit | `metlink_gtfs`, `at_gtfs` | `transit_stops` | Wellington + Auckland |
| `liveability.transit_travel_times` | Travel time to regional destinations (AM/PM peak) | Regional transit operators | Computed from GTFS — see `DATA-CATALOG.md` § GTFS-transit | varies | `transit_travel_times` | 12 cities |

### Schools + heritage
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `liveability.school_count` | Schools within 1.5km | Ministry of Education | MoE Schools Directory | `moe_schools` | `schools` | National (~2,568) |
| `liveability.schools_1500m` | School list (name, type, EQI rating, distance, zoning) | Ministry of Education | same as above; EQI from MoE EQI dataset | `moe_schools` | `schools` | National |
| `liveability.heritage_count_500m` | Heritage sites within 500m | Heritage NZ Pouhere Taonga + councils | Heritage NZ Register + council overlays | `heritage_nz_register` + council loaders | `heritage_sites` | National (~7,360) |

### Amenities / essentials
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `liveability.nearest_supermarket` | Nearest supermarket (name, distance, coords) | OpenStreetMap | OSM Overpass API (subcategory = supermarket) | `osm_amenities` | `osm_amenities` | National |
| `liveability.nearest_gp` | Nearest GP clinic (name, distance, coords) | OpenStreetMap | OSM Overpass API (subcategory IN doctors, clinic) | `osm_amenities` | `osm_amenities` | National |
| `liveability.nearest_pharmacy` | Nearest pharmacy (name, distance, coords) | OpenStreetMap | OSM Overpass API (subcategory = pharmacy) | `osm_amenities` | `osm_amenities` | National |
| `liveability.amenities_500m` | Amenity mix within 500m (cafes, shops, parks, etc.) | OpenStreetMap | OSM Overpass API | `osm_amenities` | `osm_amenities` | National |
| `liveability.conservation_nearest` | Nearest DOC conservation land (name, type, distance) | Department of Conservation | DOC Protected Areas | `doc_protected_areas` | `conservation_land` | National |

---

## Environment
<!-- UPDATE: When adding an environment/climate finding or field, add a row here. -->

### Noise + air + water
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `liveability.noise_db` | Max road noise (Laeq24h) within property | NZ Transport Agency Waka Kotahi | NZTA noise contours | `nzta_noise_contours` | `noise_contours` | State highways + major roads |
| `environment.air_pm10_trend` | PM10 air quality trend (Improving/Indeterminate/Degrading) | LAWA (Land Air Water Aotearoa) | LAWA monitoring sites | `lawa_air_quality` | `air_quality_sites` | ~80 national sites |
| `environment.air_pm25_trend` | PM2.5 air quality trend | LAWA | same as above | `lawa_air_quality` | `air_quality_sites` | ~80 sites |
| `environment.air_distance_m` | Distance to nearest air quality monitoring site | LAWA | same as above | `lawa_air_quality` | `air_quality_sites` | ~80 sites |
| `environment.water_ecoli_band` | E.coli water quality band (A–E, NPS-FM) | LAWA | LAWA water quality sites | `lawa_water_quality` | `water_quality_sites` | ~300 sites |
| `environment.water_nitrate_band` | Nitrate water quality band (A–E) | LAWA | same as above | `lawa_water_quality` | `water_quality_sites` | ~300 sites |
| `environment.water_drp_band` | Dissolved reactive phosphorus band (A–E) | LAWA | same as above | `lawa_water_quality` | `water_quality_sites` | ~300 sites |
| `environment.water_ammonia_band` | Ammonia water quality band (A–E) | LAWA | same as above | `lawa_water_quality` | `water_quality_sites` | ~300 sites |
| `environment.water_clarity_band` | Water clarity (Secchi) band (A–E) | LAWA | same as above | `lawa_water_quality` | `water_quality_sites` | ~300 sites |

### Climate
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `environment.climate_temp_change` | Temperature change 2041–2060 (°C, SSP2-4.5) | NIWA | NIWA climate projections (VCSN grid) | `niwa_climate_projections` | `climate_projections` | National (~2.6M grid cells) |
| `environment.climate_precip_change_pct` | Precipitation change 2041–2060 (%, SSP2-4.5) | NIWA | same as above | `niwa_climate_projections` | `climate_projections` | National |

### Contamination
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `environment.contam_nearest_name` | Nearest contaminated site name | Regional councils (SLUR registers) | See `DATA-CATALOG.md` § DataSources-by-region (ANZECC/HAIL loaders; e.g. `nrc_contaminated_land`) | varies | `contaminated_land` | National (coverage varies by region) |
| `environment.contam_nearest_category` | ANZECC category (A/B/C/D) or HAIL activity | Regional councils | same as above | varies | `contaminated_land` | National |
| `environment.contam_nearest_distance_m` | Distance to nearest contaminated site | Regional councils | same as above | varies | `contaminated_land` | National |
| `environment.contam_count_2km` | Contaminated sites within 2km | Regional councils | same as above | varies | `contaminated_land` | National |

### WCC-specific environment
| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `environment.in_corrosion_zone` | Inside high-corrosion coastal zone | Wellington City Council | `https://gis.wcc.govt.nz/arcgis/rest/services/.../CorrosionZones` | `corrosion_zones` | `corrosion_zones` | Wellington only |
| `environment.in_rail_vibration_area` | Inside WCC rail vibration advisory zone | Wellington City Council | WCC 2024 DP rail vibration layer | `wcc_rail_vibration` | `rail_vibration` | Wellington only |

---

## Planning
<!-- UPDATE: When adding a planning finding or overlay, add a row here. -->

| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `planning.zone_name` | District Plan zone name | Individual councils | See `DATA-CATALOG.md` § DataSources-by-region (~20+ zone loaders) | varies | `district_plan_zones` | 20+ councils |
| `planning.zone_code` | Zone code (e.g. MRZ, R2) | Individual councils | same as above | varies | `district_plan_zones` | 20+ councils (null for some, e.g. QLDC) |
| `planning.zone_category` | Derived zone category (residential / business / rural / etc.) | Individual councils | Derived by `_derive_zone_category()` from zone_name text | varies | `district_plan_zones` | 20+ councils |
| `planning.max_height_m` | Maximum building height (m) | WCC + select councils | WCC 2024 DP height controls; others from zone attributes | `wcc_hazards` + council zone loaders | `height_controls`, `district_plan_zones` | WCC + select councils |
| `planning.in_viewshaft` | Inside protected viewshaft | Wellington City Council | WCC 2024 DP viewshafts layer | `wcc_viewshafts` | `viewshafts` | Wellington only |
| `planning.in_character_precinct` | Inside character precinct | Wellington City Council | WCC 2024 DP character precincts | `wcc_character_precincts` | `character_precincts` | Wellington only |
| `planning.in_heritage_overlay` | Inside heritage overlay | Individual councils | See `DATA-CATALOG.md` (e.g. `auckland_heritage`, `hamilton_heritage`) | varies | `historic_heritage_overlay` | Select councils |
| `planning.in_special_character` | Inside special character area | Individual councils | e.g. `auckland_special_character` | varies | `special_character_areas` | Select councils |
| `planning.in_ecological_area` | Inside Significant Ecological Area (SEA) | Individual councils | e.g. `auckland_ecological` | varies | `significant_ecological_areas` | Select councils |
| `planning.in_mana_whenua` | Inside mana whenua site of significance | Individual councils | e.g. `auckland_mana_whenua` | varies | `mana_whenua_sites` | Select councils |
| `planning.notable_trees_50m` | Scheduled notable trees within 50m | Individual councils | Council notable tree schedules (`wcc_notable_trees`, `hamilton_trees`, etc.) | varies | `notable_trees` | Select councils |
| `planning.nearest_park_name` | Nearest park/reserve | OpenStreetMap + DOC | OSM Overpass API (leisure=park) + DOC layers | `osm_amenities`, `doc_protected_areas` | `osm_amenities`, `conservation_land` | National |
| `planning.resource_consents_500m_2yr` | Resource consents granted within 500m (2 yr) | GWRC + ECan | GWRC + ECan resource consent registers | `resource_consents` (GWRC), `ecan_resource_consents` | `resource_consents` | Wellington + Canterbury only |
| `planning.transmission_distance_m` | Distance to HV transmission line | Transpower | Historical bulk import of Transpower GIS; no active loader | `-` | `transmission_lines` | National (static snapshot) |

---

## Property
<!-- UPDATE: When adding a property-level field (CV/LV/title/footprint), add a row here. -->

| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `property.capital_value` | Capital value (CV, NZD) | Individual councils (rating valuations) | See `DATA-CATALOG.md` § Live-rates-APIs (25 councils) — fallback to `council_valuations` bulk data | varies | `council_valuations` + live APIs | 25 councils live + 40+ bulk |
| `property.land_value` | Land value (LV, NZD) | Individual councils | See `DATA-CATALOG.md` § Live-rates-APIs | varies | `council_valuations` + live APIs | 25 councils live |
| `property.improvements_value` | Improvements value (NZD) | Individual councils | See `DATA-CATALOG.md` § Live-rates-APIs | varies | `council_valuations` + live APIs | 25 councils live |
| `property.footprint_sqm` | Building footprint area (m²) | LINZ | LINZ Building Outlines (Topo50) | `linz_building_outlines` | `building_outlines` | National (3.2M) |
| `property.title_no` | Land title number | LINZ | LINZ Property Titles | `linz_property_titles` | `property_titles` | National (2.4M) |
| `property.estate_description` | Estate description (freehold / leasehold / cross-lease) | LINZ | LINZ Property Titles | `linz_property_titles` | `property_titles` | National |
| `property.parcel_area_sqm` | Parcel area (m²) | LINZ | LINZ Parcels | `linz_parcels` | `parcels` | National (4.3M) |

---

## Market
<!-- UPDATE: When adding a market/rent/price/HPI field, add a row here. -->

| Field path | Label | Authority | Dataset / endpoint | DataSource key | Table | Coverage |
|---|---|---|---|---|---|---|
| `market.rental_overview` | Rental data by dwelling type + bedrooms (median, bond count, YoY) | MBIE | MBIE Tenancy Services — Tenancy Bonds Database (quarterly, by SA2) | `mbie_bonds_detailed` | `bonds_detailed` | National (1.2M bonds, all SA2s) |
| `market.trends` | 3-year + 5-year rental CAGR by dwelling type | MBIE | MBIE Tenancy Bonds (time-series aggregation) | `mbie_bonds_detailed` | `bonds_detailed` | National |
| `market.hpi_latest` | Latest HPI quarter | RBNZ | RBNZ M10 House Price Index | `rbnz_hpi` | `hpi_national` | National (quarterly) |
| `market.hpi_latest_value` | Latest HPI value | RBNZ | same as above | `rbnz_hpi` | `hpi_national` | National |

---

## Terrain (computed, not loaded)

These fields are **derived** from an SRTM digital elevation model — they are not imported from an external authoritative dataset. Label the attribution as "SRTM 30m DEM (NASA/USGS), computed by WhareScore" when surfacing in the UI.

| Field path | Label | Authority | Dataset / endpoint | Computed by | Coverage |
|---|---|---|---|---|---|
| `terrain.elevation_m` | Property elevation (m) | NASA/USGS SRTM | Shuttle Radar Topography Mission 1-arc-second (30m) | `backend/app/routers/property.py _overlay_terrain_data()` | Global |
| `terrain.slope_degrees` | Slope gradient (degrees) | NASA/USGS SRTM | same as above (computed) | same | Global |
| `terrain.aspect_label` | Slope aspect (N/NE/E/SE/S/SW/W/NW/flat) | NASA/USGS SRTM | same as above (computed) | same | Global |
| `terrain.flood_terrain_risk` | Terrain-inferred flood risk (none/low/moderate/high) | NASA/USGS SRTM | DEM analysis — NOT an official flood zone | same | Global |
| `terrain.wind_exposure` | Terrain-inferred wind exposure | NASA/USGS SRTM | DEM analysis | same | Global |
| `terrain.relative_position` | Relative terrain position (flat/depression/valley/slope/hilltop) | NASA/USGS SRTM | DEM analysis | same | Global |
| `terrain.is_depression` | In natural low point (boolean) | NASA/USGS SRTM | DEM analysis | same | Global |
| `terrain.nearest_waterway_m` | Distance to nearest LINZ waterway | LINZ | LINZ NZ Waterways (Topo50 rivers/streams/drains) | `linz_waterways` → `nz_waterways` | National |

---

## Cross-references

- **Authorities with multiple endpoints**: expand the relevant DATA-CATALOG.md section (DataSources-by-region for 63 flood / 16 liquefaction / 12 tsunami / 20+ zone loaders; Live-rates-APIs for 25 councils; GTFS-transit for 12 cities).
- **Adding a new DataSource**: add a row here **and** a row in DATA-CATALOG.md § DataSources-by-region. If the DataSource surfaces in findings/insights, also update `report_html.py` to set a `source_key` on the Insight — see `FRONTEND-WIRING.md` § Source-attribution.
- **Verifying a row**: `grep` the DataSource key in `backend/app/services/data_loader.py` — every row with a key should resolve to one `DataSource(...)` registration. Rows with `-` in the DataSource column are bulk/one-off loads with no active loader.
