-- 0035: Commute mode + climate normals tables
-- Commute: aggregated from Stats NZ Census 2023 origin-destination CSV
-- Climate: monthly normals from Open-Meteo Climate API per TA/city

CREATE TABLE IF NOT EXISTS census_commute (
    sa2_code TEXT PRIMARY KEY,
    sa2_name TEXT,
    -- 2023 commute mode counts (aggregated across all destinations)
    work_at_home INT,
    drive_private INT,
    drive_company INT,
    passenger INT,
    public_bus INT,
    train INT,
    bicycle INT,
    walk_or_jog INT,
    ferry INT,
    other INT,
    total_stated INT,
    -- 2018 for comparison
    total_stated_2018 INT,
    work_at_home_2018 INT
);

CREATE TABLE IF NOT EXISTS climate_normals (
    location_name TEXT NOT NULL,
    ta_name TEXT,  -- territorial authority for joining
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    temp_mean REAL,      -- degrees C
    temp_max REAL,
    temp_min REAL,
    precipitation_mm REAL,
    rain_days REAL,      -- days with >1mm
    sunshine_hours REAL,
    wind_speed_mean REAL, -- km/h
    PRIMARY KEY (location_name, month)
);

CREATE INDEX IF NOT EXISTS idx_census_commute_sa2 ON census_commute(sa2_code);
CREATE INDEX IF NOT EXISTS idx_climate_normals_ta ON climate_normals(ta_name);
