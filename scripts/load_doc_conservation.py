"""
Load DOC Public Conservation Land GeoJSON into PostGIS.
Requires: psycopg (pip install psycopg[binary])

Usage: python scripts/load_doc_conservation.py
"""

import json
import time
import sys
import psycopg

DB = "postgresql://postgres:postgres@localhost:5432/wharescore"
GEOJSON_FILE = r"D:\Projects\Experiments\propertyiq-poc\data\doc-conservation\doc-public-conservation-land.geojson"


def main():
    print("=" * 60)
    print("LOADING DOC CONSERVATION LAND INTO POSTGIS")
    print("=" * 60)

    print(f"\nReading {GEOJSON_FILE}...")
    t0 = time.time()
    with open(GEOJSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    t1 = time.time()

    features = data.get("features", [])
    print(f"  Loaded {len(features)} features in {t1 - t0:.1f}s")

    if not features:
        print("ERROR: No features found!")
        return

    # Inspect first feature to understand schema
    props = features[0].get("properties", {})
    print(f"  Sample properties: {list(props.keys())[:15]}")

    print(f"\nConnecting to database...")
    with psycopg.connect(DB, autocommit=False) as conn:
        print("  Dropping old table if exists...")
        conn.execute("DROP TABLE IF EXISTS conservation_land CASCADE;")

        print("  Creating table...")
        conn.execute("""
            CREATE TABLE conservation_land (
                id SERIAL PRIMARY KEY,
                name TEXT,
                land_type TEXT,
                land_status TEXT,
                managing_agency TEXT,
                area_ha NUMERIC,
                legal_name TEXT,
                geom GEOMETRY(Geometry, 4326)
            );
        """)

        print(f"  Inserting {len(features)} rows...")
        t2 = time.time()
        inserted = 0
        skipped = 0

        for feat in features:
            geom = feat.get("geometry")
            if not geom:
                skipped += 1
                continue

            props = feat.get("properties", {})

            # Try common field names from DOC data
            name = (props.get("Name") or props.get("name") or
                    props.get("NAME") or props.get("LegalName") or
                    props.get("legal_name") or "")
            land_type = (props.get("Type") or props.get("type") or
                        props.get("TYPE") or props.get("LandType") or
                        props.get("land_type") or "")
            land_status = (props.get("Status") or props.get("status") or
                          props.get("STATUS") or props.get("LandStatus") or
                          props.get("land_status") or "")
            managing_agency = (props.get("ManagingAgency") or props.get("Agency") or
                              props.get("managing_agency") or "")
            legal_name = (props.get("LegalName") or props.get("legal_name") or
                         props.get("LEGAL_NAME") or "")

            # Area
            area_ha = None
            for key in ["AreaHa", "area_ha", "AREA_HA", "Shape_Area", "shape_area", "Area"]:
                if key in props and props[key] is not None:
                    try:
                        area_ha = float(props[key])
                    except (ValueError, TypeError):
                        pass
                    break

            geom_json = json.dumps(geom)

            try:
                conn.execute(
                    """INSERT INTO conservation_land
                       (name, land_type, land_status, managing_agency, area_ha, legal_name, geom)
                       VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))""",
                    (name, land_type, land_status, managing_agency, area_ha, legal_name, geom_json)
                )
                inserted += 1
            except Exception as e:
                skipped += 1
                if skipped <= 3:
                    print(f"    Warning: skipped feature: {e}")
                conn.rollback()
                conn.autocommit = False

            if inserted % 1000 == 0 and inserted > 0:
                print(f"    Inserted {inserted}...", flush=True)

        t3 = time.time()
        print(f"  Inserted {inserted} rows, skipped {skipped} in {t3 - t2:.1f}s")

        print("  Creating indexes...")
        conn.execute("CREATE INDEX idx_conservation_geom ON conservation_land USING GIST (geom);")
        conn.execute("CREATE INDEX idx_conservation_type ON conservation_land (land_type);")
        conn.execute("ANALYZE conservation_land;")

        conn.commit()

        # Stats
        result = conn.execute(
            "SELECT land_type, COUNT(*) FROM conservation_land GROUP BY land_type ORDER BY count DESC LIMIT 15"
        ).fetchall()
        print(f"\n  Land type breakdown:")
        total = 0
        for lt, cnt in result:
            print(f"    {lt or '(empty)'}: {cnt:,}")
            total += cnt
        print(f"    TOTAL: {total:,}")

    print(f"\nDone! Total time: {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
