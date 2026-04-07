# Suburb Guide Generation Runbook

**Goal:** generate ~2,000 SEO landing pages (one per NZ SA2 suburb) using the local Qwen model via Ollama, write them to the `suburb_guide_pages` table, and leave them published so they appear at `/suburbs/{slug}` and in `sitemap.xml`.

This runbook is self-contained. Follow it top to bottom. It assumes nothing is installed.

---

## 0. What you're building

| Piece | Location |
|---|---|
| Database table | `suburb_guide_pages` (migration `backend/migrations/0041_suburb_guide_pages.sql`) |
| Generation script | `scripts/generate_suburb_guides.py` |
| Backend API | `GET /api/v1/suburbs/guide/{slug}`, `GET /api/v1/suburbs/guides` |
| Frontend route | `/suburbs/{slug}` (server-rendered) and `/suburbs` (index) |
| Sitemap | `frontend/src/app/sitemap.ts` (auto-includes guides) |

Content source of truth: the `DATA` block fed to Qwen. It is built from `sa2_boundaries`, `mv_sa2_comparisons`, `mv_ta_comparisons`, `mv_rental_market`, `mv_rental_trends`, `mv_crime_ta`, `area_profiles`. The model is told to invent nothing.

---

## 1. Prerequisites

| Thing | Check |
|---|---|
| Python 3.14 installed | `py -3.14 --version` |
| Postgres running locally on 5432 with the `wharescore` DB populated | `docker ps \| grep postgres` or `psql -h localhost -U postgres -d wharescore -c "SELECT COUNT(*) FROM sa2_boundaries;"` (should be ~2,200) |
| Backend API running locally (needed ONLY if you want to test the page render) | `curl http://localhost:8000/api/v1/suburbs/guides` should return JSON |
| Ollama installed | `ollama --version` |
| Qwen model pulled | `ollama list \| grep qwen` |
| Disk space: ~20 GB free | `df -h` |
| RAM: 16 GB+ (for qwen2.5:14b) or 8 GB+ (for qwen2.5:7b) | Task Manager |

---

## 2. One-time setup

### 2a. Install Python deps
```bash
py -3.14 -m pip install "psycopg[binary]" requests
```

### 2b. Install Ollama
Windows: download installer from https://ollama.com/download  
After install, Ollama runs as a service. Verify:
```bash
ollama --version
curl http://localhost:11434/api/tags
```

### 2c. Pull Qwen
Pick ONE based on your RAM:

```bash
ollama pull qwen3.5:9b
```

Verify it loads:
```bash
ollama run qwen3.5:9b "Reply with one word: ready"
```
You should see `ready` (or similar) within ~10 seconds.

### 2d. Apply the migration
The migration runs automatically when the backend starts. If the backend is already running, either restart it OR apply the migration directly:

```bash
docker exec app-postgres-1 psql -U postgres -d wharescore -f - < backend/migrations/0041_suburb_guide_pages.sql
```

Or, if postgres is a native process (not Docker):
```bash
psql -h localhost -U postgres -d wharescore -f backend/migrations/0041_suburb_guide_pages.sql
```

Verify:
```bash
psql -h localhost -U postgres -d wharescore -c "\d suburb_guide_pages"
```

---

## 3. Smoke test (5 minutes)

**Generate just 3 suburbs** to confirm everything works before committing to the full overnight run:

```bash
cd D:\Projects\Experiments\propertyiq-poc
py -3.14 scripts/generate_suburb_guides.py --limit 3 --publish
```

Expected output:
- `Ollama OK: ...`
- `Processing 3 suburbs`
- Per suburb: `GENERATING <name>` then `section: overview`, `section: housing_and_rent`, ..., `wrote /suburbs/<slug>  (N words)`
- `DONE — ok=3 skipped=0 failed=0`

Verify rows landed:
```bash
psql -h localhost -U postgres -d wharescore -c "SELECT slug, suburb_name, ta_name, word_count, status FROM suburb_guide_pages ORDER BY generated_at DESC LIMIT 3;"
```

Verify the API returns them:
```bash
curl http://localhost:8000/api/v1/suburbs/guides?limit=3
curl http://localhost:8000/api/v1/suburbs/guide/<slug-from-query-above>
```

View one in the browser (if frontend is running):
```
http://localhost:3000/suburbs/<slug>
```

If all three read naturally, contain real numbers, have no hallucinated facts, and no "vibrant/thriving/hidden gem" language, you are good to proceed.

---

## 4. Quality check the output

Before running the full batch, read 2-3 generated guides end to end. Look for:

| Check | How |
|---|---|
| All numbers appear in the DATA block | Open the DB row: `SELECT intro, sections FROM suburb_guide_pages WHERE slug='<slug>';` then search the DATA block (rerun the fetch in a Python REPL) |
| No invented street names, school names, parks | Read each paragraph; cross-check against the DATA block |
| No marketing clichés (`vibrant`, `thriving`, `hidden gem`, `booming`, `charming`) | `grep -iE "vibrant\|thriving\|hidden gem\|booming\|charming\|bustling" suburb_guides.log` — should be empty |
| Length: each section 100-200 words, total ~800-1,200 | `SELECT word_count FROM suburb_guide_pages ORDER BY generated_at DESC LIMIT 5;` |
| FAQ answers are grounded or say "Data not available" | Read the faqs JSONB |

If quality is off, tune `OLLAMA_OPTIONS.temperature` (lower = more literal) or strengthen the `SYSTEM_PREAMBLE` in `scripts/generate_suburb_guides.py`, then rerun with `--force --limit 3`.

---

## 5. Full overnight run

When smoke test passes:

```bash
cd D:\Projects\Experiments\propertyiq-poc
py -3.14 scripts/generate_suburb_guides.py --publish 2>&1 | tee -a suburb_guides.log
```

**Expected timing** on a home workstation (RTX 3060 or similar, CPU-only Ollama):
- 14B model: ~60-90 seconds per suburb × ~2,000 suburbs ≈ **35-50 hours** — run in chunks
- 7B model: ~20-30 seconds per suburb × ~2,000 suburbs ≈ **12-17 hours** — one overnight run

**Run in chunks by territorial authority** to make it fully unattended and resumable:
```bash
# Wellington region first (smallest, fastest feedback loop)
py -3.14 scripts/generate_suburb_guides.py --ta "Wellington City" --publish
py -3.14 scripts/generate_suburb_guides.py --ta "Lower Hutt City" --publish
py -3.14 scripts/generate_suburb_guides.py --ta "Porirua City" --publish
py -3.14 scripts/generate_suburb_guides.py --ta "Upper Hutt City" --publish
py -3.14 scripts/generate_suburb_guides.py --ta "Kapiti Coast District" --publish

# Then Auckland (biggest)
py -3.14 scripts/generate_suburb_guides.py --ta "Auckland" --publish

# Then everything else
py -3.14 scripts/generate_suburb_guides.py --publish
```

The script **skips suburbs whose data hash has not changed**, so re-running is safe and fast.

### If it crashes mid-run
Just re-run the same command. Already-generated suburbs will be skipped.

### If you want to regenerate
Add `--force` to ignore the data hash.

### If you want drafts (for review before publishing)
Omit `--publish`. Rows will have `status='draft'` and won't appear on the site or in the sitemap. Promote later:
```sql
UPDATE suburb_guide_pages SET status='published', published_at=now() WHERE status='draft';
```

---

## 6. Verify after the run

```bash
# Count by status
psql -h localhost -U postgres -d wharescore -c "SELECT status, COUNT(*) FROM suburb_guide_pages GROUP BY status;"

# Count by territorial authority
psql -h localhost -U postgres -d wharescore -c "SELECT ta_name, COUNT(*) FROM suburb_guide_pages WHERE status='published' GROUP BY ta_name ORDER BY 2 DESC LIMIT 20;"

# Average word count
psql -h localhost -U postgres -d wharescore -c "SELECT avg(word_count)::int, min(word_count), max(word_count) FROM suburb_guide_pages WHERE status='published';"

# Any that failed / are suspicious
psql -h localhost -U postgres -d wharescore -c "SELECT slug, word_count FROM suburb_guide_pages WHERE word_count < 400 OR word_count > 1800;"

# Marketing cliché scan
psql -h localhost -U postgres -d wharescore -c "SELECT slug FROM suburb_guide_pages WHERE intro ~* 'vibrant|thriving|hidden gem|booming|charming|bustling' OR sections::text ~* 'vibrant|thriving|hidden gem|booming|charming|bustling' LIMIT 20;"
```

Regenerate any that fail quality checks:
```bash
py -3.14 scripts/generate_suburb_guides.py --sa2 <code> --force --publish
```

---

## 7. Verify on the live site

Once pages are published and the frontend is running:

| Check | URL |
|---|---|
| Guide index | https://wharescore.co.nz/suburbs |
| Sample guide | https://wharescore.co.nz/suburbs/<slug> |
| Sitemap | https://wharescore.co.nz/sitemap.xml — should contain all `/suburbs/<slug>` URLs |

Submit the sitemap to Google Search Console:
1. Log into Google Search Console
2. Select the `wharescore.co.nz` property
3. Sitemaps → Add new sitemap → `sitemap.xml`
4. Click Submit

Google will start crawling. First indexing typically takes 1-7 days.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `Ollama check failed: Connection refused` | Start Ollama: `ollama serve` (runs in foreground) or restart the Ollama service |
| `Ollama attempt 1/3 failed: HTTPSConnectionPool ... Read timed out` | Your hardware is slow; reduce `OLLAMA_OPTIONS.num_predict` to 600, or switch to qwen2.5:7b-instruct |
| Model returns empty strings | Lower `num_ctx` to 4096, or switch model |
| `psycopg.OperationalError: connection refused` | Postgres isn't running; start Docker: `docker compose up -d postgres` |
| `meta JSON parse failed, using fallback` | Normal on a few rows — the fallback metadata is fine. If >20% of rows hit this, raise a stricter system prompt |
| All rows are `skipped` | Data hashes already match. Use `--force` to regenerate |
| 404 on `/suburbs/<slug>` even though DB row exists | The row has `status='draft'`. Either re-run with `--publish` or manually update to published |
| Redis is caching stale pages | `docker exec app-redis-1 redis-cli -a $REDIS_PASSWORD DEL "suburb_guide:<slug>"` |

---

## 9. Cost / performance tuning

| Lever | Effect |
|---|---|
| `MODEL = "qwen2.5:7b-instruct"` | 2-3× faster, slightly noisier output |
| `MODEL = "qwen2.5:32b-instruct"` | Higher quality, 3× slower, needs 24 GB+ RAM |
| `OLLAMA_OPTIONS.temperature` | 0.3 = more literal, 0.6 = more varied phrasing |
| `OLLAMA_OPTIONS.num_predict` | Max tokens per section. 600 = shorter, 900 = default, 1200 = longer |
| `SLEEP_BETWEEN_SUBURBS` | Raise if your CPU/GPU is overheating |
| Fewer sections | Edit `SECTIONS` in the script |

---

## 10. Ongoing maintenance

**Re-run quarterly** after refreshing `mv_rental_market`, `mv_rental_trends`, `mv_crime_ta`. The script's hash check will only regenerate suburbs whose underlying data actually changed:

```bash
py -3.14 scripts/generate_suburb_guides.py --publish
```

Logs go to `suburb_guides.log` in the repo root. Archive it after each run.

---

## 11. Rollback

If the output is bad and you want a clean slate:
```sql
-- Soft: hide all guides from the site
UPDATE suburb_guide_pages SET status='archived';

-- Hard: wipe everything
TRUNCATE TABLE suburb_guide_pages RESTART IDENTITY;
```

The Next.js pages will 404 when the DB row is gone. The sitemap will drop them on next rebuild.
