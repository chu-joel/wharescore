"""
Pre-compute transit travel times from every Metlink stop to key Wellington destinations.

Uses GTFS stop_times to find the shortest scheduled travel time from each stop
to destination stops (within 300m of key locations). Considers direct routes only
(no transfers) — which is what most commuters care about for frequent trips.

Output: transit_travel_times table with (origin_stop_id, destination, min_minutes, route_names)

Run: python scripts/precompute_travel_times.py
"""

import io
import csv
import json
import math
import sys
import time as time_mod
import urllib.request
import zipfile
from collections import defaultdict

import psycopg

DB_CONN = "host=localhost dbname=wharescore user=postgres password=postgres"
GTFS_URL = "https://static.opendata.metlink.org.nz/v1/gtfs/full.zip"

# Key Wellington destinations: name → (lng, lat)
# These are the places property buyers care about reaching by transit
KEY_DESTINATIONS = {
    "Wellington CBD":       (174.7762, -41.2788),  # Wellington Station / Lambton Quay
    "Airport":              (174.8050, -41.3272),  # Wellington Airport terminal
    "Hospital":             (174.7780, -41.3045),  # Wellington Regional Hospital
    "Victoria University":  (174.7668, -41.2868),  # Kelburn campus
    "Lower Hutt":           (174.9070, -41.2095),  # Queensgate / Lower Hutt CBD
    "Petone":               (174.8850, -41.2270),  # Petone Station area
    "Johnsonville":         (174.8060, -41.2240),  # Johnsonville Station
    "Porirua":              (174.8390, -41.1340),  # Porirua Station
    "Courtenay Place":      (174.7830, -41.2930),  # Entertainment/dining hub
    "Newtown":              (174.7790, -41.3070),  # Newtown shopping centre
    "Kilbirnie":            (174.7990, -41.3170),  # Kilbirnie town centre
    "Miramar":              (174.8160, -41.3200),  # Miramar shops / Weta area
}

DEST_RADIUS_M = 400  # Match stops within this radius of destination


def haversine(lon1, lat1, lon2, lat2):
    R = 6371000
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + \
        math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 2 * R * math.asin(math.sqrt(a))


def time_to_secs(t):
    parts = t.split(":")
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])


def main():
    sys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None

    # 1. Download GTFS
    print("Downloading GTFS...")
    req = urllib.request.Request(GTFS_URL, headers={"User-Agent": "WhareScore/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        zip_data = resp.read()
    print(f"  Downloaded {len(zip_data) / 1024 / 1024:.1f} MB")

    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        # 2. Load stops
        with zf.open("stops.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            stops = {}
            for row in reader:
                try:
                    stops[row["stop_id"]] = {
                        "name": row["stop_name"],
                        "lat": float(row["stop_lat"]),
                        "lon": float(row["stop_lon"]),
                    }
                except (ValueError, KeyError):
                    continue
        print(f"  {len(stops)} stops")

        # 3. Load routes
        with zf.open("routes.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            route_info = {}
            for r in reader:
                route_info[r["route_id"]] = {
                    "name": r["route_short_name"],
                    "type": int(r["route_type"]),
                    "long_name": r["route_long_name"],
                }
        print(f"  {len(route_info)} routes")

        # 4. Load trips → route mapping
        with zf.open("trips.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            trip_route = {r["trip_id"]: r["route_id"] for r in reader}
        print(f"  {len(trip_route)} trips")

        # 5. Load stop_times and build trip sequences
        print("  Loading stop_times...")
        trip_stops = defaultdict(list)
        with zf.open("stop_times.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            for row in reader:
                trip_stops[row["trip_id"]].append((
                    int(row["stop_sequence"]),
                    row["stop_id"],
                    time_to_secs(row["arrival_time"]),
                ))

        # Sort each trip by sequence
        for tid in trip_stops:
            trip_stops[tid].sort()
        print(f"  {len(trip_stops)} trips with stop sequences")

    # 6. Find destination stops
    dest_stops = {}  # destination_name → set of stop_ids
    for dest_name, (dlon, dlat) in KEY_DESTINATIONS.items():
        matching = set()
        for sid, s in stops.items():
            dist = haversine(dlon, dlat, s["lon"], s["lat"])
            if dist <= DEST_RADIUS_M:
                matching.add(sid)
        dest_stops[dest_name] = matching
        print(f"  {dest_name}: {len(matching)} stops within {DEST_RADIUS_M}m")

    # 7. For each trip, compute travel times from every stop to destination stops
    # Result: origin_stop → destination → {min_minutes, routes}
    print("\nComputing travel times...")
    travel_times = defaultdict(lambda: defaultdict(lambda: {"min_minutes": 9999, "routes": set()}))

    for trip_idx, (tid, stop_seq) in enumerate(trip_stops.items()):
        if trip_idx % 2000 == 0:
            print(f"  Processing trip {trip_idx}/{len(trip_stops)}...")

        rid = trip_route.get(tid)
        rinfo = route_info.get(rid, {})
        route_name = rinfo.get("name", "?")
        route_type = rinfo.get("type", 3)

        # Map route_type to mode label
        mode = {2: "train", 3: "bus", 4: "ferry", 5: "cable car"}.get(route_type, "bus")

        # Build stop_id → arrival_time index for this trip
        stop_times = {sid: arr for _, sid, arr in stop_seq}

        # For each destination, check if this trip passes through a destination stop
        for dest_name, dest_stop_ids in dest_stops.items():
            # Find the earliest destination stop on this trip
            dest_arrivals = []
            for dsid in dest_stop_ids:
                if dsid in stop_times:
                    dest_arrivals.append(stop_times[dsid])

            if not dest_arrivals:
                continue

            dest_arrival = min(dest_arrivals)

            # For every stop BEFORE the destination on this trip, compute travel time
            for _, sid, arr in stop_seq:
                if arr >= dest_arrival:
                    break  # Past the destination
                travel_min = (dest_arrival - arr) / 60
                if travel_min < 1:
                    continue  # Same stop cluster

                entry = travel_times[sid][dest_name]
                if travel_min < entry["min_minutes"]:
                    entry["min_minutes"] = travel_min
                    entry["routes"] = {f"{route_name} ({mode})"}
                elif travel_min == entry["min_minutes"]:
                    entry["routes"].add(f"{route_name} ({mode})")

    # Count results
    total_pairs = sum(len(dests) for dests in travel_times.values())
    print(f"\n  Computed {total_pairs} origin→destination travel time pairs")

    # 8. Also compute peak-hour frequency for each stop
    # Count trips per stop during morning peak (7-9am = 25200-32400 seconds)
    print("\nComputing peak frequency per stop...")
    stop_peak_trips = defaultdict(set)  # stop_id → set of (route_name, trip_id)
    PEAK_START = 7 * 3600  # 7am
    PEAK_END = 9 * 3600    # 9am

    for tid, stop_seq in trip_stops.items():
        rid = trip_route.get(tid)
        rinfo = route_info.get(rid, {})
        route_name = rinfo.get("name", "?")

        for _, sid, arr in stop_seq:
            if PEAK_START <= arr <= PEAK_END:
                stop_peak_trips[sid].add(tid)

    # Convert to trips per hour
    stop_frequency = {}
    for sid, trips in stop_peak_trips.items():
        stop_frequency[sid] = len(trips) / 2  # 2-hour window → per hour

    # 9. Write to database
    print("\nWriting to database...")
    conn = psycopg.connect(DB_CONN)
    cur = conn.cursor()

    # Create tables
    cur.execute("""
        DROP TABLE IF EXISTS transit_travel_times CASCADE;
        CREATE TABLE transit_travel_times (
            id SERIAL PRIMARY KEY,
            stop_id TEXT NOT NULL,
            destination TEXT NOT NULL,
            min_minutes NUMERIC NOT NULL,
            route_names TEXT[],
            UNIQUE(stop_id, destination)
        );
        CREATE INDEX idx_ttt_stop ON transit_travel_times (stop_id);
        CREATE INDEX idx_ttt_dest ON transit_travel_times (destination);
    """)

    cur.execute("""
        DROP TABLE IF EXISTS transit_stop_frequency CASCADE;
        CREATE TABLE transit_stop_frequency (
            stop_id TEXT PRIMARY KEY,
            peak_trips_per_hour NUMERIC NOT NULL
        );
    """)

    # Insert travel times
    count = 0
    for sid, dests in travel_times.items():
        for dest_name, info in dests.items():
            if info["min_minutes"] >= 9999:
                continue
            cur.execute("""
                INSERT INTO transit_travel_times (stop_id, destination, min_minutes, route_names)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (stop_id, destination) DO UPDATE SET
                    min_minutes = EXCLUDED.min_minutes,
                    route_names = EXCLUDED.route_names
            """, (
                sid,
                dest_name,
                round(info["min_minutes"], 1),
                sorted(info["routes"]),
            ))
            count += 1

    print(f"  Inserted {count} travel time records")

    # Insert frequencies
    freq_count = 0
    for sid, freq in stop_frequency.items():
        cur.execute("""
            INSERT INTO transit_stop_frequency (stop_id, peak_trips_per_hour)
            VALUES (%s, %s)
            ON CONFLICT (stop_id) DO UPDATE SET peak_trips_per_hour = EXCLUDED.peak_trips_per_hour
        """, (sid, round(freq, 1)))
        freq_count += 1

    print(f"  Inserted {freq_count} frequency records")

    conn.commit()

    # Validation
    print("\n=== Validation ===")
    cur.execute("SELECT COUNT(*) FROM transit_travel_times")
    print(f"  transit_travel_times: {cur.fetchone()[0]} rows")
    cur.execute("SELECT COUNT(*) FROM transit_stop_frequency")
    print(f"  transit_stop_frequency: {cur.fetchone()[0]} rows")

    # Sample: show travel times from Wellington Station (stop 5015)
    print("\n=== Sample: stops near Lambton Quay (5015) ===")
    cur.execute("""
        SELECT destination, min_minutes, route_names
        FROM transit_travel_times
        WHERE stop_id = '5015'
        ORDER BY min_minutes
    """)
    for row in cur.fetchall():
        print(f"  → {row[0]:25s} {row[1]:5.0f} min  via {', '.join(row[2][:3])}")

    # Sample: Cuba Street area stops
    print("\n=== Sample: stops near Cuba Street (5000 area) ===")
    cur.execute("""
        SELECT destination, min_minutes, route_names
        FROM transit_travel_times
        WHERE stop_id = '5000'
        ORDER BY min_minutes
    """)
    for row in cur.fetchall():
        print(f"  → {row[0]:25s} {row[1]:5.0f} min  via {', '.join(row[2][:3])}")

    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
