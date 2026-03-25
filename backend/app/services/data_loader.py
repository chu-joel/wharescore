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


def _fetch_url(url: str, timeout: int = 120) -> bytes:
    """Fetch URL with SSL fallback (dev only — prod always verifies)."""
    req = urllib.request.Request(url, headers={"User-Agent": "WhareScore/1.0"})
    for attempt in range(4):
        try:
            ctx = _SSL_CTX if attempt == 0 else _SSL_NOVERIFY
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                return resp.read()
        except ssl.SSLCertVerificationError:
            if settings.ENVIRONMENT == "production":
                logger.error(f"SSL verification failed for {url} — refusing in production")
                raise
            if attempt == 0:
                logger.error(f"SSL verification failed for {url} — using unverified (dev only)")
                continue
            raise
        except (TimeoutError, urllib.error.URLError) as e:
            if attempt < 3:
                wait = (attempt + 1) * 5
                logger.warning(f"Timeout/error fetching {url} (attempt {attempt+1}/4), retrying in {wait}s: {e}")
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            if attempt < 3:
                time.sleep(3)
                continue
            raise
    return b""


def _fetch_arcgis(base_url: str, max_per_page: int = 1000, where: str = "1=1"):
    """Fetch all features from ArcGIS REST with pagination (streaming generator).

    Yields features one at a time — constant memory regardless of dataset size.
    Callers iterate with ``for f in _fetch_arcgis(...):`` exactly as before.
    """
    offset = 0
    while True:
        params = {
            "where": where, "outFields": "*", "f": "json",
            "returnGeometry": "true",
            "resultOffset": str(offset), "resultRecordCount": str(max_per_page),
        }
        url = f"{base_url}/query?{urllib.parse.urlencode(params)}"
        data = json.loads(_fetch_url(url))
        features = data.get("features", [])
        if not features:
            break
        yield from features
        offset += len(features)
        if len(features) < max_per_page:
            break
        time.sleep(0.3)


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


def _ml_wkt(geom: dict) -> str | None:
    """ArcGIS paths → WKT MULTILINESTRING."""
    paths = geom.get("paths", [])
    if not paths:
        return None
    parts = []
    for path in paths:
        coords = ", ".join(f"{p[0]} {p[1]}" for p in path)
        parts.append(f"({coords})")
    return f"MULTILINESTRING({', '.join(parts)})"


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
        (8, "earthquake_hazard", ["chi", "chi_hazard_grade", "severity"],
         lambda a: (_clean(a.get("CHI")), _clean(a.get("CHI_HAZ_GR")), _clean(a.get("SEVERITY")))),
        (9, "ground_shaking", ["zone", "severity"],
         lambda a: (_clean(a.get("ZONE")), _clean(a.get("SEVERITY")))),
        (10, "liquefaction_detail", ["liquefaction", "simplified"],
         lambda a: (_clean(a.get("Liquefaction")), _clean(a.get("Simplified")))),
        (11, "slope_failure", ["lskey", "severity"],
         lambda a: (_clean(a.get("LSKEY")), _clean(a.get("SEVERITY")))),
    ]

    council = "greater_wellington"
    for layer_id, table, cols, extract in layers:
        _progress(log, f"Fetching {table} (layer {layer_id})...")
        features = _fetch_arcgis(f"{base}/{layer_id}")
        cur.execute(f"DELETE FROM {table} WHERE source_council = %s", (council,))
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
                f"INSERT INTO {table} ({', '.join(cols)}, source_council, geom) "
                f"VALUES ({placeholders}, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (*vals, council, wkt),
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

    council = "wellington_city"

    # Fault zones (layers 56-59)
    _progress(log, "Fetching WCC fault zones...")
    cur.execute("DELETE FROM fault_zones WHERE source_council = %s", (council,))
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
                "INSERT INTO fault_zones (name, hazard_ranking, fault_complexity, ri_class, layer_id, source_council, geom) "
                "VALUES (%s,%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s),2193),4326))",
                (_clean(a.get("Name")), _clean(a.get("DP_HazardRanking")),
                 _clean(a.get("Fault_Comp")), _clean(a.get("RI_Class")), lid, council, wkt),
            )
            total += 1

    # Flood (layers 61-63)
    _progress(log, "Fetching WCC flood hazard...")
    cur.execute("DELETE FROM flood_hazard WHERE source_council = %s", (council,))
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
                "INSERT INTO flood_hazard (name, hazard_ranking, hazard_type, layer_id, source_council, geom) "
                "VALUES (%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s),2193),4326))",
                (_clean(a.get("Name")), _clean(a.get("DP_HazardRanking")), htype, lid, council, wkt),
            )
            total += 1

    # Tsunami (layers 52-54)
    _progress(log, "Fetching WCC tsunami hazard...")
    cur.execute("DELETE FROM tsunami_hazard WHERE source_council = %s", (council,))
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
                "INSERT INTO tsunami_hazard (name, hazard_ranking, scenario, return_period, layer_id, source_council, geom) "
                "VALUES (%s,%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s),2193),4326))",
                (_clean(a.get("Name")), _clean(a.get("DP_HazardRanking")),
                 _clean(a.get("Scenario")), rp, lid, council, wkt),
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

    # Compute travel times for morning (7–9 AM) and evening (4:30–6:30 PM) peak
    # Uses median travel time across peak trips for realistic commute estimates
    AM_START = 7 * 3600          # 7:00 AM
    AM_END = 9 * 3600            # 9:00 AM
    PM_START = 16 * 3600 + 1800  # 4:30 PM
    PM_END = 18 * 3600 + 1800    # 6:30 PM

    # Exclude night/after-midnight routes (e.g. N1, N6, N66, N88)
    night_route_ids = {rid for rid, info in route_info.items() if info.get("name", "").upper().startswith("N") and info.get("name", "")[1:].isdigit()}
    _progress(log, f"Excluding {len(night_route_ids)} night routes")

    _progress(log, "Computing travel times (AM + PM peak)...")
    dest_stops = {}
    for dname, (dlon, dlat) in KEY_DESTINATIONS.items():
        dest_stops[dname] = {sid for sid, s in stops.items() if _haversine(dlon, dlat, s["lon"], s["lat"]) <= 400}

    def _in_peak(secs: int) -> str | None:
        """Return peak window name or None if outside both peaks."""
        if AM_START <= secs <= AM_END:
            return "am"
        if PM_START <= secs <= PM_END:
            return "pm"
        return None

    # Collect peak-hour travel times per (stop, destination, peak_window)
    travel_samples = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"times": [], "routes": set()})))
    for tid, seq in trip_stops.items():
        rid = trip_route.get(tid)
        if rid in night_route_ids:
            continue
        rinfo = route_info.get(rid, {})
        rname = rinfo.get("name", "?")
        mode = {2: "train", 3: "bus", 4: "ferry", 5: "cable car"}.get(rinfo.get("type", 3), "bus")
        stop_times_map = {sid: arr for _, sid, arr in seq}
        for dname, dsids in dest_stops.items():
            darrs = [stop_times_map[d] for d in dsids if d in stop_times_map]
            if not darrs:
                continue
            darr = min(darrs)
            for _, sid, arr in seq:
                if arr >= darr:
                    break
                peak = _in_peak(arr)
                if peak is None:
                    continue
                mins = (darr - arr) / 60
                if mins < 1:
                    continue
                entry = travel_samples[sid][dname][peak]
                entry["times"].append(mins)
                entry["routes"].add(f"{rname} ({mode})")

    # Insert travel times — use median of peak-hour trips, one row per (stop, dest, window)
    cur.execute("TRUNCATE transit_travel_times RESTART IDENTITY")
    # Add peak_window column if missing (backward-compat)
    cur.execute("""
        DO $$ BEGIN
            ALTER TABLE transit_travel_times ADD COLUMN peak_window text NOT NULL DEFAULT 'am';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$
    """)
    # Drop old unique constraint and create new one including peak_window
    cur.execute("""
        DO $$ BEGIN
            ALTER TABLE transit_travel_times DROP CONSTRAINT IF EXISTS transit_travel_times_stop_id_destination_key;
            CREATE UNIQUE INDEX IF NOT EXISTS transit_travel_times_stop_dest_peak
                ON transit_travel_times (stop_id, destination, peak_window);
        EXCEPTION WHEN others THEN NULL;
        END $$
    """)
    tt_count = 0
    for sid, dests in travel_samples.items():
        for dname, windows in dests.items():
            for peak, info in windows.items():
                times = sorted(info["times"])
                if not times:
                    continue
                # Median travel time
                mid = len(times) // 2
                median_mins = times[mid] if len(times) % 2 == 1 else (times[mid - 1] + times[mid]) / 2
                cur.execute(
                    "INSERT INTO transit_travel_times (stop_id, destination, min_minutes, route_names, peak_window) "
                    "VALUES (%s,%s,%s,%s,%s)",
                    (sid, dname, round(median_mins, 1), sorted(info["routes"]), peak),
                )
                tt_count += 1

    # Peak frequency (AM peak only for the services/hr stat)
    _progress(log, "Computing peak frequency...")
    stop_peak = defaultdict(set)
    for tid, seq in trip_stops.items():
        rid = trip_route.get(tid)
        if rid in night_route_ids:
            continue
        for _, sid, arr in seq:
            if AM_START <= arr <= AM_END:
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


def _load_ecan_consents(conn: psycopg.Connection, log: Callable = None) -> int:
    """ECan (Canterbury) resource consents — ~115K active consents."""
    url = "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Resource_Consents/MapServer/0"
    _progress(log, "Fetching ECan resource consents (Canterbury)...")
    features = _fetch_arcgis(url, 2000, where="1=1")
    cur = conn.cursor()
    # Don't truncate — append alongside GWRC consents. Delete ECan rows (CRC prefix).
    cur.execute("DELETE FROM resource_consents WHERE consent_id LIKE 'CRC%' OR consent_id LIKE 'RC%'")
    conn.commit()
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
            (_clean(a.get("ConsentNo")),
             _clean(a.get("FileNo")),
             _clean(a.get("ConsentType")),
             _clean(a.get("PermitType")),
             _clean(a.get("ConsentStatus")),
             _clean(a.get("fmDateText")),
             _clean(a.get("toDateText")),
             _clean(a.get("ActivityText")),
             x, y),
        )
        count += 1
        if count % 5000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"ECan resource consents: {count} rows")
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


# ── GWRC Landslide (Layer 21) ─────────────────────────────────

def load_gwrc_landslide(conn: psycopg.Connection, log: Callable = None) -> int:
    """GWRC Layer 21 — GNS QMap landslide polylines."""
    url = "https://mapping.gw.govt.nz/arcgis/rest/services/GW/Emergencies_P/MapServer/21"
    council = "greater_wellington"
    _progress(log, "Fetching GWRC landslide (Layer 21)...")
    features = _fetch_arcgis(url)
    cur = conn.cursor()
    cur.execute("DELETE FROM landslide_susceptibility WHERE source_council = %s", (council,))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("paths"):
            continue
        wkt = _ml_wkt(geom)
        if not wkt:
            continue
        cur.execute(
            "INSERT INTO landslide_susceptibility (accuracy, type, source_council, geom) "
            "VALUES (%s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (_clean(a.get("ACCURACY")), _clean(a.get("TYPE")), council, wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"GWRC landslide: {count} rows")
    return count


# ── GWRC Coastal Elevation ────────────────────────────────────

def load_coastal_elevation(conn: psycopg.Connection, log: Callable = None) -> int:
    """GWRC Coastal elevation (cm above MHWS10)."""
    url = "https://mapping.gw.govt.nz/arcgis/rest/services/Hazards/Coastal_elevation/MapServer/0"
    _progress(log, "Fetching GWRC coastal elevation...")
    features = _fetch_arcgis(url)
    cur = conn.cursor()
    cur.execute("TRUNCATE coastal_elevation RESTART IDENTITY")
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
            "INSERT INTO coastal_elevation (gridcode, geom) "
            "VALUES (%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (a.get("gridcode"), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Coastal elevation: {count} rows")
    return count


# ── GWRC Flood Hazard Extents (regional) ─────────────────────

def load_gwrc_flood_extents(conn: psycopg.Connection, log: Callable = None) -> int:
    """GWRC regional flood extents — 2%, 1%, 0.23% AEP."""
    base = "https://mapping.gw.govt.nz/arcgis/rest/services/Flood_Hazard_Extents_P/MapServer"
    council = "greater_wellington"
    cur = conn.cursor()
    cur.execute("DELETE FROM flood_extent WHERE source_council = %s", (council,))
    total = 0
    for lid, aep in [(3, "2%"), (4, "1%"), (5, "0.23%")]:
        _progress(log, f"Fetching {aep} AEP flood extent (layer {lid})...")
        features = _fetch_arcgis(f"{base}/{lid}")
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
                "INSERT INTO flood_extent (aep, label, title, description, hectares, source_council, geom) "
                "VALUES (%s,%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (aep, _clean(a.get("Label")), _clean(a.get("Title")),
                 _clean(a.get("Description")), a.get("Hectares"), council, wkt),
            )
            count += 1
        total += count
        _progress(log, f"  {aep} AEP: {count} rows")
    conn.commit()
    _progress(log, f"GWRC flood extents total: {total} rows")
    return total


# ── WCC Corrosion Zones ──────────────────────────────────────

def load_corrosion_zones(conn: psycopg.Connection, log: Callable = None) -> int:
    """WCC Corrosion zones (500m coastal buffer)."""
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/Environment/CorrosionZones/MapServer/0"
    _progress(log, "Fetching WCC corrosion zones...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("TRUNCATE corrosion_zones RESTART IDENTITY")
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
            "INSERT INTO corrosion_zones (contour, buff_dist, geom) "
            "VALUES (%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (_clean(a.get("CONTOUR")), a.get("BUFF_DIST"), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Corrosion zones: {count} rows")
    return count


# ── WCC Viewshafts ───────────────────────────────────────────

def load_viewshafts(conn: psycopg.Connection, log: Callable = None) -> int:
    """WCC District Plan viewshafts."""
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/76"
    _progress(log, "Fetching WCC viewshafts...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("TRUNCATE viewshafts RESTART IDENTITY")
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
            "INSERT INTO viewshafts (dp_ref, name, description, significance, focal_elements, geom) "
            "VALUES (%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (_clean(a.get("DPRef")), _clean(a.get("Name")), _clean(a.get("Description")),
             _clean(a.get("Significance")), _clean(a.get("FocalElements")), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Viewshafts: {count} rows")
    return count


# ── WCC Character Precincts ──────────────────────────────────

def load_character_precincts(conn: psycopg.Connection, log: Callable = None) -> int:
    """WCC District Plan character precincts."""
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/94"
    _progress(log, "Fetching WCC character precincts...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("TRUNCATE character_precincts RESTART IDENTITY")
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
            "INSERT INTO character_precincts (name, type, code, zone_name, zone_code, description, geom) "
            "VALUES (%s,%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (_clean(a.get("Name")), _clean(a.get("Type")), _clean(a.get("Code")),
             _clean(a.get("DPZone")), _clean(a.get("DPZoneCode")),
             _clean(a.get("Description")), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Character precincts: {count} rows")
    return count


# ── WCC Coastal Inundation ───────────────────────────────────

def load_coastal_inundation(conn: psycopg.Connection, log: Callable = None) -> int:
    """WCC District Plan coastal inundation overlays (with and without SLR)."""
    base = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer"
    cur = conn.cursor()
    cur.execute("TRUNCATE coastal_inundation RESTART IDENTITY")
    total = 0
    for lid in [49, 50]:
        _progress(log, f"Fetching coastal inundation layer {lid}...")
        features = _fetch_arcgis(f"{base}/{lid}", 2000)
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
                "INSERT INTO coastal_inundation (name, hazard_ranking, scenario, coast, layer_id, geom) "
                "VALUES (%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (_clean(a.get("Name")), _clean(a.get("DP_HazardRanking")),
                 _clean(a.get("Scenario")), _clean(a.get("Coast")), lid, wkt),
            )
            count += 1
        total += count
        _progress(log, f"  Layer {lid}: {count} rows")
    conn.commit()
    _progress(log, f"Coastal inundation total: {total} rows")
    return total


# ── WCC Rail Vibration Advisory ──────────────────────────────

def load_rail_vibration(conn: psycopg.Connection, log: Callable = None) -> int:
    """WCC District Plan rail vibration advisory overlay."""
    url = "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/140"
    _progress(log, "Fetching WCC rail vibration advisory...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("TRUNCATE rail_vibration RESTART IDENTITY")
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
            "INSERT INTO rail_vibration (noise_area, noise_area_type, eplan_category, geom) "
            "VALUES (%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (_clean(a.get("NoiseArea")), _clean(a.get("NoiseAreaType")),
             _clean(a.get("eplan_category")), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Rail vibration: {count} rows")
    return count


# ── GWRC Erosion Prone Land ──────────────────────────────────

def load_erosion_prone_land(conn: psycopg.Connection, log: Callable = None) -> int:
    """GWRC Regional Planning — erosion prone land."""
    url = "https://mapping.gw.govt.nz/arcgis/rest/services/GW/Regional_Planning_P/MapServer/22"
    _progress(log, "Fetching GWRC erosion prone land...")
    features = _fetch_arcgis(url)
    cur = conn.cursor()
    cur.execute("TRUNCATE erosion_prone_land RESTART IDENTITY")
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
            "INSERT INTO erosion_prone_land (min_angle, hectares, geom) "
            "VALUES (%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (a.get("MINANGLE"), a.get("Hectares"), wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Erosion prone land: {count} rows")
    return count


# ── GNS Landslide Database (NZLD) ─────────────────────────────

def load_gns_landslides(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load GNS NZ Landslide Database — point events + polygon areas (NATIONAL)."""
    cur = conn.cursor()

    # Create tables if they don't exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS landslide_events (
          id SERIAL PRIMARY KEY,
          gns_landslide_id INTEGER,
          name TEXT,
          time_of_occurrence DATE,
          damage_description TEXT,
          size_category INTEGER,
          trigger_name TEXT,
          severity_name TEXT,
          debris_type_name TEXT,
          material_type_name TEXT,
          movement_type_name TEXT,
          activity_name TEXT,
          aspect_name TEXT,
          data_source_name TEXT,
          source_council VARCHAR(50),
          geom GEOMETRY(Point, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_landslide_events_geom ON landslide_events USING GIST (geom);
        CREATE INDEX IF NOT EXISTS idx_landslide_events_trigger ON landslide_events (trigger_name);

        CREATE TABLE IF NOT EXISTS landslide_areas (
          id SERIAL PRIMARY KEY,
          gns_feature_id INTEGER,
          gns_landslide_id INTEGER,
          name TEXT,
          feature_type TEXT,
          source_council VARCHAR(50),
          geom GEOMETRY(MultiPolygon, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_landslide_areas_geom ON landslide_areas USING GIST (geom);
    """)
    conn.commit()

    # National — no bbox filter. Fetch in regional chunks to stay under WFS limits.
    nz_regions = [
        ("Northland/Auckland", "172.0,-37.8,177.0,-34.3"),
        ("Waikato/BOP", "174.5,-39.0,178.5,-36.5"),
        ("Central NI", "174.0,-41.0,178.0,-38.5"),
        ("Wellington", "174.5,-41.7,176.5,-40.5"),
        ("Nelson/Marlborough", "172.0,-42.5,175.0,-40.5"),
        ("Canterbury", "170.0,-44.5,173.5,-42.0"),
        ("West Coast", "168.0,-44.0,172.0,-41.5"),
        ("Otago", "168.0,-46.5,172.0,-44.0"),
        ("Southland", "166.0,-47.5,170.0,-45.5"),
    ]
    total = 0

    # 1. Point events — fetch per region
    _progress(log, "Fetching GNS landslide point events (National)...")
    cur.execute("TRUNCATE landslide_events RESTART IDENTITY")
    event_count = 0
    seen_ids = set()
    for region_name, bbox in nz_regions:
        _progress(log, f"  Region: {region_name}...")
        url = (
            "https://maps.gns.cri.nz/gns/ows?service=wfs&version=1.0.0"
            "&request=GetFeature&typeName=gns:v_landslide3"
            f"&outputFormat=application/json&maxFeatures=10000&CQL_FILTER=BBOX(location,{bbox})"
        )
        try:
            data = json.loads(_fetch_url(url, timeout=180))
        except Exception as e:
            logger.warning(f"Failed to fetch landslides for {region_name}: {e}")
            continue
        features = data.get("features", [])
        for feat in features:
            props = feat.get("properties", {})
            gns_id = props.get("id")
            if gns_id in seen_ids:
                continue
            seen_ids.add(gns_id)
            geom = feat.get("geometry")
            if not geom or not geom.get("coordinates"):
                continue
            coords = geom["coordinates"]
            if len(coords) < 2:
                continue
            cur.execute(
                "INSERT INTO landslide_events "
                "(gns_landslide_id, name, time_of_occurrence, damage_description, "
                "size_category, trigger_name, severity_name, debris_type_name, "
                "material_type_name, movement_type_name, activity_name, "
                "aspect_name, data_source_name, geom) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s),4326))",
                (gns_id, props.get("name"), props.get("time_of_occurrence"),
                 props.get("damage_description"), props.get("size_category"),
                 props.get("trigger_name"), props.get("severity_name"),
                 props.get("debris_type_name"), props.get("material_type_name"),
                 props.get("movement_type_name"), props.get("activity_name"),
                 props.get("aspect_name"), props.get("data_source_name"),
                 coords[0], coords[1]),
            )
            event_count += 1
        _progress(log, f"    {region_name}: {len(features)} features ({event_count} unique total)")
    total += event_count
    _progress(log, f"  Inserted {event_count} point events")

    # 2. Polygon areas — fetch per region
    _progress(log, "Fetching GNS landslide polygon areas (National)...")
    cur.execute("TRUNCATE landslide_areas RESTART IDENTITY")
    area_count = 0
    seen_feature_ids = set()
    for region_name, bbox in nz_regions:
        _progress(log, f"  Region: {region_name}...")
        url = (
            "https://maps.gns.cri.nz/gns/ows?service=wfs&version=1.0.0"
            "&request=GetFeature&typeName=gns:landslide_polygon_feature_view"
            f"&outputFormat=application/json&maxFeatures=10000&CQL_FILTER=BBOX(Geometry,{bbox})"
        )
        try:
            data = json.loads(_fetch_url(url, timeout=180))
        except Exception as e:
            logger.warning(f"Failed to fetch landslide polygons for {region_name}: {e}")
            continue
        features = data.get("features", [])
        for feat in features:
            props = feat.get("properties", {})
            fid = props.get("Feature ID")
            if fid in seen_feature_ids:
                continue
            seen_feature_ids.add(fid)
            geom = feat.get("geometry")
            if not geom:
                continue
            geom_json = json.dumps(geom)
            try:
                cur.execute(
                    "INSERT INTO landslide_areas "
                    "(gns_feature_id, gns_landslide_id, name, feature_type, geom) "
                    "VALUES (%s,%s,%s,%s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))",
                    (fid, props.get("Landslide ID"),
                     props.get("Landslide name"), props.get("Landslide feature"), geom_json),
                )
                area_count += 1
            except Exception as e:
                logger.warning(f"Skipped landslide polygon: {e}")
                conn.rollback()
    total += area_count
    _progress(log, f"  Inserted {area_count} polygon areas")

    conn.commit()
    cur.execute("ANALYZE landslide_events")
    cur.execute("ANALYZE landslide_areas")
    conn.commit()

    _progress(log, f"GNS landslides total: {total} records (national)")
    return total


# ── GNS Active Faults Database (National) ────────────────────

def load_gns_active_faults(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load GNS Active Faults Database — national fault lines + avoidance zones."""
    cur = conn.cursor()
    total = 0

    # 1. Active fault traces (lines) — from maps.gns.cri.nz
    _progress(log, "Fetching GNS active fault traces (National)...")
    url = (
        "https://maps.gns.cri.nz/gns/ows?service=wfs&version=1.0.0"
        "&request=GetFeature&typeName=gns:af250_faults_pg"
        "&outputFormat=application/json&maxFeatures=50000"
    )
    data = json.loads(_fetch_url(url, timeout=300))

    features = data.get("features", [])
    _progress(log, f"  Downloaded {len(features)} fault traces")

    cur.execute("TRUNCATE active_faults RESTART IDENTITY")
    count = 0
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry")
        if not geom:
            continue
        geom_json = json.dumps(geom)
        try:
            cur.execute(
                "INSERT INTO active_faults "
                "(fault_name, fault_id, fault_class, slip_rate_mm_yr, recurrence_interval, "
                "last_rupture, fault_type, accuracy, data_source, geom) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s, "
                "ST_Transform(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 2193)), 4326))",
                (
                    props.get("name"),
                    str(props.get("afdb_id") or ""),
                    props.get("rec_interv"),
                    props.get("slip_rate"),
                    props.get("rec_interv"),
                    None,  # last_event is coded, not text
                    str(props.get("slip_type") or ""),
                    props.get("line_accur"),
                    "GNS Active Faults Database",
                    geom_json,
                ),
            )
            count += 1
        except Exception as e:
            logger.warning(f"Skipped fault trace: {e}")
            conn.rollback()
    total += count
    _progress(log, f"  Inserted {count} fault traces")

    # 2. Fault avoidance zones (polygons) — try to fetch
    _progress(log, "Fetching GNS fault avoidance zones...")
    faz_url = (
        "https://maps.gns.cri.nz/gns/ows?service=wfs&version=1.0.0"
        "&request=GetFeature&typeName=gns:af250_faz_pg"
        "&outputFormat=application/json&maxFeatures=50000"
    )
    try:
        data = json.loads(_fetch_url(faz_url, timeout=300))
        features = data.get("features", [])
        _progress(log, f"  Downloaded {len(features)} avoidance zones")

        cur.execute("TRUNCATE fault_avoidance_zones RESTART IDENTITY")
        count = 0
        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry")
            if not geom:
                continue
            geom_json = json.dumps(geom)
            try:
                cur.execute(
                    "INSERT INTO fault_avoidance_zones "
                    "(fault_name, fault_id, zone_type, fault_class, setback_m, geom) "
                    "VALUES (%s,%s,%s,%s,%s, "
                    "ST_Transform(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 2193)), 4326))",
                    (
                        props.get("fault_name") or props.get("name"),
                        str(props.get("fault_id") or props.get("fid", "")),
                        props.get("zone_type", "FAZ"),
                        props.get("recurrence_interval_class") or props.get("ri_class"),
                        props.get("setback_distance") or props.get("setback_m"),
                        geom_json,
                    ),
                )
                count += 1
            except Exception as e:
                logger.warning(f"Skipped FAZ: {e}")
                conn.rollback()
        total += count
        _progress(log, f"  Inserted {count} fault avoidance zones")
    except Exception as e:
        _progress(log, f"  FAZ layer not available: {e}")

    conn.commit()
    cur.execute("ANALYZE active_faults")
    conn.commit()

    _progress(log, f"GNS active faults total: {total} records")
    return total


# ═══════════════════════════════════════════════════════════════
# AUCKLAND COUNCIL LOADERS
# ═══════════════════════════════════════════════════════════════

def _load_council_arcgis(
    conn: psycopg.Connection, log: Callable,
    url: str, table: str, council: str,
    cols: list[str], extract: Callable,
    srid: int = 2193, geom_type: str = "polygon",
    skip_delete: bool = False,
) -> int:
    """Generic council ArcGIS loader. Deletes council rows, re-inserts."""
    _progress(log, f"Fetching {table} ({council})...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    if not skip_delete:
        cur.execute(f"DELETE FROM {table} WHERE source_council = %s", (council,))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if geom_type == "polygon":
            if not geom or not geom.get("rings"):
                continue
            wkt = _mp_wkt(geom)
        elif geom_type == "line":
            if not geom or not geom.get("paths"):
                continue
            wkt = _ml_wkt(geom)
        elif geom_type == "point":
            if not geom:
                continue
            x, y = geom.get("x"), geom.get("y")
            if x is None or y is None:
                continue
            wkt = f"POINT({x} {y})"
        else:
            continue
        if not wkt:
            continue
        vals = extract(a)
        placeholders = ", ".join(["%s"] * len(cols))
        try:
            cur.execute(
                f"INSERT INTO {table} ({', '.join(cols)}, source_council, geom) "
                f"VALUES ({placeholders}, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), {srid}), 4326))",
                (*vals, council, wkt),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"  {table} ({council}): {count} rows")
    return count


def load_auckland_flood(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland flood prone areas."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Flood_Prone_Areas/FeatureServer/0"
    return _load_council_arcgis(
        conn, log, url, "flood_hazard", "auckland",
        ["name", "hazard_ranking", "hazard_type"],
        lambda a: (
            _clean(a.get("FPA_ID")) or "Flood Prone Area",
            "High" if (a.get("Depth100y") or 0) > 0.5 else "Medium" if (a.get("Depth100y") or 0) > 0 else "Low",
            "Flood Prone",
        ),
    )


def load_auckland_coastal_inundation(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland coastal inundation (multiple scenarios)."""
    # Single DELETE upfront so later scenarios don't wipe earlier ones
    cur = conn.cursor()
    cur.execute("DELETE FROM coastal_inundation WHERE source_council = 'auckland'")
    conn.commit()
    total = 0
    scenarios = [
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Coastal_Inundation_5_yr_Return/FeatureServer/0",
         "5yr return", "Low"),
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Coastal_Inundation_18_1_1_5m_Sea_Level_Rise/FeatureServer/0",
         "18.1% + 1.5m SLR", "High"),
    ]
    for url, scenario, ranking in scenarios:
        count = _load_council_arcgis(
            conn, log, url, "coastal_inundation", "auckland",
            ["name", "hazard_ranking", "scenario"],
            lambda a, s=scenario, r=ranking: (
                _clean(a.get("Name")) or s,
                r,
                s,
            ),
            skip_delete=True,
        )
        total += count
    return total


def load_auckland_liquefaction(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland liquefaction vulnerability."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Liquefaction_Vulnerability_Basic_Assessment/FeatureServer/0"
    return _load_council_arcgis(
        conn, log, url, "liquefaction_detail", "auckland",
        ["liquefaction", "simplified"],
        lambda a: (
            _clean(a.get("Vulnerability")),
            _clean(a.get("VulnerabilityDescription")),
        ),
    )


def load_auckland_landslide(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland large-scale + shallow landslide susceptibility."""
    # Single DELETE upfront so the second layer doesn't wipe the first
    cur = conn.cursor()
    cur.execute("DELETE FROM landslide_susceptibility WHERE source_council = 'auckland'")
    conn.commit()
    total = 0
    layers = [
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Large_Scale_Landslide_Susceptibility/FeatureServer/0",
         "large_scale"),
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Shallow_Landslide_Susceptibility/FeatureServer/0",
         "shallow"),
    ]
    for url, analysis_type in layers:
        count = _load_council_arcgis(
            conn, log, url, "landslide_susceptibility", "auckland",
            ["accuracy", "type"],
            lambda a, at=analysis_type: (
                _clean(a.get("SusceptibilityValue")) or _clean(a.get("Confidence")),
                at,
            ),
            skip_delete=True,
        )
        total += count
    return total


def _fetch_arcgis_with_domains(base_url: str, max_per_page: int = 1000) -> list[dict]:
    """Fetch ArcGIS features with coded domain values resolved to labels."""
    all_features = []
    offset = 0
    while True:
        params = {
            "where": "1=1", "outFields": "*", "f": "json",
            "returnGeometry": "true", "returnDomainValues": "true",
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


def load_auckland_plan_zones(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Unitary Plan base zones."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Unitary_Plan_Base_Zone/FeatureServer/0"
    _progress(log, "Fetching Auckland Unitary Plan zones...")
    features = _fetch_arcgis_with_domains(url, 2000)
    council = "auckland"
    cur = conn.cursor()
    cur.execute("DELETE FROM district_plan_zones WHERE source_council = %s", (council,))
    count = 0
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
        cur.execute(
            "INSERT INTO district_plan_zones (zone_name, zone_code, category, source_council, geom) "
            "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (zone_name, str(a.get("ZONE", "")), group, council, wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland plan zones: {count} rows")
    return count


def load_auckland_stormwater(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Stormwater Management Area Control (Unitary Plan overlay)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Stormwater_Management_Area_Control/FeatureServer/0"
    # TYPE coded domain: 1 = "Flow 1", 2 = "Flow 2"
    type_map = {1: "Flow 1", 1.0: "Flow 1", 2: "Flow 2", 2.0: "Flow 2"}

    _progress(log, "Fetching Auckland stormwater management areas...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("DELETE FROM stormwater_management_area WHERE source_council = %s", ("auckland",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        raw_type = a.get("TYPE")
        control_type = type_map.get(raw_type, _clean(raw_type))
        area_name = _clean(a.get("NAME")) or _clean(a.get("SCHEDULE"))
        cur.execute(
            "INSERT INTO stormwater_management_area (control_type, area_name, source_council, geom) "
            "VALUES (%s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (control_type, area_name, "auckland", wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland stormwater: {count} rows")
    return count


def load_auckland_tsunami(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland tsunami evacuation zones (Red/Yellow)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Tsunami_Evacuation_Zones/FeatureServer/0"
    zone_ranking = {"red": "High", "yellow": "Medium"}

    return _load_council_arcgis(
        conn, log, url, "tsunami_hazard", "auckland",
        ["name", "hazard_ranking", "scenario"],
        lambda a: (
            f"Tsunami Evacuation Zone ({(_clean(a.get('ZONETYPE')) or 'Unknown')})",
            zone_ranking.get((_clean(a.get("ZONETYPE")) or "").lower(), "Medium"),
            _clean(a.get("COMMENTS")) or "Evacuation Zone",
        ),
    )


def load_auckland_overland_flow(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland overland flow paths (polylines)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Overland_Flow_Paths/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS overland_flow_paths (
            id SERIAL PRIMARY KEY,
            catchment_group INTEGER,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiLineString, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_ofp_geom ON overland_flow_paths USING GIST (geom);
    """)
    conn.commit()

    _progress(log, "Fetching Auckland overland flow paths...")
    features = _fetch_arcgis(url, 2000)
    cur.execute("DELETE FROM overland_flow_paths WHERE source_council = %s", ("auckland",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("paths"):
            continue
        wkt = _ml_wkt(geom)
        if not wkt:
            continue
        cur.execute(
            "INSERT INTO overland_flow_paths (catchment_group, source_council, geom) "
            "VALUES (%s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (a.get("CATCHMENTAREAGROUP"), "auckland", wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland overland flow paths: {count} rows")
    return count


def load_auckland_flood_sensitive(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland flood sensitive areas."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Flood_Sensitive_Areas/FeatureServer/0"
    return _load_council_arcgis(
        conn, log, url, "flood_hazard", "auckland_flood_sensitive",
        ["name", "hazard_ranking", "hazard_type"],
        lambda a: (
            _clean(a.get("Hazard")) or "Flood Sensitive Area",
            "Medium",
            "Flood Sensitive",
        ),
    )


def load_auckland_heritage(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Historic Heritage Overlay places (Unitary Plan)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Historic_Heritage_Overlay_Place/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS historic_heritage_overlay (
            id SERIAL PRIMARY KEY,
            name TEXT,
            schedule TEXT,
            heritage_type TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(Point, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_hho_geom ON historic_heritage_overlay USING GIST (geom);
    """)
    conn.commit()

    _progress(log, "Fetching Auckland historic heritage overlay...")
    features = _fetch_arcgis(url, 2000)
    cur.execute("DELETE FROM historic_heritage_overlay WHERE source_council = %s", ("auckland",))
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
            "INSERT INTO historic_heritage_overlay (name, schedule, heritage_type, source_council, geom) "
            "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 2193), 4326))",
            (_clean(a.get("NAME")), _clean(a.get("SCHEDULE")),
             _clean(a.get("TYPE")), "auckland", x, y),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland heritage overlay: {count} rows")
    return count


def load_auckland_aircraft_noise(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland aircraft noise overlay (Unitary Plan — 15 noise zones)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Aircraft_Noise_Overlay/FeatureServer/0"
    # TYPE coded domain → name + dBA level
    type_map = {
        1: ("Ardmore Airport outer control boundary", 55),
        2: ("Ardmore Airport inner control boundary", 60),
        3: ("Ardmore Airport noise boundary", 65),
        4: ("Whenuapai Airbase noise control area", 55),
        5: ("Whenuapai Airbase noise control area", 65),
        6: ("North Shore Airfield air noise boundary", 65),
        7: ("North Shore Airfield outer control boundary", 55),
        8: ("Kaipara Flats Airfield air noise boundary", 65),
        9: ("Kaipara Flats Airfield air noise boundary", 55),
        10: ("Auckland Airport high aircraft noise area", None),
        11: ("Auckland Airport moderate aircraft noise area", None),
        12: ("Auckland Airport aircraft noise notification area", None),
        13: ("Auckland Airport aircraft noise notification area", 57),
        14: ("North Shore Airport air noise boundary", 65),
        15: ("North Shore Airport outer control boundary", 55),
    }

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS aircraft_noise_overlay (
            id SERIAL PRIMARY KEY,
            name TEXT,
            noise_level_dba INTEGER,
            noise_category TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiPolygon, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_ano_geom ON aircraft_noise_overlay USING GIST (geom);
    """)
    conn.commit()

    _progress(log, "Fetching Auckland aircraft noise overlay...")
    features = _fetch_arcgis(url, 2000)
    cur.execute("DELETE FROM aircraft_noise_overlay WHERE source_council = %s", ("auckland",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        raw_type = a.get("TYPE")
        type_key = int(raw_type) if raw_type is not None else None
        name, dba = type_map.get(type_key, (_clean(a.get("NAME")) or f"Type {type_key}", None))
        # Categorise noise severity
        if dba and dba >= 65:
            category = "High"
        elif dba and dba >= 60:
            category = "Moderate"
        elif dba and dba >= 55:
            category = "Low"
        elif "high" in (name or "").lower():
            category = "High"
        elif "moderate" in (name or "").lower():
            category = "Moderate"
        else:
            category = "Notification"
        cur.execute(
            "INSERT INTO aircraft_noise_overlay (name, noise_level_dba, noise_category, source_council, geom) "
            "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (name, dba, category, "auckland", wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland aircraft noise: {count} rows")
    return count


def load_auckland_special_character(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Special Character Areas Overlay (Residential & Business)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Special_Character_Areas_Overlay_Residential_and_Business/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS special_character_areas (
            id SERIAL PRIMARY KEY,
            name TEXT,
            schedule TEXT,
            character_type TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiPolygon, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_sca_geom ON special_character_areas USING GIST (geom);
    """)
    conn.commit()

    return _load_council_arcgis(
        conn, log, url, "special_character_areas", "auckland",
        ["name", "schedule", "character_type"],
        lambda a: (
            _clean(a.get("NAME")),
            _clean(a.get("SCHEDULE")),
            _clean(a.get("TYPE")),
        ),
    )


def load_auckland_notable_trees(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Notable Trees Overlay (Unitary Plan)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Notable_Trees_Overlay/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notable_trees (
            id SERIAL PRIMARY KEY,
            name TEXT,
            schedule TEXT,
            tree_type TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(Point, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_nt_geom ON notable_trees USING GIST (geom);
    """)
    conn.commit()

    # TYPE: "1"=Verified position, "2"=Unverified position
    _progress(log, "Fetching Auckland notable trees...")
    features = _fetch_arcgis(url, 2000)
    cur.execute("DELETE FROM notable_trees WHERE source_council = %s", ("auckland",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue
        x, y = geom.get("x"), geom.get("y")
        if x is None or y is None:
            continue
        tree_type = "Verified" if str(a.get("TYPE")) == "1" else "Unverified"
        cur.execute(
            "INSERT INTO notable_trees (name, schedule, tree_type, source_council, geom) "
            "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 2193), 4326))",
            (_clean(a.get("NAME")), _clean(a.get("SCHEDULE")), tree_type, "auckland", x, y),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland notable trees: {count} rows")
    return count


def load_auckland_ecological_areas(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Significant Ecological Areas Overlay."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Significant_Ecological_Areas_Overlay/FeatureServer/0"
    # TYPE: 1=Terrestrial, 2=Marine 1, 3=Marine 2, 4=Land
    type_map = {1: "Terrestrial", 2: "Marine 1", 3: "Marine 2", 4: "Land"}

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS significant_ecological_areas (
            id SERIAL PRIMARY KEY,
            name TEXT,
            schedule TEXT,
            eco_type TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiPolygon, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_sea_geom ON significant_ecological_areas USING GIST (geom);
    """)
    conn.commit()

    _progress(log, "Fetching Auckland significant ecological areas...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("DELETE FROM significant_ecological_areas WHERE source_council = %s", ("auckland",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        raw_type = a.get("TYPE")
        eco_type = type_map.get(int(raw_type) if raw_type is not None else None, _clean(raw_type))
        cur.execute(
            "INSERT INTO significant_ecological_areas (name, schedule, eco_type, source_council, geom) "
            "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (_clean(a.get("NAME")), _clean(a.get("SCHEDULE")), eco_type, "auckland", wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland ecological areas: {count} rows")
    return count


def load_auckland_coastal_erosion(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Coastal Instability and Erosion (ASCIE) — polylines."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/CoastalInstabilityAndErosion/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS coastal_erosion (
            id SERIAL PRIMARY KEY,
            name TEXT,
            coast_type TEXT,
            timeframe INTEGER,
            scenario TEXT,
            geology TEXT,
            distance_from_coast TEXT,
            sea_level_rise DOUBLE PRECISION,
            assessment_level TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiLineString, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_ce_geom ON coastal_erosion USING GIST (geom);
        ALTER TABLE coastal_erosion ADD COLUMN IF NOT EXISTS source_council VARCHAR(50);
    """)
    conn.commit()

    _progress(log, "Fetching Auckland coastal erosion (ASCIE)...")
    features = _fetch_arcgis(url, 2000)
    cur.execute("DELETE FROM coastal_erosion WHERE source_council = %s", ("auckland",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("paths"):
            continue
        wkt = _ml_wkt(geom)
        if not wkt:
            continue
        cur.execute(
            "INSERT INTO coastal_erosion "
            "(name, coast_type, timeframe, scenario, geology, distance_from_coast, "
            "sea_level_rise, assessment_level, source_council, geom) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (
                _clean(a.get("Name")), _clean(a.get("CoastType")),
                a.get("Timeframe"), _clean(a.get("Scenario")),
                _clean(a.get("Geology")), _clean(a.get("DistanceFromCoastline")),
                a.get("SeaLevelRise"), _clean(a.get("AssessmentLevel")),
                "auckland", wkt,
            ),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland coastal erosion: {count} rows")
    return count


def load_auckland_height_variation(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Height Variation Control (Unitary Plan)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Height_Variation_Control/FeatureServer/0"
    # TYPE coded domain maps to height strings like "16.5m/4 storeys"
    type_map = {
        1: "16.5m/4 storeys", 2: "24.5m/6 storeys", 3: "12.5m/3 storeys",
        4: "20.5m/6 storeys", 5: "17.5m/5 storeys", 7: "20.5m/5 storeys",
        8: "32.5m/8 storeys", 10: "8.5m/2 storeys", 14: "72.5m/18 storeys",
        15: "40.5m/10 storeys", 17: "48.5m/12 storeys", 18: "8.5m",
        19: "13m", 20: "17.5m", 21: "18m", 22: "19.5m", 23: "21m",
        24: "22.5m", 25: "27m", 26: "32.5m", 27: "28.5m", 28: "40.5m",
        29: "48.5m", 30: "11m", 31: "16m", 32: "35m", 33: "24m", 34: "15m",
        35: "22m", 36: "25m", 37: "30m", 38: "40m", 39: "43m", 40: "50m",
        41: "75m", 42: "28m", 43: "31m", 44: "32m", 45: "55m", 46: "9m",
        47: "7m", 48: "8m", 49: "31.5m", 50: "34.5m",
    }

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS height_variation_control (
            id SERIAL PRIMARY KEY,
            name TEXT,
            schedule TEXT,
            height_limit TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiPolygon, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_hvc_geom ON height_variation_control USING GIST (geom);
    """)
    conn.commit()

    _progress(log, "Fetching Auckland height variation control...")
    features = _fetch_arcgis(url, 2000)
    cur.execute("DELETE FROM height_variation_control WHERE source_council = %s", ("auckland",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        raw_type = a.get("TYPE")
        type_key = int(raw_type) if raw_type is not None else None
        height_limit = type_map.get(type_key, _clean(a.get("NAME")) or f"Type {type_key}")
        cur.execute(
            "INSERT INTO height_variation_control (name, schedule, height_limit, source_council, geom) "
            "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (_clean(a.get("NAME")), _clean(a.get("SCHEDULE")), height_limit, "auckland", wkt),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland height variation: {count} rows")
    return count


def load_auckland_mana_whenua(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Sites and Places of Significance to Mana Whenua Overlay."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Sites_and_Places_of_Significance_to_Mana_Whenua_Overlay/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mana_whenua_sites (
            id SERIAL PRIMARY KEY,
            name TEXT,
            schedule TEXT,
            site_type TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiPolygon, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_mws_geom ON mana_whenua_sites USING GIST (geom);
    """)
    conn.commit()

    return _load_council_arcgis(
        conn, log, url, "mana_whenua_sites", "auckland",
        ["name", "schedule", "site_type"],
        lambda a: (
            _clean(a.get("NAME")),
            _clean(a.get("SCHEDULE")),
            _clean(a.get("TYPE")),
        ),
    )


def load_auckland_geotech_reports(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Geotechnical Report Extent areas."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Geotechnical_Report_Extent/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS geotechnical_reports (
            id SERIAL PRIMARY KEY,
            report_id TEXT,
            location_description TEXT,
            locality TEXT,
            hazard TEXT,
            comment TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiPolygon, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_gr_geom ON geotechnical_reports USING GIST (geom);
    """)
    conn.commit()

    return _load_council_arcgis(
        conn, log, url, "geotechnical_reports", "auckland",
        ["report_id", "location_description", "locality", "hazard", "comment"],
        lambda a: (
            _clean(a.get("GeotechExtentID")),
            _clean(a.get("LocationDescription")),
            _clean(a.get("Locality")),
            _clean(a.get("Hazard")),
            _clean(a.get("Comment")),
        ),
    )


def load_auckland_schools(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland school locations (AC dataset, supplements national MOE data)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/SchoolLocations/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS auckland_schools (
            id SERIAL PRIMARY KEY,
            school_number INTEGER,
            school_name TEXT,
            school_type TEXT,
            school_website TEXT,
            definition TEXT,
            authority TEXT,
            gender TEXT,
            decile INTEGER,
            source_council VARCHAR(50) DEFAULT 'auckland',
            geom GEOMETRY(Point, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_as_geom ON auckland_schools USING GIST (geom);
    """)
    conn.commit()

    _progress(log, "Fetching Auckland school locations...")
    features = _fetch_arcgis(url, 2000)
    cur.execute("DELETE FROM auckland_schools WHERE source_council = %s", ("auckland",))
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
            "INSERT INTO auckland_schools "
            "(school_number, school_name, school_type, school_website, definition, "
            "authority, gender, decile, source_council, geom) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_MakePoint(%s,%s), 2193), 4326))",
            (
                a.get("SchoolNumber"), _clean(a.get("SchoolName")),
                _clean(a.get("SchoolType")), _clean(a.get("SchoolWebsite")),
                _clean(a.get("Definition")), _clean(a.get("Authority")),
                _clean(a.get("GenderOfStudents")), a.get("Decile"),
                "auckland", x, y,
            ),
        )
        count += 1
    conn.commit()
    _progress(log, f"Auckland schools: {count} rows")
    return count


def load_auckland_parks(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland public park extents."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/ParkExtentPublic/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS park_extents (
            id SERIAL PRIMARY KEY,
            site_name TEXT,
            asset_group TEXT,
            tla_desc TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiPolygon, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_pe_geom ON park_extents USING GIST (geom);
    """)
    conn.commit()

    return _load_council_arcgis(
        conn, log, url, "park_extents", "auckland",
        ["site_name", "asset_group", "tla_desc"],
        lambda a: (
            _clean(a.get("SiteName")),
            _clean(a.get("AssetGroup")),
            _clean(a.get("TLA_AssetDes")),
        ),
    )


def load_auckland_viewshafts(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Local Public Views + Volcanic Viewshafts (3 layers combined)."""
    layers = [
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Local_Public_Views_Overlay/FeatureServer/0",
         "Local Public View"),
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Locally_Significant_Volcanic_Viewshafts_Overlay/FeatureServer/0",
         "Locally Significant Volcanic Viewshaft"),
        ("https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Regionally_Significant_Volcanic_Viewshafts_And_Height_Sensitive_Areas_Overlay/FeatureServer/0",
         "Regionally Significant Volcanic Viewshaft"),
    ]
    council = "auckland"
    cur = conn.cursor()
    cur.execute("DELETE FROM viewshafts WHERE source_council = %s", (council,))
    total = 0
    for url, significance in layers:
        _progress(log, f"Fetching {significance}...")
        features = _fetch_arcgis(url, 2000)
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
                "INSERT INTO viewshafts (dp_ref, name, description, significance, source_council, geom) "
                "VALUES (%s, %s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (
                    _clean(a.get("SCHEDULE")),
                    _clean(a.get("NAME")),
                    None,
                    significance,
                    council, wkt,
                ),
            )
            count += 1
        total += count
        _progress(log, f"  {significance}: {count} rows")
    conn.commit()
    _progress(log, f"Auckland viewshafts total: {total} rows")
    return total


def load_auckland_heritage_extent(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Historic Heritage Overlay — Extent of Place (polygon boundaries)."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Historic_Heritage_Overlay_Extent_of_Place/FeatureServer/0"

    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS heritage_extent (
            id SERIAL PRIMARY KEY,
            name TEXT,
            schedule TEXT,
            heritage_type TEXT,
            source_council VARCHAR(50),
            geom GEOMETRY(MultiPolygon, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_he_geom ON heritage_extent USING GIST (geom);
    """)
    conn.commit()

    return _load_council_arcgis(
        conn, log, url, "heritage_extent", "auckland",
        ["name", "schedule", "heritage_type"],
        lambda a: (
            _clean(a.get("NAME")),
            _clean(a.get("SCHEDULE")),
            _clean(a.get("TYPE")),
        ),
    )


# ── Auckland Transport GTFS ──────────────────────────────────

AT_KEY_DESTINATIONS = {
    "Auckland CBD (Britomart)": (174.7685, -36.8442),
    "Auckland Airport": (174.7850, -37.0082),
    "Auckland Hospital": (174.7610, -36.8600),
    "University of Auckland": (174.7700, -36.8520),
    "Newmarket": (174.7775, -36.8700),
    "Takapuna": (174.7700, -36.7870),
    "Manukau": (174.8810, -36.9920),
    "Henderson": (174.6310, -36.8790),
    "Albany": (174.7060, -36.7270),
    "Sylvia Park": (174.8420, -36.9180),
    "Ponsonby": (174.7490, -36.8540),
    "Mt Eden": (174.7630, -36.8770),
}


def load_at_gtfs(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load Auckland Transport GTFS stops + compute travel times to key destinations."""
    _progress(log, "Downloading Auckland Transport GTFS...")
    zip_data = _fetch_url("https://gtfs.at.govt.nz/gtfs.zip", timeout=180)
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
            route_info = {}
            for r in reader:
                try:
                    route_info[r["route_id"]] = {"name": r["route_short_name"], "type": int(r["route_type"])}
                except (ValueError, KeyError):
                    continue

        # Trips
        with zf.open("trips.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            trip_route = {r["trip_id"]: r["route_id"] for r in reader}

        # Stop-route mapping + trip stops
        stop_route_types = defaultdict(set)
        trip_stops = defaultdict(list)
        _progress(log, "Parsing stop_times (this may take a minute)...")
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
                try:
                    trip_stops[tid].append((int(row["stop_sequence"]), sid, _time_secs(row["arrival_time"])))
                except (ValueError, KeyError):
                    continue

        for tid in trip_stops:
            trip_stops[tid].sort()

    cur = conn.cursor()

    # Create AT-specific stops table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS at_stops (
            id SERIAL PRIMARY KEY,
            stop_id VARCHAR(50) UNIQUE,
            stop_code VARCHAR(20),
            stop_name TEXT,
            zone_id VARCHAR(20),
            route_types INTEGER[],
            geom GEOMETRY(Point, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_at_stops_geom ON at_stops USING GIST (geom);
        CREATE INDEX IF NOT EXISTS idx_at_stops_sid ON at_stops (stop_id);
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS at_travel_times (
            id SERIAL PRIMARY KEY,
            stop_id VARCHAR(50),
            destination TEXT,
            min_minutes REAL,
            route_names TEXT[],
            peak_window TEXT NOT NULL DEFAULT 'am',
            UNIQUE (stop_id, destination, peak_window)
        );
        CREATE INDEX IF NOT EXISTS idx_at_tt_stop ON at_travel_times (stop_id);
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS at_stop_frequency (
            stop_id VARCHAR(50) PRIMARY KEY,
            peak_trips_per_hour REAL
        );
    """)
    conn.commit()

    # Insert stops
    _progress(log, f"Inserting {len(stops)} AT stops...")
    cur.execute("TRUNCATE at_stops RESTART IDENTITY")
    stop_count = 0
    for sid, s in stops.items():
        rts = sorted(stop_route_types.get(sid, []))
        cur.execute(
            "INSERT INTO at_stops (stop_id, stop_code, stop_name, zone_id, route_types, geom) "
            "VALUES (%s,%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s),4326)) "
            "ON CONFLICT (stop_id) DO UPDATE SET stop_name=EXCLUDED.stop_name, route_types=EXCLUDED.route_types",
            (sid, s.get("code"), s["name"], s.get("zone_id"), rts or None, s["lon"], s["lat"]),
        )
        stop_count += 1

    # AM/PM peak windows
    AM_START, AM_END = 7 * 3600, 9 * 3600
    PM_START, PM_END = 16 * 3600 + 1800, 18 * 3600 + 1800

    # Exclude night routes
    night_route_ids = {
        rid for rid, info in route_info.items()
        if info.get("name", "").upper().startswith("N") and info.get("name", "")[1:].isdigit()
    }
    _progress(log, f"Excluding {len(night_route_ids)} night routes")

    _progress(log, "Computing travel times (AM + PM peak)...")
    dest_stops = {}
    for dname, (dlon, dlat) in AT_KEY_DESTINATIONS.items():
        dest_stops[dname] = {sid for sid, s in stops.items() if _haversine(dlon, dlat, s["lon"], s["lat"]) <= 400}

    def _in_peak(secs: int) -> str | None:
        if AM_START <= secs <= AM_END:
            return "am"
        if PM_START <= secs <= PM_END:
            return "pm"
        return None

    travel_samples = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"times": [], "routes": set()})))
    for tid, seq in trip_stops.items():
        rid = trip_route.get(tid)
        if rid in night_route_ids:
            continue
        rinfo = route_info.get(rid, {})
        rname = rinfo.get("name", "?")
        mode = {2: "train", 3: "bus", 4: "ferry"}.get(rinfo.get("type", 3), "bus")
        stop_times_map = {sid: arr for _, sid, arr in seq}
        for dname, dsids in dest_stops.items():
            darrs = [stop_times_map[d] for d in dsids if d in stop_times_map]
            if not darrs:
                continue
            darr = min(darrs)
            for _, sid, arr in seq:
                if arr >= darr:
                    break
                peak = _in_peak(arr)
                if peak is None:
                    continue
                mins = (darr - arr) / 60
                if mins < 1:
                    continue
                entry = travel_samples[sid][dname][peak]
                entry["times"].append(mins)
                entry["routes"].add(f"{rname} ({mode})")

    # Insert travel times (median)
    cur.execute("TRUNCATE at_travel_times RESTART IDENTITY")
    tt_count = 0
    for sid, dests in travel_samples.items():
        for dname, windows in dests.items():
            for peak, info in windows.items():
                times = sorted(info["times"])
                if not times:
                    continue
                mid = len(times) // 2
                median_mins = times[mid] if len(times) % 2 == 1 else (times[mid - 1] + times[mid]) / 2
                cur.execute(
                    "INSERT INTO at_travel_times (stop_id, destination, min_minutes, route_names, peak_window) "
                    "VALUES (%s,%s,%s,%s,%s)",
                    (sid, dname, round(median_mins, 1), sorted(info["routes"]), peak),
                )
                tt_count += 1

    # Peak frequency
    _progress(log, "Computing peak frequency...")
    stop_peak = defaultdict(set)
    for tid, seq in trip_stops.items():
        rid = trip_route.get(tid)
        if rid in night_route_ids:
            continue
        for _, sid, arr in seq:
            if AM_START <= arr <= AM_END:
                stop_peak[sid].add(tid)

    cur.execute("TRUNCATE at_stop_frequency")
    for sid, trips in stop_peak.items():
        cur.execute(
            "INSERT INTO at_stop_frequency (stop_id, peak_trips_per_hour) VALUES (%s,%s) "
            "ON CONFLICT (stop_id) DO UPDATE SET peak_trips_per_hour=EXCLUDED.peak_trips_per_hour",
            (sid, round(len(trips) / 2, 1)),
        )

    conn.commit()
    _progress(log, f"AT GTFS: {stop_count} stops, {tt_count} travel times")
    return stop_count + tt_count


REGIONAL_DESTINATIONS = {
    "christchurch": {
        "Christchurch CBD": (172.6362, -43.5321),
        "Christchurch Airport": (172.5347, -43.4893),
        "Christchurch Hospital": (172.6270, -43.5340),
        "University of Canterbury": (172.5833, -43.5236),
        "Riccarton": (172.5990, -43.5310),
        "Papanui": (172.6130, -43.5050),
        "Hornby": (172.5280, -43.5530),
        "Eastgate": (172.6780, -43.5420),
        "Northlands": (172.6220, -43.5090),
    },
    "hamilton": {
        "Hamilton CBD": (175.2793, -37.7870),
        "Waikato Hospital": (175.2950, -37.8020),
        "The Base (Te Rapa)": (175.2590, -37.7490),
        "University of Waikato": (175.3170, -37.7880),
        "Hamilton Transport Centre": (175.2780, -37.7900),
        "Chartwell": (175.3030, -37.7580),
        "Hillcrest": (175.3090, -37.7810),
    },
    "dunedin": {
        "Dunedin CBD (Octagon)": (170.5028, -45.8742),
        "Dunedin Hospital": (170.5060, -45.8710),
        "University of Otago": (170.5130, -45.8660),
        "South Dunedin": (170.5050, -45.8950),
        "Mosgiel": (170.3490, -45.8750),
    },
    "nelson": {
        "Nelson CBD": (173.2840, -41.2710),
        "Nelson Hospital": (173.2890, -41.2700),
        "Richmond": (173.1830, -41.3370),
        "Stoke": (173.2360, -41.3010),
    },
    "taranaki": {
        "New Plymouth CBD": (174.0752, -39.0558),
        "Taranaki Base Hospital": (174.0650, -39.0650),
        "Bell Block": (174.0960, -39.0220),
    },
    "palmerston_north": {
        "Palmerston North CBD (The Square)": (175.6120, -40.3523),
        "Palmerston North Hospital": (175.6200, -40.3560),
        "Massey University": (175.6180, -40.3870),
        "Palmerston North Airport": (175.6190, -40.3200),
    },
}


def _load_regional_gtfs(
    conn: psycopg.Connection, log: Callable,
    gtfs_url: str, region_name: str,
) -> int:
    """Regional GTFS loader — loads stops + computes travel times to key destinations."""
    _progress(log, f"Downloading {region_name} GTFS...")
    zip_data = _fetch_url(gtfs_url, timeout=180)
    if not zip_data:
        _progress(log, f"  Empty response from {gtfs_url}")
        return 0
    _progress(log, f"  Downloaded {len(zip_data) / 1024 / 1024:.1f} MB")

    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_data))
    except zipfile.BadZipFile:
        _progress(log, f"  Bad zip file from {gtfs_url}")
        return 0

    with zf:
        # Parse stops
        with zf.open("stops.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            stops = {}
            for row in reader:
                try:
                    lat = float(row["stop_lat"])
                    lon = float(row["stop_lon"])
                    if lat == 0 or lon == 0:
                        continue
                    stops[row["stop_id"]] = {
                        "name": row["stop_name"], "code": row.get("stop_code"),
                        "lat": lat, "lon": lon,
                    }
                except (ValueError, KeyError):
                    continue

        # Routes — determine mode
        route_info = {}
        try:
            with zf.open("routes.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for r in reader:
                    try:
                        route_info[r["route_id"]] = {"name": r.get("route_short_name", ""), "type": int(r["route_type"])}
                    except (ValueError, KeyError):
                        continue
        except KeyError:
            pass

        # Trips
        trip_route = {}
        try:
            with zf.open("trips.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                trip_route = {r["trip_id"]: r["route_id"] for r in reader}
        except KeyError:
            pass

        # Stop times — build trip sequences + route type lookups
        stop_route_types = defaultdict(set)
        trip_stops = defaultdict(list)
        try:
            with zf.open("stop_times.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    tid = row.get("trip_id")
                    sid = row.get("stop_id")
                    rid = trip_route.get(tid)
                    if rid:
                        rt = route_info.get(rid, {}).get("type")
                        if rt is not None:
                            stop_route_types[sid].add(rt)
                    try:
                        trip_stops[tid].append((int(row["stop_sequence"]), sid, _time_secs(row["arrival_time"])))
                    except (ValueError, KeyError):
                        continue
        except KeyError:
            pass

        for tid in trip_stops:
            trip_stops[tid].sort()

    cur = conn.cursor()
    cur.execute("ALTER TABLE transit_stops ADD COLUMN IF NOT EXISTS source VARCHAR(50)")
    cur.execute("ALTER TABLE transit_stops ADD COLUMN IF NOT EXISTS mode_type VARCHAR(20)")
    conn.commit()

    # Insert stops
    cur.execute("DELETE FROM transit_stops WHERE source = %s", (region_name,))
    stop_count = 0
    for sid, s in stops.items():
        rts = sorted(stop_route_types.get(sid, []))
        mode = "bus"
        if 2 in rts:
            mode = "train"
        elif 4 in rts:
            mode = "ferry"
        cur.execute(
            "INSERT INTO transit_stops (stop_id, stop_name, mode_type, source, geom) "
            "VALUES (%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s),4326)) "
            "ON CONFLICT DO NOTHING",
            (f"{region_name}_{sid}", s["name"], mode, region_name, s["lon"], s["lat"]),
        )
        stop_count += 1
    conn.commit()

    # Compute travel times if destinations are defined for this region
    destinations = REGIONAL_DESTINATIONS.get(region_name)
    if not destinations or not trip_stops:
        _progress(log, f"{region_name} GTFS: {stop_count} stops loaded (no travel times — no destinations or stop_times)")
        return stop_count

    AM_START, AM_END = 7 * 3600, 9 * 3600
    PM_START, PM_END = 16 * 3600 + 1800, 18 * 3600 + 1800

    night_route_ids = {
        rid for rid, info in route_info.items()
        if info.get("name", "").upper().startswith("N") and info.get("name", "")[1:].isdigit()
    }

    _progress(log, f"Computing travel times for {region_name} ({len(destinations)} destinations)...")

    dest_stops = {}
    for dname, (dlon, dlat) in destinations.items():
        dest_stops[dname] = {sid for sid, s in stops.items() if _haversine(dlon, dlat, s["lon"], s["lat"]) <= 400}

    def _in_peak(secs):
        if AM_START <= secs <= AM_END:
            return "am"
        if PM_START <= secs <= PM_END:
            return "pm"
        return None

    travel_samples = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"times": [], "routes": set()})))
    for tid, seq in trip_stops.items():
        rid = trip_route.get(tid)
        if rid in night_route_ids:
            continue
        rinfo = route_info.get(rid, {})
        rname = rinfo.get("name", "?")
        mode = {2: "train", 3: "bus", 4: "ferry", 5: "cable car"}.get(rinfo.get("type", 3), "bus")
        stop_times_map = {sid: arr for _, sid, arr in seq}
        for dname, dsids in dest_stops.items():
            darrs = [stop_times_map[d] for d in dsids if d in stop_times_map]
            if not darrs:
                continue
            darr = min(darrs)
            for _, sid, arr in seq:
                if arr >= darr:
                    break
                peak = _in_peak(arr)
                if peak is None:
                    continue
                mins = (darr - arr) / 60
                if mins < 1:
                    continue
                entry = travel_samples[sid][dname][peak]
                entry["times"].append(mins)
                entry["routes"].add(f"{rname} ({mode})")

    # Store travel times in transit_travel_times (shared table)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transit_travel_times (
            id SERIAL PRIMARY KEY,
            stop_id VARCHAR(50),
            destination TEXT,
            min_minutes REAL,
            route_names TEXT[],
            peak_window TEXT NOT NULL DEFAULT 'am',
            UNIQUE (stop_id, destination, peak_window)
        )
    """)
    cur.execute("""CREATE INDEX IF NOT EXISTS idx_ttt_stop ON transit_travel_times (stop_id)""")
    conn.commit()

    # Delete old travel times for this region
    cur.execute("DELETE FROM transit_travel_times WHERE stop_id LIKE %s", (f"{region_name}_%",))

    tt_count = 0
    for sid, dests in travel_samples.items():
        for dname, windows in dests.items():
            for peak, info in windows.items():
                times = sorted(info["times"])
                if not times:
                    continue
                mid = len(times) // 2
                median_mins = times[mid] if len(times) % 2 == 1 else (times[mid - 1] + times[mid]) / 2
                cur.execute(
                    "INSERT INTO transit_travel_times (stop_id, destination, min_minutes, route_names, peak_window) "
                    "VALUES (%s,%s,%s,%s,%s) ON CONFLICT (stop_id, destination, peak_window) DO UPDATE "
                    "SET min_minutes=EXCLUDED.min_minutes, route_names=EXCLUDED.route_names",
                    (f"{region_name}_{sid}", dname, round(median_mins, 1), sorted(info["routes"]), peak),
                )
                tt_count += 1

    # Peak frequency
    stop_peak = defaultdict(set)
    for tid, seq in trip_stops.items():
        rid = trip_route.get(tid)
        if rid in night_route_ids:
            continue
        for _, sid, arr in seq:
            if AM_START <= arr <= AM_END:
                stop_peak[sid].add(tid)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS transit_stop_frequency (
            stop_id VARCHAR(50) PRIMARY KEY,
            peak_trips_per_hour REAL
        )
    """)
    conn.commit()
    for sid, trips in stop_peak.items():
        cur.execute(
            "INSERT INTO transit_stop_frequency (stop_id, peak_trips_per_hour) VALUES (%s,%s) "
            "ON CONFLICT (stop_id) DO UPDATE SET peak_trips_per_hour=EXCLUDED.peak_trips_per_hour",
            (f"{region_name}_{sid}", round(len(trips) / 2, 1)),
        )

    conn.commit()
    _progress(log, f"{region_name} GTFS: {stop_count} stops, {tt_count} travel times")
    return stop_count + tt_count


def _load_rates(
    conn: psycopg.Connection, log: Callable,
    url: str, council: str,
    cv_field: str, lv_field: str, iv_field: str | None,
    addr_field: str | None = None,
    geom_type: str = "polygon", srid: int = 2193,
    extra_where: str | None = None,
    page_size: int = 2000,
) -> int:
    """Load council valuations into council_valuations table."""
    # Add council column if not exists + fix geometry to accept any type
    cur = conn.cursor()
    cur.execute("ALTER TABLE council_valuations ADD COLUMN IF NOT EXISTS council VARCHAR(50)")
    cur.execute("""
        DO $$ BEGIN
            ALTER TABLE council_valuations ALTER COLUMN geom TYPE geometry(Geometry, 4326)
            USING geom::geometry(Geometry, 4326);
        EXCEPTION WHEN others THEN NULL;
        END $$
    """)
    conn.commit()

    _progress(log, f"Fetching {council} rates/valuations...")
    where = extra_where or "1=1"
    features = _fetch_arcgis(url, page_size, where=where)
    cur.execute("DELETE FROM council_valuations WHERE council = %s", (council,))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue

        cv = a.get(cv_field)
        lv = a.get(lv_field)
        iv = a.get(iv_field) if iv_field else None
        addr = _clean(a.get(addr_field)) if addr_field else None

        if geom_type == "point":
            x, y = geom.get("x"), geom.get("y")
            if x is None or y is None:
                continue
            geom_sql = f"ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), {srid}), 4326)"
            geom_params = (x, y)
        else:
            if not geom.get("rings"):
                continue
            wkt = _mp_wkt(geom)
            if not wkt:
                continue
            geom_sql = f"ST_Transform(ST_SetSRID(ST_GeomFromText(%s), {srid}), 4326)"
            geom_params = (wkt,)

        try:
            cur.execute(
                f"INSERT INTO council_valuations (council, capital_value, land_value, improvements_value, address, geom) "
                f"VALUES (%s, %s, %s, %s, %s, {geom_sql})",
                (council, cv, lv, iv, addr, *geom_params),
            )
            count += 1
        except Exception:
            conn.rollback()  # skip bad geometry
            continue

        if count % 5000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"{council} rates: {count} rows")
    return count


def _load_uhcc(conn: psycopg.Connection, log: Callable) -> int:
    """Load Upper Hutt rates via HTML scraping (no ArcGIS API available)."""
    from .uhcc_scraper import load_uhcc_rates
    return load_uhcc_rates(conn, log)


# ═══════════════════════════════════════════════════════════════
# CHRISTCHURCH COUNCIL LOADERS
# ═══════════════════════════════════════════════════════════════

def load_christchurch_liquefaction(conn: psycopg.Connection, log: Callable = None) -> int:
    """Christchurch liquefaction — CCC district plan zones + ECan regional susceptibility."""
    total = 0
    # 1. CCC District Plan liquefaction management zones (legally binding)
    url1 = "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSP/FeatureServer/39"
    total += _load_council_arcgis(
        conn, log, url1, "liquefaction_detail", "christchurch",
        ["liquefaction", "simplified"],
        lambda a: (
            _clean(a.get("LiquefactionManagementZoneCategory")) or "Liquefaction Management Zone",
            _clean(a.get("LiquefactionManagementZoneCategoryCode")),
        ),
    )
    # 2. ECan regional susceptibility (large zones covering Canterbury)
    url2 = "https://gis1.ecan.govt.nz/arcgis/rest/services/Public/Liquefaction_Susceptibility/MapServer/4"
    total += _load_council_arcgis(
        conn, log, url2, "liquefaction_detail", "christchurch_regional",
        ["liquefaction", "simplified"],
        lambda a: (
            _clean(a.get("LV_Cat")) or _clean(a.get("Category")),
            _clean(a.get("Description")) or _clean(a.get("Geology")),
        ),
    )
    return total


def load_christchurch_flood(conn: psycopg.Connection, log: Callable = None) -> int:
    """Christchurch inundation zones — hazard_zone, depth, ARI from CCC Hosted layer."""
    # CCC InundationZonesPortal — SRID 3857 (Web Mercator)
    url = "https://gis.ccc.govt.nz/arcgis/rest/services/Hosted/InundationZonesPortal/FeatureServer/0"

    def _hazard_ranking(a: dict) -> str:
        hz = _clean(a.get("hazard_zone")) or ""
        if "high" in hz.lower():
            return "High"
        if "medium" in hz.lower():
            return "Medium"
        if "low" in hz.lower():
            return "Low"
        return "Medium"

    def _hazard_type(a: dict) -> str:
        parts = []
        conn_type = _clean(a.get("connected_disconnected_flooding"))
        if conn_type:
            parts.append(conn_type)
        ari = a.get("ari_years")
        if ari:
            parts.append(f"{ari}yr ARI")
        depth_min = a.get("depth_min")
        depth_max = a.get("depth_max")
        if depth_min is not None and depth_max is not None:
            parts.append(f"{depth_min}-{depth_max}m depth")
        return " | ".join(parts) if parts else "Inundation Zone"

    return _load_council_arcgis(
        conn, log, url, "flood_hazard", "christchurch",
        ["name", "hazard_ranking", "hazard_type"],
        lambda a: (
            _clean(a.get("name")) or _clean(a.get("hazard_zone")) or "Inundation Zone",
            _hazard_ranking(a),
            _hazard_type(a),
        ),
        srid=3857,
    )


# ═══════════════════════════════════════════════════════════════
# CUSTOM LOADERS FOR NATIONAL-SCHEMA TABLES (no source_council)
# ═══════════════════════════════════════════════════════════════

def load_taranaki_faults(conn: psycopg.Connection, log: Callable = None) -> int:
    """Taranaki active faultlines → active_faults table (national schema)."""
    url = "https://maps.trc.govt.nz/arcgis/rest/services/LocalMaps/EmergencyManagement/MapServer/1"
    _progress(log, "Fetching active_faults (taranaki)...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("DELETE FROM active_faults WHERE data_source = %s", ("Taranaki Regional Council",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("paths"):
            continue
        wkt = _ml_wkt(geom)
        if not wkt:
            continue
        try:
            cur.execute(
                "INSERT INTO active_faults "
                "(fault_name, fault_type, slip_rate_mm_yr, data_source, geom) "
                "VALUES (%s, %s, %s, %s, "
                "ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (
                    _clean(a.get("Name")) or _clean(a.get("FAULT_NAME")) or "Active Fault",
                    _clean(a.get("Type")) or _clean(a.get("FAULT_TYPE")),
                    _clean(a.get("SlipRate")) or _clean(a.get("SLIP_RATE")),
                    "Taranaki Regional Council",
                    wkt,
                ),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"  active_faults (taranaki): {count} rows")
    return count


def load_taranaki_tsunami(conn: psycopg.Connection, log: Callable = None) -> int:
    """Taranaki tsunami evacuation zones → tsunami_zones table (national schema)."""
    url = "https://maps.trc.govt.nz/arcgis/rest/services/LocalMaps/EmergencyManagement/MapServer/2"
    _progress(log, "Fetching tsunami_zones (taranaki)...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("DELETE FROM tsunami_zones WHERE location = %s", ("Taranaki",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        try:
            cur.execute(
                "INSERT INTO tsunami_zones "
                "(evac_zone, zone_class, location, geom) "
                "VALUES (%s, %s, %s, "
                "ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (
                    _clean(a.get("Name")) or _clean(a.get("Zone")) or "Tsunami Zone",
                    _clean(a.get("Class")) or 1,
                    "Taranaki",
                    wkt,
                ),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"  tsunami_zones (taranaki): {count} rows")
    return count


def load_tauranga_heritage(conn: psycopg.Connection, log: Callable = None) -> int:
    """Tauranga built heritage sites → heritage_sites table (national schema)."""
    url = "https://gis.tauranga.govt.nz/server/rest/services/ePlan/ePlan_Sections1to3/MapServer/7"
    _progress(log, "Fetching heritage_sites (tauranga)...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("DELETE FROM heritage_sites WHERE district_council = %s", ("Tauranga",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue
        x, y = geom.get("x"), geom.get("y")
        if x is None or y is None:
            continue
        wkt = f"POINT({x} {y})"
        try:
            cur.execute(
                "INSERT INTO heritage_sites "
                "(name, list_entry_type, list_number, district_council, geom) "
                "VALUES (%s, %s, %s, %s, "
                "ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (
                    _clean(a.get("Name")) or _clean(a.get("Heritage_Name")) or "Heritage Site",
                    _clean(a.get("Category")) or _clean(a.get("Type")),
                    int(v) if (v := (_clean(a.get("NZAA_No")) or _clean(a.get("SiteNumber")))) and v.isdigit() else None,
                    "Tauranga",
                    wkt,
                ),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"  heritage_sites (tauranga): {count} rows")
    return count


def load_tauranga_noise(conn: psycopg.Connection, log: Callable = None) -> int:
    """Tauranga airport + port noise contours → noise_contours table (national schema)."""
    url = "https://gis.tauranga.govt.nz/server/rest/services/ePlan/ePlan_Section5/MapServer/9"
    _progress(log, "Fetching noise_contours (tauranga)...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    # Delete any previously loaded Tauranga contours by checking for non-null laeq24h
    # from this source. Since laeq24h is the only data column, we tag with a negative
    # value range or use a separate approach. Safest: delete where ogc_fid matches
    # a known range. But simplest: add source_council column if missing, then use it.
    try:
        cur.execute(
            "ALTER TABLE noise_contours ADD COLUMN IF NOT EXISTS source_council TEXT"
        )
        conn.commit()
    except Exception:
        conn.rollback()
    cur.execute("DELETE FROM noise_contours WHERE source_council = %s", ("tauranga",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        noise_level = _clean(a.get("NoiseLevel")) or _clean(a.get("dBA"))
        try:
            laeq = int(noise_level) if noise_level else None
        except (ValueError, TypeError):
            laeq = None
        try:
            cur.execute(
                "INSERT INTO noise_contours "
                "(laeq24h, source_council, geom) "
                "VALUES (%s, %s, "
                "ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (laeq, "tauranga", wkt),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"  noise_contours (tauranga): {count} rows")
    return count


# ═══════════════════════════════════════════════════════════════
# REGISTRY
# ═══════════════════════════════════════════════════════════════

DATA_SOURCES: list[DataSource] = [
    # ── National (GNS) ────────────────────────────────────────
    DataSource(
        "gns_landslides", "GNS Landslide Database (National)",
        ["landslide_events", "landslide_areas"],
        load_gns_landslides,
    ),
    DataSource(
        "gns_active_faults", "GNS Active Faults (National)",
        ["active_faults", "fault_avoidance_zones"],
        load_gns_active_faults,
    ),
    # ── Wellington / Greater Wellington ───────────────────────
    DataSource(
        "gwrc_earthquake", "GWRC Earthquake Hazards",
        ["earthquake_hazard", "ground_shaking", "liquefaction_detail", "slope_failure"],
        load_gwrc_earthquake,
    ),
    DataSource(
        "wcc_hazards", "WCC District Plan Hazards",
        ["fault_zones", "flood_hazard", "tsunami_hazard"],
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
    DataSource(
        "gwrc_landslide", "GWRC Landslide (GNS QMap)",
        ["landslide_susceptibility"],
        load_gwrc_landslide,
    ),
    DataSource(
        "coastal_elevation", "GWRC Coastal Elevation",
        ["coastal_elevation"],
        load_coastal_elevation,
    ),
    DataSource(
        "gwrc_flood_extents", "GWRC Flood Extents (2%, 1%, 0.23% AEP)",
        ["flood_extent"],
        load_gwrc_flood_extents,
    ),
    DataSource(
        "corrosion_zones", "WCC Corrosion Zones",
        ["corrosion_zones"],
        load_corrosion_zones,
    ),
    DataSource(
        "viewshafts", "WCC Viewshafts",
        ["viewshafts"],
        load_viewshafts,
    ),
    DataSource(
        "character_precincts", "WCC Character Precincts",
        ["character_precincts"],
        load_character_precincts,
    ),
    DataSource(
        "coastal_inundation", "WCC Coastal Inundation (+ SLR)",
        ["coastal_inundation"],
        load_coastal_inundation,
    ),
    DataSource(
        "rail_vibration", "WCC Rail Vibration Advisory",
        ["rail_vibration"],
        load_rail_vibration,
    ),
    DataSource(
        "erosion_prone_land", "GWRC Erosion Prone Land",
        ["erosion_prone_land"],
        load_erosion_prone_land,
    ),
    # ── Auckland ──────────────────────────────────────────────
    DataSource(
        "auckland_flood", "Auckland Flood Prone Areas",
        ["flood_hazard"],
        load_auckland_flood,
    ),
    DataSource(
        "auckland_coastal", "Auckland Coastal Inundation",
        ["coastal_inundation"],
        load_auckland_coastal_inundation,
    ),
    DataSource(
        "auckland_liquefaction", "Auckland Liquefaction",
        ["liquefaction_detail"],
        load_auckland_liquefaction,
    ),
    DataSource(
        "auckland_landslide", "Auckland Landslide Susceptibility",
        ["landslide_susceptibility"],
        load_auckland_landslide,
    ),
    DataSource(
        "auckland_plan_zones", "Auckland Unitary Plan Zones",
        ["district_plan_zones"],
        load_auckland_plan_zones,
    ),
    DataSource(
        "auckland_stormwater", "Auckland Stormwater Management Areas",
        ["stormwater_management_area"],
        load_auckland_stormwater,
    ),
    DataSource(
        "auckland_tsunami", "Auckland Tsunami Evacuation Zones",
        ["tsunami_hazard"],
        load_auckland_tsunami,
    ),
    DataSource(
        "auckland_overland_flow", "Auckland Overland Flow Paths",
        ["overland_flow_paths"],
        load_auckland_overland_flow,
    ),
    DataSource(
        "auckland_flood_sensitive", "Auckland Flood Sensitive Areas",
        ["flood_hazard"],
        load_auckland_flood_sensitive,
    ),
    DataSource(
        "auckland_heritage", "Auckland Historic Heritage Overlay",
        ["historic_heritage_overlay"],
        load_auckland_heritage,
    ),
    DataSource(
        "auckland_aircraft_noise", "Auckland Aircraft Noise Overlay",
        ["aircraft_noise_overlay"],
        load_auckland_aircraft_noise,
    ),
    DataSource(
        "auckland_special_character", "Auckland Special Character Areas",
        ["special_character_areas"],
        load_auckland_special_character,
    ),
    DataSource(
        "auckland_notable_trees", "Auckland Notable Trees",
        ["notable_trees"],
        load_auckland_notable_trees,
    ),
    DataSource(
        "auckland_ecological", "Auckland Significant Ecological Areas",
        ["significant_ecological_areas"],
        load_auckland_ecological_areas,
    ),
    DataSource(
        "auckland_coastal_erosion", "Auckland Coastal Erosion (ASCIE)",
        ["coastal_erosion"],
        load_auckland_coastal_erosion,
    ),
    DataSource(
        "auckland_height_variation", "Auckland Height Variation Control",
        ["height_variation_control"],
        load_auckland_height_variation,
    ),
    DataSource(
        "auckland_mana_whenua", "Auckland Mana Whenua Sites",
        ["mana_whenua_sites"],
        load_auckland_mana_whenua,
    ),
    DataSource(
        "auckland_geotech", "Auckland Geotechnical Reports",
        ["geotechnical_reports"],
        load_auckland_geotech_reports,
    ),
    DataSource(
        "auckland_schools", "Auckland School Locations",
        ["auckland_schools"],
        load_auckland_schools,
    ),
    DataSource(
        "auckland_parks", "Auckland Park Extents",
        ["park_extents"],
        load_auckland_parks,
    ),
    DataSource(
        "auckland_viewshafts", "Auckland Viewshafts (Local + Volcanic)",
        ["viewshafts"],
        load_auckland_viewshafts,
    ),
    DataSource(
        "auckland_heritage_extent", "Auckland Heritage Extent of Place",
        ["heritage_extent"],
        load_auckland_heritage_extent,
    ),
    DataSource(
        "at_gtfs", "Auckland Transport GTFS + Travel Times",
        ["at_stops", "at_travel_times", "at_stop_frequency"],
        load_at_gtfs,
    ),
    # ── Christchurch ─────────────────────────────────────────
    DataSource(
        "chch_liquefaction", "Christchurch Liquefaction",
        ["liquefaction_detail"],
        load_christchurch_liquefaction,
    ),
    DataSource(
        "chch_flood", "Christchurch Flood Management",
        ["flood_hazard"],
        load_christchurch_flood,
    ),
    # ── Hamilton ─────────────────────────────────────────────
    DataSource(
        "hamilton_flood", "Hamilton Flood Hazard",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/hcc_entpublic/portal_floodviewer_floodhazard/FeatureServer/1",
            "flood_hazard", "hamilton",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Model_Name")) or "Flood Hazard Area",
                _clean(a.get("Hazard_Factor")) or "Medium",
                _clean(a.get("Storm_Event")) or "Flood",
            ),
        ),
    ),
    DataSource(
        "hamilton_plan_zones", "Hamilton District Plan Zones",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/agol_odp2017/DistrictPlan_Proposed_Decisions_2015_Zoning/MapServer/32",
            "district_plan_zones", "hamilton",
            ["zone_name", "zone_code", "category"],
            lambda a: (
                _clean(a.get("Zone_Description")),
                _clean(a.get("Zoning_Text")),
                _clean(a.get("SubZone_Text")),
            ),
        ),
    ),
    DataSource(
        "waikato_liquefaction", "Waikato Liquefaction (Level A)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/HAZ_LIQUEFACTION_LEVEL_A/FeatureServer/0",
            "liquefaction_detail", "waikato",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or _clean(a.get("Liquefaction")),
                _clean(a.get("SIMPLENAME")) or _clean(a.get("MAINROCK")),
            ),
        ),
    ),
    DataSource(
        "waikato_flood", "Waikato Local Flood Hazard",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/HAZ_MOD_LOCAL_FLOOD_HAZ_CLASS/FeatureServer/0",
            "flood_hazard", "waikato",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("LOCATION")) or "Flood Hazard",
                _clean(a.get("HAZARD_CLASS")) or "Medium",
                "Local Flood" + (f" ({a.get('CLIMATE_CHANGE')})" if _clean(a.get("CLIMATE_CHANGE")) else ""),
            ),
        ),
    ),
    # ── Tauranga ──────────────────────────────────────────────
    DataSource(
        "tauranga_flood", "Tauranga Flood Risk",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/fv_FloodRisk/FeatureServer/83",
            "flood_hazard", "tauranga",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("FloodRiskClassification")) or "Flood Risk Area",
                "High" if "300" in str(a.get("FloodRiskClassification") or "") else
                "Medium" if "100" in str(a.get("FloodRiskClassification") or "") or "Floodplain" in str(a.get("FloodRiskClassification") or "") else "Low",
                _clean(a.get("FloodRiskClassification")) or "Flood",
            ),
        ),
    ),
    DataSource(
        "tauranga_liquefaction", "Tauranga Liquefaction Vulnerability",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/Liquefaction/FeatureServer/0",
            "liquefaction_detail", "tauranga",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LiquefactionVulnerability")) or _clean(a.get("RuleID")),
                _clean(a.get("LateralSpreadArea")),
            ),
        ),
    ),
    DataSource(
        "tauranga_plan_zones", "Tauranga Planning Zones",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/City_Planning_Zones/MapServer/10",
            "district_plan_zones", "tauranga",
            ["zone_name", "zone_code", "category"],
            lambda a: (
                _clean(a.get("Description")) or _clean(a.get("Zone")),
                _clean(a.get("Zone")),
                None,
            ),
        ),
    ),
    DataSource(
        "tauranga_tsunami", "Tauranga Tsunami Evacuation Zones",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/Natural_Hazards__multiple_data_sources/MapServer/26",
            "tsunami_hazard", "tauranga",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Evacuation Zone",
                "High",
                _clean(a.get("AreaType")) or "Evacuation Zone",
            ),
        ),
    ),
    # ── Dunedin ──────────────────────────────────────────────
    DataSource(
        "dunedin_flood_h1", "Dunedin Flood Hazard 1",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_OverlayZones/MapServer/9",
            "flood_hazard", "dunedin",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Flood_Area")) or "Hazard 1 Flood",
                "High",
                _clean(a.get("Type")) or "Hazard 1 (flood)",
            ),
        ),
    ),
    DataSource(
        "dunedin_flood_h2", "Dunedin Flood Hazard 2",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_OverlayZones/MapServer/12",
            "flood_hazard", "dunedin_h2",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Flood_Area")) or "Hazard 2 Flood",
                "Medium",
                _clean(a.get("Type")) or "Hazard 2 (flood)",
            ),
        ),
    ),
    DataSource(
        "dunedin_flood_h3", "Dunedin Flood Hazard 3",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_OverlayZones/MapServer/14",
            "flood_hazard", "dunedin_h3",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Flood_Area")) or "Hazard 3 Flood",
                "Low",
                _clean(a.get("Type")) or "Hazard 3 (flood)",
            ),
        ),
    ),
    DataSource(
        "dunedin_land_instability", "Dunedin Land Instability",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_OverlayZones/MapServer/11",
            "slope_failure", "dunedin",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Category")) or "Land Instability",
                "High",
            ),
        ),
    ),
    DataSource(
        "dunedin_tsunami", "Dunedin/Otago Tsunami",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/Tsunami_AffectedArea_Final/FeatureServer/0",
            "tsunami_hazard", "dunedin",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Affected Area",
                "High",
                _clean(a.get("Scenario")) or _clean(a.get("LayerDescription")) or "Tsunami",
            ),
        ),
    ),
    DataSource(
        "dunedin_plan_zones", "Dunedin 2GP Zones (Residential)",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_Zones/MapServer/0",
            "district_plan_zones", "dunedin",
            ["zone_name", "zone_code", "category"],
            lambda a: (
                _clean(a.get("Sub_Zone")) or _clean(a.get("Zone")),
                _clean(a.get("Zone")),
                _clean(a.get("Location")),
            ),
        ),
    ),
    # ── Napier / Hastings (HBRC) ─────────────────────────────
    DataSource(
        "hbrc_flood", "Hawke's Bay Flood Risk Areas",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Flooding/MapServer/0",
            "flood_hazard", "hawkes_bay",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Location")) or "Flood Risk Area",
                "High" if _clean(a.get("Class")) == "Flood risk areas" else "Low",
                _clean(a.get("Class")) or "Flood",
            ),
        ),
    ),
    DataSource(
        "hbrc_liquefaction", "Hawke's Bay Liquefaction",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Earthquake_Liquefaction/MapServer/0",
            "liquefaction_detail", "hawkes_bay",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Hazard_Description")) or _clean(a.get("F3604_haza")),
                _clean(a.get("Confidence")),
            ),
        ),
    ),
    DataSource(
        "hbrc_tsunami", "Hawke's Bay Tsunami Inundation",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Tsunami_Inundation/MapServer/0",
            "tsunami_hazard", "hawkes_bay",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("NAME")) or "Tsunami Inundation Zone",
                "High",
                f"{_clean(a.get('WaveSource')) or 'Distant'} source, {a.get('Return_Period_Yrs') or '?'}yr return",
            ),
        ),
    ),
    DataSource(
        "hbrc_landslide_high", "Hawke's Bay High Landslide Risk",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Landslide_Risk/MapServer/1",
            "slope_failure", "hawkes_bay",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("ClassName")) or "High landslide risk",
                "High",
            ),
        ),
    ),
    # ── Nelson ───────────────────────────────────────────────
    DataSource(
        "nelson_flood", "Nelson River Flooding (Present Day)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/DataPublic/OurNaturalHazards/MapServer/0",
            "flood_hazard", "nelson",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Source")) or "River Flooding",
                "High" if _clean(a.get("AnnualExceedanceProbablity")) in ("1%", "2%") else "Medium",
                f"River Flood ({_clean(a.get('AnnualExceedanceProbablity')) or '?'} AEP)",
            ),
        ),
    ),
    DataSource(
        "nelson_liquefaction", "Nelson Liquefaction",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/DataPublic/OurNaturalHazards/MapServer/3",
            "liquefaction_detail", "nelson",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Type")) or "Potential Liquefaction",
                None,
            ),
        ),
    ),
    DataSource(
        "nelson_fault_hazard", "Nelson Fault Hazard Corridor",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/DataPublic/OurNaturalHazards/MapServer/4",
            "fault_zones", "nelson",
            ["name", "hazard_ranking"],
            lambda a: (
                "Waimea-Flaxmore Fault Corridor",
                "High",
            ),
        ),
    ),
    DataSource(
        "nelson_slope", "Nelson Slope Instability",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/DataPublic/SlopeInstabilityOverlay/MapServer/0",
            "slope_failure", "nelson",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("type")) or "Slope Instability",
                "High",
            ),
        ),
    ),
    # ── Hamilton extras ──────────────────────────────────────
    DataSource(
        "hamilton_overland_flood", "Hamilton Overland Flowpath Flood Hazard",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/agol_odp2017/DistrictPlan_Proposed_Decisions_2015_Features/MapServer/194",
            "flood_hazard", "hamilton_overland",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Overland Flowpath / Ponding",
                _clean(a.get("Adjusted_Hazard_Factor_Desc")) or "Medium",
                "Overland Flowpath",
            ),
        ),
    ),
    DataSource(
        "hamilton_riverbank_hazard", "Hamilton Riverbank & Gully Hazard",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/agol_odp2017/DistrictPlan_Proposed_Decisions_2015_Features/MapServer/195",
            "slope_failure", "hamilton",
            ["lskey", "severity"],
            lambda a: (
                "Riverbank & Gully Hazard",
                "High",
            ),
        ),
    ),
    DataSource(
        "hamilton_sna", "Hamilton Significant Natural Areas",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/agol_odp2017/DistrictPlan_Proposed_Decisions_2015_Features/MapServer/3",
            "significant_ecological_areas", "hamilton",
            ["name", "schedule", "eco_type"],
            lambda a: (
                _clean(a.get("Name")),
                _clean(a.get("DP_SNA_Number")),
                "Terrestrial",
            ),
        ),
    ),
    DataSource(
        "waikato_ground_shaking", "Waikato Earthquake Ground Shaking",
        ["ground_shaking"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_EARTHQUAKE_GROUND_SHAKING/FeatureServer/0",
            "ground_shaking", "waikato",
            ["zone", "severity"],
            lambda a: (
                _clean(a.get("RATING")),
                _clean(a.get("RATING")),
            ),
        ),
    ),
    # ── Tauranga extras ──────────────────────────────────────
    DataSource(
        "tauranga_slope", "Tauranga Slope Hazard Zones",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/Natural_Hazards__multiple_data_sources/MapServer/21",
            "slope_failure", "tauranga",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Type")) or "Slope Hazard",
                "High" if "Failure" in str(a.get("Type") or "") else "Medium",
            ),
        ),
    ),
    DataSource(
        "tauranga_coastal_erosion", "Tauranga Coastal Erosion (NZVD16)",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/Natural_Hazards__multiple_data_sources/MapServer/2",
            "coastal_erosion", "tauranga",
            ["name", "coast_type", "timeframe", "scenario", "sea_level_rise"],
            lambda a: (
                _clean(a.get("TYPE_")) or "Coastal Erosion",
                "Coastal",
                a.get("HORIZON"),
                _clean(a.get("Probability")),
                _clean(a.get("SlrNZVD16")),
            ),
        ),
    ),
    # ── Dunedin extras ───────────────────────────────────────
    DataSource(
        "dunedin_coastal_hazard", "Dunedin Coastal Hazard",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_OverlayZones/MapServer/16",
            "flood_hazard", "dunedin_coastal",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Location")) or "Coastal Hazard",
                _clean(a.get("Risk")) or "High",
                _clean(a.get("Category")) or "Coastal",
            ),
        ),
    ),
    DataSource(
        "dunedin_heritage_precinct", "Dunedin Heritage Precincts",
        ["character_precincts"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_OverlayZones/MapServer/7",
            "character_precincts", "dunedin",
            ["name", "type", "code"],
            lambda a: (
                _clean(a.get("Name")),
                _clean(a.get("Type")),
                _clean(a.get("Precinct")),
            ),
        ),
    ),
    # ── Queenstown-Lakes (QLDC) hazards ─────────────────────
    DataSource(
        "qldc_flood", "QLDC Flood Hazard Area",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Flooding/MapServer/3",
            "flood_hazard", "queenstown_lakes",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Source")) or "Flood Hazard Area",
                _clean(a.get("HazardLevel")) or _clean(a.get("Category")) or "Medium",
                "ORC Flood Hazard",
            ),
        ),
    ),
    DataSource(
        "qldc_liquefaction", "QLDC Liquefaction (GNS 2019)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Liquefaction/FeatureServer/3",
            "liquefaction_detail", "queenstown_lakes",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Susceptibility")) or _clean(a.get("LIQ_CLASS")) or _clean(a.get("Liquefaction_Susceptibility")),
                _clean(a.get("Domain")) or _clean(a.get("Geology")),
            ),
        ),
    ),
    DataSource(
        "qldc_landslide", "QLDC Landslide Areas",
        ["landslide_areas"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Other_Land_Hazards/MapServer/3",
            "landslide_areas", "queenstown_lakes",
            ["name", "source", "certainty"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Description")) or "Landslide Area",
                _clean(a.get("Source")) or "ORC",
                _clean(a.get("Certainty")) or _clean(a.get("Category")),
            ),
        ),
    ),
    DataSource(
        "otago_liquefaction", "Otago Region Liquefaction (GNS 2019)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/Seismic_LiquefactionOtago_2019/MapServer/0",
            "liquefaction_detail", "otago",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Susceptibility")) or _clean(a.get("LIQ_CLASS")),
                _clean(a.get("DOMAIN")) or _clean(a.get("GEOLOGY")),
            ),
        ),
    ),
    # ── ORC contaminated land (Dunedin/Otago HAIL) ──────────
    DataSource(
        "orc_hail", "Otago Region Contaminated Sites (HAIL)",
        ["contaminated_land"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/ORCHAILService/FeatureServer/0",
            "contaminated_land", "otago",
            ["site_name", "category", "site_history"],
            lambda a: (
                _clean(a.get("SiteName")) or _clean(a.get("Name")) or _clean(a.get("SITE_NAME")),
                _clean(a.get("Category")) or _clean(a.get("HAIL_CATEGORY")),
                _clean(a.get("Description")) or _clean(a.get("Activity")),
            ),
        ),
    ),
    # ── Whangarei District hazards ────────────────────────────
    DataSource(
        "whangarei_flood", "Whangarei Flood Susceptible Areas",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/Floods/MapServer/0",
            "flood_hazard", "whangarei",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Description")) or "Flood Susceptible",
                _clean(a.get("Category")) or "Medium",
                "Flood Susceptible",
            ),
        ),
    ),
    DataSource(
        "whangarei_liquefaction", "Whangarei Liquefaction Vulnerability (T+T 2020)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/Liquefaction/MapServer/1",
            "liquefaction_detail", "whangarei",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_VULN_CATEGORY")) or _clean(a.get("Category")) or _clean(a.get("Vulnerability")),
                _clean(a.get("GEOLOGY")) or _clean(a.get("Description")),
            ),
        ),
    ),
    DataSource(
        "whangarei_land_stability", "Whangarei Land Instability",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/Land_Stability/MapServer/1",
            "slope_failure", "whangarei",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Category")) or _clean(a.get("Name")) or "Land Instability",
                _clean(a.get("Susceptibility")) or _clean(a.get("Risk")),
            ),
        ),
    ),
    # ── Taranaki hazards (TRC Emergency Management) ──────────
    DataSource(
        "taranaki_faults", "Taranaki Active Faultlines",
        ["active_faults"],
        load_taranaki_faults,
    ),
    DataSource(
        "taranaki_tsunami", "Taranaki Tsunami Evacuation Zones",
        ["tsunami_zones"],
        load_taranaki_tsunami,
    ),
    DataSource(
        "taranaki_volcanic", "Taranaki Volcanic Hazard Zones",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://maps.trc.govt.nz/arcgis/rest/services/LocalMaps/EmergencyManagement/MapServer/3",
            "flood_hazard", "taranaki_volcanic",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Zone")) or "Volcanic Hazard",
                _clean(a.get("Category")) or "High",
                "Volcanic",
            ),
        ),
    ),
    # ── Christchurch slope + Canterbury faults ────────────────
    DataSource(
        "chch_slope_hazard", "Christchurch Slope Hazard (CCC)",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.ccc.govt.nz/server/rest/services/OpenData/LandCharacteristic/FeatureServer/1",
            "slope_failure", "christchurch",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Type")) or _clean(a.get("Name")) or "Slope Hazard",
                _clean(a.get("Category")) or _clean(a.get("Risk")),
            ),
        ),
    ),
    DataSource(
        "canterbury_faults", "Canterbury Fault Awareness Areas (ECan 2024)",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/EarthquakeFaults/MapServer/25",
            "fault_zones", "canterbury",
            ["name", "hazard_ranking", "fault_complexity"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("FaultName")) or "Canterbury Fault",
                _clean(a.get("Status")) or _clean(a.get("Classification")),
                _clean(a.get("Type")) or _clean(a.get("Complexity")),
            ),
        ),
    ),
    # ── Tauranga heritage + noise ─────────────────────────────
    DataSource(
        "tauranga_heritage", "Tauranga Built Heritage Sites",
        ["heritage_sites"],
        load_tauranga_heritage,
    ),
    DataSource(
        "tauranga_noise", "Tauranga Airport + Port Noise Contours",
        ["noise_contours"],
        load_tauranga_noise,
    ),
    # ── HBRC extras ──────────────────────────────────────────
    DataSource(
        "hbrc_contaminated", "Hawke's Bay Contaminated Sites",
        ["contaminated_land"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Contaminated_Sites/MapServer/19",
            "contaminated_land", "hawkes_bay",
            ["site_name", "category", "site_history"],
            lambda a: (
                _clean(a.get("SiteName")) or _clean(a.get("LocationCommonName")),
                _clean(a.get("Category")),
                _clean(a.get("CategotyContext")),
            ),
        ),
    ),
    DataSource(
        "hbrc_earthquake_amp", "Hawke's Bay Earthquake Amplification",
        ["ground_shaking"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Earthquake_Amplification/MapServer/0",
            "ground_shaking", "hawkes_bay",
            ["zone", "severity"],
            lambda a: (
                _clean(a.get("Relative_Earthquake_Amplificati")) or _clean(a.get("AMPLIFICAT")),
                _clean(a.get("Relative_Earthquake_Amplificati")) or _clean(a.get("AMPLIFICAT")),
            ),
        ),
    ),
    DataSource(
        "hbrc_coastal_hazard", "Hawke's Bay Coastal Hazard Zones",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Coastal_Hazard_Zones/MapServer/25",
            "flood_hazard", "hawkes_bay_coastal",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("LOCATION")) or "Coastal Hazard Zone",
                _clean(a.get("RiskZone")) or "High",
                _clean(a.get("CHZ_Type")) or "Coastal Hazard",
            ),
        ),
    ),
    # ══════════════════════════════════════════════════════════
    # NEW: Christchurch expanded data
    # ══════════════════════════════════════════════════════════
    DataSource("chch_plan_zones", "Christchurch District Plan Zones",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSP/FeatureServer/0",
            "district_plan_zones", "christchurch",
            ["zone_name", "zone_code", "category"],
            lambda a: (_clean(a.get("ZoneType")), _clean(a.get("ZoneCode")), None))),
    DataSource("chch_tsunami", "Christchurch Tsunami Inundation",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSP/FeatureServer/23",
            "tsunami_hazard", "christchurch",
            ["name", "hazard_ranking", "scenario"],
            lambda a: ("Tsunami Inundation", "High", _clean(a.get("TsunamiInundationStatus")) or "Tsunami"))),
    DataSource("chch_heritage", "Christchurch Heritage Items (polygons)",
        ["heritage_extent"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSP/FeatureServer/44",
            "heritage_extent", "christchurch",
            ["name", "schedule", "heritage_type"],
            lambda a: (_clean(a.get("Reference")), None, "Heritage Item"))),
    DataSource("chch_notable_trees", "Christchurch Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSP/FeatureServer/74",
            "notable_trees", "christchurch",
            ["name", "schedule", "tree_type"],
            lambda a: (_clean(a.get("SpeciesCommonName")) or _clean(a.get("Species")),
                        _clean(a.get("PlanReference")), "Notable Tree"),
            geom_type="point")),
    DataSource("chch_slope", "Christchurch Slope Hazard",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSP/FeatureServer/38",
            "slope_failure", "christchurch",
            ["lskey", "severity"],
            lambda a: (_clean(a.get("SlopeHazardCategory")) or "Slope Hazard",
                        _clean(a.get("SlopeHazardStatus")) or "High"))),
    DataSource("chch_coastal_erosion", "Christchurch Coastal Erosion",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSP/FeatureServer/42",
            "coastal_erosion", "christchurch",
            ["name", "coast_type", "scenario"],
            lambda a: ("Coastal Erosion", "Coastal",
                        _clean(a.get("ClimateScenario")) or _clean(a.get("Timeframe"))))),
    DataSource("chch_coastal_inundation", "Christchurch Coastal Inundation",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSP/FeatureServer/43",
            "coastal_inundation", "christchurch_coastal",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (_clean(a.get("Location")) or "Coastal Inundation",
                        "High" if _clean(a.get("Depth")) and float(a.get("Depth") or 0) > 0.5 else "Medium",
                        _clean(a.get("ClimateScenario"))))),
    DataSource("chch_flood_high", "Christchurch High Flood Hazard",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSP/FeatureServer/34",
            "flood_hazard", "christchurch_high",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (_clean(a.get("HighFloodHazardStatus")) or "High Flood Hazard", "High", "High Flood Hazard"))),
    # ── Rates / Valuations (council-specific field mappings) ─
    DataSource("auckland_rates", "Auckland Rates/Valuations (623K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/AGOL_RateAccountInfo1_gdb/FeatureServer/0",
            "auckland", "CV", "LV", None, "FORMATTEDADDRESS", srid=3857)),
    DataSource("chch_rates", "Christchurch Rates/Valuations (186K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/CorporateData/Rating/MapServer/0",
            "christchurch", "CapitalValue", "LandValue", "ImprovementsValue",
            geom_type="point")),
    DataSource("dunedin_rates", "Dunedin Rates/Valuations (58K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/Rates/MapServer/0",
            "dunedin", "Rateable_Value", None, None, "Formatted_address",
            page_size=1000)),
    DataSource("taranaki_rates", "Taranaki Rates/Valuations (58K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/MMPHUPU6MnEt0lEK/arcgis/rest/services/Property_Rating/FeatureServer/0",
            "taranaki", "Capital_Value", "Land_Value", None, "Property_Address")),
    DataSource("uhcc_rates", "Upper Hutt Rates/Valuations (10K, scraped)",
        ["council_valuations"],
        lambda conn, log=None: _load_uhcc(conn, log)),
    DataSource("hcc_rates", "Hutt City Rates/Valuations (46K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.huttcity.govt.nz/server01/rest/services/HCC_External_Data/MapServer/1",
            "hcc", "capital_value", "land_value", None, "prop_address")),
    DataSource("pcc_rates", "Porirua City Rates/Valuations (24K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Property/PropertyAdminExternal/MapServer/5",
            "PCC", "Total_Value", "Land_Value", "Imp_Value", "Address")),
    DataSource("kcdc_rates", "Kapiti Coast Rates/Valuations (27K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/Property_Public/MapServer/0",
            "KCDC", "Capital_Value", "Land_Value", "Improvements_Value", "Location")),
    DataSource("hdc_rates", "Horowhenua Rates/Valuations (19K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_Property/MapServer/1",
            "HDC", "VnzCapitalValue", "VnzLandValue", None, "VnzLocation",
            extra_where="TerritorialAuthority LIKE '%Horowhenua%'")),
    DataSource("whanganui_rates", "Whanganui Rates/Valuations (~25K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_Property/MapServer/1",
            "whanganui", "VnzCapitalValue", "VnzLandValue", None, "VnzLocation",
            extra_where="TerritorialAuthority LIKE '%Whanganui%'")),
    DataSource("manawatu_rates", "Manawatu District Rates/Valuations (~15K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_Property/MapServer/1",
            "manawatu", "VnzCapitalValue", "VnzLandValue", None, "VnzLocation",
            extra_where="TerritorialAuthority LIKE '%Manawatu%'")),
    DataSource("rangitikei_rates", "Rangitikei District Rates/Valuations (~10K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_Property/MapServer/1",
            "rangitikei", "VnzCapitalValue", "VnzLandValue", None, "VnzLocation",
            extra_where="TerritorialAuthority LIKE '%Rangitikei%'")),
    DataSource("tararua_rates", "Tararua District Rates/Valuations (~10K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_Property/MapServer/1",
            "tararua", "VnzCapitalValue", "VnzLandValue", None, "VnzLocation",
            extra_where="TerritorialAuthority LIKE '%Tararua%'")),
    DataSource("ruapehu_rates", "Ruapehu District Rates/Valuations (~8K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_Property/MapServer/1",
            "ruapehu", "VnzCapitalValue", "VnzLandValue", None, "VnzLocation",
            extra_where="TerritorialAuthority LIKE '%Ruapehu%'")),
    DataSource("tasman_rates", "Tasman Rates/Valuations (29K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Property/MapServer/0",
            "tasman", "CapitalValue", "LandValue", "ImprovementsValue", "PropertyLocation")),
    DataSource("marlborough_rates", "Marlborough Rates/Valuations (27K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/RatingInformation/MapServer/2",
            "marlborough", "CapitalValue", "LandValue", "ImprovementValue", None,
            page_size=1000)),
    # ── Waikato region councils (WRC Properties FeatureServer) ──
    # Uses PREDICTED_SITUATION_MAJOR_NAME to filter by town
    DataSource("waikato_dc_rates", "Waikato District Rates/Valuations (~21K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_PROPERTIES_WRC_EXT/FeatureServer/0",
            "waikato_dc", "CAPITAL_VALUE", "LAND_VALUE", None, "SITUATION_ADDRESS",
            srid=2193,
            extra_where="PREDICTED_SITUATION_MAJOR_NAME IN ('HUNTLY','NGARUAWAHIA','RAGLAN','TUAKAU','POKENO','TE KAUWHATA','MEREMERE','TE KOWHAI','TAUPIRI','GORDONTON','MATANGI','EUREKA','HOROTIU','WHATAWHATA','ONEWHERO','PORT WAIKATO','MERCER','TE AKAU','GLEN MASSEY')")),
    DataSource("thames_coromandel_rates", "Thames-Coromandel Rates/Valuations (~30K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_PROPERTIES_WRC_EXT/FeatureServer/0",
            "thames_coromandel", "CAPITAL_VALUE", "LAND_VALUE", None, "SITUATION_ADDRESS",
            srid=2193,
            extra_where="PREDICTED_SITUATION_MAJOR_NAME IN ('THAMES','COROMANDEL','WHITIANGA','WHANGAMATA','PAUANUI','TAIRUA','MATARANGI','WAIHI BEACH','COOKS BEACH','HAHEI','OPOUTERE','COLVILLE','KUAOTUNU','ONEMANA','WHANGAPOUA','HOTWATER BEACH','KOPU','MANAIA','TE RERENGA')")),
    DataSource("south_waikato_rates", "South Waikato Rates/Valuations (~12K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_PROPERTIES_WRC_EXT/FeatureServer/0",
            "south_waikato", "CAPITAL_VALUE", "LAND_VALUE", None, "SITUATION_ADDRESS",
            srid=2193,
            extra_where="PREDICTED_SITUATION_MAJOR_NAME IN ('TOKOROA','PUTARURU','TIRAU','ARAPUNI','LICHFIELD','KINLEITH')")),
    DataSource("matamata_piako_rates", "Matamata-Piako Rates/Valuations (~16K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_PROPERTIES_WRC_EXT/FeatureServer/0",
            "matamata_piako", "CAPITAL_VALUE", "LAND_VALUE", None, "SITUATION_ADDRESS",
            srid=2193,
            extra_where="PREDICTED_SITUATION_MAJOR_NAME IN ('MATAMATA','MORRINSVILLE','TE AROHA','WAHAROA','WALTON','HINUERA','TAHUNA')")),
    DataSource("waipa_rates", "Waipa District Rates/Valuations (~25K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_PROPERTIES_WRC_EXT/FeatureServer/0",
            "waipa", "CAPITAL_VALUE", "LAND_VALUE", None, "SITUATION_ADDRESS",
            srid=2193,
            extra_where="PREDICTED_SITUATION_MAJOR_NAME IN ('CAMBRIDGE','TE AWAMUTU','KIHIKIHI','PIRONGIA','OHAUPO','KARAPIRO','LEAMINGTON','TE PAHU')")),
    DataSource("hauraki_rates", "Hauraki District Rates/Valuations (~12K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_PROPERTIES_WRC_EXT/FeatureServer/0",
            "hauraki", "CAPITAL_VALUE", "LAND_VALUE", None, "SITUATION_ADDRESS",
            srid=2193,
            extra_where="PREDICTED_SITUATION_MAJOR_NAME IN ('WAIHI','PAEROA','NGATEA','TURUA','KEREPEHI','MACKAYTOWN','KARANGAHAKE')")),
    # ── Canterbury region councils (ECan Property_Details/MapServer/2) ──
    # TLA codes: 058=Hurunui, 059=Waimakariri, 062=Selwyn, 063=Ashburton,
    #            064=Timaru, 065=Mackenzie, 066=Waimate, 068=Waitaki
    DataSource("selwyn_rates", "Selwyn Rates/Valuations (~30K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Property_Details/MapServer/2",
            "selwyn", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            extra_where="TLA = '062'", page_size=1000)),
    DataSource("waimakariri_rates", "Waimakariri Rates/Valuations (~30K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Property_Details/MapServer/2",
            "waimakariri", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            extra_where="TLA = '059'", page_size=1000)),
    DataSource("ashburton_rates", "Ashburton Rates/Valuations (~20K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Property_Details/MapServer/2",
            "ashburton", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            extra_where="TLA = '063'", page_size=1000)),
    DataSource("timaru_rates", "Timaru Rates/Valuations (~25K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Property_Details/MapServer/2",
            "timaru", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            extra_where="TLA = '064'", page_size=1000)),
    DataSource("hurunui_rates", "Hurunui Rates/Valuations (~8K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Property_Details/MapServer/2",
            "hurunui", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            extra_where="TLA = '058'", page_size=1000)),
    DataSource("waimate_rates", "Waimate Rates/Valuations (~5K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Property_Details/MapServer/2",
            "waimate", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            extra_where="TLA = '066'", page_size=1000)),
    DataSource("mackenzie_rates", "Mackenzie Rates/Valuations (~4K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Property_Details/MapServer/2",
            "mackenzie", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            extra_where="TLA = '065'", page_size=1000)),
    DataSource("waitaki_rates", "Waitaki Rates/Valuations (~15K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Property_Details/MapServer/2",
            "waitaki", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            extra_where="TLA = '068'", page_size=1000)),
    DataSource("kaikoura_rates", "Kaikoura Rates/Valuations (~3.5K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Property_Details/MapServer/2",
            "kaikoura", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            extra_where="LocalCouncil LIKE '%Kaikoura%'", page_size=1000)),
    # ── Otago region councils (ORC PropertyExternal/MapServer/0) ──
    DataSource("central_otago_rates", "Central Otago Rates/Valuations (~18K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/PropertyExternal/MapServer/0",
            "central_otago", "CapitalValue", "LandValue", None, None,
            extra_where="RatingAuthority = 'Central Otago District'", page_size=1000)),
    DataSource("clutha_rates", "Clutha Rates/Valuations (~15K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/PropertyExternal/MapServer/0",
            "clutha", "CapitalValue", "LandValue", None, None,
            extra_where="RatingAuthority = 'Clutha District'", page_size=1000)),
    DataSource("dunedin_orc_rates", "Dunedin Rates/Valuations via ORC (~58K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/PropertyExternal/MapServer/0",
            "dunedin", "CapitalValue", "LandValue", None, None,
            extra_where="RatingAuthority = 'Dunedin City'", page_size=1000)),
    DataSource("queenstown_orc_rates", "Queenstown-Lakes Rates via ORC (~33K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/PropertyExternal/MapServer/0",
            "queenstown_lakes", "CapitalValue", "LandValue", None, None,
            extra_where="RatingAuthority = 'Queenstown Lakes District'", page_size=1000)),
    # ── West Coast councils (WCRC PropertyPublic/MapServer) ──
    DataSource("buller_rates", "Buller Rates/Valuations (~7.8K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/PropertyAndBoundaries/PropertyPublic/MapServer/0",
            "buller", "CapitalValue", "LandValue", "ImprovemntsValue", "Address1",
            page_size=1000)),
    DataSource("grey_westland_rates", "Grey + Westland Rates/Valuations (~24K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/PropertyAndBoundaries/PropertyPublic/MapServer/1",
            "grey_westland", "CapitalValue", "LandValue", "ImprovementsValue", "StreetAddress",
            page_size=1000)),
    # ── ECan resource consents ────────────────────────────────
    DataSource("ecan_resource_consents", "ECan Resource Consents (Canterbury, ~115K)",
        ["resource_consents"],
        lambda conn, log=None: _load_ecan_consents(conn, log)),
    # ── Hamilton heritage + trees ────────────────────────────
    DataSource("hamilton_heritage", "Hamilton Built Heritage",
        ["historic_heritage_overlay"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/agol_odp2017/DistrictPlan_Proposed_Decisions_2015_Features/MapServer/0",
            "historic_heritage_overlay", "hamilton",
            ["name", "schedule", "heritage_type"],
            lambda a: (_clean(a.get("Name")), _clean(a.get("ReferenceNo")),
                        _clean(a.get("Ranking"))),
            geom_type="point")),
    DataSource("hamilton_trees", "Hamilton Significant Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/agol_odp2017/DistrictPlan_Proposed_Decisions_2015_Features/MapServer/156",
            "notable_trees", "hamilton",
            ["name", "schedule", "tree_type"],
            lambda a: (_clean(a.get("CommonName")) or _clean(a.get("BotanicalName")),
                        _clean(a.get("ReferenceNo")), _clean(a.get("Category"))),
            geom_type="point")),
    # ── Dunedin heritage + trees + airport noise ─────────────
    DataSource("dunedin_heritage", "Dunedin Heritage Buildings",
        ["historic_heritage_overlay"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_ScheduledItems/MapServer/1",
            "historic_heritage_overlay", "dunedin",
            ["name", "schedule", "heritage_type"],
            lambda a: (_clean(a.get("Name")), _clean(a.get("DPlan_ID")),
                        _clean(a.get("Type")) or _clean(a.get("HNZ_Category"))),
            geom_type="point")),
    DataSource("dunedin_trees", "Dunedin Scheduled Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_ScheduledItems/MapServer/2",
            "notable_trees", "dunedin",
            ["name", "schedule", "tree_type"],
            lambda a: (_clean(a.get("Common_Name")), _clean(a.get("DPlan_ID")), "Scheduled Tree"),
            geom_type="point")),
    DataSource("dunedin_airport_noise", "Dunedin Airport Flight Fan",
        ["aircraft_noise_overlay"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/SecondGenerationPlan_ScheduledItems/MapServer/8",
            "aircraft_noise_overlay", "dunedin",
            ["name", "noise_level_dba", "noise_category"],
            lambda a: (f"Dunedin Airport ({_clean(a.get('Purpose')) or 'Flight Fan'})",
                        None, _clean(a.get("Height_Res")) or "Restriction Zone"))),
    # ── Napier/Hastings plan zones ───────────────────────────
    DataSource("hbrc_plan_zones", "Hawke's Bay District Plan Zones",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/ExternalServices/TLA_Regulatory_Planning_Layers/MapServer/2",
            "district_plan_zones", "hawkes_bay",
            ["zone_name", "zone_code", "category"],
            lambda a: (_clean(a.get("ZoneName")), None, _clean(a.get("TLA"))))),
    # ── Nelson notable trees ─────────────────────────────────
    DataSource("nelson_trees", "Nelson Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/NelsonPlan/Notable_Trees/MapServer/0",
            "notable_trees", "nelson",
            ["name", "schedule", "tree_type"],
            lambda a: (_clean(a.get("NP_CommonName")) or _clean(a.get("NP_BotanicalName")),
                        _clean(a.get("NPTreeID")), _clean(a.get("NelsonPlanCategory"))),
            geom_type="point")),
    # ══════════════════════════════════════════════════════════
    # REGIONAL GTFS TRANSIT
    # ══════════════════════════════════════════════════════════
    DataSource("christchurch_gtfs", "Christchurch Metro GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://apis.metroinfo.co.nz/rti/gtfs/v1/gtfs.zip", "christchurch")),
    DataSource("hamilton_gtfs", "Hamilton BUSIT GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://wrcscheduledata.blob.core.windows.net/wrcgtfs/busit-nz-public.zip", "hamilton")),
    DataSource("dunedin_gtfs", "Dunedin Orbus GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://www.orc.govt.nz/transit/google_transit.zip", "dunedin")),
    DataSource("nelson_gtfs", "Nelson eBus GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://data.trilliumtransit.com/gtfs/nsn-nz/nsn-nz.zip", "nelson")),
    DataSource("taranaki_gtfs", "New Plymouth Citylink GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://data.trilliumtransit.com/gtfs/trc-nz/trc-nz.zip", "taranaki")),
    DataSource("palmerston_north_gtfs", "Palmerston North Horizons GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://www.horizons.govt.nz/HRC/media/Data/files/tranzit/HRC_GTFS_Production.zip", "palmerston_north")),
    # ══════════════════════════════════════════════════════════
    # NORTH ISLAND — NEWLY DISCOVERED COUNCILS
    # ══════════════════════════════════════════════════════════
    # ── Wairarapa shared endpoint (Masterton, Carterton, South Wairarapa) ──
    DataSource("masterton_rates", "Masterton Rates/Valuations (~14K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/PropertyAndBoundaries/PropertyPublic/MapServer/0",
            "masterton", "CapitalValue", "LandValue", "ImprValue", "Location",
            page_size=1000)),
    DataSource("carterton_rates", "Carterton Rates/Valuations (~5K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/PropertyAndBoundaries/PropertyPublic/MapServer/1",
            "carterton", "CapitalValue", "LandValue", "ImprValue", "Location",
            page_size=1000)),
    DataSource("south_wairarapa_rates", "South Wairarapa Rates/Valuations (~8K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/PropertyAndBoundaries/PropertyPublic/MapServer/2",
            "south_wairarapa", "CapitalValue", "LandValue", "ImprValue", "Location",
            page_size=1000)),
    # ── Whakatane District ──
    DataSource("whakatane_rates", "Whakatane Rates/Valuations (~17K)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://gis.whakatane.govt.nz/arcgis/rest/services/Geocortex/PropertyRoadSearch/MapServer/2",
            "whakatane", "CapitalValue", "LandValue", None, "Location",
            page_size=1000)),
    # ── Waikato Regional — additional TAs by VG_NUMBER prefix ──
    DataSource("taupo_rates", "Taupo Rates/Valuations (~20K, partial WRC)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_PROPERTIES_WRC_EXT/FeatureServer/0",
            "taupo", "CAPITAL_VALUE", "LAND_VALUE", None, "SITUATION_ADDRESS",
            extra_where="VG_NUMBER LIKE '073%'")),
    DataSource("waitomo_rates", "Waitomo Rates/Valuations (~3K, partial WRC)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_PROPERTIES_WRC_EXT/FeatureServer/0",
            "waitomo", "CAPITAL_VALUE", "LAND_VALUE", None, "SITUATION_ADDRESS",
            extra_where="VG_NUMBER LIKE '056%'")),
    DataSource("otorohanga_rates", "Otorohanga Rates/Valuations (~3K, partial WRC)",
        ["council_valuations"],
        lambda conn, log=None: _load_rates(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_PROPERTIES_WRC_EXT/FeatureServer/0",
            "otorohanga", "CAPITAL_VALUE", "LAND_VALUE", None, "SITUATION_ADDRESS",
            extra_where="VG_NUMBER LIKE '055%'")),
    # ══════════════════════════════════════════════════════════
    # ADDITIONAL CONTAMINATED LAND REGISTERS (regional)
    # ══════════════════════════════════════════════════════════
    DataSource("southland_hail", "Southland Contaminated Land Register",
        ["contaminated_land"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://services1.arcgis.com/bkGMdMdLQmSKFLDY/arcgis/rest/services/Southland_Contaminated_Land_Register/FeatureServer/0",
            "contaminated_land", "southland",
            ["site_name", "category", "site_history"],
            lambda a: (
                _clean(a.get("SiteName")) or _clean(a.get("Name")),
                _clean(a.get("Category")) or _clean(a.get("LandUseCategory")),
                _clean(a.get("Activity")) or _clean(a.get("Description")),
            ),
            geom_type="point",
            srid=4326,
        ),
    ),
    DataSource("taranaki_hail", "Taranaki Selected Land Use Register",
        ["contaminated_land"],
        lambda conn, log=None: _load_council_arcgis(
            conn, log,
            "https://services1.arcgis.com/R6s0QqCMQdwKY6yp/arcgis/rest/services/Selected_Land_Use/FeatureServer/0",
            "contaminated_land", "taranaki",
            ["site_name", "category", "site_history"],
            lambda a: (
                _clean(a.get("SiteName")) or _clean(a.get("Site_Name")) or _clean(a.get("Name")),
                _clean(a.get("Category")) or _clean(a.get("HAIL_Category")),
                _clean(a.get("Activity")) or _clean(a.get("Land_Use")),
            ),
            geom_type="point",
            srid=4326,
        ),
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
