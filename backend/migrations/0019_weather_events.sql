-- 0019_weather_events.sql
-- Store extreme weather events from Open-Meteo archive for area feed.
-- Grid-based: one row per SA2 centroid per extreme weather day.

CREATE TABLE IF NOT EXISTS weather_events (
    id SERIAL PRIMARY KEY,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL,          -- 'heavy_rain', 'extreme_wind', 'heatwave', 'storm', 'snow'
    severity TEXT NOT NULL,            -- 'critical', 'warning', 'info'
    title TEXT NOT NULL,
    description TEXT,
    precipitation_mm REAL,
    wind_gust_kmh REAL,
    temp_max_c REAL,
    temp_min_c REAL,
    weather_code INT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_weather_events_geom ON weather_events USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_weather_events_date ON weather_events (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_weather_events_severity ON weather_events (severity);
