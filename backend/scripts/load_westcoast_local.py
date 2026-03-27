"""Load West Coast data from local JSON files (bypasses GIS 403 from VM).

Usage: Copy JSON files to server, then run inside Docker container:
  docker exec app-api-1 python /app/scripts/load_westcoast_local.py
"""
import json
import logging
import os
import sys

import psycopg
from psycopg import sql

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "westcoast_data")

# (filename, table, council, cols, extract_fn, geom_type, srid)
DATASETS = [
    # TTPP layers
    ("ttpp_floodplain.json", "flood_hazard", "westcoast_floodplain",
     ["name", "hazard_ranking", "hazard_type"],
     lambda a: ("TTPP Flood Plain", "High", "Flood Plain (TTPP)"), "polygon", 2193),
    ("ttpp_flood_severe.json", "flood_hazard", "westcoast_flood_severe",
     ["name", "hazard_ranking", "hazard_type"],
     lambda a: ("Severe Flood Hazard", "High", "Flood Hazard Severe (TTPP)"), "polygon", 2193),
    ("ttpp_flood_suscept.json", "flood_hazard", "westcoast_flood_suscept",
     ["name", "hazard_ranking", "hazard_type"],
     lambda a: ("Flood Susceptibility", "Medium", "Flood Hazard Susceptibility (TTPP)"), "polygon", 2193),
    ("ttpp_fault_avoid.json", "fault_zones", "westcoast_fault_avoid",
     ["name", "fault_complexity"],
     lambda a: ((_clean(a, "Name") or "Fault Avoidance Zone"), "Fault Avoidance (TTPP)"), "polygon", 2193),
    ("ttpp_tsunami.json", "tsunami_hazard", "westcoast_ttpp",
     ["name", "hazard_ranking", "scenario"],
     lambda a: ((_clean(a, "Name") or "Tsunami Hazard Zone"), "High", "TTPP Tsunami Hazard"), "polygon", 2193),
    # Natural Hazards
    ("active_faults.json", "fault_zones", "westcoast_active",
     ["name", "fault_complexity"],
     lambda a: ((_clean(a, "Name") or _clean(a, "FaultName") or "Active Fault"), "Active Fault"), "line_to_poly", 2193),
    ("alpine_fault.json", "fault_zones", "westcoast_alpine",
     ["name", "fault_complexity"],
     lambda a: ((_clean(a, "Name") or "Alpine Fault Trace"), "Alpine Fault"), "line_to_poly", 2193),
    ("landslide_catalog.json", "slope_failure", "westcoast_landslide",
     ["lskey", "severity"],
     lambda a: ((_clean(a, "Type") or "Landslide"), "High"), "point_to_poly", 2193),
    # Other hazards (coastal_hazard and rockfall have path geometry despite being area-ish)
    ("coastal_hazard.json", "coastal_erosion", "westcoast_coastal",
     ["name", "coast_type"],
     lambda a: ((_clean(a, "Name") or "West Coast Coastal Hazard"), "Coastal Hazard"), "line", 2193),
    ("rockfall.json", "slope_failure", "westcoast_rockfall",
     ["lskey", "severity"],
     lambda a: ("Rockfall Hazard", "High"), "line_to_poly", 2193),
    ("tsunami_evac.json", "tsunami_hazard", "westcoast",
     ["name", "hazard_ranking", "scenario"],
     lambda a: ((_clean(a, "Zone") or _clean(a, "Name") or "Tsunami Evacuation Zone"),
                (_clean(a, "Colour") or "High"), "West Coast Tsunami Evacuation"), "polygon", 2193),
]


def _clean(attrs: dict, key: str) -> str | None:
    v = attrs.get(key)
    if v is None:
        return None
    s = str(v).strip()
    return s if s and s.lower() not in ("null", "none", "<null>") else None


def _mp_wkt(geom: dict) -> str | None:
    rings = geom.get("rings", [])
    if not rings:
        return None
    parts = []
    for ring in rings:
        coords = ", ".join(f"{p[0]} {p[1]}" for p in ring)
        parts.append(f"(({coords}))")
    return f"MULTIPOLYGON({', '.join(parts)})"


def _ml_wkt(geom: dict) -> str | None:
    paths = geom.get("paths", [])
    if not paths:
        return None
    parts = []
    for path in paths:
        coords = ", ".join(f"{p[0]} {p[1]}" for p in path)
        parts.append(f"({coords})")
    return f"MULTILINESTRING({', '.join(parts)})"


def load_dataset(conn, filename, table, council, cols, extract, geom_type, srid):
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        log.warning(f"SKIP {filename} — file not found")
        return 0

    with open(filepath) as f:
        data = json.load(f)
    features = data.get("features", [])
    log.info(f"Loading {filename}: {len(features)} features → {table} ({council})")

    cur = conn.cursor()
    cur.execute(
        sql.SQL("DELETE FROM {} WHERE source_council = %s").format(sql.Identifier(table)),
        (council,),
    )

    col_ids = sql.SQL(", ").join([sql.Identifier(c) for c in cols])
    placeholders = sql.SQL(", ").join([sql.Placeholder()] * len(cols))
    # For line/point geometries going into MultiPolygon columns, buffer them
    if geom_type in ("line_to_poly", "point_to_poly"):
        # Buffer by 50m then simplify — creates a MultiPolygon from line/point
        # Transform NZGD2000(2193) → 4326, then buffer on geography, then simplify
        insert_q = sql.SQL(
            "INSERT INTO {} ({}, source_council, geom) "
            "VALUES ({}, %s, ST_Multi(ST_SimplifyPreserveTopology("
            "ST_Buffer(ST_Transform(ST_SetSRID(ST_GeomFromText(%s), %s), 4326)::geography, 50)::geometry"
            ", 0.0005)))"
        ).format(sql.Identifier(table), col_ids, placeholders)
    else:
        # Use ST_SimplifyPreserveTopology to reduce vertex count and avoid OOM
        insert_q = sql.SQL(
            "INSERT INTO {} ({}, source_council, geom) "
            "VALUES ({}, %s, ST_Multi(ST_Transform(ST_SimplifyPreserveTopology("
            "ST_SetSRID(ST_GeomFromText(%s), %s), 50), 4326)))"
        ).format(sql.Identifier(table), col_ids, placeholders)

    count = 0
    for feat in features:
        attrs = feat.get("attributes", {})
        geom = feat.get("geometry")
        if not geom:
            continue

        if geom_type == "polygon":
            if not geom.get("rings"):
                continue
            wkt = _mp_wkt(geom)
        elif geom_type in ("line", "line_to_poly"):
            if not geom.get("paths"):
                continue
            wkt = _ml_wkt(geom)
        elif geom_type in ("point", "point_to_poly"):
            x, y = geom.get("x"), geom.get("y")
            if x is None or y is None:
                continue
            wkt = f"POINT({x} {y})"
        else:
            continue

        if not wkt:
            continue

        vals = extract(attrs)
        try:
            cur.execute(insert_q, (*vals, council, wkt, srid))
            count += 1
        except Exception as e:
            if count == 0:
                log.warning(f"  First insert error for {council}: {e}")
            conn.rollback()
            continue
        if count % 500 == 0:
            conn.commit()

    conn.commit()
    log.info(f"  {table} ({council}): {count} rows loaded")
    return count


def main():
    db_url = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    total = 0
    ok = 0
    fail = 0

    for ds in DATASETS:
        filename, table, council, cols, extract, geom_type, srid = ds
        # Fresh connection for each dataset to survive OOM/crashes
        try:
            conn = psycopg.connect(db_url)
            n = load_dataset(conn, filename, table, council, cols, extract, geom_type, srid)
            conn.close()
            total += n
            ok += 1
            log.info(f"  OK: {filename}")
        except Exception as e:
            fail += 1
            log.error(f"  FAIL: {filename} — {e}")
            try:
                conn.close()
            except Exception:
                pass
    log.info(f"DONE: {ok} OK, {fail} FAIL, {total} total rows")


if __name__ == "__main__":
    main()
