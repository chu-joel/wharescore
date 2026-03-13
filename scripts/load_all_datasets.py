"""
Load all downloaded CSV datasets into PostGIS.
Datasets: earthquakes, schools, crash (CAS), bonds (TLA & region), transit stops
"""

import csv
import sys
import time
import psycopg

DB = "postgresql://postgres:postgres@localhost:5432/wharescore"


def timer(label):
    """Simple context manager for timing."""
    class Timer:
        def __enter__(self):
            self.start = time.time()
            print(f"  Loading {label}...", flush=True)
            return self
        def __exit__(self, *args):
            elapsed = time.time() - self.start
            print(f"  Done in {elapsed:.1f}s", flush=True)
    return Timer()


def load_earthquakes(conn):
    """Load GeoNet earthquake data (pipe-delimited, lat/lng WGS84)."""
    print("\n=== EARTHQUAKES ===", flush=True)

    conn.execute("DROP TABLE IF EXISTS earthquakes CASCADE;")
    conn.execute("""
        CREATE TABLE earthquakes (
            event_id TEXT PRIMARY KEY,
            event_time TIMESTAMPTZ,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            depth_km DOUBLE PRECISION,
            magnitude DOUBLE PRECISION,
            mag_type TEXT,
            location_name TEXT,
            event_type TEXT,
            geom GEOMETRY(Point, 4326)
        );
    """)

    filepath = r"D:\Projects\Experiments\propertyiq-poc\data\earthquake\nz-earthquakes-m3plus.csv"
    rows = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            parts = line.strip().split("|")
            if len(parts) < 8:
                continue
            rows.append((
                parts[0],           # EventID
                parts[1],           # Time
                float(parts[2]),    # Latitude
                float(parts[3]),    # Longitude
                float(parts[4]),    # Depth/km
                float(parts[10]) if parts[10] else None,  # Magnitude
                parts[9],           # MagType
                parts[12],          # EventLocationName
                parts[13] if len(parts) > 13 else None,  # EventType
            ))

    with timer(f"{len(rows)} earthquakes"):
        with conn.cursor().copy(
            "COPY earthquakes (event_id, event_time, latitude, longitude, depth_km, "
            "magnitude, mag_type, location_name, event_type) FROM STDIN"
        ) as copy:
            for row in rows:
                copy.write_row(row)
        conn.execute("""
            UPDATE earthquakes
            SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);
        """)
        conn.execute("CREATE INDEX idx_earthquakes_geom ON earthquakes USING GIST (geom);")
        conn.execute("CREATE INDEX idx_earthquakes_magnitude ON earthquakes (magnitude);")
    conn.commit()
    print(f"  Loaded {len(rows)} earthquakes")


def load_schools(conn):
    """Load NZ school directory (CSV with lat/lng)."""
    print("\n=== SCHOOLS ===", flush=True)

    conn.execute("DROP TABLE IF EXISTS schools CASCADE;")
    conn.execute("""
        CREATE TABLE schools (
            school_id INTEGER PRIMARY KEY,
            org_name TEXT,
            telephone TEXT,
            email TEXT,
            contact_name TEXT,
            url TEXT,
            address_line1 TEXT,
            suburb TEXT,
            city TEXT,
            postal_address TEXT,
            postal_suburb TEXT,
            postal_city TEXT,
            postal_code TEXT,
            urban_rural TEXT,
            org_type TEXT,
            definition TEXT,
            authority TEXT,
            school_donations TEXT,
            coed_status TEXT,
            takiwa TEXT,
            territorial_authority TEXT,
            regional_council TEXT,
            education_region TEXT,
            general_electorate TEXT,
            maori_electorate TEXT,
            sa2_code TEXT,
            sa2_description TEXT,
            ward TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            enrolment_scheme TEXT,
            eqi_index INTEGER,
            roll_date DATE,
            total_roll INTEGER,
            european INTEGER,
            maori INTEGER,
            pacific INTEGER,
            asian INTEGER,
            melaa INTEGER,
            other_ethnicity INTEGER,
            international INTEGER,
            isolation_index DOUBLE PRECISION,
            language_of_instruction TEXT,
            boarding_facilities TEXT,
            cohort_entry TEXT,
            status TEXT,
            date_opened DATE,
            geom GEOMETRY(Point, 4326)
        );
    """)

    filepath = r"D:\Projects\Experiments\propertyiq-poc\data\schools\nz-schools-directory.csv"
    rows = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            lat = r.get("Latitude", "").strip()
            lng = r.get("Longitude", "").strip()
            if not lat or not lng:
                continue

            def safe_int(val):
                v = val.strip().strip('"') if val else ""
                try:
                    return int(v) if v else None
                except (ValueError, TypeError):
                    return None

            def safe_float(val):
                v = val.strip().strip('"') if val else ""
                try:
                    return float(v) if v else None
                except (ValueError, TypeError):
                    return None

            def safe_date(val):
                v = val.strip().strip('"') if val else ""
                if not v:
                    return None
                return v.split(" ")[0] if " " in v else v

            rows.append((
                safe_int(r["School_Id"]),
                r.get("Org_Name", "").strip().strip('"'),
                r.get("Telephone", "").strip().strip('"'),
                r.get("Email", "").strip().strip('"'),
                r.get("Contact1_Name", "").strip().strip('"'),
                r.get("URL", "").strip().strip('"'),
                r.get("Add1_Line1", "").strip().strip('"'),
                r.get("Add1_Suburb", "").strip().strip('"'),
                r.get("Add1_City", "").strip().strip('"'),
                r.get("Add2_Line1", "").strip().strip('"'),
                r.get("Add2_Suburb", "").strip().strip('"'),
                r.get("Add2_City", "").strip().strip('"'),
                r.get("Add2_Postal_Code", "").strip().strip('"'),
                r.get("Urban_Rural_Indicator", "").strip().strip('"'),
                r.get("Org_Type", "").strip().strip('"'),
                r.get("Definition", "").strip().strip('"'),
                r.get("Authority", "").strip().strip('"'),
                r.get("School_Donations", "").strip().strip('"'),
                r.get("CoEd_Status", "").strip().strip('"'),
                r.get("Takiwā", "").strip().strip('"'),
                r.get("Territorial_Authority", "").strip().strip('"'),
                r.get("Regional_Council", "").strip().strip('"'),
                r.get("Education_Region", "").strip().strip('"'),
                r.get("General_Electorate", "").strip().strip('"'),
                r.get("Māori_Electorate", "").strip().strip('"'),
                r.get("Statistical_Area_2_Code", "").strip().strip('"'),
                r.get("Statistical_Area_2_Description", "").strip().strip('"'),
                r.get("Ward", "").strip().strip('"'),
                safe_float(lat),
                safe_float(lng),
                r.get("Enrolment_Scheme", "").strip().strip('"'),
                safe_int(r.get("EQi_Index", "")),
                safe_date(r.get("Roll_Date", "")),
                safe_int(r.get("Total", "")),
                safe_int(r.get("European", "")),
                safe_int(r.get("Māori", "")),
                safe_int(r.get("Pacific", "")),
                safe_int(r.get("Asian", "")),
                safe_int(r.get("MELAA", "")),
                safe_int(r.get("Other", "")),
                safe_int(r.get("International", "")),
                safe_float(r.get("Isolation_Index", "")),
                r.get("Language_of_Instruction", "").strip().strip('"'),
                r.get("BoardingFacilities", "").strip().strip('"'),
                r.get("CohortEntry", "").strip().strip('"'),
                r.get("Status", "").strip().strip('"'),
                safe_date(r.get("DateSchoolOpened", "")),
            ))

    with timer(f"{len(rows)} schools"):
        with conn.cursor().copy(
            "COPY schools (school_id, org_name, telephone, email, contact_name, url, "
            "address_line1, suburb, city, postal_address, postal_suburb, postal_city, postal_code, "
            "urban_rural, org_type, definition, authority, school_donations, coed_status, takiwa, "
            "territorial_authority, regional_council, education_region, general_electorate, "
            "maori_electorate, sa2_code, sa2_description, ward, latitude, longitude, "
            "enrolment_scheme, eqi_index, roll_date, total_roll, european, maori, pacific, "
            "asian, melaa, other_ethnicity, international, isolation_index, "
            "language_of_instruction, boarding_facilities, cohort_entry, status, date_opened) "
            "FROM STDIN"
        ) as copy:
            for row in rows:
                copy.write_row(row)
        conn.execute("""
            UPDATE schools
            SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
        """)
        conn.execute("CREATE INDEX idx_schools_geom ON schools USING GIST (geom);")
    conn.commit()
    print(f"  Loaded {len(rows)} schools")


def load_crash(conn):
    """Load Crash Analysis System data (CSV, X/Y in NZTM EPSG:2193)."""
    print("\n=== CRASH (CAS) ===", flush=True)

    conn.execute("DROP TABLE IF EXISTS crashes CASCADE;")
    conn.execute("""
        CREATE TABLE crashes (
            objectid INTEGER PRIMARY KEY,
            x DOUBLE PRECISION,
            y DOUBLE PRECISION,
            crash_year INTEGER,
            crash_severity TEXT,
            fatal_count INTEGER,
            serious_injury_count INTEGER,
            minor_injury_count INTEGER,
            crash_location1 TEXT,
            crash_location2 TEXT,
            crash_road_side_road TEXT,
            crash_sh_description TEXT,
            speed_limit INTEGER,
            road_surface TEXT,
            road_character TEXT,
            road_lane TEXT,
            number_of_lanes INTEGER,
            light TEXT,
            weather_a TEXT,
            weather_b TEXT,
            urban TEXT,
            flat_hill TEXT,
            intersection TEXT,
            bicycle INTEGER,
            bus INTEGER,
            car_station_wagon INTEGER,
            motorcycle INTEGER,
            moped INTEGER,
            pedestrian INTEGER,
            truck INTEGER,
            van_or_utility INTEGER,
            suv INTEGER,
            taxi INTEGER,
            school_bus INTEGER,
            region TEXT,
            tla_id INTEGER,
            tla_name TEXT,
            meshblock_id TEXT,
            area_unit_id TEXT,
            holiday TEXT,
            crash_financial_year TEXT,
            geom GEOMETRY(Point, 4326)
        );
    """)

    filepath = r"D:\Projects\Experiments\propertyiq-poc\data\crash\Crash_Analysis_System_(CAS)_data.csv"
    rows = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            x_val = r.get("X", "").strip()
            y_val = r.get("Y", "").strip()
            if not x_val or not y_val:
                continue

            def safe_int(val):
                v = (val or "").strip()
                try:
                    return int(float(v)) if v else None
                except (ValueError, TypeError):
                    return None

            def safe_float(val):
                v = (val or "").strip()
                try:
                    return float(v) if v else None
                except (ValueError, TypeError):
                    return None

            rows.append((
                safe_int(r.get("OBJECTID")),
                safe_float(x_val),
                safe_float(y_val),
                safe_int(r.get("crashYear")),
                r.get("crashSeverity", "").strip() or None,
                safe_int(r.get("fatalCount")),
                safe_int(r.get("seriousInjuryCount")),
                safe_int(r.get("minorInjuryCount")),
                r.get("crashLocation1", "").strip() or None,
                r.get("crashLocation2", "").strip() or None,
                r.get("crashRoadSideRoad", "").strip() or None,
                r.get("crashSHDescription", "").strip() or None,
                safe_int(r.get("speedLimit")),
                r.get("roadSurface", "").strip() or None,
                r.get("roadCharacter", "").strip() or None,
                r.get("roadLane", "").strip() or None,
                safe_int(r.get("NumberOfLanes")),
                r.get("light", "").strip() or None,
                r.get("weatherA", "").strip() or None,
                r.get("weatherB", "").strip() or None,
                r.get("urban", "").strip() or None,
                r.get("flatHill", "").strip() or None,
                r.get("intersection", "").strip() or None,
                safe_int(r.get("bicycle")),
                safe_int(r.get("bus")),
                safe_int(r.get("carStationWagon")),
                safe_int(r.get("motorcycle")),
                safe_int(r.get("moped")),
                safe_int(r.get("pedestrian")),
                safe_int(r.get("truck")),
                safe_int(r.get("vanOrUtility")),
                safe_int(r.get("suv")),
                safe_int(r.get("taxi")),
                safe_int(r.get("schoolBus")),
                r.get("region", "").strip() or None,
                safe_int(r.get("tlaId")),
                r.get("tlaName", "").strip() or None,
                r.get("meshblockId", "").strip() or None,
                r.get("areaUnitID", "").strip() or None,
                r.get("holiday", "").strip() or None,
                r.get("crashFinancialYear", "").strip() or None,
            ))

    with timer(f"{len(rows)} crashes"):
        with conn.cursor().copy(
            "COPY crashes (objectid, x, y, crash_year, crash_severity, fatal_count, "
            "serious_injury_count, minor_injury_count, crash_location1, crash_location2, "
            "crash_road_side_road, crash_sh_description, speed_limit, road_surface, "
            "road_character, road_lane, number_of_lanes, light, weather_a, weather_b, "
            "urban, flat_hill, intersection, bicycle, bus, car_station_wagon, motorcycle, "
            "moped, pedestrian, truck, van_or_utility, suv, taxi, school_bus, region, "
            "tla_id, tla_name, meshblock_id, area_unit_id, holiday, crash_financial_year) "
            "FROM STDIN"
        ) as copy:
            for row in rows:
                copy.write_row(row)

        # Transform NZTM coordinates to WGS84
        conn.execute("""
            UPDATE crashes
            SET geom = ST_Transform(ST_SetSRID(ST_MakePoint(x, y), 2193), 4326)
            WHERE x IS NOT NULL AND y IS NOT NULL;
        """)
        conn.execute("CREATE INDEX idx_crashes_geom ON crashes USING GIST (geom);")
        conn.execute("CREATE INDEX idx_crashes_severity ON crashes (crash_severity);")
        conn.execute("CREATE INDEX idx_crashes_year ON crashes (crash_year);")
    conn.commit()
    print(f"  Loaded {len(rows)} crashes")


def load_bonds_tla(conn):
    """Load rental bond data by TLA."""
    print("\n=== BONDS (TLA) ===", flush=True)

    conn.execute("DROP TABLE IF EXISTS bonds_tla CASCADE;")
    conn.execute("""
        CREATE TABLE bonds_tla (
            id SERIAL PRIMARY KEY,
            time_frame DATE,
            location_id INTEGER,
            location TEXT,
            lodged_bonds INTEGER,
            active_bonds INTEGER,
            closed_bonds INTEGER,
            median_rent INTEGER,
            geometric_mean_rent INTEGER,
            upper_quartile_rent INTEGER,
            lower_quartile_rent INTEGER,
            log_std_dev DOUBLE PRECISION
        );
    """)

    filepath = r"D:\Projects\Experiments\propertyiq-poc\data\bonds\Detailed-Monthly-TLA-Tenancy.csv"
    rows = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            def clean_int(val):
                v = (val or "").strip().strip('"').replace(",", "")
                try:
                    return int(v) if v else None
                except (ValueError, TypeError):
                    return None

            def clean_float(val):
                v = (val or "").strip().strip('"').replace(",", "")
                try:
                    return float(v) if v else None
                except (ValueError, TypeError):
                    return None

            tf = r.get("Time Frame", "").strip().strip('"')
            rows.append((
                tf if tf else None,
                clean_int(r.get("Location Id")),
                r.get("Location", "").strip().strip('"') or None,
                clean_int(r.get("Lodged Bonds")),
                clean_int(r.get("Active Bonds")),
                clean_int(r.get("Closed Bonds")),
                clean_int(r.get("Median Rent")),
                clean_int(r.get("Geometric Mean Rent")),
                clean_int(r.get("Upper Quartile Rent")),
                clean_int(r.get("Lower Quartile Rent")),
                clean_float(r.get("Log Std Dev Weekly Rent")),
            ))

    with timer(f"{len(rows)} bond records (TLA)"):
        with conn.cursor().copy(
            "COPY bonds_tla (time_frame, location_id, location, lodged_bonds, active_bonds, "
            "closed_bonds, median_rent, geometric_mean_rent, upper_quartile_rent, "
            "lower_quartile_rent, log_std_dev) FROM STDIN"
        ) as copy:
            for row in rows:
                copy.write_row(row)
        conn.execute("CREATE INDEX idx_bonds_tla_location ON bonds_tla (location);")
        conn.execute("CREATE INDEX idx_bonds_tla_time ON bonds_tla (time_frame);")
    conn.commit()
    print(f"  Loaded {len(rows)} bond records (TLA)")


def load_bonds_region(conn):
    """Load rental bond data by region."""
    print("\n=== BONDS (REGION) ===", flush=True)

    conn.execute("DROP TABLE IF EXISTS bonds_region CASCADE;")
    conn.execute("""
        CREATE TABLE bonds_region (
            id SERIAL PRIMARY KEY,
            time_frame DATE,
            location_id INTEGER,
            location TEXT,
            lodged_bonds INTEGER,
            active_bonds INTEGER,
            closed_bonds INTEGER,
            median_rent INTEGER,
            geometric_mean_rent INTEGER,
            upper_quartile_rent INTEGER,
            lower_quartile_rent INTEGER,
            log_std_dev DOUBLE PRECISION
        );
    """)

    filepath = r"D:\Projects\Experiments\propertyiq-poc\data\bonds\Detailed-Monthly-Region-Tenancy.csv"
    rows = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            def clean_int(val):
                v = (val or "").strip().strip('"').replace(",", "")
                try:
                    return int(v) if v else None
                except (ValueError, TypeError):
                    return None

            def clean_float(val):
                v = (val or "").strip().strip('"').replace(",", "")
                try:
                    return float(v) if v else None
                except (ValueError, TypeError):
                    return None

            tf = r.get("Time Frame", "").strip().strip('"')
            rows.append((
                tf if tf else None,
                clean_int(r.get("Location Id")),
                r.get("Location", "").strip().strip('"') or None,
                clean_int(r.get("Lodged Bonds")),
                clean_int(r.get("Active Bonds")),
                clean_int(r.get("Closed Bonds")),
                clean_int(r.get("Median Rent")),
                clean_int(r.get("Geometric Mean Rent")),
                clean_int(r.get("Upper Quartile Rent")),
                clean_int(r.get("Lower Quartile Rent")),
                clean_float(r.get("Log Std Dev Weekly Rent")),
            ))

    with timer(f"{len(rows)} bond records (region)"):
        with conn.cursor().copy(
            "COPY bonds_region (time_frame, location_id, location, lodged_bonds, active_bonds, "
            "closed_bonds, median_rent, geometric_mean_rent, upper_quartile_rent, "
            "lower_quartile_rent, log_std_dev) FROM STDIN"
        ) as copy:
            for row in rows:
                copy.write_row(row)
        conn.execute("CREATE INDEX idx_bonds_region_location ON bonds_region (location);")
        conn.execute("CREATE INDEX idx_bonds_region_time ON bonds_region (time_frame);")
    conn.commit()
    print(f"  Loaded {len(rows)} bond records (region)")


def load_transit_stops(conn):
    """Load Metlink GTFS transit stops."""
    print("\n=== TRANSIT STOPS ===", flush=True)

    conn.execute("DROP TABLE IF EXISTS transit_stops CASCADE;")
    conn.execute("""
        CREATE TABLE transit_stops (
            stop_id TEXT PRIMARY KEY,
            stop_code TEXT,
            stop_name TEXT,
            stop_desc TEXT,
            stop_lat DOUBLE PRECISION,
            stop_lon DOUBLE PRECISION,
            zone_id TEXT,
            location_type INTEGER,
            parent_station TEXT,
            geom GEOMETRY(Point, 4326)
        );
    """)

    filepath = r"D:\Projects\Experiments\propertyiq-poc\data\transit\stops.txt"
    rows = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            lat = r.get("stop_lat", "").strip()
            lon = r.get("stop_lon", "").strip()
            if not lat or not lon:
                continue
            rows.append((
                r.get("stop_id", "").strip(),
                r.get("stop_code", "").strip() or None,
                r.get("stop_name", "").strip(),
                r.get("stop_desc", "").strip() or None,
                float(lat),
                float(lon),
                r.get("zone_id", "").strip() or None,
                int(r["location_type"]) if r.get("location_type", "").strip() else None,
                r.get("parent_station", "").strip() or None,
            ))

    with timer(f"{len(rows)} transit stops"):
        with conn.cursor().copy(
            "COPY transit_stops (stop_id, stop_code, stop_name, stop_desc, "
            "stop_lat, stop_lon, zone_id, location_type, parent_station) FROM STDIN"
        ) as copy:
            for row in rows:
                copy.write_row(row)
        conn.execute("""
            UPDATE transit_stops
            SET geom = ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326);
        """)
        conn.execute("CREATE INDEX idx_transit_stops_geom ON transit_stops USING GIST (geom);")
    conn.commit()
    print(f"  Loaded {len(rows)} transit stops")


def main():
    print("Connecting to PostGIS...", flush=True)
    with psycopg.connect(DB) as conn:
        load_earthquakes(conn)
        load_schools(conn)
        load_crash(conn)
        load_bonds_tla(conn)
        load_bonds_region(conn)
        load_transit_stops(conn)

    print("\n=== ALL DONE ===")
    print("Tables created: earthquakes, schools, crashes, bonds_tla, bonds_region, transit_stops")
    print("\nStill need re-download from LINZ: property titles, building outlines (zips were 0 bytes)")


if __name__ == "__main__":
    main()
