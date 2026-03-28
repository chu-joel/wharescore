# WhareScore — Data Layers Coverage Matrix

**Last Updated:** 2026-03-28 (session 69 — transit + live rates nationwide)

This document tracks which data layers are loaded per region, data format inconsistencies, and the full inventory of DataSource entries in `data_loader.py`.

**Key stats:** 364 data sources loaded | 12 cities with GTFS transit | 25 councils with live rates API | 55+ CBD coordinates

---

## Coverage Matrix — Hazard Layers

Legend: **Y** = loader exists, **-** = not available/not loaded, **P** = partial

| Layer | Wellington | Auckland | Christchurch | Hamilton | Tauranga | Dunedin | QLDC | Nelson | Hawke's Bay | Whangarei | Northland | BOP | Waikato | Horizons | Gisborne | Southland | Canterbury | Marlborough | Tasman | Taranaki | West Coast | Otago (ORC) | National |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Flood** | Y | Y | Y | Y | Y | Y (H1/H2/H3) | Y (3 types) | Y (7 layers) | Y (HBRC regional+ponding) | Y | Y (10yr/50yr/100yr+suscept) | Y | Y (regional+1%AEP+Waipa) | Y (200yr+observed+floodways) | Y (2 layers) | Y | Y (Kaikoura+Waitaki+floodways) | Y (MEP) | Y | - | Y (TTPP 3 layers) | Y (Waitaki floodplain) | - |
| **Liquefaction** | Y | Y | Y | Y(Waikato) | Y | - | Y | Y (NRMP+Tahunanui) | Y (HBRC Heretaunga+CHB) | Y | - | Y (A+B) | Y | - | Y | Y | Y (9 districts) | Y (6 zones A-F) | Y | - | - | - | - |
| **Tsunami** | Y (GWRC all) | Y | Y | - | Y | Y (ORC) | - | Y (TOTS evac) | Y (HBRC 2024 evac) | - | Y (2024) | Y (evac+2500yr) | Y (2 layers) | - | Y (2019) | Y | Y (ECan) | Y (GNS) | Y (TOTS) | Y | Y (evac+TTPP) | - | - |
| **Active faults** | Y(WCC) | - | - | - | - | - | Y (faults+folds) | Y (3 overlays) | - | - | - | Y | - | - | - | Y | Y (ECan 2019+Kaikoura+Ostler) | - | Y | Y | Y (active+alpine+TTPP) | - | Y (GNS 10K) |
| **Slope/landslide** | Y (GWRC) | Y (2 types) | Y (CCC) | Y (riverbank) | Y (landslide) | Y (instability) | Y (5 types) | Y (3 layers) | Y (HBRC 7 categories) | Y | Y (erosion prone) | - | - | - | Y | - | Y (Kaikoura landslide+debris) | Y (steep erosion) | - | - | Y (3 types+rockfall) | - | Y (GNS) |
| **Coastal erosion** | Y | Y (ASCIE 2130) | Y | - | Y | Y (coastal hazard) | Y (erosion areas) | - | Y (HBRC present day) | - | Y (4 timeframes) | Y (2 layers) | - | Y (Horizons coastal) | Y | Y (ICC) | Y (ECan+RCEP) | - | - | - | Y | Y (ORC CoastPlan) | Y (CSI) |
| **Coastal inundation** | Y | Y | Y | - | - | - | - | Y (NRMP+coastal) | Y (HBRC 2023) | - | - | - | - | - | Y | Y (ICC) | Y (sea inundation) | Y (SLR) | Y (3 SLR scenarios) | - | - | Y (storm surge) | - |
| **Storm surge** | Y (GWRC 3 scenarios) | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Y (ORC all scenarios) | - |
| **Ground shaking** | Y | - | - | - | - | - | - | - | Y (HBRC amplification) | - | - | - | Y | - | - | Y | - | - | - | - | - | - | - |
| **Volcanic/Lahar** | - | Y (AVF 4 layers) | - | - | - | - | - | - | - | - | - | Y (calderas) | - | Y (Ruapehu lahar) | - | - | - | - | - | Y (hazard+evac) | - | - | - |

## Coverage Matrix — District Plan & Amenity Layers

| Layer | Wellington | Auckland | Christchurch | Hamilton | Tauranga | Dunedin | QLDC | Nelson | Hawke's Bay | Whangarei | Kapiti | Porirua | PNCC | Rotorua | Taupo | Timaru | Waimakariri | Invercargill | Gisborne | Tasman | West Coast |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Plan zones** | Y | Y (139K) | Y | Y | Y | Y | Y | Y (NRMP PC29) | Y | Y (4 types) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y (TTPP) |
| **Heritage** | Y (WCC 2024 DP) | Y | Y | Y | Y | Y | Y | Y (NRMP PC29) | - | Y | Y | Y | Y | - | Y | Y | Y | Y | - | - | - |
| **Notable trees** | Y (WCC 2024 DP) | Y | Y | Y | - | Y | - | Y (2 sources) | - | Y | Y | - | Y | - | Y | Y | Y | - | - | - | - |
| **Noise contours** | Y | Y (aircraft) | Y (airport 3 bands) | Y (airport) | Y (airport+port) | Y (airport) | - | - | - | - | - | - | Y (airport) | - | - | - | - | Y (airport+port) | Y (NZTA national road noise) | - | - |
| **Contaminated land** | Y | - | - | - | Y | Y (ORC) | Y (ORC) | - | Y | - | - | - | - | Y (BOP) | - | - | - | - | Y (TRC) | - | - |
| **Ecological areas** | - | Y | - | Y (SNA) | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |

## Coverage Matrix — National Layers (all regions)

| Layer | Source | Records | Notes |
|-------|--------|---------|-------|
| **Earthquakes** | GeoNet M3+ | ~50K | National coverage |
| **Climate projections** | NIWA grid | ~5K | Temperature change by SA2 |
| **Air quality** | LAWA | 72 sites | PM10/PM2.5 annual averages |
| **Water quality** | LAWA | 1,175 sites | MCI river health scores |
| **Schools** | MoE | ~2,500 | Decile, ERO, roll, type |
| **Crime** | NZ Police | ~2,800 | SA2-level crime density |
| **Deprivation** | NZDep | ~5K | 10-point scale by SA2 |
| **Building outlines** | LINZ | ~1.8M | Footprint area + height |
| **Property titles** | LINZ | ~1.5M | Title number, estate type |
| **Heritage NZ** | Heritage NZ | ~7,360 | National heritage list |
| **Infrastructure** | Te Waihanga | ~13,944 | Major projects |
| **Wildfire risk** | NIWA/FW | 30 stations | VHE fire weather days |
| **Conservation land** | DOC | ~12K | National parks, reserves |
| **DOC Huts** | DOC | ~990 | Backcountry huts (point) |
| **DOC Tracks** | DOC | ~3,153 | Walking/tramping tracks (line) |
| **DOC Campsites** | DOC | ~331 | Campsites (point) |
| **Road noise** | Waka Kotahi | ~224K polygons | LAeq24h national contours |
| **School zones** | MoE | ~1,317 | Enrolment scheme boundaries |
| **Active faults** | GNS | ~10K | National fault traces |
| **Landslides** | GNS | ~8K | Events + areas |

---

## Transit Data Coverage (GTFS)

**12 cities** with full GTFS transit data: stops, travel times to key destinations, and peak frequency.

| City | GTFS Source | Stops | Destinations | Travel Time Routes | Tables |
|------|-----------|-------|-------------|-------------------|--------|
| **Auckland** | `gtfs.at.govt.nz` | 7,023 | 11 (CBD, Airport, Hospital, Uni, Newmarket, Takapuna, Manukau, Henderson, Albany, Sylvia Park, Ponsonby, Mt Eden) | ~6,800 | `at_stops`, `at_travel_times`, `at_stop_frequency` |
| **Wellington** | `static.opendata.metlink.org.nz` | 3,154 | 12 (CBD, Airport, Hospital, Vic Uni, Lower Hutt, Petone, J'ville, Porirua, Courtenay Pl, Newtown, Kilbirnie, Miramar) | ~7,200 | `metlink_stops`, `transit_travel_times`, `transit_stop_frequency` |
| **Hamilton** | Waikato RC GTFS | 1,570 | 9 (CBD, Hospital, The Base, Uni, Transport Centre, Chartwell, Hillcrest, Airport, Rototuna) | 2,568 | `transit_stops`, `transit_travel_times`, `transit_stop_frequency` |
| **Tauranga/BOP** | Trillium BayBus | 1,198 | 10 (CBD, Hospital, Mt Maunganui, Papamoa, Bayfair, Bethlehem, Greerton, Airport, Tauriko, Waikato Uni) | 1,130 | `transit_stops` |
| **Dunedin** | ORC GTFS | 907 | 8 (CBD, Hospital, Otago Uni, South Dunedin, Mosgiel, Port Chalmers, St Clair, Airport) | 2,374 | `transit_stops` |
| **Hawke's Bay** | Trillium HB | 461 | 8 (Napier CBD, Hastings CBD, both Hospitals, EIT, Taradale, Havelock North, Airport) | 868 | `transit_stops` |
| **Palmerston North** | Horizons GTFS | 885 | 6 (CBD, Hospital, Massey Uni, Airport, Arena, Highbury) | 808 | `transit_stops` |
| **Nelson** | Trillium eBus | 231 | 6 (CBD, Hospital, Richmond, Stoke, Tahunanui, Airport) | 580 | `transit_stops` |
| **Rotorua** | Trillium BayBus | 1,198 | 6 (CBD, Hospital, Airport, Whakarewarewa, Western Heights, Ngongotaha) | 376 | `transit_stops` |
| **Whangarei** | Trillium CityLink | 273 | 6 (CBD, Hospital, NorthTec, Kamo, Tikipunga, Onerahi) | 354 | `transit_stops` |
| **Taranaki** | Trillium Citylink | 386 | 6 (CBD, Hospital, Bell Block, Fitzroy, Merrilands, Westown) | 326 | `transit_stops` |
| **Queenstown** | ORC GTFS | 907 | 7 (CBD, Airport, Frankton, Arrowtown, Remarkables Park, Lake Hayes, Jack's Point) | 248 | `transit_stops` |

**Not available:** Christchurch (GTFS needs API key), Invercargill (no GTFS feed)

### How transit data flows into reports

1. **SQL report function** (`get_property_report`) queries `metlink_stops` (Wellington only)
2. **`get_transit_data()` SQL helper** queries all three tables with COALESCE fallback (metlink → AT → regional)
3. **`_overlay_transit_data()` Python post-processor** calls `get_transit_data()` and overlays results onto the report when Wellington metlink returns nothing
4. Report fields populated: `bus_stops_800m`, `rail_stops_800m`, `ferry_stops_800m`, `transit_travel_times`, `peak_trips_per_hour`, `nearest_stop_name`

---

## Live Council Rates API Coverage

**25 councils** have live rates API integration for fresh CV/LV/IV data.

Both the **free on-screen report** (`_fix_unit_cv()` in property.py) and the **paid snapshot** (snapshot_generator.py) call the same council APIs.

| # | Council | Module | Endpoint Type | CV | LV | IV | Rates |
|---|---------|--------|--------------|:--:|:--:|:--:|:-----:|
| 1 | Wellington | `rates.py` | WCC rates API + cache | Y | Y | Y | Y |
| 2 | Auckland | `auckland_rates.py` | AC rates API | Y | Y | Y | Y |
| 3 | Lower Hutt | `hcc_rates.py` | ArcGIS MapServer | Y | Y | Y | Y |
| 4 | Upper Hutt | `uhcc_rates.py` | ArcGIS Online FeatureServer | Y | - | - | Y |
| 5 | Porirua | `pcc_rates.py` | ArcGIS MapServer | Y | Y | Y | - |
| 6 | Kapiti Coast | `kcdc_rates.py` | ArcGIS MapServer | Y | Y | Y | - |
| 7 | Horowhenua | `hdc_rates.py` | ArcGIS MapServer | Y | Y | Y | - |
| 8 | Hamilton | `hamilton_rates.py` | ArcGIS FeatureServer | Y | Y | Y | - |
| 9 | Dunedin | `dcc_rates.py` | ArcGIS MapServer | Y | - | - | - |
| 10 | Christchurch | `ccc_rates.py` | CCC rates API + cache | Y | Y | Y | Y |
| 11 | New Plymouth | `taranaki_rates.py` | ArcGIS FeatureServer | Y | Y | Y | - |
| 12 | Tasman | `tasman_rates.py` | ArcGIS MapServer | Y | Y | Y | - |
| 13 | Tauranga | `tcc_rates.py` | ArcGIS FeatureServer (2-step) | Y | Y | Y | Y |
| 14 | Western BOP | `wbop_rates.py` | ArcGIS MapServer (4-layer join) | Y | Y | Y | - |
| 15 | Palmerston North | `pncc_rates.py` | ArcGIS Online FeatureServer | Y | Y | - | Y |
| 16 | Whangarei | `wdc_rates.py` | ArcGIS MapServer | Y | Y | Y | - |
| 17 | Queenstown | `qldc_rates.py` | ArcGIS FeatureServer | Y | Y | Y | - |
| 18 | Invercargill | `icc_rates.py` | ArcGIS MapServer | Y | Y | Y | - |
| 19 | Hastings | `hastings_rates.py` | ArcGIS MapServer | Y | Y | Y | - |
| 20 | Gisborne | `gdc_rates.py` | ArcGIS Online FeatureServer | Y | Y | Y | Y |
| 21 | Nelson | `ncc_rates.py` | MagiqCloud scraping | Y | Y | Y | Y |
| 22 | Rotorua | `rlc_rates.py` | ArcGIS Online FeatureServer | Y | Y | Y | Y |
| 23 | Timaru | `timaru_rates.py` | ArcGIS MapServer | Y | Y | Y | - |
| 24 | Marlborough | `mdc_rates.py` | ArcGIS MapServer | Y | Y | Y | - |
| 25 | Whanganui | `wdc_whanganui_rates.py` | GeoServer WFS (2-step) | Y | Y | Y | - |

**No API available:** Napier (falls back to bulk `council_valuations` table)

### How CV flows into price calculations

1. **SQL report function** → spatial match from `council_valuations` table (bulk-loaded, may be stale or wrong unit)
2. **`_fix_unit_cv()`** → calls live council API by city → overwrites CV/LV/IV with fresh per-unit data
3. **Price advisor** → takes the corrected CV → adjusts forward using HPI (`CV × HPI_now / HPI_at_valuation`) → cross-checks with yield inversion → applies property adjustments → produces estimated value band
4. **Report cached** 24h with corrected values

### HPI Data

| Table | Source | Records | Fields |
|-------|--------|---------|--------|
| `hpi_national` | RBNZ M10 (CoreLogic) | 143 | `quarter_end`, `house_price_index`, `house_sales`, `housing_stock_value_m` |
| `rbnz_housing` | Same source | 143 | Same + `residential_investment_real_m` |

Used by: price advisor (HPI-adjusted CV), report market section, snapshot generator.

---

## CBD Distance Coverage

**55+ cities/towns** now have CBD coordinates defined in:
- `rent_advisor.py` → `_CBD_COORDS` dict (Python-side, used for live reports)
- `migrations/0016_expand_cbd_points.sql` → `get_nearest_cbd_point()` SQL function (database-side)

| Region | Cities with CBD coords |
|--------|----------------------|
| Greater Wellington | Wellington, Lower Hutt, Upper Hutt, Porirua, Paraparaumu/Kapiti |
| Wairarapa | Masterton, Carterton, Greytown |
| Manawatu-Whanganui | Palmerston North, Whanganui, Levin, Feilding |
| Auckland | Auckland (Britomart) |
| Waikato | Hamilton, Cambridge, Te Awamutu, Tokoroa, Matamata, Huntly, Thames, Paeroa, Taupo, Te Kuiti, Otorohanga |
| Bay of Plenty | Tauranga/Mt Maunganui, Whakatane, Rotorua |
| Canterbury | Christchurch, Timaru, Ashburton, Rangiora, Rolleston, Kaikoura, Oamaru |
| Otago | Dunedin, Queenstown, Alexandra, Cromwell, Balclutha, Wanaka |
| Southland | Invercargill, Gore |
| Top of the South | Nelson, Blenheim, Richmond |
| West Coast | Greymouth, Westport |
| Northland | Whangarei, Kerikeri, Dargaville |
| Taranaki | New Plymouth |
| Hawke's Bay | Napier, Hastings |
| Gisborne | Gisborne |

---

## Council Valuations Coverage

**~1,683,000 properties across 32+ councils**

| Council | Code | Records | Source Type |
|---------|------|---------|------------|
| Auckland | auckland | ~578K | ArcGIS FeatureServer |
| Christchurch | christchurch | 185,579 | ArcGIS MapServer |
| Dunedin | dunedin | 58,461 | ArcGIS MapServer (1K/page) |
| Hamilton | hamilton | 44,546 | Web scrape |
| Tauranga | tauranga | 63,674 | ArcGIS FeatureServer |
| Wellington | WCC | ~75K | ArcGIS FeatureServer |
| Hutt City | hcc | ~46K | ArcGIS MapServer |
| Upper Hutt | uhcc | ~10K | MagiqCloud scrape |
| Porirua | PCC | 21,081 | ArcGIS MapServer |
| Kapiti Coast | KCDC | 27,191 | ArcGIS MapServer |
| Taranaki | taranaki | 58,213 | ArcGIS FeatureServer |
| Tasman | tasman | 28,386 | ArcGIS MapServer |
| Whangarei | whangarei | 49,752 | ArcGIS MapServer |
| Palmerston North | pncc | 35,372 | ArcGIS Online |
| Hastings | hastings | 33,656 | ArcGIS (rates only) |
| Queenstown-Lakes | qldc | 33,074 | ArcGIS Online |
| Invercargill | icc | 26,691 | ArcGIS MapServer |
| Western BOP | wbop | 26,399 | ArcGIS (4-layer join) |
| Horowhenua | HDC | 19,303 | Horizons Regional |
| Whanganui | whanganui | 22,904 | Horizons Regional |
| Manawatu | manawatu | 15,859 | Horizons Regional |
| Rangitikei | rangitikei | 8,675 | Horizons Regional |
| Tararua | tararua | 10,773 | Horizons Regional |
| Ruapehu | ruapehu | 9,650 | Horizons Regional |
| Selwyn | selwyn | 37,222 | ECan Property |
| Waimakariri | waimakariri | 30,536 | ECan Property |
| Ashburton | ashburton | 17,214 | ECan Property |
| Timaru | timaru | 24,400 | ECan Property |
| Hurunui | hurunui | 9,255 | ECan Property |
| Waimate | waimate | 4,454 | ECan Property |
| Mackenzie | mackenzie | 4,372 | ECan Property |
| Waitaki | waitaki | 12,295 | ECan Property |
| Marlborough | marlborough | ~27K | ArcGIS MapServer |
| Waikato DC + 6 sub-councils | various | ~120K | WRC FeatureServer |
| Wairarapa (3 councils) | various | ~27K | Masterton GIS |
| West Coast (3 councils) | various | ~32K | WCRC MapServer |
| Otago (4 councils) | various | ~66K | ORC MapServer |

---

## Data Format Inconsistencies

### Flood Zones
| Region | Format | Notes |
|--------|--------|-------|
| Wellington (GWRC) | "1% AEP flood hazard" | Single return period |
| Christchurch (CCC) | "CCC 10yr", "CCC 50yr", "CCC 200yr" | Three return periods |
| Auckland | "Flood Prone Area" | Binary (in/out of zone) |
| Northland | "River Flood Zone (10yr)", "(50yr)" | Two return periods |
| Waikato | Location + depth group + climate change scenario | Most detailed |

### Liquefaction
| Region | Categories | Source |
|--------|-----------|--------|
| Wellington (GWRC) | Low, Moderate, High, Very High | Begg & Mazengarb 1996 |
| Christchurch (CCC) | 5-level vulnerability | CCC post-earthquake |
| ECan districts | "Liquefaction damage is possible/unlikely" | GNS district studies 2006-2024 |
| Marlborough | Zone A-F investigation zones | Investigation priority |
| Tauranga | 7 vulnerability levels | TCC assessment |

### Tsunami
| Region | Zone scheme | Notes |
|--------|------------|-------|
| Wellington | Shore Exclusion, Self Evacuation, CDEM Evacuation | Action-based |
| Christchurch | Red, Orange, Yellow | Colour-coded |
| Northland (2024) | Blue, Green, Red | Updated zones |
| Hawke's Bay | Wave source + return period | Most detailed |
| Marlborough | Yellow, Orange, Red evacuation zones | GNS modelling |

---

## Full DataSource Registry (426 entries in data_loader.py)

### By Category

| Category | Count | Key |
|----------|-------|-----|
| **Hazard — flood** | ~55 | flood_hazard table, per-council |
| **Hazard — liquefaction** | ~35 | liquefaction_detail table |
| **Hazard — tsunami** | ~25 | tsunami_hazard / tsunami_zones |
| **Hazard — faults/seismic** | ~25 | active_faults / fault_zones |
| **Hazard — slope/landslide** | ~20 | slope_failure / landslide_areas |
| **Hazard — coastal** | ~25 | coastal_erosion / coastal_inundation |
| **Hazard — ground shaking** | ~10 | ground_shaking |
| **Hazard — volcanic/geothermal** | ~10 | volcanic hazard, geothermal, caldera |
| **District plan zones** | ~30 | district_plan_zones / plan_zones |
| **Heritage sites** | ~25 | heritage / historic_heritage_overlay |
| **Notable trees** | ~22 | notable_trees |
| **Noise contours** | ~20 | noise_contours / aircraft_noise_overlay |
| **Contaminated land** | ~12 | contaminated_land |
| **Ecological areas** | ~15 | significant_ecological_areas |
| **Council valuations** | ~45 | council_valuations |
| **Transit/GTFS** | 8 | transit_stops / transit_travel_times |
| **National datasets** | ~20 | Various (GNS, LINZ, MoE, etc.) |
| **Other overlays** | ~20 | viewshafts, character precincts, etc. |

### Coverage Per Region (non-rates, non-national layers)

| Region | Count | Key Areas |
|--------|:-----:|-----------|
| Auckland | 27 | Flood, liquefaction, tsunami, landslide, volcanic (AVF), heritage, zones, ecological, noise |
| Nelson | 25 | NRMP PC29 (zones, heritage, faults, liquefaction, slope, flood, inundation, tsunami) |
| ECan (Canterbury) | 22 | 9 district liquefaction maps, tsunami, coastal, faults, flood, landslide |
| Marlborough | 17 | 6 liquefaction zones, tsunami, SLR, flood, erosion |
| Porirua | 16 | Fault rupture, liquefaction, ground shaking, landslide, coastal erosion/inundation, tsunami (3 return periods) |
| Hawke's Bay | 15 | 7 landslide categories, liquefaction, amplification, coastal, tsunami, flood |
| Taranaki (TRC+NPDC) | 15 | Zones, heritage, trees, liquefaction, flood, fault, coastal, volcanic, noise, SNA |
| Wellington (WCC) | 14 | Hazards, solar, heritage, trees, corrosion, viewshafts, district plan |
| West Coast | 14 | Active faults, alpine fault, landslides, rockfall, TTPP plan, coastal, tsunami, flood |
| Rotorua | 14 | Geothermal, fault avoidance, liquefaction, soft ground, landslide, 3 flood models, heritage, trees, SNA, noise, caldera |
| Tauranga | 13 | Flood, liquefaction, tsunami, slope, coastal, heritage, noise, trees, harbour inundation |
| Hamilton | 12 | Flood (4 types), heritage, trees, SNA, zones, noise, seismic |
| Dunedin | 12 | 3 flood tiers, instability, tsunami, zones, coastal, heritage, trees, noise |
| Upper Hutt | 12 | Zones, heritage, trees, fault, flood (3 types), slope, peat, erosion, ecological, contaminated |
| Wairarapa | 12 | Zones, heritage, trees, SNA, faults, flood (2 periods), liquefaction, tsunami, contaminated, erosion, noise |
| Gisborne | 12 | Flood, tsunami, liquefaction, coastal (3 types), stability, zones, heritage, noise (2), contaminated |
| Invercargill | 12 | Zones, heritage (2), trees, flood, SLR, coastal, liquefaction, amplification, noise (2), biodiversity |
| GWRC | 11 | Earthquake, landslide, flood, erosion, tsunami, storm surge (3 scenarios), coastal |
| Northland | 11 | Tsunami, flood (5 timeframes), coastal (2), erosion prone, flood susceptible |
| Southland | 11 | Liquefaction, shaking, tsunami, flood (2), faults, contaminated, heritage, coastal, noise, HAIL |
| Kapiti | 11 | Zones, heritage, trees, flood (3 types), fault, tsunami, coastal erosion (2), ecological |
| Lower Hutt | 11 | Zones, heritage (2), trees, flood (3 types), tsunami (2), coastal (2) |
| Christchurch | 11 | Zones, tsunami, heritage, trees, slope, coastal (2), flood, noise (3 bands) |
| Waikato | 10 | Liquefaction, flood (4 types), ground shaking, tsunami (2), geothermal (2) |
| QLDC | 10 | Flood, liquefaction, landslide, faults, folds, avalanche, debris, erosion, alluvial fans, damburst |
| BOP | 10 | Tsunami (2), liquefaction (2), faults, historic floods, calderas, coastal (2), contaminated |
| Tasman | 10 | Liquefaction, coastal SLR (5 scenarios), faults, floods, zones, erosion |
| Taupo | 10 | Zones, heritage, trees, faults (2), flood, noise, geothermal, liquefaction, landslide |
| Timaru | 10 | Zones, heritage, trees (2), flood, liquefaction, fault, coastal, ecological, noise |
| Waimakariri | 10 | Zones, heritage, trees, faults (2), flood (3), liquefaction, ecological |
| Whangarei | 13 | Zones (4), heritage, trees, flood, liquefaction, stability, coastal, noise (2), tsunami |
| ORC/Otago | 10 | Liquefaction, HAIL, storm surge, floodplain, coastal, tsunami (2), floodways (3) |
| Horizons | 8 | Flood (3 types), floodways, lahar, coastal, liquefaction, tsunami |
| Palmerston North | 8 | Zones, heritage (2), trees (2), flood, noise, overlays |
| Waipa | 6 | Flood, zones, heritage, trees, SNA, noise |

**Note:** Properties in Waipa also receive Waikato regional layers (+10), Palmerston North gets Horizons layers (+8), giving effective 16+ layers each.

### Session 68 Additions (2026-03-27) — Coverage Expansion

**~110 new DataSource entries** bringing total from 290 regional to 378 regional (426 total with rates/national/GTFS):

**Wellington sub-regions (51 new):**
- Lower Hutt (11): zones, heritage (2), trees, flood (3), tsunami (2), coastal (2)
- Upper Hutt (12): zones, heritage, trees, fault, flood (3), slope, peat, erosion, ecological, contaminated
- Porirua (13): fault rupture, liquefaction, ground shaking, landslide (2), coastal erosion (2), coastal inundation (2), tsunami (3 return periods), ecological
- Kapiti (6): tsunami, coastal erosion (2), ecological, flood river corridor, flood ponding
- Wairarapa (12): zones, heritage, trees, SNA, faults, flood (2), liquefaction, tsunami, contaminated, erosion, noise

**South Island (25 new):**
- Invercargill (7): liquefaction, amplification, airport/port noise, archaeological, biodiversity, trees
- Southland (5): contaminated, flood, heritage, coastal, noise
- ORC/Otago (5): tsunami, floodways (3), Dunedin tsunami
- Tasman (3): SLR +0.5m/+1.5m scenarios, coastal erosion structures
- Timaru (3): trees supplement, ecological, noise
- Waimakariri (2): liquefaction, ecological

**Waikato/BOP (33 new):**
- Rotorua (13): geothermal, fault avoidance, liquefaction, soft ground, landslide, 3 flood models, trees, heritage, SNA, noise, caldera
- Hamilton (4): flood extents, flood depressions, seismic, natural hazard
- Tauranga (4): harbour inundation, flood DxV, trees, archaeological
- Waikato regional (2): geothermal systems, geothermal subsidence
- Waipa (5): zones, heritage, trees, SNA, airport noise
- Taupo (5): flood, noise, geothermal, liquefaction, landslide

**Lower North Island (27 new):**
- Taranaki/NPDC (12): zones, heritage, trees, liquefaction, flood (2), fault, coastal erosion, coastal flood, volcanic, noise, SNA
- Horizons (3): liquefaction, tsunami, flood modelled
- Palmerston North (3): heritage, trees, overlays
- Gisborne (5): heritage, port noise, airport noise, contaminated, coastal erosion
- Whangarei (4): coastal hazard, airport noise, noise control, tsunami

### Session 65 Additions (2026-03-26)

**New hazard loaders (~55 entries):**
- QLDC: active faults, folds, avalanche, debris/rockfall, erosion, alluvial fans, damburst flood, rainfall flood
- ECan: 9 district liquefaction maps, tsunami evacuation, coastal hazard
- Southland: liquefaction, shaking, tsunami, floodplains, active faults
- Northland: tsunami 2024, river flood 10yr/50yr, coastal flood
- BOP: tsunami evacuation 2023, tsunami 2500yr, liquefaction A+B, active faults, historic floods, calderas
- Waikato: tsunami hazard class, tsunami inundation, regional flood, flood depth
- Gisborne: flood, tsunami, liquefaction, coastal hazard, stability, coastal flooding
- Nelson: future flooding 2130, floodway
- Marlborough: tsunami, SLR modelling, 6 liquefaction zones
- Tasman: liquefaction, 3 coastal SLR scenarios, active faults, historic floods
- Taranaki: volcanic evacuation zones

**New district plan zones (~15 entries):**
- Whangarei (4 zone types), Invercargill, Kapiti Coast, Porirua, Palmerston North, QLDC, Rotorua, Taupo, Timaru, Waimakariri, Gisborne

**New heritage sites (~9 entries):**
- Whangarei, Invercargill, Kapiti Coast, Porirua, Palmerston North, QLDC, Taupo, Timaru, Waimakariri

**New notable trees (~6 entries):**
- Whangarei, Kapiti Coast, Palmerston North, Taupo, Timaru, Waimakariri

**New noise contours (~6 entries):**
- Christchurch Airport (50/55/65dB), Hamilton Airport, Palmerston North Airport, Marlborough (airport+port)

**New contaminated land (~1 entry):**
- Bay of Plenty HAIL sites

**National data added:**
- Waka Kotahi road noise contours (488K polygons nationwide)
- NRC contaminated land (Northland IRIS SLUs)
- MoE school enrolment zones

---

## Loader Scripts

### Invocation
All loaders are triggered via admin panel or CLI:
```bash
python -m app.services.data_loader --load <key>
```

### GTFS Transit Feeds
| City | GTFS URL | Auth | Destinations |
|------|----------|------|:---:|
| Wellington | Metlink GTFS (internal) | None | 12 |
| Auckland | AT GTFS (internal) | None | 12 |
| Christchurch | `apis.metroinfo.co.nz/.../gtfs.zip` | **API key** | 9 |
| Hamilton | `wrcscheduledata.blob.core.windows.net/.../busit-nz-public.zip` | None | 7 |
| Dunedin | `www.orc.govt.nz/transit/google_transit.zip` | None | 5 |
| Nelson | `data.trilliumtransit.com/gtfs/nsn-nz/nsn-nz.zip` | None | 4 |
| New Plymouth | `data.trilliumtransit.com/gtfs/trc-nz/trc-nz.zip` | None | 3 |
| Palmerston North | `horizons.govt.nz/.../HRC_GTFS_Production.zip` | None | 4 |

---

## Remaining Priority Gaps — Hazard Layers

Sorted by impact (population × hazard severity). Columns: **Feasibility** = how likely we can get the data; **Effort** = dev time estimate.

### Flood (Canterbury, Marlborough, Taranaki missing)

| Region | Gap | Potential Source | Feasibility | Effort | Notes |
|--------|-----|-----------------|:-----------:|:------:|-------|
| Canterbury (ECan) | Regional flood hazard maps | `mapviewer.canterburymaps.govt.nz` — "Flood Hazard" layer | High | Low | ECan has good ArcGIS infrastructure, likely same pattern as liquefaction |
| Marlborough | Flood hazard zones | `gis.marlborough.govt.nz` or `maps.marlborough.govt.nz` | Medium | Low | MDC has ArcGIS, may need layer discovery |
| Taranaki | Flood zones | TRC hazard portal or regional council GIS | Medium | Low | Smaller region, may not have detailed spatial flood data |

### Liquefaction (Dunedin, Northland, Taranaki missing)

| Region | Gap | Potential Source | Feasibility | Effort | Notes |
|--------|-----|-----------------|:-----------:|:------:|-------|
| Dunedin | Liquefaction susceptibility | ORC or DCC hazard maps | Low | Low | Dunedin on bedrock — may genuinely not have liquefaction mapping |
| Northland | Liquefaction zones | NRC hazard portal | Medium | Low | May be available via `gis.nrc.govt.nz` |
| Taranaki | Liquefaction zones | TRC GIS | Low | Low | Volcanic soils — may not have standard liquefaction studies |

### Tsunami (Hamilton, QLDC, Nelson, Whangarei, Tasman missing)

| Region | Gap | Potential Source | Feasibility | Effort | Notes |
|--------|-----|-----------------|:-----------:|:------:|-------|
| Hamilton | Tsunami | N/A | N/A | N/A | **Inland city** — no tsunami risk, gap is expected |
| QLDC | Tsunami | N/A | N/A | N/A | **Inland district** — no coastal tsunami zones expected |
| Nelson | Tsunami | `gis.nelson.govt.nz` or GNS national model | Medium | Low | Tasman Bay exposure — may have GNS/NIWA modelling |
| Whangarei | Tsunami | NRC or `gis.nrc.govt.nz` (distinct from Northland regional) | Medium | Low | May be included in Northland 2024 dataset |
| Tasman | Tsunami | `gis.tasman.govt.nz` or GNS model | Medium | Low | Golden Bay/Abel Tasman coast exposed |

### Active Faults (many regions missing — Auckland, Christchurch, Hamilton, Tauranga, Dunedin, HB, Whangarei, Northland, Waikato, Gisborne, Marlborough)

| Gap | Notes |
|-----|-------|
| Most gaps expected | GNS national fault trace data (10K entries) provides **national coverage** — council-specific datasets only add local detail |
| Auckland, Christchurch, Dunedin | Not on major active faults — no council-level data expected |
| Hawke's Bay, Waikato, Marlborough | May have regional overlays but GNS national data already covers these |
| **Action:** None required — GNS 10K national dataset already provides fault proximity for all regions |

### Slope/Landslide (Northland, BOP, Waikato, Southland, Canterbury, Marlborough, Tasman, Taranaki missing)

| Region | Gap | Potential Source | Feasibility | Effort | Notes |
|--------|-----|-----------------|:-----------:|:------:|-------|
| All regions | GNS national landslide database covers all NZ | Already loaded (8K events + areas) | N/A | N/A | National data provides base coverage |
| Canterbury | Council-specific slope hazard | `mapviewer.canterburymaps.govt.nz` — "Mass Movement" layer | Medium | Low | Port Hills landslide data post-earthquakes |
| Northland | Landslide susceptibility | NRC hazard portal | Low | Low | Limited spatial data available |
| Taranaki | Lahar/debris flow zones | TRC volcanic hazard maps | Medium | Low | Volcanic-specific slope hazards |

### Coastal Erosion & Inundation (many inland regions N/A)

| Region | Gap | Potential Source | Feasibility | Effort | Notes |
|--------|-----|-----------------|:-----------:|:------:|-------|
| Hamilton, Waikato (inland) | N/A | N/A | N/A | N/A | Inland — no coastal risk |
| Northland | Coastal erosion/inundation | NRC coastal hazard maps | Medium | Low | Extensive coastline — data likely exists |
| BOP | Coastal erosion | BOPRC coastal plan maps | Medium | Low | May be in regional hazard portal |
| Nelson | Coastal erosion | Nelson City Council GIS | Medium | Low | Limited coastline |
| Tasman | Coastal erosion | Already have 3 SLR scenarios | Partial | N/A | SLR covers inundation, erosion mapping may not exist separately |

### Ground Shaking (most regions missing — only Wellington, HB, Waikato, Southland have it)

| Gap | Notes |
|-----|-------|
| Most councils don't publish ground shaking maps | Only regional councils with seismic microzone studies produce this |
| **National option:** GNS/NSHM 2022 | National Seismic Hazard Model provides PGA values but is raster/grid format, not polygons |
| **Action:** Low priority — earthquake proximity (GeoNet) + active faults (GNS) already provide seismic risk signal |

### Volcanic (only BOP calderas + Taranaki evacuation)

| Gap | Notes |
|-----|-------|
| Auckland Volcanic Field (AVF) | Auckland Council has AVF eruption scenario mapping — `aucklandcouncil.govt.nz` hazard maps |
| Tongariro/Ruapehu lahar zones | DOC/GNS lahar modelling — may be available as spatial data |
| **Action:** Medium priority — AVF affects 1.7M people, worth adding if ArcGIS layer found |

---

## Remaining Priority Gaps — District Plan & Amenity Layers

### Plan Zones (only Nelson missing)

| Region | Gap | Potential Source | Feasibility | Notes |
|--------|-----|-----------------|:-----------:|-------|
| Nelson | District plan zones | `gis.nelson.govt.nz` or Nelson Resource Management Plan maps | Medium | Small council, may use non-standard GIS |

### Heritage Sites (Nelson, Hawke's Bay, Rotorua, Gisborne missing)

| Region | Gap | Potential Source | Feasibility | Notes |
|--------|-----|-----------------|:-----------:|-------|
| Nelson | Heritage buildings/sites | Nelson City Council DP maps | Medium | Small list, may not be in GIS |
| Hawke's Bay | Heritage sites | HBRC or HDC/NCC district plan maps | Medium | Art Deco precinct likely mapped |
| Rotorua | Heritage sites | RLC district plan | Low | On-premise server issues (see Known Blockers) |
| Gisborne | Heritage sites | GDC district plan maps | Medium | Small list expected |

### Notable Trees (Tauranga, QLDC, HB, Porirua, Rotorua, Invercargill, Gisborne missing)

| Region | Gap | Potential Source | Feasibility | Notes |
|--------|-----|-----------------|:-----------:|-------|
| Tauranga | Notable trees | TCC district plan overlays | Medium | May be in same ArcGIS as other TCC data |
| Porirua | Notable trees | PCC district plan | Medium | Small list |
| Invercargill | Notable trees | ICC district plan or Southland maps | Medium | |
| Gisborne | Notable trees | GDC district plan | Low | Very small city |
| QLDC, HB, Rotorua | Notable trees | Various | Low | Lower priority |

### Noise Contours (many smaller councils missing)

| Gap | Notes |
|-----|-------|
| Missing councils | QLDC, Nelson, Hawke's Bay, Whangarei, Kapiti, Porirua, Rotorua, Taupo, Timaru, Waimakariri |
| **Mitigation:** Waka Kotahi national road noise (488K polygons) covers all regions for road noise |
| **Action:** Only airport noise contours are missing — these are typically in district plans as "Airport Noise Boundary" overlays |
| **Priority airports:** Queenstown (polylines only — needs conversion), Napier/Hastings, Rotorua, Nelson |

### Contaminated Land (most councils missing)

| Gap | Notes |
|-----|-------|
| Auckland | $128-228/report — not publicly available |
| Christchurch/Canterbury | LLUR is a custom web app, not ArcGIS REST |
| Hamilton/Waikato | Per-property request only |
| Marlborough | Not exposed as GIS layer |
| Nelson, Northland (non-NRC), Southland, Tasman | Unknown availability |
| **Action:** Low ROI — most councils restrict contaminated land data. Current coverage (Wellington, Tauranga, Dunedin/ORC, QLDC/ORC, HB, BOP, Taranaki) is already good for key regions |

### Ecological Areas (only Auckland + Hamilton have data)

| Gap | Notes |
|-----|-------|
| Most councils | SNAs are mapped in district plans but not always exposed via GIS REST endpoints |
| **National option:** DOC protected areas (already loaded) + LENZ (Land Environments NZ) from Landcare |
| **Action:** Low priority — ecological data is less impactful for property buyers than hazard/zone data |

---

## Known Blockers (not publicly available or technically blocked)

| Data | Reason | Workaround |
|------|--------|------------|
| Auckland contaminated land | Council charges $128-228/report | None — paywall |
| Canterbury LLUR (contaminated) | Custom web app, not ArcGIS REST | Could scrape but high effort |
| Waikato contaminated land | Per-property request only | None |
| Marlborough contaminated land | Not exposed as GIS layer | None |
| Solar potential | GeoTIFF raster format, not vector polygons | Would need raster→point lookup, different pipeline |
| Wind zones (outside Wellington) | Only GWRC has spatial wind data | NIWA wind atlas is raster |
| Christchurch GTFS | API key required | Register at `apidevelopers.metroinfo.co.nz` |
| Rotorua hazards | On-premise server unreachable from internet | Need to check if moved to cloud |
| Queenstown airport noise | Polylines only (not polygons) | Could buffer lines into polygons |
| GNS fault avoidance zones | WFS endpoint returns invalid JSON | Use national fault traces instead |
| Auckland landslide detail | FeatureServer very slow, causes OOM | GNS national data covers this |
| Auckland overland flow paths | DNS failure after 380K rows (VM OOM) | Load in smaller batches |

---

## Recommended Next Actions (priority order)

1. **Canterbury flood hazard** — High population, likely available via ECan ArcGIS, low effort
2. **Auckland Volcanic Field** — 1.7M affected, check Auckland Council hazard ArcGIS layers
3. **Marlborough flood hazard** — MDC has ArcGIS infrastructure, likely quick to add
4. **Canterbury slope/mass movement** — Port Hills data post-earthquake, high value for Christchurch
5. **Northland coastal hazard** — Extensive coastline, NRC likely has data
6. **Nelson district plan zones** — Last missing council for complete plan zone coverage
7. **Queenstown airport noise** — Buffer polylines to create usable polygons
8. **Tauranga notable trees** — Fill gaps in major city amenity coverage
9. **Hawke's Bay heritage** — Art Deco precinct is a significant heritage area
10. **Christchurch GTFS** — Register for API key, then simple to load
