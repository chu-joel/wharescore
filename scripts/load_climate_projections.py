"""Load MfE climate projections Parquet into PostGIS."""
import pyarrow.parquet as pq
import psycopg
import io
import csv

PARQUET_FILE = r"D:\Projects\Experiments\propertyiq-poc\data\climate\climate-projections-mmm.parquet"
DB_DSN = "host=localhost dbname=wharescore user=postgres password=postgres"

# Read parquet
print("Reading Parquet file...")
tbl = pq.read_table(PARQUET_FILE)
df = tbl.to_pandas()
print(f"  {len(df):,} rows, {len(df.columns)} columns")

# Drop all _units columns (constant strings, waste of space)
units_cols = [c for c in df.columns if c.endswith("_units")]
print(f"  Dropping {len(units_cols)} units columns")
df = df.drop(columns=units_cols)

# Keep only value columns we care about for property analysis
# Dimension cols: model, base_period, future_period, scenario, season, vcsn_agent
# Value cols: everything else (the actual climate data)
print(f"  Final: {len(df.columns)} columns")

# Create table in PostGIS
dim_cols = ["model", "base_period", "future_period", "scenario", "season", "vcsn_agent"]
value_cols = [c for c in df.columns if c not in dim_cols]

col_defs = []
for c in dim_cols:
    if c == "vcsn_agent":
        col_defs.append(f'"{c}" INTEGER')
    else:
        col_defs.append(f'"{c}" TEXT')
for c in value_cols:
    col_defs.append(f'"{c}" REAL')

create_sql = f"""
DROP TABLE IF EXISTS climate_projections;
CREATE TABLE climate_projections (
    id SERIAL PRIMARY KEY,
    {', '.join(col_defs)}
);
"""

print("Creating table...")
with psycopg.connect(DB_DSN) as conn:
    conn.execute(create_sql)
    conn.commit()

# Load via COPY for speed
print("Loading data via COPY (this may take a minute)...")
columns = dim_cols + value_cols

with psycopg.connect(DB_DSN) as conn:
    with conn.cursor() as cur:
        with cur.copy(f"COPY climate_projections ({','.join(f'\"'+c+'\"' for c in columns)}) FROM STDIN WITH (FORMAT CSV)") as copy:
            buf = io.StringIO()
            writer = csv.writer(buf)
            batch_size = 50000
            for i in range(0, len(df), batch_size):
                chunk = df.iloc[i:i+batch_size]
                for row in chunk.itertuples(index=False):
                    writer.writerow(row)
                copy.write(buf.getvalue())
                buf.seek(0)
                buf.truncate(0)
                print(f"  {min(i+batch_size, len(df)):,} / {len(df):,} rows")
    conn.commit()

# Create indexes
print("Creating indexes...")
with psycopg.connect(DB_DSN) as conn:
    conn.execute("CREATE INDEX idx_climate_proj_vcsn ON climate_projections (vcsn_agent);")
    conn.execute("CREATE INDEX idx_climate_proj_scenario ON climate_projections (scenario, future_period, season);")
    conn.execute("ANALYZE climate_projections;")
    conn.commit()

# Verify
with psycopg.connect(DB_DSN) as conn:
    count = conn.execute("SELECT count(*) FROM climate_projections").fetchone()[0]
    print(f"\nDone! {count:,} rows loaded into climate_projections")
    print("Join to climate_grid via: climate_projections.vcsn_agent = climate_grid.agent_no")
