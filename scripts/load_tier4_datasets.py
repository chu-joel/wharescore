"""
Load Tier 4 datasets into PostGIS from ArcGIS REST APIs.

Datasets:
1. WCC 2024 District Plan Zones (2,683 polygons)
2. WCC Height Control Areas (2,365 polygons)
3. GWRC Contaminated Land SLUR (2,391 polygons)
4. WCC Earthquake-Prone Buildings (544 points)
5. GWRC Resource Consents (26,507 points)

All sources are ArcGIS REST services. Geometry is reprojected from
EPSG:2193 (NZTM) to EPSG:4326 (WGS84) on insert using ST_Transform.
"""

import json
import ssl
import urllib.request
import urllib.parse
import time
import psycopg

# GWRC has SSL cert issues — create unverified context as fallback
SSL_CTX = ssl.create_default_context()
try:
    SSL_CTX.load_default_certs()
except Exception:
    pass
SSL_CTX_NOVERIFY = ssl._create_unverified_context()

DB_CONN = "host=localhost dbname=wharescore user=postgres password=postgres"


def fetch_arcgis_features(base_url, max_per_page=1000, where="1=1", out_fields="*"):
    """Fetch all features from an ArcGIS REST endpoint with pagination."""
    all_features = []
    offset = 0

    while True:
        params = {
            "where": where,
            "outFields": out_fields,
            "f": "json",
            "returnGeometry": "true",
            "resultOffset": str(offset),
            "resultRecordCount": str(max_per_page),
        }
        url = f"{base_url}/query?{urllib.parse.urlencode(params)}"
        print(f"  Fetching offset {offset}...")

        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "WhareScore-POC/1.0"})
                # Try with default SSL first, fall back to unverified
                ctx = SSL_CTX if attempt == 0 else SSL_CTX_NOVERIFY
                with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                break
            except ssl.SSLCertVerificationError:
                if attempt == 0:
                    print(f"    SSL cert issue, retrying without verification...")
                    continue
                raise
            except Exception as e:
                if attempt < 2:
                    print(f"    Retry {attempt+1} after error: {e}")
                    time.sleep(2)
                else:
                    raise

        features = data.get("features", [])
        if not features:
            break

        all_features.extend(features)
        offset += len(features)

        if len(features) < max_per_page:
            break

        time.sleep(0.5)

    print(f"  Total features: {len(all_features)}")
    return all_features, data.get("geometryType", ""), data.get("spatialReference", {})


def rings_to_wkt(rings):
    """Convert ArcGIS rings to WKT polygon."""
    parts = []
    for ring in rings:
        coords = ", ".join(f"{p[0]} {p[1]}" for p in ring)
        parts.append(f"({coords})")
    return f"POLYGON({', '.join(parts)})"


def multipolygon_wkt(geometry):
    """Convert ArcGIS geometry to WKT, handling both single and multi rings."""
    rings = geometry.get("rings", [])
    if not rings:
        return None
    coords_parts = []
    for ring in rings:
        coords = ", ".join(f"{p[0]} {p[1]}" for p in ring)
        coords_parts.append(f"(({coords}))")
    return f"MULTIPOLYGON({', '.join(coords_parts)})"


def point_wkt(geometry):
    """Convert ArcGIS point geometry to WKT."""
    x = geometry.get("x")
    y = geometry.get("y")
    if x is None or y is None:
        return None
    return f"POINT({x} {y})"


def clean(val):
    if val is None:
        return None
    s = str(val).strip()
    if s in ("", "None", "none", "Null", "null"):
        return None
    return s


# ============================================================
# Dataset 1: WCC 2024 District Plan Zones
# ============================================================
def load_district_plan_zones(cur):
    print("\n=== 1. WCC 2024 District Plan Zones ===")
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/122"

    features, geom_type, sr = fetch_arcgis_features(url, max_per_page=2000)

    cur.execute("""
        DROP TABLE IF EXISTS district_plan_zones CASCADE;
        CREATE TABLE district_plan_zones (
            id SERIAL PRIMARY KEY,
            zone_name TEXT,
            zone_code TEXT,
            category TEXT,
            chapter TEXT,
            eplan_url TEXT,
            status TEXT,
            council TEXT DEFAULT 'WCC',
            geom GEOMETRY(MultiPolygon, 4326)
        );
    """)

    count = 0
    for f in features:
        attrs = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = multipolygon_wkt(geom)
        if not wkt:
            continue

        cur.execute("""
            INSERT INTO district_plan_zones
                (zone_name, zone_code, category, chapter, eplan_url, status, geom)
            VALUES (%s, %s, %s, %s, %s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
        """, (
            clean(attrs.get("DPZone")),
            clean(attrs.get("DPZoneCode")),
            clean(attrs.get("Category")),
            clean(attrs.get("DP_Chapter")),
            clean(attrs.get("ePlan_URL")),
            clean(attrs.get("Status")),
            wkt,
        ))
        count += 1

    cur.execute("""
        CREATE INDEX idx_dpz_geom ON district_plan_zones USING GIST (geom);
        CREATE INDEX idx_dpz_zone ON district_plan_zones (zone_name);
        CREATE INDEX idx_dpz_code ON district_plan_zones (zone_code);
    """)
    print(f"  Inserted {count} zones")
    return count


# ============================================================
# Dataset 2: WCC Height Control Areas
# ============================================================
def load_height_controls(cur):
    print("\n=== 2. WCC Height Control Areas ===")
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/124"

    features, geom_type, sr = fetch_arcgis_features(url, max_per_page=2000)

    cur.execute("""
        DROP TABLE IF EXISTS height_controls CASCADE;
        CREATE TABLE height_controls (
            id SERIAL PRIMARY KEY,
            height_metres DOUBLE PRECISION,
            zone_name TEXT,
            zone_code TEXT,
            name TEXT,
            label TEXT,
            notes TEXT,
            council TEXT DEFAULT 'WCC',
            geom GEOMETRY(MultiPolygon, 4326)
        );
    """)

    count = 0
    for f in features:
        attrs = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = multipolygon_wkt(geom)
        if not wkt:
            continue

        height = attrs.get("HeightControl_Metres")
        if height is not None:
            try:
                height = float(height)
            except (ValueError, TypeError):
                height = None

        cur.execute("""
            INSERT INTO height_controls
                (height_metres, zone_name, zone_code, name, label, notes, geom)
            VALUES (%s, %s, %s, %s, %s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
        """, (
            height,
            clean(attrs.get("DPZone")),
            clean(attrs.get("DPZoneCode")),
            clean(attrs.get("Name")),
            clean(attrs.get("Label")),
            clean(attrs.get("Notes")),
            wkt,
        ))
        count += 1

    cur.execute("""
        CREATE INDEX idx_hc_geom ON height_controls USING GIST (geom);
        CREATE INDEX idx_hc_height ON height_controls (height_metres);
        CREATE INDEX idx_hc_zone ON height_controls (zone_name);
    """)
    print(f"  Inserted {count} height control areas")
    return count


# ============================================================
# Dataset 3: GWRC Contaminated Land (SLUR)
# ============================================================
def load_contaminated_land(cur):
    print("\n=== 3. GWRC Contaminated Land (SLUR) ===")
    url = "https://mapping.gw.govt.nz/arcgis/rest/services/GW/Our_Environment_P/MapServer/39"

    features, geom_type, sr = fetch_arcgis_features(url, max_per_page=1000)

    cur.execute("""
        DROP TABLE IF EXISTS contaminated_land CASCADE;
        CREATE TABLE contaminated_land (
            id SERIAL PRIMARY KEY,
            site_id TEXT,
            site_name TEXT,
            file_no TEXT,
            anzecc_category TEXT,
            anzecc_subcategory TEXT,
            category TEXT,
            street_number TEXT,
            street_name TEXT,
            local_authority TEXT,
            legal_description TEXT,
            site_history TEXT,
            geom GEOMETRY(MultiPolygon, 4326)
        );
    """)

    count = 0
    for f in features:
        attrs = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = multipolygon_wkt(geom)
        if not wkt:
            continue

        cur.execute("""
            INSERT INTO contaminated_land
                (site_id, site_name, file_no, anzecc_category, anzecc_subcategory,
                 category, street_number, street_name, local_authority,
                 legal_description, site_history, geom)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
        """, (
            clean(attrs.get("SITEID")),
            clean(attrs.get("SITENAME")),
            clean(attrs.get("FILENO")),
            clean(attrs.get("ANZECC")),
            clean(attrs.get("ANZECCSUB")),
            clean(attrs.get("CATEGORY")),
            clean(attrs.get("STREET_NUMBER")),
            clean(attrs.get("STREET_NAME")),
            clean(attrs.get("LA_NAME")),
            clean(attrs.get("LEGAL_DESCRIPTION")),
            clean(attrs.get("SITE_HISTORY")),
            wkt,
        ))
        count += 1

    cur.execute("""
        CREATE INDEX idx_cl_geom ON contaminated_land USING GIST (geom);
        CREATE INDEX idx_cl_category ON contaminated_land (category);
        CREATE INDEX idx_cl_la ON contaminated_land (local_authority);
    """)
    print(f"  Inserted {count} contaminated sites")
    return count


# ============================================================
# Dataset 4: WCC Earthquake-Prone Buildings
# ============================================================
def load_earthquake_prone_buildings(cur):
    print("\n=== 4. WCC Earthquake-Prone Buildings ===")
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/ForwardWorks/ForwardWorks/MapServer/20"

    features, geom_type, sr = fetch_arcgis_features(url, max_per_page=2000)

    cur.execute("""
        DROP TABLE IF EXISTS earthquake_prone_buildings CASCADE;
        CREATE TABLE earthquake_prone_buildings (
            id SERIAL PRIMARY KEY,
            address TEXT,
            epbr_url TEXT,
            council TEXT DEFAULT 'WCC',
            geom GEOMETRY(Point, 4326)
        );
    """)

    count = 0
    for f in features:
        attrs = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue
        wkt = point_wkt(geom)
        if not wkt:
            continue

        cur.execute("""
            INSERT INTO earthquake_prone_buildings (address, epbr_url, geom)
            VALUES (%s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
        """, (
            clean(attrs.get("Address")),
            clean(attrs.get("URL")),
            wkt,
        ))
        count += 1

    cur.execute("""
        CREATE INDEX idx_epb_geom ON earthquake_prone_buildings USING GIST (geom);
    """)
    print(f"  Inserted {count} earthquake-prone buildings")
    return count


# ============================================================
# Dataset 5: GWRC Resource Consents
# ============================================================
def load_resource_consents(cur):
    print("\n=== 5. GWRC Resource Consents ===")
    url = "https://mapping.gw.govt.nz/arcgis/rest/services/GW/Resource_Consents_P/MapServer/0"

    features, geom_type, sr = fetch_arcgis_features(url, max_per_page=1000)

    cur.execute("""
        DROP TABLE IF EXISTS resource_consents CASCADE;
        CREATE TABLE resource_consents (
            id SERIAL PRIMARY KEY,
            consent_id TEXT,
            file_no TEXT,
            consent_type TEXT,
            application_type TEXT,
            status TEXT,
            commencement_date TEXT,
            expired_date TEXT,
            purpose_desc TEXT,
            geom GEOMETRY(Point, 4326)
        );
    """)

    count = 0
    for f in features:
        attrs = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue
        wkt = point_wkt(geom)
        if not wkt:
            continue

        cur.execute("""
            INSERT INTO resource_consents
                (consent_id, file_no, consent_type, application_type,
                 status, commencement_date, expired_date, purpose_desc, geom)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
        """, (
            clean(attrs.get("Consent_ID") or attrs.get("ConsentID")),
            clean(attrs.get("RC_CON_FILENO")),
            clean(attrs.get("ConsentType") or attrs.get("ConsentTyp")),
            clean(attrs.get("RC_APT_DESC")),
            clean(attrs.get("RCstatus")),
            clean(attrs.get("commencement_date")),
            clean(attrs.get("ExpiredDate")),
            clean(attrs.get("Purpose_Desc")),
            wkt,
        ))
        count += 1

    cur.execute("""
        CREATE INDEX idx_rc_geom ON resource_consents USING GIST (geom);
        CREATE INDEX idx_rc_type ON resource_consents (consent_type);
        CREATE INDEX idx_rc_status ON resource_consents (status);
    """)
    print(f"  Inserted {count} resource consents")
    return count


# ============================================================
# Main
# ============================================================
def main():
    import sys
    # Pass --all to reload everything, otherwise skip already-loaded tables
    reload_all = "--all" in sys.argv

    with psycopg.connect(DB_CONN) as conn:
        with conn.cursor() as cur:
            counts = {}

            if reload_all:
                counts["district_plan_zones"] = load_district_plan_zones(cur)
                counts["height_controls"] = load_height_controls(cur)
            else:
                # Check if already loaded
                cur.execute("SELECT COUNT(*) FROM district_plan_zones")
                z = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM height_controls")
                h = cur.fetchone()[0]
                if z > 0:
                    counts["district_plan_zones"] = z
                    print(f"\n=== 1. district_plan_zones already loaded ({z} rows), skipping ===")
                else:
                    counts["district_plan_zones"] = load_district_plan_zones(cur)
                if h > 0:
                    counts["height_controls"] = h
                    print(f"\n=== 2. height_controls already loaded ({h} rows), skipping ===")
                else:
                    counts["height_controls"] = load_height_controls(cur)

            counts["contaminated_land"] = load_contaminated_land(cur)
            counts["earthquake_prone_buildings"] = load_earthquake_prone_buildings(cur)
            counts["resource_consents"] = load_resource_consents(cur)

            conn.commit()

            # Validation
            print("\n=== Validation ===")
            for table, expected in counts.items():
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                actual = cur.fetchone()[0]
                cur.execute(f"SELECT COUNT(*) FROM {table} WHERE geom IS NOT NULL")
                with_geom = cur.fetchone()[0]
                status = "OK" if actual == expected else "MISMATCH"
                print(f"  {table}: {actual} rows, {with_geom} with geometry [{status}]")

            # Test against Cuba Street
            print("\n=== Cuba Street test (162 Cuba Street, Te Aro) ===")
            cur.execute("""
                SELECT geom FROM addresses
                WHERE full_address ILIKE '%162 Cuba Street%Te Aro%'
                LIMIT 1
            """)
            addr_row = cur.fetchone()
            if addr_row:
                addr_geom = addr_row[0]

                # Zoning
                cur.execute("""
                    SELECT zone_name, zone_code
                    FROM district_plan_zones
                    WHERE ST_Intersects(geom, %s)
                """, (addr_geom,))
                zones = cur.fetchall()
                print(f"  Zoning: {zones}")

                # Height
                cur.execute("""
                    SELECT height_metres, zone_name
                    FROM height_controls
                    WHERE ST_Intersects(geom, %s)
                """, (addr_geom,))
                heights = cur.fetchall()
                print(f"  Height control: {heights}")

                # Contaminated land within 200m
                cur.execute("""
                    SELECT site_name, category,
                           ROUND(ST_Distance(geom::geography, %s::geography)::numeric) as dist_m
                    FROM contaminated_land
                    WHERE ST_DWithin(geom::geography, %s::geography, 200)
                    ORDER BY dist_m
                """, (addr_geom, addr_geom))
                contam = cur.fetchall()
                print(f"  Contaminated sites within 200m: {len(contam)}")
                for c in contam[:3]:
                    print(f"    {c[0]} | {c[1]} | {c[2]}m")

                # EPBs within 300m
                cur.execute("""
                    SELECT address,
                           ROUND(ST_Distance(geom::geography, %s::geography)::numeric) as dist_m
                    FROM earthquake_prone_buildings
                    WHERE geom && ST_Expand(%s, 0.005)
                      AND ST_DWithin(geom::geography, %s::geography, 300)
                    ORDER BY dist_m
                    LIMIT 5
                """, (addr_geom, addr_geom, addr_geom))
                epbs = cur.fetchall()
                print(f"  Earthquake-prone buildings within 300m: {len(epbs)}")
                for e in epbs[:3]:
                    print(f"    {e[0]} | {e[1]}m")

                # Resource consents within 300m (granted, land use)
                cur.execute("""
                    SELECT consent_type, status, purpose_desc,
                           ROUND(ST_Distance(geom::geography, %s::geography)::numeric) as dist_m
                    FROM resource_consents
                    WHERE geom && ST_Expand(%s, 0.005)
                      AND ST_DWithin(geom::geography, %s::geography, 300)
                      AND status = 'Granted'
                    ORDER BY dist_m
                    LIMIT 5
                """, (addr_geom, addr_geom, addr_geom))
                consents = cur.fetchall()
                print(f"  Granted resource consents within 300m: {len(consents)}")
                for c in consents[:3]:
                    print(f"    {c[0]} | {c[1]} | {c[2][:80] if c[2] else ''} | {c[3]}m")

    # Analyze all new tables
    with psycopg.connect(DB_CONN) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            for table in counts:
                cur.execute(f"ANALYZE {table}")
    print("\nAll tables analyzed. Done!")


if __name__ == "__main__":
    main()
