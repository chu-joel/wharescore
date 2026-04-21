-- REINZ Territorial Authority HPI, per month.
-- Populated by admin-uploaded REINZ monthly HPI PDF (page 14 index table +
-- page 6 summary-of-movements percentages).
-- Used by price_advisor to back-calculate HPI at council reval dates via
-- compound 5-year-CGR extrapolation, replacing the national rbnz_housing
-- series that misrepresents regional markets like Christchurch and Dunedin.

CREATE TABLE IF NOT EXISTS reinz_hpi_ta (
  ta_name         TEXT NOT NULL,   -- e.g. "Christchurch City"
  month_end       DATE NOT NULL,   -- effective month of the release
  hpi             NUMERIC NOT NULL,
  change_1m_pct   NUMERIC,         -- only populated for TAs in the page-6 summary (~27)
  change_3m_pct   NUMERIC,
  change_1y_pct   NUMERIC,
  change_5y_cgr_pct NUMERIC,       -- compound annual growth rate over 5y; key for back-calc
  calculated      TEXT,            -- 'Actual Month' | '2 month rolling' | '3 month rolling' | '6 month rolling'
  PRIMARY KEY (ta_name, month_end)
);

CREATE INDEX IF NOT EXISTS idx_reinz_hpi_ta_month ON reinz_hpi_ta (month_end DESC);
