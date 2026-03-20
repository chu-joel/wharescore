-- Migration 0009: Saved properties (free bookmarks, requires sign-in)
-- Supports the "save property" conversion funnel step

BEGIN;

CREATE TABLE IF NOT EXISTS saved_properties (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    address_id INT NOT NULL,
    full_address TEXT NOT NULL DEFAULT '',
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_saved_properties_user_address
    ON saved_properties (user_id, address_id);
CREATE INDEX idx_saved_properties_user
    ON saved_properties (user_id, saved_at DESC);

COMMIT;
