# DATA-LOADERS.md — operational catalogue of bulk loaders

> AUTO-GENERATED from `backend/app/services/data_loader.py::DATA_SOURCES`.
> Do NOT hand-edit. To update a row, change the DataSource entry in code and
> re-run `python scripts/dump_data_loaders.py`.

This is the operational view of every dataset we bulk-load: where it comes
from, who the authority is, how often it changes, and how the scheduler
(future) decides whether to refresh it. Companion docs:

- `DATA-CATALOG.md` — what tables exist and what they store
- `DATA-PROVENANCE.md` — which user-facing field comes from which authority
- `DATA-LAYERS.md` — coverage matrix per council
- `RECIPES.md` — how to add a new loader

## Cadence classes

| Class | Meaning | Refresh policy |
|---|---|---|
| `static` | Never changes after initial load (historical catalogues, frozen census tabulations) | Do not auto-refresh |
| `revisable` | Changes only when the authority republishes (district plans, hazard maps) | Cheap freshness check; full reload only on diff |
| `periodic` | Publishes on a known cadence (GTFS weekly, REINZ HPI monthly) | Schedule matches publication cadence |
| `continuous` | Changes any time | Lazy-fetch or short-TTL cache, not bulk reload |
| `unknown` | Not yet classified | Treat as `revisable` until classified |

## Change-detection methods

| Method | Cost | Notes |
|---|---|---|
| `arcgis_lastEditDate` | 1 HTTP request, ~1KB | ArcGIS metadata endpoint (`?f=pjson` → `editingInfo.lastEditDate`) |
| `http_etag` | 1 HEAD request | Plain HTTP ETag / Last-Modified header (GTFS zips, plain GeoJSON) |
| `row_count_diff` | Full download | Count rows after fetch, compare to last successful row count |
| `manual` | - | Operator-triggered; no automatic check |
| `none` | - | No upstream poll possible (e.g. one-shot CSV imports) |
| `unknown` | - | Not yet classified |

## Loaders

Columns: `key` (DataSource identifier) · `label` (human description) · `tables` (DB targets) · `loader` (function or lambda location) · `authority` · `format` · `upstream URL` · `cadence_class` · `check_interval` · `change_detection` · `notes`.



### National — Commerce Commission (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `fibre_coverage` | Commerce Commission Specified Fibre Areas (2025) | fibre_coverage | `backend/app/services/data_loader.py:4404` `load_fibre_coverage` | - | unknown | - | unknown | unknown | unknown | - |

### National — DOC (3 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `doc_campsites` | DOC Campsites (National) | doc_campsites | `backend/app/services/data_loader.py:3605` `load_doc_campsites` | - | unknown | - | unknown | unknown | unknown | - |
| `doc_huts` | DOC Huts (National) | doc_huts | `backend/app/services/data_loader.py:3518` `load_doc_huts` | - | unknown | - | unknown | unknown | unknown | - |
| `doc_tracks` | DOC Tracks (National) | doc_tracks | `backend/app/services/data_loader.py:3561` `load_doc_tracks` | - | unknown | - | unknown | unknown | unknown | - |

### National — GNS Science (2 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `gns_active_faults` | GNS Active Faults (National) | active_faults, fault_avoidance_zones | `backend/app/services/data_loader.py:1501` `load_gns_active_faults` | - | unknown | - | unknown | unknown | unknown | - |
| `gns_landslides` | GNS Landslide Database (National) | landslide_events, landslide_areas | `backend/app/services/data_loader.py:1343` `load_gns_landslides` | - | unknown | - | unknown | unknown | unknown | - |

### National — LINZ (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `linz_waterways` | LINZ NZ Waterways (Topo50 rivers, streams, drains) | nz_waterways | `backend/app/services/data_loader.py:3788` `load_linz_waterways` | - | unknown | - | unknown | unknown | unknown | - |

### National — MBIE (2 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `epb_mbie` | MBIE National EPB Register (with historical delistings) | mbie_epb_history | `backend/app/services/data_loader.py:720` `load_mbie_epb_national` | - | unknown | - | unknown | unknown | unknown | - |
| `epb_wcc` | WCC Earthquake-Prone Buildings | earthquake_prone_buildings | `backend/app/services/data_loader.py:888` `load_earthquake_prone_buildings` | - | unknown | - | unknown | unknown | unknown | - |

### National — NIWA (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `climate_normals` | Climate Normals 1991-2020 (60 cities. temp, rain, sun, wind) | climate_normals | `backend/app/services/data_loader.py:4238` `load_climate_normals` | - | unknown | - | unknown | unknown | unknown | - |

### National — NZTA (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `nzta_noise_contours` | NZTA National Road Noise Contours | noise_contours | `backend/app/services/data_loader.py:3694` `load_nzta_noise_contours` | - | unknown | - | unknown | unknown | unknown | - |

### National — OSM (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `cycleways` | OSM Cycleways (16 major cities) | cycleways | `backend/app/services/data_loader.py:4477` `load_cycleways` | - | unknown | - | unknown | unknown | unknown | - |

### National — Stats NZ (4 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `business_demography` | Business Demography 2024 (SA2. employee + business counts, growth) | business_demography | `backend/app/services/data_loader.py:4564` `load_business_demography` | - | unknown | - | unknown | unknown | unknown | - |
| `census_commute` | Census 2023 Commute Mode (SA2. drive, bus, train, bike, WFH) | census_commute | `backend/app/services/data_loader.py:4140` `load_census_commute` | - | unknown | - | unknown | unknown | unknown | - |
| `census_demographics` | Census 2023 Demographics (SA2. population, age, ethnicity) | census_demographics | `backend/app/services/data_loader.py:3912` `load_census_demographics` | - | unknown | - | unknown | unknown | unknown | - |
| `census_households` | Census 2023 Households (SA2. income, tenure, vehicles, internet) | census_households | `backend/app/services/data_loader.py:4017` `load_census_households` | - | unknown | - | unknown | unknown | unknown | - |

### Auckland (28 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `auckland_aircraft_noise` | Auckland Aircraft Noise Overlay | aircraft_noise_overlay | `backend/app/services/data_loader.py:2131` `load_auckland_aircraft_noise` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_coastal` | Auckland Coastal Inundation | coastal_inundation | `backend/app/services/data_loader.py:1796` `load_auckland_coastal_inundation` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_coastal_erosion` | Auckland Coastal Erosion (ASCIE) | coastal_erosion | `backend/app/services/data_loader.py:2324` `load_auckland_coastal_erosion` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_coastal_erosion_2130` | Auckland Coastal Erosion/Instability (ASCIE 2130 RCP8.5) | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_ecological` | Auckland Significant Ecological Areas | significant_ecological_areas | `backend/app/services/data_loader.py:2278` `load_auckland_ecological_areas` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_flood` | Auckland Flood Prone Areas | flood_hazard | `backend/app/services/data_loader.py:1762` `load_auckland_flood` | Auckland Council | arcgis | [link](https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Flood_Prone_Areas/FeatureServer/0) | revisable | monthly | arcgis_lastEditDate | Authoritative 1% AEP / 1-in-100yr layer. Loader tags hazard_type='1%' with depth-tiered ranking from Depth100y. AC republishes after major rainfall events. |
| `auckland_flood_sensitive` | Auckland Flood Sensitive Areas | flood_hazard | `backend/app/services/data_loader.py:2066` `load_auckland_flood_sensitive` | Auckland Council | arcgis | [link](https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Flood_Sensitive_Areas/FeatureServer/0) | revisable | monthly | arcgis_lastEditDate | Modelled future-scenario screening (Rapid Flood Hazard Assessment), NOT a validated flood zone. Loader tags hazard_type='Flood Sensitive', ranking='Low'. Capped at 'low' tier in frontend getFloodTier. |
| `auckland_geotech` | Auckland Geotechnical Reports | geotechnical_reports | `backend/app/services/data_loader.py:2465` `load_auckland_geotech_reports` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_height_variation` | Auckland Height Variation Control | height_variation_control | `backend/app/services/data_loader.py:2379` `load_auckland_height_variation` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_heritage` | Auckland Historic Heritage Overlay | historic_heritage_overlay | `backend/app/services/data_loader.py:2089` `load_auckland_heritage` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_heritage_extent` | Auckland Heritage Extent of Place | heritage_extent | `backend/app/services/data_loader.py:2626` `load_auckland_heritage_extent` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_landslide` | Auckland Landslide Susceptibility | landslide_susceptibility | `backend/app/services/data_loader.py:1837` `load_auckland_landslide` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_liquefaction` | Auckland Liquefaction | liquefaction_detail | `backend/app/services/data_loader.py:1824` `load_auckland_liquefaction` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_mana_whenua` | Auckland Mana Whenua Sites | mana_whenua_sites | `backend/app/services/data_loader.py:2436` `load_auckland_mana_whenua` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_notable_trees` | Auckland Notable Trees | notable_trees | `backend/app/services/data_loader.py:2235` `load_auckland_notable_trees` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_overland_flow` | Auckland Overland Flow Paths | overland_flow_paths | `backend/app/services/data_loader.py:2021` `load_auckland_overland_flow` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_parks` | Auckland Park Extents | park_extents | `backend/app/services/data_loader.py:2552` `load_auckland_parks` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_plan_zones` | Auckland Unitary Plan Zones | district_plan_zones | `backend/app/services/data_loader.py:1914` `load_auckland_plan_zones` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_rates` | Auckland Rates/Valuations (623K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_schools` | Auckland School Locations | auckland_schools | `backend/app/services/data_loader.py:2498` `load_auckland_schools` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_special_character` | Auckland Special Character Areas | special_character_areas | `backend/app/services/data_loader.py:2206` `load_auckland_special_character` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_stormwater` | Auckland Stormwater Management Areas | stormwater_management_area | `backend/app/services/data_loader.py:1972` `load_auckland_stormwater` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_tsunami` | Auckland Tsunami Evacuation Zones | tsunami_hazard | `backend/app/services/data_loader.py:2005` `load_auckland_tsunami` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_viewshafts` | Auckland Viewshafts (Local + Volcanic) | viewshafts | `backend/app/services/data_loader.py:2581` `load_auckland_viewshafts` | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_volcanic_5km_buffer` | Auckland Volcanic Field 5km Buffer | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_volcanic_deposits` | Auckland Volcanic Field Past Deposits | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_volcanic_field` | Auckland Volcanic Field Boundary | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `auckland_volcanic_vents` | Auckland Volcanic Field. Past Vents | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Chch (15 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `chch_airport_noise_50db` | Christchurch Airport Noise 50dB Envelope | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_airport_noise_55db` | Christchurch Airport Noise 55dB Envelope | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_airport_noise_65db` | Christchurch Airport Noise 65dB Envelope | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_coastal_erosion` | Christchurch Coastal Erosion | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_coastal_inundation` | Christchurch Coastal Inundation | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_flood` | Christchurch Flood Management | flood_hazard | `backend/app/services/data_loader.py:3333` `load_christchurch_flood` | - | unknown | - | unknown | unknown | unknown | - |
| `chch_flood_high` | Christchurch High Flood Hazard | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_heritage` | Christchurch Heritage Items (polygons) | heritage_extent | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_liquefaction` | Christchurch Liquefaction | liquefaction_detail | `backend/app/services/data_loader.py:3307` `load_christchurch_liquefaction` | - | unknown | - | unknown | unknown | unknown | - |
| `chch_notable_trees` | Christchurch Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_plan_zones` | Christchurch District Plan Zones | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_rates` | Christchurch Rates/Valuations (186K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_slope` | Christchurch Slope Hazard | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_slope_hazard` | Christchurch Slope Hazard (CCC) | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `chch_tsunami` | Christchurch Tsunami Evacuation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Christchurch (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `christchurch_gtfs` | Christchurch Metro GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |

### Dunedin (14 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `dunedin_airport_noise` | Dunedin Airport Flight Fan | aircraft_noise_overlay | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_coastal_hazard` | Dunedin Coastal Hazard | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_flood_h1` | Dunedin Flood Hazard 1 | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_flood_h2` | Dunedin Flood Hazard 2 | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_flood_h3` | Dunedin Flood Hazard 3 | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_gtfs` | Dunedin Orbus GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_heritage` | Dunedin Heritage Buildings | historic_heritage_overlay | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_heritage_precinct` | Dunedin Heritage Precincts | character_precincts | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_land_instability` | Dunedin Land Instability | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_orc_rates` | Dunedin Rates/Valuations via ORC (~58K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_plan_zones` | Dunedin 2GP Zones (Residential) | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_rates` | Dunedin Rates/Valuations (58K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_trees` | Dunedin Scheduled Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `dunedin_tsunami` | Dunedin/Otago Tsunami | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Ecan (22 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `ecan_coastal_hazard` | Canterbury Coastal Hazard Zones | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_fault_awareness_2019` | ECan Canterbury Fault Awareness Areas 2019 | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_flood_kaikoura` | ECan Kaikoura Flood Assessment | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_flood_waitaki` | ECan Waitaki Flood Assessment | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_floodways` | ECan Floodways (Bylaw 2013) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_kaikoura_debris_fan` | ECan Kaikoura Debris Fan Assessment | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_kaikoura_faults` | ECan Kaikoura Faults (2015) | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_kaikoura_landslide` | ECan Kaikoura Landslide Assessment | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_liquefaction_ashburton` | Ashburton Liquefaction Vulnerability 2024 | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_liquefaction_hurunui` | Hurunui Liquefaction (Eastern Canterbury 2012) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_liquefaction_kaikoura` | Kaikoura Liquefaction Vulnerability 2019 | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_liquefaction_mackenzie` | Mackenzie Liquefaction Vulnerability 2023 | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_liquefaction_selwyn` | Selwyn Liquefaction Susceptibility 2006 | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_liquefaction_timaru` | Timaru Liquefaction Vulnerability 2020 | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_liquefaction_waimakariri` | Waimakariri Liquefaction Susceptibility 2009 | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_liquefaction_waimate` | Waimate Liquefaction Vulnerability 2022 | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_liquefaction_waitaki` | Waitaki Liquefaction Vulnerability 2023 | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_ostler_fault` | ECan Mackenzie Ostler Fault Hazard Area | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_rcep_coastal_hazard` | ECan RCEP Coastal Hazard Zones | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_resource_consents` | ECan Resource Consents (Canterbury, ~115K) | resource_consents | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_sea_inundation` | ECan Sea Water Inundation Zone | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `ecan_tsunami` | Canterbury Tsunami Evacuation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Far North (2 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `far_north_coastal` | Far North NRC Coastal Hazards | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `far_north_flood` | Far North NRC Flood Susceptible Land | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Gisborne (12 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `gisborne_airport_noise` | Gisborne Airport Noise (65Ldn) | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_coastal_erosion` | Gisborne Coastal Erosion | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_coastal_flooding` | Gisborne Coastal Storm Flooding (1% AEP + 2m SLR) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_coastal_hazard` | Gisborne Coastal Hazard Overlays | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_contaminated` | Gisborne Contaminated Sites | contaminated_land | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_flood` | Gisborne Flood Hazard Overlays | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_heritage` | Gisborne Heritage Alert Areas | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_liquefaction` | Gisborne Liquefaction | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_port_noise` | Gisborne Port Noise Controls | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_stability` | Gisborne Stability Alert Areas | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_tsunami` | Gisborne Tsunami Evacuation Zones 2019 | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `gisborne_zones` | Gisborne District Plan Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Grey (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `grey_westland_rates` | Grey + Westland Rates/Valuations (~24K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |

### Gwrc (8 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `gwrc_earthquake` | GWRC Earthquake Hazards | earthquake_hazard, ground_shaking, liquefaction_detail, slope_failure | `backend/app/services/data_loader.py:322` `load_gwrc_earthquake` | - | unknown | - | unknown | unknown | unknown | - |
| `gwrc_flood_1pct` | GWRC 1% AEP Flood Hazard Extent | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `gwrc_flood_extents` | GWRC Flood Extents (2%, 1%, 0.23% AEP) | flood_extent | `backend/app/services/data_loader.py:1125` `load_gwrc_flood_extents` | - | unknown | - | unknown | unknown | unknown | - |
| `gwrc_landslide` | GWRC Landslide (GNS QMap) | landslide_susceptibility | `backend/app/services/data_loader.py:1066` `load_gwrc_landslide` | - | unknown | - | unknown | unknown | unknown | - |
| `gwrc_storm_surge_100cm` | GWRC Storm Surge 1%AEP +100cm SLR | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `gwrc_storm_surge_50cm` | GWRC Storm Surge 1%AEP +50cm SLR | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `gwrc_storm_surge_present` | GWRC Storm Surge 1%AEP Present Day | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `gwrc_tsunami` | GWRC Tsunami Zones (all Greater Wellington) | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Hamilton (13 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `hamilton_airport_noise` | Hamilton Airport Noise Overlay (Waipa) | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_flood` | Hamilton Flood Hazard | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_flood_depressions` | Hamilton Flood Depressions (100yr) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_flood_extents` | Hamilton Flood Extents (100yr Rainfall) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_gtfs` | Hamilton BUSIT GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_heritage` | Hamilton Built Heritage | historic_heritage_overlay | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_natural_hazard` | Hamilton Natural Hazard Area (Peacocke) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_overland_flood` | Hamilton Overland Flowpath Flood Hazard | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_plan_zones` | Hamilton District Plan Zones | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_riverbank_hazard` | Hamilton Riverbank & Gully Hazard | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_seismic` | Hamilton Seismic Stability (Peacocke) | ground_shaking | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_sna` | Hamilton Significant Natural Areas | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `hamilton_trees` | Hamilton Significant Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |

### Hbrc (22 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `hbrc_amplification` | HBRC Earthquake Amplification | ground_shaking | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_coastal_erosion_present` | HBRC Coastal Erosion. Present Day | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_coastal_hazard` | Hawke's Bay Coastal Hazard Zones | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_coastal_inundation_2023` | HBRC Coastal Inundation 2023 | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_contaminated` | Hawke's Bay Contaminated Sites | contaminated_land | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_earthflow_moderate` | HBRC Earthflow Risk. Moderate | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_earthflow_severe` | HBRC Earthflow Risk. Severe | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_earthquake_amp` | Hawke's Bay Earthquake Amplification | ground_shaking | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_flood` | Hawke's Bay Flood Risk Areas | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_flood_risk` | HBRC Flood Risk Areas (region-wide) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_gully_risk` | HBRC Gully Erosion Risk | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_hastings_ponding` | HBRC Hastings Areas Subject to Ponding | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_landslide_high` | Hawke's Bay High Landslide Risk | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_landslide_high_delivery` | HBRC Landslide Risk. High (Delivery to Stream) | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_landslide_high_nodelivery` | HBRC Landslide Risk. High (Non-Delivery) | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_liquefaction` | Hawke's Bay Liquefaction | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_liquefaction_chb` | HBRC CHB/HDC/WDC Liquefaction Severity | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_liquefaction_vulnerability` | HBRC Heretaunga Plains Liquefaction Vulnerability | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_plan_zones` | Hawke's Bay District Plan Zones | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_tsunami` | Hawke's Bay Tsunami Inundation | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_tsunami_evac_2024` | HBRC Tsunami Evacuation Zones 2024 | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hbrc_wairoa_bank` | HBRC Wairoa River Bank Stability | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |

### Invercargill (13 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `invercargill_amplification` | Invercargill Seismic Amplification | ground_shaking | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_archaeological` | Invercargill Archaeological Sites | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_biodiversity` | Invercargill Significant Indigenous Biodiversity | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_coastal_erosion` | Invercargill Coastline Prone to Erosion | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_heritage` | Invercargill Heritage Sites | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_liquefaction` | Invercargill Liquefaction Vulnerability | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_liquefaction` | Invercargill Liquefaction Susceptibility | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_noise_airport` | Invercargill Airport Noise Boundary | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_noise_port` | Invercargill Port Noise Boundary | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_notable_trees` | Invercargill Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_riverine_inundation` | Invercargill Riverine Inundation | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_sea_level_rise` | Invercargill Sea Level Rise Storm Surge | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `invercargill_zones` | Invercargill Planning Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Kapiti (11 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `kapiti_coastal_erosion_2120` | Kapiti Coastal Erosion 2120 (+0.6m SLR) | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_coastal_erosion_present` | Kapiti Coastal Erosion (Present Day) | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_ecological` | Kapiti Ecological Sites | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_fault_avoidance` | Kapiti Coast Fault Avoidance Areas | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_flood` | Kapiti Coast Flood Hazard | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_flood_ponding` | Kapiti Flood Hazard Ponding | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_flood_river_corridor` | Kapiti Flood Hazard River Corridor | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_heritage` | Kapiti Coast Historic Heritage Places | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_trees` | Kapiti Coast Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_tsunami` | Kapiti Coast Tsunami Evacuation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `kapiti_zones` | Kapiti Coast District Plan Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Manawatu (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `manawatu_rates` | Manawatu District Rates/Valuations (~15K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |

### Marlborough (21 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `marlborough_flood` | Marlborough Flood Hazard Areas (MEP) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liq_a` | Marlborough Liquefaction Zone A | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liq_b` | Marlborough Liquefaction Zone B | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liq_c` | Marlborough Liquefaction Zone C | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liq_d` | Marlborough Liquefaction Zone D | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liq_e` | Marlborough Liquefaction Zone E | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liq_f` | Marlborough Liquefaction Zone F | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liquefaction_a` | Marlborough Liquefaction Investigation Zone A | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liquefaction_b` | Marlborough Liquefaction Investigation Zone B | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liquefaction_c` | Marlborough Liquefaction Investigation Zone C | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liquefaction_d` | Marlborough Liquefaction Investigation Zone D | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liquefaction_e` | Marlborough Liquefaction Investigation Zone E | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_liquefaction_f` | Marlborough Liquefaction Investigation Zone F | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_noise` | Marlborough Noise Control Boundaries | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_notable_trees` | Marlborough Notable Trees (MEP) | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_plan_zones` | Marlborough District Plan Zones (MEP Decision) | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_rates` | Marlborough Rates/Valuations (27K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_slr` | Marlborough Sea Level Rise Modelling | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_steep_erosion` | Marlborough Steep Erosion Prone Land | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_steep_erosion` | Marlborough Steep Erosion Prone Land | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `marlborough_tsunami` | Marlborough Tsunami Inundation (GNS) | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Nelson (30 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `nelson_coastal_inundation` | Nelson Coastal Inundation | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_fault_awareness` | Nelson Fault Awareness Overlay (NRMP PC29) | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_fault_corridor` | Nelson Fault Hazard Corridor (TOTS) | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_fault_deformation` | Nelson Fault Deformation Overlay (NRMP PC29) | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_fault_hazard` | Nelson Fault Hazard Corridor | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_fault_hazard_nrmp` | Nelson Fault Hazard Overlay (NRMP PC29) | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_flood` | Nelson River Flooding (Present Day) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_flood_future` | Nelson Future Flooding 2130 | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_flood_overlay` | Nelson Flood Overlay (NRMP PC29) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_floodway` | Nelson Floodway | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_gtfs` | Nelson eBus GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_heritage` | Nelson Heritage Buildings/Objects/Places (NRMP PC29) | historic_heritage_overlay | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_high_flood` | Nelson High Flood Hazard Overlay (NRMP PC29) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_inundation` | Nelson Inundation Overlay (NRMP PC29) | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_liquefaction` | Nelson Liquefaction | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_liquefaction_nrmp` | Nelson Liquefaction Hazard Overlay (NRMP PC29) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_maitai_flood_2013` | Nelson Maitai River Flood 2013 Model | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_maitai_flood_2100` | Nelson Maitai River Flood 2100 Model | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_notable_trees` | Nelson Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_plan_zones` | Nelson District Plan Zones (NRMP PC29) | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_river_flood_2130` | Nelson River Flooding 2130 | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_river_flood_present` | Nelson River Flooding Present Day | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_slope` | Nelson Slope Instability | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_slope_failure_register` | Nelson Slope Failure Register (TOTS) | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_slope_instability` | Nelson Slope Instability Overlay | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_slope_instability_pc29` | Nelson Slope Instability (NRMP PC29) | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_tahunanui_liquefaction` | Nelson Tahunanui Liquefaction | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_tasman_tsunami` | Nelson/Tasman Tsunami Evacuation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_trees` | Nelson Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `nelson_tsunami_evac` | Nelson Tsunami Evacuation Zones (TOTS) | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Nrc (2 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `nrc_contaminated_land` | NRC Contaminated Land (Northland) | contaminated_land | `backend/app/services/data_loader.py:3735` `load_nrc_contaminated_land` | - | unknown | - | unknown | unknown | unknown | - |
| `nrc_flood_susceptible` | NRC Flood Susceptible Land | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Orc (12 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `orc_coastal_erosion_dunedin` | ORC Dunedin Coast Revised Hazard Area | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_coastal_hazard` | ORC Coastal Hazard Areas (CoastPlan) | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_dunedin_tsunami` | Dunedin Tsunami Zones (ORC) | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_floodway_clutha` | ORC Lower Clutha Floodway | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_floodway_hendersons` | ORC Hendersons Creek Floodway | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_floodway_taieri` | ORC Taieri River Floodway | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_hail` | Otago Region Contaminated Sites (HAIL) | contaminated_land | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_liquefaction_otago` | ORC Seismic Liquefaction Otago 2019 | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_storm_surge` | ORC Storm Surge Affected Areas (All Scenarios) | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_storm_surge` | ORC Storm Surge Affected Areas (all scenarios) | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_tsunami_affected` | ORC Tsunami Affected Areas | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `orc_waitaki_floodplain` | ORC Waitaki River Indicative Floodplain | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Palmerston (4 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `palmerston_north_gtfs` | Palmerston North Horizons GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `palmerston_north_heritage` | Palmerston North Heritage Sites | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `palmerston_north_trees` | Palmerston North Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `palmerston_north_zones` | Palmerston North Planning Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Porirua (16 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `porirua_coastal_erosion_current` | Porirua Coastal Erosion (Current) | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_coastal_erosion_slr` | Porirua Coastal Erosion (1m SLR) | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_coastal_inundation` | Porirua Coastal Inundation (Current) | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_coastal_inundation_slr` | Porirua Coastal Inundation (1m SLR) | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_ecological` | Porirua Ecosites | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_fault_rupture` | Porirua Fault Rupture Zones | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_flood` | Porirua Flood Hazard | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_ground_shaking` | Porirua Ground Shaking Zones | ground_shaking | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_heritage` | Porirua Historic Heritage Buildings | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_landslide_runout` | Porirua Landslide Run Out | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_landslide_suscept` | Porirua Landslide Susceptibility | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_liquefaction` | Porirua Liquefaction Hazard | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_tsunami_1000yr` | Porirua Tsunami Inundation 1:1000yr | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_tsunami_100yr` | Porirua Tsunami Inundation 1:100yr | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_tsunami_500yr` | Porirua Tsunami Inundation 1:500yr | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `porirua_zones` | Porirua Planning Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Qldc (13 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `qldc_active_faults` | QLDC Active Faults (GNS 2019) | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_active_folds` | QLDC Active Folds (GNS 2019) | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_alluvial_fans` | QLDC Alluvial Fan Areas (ORC 2011) | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_avalanche` | QLDC Avalanche Areas | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_damburst` | QLDC Damburst Flooding (ORC 2002) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_debris_rockfall` | QLDC Debris Flow & Rockfall Risk (BECA 2020) | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_erosion` | QLDC Erosion Areas (Opus 2002) | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_flood` | QLDC Flood Hazard Area | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_heritage` | Queenstown-Lakes Heritage & Protected Features | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_landslide` | QLDC Landslide Areas | landslide_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_liquefaction` | QLDC Liquefaction (GNS 2019) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_rainfall_flood` | QLDC Rainfall Flooding (ORC 2012) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `qldc_zones` | Queenstown-Lakes Operative Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Queenstown (2 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `queenstown_gtfs` | Queenstown Orbus GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `queenstown_orc_rates` | Queenstown-Lakes Rates via ORC (~33K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |

### Rotorua (15 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `rotorua_airport_noise` | Rotorua Airport Noise Contours | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_caldera` | Rotorua Caldera Rim Landscape | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_fault_avoidance` | Rotorua Fault Avoidance Zones (2021) | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_geothermal` | Rotorua Geothermal Systems | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_gtfs` | Rotorua CityRide GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_gucm_flood` | Rotorua Utuhina Flood Depth (1% AEP 2130) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_heritage` | Rotorua Archaeological & Heritage Sites | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_landslide` | Rotorua Landslide Susceptibility | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_liquefaction` | Rotorua Liquefaction Vulnerability | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_ncm_flood` | Rotorua Ngongotaha Flood Hazard (1% AEP) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_scm_flood` | Rotorua Stormwater Flood Depth (1% AEP) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_sna` | Rotorua Significant Natural Areas | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_soft_ground` | Rotorua Soft Ground Hazard | ground_shaking | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_trees` | Rotorua Notable Tree Areas | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `rotorua_zones` | Rotorua Zoning | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Selwyn (3 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `selwyn_faults` | Selwyn Fault Lines (via ECAN) | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `selwyn_flood_zones` | Selwyn ECan Defined Flood Zones | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `selwyn_rates` | Selwyn Rates/Valuations (~30K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |

### Southland (11 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `southland_active_faults` | Southland Active Faults | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_contaminated` | Southland Contaminated Land (HAIL) | contaminated_land | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_dc_coastal_hazard` | Southland District Coastal Hazard | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_dc_flood` | Southland District Flood Inundation Overlay | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_dc_heritage` | Southland District Heritage Sites | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_dc_noise` | Southland District Noise Control | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_floodplains` | Southland Significant Floodplains | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_hail` | Southland Contaminated Land Register | contaminated_land | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_liquefaction` | Southland Liquefaction Risk | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_shaking` | Southland Shaking Amplification | ground_shaking | - | - | unknown | - | unknown | unknown | unknown | - |
| `southland_tsunami` | Southland Tsunami Evacuation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Taranaki (8 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `taranaki_active_faults` | Taranaki Active Faultlines | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `taranaki_faults` | Taranaki Active Faultlines | active_faults | `backend/app/services/data_loader.py:3378` `load_taranaki_faults` | - | unknown | - | unknown | unknown | unknown | - |
| `taranaki_gtfs` | New Plymouth Citylink GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `taranaki_hail` | Taranaki Selected Land Use Register | contaminated_land | - | - | unknown | - | unknown | unknown | unknown | - |
| `taranaki_rates` | Taranaki Rates/Valuations (58K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `taranaki_tsunami` | Taranaki Tsunami Evacuation Zones | tsunami_hazard | `backend/app/services/data_loader.py:3419` `load_taranaki_tsunami` | - | unknown | - | unknown | unknown | unknown | - |
| `taranaki_volcanic` | Taranaki Volcanic Hazard Zones | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `taranaki_volcanic_evac` | Taranaki Volcanic Evacuation Zones | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Tasman (11 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `tasman_coastal_erosion_structures` | Tasman Coastal Erosion Protection | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_coastal_slr_05m` | Tasman Coastal SLR +0.5m Scenario | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_coastal_slr_15m` | Tasman Coastal SLR +1.5m Scenario | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_coastal_slr_1m` | Tasman Coastal SLR +1.0m Scenario | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_coastal_slr_2m` | Tasman Coastal SLR +2.0m Scenario | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_coastal_slr_present` | Tasman Coastal SLR Present Day (1% AEP) | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_faults` | Tasman Active & Capable Faultlines | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_historic_floods` | Tasman Historic Flood Patterns | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_liquefaction` | Tasman Liquefaction Vulnerability (Level A) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_plan_zones` | Tasman District Plan Zones | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `tasman_rates` | Tasman Rates/Valuations (29K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |

### Tauranga (14 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `tauranga_archaeological` | Tauranga Significant Archaeological Areas | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_bop_gtfs` | Tauranga/BOP BayBus GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_coastal_erosion` | Tauranga Coastal Erosion (NZVD16) | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_flood` | Tauranga Flood Risk | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_flood_dxv` | Tauranga Flood Depth x Velocity (100yr) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_harbour_inundation` | Tauranga Harbour Inundation (2130 1%AEP) | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_heritage` | Tauranga Built Heritage Sites | heritage_sites | `backend/app/services/data_loader.py:3434` `load_tauranga_heritage` | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_liquefaction` | Tauranga Liquefaction Vulnerability | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_noise` | Tauranga Airport + Port Noise Contours | noise_contours | `backend/app/services/data_loader.py:3476` `load_tauranga_noise` | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_plan_zones` | Tauranga Planning Zones | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_slope` | Tauranga Slope Hazard Zones | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_slope_hazard` | Tauranga Slope/Landslide Hazard | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_trees` | Tauranga Significant Trees (Groups) | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `tauranga_tsunami` | Tauranga Tsunami Evacuation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Thames (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `thames_coromandel_rates` | Thames-Coromandel Rates/Valuations (~30K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |

### Waikato (11 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `waikato_dc_rates` | Waikato District Rates/Valuations (~21K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_flood` | Waikato Local Flood Hazard | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_flood_1pct` | Waikato Flood Extent 1% AEP (Lower Waikato & Waipa Rivers) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_flood_depth` | Waikato Local Flood Depth Model | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_geothermal` | Waikato Geothermal Systems | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_geothermal_subsidence` | Waikato Geothermal Subsidence Bowl | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_ground_shaking` | Waikato Earthquake Ground Shaking | ground_shaking | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_liquefaction` | Waikato Liquefaction (Level A) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_regional_flood` | Waikato Regional Flood Hazard Update | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_tsunami` | Waikato Tsunami Hazard Classification | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waikato_tsunami_inundation` | Waikato Tsunami Inundation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |

### Waimakariri (11 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `waimakariri_ashley_fault` | Waimakariri Ashley Fault Avoidance | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_ecological` | Waimakariri Significant Natural Areas | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_fault_awareness` | Waimakariri Fault Awareness Overlay | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_flood_ashley` | Waimakariri 200yr Ashley Breakout Flood | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_flood_coastal` | Waimakariri 100yr Coastal Flood | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_flood_localised` | Waimakariri 200yr Localised Flood | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_heritage` | Waimakariri Heritage Buildings | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_liquefaction` | Waimakariri Liquefaction Susceptibility | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_rates` | Waimakariri Rates/Valuations (~30K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_trees` | Waimakariri Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `waimakariri_zones` | Waimakariri District Plan Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Waipa (7 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `waipa_airport_noise` | Waipa Airport Noise Overlay | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `waipa_flood_hazard` | Waipa District Flood Hazard Area | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waipa_heritage` | Waipa Heritage Sites | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `waipa_rates` | Waipa District Rates/Valuations (~25K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `waipa_sna` | Waipa Significant Natural Areas | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `waipa_trees` | Waipa Protected Trees & Bushstands | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `waipa_zones` | Waipa District Plan Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Waitaki (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `waitaki_rates` | Waitaki Rates/Valuations (~15K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |

### Wcc (5 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `wcc_hazards` | WCC District Plan Hazards | fault_zones, flood_hazard, tsunami_hazard | `backend/app/services/data_loader.py:376` `load_wcc_hazards` | - | unknown | - | unknown | unknown | unknown | - |
| `wcc_heritage` | Wellington Heritage Buildings (2024 DP) | historic_heritage_overlay | - | - | unknown | - | unknown | unknown | unknown | - |
| `wcc_heritage_areas` | Wellington Heritage Areas (2024 DP) | character_precincts | - | - | unknown | - | unknown | unknown | unknown | - |
| `wcc_notable_trees` | Wellington Notable Trees (2024 DP) | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `wcc_solar` | WCC Solar Radiation | wcc_solar_radiation | `backend/app/services/data_loader.py:449` `load_wcc_solar` | - | unknown | - | unknown | unknown | unknown | - |

### Whakatane (1 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `whakatane_rates` | Whakatane Rates/Valuations (~17K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |

### Whangarei (16 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `whangarei_airport_noise` | Whangarei Airport Air Noise Boundary | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_coastal_hazard` | Whangarei Coastal Hazard Zones | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_flood` | Whangarei Flood Susceptible Areas | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_gtfs` | Whangarei CityLink GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_heritage` | Whangarei Heritage Items | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_land_stability` | Whangarei Land Instability | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_land_stability` | Whangarei Land Instability (T+T 2020) | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_liquefaction` | Whangarei Liquefaction Vulnerability (T+T 2020) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_liquefaction` | Whangarei Liquefaction Vulnerability (T+T 2020) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_noise_control` | Whangarei Noise Control Boundaries | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_trees` | Whangarei Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_tsunami` | Whangarei Tsunami Zones (NRC 2024) | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_zones_commercial` | Whangarei Commercial & Mixed Use Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_zones_industrial` | Whangarei Industrial Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_zones_residential` | Whangarei Residential Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `whangarei_zones_rural` | Whangarei Rural Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |

### Other (172 loaders)

| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `ashburton_rates` | Ashburton Rates/Valuations (~20K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `at_gtfs` | Auckland Transport GTFS + Travel Times | at_stops, at_travel_times, at_stop_frequency | `backend/app/services/data_loader.py:2673` `load_at_gtfs` | - | unknown | - | unknown | unknown | unknown | - |
| `bop_active_faults` | BOP Active Faults (GNS) | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `bop_calderas` | BOP Volcanic Calderas (GNS) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `bop_coastal_hazard_ohiwa` | BOP Ohiwa Spit Coastal Hazard | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `bop_coastal_hazard_sensitive` | BOP Area Sensitive Coastal Hazard | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `bop_contaminated` | BOP HAIL Contaminated Sites | contaminated_land | - | - | unknown | - | unknown | unknown | unknown | - |
| `bop_historic_floods` | BOP Historic Flood Extents | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `bop_liquefaction_a` | BOP Liquefaction Level A (Desktop) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `bop_liquefaction_b` | BOP Liquefaction Level B (Detailed) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `bop_tsunami_2500yr` | BOP Tsunami Inundation 2500yr ARI | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `bop_tsunami_evac` | BOP Tsunami Evacuation Zones 2023 | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `buller_rates` | Buller Rates/Valuations (~7.8K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `canterbury_faults` | Canterbury Fault Awareness Areas (ECan 2024) | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `carterton_rates` | Carterton Rates/Valuations (~5K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `central_otago_rates` | Central Otago Rates/Valuations (~18K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `character_precincts` | WCC Character Precincts | character_precincts | `backend/app/services/data_loader.py:1219` `load_character_precincts` | - | unknown | - | unknown | unknown | unknown | - |
| `clutha_rates` | Clutha Rates/Valuations (~15K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `coastal_elevation` | GWRC Coastal Elevation | coastal_elevation | `backend/app/services/data_loader.py:1096` `load_coastal_elevation` | - | unknown | - | unknown | unknown | unknown | - |
| `coastal_inundation` | WCC Coastal Inundation (+ SLR) | coastal_inundation | `backend/app/services/data_loader.py:1250` `load_coastal_inundation` | - | unknown | - | unknown | unknown | unknown | - |
| `contaminated_land` | GWRC Contaminated Land (SLUR) | contaminated_land | `backend/app/services/data_loader.py:686` `load_contaminated_land` | - | unknown | - | unknown | unknown | unknown | - |
| `corrosion_zones` | WCC Corrosion Zones | corrosion_zones | `backend/app/services/data_loader.py:1160` `load_corrosion_zones` | - | unknown | - | unknown | unknown | unknown | - |
| `district_plan` | WCC District Plan Zones | district_plan_zones | `backend/app/services/data_loader.py:995` `load_district_plan_zones` | - | unknown | - | unknown | unknown | unknown | - |
| `erosion_prone_land` | GWRC Erosion Prone Land | erosion_prone_land | `backend/app/services/data_loader.py:1314` `load_erosion_prone_land` | - | unknown | - | unknown | unknown | unknown | - |
| `hauraki_rates` | Hauraki District Rates/Valuations (~12K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `hawkes_bay_gtfs` | Hawke's Bay GoBus GTFS + Travel Times | transit_stops, transit_travel_times, transit_stop_frequency | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_archaeological` | Lower Hutt Archaeological Sites | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_coastal_inundation_high` | Lower Hutt Coastal Inundation (High) | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_coastal_inundation_medium` | Lower Hutt Coastal Inundation (Medium) | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_flood_inundation` | Lower Hutt Flood Inundation | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_flood_overland_flow` | Lower Hutt Overland Flow Flood | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_flood_stream_corridor` | Lower Hutt Stream Corridor Flood | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_heritage` | Lower Hutt Heritage Sites | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_notable_trees` | Lower Hutt Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_plan_zones` | Lower Hutt District Plan Activity Areas | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_rates` | Hutt City Rates/Valuations (46K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_tsunami_high` | Lower Hutt Tsunami Hazard (High) | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hcc_tsunami_medium` | Lower Hutt Tsunami Hazard (Medium) | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hdc_rates` | Horowhenua Rates/Valuations (19K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `height_controls` | WCC Height Controls | height_controls | `backend/app/services/data_loader.py:1031` `load_height_controls` | - | unknown | - | unknown | unknown | unknown | - |
| `horizons_coastal_hazard` | Horizons Coastal Hazard Zones | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `horizons_flood_200yr` | Horizons 200yr Modelled Flood Extent | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `horizons_flood_modelled` | Horizons Modelled Flood Wet Extents (200yr) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `horizons_floodways` | Horizons OnePlan Floodways (Schedule 10) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `horizons_lahar_ruapehu` | Horizons Ruapehu Lahar Risk Zones | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `horizons_liquefaction` | Horizons Liquefaction Susceptibility | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `horizons_observed_flooding` | Horizons Observed Flooding Extents | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `horizons_tsunami` | Horizons Tsunami Evacuation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `hurunui_rates` | Hurunui Rates/Valuations (~8K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `kaikoura_rates` | Kaikoura Rates/Valuations (~3.5K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `kcdc_rates` | Kapiti Coast Rates/Valuations (27K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `mackenzie_rates` | Mackenzie Rates/Valuations (~4K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `masterton_rates` | Masterton Rates/Valuations (~14K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `matamata_piako_rates` | Matamata-Piako Rates/Valuations (~16K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `metlink_gtfs` | Metlink GTFS + Travel Times | metlink_stops, transit_travel_times, transit_stop_frequency | `backend/app/services/data_loader.py:507` `load_metlink_gtfs` | - | unknown | - | unknown | unknown | unknown | - |
| `northland_coastal_erosion` | Northland Coastal Erosion Hazard Zones | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `northland_coastal_flood` | Northland Coastal Flood (Current) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `northland_coastal_flood_full` | Northland Coastal Flood Hazard Zones (Full) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `northland_erosion_prone` | Northland Erosion Prone Land | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `northland_flood_10yr` | Northland River Flood 10yr (Regionwide) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `northland_flood_50yr` | Northland River Flood 50yr (Regionwide) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `northland_river_flood_100yr` | Northland River Flood 100yr+CC | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `northland_river_flood_10yr` | Northland River Flood 10yr | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `northland_river_flood_50yr` | Northland River Flood 50yr | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `northland_tsunami` | Northland Tsunami Inundation Zones 2024 | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_coastal_erosion` | New Plymouth Coastal Erosion Hazard | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_coastal_flood` | New Plymouth Coastal Flooding Hazard | coastal_inundation | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_fault_hazard` | New Plymouth Fault Hazard Areas | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_flood_plain` | New Plymouth Flood Plain Areas | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_heritage` | New Plymouth Heritage Buildings & Items | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_liquefaction` | New Plymouth Liquefaction Vulnerability | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_noise` | New Plymouth Noise Control Boundaries | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_sna` | New Plymouth Significant Natural Areas | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_stormwater_flood` | New Plymouth Stormwater Flooding Areas | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_trees` | New Plymouth Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_volcanic_hazard` | New Plymouth Volcanic Hazard Areas | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `npdc_zones` | New Plymouth District Plan Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `otago_liquefaction` | Otago Region Liquefaction (GNS 2019) | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `otorohanga_rates` | Otorohanga Rates/Valuations (~3K, partial WRC) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `pcc_rates` | Porirua City Rates/Valuations (24K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `pncc_airport_noise` | Palmerston North Airport Noise Zones | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `pncc_flood_prone` | Palmerston North Flood Prone Areas | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `pncc_heritage_dp` | Palmerston North Heritage Sites (DP) | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `pncc_notable_trees` | Palmerston North Notable Trees (Parks) | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `pncc_overlays` | Palmerston North District Plan Overlays | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `rail_vibration` | WCC Rail Vibration Advisory | rail_vibration | `backend/app/services/data_loader.py:1284` `load_rail_vibration` | - | unknown | - | unknown | unknown | unknown | - |
| `rangitikei_rates` | Rangitikei District Rates/Valuations (~10K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `resource_consents` | GWRC Resource Consents | resource_consents | `backend/app/services/data_loader.py:915` `load_resource_consents` | - | unknown | - | unknown | unknown | unknown | - |
| `ruapehu_rates` | Ruapehu District Rates/Valuations (~8K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `school_zones` | School Enrolment Zones (National) | school_zones | `backend/app/services/data_loader.py:3648` `load_school_zones` | - | unknown | - | unknown | unknown | unknown | - |
| `south_waikato_rates` | South Waikato Rates/Valuations (~12K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `south_wairarapa_rates` | South Wairarapa Rates/Valuations (~8K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `tararua_rates` | Tararua District Rates/Valuations (~10K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_fault_avoidance` | Taupo Fault Avoidance Zones | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_fault_awareness` | Taupo Fault Awareness Areas | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_flood` | Taupo Flood Hazard Areas | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_geothermal` | Taupo Geothermal Hazard Zones | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_heritage` | Taupo Historic Heritage Sites | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_landslide` | Taupo Landslide Susceptibility | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_liquefaction` | Taupo Liquefaction Vulnerability | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_noise` | Taupo Noise Control Areas | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_rates` | Taupo Rates/Valuations (~20K, partial WRC) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_trees` | Taupo Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `taupo_zones` | Taupo District Plan Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_coastal_hazard` | Timaru Coastal High Hazard | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_earthquake_fault` | Timaru Earthquake Fault Areas | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_ecological` | Timaru Significant Natural Areas | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_flood` | Timaru Flood Assessment Area | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_heritage` | Timaru Heritage Buildings | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_liquefaction` | Timaru Liquefaction Areas | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_noise` | Timaru Airport/Port Noise Contours | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_notable_trees_extra` | Timaru Street Trees (supplementary) | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_rates` | Timaru Rates/Valuations (~25K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_trees` | Timaru Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `timaru_zones` | Timaru Proposed District Plan Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_100yr_flood` | Upper Hutt 100yr Flood Extent | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_contaminated_land` | Upper Hutt SLUR Contaminated Sites | contaminated_land | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_ecological` | Upper Hutt Southern Hills Ecological Overlay | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_erosion` | Upper Hutt Mangaroa Erosion Hazard | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_heritage` | Upper Hutt Heritage Features | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_notable_trees` | Upper Hutt Notable Trees | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_overland_flow` | Upper Hutt Overland Flow Hazard | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_peat_overlay` | Upper Hutt Mangaroa Peat Overlay | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_pinehaven_flood` | Upper Hutt Pinehaven Flood Hazard | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_plan_zones` | Upper Hutt District Plan Zones | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_rates` | Upper Hutt Rates/Valuations (10K, scraped) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_slope_hazard` | Upper Hutt Slope Hazard Overlay | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `uhcc_wellington_fault` | Upper Hutt Wellington Fault Band | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `viewshafts` | WCC Viewshafts | viewshafts | `backend/app/services/data_loader.py:1189` `load_viewshafts` | - | unknown | - | unknown | unknown | unknown | - |
| `waimate_rates` | Waimate Rates/Valuations (~5K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_contaminated` | Wairarapa Contaminated Sites | contaminated_land | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_erosion` | Wairarapa Erosion Hazard Areas | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_fault_hazard` | Wairarapa Fault Line Hazard Areas | active_faults | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_flood_100yr` | Wairarapa Flood Zones (100yr Greytown) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_flood_50yr` | Wairarapa Flood Zones (50yr) | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_heritage` | Wairarapa Heritage Sites (3 councils) | heritage | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_liquefaction` | Wairarapa Liquefaction | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_noise` | Wairarapa Airport Noise Contours | noise_contours | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_notable_trees` | Wairarapa Notable Trees (3 councils) | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_plan_zones` | Wairarapa District Plan Zones (3 councils) | plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_sna` | Wairarapa Significant Natural Areas | significant_ecological_areas | - | - | unknown | - | unknown | unknown | unknown | - |
| `wairarapa_tsunami` | Wairarapa Tsunami Evacuation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `waitomo_rates` | Waitomo Rates/Valuations (~3K, partial WRC) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_active_faults` | West Coast Active Faults | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_alpine_fault` | West Coast Alpine Fault Traces | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_coastal_hazard` | West Coast Coastal Hazard | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_earthquake_landslides` | West Coast Earthquake-Induced Landslides | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_landslide_catalog` | West Coast Landslide Catalog | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_plan_zones` | West Coast District Plan Zones (TTPP) | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_rain_landslides` | West Coast Rain-Induced Landslides | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_rockfall` | West Coast Rockfall Hazard | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_tsunami_evac` | West Coast Tsunami Evacuation Zones | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_ttpp_fault_avoid` | West Coast TTPP Fault Avoidance Zone | fault_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_ttpp_flood_severe` | West Coast TTPP Flood Hazard Severe | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_ttpp_flood_suscept` | West Coast TTPP Flood Susceptibility | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_ttpp_floodplain` | West Coast TTPP Flood Plain | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `westcoast_ttpp_tsunami` | West Coast TTPP Tsunami Hazard Zone | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_coastal_erosion` | Whanganui Coastal Erosion Hazard (Current) | coastal_erosion | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_flood_risk_a` | Whanganui Flood Risk Area A | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_flood_risk_b` | Whanganui Flood Risk Area B | flood_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_heritage` | Whanganui Heritage Sites (ePlan) | heritage_sites | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_land_stability_a` | Whanganui Land Stability Area A | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_land_stability_b` | Whanganui Land Stability Area B | slope_failure | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_liquefaction_high` | Whanganui High Liquefaction | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_liquefaction_low` | Whanganui Low Liquefaction | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_liquefaction_moderate` | Whanganui Moderate Liquefaction | liquefaction_detail | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_plan_zones` | Whanganui District Plan Zones (ePlan) | district_plan_zones | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_protected_trees` | Whanganui Protected Trees (ePlan) | notable_trees | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_rates` | Whanganui Rates/Valuations (~25K) | council_valuations | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_tsunami_orange` | Whanganui Tsunami Orange Zone | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_tsunami_red` | Whanganui Tsunami Red Zone | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |
| `whanganui_tsunami_yellow` | Whanganui Tsunami Yellow Zone | tsunami_hazard | - | - | unknown | - | unknown | unknown | unknown | - |


---

**Summary:** 566 DataSources total, 2 classified (0%). Backfill the rest by adding `upstream_url`, `cadence_class`, `check_interval`, and `change_detection` to each DataSource registration in `data_loader.py`, then re-run this script.
