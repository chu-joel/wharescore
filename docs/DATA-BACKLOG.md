# Data Backlog

All datasets to add to WhareScore, organized by priority phase. Update status as each is loaded.

<!-- UPDATE: When adding a new dataset idea, add a row to the appropriate phase table. -->

## Phase 1 — High impact, easy to load (SA2 joins, CSV downloads)

| Dataset | Source | Granularity | Format | Status | Notes |
|---|---|---|---|---|---|
| Census 2023 demographics | [Stats NZ ArcGIS](https://services2.arcgis.com/vKb0s8tBIA3bdocZ/arcgis/rest/services/2023_Census_totals_by_topic_for_individuals_by_SA2/FeatureServer/0) | SA2 | ArcGIS API | **Loaded** | 2,311 SA2 areas. Population, age, ethnicity, birthplace, gender, languages |
| Census 2023 households | [Stats NZ ArcGIS](https://services2.arcgis.com/vKb0s8tBIA3bdocZ/arcgis/rest/services/2023_Census_totals_by_topic_for_households_by_SA2/FeatureServer/0) | SA2 | ArcGIS API | **Loaded** | 2,311 SA2 areas. Income, tenure, crowding, vehicles, internet, rent, landlord |
| Census 2023 commute mode | [Stats NZ ArcGIS CSV](https://statsnz.maps.arcgis.com/sharing/rest/content/items/fedc12523d4f4da08f094cf13bb21807/data) | SA2 | CSV | **Loader ready** | Origin-destination matrix aggregated by residence SA2 |
| Climate normals (seasonal) | [Open-Meteo Climate API](https://climate-api.open-meteo.com/v1/climate) | 60 cities | API | **Loader ready** | 1991-2020 monthly normals, joined by TA name |
| Employment (business demography) | [Stats NZ ArcGIS](https://services2.arcgis.com/vKb0s8tBIA3bdocZ/arcgis/rest/services/2024_Business_Demography_employee_count_by_SA2/FeatureServer/0) | SA2 | ArcGIS API | **Loader ready** | Employee + business counts, 2019→2024 growth. No industry breakdown at SA2. |

## Phase 2 — High impact, moderate effort (spatial data, APIs)

| Dataset | Source | Granularity | Format | Status | Notes |
|---|---|---|---|---|---|
| Broadband/fibre coverage | [Commerce Commission SFA map](https://www.comcom.govt.nz/regulated-industries/telecommunications/regulated-services/consumer-protections-for-copper-withdrawal/map-of-specified-fibre-areas/) | Polygon | Shapefile | Not started | ST_Contains query, shows fibre availability |
| Hospital locations | Already in osm_amenities (40 hospitals) | Point | osm_amenities | **Done** | Queried in community_facilities snapshot |
| GP/medical density | Already in osm_amenities (483 doctors, 269 clinics) | Point | osm_amenities | **Done** | Already shown in Nearest Essentials |
| EV charging stations | Already in osm_amenities (509 chargers) | Point | osm_amenities | **Done** | Queried in community_facilities snapshot |

## Phase 3 — Nice to have, moderate effort

| Dataset | Source | Granularity | Format | Status | Notes |
|---|---|---|---|---|---|
| Libraries | Already in osm_amenities (189) | Point | osm_amenities | **Done** | Queried in community_facilities snapshot |
| Sports centres/pools | Already in osm_amenities (164 + 54) | Point | osm_amenities | **Done** | Queried in community_facilities snapshot |
| Cycling infrastructure | OSM cycleway | Line | OSM extract | Not started | Km of cycle lanes within 2km |
| Playgrounds | Already in osm_amenities (92) | Point | osm_amenities | **Done** | Queried in community_facilities snapshot |
| Community centres | Already in osm_amenities (761) | Point | osm_amenities | **Done** | Queried in community_facilities snapshot |

## Phase 4 — Aspirational, harder to source

| Dataset | Source | Granularity | Format | Status | Notes |
|---|---|---|---|---|---|
| UV index by region | [NIWA UV Atlas](https://niwa.co.nz/atmosphere/uv-and-ozone) | ~5 stations | CSV | Not started | Map to nearest TA |
| Insurance cost indicators | EQC/Tower public data | TA/zone | Manual | Not started | Proxy from hazard zones |
| Power outage history | Electricity distributors | Network area | Varies | Not started | Scrape/API per distributor |
| Regional fuel prices | [MBIE weekly monitoring](https://www.mbie.govt.nz/building-and-energy/energy-and-natural-resources/energy-statistics-and-modelling/energy-statistics/weekly-fuel-price-monitoring) | 4 cities | CSV | Not started | TA-level lookup |
| Council long-term plans | Individual councils | TA | PDF/manual | Not started | Curated growth area summaries |
| School performance trends | ERO / MoE | School | CSV | Not started | Historical ERO ratings, roll changes |
| Property price trends by SA2 | REINZ / CoreLogic | SA2 | Paid? | Not started | May not be freely available |
| Crime trends (direction) | NZ Police | SA2 | CSV | Not started | YoY change in victimisations |
