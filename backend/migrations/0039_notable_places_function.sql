-- 0039: Martin function for notable places on the map
-- Shows supermarkets, schools, parks, pharmacies, etc at high zoom
-- Cafes/restaurants limited to 20 per tile to prevent flooding

CREATE OR REPLACE FUNCTION notable_places(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  bounds geometry;
  result bytea;
BEGIN
  IF z < 15 THEN RETURN NULL; END IF;
  bounds := ST_TileEnvelope(z, x, y);

  SELECT ST_AsMVT(q, 'notable_places', 4096, 'geom') INTO result
  FROM (
    SELECT * FROM (
      -- Essentials (priority 1)
      SELECT COALESCE(oa.brand, oa.name, initcap(oa.subcategory)) AS label,
        oa.subcategory AS kind, 1 AS priority,
        ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true) AS geom
      FROM osm_amenities oa
      WHERE oa.geom && ST_Transform(bounds, 4326)
        AND oa.subcategory IN ('supermarket', 'hospital', 'school')
      UNION ALL
      -- Health (priority 2)
      SELECT COALESCE(oa.name, initcap(oa.subcategory)), oa.subcategory, 2,
        ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true)
      FROM osm_amenities oa
      WHERE oa.geom && ST_Transform(bounds, 4326)
        AND oa.subcategory IN ('pharmacy', 'doctors')
      UNION ALL
      -- Green space (priority 3)
      SELECT COALESCE(oa.name, initcap(oa.subcategory)), oa.subcategory, 3,
        ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true)
      FROM osm_amenities oa
      WHERE oa.geom && ST_Transform(bounds, 4326)
        AND oa.subcategory IN ('park', 'playground')
      UNION ALL
      -- Community (priority 4)
      SELECT COALESCE(oa.name, initcap(oa.subcategory)), oa.subcategory, 4,
        ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true)
      FROM osm_amenities oa
      WHERE oa.geom && ST_Transform(bounds, 4326)
        AND oa.subcategory IN ('library', 'community_centre', 'charging_station', 'sports_centre', 'swimming_pool')
      UNION ALL
      -- Food (priority 5, limited to prevent flooding)
      SELECT label, kind, 5, geom FROM (
        SELECT COALESCE(oa.name, initcap(oa.subcategory)) AS label,
          oa.subcategory AS kind,
          ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true) AS geom
        FROM osm_amenities oa
        WHERE oa.geom && ST_Transform(bounds, 4326)
          AND oa.subcategory IN ('cafe', 'restaurant')
          AND oa.name IS NOT NULL AND oa.name != ''
        LIMIT 20
      ) food
    ) all_places
  ) q
  WHERE q.geom IS NOT NULL;

  RETURN result;
END;
$$;
