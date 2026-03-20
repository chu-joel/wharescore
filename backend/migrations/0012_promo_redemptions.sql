-- Track promo code redemptions to enforce per-user limits
CREATE TABLE IF NOT EXISTS promo_redemptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user_code
    ON promo_redemptions (user_id, code);
