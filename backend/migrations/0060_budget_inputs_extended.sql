-- Capture the buyer property descriptors that PriceAdvisorCard collects but
-- never persisted. Mirrors what migration 0059 did for the renter side.
--
-- Before: BuyerBudgetCalculator POSTed financial inputs (purchase_price,
-- deposit_pct, interest_rate, etc.) but the property-descriptor inputs
-- from PriceAdvisorCard (asking_price, bedrooms, bathrooms, finish_tier,
-- has_parking) lived in the client zustand store and got discarded after
-- the on-screen estimate finished rendering.
--
-- After: those descriptors land in the same row as the budget inputs so
-- (a) the admin dashboard can break down buyer engagement by city,
-- bedrooms, finish tier, and asking-price band, and (b) we can build
-- crowd-sourced asking-price-vs-CV data that improves the price advisor
-- as volume grows. Same upsert pattern as user_rent_reports — multiple
-- POSTs from one user/address inside a 24h window merge into one row
-- via COALESCE rather than 409-ing or duplicating.
--
-- All columns nullable so existing rows keep working and the previous
-- BuyerBudgetCalculator body still validates.
--
-- source_context tracks WHICH form submitted (buyer_price_advisor /
-- buyer_budget_calc) for the admin breakdown. notice_version mirrors
-- the analytics consent banner ack so we can audit consent state at
-- collection time.

ALTER TABLE user_budget_inputs ADD COLUMN IF NOT EXISTS asking_price    INTEGER;
ALTER TABLE user_budget_inputs ADD COLUMN IF NOT EXISTS bedrooms        TEXT;
ALTER TABLE user_budget_inputs ADD COLUMN IF NOT EXISTS bathrooms       TEXT;
ALTER TABLE user_budget_inputs ADD COLUMN IF NOT EXISTS finish_tier     TEXT;
ALTER TABLE user_budget_inputs ADD COLUMN IF NOT EXISTS has_parking     BOOLEAN;
ALTER TABLE user_budget_inputs ADD COLUMN IF NOT EXISTS source_context  TEXT;
ALTER TABLE user_budget_inputs ADD COLUMN IF NOT EXISTS notice_version  TEXT;

-- Index for the upsert pattern: latest row per ip+address+persona inside
-- the dedup window. Mirrors the equivalent on user_rent_reports.
CREATE INDEX IF NOT EXISTS idx_budget_inputs_ip_address_persona_recent
  ON user_budget_inputs (ip_hash, address_id, persona, reported_at DESC);
