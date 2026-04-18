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
from datetime import date, datetime, timezone
from typing import Callable

import psycopg
from psycopg import sql

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


def _fetch_url(url: str, timeout: int = 120, extra_headers: dict | None = None) -> bytes:
    """Fetch URL with SSL fallback (dev only — prod always verifies)."""
    headers = {"User-Agent": "WhareScore/1.0"}
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, headers=headers)
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


def _fetch_arcgis(base_url: str, max_per_page: int = 1000, where: str = "1=1",
                   max_allowable_offset: float | None = None):
    """Fetch all features from ArcGIS REST with pagination (streaming generator).

    Yields features one at a time — constant memory regardless of dataset size.
    Callers iterate with ``for f in _fetch_arcgis(...):`` exactly as before.

    Handles two pagination strategies:
    1. Offset-based (if server supports resultOffset) — default
    2. ObjectID-based (fallback for MapServer layers that don't support offset)
       Uses ``where=OBJECTID > {last_oid}`` with ``orderByFields=OBJECTID ASC``

    ``max_allowable_offset`` (metres) simplifies geometry server-side, reducing
    transfer size for datasets with very dense vertices.
    """
    # ── Check if the service supports offset pagination ──────
    supports_pagination = True
    try:
        meta_url = f"{base_url}?f=json"
        meta = json.loads(_fetch_url(meta_url, timeout=30))
        # FeatureServer layers expose advancedQueryCapabilities
        adv = meta.get("advancedQueryCapabilities", {})
        if adv:
            supports_pagination = adv.get("supportsPagination", True)
        else:
            # MapServer layers: check supportsResultOffset or supportsPagination
            supports_pagination = meta.get("supportsPagination", meta.get("supportsResultOffset", False))
    except Exception:
        # If metadata fetch fails, try offset first and fall back if needed
        pass

    if supports_pagination:
        # ── Strategy 1: offset-based pagination ──────────────
        offset = 0
        while True:
            params = {
                "where": where, "outFields": "*", "f": "json",
                "returnGeometry": "true",
                "resultOffset": str(offset), "resultRecordCount": str(max_per_page),
            }
            if max_allowable_offset is not None:
                params["maxAllowableOffset"] = str(max_allowable_offset)
            url = f"{base_url}/query?{urllib.parse.urlencode(params)}"
            data = json.loads(_fetch_url(url))
            features = data.get("features", [])
            if not features:
                break
            yield from features
            offset += len(features)
            # Check exceededTransferLimit — if true, there are more records
            if data.get("exceededTransferLimit"):
                time.sleep(0.3)
                continue
            if len(features) < max_per_page:
                break
            time.sleep(0.3)
    else:
        # ── Strategy 2: ObjectID-based pagination ────────────
        # For MapServer layers that don't support resultOffset
        logger.info(f"Using ObjectID-based pagination for {base_url}")
        last_oid = -1
        while True:
            oid_where = f"OBJECTID > {last_oid}"
            if where and where != "1=1":
                oid_where = f"({where}) AND {oid_where}"
            params = {
                "where": oid_where, "outFields": "*", "f": "json",
                "returnGeometry": "true",
                "resultRecordCount": str(max_per_page),
                "orderByFields": "OBJECTID ASC",
            }
            if max_allowable_offset is not None:
                params["maxAllowableOffset"] = str(max_allowable_offset)
            url = f"{base_url}/query?{urllib.parse.urlencode(params)}"
            data = json.loads(_fetch_url(url))
            features = data.get("features", [])
            if not features:
                break
            yield from features
            # Track the last OBJECTID we received
            last_oid = max(
                f.get("attributes", {}).get("OBJECTID") or
                f.get("attributes", {}).get("objectid") or
                f.get("attributes", {}).get("FID") or 0
                for f in features
            )
            if last_oid <= 0:
                # No OBJECTID field found — can't paginate further
                logger.warning(f"No OBJECTID field found in features from {base_url}, stopping after first page")
                break
            # Check exceededTransferLimit — if true, there are more records
            if data.get("exceededTransferLimit"):
                time.sleep(0.3)
                continue
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


def _derive_zone_category(zone_name: str | None) -> str | None:
    """Infer a category label ('Residential', 'Business', etc.) from a zone name
    when the council's ArcGIS feed doesn't expose a separate category/group field.
    Used by loaders like CHC and QLDC that only give us one descriptive string.
    Keywords are checked in specificity order so 'Rural Residential' wins over
    plain 'Rural' and 'Mixed Use' beats 'Business'."""
    if not zone_name:
        return None
    n = zone_name.lower()
    if "rural residential" in n or "lifestyle" in n:
        return "Rural Residential"
    if "mixed use" in n:
        return "Mixed Use"
    if "city centre" in n or "town centre" in n or "metropolitan centre" in n or "local centre" in n or "neighbourhood centre" in n:
        return "Centre"
    if "residential" in n:
        return "Residential"
    if "business" in n or "commercial" in n or "office" in n or "retail" in n:
        return "Business"
    if "industrial" in n:
        return "Industrial"
    if "rural" in n or "countryside" in n:
        return "Rural"
    if "open space" in n or "recreation" in n or "reserve" in n or "park" in n:
        return "Open Space"
    if "special" in n or "precinct" in n or "activity area" in n:
        return "Special Purpose"
    if "future urban" in n or "future development" in n:
        return "Future Urban"
    if "coastal" in n or "marine" in n or "waterfront" in n or "harbour" in n:
        return "Coastal"
    return None


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
        cur.execute(
            sql.SQL("DELETE FROM {} WHERE source_council = %s").format(sql.Identifier(table)),
            (council,),
        )
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
            placeholders = sql.SQL(", ").join([sql.Placeholder()] * len(cols))
            col_ids = sql.SQL(", ").join([sql.Identifier(c) for c in cols])
            cur.execute(
                sql.SQL(
                    "INSERT INTO {} ({}, source_council, geom) "
                    "VALUES ({}, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))"
                ).format(sql.Identifier(table), col_ids, placeholders),
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
        zone_name = _clean(a.get("DPZone"))
        raw_category = _clean(a.get("Category"))
        # WCC's "Category" field sometimes returns the literal string "Zone"
        # (or matches the zone_name), neither of which is meaningful to users.
        # Fall back to _derive_zone_category so the frontend can render
        # "Residential", "Business", etc.
        if not raw_category or raw_category.strip().lower() == "zone" or raw_category == zone_name:
            raw_category = _derive_zone_category(zone_name)
        cur.execute(
            "INSERT INTO district_plan_zones (zone_name, zone_code, category, chapter, eplan_url, status, geom) "
            "VALUES (%s,%s,%s,%s,%s,%s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (zone_name, _clean(a.get("DPZoneCode")), raw_category,
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
    max_allowable_offset: float | None = None,
    page_size: int = 2000,
) -> int:
    """Generic council ArcGIS loader. Deletes council rows, re-inserts."""
    _progress(log, f"Fetching {table} ({council})...")
    features = _fetch_arcgis(url, page_size, max_allowable_offset=max_allowable_offset)
    cur = conn.cursor()
    if not skip_delete:
        cur.execute(
            sql.SQL("DELETE FROM {} WHERE source_council = %s").format(sql.Identifier(table)),
            (council,),
        )
    col_ids = sql.SQL(", ").join([sql.Identifier(c) for c in cols])
    placeholders = sql.SQL(", ").join([sql.Placeholder()] * len(cols))
    insert_q = sql.SQL(
        "INSERT INTO {} ({}, source_council, geom) "
        "VALUES ({}, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), %s), 4326))"
    ).format(sql.Identifier(table), col_ids, placeholders)
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
        try:
            cur.execute(insert_q, (*vals, council, wkt, srid))
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"  {table} ({council}): {count} rows")
    return count


def _load_council_wfs(
    conn: psycopg.Connection, log: Callable,
    base_url: str, type_name: str, table: str, council: str,
    cols: list[str], extract: Callable,
    srid: int = 4326, geom_type: str = "polygon",
    max_features: int = 50000,
) -> int:
    """Generic WFS GeoJSON loader. Deletes council rows, re-inserts."""
    _progress(log, f"Fetching {table} ({council}) via WFS...")
    url = (
        f"{base_url}?service=WFS&version=1.1.0&request=GetFeature"
        f"&typeName={type_name}&outputFormat=application/json&maxFeatures={max_features}"
    )
    try:
        data = json.loads(_fetch_url(url, timeout=180))
    except Exception as e:
        _progress(log, f"  WFS error for {type_name}: {e}")
        return 0
    features = data.get("features", [])
    cur = conn.cursor()
    cur.execute(
        sql.SQL("DELETE FROM {} WHERE source_council = %s").format(sql.Identifier(table)),
        (council,),
    )
    col_ids = sql.SQL(", ").join([sql.Identifier(c) for c in cols])
    placeholders = sql.SQL(", ").join([sql.Placeholder()] * len(cols))
    insert_q = sql.SQL(
        "INSERT INTO {} ({}, source_council, geom) "
        "VALUES ({}, %s, ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(%s), %s), 4326))"
    ).format(sql.Identifier(table), col_ids, placeholders)
    count = 0
    for feat in features:
        props = feat.get("properties", {})
        geom_json = feat.get("geometry")
        if not geom_json:
            continue
        vals = extract(props)
        try:
            cur.execute(insert_q, (*vals, council, json.dumps(geom_json), srid))
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
    """Auckland flood prone areas. The AC 'Flood_Prone_Areas' FeatureServer has
    no human-readable name field — only FPA_ID (numeric), depth, and volume — so
    we synthesize a descriptive label from the 100-year ARI depth instead of
    leaking OBJECTIDs into hazards.flood_extent_label."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Flood_Prone_Areas/FeatureServer/0"

    def _label(a: dict) -> str:
        depth = a.get("Depth100y")
        try:
            d = float(depth) if depth is not None else None
        except (TypeError, ValueError):
            d = None
        if d is None or d <= 0:
            return "Flood Prone Area (100-yr ARI)"
        return f"Flood Prone Area ({d:.1f}m depth, 100-yr ARI)"

    return _load_council_arcgis(
        conn, log, url, "flood_hazard", "auckland",
        ["name", "hazard_ranking", "hazard_type"],
        lambda a: (
            _label(a),
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


def _fetch_arcgis_coded_value_domains(base_url: str) -> dict[str, dict]:
    """Return a dict {field_name: {code: name}} built from a FeatureServer layer's
    metadata. ArcGIS FeatureServer publishes coded-value domains under
    layer.fields[].domain.codedValues even though query responses return raw codes
    (returnDomainValues=true is unreliable on FeatureServer)."""
    try:
        meta = json.loads(_fetch_url(f"{base_url}?f=json"))
    except Exception as e:
        logger.warning(f"Could not fetch ArcGIS layer metadata for {base_url}: {e}")
        return {}
    out: dict[str, dict] = {}
    for field in meta.get("fields", []):
        domain = field.get("domain") or {}
        if domain.get("type") != "codedValue":
            continue
        mapping = {cv.get("code"): cv.get("name") for cv in domain.get("codedValues", [])}
        # Store under the field name; keys are typically ints but also register
        # stringified keys for safety since some ArcGIS servers return codes as
        # strings.
        combined = {}
        for k, v in mapping.items():
            combined[k] = v
            combined[str(k)] = v
        out[field["name"]] = combined
    return out


def load_auckland_plan_zones(conn: psycopg.Connection, log: Callable = None) -> int:
    """Auckland Unitary Plan base zones. The FeatureServer exposes ZONE and
    GROUPZONE as numeric codes (e.g. 35 = 'Business - City Centre Zone'), so we
    read the coded-value domains from the layer metadata and resolve them before
    inserting."""
    url = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Unitary_Plan_Base_Zone/FeatureServer/0"
    _progress(log, "Fetching Auckland Unitary Plan zones...")
    domains = _fetch_arcgis_coded_value_domains(url)
    zone_lookup = domains.get("ZONE") or {}
    group_lookup = domains.get("GROUPZONE") or {}
    if not zone_lookup:
        logger.warning("Auckland plan zones: ZONE coded-value domain missing; zone names will fall back to raw codes")

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
        raw_zone = a.get("ZONE")
        raw_group = a.get("GROUPZONE")
        # Resolve codes → human names. Doubles like 35.0 also need to hit the
        # lookup, so try the int form too.
        def _resolve(lookup: dict, code):
            if code is None:
                return None
            if code in lookup:
                return lookup[code]
            try:
                return lookup.get(int(code))
            except (TypeError, ValueError):
                return None

        zone_name = _resolve(zone_lookup, raw_zone) or _clean(a.get("NAME"))
        group_name = _resolve(group_lookup, raw_group)
        # Fall back to the raw code only as a last resort so the report doesn't
        # render integers.
        if not zone_name and raw_zone is not None:
            zone_name = str(raw_zone)
        zone_code = str(int(raw_zone)) if isinstance(raw_zone, (int, float)) and raw_zone is not None else (str(raw_zone) if raw_zone is not None else "")
        cur.execute(
            "INSERT INTO district_plan_zones (zone_name, zone_code, category, source_council, geom) "
            "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            (zone_name, zone_code, group_name, council, wkt),
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
    features = _fetch_arcgis(url, 2000, max_allowable_offset=20)
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
        try:
            cur.execute(
                "INSERT INTO overland_flow_paths (catchment_group, source_council, geom) "
                "VALUES (%s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (a.get("CATCHMENTAREAGROUP"), "auckland", wkt),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 5000 == 0:
            conn.commit()
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
        "Hamilton Airport": (175.3320, -37.8670),
        "Rototuna": (175.3060, -37.7360),
    },
    "dunedin": {
        "Dunedin CBD (Octagon)": (170.5028, -45.8742),
        "Dunedin Hospital": (170.5060, -45.8710),
        "University of Otago": (170.5130, -45.8660),
        "South Dunedin": (170.5050, -45.8950),
        "Mosgiel": (170.3490, -45.8750),
        "Port Chalmers": (170.6240, -45.8160),
        "St Clair": (170.4880, -45.9120),
        "Dunedin Airport": (170.1980, -45.9280),
    },
    "nelson": {
        "Nelson CBD": (173.2840, -41.2710),
        "Nelson Hospital": (173.2890, -41.2700),
        "Richmond": (173.1830, -41.3370),
        "Stoke": (173.2360, -41.3010),
        "Tahunanui": (173.2540, -41.2880),
        "Nelson Airport": (173.2210, -41.2980),
    },
    "taranaki": {
        "New Plymouth CBD": (174.0752, -39.0558),
        "Taranaki Base Hospital": (174.0650, -39.0650),
        "Bell Block": (174.0960, -39.0220),
        "Fitzroy": (174.1010, -39.0570),
        "Merrilands": (174.0530, -39.0480),
        "Westown": (174.0480, -39.0580),
    },
    "palmerston_north": {
        "Palmerston North CBD (The Square)": (175.6120, -40.3523),
        "Palmerston North Hospital": (175.6200, -40.3560),
        "Massey University": (175.6180, -40.3870),
        "Palmerston North Airport": (175.6190, -40.3200),
        "Arena Manawatu": (175.5930, -40.3710),
        "Highbury": (175.5970, -40.3610),
    },
    "hawkes_bay": {
        "Napier CBD": (176.9190, -39.4910),
        "Hastings CBD": (176.8420, -39.6390),
        "Napier Hospital": (176.8990, -39.4920),
        "Hastings Hospital": (176.8520, -39.6360),
        "EIT Hawke's Bay": (176.8870, -39.4960),
        "Taradale": (176.8560, -39.5370),
        "Havelock North": (176.8830, -39.6650),
        "Napier Airport": (176.8700, -39.4660),
    },
    "whangarei": {
        "Whangarei CBD": (174.3230, -35.7250),
        "Whangarei Hospital": (174.3190, -35.7210),
        "NorthTec": (174.3260, -35.7200),
        "Kamo": (174.3070, -35.6870),
        "Tikipunga": (174.3020, -35.6980),
        "Onerahi": (174.3590, -35.7370),
    },
    "tauranga_bop": {
        "Tauranga CBD": (176.1675, -37.6878),
        "Tauranga Hospital": (176.1580, -37.6970),
        "Mount Maunganui": (176.1830, -37.6380),
        "Papamoa": (176.2770, -37.6930),
        "Bayfair": (176.2070, -37.6680),
        "Bethlehem": (176.1180, -37.6870),
        "Greerton": (176.1310, -37.7200),
        "Tauranga Airport": (176.1960, -37.6720),
        "Tauriko": (176.0880, -37.7290),
        "University of Waikato Tauranga": (176.1720, -37.6860),
    },
    "rotorua": {
        "Rotorua CBD": (176.2510, -38.1370),
        "Rotorua Hospital": (176.2610, -38.1290),
        "Rotorua Airport": (176.3170, -38.1090),
        "Whakarewarewa": (176.2510, -38.1650),
        "Western Heights": (176.2190, -38.1310),
        "Ngongotaha": (176.2240, -38.0850),
    },
    "queenstown": {
        "Queenstown CBD": (168.6626, -45.0312),
        "Queenstown Airport": (168.7390, -45.0210),
        "Frankton": (168.7280, -45.0140),
        "Arrowtown": (168.8340, -44.9380),
        "Remarkables Park": (168.7280, -45.0300),
        "Lake Hayes": (168.7960, -44.9840),
        "Jack's Point": (168.7230, -45.0610),
    },
}


def _load_regional_gtfs(
    conn: psycopg.Connection, log: Callable,
    gtfs_url: str, region_name: str,
    extra_headers: dict | None = None,
) -> int:
    """Regional GTFS loader — loads stops + computes travel times to key destinations."""
    _progress(log, f"Downloading {region_name} GTFS...")
    zip_data = _fetch_url(gtfs_url, timeout=180, extra_headers=extra_headers)
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


def _parse_arcgis_date(raw) -> date | None:
    """ArcGIS esriFieldTypeDate values come as epoch-millis ints.
    Returns a date (not datetime) since council_valuations.valuation_date is DATE.
    Guards against epoch-0 sentinels and malformed values.
    """
    if raw is None:
        return None
    try:
        ms = int(raw)
    except (TypeError, ValueError):
        return None
    if ms <= 0:
        return None
    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).date()
    except (OverflowError, OSError, ValueError):
        return None


def _load_rates(
    conn: psycopg.Connection, log: Callable,
    url: str, council: str,
    cv_field: str, lv_field: str, iv_field: str | None,
    addr_field: str | None = None,
    geom_type: str = "polygon", srid: int = 2193,
    extra_where: str | None = None,
    page_size: int = 2000,
    date_field: str | None = None,
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
        val_date = _parse_arcgis_date(a.get(date_field)) if date_field else None

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
                f"INSERT INTO council_valuations (council, capital_value, land_value, improvements_value, address, valuation_date, geom) "
                f"VALUES (%s, %s, %s, %s, %s, %s, {geom_sql})",
                (council, cv, lv, iv, addr, val_date, *geom_params),
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
    """Taranaki tsunami evacuation zones → tsunami_hazard table (council schema)."""
    return _load_council_arcgis(
        conn, log,
        "https://maps.trc.govt.nz/arcgis/rest/services/LocalMaps/EmergencyManagement/MapServer/2",
        "tsunami_hazard", "taranaki",
        ["name", "hazard_ranking", "scenario"],
        lambda a: (
            _clean(a.get("Name")) or _clean(a.get("Zone")) or "Tsunami Zone",
            "High",
            "Taranaki Tsunami Evacuation",
        ),
    )


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


# ── DOC Huts ─────────────────────────────────────────────────

def load_doc_huts(conn: psycopg.Connection, log: Callable = None) -> int:
    """DOC backcountry huts (national)."""
    url = "https://mapserver.doc.govt.nz/arcgis/rest/services/DTO/Huts/MapServer/0"
    _progress(log, "Fetching DOC huts...")
    cur = conn.cursor()
    cur.execute("TRUNCATE doc_huts RESTART IDENTITY")
    conn.commit()
    features = _fetch_arcgis(url, 2000)
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue
        x, y = geom.get("x"), geom.get("y")
        if x is None or y is None:
            continue
        try:
            cur.execute(
                "INSERT INTO doc_huts (name, status, category, equipment, geom) "
                "VALUES (%s, %s, %s, %s, "
                "ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 2193), 4326))",
                (
                    _clean(a.get("DESCRIPTION")),
                    _clean(a.get("STATUS")),
                    _clean(a.get("CATEGORY_DESCRIPTION")),
                    _clean(a.get("EQUIPMENT")),
                    x, y,
                ),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"DOC huts: {count} rows")
    return count


# ── DOC Tracks ───────────────────────────────────────────────

def load_doc_tracks(conn: psycopg.Connection, log: Callable = None) -> int:
    """DOC tracks (national)."""
    url = "https://mapserver.doc.govt.nz/arcgis/rest/services/DTO/AllTracks/MapServer/0"
    _progress(log, "Fetching DOC tracks...")
    cur = conn.cursor()
    cur.execute("TRUNCATE doc_tracks RESTART IDENTITY")
    conn.commit()
    features = _fetch_arcgis(url, 2000)
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
                "INSERT INTO doc_tracks (name, status, category, track_type, url, geom) "
                "VALUES (%s, %s, %s, %s, %s, "
                "ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (
                    _clean(a.get("DESCRIPTION")),
                    _clean(a.get("STATUS")),
                    _clean(a.get("CATEGORY_DESCRIPTION")),
                    _clean(a.get("OBJECT_TYPE_DESCRIPTION")),
                    _clean(a.get("URL")),
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
    _progress(log, f"DOC tracks: {count} rows")
    return count


# ── DOC Campsites ────────────────────────────────────────────

def load_doc_campsites(conn: psycopg.Connection, log: Callable = None) -> int:
    """DOC campsites (national)."""
    url = "https://mapserver.doc.govt.nz/arcgis/rest/services/DTO/Campsites/MapServer/0"
    _progress(log, "Fetching DOC campsites...")
    cur = conn.cursor()
    cur.execute("TRUNCATE doc_campsites RESTART IDENTITY")
    conn.commit()
    features = _fetch_arcgis(url, 2000)
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue
        x, y = geom.get("x"), geom.get("y")
        if x is None or y is None:
            continue
        try:
            cur.execute(
                "INSERT INTO doc_campsites (name, status, category, equipment, geom) "
                "VALUES (%s, %s, %s, %s, "
                "ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 2193), 4326))",
                (
                    _clean(a.get("DESCRIPTION")),
                    _clean(a.get("STATUS")),
                    _clean(a.get("CATEGORY_DESCRIPTION")),
                    _clean(a.get("EQUIPMENT")),
                    x, y,
                ),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"DOC campsites: {count} rows")
    return count


# ── School Enrolment Zones ───────────────────────────────────

def load_school_zones(conn: psycopg.Connection, log: Callable = None) -> int:
    """MoE school enrolment zone boundaries (national)."""
    url = "https://services.arcgis.com/XTtANUDT8Va4DLwI/arcgis/rest/services/NZ_School_Zone_boundaries/FeatureServer/0"
    _progress(log, "Fetching school enrolment zones...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("TRUNCATE school_zones RESTART IDENTITY")
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        school_id = a.get("School_ID")
        try:
            school_id = int(school_id) if school_id else None
        except (ValueError, TypeError):
            school_id = None
        try:
            cur.execute(
                "INSERT INTO school_zones (school_id, school_name, institution_type, geom) "
                "VALUES (%s, %s, %s, "
                "ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (
                    school_id,
                    _clean(a.get("School_name")),
                    _clean(a.get("Institution_type")),
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
    _progress(log, f"School zones: {count} rows")
    return count


# ── NZTA National Road Noise Contours ────────────────────────

def load_nzta_noise_contours(conn: psycopg.Connection, log: Callable = None) -> int:
    """Waka Kotahi national road noise contours."""
    url = "https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services/Road_Noise_Contours/FeatureServer/0"
    _progress(log, "Fetching NZTA national road noise contours...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("DELETE FROM noise_contours WHERE source_council = %s", ("nzta_national",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom or not geom.get("rings"):
            continue
        wkt = _mp_wkt(geom)
        if not wkt:
            continue
        laeq_raw = a.get("LAeq24h")
        try:
            laeq = int(float(laeq_raw)) if laeq_raw is not None else None
        except (ValueError, TypeError):
            laeq = None
        try:
            cur.execute(
                "INSERT INTO noise_contours (laeq24h, source_council, geom) "
                "VALUES (%s, %s, "
                "ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                (laeq, "nzta_national", wkt),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"  noise_contours (nzta_national): {count} rows")
    return count


# ── Northland Regional Council Contaminated Land ─────────────

def load_nrc_contaminated_land(conn: psycopg.Connection, log: Callable = None) -> int:
    """Northland Regional Council contaminated land (IRIS SLUs) — point geometry."""
    url = "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/IRIS_SLUs/FeatureServer/0"
    _progress(log, "Fetching NRC contaminated land (IRIS SLUs)...")
    features = _fetch_arcgis(url, 2000)
    cur = conn.cursor()
    cur.execute("DELETE FROM contaminated_land WHERE source_council = %s", ("northland",))
    count = 0
    for f in features:
        a = f.get("attributes", {})
        geom = f.get("geometry")
        if not geom:
            continue
        x, y = geom.get("x"), geom.get("y")
        if x is None or y is None:
            continue
        # Map NRC fields to contaminated_land columns
        site_id = _clean(a.get("IRISID"))
        category = _clean(a.get("Classification"))
        hail_cats = _clean(a.get("HailCategories"))
        status = _clean(a.get("CurrentStatus"))
        try:
            cur.execute(
                "INSERT INTO contaminated_land "
                "(site_id, site_name, category, anzecc_category, site_history, source_council, geom) "
                "VALUES (%s, %s, %s, %s, %s, %s, "
                "ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 2193), 4326))",
                (
                    site_id,
                    f"IRIS {site_id}" if site_id else None,
                    category,
                    hail_cats,
                    status,
                    "northland",
                    x, y,
                ),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 2000 == 0:
            conn.commit()
    conn.commit()
    _progress(log, f"  contaminated_land (northland): {count} rows")
    return count


# ═══════════════════════════════════════════════════════════════
# NATIONAL WATERWAYS (LINZ Topo50)
# ═══════════════════════════════════════════════════════════════


def load_linz_waterways(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load NZ river/stream/drain centrelines from LINZ WFS (Topo50 layer 103632).

    Dataset: NZ River Name Lines (Pilot) — 774K features including rivers,
    drains, and canals. Coordinates in NZTM (EPSG:2193), transformed to WGS84.
    Used for waterway proximity analysis in property reports.
    """
    from ..config import settings

    api_key = settings.LINZ_API_KEY
    if not api_key:
        _progress(log, "LINZ_API_KEY not set — skipping waterways")
        return 0

    base_url = f"https://data.linz.govt.nz/services;key={api_key}/wfs"
    cur = conn.cursor()

    # Ensure table exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS nz_waterways (
            id SERIAL PRIMARY KEY,
            linz_id INTEGER,
            feat_type VARCHAR(20),
            name TEXT,
            name_ascii TEXT,
            geom GEOMETRY(LineString, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_nz_waterways_geom ON nz_waterways USING GIST (geom);
        CREATE INDEX IF NOT EXISTS idx_nz_waterways_feat_type ON nz_waterways (feat_type);
    """)
    conn.commit()

    cur.execute("TRUNCATE nz_waterways RESTART IDENTITY")
    conn.commit()

    _progress(log, "Fetching LINZ waterways via WFS (774K features — this takes a few minutes)...")

    count = 0
    page_size = 10000
    start_index = 0
    batch = []

    while True:
        params = urllib.parse.urlencode({
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeNames": "layer-103632",
            "outputFormat": "application/json",
            "count": str(page_size),
            "startIndex": str(start_index),
        })
        url = f"{base_url}?{params}"
        try:
            raw = _fetch_url(url, timeout=120)
            data = json.loads(raw)
        except Exception as e:
            _progress(log, f"  WFS page failed at offset {start_index}: {e}")
            break

        features = data.get("features", [])
        if not features:
            break

        for f in features:
            props = f.get("properties", {})
            geom = f.get("geometry")
            if not geom or geom.get("type") not in ("LineString", "MultiLineString"):
                continue

            coords = geom.get("coordinates", [])
            if not coords:
                continue

            # Build WKT — handle both LineString and MultiLineString
            if geom["type"] == "LineString":
                wkt = "LINESTRING(" + ", ".join(f"{c[0]} {c[1]}" for c in coords) + ")"
            else:
                # MultiLineString → take first line
                wkt = "LINESTRING(" + ", ".join(f"{c[0]} {c[1]}" for c in coords[0]) + ")"

            batch.append((
                props.get("river_section_id") or props.get("id"),
                props.get("feat_type"),
                _clean(props.get("name")),
                _clean(props.get("name_ascii")),
                wkt,
            ))

        start_index += len(features)

        # Flush batch every 10K
        if len(batch) >= 5000:
            cur.executemany(
                "INSERT INTO nz_waterways (linz_id, feat_type, name, name_ascii, geom) "
                "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                batch,
            )
            count += len(batch)
            conn.commit()
            batch = []
            _progress(log, f"  {count} waterways loaded...")

        if len(features) < page_size:
            break

        time.sleep(0.5)  # Be polite to LINZ API

    # Flush remaining
    if batch:
        cur.executemany(
            "INSERT INTO nz_waterways (linz_id, feat_type, name, name_ascii, geom) "
            "VALUES (%s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
            batch,
        )
        count += len(batch)
        conn.commit()

    _progress(log, f"LINZ waterways total: {count} rows")
    return count


# ── Census 2023 Demographics (SA2) ────────────────────────────

def load_census_demographics(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load Census 2023 individual demographics by SA2 from Stats NZ ArcGIS."""
    base = "https://services2.arcgis.com/vKb0s8tBIA3bdocZ/arcgis/rest/services/2023_Census_totals_by_topic_for_individuals_by_SA2/FeatureServer/0"
    _progress(log, "Fetching Census 2023 demographics (individuals by SA2)...")

    # Field mapping: VAR code → our column
    # VAR_1_2 = pop 2018, VAR_1_3 = pop 2023
    # VAR_1_80-83 = age life cycle 2023, VAR_1_69 = median age 2023
    # VAR_1_158-168 = ethnicity 2023
    # VAR_1_95-96 = birthplace 2023
    # VAR_1_270-271 = gender 2023
    # VAR_1_205-206,212 = languages 2023
    out_fields = (
        "SA22023_V1_00,SA22023_V1_00_NAME_ASCII,"
        "VAR_1_2,VAR_1_3,"
        "VAR_1_80,VAR_1_81,VAR_1_82,VAR_1_83,VAR_1_69,"
        "VAR_1_158,VAR_1_159,VAR_1_160,VAR_1_161,VAR_1_162,VAR_1_163,VAR_1_167,"
        "VAR_1_95,VAR_1_96,"
        "VAR_1_270,VAR_1_271,"
        "VAR_1_205,VAR_1_206,VAR_1_212"
    )

    cur = conn.cursor()
    cur.execute("TRUNCATE census_demographics")
    conn.commit()

    # Paginate through all SA2 records
    offset = 0
    count = 0
    while True:
        url = (
            f"{base}/query?where=1%3D1&outFields={out_fields}"
            f"&returnGeometry=false&resultRecordCount=2000&resultOffset={offset}&f=json"
        )
        data = json.loads(_fetch_url(url, timeout=60))
        features = data.get("features", [])
        if not features:
            break

        for f in features:
            a = f.get("attributes", {})
            sa2_code = a.get("SA22023_V1_00")
            if not sa2_code:
                continue

            def _v(key, default=None):
                val = a.get(key)
                if val is None or val == -999:
                    return default
                return val

            try:
                cur.execute(
                    """INSERT INTO census_demographics (
                        sa2_code, sa2_name,
                        population_2018, population_2023,
                        age_under_15, age_15_to_29, age_30_to_64, age_65_plus, median_age,
                        ethnicity_european, ethnicity_maori, ethnicity_pacific, ethnicity_asian,
                        ethnicity_melaa, ethnicity_other, ethnicity_total,
                        born_nz, born_overseas,
                        gender_male, gender_female,
                        lang_english, lang_maori, lang_total
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (sa2_code) DO UPDATE SET
                        sa2_name=EXCLUDED.sa2_name, population_2018=EXCLUDED.population_2018,
                        population_2023=EXCLUDED.population_2023, age_under_15=EXCLUDED.age_under_15,
                        age_15_to_29=EXCLUDED.age_15_to_29, age_30_to_64=EXCLUDED.age_30_to_64,
                        age_65_plus=EXCLUDED.age_65_plus, median_age=EXCLUDED.median_age,
                        ethnicity_european=EXCLUDED.ethnicity_european, ethnicity_maori=EXCLUDED.ethnicity_maori,
                        ethnicity_pacific=EXCLUDED.ethnicity_pacific, ethnicity_asian=EXCLUDED.ethnicity_asian,
                        ethnicity_melaa=EXCLUDED.ethnicity_melaa, ethnicity_other=EXCLUDED.ethnicity_other,
                        ethnicity_total=EXCLUDED.ethnicity_total,
                        born_nz=EXCLUDED.born_nz, born_overseas=EXCLUDED.born_overseas,
                        gender_male=EXCLUDED.gender_male, gender_female=EXCLUDED.gender_female,
                        lang_english=EXCLUDED.lang_english, lang_maori=EXCLUDED.lang_maori,
                        lang_total=EXCLUDED.lang_total
                    """,
                    (
                        sa2_code, a.get("SA22023_V1_00_NAME_ASCII"),
                        _v("VAR_1_2"), _v("VAR_1_3"),
                        _v("VAR_1_80"), _v("VAR_1_81"), _v("VAR_1_82"), _v("VAR_1_83"), _v("VAR_1_69"),
                        _v("VAR_1_158"), _v("VAR_1_159"), _v("VAR_1_160"), _v("VAR_1_161"),
                        _v("VAR_1_162"), _v("VAR_1_163"), _v("VAR_1_167"),
                        _v("VAR_1_95"), _v("VAR_1_96"),
                        _v("VAR_1_270"), _v("VAR_1_271"),
                        _v("VAR_1_205"), _v("VAR_1_206"), _v("VAR_1_212"),
                    ),
                )
                count += 1
            except Exception:
                conn.rollback()
                continue

        conn.commit()
        offset += len(features)
        _progress(log, f"Census demographics: {count} SA2 areas loaded...")
        if len(features) < 2000:
            break

    _progress(log, f"Census 2023 demographics: {count} SA2 areas")
    return count


# ── Census 2023 Households (SA2) ─────────────────────────────

def load_census_households(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load Census 2023 household data by SA2 from Stats NZ ArcGIS."""
    base = "https://services2.arcgis.com/vKb0s8tBIA3bdocZ/arcgis/rest/services/2023_Census_totals_by_topic_for_households_by_SA2/FeatureServer/0"
    _progress(log, "Fetching Census 2023 households by SA2...")

    # Field mapping: VAR_4_* → our columns
    out_fields = (
        "SA22023_V1_00,SA22023_V1_00_NAME_ASCII,"
        "VAR_4_2,VAR_4_3,"  # households 2018, 2023
        "VAR_4_74,VAR_4_75,VAR_4_76,VAR_4_77,VAR_4_78,VAR_4_80,"  # composition
        "VAR_4_48,VAR_4_51,"  # crowding
        "VAR_4_184,VAR_4_185,VAR_4_186,VAR_4_189,"  # tenure
        "VAR_4_214,VAR_4_215,VAR_4_216,VAR_4_217,VAR_4_218,VAR_4_219,VAR_4_220,VAR_4_221,VAR_4_225,"  # income
        "VAR_4_136,VAR_4_137,VAR_4_138,VAR_4_139,VAR_4_144,"  # vehicles (none,1,2,3+,total)
        "VAR_4_24,VAR_4_20,VAR_4_27,"  # internet
        "VAR_4_261,VAR_4_260,"  # rent median, rent total
        "VAR_4_163,VAR_4_165,VAR_4_164,VAR_4_167,VAR_4_171"  # landlord
    )

    cur = conn.cursor()
    cur.execute("TRUNCATE census_households")
    conn.commit()

    offset = 0
    count = 0
    while True:
        url = (
            f"{base}/query?where=1%3D1&outFields={out_fields}"
            f"&returnGeometry=false&resultRecordCount=2000&resultOffset={offset}&f=json"
        )
        data = json.loads(_fetch_url(url, timeout=60))
        features = data.get("features", [])
        if not features:
            break

        for f in features:
            a = f.get("attributes", {})
            sa2_code = a.get("SA22023_V1_00")
            if not sa2_code:
                continue

            def _v(key, default=None):
                val = a.get(key)
                if val is None or val == -999:
                    return default
                return val

            # vehicles_three_plus = 3 + 4 + 5+
            v3 = _v("VAR_4_139", 0) or 0
            v4 = _v("VAR_4_140", 0) or 0 if "VAR_4_140" in a else 0
            # multi-family = two-family + three+
            multi_fam = (_v("VAR_4_75", 0) or 0) + (_v("VAR_4_76", 0) or 0)

            try:
                cur.execute(
                    """INSERT INTO census_households (
                        sa2_code, sa2_name,
                        households_2018, households_2023,
                        hh_one_family, hh_multi_family, hh_other_multi_person, hh_one_person, hh_total,
                        hh_crowded, hh_not_crowded,
                        tenure_owned, tenure_not_owned, tenure_family_trust, tenure_total,
                        income_under_20k, income_20k_30k, income_30k_50k, income_50k_70k,
                        income_70k_100k, income_100k_150k, income_150k_200k, income_200k_plus, income_median,
                        vehicles_none, vehicles_one, vehicles_two, vehicles_three_plus, vehicles_total,
                        internet_access, internet_no_access, internet_total,
                        rent_median, rent_total_hh,
                        landlord_private, landlord_kainga_ora, landlord_council, landlord_other, landlord_total
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (sa2_code) DO UPDATE SET
                        sa2_name=EXCLUDED.sa2_name, households_2018=EXCLUDED.households_2018,
                        households_2023=EXCLUDED.households_2023, hh_one_family=EXCLUDED.hh_one_family,
                        hh_multi_family=EXCLUDED.hh_multi_family, hh_other_multi_person=EXCLUDED.hh_other_multi_person,
                        hh_one_person=EXCLUDED.hh_one_person, hh_total=EXCLUDED.hh_total,
                        hh_crowded=EXCLUDED.hh_crowded, hh_not_crowded=EXCLUDED.hh_not_crowded,
                        tenure_owned=EXCLUDED.tenure_owned, tenure_not_owned=EXCLUDED.tenure_not_owned,
                        tenure_family_trust=EXCLUDED.tenure_family_trust, tenure_total=EXCLUDED.tenure_total,
                        income_under_20k=EXCLUDED.income_under_20k, income_20k_30k=EXCLUDED.income_20k_30k,
                        income_30k_50k=EXCLUDED.income_30k_50k, income_50k_70k=EXCLUDED.income_50k_70k,
                        income_70k_100k=EXCLUDED.income_70k_100k, income_100k_150k=EXCLUDED.income_100k_150k,
                        income_150k_200k=EXCLUDED.income_150k_200k, income_200k_plus=EXCLUDED.income_200k_plus,
                        income_median=EXCLUDED.income_median,
                        vehicles_none=EXCLUDED.vehicles_none, vehicles_one=EXCLUDED.vehicles_one,
                        vehicles_two=EXCLUDED.vehicles_two, vehicles_three_plus=EXCLUDED.vehicles_three_plus,
                        vehicles_total=EXCLUDED.vehicles_total,
                        internet_access=EXCLUDED.internet_access, internet_no_access=EXCLUDED.internet_no_access,
                        internet_total=EXCLUDED.internet_total,
                        rent_median=EXCLUDED.rent_median, rent_total_hh=EXCLUDED.rent_total_hh,
                        landlord_private=EXCLUDED.landlord_private, landlord_kainga_ora=EXCLUDED.landlord_kainga_ora,
                        landlord_council=EXCLUDED.landlord_council, landlord_other=EXCLUDED.landlord_other,
                        landlord_total=EXCLUDED.landlord_total
                    """,
                    (
                        sa2_code, a.get("SA22023_V1_00_NAME_ASCII"),
                        _v("VAR_4_2"), _v("VAR_4_3"),
                        _v("VAR_4_74"), multi_fam, _v("VAR_4_77"), _v("VAR_4_78"), _v("VAR_4_80"),
                        _v("VAR_4_48"), _v("VAR_4_51"),
                        _v("VAR_4_184"), _v("VAR_4_185"), _v("VAR_4_186"), _v("VAR_4_189"),
                        _v("VAR_4_214"), _v("VAR_4_215"), _v("VAR_4_216"), _v("VAR_4_217"),
                        _v("VAR_4_218"), _v("VAR_4_219"), _v("VAR_4_220"), _v("VAR_4_221"), _v("VAR_4_225"),
                        _v("VAR_4_136"), _v("VAR_4_137"), _v("VAR_4_138"), v3,
                        _v("VAR_4_144"),
                        _v("VAR_4_24"), _v("VAR_4_20"), _v("VAR_4_27"),
                        _v("VAR_4_261"), _v("VAR_4_260"),
                        _v("VAR_4_163"), _v("VAR_4_165"), _v("VAR_4_164"), _v("VAR_4_167"), _v("VAR_4_171"),
                    ),
                )
                count += 1
            except Exception:
                conn.rollback()
                continue

        conn.commit()
        offset += len(features)
        _progress(log, f"Census households: {count} SA2 areas loaded...")
        if len(features) < 2000:
            break

    _progress(log, f"Census 2023 households: {count} SA2 areas")
    return count


# ── Census 2023 Commute Mode (SA2) ────────────────────────────

def load_census_commute(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load Census 2023 commute mode by SA2 from Stats NZ ArcGIS CSV.
    Source is an origin-destination matrix — we aggregate by residence SA2."""
    import csv, io
    url = "https://statsnz.maps.arcgis.com/sharing/rest/content/items/fedc12523d4f4da08f094cf13bb21807/data"
    _progress(log, "Downloading Census 2023 commute mode CSV (~11MB)...")
    raw = _fetch_url(url, timeout=120)

    # Parse CSV and aggregate by residence SA2
    text = raw.decode("utf-8-sig") if isinstance(raw, bytes) else raw
    reader = csv.DictReader(io.StringIO(text))
    agg: dict[str, dict] = {}

    for row in reader:
        sa2 = row.get("SA22023_V1_00_usual_residence_address", "").strip()
        name = row.get("SA22023_V1_00_NAME_ASCII_usual_residence_address", "").strip()
        if not sa2 or sa2 == "Total":
            continue

        if sa2 not in agg:
            agg[sa2] = {
                "sa2_name": name,
                "work_at_home": 0, "drive_private": 0, "drive_company": 0,
                "passenger": 0, "public_bus": 0, "train": 0,
                "bicycle": 0, "walk_or_jog": 0, "ferry": 0, "other": 0,
                "total_stated": 0,
                "total_stated_2018": 0, "work_at_home_2018": 0,
            }

        def _safe(key):
            v = row.get(key, "")
            if not v or v == "-999" or v.strip() == "":
                return 0
            try:
                return int(v)
            except ValueError:
                return 0

        a = agg[sa2]
        a["work_at_home"] += _safe("2023_Work_at_home")
        a["drive_private"] += _safe("2023_Drive_a_private_car_truck_or_van")
        a["drive_company"] += _safe("2023_Drive_a_company_car_truck_or_van")
        a["passenger"] += _safe("2023_Passenger_in_a_car_truck_van_or_company_bus")
        a["public_bus"] += _safe("2023_Public_bus")
        a["train"] += _safe("2023_Train")
        a["bicycle"] += _safe("2023_Bicycle")
        a["walk_or_jog"] += _safe("2023_Walk_or_jog")
        a["ferry"] += _safe("2023_Ferry")
        a["other"] += _safe("2023_Other")
        a["total_stated"] += _safe("2023_Total_stated")
        a["total_stated_2018"] += _safe("2018_Total_stated")
        a["work_at_home_2018"] += _safe("2018_Work_at_home")

    _progress(log, f"Parsed {len(agg)} SA2 areas from commute CSV, inserting...")
    cur = conn.cursor()
    cur.execute("TRUNCATE census_commute")
    conn.commit()

    count = 0
    for sa2, a in agg.items():
        try:
            cur.execute(
                """INSERT INTO census_commute (
                    sa2_code, sa2_name,
                    work_at_home, drive_private, drive_company, passenger,
                    public_bus, train, bicycle, walk_or_jog, ferry, other, total_stated,
                    total_stated_2018, work_at_home_2018
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (sa2_code) DO UPDATE SET
                    sa2_name=EXCLUDED.sa2_name, work_at_home=EXCLUDED.work_at_home,
                    drive_private=EXCLUDED.drive_private, drive_company=EXCLUDED.drive_company,
                    passenger=EXCLUDED.passenger, public_bus=EXCLUDED.public_bus,
                    train=EXCLUDED.train, bicycle=EXCLUDED.bicycle,
                    walk_or_jog=EXCLUDED.walk_or_jog, ferry=EXCLUDED.ferry,
                    other=EXCLUDED.other, total_stated=EXCLUDED.total_stated,
                    total_stated_2018=EXCLUDED.total_stated_2018,
                    work_at_home_2018=EXCLUDED.work_at_home_2018
                """,
                (
                    sa2, a["sa2_name"],
                    a["work_at_home"], a["drive_private"], a["drive_company"], a["passenger"],
                    a["public_bus"], a["train"], a["bicycle"], a["walk_or_jog"],
                    a["ferry"], a["other"], a["total_stated"],
                    a["total_stated_2018"], a["work_at_home_2018"],
                ),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue

    conn.commit()
    _progress(log, f"Census 2023 commute: {count} SA2 areas")
    return count


# ── Climate Normals (Open-Meteo) ──────────────────────────────

def load_climate_normals(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load 30-year climate normals for ~60 NZ cities from Open-Meteo Climate API."""
    import time as _time

    # Major NZ cities/towns with coordinates and TA names
    locations = [
        ("Auckland CBD", "Auckland", -36.848, 174.763),
        ("North Shore", "Auckland", -36.780, 174.757),
        ("Manukau", "Auckland", -36.993, 174.880),
        ("Waitakere", "Auckland", -36.850, 174.545),
        ("Hamilton", "Hamilton City", -37.787, 175.283),
        ("Tauranga", "Tauranga City", -37.688, 176.167),
        ("Wellington", "Wellington City", -41.293, 174.781),
        ("Lower Hutt", "Hutt City", -41.209, 174.908),
        ("Upper Hutt", "Upper Hutt City", -41.124, 175.070),
        ("Porirua", "Porirua City", -41.134, 174.840),
        ("Christchurch", "Christchurch City", -43.532, 172.636),
        ("Dunedin", "Dunedin City", -45.874, 170.504),
        ("Napier", "Napier City", -39.489, 176.912),
        ("Hastings", "Hastings District", -39.639, 176.839),
        ("Palmerston North", "Palmerston North City", -40.356, 175.611),
        ("Nelson", "Nelson City", -41.271, 173.284),
        ("Rotorua", "Rotorua District", -38.137, 176.251),
        ("New Plymouth", "New Plymouth District", -39.056, 174.075),
        ("Whangarei", "Whangarei District", -35.725, 174.324),
        ("Invercargill", "Invercargill City", -46.413, 168.353),
        ("Kapiti Coast", "Kapiti Coast District", -40.914, 174.983),
        ("Queenstown", "Queenstown-Lakes District", -45.031, 168.662),
        ("Wanaka", "Queenstown-Lakes District", -44.700, 169.132),
        ("Blenheim", "Marlborough District", -41.514, 173.953),
        ("Timaru", "Timaru District", -44.396, 171.254),
        ("Whanganui", "Whanganui District", -39.930, 175.050),
        ("Gisborne", "Gisborne District", -38.662, 178.018),
        ("Masterton", "Masterton District", -40.952, 175.658),
        ("Levin", "Horowhenua District", -40.622, 175.275),
        ("Taupo", "Taupo District", -38.684, 176.070),
        ("Thames", "Thames-Coromandel District", -36.861, 175.540),
        ("Whitianga", "Thames-Coromandel District", -36.834, 175.699),
        ("Whakatane", "Whakatane District", -37.953, 176.993),
        ("Cambridge", "Waipa District", -37.882, 175.469),
        ("Te Awamutu", "Waipa District", -38.007, 175.323),
        ("Ashburton", "Ashburton District", -43.901, 171.730),
        ("Rangiora", "Waimakariri District", -43.305, 172.596),
        ("Rolleston", "Selwyn District", -43.590, 172.379),
        ("Oamaru", "Waitaki District", -45.097, 170.972),
        ("Greymouth", "Grey District", -42.450, 171.211),
        ("Hokitika", "Westland District", -42.717, 170.968),
        ("Gore", "Gore District", -46.100, 168.944),
        ("Kaikoura", "Kaikoura District", -42.400, 173.681),
        ("Kerikeri", "Far North District", -35.227, 174.000),
        ("Kaitaia", "Far North District", -35.111, 173.263),
        ("Pukekohe", "Auckland", -37.200, 174.900),
        ("Papamoa", "Western Bay of Plenty District", -37.720, 176.297),
        ("Mount Maunganui", "Tauranga City", -37.632, 176.182),
        ("Richmond", "Tasman District", -41.340, 173.178),
        ("Motueka", "Tasman District", -41.111, 172.988),
        ("Alexandra", "Central Otago District", -45.249, 169.379),
        ("Cromwell", "Central Otago District", -45.039, 169.196),
        ("Waihi", "Hauraki District", -37.386, 175.834),
        ("Tokoroa", "South Waikato District", -38.228, 175.869),
        ("Matamata", "Matamata-Piako District", -37.810, 175.762),
        ("Stratford", "Stratford District", -39.346, 174.284),
        ("Dannevirke", "Tararua District", -40.204, 176.101),
        ("Carterton", "Carterton District", -41.023, 175.527),
        ("Waipukurau", "Central Hawke's Bay District", -41.049, 176.554),
        ("Te Kuiti", "Waitomo District", -38.335, 175.163),
    ]

    _progress(log, f"Fetching climate normals for {len(locations)} locations from Open-Meteo...")
    cur = conn.cursor()
    cur.execute("TRUNCATE climate_normals")
    conn.commit()

    count = 0
    for i, (name, ta, lat, lng) in enumerate(locations):
        try:
            # Use daily data for 10 years, aggregate to monthly averages
            url = (
                f"https://climate-api.open-meteo.com/v1/climate?"
                f"latitude={lat}&longitude={lng}"
                f"&start_date=2010-01-01&end_date=2019-12-31"
                f"&models=EC_Earth3P_HR"
                f"&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,"
                f"precipitation_sum,wind_speed_10m_mean"
            )
            raw = _fetch_url(url, timeout=60)
            data = json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
            daily = data.get("daily", {})
            times = daily.get("time", [])
            t_mean = daily.get("temperature_2m_mean", [])
            t_max = daily.get("temperature_2m_max", [])
            t_min = daily.get("temperature_2m_min", [])
            precip = daily.get("precipitation_sum", [])
            wind = daily.get("wind_speed_10m_mean", [])

            # Aggregate by month
            monthly_agg: dict[int, dict] = {}
            for idx, t in enumerate(times):
                month = int(t.split("-")[1])
                if month not in monthly_agg:
                    monthly_agg[month] = {
                        "t_mean": [], "t_max": [], "t_min": [],
                        "precip_days": [], "precip_sum": [], "wind": [],
                    }
                ma = monthly_agg[month]
                if idx < len(t_mean) and t_mean[idx] is not None:
                    ma["t_mean"].append(t_mean[idx])
                if idx < len(t_max) and t_max[idx] is not None:
                    ma["t_max"].append(t_max[idx])
                if idx < len(t_min) and t_min[idx] is not None:
                    ma["t_min"].append(t_min[idx])
                if idx < len(precip) and precip[idx] is not None:
                    ma["precip_sum"].append(precip[idx])
                    if precip[idx] >= 1.0:
                        ma["precip_days"].append(1)
                    else:
                        ma["precip_days"].append(0)
                if idx < len(wind) and wind[idx] is not None:
                    ma["wind"].append(wind[idx])

            for month, ma in sorted(monthly_agg.items()):
                def _avg(lst):
                    return round(sum(lst) / len(lst), 1) if lst else None
                # Monthly precipitation = average daily sum * ~30 days
                avg_daily_precip = sum(ma["precip_sum"]) / max(len(ma["precip_sum"]), 1)
                days_in_month_approx = len(ma["precip_sum"]) / 10  # 10 years of data
                monthly_precip = round(avg_daily_precip * days_in_month_approx, 1) if ma["precip_sum"] else None
                rain_days = round(sum(ma["precip_days"]) / 10, 1)  # avg rain days per year

                cur.execute(
                    """INSERT INTO climate_normals (
                        location_name, ta_name, latitude, longitude, month,
                        temp_mean, temp_max, temp_min, precipitation_mm,
                        rain_days, sunshine_hours, wind_speed_mean
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (location_name, month) DO UPDATE SET
                        ta_name=EXCLUDED.ta_name, temp_mean=EXCLUDED.temp_mean,
                        temp_max=EXCLUDED.temp_max, temp_min=EXCLUDED.temp_min,
                        precipitation_mm=EXCLUDED.precipitation_mm, rain_days=EXCLUDED.rain_days,
                        sunshine_hours=EXCLUDED.sunshine_hours, wind_speed_mean=EXCLUDED.wind_speed_mean
                    """,
                    (
                        name, ta, lat, lng, month,
                        _avg(ma["t_mean"]), _avg(ma["t_max"]), _avg(ma["t_min"]),
                        monthly_precip, rain_days,
                        None,  # sunshine hours not available from climate API
                        _avg(ma["wind"]),
                    ),
                )
                count += 1
        except Exception as e:
            logger.warning(f"Climate normals failed for {name}: {e}")
            conn.rollback()
            continue

        conn.commit()
        if (i + 1) % 10 == 0:
            _progress(log, f"Climate normals: {i + 1}/{len(locations)} locations...")
        _time.sleep(0.3)  # Rate limit courtesy

    _progress(log, f"Climate normals: {count} records for {len(locations)} locations")
    return count


# ── Fibre Coverage (Commerce Commission SFA) ──────────────────

def load_fibre_coverage(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load Specified Fibre Areas from Commerce Commission GPKG.
    Downloads 291MB GPKG, dissolves 1.68M parcels into ~2K SFA zone convex hulls."""
    import sqlite3, struct

    gpkg_path = "/tmp/sfa_data/SFA_2025.gpkg"

    # Check if GPKG exists, download if not
    try:
        open(gpkg_path, "rb").close()
    except FileNotFoundError:
        _progress(log, "Downloading SFA GeoPackage (291MB)...")
        import zipfile, io as _io
        raw = _fetch_url(
            "https://www.comcom.govt.nz/assets/Uploads/2025-SFA-map-GPKG.zip",
            timeout=600,
            extra_headers={"Referer": "https://www.comcom.govt.nz/"},
        )
        with zipfile.ZipFile(_io.BytesIO(raw)) as zf:
            zf.extractall("/tmp/sfa_data/")
        _progress(log, "GPKG downloaded and extracted")

    _progress(log, "Reading SFA zones from GPKG (this takes ~2 minutes)...")
    sfa_conn = sqlite3.connect(gpkg_path)
    sfa_cur = sfa_conn.cursor()

    # Get all unique SFA zones with their centroids and parcel counts
    # We can't easily do convex hull in sqlite3, so we'll collect bounding boxes
    # per SFA zone and create a union polygon in PostGIS
    sfa_cur.execute("""
        SELECT sfa_name, provider, count(*) as cnt,
               min(minx) as minx, min(miny) as miny,
               max(maxx) as maxy, max(maxy) as maxy2
        FROM sfa_2025, rtree_sfa_2025_geom r
        WHERE sfa_2025.id = r.id
        GROUP BY sfa_name, provider
    """)
    zones = sfa_cur.fetchall()
    _progress(log, f"Found {len(zones)} SFA zones")
    sfa_conn.close()

    # Fallback: just load SFA name + provider + approximate bbox as polygon
    cur = conn.cursor()
    cur.execute("TRUNCATE fibre_coverage RESTART IDENTITY")
    conn.commit()

    count = 0
    for sfa_name, provider, cnt, minx, miny, maxx, maxy in zones:
        if not minx or not miny or not maxx or not maxy:
            continue
        try:
            # Create bounding box polygon (approximation of fibre coverage area)
            wkt = f"POLYGON(({minx} {miny},{maxx} {miny},{maxx} {maxy},{minx} {maxy},{minx} {miny}))"
            cur.execute(
                """INSERT INTO fibre_coverage (sfa_name, provider, parcel_count, geom)
                   VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))""",
                (sfa_name, provider, cnt, wkt),
            )
            count += 1
        except Exception:
            conn.rollback()
            continue
        if count % 500 == 0:
            conn.commit()
            _progress(log, f"Fibre zones: {count}/{len(zones)}...")

    conn.commit()
    _progress(log, f"Fibre coverage: {count} SFA zones loaded")
    return count


# ── OSM Cycleways (Overpass API) ──────────────────────────────

def load_cycleways(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load cycleway line features from OSM Overpass API for major NZ cities."""
    import time as _time

    # Major NZ cities with bounding boxes [south, west, north, east]
    cities = [
        ("Auckland", -37.05, 174.55, -36.65, 175.00),
        ("Wellington", -41.40, 174.65, -41.10, 174.95),
        ("Christchurch", -43.65, 172.40, -43.40, 172.80),
        ("Hamilton", -37.85, 175.20, -37.70, 175.35),
        ("Tauranga", -37.75, 176.05, -37.60, 176.30),
        ("Dunedin", -46.00, 170.35, -45.80, 170.60),
        ("Napier-Hastings", -39.70, 176.70, -39.40, 177.00),
        ("Palmerston North", -40.40, 175.55, -40.30, 175.70),
        ("Nelson", -41.35, 173.20, -41.20, 173.35),
        ("New Plymouth", -39.10, 174.00, -39.00, 174.15),
        ("Rotorua", -38.20, 176.15, -38.07, 176.35),
        ("Queenstown", -45.10, 168.60, -44.95, 168.80),
        ("Invercargill", -46.45, 168.30, -46.35, 168.45),
        ("Whangarei", -35.80, 174.25, -35.65, 174.40),
        ("Kapiti Coast", -41.00, 174.85, -40.85, 175.05),
        ("Lower Hutt", -41.25, 174.85, -41.15, 175.00),
    ]

    cur = conn.cursor()
    cur.execute("TRUNCATE cycleways RESTART IDENTITY")
    conn.commit()

    count = 0
    for city_name, south, west, north, east in cities:
        _progress(log, f"Fetching cycleways for {city_name}...")
        try:
            query = f"""[out:json][timeout:60];
(way["highway"="cycleway"]({south},{west},{north},{east});
 way["cycleway"="track"]({south},{west},{north},{east});
 way["cycleway:left"="track"]({south},{west},{north},{east});
 way["cycleway:right"="track"]({south},{west},{north},{east}););
out geom;"""
            url = "https://overpass-api.de/api/interpreter"
            data = urllib.parse.urlencode({"data": query}).encode()
            req = urllib.request.Request(url, data=data, headers={"User-Agent": "WhareScore/1.0"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                result = json.loads(resp.read())

            city_count = 0
            for element in result.get("elements", []):
                if element.get("type") != "way":
                    continue
                geom = element.get("geometry", [])
                if len(geom) < 2:
                    continue
                tags = element.get("tags", {})
                name = tags.get("name", "")
                surface = tags.get("surface", "")

                # Build LineString WKT — coords need comma separation
                coords = ",".join(f"{p['lon']} {p['lat']}" for p in geom)
                wkt = f"LINESTRING({coords})"

                try:
                    cur.execute("SAVEPOINT sp")
                    cur.execute(
                        """INSERT INTO cycleways (name, surface, geom)
                           VALUES (%s, %s, ST_SetSRID(ST_GeomFromText(%s), 4326))""",
                        (name, surface, wkt),
                    )
                    cur.execute("RELEASE SAVEPOINT sp")
                    count += 1
                    city_count += 1
                except Exception:
                    cur.execute("ROLLBACK TO SAVEPOINT sp")
                    continue

            conn.commit()
            _progress(log, f"  {city_name}: {city_count} cycleways, total {count}")
        except Exception as e:
            logger.warning(f"Cycleways failed for {city_name}: {e}")
            conn.rollback()

        _time.sleep(5)  # Rate limit Overpass

    _progress(log, f"Cycleways: {count} ways loaded across {len(cities)} cities")
    return count


# ── Business Demography 2024 (SA2) ────────────────────────────

def load_business_demography(conn: psycopg.Connection, log: Callable = None) -> int:
    """Load 2024 Business Demography employee + business counts by SA2."""
    base = "https://services2.arcgis.com/vKb0s8tBIA3bdocZ/arcgis/rest/services/2024_Business_Demography_employee_count_by_SA2/FeatureServer/0"
    _progress(log, "Fetching 2024 Business Demography (employee + business counts by SA2)...")

    out_fields = "SA22023_V1_00,SA22023_V1_00_NAME_ASCII,ec2019,ec2024,ec_avperinc,gc2019,gc2024,gc_avperinc"
    cur = conn.cursor()
    cur.execute("TRUNCATE business_demography")
    conn.commit()

    offset = 0
    count = 0
    while True:
        url = (
            f"{base}/query?where=1%3D1&outFields={out_fields}"
            f"&returnGeometry=false&resultRecordCount=2000&resultOffset={offset}&f=json"
        )
        data = json.loads(_fetch_url(url, timeout=60))
        features = data.get("features", [])
        if not features:
            break

        for f in features:
            a = f.get("attributes", {})
            sa2_code = a.get("SA22023_V1_00")
            if not sa2_code:
                continue

            def _v(key):
                val = a.get(key)
                if val is None or val == -999:
                    return None
                return val

            try:
                cur.execute(
                    """INSERT INTO business_demography (
                        sa2_code, sa2_name,
                        employee_count_2019, employee_count_2024, employee_growth_pct,
                        business_count_2019, business_count_2024, business_growth_pct
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (sa2_code) DO UPDATE SET
                        sa2_name=EXCLUDED.sa2_name,
                        employee_count_2019=EXCLUDED.employee_count_2019,
                        employee_count_2024=EXCLUDED.employee_count_2024,
                        employee_growth_pct=EXCLUDED.employee_growth_pct,
                        business_count_2019=EXCLUDED.business_count_2019,
                        business_count_2024=EXCLUDED.business_count_2024,
                        business_growth_pct=EXCLUDED.business_growth_pct
                    """,
                    (
                        sa2_code, a.get("SA22023_V1_00_NAME_ASCII"),
                        _v("ec2019"), _v("ec2024"), _v("ec_avperinc"),
                        _v("gc2019"), _v("gc2024"), _v("gc_avperinc"),
                    ),
                )
                count += 1
            except Exception:
                conn.rollback()
                continue

        conn.commit()
        offset += len(features)
        _progress(log, f"Business demography: {count} SA2 areas loaded...")
        if len(features) < 2000:
            break

    _progress(log, f"Business Demography 2024: {count} SA2 areas")
    return count


# ═══════════════════════════════════════════════════════════════
# REGISTRY
# ═══════════════════════════════════════════════════════════════

DATA_SOURCES: list[DataSource] = [
    # ── National (Stats NZ Census 2023) ──────────────────────
    DataSource(
        "census_demographics", "Census 2023 Demographics (SA2 — population, age, ethnicity)",
        ["census_demographics"],
        load_census_demographics,
    ),
    DataSource(
        "census_households", "Census 2023 Households (SA2 — income, tenure, vehicles, internet)",
        ["census_households"],
        load_census_households,
    ),
    DataSource(
        "census_commute", "Census 2023 Commute Mode (SA2 — drive, bus, train, bike, WFH)",
        ["census_commute"],
        load_census_commute,
    ),
    DataSource(
        "climate_normals", "Climate Normals 1991-2020 (60 cities — temp, rain, sun, wind)",
        ["climate_normals"],
        load_climate_normals,
    ),
    DataSource(
        "business_demography", "Business Demography 2024 (SA2 — employee + business counts, growth)",
        ["business_demography"],
        load_business_demography,
    ),
    DataSource(
        "fibre_coverage", "Commerce Commission Specified Fibre Areas (2025)",
        ["fibre_coverage"],
        load_fibre_coverage,
    ),
    DataSource(
        "cycleways", "OSM Cycleways (16 major cities)",
        ["cycleways"],
        load_cycleways,
    ),
    # ── National (LINZ) ───────────────────────────────────────
    DataSource(
        "linz_waterways", "LINZ NZ Waterways (Topo50 rivers, streams, drains)",
        ["nz_waterways"],
        load_linz_waterways,
    ),
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
            ["name", "feature_type"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Description")) or "Landslide Area",
                _clean(a.get("Certainty")) or _clean(a.get("Category")) or "Landslide Area",
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
    # NOTE: As of 2026-03, this endpoint returns "Token Required" (error 499).
    # ORC appears to have restricted public access. Loader will return 0 rows
    # until the endpoint is made public again or an auth token is configured.
    # Geometry type is likely Point (similar to other HAIL/contaminated land services).
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
            geom_type="point",
            srid=4326,
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
        ["tsunami_hazard"],
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
        # Use the GCSPCombined MapServer, not GCSP FeatureServer — the
        # FeatureServer has a stale snapshot with null ZoneType/ZoneCode at
        # Central City addresses (e.g. Cathedral Square), while the MapServer
        # layer is up-to-date and returns 'City centre zone' / 'CCZ' correctly.
        # CCC's feed has no explicit ZoneGroup, so derive the category from
        # the zone name text (same approach as QLDC, etc).
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/OpenData/GCSPCombined/MapServer/0",
            "district_plan_zones", "christchurch",
            ["zone_name", "zone_code", "category"],
            lambda a: (
                _clean(a.get("ZoneType")),
                _clean(a.get("ZoneCode")),
                _derive_zone_category(_clean(a.get("ZoneType"))),
            ))),
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
            "auckland", "CV", "LV", None, "FORMATTEDADDRESS", srid=3857,
            date_field="LATESTVALUATIONDATE")),
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
            "https://apis.metroinfo.co.nz/rti/gtfs/v1/gtfs.zip", "christchurch",
            extra_headers={"Ocp-Apim-Subscription-Key": settings.METROINFO_API_KEY}
            if getattr(settings, "METROINFO_API_KEY", None) else None)),
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
    DataSource("hawkes_bay_gtfs", "Hawke's Bay GoBus GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://data.trilliumtransit.com/gtfs/hbrc-nz/hbrc-nz.zip", "hawkes_bay")),
    DataSource("whangarei_gtfs", "Whangarei CityLink GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://data.trilliumtransit.com/gtfs/nrc-nz/nrc-nz.zip", "whangarei")),
    DataSource("tauranga_bop_gtfs", "Tauranga/BOP BayBus GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://data.trilliumtransit.com/gtfs/boprc-nz/boprc-nz.zip", "tauranga_bop")),
    DataSource("rotorua_gtfs", "Rotorua CityRide GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://data.trilliumtransit.com/gtfs/boprc-nz/boprc-nz.zip", "rotorua")),
    DataSource("queenstown_gtfs", "Queenstown Orbus GTFS + Travel Times",
        ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
        lambda conn, log=None: _load_regional_gtfs(conn, log,
            "https://www.orc.govt.nz/transit/google_transit.zip", "queenstown")),
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
    # ══════════════════════════════════════════════════════════
    # QUEENSTOWN-LAKES (QLDC) — expanded hazards
    # ══════════════════════════════════════════════════════════
    DataSource("qldc_active_faults", "QLDC Active Faults (GNS 2019)",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Seismic/MapServer/1",
            "active_faults", "queenstown_lakes",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                _clean(a.get("NAME")) or "Active Fault",
                _clean(a.get("ZONE")),
                _clean(a.get("DOWN_QUAD")),
                "GNS 2019 via QLDC",
            ),
            geom_type="line")),
    DataSource("qldc_active_folds", "QLDC Active Folds (GNS 2019)",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Seismic/MapServer/0",
            "active_faults", "queenstown_lakes_folds",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                _clean(a.get("NAME")) or "Active Fold",
                _clean(a.get("TYPE")) or "fold",
                _clean(a.get("FACING")),
                "GNS 2019 via QLDC",
            ),
            geom_type="line")),
    DataSource("qldc_avalanche", "QLDC Avalanche Areas",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Other_Land_Hazards/MapServer/0",
            "slope_failure", "queenstown_avalanche",
            ["lskey", "severity"],
            lambda a: (
                "Avalanche Area",
                _clean(a.get("HAZ_CODE")) or "High",
            ))),
    DataSource("qldc_debris_rockfall", "QLDC Debris Flow & Rockfall Risk (BECA 2020)",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Other_Land_Hazards/MapServer/1",
            "slope_failure", "queenstown_debris_rockfall",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Description")) or "Debris Flow / Rockfall",
                "High",
            ))),
    DataSource("qldc_erosion", "QLDC Erosion Areas (Opus 2002)",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Other_Land_Hazards/MapServer/2",
            "coastal_erosion", "queenstown_lakes",
            ["name", "coast_type", "scenario"],
            lambda a: (
                _clean(a.get("HAZ_TYPE")) or "Erosion Area",
                _clean(a.get("HAZ_CAT")) or "Land",
                _clean(a.get("COMMENTS")),
            ))),
    DataSource("qldc_alluvial_fans", "QLDC Alluvial Fan Areas (ORC 2011)",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Alluvial_Fans/MapServer/1",
            "slope_failure", "queenstown_alluvial",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("FAN_NAME")) or "Alluvial Fan",
                _clean(a.get("FAN_HAZARD")) or _clean(a.get("ADVISORY")) or "High",
            ))),
    DataSource("qldc_damburst", "QLDC Damburst Flooding (ORC 2002)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Flooding/MapServer/2",
            "flood_hazard", "queenstown_damburst",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Damburst Flood Zone",
                "High",
                "Flood Due to Damburst",
            ))),
    DataSource("qldc_rainfall_flood", "QLDC Rainfall Flooding (ORC 2012)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/Hazards/Flooding/MapServer/1",
            "flood_hazard", "queenstown_rainfall",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("DESCRIPTIO")) or "Rainfall Flooding",
                _clean(a.get("CLASS")) or "Medium",
                _clean(a.get("HAZ_TYPE")) or "Rainfall Flood",
            ))),
    # ══════════════════════════════════════════════════════════
    # CANTERBURY (ECan) — expanded hazards
    # ══════════════════════════════════════════════════════════
    DataSource("ecan_liquefaction_ashburton", "Ashburton Liquefaction Vulnerability 2024",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/31",
            "liquefaction_detail", "ashburton",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or "Unknown",
                _clean(a.get("DESCRIP")) or _clean(a.get("DETAIL")),
            ))),
    DataSource("ecan_liquefaction_mackenzie", "Mackenzie Liquefaction Vulnerability 2023",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/29",
            "liquefaction_detail", "mackenzie",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or "Unknown",
                _clean(a.get("DESCRIP")) or _clean(a.get("DETAIL")),
            ))),
    DataSource("ecan_liquefaction_waitaki", "Waitaki Liquefaction Vulnerability 2023",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/30",
            "liquefaction_detail", "waitaki",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or "Unknown",
                _clean(a.get("DESCRIP")) or _clean(a.get("DETAIL")),
            ))),
    DataSource("ecan_liquefaction_waimate", "Waimate Liquefaction Vulnerability 2022",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/28",
            "liquefaction_detail", "waimate",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or "Unknown",
                _clean(a.get("DESCRIP")) or _clean(a.get("DETAIL")),
            ))),
    DataSource("ecan_liquefaction_timaru", "Timaru Liquefaction Vulnerability 2020",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/9",
            "liquefaction_detail", "timaru",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or "Unknown",
                _clean(a.get("DESCRIP")) or _clean(a.get("DETAIL")),
            ))),
    DataSource("ecan_liquefaction_kaikoura", "Kaikoura Liquefaction Vulnerability 2019",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/20",
            "liquefaction_detail", "kaikoura",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or "Unknown",
                _clean(a.get("DESCRIP")) or _clean(a.get("DETAIL")),
            ))),
    DataSource("ecan_liquefaction_waimakariri", "Waimakariri Liquefaction Susceptibility 2009",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/6",
            "liquefaction_detail", "waimakariri",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or _clean(a.get("SUSCEPTIBILITY")) or "Unknown",
                _clean(a.get("DESCRIP")) or _clean(a.get("DETAIL")),
            ))),
    DataSource("ecan_liquefaction_selwyn", "Selwyn Liquefaction Susceptibility 2006",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/7",
            "liquefaction_detail", "selwyn",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or _clean(a.get("SUSCEPTIBILITY")) or "Unknown",
                _clean(a.get("DESCRIP")) or _clean(a.get("DETAIL")),
            ))),
    DataSource("ecan_liquefaction_hurunui", "Hurunui Liquefaction (Eastern Canterbury 2012)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/3",
            "liquefaction_detail", "hurunui",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or "Unknown",
                _clean(a.get("DESCRIP")) or _clean(a.get("DETAIL")),
            ))),
    DataSource("ecan_tsunami", "Canterbury Tsunami Evacuation Zones",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/4",
            "tsunami_hazard", "canterbury",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Description")) or "Tsunami Evacuation Zone",
                _clean(a.get("Status")) or "High",
                _clean(a.get("District")) or "Canterbury",
            ))),
    DataSource("ecan_coastal_hazard", "Canterbury Coastal Hazard Zones",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/RPS_RCEP_Coastal_Erosion/MapServer/3",
            "coastal_erosion", "canterbury",
            ["name", "coast_type", "scenario"],
            lambda a: (
                _clean(a.get("Hazard_Zone")) or "Coastal Hazard Zone",
                "Coastal",
                _clean(a.get("DISTRICT")) or _clean(a.get("STATUS")),
            ))),
    # ══════════════════════════════════════════════════════════
    # ENVIRONMENT SOUTHLAND — hazards
    # ══════════════════════════════════════════════════════════
    DataSource("southland_liquefaction", "Southland Liquefaction Risk",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.es.govt.nz/server/rest/services/Public/NaturalHazards/MapServer/11",
            "liquefaction_detail", "southland",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_RISK")) or _clean(a.get("Description")) or "Unknown",
                _clean(a.get("Description")),
            ))),
    DataSource("southland_shaking", "Southland Shaking Amplification",
        ["ground_shaking"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.es.govt.nz/server/rest/services/Public/NaturalHazards/MapServer/10",
            "ground_shaking", "southland",
            ["zone", "severity"],
            lambda a: (
                _clean(a.get("AMP_CODE")) or _clean(a.get("GroundClass")),
                _clean(a.get("Description")) or _clean(a.get("AMP_CODE")),
            ))),
    DataSource("southland_tsunami", "Southland Tsunami Evacuation Zones",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.es.govt.nz/server/rest/services/Public/NaturalHazards/MapServer/8",
            "tsunami_hazard", "southland",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Name")) or "Tsunami Evacuation Zone",
                _clean(a.get("Zone")) or "High",
                _clean(a.get("Type")) or _clean(a.get("ZoneText")) or "Tsunami",
            ))),
    DataSource("southland_floodplains", "Southland Significant Floodplains",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.es.govt.nz/server/rest/services/Public/NaturalHazards/MapServer/7",
            "flood_hazard", "southland",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Region")) or "Significant Floodplain",
                "High",
                "Significant Floodplain",
            ))),
    DataSource("southland_active_faults", "Southland Active Faults",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.es.govt.nz/server/rest/services/Public/NaturalHazards/MapServer/2",
            "active_faults", "southland",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                _clean(a.get("NAME")) or "Active Fault",
                _clean(a.get("ZONE")),
                None,
                "Environment Southland",
            ),
            geom_type="line")),
    # ══════════════════════════════════════════════════════════
    # NORTHLAND (NRC) — hazards
    # ══════════════════════════════════════════════════════════
    DataSource("northland_tsunami", "Northland Tsunami Inundation Zones 2024",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services9.arcgis.com/QYNojhn6G3lxeEgh/arcgis/rest/services/Tsunami_Inundation_Zones_2024__Public_/FeatureServer/0",
            "tsunami_hazard", "northland",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Inundation Zone",
                _clean(a.get("Zone")) or "High",
                _clean(a.get("Zone")) or "Tsunami",
            ),
            srid=2193)),
    DataSource("northland_flood_50yr", "Northland River Flood 50yr (Regionwide)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Simplified_River_Flood_Hazard_Zone_Regionwide_Model_50_year_Extent/FeatureServer/0",
            "flood_hazard", "northland_50yr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "River Flood Zone (50yr)",
                "Medium",
                "River Flood 50yr ARI",
            ),
            srid=2193)),
    DataSource("northland_flood_10yr", "Northland River Flood 10yr (Regionwide)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Simplified_River_Flood_Hazard_Zone_Regionwide_Model_10_year_Extent/FeatureServer/0",
            "flood_hazard", "northland_10yr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "River Flood Zone (10yr)",
                "High",
                "River Flood 10yr ARI",
            ),
            srid=2193)),
    DataSource("northland_coastal_flood", "Northland Coastal Flood (Current)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Simplified_Coastal_Flood_Hazard_Zone_Zone0_Current/FeatureServer/0",
            "flood_hazard", "northland_coastal",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Coastal Flood Zone",
                "High",
                f"Coastal Flood (CFHZ0={a.get('CFHZ0') or '?'}m)",
            ),
            srid=2193)),
    # ══════════════════════════════════════════════════════════
    # BAY OF PLENTY REGIONAL COUNCIL — hazards
    # ══════════════════════════════════════════════════════════
    DataSource("bop_tsunami_evac", "BOP Tsunami Evacuation Zones 2023",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/Natural_Hazards/MapServer/6",
            "tsunami_hazard", "bay_of_plenty",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Evacuation Zone",
                "High",
                _clean(a.get("AreaType")) or _clean(a.get("TA")) or "BOP Evacuation",
            ))),
    DataSource("bop_tsunami_2500yr", "BOP Tsunami Inundation 2500yr ARI",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/Natural_Hazards/MapServer/105",
            "tsunami_hazard", "bop_2500yr",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Inundation (2500yr ARI)",
                _clean(a.get("Zone")) or "High",
                "2500yr ARI max depth",
            ))),
    DataSource("bop_liquefaction_a", "BOP Liquefaction Level A (Desktop)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/Natural_Hazards/MapServer/10",
            "liquefaction_detail", "bay_of_plenty",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LiquefactionVulnerabilityCatego")) or "Unknown",
                _clean(a.get("Terrain")) or _clean(a.get("SubTerrain")),
            ))),
    DataSource("bop_liquefaction_b", "BOP Liquefaction Level B (Detailed)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/Natural_Hazards/MapServer/11",
            "liquefaction_detail", "bop_level_b",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LiquefactionVulnerabilityCatego")) or "Unknown",
                _clean(a.get("Terrain")) or _clean(a.get("SubTerrain")),
            ))),
    DataSource("bop_active_faults", "BOP Active Faults (GNS)",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/Natural_Hazards/MapServer/1",
            "active_faults", "bay_of_plenty",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                _clean(a.get("NAME")) or "Active Fault",
                _clean(a.get("ACTIVITY")),
                _clean(a.get("TOTAL_SLIP")),
                "GNS via BoPRC",
            ),
            geom_type="line")),
    DataSource("bop_historic_floods", "BOP Historic Flood Extents",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/Natural_Hazards/MapServer/5",
            "flood_hazard", "bay_of_plenty",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("FloodingType")) or "Historic Flood",
                "High",
                f"Historic Flood ({_clean(a.get('CaptureDate')) or '?'})",
            ))),
    DataSource("bop_calderas", "BOP Volcanic Calderas (GNS)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/Natural_Hazards/MapServer/0",
            "flood_hazard", "bop_volcanic",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Volcanic Caldera",
                "High",
                "Volcanic Caldera",
            ))),
    # ══════════════════════════════════════════════════════════
    # WAIKATO REGIONAL — expanded hazards
    # ══════════════════════════════════════════════════════════
    DataSource("waikato_tsunami", "Waikato Tsunami Hazard Classification",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/HAZ_MOD_TSUNAMI_HAZARD_CLASS/FeatureServer/12",
            "tsunami_hazard", "waikato",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Hazard Zone",
                _clean(a.get("HAZARD_CLASS")) or "Medium",
                _clean(a.get("HAZARD_CLASS")) or "Tsunami",
            ),
            srid=2193)),
    DataSource("waikato_tsunami_inundation", "Waikato Tsunami Inundation Zones",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WAIKATO_HAZ_TSUNAMI_DATA_Apr_2021/FeatureServer/28",
            "tsunami_hazard", "waikato_inundation",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("MODEL_AREA")) or "Tsunami Inundation Zone",
                "High",
                _clean(a.get("REGION")) or _clean(a.get("MODEL_TYPE")) or "Tsunami Inundation",
            ),
            srid=2193)),
    DataSource("waikato_regional_flood", "Waikato Regional Flood Hazard Update",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/Regional_Flood_Hazard_Update/FeatureServer/0",
            "flood_hazard", "waikato_regional",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("AREA_NAME")) or _clean(a.get("FLOOD_HZD_NAME")) or "Regional Flood",
                "High" if _clean(a.get("WORKS_DESIGN_STANDARD")) in ("1%", "2%") else "Medium",
                _clean(a.get("FLOOD_TYPE")) or "Flooding",
            ),
            srid=2193)),
    DataSource("waikato_flood_depth", "Waikato Local Flood Depth Model",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/HAZ_MOD_LOCAL_FLOOD_DEPTH/FeatureServer/0",
            "flood_hazard", "waikato_depth",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("LOCATION")) or "Flood Depth Zone",
                "High" if ">1" in str(a.get("FLOOD_DEPTH_GROUP_M") or "") else
                "Medium" if ">0.5" in str(a.get("FLOOD_DEPTH_GROUP_M") or "") else "Low",
                f"Flood Depth {_clean(a.get('FLOOD_DEPTH_GROUP_M')) or '?'}m",
            ),
            srid=2193)),
    # ══════════════════════════════════════════════════════════
    # GISBORNE DISTRICT — hazards
    # ══════════════════════════════════════════════════════════
    DataSource("gisborne_flood", "Gisborne Flood Hazard Overlays",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/plan_flood_hazard/FeatureServer/0",
            "flood_hazard", "gisborne",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("ZONE")) or "Flood Hazard",
                "High",
                _clean(a.get("DISTPLAN_T")) or "Flood",
            ),
            srid=2193)),
    DataSource("gisborne_tsunami", "Gisborne Tsunami Evacuation Zones 2019",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/Updated_Tsunami_Evacuation_Zones_2019/FeatureServer/3",
            "tsunami_hazard", "gisborne",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("NAME")) or "Tsunami Evacuation Zone",
                _clean(a.get("ZONE")) or "High",
                _clean(a.get("Description")) or _clean(a.get("ZONE")) or "Tsunami",
            ),
            srid=2193)),
    DataSource("gisborne_liquefaction", "Gisborne Liquefaction",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/liquefaction/FeatureServer/0",
            "liquefaction_detail", "gisborne",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Class")) or "Unknown",
                None,
            ),
            srid=2193)),
    DataSource("gisborne_coastal_hazard", "Gisborne Coastal Hazard Overlays",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/plan_coastal_hazard/FeatureServer/0",
            "coastal_erosion", "gisborne",
            ["name", "coast_type", "scenario"],
            lambda a: (
                _clean(a.get("CODE")) or "Coastal Hazard",
                "Coastal",
                _clean(a.get("DISTPLAN_T")),
            ),
            srid=2193)),
    DataSource("gisborne_stability", "Gisborne Stability Alert Areas",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/plan_stability_alert/FeatureServer/0",
            "slope_failure", "gisborne",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("TEXT")) or _clean(a.get("LABEL")) or "Stability Alert",
                "High",
            ),
            srid=2193)),
    DataSource("gisborne_coastal_flooding", "Gisborne Coastal Storm Flooding (1% AEP + 2m SLR)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/coastal_flooding/FeatureServer/1",
            "flood_hazard", "gisborne_coastal",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("NAME")) or "Coastal Storm Flood",
                "High",
                "Coastal Storm 1% AEP + 2m SLR",
            ),
            srid=2193)),
    # ══════════════════════════════════════════════════════════
    # NELSON — expanded hazards
    # ══════════════════════════════════════════════════════════
    DataSource("nelson_flood_future", "Nelson Future Flooding 2130",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/DataPublic/OurNaturalHazards/MapServer/1",
            "flood_hazard", "nelson_2130",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Type")) or "Future Flooding",
                "High" if _clean(a.get("AnnualExceedanceProbablity")) in ("1%", "2%") else "Medium",
                f"Future Flood 2130 ({_clean(a.get('AnnualExceedanceProbablity')) or '?'} AEP)",
            ))),
    DataSource("nelson_floodway", "Nelson Floodway",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/DataPublic/OurNaturalHazards/MapServer/2",
            "flood_hazard", "nelson_floodway",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Type")) or "Floodway",
                "High",
                "Floodway",
            ))),
    # ══════════════════════════════════════════════════════════
    # MARLBOROUGH — hazards
    # ══════════════════════════════════════════════════════════
    DataSource("marlborough_tsunami", "Marlborough Tsunami Inundation (GNS)",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/22",
            "tsunami_hazard", "marlborough",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Inundation Zone",
                _clean(a.get("EvacuationZone")) or "High",
                _clean(a.get("Label")) or _clean(a.get("EvacuationZone")) or "Tsunami",
            ))),
    DataSource("marlborough_slr", "Marlborough Sea Level Rise Modelling",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Hazard/MapServer/4",
            "coastal_inundation", "marlborough",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                f"SLR {_clean(a.get('Type')) or 'Inundation'}",
                "High" if _clean(a.get("Scenario")) and "8.5" in str(a.get("Scenario")) else "Medium",
                f"{_clean(a.get('Scenario')) or '?'} {a.get('Year') or '?'}",
            ))),
    DataSource("marlborough_liquefaction_a", "Marlborough Liquefaction Investigation Zone A",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/31",
            "liquefaction_detail", "marlborough_a",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("ZoneName")) or "LIZ A — High Vulnerability",
                "LIZ A",
            ))),
    DataSource("marlborough_liquefaction_b", "Marlborough Liquefaction Investigation Zone B",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/30",
            "liquefaction_detail", "marlborough_b",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("ZoneName")) or "LIZ B — Moderate Vulnerability",
                "LIZ B",
            ))),
    DataSource("marlborough_liquefaction_c", "Marlborough Liquefaction Investigation Zone C",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/32",
            "liquefaction_detail", "marlborough_c",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("ZoneName")) or "LIZ C",
                "LIZ C",
            ))),
    DataSource("marlborough_liquefaction_d", "Marlborough Liquefaction Investigation Zone D",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/33",
            "liquefaction_detail", "marlborough_d",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("ZoneName")) or "LIZ D",
                "LIZ D",
            ))),
    DataSource("marlborough_liquefaction_e", "Marlborough Liquefaction Investigation Zone E",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/34",
            "liquefaction_detail", "marlborough_e",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("ZoneName")) or "LIZ E",
                "LIZ E",
            ))),
    DataSource("marlborough_liquefaction_f", "Marlborough Liquefaction Investigation Zone F",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/35",
            "liquefaction_detail", "marlborough_f",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("ZoneName")) or "LIZ F",
                "LIZ F",
            ))),
    DataSource("marlborough_plan_zones", "Marlborough District Plan Zones (MEP Decision)",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/ZonesMEPDecision/MapServer/19",
            "district_plan_zones", "marlborough",
            ["zone_name", "zone_code", "category"],
            lambda a: (
                _clean(a.get("ZoningCodeLabel")) or "Unknown Zone",
                _clean(a.get("ZoningCodeLabel")),
                None,
            ))),
    DataSource("marlborough_notable_trees", "Marlborough Notable Trees (MEP)",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/ZonesMEPDecision/MapServer/7",
            "notable_trees", "marlborough",
            ["species", "common_name"],
            lambda a: (
                _clean(a.get("SpeciesName")) or "Notable Tree",
                _clean(a.get("CommonName")),
            ))),
    DataSource("marlborough_steep_erosion", "Marlborough Steep Erosion Prone Land",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/ZonesMEPDecisionOverlays/MapServer/31",
            "slope_failure", "marlborough",
            ["lskey", "severity"],
            lambda a: (
                "Steep Erosion Prone",
                "High",
            ))),

    # ══════════════════════════════════════════════════════════
    # TASMAN — hazards
    # ══════════════════════════════════════════════════════════
    DataSource("tasman_liquefaction", "Tasman Liquefaction Vulnerability (Level A)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Environment_Hazards/MapServer/8",
            "liquefaction_detail", "tasman",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LiquefactionCategory")) or "Unknown",
                _clean(a.get("Date")),
            ))),
    DataSource("tasman_coastal_slr_present", "Tasman Coastal SLR Present Day (1% AEP)",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Environment_Hazards/MapServer/3",
            "coastal_inundation", "tasman_present",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Coastal SLR (Present Day)",
                "Medium",
                f"1% AEP, SLR={a.get('SLR') or 0}m, Elev={a.get('SLRElevation') or '?'}m",
            ))),
    DataSource("tasman_coastal_slr_1m", "Tasman Coastal SLR +1.0m Scenario",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Environment_Hazards/MapServer/5",
            "coastal_inundation", "tasman_1m",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Coastal SLR (+1.0m)",
                "High",
                f"1% AEP, SLR=1.0m, Elev={a.get('SLRElevation') or '?'}m",
            ))),
    DataSource("tasman_coastal_slr_2m", "Tasman Coastal SLR +2.0m Scenario",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Environment_Hazards/MapServer/7",
            "coastal_inundation", "tasman_2m",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Coastal SLR (+2.0m)",
                "High",
                f"1% AEP, SLR=2.0m, Elev={a.get('SLRElevation') or '?'}m",
            ))),
    DataSource("tasman_faults", "Tasman Active & Capable Faultlines",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Environment_Hazards_LimitedAccess/MapServer/0",
            "active_faults", "tasman",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                _clean(a.get("Name")) or "Active Fault",
                _clean(a.get("Type")) or "active",
                None,
                _clean(a.get("DataSource")) or "Tasman DC",
            ),
            geom_type="line")),
    DataSource("tasman_historic_floods", "Tasman Historic Flood Patterns",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Environment_Hazards_LimitedAccess/MapServer/1",
            "flood_hazard", "tasman",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Event")) or _clean(a.get("Location")) or "Historic Flood",
                "High",
                f"Historic Flood ({a.get('Year') or '?'})",
            ))),
    # ══════════════════════════════════════════════════════════
    # TARANAKI — volcanic evacuation zones (addition)
    # ══════════════════════════════════════════════════════════
    DataSource("taranaki_volcanic_evac", "Taranaki Volcanic Evacuation Zones",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.trc.govt.nz/arcgis/rest/services/LocalMaps/EmergencyManagement/MapServer/4",
            "flood_hazard", "taranaki_volcanic_evac",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Description")) or f"Volcanic Evacuation Zone {a.get('Zone') or ''}",
                "High",
                "Volcanic Evacuation",
            ))),
    # ── National (DOC) ────────────────────────────────────────
    DataSource(
        "doc_huts", "DOC Huts (National)",
        ["doc_huts"],
        load_doc_huts,
    ),
    DataSource(
        "doc_tracks", "DOC Tracks (National)",
        ["doc_tracks"],
        load_doc_tracks,
    ),
    DataSource(
        "doc_campsites", "DOC Campsites (National)",
        ["doc_campsites"],
        load_doc_campsites,
    ),
    # ── National (MoE) ────────────────────────────────────────
    DataSource(
        "school_zones", "School Enrolment Zones (National)",
        ["school_zones"],
        load_school_zones,
    ),
    # ── National (Waka Kotahi) ────────────────────────────────
    DataSource(
        "nzta_noise_contours", "NZTA National Road Noise Contours",
        ["noise_contours"],
        load_nzta_noise_contours,
    ),
    # ── Northland ─────────────────────────────────────────────
    DataSource(
        "nrc_contaminated_land", "NRC Contaminated Land (Northland)",
        ["contaminated_land"],
        load_nrc_contaminated_land,
    ),
    # ══════════════════════════════════════════════════════════
    # DISTRICT PLAN ZONES — all councils
    # ══════════════════════════════════════════════════════════
    DataSource("whangarei_zones_residential", "Whangarei Residential Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/District_Plan_Public/MapServer/65",
            "district_plan_zones", "whangarei_residential",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("ZONE")) or _clean(a.get("ePlanDisplayField")) or "Residential",
                "Residential",
            ))),
    DataSource("whangarei_zones_commercial", "Whangarei Commercial & Mixed Use Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/District_Plan_Public/MapServer/67",
            "district_plan_zones", "whangarei_commercial",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("ZONE")) or "Commercial/Mixed Use",
                "Commercial",
            ))),
    DataSource("whangarei_zones_rural", "Whangarei Rural Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/District_Plan_Public/MapServer/66",
            "district_plan_zones", "whangarei_rural",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("ZONE")) or "Rural",
                "Rural",
            ))),
    DataSource("whangarei_zones_industrial", "Whangarei Industrial Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/District_Plan_Public/MapServer/68",
            "district_plan_zones", "whangarei_industrial",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("ZONE")) or "Industrial",
                "Industrial",
            ))),
    DataSource("invercargill_zones", "Invercargill Planning Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/Essentials/DistrictPlan/MapServer/49",
            "district_plan_zones", "invercargill",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("FINAL")) or _clean(a.get("NEW_ZONE")) or "Zone",
                _clean(a.get("LIMCODE")),
            ))),
    DataSource("kapiti_zones", "Kapiti Coast District Plan Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/District_Plan_Zones/MapServer/0",
            "district_plan_zones", "kapiti_coast",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("ePlan_Zone")) or _clean(a.get("PDP_ZONE")) or "Zone",
                _clean(a.get("Abbreviation")),
            ))),
    DataSource("porirua_zones", "Porirua Planning Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/DistrictPlan/Operative_District_Plan/MapServer/19",
            "district_plan_zones", "porirua",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("ZONE")) or "Zone",
                None,
            ))),
    DataSource("palmerston_north_zones", "Palmerston North Planning Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/DISTRICTPLAN_PlanningZones/FeatureServer/0",
            "district_plan_zones", "palmerston_north",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("ZONE")) or "Zone",
                None,
            ),
            srid=2193)),
    DataSource("qldc_zones", "Queenstown-Lakes Operative Zones",
        ["plan_zones"],
        # QLDC's operative plan layer exposes `ZONE` (the full zone name like
        # "High Density Residential Zone") and sometimes `Zone_Name`, but no
        # separate short code or category field. Previously we stored the
        # same string in zone_code AND zone_name, which left the report
        # showing "High Density Residential Zone" as the zone_code. Now we
        # leave zone_code NULL unless the feed actually has a distinct
        # abbreviation, and derive category from the zone name text.
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/DistrictPlan/Operative_District_Plan/MapServer/37",
            "district_plan_zones", "queenstown_lakes",
            ["zone_name", "zone_code", "category"],
            lambda a: (
                _clean(a.get("Zone_Name")) or _clean(a.get("ZONE")) or "Zone",
                _clean(a.get("Zone_Code")) or _clean(a.get("ZONE_CODE")),
                _derive_zone_category(_clean(a.get("Zone_Name")) or _clean(a.get("ZONE"))),
            ))),
    DataSource("rotorua_zones", "Rotorua Zoning",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services6.arcgis.com/NIWVPpy3nWPIOE2J/arcgis/rest/services/Zoning/FeatureServer/0",
            "district_plan_zones", "rotorua",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("Description")) or _clean(a.get("Type")) or "Zone",
                _clean(a.get("Code")),
            ),
            srid=2193)),
    DataSource("taupo_zones", "Taupo District Plan Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/S7DHOirgbYgdtrbR/arcgis/rest/services/Zone_NPS_view/FeatureServer/0",
            "district_plan_zones", "taupo",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("Zone")) or "Zone",
                _clean(a.get("Status")),
            ),
            srid=2193)),
    DataSource("timaru_zones", "Timaru Proposed District Plan Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.timaru.govt.nz/server/rest/services/Vector/Proposed_District_Plan/MapServer/57",
            "district_plan_zones", "timaru",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("ZONE_NAME")) or "Zone",
                _clean(a.get("ABBREVIATION")),
            ))),
    DataSource("waimakariri_zones", "Waimakariri District Plan Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gisservices.waimakariri.govt.nz/arcgis/rest/services/District_Plan_2021/District_Plan_General/MapServer/0",
            "district_plan_zones", "waimakariri",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("NAME")) or "Zone",
                _clean(a.get("Status")),
            ))),
    DataSource("gisborne_zones", "Gisborne District Plan Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/plan_flood_hazard/FeatureServer/0",
            "district_plan_zones", "gisborne",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("ZONE")) or "Zone",
                _clean(a.get("DISTPLAN_T")),
            ),
            srid=2193)),
    # ══════════════════════════════════════════════════════════
    # HERITAGE SITES — all councils
    # ══════════════════════════════════════════════════════════
    DataSource("whangarei_heritage", "Whangarei Heritage Items",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/District_Plan_Public/MapServer/31",
            "historic_heritage_overlay", "whangarei",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("DESCRIPTIO")) or _clean(a.get("ePlanDisplayField")) or "Heritage Item",
                _clean(a.get("LABEL")),
                None,
            ),
            geom_type="point")),
    DataSource("invercargill_heritage", "Invercargill Heritage Sites",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/Essentials/DistrictPlan/MapServer/8",
            "historic_heritage_overlay", "invercargill",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("DESCRIPTION")) or "Heritage Site",
                _clean(a.get("CLASS")) or _clean(a.get("CATEGORY")),
                _clean(a.get("REF_NO")),
            ),
            geom_type="point")),
    DataSource("kapiti_heritage", "Kapiti Coast Historic Heritage Places",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/District_Plan_Overlays/MapServer/14",
            "historic_heritage_overlay", "kapiti_coast",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("LOCATION")) or "Heritage Place",
                _clean(a.get("SIGNIFICANCE")),
                _clean(a.get("ORIGIN")),
            ),
            geom_type="point")),
    DataSource("porirua_heritage", "Porirua Historic Heritage Buildings",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/DistrictPlan/Operative_District_Plan/MapServer/1",
            "historic_heritage_overlay", "porirua",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("NAME")) or _clean(a.get("FEATURE_DE")) or "Heritage Building",
                _clean(a.get("NZHPT_OR_A")),
                _clean(a.get("LOCATION__")),
            ),
            geom_type="point")),
    DataSource("palmerston_north_heritage", "Palmerston North Heritage Sites",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/DISTRICTPLAN_HeritageSites/FeatureServer/0",
            "historic_heritage_overlay", "palmerston_north",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("BLDG_OBJECT")) or "Heritage Site",
                _clean(a.get("TYPE")),
                None,
            ),
            geom_type="point",
            srid=2193)),
    DataSource("qldc_heritage", "Queenstown-Lakes Heritage & Protected Features",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.qldc.govt.nz/server/rest/services/DistrictPlan/PDP_Stage_1_2_3_Decisions/MapServer/13",
            "historic_heritage_overlay", "queenstown_lakes",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("Description")) or "Heritage Feature",
                _clean(a.get("FeatureType")),
                _clean(a.get("RefNo")),
            ),
            geom_type="point")),
    DataSource("taupo_heritage", "Taupo Historic Heritage Sites",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/S7DHOirgbYgdtrbR/arcgis/rest/services/Historic_Heritage_NPS_view/FeatureServer/0",
            "historic_heritage_overlay", "taupo",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("Name")) or "Heritage Site",
                _clean(a.get("Type")),
                _clean(a.get("TDC_ID")),
            ),
            geom_type="point",
            srid=2193)),
    DataSource("timaru_heritage", "Timaru Heritage Buildings",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.timaru.govt.nz/server/rest/services/Vector/Proposed_District_Plan/MapServer/6",
            "historic_heritage_overlay", "timaru",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("SITE_BUILDING_NAME")) or "Heritage Building",
                _clean(a.get("CATEGORY")),
                _clean(a.get("UNIQUE_INDENTIFIER")),
            ),
            geom_type="point")),
    DataSource("waimakariri_heritage", "Waimakariri Heritage Buildings",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gisservices.waimakariri.govt.nz/arcgis/rest/services/District_Plan_2021/District_Plan_General/MapServer/7",
            "historic_heritage_overlay", "waimakariri",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("Name")) or "Heritage Item",
                _clean(a.get("Historic_Heritage_Category")),
                _clean(a.get("Address")),
            ),
            geom_type="point")),
    # ══════════════════════════════════════════════════════════
    # NOTABLE TREES — all councils
    # ══════════════════════════════════════════════════════════
    DataSource("whangarei_trees", "Whangarei Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/District_Plan_Public/MapServer/30",
            "notable_trees", "whangarei",
            ["name", "species", "address"],
            lambda a: (
                _clean(a.get("LABEL")) or "Notable Tree",
                _clean(a.get("LISTING")),
                None,
            ),
            geom_type="point")),
    DataSource("kapiti_trees", "Kapiti Coast Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/District_Plan_Overlays/MapServer/16",
            "notable_trees", "kapiti_coast",
            ["name", "species", "address"],
            lambda a: (
                _clean(a.get("SIGNIFICANCE")) or "Notable Tree",
                _clean(a.get("LOCATION")),
                None,
            ),
            geom_type="point")),
    DataSource("palmerston_north_trees", "Palmerston North Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/PARKS_NotableTrees/FeatureServer/0",
            "notable_trees", "palmerston_north",
            ["name", "species", "address"],
            lambda a: (
                _clean(a.get("COMMON_NAME")) or "Notable Tree",
                _clean(a.get("BOTANICAL_NAME")),
                None,
            ),
            geom_type="point",
            srid=2193)),
    DataSource("taupo_trees", "Taupo Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/S7DHOirgbYgdtrbR/arcgis/rest/services/Notable_Trees_NPS/FeatureServer/0",
            "notable_trees", "taupo",
            ["name", "species", "address"],
            lambda a: (
                _clean(a.get("Species_Group")) or "Notable Tree",
                _clean(a.get("Tree_Type")),
                _clean(a.get("Road_Name")),
            ),
            geom_type="point",
            srid=2193)),
    DataSource("timaru_trees", "Timaru Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.timaru.govt.nz/server/rest/services/Vector/Proposed_District_Plan/MapServer/30",
            "notable_trees", "timaru",
            ["name", "species", "address"],
            lambda a: (
                _clean(a.get("COMMON_NAME")) or "Notable Tree",
                _clean(a.get("BOTANICAL_NAME")),
                _clean(a.get("UNIQUE_IDENTIFIER")),
            ),
            geom_type="point")),
    DataSource("waimakariri_trees", "Waimakariri Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gisservices.waimakariri.govt.nz/arcgis/rest/services/District_Plan_2021/District_Plan_General/MapServer/5",
            "notable_trees", "waimakariri",
            ["name", "species", "address"],
            lambda a: (
                _clean(a.get("Tree_Common_Name")) or "Notable Tree",
                _clean(a.get("Tree_Species")),
                _clean(a.get("Tree_Location_Address")),
            ),
            geom_type="point")),
    # ══════════════════════════════════════════════════════════
    # NOISE CONTOURS — additional cities
    # ══════════════════════════════════════════════════════════
    DataSource("chch_airport_noise_65db", "Christchurch Airport Noise 65dB Envelope",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/Hosted/Airport_Noise_Corridors_2023/FeatureServer/0",
            "noise_contours", "christchurch_65db",
            ["laeq24h", "source_council"],
            lambda a: (
                65,
                "Christchurch Airport 65dB",
            ),
            srid=2193)),
    DataSource("chch_airport_noise_55db", "Christchurch Airport Noise 55dB Envelope",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/Hosted/Airport_Noise_Corridors_2023/FeatureServer/1",
            "noise_contours", "christchurch_55db",
            ["laeq24h", "source_council"],
            lambda a: (
                55,
                "Christchurch Airport 55dB",
            ),
            srid=2193)),
    DataSource("chch_airport_noise_50db", "Christchurch Airport Noise 50dB Envelope",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ccc.govt.nz/arcgis/rest/services/Hosted/Airport_Noise_Corridors_2023/FeatureServer/2",
            "noise_contours", "christchurch_50db",
            ["laeq24h", "source_council"],
            lambda a: (
                50,
                "Christchurch Airport 50dB",
            ),
            srid=2193)),
    DataSource("hamilton_airport_noise", "Hamilton Airport Noise Overlay (Waipa)",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services9.arcgis.com/OsxSXqmTWVTZQ9ie/arcgis/rest/services/WaipaDistrictPlan_Airport_Noise_Overlay/FeatureServer/0",
            "noise_contours", "hamilton_airport",
            ["laeq24h", "source_council"],
            lambda a: (
                65 if "AIR NOISE" in str(a.get("Name") or "").upper() else
                55 if "OUTER" in str(a.get("Name") or "").upper() else 60,
                f"Hamilton Airport - {_clean(a.get('Name')) or 'Noise Boundary'}",
            ),
            srid=2193)),
    DataSource("pncc_airport_noise", "Palmerston North Airport Noise Zones",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/DISTRICTPLAN_AirportNoiseZones/FeatureServer/0",
            "noise_contours", "palmerston_north_airport",
            ["laeq24h", "source_council"],
            lambda a: (
                65 if "INNER" in str(a.get("NOISEZONE") or "").upper() else 55,
                f"Palmerston North Airport - {_clean(a.get('NOISEZONE')) or 'Noise Zone'}",
            ),
            srid=2193)),
    DataSource("marlborough_noise", "Marlborough Noise Control Boundaries",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/OpenData/OpenData5/MapServer/34",
            "noise_contours", "marlborough",
            ["laeq24h", "source_council"],
            lambda a: (
                int("".join(c for c in str(a.get("ActivityLimitation") or "55") if c.isdigit()) or "55"),
                f"Marlborough {_clean(a.get('NoiseType')) or 'Noise'} - {_clean(a.get('ActivityLimitation')) or '?'}",
            ))),
    # ══════════════════════════════════════════════════════════
    # CONTAMINATED LAND — additional regions
    # ══════════════════════════════════════════════════════════
    DataSource("bop_contaminated", "BOP HAIL Contaminated Sites",
        ["contaminated_land"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/ConsentsandCompliance/MapServer/2",
            "contaminated_land", "bay_of_plenty",
            ["site_id", "classification", "hail_code", "description"],
            lambda a: (
                _clean(a.get("SiteID")) or _clean(a.get("BOPRC_Ref")) or "Unknown",
                _clean(a.get("SiteClassification")) or "HAIL Site",
                _clean(a.get("HAILCode")),
                _clean(a.get("HAILActivityDescription")) or _clean(a.get("HAILSummary")),
            ))),
    # ══════════════════════════════════════════════════════════
    # INVERCARGILL — additional hazard layers
    # ══════════════════════════════════════════════════════════
    DataSource("invercargill_riverine_inundation", "Invercargill Riverine Inundation",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/LocalMaps/LocalMaps_DistrictPlan_Hazards/MapServer/4",
            "flood_hazard", "invercargill_riverine",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Riverine Inundation",
                "High",
                "Riverine Inundation",
            ))),
    DataSource("invercargill_sea_level_rise", "Invercargill Sea Level Rise Storm Surge",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/LocalMaps/LocalMaps_DistrictPlan_Hazards/MapServer/5",
            "coastal_inundation", "invercargill",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Sea Level Rise Storm Surge",
                "High",
                "SLR Storm Surge Event",
            ))),
    DataSource("invercargill_coastal_erosion", "Invercargill Coastline Prone to Erosion",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/LocalMaps/LocalMaps_DistrictPlan_Hazards/MapServer/3",
            "coastal_erosion", "invercargill",
            ["name", "coast_type", "scenario"],
            lambda a: (
                "Coastline Most Prone to Erosion",
                "Coastal",
                None,
            ),
            geom_type="line")),
    DataSource("invercargill_liquefaction", "Invercargill Liquefaction Vulnerability",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/LocalMaps/LocalMaps_LiquefactionVulnerability/MapServer/0",
            "liquefaction_detail", "invercargill",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or "Liquefaction",
                _clean(a.get("Geomorphic_Terrain")),
            ))),

    # ══════════════════════════════════════════════════════════
    # PORIRUA — hazard layers
    # ══════════════════════════════════════════════════════════
    DataSource("porirua_flood", "Porirua Flood Hazard",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/DistrictPlan/Operative_District_Plan/MapServer/5",
            "flood_hazard", "porirua",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("prov_type")) or "Flood Hazard",
                "High",
                "Flood Hazard",
            ))),
    # ══════════════════════════════════════════════════════════
    # KAPITI COAST — hazard layers
    # ══════════════════════════════════════════════════════════
    DataSource("kapiti_flood", "Kapiti Coast Flood Hazard",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/District_Plan_Overlays/MapServer/11",
            "flood_hazard", "kapiti_coast",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("ZONE")) or "Flood Hazard",
                "High",
                "Flood Hazard",
            ))),
    DataSource("kapiti_fault_avoidance", "Kapiti Coast Fault Avoidance Areas",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/District_Plan_Overlays/MapServer/10",
            "active_faults", "kapiti_coast",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                "Fault Avoidance Area",
                "Fault Avoidance",
                None,
                "Kapiti Coast DC",
            ))),
    # ══════════════════════════════════════════════════════════
    # PALMERSTON NORTH — flood prone areas
    # ══════════════════════════════════════════════════════════
    DataSource("pncc_flood_prone", "Palmerston North Flood Prone Areas",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/DISTRICTPLAN_FLOODPRONEAREAS/FeatureServer/0",
            "flood_hazard", "palmerston_north",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Flood Prone Area",
                "High",
                "Flood Prone",
            ),
            srid=2193)),
    # ══════════════════════════════════════════════════════════
    # TIMARU — hazard layers
    # ══════════════════════════════════════════════════════════
    DataSource("timaru_flood", "Timaru Flood Assessment Area",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.timaru.govt.nz/server/rest/services/Vector/Proposed_District_Plan/MapServer/38",
            "flood_hazard", "timaru",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Flood Assessment Area",
                "High",
                "Flood Assessment",
            ))),
    DataSource("timaru_liquefaction", "Timaru Liquefaction Areas",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.timaru.govt.nz/server/rest/services/Vector/Proposed_District_Plan/MapServer/41",
            "liquefaction_detail", "timaru_dp",
            ["liquefaction", "simplified"],
            lambda a: (
                "Liquefaction Area",
                None,
            ))),
    DataSource("timaru_earthquake_fault", "Timaru Earthquake Fault Areas",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.timaru.govt.nz/server/rest/services/Vector/Proposed_District_Plan/MapServer/40",
            "active_faults", "timaru",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                "Earthquake Fault Area",
                "Fault",
                None,
                "Timaru DC",
            ))),
    DataSource("timaru_coastal_hazard", "Timaru Coastal High Hazard",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.timaru.govt.nz/server/rest/services/Vector/Proposed_District_Plan/MapServer/35",
            "coastal_erosion", "timaru",
            ["name", "coast_type", "scenario"],
            lambda a: (
                "Coastal High Hazard (Erosion)",
                "Coastal",
                None,
            ))),
    # ══════════════════════════════════════════════════════════
    # WAIMAKARIRI — additional hazard layers
    # ══════════════════════════════════════════════════════════
    DataSource("waimakariri_fault_awareness", "Waimakariri Fault Awareness Overlay",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gisservices.waimakariri.govt.nz/arcgis/rest/services/District_Plan_2021/District_Plan_General/MapServer/27",
            "active_faults", "waimakariri_awareness",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                "Fault Awareness Area",
                "Fault Awareness",
                None,
                "Waimakariri DC",
            ))),
    DataSource("waimakariri_ashley_fault", "Waimakariri Ashley Fault Avoidance",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gisservices.waimakariri.govt.nz/arcgis/rest/services/District_Plan_2021/District_Plan_General/MapServer/26",
            "active_faults", "waimakariri_ashley",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                "Ashley Fault Avoidance Zone",
                "Fault Avoidance",
                None,
                "Waimakariri DC",
            ))),
    # ══════════════════════════════════════════════════════════
    # NELSON — slope instability
    # ══════════════════════════════════════════════════════════
    DataSource("nelson_slope_instability", "Nelson Slope Instability Overlay",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/DataPublic/SlopeInstabilityOverlay/MapServer/0",
            "slope_failure", "nelson",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Type")) or "Slope Instability Zone",
                "High",
            ))),
    # ══════════════════════════════════════════════════════════
    # TAUPO — fault avoidance zones
    # ══════════════════════════════════════════════════════════
    DataSource("taupo_fault_avoidance", "Taupo Fault Avoidance Zones",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.taupodc.govt.nz/server/rest/services/hazards/Fault_Avoidance_Zone/MapServer/0",
            "active_faults", "taupo_faz",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                "Fault Avoidance Zone",
                "Fault Avoidance",
                None,
                "Taupo DC",
            ))),
    DataSource("taupo_fault_awareness", "Taupo Fault Awareness Areas",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.taupodc.govt.nz/server/rest/services/hazards/Fault_Awareness_Area/MapServer/0",
            "active_faults", "taupo_faa",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                "Fault Awareness Area",
                "Fault Awareness",
                None,
                "Taupo DC",
            ))),
    # ══════════════════════════════════════════════════════════
    # GAP FILLS — session 65 second pass
    # ══════════════════════════════════════════════════════════
    # ── Wellington heritage + trees (WCC 2024 District Plan) ──
    DataSource("wcc_heritage", "Wellington Heritage Buildings (2024 DP)",
        ["historic_heritage_overlay"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/67",
            "historic_heritage_overlay", "wellington",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("Name")) or "Heritage Building",
                _clean(a.get("DPRef")),
                _clean(a.get("Type")) or _clean(a.get("Schedule")),
            ),
            geom_type="point")),
    DataSource("wcc_heritage_areas", "Wellington Heritage Areas (2024 DP)",
        ["character_precincts"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/73",
            "character_precincts", "wellington_heritage",
            ["name", "type", "code"],
            lambda a: (
                _clean(a.get("Name")) or "Heritage Area",
                "Heritage Area",
                _clean(a.get("DPRef")),
            ))),
    DataSource("wcc_notable_trees", "Wellington Notable Trees (2024 DP)",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.wcc.govt.nz/arcgis/rest/services/2024DistrictPlan/2024DistrictPlan/MapServer/78",
            "notable_trees", "wellington",
            ["name", "schedule", "tree_type"],
            lambda a: (
                _clean(a.get("CommonName")) or _clean(a.get("BotanicalName")) or "Notable Tree",
                _clean(a.get("DPRef")),
                _clean(a.get("BotanicalName")),
            ),
            geom_type="point")),
    # ── GWRC tsunami (covers Porirua, Kapiti, Lower Hutt, Upper Hutt) ──
    DataSource("gwrc_tsunami", "GWRC Tsunami Zones (all Greater Wellington)",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://mapping.gw.govt.nz/arcgis/rest/services/GW/Emergencies_P/MapServer/23",
            "tsunami_hazard", "greater_wellington",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Evac_Zone")) or "Tsunami Zone",
                _clean(a.get("Col_Code")) or "High",
                f"{_clean(a.get('Location')) or 'GWRC'}: {_clean(a.get('Info')) or _clean(a.get('Heights')) or 'Tsunami'}",
            ))),
    # ── Tauranga slope hazard (verified, rich fields) ──
    DataSource("tauranga_slope_hazard", "Tauranga Slope/Landslide Hazard",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/Natural_Hazards__multiple_data_sources/MapServer/21",
            "slope_failure", "tauranga_landslide",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("SlopeType")) or _clean(a.get("Type")) or "Slope Hazard",
                _clean(a.get("Activity")) or "High",
            ))),
    # ── Waimakariri flood hazard (200yr Ashley breakout) ──
    DataSource("waimakariri_flood_ashley", "Waimakariri 200yr Ashley Breakout Flood",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gisservices.waimakariri.govt.nz/arcgis/rest/services/Natural_Hazards/Waimakariri_District_Hazards/MapServer/0",
            "flood_hazard", "waimakariri_ashley",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Ashley Breakout Flood (200yr)",
                "High" if (a.get("gridcode") or 0) > 500 else "Medium",
                f"Flood Depth gridcode={a.get('gridcode') or '?'}",
            ))),
    DataSource("waimakariri_flood_coastal", "Waimakariri 100yr Coastal Flood",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gisservices.waimakariri.govt.nz/arcgis/rest/services/Natural_Hazards/Waimakariri_District_Hazards/MapServer/7",
            "flood_hazard", "waimakariri_coastal",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Coastal Flood (100yr)",
                "High",
                f"Coastal Flood gridcode={a.get('gridcode') or '?'}",
            ))),
    DataSource("waimakariri_flood_localised", "Waimakariri 200yr Localised Flood",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gisservices.waimakariri.govt.nz/arcgis/rest/services/Natural_Hazards/Waimakariri_District_Hazards/MapServer/8",
            "flood_hazard", "waimakariri_localised",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Localised Flood (200yr)",
                "High" if (a.get("gridcode") or 0) > 500 else "Medium",
                f"Localised Flood gridcode={a.get('gridcode') or '?'}",
            ))),
    # ══════════════════════════════════════════════════════════════════════
    #  SESSION 66 — Fill ALL remaining gaps for every district/region
    # ══════════════════════════════════════════════════════════════════════

    # ── Canterbury / ECan — flood, floodways, coastal ──
    DataSource("ecan_flood_kaikoura", "ECan Kaikoura Flood Assessment",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/9",
            "flood_hazard", "ecan_kaikoura",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Kaikoura Flood Assessment",
                "High",
                _clean(a.get("Description")) or "Flood Assessment",
            ))),
    DataSource("ecan_flood_waitaki", "ECan Waitaki Flood Assessment",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/16",
            "flood_hazard", "ecan_waitaki",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Waitaki Flood Assessment",
                "High",
                _clean(a.get("Description")) or "Flood Assessment",
            ))),
    DataSource("ecan_floodways", "ECan Floodways (Bylaw 2013)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/PlanningZones/MapServer/7",
            "flood_hazard", "ecan_floodway",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "ECan Floodway",
                "High",
                "Floodway (Bylaw 2013)",
            ))),
    DataSource("ecan_rcep_coastal_hazard", "ECan RCEP Coastal Hazard Zones",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/RCEP/MapServer/29",
            "coastal_erosion", "ecan_rcep",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("Name")) or "RCEP Coastal Hazard",
                "Coastal Hazard Zone",
            ))),
    DataSource("ecan_sea_inundation", "ECan Sea Water Inundation Zone",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/RCEP/MapServer/30",
            "coastal_inundation", "ecan_sea_inundation",
            ["name", "scenario"],
            lambda a: (
                "Sea Water Inundation Zone",
                _clean(a.get("Description")) or "RCEP Boundary",
            ))),

    # ── Marlborough — flood hazard, steep erosion, SLR, tsunami ──
    DataSource("marlborough_flood", "Marlborough Flood Hazard Areas (MEP)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/ZonesMEPDecisionOverlays/MapServer/2",
            "flood_hazard", "marlborough",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Type")) or "Marlborough Flood Hazard",
                _clean(a.get("HazardStatus")) or "High",
                f"MEP Flood Level: {_clean(a.get('HazardStatus')) or '?'}",
            ))),
    DataSource("marlborough_steep_erosion", "Marlborough Steep Erosion Prone Land",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/ZonesMEPDecisionOverlays/MapServer/31",
            "slope_failure", "marlborough_erosion",
            ["lskey", "severity"],
            lambda a: (
                "Steep Erosion Prone Land",
                "High",
            ))),
    # marlborough_slr and marlborough_tsunami already exist earlier in the file

    # ── Auckland — volcanic field, coastal erosion/instability ──
    DataSource("auckland_volcanic_vents", "Auckland Volcanic Field — Past Vents",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/AucklandsHazardViewer20181128/FeatureServer/2",
            "flood_hazard", "auckland_avf_vents",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Volcano")) or "Volcanic Vent",
                "High",
                "AVF Past Vent",
            ),
            geom_type="point")),
    DataSource("auckland_volcanic_field", "Auckland Volcanic Field Boundary",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/AucklandsHazardViewer20181128/FeatureServer/3",
            "flood_hazard", "auckland_avf_boundary",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Auckland Volcanic Field Boundary",
                "High",
                "AVF Boundary",
            ))),
    DataSource("auckland_volcanic_5km_buffer", "Auckland Volcanic Field 5km Buffer",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/AucklandsHazardViewer20181128/FeatureServer/4",
            "flood_hazard", "auckland_avf_5km",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "AVF 5km Buffer Zone",
                "Medium",
                "AVF Buffer",
            ))),
    DataSource("auckland_volcanic_deposits", "Auckland Volcanic Field Past Deposits",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/AucklandsHazardViewer20181128/FeatureServer/5",
            "flood_hazard", "auckland_avf_deposits",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Volcanic Deposit",
                "High",
                _clean(a.get("Description")) or "Past Deposit",
            ))),
    DataSource("auckland_coastal_erosion_2130", "Auckland Coastal Erosion/Instability (ASCIE 2130 RCP8.5)",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Susceptible_Areas_ASCIE_2130_RCP85_Regional/FeatureServer/0",
            "coastal_erosion", "auckland_ascie",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Description")) or _clean(a.get("ASCIE_Cat")) or "Coastal Susceptibility",
                _clean(a.get("Hazard")) or "Erosion/Instability",
            ))),

    # ── Nelson — plan zones, heritage, flooding, liquefaction, fault, slope, notable trees ──
    DataSource("nelson_plan_zones", "Nelson District Plan Zones (NRMP PC29)",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_PC29_Operative/FeatureServer/12",
            "district_plan_zones", "nelson",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("Name")) or "Nelson Zone",
                _clean(a.get("ZoneType")) or _clean(a.get("Category")) or "Zone",
            ))),
    DataSource("nelson_heritage", "Nelson Heritage Buildings/Objects/Places (NRMP PC29)",
        ["historic_heritage_overlay"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_PC29_Operative/FeatureServer/0",
            "historic_heritage_overlay", "nelson",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("HeritageName")) or "Nelson Heritage",
                _clean(a.get("Category")) or "Heritage",
                _clean(a.get("Type")) or "Building/Object/Place",
            ),
            geom_type="point")),
    DataSource("nelson_flood_overlay", "Nelson Flood Overlay (NRMP PC29)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_PC29_Operative/FeatureServer/4",
            "flood_hazard", "nelson_flood_overlay",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Nelson Flood Overlay",
                "High",
                "NRMP Flood Overlay",
            ))),
    DataSource("nelson_high_flood", "Nelson High Flood Hazard Overlay (NRMP PC29)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_PC29_Operative/FeatureServer/9",
            "flood_hazard", "nelson_high_flood",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Nelson High Flood Hazard",
                "High",
                "NRMP High Flood Hazard Overlay",
            ))),
    DataSource("nelson_liquefaction_nrmp", "Nelson Liquefaction Hazard Overlay (NRMP PC29)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_PC29_Operative/FeatureServer/10",
            "liquefaction_detail", "nelson_nrmp",
            ["name", "susceptibility", "category"],
            lambda a: (
                "Nelson Liquefaction Overlay",
                "Susceptible",
                "NRMP Liquefaction Hazard",
            ))),
    DataSource("nelson_fault_awareness", "Nelson Fault Awareness Overlay (NRMP PC29)",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_PC29_Operative/FeatureServer/1",
            "fault_zones", "nelson_awareness",
            ["name", "fault_complexity"],
            lambda a: (
                "Fault Awareness Overlay",
                "Fault Awareness Zone",
            ))),
    DataSource("nelson_fault_deformation", "Nelson Fault Deformation Overlay (NRMP PC29)",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_PC29_Operative/FeatureServer/2",
            "fault_zones", "nelson_deformation",
            ["name", "fault_complexity"],
            lambda a: (
                "Fault Deformation Overlay",
                "Fault Deformation Zone",
            ))),
    DataSource("nelson_fault_hazard_nrmp", "Nelson Fault Hazard Overlay (NRMP PC29)",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_PC29_Operative/FeatureServer/3",
            "fault_zones", "nelson_fault_hazard",
            ["name", "fault_complexity"],
            lambda a: (
                "Fault Hazard Overlay",
                "Fault Hazard Zone",
            ))),
    DataSource("nelson_inundation", "Nelson Inundation Overlay (NRMP PC29)",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_PC29_Operative/FeatureServer/6",
            "coastal_inundation", "nelson_inundation",
            ["name", "scenario"],
            lambda a: (
                "Nelson Inundation Overlay",
                "NRMP Inundation",
            ))),
    DataSource("nelson_slope_instability_pc29", "Nelson Slope Instability (NRMP PC29)",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/NRMP_Plan_Change_29_Slope_Instability_Reply_Nov2024/FeatureServer/0",
            "slope_failure", "nelson_slope",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Category")) or "Slope Instability",
                _clean(a.get("Hazard_Rating")) or "High",
            ))),
    DataSource("nelson_notable_trees", "Nelson Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/NelsonPlan/Notable_Trees/MapServer/0",
            "notable_trees", "nelson",
            ["name", "schedule", "tree_type"],
            lambda a: (
                _clean(a.get("CommonName")) or _clean(a.get("BotanicalName")) or "Notable Tree",
                _clean(a.get("Schedule")),
                _clean(a.get("BotanicalName")),
            ),
            geom_type="point")),
    DataSource("nelson_river_flood_present", "Nelson River Flooding Present Day",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/DataPublic/OurNaturalHazards/MapServer/0",
            "flood_hazard", "nelson_river_present",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "River Flooding (Present Day)",
                _clean(a.get("Hazard")) or "High",
                "River Flood Present Day",
            ))),
    DataSource("nelson_river_flood_2130", "Nelson River Flooding 2130",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.nelson.govt.nz/server/rest/services/DataPublic/OurNaturalHazards/MapServer/1",
            "flood_hazard", "nelson_river_2130",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "River Flooding (2130)",
                _clean(a.get("Hazard")) or "High",
                "River Flood 2130",
            ))),
    DataSource("nelson_coastal_inundation", "Nelson Coastal Inundation",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/Y4k7lyf2XTGeQC6V/arcgis/rest/services/Nelson_Coastal_Inundation/FeatureServer/0",
            "coastal_inundation", "nelson_coastal",
            ["name", "scenario"],
            lambda a: (
                _clean(a.get("Name")) or "Nelson Coastal Inundation",
                _clean(a.get("Scenario")) or _clean(a.get("Description")) or "Coastal",
            ))),

    # ── Nelson/Tasman — tsunami evacuation ──
    DataSource("nelson_tasman_tsunami", "Nelson/Tasman Tsunami Evacuation Zones",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://topofthesouthmaps.co.nz/arcgis/rest/services/DataHazards/MapServer/0",
            "tsunami_hazard", "nelson_tasman",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("Name")) or "Tsunami Evacuation Zone",
                _clean(a.get("Colour")) or "High",
                "Nelson/Tasman Evacuation",
            ))),

    # ── Tasman — plan zones ──
    DataSource("tasman_plan_zones", "Tasman District Plan Zones",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://topofthesouthmaps.co.nz/arcgis/rest/services/DataPlanning/MapServer/3",
            "district_plan_zones", "tasman",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("ZoneName")) or "Tasman Zone",
                _clean(a.get("Category")) or "Zone",
            ))),

    # ── Northland — coastal erosion, coastal flood, river flood, erosion prone, tsunami ──
    DataSource("northland_coastal_erosion", "Northland Coastal Erosion Hazard Zones",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Coastal_Erosion_Hazard_Zones/FeatureServer/0",
            "coastal_erosion", "northland_current",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("Name")) or "Coastal Erosion",
                _clean(a.get("Type")) or "Erosion Hazard Zone",
            ))),
    DataSource("northland_coastal_flood_full", "Northland Coastal Flood Hazard Zones (Full)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Northland_Coastal_Flood_Hazard_Zones/FeatureServer/0",
            "flood_hazard", "northland_coastal",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Zone")) or "Northland Coastal Flood",
                "High",
                _clean(a.get("Type")) or "Coastal Flood Hazard",
            ))),
    DataSource("northland_river_flood_100yr", "Northland River Flood 100yr+CC",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Northland_RFHZ_100yearCC_Extents/FeatureServer/0",
            "flood_hazard", "northland_river_100yr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "River Flood 100yr+CC",
                "High",
                "River Flood Hazard (100yr+CC)",
            ),
            max_allowable_offset=100, page_size=5)),
    DataSource("northland_river_flood_50yr", "Northland River Flood 50yr",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Northland_RFHZ_50year_Extents/FeatureServer/0",
            "flood_hazard", "northland_river_50yr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "River Flood 50yr",
                "High",
                "River Flood Hazard (50yr)",
            ),
            max_allowable_offset=100, page_size=5)),
    DataSource("northland_river_flood_10yr", "Northland River Flood 10yr",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Northland_RFHZ_10year_Extents/FeatureServer/0",
            "flood_hazard", "northland_river_10yr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "River Flood 10yr",
                "High",
                "River Flood Hazard (10yr)",
            ),
            max_allowable_offset=100, page_size=5)),
    DataSource("northland_erosion_prone", "Northland Erosion Prone Land",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Erosion_Prone_Land/FeatureServer/0",
            "slope_failure", "northland_erosion",
            ["lskey", "severity"],
            lambda a: (
                "Erosion Prone Land",
                "High",
            ))),

    # ── Far North — district plan hazards (via FNDC MapServer) ──
    DataSource("far_north_flood", "Far North NRC Flood Susceptible Land",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.fndc.govt.nz/server/rest/services/District_Plan_Hazards/MapServer/0",
            "flood_hazard", "far_north",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "NRC Flood Susceptible Land",
                "High",
                "Flood Susceptible (District Plan)",
            ))),
    DataSource("far_north_coastal", "Far North NRC Coastal Hazards",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.fndc.govt.nz/server/rest/services/District_Plan_Hazards/MapServer/1",
            "coastal_erosion", "far_north",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("PLACE")) or "Coastal Hazard",
                _clean(a.get("CODE")) or "Coastal",
            ),
            geom_type="line")),

    # ── Selwyn — district plan hazards (via ECAN-hosted) ──
    DataSource("selwyn_flood_zones", "Selwyn ECan Defined Flood Zones",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Selwyn_DC/SDC_DistrictPlan/MapServer/22",
            "flood_hazard", "selwyn",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "ECan Flood Zone",
                "High",
                "Flood Zone (Selwyn DP)",
            ))),
    DataSource("selwyn_faults", "Selwyn Fault Lines (via ECAN)",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Selwyn_DC/SDC_DistrictPlan/MapServer/6",
            "fault_zones", "selwyn",
            ["name", "hazard_ranking"],
            lambda a: (
                _clean(a.get("NAME")) or "Fault Line",
                _clean(a.get("Certainty")) or "Medium",
            ),
            geom_type="line")),

    # ── ORC Storm Surge (coastal inundation for Otago coast) ──
    DataSource("orc_storm_surge", "ORC Storm Surge Affected Areas (All Scenarios)",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/Stormsurge_Affectedareas_allscenarios/FeatureServer/0",
            "coastal_inundation", "otago_storm_surge",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Description")) or "Storm Surge Affected Area",
                "High",
                _clean(a.get("Source_Report")) or "ORC Storm Surge",
            ))),
    DataSource("orc_coastal_erosion_dunedin", "ORC Dunedin Coast Revised Hazard Area",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/A___Land_below_1_100_year_Storm_Surge/FeatureServer/0",
            "coastal_erosion", "dunedin_orc",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Community")) or "Dunedin Coast Hazard",
                _clean(a.get("HazardArea")) or "Coastal",
            ))),

    # ── Bay of Plenty — coastal hazard (Ohiwa Spit + Area Sensitive) ──
    DataSource("bop_coastal_hazard_ohiwa", "BOP Ohiwa Spit Coastal Hazard",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/PlansandRules/MapServer/27",
            "coastal_erosion", "bop_ohiwa",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Name")) or "Ohiwa Spit Coastal Hazard",
                "Coastal Hazard",
            ))),
    DataSource("bop_coastal_hazard_sensitive", "BOP Area Sensitive Coastal Hazard",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/PlansandRules/MapServer/34",
            "coastal_erosion", "bop_sensitive",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Name")) or "Area Sensitive Coastal Hazard",
                "Sensitive Coastal Hazard",
            ))),

    # ── Taranaki — active faults (tsunami + volcanic already exist earlier) ──
    DataSource("taranaki_active_faults", "Taranaki Active Faultlines",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.trc.govt.nz/arcgis/rest/services/LocalMaps/EmergencyManagement/MapServer/1",
            "fault_zones", "taranaki",
            ["name", "fault_complexity"],
            lambda a: (
                _clean(a.get("Name")) or "Active Faultline",
                _clean(a.get("Type")) or "Active Fault",
            ),
            geom_type="line")),

    # ── West Coast — active faults, folds, landslides ──
    DataSource("westcoast_active_faults", "West Coast Active Faults",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/Natural_Hazards/MapServer/3",
            "fault_zones", "westcoast_active",
            ["name", "fault_complexity"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("FaultName")) or "Active Fault",
                "Active Fault",
            ),
            geom_type="line")),
    DataSource("westcoast_alpine_fault", "West Coast Alpine Fault Traces",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/Natural_Hazards/MapServer/8",
            "fault_zones", "westcoast_alpine",
            ["name", "fault_complexity"],
            lambda a: (
                _clean(a.get("Name")) or "Alpine Fault Trace",
                "Alpine Fault",
            ),
            geom_type="line")),
    DataSource("westcoast_landslide_catalog", "West Coast Landslide Catalog",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/Natural_Hazards/MapServer/10",
            "slope_failure", "westcoast_landslide",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Type")) or "Landslide",
                _clean(a.get("Activity")) or "High",
            ),
            geom_type="point")),
    DataSource("westcoast_earthquake_landslides", "West Coast Earthquake-Induced Landslides",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/Natural_Hazards/MapServer/11",
            "slope_failure", "westcoast_eq_landslide",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Name")) or "Earthquake Landslide",
                "High",
            ),
            geom_type="point")),
    DataSource("westcoast_rain_landslides", "West Coast Rain-Induced Landslides",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/Natural_Hazards/MapServer/12",
            "slope_failure", "westcoast_rain_landslide",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Name")) or "Rain Landslide",
                "High",
            ),
            geom_type="point")),
    DataSource("westcoast_plan_zones", "West Coast District Plan Zones (TTPP)",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/TeTaiOPoutiniPlan/TTPPDistrictPlanZones/MapServer/0",
            "district_plan_zones", "westcoast",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("ZoneName")) or "West Coast Zone",
                _clean(a.get("ZoneType")) or "Zone",
            ))),

    # ── Marlborough — liquefaction zones A-F ──
    DataSource("marlborough_liq_a", "Marlborough Liquefaction Zone A",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/31",
            "liquefaction_detail", "marlborough_liq_a",
            ["name", "susceptibility", "category"],
            lambda a: (
                _clean(a.get("ZoneName")) or "Zone A",
                "Very High",
                _clean(a.get("Label")) or "Zone A",
            ))),
    DataSource("marlborough_liq_b", "Marlborough Liquefaction Zone B",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/30",
            "liquefaction_detail", "marlborough_liq_b",
            ["name", "susceptibility", "category"],
            lambda a: (
                _clean(a.get("ZoneName")) or "Zone B",
                "High",
                _clean(a.get("Label")) or "Zone B",
            ))),
    DataSource("marlborough_liq_c", "Marlborough Liquefaction Zone C",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/32",
            "liquefaction_detail", "marlborough_liq_c",
            ["name", "susceptibility", "category"],
            lambda a: (
                _clean(a.get("ZoneName")) or "Zone C",
                "Medium",
                _clean(a.get("Label")) or "Zone C",
            ))),
    DataSource("marlborough_liq_d", "Marlborough Liquefaction Zone D",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/33",
            "liquefaction_detail", "marlborough_liq_d",
            ["name", "susceptibility", "category"],
            lambda a: (
                _clean(a.get("ZoneName")) or "Zone D",
                "Low",
                _clean(a.get("Label")) or "Zone D",
            ))),
    DataSource("marlborough_liq_e", "Marlborough Liquefaction Zone E",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/34",
            "liquefaction_detail", "marlborough_liq_e",
            ["name", "susceptibility", "category"],
            lambda a: (
                _clean(a.get("ZoneName")) or "Zone E",
                "Very Low",
                _clean(a.get("Label")) or "Zone E",
            ))),
    DataSource("marlborough_liq_f", "Marlborough Liquefaction Zone F",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.marlborough.govt.nz/server/rest/services/DataPublic/Environment/MapServer/35",
            "liquefaction_detail", "marlborough_liq_f",
            ["name", "susceptibility", "category"],
            lambda a: (
                _clean(a.get("ZoneName")) or "Zone F",
                "Negligible",
                _clean(a.get("Label")) or "Zone F",
            ))),

    # ── Nelson/Top of South — additional hazard layers ──
    DataSource("nelson_tsunami_evac", "Nelson Tsunami Evacuation Zones (TOTS)",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://topofthesouthmaps.co.nz/arcgis/rest/services/ArcGISOnline_NCC/Hazards/MapServer/9",
            "tsunami_hazard", "nelson",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("Name")) or "Tsunami Evacuation Zone",
                _clean(a.get("Colour")) or "High",
                "Nelson Tsunami Evacuation",
            ))),
    DataSource("nelson_maitai_flood_2013", "Nelson Maitai River Flood 2013 Model",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://topofthesouthmaps.co.nz/arcgis/rest/services/ArcGISOnline_NCC/Hazards/MapServer/6",
            "flood_hazard", "nelson_maitai_2013",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Maitai River Flood (2013 Model)",
                "High",
                "River Flood Model",
            ))),
    DataSource("nelson_maitai_flood_2100", "Nelson Maitai River Flood 2100 Model",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://topofthesouthmaps.co.nz/arcgis/rest/services/ArcGISOnline_NCC/Hazards/MapServer/7",
            "flood_hazard", "nelson_maitai_2100",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Maitai River Flood (2100 Model)",
                "High",
                "River Flood Model 2100",
            ))),
    DataSource("nelson_fault_corridor", "Nelson Fault Hazard Corridor (TOTS)",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://topofthesouthmaps.co.nz/arcgis/rest/services/ArcGISOnline_NCC/Hazards/MapServer/8",
            "fault_zones", "nelson_corridor",
            ["name", "fault_complexity"],
            lambda a: (
                _clean(a.get("Name")) or "Fault Hazard Corridor",
                "Fault Hazard Corridor",
            ))),
    DataSource("nelson_slope_failure_register", "Nelson Slope Failure Register (TOTS)",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://topofthesouthmaps.co.nz/arcgis/rest/services/ArcGISOnline_NCC/Hazards/MapServer/0",
            "slope_failure", "nelson_slope_register",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Type")) or "Slope Failure",
                _clean(a.get("Activity")) or "High",
            ),
            geom_type="point")),
    DataSource("nelson_tahunanui_liquefaction", "Nelson Tahunanui Liquefaction",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://topofthesouthmaps.co.nz/arcgis/rest/services/ArcGISOnline_NCC/NelsonPlanNaturalHazards/MapServer/1",
            "liquefaction_detail", "nelson_tahunanui",
            ["name", "susceptibility", "category"],
            lambda a: (
                "Tahunanui Liquefaction Zone",
                _clean(a.get("Susceptibility")) or "High",
                "Tahunanui",
            ))),
    # ══════════════════════════════════════════════════════════════════════
    #  SESSION 67b — Rural/regional gap fill from research agents
    # ══════════════════════════════════════════════════════════════════════

    # ── HBRC — Hawke's Bay Regional (flood, landslide, liquefaction, coastal, amplification) ──
    DataSource("hbrc_flood_risk", "HBRC Flood Risk Areas (region-wide)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Flooding/MapServer/0",
            "flood_hazard", "hawkes_bay_regional",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "HBRC Flood Risk Area",
                "High",
                "Regional Flood Risk",
            ))),
    DataSource("hbrc_hastings_ponding", "HBRC Hastings Areas Subject to Ponding",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Flooding/MapServer/1",
            "flood_hazard", "hastings_ponding",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Hastings Ponding Area",
                "Medium",
                "Ponding",
            ))),
    DataSource("hbrc_landslide_high_delivery", "HBRC Landslide Risk — High (Delivery to Stream)",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Landslide_Risk/MapServer/1",
            "slope_failure", "hbrc_high_delivery",
            ["lskey", "severity"],
            lambda a: (
                "High Landslide (delivery to stream)",
                "High",
            ))),
    DataSource("hbrc_landslide_high_nodelivery", "HBRC Landslide Risk — High (Non-Delivery)",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Landslide_Risk/MapServer/2",
            "slope_failure", "hbrc_high_nodelivery",
            ["lskey", "severity"],
            lambda a: (
                "High Landslide (non-delivery)",
                "High",
            ))),
    DataSource("hbrc_earthflow_moderate", "HBRC Earthflow Risk — Moderate",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Landslide_Risk/MapServer/3",
            "slope_failure", "hbrc_earthflow_mod",
            ["lskey", "severity"],
            lambda a: (
                "Moderate Earthflow Risk",
                "Medium",
            ))),
    DataSource("hbrc_earthflow_severe", "HBRC Earthflow Risk — Severe",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Landslide_Risk/MapServer/4",
            "slope_failure", "hbrc_earthflow_severe",
            ["lskey", "severity"],
            lambda a: (
                "Severe Earthflow Risk",
                "High",
            ))),
    DataSource("hbrc_gully_risk", "HBRC Gully Erosion Risk",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Landslide_Risk/MapServer/5",
            "slope_failure", "hbrc_gully",
            ["lskey", "severity"],
            lambda a: (
                "Gully Erosion Risk",
                "High",
            ))),
    DataSource("hbrc_liquefaction_vulnerability", "HBRC Heretaunga Plains Liquefaction Vulnerability",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Earthquake_Liquefaction/MapServer/0",
            "liquefaction_detail", "hbrc_heretaunga",
            ["name", "susceptibility", "category"],
            lambda a: (
                _clean(a.get("Name")) or "Heretaunga Plains Liquefaction",
                _clean(a.get("Vulnerability")) or _clean(a.get("Category")) or "Susceptible",
                "Heretaunga Plains",
            ))),
    DataSource("hbrc_liquefaction_chb", "HBRC CHB/HDC/WDC Liquefaction Severity",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Earthquake_Liquefaction/MapServer/4",
            "liquefaction_detail", "hbrc_chb_hdc_wdc",
            ["name", "susceptibility", "category"],
            lambda a: (
                _clean(a.get("Name")) or "CHB/HDC/WDC Liquefaction",
                _clean(a.get("Severity")) or _clean(a.get("Category")) or "Variable",
                "Central HB / Hastings / Wairoa",
            ))),
    DataSource("hbrc_amplification", "HBRC Earthquake Amplification",
        ["ground_shaking"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Earthquake_Amplification/MapServer/0",
            "ground_shaking", "hawkes_bay",
            ["zone_name", "amplification_factor"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Zone")) or "Amplification Zone",
                _clean(a.get("Factor")) or _clean(a.get("Class")) or "Variable",
            ))),
    DataSource("hbrc_coastal_erosion_present", "HBRC Coastal Erosion — Present Day",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Present_Day_Coastal_Erosion/MapServer/0",
            "coastal_erosion", "hbrc_present",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Name")) or "Present Day Coastal Erosion",
                _clean(a.get("Type")) or "Present Day",
            ))),
    DataSource("hbrc_coastal_inundation_2023", "HBRC Coastal Inundation 2023",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Coastal_Inundation_2023/MapServer/0",
            "coastal_inundation", "hbrc_2023",
            ["name", "scenario"],
            lambda a: (
                _clean(a.get("Name")) or "Coastal Inundation 2023",
                _clean(a.get("Scenario")) or _clean(a.get("Description")) or "2023 Model",
            ))),
    DataSource("hbrc_wairoa_bank", "HBRC Wairoa River Bank Stability",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Wairoa_River_Bank/MapServer/1",
            "slope_failure", "hbrc_wairoa_bank",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Zone")) or "Wairoa River Bank Stability",
                _clean(a.get("Class")) or "High",
            ))),
    DataSource("hbrc_tsunami_evac_2024", "HBRC Tsunami Evacuation Zones 2024",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/hWByVnSkh6ElzHkf/arcgis/rest/services/HawkesBay_Tsunami_Evacuation_Zones_2024/FeatureServer/1",
            "tsunami_hazard", "hawkes_bay_2024",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("Name")) or "Tsunami Evacuation Zone",
                _clean(a.get("Colour")) or "High",
                "HB Tsunami Evacuation 2024",
            ))),

    # ── Horizons — flood, floodways, lahar ──
    DataSource("horizons_flood_200yr", "Horizons 200yr Modelled Flood Extent",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/Modelled_wet_extents_data_from_flood_plain_mapping_analysis/FeatureServer/11",
            "flood_hazard", "horizons_200yr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Horizons 200yr Flood",
                "High",
                "200yr Modelled Flood Extent",
            ))),
    DataSource("horizons_observed_flooding", "Horizons Observed Flooding Extents",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/NaturalHazards_ObservedFloodingExtent/FeatureServer/21",
            "flood_hazard", "horizons_observed",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Event")) or "Observed Flooding",
                "High",
                f"Observed Flooding {_clean(a.get('Year')) or ''}",
            ))),
    DataSource("horizons_floodways", "Horizons OnePlan Floodways (Schedule 10)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_OnePlan/MapServer/38",
            "flood_hazard", "horizons_floodways",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Floodway",
                "High",
                _clean(a.get("Type")) or "Floodway (OnePlan Sched 10)",
            ))),
    DataSource("horizons_lahar_ruapehu", "Horizons Ruapehu Lahar Risk Zones",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/Lahar_Risk_Ruapehu/FeatureServer/2",
            "flood_hazard", "horizons_lahar",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Zone")) or "Lahar Risk Zone",
                "High",
                "Volcanic Lahar (Ruapehu)",
            ))),
    DataSource("horizons_coastal_hazard", "Horizons Coastal Hazard Zones",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/Coastal_Hazard_Zones/FeatureServer/0",
            "coastal_erosion", "horizons_coastal",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Name")) or "Horizons Coastal Hazard",
                _clean(a.get("Type")) or "Coastal Hazard Zone",
            ))),

    # ── GWRC — additional flood, storm surge ──
    DataSource("gwrc_flood_1pct", "GWRC 1% AEP Flood Hazard Extent",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://mapping.gw.govt.nz/arcgis/rest/services/Flood_Hazard_Extents_P/MapServer/4",
            "flood_hazard", "gwrc_1pct_aep",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "1% AEP Flood Hazard",
                "High",
                "1% AEP Flood Extent",
            ))),
    DataSource("gwrc_storm_surge_present", "GWRC Storm Surge 1%AEP Present Day",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://mapping.gw.govt.nz/arcgis/rest/services/Hazards/Storm_Surge/MapServer/4",
            "coastal_inundation", "gwrc_storm_present",
            ["name", "scenario"],
            lambda a: (
                "Storm Surge 1%AEP Present Day",
                "Present Day",
            ))),
    DataSource("gwrc_storm_surge_50cm", "GWRC Storm Surge 1%AEP +50cm SLR",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://mapping.gw.govt.nz/arcgis/rest/services/Hazards/Storm_Surge/MapServer/3",
            "coastal_inundation", "gwrc_storm_50cm",
            ["name", "scenario"],
            lambda a: (
                "Storm Surge 1%AEP +50cm SLR",
                "+50cm SLR",
            ))),
    DataSource("gwrc_storm_surge_100cm", "GWRC Storm Surge 1%AEP +100cm SLR",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://mapping.gw.govt.nz/arcgis/rest/services/Hazards/Storm_Surge/MapServer/2",
            "coastal_inundation", "gwrc_storm_100cm",
            ["name", "scenario"],
            lambda a: (
                "Storm Surge 1%AEP +100cm SLR",
                "+100cm SLR",
            ))),

    # ── ECan — Kaikoura landslide/debris, Mackenzie fault, Canterbury fault awareness ──
    DataSource("ecan_kaikoura_landslide", "ECan Kaikoura Landslide Assessment",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/8",
            "slope_failure", "ecan_kaikoura_landslide",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Name")) or "Kaikoura Landslide",
                _clean(a.get("Category")) or "High",
            ))),
    DataSource("ecan_kaikoura_debris_fan", "ECan Kaikoura Debris Fan Assessment",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/10",
            "slope_failure", "ecan_kaikoura_debris",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Name")) or "Kaikoura Debris Fan",
                "High",
            ))),
    DataSource("ecan_kaikoura_faults", "ECan Kaikoura Faults (2015)",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/2",
            "fault_zones", "ecan_kaikoura_faults",
            ["name", "fault_complexity"],
            lambda a: (
                _clean(a.get("Name")) or "Kaikoura Fault",
                _clean(a.get("Type")) or "Fault",
            ),
            geom_type="line")),
    DataSource("ecan_fault_awareness_2019", "ECan Canterbury Fault Awareness Areas 2019",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/EarthquakeFaultsLayers/MapServer/0",
            "fault_zones", "ecan_fault_awareness",
            ["name", "fault_complexity"],
            lambda a: (
                _clean(a.get("Name")) or _clean(a.get("Fault_Name")) or "Canterbury Fault Awareness",
                _clean(a.get("Type")) or "Fault Awareness Area",
            ))),
    DataSource("ecan_ostler_fault", "ECan Mackenzie Ostler Fault Hazard Area",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.ecan.govt.nz/arcgis/rest/services/Public/EarthquakeFaultsLayers/MapServer/20",
            "fault_zones", "ecan_ostler_fault",
            ["name", "fault_complexity"],
            lambda a: (
                "Ostler Fault Hazard Area (Mackenzie DP)",
                "Active Fault Hazard",
            ))),

    # ── ORC — storm surge, Waitaki flood/landslide, coastal ──
    DataSource("orc_storm_surge", "ORC Storm Surge Affected Areas (all scenarios)",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/Stormsurge_Affectedareas_allscenarios/MapServer/0",
            "coastal_inundation", "orc_storm_surge",
            ["name", "scenario"],
            lambda a: (
                _clean(a.get("Name")) or "ORC Storm Surge",
                _clean(a.get("Scenario")) or "All Scenarios",
            ))),
    DataSource("orc_waitaki_floodplain", "ORC Waitaki River Indicative Floodplain",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/WaitakiRiverIndicativeFloodplain_DistrictPlanReview2021/MapServer/0",
            "flood_hazard", "orc_waitaki_floodplain",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Waitaki River Floodplain",
                "High",
                "Indicative Floodplain (DP 2021)",
            ))),
    DataSource("orc_coastal_hazard", "ORC Coastal Hazard Areas (CoastPlan)",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/CoastPlan/MapServer/8",
            "coastal_erosion", "orc_coastplan",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Name")) or "ORC Coastal Hazard",
                _clean(a.get("Type")) or "CoastPlan Hazard Area",
            ),
            geom_type="line")),

    # ── West Coast — coastal, rockfall, tsunami, TTPP flood ──
    DataSource("westcoast_coastal_hazard", "West Coast Coastal Hazard",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/Hazards/MapServer/0",
            "coastal_erosion", "westcoast_coastal",
            ["name", "coast_type"],
            lambda a: (
                _clean(a.get("Name")) or "West Coast Coastal Hazard",
                "Coastal Hazard",
            ))),
    DataSource("westcoast_rockfall", "West Coast Rockfall Hazard",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/Hazards/MapServer/1",
            "slope_failure", "westcoast_rockfall",
            ["lskey", "severity"],
            lambda a: (
                "Rockfall Hazard",
                "High",
            ))),
    DataSource("westcoast_tsunami_evac", "West Coast Tsunami Evacuation Zones",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/TsunamiEvacuationZones/MapServer/0",
            "tsunami_hazard", "westcoast",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("Name")) or "Tsunami Evacuation Zone",
                _clean(a.get("Colour")) or "High",
                "West Coast Tsunami Evacuation",
            ))),
    DataSource("westcoast_ttpp_floodplain", "West Coast TTPP Flood Plain",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/TeTaiOPoutiniPlan/TToPPDraftPlanData/MapServer/7",
            "flood_hazard", "westcoast_floodplain",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "TTPP Flood Plain",
                "High",
                "Flood Plain (TTPP)",
            ))),
    DataSource("westcoast_ttpp_flood_severe", "West Coast TTPP Flood Hazard Severe",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/TeTaiOPoutiniPlan/TToPPDraftPlanData/MapServer/10",
            "flood_hazard", "westcoast_flood_severe",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Severe Flood Hazard",
                "High",
                "Flood Hazard Severe (TTPP)",
            ))),
    DataSource("westcoast_ttpp_flood_suscept", "West Coast TTPP Flood Susceptibility",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/TeTaiOPoutiniPlan/TToPPDraftPlanData/MapServer/11",
            "flood_hazard", "westcoast_flood_suscept",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Flood Susceptibility",
                "Medium",
                "Flood Hazard Susceptibility (TTPP)",
            ))),
    DataSource("westcoast_ttpp_fault_avoid", "West Coast TTPP Fault Avoidance Zone",
        ["fault_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/TeTaiOPoutiniPlan/TToPPDraftPlanData/MapServer/5",
            "fault_zones", "westcoast_fault_avoid",
            ["name", "fault_complexity"],
            lambda a: (
                _clean(a.get("Name")) or "Fault Avoidance Zone",
                "Fault Avoidance (TTPP)",
            ))),
    DataSource("westcoast_ttpp_tsunami", "West Coast TTPP Tsunami Hazard Zone",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.westcoast.govt.nz/arcgis/rest/services/TeTaiOPoutiniPlan/TToPPDraftPlanData/MapServer/6",
            "tsunami_hazard", "westcoast_ttpp",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Name")) or "Tsunami Hazard Zone",
                "High",
                "TTPP Tsunami Hazard",
            ))),

    # ── Waipa District — flood hazard ──
    DataSource("waipa_flood_hazard", "Waipa District Flood Hazard Area",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services9.arcgis.com/OsxSXqmTWVTZQ9ie/arcgis/rest/services/WaipaDistrictPlan_SpecialFeature_Area_Flood/FeatureServer/0",
            "flood_hazard", "waipa",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Waipa Flood Hazard",
                "High",
                "District Plan Flood Hazard",
            ))),

    # ── Waikato Regional — flood extent 1% AEP ──
    DataSource("waikato_flood_1pct", "Waikato Flood Extent 1% AEP (Lower Waikato & Waipa Rivers)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/HAZ_FLOOD_EXTENT_1_AEP_OCT_2021/FeatureServer/0",
            "flood_hazard", "waikato_1pct",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Waikato 1% AEP Flood Extent",
                "High",
                "1% AEP Flood Extent (Oct 2021)",
            ))),

    # ── NRC — Ruawai/Kaipara flood, flood susceptible land ──
    DataSource("nrc_flood_susceptible", "NRC Flood Susceptible Land",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://nrcmaps.nrc.govt.nz/imagery/rest/services/Land_Hazards/MapServer/0",
            "flood_hazard", "northland_flood_suscept",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Flood Susceptible Land",
                "Medium",
                "Flood Susceptible Land (NRC)",
            ))),

    # ══════════════════════════════════════════════════════════
    # LOWER HUTT (HCC) — hazard + amenity layers
    # ══════════════════════════════════════════════════════════
    DataSource("hcc_plan_zones", "Lower Hutt District Plan Activity Areas",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/Essentials/HCC_District_Plan/MapServer/113",
            "district_plan_zones", "lower_hutt",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("Activity_Area")) or _clean(a.get("Description")) or "Zone",
                _clean(a.get("DP_E_CODE")),
            ))),
    DataSource("hcc_heritage", "Lower Hutt Heritage Sites",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/Essentials/HCC_District_Plan/MapServer/116",
            "historic_heritage_overlay", "lower_hutt",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("Common_Name")) or "Heritage Item",
                _clean(a.get("CATEGORY")),
                _clean(a.get("TYPE")),
            ),
            geom_type="point")),
    DataSource("hcc_notable_trees", "Lower Hutt Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/Essentials/HCC_District_Plan/MapServer/115",
            "notable_trees", "lower_hutt",
            ["name", "schedule"],
            lambda a: (
                _clean(a.get("COMMON_NAME__SPECIES_")) or "Notable Tree",
                _clean(a.get("DP_NUMBER")),
            ),
            geom_type="point")),
    DataSource("hcc_flood_inundation", "Lower Hutt Flood Inundation",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/DP_Flood_Hazard_Overlay/MapServer/60",
            "flood_hazard", "lower_hutt_inundation",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Type")) or "Flood Inundation",
                "High",
                "Flood Inundation",
            ))),
    DataSource("hcc_flood_stream_corridor", "Lower Hutt Stream Corridor Flood",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/DP_Flood_Hazard_Overlay/MapServer/64",
            "flood_hazard", "lower_hutt_stream",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Type")) or "Stream Corridor",
                "High",
                "Stream Corridor Flood Hazard",
            ))),
    DataSource("hcc_flood_overland_flow", "Lower Hutt Overland Flow Flood",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/DP_Flood_Hazard_Overlay/MapServer/62",
            "flood_hazard", "lower_hutt_overland",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Type")) or "Overland Flow",
                "Medium",
                "Overland Flow Flood Hazard",
            ))),
    DataSource("hcc_tsunami_high", "Lower Hutt Tsunami Hazard (High)",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/DP_Coastal_Hazard_Overlay___Tsunami/MapServer/66",
            "tsunami_hazard", "lower_hutt_high",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Type")) or "Tsunami High",
                "High",
                "DP Coastal Hazard Overlay",
            ))),
    DataSource("hcc_tsunami_medium", "Lower Hutt Tsunami Hazard (Medium)",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/DP_Coastal_Hazard_Overlay___Tsunami/MapServer/68",
            "tsunami_hazard", "lower_hutt_medium",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Type")) or "Tsunami Medium",
                "Medium",
                "DP Coastal Hazard Overlay",
            ))),
    DataSource("hcc_coastal_inundation_high", "Lower Hutt Coastal Inundation (High)",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/DP_Coastal_Inundation_Hazard/MapServer/74",
            "coastal_inundation", "lower_hutt_high",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Coastal Inundation (High)",
                "High",
                "Coastal Inundation",
            ))),
    DataSource("hcc_coastal_inundation_medium", "Lower Hutt Coastal Inundation (Medium)",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/DP_Coastal_Inundation_Hazard/MapServer/72",
            "coastal_inundation", "lower_hutt_medium",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Coastal Inundation (Medium)",
                "Medium",
                "Coastal Inundation",
            ))),
    DataSource("hcc_archaeological", "Lower Hutt Archaeological Sites",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.huttcity.govt.nz/server02/rest/services/Essentials/HCC_District_Plan/MapServer/119",
            "historic_heritage_overlay", "lower_hutt_arch",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("SITE")) or "Archaeological Site",
                _clean(a.get("DP_E_CODE")),
                "Archaeological",
            ),
            geom_type="point")),

    # ══════════════════════════════════════════════════════════
    # UPPER HUTT (UHCC) — hazard + amenity layers
    # ══════════════════════════════════════════════════════════
    DataSource("uhcc_plan_zones", "Upper Hutt District Plan Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Zones/MapServer/0",
            "district_plan_zones", "upper_hutt",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("Zone")) or "Zone",
                None,
            ))),
    DataSource("uhcc_heritage", "Upper Hutt Heritage Features",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Features/MapServer/0",
            "historic_heritage_overlay", "upper_hutt",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("NAME")) or "Heritage Feature",
                _clean(a.get("SCHEDULE")),
                _clean(a.get("CLASS")),
            ),
            geom_type="point")),
    DataSource("uhcc_notable_trees", "Upper Hutt Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Features/MapServer/1",
            "notable_trees", "upper_hutt",
            ["name", "schedule"],
            lambda a: (
                _clean(a.get("COMMON_NAME")) or "Notable Tree",
                _clean(a.get("SCHEDULE")),
            ),
            geom_type="point")),
    DataSource("uhcc_wellington_fault", "Upper Hutt Wellington Fault Band",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Hazards/MapServer/1",
            "active_faults", "upper_hutt",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                _clean(a.get("Fault_Name")) or "Wellington Fault",
                "Fault Band",
                None,
                "Upper Hutt City Council",
            ))),
    DataSource("uhcc_100yr_flood", "Upper Hutt 100yr Flood Extent",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Hazards/MapServer/38",
            "flood_hazard", "upper_hutt",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "100yr Flood Extent",
                "High",
                "100yr Flood",
            ))),
    DataSource("uhcc_slope_hazard", "Upper Hutt Slope Hazard Overlay",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Hazards/MapServer/10",
            "slope_failure", "upper_hutt",
            ["name", "hazard_ranking"],
            lambda a: (
                "Slope Hazard",
                "Medium",
            ))),
    DataSource("uhcc_peat_overlay", "Upper Hutt Mangaroa Peat Overlay",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Hazards/MapServer/9",
            "liquefaction_detail", "upper_hutt",
            ["liquefaction", "simplified"],
            lambda a: (
                "Peat Subsidence Hazard",
                "Mangaroa Peat Overlay",
            ))),
    DataSource("uhcc_erosion", "Upper Hutt Mangaroa Erosion Hazard",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Hazards/MapServer/43",
            "slope_failure", "upper_hutt_erosion",
            ["name", "hazard_ranking"],
            lambda a: (
                "Erosion Hazard Area",
                "Medium",
            ))),
    DataSource("uhcc_pinehaven_flood", "Upper Hutt Pinehaven Flood Hazard",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Hazards/MapServer/42",
            "flood_hazard", "upper_hutt_pinehaven",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Pinehaven Stream Corridor",
                "High",
                "Stream Corridor Flood",
            ))),
    DataSource("uhcc_overland_flow", "Upper Hutt Overland Flow Hazard",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Hazards/MapServer/11",
            "flood_hazard", "upper_hutt_overland",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Overland Flow Path",
                "Medium",
                "Overland Flow",
            ))),
    DataSource("uhcc_ecological", "Upper Hutt Southern Hills Ecological Overlay",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/District_Plan_Features/MapServer/11",
            "significant_ecological_areas", "upper_hutt",
            ["name", "significance"],
            lambda a: (
                "Southern Hills Ecological Area",
                _clean(a.get("VALUE")),
            ))),
    DataSource("uhcc_contaminated_land", "Upper Hutt SLUR Contaminated Sites",
        ["contaminated_land"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.upperhutt.govt.nz/arcgis/rest/services/Consenting_Information/MapServer/24",
            "contaminated_land", "upper_hutt",
            ["site_name", "category"],
            lambda a: (
                _clean(a.get("SITENAME")) or "Contaminated Site",
                _clean(a.get("CATEGORY")),
            ))),

    # ══════════════════════════════════════════════════════════
    # PORIRUA — additional hazard layers (extends existing 3)
    # ══════════════════════════════════════════════════════════
    DataSource("porirua_fault_rupture", "Porirua Fault Rupture Zones",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Earthquake_Hazards/MapServer/1",
            "active_faults", "porirua",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                _clean(a.get("Fault_Name")) or "Fault Rupture Zone",
                _clean(a.get("Complexity")) or "Fault Rupture",
                None,
                "Porirua City Council",
            ))),
    DataSource("porirua_liquefaction", "Porirua Liquefaction Hazard",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Earthquake_Hazards/MapServer/2",
            "liquefaction_detail", "porirua",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Liquefaction")) or "Liquefaction",
                _clean(a.get("Simplified")),
            ))),
    DataSource("porirua_ground_shaking", "Porirua Ground Shaking Zones",
        ["ground_shaking"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Earthquake_Hazards/MapServer/3",
            "ground_shaking", "porirua",
            ["zone", "severity"],
            lambda a: (
                _clean(a.get("ground_shaking_zone")) or "Ground Shaking",
                _clean(a.get("ground_shaking_zone")),
            ))),
    DataSource("porirua_landslide_suscept", "Porirua Landslide Susceptibility",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Geohazards/MapServer/1",
            "slope_failure", "porirua_suscept",
            ["name", "hazard_ranking"],
            lambda a: (
                "Landslide Susceptibility",
                _clean(a.get("Susceptibility")) or "Medium",
            ))),
    DataSource("porirua_landslide_runout", "Porirua Landslide Run Out",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Geohazards/MapServer/0",
            "slope_failure", "porirua_runout",
            ["name", "hazard_ranking"],
            lambda a: (
                "Landslide Run Out",
                _clean(a.get("RunOut")) or "Medium",
            ))),
    DataSource("porirua_coastal_erosion_current", "Porirua Coastal Erosion (Current)",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Coastal_Hazards/MapServer/0",
            "coastal_erosion", "porirua_current",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Location")) or "Coastal Erosion (Current)",
                "High",
                "Coastal Erosion — Present Day",
            ))),
    DataSource("porirua_coastal_erosion_slr", "Porirua Coastal Erosion (1m SLR)",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Coastal_Hazards/MapServer/1",
            "coastal_erosion", "porirua_slr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Location")) or "Coastal Erosion (+1m SLR)",
                "High",
                "Coastal Erosion — 1m Sea Level Rise",
            ))),
    DataSource("porirua_coastal_inundation", "Porirua Coastal Inundation (Current)",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Coastal_Hazards/MapServer/2",
            "coastal_inundation", "porirua_current",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Location")) or "Coastal Inundation (Current)",
                "High",
                "Coastal Inundation",
            ))),
    DataSource("porirua_coastal_inundation_slr", "Porirua Coastal Inundation (1m SLR)",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Coastal_Hazards/MapServer/3",
            "coastal_inundation", "porirua_slr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Location")) or "Coastal Inundation (+1m SLR)",
                "High",
                "Coastal Inundation — 1m Sea Level Rise",
            ))),
    DataSource("porirua_tsunami_100yr", "Porirua Tsunami Inundation 1:100yr",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Coastal_Hazards/MapServer/4",
            "tsunami_hazard", "porirua_100yr",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Inundation 1:100yr",
                "High",
                "1:100yr return period",
            ))),
    DataSource("porirua_tsunami_500yr", "Porirua Tsunami Inundation 1:500yr",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Coastal_Hazards/MapServer/5",
            "tsunami_hazard", "porirua_500yr",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Inundation 1:500yr",
                "Medium",
                "1:500yr return period",
            ))),
    DataSource("porirua_tsunami_1000yr", "Porirua Tsunami Inundation 1:1000yr",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/Hazards/Coastal_Hazards/MapServer/6",
            "tsunami_hazard", "porirua_1000yr",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                "Tsunami Inundation 1:1000yr",
                "Low",
                "1:1000yr return period",
            ))),
    DataSource("porirua_ecological", "Porirua Ecosites",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.poriruacity.govt.nz/server/rest/services/DistrictPlan/Operative_District_Plan/MapServer/3",
            "significant_ecological_areas", "porirua",
            ["name", "significance"],
            lambda a: (
                _clean(a.get("NAME")) or "Ecosite",
                None,
            ))),

    # ══════════════════════════════════════════════════════════
    # KAPITI COAST — additional layers (extends existing 5)
    # ══════════════════════════════════════════════════════════
    DataSource("kapiti_tsunami", "Kapiti Coast Tsunami Evacuation Zones",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/Tsunami/MapServer/3",
            "tsunami_hazard", "kapiti_coast",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Evac_Zone")) or "Tsunami Evacuation Zone",
                "High" if "red" in (_clean(a.get("Col_Code")) or "").lower() else
                "Medium" if "orange" in (_clean(a.get("Col_Code")) or "").lower() else "Low",
                _clean(a.get("Location")) or "Kapiti Coast",
            ))),
    DataSource("kapiti_coastal_erosion_present", "Kapiti Coastal Erosion (Present Day)",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/Coastal_Erosion/MapServer/2",
            "coastal_erosion", "kapiti_present",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Present Day Coastal Erosion",
                "High",
                "Coastal Erosion — Present Day",
            ),
            geom_type="line")),
    DataSource("kapiti_coastal_erosion_2120", "Kapiti Coastal Erosion 2120 (+0.6m SLR)",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/Coastal_Erosion/MapServer/23",
            "coastal_erosion", "kapiti_2120",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Coastal Erosion 2120 (+0.6m RSLR)",
                "High",
                "Coastal Erosion — 2120 Projection",
            ))),
    DataSource("kapiti_ecological", "Kapiti Ecological Sites",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/District_Plan_Overlays/MapServer/19",
            "significant_ecological_areas", "kapiti_coast",
            ["name", "significance"],
            lambda a: (
                _clean(a.get("Name")) or "Ecological Site",
                None,
            ))),
    DataSource("kapiti_flood_river_corridor", "Kapiti Flood Hazard River Corridor",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/Latest_Flood_Hazards/MapServer/0",
            "flood_hazard", "kapiti_river_corridor",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("ZONE")) or "River Corridor",
                "High",
                "River Corridor Flood Hazard",
            ))),
    DataSource("kapiti_flood_ponding", "Kapiti Flood Hazard Ponding",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.kapiticoast.govt.nz/server/rest/services/Public/Latest_Flood_Hazards/MapServer/6",
            "flood_hazard", "kapiti_ponding",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("ZONE")) or "Ponding",
                "Medium",
                "Ponding Flood Hazard",
            ))),

    # ══════════════════════════════════════════════════════════
    # WAIRARAPA — all layers (Masterton GIS hosts all 3 councils)
    # ══════════════════════════════════════════════════════════
    DataSource("wairarapa_plan_zones", "Wairarapa District Plan Zones (3 councils)",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/ResourceManagementAndPlanning/Zones/MapServer/4",
            "district_plan_zones", "wairarapa",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("NAME")) or _clean(a.get("ZONE_TYPE")) or "Zone",
                _clean(a.get("SUB_TYPE")),
            ))),
    DataSource("wairarapa_heritage", "Wairarapa Heritage Sites (3 councils)",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/ResourceManagementAndPlanning/SpecialFeatures/MapServer/3",
            "historic_heritage_overlay", "wairarapa",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("DESCRIPTIO")) or "Heritage Site",
                _clean(a.get("CATEGORY")),
                _clean(a.get("TLA")),
            ),
            geom_type="point")),
    DataSource("wairarapa_notable_trees", "Wairarapa Notable Trees (3 councils)",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/ResourceManagementAndPlanning/SpecialFeatures/MapServer/4",
            "notable_trees", "wairarapa",
            ["name", "schedule"],
            lambda a: (
                _clean(a.get("TREE_TYPE")) or _clean(a.get("DESCRIPTIO")) or "Notable Tree",
                _clean(a.get("GIS_ID")),
            ),
            geom_type="point")),
    DataSource("wairarapa_sna", "Wairarapa Significant Natural Areas",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/ResourceManagementAndPlanning/SpecialFeatures/MapServer/0",
            "significant_ecological_areas", "wairarapa",
            ["name", "significance"],
            lambda a: (
                _clean(a.get("SITE")) or "Significant Natural Area",
                _clean(a.get("DESCRIPTIO")),
            ))),
    DataSource("wairarapa_fault_hazard", "Wairarapa Fault Line Hazard Areas",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/EarthquakeHazards/MapServer/0",
            "active_faults", "wairarapa",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                _clean(a.get("FAULT_NAME")) or "Wairarapa Fault",
                _clean(a.get("LABEL")),
                None,
                _clean(a.get("SOURCE")) or "Masterton GIS",
            ))),
    DataSource("wairarapa_flood_50yr", "Wairarapa Flood Zones (50yr)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/FloodZones/MapServer/0",
            "flood_hazard", "wairarapa_50yr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("CLASS_OF_H")) or "50yr Flood Zone",
                "High",
                "50yr ARI Flood",
            ))),
    DataSource("wairarapa_flood_100yr", "Wairarapa Flood Zones (100yr Greytown)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/FloodZones/MapServer/3",
            "flood_hazard", "wairarapa_100yr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "100yr Flood Zone (Greytown)",
                "High",
                "100yr ARI Flood",
            ))),
    DataSource("wairarapa_liquefaction", "Wairarapa Liquefaction",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/Liquefaction/MapServer/0",
            "liquefaction_detail", "wairarapa",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Liquefaction")) or "Liquefaction",
                _clean(a.get("Simplified")),
            ))),
    DataSource("wairarapa_tsunami", "Wairarapa Tsunami Evacuation Zones",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/TsunamiEvacuationZones/MapServer/0",
            "tsunami_hazard", "wairarapa",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Location")) or "Wairarapa Tsunami Zone",
                "High" if "red" in (_clean(a.get("Zone_class")) or "").lower() else
                "Medium" if "orange" in (_clean(a.get("Zone_class")) or "").lower() else "Low",
                "Tsunami Evacuation Zone",
            ))),
    DataSource("wairarapa_contaminated", "Wairarapa Contaminated Sites",
        ["contaminated_land"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/ResourceManagementAndPlanning/SpecialFeatures/MapServer/18",
            "contaminated_land", "wairarapa",
            ["site_name", "category"],
            lambda a: (
                _clean(a.get("DESCRIPTIO")) or "Contaminated Site",
                _clean(a.get("STATUS")),
            ))),
    DataSource("wairarapa_erosion", "Wairarapa Erosion Hazard Areas",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/ResourceManagementAndPlanning/ManagementAreas/MapServer/5",
            "slope_failure", "wairarapa",
            ["name", "hazard_ranking"],
            lambda a: (
                _clean(a.get("CLASS_OF_H")) or "Erosion Hazard",
                "Medium",
            ))),
    DataSource("wairarapa_noise", "Wairarapa Airport Noise Contours",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.mstn.govt.nz/arcgis/rest/services/ResourceManagementAndPlanning/ManagementAreas/MapServer/14",
            "noise_contours", "wairarapa",
            ["name", "noise_level_db"],
            lambda a: (
                _clean(a.get("AIRPORT")) or "Wairarapa Airport",
                _clean(a.get("CONTOUR")),
            ),
            geom_type="line")),

    # ══════════════════════════════════════════════════════════
    # INVERCARGILL — additional layers (extends existing 5)
    # ══════════════════════════════════════════════════════════
    DataSource("invercargill_liquefaction", "Invercargill Liquefaction Susceptibility",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/Essentials/DistrictPlan/MapServer/63",
            "liquefaction_detail", "invercargill",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("DESCRIPTIO")) or _clean(a.get("LIQ_CODE")) or "Liquefaction",
                _clean(a.get("LIQ_CODE")),
            ))),
    DataSource("invercargill_amplification", "Invercargill Seismic Amplification",
        ["ground_shaking"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/Essentials/DistrictPlan/MapServer/60",
            "ground_shaking", "invercargill",
            ["zone", "severity"],
            lambda a: (
                _clean(a.get("AMP_CODE")) or "Amplification",
                _clean(a.get("DESCRIPTIO")),
            ))),
    DataSource("invercargill_noise_airport", "Invercargill Airport Noise Boundary",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/LocalMaps/LocalMaps_DistrictPlan_Planning_2024/MapServer/4",
            "noise_contours", "invercargill_airport",
            ["name", "noise_level_db"],
            lambda a: (
                "Invercargill Airport Sound Exposure Boundary",
                None,
            ))),
    DataSource("invercargill_noise_port", "Invercargill Port Noise Boundary",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/LocalMaps/LocalMaps_DistrictPlan_Planning_2024/MapServer/10",
            "noise_contours", "invercargill_port",
            ["name", "noise_level_db"],
            lambda a: (
                "Invercargill Port Noise Inner Control Boundary",
                None,
            ))),
    DataSource("invercargill_archaeological", "Invercargill Archaeological Sites",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/LocalMaps/LocalMaps_DistrictPlan_Planning_2024/MapServer/6",
            "historic_heritage_overlay", "invercargill_arch",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("site_type")) or "Archaeological Site",
                str(a.get("REF_NO", "")),
                "Archaeological",
            ),
            geom_type="point")),
    DataSource("invercargill_biodiversity", "Invercargill Significant Indigenous Biodiversity",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/LocalMaps/LocalMaps_DistrictPlan_Planning_2024/MapServer/16",
            "significant_ecological_areas", "invercargill",
            ["name", "significance"],
            lambda a: (
                _clean(a.get("NAME")) or "Indigenous Biodiversity Area",
                _clean(a.get("CATEGORY")),
            ))),
    DataSource("invercargill_notable_trees", "Invercargill Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.icc.govt.nz/arcgis/rest/services/Essentials/DistrictPlan/MapServer/8",
            "notable_trees", "invercargill",
            ["name", "schedule"],
            lambda a: (
                _clean(a.get("DESCRIPTION")) or "Notable Tree",
                _clean(a.get("CLASS")),
            ),
            geom_type="point",
            skip_delete=True)),

    # ══════════════════════════════════════════════════════════
    # SOUTHLAND — additional layers (extends existing 6)
    # ══════════════════════════════════════════════════════════
    DataSource("southland_contaminated", "Southland Contaminated Land (HAIL)",
        ["contaminated_land"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.es.govt.nz/server/rest/services/Public/General/MapServer/42",
            "contaminated_land", "southland",
            ["site_name", "category"],
            lambda a: (
                _clean(a.get("Address")) or "Contaminated Site",
                _clean(a.get("Classification")),
            ))),
    DataSource("southland_dc_flood", "Southland District Flood Inundation Overlay",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.southlanddc.govt.nz/server/rest/services/EPLAN_DISTRICT_PLAN_AGOL/MapServer/73",
            "flood_hazard", "southland_dc",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Area")) or "Flooding Inundation Overlay",
                "High",
                "Flooding Inundation (SDC)",
            ))),
    DataSource("southland_dc_heritage", "Southland District Heritage Sites",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.southlanddc.govt.nz/server/rest/services/EPLAN_DISTRICT_PLAN_AGOL/MapServer/9",
            "historic_heritage_overlay", "southland_dc",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("NAME")) or "Heritage Site",
                _clean(a.get("HNZ_NO")),
                _clean(a.get("LOCALITY")),
            ))),
    DataSource("southland_dc_coastal_hazard", "Southland District Coastal Hazard",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.southlanddc.govt.nz/server/rest/services/EPLAN_DISTRICT_PLAN_AGOL/MapServer/4",
            "coastal_erosion", "southland_dc",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Feature_Type")) or "Coastal Hazard",
                "High",
                "Coastal Hazard (SDC)",
            ))),
    DataSource("southland_dc_noise", "Southland District Noise Control",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.southlanddc.govt.nz/server/rest/services/EPLAN_DISTRICT_PLAN_AGOL/MapServer/24",
            "noise_contours", "southland_dc",
            ["name", "noise_level_db"],
            lambda a: (
                _clean(a.get("LOCALITY")) or "Noise Control Area",
                _clean(a.get("TYPE")),
            ))),

    # ══════════════════════════════════════════════════════════
    # OTAGO (ORC) — additional layers (extends existing 5)
    # ══════════════════════════════════════════════════════════
    DataSource("orc_tsunami_affected", "ORC Tsunami Affected Areas",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/Tsunami_AffectedArea_Final/MapServer/0",
            "tsunami_hazard", "otago_tsunami",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("LayerDescription")) or "Tsunami Affected Area",
                "High",
                _clean(a.get("Scenario")) or "ORC Tsunami",
            ))),
    DataSource("orc_floodway_taieri", "ORC Taieri River Floodway",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/FloodProtectionManagementBylaw2022/MapServer/13",
            "flood_hazard", "otago_taieri",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("FloodwayName")) or "Taieri River Floodway",
                "High",
                "Floodway (ORC Bylaw 2022)",
            ))),
    DataSource("orc_floodway_clutha", "ORC Lower Clutha Floodway",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/FloodProtectionManagementBylaw2022/MapServer/17",
            "flood_hazard", "otago_clutha",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("FloodwayName")) or "Lower Clutha Floodway",
                "High",
                "Floodway (ORC Bylaw 2022)",
            ))),
    DataSource("orc_floodway_hendersons", "ORC Hendersons Creek Floodway",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/FloodProtectionManagementBylaw2022/MapServer/26",
            "flood_hazard", "otago_hendersons",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("FloodwayName")) or "Hendersons Creek Floodway",
                "High",
                "Floodway (ORC Bylaw 2022)",
            ))),
    DataSource("orc_dunedin_tsunami", "Dunedin Tsunami Zones (ORC)",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/Tsunami_AffectedArea_Final/MapServer/0",
            "tsunami_hazard", "dunedin_orc",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("LayerDescription")) or "Dunedin Tsunami Zone",
                "High",
                _clean(a.get("Scenario")) or "ORC Tsunami",
            ),
            skip_delete=True)),

    DataSource("orc_liquefaction_otago", "ORC Seismic Liquefaction Otago 2019",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.orc.govt.nz/arcgis/rest/services/Seismic_LiquefactionOtago_2019/FeatureServer/0",
            "liquefaction_detail", "otago",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LiqSuscept")) or _clean(a.get("Susceptibility")) or "Liquefaction",
                _clean(a.get("Geology")) or _clean(a.get("Description")),
            ))),

    # ══════════════════════════════════════════════════════════
    # TASMAN — additional layers (extends existing 7)
    # ══════════════════════════════════════════════════════════
    DataSource("tasman_coastal_slr_05m", "Tasman Coastal SLR +0.5m Scenario",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Environment_Hazards/MapServer/4",
            "coastal_inundation", "tasman_slr_05m",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("NAME")) or "Coastal SLR +0.5m",
                "Medium",
                "Sea Level Rise +0.5m",
            ))),
    DataSource("tasman_coastal_slr_15m", "Tasman Coastal SLR +1.5m Scenario",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Environment_Hazards/MapServer/6",
            "coastal_inundation", "tasman_slr_15m",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("NAME")) or "Coastal SLR +1.5m",
                "High",
                "Sea Level Rise +1.5m",
            ))),
    DataSource("tasman_coastal_erosion_structures", "Tasman Coastal Erosion Protection",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gispublic.tasman.govt.nz/server/rest/services/OpenData/OpenData_Environment_Hazards/MapServer/0",
            "coastal_erosion", "tasman_structures",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Type")) or "Coastal Protection Structure",
                "Medium",
                "Coastal Erosion Protection",
            ),
            geom_type="line")),

    # ══════════════════════════════════════════════════════════
    # TIMARU — additional layers (extends existing 7)
    # ══════════════════════════════════════════════════════════
    DataSource("timaru_notable_trees_extra", "Timaru Street Trees (supplementary)",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.timaru.govt.nz/server/rest/services/Essentials/DistrictPlan/MapServer/0",
            "notable_trees", "timaru_street",
            ["name", "schedule"],
            lambda a: (
                _clean(a.get("Species")) or "Tree",
                _clean(a.get("Schedule")),
            ),
            geom_type="point",
            skip_delete=True)),
    DataSource("timaru_ecological", "Timaru Significant Natural Areas",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.timaru.govt.nz/server/rest/services/Essentials/DistrictPlan/MapServer/3",
            "significant_ecological_areas", "timaru",
            ["name", "significance"],
            lambda a: (
                _clean(a.get("NAME")) or "Significant Natural Area",
                _clean(a.get("Description")),
            ))),
    DataSource("timaru_noise", "Timaru Airport/Port Noise Contours",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.timaru.govt.nz/server/rest/services/Essentials/DistrictPlan/MapServer/5",
            "noise_contours", "timaru",
            ["name", "noise_level_db"],
            lambda a: (
                _clean(a.get("Type")) or "Noise Contour",
                _clean(a.get("Level")),
            ))),

    # ══════════════════════════════════════════════════════════
    # WAIMAKARIRI — additional layers (extends existing 8)
    # ══════════════════════════════════════════════════════════
    DataSource("waimakariri_liquefaction", "Waimakariri Liquefaction Susceptibility",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis1.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Liquefaction_Susceptibility/MapServer/6",
            "liquefaction_detail", "waimakariri",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Liquefaction_Susceptibility")) or _clean(a.get("Descrip")) or "Liquefaction",
                _clean(a.get("Descrip")),
            ))),
    DataSource("waimakariri_ecological", "Waimakariri Significant Natural Areas",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis1.ecan.govt.nz/arcgis/rest/services/Public/Canterbury_Biodiversity/MapServer/0",
            "significant_ecological_areas", "waimakariri",
            ["name", "significance"],
            lambda a: (
                _clean(a.get("Name")) or "Significant Natural Area",
                _clean(a.get("Type")),
            ))),

    # ══════════════════════════════════════════════════════════
    # HAMILTON — additional layers (extends existing 8)
    # ══════════════════════════════════════════════════════════
    DataSource("hamilton_flood_extents", "Hamilton Flood Extents (100yr Rainfall)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/hcc_entpublic/portal_floodviewer_floodextents/MapServer/0",
            "flood_hazard", "hamilton_100yr",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Storm_Event")) or "100yr Flood Extent",
                _clean(a.get("Hazard_Factor")) or "High",
                "100yr Rainfall Flood",
            ))),
    DataSource("hamilton_flood_depressions", "Hamilton Flood Depressions (100yr)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/hcc_flooding/hcc_flooddepressions_100yr/MapServer/2",
            "flood_hazard", "hamilton_depressions",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Flood Depression (100yr)",
                "Medium",
                "Ponding/Depression",
            ))),
    DataSource("hamilton_seismic", "Hamilton Seismic Stability (Peacocke)",
        ["ground_shaking"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/hcc_entpublic/hccent_pwvfeatures/MapServer/7",
            "ground_shaking", "hamilton",
            ["zone", "severity"],
            lambda a: (
                _clean(a.get("Name")) or "Seismic Stability Area",
                _clean(a.get("Reference")),
            ))),
    DataSource("hamilton_natural_hazard", "Hamilton Natural Hazard Area (Peacocke)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://maps.hamilton.govt.nz/server/rest/services/hcc_entpublic/hccent_pwvfeatures/MapServer/14",
            "flood_hazard", "hamilton_nat_hazard",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Natural Hazard Area",
                "High",
                "Natural Hazard Zone",
            ))),

    # ══════════════════════════════════════════════════════════
    # TAURANGA — additional layers (extends existing 9)
    # ══════════════════════════════════════════════════════════
    DataSource("tauranga_harbour_inundation", "Tauranga Harbour Inundation (2130 1%AEP)",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/Natural_Hazards__multiple_data_sources/MapServer/4",
            "coastal_inundation", "tauranga_2130",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Harbour Inundation 2130 (1%AEP +1.25m SLR)",
                "High",
                "Harbour Storm Inundation",
            ))),
    DataSource("tauranga_flood_dxv", "Tauranga Flood Depth x Velocity (100yr)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/Natural_Hazards__multiple_data_sources/MapServer/14",
            "flood_hazard", "tauranga_dxv",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("HazardClass")) or "Flood Hazard (DxV)",
                "High",
                "Depth x Velocity 100yr",
            ))),
    DataSource("tauranga_trees", "Tauranga Significant Trees (Groups)",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/ePlan/ePlan_Sections1to3/MapServer/11",
            "notable_trees", "tauranga",
            ["name", "schedule"],
            lambda a: (
                "Significant Tree Group",
                None,
            ))),
    DataSource("tauranga_archaeological", "Tauranga Significant Archaeological Areas",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.tauranga.govt.nz/server/rest/services/ePlan/ePlan_Sections1to3/MapServer/9",
            "historic_heritage_overlay", "tauranga_arch",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                "Significant Archaeological Area",
                None,
                "Archaeological",
            ))),

    # ══════════════════════════════════════════════════════════
    # ROTORUA — 14 new layers (extends existing 1: zones)
    # ══════════════════════════════════════════════════════════
    DataSource("rotorua_geothermal", "Rotorua Geothermal Systems",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/240",
            "flood_hazard", "rotorua_geothermal",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Geothermal System",
                _clean(a.get("ProtectionStatus")) or "High",
                f"Geothermal ({_clean(a.get('Type')) or 'system'})",
            ))),
    DataSource("rotorua_fault_avoidance", "Rotorua Fault Avoidance Zones (2021)",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/250",
            "active_faults", "rotorua",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                "Fault Avoidance Zone (2021)",
                _clean(a.get("Fault_Comp")) or "Fault Avoidance",
                None,
                _clean(a.get("RI_Class")),
            ))),
    DataSource("rotorua_liquefaction", "Rotorua Liquefaction Vulnerability",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/330",
            "liquefaction_detail", "rotorua",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LiquefactionVulnerabilityCatego")) or "Liquefaction",
                _clean(a.get("Terrain")),
            ))),
    DataSource("rotorua_soft_ground", "Rotorua Soft Ground Hazard",
        ["ground_shaking"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/335",
            "ground_shaking", "rotorua",
            ["zone", "severity"],
            lambda a: (
                "Soft Ground",
                "Medium",
            ))),
    DataSource("rotorua_landslide", "Rotorua Landslide Susceptibility",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/340",
            "slope_failure", "rotorua",
            ["name", "hazard_ranking"],
            lambda a: (
                _clean(a.get("DESCRIPT")) or "Landslide Susceptibility",
                _clean(a.get("VALUE")) or "Medium",
            ))),
    DataSource("rotorua_ncm_flood", "Rotorua Ngongotaha Flood Hazard (1% AEP)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/349",
            "flood_hazard", "rotorua_ncm",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("HazardLevel")) or "Ngongotaha Flood",
                str(a.get("HazardInteger", "")) or "High",
                "1% AEP Flood (NCM)",
            ))),
    DataSource("rotorua_scm_flood", "Rotorua Stormwater Flood Depth (1% AEP)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/362",
            "flood_hazard", "rotorua_scm",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Stormwater Flood (1% AEP)",
                "High",
                "1% AEP Flood (SCM)",
            ))),
    DataSource("rotorua_gucm_flood", "Rotorua Utuhina Flood Depth (1% AEP 2130)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/346",
            "flood_hazard", "rotorua_gucm",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Utuhina Flood (1% AEP 2130 CC)",
                "High",
                "1% AEP Flood + Climate Change (GUCM)",
            ))),
    DataSource("rotorua_trees", "Rotorua Notable Tree Areas",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/25",
            "notable_trees", "rotorua",
            ["name", "schedule"],
            lambda a: (
                _clean(a.get("Description")) or "Notable Tree",
                _clean(a.get("Reference")),
            ))),
    DataSource("rotorua_heritage", "Rotorua Archaeological & Heritage Sites",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/10",
            "historic_heritage_overlay", "rotorua",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("NAME")) or _clean(a.get("OTHER_NAME")) or "Archaeological Site",
                _clean(a.get("NZAA_ID")),
                _clean(a.get("site_type")),
            ),
            geom_type="point")),
    DataSource("rotorua_sna", "Rotorua Significant Natural Areas",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/95",
            "significant_ecological_areas", "rotorua",
            ["name", "significance"],
            lambda a: (
                _clean(a.get("Site_Name")) or "Significant Natural Area",
                _clean(a.get("Significance")),
            ))),
    DataSource("rotorua_airport_noise", "Rotorua Airport Noise Contours",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/115",
            "noise_contours", "rotorua",
            ["name", "noise_level_db"],
            lambda a: (
                "Rotorua Airport",
                _clean(a.get("dBa")) or _clean(a.get("Control")),
            ),
            geom_type="line")),
    DataSource("rotorua_caldera", "Rotorua Caldera Rim Landscape",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.rdc.govt.nz/server/rest/services/Core/Planning_and_Development/MapServer/60",
            "flood_hazard", "rotorua_caldera",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Rotorua Caldera Rim",
                "Medium",
                "Volcanic Caldera Landscape",
            ))),

    # ══════════════════════════════════════════════════════════
    # WAIKATO REGIONAL — additional layers (extends existing 8)
    # ══════════════════════════════════════════════════════════
    DataSource("waikato_geothermal", "Waikato Geothermal Systems",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/WDP_WRP_GEOTHERMAL_SYSTEM/FeatureServer/0",
            "flood_hazard", "waikato_geothermal",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("NAME")) or "Geothermal System",
                _clean(a.get("CLASS")) or "High",
                "Geothermal System (WRC)",
            ),
            srid=2193)),
    DataSource("waikato_geothermal_subsidence", "Waikato Geothermal Subsidence Bowl",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/HAZ_GEOTH_SUBSIDENCE_BOWL_2010/FeatureServer/0",
            "flood_hazard", "waikato_subsidence",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("LOCATION")) or "Geothermal Subsidence Bowl",
                "High",
                "Geothermal Subsidence (2010)",
            ),
            srid=2193)),

    # ══════════════════════════════════════════════════════════
    # WAIPA — 9 new layers (extends existing 1: flood)
    # ══════════════════════════════════════════════════════════
    DataSource("waipa_zones", "Waipa District Plan Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services9.arcgis.com/OsxSXqmTWVTZQ9ie/arcgis/rest/services/WaipaDistrictPlan_Zones/FeatureServer/0",
            "district_plan_zones", "waipa",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("Type")) or "Zone",
                _clean(a.get("Reference")),
            ),
            srid=2193)),
    DataSource("waipa_heritage", "Waipa Heritage Sites",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services9.arcgis.com/OsxSXqmTWVTZQ9ie/arcgis/rest/services/WaipaDistrictPlan_Policy_Heritage_Points/FeatureServer/0",
            "historic_heritage_overlay", "waipa",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("site_name")) or _clean(a.get("location")) or "Heritage Site",
                _clean(a.get("Reference")),
                _clean(a.get("Category")),
            ),
            geom_type="point",
            srid=2193)),
    DataSource("waipa_trees", "Waipa Protected Trees & Bushstands",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services9.arcgis.com/OsxSXqmTWVTZQ9ie/arcgis/rest/services/WaipaDistrictPlan_Protected_Trees_Bushstands/FeatureServer/0",
            "notable_trees", "waipa",
            ["name", "schedule"],
            lambda a: (
                _clean(a.get("english_na")) or _clean(a.get("species")) or "Protected Tree",
                _clean(a.get("Reference")),
            ),
            geom_type="point",
            srid=2193)),
    DataSource("waipa_sna", "Waipa Significant Natural Areas",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services9.arcgis.com/OsxSXqmTWVTZQ9ie/arcgis/rest/services/WaipaDistrictPlan_SNA/FeatureServer/0",
            "significant_ecological_areas", "waipa",
            ["name", "significance"],
            lambda a: (
                _clean(a.get("Name")) or "Significant Natural Area",
                _clean(a.get("Significan")),
            ),
            srid=2193)),
    DataSource("waipa_airport_noise", "Waipa Airport Noise Overlay",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services9.arcgis.com/OsxSXqmTWVTZQ9ie/arcgis/rest/services/WaipaDistrictPlan_Airport_Noise_Overlay/FeatureServer/0",
            "noise_contours", "waipa",
            ["name", "noise_level_db"],
            lambda a: (
                _clean(a.get("Name")) or "Waipa Airport Noise Overlay",
                _clean(a.get("Reference")),
            ),
            srid=2193)),

    # ══════════════════════════════════════════════════════════
    # TAUPO — additional layers (extends existing 5)
    # ══════════════════════════════════════════════════════════
    DataSource("taupo_flood", "Taupo Flood Hazard Areas",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.taupodc.govt.nz/arcgis/rest/services/Mapi/TaupoDistrictPlan/MapServer/5",
            "flood_hazard", "taupo",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Flood Hazard Area",
                "High",
                "Flood Hazard",
            ))),
    DataSource("taupo_noise", "Taupo Noise Control Areas",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.taupodc.govt.nz/arcgis/rest/services/Mapi/TaupoDistrictPlan/MapServer/6",
            "noise_contours", "taupo",
            ["name", "noise_level_db"],
            lambda a: (
                _clean(a.get("Name")) or "Taupo Noise Control",
                None,
            ))),
    DataSource("taupo_geothermal", "Taupo Geothermal Hazard Zones",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.taupodc.govt.nz/arcgis/rest/services/Mapi/TaupoDistrictPlan/MapServer/8",
            "flood_hazard", "taupo_geothermal",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name")) or "Geothermal Hazard",
                "High",
                "Geothermal Hazard Zone",
            ))),
    DataSource("taupo_liquefaction", "Taupo Liquefaction Vulnerability",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.taupodc.govt.nz/arcgis/rest/services/Mapi/TaupoDistrictPlan/MapServer/9",
            "liquefaction_detail", "taupo",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Name")) or "Liquefaction",
                _clean(a.get("Category")),
            ))),
    DataSource("taupo_landslide", "Taupo Landslide Susceptibility",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://gis.taupodc.govt.nz/arcgis/rest/services/Mapi/TaupoDistrictPlan/MapServer/10",
            "slope_failure", "taupo",
            ["name", "hazard_ranking"],
            lambda a: (
                _clean(a.get("Name")) or "Landslide Susceptibility",
                "Medium",
            ))),

    # ══════════════════════════════════════════════════════════
    # TARANAKI / NEW PLYMOUTH (NPDC) — new layers
    # ══════════════════════════════════════════════════════════
    DataSource("npdc_zones", "New Plymouth District Plan Zones",
        ["plan_zones"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/51",
            "district_plan_zones", "new_plymouth",
            ["zone_name", "zone_code"],
            lambda a: (
                _clean(a.get("Zone")) or _clean(a.get("Type")) or "Zone",
                None,
            ),
            srid=2193)),
    DataSource("npdc_heritage", "New Plymouth Heritage Buildings & Items",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/4",
            "historic_heritage_overlay", "new_plymouth",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("site_name")) or "Heritage Item",
                _clean(a.get("SiteID")),
                _clean(a.get("NZHPT_Category_1")),
            ),
            geom_type="point",
            srid=2193)),
    DataSource("npdc_trees", "New Plymouth Notable Trees",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/5",
            "notable_trees", "new_plymouth",
            ["name", "schedule"],
            lambda a: (
                _clean(a.get("CommonName")) or _clean(a.get("BotanicalName")) or "Notable Tree",
                str(a.get("SiteID", "")),
            ),
            geom_type="point",
            srid=2193)),
    DataSource("npdc_liquefaction", "New Plymouth Liquefaction Vulnerability",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy/FeatureServer/0",
            "liquefaction_detail", "new_plymouth",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LIQ_CAT")) or "Liquefaction",
                _clean(a.get("Geomorphic_Terrain")),
            ),
            srid=2193)),
    DataSource("npdc_flood_plain", "New Plymouth Flood Plain Areas",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/42",
            "flood_hazard", "new_plymouth_plain",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Flood Plain",
                "High",
                "Flood Plain (NPDC DP)",
            ),
            srid=2193)),
    DataSource("npdc_stormwater_flood", "New Plymouth Stormwater Flooding Areas",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/36",
            "flood_hazard", "new_plymouth_stormwater",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Stormwater Flooding Area",
                "Medium",
                "Stormwater Flood (NPDC)",
            ),
            srid=2193)),
    DataSource("npdc_fault_hazard", "New Plymouth Fault Hazard Areas",
        ["active_faults"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/39",
            "active_faults", "new_plymouth",
            ["fault_name", "fault_type", "slip_rate_mm_yr", "data_source"],
            lambda a: (
                "Fault Hazard Area",
                "Fault Hazard",
                None,
                "NPDC District Plan",
            ),
            srid=2193)),
    DataSource("npdc_coastal_erosion", "New Plymouth Coastal Erosion Hazard",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/38",
            "coastal_erosion", "new_plymouth",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Coastal Erosion Hazard Area",
                "High",
                "Coastal Erosion (NPDC DP)",
            ),
            srid=2193)),
    DataSource("npdc_coastal_flood", "New Plymouth Coastal Flooding Hazard",
        ["coastal_inundation"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/37",
            "coastal_inundation", "new_plymouth",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Coastal Flooding Hazard Area",
                "High",
                "Coastal Flooding (NPDC DP)",
            ),
            srid=2193)),
    DataSource("npdc_volcanic_hazard", "New Plymouth Volcanic Hazard Areas",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/41",
            "flood_hazard", "new_plymouth_volcanic",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Volcanic Hazard Area",
                "High",
                "Volcanic Hazard (NPDC DP)",
            ),
            srid=2193)),
    DataSource("npdc_noise", "New Plymouth Noise Control Boundaries",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/21",
            "noise_contours", "new_plymouth",
            ["name", "noise_level_db"],
            lambda a: (
                "NPDC Noise Control Boundary",
                None,
            ),
            srid=2193)),
    DataSource("npdc_sna", "New Plymouth Significant Natural Areas",
        ["significant_ecological_areas"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services2.arcgis.com/JthOmqz8HxPqljUO/arcgis/rest/services/OpenData_Strategy_DistrictPlan_PartOperative/FeatureServer/48",
            "significant_ecological_areas", "new_plymouth",
            ["name", "significance"],
            lambda a: (
                "Significant Natural Area",
                None,
            ),
            srid=2193)),

    # ══════════════════════════════════════════════════════════
    # HORIZONS — additional layers (extends existing 5)
    # ══════════════════════════════════════════════════════════
    DataSource("horizons_liquefaction", "Horizons Liquefaction Susceptibility",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/Liquefaction_Susceptibility/FeatureServer/0",
            "liquefaction_detail", "horizons",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("LiquefactionSusceptibilityClass")) or "Liquefaction",
                None,
            ),
            srid=2193)),
    DataSource("horizons_tsunami", "Horizons Tsunami Evacuation Zones",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/Tsunami_Evacuation_Zones/FeatureServer/0",
            "tsunami_hazard", "horizons",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Zone")) or "Tsunami Evacuation Zone",
                "High" if "red" in (_clean(a.get("Zone")) or "").lower() else "Medium",
                "Horizons Tsunami Evacuation",
            ),
            srid=2193)),
    DataSource("horizons_flood_modelled", "Horizons Modelled Flood Wet Extents (200yr)",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/Modelled_wet_extents_data_from_flood_plain_mapping_analysis/FeatureServer/11",
            "flood_hazard", "horizons_modelled",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("Name1")) or _clean(a.get("Area")) or "200yr Modelled Flood",
                "High",
                f"200yr ARI ({_clean(a.get('Scenario')) or 'modelled'})",
            ),
            srid=2193)),

    # ══════════════════════════════════════════════════════════
    # PALMERSTON NORTH — additional layers (extends existing 5)
    # ══════════════════════════════════════════════════════════
    DataSource("pncc_heritage_dp", "Palmerston North Heritage Sites (DP)",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/DISTRICTPLAN_HeritageSites/FeatureServer/0",
            "historic_heritage_overlay", "palmerston_north_dp",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("BLDG_OBJECT")) or "Heritage Site",
                None,
                _clean(a.get("TYPE")),
            ),
            geom_type="point",
            srid=2193)),
    DataSource("pncc_notable_trees", "Palmerston North Notable Trees (Parks)",
        ["notable_trees"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/PARKS_NotableTrees/FeatureServer/0",
            "notable_trees", "palmerston_north_parks",
            ["name", "schedule"],
            lambda a: (
                _clean(a.get("COMMON_NAME")) or _clean(a.get("BOTANICAL_NAME")) or "Notable Tree",
                None,
            ),
            geom_type="point",
            srid=2193)),
    DataSource("pncc_overlays", "Palmerston North District Plan Overlays",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/DISTRICTPLAN_Overlays/FeatureServer/0",
            "flood_hazard", "palmerston_north_overlays",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("DESCRIPTION")) or "District Plan Overlay",
                "Medium",
                "District Plan Overlay",
            ),
            srid=2193)),

    # ══════════════════════════════════════════════════════════
    # GISBORNE — additional layers (extends existing 7)
    # ══════════════════════════════════════════════════════════
    DataSource("gisborne_heritage", "Gisborne Heritage Alert Areas",
        ["heritage"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/plan_heritage_alert/FeatureServer/0",
            "historic_heritage_overlay", "gisborne",
            ["name", "schedule", "heritage_type"],
            lambda a: (
                _clean(a.get("TEXT")) or "Heritage Alert Area",
                None,
                _clean(a.get("ZONE_STATU")),
            ),
            srid=2193)),
    DataSource("gisborne_port_noise", "Gisborne Port Noise Controls",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/plan_port_controls/FeatureServer/0",
            "noise_contours", "gisborne_port",
            ["name", "noise_level_db"],
            lambda a: (
                "Gisborne Port 55Ldn Noise Boundary",
                "55",
            ),
            srid=2193)),
    DataSource("gisborne_airport_noise", "Gisborne Airport Noise (65Ldn)",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/plan_airport_controls/FeatureServer/2",
            "noise_contours", "gisborne_airport",
            ["name", "noise_level_db"],
            lambda a: (
                "Gisborne Airport 65Ldn",
                "65",
            ),
            srid=2193)),
    DataSource("gisborne_contaminated", "Gisborne Contaminated Sites",
        ["contaminated_land"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/plan_contaminated_sites/FeatureServer/0",
            "contaminated_land", "gisborne",
            ["site_name", "category"],
            lambda a: (
                _clean(a.get("CONTAMINAT")) or "Contaminated Site",
                _clean(a.get("SITE_NUM")),
            ),
            srid=2193)),
    DataSource("gisborne_coastal_erosion", "Gisborne Coastal Erosion",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/coastal_erosion/FeatureServer/0",
            "coastal_erosion", "gisborne",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                "Coastal Erosion Susceptibility",
                "High",
                "Coastal Erosion",
            ),
            srid=2193)),

    # ══════════════════════════════════════════════════════════
    # WHANGAREI — additional layers (extends existing 9)
    # ══════════════════════════════════════════════════════════
    DataSource("whangarei_coastal_hazard", "Whangarei Coastal Hazard Zones",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/District_Plan_District_Wide_Matters/MapServer/20",
            "coastal_erosion", "whangarei",
            ["name", "hazard_ranking", "hazard_type"],
            lambda a: (
                _clean(a.get("ePlanDisplayField")) or "Coastal Hazard Zone",
                "High",
                f"Coastal Hazard Zone {a.get('CHZ_NUM', '')}",
            ))),
    DataSource("whangarei_airport_noise", "Whangarei Airport Air Noise Boundary",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/District_Plan_District_Wide_Matters/MapServer/50",
            "noise_contours", "whangarei_airport",
            ["name", "noise_level_db"],
            lambda a: (
                _clean(a.get("DESC_")) or "Whangarei Airport Air Noise Boundary",
                None,
            ))),
    DataSource("whangarei_noise_control", "Whangarei Noise Control Boundaries",
        ["noise_contours"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/District_Plan_District_Wide_Matters/MapServer/53",
            "noise_contours", "whangarei_noise",
            ["name", "noise_level_db"],
            lambda a: (
                _clean(a.get("NAME")) or "Noise Control Boundary",
                _clean(a.get("LABEL")),
            ))),
    DataSource("whangarei_tsunami", "Whangarei Tsunami Zones (NRC 2024)",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://nrcmaps.nrc.govt.nz/server/rest/services/Tsunami_Inundation_Zones_2024/MapServer/11",
            "tsunami_hazard", "whangarei",
            ["name", "hazard_ranking", "scenario"],
            lambda a: (
                _clean(a.get("Zone")) or "Tsunami Zone",
                "High",
                "NRC Tsunami 2024",
            ))),

    DataSource("whangarei_liquefaction", "Whangarei Liquefaction Vulnerability (T+T 2020)",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/Liquefaction/MapServer/1",
            "liquefaction_detail", "whangarei",
            ["liquefaction", "simplified"],
            lambda a: (
                _clean(a.get("Category")) or _clean(a.get("Vulnerability")) or "Liquefaction",
                _clean(a.get("Description")),
            ))),
    DataSource("whangarei_land_stability", "Whangarei Land Instability (T+T 2020)",
        ["slope_failure"],
        lambda conn, log=None: _load_council_arcgis(conn, log,
            "https://geo.wdc.govt.nz/server/rest/services/Land_Stability/MapServer/1",
            "slope_failure", "whangarei",
            ["lskey", "severity"],
            lambda a: (
                _clean(a.get("Category")) or "Land Instability",
                _clean(a.get("Susceptibility")) or _clean(a.get("Category")) or "Medium",
            ))),

    # ══════════════════════════════════════════════════════════
    # WHANGANUI — district data via GeoServer WFS
    # Base: https://data.whanganui.govt.nz/geoserver/ows
    # ══════════════════════════════════════════════════════════
    DataSource("whanganui_plan_zones", "Whanganui District Plan Zones (ePlan)",
        ["district_plan_zones"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:property_eplan_zones",
            "district_plan_zones", "whanganui",
            ["zone_name", "zone_code", "category"],
            lambda p: (
                _clean(p.get("name")) or "Unknown Zone",
                _clean(p.get("eplan_ref")),
                _clean(p.get("category")),
            ))),
    DataSource("whanganui_flood_risk_a", "Whanganui Flood Risk Area A",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:eplan_flood_risk_area_a",
            "flood_hazard", "whanganui_flood_a",
            ["name", "hazard_ranking", "hazard_type"],
            lambda p: (
                "Flood Risk Area A",
                "High",
                "Flood Risk Area A (ePlan)",
            ))),
    DataSource("whanganui_flood_risk_b", "Whanganui Flood Risk Area B",
        ["flood_hazard"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:eplan_flood_risk_area_b",
            "flood_hazard", "whanganui_flood_b",
            ["name", "hazard_ranking", "hazard_type"],
            lambda p: (
                "Flood Risk Area B",
                "Medium",
                "Flood Risk Area B (ePlan)",
            ))),
    DataSource("whanganui_liquefaction_high", "Whanganui High Liquefaction",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:highliquefaction",
            "liquefaction_detail", "whanganui_high",
            ["liquefaction", "simplified"],
            lambda p: ("High", "High Liquefaction Susceptibility"))),
    DataSource("whanganui_liquefaction_moderate", "Whanganui Moderate Liquefaction",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:moderateliquefaction",
            "liquefaction_detail", "whanganui_moderate",
            ["liquefaction", "simplified"],
            lambda p: ("Moderate", "Moderate Liquefaction Susceptibility"),
            max_features=100000)),
    DataSource("whanganui_liquefaction_low", "Whanganui Low Liquefaction",
        ["liquefaction_detail"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:lowliquefaction",
            "liquefaction_detail", "whanganui_low",
            ["liquefaction", "simplified"],
            lambda p: ("Low", "Low Liquefaction Susceptibility"),
            max_features=100000)),
    DataSource("whanganui_tsunami_red", "Whanganui Tsunami Red Zone",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:tsunamiredzone",
            "tsunami_hazard", "whanganui_red",
            ["name", "hazard_ranking", "scenario"],
            lambda p: ("Tsunami Red Zone", "High", "Immediate evacuation"))),
    DataSource("whanganui_tsunami_orange", "Whanganui Tsunami Orange Zone",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:tsunamiorangezone",
            "tsunami_hazard", "whanganui_orange",
            ["name", "hazard_ranking", "scenario"],
            lambda p: ("Tsunami Orange Zone", "Medium", "Evacuation on warning"))),
    DataSource("whanganui_tsunami_yellow", "Whanganui Tsunami Yellow Zone",
        ["tsunami_hazard"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:tsunamiyellowzone",
            "tsunami_hazard", "whanganui_yellow",
            ["name", "hazard_ranking", "scenario"],
            lambda p: ("Tsunami Yellow Zone", "Low", "Long/strong evacuation"))),
    DataSource("whanganui_heritage", "Whanganui Heritage Sites (ePlan)",
        ["heritage_sites"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:eplan_heritage_sites",
            "heritage_sites", "whanganui",
            ["name", "category"],
            lambda p: (
                _clean(p.get("name")) or "Heritage Site",
                _clean(p.get("category")),
            ),
            geom_type="point")),
    DataSource("whanganui_protected_trees", "Whanganui Protected Trees (ePlan)",
        ["notable_trees"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:eplan_protected_trees",
            "notable_trees", "whanganui",
            ["species", "common_name"],
            lambda p: (
                _clean(p.get("name")) or "Protected Tree",
                _clean(p.get("category")),
            ),
            geom_type="point")),
    DataSource("whanganui_land_stability_a", "Whanganui Land Stability Area A",
        ["slope_failure"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:eplan_land_stability_assessment_area_a",
            "slope_failure", "whanganui_stability_a",
            ["lskey", "severity"],
            lambda p: ("Land Stability A", "High"))),
    DataSource("whanganui_land_stability_b", "Whanganui Land Stability Area B",
        ["slope_failure"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:eplan_land_stability_assessment_area_b",
            "slope_failure", "whanganui_stability_b",
            ["lskey", "severity"],
            lambda p: ("Land Stability B", "Medium"))),
    DataSource("whanganui_coastal_erosion", "Whanganui Coastal Erosion Hazard (Current)",
        ["coastal_erosion"],
        lambda conn, log=None: _load_council_wfs(conn, log,
            "https://data.whanganui.govt.nz/geoserver/ows",
            "geonode:tt24_1_current_ceha",
            "coastal_erosion", "whanganui",
            ["name", "hazard_ranking", "hazard_type"],
            lambda p: (
                "Coastal Erosion Hazard (Current)",
                "High",
                "Coastal Erosion",
            ))),
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
