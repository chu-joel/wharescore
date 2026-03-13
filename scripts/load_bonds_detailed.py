"""
Load detailed quarterly rental bond data into PostGIS.
Combines two files:
  - Detailed Quarterly Tenancy Q1 1993 - Q4 2019.csv (960K rows)
  - Detailed-Quarterly-Tenancy-Q1-2020-Q3-2025.csv (229K rows)
SA2-level granularity with median/geometric mean/quartile rents by dwelling type and bedrooms.
Source: MBIE Tenancy Services, CC BY 3.0 NZ.
"""

import csv
import sys
import time
import psycopg

DB = "postgresql://postgres:postgres@localhost:5432/wharescore"
BASE = "data/bonds"
FILES = [
    f"{BASE}/Detailed Quarterly Tenancy Q1 1993 - Q4 2019.csv",
    f"{BASE}/Detailed-Quarterly-Tenancy-Q1-2020-Q3-2025.csv",
]


def load_bonds_detailed(conn):
    print("\n=== DETAILED QUARTERLY BONDS (SA2) ===", flush=True)

    conn.execute("DROP TABLE IF EXISTS bonds_detailed CASCADE;")
    conn.execute("""
        CREATE TABLE bonds_detailed (
            time_frame DATE,
            location_id TEXT,
            dwelling_type TEXT,
            number_of_beds TEXT,
            total_bonds INTEGER,
            active_bonds INTEGER,
            closed_bonds INTEGER,
            median_rent NUMERIC,
            geometric_mean_rent NUMERIC,
            upper_quartile_rent NUMERIC,
            lower_quartile_rent NUMERIC,
            log_std_dev_weekly_rent NUMERIC
        );
    """)

    total_rows = 0
    for filepath in FILES:
        print(f"  Loading {filepath}...", flush=True)
        start = time.time()
        rows = []
        with open(filepath, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                def parse_num(v):
                    if v is None or v == "" or v == "NULL":
                        return None
                    return v

                rows.append((
                    row["TimeFrame"],
                    row["Location Id"] if row["Location Id"] != "NULL" else None,
                    row["Dwelling Type"],
                    row["Number Of Beds"],
                    parse_num(row["Total Bonds"]),
                    parse_num(row["Active Bonds"]),
                    parse_num(row["Closed Bonds"]),
                    parse_num(row["Median Rent"]),
                    parse_num(row["Geometric Mean Rent"]),
                    parse_num(row["Upper Quartile Rent"]),
                    parse_num(row["Lower Quartile Rent"]),
                    parse_num(row["Log Std Dev Weekly Rent"]),
                ))

                if len(rows) >= 10000:
                    _insert_batch(conn, rows)
                    total_rows += len(rows)
                    rows = []

        if rows:
            _insert_batch(conn, rows)
            total_rows += len(rows)

        conn.commit()
        elapsed = time.time() - start
        print(f"    {elapsed:.1f}s", flush=True)

    # Create indexes
    print("  Creating indexes...", flush=True)
    conn.execute("CREATE INDEX idx_bonds_det_location ON bonds_detailed(location_id);")
    conn.execute("CREATE INDEX idx_bonds_det_timeframe ON bonds_detailed(time_frame);")
    conn.execute("CREATE INDEX idx_bonds_det_dwelling ON bonds_detailed(dwelling_type);")
    conn.commit()

    # Verify
    count = conn.execute("SELECT count(*) FROM bonds_detailed").fetchone()[0]
    date_range = conn.execute(
        "SELECT min(time_frame), max(time_frame) FROM bonds_detailed"
    ).fetchone()
    locations = conn.execute(
        "SELECT count(DISTINCT location_id) FROM bonds_detailed WHERE location_id IS NOT NULL"
    ).fetchone()[0]
    print(f"\n  Loaded {count:,} rows ({date_range[0]} to {date_range[1]})")
    print(f"  {locations} unique SA2 locations")

    # Sample: Wellington CBD latest quarter
    sample = conn.execute("""
        SELECT time_frame, location_id, dwelling_type, number_of_beds,
               median_rent, geometric_mean_rent
        FROM bonds_detailed
        WHERE location_id = '241600'
          AND dwelling_type = 'ALL' AND number_of_beds = 'ALL'
        ORDER BY time_frame DESC LIMIT 1
    """).fetchone()
    if sample:
        print(f"  Sample (Wellington Central SA2 241600): {sample[0]} — median ${sample[4]}/wk, geo mean ${sample[5]}/wk")

    return count


def _insert_batch(conn, rows):
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO bonds_detailed
               (time_frame, location_id, dwelling_type, number_of_beds,
                total_bonds, active_bonds, closed_bonds,
                median_rent, geometric_mean_rent, upper_quartile_rent,
                lower_quartile_rent, log_std_dev_weekly_rent)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            rows,
        )


def main():
    start = time.time()
    with psycopg.connect(DB) as conn:
        count = load_bonds_detailed(conn)

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s — {count:,} records loaded into bonds_detailed")


if __name__ == "__main__":
    main()
