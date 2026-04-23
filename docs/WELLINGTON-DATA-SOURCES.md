# Wellington-Specific Data Sources — API Reference

## 1. WCC Open Data (ArcGIS REST APIs)

All at `gis.wcc.govt.nz`, polygon geometry, NZTM2000 (EPSG:2193), max 2000 records, no auth.

### 2024 District Plan Service
Base: `https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer`

| Dataset | Layer | Key Fields |
|---------|-------|------------|
| Fault Lines | 56-59 | `Name`, `DP_HazardRanking`, `Fault_Comp`, `RI_Class` |
| Flood — Inundation | 61 | `Name`, `DP_HazardRanking` (Low) |
| Flood — Overland Flowpath | 62 | `Name`, `DP_HazardRanking` (Medium) |
| Flood — Stream Corridor | 63 | `Name`, `DP_HazardRanking` (High) |
| Tsunami — Low (1:1000yr) | 52 | `Name`, `DP_HazardRanking`, `Scenario` |
| Tsunami — Medium (1:500yr) | 53 | `Name`, `DP_HazardRanking`, `Scenario` |
| Tsunami — High (1:100yr) | 54 | `Name`, `DP_HazardRanking`, `Scenario` |
| Zones | 122 | `DPZone`, `DPZoneCode`, `Category`, `ePlan_URL` |

### Legacy Services
- Tsunami Evacuation: `.../Environment/TsunamiEvacuationZones/MapServer/1` → `Zone_Class`, `Evac_Zone`, `Heights`
- Flood Zones: `.../Environment/FloodZones/MapServer/0` → `DepthText`, `Flood_Info`

### Building Solar Radiation (WCC service offline, mirror available)
- URL: `https://services3.arcgis.com/zKATtxCTqU2pTs69/arcgis/rest/services/Solar_Potential_of_Wellington_Buildings_WFL1/FeatureServer/0/query`
- Fields: `MEAN_YEARLY_SOLAR` (kWh/m²), `MAX_YEARLY_SOLAR_`, `APPROX_HEIGHT`
- EPSG:3857, max 2000 records

## 2. GWRC Earthquake Hazards

Base: `https://mapping.gw.govt.nz/arcgis/rest/services/GW/Emergencies_P/MapServer`
All polygons, EPSG:2193, max 1000 records, no auth.

| Dataset | Layer | Key Fields |
|---------|-------|------------|
| Combined Earthquake Hazard | 8 | `CHI` (index), `CHI_HAZ_GR` (1-5), `SEVERITY` |
| Ground Shaking | 9 | `ZONE`, `SEVERITY` (Low→High) |
| Liquefaction | 10 | `Liquefaction` (risk level), `Simplified` (geology type) |
| Slope Failure | 11 | `LSKEY`, `SEVERITY` ("1 Low"→"5 High") |

Example spatial query:
```
/MapServer/10/query?geometry={"x":1749000,"y":5427000,"spatialReference":{"wkid":2193}}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=*&f=json
```

## 3. MBIE Earthquake-Prone Building Register

Public API (no auth, undocumented — parameters reverse-engineered from the MBIE UI's `bundle.js`):

| Endpoint | Description |
|----------|-------------|
| `GET /api/public/buildings?export=all&filter.hideRemoved=false` | **Use this.** Returns every building on the register (~8,400 = ~5,940 active + ~2,460 historical delistings) in one ~13MB JSON. Full detail set. Removed rows signalled by `noticeStatus == "Removed"`. |
| `GET /api/public/buildings?paging.index=N&paging.size=S&filter.hideRemoved=false` | Paginated variant. Same 8,400-row superset, lighter payload per row (`hasBeenRemoved` boolean + `removalReason` string). Useful if you need `removalReason` copy. |
| `GET /api/query/all-locations` | Geo-only skeleton (`buildingId`, `versionId`, `name`, `lat`, `lng`) for active buildings only. Useful for map tiles. |
| `GET /api/query/location-detail?versionId={vid}` | Single building by versionId. Minimal fields (address, name, image). |

**Critical pagination gotcha:** the endpoint uses dot-notation — `paging.index` and `paging.size`, not `page`/`pageIndex`. Also, the default `filter.hideRemoved=true` strips all delistings. If you pass `?page=N&pageSize=20` (the shape our old docs recommended), the server silently ignores every param and returns the same first 20 active rows forever. That bug caused our DB to hold 20 EPBs instead of 5,813 until 2026-04-23.

**`export=all` returns per building:** `id` (UUID), `buildingNationalIdentifier`, `territorialAuthority`, `addresses` (array), `latitude`, `longitude`, `names` (array), `legalDescription`, `comment`, `constructionType`, `designDate`, `seismicRiskArea`, `region`, `parts`, `taReference`, `noticeType`, `noticeNumber`, `noticeDate`, `completionDeadline`, `earthquakeRating`, `isProceeding`, `isPriority`, `isExtended`, `extensionGrantedDate`, `isExtensionRevoked`, `hasExemptionNotice`, `publishingStatus`, `version`, `noticeStatus` ("Issued" / "Removed"), `hasPartPriority`.

**Paginated shape additionally returns:** `hasBeenRemoved` (bool), `removalReason` (string — e.g. "Further information"), `address` (singular, not array), `priority` (instead of `isPriority`), `name` (instead of `names`). It does NOT return the detail fields (`constructionType`, `designDate`, `seismicRiskArea`, `region`, `legalDescription`, `taReference`, `noticeNumber`).

## 4. Metlink Public Transport

**GTFS Static (no auth):** `https://static.opendata.metlink.org.nz/v1/gtfs/full.zip`

**API (free key):** Base `https://api.opendata.metlink.org.nz/v1/`, header `x-api-key`

Stops: `stop_id`, `stop_code`, `stop_name`, `stop_lat`, `stop_lon`, `zone_id`
Route types: Bus (3), Rail (2), Ferry (4), Cable Car (5) — all included.
