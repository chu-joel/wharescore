-- NZ Waterways (rivers, streams, drains, canals) from LINZ Topo50
-- Used for waterway proximity analysis in property reports
CREATE TABLE IF NOT EXISTS nz_waterways (
    id SERIAL PRIMARY KEY,
    linz_id INTEGER,
    feat_type VARCHAR(20),          -- river_cl, drain_cl, canal_cl
    name TEXT,                       -- River/stream name (may be NULL for unnamed)
    name_ascii TEXT,                 -- ASCII version of name
    geom GEOMETRY(LineString, 4326)
);

CREATE INDEX IF NOT EXISTS idx_nz_waterways_geom ON nz_waterways USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_nz_waterways_feat_type ON nz_waterways (feat_type);
