-- 0018_saved_reports_share_token.sql
-- Add share_token to saved_reports so account page can link to hosted reports
-- instead of serving old HTML blobs.

ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS share_token TEXT;
