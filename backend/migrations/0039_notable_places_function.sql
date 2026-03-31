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
        -- Priority 1: essentials (always shown first)
        WHEN 'supermarket' THEN 1
        -- Priority 2: schools & health
        WHEN 'school' THEN 2
        WHEN 'hospital' THEN 2
        WHEN 'doctors' THEN 3
        WHEN 'pharmacy' THEN 3
        -- Priority 3: green space & family
        WHEN 'park' THEN 4
        WHEN 'playground' THEN 4
        -- Priority 4: food & drink
        WHEN 'cafe' THEN 5
        WHEN 'restaurant' THEN 6
        -- Priority 5: community & transport
        WHEN 'library' THEN 5
        WHEN 'community_centre' THEN 6
        WHEN 'charging_station' THEN 6
        WHEN 'sports_centre' THEN 7
        WHEN 'swimming_pool' THEN 7
        ELSE 8
      END AS priority,
      ST_AsMVTGeom(oa.geom, bounds, 4096, 64, true) AS geom
    FROM osm_amenities oa
    WHERE oa.geom && bounds
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
