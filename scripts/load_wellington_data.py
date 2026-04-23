"""
Load Wellington-specific datasets into PostGIS.

Sources:
1. MBIE Earthquake-Prone Building Register (national, ~6k buildings)
2. GWRC Earthquake Hazards (4 layers: combined, ground shaking, liquefaction, slope failure)
3. WCC 2024 District Plan hazards (fault zones, flood, tsunami)
4. WCC Building Solar Radiation
5. Metlink GTFS stops (with route_type breakdown)

Run: python scripts/load_wellington_data.py [--all]
"""

import io
import json
import ssl
import time
import urllib.parse
import urllib.request
import zipfile
import csv
import psycopg

# SSL contexts
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
                ctx = SSL_CTX if attempt == 0 else SSL_CTX_NOVERIFY
                with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                break
            except ssl.SSLCertVerificationError:
                if attempt == 0:
                    print("    SSL cert issue, retrying without verification...")
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
    return all_features


def multipolygon_wkt(geometry):
    """Convert ArcGIS geometry to WKT MULTIPOLYGON."""
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


def table_has_rows(cur, table_name):
    """Check if a table exists and has rows."""
    try:
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        return cur.fetchone()[0] > 0
    except Exception:
        return False


# ============================================================
# 1. MBIE Earthquake-Prone Building Register
# ============================================================
def load_mbie_epb(cur):
    print("\n=== 1. MBIE Earthquake-Prone Buildings ===")
    base_url = "https://epbr.building.govt.nz/api/public/buildings"
    page_size = 20  # API always returns 20 regardless of param
    all_buildings = []
    page_index = 0

    while True:
        url = f"{base_url}?pageSize={page_size}&page={page_index}"
        if page_index % 50 == 0:
            print(f"  Fetching page {page_index}...")

        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={
                    "User-Agent": "WhareScore-POC/1.0",
                    "Accept": "application/json",
                })
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                break
            except Exception as e:
                if attempt < 2:
                    print(f"    Retry {attempt+1}: {e}")
                    time.sleep(3)
                else:
                    raise

        # API returns {results: [...], resultsTotal, pageIndex, pageSize}
        buildings = data.get("results", []) if isinstance(data, dict) else data
        if not buildings:
            break

        all_buildings.extend(buildings)
        page_index += 1

        if len(all_buildings) >= data.get("resultsTotal", 999999):
            break

        time.sleep(0.2)

    print(f"  Total buildings: {len(all_buildings)}")

    # Safety guard: if the fetch came back implausibly small we'd otherwise
    # flag ~every building as removed. 4000 floor is well under the observed
    # ~5900 register size but comfortably catches a truncated fetch.
    if len(all_buildings) < 4000:
        raise RuntimeError(
            f"MBIE EPB fetch returned only {len(all_buildings)} buildings, "
            "refusing to proceed (would mark the register as mass-delisted). "
            "Investigate the API before retrying."
        )

    # Soft-delete strategy: UPSERT everything we saw with last_seen_at = now,
    # then stamp removed_at on any row the sweep missed. See migration 0057.
    cur.execute("SELECT NOW()")
    load_started_at = cur.fetchone()[0]

    count = 0
    removed_by_mbie = 0
    for b in all_buildings:
        lat = b.get("latitude")
        lng = b.get("longitude")
        if lat is None or lng is None:
            continue

        try:
            lat = float(lat)
            lng = float(lng)
        except (ValueError, TypeError):
            continue

        bid = b.get("id")
        if not bid:
            continue

        # Address is nested: {address: {streetNumber, streetName, streetType, suburb, town}}
        addr = b.get("address", {}) if isinstance(b.get("address"), dict) else {}
        street_parts = [
            addr.get("unitType", ""), addr.get("unit", ""),
            addr.get("floor", ""), addr.get("streetNumber", ""),
            addr.get("streetAlpha", ""),
        ]
        street_num = " ".join(p for p in street_parts if p).strip()
        street_name_parts = [
            addr.get("streetName", ""), addr.get("streetType", ""),
            addr.get("streetDirection", ""),
        ]
        street_name = " ".join(p for p in street_name_parts if p).strip()
        address_line1 = f"{street_num} {street_name}".strip() if street_num or street_name else None

        notice_date = clean(b.get("noticeDate"))
        if notice_date:
            notice_date = notice_date[:10]

        deadline = clean(b.get("completionDeadline"))
        if deadline:
            deadline = deadline[:10]

        priority_val = b.get("priority")
        priority_str = "Priority" if priority_val else None
        has_been_removed = bool(b.get("hasBeenRemoved", False))

        cur.execute("""
            INSERT INTO mbie_epb_history
                (id, name, address_line1, address_line2, suburb, city, region,
                 earthquake_rating, heritage_status, construction_type,
                 design_date, priority, notice_date, completion_deadline,
                 issued_by, seismic_risk_area, geom,
                 first_seen_at, last_seen_at, removed_at,
                 has_been_removed, raw_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                %s, %s,
                CASE WHEN %s THEN %s ELSE NULL END,
                %s, %s::jsonb)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                address_line1 = EXCLUDED.address_line1,
                address_line2 = EXCLUDED.address_line2,
                suburb = EXCLUDED.suburb,
                city = EXCLUDED.city,
                region = EXCLUDED.region,
                earthquake_rating = EXCLUDED.earthquake_rating,
                heritage_status = EXCLUDED.heritage_status,
                construction_type = EXCLUDED.construction_type,
                design_date = EXCLUDED.design_date,
                priority = EXCLUDED.priority,
                notice_date = EXCLUDED.notice_date,
                completion_deadline = EXCLUDED.completion_deadline,
                issued_by = EXCLUDED.issued_by,
                seismic_risk_area = EXCLUDED.seismic_risk_area,
                geom = EXCLUDED.geom,
                last_seen_at = EXCLUDED.last_seen_at,
                has_been_removed = EXCLUDED.has_been_removed,
                raw_json = EXCLUDED.raw_json,
                -- Removal state is driven by MBIE's hasBeenRemoved flag.
                -- First time we see it true: stamp removed_at = now.
                -- If MBIE un-removes it: clear removed_at.
                -- Otherwise leave removed_at unchanged.
                removed_at = CASE
                    WHEN EXCLUDED.has_been_removed = FALSE THEN NULL
                    WHEN mbie_epb_history.removed_at IS NULL THEN EXCLUDED.last_seen_at
                    ELSE mbie_epb_history.removed_at
                END
        """, (
            bid,
            clean(b.get("name")),
            address_line1,
            None,  # address_line2 not in list endpoint
            clean(addr.get("suburb")),
            clean(addr.get("town")),
            None,  # region not in list endpoint
            clean(b.get("earthquakeRating")),
            clean(b.get("heritageStatus")),
            None,  # constructionType only in detail endpoint
            None,  # designDate only in detail endpoint
            priority_str,
            notice_date,
            deadline,
            clean(b.get("issuedBy")),
            None,  # seismicRiskArea only in detail endpoint
            lng, lat,
            load_started_at, load_started_at,
            has_been_removed, load_started_at,  # removed_at stamp if flagged
            has_been_removed,
            json.dumps(b),
        ))
        count += 1
        if has_been_removed:
            removed_by_mbie += 1

    # Backstop: if a row we have in the DB wasn't in MBIE's feed at all this
    # refresh, treat it as removed. hasBeenRemoved handles the normal case;
    # this catches rows MBIE purges entirely.
    cur.execute("""
        UPDATE mbie_epb_history
        SET removed_at = NOW()
        WHERE removed_at IS NULL
          AND has_been_removed = FALSE
          AND (last_seen_at IS NULL OR last_seen_at < %s)
    """, (load_started_at,))
    vanished = cur.rowcount

    print(f"  Upserted {count} rows ({removed_by_mbie} flagged hasBeenRemoved), "
          f"marked {vanished} as vanished from feed")
    return count


# ============================================================
# 2. GWRC Earthquake Hazard Layers
# ============================================================
GWRC_BASE = "https://mapping.gw.govt.nz/arcgis/rest/services/GW/Emergencies_P/MapServer"


def load_gwrc_earthquake_hazard(cur):
    print("\n=== 2a. GWRC Combined Earthquake Hazard ===")
    features = fetch_arcgis_features(f"{GWRC_BASE}/8")

    cur.execute("DELETE FROM gwrc_earthquake_hazard")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = multipolygon_wkt(geom)
        if not wkt:
            continue

        chi = a.get("CHI")
        chi_grade = a.get("CHI_HAZ_GR")
        try:
            chi = float(chi) if chi is not None else None
        except (ValueError, TypeError):
            chi = None
        try:
            chi_grade = int(chi_grade) if chi_grade is not None else None
        except (ValueError, TypeError):
            chi_grade = None

        cur.execute("""
            INSERT INTO gwrc_earthquake_hazard (chi, chi_hazard_grade, severity, geom)
            VALUES (%s, %s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
        """, (chi, chi_grade, clean(a.get("SEVERITY")), wkt))
        count += 1

    print(f"  Inserted {count} polygons")
    return count


def load_gwrc_ground_shaking(cur):
    print("\n=== 2b. GWRC Ground Shaking ===")
    features = fetch_arcgis_features(f"{GWRC_BASE}/9")

    cur.execute("DELETE FROM gwrc_ground_shaking")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = multipolygon_wkt(geom)
        if not wkt:
            continue

        cur.execute("""
            INSERT INTO gwrc_ground_shaking (zone, severity, geom)
            VALUES (%s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
        """, (clean(a.get("ZONE")), clean(a.get("SEVERITY")), wkt))
        count += 1

    print(f"  Inserted {count} polygons")
    return count


def load_gwrc_liquefaction(cur):
    print("\n=== 2c. GWRC Liquefaction ===")
    features = fetch_arcgis_features(f"{GWRC_BASE}/10")

    cur.execute("DELETE FROM gwrc_liquefaction")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = multipolygon_wkt(geom)
        if not wkt:
            continue

        cur.execute("""
            INSERT INTO gwrc_liquefaction (liquefaction, simplified, geom)
            VALUES (%s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
        """, (clean(a.get("Liquefaction")), clean(a.get("Simplified")), wkt))
        count += 1

    print(f"  Inserted {count} polygons")
    return count


def load_gwrc_slope_failure(cur):
    print("\n=== 2d. GWRC Slope Failure ===")
    features = fetch_arcgis_features(f"{GWRC_BASE}/11")

    cur.execute("DELETE FROM gwrc_slope_failure")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = multipolygon_wkt(geom)
        if not wkt:
            continue

        cur.execute("""
            INSERT INTO gwrc_slope_failure (lskey, severity, geom)
            VALUES (%s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
        """, (clean(a.get("LSKEY")), clean(a.get("SEVERITY")), wkt))
        count += 1

    print(f"  Inserted {count} polygons")
    return count


# ============================================================
# 3. WCC 2024 District Plan Hazard Layers
# ============================================================
WCC_DP_BASE = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer"


def load_wcc_fault_zones(cur):
    print("\n=== 3a. WCC Fault Zones ===")
    cur.execute("DELETE FROM wcc_fault_zones")
    count = 0

    for layer_id in [56, 57, 58, 59]:
        print(f"  Layer {layer_id}...")
        features = fetch_arcgis_features(f"{WCC_DP_BASE}/{layer_id}", max_per_page=2000)

        for f in features:
            a = f.get("attributes", {})
            geom = f.get("geometry")
            if not geom or not geom.get("rings"):
                continue
            wkt = multipolygon_wkt(geom)
            if not wkt:
                continue

            cur.execute("""
                INSERT INTO wcc_fault_zones
                    (name, hazard_ranking, fault_complexity, ri_class, layer_id, geom)
                VALUES (%s, %s, %s, %s, %s,
                    ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
            """, (
                clean(a.get("Name")),
                clean(a.get("DP_HazardRanking")),
                clean(a.get("Fault_Comp")),
                clean(a.get("RI_Class")),
                layer_id,
                wkt,
            ))
            count += 1

    print(f"  Inserted {count} fault zone polygons")
    return count


def load_wcc_flood_hazard(cur):
    print("\n=== 3b. WCC Flood Hazard ===")
    cur.execute("DELETE FROM wcc_flood_hazard")
    count = 0

    layers = [
        (61, "Inundation"),
        (62, "Overland Flowpath"),
        (63, "Stream Corridor"),
    ]

    for layer_id, hazard_type in layers:
        print(f"  Layer {layer_id} ({hazard_type})...")
        features = fetch_arcgis_features(f"{WCC_DP_BASE}/{layer_id}", max_per_page=2000)

        for f in features:
            a = f.get("attributes", {})
            geom = f.get("geometry")
            if not geom or not geom.get("rings"):
                continue
            wkt = multipolygon_wkt(geom)
            if not wkt:
                continue

            cur.execute("""
                INSERT INTO wcc_flood_hazard
                    (name, hazard_ranking, hazard_type, layer_id, geom)
                VALUES (%s, %s, %s, %s,
                    ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
            """, (
                clean(a.get("Name")),
                clean(a.get("DP_HazardRanking")),
                hazard_type,
                layer_id,
                wkt,
            ))
            count += 1

    print(f"  Inserted {count} flood hazard polygons")
    return count


def load_wcc_tsunami_hazard(cur):
    print("\n=== 3c. WCC Tsunami Hazard ===")
    cur.execute("DELETE FROM wcc_tsunami_hazard")
    count = 0

    layers = [
        (54, "1:100yr"),
        (53, "1:500yr"),
        (52, "1:1000yr"),
    ]

    for layer_id, return_period in layers:
        print(f"  Layer {layer_id} ({return_period})...")
        features = fetch_arcgis_features(f"{WCC_DP_BASE}/{layer_id}", max_per_page=2000)

        for f in features:
            a = f.get("attributes", {})
            geom = f.get("geometry")
            if not geom or not geom.get("rings"):
                continue
            wkt = multipolygon_wkt(geom)
            if not wkt:
                continue

            cur.execute("""
                INSERT INTO wcc_tsunami_hazard
                    (name, hazard_ranking, scenario, return_period, layer_id, geom)
                VALUES (%s, %s, %s, %s, %s,
                    ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))
            """, (
                clean(a.get("Name")),
                clean(a.get("DP_HazardRanking")),
                clean(a.get("Scenario")),
                return_period,
                layer_id,
                wkt,
            ))
            count += 1

    print(f"  Inserted {count} tsunami hazard polygons")
    return count


# ============================================================
# 4. WCC Building Solar Radiation
# ============================================================
def load_wcc_solar(cur):
    print("\n=== 4. WCC Building Solar Radiation ===")
    url = "https://services3.arcgis.com/zKATtxCTqU2pTs69/arcgis/rest/services/Solar_Potential_of_Wellington_Buildings_WFL1/FeatureServer/0"

    features = fetch_arcgis_features(url, max_per_page=2000)

    cur.execute("DELETE FROM wcc_solar_radiation")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = multipolygon_wkt(geom)
        if not wkt:
            continue

        mean_solar = a.get("MEAN_YEARLY_SOLAR")
        max_solar = a.get("MAX_YEARLY_SOLAR_")
        approx_height = a.get("APPROX_HEIGHT")

        try:
            mean_solar = float(mean_solar) if mean_solar is not None else None
        except (ValueError, TypeError):
            mean_solar = None
        try:
            max_solar = float(max_solar) if max_solar is not None else None
        except (ValueError, TypeError):
            max_solar = None
        try:
            approx_height = float(approx_height) if approx_height is not None else None
        except (ValueError, TypeError):
            approx_height = None

        # Solar data is in EPSG:3857 (Web Mercator)
        cur.execute("""
            INSERT INTO wcc_solar_radiation (mean_yearly_solar, max_yearly_solar, approx_height, geom)
            VALUES (%s, %s, %s,
                ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 3857), 4326))
        """, (mean_solar, max_solar, approx_height, wkt))
        count += 1

    print(f"  Inserted {count} building solar polygons")
    return count


# ============================================================
# 5. Metlink GTFS Stops
# ============================================================
def load_metlink_stops(cur):
    print("\n=== 5. Metlink GTFS Stops ===")
    gtfs_url = "https://static.opendata.metlink.org.nz/v1/gtfs/full.zip"

    print("  Downloading GTFS zip...")
    req = urllib.request.Request(gtfs_url, headers={"User-Agent": "WhareScore-POC/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        zip_data = resp.read()

    print(f"  Downloaded {len(zip_data) / 1024 / 1024:.1f} MB")

    # Parse stops.txt, stop_times.txt, trips.txt, routes.txt
    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        # Read stops
        with zf.open("stops.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            stops = {row["stop_id"]: row for row in reader}

        # Build stop_id → route_types mapping
        # routes.txt: route_id → route_type
        with zf.open("routes.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            route_types = {row["route_id"]: int(row["route_type"]) for row in reader}

        # trips.txt: trip_id → route_id
        with zf.open("trips.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            trip_route = {row["trip_id"]: row["route_id"] for row in reader}

        # stop_times.txt: stop_id → set of route_types
        stop_route_types = {}
        with zf.open("stop_times.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            for row in reader:
                sid = row["stop_id"]
                tid = row["trip_id"]
                rid = trip_route.get(tid)
                if rid:
                    rt = route_types.get(rid)
                    if rt is not None:
                        stop_route_types.setdefault(sid, set()).add(rt)

    print(f"  Parsed {len(stops)} stops, {len(stop_route_types)} with route info")

    cur.execute("DELETE FROM metlink_stops")
    count = 0
    for stop_id, stop in stops.items():
        lat = stop.get("stop_lat")
        lon = stop.get("stop_lon")
        if not lat or not lon:
            continue
        try:
            lat = float(lat)
            lon = float(lon)
        except (ValueError, TypeError):
            continue

        rts = sorted(stop_route_types.get(stop_id, []))

        cur.execute("""
            INSERT INTO metlink_stops (stop_id, stop_code, stop_name, zone_id, route_types, geom)
            VALUES (%s, %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            ON CONFLICT (stop_id) DO UPDATE SET
                stop_name = EXCLUDED.stop_name,
                route_types = EXCLUDED.route_types
        """, (
            stop_id,
            clean(stop.get("stop_code")),
            clean(stop.get("stop_name")),
            clean(stop.get("zone_id")),
            rts if rts else None,
            lon, lat,
        ))
        count += 1

    print(f"  Inserted {count} Metlink stops")
    return count


# ============================================================
# Main
# ============================================================
def main():
    import sys
    reload_all = "--all" in sys.argv

    with psycopg.connect(DB_CONN) as conn:
        with conn.cursor() as cur:
            counts = {}

            # Ensure tables exist (run DDL)
            print("Ensuring tables exist...")
            ddl_path = "sql/10-wellington-data.sql"
            try:
                with open(ddl_path) as f:
                    cur.execute(f.read())
                conn.commit()
                print("  Tables created/verified.")
            except Exception as e:
                print(f"  Note: DDL had issue ({e}), tables may already exist. Continuing...")
                conn.rollback()

            # Load each dataset (skip if already populated unless --all)
            loaders = [
                ("mbie_epb", load_mbie_epb),
                ("gwrc_earthquake_hazard", load_gwrc_earthquake_hazard),
                ("gwrc_ground_shaking", load_gwrc_ground_shaking),
                ("gwrc_liquefaction", load_gwrc_liquefaction),
                ("gwrc_slope_failure", load_gwrc_slope_failure),
                ("wcc_fault_zones", load_wcc_fault_zones),
                ("wcc_flood_hazard", load_wcc_flood_hazard),
                ("wcc_tsunami_hazard", load_wcc_tsunami_hazard),
                ("wcc_solar_radiation", load_wcc_solar),
                ("metlink_stops", load_metlink_stops),
            ]

            for table, loader in loaders:
                if not reload_all and table_has_rows(cur, table):
                    cur.execute(f"SELECT COUNT(*) FROM {table}")
                    n = cur.fetchone()[0]
                    print(f"\n=== {table} already loaded ({n} rows), skipping ===")
                    counts[table] = n
                else:
                    try:
                        counts[table] = loader(cur)
                        conn.commit()
                    except Exception as e:
                        print(f"  ERROR loading {table}: {e}")
                        conn.rollback()
                        counts[table] = 0

            # Validation
            print("\n=== Validation ===")
            for table in counts:
                try:
                    cur.execute(f"SELECT COUNT(*) FROM {table}")
                    actual = cur.fetchone()[0]
                    cur.execute(f"SELECT COUNT(*) FROM {table} WHERE geom IS NOT NULL")
                    with_geom = cur.fetchone()[0]
                    print(f"  {table}: {actual} rows, {with_geom} with geometry")
                except Exception as e:
                    print(f"  {table}: error — {e}")

    # Analyze
    with psycopg.connect(DB_CONN) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            for table in counts:
                try:
                    cur.execute(f"ANALYZE {table}")
                except Exception:
                    pass
    print("\nDone!")


if __name__ == "__main__":
    main()
