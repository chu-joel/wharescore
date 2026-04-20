-- 0053_verify_dev_user.sql
--
-- Seeds a service-account user used by /verify captures, /iterate smoke tests,
-- and local development. Gives it Pro-tier access with bounded daily/monthly
-- limits so a bug in the autonomous loop can't generate unbounded snapshots.
--
-- Rollback:
--   DELETE FROM report_credits WHERE user_id = 'verify-dev-service-account';
--   DELETE FROM users          WHERE user_id = 'verify-dev-service-account';
--
-- Notes:
--   - Idempotent via ON CONFLICT — safe to re-run migrate.py on any env.
--   - The JWT minter (backend/scripts/mint-dev-jwt.py) signs tokens with sub =
--     'verify-dev-service-account', which matches the user_id below.
--   - Plan = 'pro' unlocks all paywalled endpoints without touching Stripe.
--   - Daily limit of 20 + monthly of 200 means a runaway /iterate still can't
--     generate thousands of hosted reports before the credit system blocks it.
--   - Column name is `user_id`, not `clerk_id` — migration 0008 renamed the
--     column when auth moved from Clerk to Auth.js. Earlier versions of this
--     file used `clerk_id` and crashed migrate.py on boot ("UndefinedColumn:
--     clerk_id of relation users"). Fixed in place because this migration
--     had never successfully applied on any environment (a failed
--     migration leaves no row in schema_migrations, so the corrected file
--     re-runs cleanly).

INSERT INTO users (user_id, email, display_name, plan)
VALUES (
    'verify-dev-service-account',
    'verify-dev@speculo.co.nz',
    'Verify Dev Service Account',
    'pro'
)
ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        plan = 'pro',
        updated_at = now();

-- Idempotent Pro entitlement for the service account.
-- Using INSERT ... WHERE NOT EXISTS rather than DELETE+INSERT, because:
--   (a) DELETE would trip the irreversible-migration-guard hook (intentional)
--   (b) The service-account credit row only needs to exist once — if it's already
--       there from a prior migration run, leaving it untouched is correct.
-- If a future change needs to update the limits, add a new migration that
-- explicitly UPDATEs specific columns and gate it via human review.
INSERT INTO report_credits (
    user_id,
    credit_type,
    credits_remaining,
    daily_limit,
    monthly_limit,
    stripe_payment_id,
    stripe_subscription_id,
    stripe_customer_id,
    expires_at
)
SELECT
    'verify-dev-service-account',
    'pro',
    NULL,            -- Pro uses daily/monthly limits, not a balance
    20,              -- daily cap (anti-runaway safeguard)
    200,             -- monthly cap
    NULL,
    'verify-dev-none',   -- sentinel — not a real Stripe sub
    NULL,
    NULL             -- no expiry
WHERE NOT EXISTS (
    SELECT 1 FROM report_credits WHERE user_id = 'verify-dev-service-account'
);
