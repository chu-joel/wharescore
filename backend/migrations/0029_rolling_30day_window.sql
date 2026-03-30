-- 0029: Change monthly download counter to rolling 30-day window
--
-- Previously counted downloads from the 1st of the calendar month.
-- Now counts from the last 30 days, so Pro users get a steady
-- 30 reports per rolling 30-day window instead of resetting on the 1st.

CREATE OR REPLACE FUNCTION count_user_downloads_month(p_user_id TEXT)
RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM saved_reports
    WHERE user_id = p_user_id
      AND generated_at >= now() - INTERVAL '30 days';
$$ LANGUAGE SQL STABLE;
