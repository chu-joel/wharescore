-- WhareScore POC: Table Creation
-- Run with: psql -U postgres -d wharescore -f 02-create-tables.sql

-----------------------------------------------------------
-- NZDep2023: Deprivation scores per meshblock
-----------------------------------------------------------
CREATE TABLE IF NOT EXISTS nzdep (
    mb2023_code VARCHAR(7) PRIMARY KEY,
    nzdep2023 INTEGER,
    nzdep2023_score NUMERIC,
    sa12023_code VARCHAR(9)
);

-----------------------------------------------------------
-- Meshblock boundaries (loaded via ogr2ogr from GeoPackage)
-- Table 'meshblocks' will be created by ogr2ogr automatically
-----------------------------------------------------------

-----------------------------------------------------------
-- Flood zones (loaded via ogr2ogr from GeoPackage/Shapefile)
-- Table 'flood_zones' will be created by ogr2ogr automatically
-----------------------------------------------------------

-----------------------------------------------------------
-- LINZ Parcels (loaded via ogr2ogr from GeoPackage)
-- Table 'parcels' will be created by ogr2ogr automatically
-----------------------------------------------------------

-----------------------------------------------------------
-- LINZ Addresses (loaded via ogr2ogr from GeoPackage)
-- Table 'addresses' will be created by ogr2ogr automatically
-----------------------------------------------------------

-----------------------------------------------------------
-- Views: Join NZDep scores to meshblock boundaries
-----------------------------------------------------------
-- This view will be created AFTER data is loaded
-- CREATE VIEW meshblock_deprivation AS
-- SELECT m.*, n.nzdep2023, n.nzdep2023_score
-- FROM meshblocks m
-- JOIN nzdep n ON m.mb2023_code = n.mb2023_code;
