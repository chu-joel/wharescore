# WhareScore — Deployment & Operations Guide

**Created:** 2026-03-11
**Last Updated:** 2026-03-13

---

## Table of Contents

1. [Server Details](#1-server-details)
2. [Architecture](#2-architecture)
3. [SSH Access](#3-ssh-access)
4. [Deploying New Changes](#4-deploying-new-changes)
4a. [Database Migrations](#4a-database-migrations)
5. [Database Operations](#5-database-operations)
6. [SSL Certificate](#6-ssl-certificate)
7. [Nginx Configuration](#7-nginx-configuration)
8. [Docker Compose Reference](#8-docker-compose-reference)
9. [Monitoring & Troubleshooting](#9-monitoring--troubleshooting)
10. [Azure NSG / Firewall](#10-azure-nsg--firewall)
11. [Initial Setup (done)](#11-initial-setup-done)

---

## 1. Server Details

| Item | Value |
|------|-------|
| **URL** | https://wharescore.australiaeast.cloudapp.azure.com |
| **Public IP** | 20.5.86.126 |
| **VM** | Azure B2ms (2 vCPU, 8 GB RAM, 64 GB OS disk) |
| **Region** | Australia East (Sydney) |
| **OS** | Ubuntu 24.04 LTS |
| **User** | `wharescore` |
| **App directory** | `/home/wharescore/app/` |
| **DB data** | `/data/postgres/` (mounted disk) |
| **SSL certs** | `/etc/letsencrypt/live/wharescore.australiaeast.cloudapp.azure.com/` |
| **Resource group** | `rg-joel-test` |
| **NSG** | `wharescore-vmNSG` (attached to NIC + subnet) |

---

## 2. Architecture

```
Internet
  │
  ├─ :80  ──→ nginx ──→ 301 redirect to HTTPS
  ├─ :443 ──→ nginx (SSL termination)
  │             ├─ /api/*     → api:8000    (FastAPI + Uvicorn, 4 workers)
  │             ├─ /health    → api:8000
  │             ├─ /tiles/*   → martin:3000 (vector tiles, cached 7d)
  │             ├─ /_next/*   → web:3000    (static assets, cached 1yr)
  │             └─ /*         → web:3000    (Next.js frontend)
  │
  └─ :22 ───→ SSH

Docker internal network:
  postgres:5432  ─── PostGIS 17-3.5 (18.7M rows, 67 tables)
  redis:6379     ─── Redis 7 (128MB LRU cache)
  martin:3000    ─── Martin v0.15.0 (vector tile server)
  api:8000       ─── FastAPI backend (Python 3.13)
  web:3000       ─── Next.js frontend (Node 22)
  nginx:80/443   ─── Reverse proxy + SSL + rate limiting
```

---

## 3. SSH Access

```bash
ssh wharescore@20.5.86.126
```

SSH key is on local machine. All Docker commands run as the `wharescore` user (in docker group).

---

## 4. Deploying New Changes

Deploys are **automatic via GitHub Actions** — push to `main` and the CI/CD pipeline SSHs into the VM, pulls the latest code, and rebuilds Docker containers.

### Automatic deploy (CI/CD)

Every push to `main` triggers `.github/workflows/deploy.yml`:

1. SSHs into the Azure VM
2. `git fetch origin main && git reset --hard origin/main`
3. `docker compose up -d --build --remove-orphans`
4. Polls `/health` for up to 90 seconds
5. Fails the workflow (with API logs) if the health check doesn't pass

**GitHub Secrets required:**

| Secret | Value |
|---|---|
| `AZURE_VM_IP` | `20.5.86.126` |
| `SSH_PRIVATE_KEY` | SSH private key for `wharescore` user |

### Manual deploy (fallback)

If CI/CD is broken or you need to deploy from the VM directly:

```bash
ssh wharescore@20.5.86.126
cd /home/wharescore/app
git fetch origin main && git reset --hard origin/main
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --remove-orphans
curl -sf http://localhost:8000/health
```

### Rollback

```bash
# Option A: revert the last commit and push (triggers CI/CD)
git revert HEAD
git push origin main

# Option B: reset to a known-good commit and push
git reset --hard <commit-sha>
git push origin main --force

# Option C: manual rollback on the VM
ssh wharescore@20.5.86.126
cd /home/wharescore/app
git reset --hard <commit-sha>
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --remove-orphans
```

**Database rollbacks:** There is no automatic down-migration. Write a new forward migration to undo schema changes.

### Verify deployment

```bash
curl -s https://wharescore.australiaeast.cloudapp.azure.com/health
# Expected: {"status":"ok","db":true,"redis":true}
```

### Nginx config changes

Nginx config is volume-mounted — no Docker rebuild needed:

```bash
# After pushing config changes via git, reload nginx on the VM
ssh wharescore@20.5.86.126 "docker exec app-nginx-1 nginx -t && docker exec app-nginx-1 nginx -s reload"
```

### Environment variable changes

```bash
# Edit .env.prod on the server (not in git)
ssh wharescore@20.5.86.126 "nano /home/wharescore/app/.env.prod"

# Restart affected services
ssh wharescore@20.5.86.126 "cd /home/wharescore/app && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"
```

### Clear Redis cache (if needed)

```bash
ssh wharescore@20.5.86.126 "docker exec app-redis-1 redis-cli FLUSHALL"
```

---

## 4a. Database Migrations

Schema changes are managed by a lightweight SQL migration runner (`backend/app/migrate.py`). Migrations run automatically at app startup, before the connection pool is created.

### How it works

1. On startup, each Uvicorn worker tries to acquire a PostgreSQL advisory lock
2. The first worker to get the lock runs pending migrations; the other 3 skip
3. Each `.sql` file in `backend/migrations/` runs in its own transaction
4. Applied versions are tracked in the `schema_migrations` table
5. If a migration fails, the transaction rolls back and the worker crashes (correct — don't serve traffic on broken schema)

### Creating a new migration

```bash
# Naming convention: NNNN_description.sql
# Example:
touch backend/migrations/0001_add_saved_properties.sql
```

Write standard SQL in the file. Each file runs inside a single transaction — no need for explicit `BEGIN`/`COMMIT`.

### Checking migration status

```bash
# See which migrations have been applied
ssh wharescore@20.5.86.126 "docker exec app-postgres-1 psql -U postgres -d wharescore -c 'SELECT * FROM schema_migrations ORDER BY version;'"
```

### Migration tips

- **One concern per file** — don't mix unrelated schema changes
- **Idempotent when possible** — use `IF NOT EXISTS`, `IF EXISTS` where applicable
- **No down migrations** — to undo a change, write a new forward migration
- **Test locally first** — `docker compose up --build api` will run the migration on startup

---

## 5. Database Operations

### Dump local database

```bash
export PATH="$PATH:/e/Programs/postgresql/bin"
PGPASSWORD=postgres pg_dump -U postgres -d wharescore -Fc -Z 6 -f /d/Projects/Experiments/wharescore-dump.dump
```

Produces ~4.1 GB compressed file from 11 GB database. Takes ~6 minutes.

### Transfer dump to server

```bash
scp /d/Projects/Experiments/wharescore-dump.dump wharescore@20.5.86.126:/home/wharescore/wharescore-dump.dump
```

Takes ~28 minutes on ~20 Mbps upload.

### Restore dump to Docker PostgreSQL

```bash
ssh wharescore@20.5.86.126

# Copy dump into postgres container
docker cp /home/wharescore/wharescore-dump.dump app-postgres-1:/tmp/wharescore-dump.dump

# Restore (4 parallel jobs, ignore ownership)
docker exec app-postgres-1 pg_restore -U postgres -d wharescore \
  --no-owner --no-privileges --clean --if-exists -j 4 \
  /tmp/wharescore-dump.dump

# Clean up dump file inside container
docker exec app-postgres-1 rm /tmp/wharescore-dump.dump
```

The `--clean --if-exists` flags drop existing objects before recreating. Safe to re-run.
Expected warning: "cannot drop extension postgis" — harmless (already exists).

### Run SQL on production database

```bash
ssh wharescore@20.5.86.126 "docker exec app-postgres-1 psql -U postgres -d wharescore -c 'SELECT count(*) FROM addresses;'"
```

### Connect to psql interactively

```bash
ssh wharescore@20.5.86.126
docker exec -it app-postgres-1 psql -U postgres -d wharescore
```

### Refresh materialized views

```bash
ssh wharescore@20.5.86.126 "docker exec app-postgres-1 psql -U postgres -d wharescore -c '
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_crime_density;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_crime_ta;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rental_market;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rental_trends;
'"
```

---

## 6. SSL Certificate

**Issued by:** Let's Encrypt
**Domain:** `wharescore.australiaeast.cloudapp.azure.com`
**Expires:** 2026-06-09
**Auto-renewal:** Certbot scheduled task (installed on host, runs automatically)

### Manual renewal (if needed)

```bash
ssh wharescore@20.5.86.126

# Stop nginx to free port 80
cd /home/wharescore/app
docker compose -f docker-compose.prod.yml --env-file .env.prod stop nginx

# Renew
sudo certbot renew

# Restart nginx
docker compose -f docker-compose.prod.yml --env-file .env.prod start nginx
```

### Check certificate expiry

```bash
ssh wharescore@20.5.86.126 "sudo certbot certificates"
```

### Note on auto-renewal

Certbot's auto-renewal timer runs on the host, but Docker's nginx holds port 80. For auto-renewal to work, add a pre/post hook:

```bash
sudo bash -c 'cat > /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh << "EOF"
#!/bin/bash
cd /home/wharescore/app && docker compose -f docker-compose.prod.yml --env-file .env.prod stop nginx
EOF'

sudo bash -c 'cat > /etc/letsencrypt/renewal-hooks/post/start-nginx.sh << "EOF"
#!/bin/bash
cd /home/wharescore/app && docker compose -f docker-compose.prod.yml --env-file .env.prod start nginx
EOF'

sudo chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/post/start-nginx.sh
```

---

## 7. Nginx Configuration

Config file: `/home/wharescore/app/nginx/nginx.prod.conf` (volume-mounted, no rebuild needed)

**Key routing:**

| Path | Upstream | Rate Limit | Cache |
|------|----------|------------|-------|
| `/api/*` | api:8000 | 30 req/s + burst 20 | No cache |
| `/health` | api:8000 | None | No |
| `/tiles/*` | martin:3000 | 60 req/s + burst 40 | 7 days |
| `/_next/static/*` | web:3000 | None | 1 year (immutable) |
| `/*` | web:3000 | None | No |

**Security headers applied:** HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.

HTTP (port 80) redirects 301 to HTTPS (port 443).

---

## 8. Docker Compose Reference

All commands must be run from `/home/wharescore/app/`:

```bash
# Shorthand for all commands below
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

# Start all services
$COMPOSE up -d

# Stop all services
$COMPOSE down

# Rebuild and restart (after code changes)
$COMPOSE up -d --build --remove-orphans

# Rebuild a single service
$COMPOSE up -d --build api    # or: web, nginx, martin, postgres, redis

# View logs
$COMPOSE logs -f              # all services
$COMPOSE logs -f api          # single service
$COMPOSE logs --tail 50 api   # last 50 lines

# Check status
$COMPOSE ps

# Restart a service (no rebuild)
$COMPOSE restart api

# Shell into a container
docker exec -it app-api-1 bash
docker exec -it app-postgres-1 bash
docker exec -it app-nginx-1 sh    # alpine uses sh
```

**Container names:** `app-postgres-1`, `app-redis-1`, `app-martin-1`, `app-api-1`, `app-web-1`, `app-nginx-1`

---

## 9. Monitoring & Troubleshooting

### Health check

```bash
curl -s https://wharescore.australiaeast.cloudapp.azure.com/health
# Expected: {"status":"ok","db":true,"redis":true}
```

### Test key endpoints

```bash
# Search
curl -s "https://wharescore.australiaeast.cloudapp.azure.com/api/v1/search/address?q=162+Cuba+Street"

# Property report
curl -s "https://wharescore.australiaeast.cloudapp.azure.com/api/v1/property/1753062/report" | python3 -m json.tool | head -20

# Nearby schools
curl -s "https://wharescore.australiaeast.cloudapp.azure.com/api/v1/nearby/1753062/schools"
```

### Check disk space

```bash
ssh wharescore@20.5.86.126 "df -h /home/wharescore /data"
```

### Check memory usage

```bash
ssh wharescore@20.5.86.126 "free -h && echo '---' && docker stats --no-stream"
```

### View container resource usage

```bash
ssh wharescore@20.5.86.126 "docker stats --no-stream"
```

### Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| 502 Bad Gateway | Backend container crashed | `docker compose logs api`, then `up -d --build api` |
| 504 Gateway Timeout | Slow DB query (>30s) | Check `docker compose logs api` for slow queries |
| Connection refused | Containers not running | `docker compose ps`, then `up -d` |
| SSL cert expired | Auto-renewal failed | See [§6 Manual renewal](#manual-renewal-if-needed) |
| Disk full | Dump files / Docker images | `docker system prune`, delete old dumps |
| DB not connecting | Wrong password in .env.prod | Check `.env.prod` matches what postgres was initialized with |
| Bot detection 429 on all requests | All traffic shows same Docker internal IP | Ensure `bot_detection.py` uses `X-Forwarded-For`/`X-Real-IP` headers |
| Bot detection 429 after fix | Old counter still in Redis | `docker exec app-redis-1 redis-cli KEYS 'scrape_detect:*'` then DEL them |
| Migration fails on startup | Bad SQL in migration file | Check API logs: `docker compose logs --tail 50 api`. Fix the SQL, push again. The failed migration was rolled back. |
| PDF status flips 200/404 | In-memory job store + 4 Uvicorn workers | Known issue — job created in worker 1, polled in worker 2. Fix: move job store to Redis |

### Known issues

1. **PDF export unreliable** — The PDF job store is in-memory (`pdf_jobs.py`) but Uvicorn runs 4 workers. Job created in one worker is invisible to others. Fix: move to Redis-backed job store. Workaround: run with `--workers 1` (reduces throughput).

### Clean up Docker resources

```bash
ssh wharescore@20.5.86.126 "docker system prune -f && docker image prune -f"
```

---

## 10. Azure NSG / Firewall

**NSG name:** `wharescore-vmNSG`
**Attached to:** NIC (`wharescore-vmVMNic`) + Subnet (`wharescore-vmSubnet`)

**Inbound rules:**

| Priority | Name | Port | Protocol | Action |
|----------|------|------|----------|--------|
| 100 | open-port-80 | 80,443 | Any | Allow |
| 1000 | default-allow-ssh | 22 | TCP | Allow |

**Important:** Port 443 was added to the existing port-80 rule (priority 100) because a separate rule at priority 300 wasn't working. The NSG must be attached to **both** the NIC and the subnet.

To add new ports: Azure Portal → Network security groups → `wharescore-vmNSG` → Inbound security rules → Add rule.

---

## 11. Initial Setup (done)

This section documents what was done on 2026-03-11 for reference.

### VM setup

1. Created Azure B2ms VM (Ubuntu 24.04) in Australia East
2. Created `wharescore` user, added to docker group
3. Installed Docker Engine + Docker Compose
4. Created `/data/postgres` directory for DB data
5. Uploaded app files (backend, frontend, nginx config, docker-compose, .env.prod)

### Database migration

1. Local: `pg_dump -Fc -Z 6` → 4.1 GB compressed (from 11 GB, ~6 min)
2. SCP to server → ~28 min
3. `docker cp` into postgres container
4. `pg_restore --no-owner --no-privileges --clean --if-exists -j 4` → success
5. Verified: 67 tables, 18.7M+ rows (addresses: 2.4M, parcels: 4.3M, building_outlines: 3.2M, bonds_detailed: 1.2M, crime: 1.2M, crashes: 904K)

### SSL setup

1. Installed certbot on host
2. Stopped Docker stack (to free port 80)
3. `certbot certonly --standalone -d wharescore.australiaeast.cloudapp.azure.com`
4. Updated nginx config with SSL server block + HTTP→HTTPS redirect
5. Added `/etc/letsencrypt` volume mount to nginx container
6. Added port 443 to Docker compose + Azure NSG

### Azure NSG fix

Port 443 was initially unreachable despite having a dedicated Allow rule at priority 300. Fixed by adding `443` to the existing `open-port-80` rule at priority 100 (destination ports: `80,443`).

### Git-based deploy transition (session 34)

Replaced manual SCP deploys with git-based deploys via GitHub Actions. One-time VM transition steps:

```bash
# 1. Backup .env.prod
cp /home/wharescore/app/.env.prod /home/wharescore/.env.prod.backup

# 2. Stop services
cd /home/wharescore/app && docker compose -f docker-compose.prod.yml --env-file .env.prod down

# 3. Move old app, clone repo
cd /home/wharescore && mv app app.old
git clone https://github.com/chu-joel/wharescore.git app

# 4. Restore .env.prod
cp /home/wharescore/.env.prod.backup /home/wharescore/app/.env.prod

# 5. Start services
cd /home/wharescore/app
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 6. Verify, then cleanup
curl -sf http://localhost:8000/health
rm -rf /home/wharescore/app.old /home/wharescore/.env.prod.backup
```

Volume mounts (`/data/postgres`, `/etc/letsencrypt`) use absolute paths — unaffected by the transition.

### Post-deploy fixes (session 33)

1. **Bot detection 429 blocking all users** — Fixed: added `_get_client_ip()` that reads `X-Forwarded-For`/`X-Real-IP` headers.

2. **PDF export broken (multi-worker)** — PDF job store is in-memory but Uvicorn runs 4 workers. **TODO: migrate to Redis-backed job store.**

3. **CORS_ORIGINS missing HTTPS** — Added `https://wharescore.australiaeast.cloudapp.azure.com` to CORS_ORIGINS.

---

## File Layout on Server

```
/home/wharescore/
├── app/
│   ├── docker-compose.prod.yml
│   ├── .env.prod                    # secrets — DO NOT commit
│   ├── martin.prod.yaml
│   ├── .github/workflows/
│   │   └── deploy.yml               # CI/CD — auto-deploy on push to main
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── app/                     # FastAPI application
│   │   └── migrations/              # SQL migration files (NNNN_desc.sql)
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── ...                      # Next.js application
│   ├── nginx/
│   │   └── nginx.prod.conf
│   └── postgres/
│       └── postgresql.conf          # Tuned for B2ms (2GB shared_buffers)
└── wharescore-dump.dump             # DB dump (can delete after restore)

/data/postgres/                      # PostgreSQL data directory
/etc/letsencrypt/                    # SSL certificates (auto-managed)
```
