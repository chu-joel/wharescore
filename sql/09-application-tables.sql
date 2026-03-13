-- 09-application-tables.sql
-- Application feature tables (not spatial data).
-- These support user-contributed data, feedback, email signups, and admin.

----------------------------------------------------------------------
-- USER-CONTRIBUTED RENT REPORTS (crowdsourced per-building data)
-- Reference: UX spec "User-Contributed Rent Data" section
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_rent_reports (
  id SERIAL PRIMARY KEY,
  address_id BIGINT NOT NULL REFERENCES addresses(address_id),
  building_address TEXT,              -- base street address (e.g. "30 Taranaki Street")
  sa2_code VARCHAR(10),               -- for area-level fallback
  dwelling_type VARCHAR(20) NOT NULL, -- House, Flat, Apartment, Room
  bedrooms VARCHAR(5) NOT NULL,       -- 1, 2, 3, 4, 5+
  reported_rent INTEGER NOT NULL,     -- $/week
  is_outlier BOOLEAN DEFAULT FALSE,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash VARCHAR(64),                -- SHA-256 of IP, for rate limiting only (not tracking)
  source VARCHAR(20) DEFAULT 'web'    -- web, share, api
);

CREATE INDEX IF NOT EXISTS idx_rent_reports_address ON user_rent_reports(address_id);
CREATE INDEX IF NOT EXISTS idx_rent_reports_building ON user_rent_reports(building_address);
CREATE INDEX IF NOT EXISTS idx_rent_reports_sa2 ON user_rent_reports(sa2_code);
CREATE INDEX IF NOT EXISTS idx_rent_reports_reported_at ON user_rent_reports(reported_at);

----------------------------------------------------------------------
-- FEEDBACK (bug reports, feature requests, general feedback)
-- Reference: UX spec "Feedback & Bug Reporting" section
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,          -- bug, feature, general
  description TEXT NOT NULL,
  context TEXT,                        -- what the user was doing
  page_url TEXT,
  property_address TEXT,
  importance VARCHAR(20),              -- low, medium, high, critical (for bugs)
  satisfaction INTEGER,                -- 1-5 for general feedback
  email VARCHAR(255),                  -- optional contact email
  browser_info JSONB,                  -- user agent, screen size, etc.
  screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'new'    -- new, reviewed, resolved, wontfix
);

CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

----------------------------------------------------------------------
-- EMAIL SIGNUPS (out-of-coverage notifications)
-- Reference: UX spec "Out of Coverage" error state
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_signups (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  requested_region TEXT,               -- e.g. "Auckland", "Christchurch"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_signups_email ON email_signups(email);

----------------------------------------------------------------------
-- WCC RATES CACHE (live API data cached per property)
-- Reference: IMPLEMENTATION-PLAN.md Phase 2H
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wcc_rates_cache (
  valuation_number TEXT PRIMARY KEY,
  rate_account_number INTEGER,
  address TEXT NOT NULL,
  identifier TEXT,
  rating_category TEXT,
  billing_code TEXT,
  legal_description TEXT,
  valued_land_area INTEGER,
  has_water_meter BOOLEAN DEFAULT FALSE,
  capital_value INTEGER,
  land_value INTEGER,
  improvements_value INTEGER,
  valuation_date DATE,
  total_rates NUMERIC(10,2),
  rates_period TEXT,
  valuations JSONB,
  levies JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wcc_rates_address ON wcc_rates_cache(lower(address));
CREATE INDEX IF NOT EXISTS idx_wcc_rates_account ON wcc_rates_cache(rate_account_number);

----------------------------------------------------------------------
-- DATA SOURCES (metadata for DataSourceBadge.tsx)
-- Reference: BACKEND-PLAN.md Phase 2C
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_sources (
  table_name TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url TEXT,
  license TEXT,
  last_updated DATE,
  update_frequency TEXT  -- 'daily', 'monthly', 'quarterly', 'annually', 'static'
);

INSERT INTO data_sources VALUES
  ('addresses',          'LINZ',                    'data.linz.govt.nz', 'CC BY 4.0', '2026-01-15', 'monthly'),
  ('parcels',            'LINZ',                    'data.linz.govt.nz', 'CC BY 4.0', '2026-01-15', 'monthly'),
  ('building_outlines',  'LINZ',                    'data.linz.govt.nz', 'CC BY 4.0', '2026-01-15', 'monthly'),
  ('flood_zones',        'GWRC',                    'mapping.gw.govt.nz', 'CC BY 4.0', '2025-12-01', 'static'),
  ('crime',              'NZ Police',               'policedata.nz',     'CC BY 4.0', '2025-12-31', 'quarterly'),
  ('bonds_detailed',     'MBIE Tenancy Services',   'mbie.govt.nz',      'CC BY 3.0', '2025-12-31', 'quarterly'),
  ('council_valuations', 'Wellington City Council',  'wcc.govt.nz',       'CC BY-SA',  '2024-09-01', 'triennially'),
  ('schools',            'Ministry of Education',    'educationcounts.govt.nz', 'CC BY 4.0', '2025-06-01', 'annually'),
  ('osm_amenities',      'OpenStreetMap contributors', 'openstreetmap.org', 'ODbL', '2026-02-01', 'monthly')
ON CONFLICT (table_name) DO NOTHING;

----------------------------------------------------------------------
-- ADMIN CONTENT (editable banner, demo addresses, FAQ)
-- Reference: BACKEND-PLAN.md Phase 2K
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_content (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO admin_content (key, value) VALUES
  ('banner', '{"text": "WhareScore is in beta — data may be incomplete.", "variant": "info", "active": true}'),
  ('demo_addresses', '["162 Cuba Street, Te Aro, Wellington", "1 Te Ara O Paetutu, Petone, Lower Hutt"]'),
  ('faq', '[]')
ON CONFLICT (key) DO NOTHING;
