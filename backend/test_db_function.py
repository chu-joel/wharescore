#!/usr/bin/env python
"""Test if the database function exists and can be called."""
import psycopg
from psycopg.rows import dict_row

DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/wharescore"

try:
    print("Connecting to database...")
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    print("Connected!")

    cur = conn.cursor()

    print("\n1. Testing basic connection...")
    cur.execute("SELECT 1 AS test")
    result = cur.fetchone()
    print(f"   Result: {result}")

    print("\n2. Checking if get_property_report function exists...")
    cur.execute("""
        SELECT EXISTS(
            SELECT 1 FROM information_schema.routines
            WHERE routine_name = 'get_property_report'
        ) AS exists;
    """)
    result = cur.fetchone()
    print(f"   Function exists: {result['exists']}")

    if result['exists']:
        print("\n3. Trying to call get_property_report(1378995)...")
        try:
            cur.execute("SELECT get_property_report(%s) AS report", [1378995])
            row = cur.fetchone()
            if row and row['report']:
                print(f"   Got response! Type: {type(row['report'])}, Length: {len(str(row['report']))}")
                # Print first 200 chars of the JSON
                report_str = str(row['report'])[:200]
                print(f"   First 200 chars: {report_str}...")
            else:
                print(f"   Got NULL or empty response")
        except Exception as e:
            print(f"   ERROR calling function: {e}")

    cur.close()
    conn.close()
    print("\nSuccess!")

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
