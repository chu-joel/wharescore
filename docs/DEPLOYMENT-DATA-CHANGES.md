# Deploying Database & Data Changes

## The Problem

WhareScore has two kinds of database changes with very different deployment characteristics:

| Type | Example | Size | Source | Can run in migration? |
|------|---------|------|--------|----------------------|
| **Schema** | CREATE TABLE, CREATE INDEX, ALTER | Tiny | SQL file in repo | Yes |
| **Function** | CREATE OR REPLACE FUNCTION | Small | SQL file in repo | Yes |
| **Reference data** | Wellington hazard polygons, GTFS stops | 10K–100K rows | External APIs | No — network calls, 5–30 min runtime |
| **Computed data** | Transit travel times, materialized views | Derived | Local computation on existing data | Maybe — if fast enough |

The migration system (`backend/app/migrate.py`) only handles the first two. Reference data loading requires calling external APIs (GWRC, WCC, Metlink) which can't run inside a database transaction. This creates a manual deployment gap.

---

## Current Approach (What Works Today)

### Step 1: Schema + Function Changes (Automatic)

Create migration files in `backend/migrations/`. They run automatically when the API container starts.

```
backend/migrations/
  0001_wellington_tables.sql      # CREATE TABLE IF NOT EXISTS ...
  0002_update_report_function.sql # CREATE OR REPLACE FUNCTION get_property_report(...)
```

**Rules:**
- Files run in lexicographic order, once each (tracked in `schema_migrations` table)
- Each file runs in a transaction — failure rolls back cleanly
- Use `IF NOT EXISTS` / `IF EXISTS` for safety
- `CREATE OR REPLACE FUNCTION` is idempotent by nature

**Deployment:** Push to `main` → GitHub Actions SSHs to VM → `docker compose up -d --build` → API starts → migrations run.

### Step 2: Data Loading (Manual SSH)

After deploy, SSH into the VM and run data loading scripts. Two options:

#### Option A: Run scripts on the VM (re-fetch from APIs)

```bash
ssh wharescore@<VM_IP>
cd /home/wharescore/app

# Scripts aren't in the Docker image — run from the host git checkout
# Need Python + psycopg on the host, or exec into the API container

# Install psycopg if not on host
pip3 install psycopg

# Run against the Docker PostgreSQL (exposed on localhost via docker network)
# First, temporarily expose postgres port or use docker exec
docker exec -i app-postgres-1 psql -U postgres -d wharescore -c "SELECT 1"  # verify

# Option: exec into API container which has psycopg
docker exec -it app-api-1 python scripts/load_wellington_data.py  # FAILS: scripts/ not in image
```

**Problem:** The Dockerfile only copies `app/` and `migrations/`, not `scripts/`. You'd need to either:
1. Add `COPY scripts/ scripts/` to the Dockerfile, or
2. Run scripts from the host with the right DB connection string, or
3. Use `docker cp` to copy scripts into the running container

#### Option B: pg_dump from local (recommended for now)

This is faster and more reliable — avoids re-fetching from external APIs on the VM.

```bash
# LOCAL: dump only the new data tables
# (Windows — run from Git Bash or adjust path)
"C:/Program Files/PostgreSQL/17/bin/pg_dump" -U postgres -Fc \
  -t mbie_epb -t gwrc_earthquake_hazard -t gwrc_ground_shaking \
  -t gwrc_liquefaction -t gwrc_slope_failure -t wcc_fault_zones \
  -t wcc_flood_hazard -t wcc_tsunami_hazard -t wcc_solar_radiation \
  -t metlink_stops -t transit_travel_times -t transit_stop_frequency \
  wharescore > wellington-data.dump

# Upload to VM
scp wellington-data.dump wharescore@<VM_IP>:/tmp/

# Restore on VM (--data-only because tables already created by migration)
ssh wharescore@<VM_IP> "
  docker cp /tmp/wellington-data.dump app-postgres-1:/tmp/
  docker exec app-postgres-1 pg_restore -U postgres -d wharescore \
    --no-owner --data-only --disable-triggers /tmp/wellington-data.dump
  docker exec app-postgres-1 psql -U postgres -d wharescore -c 'ANALYZE;'
  docker exec app-redis-1 redis-cli FLUSHDB
  rm /tmp/wellington-data.dump
"
```

### Step 3: Verify

```bash
ssh wharescore@<VM_IP> "
  docker exec app-postgres-1 psql -U postgres -d wharescore -c \"
    SELECT 'gwrc_earthquake_hazard' as t, COUNT(*) FROM gwrc_earthquake_hazard
    UNION ALL SELECT 'metlink_stops', COUNT(*) FROM metlink_stops
    UNION ALL SELECT 'transit_travel_times', COUNT(*) FROM transit_travel_times
    UNION ALL SELECT 'wcc_solar_radiation', COUNT(*) FROM wcc_solar_radiation;
  \"
"

# Test report output
curl -s https://wharescore.co.nz/api/v1/property/1753062/report | \
  python3 -c "import sys,json; r=json.load(sys.stdin); h=r['hazards']; print(f'EQ grade: {h.get(\"earthquake_hazard_grade\")}'); print(f'Solar: {h.get(\"solar_mean_kwh\")}')"
```

### Step 4: Clear Cache

```bash
ssh wharescore@<VM_IP> "docker exec app-redis-1 redis-cli FLUSHDB"
```

Reports are cached for 24h in Redis. Flush after data changes to ensure new fields appear immediately.

---

## Problems With the Current Approach

1. **Manual SSH step required** — data loading doesn't happen automatically on deploy
2. **Scripts not in Docker image** — can't `docker exec` them in the API container
3. **pg_dump is a one-shot** — fine for initial load but awkward for incremental updates (e.g. weekly GTFS refresh)
4. **No idempotency guarantee** — running `load_wellington_data.py` twice inserts duplicates unless tables are truncated first (the script does `DELETE FROM` but that's fragile)
5. **External API dependency** — GWRC, WCC, Metlink APIs could be down during deploy
6. **Connection string hardcoded** — scripts use `host=localhost` which doesn't work inside Docker
7. **No data versioning** — no way to know what data version is deployed

---

## Web Admin Approach (Implemented)

The admin panel at `/admin/data-loader` now has "Load" buttons for each data source. After deploying code + migrations:

1. Go to `https://wharescore.co.nz/admin/data-loader`
2. Log in with the admin password
3. Click "Load" on each data source — they run as background jobs
4. Watch progress in real-time (polls every 2 seconds)
5. Report cache is auto-flushed after each load

**Data sources available:**
| Source | Tables | API | Approx time |
|--------|--------|-----|-------------|
| GWRC Earthquake Hazards | 4 tables (eq hazard, ground shaking, liquefaction, slope failure) | GWRC ArcGIS | ~2 min |
| WCC District Plan Hazards | 3 tables (faults, flood, tsunami) | WCC ArcGIS | ~1 min |
| WCC Solar Radiation | 1 table (building solar potential) | ArcGIS Online | ~1 min |
| Metlink GTFS + Travel Times | 3 tables (stops, travel times, frequency) | Metlink GTFS zip | ~3 min |

**How it works:**
- `POST /api/v1/admin/data-sources/{key}/load` starts a background thread
- Loader fetches from external APIs, truncates target tables, inserts fresh data
- Progress stored in Redis, polled by frontend
- `data_versions` table tracks last load time per source
- Only one load can run at a time (prevents double-loading)
- Report Redis cache is flushed after completion

**For initial deploy with existing local data (faster):** Use the pg_dump approach below, then use the web loader for subsequent refreshes.

---

## Better Approach (Recommended)

### 1. Add a `manage.py` CLI to the backend

Create a management command system inside the backend Docker image. This gives you a single entry point for all maintenance tasks.

```
backend/
  app/
    manage.py          # CLI: python -m app.manage <command>
    commands/
      load_data.py     # Load external data sources
      refresh_gtfs.py  # Refresh Metlink GTFS + recompute travel times
      refresh_cache.py # Flush Redis, warm common reports
```

**Why:** The API container already has psycopg, the right `DATABASE_URL` env var, and network access to PostgreSQL. Adding management commands there means no separate Python environment to maintain.

**Usage:**
```bash
# After deploy, from anywhere:
docker exec app-api-1 python -m app.manage load_wellington_data
docker exec app-api-1 python -m app.manage refresh_gtfs
```

### 2. Make data loading environment-aware and idempotent

```python
# Use DATABASE_URL from environment (same as the API uses)
import os
DB_URL = os.environ.get("DATABASE_URL", "host=localhost dbname=wharescore user=postgres password=postgres")
```

Each loader should:
- `TRUNCATE table RESTART IDENTITY` before inserting (clean slate, idempotent)
- Log row counts before/after
- Wrap in a single transaction (all-or-nothing)
- Accept `--dry-run` flag

### 3. Add scripts to Docker image

In `backend/Dockerfile`:
```dockerfile
COPY scripts/ scripts/       # <-- add this line
```

This makes all data loading scripts available inside the container. No more `docker cp` or host-level Python.

### 4. Add a `data_versions` tracking table

```sql
CREATE TABLE IF NOT EXISTS data_versions (
    source TEXT PRIMARY KEY,          -- 'gwrc_earthquake_hazard', 'metlink_gtfs', etc.
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    row_count INT,
    source_url TEXT,
    checksum TEXT                     -- hash of source data for change detection
);
```

Each loader updates this after success. The `/health` endpoint can report data freshness. The frontend can show "Data updated: 3 days ago" per source.

### 5. Scheduled GTFS refresh via cron

GTFS timetables change every few months. Add a cron job on the VM:

```bash
# /etc/cron.d/wharescore-gtfs
0 3 * * 0  wharescore  docker exec app-api-1 python -m app.manage refresh_gtfs >> /var/log/wharescore-gtfs.log 2>&1
```

This runs weekly on Sunday at 3am — downloads fresh GTFS, recomputes travel times, logs the result.

### 6. Two-phase deploy for data-heavy changes

For changes that include both schema and data:

```
Phase 1 (automatic): git push → migrations create empty tables → API starts
Phase 2 (triggered): GitHub Actions runs data loading as a post-deploy step
```

In `.github/workflows/deploy.yml`:
```yaml
- name: Load data (if new tables created)
  run: |
    ssh wharescore@${{ secrets.AZURE_VM_IP }} "
      docker exec app-api-1 python -m app.manage load_wellington_data --if-empty
    "
```

The `--if-empty` flag skips loading if tables already have data. This makes the deploy idempotent.

### 7. Seed data in migrations (for small, static datasets)

For small datasets that don't change (e.g. the 12 key destinations for travel times), embed them directly in migrations:

```sql
-- 0003_seed_key_destinations.sql
INSERT INTO key_destinations (name, type, lat, lng) VALUES
  ('Wellington CBD', 'transport', -41.2788, 174.7762),
  ('Airport', 'transport', -41.3272, 174.8050),
  ('Hospital', 'health', -41.3045, 174.7780)
ON CONFLICT (name) DO NOTHING;
```

This runs automatically, no manual step needed.

---

## Migration File Naming Convention

```
NNNN_description.sql

0001_wellington_tables.sql          # Schema: new tables
0002_update_report_function.sql     # Function: updated report query
0003_add_data_versions_table.sql    # Schema: data versioning
0004_seed_key_destinations.sql      # Seed: small static data
```

- Prefix with 4-digit sequence number
- Use underscores, lowercase
- One concern per file
- Never edit an already-deployed migration — write a new one

---

## Quick Reference: This Wellington Deploy

### Automatic (push to main):
- `0001_wellington_tables.sql` — 12 empty tables created
- `0002_update_report_function.sql` — report function updated with new LATERAL joins

### Manual (after deploy):
```bash
# From local machine with pg installed:
pg_dump -U postgres -Fc \
  -t mbie_epb -t gwrc_earthquake_hazard -t gwrc_ground_shaking \
  -t gwrc_liquefaction -t gwrc_slope_failure -t wcc_fault_zones \
  -t wcc_flood_hazard -t wcc_tsunami_hazard -t wcc_solar_radiation \
  -t metlink_stops -t transit_travel_times -t transit_stop_frequency \
  wharescore > wellington-data.dump

scp wellington-data.dump wharescore@<VM_IP>:/tmp/

ssh wharescore@<VM_IP> "
  docker cp /tmp/wellington-data.dump app-postgres-1:/tmp/
  docker exec app-postgres-1 pg_restore -U postgres -d wharescore \
    --no-owner --data-only --disable-triggers /tmp/wellington-data.dump
  docker exec app-postgres-1 psql -U postgres -d wharescore -c 'ANALYZE;'
  docker exec app-redis-1 redis-cli FLUSHDB
"
```

### Verify:
```bash
curl -s https://wharescore.co.nz/api/v1/property/1753062/report | python3 -m json.tool | grep earthquake_hazard_grade
```
