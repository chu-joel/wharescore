"""
Load GNS NZ Landslide Database (NZLD) data into PostGIS.
Source: maps.gns.cri.nz WFS — Wellington region.
628 point events + 157 polygon outlines.

Usage:
  python scripts/load_landslides.py

Requires: psycopg2, database connection via DATABASE_URL env var.
"""

import json
import os
import sys

import psycopg

DB_URL = os.environ.get("DATABASE_URL", "postgresql://wharescore:wharescore@localhost:5432/wharescore")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "landslides")


def load_points(cur):
    """Load landslide point events from GeoJSON."""
    path = os.path.join(DATA_DIR, "landslide_points_wellington.geojson")
    with open(path) as f:
        data = json.load(f)

    features = data.get("features", [])
    print(f"Loading {len(features)} landslide point events...")

    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry")
        if not geom:
            continue

        coords = geom.get("coordinates", [])
        if len(coords) < 2:
            continue

        wkt = f"SRID=4326;POINT({coords[0]} {coords[1]})"

        cur.execute("""
            INSERT INTO landslide_events (
                gns_landslide_id, name, time_of_occurrence, damage_description,
                size_category, trigger_name, severity_name, debris_type_name,
                material_type_name, movement_type_name, activity_name,
                aspect_name, data_source_name, geom
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, ST_GeomFromEWKT(%s))
        """, (
            props.get("id"),
            props.get("name"),
            props.get("time_of_occurrence"),
            props.get("damage_description"),
            props.get("size_category"),
            props.get("trigger_name"),
            props.get("severity_name"),
            props.get("debris_type_name"),
            props.get("material_type_name"),
            props.get("movement_type_name"),
            props.get("activity_name"),
            props.get("aspect_name"),
            props.get("data_source_name"),
            wkt,
        ))

    print(f"  Inserted {len(features)} point events.")


def load_polygons(cur):
    """Load landslide area polygons from GeoJSON."""
    path = os.path.join(DATA_DIR, "landslide_polygons_wellington.geojson")
    with open(path) as f:
        data = json.load(f)

    features = data.get("features", [])
    print(f"Loading {len(features)} landslide area polygons...")

    loaded = 0
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry")
        if not geom:
            continue

        geom_json = json.dumps(geom)

        try:
            cur.execute("""
                INSERT INTO landslide_areas (
                    gns_feature_id, gns_landslide_id, name, feature_type, geom
                ) VALUES (
                    %s, %s, %s, %s,
                    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
                )
            """, (
                props.get("Feature ID"),
                props.get("Landslide ID"),
                props.get("Landslide name"),
                props.get("Landslide feature"),
                geom_json,
            ))
            loaded += 1
        except Exception as e:
            print(f"  Skipped polygon: {e}")

    print(f"  Inserted {loaded} polygon areas.")


def main():
    print(f"Connecting to database...")
    conn = psycopg.connect(DB_URL)
    cur = conn.cursor()

    # Create tables
    sql_path = os.path.join(os.path.dirname(__file__), "..", "sql", "11-landslides.sql")
    with open(sql_path) as f:
        cur.execute(f.read())
    conn.commit()
    print("Tables created.")

    # Clear existing data
    cur.execute("TRUNCATE landslide_events, landslide_areas RESTART IDENTITY")
    conn.commit()

    # Load data
    load_points(cur)
    conn.commit()

    load_polygons(cur)
    conn.commit()

    # Verify
    cur.execute("SELECT COUNT(*) FROM landslide_events")
    print(f"\nVerification: {cur.fetchone()[0]} landslide events loaded")

    cur.execute("SELECT COUNT(*) FROM landslide_areas")
    print(f"Verification: {cur.fetchone()[0]} landslide areas loaded")

    cur.execute("SELECT trigger_name, COUNT(*) FROM landslide_events GROUP BY trigger_name ORDER BY COUNT(*) DESC")
    print("\nTrigger breakdown:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}")

    cur.execute("ANALYZE landslide_events")
    cur.execute("ANALYZE landslide_areas")

    conn.commit()
    cur.close()
    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
