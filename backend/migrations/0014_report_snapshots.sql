-- 0014_report_snapshots.sql
-- Stores pre-computed report snapshots for the hosted interactive report page.
-- Each snapshot is immutable — contains all data needed to render the report
-- forever, including pre-computed rent/price advisor variants for all
-- bedroom/bathroom/finish combinations.

CREATE TABLE IF NOT EXISTS report_snapshots (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    guest_purchase_id INT REFERENCES guest_purchases(id) ON DELETE SET NULL,
    address_id INT NOT NULL,
    full_address TEXT NOT NULL,
    persona TEXT NOT NULL DEFAULT 'buyer',
    share_token_hash TEXT NOT NULL UNIQUE,
    snapshot_json JSONB NOT NULL,
    inputs_at_purchase JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ  -- NULL = never expires
);

CREATE INDEX IF NOT EXISTS idx_snapshots_token ON report_snapshots (share_token_hash);
CREATE INDEX IF NOT EXISTS idx_snapshots_user ON report_snapshots (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snapshots_address ON report_snapshots (address_id);
