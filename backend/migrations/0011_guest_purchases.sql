-- 0011: Guest checkout purchases (no account required)
CREATE TABLE IF NOT EXISTS guest_purchases (
    id SERIAL PRIMARY KEY,
    stripe_session_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    address_id INT NOT NULL,
    persona TEXT NOT NULL DEFAULT 'buyer',
    download_token_hash TEXT NOT NULL,
    download_count INT NOT NULL DEFAULT 0,
    max_downloads INT NOT NULL DEFAULT 3,
    job_id TEXT,
    user_id TEXT REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '72 hours',
    redeemed_at TIMESTAMPTZ
);

CREATE INDEX idx_guest_purchases_token ON guest_purchases (download_token_hash);
CREATE INDEX idx_guest_purchases_email ON guest_purchases (email);
CREATE INDEX idx_guest_purchases_session ON guest_purchases (stripe_session_id);
