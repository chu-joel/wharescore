-- WhareScore POC: Indexes and Views
-- Run AFTER all data is loaded
-- Execute with: psql -U postgres -d wharescore -f 03-create-indexes-views.sql

-----------------------------------------------------------
-- Spatial indexes (critical for query performance)
-----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meshblocks_geom ON meshblocks USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_parcels_geom ON parcels USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_addresses_geom ON addresses USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_flood_zones_geom ON flood_zones USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_slope_failure_zones_geom ON slope_failure_zones USING GIST (geom);

-- Analyze tables after index creation
ANALYZE meshblocks;
ANALYZE parcels;
ANALYZE addresses;
ANALYZE flood_zones;
ANALYZE nzdep;

-----------------------------------------------------------
-- View: Meshblock boundaries with deprivation scores
-----------------------------------------------------------
CREATE OR REPLACE VIEW meshblock_deprivation AS
SELECT m.*, n.nzdep2023, n.nzdep2023_score
FROM meshblocks m
JOIN nzdep n ON m.mb2023_code = n.mb2023_code;

-----------------------------------------------------------
-- The validation query: address → parcel + deprivation + flood
-----------------------------------------------------------
-- Usage: Replace the address text to look up any property
--
-- SELECT
--     a.full_address,
--     p.appellation AS parcel_id,
--     n.nzdep2023 AS deprivation_score,
--     CASE
--         WHEN f.ogc_fid IS NOT NULL THEN 'IN FLOOD ZONE'
--         ELSE 'Not in flood zone'
--     END AS flood_status,
--     ST_AsGeoJSON(p.geom) AS parcel_geojson
-- FROM addresses a
-- LEFT JOIN parcels p ON ST_Contains(p.geom, a.geom)
-- LEFT JOIN meshblocks m ON ST_Contains(m.geom, a.geom)
-- LEFT JOIN nzdep n ON m.mb2023_code = n.mb2023_code
-- LEFT JOIN flood_zones f ON ST_Intersects(f.geom, a.geom)
-- WHERE a.full_address ILIKE '%Petone%'
-- LIMIT 5;
