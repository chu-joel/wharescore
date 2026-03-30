-- 0037: Fibre coverage + cycleway tables

-- SFA fibre coverage (simplified to convex hull per SFA zone, not per parcel)
CREATE TABLE IF NOT EXISTS fibre_coverage (
    id SERIAL PRIMARY KEY,
    sfa_name TEXT NOT NULL,
    provider TEXT,
    parcel_count INT,
    geom geometry(Geometry, 4326)
);
CREATE INDEX IF NOT EXISTS idx_fibre_coverage_geom ON fibre_coverage USING GIST(geom);

-- OSM cycleways (line features)
CREATE TABLE IF NOT EXISTS cycleways (
    id SERIAL PRIMARY KEY,
    name TEXT,
    surface TEXT,
    geom geometry(LineString, 4326)
);
CREATE INDEX IF NOT EXISTS idx_cycleways_geom ON cycleways USING GIST(geom);
