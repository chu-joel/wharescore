# WhareScore - Proof of Concept

**Goal:** Validate that NZ government spatial datasets can be joined at the property level to deliver hazard exposure + deprivation scoring + flood zone detection from a single address lookup.

## Quick Start

### 1. Install Prerequisites

- **PostgreSQL 16+** with **PostGIS 3.4+** — [EDB Installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
- **GDAL/ogr2ogr** — included with PostGIS Stack Builder install, or [OSGeo4W](https://trac.osgeo.org/osgeo4w/)
- **Python 3.8+** — already installed

### 2. Download Datasets

| Dataset | Location | Download To |
|---------|----------|-------------|
| NZDep2023 meshblock data | [Otago Uni](https://www.otago.ac.nz/__data/assets/excel_doc/0022/593140/NZDep2023_MB2023.xlsx) | `data/nzdep/` (auto-downloaded) |
| Meshblock 2023 boundaries | [Stats NZ Datafinder](https://datafinder.stats.govt.nz/layer/111228-meshblock-2023-generalised/) | `data/nzdep/` |
| NZ Parcels | [LINZ Data Service](https://data.linz.govt.nz) Layer 51571 | `data/linz/` |
| NZ Street Addresses | [LINZ Data Service](https://data.linz.govt.nz) Layer 53353 | `data/linz/` |
| Wellington Flood Zones | [GW Regional Council](https://mapping.gw.govt.nz) or [Koordinates](https://koordinates.com) | `data/flood/` |

Download spatial data as **GeoPackage (.gpkg)** format.

### 3. Create Database

```bash
psql -U postgres -f sql/01-create-database.sql
psql -U postgres -d wharescore -f sql/02-create-tables.sql
```

### 4. Load Data

```bash
# Load NZDep scores (Python)
python scripts/load_nzdep.py

# Load spatial datasets (ogr2ogr)
scripts\load_spatial_data.bat
```

### 5. Create Indexes and Views

```bash
psql -U postgres -d wharescore -f sql/03-create-indexes-views.sql
```

### 6. Run Validation

```bash
psql -U postgres -d wharescore -f sql/04-validation-query.sql
```

## Project Structure

```
wharescore-poc/
  data/
    nzdep/          # NZDep2023 + meshblock boundaries
    linz/           # LINZ parcels + addresses
    flood/          # Wellington flood zone data
  scripts/
    load_nzdep.py           # Python: load NZDep Excel into PostGIS
    load_spatial_data.bat   # Batch: load all spatial data via ogr2ogr
  sql/
    01-create-database.sql  # Create DB + enable PostGIS
    02-create-tables.sql    # Create tables
    03-create-indexes-views.sql  # Spatial indexes + views
    04-validation-query.sql # THE validation query
```

## Success Criteria

- [ ] PostGIS running with all datasets loaded
- [ ] Spatial indexes on all geometry columns
- [ ] Validation query returns deprivation score + flood status for a Wellington address
- [ ] Query performance < 100ms for single address lookup
