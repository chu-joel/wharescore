-- 0020_fix_invalid_geometries.sql
-- Fix invalid geometries across all spatial tables using ST_MakeValid.
-- Invalid geometries can cause ST_Contains/ST_Intersects to return wrong results.

UPDATE school_zones SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE noise_contours SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE flood_hazard SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE council_valuations SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE district_plan_zones SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE flood_zones SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE coastal_erosion SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE building_outlines SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE contaminated_land SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE liquefaction_zones SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE sa2_boundaries SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
