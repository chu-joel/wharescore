-- 0039: Martin function for notable places on the map
-- Shows supermarkets, schools, parks, pharmacies, etc at high zoom
-- with priority-based symbol placement (MapLibre handles collision)

CREATE OR REPLACE FUNCTION notable_places(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  bounds geometry;
  result bytea;
BEGIN
  -- Only serve at zoom 15+
  IF z < 15 THEN RETURN NULL; END IF;

  bounds := ST_TileEnvelope(z, x, y);

  SELECT ST_AsMVT(q, 'notable_places', 4096, 'geom') INTO result
  FROM (
    SELECT
      COALESCE(oa.brand, oa.name, initcap(oa.subcategory)) AS label,
      oa.subcategory AS kind,
      CASE oa.subcategory
        WHEN 'supermarket' THEN 1
        WHEN 'school' THEN 2
        WHEN 'hospital' THEN 2
        WHEN 'doctors' THEN 3
        WHEN 'pharmacy' THEN 3
        WHEN 'park' THEN 4
        WHEN 'playground' THEN 4
        WHEN 'cafe' THEN 5
        WHEN 'restaurant' THEN 6
        WHEN 'library' THEN 5
        WHEN 'community_centre' THEN 6
        WHEN 'charging_station' THEN 6
        WHEN 'sports_centre' THEN 7
        WHEN 'swimming_pool' THEN 7
        ELSE 8
      END AS priority,
      ST_AsMVTGeom(
        ST_Transform(oa.geom, 3857),
        bounds, 4096, 64, true
      ) AS geom
    FROM osm_amenities oa
    WHERE oa.geom && ST_Transform(bounds, 4326)
      AND oa.subcategory IN (
        'supermarket', 'school', 'hospital', 'doctors', 'pharmacy',
        'park', 'playground',
        'cafe', 'restaurant',
        'library', 'community_centre', 'charging_station',
        'sports_centre', 'swimming_pool'
      )
  ) q
  WHERE q.geom IS NOT NULL;

  RETURN result;
END;
$$;
