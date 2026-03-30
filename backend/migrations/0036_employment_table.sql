-- 0036: Business Demography employment data by SA2
-- Source: Stats NZ Business Demography 2024 ArcGIS (CC BY 4.0)

CREATE TABLE IF NOT EXISTS business_demography (
    sa2_code TEXT PRIMARY KEY,
    sa2_name TEXT,
    -- Employee counts
    employee_count_2019 INT,
    employee_count_2024 INT,
    employee_growth_pct REAL,  -- avg annual % increase 2019-2024
    -- Business (geographic unit) counts
    business_count_2019 INT,
    business_count_2024 INT,
    business_growth_pct REAL   -- avg annual % increase 2019-2024
);

CREATE INDEX IF NOT EXISTS idx_business_demography_sa2 ON business_demography(sa2_code);
