-- Migration 0007: User accounts, report credits, and saved reports
-- Supports: Clerk auth, Stripe payments, PDF paywall
-- Run with: psql -f backend/migrations/0007_user_accounts_and_payments.sql

BEGIN;

-- 1. Users (synced from Clerk via webhook)
CREATE TABLE IF NOT EXISTS users (
    clerk_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT,
    plan TEXT NOT NULL DEFAULT 'free',  -- free, single, pack3, pro
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);

-- 2. Report credits (purchased via Stripe)
-- One row per purchase or active subscription
CREATE TABLE IF NOT EXISTS report_credits (
    id SERIAL PRIMARY KEY,
    clerk_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    credit_type TEXT NOT NULL,             -- 'single', 'pack3', 'pro'
    credits_remaining INT NOT NULL DEFAULT 0,  -- for single/pack3; NULL for pro
    daily_limit INT,                       -- 10 for pro, NULL for credit-based
    monthly_limit INT,                     -- 30 for pro, NULL for credit-based
    stripe_payment_id TEXT,                -- one-off purchases
    stripe_subscription_id TEXT,           -- pro recurring
    stripe_customer_id TEXT,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,               -- pro: end of billing period
    cancelled_at TIMESTAMPTZ              -- pro: when subscription was cancelled
);

CREATE INDEX idx_report_credits_clerk ON report_credits (clerk_id);
CREATE INDEX idx_report_credits_stripe_sub ON report_credits (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- 3. Saved reports (generated PDFs linked to account)
CREATE TABLE IF NOT EXISTS saved_reports (
    id SERIAL PRIMARY KEY,
    clerk_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    address_id INT NOT NULL,
    full_address TEXT NOT NULL,
    report_html TEXT NOT NULL,
    persona TEXT NOT NULL DEFAULT 'buyer',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_reports_clerk ON saved_reports (clerk_id);
CREATE INDEX idx_saved_reports_clerk_date ON saved_reports (clerk_id, generated_at DESC);
CREATE INDEX idx_saved_reports_address ON saved_reports (clerk_id, address_id);

-- 4. Helper: count downloads today for a user (used by Pro daily limit)
CREATE OR REPLACE FUNCTION count_user_downloads_today(p_clerk_id TEXT)
RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM saved_reports
    WHERE clerk_id = p_clerk_id
      AND generated_at >= CURRENT_DATE
      AND generated_at < CURRENT_DATE + INTERVAL '1 day';
$$ LANGUAGE SQL STABLE;

-- 5. Helper: count downloads this month for a user (used by Pro monthly limit)
CREATE OR REPLACE FUNCTION count_user_downloads_month(p_clerk_id TEXT)
RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM saved_reports
    WHERE clerk_id = p_clerk_id
      AND generated_at >= date_trunc('month', CURRENT_DATE)
      AND generated_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
$$ LANGUAGE SQL STABLE;

COMMIT;
