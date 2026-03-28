-- 0026: Add report_tier column for Quick ($4.99) vs Full ($9.99) reports
-- The tier controls frontend rendering; snapshot data is identical regardless of tier.

ALTER TABLE report_snapshots
  ADD COLUMN IF NOT EXISTS report_tier TEXT NOT NULL DEFAULT 'full';

-- Add check constraint separately (IF NOT EXISTS not supported for constraints)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_snapshots_tier_check'
  ) THEN
    ALTER TABLE report_snapshots
      ADD CONSTRAINT report_snapshots_tier_check
      CHECK (report_tier IN ('quick', 'full'));
  END IF;
END$$;

-- Add tier to report_credits so we know what the user purchased
ALTER TABLE report_credits
  ADD COLUMN IF NOT EXISTS report_tier TEXT NOT NULL DEFAULT 'full';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_credits_tier_check'
  ) THEN
    ALTER TABLE report_credits
      ADD CONSTRAINT report_credits_tier_check
      CHECK (report_tier IN ('quick', 'full'));
  END IF;
END$$;

-- Add tier to guest_purchases
ALTER TABLE guest_purchases
  ADD COLUMN IF NOT EXISTS report_tier TEXT NOT NULL DEFAULT 'quick';
