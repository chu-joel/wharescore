# WhareScore — Data Layers Coverage Matrix

**Last Updated:** 2026-03-26 (session 66)

This document tracks which data layers are loaded per region, data format inconsistencies, and the full inventory of 344 DataSource entries in `data_loader.py`.

---

## Coverage Matrix — Hazard Layers

Legend: **Y** = loader exists, **-** = not available/not loaded, **P** = partial

| Layer | Wellington | Auckland | Christchurch | Hamilton | Tauranga | Dunedin | QLDC | Nelson | Hawke's Bay | Whangarei | Northland | BOP | Waikato | Gisborne | Southland | Canterbury | Marlborough | Tasman | Taranaki | West Coast | National |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Flood** | Y | Y | Y | Y | Y | Y (H1/H2/H3) | Y (3 types) | Y (7 layers) | Y | Y | Y (10yr/50yr/coastal+river) | Y | Y (regional+local+depth) | Y (2 layers) | Y | Y (Kaikoura+Waitaki+floodways) | Y (MEP) | Y | - | - | - |
| **Liquefaction** | Y | Y | Y | Y(Waikato) | Y | - | Y | Y (NRMP+Tahunanui) | Y | Y | - | Y (A+B) | Y | Y | Y | Y (9 districts) | Y (6 zones A-F) | Y | - | - | - |
| **Tsunami** | Y (GWRC all) | Y | Y | - | Y | Y (ORC) | - | Y (TOTS evac) | Y | - | Y (2024) | Y (evac+2500yr) | Y (2 layers) | Y (2019) | Y | Y (ECan) | Y (GNS) | Y (TOTS) | Y | - | - |
| **Active faults** | Y(WCC) | - | - | - | - | - | Y (faults+folds) | Y (3 overlays) | - | - | - | Y | - | - | Y | Y (ECan 2024) | - | Y | Y | Y (active+alpine) | Y (GNS 10K) |
| **Slope/landslide** | Y (GWRC) | Y (2 types) | Y (CCC) | Y (riverbank) | Y (landslide) | Y (instability) | Y (avalanche, debris, rockfall, erosion, alluvial) | Y (3 layers) | Y | Y | Y (erosion prone) | - | - | Y | - | - | Y (steep erosion) | - | - | Y (3 types) | Y (GNS) |
| **Coastal erosion** | Y | Y (ASCIE 2130) | Y | - | Y | Y (coastal hazard) | Y (erosion areas) | - | Y | - | Y (4 timeframes) | Y (2 layers) | - | Y | Y (ICC) | Y (ECan+RCEP) | - | - | - | - | Y (CSI) |
| **Coastal inundation** | Y | Y | Y | - | - | - | - | Y (NRMP+coastal) | - | - | - | - | - | Y | Y (ICC) | Y (sea inundation) | Y (SLR) | Y (3 SLR scenarios) | - | - | - |
| **Ground shaking** | Y | - | - | - | - | - | - | - | Y | - | - | - | Y | - | Y | - | - | - | - | - | - |
| **Volcanic** | - | Y (AVF 4 layers) | - | - | - | - | - | - | - | - | - | Y (calderas) | - | - | - | - | - | - | Y (hazard+evac) | - | - |

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

## Full DataSource Registry (344 entries in data_loader.py)

### By Category

| Category | Count | Key |
|----------|-------|-----|
| **Hazard — flood** | ~30 | flood_hazard table, per-council |
| **Hazard — liquefaction** | ~25 | liquefaction_detail table |
| **Hazard — tsunami** | ~15 | tsunami_hazard / tsunami_zones |
| **Hazard — faults/seismic** | ~15 | active_faults / fault_zones |
| **Hazard — slope/landslide** | ~15 | slope_failure / landslide_areas |
| **Hazard — coastal** | ~10 | coastal_erosion / coastal_inundation |
| **Hazard — ground shaking** | ~5 | ground_shaking |
| **Hazard — volcanic** | 3 | flood_hazard (volcanic type) |
| **District plan zones** | ~20 | district_plan_zones / plan_zones |
| **Heritage sites** | ~15 | heritage / historic_heritage_overlay |
| **Notable trees** | ~12 | notable_trees |
| **Noise contours** | ~10 | noise_contours / aircraft_noise_overlay |
| **Contaminated land** | ~8 | contaminated_land |
| **Council valuations** | ~45 | council_valuations |
| **Transit/GTFS** | 8 | transit_stops / transit_travel_times |
| **Ecological areas** | 3 | significant_ecological_areas |
| **National datasets** | ~20 | Various (GNS, LINZ, MoE, etc.) |
| **Other overlays** | ~20 | viewshafts, character precincts, etc. |

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
