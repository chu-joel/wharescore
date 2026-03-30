# Data Backlog

All datasets to add to WhareScore, organized by priority phase. Update status as each is loaded.

<!-- UPDATE: When adding a new dataset idea, add a row to the appropriate phase table. -->

## Phase 1 — High impact, easy to load (SA2 joins, CSV downloads)

| Dataset | Source | Granularity | Format | Status | Notes |
|---|---|---|---|---|---|
| Census 2023 demographics | [Stats NZ Aotearoa Data Explorer](https://www.stats.govt.nz/tools/aotearoa-data-explorer/) | SA2 | CSV | Not started | Population, age, income, ethnicity, household, education, pop change |
| Census 2023 commute mode | [Stats NZ table 121988](https://datafinder.stats.govt.nz/table/121988-2023-census-main-means-of-travel-by-statistical-area-2/) | SA2 | CSV | Not started | % car/bus/bike/walk/WFH per SA2 |
| Climate normals (seasonal) | [NIWA CliFlo](https://cliflo.niwa.co.nz/) + [climate maps](https://niwa.co.nz/climate-and-weather/national-and-regional-climate-maps) | ~200 stations | CSV | Not started | Monthly temp/rain/sun/frost/wind, join nearest station to property |
| Employment by industry | [Stats NZ Business Demography](https://www.stats.govt.nz/information-releases/new-zealand-business-demography-statistics-at-february-2025/) | SA2 | CSV | Not started | Job counts by ANZSIC sector per SA2 |

## Phase 2 — High impact, moderate effort (spatial data, APIs)

| Dataset | Source | Granularity | Format | Status | Notes |
|---|---|---|---|---|---|
| Broadband/fibre coverage | [Commerce Commission SFA map](https://www.comcom.govt.nz/regulated-industries/telecommunications/regulated-services/consumer-protections-for-copper-withdrawal/map-of-specified-fibre-areas/) | Polygon | Shapefile | Not started | ST_Contains query, shows fibre availability |
| Hospital locations | Ministry of Health / OSM | Point | CSV | Not started | Nearest hospital + distance, ED availability |
| GP/medical density | OSM amenity=doctors/clinic | Point | osm_amenities | Not started | Already partially in OSM data, may need enrichment |
| EV charging stations | [Open Charge Map](https://openchargemap.org/) / NZTA | Point | API/CSV | Not started | Nearest + count within 5km |

## Phase 3 — Nice to have, moderate effort

| Dataset | Source | Granularity | Format | Status | Notes |
|---|---|---|---|---|---|
| Libraries | OSM amenity=library | Point | osm_amenities | Not started | Check if already loaded |
| Sports centres/pools | OSM leisure=sports_centre, swimming_pool | Point | OSM extract | Not started | Load into osm_amenities |
| Cycling infrastructure | OSM cycleway | Line | OSM extract | Not started | Km of cycle lanes within 2km |
| Playgrounds | OSM leisure=playground | Point | osm_amenities | Not started | Check coverage |
| Community centres | OSM amenity=community_centre | Point | OSM extract | Not started | Load into osm_amenities |

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
