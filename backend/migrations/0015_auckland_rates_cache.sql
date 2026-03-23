-- Auckland Council rates cache
-- Stores property valuations and rates from Auckland Council API
-- Updated on-demand when properties are searched + via bulk loader script

CREATE TABLE IF NOT EXISTS auckland_rates_cache (
    rate_account_key    TEXT PRIMARY KEY,
    valuation_number    TEXT,
    address             TEXT NOT NULL,
    street_number       TEXT,
    street_name         TEXT,
    suburb              TEXT,
    city                TEXT,
    legal_description   TEXT,
    record_of_title     TEXT,
    property_category   TEXT,
    land_use            TEXT,
    local_board         TEXT,
    total_floor_area_sqm NUMERIC,
    building_coverage_pct NUMERIC,
    capital_value       INTEGER,
    land_value          INTEGER,
    improvements_value  INTEGER,
    total_rates         NUMERIC(12,2),
    rate_breakdown      JSONB DEFAULT '[]'::jsonb,
    x_coord             NUMERIC,
    y_coord             NUMERIC,
    fetched_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_akl_rates_address ON auckland_rates_cache (lower(address));
CREATE INDEX IF NOT EXISTS idx_akl_rates_street ON auckland_rates_cache (lower(street_name), lower(street_number));
CREATE INDEX IF NOT EXISTS idx_akl_rates_suburb ON auckland_rates_cache (lower(suburb));
CREATE INDEX IF NOT EXISTS idx_akl_rates_valuation ON auckland_rates_cache (valuation_number);
CREATE INDEX IF NOT EXISTS idx_akl_rates_cv ON auckland_rates_cache (capital_value) WHERE capital_value IS NOT NULL;
