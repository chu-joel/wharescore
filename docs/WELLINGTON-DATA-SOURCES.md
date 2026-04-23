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

Public API (no auth, undocumented):

| Endpoint | Description |
|----------|-------------|
| `GET https://epbr.building.govt.nz/api/public/buildings?export=all` | **Use this.** Returns all currently-listed buildings (~5,940) in one ~9MB JSON. Full detail set. This is what MBIE's UI uses for its CSV export. |
| `GET https://epbr.building.govt.nz/api/query/all-locations` | Geo-only skeleton (buildingId, versionId, name, lat, lng) — useful for map tiles but lacks ratings/deadline. |
| `GET https://epbr.building.govt.nz/api/query/location-detail?versionId={vid}` | Single building by versionId. Minimal fields only (address, name, image). |
| ~~`GET https://epbr.building.govt.nz/api/public/buildings?pageSize=20&page={n}`~~ | **Broken.** The paginated endpoint ignores `page`/`pageIndex`/`offset`/`skip`/`start` and returns the same first 20 rows every time. All filter params (`name`, `search`, `q`, `town`, `region`, `earthquakeRating`, `includeRemoved`, etc.) are silently ignored. Do not use. |

**`export=all` returns per building:** `id` (UUID), `buildingNationalIdentifier`, `territorialAuthority`, `addresses` (array), `latitude`, `longitude`, `names` (array), `legalDescription`, `comment`, `constructionType`, `designDate`, `seismicRiskArea`, `region`, `parts`, `taReference`, `noticeType`, `noticeNumber`, `noticeDate`, `completionDeadline`, `earthquakeRating`, `isProceeding`, `isPriority`, `isExtended`, `isExtensionRevoked`, `hasExemptionNotice`, `publishingStatus`, `version`, `noticeStatus`, `hasPartPriority`.

**Removed/delisted buildings are not exposed by any public JSON endpoint found to date.** MBIE's UI shows them (e.g. Melksham Towers at 131 Brougham St), but none of the above endpoints returns a row with `hasBeenRemoved=true`. Search params to surface them (`includeRemoved`, `showRemoved`, `isRemoved`, `status=removed`, etc.) are all silently ignored. To capture historical delistings we'd need to reverse-engineer the UI with Playwright or file an OIA request. Going-forward tracking works via the "vanished from export=all" backstop in the loader — any building that drops out of the export feed gets `removed_at` stamped.

## 4. Metlink Public Transport

**GTFS Static (no auth):** `https://static.opendata.metlink.org.nz/v1/gtfs/full.zip`

**API (free key):** Base `https://api.opendata.metlink.org.nz/v1/`, header `x-api-key`

Stops: `stop_id`, `stop_code`, `stop_name`, `stop_lat`, `stop_lon`, `zone_id`
Route types: Bus (3), Rail (2), Ferry (4), Cable Car (5) — all included.
