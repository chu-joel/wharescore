-- Analytics and metrics tables for observability
BEGIN;

-- 1. app_events — general-purpose event log
CREATE TABLE IF NOT EXISTS app_events (
    id          BIGSERIAL PRIMARY KEY,
    event_type  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id     TEXT,
    session_id  TEXT,
    ip_hash     TEXT,
    properties  JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_events_type_created ON app_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_created ON app_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_user ON app_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- 2. perf_metrics — request-level performance data
CREATE TABLE IF NOT EXISTS perf_metrics (
    id            BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    method        TEXT NOT NULL,
    path          TEXT NOT NULL,
    path_template TEXT,
    status_code   SMALLINT NOT NULL,
    duration_ms   REAL NOT NULL,
    user_id       TEXT,
    ip_hash       TEXT,
    request_id    TEXT
);

CREATE INDEX IF NOT EXISTS idx_perf_created ON perf_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_template_created ON perf_metrics (path_template, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_slow ON perf_metrics (created_at DESC) WHERE duration_ms > 2000;

-- 3. error_log — captured exceptions and failures
CREATE TABLE IF NOT EXISTS error_log (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    level       TEXT NOT NULL DEFAULT 'error',
    category    TEXT NOT NULL,
    message     TEXT NOT NULL,
    traceback   TEXT,
    request_id  TEXT,
    path        TEXT,
    user_id     TEXT,
    properties  JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_error_created ON error_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_category ON error_log (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_unresolved ON error_log (created_at DESC)
    WHERE NOT (properties ? 'resolved_at');

-- 4. daily_metrics — pre-aggregated rollups
CREATE TABLE IF NOT EXISTS daily_metrics (
    day             DATE NOT NULL,
    metric_name     TEXT NOT NULL,
    metric_value    BIGINT NOT NULL DEFAULT 0,
    properties      JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (day, metric_name)
);

-- 5. Retention cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_analytics() RETURNS void AS $$
BEGIN
    DELETE FROM app_events WHERE created_at < now() - INTERVAL '90 days';
    DELETE FROM perf_metrics WHERE created_at < now() - INTERVAL '30 days';
    DELETE FROM error_log WHERE created_at < now() - INTERVAL '90 days';
    DELETE FROM daily_metrics WHERE day < CURRENT_DATE - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

COMMIT;
