-- Migration: Create SA2 concordance view mapping 2023 census SA2 codes to 2018 boundary SA2 codes
-- Fixes 30% of suburbs missing demographics due to SA2 code mismatch.

CREATE TABLE IF NOT EXISTS sa2_concordance (
  census_sa2_code VARCHAR PRIMARY KEY,
  census_sa2_name VARCHAR NOT NULL,
  boundary_sa2_code VARCHAR NOT NULL,
  match_type VARCHAR NOT NULL
);

TRUNCATE sa2_concordance;

-- Strategy 1: Exact code match
INSERT INTO sa2_concordance (census_sa2_code, census_sa2_name, boundary_sa2_code, match_type)
SELECT d.sa2_code, d.sa2_name, s.sa2_code, 'code'
FROM census_demographics d
JOIN sa2_boundaries s ON d.sa2_code = s.sa2_code;

-- Strategy 2: Exact name match
INSERT INTO sa2_concordance (census_sa2_code, census_sa2_name, boundary_sa2_code, match_type)
SELECT DISTINCT ON (d.sa2_code) d.sa2_code, d.sa2_name, s.sa2_code, 'name'
FROM census_demographics d
JOIN sa2_boundaries s ON LOWER(TRIM(d.sa2_name)) = LOWER(TRIM(s.sa2_name))
WHERE d.sa2_code NOT IN (SELECT census_sa2_code FROM sa2_concordance)
ORDER BY d.sa2_code, s.sa2_code;

-- Strategy 3: Fuzzy name match — strip directional suffixes
INSERT INTO sa2_concordance (census_sa2_code, census_sa2_name, boundary_sa2_code, match_type)
SELECT DISTINCT ON (d.sa2_code) d.sa2_code, d.sa2_name, s.sa2_code, 'fuzzy'
FROM census_demographics d
JOIN sa2_boundaries s ON LOWER(TRIM(s.sa2_name)) = LOWER(TRIM(
  regexp_replace(d.sa2_name, ' (North|South|East|West|Central)(\s.*)?$', '')
))
WHERE d.sa2_code NOT IN (SELECT census_sa2_code FROM sa2_concordance)
ORDER BY d.sa2_code, s.sa2_code;

CREATE INDEX IF NOT EXISTS idx_concordance_boundary ON sa2_concordance (boundary_sa2_code);

-- View: census demographics aggregated by boundary SA2 code
CREATE OR REPLACE VIEW v_census_by_boundary AS
SELECT
  c.boundary_sa2_code AS sa2_code,
  b.sa2_name,
  SUM(d.population_2023) AS population_2023,
  SUM(d.population_2018) AS population_2018,
  ROUND(AVG(d.median_age)) AS median_age,
  SUM(d.age_under_15) AS age_under_15,
  SUM(d.age_15_to_29) AS age_15_to_29,
  SUM(d.age_30_to_64) AS age_30_to_64,
  SUM(d.age_65_plus) AS age_65_plus,
  SUM(d.ethnicity_european) AS ethnicity_european,
  SUM(d.ethnicity_maori) AS ethnicity_maori,
  SUM(d.ethnicity_pacific) AS ethnicity_pacific,
  SUM(d.ethnicity_asian) AS ethnicity_asian,
  SUM(d.ethnicity_melaa) AS ethnicity_melaa,
  SUM(d.ethnicity_total) AS ethnicity_total,
  SUM(d.born_nz) AS born_nz,
  SUM(d.born_overseas) AS born_overseas
FROM sa2_concordance c
JOIN census_demographics d ON d.sa2_code = c.census_sa2_code
JOIN sa2_boundaries b ON b.sa2_code = c.boundary_sa2_code
GROUP BY c.boundary_sa2_code, b.sa2_name;

-- View: census households aggregated by boundary SA2 code
CREATE OR REPLACE VIEW v_census_households_by_boundary AS
SELECT
  c.boundary_sa2_code AS sa2_code,
  b.sa2_name,
  SUM(h.tenure_owned) AS tenure_owned,
  SUM(h.tenure_not_owned) AS tenure_not_owned,
  SUM(h.tenure_family_trust) AS tenure_family_trust,
  SUM(h.tenure_total) AS tenure_total,
  ROUND(AVG(h.income_median)) AS income_median,
  SUM(h.income_under_20k) AS income_under_20k,
  SUM(h.income_20k_30k) AS income_20k_30k,
  SUM(h.income_30k_50k) AS income_30k_50k,
  SUM(h.income_50k_70k) AS income_50k_70k,
  SUM(h.income_70k_100k) AS income_70k_100k,
  SUM(h.income_100k_150k) AS income_100k_150k,
  SUM(h.income_150k_200k) AS income_150k_200k,
  SUM(h.income_200k_plus) AS income_200k_plus,
  ROUND(AVG(h.rent_median)) AS rent_median,
  SUM(h.hh_one_person) AS hh_one_person,
  SUM(h.hh_crowded) AS hh_crowded,
  SUM(h.hh_total) AS hh_total,
  SUM(h.internet_access) AS internet_access,
  SUM(h.internet_total) AS internet_total,
  SUM(h.vehicles_none) AS vehicles_none,
  SUM(h.vehicles_total) AS vehicles_total,
  SUM(h.landlord_kainga_ora) AS landlord_kainga_ora,
  SUM(h.landlord_total) AS landlord_total
FROM sa2_concordance c
JOIN census_households h ON h.sa2_code = c.census_sa2_code
JOIN sa2_boundaries b ON b.sa2_code = c.boundary_sa2_code
GROUP BY c.boundary_sa2_code, b.sa2_name;

-- View: census commute aggregated by boundary SA2 code
CREATE OR REPLACE VIEW v_census_commute_by_boundary AS
SELECT
  c.boundary_sa2_code AS sa2_code,
  b.sa2_name,
  SUM(cm.drive_private) AS drive_private,
  SUM(cm.drive_company) AS drive_company,
  SUM(cm.public_bus) AS public_bus,
  SUM(cm.train) AS train,
  SUM(cm.bicycle) AS bicycle,
  SUM(cm.walk_or_jog) AS walk_or_jog,
  SUM(cm.work_at_home) AS work_at_home,
  SUM(cm.total_stated) AS total_stated
FROM sa2_concordance c
JOIN census_commute cm ON cm.sa2_code = c.census_sa2_code
JOIN sa2_boundaries b ON b.sa2_code = c.boundary_sa2_code
GROUP BY c.boundary_sa2_code, b.sa2_name;
