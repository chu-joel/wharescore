-- 0038: Function for Martin to serve address labels at building centroids
-- When a building contains the address point, use the building centroid.
-- Otherwise fall back to the address point itself.

CREATE OR REPLACE FUNCTION address_labels(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  bounds geometry;
  result bytea;
BEGIN
  -- Only serve at zoom 17+
  IF z < 17 THEN RETURN NULL; END IF;

  bounds := ST_TileEnvelope(z, x, y);

  SELECT ST_AsMVT(q, 'address_labels', 4096, 'geom') INTO result
  FROM (
    SELECT
      a.address_number,
      a.unit_value,
      ST_AsMVTGeom(
        COALESCE(ST_Centroid(b.geom), a.geom),
        bounds, 4096, 64, true
      ) AS geom
    FROM addresses a
    LEFT JOIN LATERAL (
      SELECT geom FROM building_outlines bo
      WHERE bo.geom && a.geom AND ST_Contains(bo.geom, a.geom)
      LIMIT 1
    ) b ON true
    WHERE a.geom && bounds
      AND a.address_number IS NOT NULL
      AND a.address_lifecycle = 'Current'
  ) q
  WHERE q.geom IS NOT NULL;

  RETURN result;
END;
$$;
