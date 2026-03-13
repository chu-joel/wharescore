# WhareScore — New Device Setup Guide

**Last Updated:** 2026-03-13

Everything you need to get the project running on a fresh machine after cloning from GitHub.

---

## 1. Prerequisites (Install These First)

| Software | Version | Purpose |
|---|---|---|
| **Docker Desktop** | Latest | PostgreSQL+PostGIS, Redis, Martin, nginx |
| **Python** | 3.8+ | Backend (FastAPI) |
| **Node.js** | 18+ | Frontend (Next.js 15) |
| **Git** | Latest | Clone repo |

---

## 2. Clone & Install Dependencies

```bash
git clone <your-repo-url> propertyiq-poc
cd propertyiq-poc

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

---

## 3. Environment Files (Not in Git — Contain API Keys)

### `.env` (project root)

```env
# Database — connects to host PostgreSQL by default
DB_HOST=host.docker.internal

# API keys
MBIE_API_KEY=<your-mbie-key>
LINZ_API_KEY=<your-linz-key>
AZURE_OPENAI_ENDPOINT=<your-azure-openai-endpoint>
AZURE_OPENAI_API_KEY=<your-azure-openai-key>
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini

# Frontend
NEXT_PUBLIC_LINZ_API_KEY=<your-linz-key>

# Admin
ADMIN_PASSWORD_HASH=
```

### `backend/.env`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wharescore
REDIS_URL=redis://localhost:6379/0
MBIE_API_KEY=<your-mbie-key>
LINZ_API_KEY=<your-linz-key>
AZURE_OPENAI_ENDPOINT=<your-azure-openai-endpoint>
AZURE_OPENAI_API_KEY=<your-azure-openai-key>
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
ALLOWED_HOSTS=["localhost","127.0.0.1"]
ADMIN_PASSWORD_HASH=<bcrypt-hash>
ENVIRONMENT=development
```

Generate admin hash: `python -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"`

---

## 4. Database — Two Options

### Option A: Restore from pg_dump (Recommended — fastest)

If you created a backup before leaving the old device:

```bash
# Copy wharescore_backup.dump to new device, then:
docker exec -i <postgres-container> pg_restore -U postgres -d wharescore < wharescore_backup.dump
```

This restores all 45 tables, ~18.7M+ records, indexes, views, and functions in one step.

### Option B: Re-download & Load Everything

Follow the setup guide: `_bmad-output/brainstorming/poc-data-setup-guide.md`

1. Create database and enable extensions:
   ```bash
   psql -U postgres -f sql/01-create-database.sql
   ```

2. Create tables:
   ```bash
   psql -U postgres -d wharescore -f sql/02-create-tables.sql
   ```

3. Download and load all datasets (see table below)

4. Create indexes and views:
   ```bash
   psql -U postgres -d wharescore -f sql/03-create-indexes-views.sql
   psql -U postgres -d wharescore -f sql/05-views.sql
   psql -U postgres -d wharescore -f sql/06-materialized-views.sql
   psql -U postgres -d wharescore -f sql/07-report-function.sql
   psql -U postgres -d wharescore -f sql/08-toast-and-cleanup.sql
   psql -U postgres -d wharescore -f sql/09-application-tables.sql
   ```

---

## 5. Data Downloads (22 GB Total — Not in Git)

All data lives in `data/` which is gitignored. Re-download from government open data sources.

### Large Datasets (LINZ — 9.5 GB+)

| Dataset | Size | Source | Notes |
|---|---|---|---|
| NZ Addresses | 812 MB SQL | `data.linz.govt.nz` layer 53353 | `addresses_load.sql` |
| NZ Parcels | 4.2 GB SQL | `data.linz.govt.nz` layer 51571 | `parcels_load.sql` |
| Building Outlines | 1.6 GB SQL | `data.linz.govt.nz` layer 101290 | `building_outlines_load.sql` |
| NZ Titles | 2.2 GB SQL | `data.linz.govt.nz` layer 804 | `titles_load.sql` |
| Meshblocks | 175 MB SQL | `data.linz.govt.nz` | `meshblocks_load.sql` |
| LINZ properties | ~500 MB | `data.linz.govt.nz` | `data/linz-properties/` |

### Medium Datasets

| Dataset | Size | Source |
|---|---|---|
| Climate (NIWA) | 567 MB | NIWA |
| Crime (NZ Police) | 548 MB | `policedata.nz` |
| OSM extract | 375 MB | Overpass API / Geofabrik |
| Noise contours | 306 MB | WCC open data |
| DOC conservation | 297 MB | DOC |
| Crash (Waka Kotahi) | 249 MB | CAS open data |
| Flood zones | 211 MB | GWRC open data |
| NZDep | 160 MB | `ehinz.ac.nz` |
| Bonds (MBIE) | 82 MB | MBIE |

### Smaller Datasets (~2 GB combined)

| Dataset | Source |
|---|---|
| Schools + enrolment zones | `educationcounts.govt.nz` |
| Wind zones | GWRC open data |
| SA2 boundaries (2018) | Stats NZ |
| Tsunami zones | GWRC open data |
| Slope failure zones | GWRC `mapping.gw.govt.nz` MapServer layer 11 (under `GW/Emergencies_P`) |
| Liquefaction zones | GWRC open data |
| Coastal erosion/flood | GWRC open data |
| Active faults | GNS Science |
| Earthquake zones | NZSEE |
| EPB (earthquake-prone buildings) | WCC |
| Air quality | LAWA |
| Water quality | LAWA |
| Wildfire | FENZ |
| Contaminated sites | Regional councils |
| Resource consents | WCC |
| Heritage | Heritage NZ + WCC |
| Transit / public transport | Metlink GTFS |
| Cycling | WCC |
| Solar | NIWA |
| Zoning | WCC district plan |
| Transpower (powerlines) | Transpower |
| RBNZ housing data | RBNZ (`housingdata.xlsx`) |
| Infrastructure | Various |

Full download URLs and `ogr2ogr`/`psql` load commands are in:
`_bmad-output/brainstorming/poc-data-setup-guide.md`

---

## 6. Creating the pg_dump Backup (Run on Old Device)

```bash
# If running PostgreSQL in Docker:
docker exec <postgres-container> pg_dump -U postgres -Fc wharescore > wharescore_backup.dump

# If running PostgreSQL natively:
pg_dump -U postgres -Fc wharescore > wharescore_backup.dump
```

Expected size: ~2-4 GB compressed. Transfer via USB drive, cloud storage, or network share.

---

## 7. Running the Stack

### Development (local PostgreSQL + Docker services)

```bash
docker-compose -f docker-compose.dev.yml up -d   # Redis, Martin, nginx

cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

cd frontend
npm run dev   # port 3000
```

### Full Docker Compose

```bash
docker-compose up -d   # All services including API + frontend
```

---

## 8. Verify Everything Works

```bash
# Backend health
curl http://localhost:8000/health
# Expected: {"status":"ok","db":true,"redis":false}  (or redis:true if Redis running)

# Property report
curl http://localhost:8000/api/v1/property/1378995/report
# Expected: Full JSON with all sections

# Frontend
curl http://localhost:3000
# Expected: HTTP 200

# Martin tiles
curl http://localhost:3001/catalog
# Expected: JSON listing all tile layers
```

---

## 9. Key File References

| File | Purpose |
|---|---|
| `PROGRESS.md` | Session-by-session progress, current status, next steps |
| `IMPLEMENTATION-PLAN.md` | Build order, project structure, phase overview |
| `BACKEND-PLAN.md` | Backend architecture index + document map |
| `FRONTEND-PLAN.md` | Frontend phases 3-5 |
| `AZURE-HOSTING-PLAN.md` | Azure deployment (B2ms VM, Cloudflare, CI/CD) |
| `docs/DATABASE-SCHEMA.md` | All 42+ tables, columns, types, indexes |
| `docs/backend/02-*.md` to `11-*.md` | Detailed backend implementation docs |
| `_bmad-output/brainstorming/poc-data-setup-guide.md` | Full data download URLs + SQL commands |
| `Plan.md` | Architecture & UX design plan |

---

## 10. Deployed Instance

- **URL:** `https://wharescore.australiaeast.cloudapp.azure.com/`
- **VM:** `wharescore-vm` (B2ms, 20.5.86.126) in `rg-joel-test`
- **Details:** See `AZURE-HOSTING-PLAN.md`
