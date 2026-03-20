-- 0010: User budget calculator inputs (anonymous data collection)
CREATE TABLE IF NOT EXISTS user_budget_inputs (
    id              SERIAL PRIMARY KEY,
    address_id      INTEGER NOT NULL,
    sa2_code        TEXT,
    persona         TEXT NOT NULL CHECK (persona IN ('buyer', 'renter')),

    -- Buyer fields
    purchase_price  INTEGER,
    deposit_pct     NUMERIC(5,2),
    interest_rate   NUMERIC(5,2),
    loan_term       INTEGER,
    rates_override  NUMERIC(10,2),
    insurance_override NUMERIC(10,2),
    utilities_override NUMERIC(10,2),
    maintenance_override NUMERIC(10,2),

    -- Renter fields
    weekly_rent     INTEGER,
    room_only       BOOLEAN,
    household_size  SMALLINT,
    contents_insurance_override NUMERIC(10,2),
    transport_override NUMERIC(10,2),
    food_override   NUMERIC(10,2),

    -- Shared
    annual_income   INTEGER,
    ip_hash         TEXT,
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_inputs_address ON user_budget_inputs (address_id);
CREATE INDEX idx_budget_inputs_sa2 ON user_budget_inputs (sa2_code);
CREATE INDEX idx_budget_inputs_dedup ON user_budget_inputs (address_id, persona, ip_hash, reported_at);
