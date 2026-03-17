"""
Data source loader — triggered from admin panel.

Each source is a self-contained loader function that:
1. Fetches data from an external API or file
2. Truncates + inserts into the target table(s)
3. Reports row count

Uses the same background job pattern as PDF export.
"""
from __future__ import annotations

import io
import csv
import json
import logging
import math
import ssl
import time
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from typing import Callable

import psycopg

from ..config import settings

logger = logging.getLogger(__name__)

# SSL contexts for GWRC (cert issues)
_SSL_CTX = ssl.create_default_context()
_SSL_NOVERIFY = ssl._create_unverified_context()


def _db_url_to_sync() -> str:
    """Get sync DATABASE_URL for psycopg."""
    url = settings.DATABASE_URL
    # Strip async driver prefix if present
    return url.replace("postgresql+asyncpg://", "postgresql://")


def _fetch_url(url: str, timeout: int = 60) -> bytes:
    """Fetch URL with SSL fallback."""
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


def _fetch_arcgis(base_url: str, max_per_page: int = 1000) -> list[dict]:
    """Fetch all features from ArcGIS REST with pagination."""
    all_features = []
    offset = 0
    while True:
        params = {
            "where": "1=1", "outFields": "*", "f": "json",
            "returnGeometry": "true",
            "resultOffset": str(offset), "resultRecordCount": str(max_per_page),
        }
        url = f"{base_url}/query?{urllib.parse.urlencode(params)}"
        data = json.loads(_fetch_url(url))
        features = data.get("features", [])
        if not features:
            break
        all_features.extend(features)
        offset += len(features)
        if len(features) < max_per_page:
            break
        time.sleep(0.3)
    return all_features


def _mp_wkt(geom: dict) -> str | None:
    """ArcGIS rings → WKT MULTIPOLYGON."""
    rings = geom.get("rings", [])
    if not rings:
        return None
    parts = []
    for ring in rings:
        coords = ", ".join(f"{p[0]} {p[1]}" for p in ring)
        parts.append(f"(({coords}))")
    return f"MULTIPOLYGON({', '.join(parts)})"


def _clean(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return None if s in ("", "None", "null", "Null") else s


# ═══════════════════════════════════════════════════════════════
# DATA SOURCE REGISTRY
# ═══════════════════════════════════════════════════════════════

DataSourceLoader = Callable[[psycopg.Connection, Callable[[str], None]], int]


class DataSource:
    def __init__(self, key: str, label: str, tables: list[str], loader: DataSourceLoader):
        self.key = key
        self.label = label
        self.tables = tables  # tables this source populates
        self.loader = loader


def _progress(log_fn, msg: str):
    """Log and report progress."""
    logger.info(msg)
    if log_fn:
        log_fn(msg)


# ── GWRC Earthquake Hazards ──────────────────────────────────

def load_gwrc_earthquake(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load all 4 GWRC earthquake hazard layers."""
    base = "https://mapping.gw.govt.nz/arcgis/rest/services/GW/Emergencies_P/MapServer"
    cur = conn.cursor()
    total = 0

    layers = [
        (8, "gwrc_earthquake_hazard", ["chi", "chi_hazard_grade", "severity"],
         lambda a: (_clean(a.get("CHI")), _clean(a.get("CHI_HAZ_GR")), _clean(a.get("SEVERITY")))),
        (9, "gwrc_ground_shaking", ["zone", "severity"],
         lambda a: (_clean(a.get("ZONE")), _clean(a.get("SEVERITY")))),
        (10, "gwrc_liquefaction", ["liquefaction", "simplified"],
         lambda a: (_clean(a.get("Liquefaction")), _clean(a.get("Simplified")))),
        (11, "gwrc_slope_failure", ["lskey", "severity"],
         lambda a: (_clean(a.get("LSKEY")), _clean(a.get("SEVERITY")))),
    ]

    for layer_id, table, cols, extract in layers:
        _progress(log, f"Fetching {table} (layer {layer_id})...")
        features = _fetch_arcgis(f"{base}/{layer_id}")
        cur.execute(f"TRUNCATE {table} RESTART IDENTITY")
        count = 0
        for f in features:
            a = f.get("attributes", {})
            geom = f.get("geometry")
            if not geom or not geom.get("rings"):
                continue
            wkt = _mp_wkt(geom)
            if not wkt:
                continue
            vals = extract(a)
            placeholders = ", ".join(["%s"] * len(cols))
            cur.execute(
                f"INSERT INTO {table} ({', '.join(cols)}, geom) "
                f"VALUES ({placeholders}, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (*vals, wkt),
            )
            count += 1
        total += count
        _progress(log, f"  {table}: {count} rows")

    conn.commit()
    return total


# ── WCC District Plan Hazards ────────────────────────────────

def load_wcc_hazards(conn: psycopg.Connection, log: Callable = None) -> int:
    base = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer"
    cur = conn.cursor()
    total = 0

    # Fault zones (layers 56-59)
    _progress(log, "Fetching WCC fault zones...")
    cur.execute("TRUNCATE wcc_fault_zones RESTART IDENTITY")
    for lid in [56, 57, 58, 59]:
        for f in _fetch_arcgis(f"{base}/{lid}", 2000):
            a = f.get("attributes", {})
            geom = f.get("geometry")
            if not geom or not geom.get("rings"):
                continue
            wkt = _mp_wkt(geom)
            if not wkt:
                continue
            cur.execute(
                "INSERT INTO wcc_fault_zones (name, hazard_ranking, fault_complexity, ri_class, layer_id, geom) "
                "VALUES (%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s),2193),4326))",
                (_clean(a.get("Name")), _clean(a.get("DP_HazardRanking")),
                 _clean(a.get("Fault_Comp")), _clean(a.get("RI_Class")), lid, wkt),
            )
            total += 1

    # Flood (layers 61-63)
    _progress(log, "Fetching WCC flood hazard...")
    cur.execute("TRUNCATE wcc_flood_hazard RESTART IDENTITY")
    for lid, htype in [(61, "Inundation"), (62, "Overland Flowpath"), (63, "Stream Corridor")]:
        for f in _fetch_arcgis(f"{base}/{lid}", 2000):
            a = f.get("attributes", {})
            geom = f.get("geometry")
            if not geom or not geom.get("rings"):
                continue
            wkt = _mp_wkt(geom)
            if not wkt:
                continue
            cur.execute(
                "INSERT INTO wcc_flood_hazard (name, hazard_ranking, hazard_type, layer_id, geom) "
                "VALUES (%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s),2193),4326))",
                (_clean(a.get("Name")), _clean(a.get("DP_HazardRanking")), htype, lid, wkt),
            )
            total += 1

    # Tsunami (layers 52-54)
    _progress(log, "Fetching WCC tsunami hazard...")
    cur.execute("TRUNCATE wcc_tsunami_hazard RESTART IDENTITY")
    for lid, rp in [(54, "1:100yr"), (53, "1:500yr"), (52, "1:1000yr")]:
        for f in _fetch_arcgis(f"{base}/{lid}", 2000):
            a = f.get("attributes", {})
            geom = f.get("geometry")
            if not geom or not geom.get("rings"):
                continue
            wkt = _mp_wkt(geom)
            if not wkt:
                continue
            cur.execute(
                "INSERT INTO wcc_tsunami_hazard (name, hazard_ranking, scenario, return_period, layer_id, geom) "
                "VALUES (%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s),2193),4326))",
                (_clean(a.get("Name")), _clean(a.get("DP_HazardRanking")),
                 _clean(a.get("Scenario")), rp, lid, wkt),
            )
            total += 1

    conn.commit()
    _progress(log, f"WCC hazards total: {total} rows")
    return total


# ── WCC Solar Radiation ──────────────────────────────────────

def load_wcc_solar(conn: psycopg.Connection, log: Callable = None) -> int:
    url = "https://services3.arcgis.com/zKATtxCTqU2pTs69/arcgis/rest/services/Solar_Potential_of_Wellington_Buildings_WFL1/FeatureServer/0"
    _progress(log, "Fetching WCC solar radiation...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("TRUNCATE wcc_solar_radiation RESTART IDENTITY")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        cur.execute(
            "INSERT INTO wcc_solar_radiation (mean_yearly_solar, max_yearly_solar, approx_height, geom) "
            "VALUES (%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s),3857),4326))",
            (_clean(a.get("MEAN_YEARLY_SOLAR")), _clean(a.get("MAX_YEARLY_SOLAR_")),
             _clean(a.get("APPROX_HEIGHT")), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Solar: {count} rows")
    return count


# ── Metlink GTFS + Travel Times ──────────────────────────────

KEY_DESTINATIONS = {
    "Wellington CBD": (174.7762, -41.2788),
    "Airport": (174.8050, -41.3272),
    "Hospital": (174.7780, -41.3045),
    "Victoria University": (174.7668, -41.2868),
    "Lower Hutt": (174.9070, -41.2095),
    "Petone": (174.8850, -41.2270),
    "Johnsonville": (174.8060, -41.2240),
    "Porirua": (174.8390, -41.1340),
    "Courtenay Place": (174.7830, -41.2930),
    "Newtown": (174.7790, -41.3070),
    "Kilbirnie": (174.7990, -41.3170),
    "Miramar": (174.8160, -41.3200),
}


def _haversine(lon1, lat1, lon2, lat2):
    R = 6371000
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + \
        math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 2 * R * math.asin(math.sqrt(a))


def _time_secs(t: str) -> int:
    parts = t.split(":")
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])


def load_metlink_gtfs(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load Metlink stops + compute travel times to key destinations."""
    _progress(log, "Downloading Metlink GTFS...")
    zip_data = _fetch_url("https://static.opendata.metlink.org.nz/v1/gtfs/full.zip", timeout=120)
    _progress(log, f"  Downloaded {len(zip_data) / 1024 / 1024:.1f} MB")

    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        # Parse stops
        with zf.open("stops.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            stops = {}
            for row in reader:
                try:
                    stops[row["stop_id"]] = {
                        "name": row["stop_name"], "code": row.get("stop_code"),
                        "lat": float(row["stop_lat"]), "lon": float(row["stop_lon"]),
                        "zone_id": row.get("zone_id"),
                    }
                except (ValueError, KeyError):
                    continue

        # Routes
        with zf.open("routes.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            route_info = {r["route_id"]: {"name": r["route_short_name"], "type": int(r["route_type"])} for r in reader}

        # Trips
        with zf.open("trips.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            trip_route = {r["trip_id"]: r["route_id"] for r in reader}

        # Stop-route mapping
        stop_route_types = defaultdict(set)
        trip_stops = defaultdict(list)
        _progress(log, "Parsing stop_times...")
        with zf.open("stop_times.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            for row in reader:
                tid = row["trip_id"]
                sid = row["stop_id"]
                rid = trip_route.get(tid)
                if rid:
                    rt = route_info.get(rid, {}).get("type")
                    if rt is not None:
                        stop_route_types[sid].add(rt)
                trip_stops[tid].append((int(row["stop_sequence"]), sid, _time_secs(row["arrival_time"])))

        for tid in trip_stops:
            trip_stops[tid].sort()

    cur = conn.cursor()

    # Insert stops
    _progress(log, f"Inserting {len(stops)} stops...")
    cur.execute("TRUNCATE metlink_stops RESTART IDENTITY")
    stop_count = 0
    for sid, s in stops.items():
        rts = sorted(stop_route_types.get(sid, []))
        cur.execute(
            "INSERT INTO metlink_stops (stop_id, stop_code, stop_name, zone_id, route_types, geom) "
            "VALUES (%s,%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s),4326)) "
            "ON CONFLICT (stop_id) DO UPDATE SET stop_name=EXCLUDED.stop_name, route_types=EXCLUDED.route_types",
            (sid, s.get("code"), s["name"], s.get("zone_id"), rts or None, s["lon"], s["lat"]),
        )
        stop_count += 1

    # Compute travel times
    _progress(log, "Computing travel times...")
    dest_stops = {}
    for dname, (dlon, dlat) in KEY_DESTINATIONS.items():
        dest_stops[dname] = {sid for sid, s in stops.items() if _haversine(dlon, dlat, s["lon"], s["lat"]) <= 400}

    travel_times = defaultdict(lambda: defaultdict(lambda: {"min": 9999, "routes": set()}))
    for tid, seq in trip_stops.items():
        rid = trip_route.get(tid)
        rinfo = route_info.get(rid, {})
        rname = rinfo.get("name", "?")
        mode = {2: "train", 3: "bus", 4: "ferry", 5: "cable car"}.get(rinfo.get("type", 3), "bus")
        stop_times = {sid: arr for _, sid, arr in seq}
        for dname, dsids in dest_stops.items():
            darrs = [stop_times[d] for d in dsids if d in stop_times]
            if not darrs:
                continue
            darr = min(darrs)
            for _, sid, arr in seq:
                if arr >= darr:
                    break
                mins = (darr - arr) / 60
                if mins < 1:
                    continue
                entry = travel_times[sid][dname]
                if mins < entry["min"]:
                    entry["min"] = mins
                    entry["routes"] = {f"{rname} ({mode})"}
                elif mins == entry["min"]:
                    entry["routes"].add(f"{rname} ({mode})")

    # Insert travel times
    cur.execute("TRUNCATE transit_travel_times RESTART IDENTITY")
    tt_count = 0
    for sid, dests in travel_times.items():
        for dname, info in dests.items():
            if info["min"] >= 9999:
                continue
            cur.execute(
                "INSERT INTO transit_travel_times (stop_id, destination, min_minutes, route_names) "
                "VALUES (%s,%s,%s,%s) ON CONFLICT (stop_id, destination) DO UPDATE SET "
                "min_minutes=EXCLUDED.min_minutes, route_names=EXCLUDED.route_names",
                (sid, dname, round(info["min"], 1), sorted(info["routes"])),
            )
            tt_count += 1

    # Peak frequency
    _progress(log, "Computing peak frequency...")
    stop_peak = defaultdict(set)
    for tid, seq in trip_stops.items():
        for _, sid, arr in seq:
            if 7 * 3600 <= arr <= 9 * 3600:
                stop_peak[sid].add(tid)

    cur.execute("TRUNCATE transit_stop_frequency")
    for sid, trips in stop_peak.items():
        cur.execute(
            "INSERT INTO transit_stop_frequency (stop_id, peak_trips_per_hour) VALUES (%s,%s) "
            "ON CONFLICT (stop_id) DO UPDATE SET peak_trips_per_hour=EXCLUDED.peak_trips_per_hour",
            (sid, round(len(trips) / 2, 1)),
        )

    conn.commit()
    _progress(log, f"Metlink: {stop_count} stops, {tt_count} travel times")
    return stop_count + tt_count


# ── Tier 4: Contaminated Land, EPBs, Resource Consents ───────

def load_contaminated_land(conn: psycopg.Connection, log: Callable = None) -> int:
    """GWRC Contaminated Land (SLUR)."""
    url = "https://mapping.gw.govt.nz/arcgis/rest/services/GW/Our_Environment_P/MapServer/39"
    _progress(log, "Fetching GWRC contaminated land...")
    features = _fetch_arcgis(url)
    cur = conn.cursor()
    cur.execute("TRUNCATE contaminated_land RESTART IDENTITY")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        cur.execute(
            "INSERT INTO contaminated_land "
            "(site_id, site_name, file_no, anzecc_category, anzecc_subcategory, "
            "category, street_number, street_name, local_authority, legal_description, site_history, geom) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, "
            "ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (_clean(a.get("SITEID")), _clean(a.get("SITENAME")), _clean(a.get("FILENO")),
             _clean(a.get("ANZECC")), _clean(a.get("ANZECCSUB")), _clean(a.get("CATEGORY")),
             _clean(a.get("STREET_NUMBER")), _clean(a.get("STREET_NAME")),
             _clean(a.get("LA_NAME")), _clean(a.get("LEGAL_DESCRIPTION")),
             _clean(a.get("SITE_HISTORY")), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Contaminated land: {count} rows")
    return count


def load_earthquake_prone_buildings(conn: psycopg.Connection, log: Callable = None) -> int:
    """WCC Earthquake-Prone Buildings."""
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/ForwardWorks/ForwardWorks/MapServer/20"
    _progress(log, "Fetching WCC earthquake-prone buildings...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("TRUNCATE earthquake_prone_buildings RESTART IDENTITY")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue
        x, y = geom.get("x"), geom.get("y")
        if x is None or y is None:
            continue
        cur.execute(
            "INSERT INTO earthquake_prone_buildings (address, epbr_url, geom) "
            "VALUES (%s, %s, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 2193), 4326))",
            (_clean(a.get("Address")), _clean(a.get("URL")), x, y),
        )
        count += 1
    conn.commit()
    _progress(log, f"EPBs: {count} rows")
    return count


def load_resource_consents(conn: psycopg.Connection, log: Callable = None) -> int:
    """GWRC Resource Consents."""
    url = "https://mapping.gw.govt.nz/arcgis/rest/services/GW/Resource_Consents_P/MapServer/0"
    _progress(log, "Fetching GWRC resource consents...")
    features = _fetch_arcgis(url)
    cur = conn.cursor()
    cur.execute("TRUNCATE resource_consents RESTART IDENTITY")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue
        x, y = geom.get("x"), geom.get("y")
        if x is None or y is None:
            continue
        cur.execute(
            "INSERT INTO resource_consents "
            "(consent_id, file_no, consent_type, application_type, status, "
            "commencement_date, expired_date, purpose_desc, geom) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s, "
            "ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 2193), 4326))",
            (_clean(a.get("Consent_ID") or a.get("ConsentID")),
             _clean(a.get("RC_CON_FILENO")),
             _clean(a.get("ConsentType") or a.get("ConsentTyp")),
             _clean(a.get("RC_APT_DESC")),
             _clean(a.get("RCstatus")),
             _clean(a.get("commencement_date")),
             _clean(a.get("ExpiredDate")),
             _clean(a.get("Purpose_Desc")),
             x, y),
        )
        count += 1
    conn.commit()
    _progress(log, f"Resource consents: {count} rows")
    return count


def load_district_plan_zones(conn: psycopg.Connection, log: Callable = None) -> int:
    """WCC 2024 District Plan Zones."""
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/122"
    _progress(log, "Fetching WCC district plan zones...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("TRUNCATE district_plan_zones RESTART IDENTITY")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        cur.execute(
            "INSERT INTO district_plan_zones (zone_name, zone_code, category, chapter, eplan_url, status, geom) "
            "VALUES (%s,%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (_clean(a.get("DPZone")), _clean(a.get("DPZoneCode")), _clean(a.get("Category")),
             _clean(a.get("DP_Chapter")), _clean(a.get("ePlan_URL")), _clean(a.get("Status")), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"District plan zones: {count} rows")
    return count


def load_height_controls(conn: psycopg.Connection, log: Callable = None) -> int:
    """WCC Height Control Areas."""
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/124"
    _progress(log, "Fetching WCC height controls...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("TRUNCATE height_controls RESTART IDENTITY")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        height = a.get("HeightControl_Metres")
        try:
            height = float(height) if height is not None else None
        except (ValueError, TypeError):
            height = None
        cur.execute(
            "INSERT INTO height_controls (height_metres, zone_name, zone_code, name, label, notes, geom) "
            "VALUES (%s,%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (height, _clean(a.get("DPZone")), _clean(a.get("DPZoneCode")),
             _clean(a.get("Name")), _clean(a.get("Label")), _clean(a.get("Notes")), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Height controls: {count} rows")
    return count


# ═══════════════════════════════════════════════════════════════
# REGISTRY
# ═══════════════════════════════════════════════════════════════

DATA_SOURCES: list[DataSource] = [
    # Wellington-specific (new)
    DataSource(
        "gwrc_earthquake", "GWRC Earthquake Hazards",
        ["gwrc_earthquake_hazard", "gwrc_ground_shaking", "gwrc_liquefaction", "gwrc_slope_failure"],
        load_gwrc_earthquake,
    ),
    DataSource(
        "wcc_hazards", "WCC District Plan Hazards",
        ["wcc_fault_zones", "wcc_flood_hazard", "wcc_tsunami_hazard"],
        load_wcc_hazards,
    ),
    DataSource(
        "wcc_solar", "WCC Solar Radiation",
        ["wcc_solar_radiation"],
        load_wcc_solar,
    ),
    DataSource(
        "metlink_gtfs", "Metlink GTFS + Travel Times",
        ["metlink_stops", "transit_travel_times", "transit_stop_frequency"],
        load_metlink_gtfs,
    ),
    # Core data (existing — from ArcGIS APIs)
    DataSource(
        "contaminated_land", "GWRC Contaminated Land (SLUR)",
        ["contaminated_land"],
        load_contaminated_land,
    ),
    DataSource(
        "epb_wcc", "WCC Earthquake-Prone Buildings",
        ["earthquake_prone_buildings"],
        load_earthquake_prone_buildings,
    ),
    DataSource(
        "resource_consents", "GWRC Resource Consents",
        ["resource_consents"],
        load_resource_consents,
    ),
    DataSource(
        "district_plan", "WCC District Plan Zones",
        ["district_plan_zones"],
        load_district_plan_zones,
    ),
    DataSource(
        "height_controls", "WCC Height Controls",
        ["height_controls"],
        load_height_controls,
    ),
]

DATA_SOURCES_BY_KEY = {s.key: s for s in DATA_SOURCES}


def run_loader(source_key: str, progress_callback: Callable[[str], None] | None = None) -> dict:
    """Run a data source loader synchronously. Returns {rows, tables, error}."""
    source = DATA_SOURCES_BY_KEY.get(source_key)
    if not source:
        return {"rows": 0, "tables": [], "error": f"Unknown source: {source_key}"}

    db_url = _db_url_to_sync()
    try:
        conn = psycopg.connect(db_url)
        rows = source.loader(conn, progress_callback)
        # Update data_versions tracking
        try:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO data_versions (source, row_count)
                VALUES (%s, %s)
                ON CONFLICT (source) DO UPDATE SET
                    loaded_at = now(), row_count = EXCLUDED.row_count
            """, (source_key, rows))
            conn.commit()
        except Exception:
            pass  # data_versions table might not exist yet
        conn.close()
        return {"rows": rows, "tables": source.tables, "error": None}
    except Exception as e:
        logger.exception(f"Data loader failed for {source_key}")
        return {"rows": 0, "tables": source.tables, "error": str(e)}
