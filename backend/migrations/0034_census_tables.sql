-- 0034: Census 2023 demographics + household tables
-- Source: Stats NZ ArcGIS Feature Services (CC BY 4.0)
-- Joined to report via SA2 code (no spatial query needed)

CREATE TABLE IF NOT EXISTS census_demographics (
    sa2_code TEXT PRIMARY KEY,
    sa2_name TEXT,
    -- Population
    population_2018 INT,
    population_2023 INT,
    -- Age (life cycle groups, 2023)
    age_under_15 INT,
    age_15_to_29 INT,
    age_30_to_64 INT,
    age_65_plus INT,
    median_age REAL,
    -- Ethnicity (2023, counts — note: people can identify with multiple)
    ethnicity_european INT,
    ethnicity_maori INT,
    ethnicity_pacific INT,
    ethnicity_asian INT,
    ethnicity_melaa INT,  -- Middle Eastern/Latin American/African
    ethnicity_other INT,
    ethnicity_total INT,
    -- Birthplace (2023)
    born_nz INT,
    born_overseas INT,
    -- Gender (2023)
    gender_male INT,
    gender_female INT,
    -- Languages (2023)
    lang_english INT,
    lang_maori INT,
    lang_total INT
);

CREATE TABLE IF NOT EXISTS census_households (
    sa2_code TEXT PRIMARY KEY,
    sa2_name TEXT,
    -- Household count
    households_2018 INT,
    households_2023 INT,
    -- Composition (2023)
    hh_one_family INT,
    hh_multi_family INT,
    hh_other_multi_person INT,
    hh_one_person INT,
    hh_total INT,
    -- Crowding (2023)
    hh_crowded INT,
    hh_not_crowded INT,
    -- Tenure (2023)
    tenure_owned INT,
    tenure_not_owned INT,
    tenure_family_trust INT,
    tenure_total INT,
    -- Household income (2023)
    income_under_20k INT,
    income_20k_30k INT,
    income_30k_50k INT,
    income_50k_70k INT,
    income_70k_100k INT,
    income_100k_150k INT,
    income_150k_200k INT,
    income_200k_plus INT,
    income_median INT,
    -- Vehicles (2023)
    vehicles_none INT,
    vehicles_one INT,
    vehicles_two INT,
    vehicles_three_plus INT,
    vehicles_total INT,
    -- Internet access (2023)
    internet_access INT,
    internet_no_access INT,
    internet_total INT,
    -- Rent (2023, rented households only)
    rent_median INT,
    rent_total_hh INT,
    -- Landlord sector (2023)
    landlord_private INT,
    landlord_kainga_ora INT,
    landlord_council INT,
    landlord_other INT,
    landlord_total INT
);

CREATE INDEX IF NOT EXISTS idx_census_demographics_sa2 ON census_demographics(sa2_code);
CREATE INDEX IF NOT EXISTS idx_census_households_sa2 ON census_households(sa2_code);
