"""Run remaining national expansion data loaders directly."""
import json
import ssl
import time
import urllib.parse
import urllib.request

import psycopg

DB = "postgresql://postgres:postgres@localhost:5432/wharescore"

_SSL_CTX = ssl.create_default_context()
_SSL_NOVERIFY = ssl._create_unverified_context()


def _fetch_url(url, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": "WhareScore/1.0"})
    for attempt in range(3):
        try:
            ctx = _SSL_CTX if attempt == 0 else _SSL_NOVERIFY
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                return resp.read()
        except ssl.SSLCertVerificationError:
            if attempt == 0:
                continue
            raise
        except Exception as e:
            if attempt < 2:
                time.sleep(2)
                continue
            raise
    return b""


def _fetch_arcgis(base_url, max_per_page=1000):
    all_features = []
    offset = 0
    while True:
        params = {
            "where": "1=1", "outFields": "*", "f": "json",
            "returnGeometry": "true",
            "resultOffset": str(offset), "resultRecordCount": str(max_per_page),
        }
        url = base_url + "/query?" + urllib.parse.urlencode(params)
        data = json.loads(_fetch_url(url))
        features = data.get("features", [])
        if not features:
            break
        all_features.extend(features)
        offset += len(features)
        if len(features) < max_per_page:
            break
        time.sleep(0.3)
        print("  ...fetched %d so far" % len(all_features), flush=True)
    return all_features


def _fetch_arcgis_with_domains(base_url, max_per_page=1000):
    all_features = []
    offset = 0
    while True:
        params = {
            "where": "1=1", "outFields": "*", "f": "json",
            "returnGeometry": "true", "returnDomainValues": "true",
            "resultOffset": str(offset), "resultRecordCount": str(max_per_page),
        }
        url = base_url + "/query?" + urllib.parse.urlencode(params)
        data = json.loads(_fetch_url(url))
        features = data.get("features", [])
        if not features:
            break
        all_features.extend(features)
        offset += len(features)
        if len(features) < max_per_page:
            break
        time.sleep(0.3)
        print("  ...fetched %d so far" % len(all_features), flush=True)
    return all_features


def _clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _mp_wkt(geom):
    rings = geom.get("rings", [])
    if not rings:
        return None
    parts = []
    for ring in rings:
        coords = ", ".join("%s %s" % (p[0], p[1]) for p in ring)
        parts.append("((%s))" % coords)
    return "MULTIPOLYGON(%s)" % ", ".join(parts)


def _load_council_arcgis(conn, url, table, council, extra_cols, extract_fn):
    print("  Fetching from %s..." % url[:80], flush=True)
    features = _fetch_arcgis(url)
    print("  Downloaded %d features" % len(features), flush=True)
    cur = conn.cursor()
    cur.execute("DELETE FROM %s WHERE source_council = %%s" % table, (council,))
    count = 0
    errors = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        vals = extract_fn(a)
        col_names = ", ".join(extra_cols)
        placeholders = ", ".join(["%s"] * len(extra_cols))
        try:
            cur.execute(
                "INSERT INTO %s (%s, source_council, geom) "
                "VALUES (%s, %%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%%s), 2193), 4326))"
                % (table, col_names, placeholders),
                (*vals, council, wkt),
            )
            count += 1
        except Exception as e:
            conn.rollback()
            errors += 1
            if errors <= 3:
                print("  Error: %s" % e, flush=True)
    conn.commit()
    print("  Inserted %d rows into %s (source: %s), %d errors" % (count, table, council, errors), flush=True)
    return count


def record_load(conn, source, count):
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO data_versions (source, loaded_at, row_count) VALUES (%s, NOW(), %s) "
        "ON CONFLICT (source) DO UPDATE SET loaded_at = NOW(), row_count = %s",
        (source, count, count),
    )
    conn.commit()


def main():
    conn = psycopg.connect(DB)

    # 1. Auckland Coastal Inundation
    print("=== 1/4 Auckland Coastal Inundation ===", flush=True)
    total = 0
    scenarios = [
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Coastal_Inundation_5_yr_Return/FeatureServer/0",
         "5yr return", "Low"),
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Coastal_Inundation_18_1_1_5m_Sea_Level_Rise/FeatureServer/0",
         "18.1% + 1.5m SLR", "High"),
    ]
    for url, scenario, ranking in scenarios:
        count = _load_council_arcgis(
            conn, url, "coastal_inundation", "auckland",
            ["name", "hazard_ranking", "scenario"],
            lambda a, s=scenario, r=ranking: (
                _clean(a.get("Name")) or s,
                r,
                s,
            ),
        )
        total += count
    record_load(conn, "auckland_coastal", total)
    print("DONE: %d records\n" % total, flush=True)

    # 2. Auckland Landslide
    print("=== 2/4 Auckland Landslide Susceptibility ===", flush=True)
    total = 0
    layers = [
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Large_Scale_Landslide_Susceptibility/FeatureServer/0",
         "large_scale"),
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Shallow_Landslide_Susceptibility/FeatureServer/0",
         "shallow"),
    ]
    for url, analysis_type in layers:
        count = _load_council_arcgis(
            conn, url, "landslide_susceptibility", "auckland",
            ["accuracy", "type"],
            lambda a, at=analysis_type: (
                _clean(a.get("SusceptibilityValue")) or _clean(a.get("Confidence")),
                at,
            ),
        )
        total += count
    record_load(conn, "auckland_landslide", total)
    print("DONE: %d records\n" % total, flush=True)

    # 3. Auckland Plan Zones
    print("=== 3/4 Auckland Unitary Plan Zones ===", flush=True)
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Unitary_Plan_Base_Zone/FeatureServer/0"
    print("  Fetching...", flush=True)
    features = _fetch_arcgis_with_domains(url, 2000)
    print("  Downloaded %d features" % len(features), flush=True)
    council = "auckland"
    cur = conn.cursor()
    cur.execute("DELETE FROM district_plan_zones WHERE source_council = %s", (council,))
    count = 0
    errors = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        zone_name = _clean(a.get("ZONE")) or _clean(a.get("NAME"))
        group = _clean(a.get("GROUPZONE"))
        try:
            cur.execute(
                "INSERT INTO district_plan_zones (zone_name, zone_code, category, source_council, geom) "
                "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (zone_name, str(a.get("ZONE", "")), group, council, wkt),
            )
            count += 1
        except Exception as e:
            conn.rollback()
            errors += 1
            if errors <= 3:
                print("  Error: %s" % e, flush=True)
    conn.commit()
    record_load(conn, "auckland_plan_zones", count)
    print("DONE: %d records, %d errors\n" % (count, errors), flush=True)

    # 4. Final state
    print("=== 4/4 Final State Check ===", flush=True)
    cur = conn.cursor()
    tables = [
        "coastal_inundation", "landslide_susceptibility", "district_plan_zones",
        "flood_hazard", "liquefaction_detail", "active_faults", "fault_avoidance_zones",
    ]
    for t in tables:
        try:
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name=%s AND column_name='source_council'", (t,)
            )
            has_sc = cur.fetchone()
            if has_sc:
                cur.execute("SELECT source_council, COUNT(*) FROM %s GROUP BY source_council ORDER BY source_council" % t)
                rows = cur.fetchall()
                for c, n in rows:
                    print("  %s: %s = %s" % (t, c, "{:,}".format(n)))
                if not rows:
                    print("  %s: EMPTY" % t)
            else:
                cur.execute("SELECT COUNT(*) FROM %s" % t)
                n = cur.fetchone()[0]
                print("  %s: %s rows" % (t, "{:,}".format(n)))
        except Exception as e:
            print("  %s: ERROR %s" % (t, e))
            conn.rollback()

    conn.close()
    print("\nAll done!")


if __name__ == "__main__":
    main()
