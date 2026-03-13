# WhareScore — New Data Acquisition Guide

**Date:** 2026-03-08
**Purpose:** Download and import 10+ new datasets to enrich the property intelligence platform.
**Current state:** 39 tables, ~18.6M records in PostGIS.

---

## Quick Reference: What To Get

| # | Dataset | Source | Format | Free? | Impact |
|---|---------|--------|--------|-------|--------|
| 1 | **LINZ Sale Prices** | LINZ Data Service | CSV tables | Yes (CC-BY-4.0) | Critical |
| 2 | **OSM Amenities (NZ)** | Overpass API | GeoJSON | Yes (ODbL) | Critical |
| 3 | **Census 2023 Demographics** | Stats NZ | CSV + ArcGIS | Yes (CC-BY-4.0) | Critical |
| 4 | **GNS Active Faults** | GNS Science | Shapefile | Yes (CC-BY) | High |
| 5 | **DOC Conservation Land** | DOC ArcGIS Open Data | Shapefile/GeoJSON | Yes | High |
| 6 | **Walking & Cycling** | NZTA ArcGIS Open Data | Shapefile | Yes | Medium |
| 7 | **LINZ Property Categories** | LINZ Data Service | CSV | Yes (CC-BY-4.0) | Medium |
| 8 | **LINZ Sale Type** | LINZ Data Service | CSV | Yes (CC-BY-4.0) | Medium |
| 9 | **Building Footprint Area** | Existing data (SQL) | — | Already have | Easy win |
| 10 | **Building Age Proxy** | Existing data (SQL) | — | Already have | Easy win |

**NOT available for free:** Bedrooms, bathrooms, floor area, construction date. These are in the LINZ National District Valuation Roll but it's **controlled access (government agencies only)**. The same data is available from CoreLogic ($20k-100k/yr). Individual council websites show it per-property but don't offer bulk download.

---

## Dataset 1: LINZ Sale Prices & Property Data

LINZ has a whole "NZ Properties" dataset family. Several tables are publicly available:

### Public Tables (Free, CC-BY-4.0)

| Table | Layer/Table ID | Description |
|-------|---------------|-------------|
| NZ Properties: Sale Type | Table 105634 | Sale type for each property transaction |
| NZ Properties: Price-Value Relationship | Table 105629 | Sale price vs rating value |
| NZ Properties: Property Category | Table 105630 | Residential, commercial, etc. |
| NZ Properties: Zoning | Table 105636 | Zoning classification |
| NZ Properties: Actual Property Use | Table 105616 | What the property is actually used for |
| NZ Properties: Unit of Property | Layer 113968 | Property units with geometry |
| NZ Properties: Property-Address Reference | Table 115638 | Links properties to addresses |
| NZ Properties: Perspective | Table 113961 | Property perspective data |

### Download

1. Go to https://data.linz.govt.nz
2. Log in with existing LINZ account
3. Search for each table by ID
4. Download as CSV (tables) or GeoPackage (layers)

**Critical tables to download first:**
- Table 105629 (Price-Value Relationship) — has sale prices
- Table 105634 (Sale Type) — categorises transactions
- Table 105630 (Property Category) — residential vs commercial
- Table 105616 (Actual Property Use) — land use
- Layer 113968 (Unit of Property) — geometry + property IDs
- Table 115638 (Property-Address Reference) — joins to our addresses

### Restricted (Government Only)

| Table | ID | Description |
|-------|-----|-------------|
| National District Valuation Roll | Table 114085 | CV, LV, IV, floor area, construction date, materials |

This is the goldmine but requires joining the "NZ Properties - Controlled Access Group".

---

## Dataset 2: OpenStreetMap Amenities (NZ)

### What It Gives You
Every shop, cafe, restaurant, supermarket, pharmacy, doctor, gym, park, playground, library, bank, fuel station in NZ. This makes property reports feel complete.

### Download via Overpass API

**Option A: Geofabrik Extract (recommended for bulk)**

Download the NZ OSM extract and filter locally:
```bash
# Download NZ extract (~300MB PBF)
curl -L -o nz-latest.osm.pbf https://download.geofabrik.de/australia-oceania/new-zealand-latest.osm.pbf

# Extract amenities to GeoJSON using osmium + ogr2ogr
# Requires: osmium-tool (conda install osmium-tool)
osmium tags-filter nz-latest.osm.pbf \
  nwr/amenity nwr/shop nwr/leisure nwr/healthcare nwr/tourism \
  -o nz-amenities.osm.pbf

ogr2ogr -f "GeoJSON" nz-amenities.geojson nz-amenities.osm.pbf points
```

**Option B: Overpass API (smaller, targeted)**

```bash
# Download amenities within NZ bounding box
curl -o nz-amenities.json "https://overpass-api.de/api/interpreter" \
  --data-urlencode 'data=[out:json][timeout:300];
(
  node["amenity"~"restaurant|cafe|fast_food|bar|pub|pharmacy|doctors|dentist|hospital|clinic|bank|atm|post_office|library|cinema|theatre|fuel|parking|school|kindergarten|university|community_centre|fire_station|police|place_of_worship|toilets|recycling"](nwr:-47.5,165.5,-34.0,179.0);
  node["shop"~"supermarket|convenience|bakery|butcher|greengrocer|clothes|hairdresser|hardware|electronics|books|florist|optician|pet|sports|toys|department_store|mall"](nwr:-47.5,165.5,-34.0,179.0);
  node["leisure"~"park|playground|sports_centre|swimming_pool|fitness_centre|garden|pitch|track|dog_park"](nwr:-47.5,165.5,-34.0,179.0);
  node["healthcare"](nwr:-47.5,165.5,-34.0,179.0);
  node["tourism"~"museum|gallery|information|viewpoint|hotel|motel|camp_site|caravan_site"](nwr:-47.5,165.5,-34.0,179.0);
);
out center;'
```

Note: Overpass queries for all of NZ may timeout. Use the Geofabrik approach for reliability.

### Load Into PostGIS

```python
# See scripts/load_osm_amenities.py (to be created)
# Creates table: osm_amenities (point geom, name, category, subcategory, tags)
```

```sql
CREATE TABLE osm_amenities (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name TEXT,
    category TEXT,       -- amenity, shop, leisure, healthcare, tourism
    subcategory TEXT,     -- restaurant, supermarket, park, etc.
    brand TEXT,
    opening_hours TEXT,
    phone TEXT,
    website TEXT,
    addr_street TEXT,
    addr_housenumber TEXT,
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX idx_osm_amenities_geom ON osm_amenities USING GIST (geom);
CREATE INDEX idx_osm_amenities_category ON osm_amenities (category);
CREATE INDEX idx_osm_amenities_subcategory ON osm_amenities (subcategory);
```

---

## Dataset 3: Census 2023 Demographics (SA2 level)

### What It Gives You
Median income, age distribution, ethnicity, household composition, housing tenure (% renters vs owners), dwelling types — for every SA2 in NZ.

### Download

**Stats NZ Datafinder:**
- Layer 120898: "2023 Census totals by topic for individuals by SA2 (Part 2)"
  https://datafinder.stats.govt.nz/layer/120898-2023-census-totals-by-topic-for-individuals-by-statistical-area-2-part-2/

- Also check: https://2023census-statsnz.hub.arcgis.com/ for ArcGIS hosted layers

**Alternative — NZ.Stat tables:**
- https://nzdotstat.stats.govt.nz — search for SA2-level census tables
- Download as CSV, filter to needed variables

### Key Variables Needed

| Variable | Census Table | Use |
|----------|-------------|-----|
| Median household income | Income | Neighbourhood affluence |
| Age distribution | Age | Demographics profile |
| Ethnicity | Ethnicity | Diversity profile |
| Housing tenure (own/rent) | Housing | Rental market indicator |
| Dwelling type (house/flat/apartment) | Dwelling | Housing stock profile |
| Household composition (family/couple/single) | Household | Target market |
| Usual residents count | Population | Density |

### Load Into PostGIS

```sql
-- Join to existing sa2_boundaries table via sa2_code
CREATE TABLE census_sa2 (
    sa2_code VARCHAR(6) PRIMARY KEY,
    population INTEGER,
    median_income INTEGER,
    pct_renters NUMERIC(5,2),
    pct_owners NUMERIC(5,2),
    pct_age_0_14 NUMERIC(5,2),
    pct_age_15_29 NUMERIC(5,2),
    pct_age_30_64 NUMERIC(5,2),
    pct_age_65_plus NUMERIC(5,2),
    pct_european NUMERIC(5,2),
    pct_maori NUMERIC(5,2),
    pct_pacific NUMERIC(5,2),
    pct_asian NUMERIC(5,2),
    median_rent_weekly INTEGER,
    total_dwellings INTEGER,
    pct_houses NUMERIC(5,2),
    pct_apartments NUMERIC(5,2)
);

-- Create view joining to geometry
CREATE OR REPLACE VIEW census_demographics AS
SELECT s.geom, s.sa2_name, c.*
FROM sa2_boundaries s
JOIN census_sa2 c ON s.sa2_code = c.sa2_code;
```

---

## Dataset 4: GNS Active Fault Lines

### What It Gives You
All active fault traces in NZ with slip rate, recurrence interval, last rupture. Essential for seismic risk scoring.

### Download

**GNS Science Active Faults Database:**
- Web app: https://data.gns.cri.nz/af/
- 1:250K dataset DOI: https://doi.org/10.21420/R1QN-BM52
- High-Resolution dataset DOI: https://doi.org/10.21420/8d5w-sc97

1. Go to https://data.gns.cri.nz/af/
2. Click "Download 1:250K data" → "New Zealand 1:250K"
3. Download as Shapefile
4. Also available on data.govt.nz: search "active faults"

### Load Into PostGIS

```bash
ogr2ogr -f "PostgreSQL" PG:"dbname=wharescore" nz-active-faults.shp \
  -t_srs EPSG:4326 -nln active_faults
```

```sql
CREATE INDEX idx_active_faults_geom ON active_faults USING GIST (geom);
```

---

## Dataset 5: DOC Public Conservation Land

### What It Gives You
All conservation land, national parks, reserves, walking tracks. "500m to Zealandia", "1.2km to nearest park."

### Download

**DOC ArcGIS Open Data Portal:**
- URL: https://doc-deptconservation.opendata.arcgis.com/
- Public Conservation Land: https://doc-deptconservation.opendata.arcgis.com/datasets/72354ba9bf7a4706af3fdfe60f86eea1_0
- Download as Shapefile or GeoJSON
- Coordinate system: NZTM (EPSG:2193) — transform to WGS84

**Alternative:** LINZ also hosts protected areas:
- Layer 53564: https://data.linz.govt.nz/layer/53564-protected-areas/

### Load Into PostGIS

```bash
ogr2ogr -f "PostgreSQL" PG:"dbname=wharescore" doc-conservation-land.shp \
  -t_srs EPSG:4326 -nln conservation_land
```

```sql
CREATE INDEX idx_conservation_geom ON conservation_land USING GIST (geom);
```

---

## Dataset 6: Walking & Cycling Infrastructure

### What It Gives You
Bike lanes, shared paths, pedestrian facilities. Key liveability factor.

### Download

**NZTA ArcGIS Open Data Portal:**
- URL: https://opendata-nzta.opendata.arcgis.com
- Search for "cycling" or "walking"
- Download as Shapefile or GeoJSON

### Load Into PostGIS

```bash
ogr2ogr -f "PostgreSQL" PG:"dbname=wharescore" nzta-cycling.shp \
  -t_srs EPSG:4326 -nln cycling_infrastructure
```

---

## Datasets 9 & 10: Quick Wins from Existing Data (SQL only)

These don't need any downloads — just SQL queries on data we already have.

### 9. Building Footprint Area

```sql
-- Add calculated footprint area to building_outlines
ALTER TABLE building_outlines ADD COLUMN IF NOT EXISTS footprint_area_sqm NUMERIC;

UPDATE building_outlines
SET footprint_area_sqm = ST_Area(ST_Transform(geom, 2193))
WHERE footprint_area_sqm IS NULL;

-- This gives us a proxy for floor area (single-storey equivalent)
-- Average NZ house footprint: 120-180 m²
```

### 10. Building Age Proxy

```sql
-- capture_source_from tells us when the building first appeared in aerial imagery
-- This is a rough proxy for construction date (within a few years)
SELECT
  name,
  use,
  capture_source_from AS approx_built_date,
  EXTRACT(YEAR FROM AGE(capture_source_from)) AS approx_age_years,
  suburb_locality,
  town_city
FROM building_outlines
WHERE capture_source_from IS NOT NULL
LIMIT 10;
```

---

## Import Checklist

After downloading, run imports in this order:

```bash
# 1. LINZ Property tables (CSV)
# Use psycopg COPY or \copy in psql

# 2. OSM Amenities
python scripts/load_osm_amenities.py

# 3. Census demographics
python scripts/load_census_demographics.py

# 4. GNS Active Faults
ogr2ogr -f "PostgreSQL" PG:"dbname=wharescore" active-faults.shp -t_srs EPSG:4326 -nln active_faults

# 5. DOC Conservation Land
ogr2ogr -f "PostgreSQL" PG:"dbname=wharescore" doc-conservation.shp -t_srs EPSG:4326 -nln conservation_land

# 6. NZTA Cycling
ogr2ogr -f "PostgreSQL" PG:"dbname=wharescore" nzta-cycling.shp -t_srs EPSG:4326 -nln cycling_infrastructure

# 7. Building footprint area (SQL)
psql -d wharescore -c "ALTER TABLE building_outlines ADD COLUMN IF NOT EXISTS footprint_area_sqm NUMERIC; UPDATE building_outlines SET footprint_area_sqm = ST_Area(ST_Transform(geom, 2193)) WHERE footprint_area_sqm IS NULL;"

# 8. Create spatial indexes on all new tables
psql -d wharescore -c "CREATE INDEX IF NOT EXISTS idx_active_faults_geom ON active_faults USING GIST (geom);"
psql -d wharescore -c "CREATE INDEX IF NOT EXISTS idx_conservation_geom ON conservation_land USING GIST (geom);"
psql -d wharescore -c "CREATE INDEX IF NOT EXISTS idx_cycling_geom ON cycling_infrastructure USING GIST (geom);"
psql -d wharescore -c "CREATE INDEX IF NOT EXISTS idx_osm_amenities_geom ON osm_amenities USING GIST (geom);"
```

---

## Expected Result

After completing all downloads and imports:

| New Table | Records (est.) | Use |
|-----------|----------------|-----|
| `linz_sale_prices` | ~2M+ | Sale price history per property |
| `linz_property_category` | ~2M | Residential/commercial classification |
| `osm_amenities` | ~100K+ | Nearby shops, cafes, parks, services |
| `census_sa2` | ~2,200 | Demographics per SA2 area |
| `active_faults` | ~500+ | Fault traces for seismic risk |
| `conservation_land` | ~10K+ | Parks, reserves, DOC land |
| `cycling_infrastructure` | ~5K+ | Bike lanes, shared paths |

**Total after import: ~46+ tables, ~22M+ records**

Building footprint area added as a column to existing `building_outlines` table.
Building age proxy available via `capture_source_from` field (already in data).
