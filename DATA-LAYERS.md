# WhareScore — Data Layers Coverage Matrix

**Last Updated:** 2026-03-23 (session 59)

This document tracks which data layers are loaded per region, data format inconsistencies, and what the `get_property_report()` SQL function expects.

---

## Coverage Matrix

Legend: **Y** = loaded, **-** = not available/not loaded, **P** = partial

| Layer | Report Field | Wellington | Christchurch | Auckland | Hamilton | Tauranga | Dunedin | National |
|-------|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Flood zones** | `flood_zone` | Y (GWRC, 14) | Y (CCC, 30K) | Y (AC, 48K) | Y (HCC, 14K) | Y (TCC, 108K) | - | 186K total |
| **Liquefaction** | `liquefaction` | Y (GWRC, 502) | Y (CCC, 600) | Y (AC, 1.2K) | - | Y (TCC, 422) | - | 2.7K total |
| **Tsunami** | `tsunami_evac_zone` | Y (GWRC, 60) | Y (CCC, 8) | Y (AC, 1.2K) | - | Y (TCC, 1) | - | 1.2K total |
| **Wind zones** | `wind_zone_speed` | Y (GWRC) | - | - | - | - | - | - |
| **District plan zones** | `zone_name`, `zone_code` | Y (WCC, 2.7K) | Y (CCC, 7.5K) | Y (139K) | Y (1K) | Y (2.7K) | Y (208) | - |
| **Transit stops** | `transit_stops_400m` | Y (Metlink, 3.1K) | Y (ECan, 1.6K) | Y (AT, 1K) | Y (1.6K) | - | Y (903) | 8.1K total |
| **Contaminated land** | `contam_nearest` | Y (GWRC, 2.4K) | Y (CCC, 906) | - | - | Y (TCC, 2K) | - | 6K total |
| **Coastal erosion** | `coastal_erosion` | Y (national CSI, 1.8K) | Y (CCC, 5.3K) | Y (1.2K) | - | Y (215) | - | - |
| **Earthquakes** | `earthquake_count_30km` | Y | Y | Y | Y | Y | Y | Y (GeoNet) |
| **Climate projections** | `climate_temp_change` | Y | Y | Y | Y | Y | Y | Y (NIWA grid) |
| **Air quality** | `air_quality_site` | Y | Y | Y | Y | Y | Y | Y (LAWA, 72 sites) |
| **Water quality** | `water_quality_site` | Y | Y | Y | Y | Y | Y | Y (LAWA, 1,175 sites) |
| **Schools** | `schools_1500m` | Y | Y | Y | Y | Y | Y | Y (MoE national) |
| **Crime** | `crime_percentile` | Y | Y | Y | Y | Y | Y | Y (NZ Police national) |
| **Deprivation** | `nzdep_decile` | Y | Y | Y | Y | Y | Y | Y (NZDep national) |
| **Building outlines** | `footprint_sqm` | Y | Y | Y | Y | Y | Y | Y (LINZ national) |
| **Property titles** | `title_no` | Y | Y | Y | Y | Y | Y | Y (LINZ national) |
| **Council valuations** | `capital_value` | Y (WCC) | Y (CCC) | Y | Y | Y (TCC) | Y (DCC) | 19 councils |
| **Height controls** | `max_height_m` | Y (WCC only) | - | - | - | - | - | - |
| **Resource consents** | `resource_consents_500m_2yr` | Y (GWRC, 26K) | - | - | - | - | - | ECan (115K avail) |
| **Heritage sites** | `heritage_listed` | Y | Y | Y | Y | Y | Y | Y (Heritage NZ, 7,360) |
| **Infrastructure** | `infrastructure_5km` | Y | Y | Y | Y | Y | Y | Y (Te Waihanga, 13,944) |
| **Wildfire risk** | `wildfire_vhe_days` | Y | Y | Y | Y | Y | Y | Y (30 stations) |
| **Solar potential** | `solar_max_kwh` | - | - | - | - | - | - | - (GeoTIFF not loaded) |
| **Slope hazard** | `slope_failure` | Y (GWRC) | P (CCC, 139 polygons fetched, no table) | - | - | - | - | - |
| **Fault zones** | `fault_zone_name` | - | P (ECan, 1K polygons fetched, no table) | - | - | - | - | - |
| **Noise contours** | `road_noise_db` | Y (Waka Kotahi, Wellington) | - | - | - | - | - | National API available |
| **Conservation land** | `conservation_nearest` | Y | Y | Y | Y | Y | Y | Y (DOC national) |

---

## Data Format Inconsistencies

### Flood Zones
| Region | `label` format | `title` format | Notes |
|--------|---------------|----------------|-------|
| Wellington (GWRC) | "1% AEP flood hazard" | River-specific names | Single return period (1% AEP = 100yr) |
| Christchurch (CCC) | "CCC 10yr", "CCC 50yr", "CCC 200yr" | "Flood Extent 10yr" etc. | Three return periods, much more granular |

**Issue:** The report function returns whichever polygon intersects first (`LIMIT 1`). For CCC, it might return 10yr when 50yr is more relevant. Wellington only has 1% AEP.

**Action needed:** Consider returning the most severe flood zone, or returning all matching return periods.

### Liquefaction
| Region | `source` | Categories | Scale |
|--------|----------|------------|-------|
| Wellington (GWRC) | "Begg & Mazengarb 1996", "QMap" | Low, Moderate, High, Very High | 4-level |
| Christchurch (CCC) | "CCC" | High/Medium/Low Vulnerability, Damage Possible, Damage Unlikely | 5-level |

**Issue:** Different category names. The `simplified` column was added to normalise but isn't used by the report function. The report function reads `liquefaction` directly.

**Action needed:** Map CCC categories to match Wellington scale, or display both.

### Tsunami
| Region | `evac_zone` values | `zone_class` (int) |
|--------|-------------------|-------------------|
| Wellington (GWRC) | Shore Exclusion Zone, Self Evacuation Zone, CDEM Evacuation Zone | 1-3 |
| Christchurch (CCC) | Red, Orange, Yellow | 1-3 |

**Issue:** Different naming conventions. Wellington uses evacuation action names, Christchurch uses colour codes.

**Action needed:** Normalise to a common display format (e.g., always show colour + action).

### Transit Stops
| Region | `source` | `mode_type` | Notes |
|--------|----------|------------|-------|
| Wellington | NULL (GTFS import) | NULL | 3,119 stops, no source/mode tagged |
| Christchurch | "ECan" | "bus" | 760 stops |
| Hamilton | "hamilton" | "bus" / "train" | 1,570 stops |

**Issue:** Wellington stops have NULL source and mode_type. Should be backfilled.

### District Plan Zones
| Region | `council` | `source_council` | Notes |
|--------|-----------|-----------------|-------|
| Wellington | "WCC" | NULL | 2,692 zones |
| Christchurch | "CCC" | "CCC" | 7,451 zones |
| Auckland | "Auckland" | "auckland" | 139,331 zones |
| Hamilton | "HCC" | "hamilton" | 1,000 zones |
| Tauranga | "TCC" | "tauranga" | 2,693 zones |
| Dunedin | "DCC" | "dunedin" | 208 zones |

**Fixed in session 59.** Council column normalised for all regions.

### CBD Distance
| City | Coordinates | Status |
|------|------------|--------|
| Wellington | 174.7762, -41.2865 | Working |
| Christchurch | 172.6362, -43.5321 | Working (migration 0009) |
| Auckland | 174.7685, -36.8442 | Working |
| Hamilton | 175.2793, -37.7870 | Working |
| + 10 more cities | Various | Working |

**Fixed in session 59.** Migration 0009 has region-aware CBD based on `town_city`.

---

## Tables and Record Counts

| Table | Total Records | Sources |
|-------|--------------|---------|
| `flood_zones` | **186,168** | GWRC (14), CCC (30K), Auckland (48K), Hamilton (14K), Tauranga (108K) |
| `liquefaction_zones` | **2,695** | GWRC (502), CCC (600), Auckland (1.2K), Tauranga (422) |
| `tsunami_zones` | **1,245** | GWRC (60), CCC (8), Auckland (1.2K), Tauranga (1) |
| `wind_zones` | ~171 | GWRC only |
| `district_plan_zones` | ~161K | WCC, CCC, Auckland, Hamilton, Tauranga, Dunedin |
| `transit_stops` | **8,100** | Metlink (3.1K), ECan (1.6K), AT (1K), Hamilton (1.6K), Dunedin, Taranaki, PN, Nelson |
| `contaminated_land` | **5,980** | GWRC (2.4K), CCC (906), Tauranga (2K), Hawke's Bay (678) |
| `coastal_erosion` | ~14K | National CSI (1.8K), CCC (5.3K), Auckland (1.2K), Tauranga (215) |
| `council_valuations` | ~1,424,000 | 19 councils |
| `addresses` | ~2.2M | LINZ national |
| `building_outlines` | ~1.8M | LINZ national |
| `schools` | ~2,500 | MoE national |
| `crime` | ~2,800 | NZ Police national |
| `earthquakes` | ~50K | GeoNet national |
| `heritage_sites` | ~7,360 | Heritage NZ national |
| `infrastructure_projects` | ~13,944 | Te Waihanga national |

---

## Priority Gaps (by impact)

### Completed (session 59)
- ~~Auckland flood zones~~ — **48K polygons** (flood plains + flood prone areas)
- ~~Auckland liquefaction~~ — **1,171 polygons** (calibrated assessment)
- ~~Auckland tsunami~~ — **1,176 polygons** (Red/Yellow zones)
- ~~Auckland bus stops~~ — **1,000 stops** (AT, partial — pagination limit)
- ~~Hamilton flood zones~~ — **14K polygons** (Low/Medium/High, partial — timeout on remaining 7K)
- ~~Tauranga flood~~ — **108K polygons** (5 risk classifications)
- ~~Tauranga liquefaction~~ — **422 polygons** (7 vulnerability levels)
- ~~Tauranga tsunami~~ — **1 polygon** (evacuation zone)
- ~~Tauranga contaminated land~~ — **2,000 polygons** (HAIL sites)
- ~~Christchurch all hazards~~ — flood 30K + liquefaction 600 + tsunami 8 + zones 7.5K + transit 1.6K + contaminated 906 + coastal 5.3K
- ~~Normalisation fixes~~ — district_plan_zones council column, transit_stops source/mode, CBD distance

### Medium Priority (remaining)
1. **Canterbury resource consents** — ECan has 115K records, API available at `gis.ecan.govt.nz/.../Resource_Consents/MapServer/45`
2. **Auckland bus stops (full)** — AT has 5,572 stops, only got 1,000 due to pagination. Re-fetch with proper paging.
3. **Hamilton remaining flood** — 7K polygons timed out. Retry with smaller page size.
4. **National noise contours** — Waka Kotahi has national data, only Wellington loaded.
5. **Slope hazard table** — CCC (139), Tauranga (5,122) data available but no dedicated table.
6. **Fault zones table** — ECan data (1K polygons) available but no dedicated table.
7. **Tauranga contaminated (full)** — Only got 2K of 2,607. Re-fetch remaining pages.

### Low Priority
8. **Solar potential** — GeoTIFF exists but not loaded.
9. **Wind zones for other regions** — Only GWRC loaded.
10. **Height controls** — Only WCC has spatial data. CCC has CBD height restrictions (55 polygons).
11. **Auckland contaminated land** — Not publicly available (council charges $128-228/report).
12. **Dunedin/other city hazards** — Lower population, lower priority.

---

## Loader Scripts

| Script | Layers | Regions |
|--------|--------|---------|
| `load_christchurch_hazards.py` | flood, liquefaction, tsunami, zones, transit, contaminated, coastal | CCC/ECan |
| `load_regional_hazards.py` | flood, liquefaction, tsunami, transit, contaminated | Auckland, Hamilton, Tauranga |
| *(no equivalent for Wellington)* | All Wellington layers were loaded via ogr2ogr / manual SQL | GWRC/WCC |
| `batch_load.py` | Addresses, parcels, buildings, schools, etc. | National LINZ |

**Action needed:** Create equivalent loaders for Auckland, Hamilton, and Tauranga hazard data.
