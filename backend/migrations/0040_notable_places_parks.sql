-- 0040: Add park_extents (4,753 parks) to notable_places function
-- Previously only used osm_amenities (68 parks). Now uses park_extents
-- polygons via ST_PointOnSurface for label placement, deduped against OSM.

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
      -- Priority 1: Essentials
      SELECT COALESCE(oa.brand, oa.name, initcap(oa.subcategory)) AS label,
        oa.subcategory AS kind, 1 AS priority,
        ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true) AS geom
      FROM osm_amenities oa
      WHERE oa.geom && ST_Transform(bounds, 4326)
        AND oa.subcategory IN ('supermarket', 'hospital')
      UNION ALL
      -- Priority 1b: Schools from proper schools table (2,568 vs 56 in OSM)
      SELECT s.org_name, 'school'::text, 1,
        ST_AsMVTGeom(ST_Transform(s.geom, 3857), bounds, 4096, 64, true)
      FROM schools s
      WHERE s.geom && ST_Transform(bounds, 4326)
      UNION ALL
      -- Priority 2: Health
      SELECT COALESCE(oa.name, initcap(oa.subcategory)), oa.subcategory, 2,
        ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true)
      FROM osm_amenities oa
      WHERE oa.geom && ST_Transform(bounds, 4326)
        AND oa.subcategory IN ('pharmacy', 'doctors')
      UNION ALL
      -- Priority 3: Green space — park_extents (4,753 parks nationwide)
      SELECT initcap(pe.site_name), 'park'::text, 3,
        ST_AsMVTGeom(ST_Transform(ST_PointOnSurface(pe.geom), 3857), bounds, 4096, 64, true)
      FROM park_extents pe
      WHERE pe.geom && ST_Transform(bounds, 4326)
        AND pe.site_name IS NOT NULL AND pe.site_name != ''
      UNION ALL
      -- Priority 3: Green space — OSM playgrounds + zoos (not in park_extents)
      SELECT COALESCE(oa.name, initcap(oa.subcategory)), oa.subcategory, 3,
        ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true)
      FROM osm_amenities oa
      WHERE oa.geom && ST_Transform(bounds, 4326)
        AND oa.subcategory IN ('playground', 'zoo')
      UNION ALL
      -- Priority 3b: Culture + landmarks
      SELECT COALESCE(oa.name, initcap(oa.subcategory)), oa.subcategory, 3,
        ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true)
      FROM osm_amenities oa
      WHERE oa.geom && ST_Transform(bounds, 4326)
        AND oa.subcategory IN ('museum', 'gallery', 'cinema', 'theatre', 'university')
        AND oa.name IS NOT NULL AND oa.name != ''
      UNION ALL
      -- Priority 4: Community + transport
      SELECT COALESCE(oa.name, initcap(oa.subcategory)), oa.subcategory, 4,
        ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true)
      FROM osm_amenities oa
      WHERE oa.geom && ST_Transform(bounds, 4326)
        AND oa.subcategory IN ('library', 'community_centre', 'charging_station',
                               'sports_centre', 'swimming_pool', 'fitness_centre')
      UNION ALL
      -- Priority 5: Services (limited)
      SELECT label, kind, 5, geom FROM (
        SELECT COALESCE(oa.brand, oa.name, initcap(oa.subcategory)) AS label,
          oa.subcategory AS kind,
          ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true) AS geom
        FROM osm_amenities oa
        WHERE oa.geom && ST_Transform(bounds, 4326)
          AND oa.subcategory IN ('fuel', 'bank')
          AND oa.name IS NOT NULL AND oa.name != ''
        LIMIT 15
      ) svc
      UNION ALL
      -- Priority 6: Food (limited)
      SELECT label, kind, 6, geom FROM (
        SELECT COALESCE(oa.name, initcap(oa.subcategory)) AS label,
          oa.subcategory AS kind,
          ST_AsMVTGeom(ST_Transform(oa.geom, 3857), bounds, 4096, 64, true) AS geom
        FROM osm_amenities oa
        WHERE oa.geom && ST_Transform(bounds, 4326)
          AND oa.subcategory IN ('cafe', 'restaurant')
          AND oa.name IS NOT NULL AND oa.name != ''
        LIMIT 15
      ) food
    ) all_places
  ) q
  WHERE q.geom IS NOT NULL;

  RETURN result;
END;
$$;
