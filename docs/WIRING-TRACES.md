# WhareScore Wiring Traces

> For each report field: the complete chain from data source → database table → SQL/Python → JSON path → frontend component.
> For each city: which fields have data and which are empty.
> Agents: use this to verify data is flowing correctly end-to-end.

---

## Report Field Traces
<!-- UPDATE: When adding a new report field or changing its data chain, update the trace here. -->

Each trace shows: **DataSource → Table → Query step → Report JSON path → Frontend component**

### Property

| Report field | Table | Query step | DataSource(s) | All cities? |
|---|---|---|---|---|
| `property.capital_value` | council_valuations | SQL spatial match 30m → Python `_fix_unit_cv()` overrides with live API | 40+ *_rates DataSources (bulk) + 25 live APIs | Yes (bulk fallback for all; live API for 25 councils) |
| `property.land_value` | council_valuations | Same as above | Same | Yes |
| `property.improvements_value` | council_valuations | Same as above | Same | Yes (some councils don't have IV) |
| `property.footprint_sqm` | building_outlines | SQL spatial ST_Contains | LINZ national | Yes |
| `property.title_no` | property_titles | SQL spatial ST_Contains | LINZ national | Yes |
| `property.multi_unit` | addresses | SQL count within 5m | LINZ national | Yes |

### Hazards — National layers

| Report field | Table | Query step | Notes |
|---|---|---|---|
| `hazards.flood` | flood_zones | SQL spatial intersect | Only 14 rows — mostly Wellington GWRC. Most cities get flood data from `flood_hazard` table instead (see council_flood below) |
| `hazards.tsunami_zone_class` | tsunami_zones | SQL spatial intersect | Only 84 rows — Wellington GWRC only |
| `hazards.liquefaction` | liquefaction_zones | SQL spatial intersect | Only 502 rows — Wellington GWRC only |
| `hazards.wind_zone` | wind_zones | SQL spatial intersect | Only 171 rows — Wellington GWRC only |
| `hazards.slope_failure` | slope_failure_zones | SQL spatial intersect | Only 4,682 rows — Wellington GWRC only |
| `hazards.coastal_exposure` | coastal_erosion | SQL spatial intersect | 8,627 rows — Auckland, Wellington, Dunedin, Nelson, Northland, Tauranga, Canterbury, Napier, Queenstown |
| `hazards.earthquake_count_30km` | earthquakes | SQL count within 30km | National (GeoNet) — all cities |
| `hazards.wildfire_vhe_days` | wildfire_risk | SQL nearest weather station | National (30 stations) — all cities |
| `hazards.active_fault_nearest` | active_faults | SQL nearest within 10km | National (GNS 10K faults) — depends on proximity |
| `hazards.landslide_count_500m` | landslide_events | SQL count within 500m | National (GNS) — depends on proximity |
| `hazards.coastal_inundation_ranking` | coastal_inundation | SQL spatial intersect | 252K rows — coastal cities only |
| `hazards.epb_count_300m` | earthquake_prone_buildings / mbie_epb | SQL count within 300m | Mainly Wellington (544 WCC EPBs + 20 MBIE) |

### Hazards — Council-specific (regional tables, all cities)

| Report field | Table | Query step | Source |
|---|---|---|---|
| `hazards.flood_extent_aep` | flood_hazard | SQL spatial intersect, worst-ranking first | 63 source_councils — ALL major cities have data |
| `hazards.flood_extent_label` | flood_hazard | Same query | Same |
| `hazards.council_liquefaction` | liquefaction_detail | SQL spatial intersect, worst-class first | ~16 councils (Auckland, ChCh, Waikato, Tauranga, Hawke's Bay, GWRC) |
| `hazards.council_liquefaction_geology` | liquefaction_detail | Same query | Same |
| `hazards.council_liquefaction_source` | liquefaction_detail | Same query | Same |
| `hazards.council_tsunami_ranking` | tsunami_hazard | SQL spatial intersect, worst-ranking first | ~12 councils (Auckland, Tauranga, Dunedin, Hawke's Bay, WCC) |
| `hazards.council_tsunami_scenario` | tsunami_hazard | Same query | Same |
| `hazards.council_tsunami_return_period` | tsunami_hazard | Same query | Same |
| `hazards.council_slope_severity` | slope_failure | SQL spatial intersect, worst-severity first | ~6 councils (GWRC, Dunedin, etc.) |
| `hazards.council_slope_source` | slope_failure | Same query | Same |
| `hazards.landslide_susceptibility_rating` | landslide_susceptibility | SQL spatial intersect, worst-rating first | GWRC + Auckland |
| `hazards.landslide_susceptibility_type` | landslide_susceptibility | Same query | Same |
| `hazards.landslide_susceptibility_source` | landslide_susceptibility | Same query | Same |

| `hazards.overland_flow_within_50m` | overland_flow_paths | SQL EXISTS within 50m | Wellington + select councils |
| `hazards.coastal_erosion_exposure` | coastal_erosion | SQL nearest within 500m (source_council IS NULL) | National (NIWA) where loaded |
| `hazards.coastal_erosion_timeframe` | coastal_erosion | Same query | Same |
| `hazards.council_coastal_erosion` | coastal_erosion | SQL nearest within 500m (source_council IS NOT NULL) | Auckland (ASCIE) + select councils |
| `hazards.geotech_count_500m` | geotechnical_reports | SQL count within 500m | Wellington only |
| `hazards.geotech_nearest_hazard` | geotechnical_reports | SQL nearest within 500m | Wellington only |
| `hazards.active_fault_nearest` | active_faults | SQL nearest within 5km, jsonb object | GNS national (16 DataSources) |
| `hazards.fault_avoidance_zone` | fault_avoidance_zones | SQL spatial intersect | GNS national |
| `hazards.aircraft_noise_name` | aircraft_noise_overlay | SQL spatial intersect | Auckland (1 DataSource) |

**These are the main hazard data for all cities.** The national tables (flood_zones, tsunami_zones, liquefaction_zones, slope_failure_zones) are small Wellington-only datasets. Council tables provide regional coverage. `risk_score.py` uses council data to refine or override national scores.

### Hazards — Wellington-only layers

These fields ONLY have data for Wellington region properties. Tables were renamed by migration 0004 (gwrc_* → generic names).

| Report field | Table (current name) | Notes |
|---|---|---|
| `hazards.earthquake_hazard_index` | earthquake_hazard | GWRC CHI model (renamed from gwrc_earthquake_hazard) |
| `hazards.ground_shaking_zone` | ground_shaking | GWRC zones (renamed from gwrc_ground_shaking) |
| `hazards.gwrc_liquefaction` | liquefaction_detail | GWRC liquefaction (renamed from gwrc_liquefaction; now multi-council) |
| `hazards.gwrc_slope_severity` | slope_failure | GWRC slope (renamed from gwrc_slope_failure; now multi-council) |
| `hazards.fault_zone_name` | fault_zones | WCC fault zones (renamed from wcc_fault_zones) |
| `hazards.wcc_flood_type` | flood_hazard | WCC flood (renamed from wcc_flood_hazard; now multi-council, filtered by source_council) |
| `hazards.wcc_tsunami_return_period` | tsunami_hazard | WCC tsunami (renamed from wcc_tsunami_hazard; now multi-council, filtered by source_council) |
| `hazards.solar_mean_kwh` | wcc_solar_radiation | WCC solar |

### Liveability

| Report field | Table | Query step | Chain | All cities? |
|---|---|---|---|---|
| `liveability.school_count` | schools | SQL count within 1500m | National (MoE) | Yes |
| `liveability.nzdep_score` | nzdep + meshblocks | SQL spatial join meshblock → nzdep | National (Stats NZ) | Yes |
| `liveability.crime_rate` | crime | SQL aggregate by SA2 | National (NZ Police) | Yes |
| `liveability.noise_db` | noise_contours | SQL MAX within property | National (NZTA) | Yes (road noise). Airport noise via aircraft_noise_overlay (select cities) |
| `liveability.cbd_distance_m` | cbd_points | SQL distance to nearest | 20 cities in cbd_points table | Yes (for listed cities) |
| `liveability.nearest_train_m` | transit_stops | SQL nearest WHERE location_type=1 | National (if station exists nearby) | Limited |

### Liveability — Transit (CRITICAL: multi-step chain)

| Report field | Step 1: SQL | Step 2: Python | Data tables | Cities covered |
|---|---|---|---|---|
| `liveability.bus_stops_800m` | `get_property_report()` queries `metlink_stops` only | `_overlay_transit_data()` calls `get_transit_data()` which tries metlink → at_stops → transit_stops | metlink_stops, at_stops, transit_stops | Wellington (SQL), Auckland (Python AT fallback), 10 regional cities (Python transit_stops fallback) |
| `liveability.rail_stops_800m` | Same chain | Same chain | Same | Same (only cities with rail in GTFS: Auckland, Wellington, Hamilton) |
| `liveability.transit_travel_times` | Same chain | Same chain, joins with transit_travel_times / at_travel_times | transit_travel_times, at_travel_times | 12 GTFS cities (see DATA-CATALOG § GTFS-transit) |
| `liveability.peak_trips_per_hour` | Same chain | Same chain, joins with transit_stop_frequency / at_stop_frequency | transit_stop_frequency, at_stop_frequency | 12 GTFS cities |
| `liveability.nearest_stop_name` | Same chain | Same chain | Same | 12 GTFS cities |

**Why transit has 3 steps:** The SQL function `get_property_report()` (migration 0022) only queries `metlink_stops` (Wellington). For all other cities, the Python `_overlay_transit_data()` function in property.py calls `get_transit_data()` SQL helper (migration 0023) which tries metlink → AT → regional transit_stops with COALESCE fallback. This means transit data for non-Wellington cities is ONLY available if `_overlay_transit_data()` runs — which it does for both free and paid reports.

### Market

| Report field | Table | Query step | All cities? |
|---|---|---|---|
| `market.rental_overview` | mv_rental_market (materialized view from bonds_detailed) | SQL by SA2 | Yes (wherever MBIE has bond data) |
| `market.trends` | mv_rental_trends | SQL by SA2 | Yes |
| `market.hpi_latest` | hpi_national | SQL latest quarter | Yes (national only, not regional) |

### Planning

| Report field | Table | Query step | All cities? |
|---|---|---|---|
| `planning.zone_name` | district_plan_zones | SQL spatial intersect | 20+ councils with plan zone DataSources |
| `planning.heritage_count` | heritage_sites | SQL count within 500m | National (Heritage NZ) + council-specific |
| `planning.notable_tree_count_50m` | notable_trees | SQL count within 50m | Select councils only |
| `planning.resource_consents_500m_2yr` | resource_consents | SQL count within 500m | Wellington region only (GWRC) |
| `planning.infrastructure_count` | infrastructure_projects | SQL count within 5km (geocoded only) | National (Te Waihanga) |
| `planning.in_viewshaft` | viewshafts | SQL spatial intersect | Wellington + Auckland only |
| `planning.in_heritage_overlay` | historic_heritage_overlay | SQL spatial intersect | Auckland only |
| `planning.in_ecological_area` | significant_ecological_areas | SQL spatial intersect | Auckland + Hamilton only |
| `planning.in_special_character` | special_character_areas | SQL spatial intersect | Auckland only |
| `planning.height_variation_limit` | height_variation_control | SQL spatial intersect | Auckland only |
| `planning.in_mana_whenua` | mana_whenua_sites | SQL spatial intersect | Auckland only |
| `planning.park_count_500m` | park_extents | SQL count within 500m | Select councils |
| `planning.nearest_park_name` | park_extents | SQL nearest within 1km | Select councils |
| `planning.nearest_park_distance_m` | park_extents | Same query | Select councils |

### Terrain & Walking Reach (free + paid reports via `_overlay_terrain_data()`)

| Report field | Table/Service | Query step | Source | All cities? |
|---|---|---|---|---|
| `report.terrain.elevation_m` | srtm_elevation (raster) | `_overlay_terrain_data()` → `walking_isochrone.py` → `ST_Value()` | SRTM 30m tiles | Yes (where SRTM tiles loaded) |
| `report.terrain.slope_degrees` | srtm_elevation (raster) | `_overlay_terrain_data()` → `ST_Slope()` on 3×3 neighbourhood | Same | Yes |
| `report.terrain.slope_category` | (computed) | Python binning of slope_degrees | Same | Yes |
| `report.terrain.aspect_label` | srtm_elevation (raster) | `_overlay_terrain_data()` → `ST_Aspect()` → compass label | Same | Yes |
| `report.terrain.aspect_degrees` | srtm_elevation (raster) | `_overlay_terrain_data()` → `ST_Aspect()` raw degrees | Same | Yes |
| `report.terrain.ruggedness` | srtm_elevation (raster) | `_overlay_terrain_data()` → TRI on 3×3 window | Same | Yes |
| `report.walking_reach.bus` | transit_stops + Valhalla | `_overlay_terrain_data()` → Valhalla 10-min walk isochrone → `count_transit_in_polygon()` | Valhalla + GTFS | 12 GTFS cities |
| `report.walking_reach.rail` | transit_stops + Valhalla | Same, mode_type filter | Same | Cities with rail |
| `report.walking_reach.ferry` | transit_stops + Valhalla | Same, mode_type filter | Same | Cities with ferry |

**Why terrain is in the live report:** `_overlay_terrain_data()` in `property.py` calls Valhalla for elevation/slope and walking isochrone, available in both free on-screen and paid hosted reports. Falls back gracefully if Valhalla is unavailable.

### Terrain & Isochrone (snapshot-only, additional fields not in live report)

| Snapshot field | Table/Service | Query step | Source | All cities? |
|---|---|---|---|---|
| `terrain.elevation_m` | srtm_elevation (raster) | `ST_Value()` on SRTM raster at property point | SRTM 30m tiles via `walking_isochrone.py` | Yes (where SRTM tiles loaded) |
| `terrain.slope_degrees` | srtm_elevation (raster) | `ST_Slope()` on 3×3 neighbourhood | Same | Yes |
| `terrain.aspect_label` | srtm_elevation (raster) | `ST_Aspect()` → compass label | Same | Yes |
| `terrain.aspect_degrees` | srtm_elevation (raster) | `ST_Aspect()` raw degrees | Same | Yes |
| `terrain.ruggedness` | srtm_elevation (raster) | Terrain Ruggedness Index on 3×3 window | Same | Yes |
| `isochrone.geojson` | Valhalla service | HTTP POST to Valhalla `/isochrone` (15-min walk) | Valhalla Docker container | Yes |
| `isochrone.transit_within.bus` | transit_stops | `count_transit_in_polygon()` SQL function | GTFS transit_stops + metlink_stops + at_stops | 12 GTFS cities |
| `isochrone.transit_within.rail` | transit_stops | Same function, mode_type filter | Same | Cities with rail |
| `isochrone.transit_within.ferry` | transit_stops | Same function, mode_type filter | Same | Cities with ferry |
| `terrain_insights[]` | (computed) | `_build_terrain_insights()` rule engine in snapshot_generator.py | Terrain + isochrone data | Yes |

---

## City Coverage Matrix
<!-- UPDATE: When adding data for a new city, update the relevant cells. -->

**Key:** Y = has data, - = no data, P = partial. "Has data" means the table has rows within typical query radius of the city center.

### Core report fields

| Field | Auckland | Wellington | Christchurch | Hamilton | Dunedin | Tauranga | Palmerston Nth | Napier | Nelson | Queenstown | Rotorua | Invercargill | Gisborne | Whangarei |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| capital_value (live API) | Y | Y | Y | Y | Y | Y | Y | - | Y | Y | Y | Y | Y | Y |
| council_flood_aep | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| bus_stops_800m | Y | Y | - | Y | Y | Y | Y | Y | Y | Y | Y | - | - | Y |
| transit_travel_times | Y | Y | - | Y | Y | Y | Y | Y | Y | Y | Y | - | - | Y |
| peak_trips_per_hour | Y | Y | - | Y | Y | Y | Y | Y | Y | Y | Y | - | - | Y |
| school_count | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| crime_rate | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| noise_db (road) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| zone_name | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| heritage_count | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| earthquake_count_30km | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| cbd_distance_m | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| hpi_latest | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### Council-specific hazard data (regional tables)

<!-- UPDATE: When adding council hazard data for a city, update the relevant cell. -->

| City | Flood | Liquefaction | Tsunami | Slope | Landslide Susc | Plan Zones | Coastal Eros | Trees | GTFS | Rates API | Overland Flow |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Wellington | Y | Y | Y | Y | Y | Y | - | Y | Y | Y | - |
| Auckland | Y | Y | Y | - | Y | Y | Y | Y | Y | Y | Y |
| Christchurch | Y | Y | Y | Y | - | Y | Y | Y | - | Y | - |
| Hamilton | Y | Y | Y | Y | - | Y | - | Y | Y | Y | - |
| Dunedin | Y | Y | Y | Y | - | Y | Y | Y | Y | Y | - |
| Tauranga | Y | Y | Y | Y | - | Y | Y | Y | Y | Y | - |
| Nelson/Tasman | Y | Y | Y | Y | - | Y | Y | Y | Y | Y | - |
| Queenstown | Y | Y | - | Y | - | Y | Y | - | Y | Y | - |
| Whangarei | Y | Y | Y | Y | - | Y | Y | Y | Y | Y | - |
| New Plymouth | Y | Y | Y | - | - | Y | Y | Y | Y | Y | - |
| Palmerston Nth | Y | Y | Y | - | - | Y | Y | Y | Y | Y | - |
| Rotorua | Y | Y | - | Y | - | Y | - | Y | Y | Y | - |
| Hastings | Y | Y | Y | Y | - | Y | Y | - | Y | Y | - |
| Invercargill | Y | Y | Y | - | - | Y | Y | Y | - | Y | - |
| Gisborne | Y | Y | Y | Y | - | Y | Y | - | - | Y | - |
| Timaru | Y | Y | - | - | - | Y | Y | Y | - | Y | - |
| Kapiti Coast | Y | Y* | Y | Y* | Y* | Y | Y | Y | - | Y | - |
| Lower Hutt | Y | Y* | Y | Y* | Y* | Y | - | Y | - | Y | - |
| Upper Hutt | Y | Y | - | Y | Y* | Y | - | Y | - | Y | - |
| Porirua | Y | Y | Y | Y | Y* | Y | Y | - | - | Y | - |
| Blenheim | Y | Y | Y | Y | - | Y | - | Y | - | Y | - |
| Whanganui | Y | Y | Y | - | - | - | - | - | - | Y | - |

**Y* = covered by GWRC regional data** (Greater Wellington Regional Council layers cover all cities in the Wellington region: Wellington, Lower Hutt, Upper Hutt, Porirua, Kapiti Coast). These cities get liquefaction, slope failure, earthquake hazard, ground shaking, and landslide susceptibility data from GWRC.

### Wellington-only fields (null for all other cities)

`earthquake_hazard_index`, `ground_shaking_zone`, `fault_zone_name`, `wcc_flood_type`, `wcc_tsunami_return_period`, `solar_mean_kwh`

### Select-city fields

| Field | Which cities have data |
|---|---|
| aircraft_noise_dba | Auckland, Dunedin |
| in_viewshaft | Wellington, Auckland |
| in_heritage_overlay | Auckland |
| in_ecological_area | Auckland, Hamilton |
| notable_tree_count_50m | Wellington, Auckland, Christchurch, Hamilton, Dunedin, Nelson, Whangarei, Kapiti, Taupo, Waimakariri, Timaru, New Plymouth, Palmerston Nth, Lower Hutt, Upper Hutt, Rotorua, Invercargill |
| resource_consents_500m_2yr | Wellington region only (GWRC) |
| contamination_count | Wellington, Upper Hutt, Hawke's Bay, BOP, Gisborne, Taranaki, Southland, Wairarapa, Northland |

---

## Verification Queries
<!-- Use these to check if data is flowing for a specific city. -->

### Check if report has data for a city
```sql
-- Replace CITY and ADDRESS as needed
SELECT
  (r->'hazards'->>'council_flood_aep') as flood,
  (r->'liveability'->>'bus_stops_800m') as bus,
  (r->'liveability'->>'school_count') as schools,
  (r->'planning'->>'zone_name') as zone,
  (r->'property'->>'capital_value') as cv
FROM (
  SELECT get_property_report(address_id::bigint) as r
  FROM addresses
  WHERE town_city = 'Hamilton' AND full_address LIKE '%Street%'
  LIMIT 1
) x;
```
**Note:** This only shows the SQL function output. Transit data is added by Python `_overlay_transit_data()` — to test that, use the API: `curl https://localhost/api/v1/property/{id}/report`

### Check transit data for a city
```sql
SELECT get_transit_data(address_id)
FROM addresses
WHERE town_city = 'Hamilton' AND full_address LIKE '%Victoria Street%'
LIMIT 1;
```

### Check if a table has data near a city
```sql
-- Replace TABLE, CITY coords
SELECT count(*) FROM flood_hazard
WHERE geom && ST_Expand(ST_SetSRID(ST_Point(175.2793, -37.7870), 4326), 0.05);
```

### Check which DataSources are loaded
```sql
SELECT source, loaded_at FROM data_versions WHERE source LIKE '%hamilton%' ORDER BY source;
```

### Check live rates API for a city
```bash
# From the server:
docker exec app-api-1 python -c "
import asyncio
from app.services.hamilton_rates import fetch_hamilton_rates
result = asyncio.run(fetch_hamilton_rates('150 Victoria Street, Hamilton Central, Hamilton'))
print(result)
"
```
