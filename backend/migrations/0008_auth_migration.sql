-- Migration 0008: Rename clerk_id → user_id for Auth.js migration
-- Clerk auth replaced with Auth.js (next-auth) + Google provider
-- Run with: psql -f backend/migrations/0008_auth_migration.sql

BEGIN;

-- 1. Rename primary key in users table
ALTER TABLE users RENAME COLUMN clerk_id TO user_id;

-- 2. Rename foreign key in report_credits
ALTER TABLE report_credits RENAME COLUMN clerk_id TO user_id;

-- 3. Rename foreign key in saved_reports
ALTER TABLE saved_reports RENAME COLUMN clerk_id TO user_id;

-- 4. Drop + recreate helper functions with new parameter name
DROP FUNCTION IF EXISTS count_user_downloads_today(text);
DROP FUNCTION IF EXISTS count_user_downloads_month(text);
CREATE OR REPLACE FUNCTION count_user_downloads_today(p_user_id TEXT)
RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM saved_reports
    WHERE user_id = p_user_id
      AND generated_at >= CURRENT_DATE
      AND generated_at < CURRENT_DATE + INTERVAL '1 day';
$$ LANGUAGE SQL STABLE;

-- Rolling 30-day window (not calendar month) — resets 30 days from each report
CREATE OR REPLACE FUNCTION count_user_downloads_month(p_user_id TEXT)
RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM saved_reports
    WHERE user_id = p_user_id
      AND generated_at >= now() - INTERVAL '30 days';
$$ LANGUAGE SQL STABLE;

COMMIT;
