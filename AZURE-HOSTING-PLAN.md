# WhareScore — Azure Hosting Plan

**Created:** 2026-03-10
**Status:** Ready to execute

---

## Table of Contents

1. [Getting Free Azure Credits](#1-getting-free-azure-credits)
2. [Architecture Overview](#2-architecture-overview)
3. [Azure Resources](#3-azure-resources)
4. [Setup Steps](#4-setup-steps)
5. [Cost Breakdown](#5-cost-breakdown)
6. [Database Migration](#6-database-migration)
7. [Networking & DNS](#7-networking--dns)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [Monitoring & Alerts](#9-monitoring--alerts)
10. [Security Checklist](#10-security-checklist)
11. [Scale Path](#11-scale-path)

---

## 1. Getting Free Azure Credits

### Step 1: Microsoft for Startups (up to $5,000 — no application needed)

1. Go to [microsoft.com/startups](https://www.microsoft.com/en-us/startups)
2. Sign in with a **personal Microsoft Account** (Outlook/Hotmail/Live)
3. Describe WhareScore:
   - **Product:** SaaS property intelligence platform for NZ
   - **Stage:** Pre-launch / MVP
   - **Category:** PropTech / AI / Data Analytics
4. You get **$1,000 USD immediately** — no verification needed
5. Complete **business verification** (takes ~7 business days):
   - Provide business name (can be sole trader / individual)
   - Describe your software product
   - Confirm it's privately owned and early stage
6. After verification: unlock up to **$5,000 USD total**
7. Credits valid **90 days** (initial) → **180 days** (after verification)

**What you can use credits on:** All Azure services — VMs, managed databases, container apps, storage, networking, bandwidth.

### Step 2: Unlock Higher Tiers ($25K–$150K)

Once you're spending $100+/month on foundational Azure services, you become eligible for:
- **$25,000 tier** — usage-based unlock
- **$150,000 tier** — requires investor referral from Microsoft's partner network

For a POC, the $5,000 tier is more than enough (covers ~8-12 months of hosting).

### Step 3: Stack with Azure Free Account

If this is a **new Azure account**, you also get:
- **$200 credit** for the first 30 days
- **12 months free** on select services (750hrs/mo B1s VM, 5GB blob storage, 250GB SQL)
- **65+ always-free services** (Azure Functions 1M executions/mo, 5GB blob storage)

### Step 4: Additional Savings (Optional)

| Method | Savings | Notes |
|--------|---------|-------|
| **Visual Studio subscription** (if you have one) | $50-150/mo monthly credits | Dev/test only, no production SLA |
| **1-year Reserved Instance** | ~37% off VM pricing | Commit after POC is validated |
| **3-year Reserved Instance** | ~55% off VM pricing | Only if product has revenue |
| **Azure Spot VM** | 60-90% off | For dev/staging only (can be evicted) |
| **Azure Dev/Test pricing** | ~30% off | Requires VS subscription |

### Total Free Runway Estimate

| Source | Credits | Duration at ~$50/mo |
|--------|---------|-------------------|
| Startups instant | $1,000 | ~20 months... but 90-day expiry |
| Startups verified | $5,000 | ~100 months... but 180-day expiry |
| Free account | $200 | First 30 days only |
| **Realistic usage** | **$5,200** | **~6 months** (use credits before they expire) |

**Strategy:** Use the 90-day initial credits on the VM + setup. Once verified, the 180-day credits cover ~6 months. After that, switch to a reserved instance (~$30/mo).

---

## 2. Architecture Overview

Single VM running Docker Compose — same architecture as the existing plan, minimal complexity for a POC.

```
                    ┌─────────────────────────┐
                    │      Cloudflare CDN      │
                    │   (DNS + WAF + SSL +     │
                    │    tile/static cache)     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Azure VM (B2ms)       │
                    │    Ubuntu 24.04 LTS      │
                    │                          │
                    │  ┌──────────────────┐    │
                    │  │     Nginx        │    │
                    │  │  (reverse proxy) │    │
                    │  └──┬───┬───┬───┬──┘    │
                    │     │   │   │   │        │
                    │  ┌──▼┐ ┌▼──┐│  ┌▼──┐    │
                    │  │Web│ │API││  │Mar│    │
                    │  │:3k│ │:8k││  │tin│    │
                    │  └───┘ └───┘│  │:3k│    │
                    │             │  │ 8 │    │
                    │          ┌──▼┐ └─┬─┘    │
                    │          │Red│   │       │
                    │          │is │   │       │
                    │          │:6k│   │       │
                    │          └───┘   │       │
                    │       ┌─────────▼──┐    │
                    │       │  PostGIS    │    │
                    │       │  :5432      │    │
                    │       │  (data disk)│    │
                    │       └────────────┘    │
                    └─────────────────────────┘
```

**Why single VM:**
- Zero inter-service latency (all localhost)
- Full PostGIS tuning control (shared_buffers, work_mem, effective_cache_size)
- Simplest to deploy, debug, and maintain
- Cheapest option — one bill, one thing to manage
- Docker Compose = same setup locally and in production

---

## 3. Azure Resources

| Resource | SKU / Config | Purpose |
|----------|-------------|---------|
| **Resource Group** | `wharescore-rg` (Australia East) | Container for all resources |
| **VM** | Standard_B2ms (2 vCPU, 8GB RAM) | Runs all services via Docker Compose |
| **OS Disk** | 64GB Premium SSD (P6) | Ubuntu + Docker images |
| **Data Disk** | 128GB Premium SSD (P10) | PostgreSQL data (`/data/postgres`) |
| **Public IP** | Static Standard SKU | Stable IP for Cloudflare DNS |
| **NSG** | Network Security Group | Firewall rules |
| **VNet** | Default (optional) | Network isolation |

### VM Sizing Rationale

| Service | RAM Usage | CPU Usage |
|---------|-----------|-----------|
| PostGIS (shared_buffers=2GB) | ~2.5GB | Burst on queries |
| Martin tile server | ~512MB | Burst on tile render |
| FastAPI (Uvicorn, 4 workers) | ~512MB | Light |
| Redis | ~128MB | Minimal |
| Next.js (Node.js) | ~256MB | SSR bursts |
| Nginx | ~32MB | Minimal |
| OS + Docker overhead | ~1GB | Minimal |
| **Total** | **~5GB** | **Bursty** |

B2ms (8GB RAM) gives ~3GB headroom. B-series burstable is perfect — a POC idles most of the time, banking CPU credits for bursts.

**Upgrade path:** If you need more, B4ms (4 vCPU, 16GB) is a one-click resize with ~2min downtime.

---

## 4. Setup Steps

### 4A. Create Azure Resources

```bash
# Login
az login

# Create resource group in Australia East (Sydney — closest to NZ)
az group create --name wharescore-rg --location australiaeast

# Create VM
az vm create \
  --resource-group wharescore-rg \
  --name wharescore-vm \
  --image Canonical:ubuntu-24_04-lts:server:latest \
  --size Standard_B2ms \
  --admin-username wharescore \
  --generate-ssh-keys \
  --public-ip-sku Standard \
  --os-disk-size-gb 64 \
  --data-disk-sizes-gb 128 \
  --storage-sku Premium_LRS

# Open required ports
az vm open-port --resource-group wharescore-rg --name wharescore-vm --port 80 --priority 100
az vm open-port --resource-group wharescore-rg --name wharescore-vm --port 443 --priority 101

# Get public IP
az vm show --resource-group wharescore-rg --name wharescore-vm \
  --show-details --query publicIps -o tsv
```

### 4B. Configure the VM

```bash
# SSH into the VM
ssh wharescore@<PUBLIC_IP>

# Format and mount the data disk
sudo mkfs.ext4 /dev/sdc
sudo mkdir -p /data
sudo mount /dev/sdc /data
echo '/dev/sdc /data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab

# Create PostgreSQL data directory
sudo mkdir -p /data/postgres
sudo chown -R 999:999 /data/postgres  # postgres container UID

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt-get install docker-compose-plugin

# Verify
docker --version
docker compose version
```

### 4C. Deploy the Application

```bash
# Clone or copy project files
# Option A: git clone
git clone https://github.com/<your-repo>/wharescore.git /home/wharescore/app

# Option B: scp from local
scp -r ./docker-compose.yml ./.env ./nginx/ ./backend/ ./frontend/ \
  wharescore@<PUBLIC_IP>:/home/wharescore/app/

# Navigate to app
cd /home/wharescore/app

# Create .env with production values
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:<STRONG_PASSWORD>@postgres:5432/wharescore
REDIS_URL=redis://redis:6379
MBIE_API_KEY=<your_key>
LINZ_API_KEY=<your_key>
AZURE_OPENAI_ENDPOINT=<your_endpoint>
AZURE_OPENAI_API_KEY=<your_key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
ADMIN_PASSWORD_HASH=<bcrypt_hash>
ALLOWED_HOSTS=wharescore.co.nz,www.wharescore.co.nz
EOF

# Build and start
docker compose build
docker compose up -d

# Check all services are running
docker compose ps
docker compose logs --tail=20
```

### 4D. Restore the Database

```bash
# From your local machine, dump the database
pg_dump -U postgres -Fc -Z 9 wharescore > wharescore.dump

# Copy to Azure VM
scp wharescore.dump wharescore@<PUBLIC_IP>:/home/wharescore/

# SSH in and restore
ssh wharescore@<PUBLIC_IP>

# Copy dump into the postgres container
docker cp wharescore.dump wharescore-postgres-1:/tmp/

# Restore
docker exec -it wharescore-postgres-1 \
  pg_restore -U postgres -d wharescore --no-owner --no-privileges /tmp/wharescore.dump

# Verify
docker exec -it wharescore-postgres-1 \
  psql -U postgres -d wharescore -c "SELECT count(*) FROM nz_addresses;"
```

### 4E. PostGIS Tuning

Create `postgresql.conf` overrides for the 8GB RAM VM:

```bash
cat > /home/wharescore/app/postgres-custom.conf << 'EOF'
# Memory (8GB VM, ~2.5GB for Postgres)
shared_buffers = 2GB
effective_cache_size = 4GB
work_mem = 64MB
maintenance_work_mem = 512MB

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 2GB

# Planner
random_page_cost = 1.1        # SSD
effective_io_concurrency = 200  # SSD
default_statistics_target = 500

# Connections
max_connections = 50           # Low for POC

# Logging
log_min_duration_statement = 500  # Log slow queries > 500ms
EOF
```

Mount this in docker-compose.yml:
```yaml
postgres:
  volumes:
    - /data/postgres:/var/lib/postgresql/data
    - ./postgres-custom.conf:/etc/postgresql/conf.d/custom.conf
  command: postgres -c 'config_file=/etc/postgresql/conf.d/custom.conf'
```

---

## 5. Cost Breakdown

### During Free Credits ($5,000 Startups + $200 Free Account)

| Resource | Monthly Cost (USD) |
|----------|-------------------|
| VM (B2ms) | ~$48 |
| OS Disk (64GB P6) | ~$10 |
| Data Disk (128GB P10) | ~$20 |
| Static Public IP | ~$4 |
| Egress (~50GB/mo) | ~$4 |
| **Total** | **~$86/mo** |

**Free runway: ~6 months** ($5,200 ÷ $86 ≈ 60 months on paper, but credits expire in 180 days)

### After Credits Expire

| Scenario | Monthly Cost |
|----------|-------------|
| Pay-as-you-go | ~$86/mo |
| 1-year reserved VM | ~$65/mo (VM drops from $48 → $30) |
| 3-year reserved VM | ~$55/mo (VM drops from $48 → $22) |

### Comparison to Vultr Plan

| | Vultr Sydney | Azure Sydney |
|---|---|---|
| Specs | 4 vCPU, 8GB, 180GB NVMe | 2 vCPU, 8GB, 128GB SSD |
| Monthly | $48/mo | ~$86/mo (PAYG) / ~$65/mo (1yr RI) |
| Free credits | None | Up to $5,200 |
| Managed services path | None | Easy upgrade to managed PG, containers |
| Free runway | 0 months | ~6 months |

**Azure is more expensive monthly, but the free credits give you 6+ months to validate the product before paying anything.**

---

## 6. Database Migration

### Local → Azure Migration Steps

```bash
# 1. On local machine: create optimized dump
pg_dump -U postgres -Fc -Z 9 \
  --no-owner --no-privileges \
  wharescore > wharescore-$(date +%Y%m%d).dump

# Dump size estimate: ~2-3GB compressed (18.7M rows with geometries)

# 2. Upload to Azure VM (may take 30-60 min on home internet)
scp wharescore-20260310.dump wharescore@<IP>:/home/wharescore/

# 3. On Azure VM: restore into Docker PostgreSQL
docker cp wharescore-20260310.dump wharescore-postgres-1:/tmp/
docker exec wharescore-postgres-1 \
  pg_restore -U postgres -d wharescore \
  --no-owner --no-privileges --jobs=2 /tmp/wharescore-20260310.dump

# 4. Verify table counts
docker exec wharescore-postgres-1 psql -U postgres -d wharescore -c "
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC
LIMIT 20;
"

# 5. Verify spatial indexes
docker exec wharescore-postgres-1 psql -U postgres -d wharescore -c "
SELECT tablename, indexname
FROM pg_indexes
WHERE indexdef LIKE '%gist%'
ORDER BY tablename;
"

# 6. Run ANALYZE to update statistics
docker exec wharescore-postgres-1 psql -U postgres -d wharescore -c "ANALYZE;"

# 7. Test the report function
docker exec wharescore-postgres-1 psql -U postgres -d wharescore -c "
SELECT jsonb_pretty(get_property_report(1753062));
"
```

### Ongoing Backups

```bash
# Cron job for daily backups to Azure Blob Storage (cheap cold storage)
# Add to crontab on the VM:
0 3 * * * docker exec wharescore-postgres-1 \
  pg_dump -U postgres -Fc wharescore > /data/backups/wharescore-$(date +\%Y\%m\%d).dump \
  && az storage blob upload \
    --account-name wharescorebackups \
    --container-name db-backups \
    --file /data/backups/wharescore-$(date +\%Y\%m\%d).dump \
    --name wharescore-$(date +\%Y\%m\%d).dump \
  && find /data/backups -name "*.dump" -mtime +7 -delete
```

Cost: Azure Blob Cool tier = ~$0.01/GB/mo. A 3GB daily backup × 30 days = ~$0.90/mo.

---

## 7. Networking & DNS

### Cloudflare Setup (Free Tier)

1. **Register domains:** ✅ Done (2026-03-24, Regery)
   - `wharescore.co.nz` ($14.99 USD/yr)
   - `wharescore.nz` ($14.99 USD/yr — brand protection, 301 redirect)
   - `wharescore.com` ($10.99 USD/yr — brand protection, 301 redirect)

2. **Add to Cloudflare (free plan):**
   - Point nameservers to Cloudflare
   - Add DNS records:
     ```
     A     wharescore.co.nz     → <Azure VM IP>  (Proxied ☁️)
     A     www.wharescore.co.nz → <Azure VM IP>  (Proxied ☁️)
     CNAME wharescore.com       → wharescore.co.nz (Proxied ☁️)
     ```

3. **SSL:** Cloudflare handles SSL termination (Full Strict mode). No Certbot needed on the VM.

4. **Caching rules:**
   ```
   # Vector tiles: cache 7 days
   *.pbf  → Cache-Control: public, max-age=604800

   # Static assets: cache 30 days
   /_next/static/*  → Cache-Control: public, max-age=2592000

   # API responses: no cache (dynamic)
   /api/*  → Cache-Control: no-store
   ```

5. **WAF rules (already planned in BACKEND-PLAN.md):**
   - Rate limiting: 100 req/min per IP on `/api/*`
   - Block known bad bots
   - Challenge suspicious traffic
   - Geo-restrict to NZ/AU if desired (reduces abuse)

### Azure NSG (Network Security Group) Rules

| Priority | Direction | Port | Source | Action |
|----------|-----------|------|--------|--------|
| 100 | Inbound | 80 | Cloudflare IPs only | Allow |
| 101 | Inbound | 443 | Cloudflare IPs only | Allow |
| 200 | Inbound | 22 | Your home IP only | Allow |
| 65000 | Inbound | * | * | Deny |

**Important:** Only allow HTTP/HTTPS from Cloudflare's IP ranges — this prevents direct-to-IP access bypassing the WAF.

Cloudflare IP ranges: https://www.cloudflare.com/ips/

```bash
# Script to update NSG with Cloudflare IPs
CLOUDFLARE_IPS=$(curl -s https://www.cloudflare.com/ips-v4 | tr '\n' ' ')
az network nsg rule update \
  --resource-group wharescore-rg \
  --nsg-name wharescore-vmNSG \
  --name AllowHTTP \
  --source-address-prefixes $CLOUDFLARE_IPS
```

---

## 8. CI/CD Pipeline

### Simple Approach: GitHub Actions → SSH Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.AZURE_VM_IP }}
          username: wharescore
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/wharescore/app
            git pull origin main
            docker compose build --parallel
            docker compose up -d --remove-orphans
            docker compose ps
            # Health check
            sleep 10
            curl -sf http://localhost:8000/health || exit 1
            echo "Deploy successful"
```

### Secrets to Configure in GitHub

| Secret | Value |
|--------|-------|
| `AZURE_VM_IP` | VM's public IP |
| `SSH_PRIVATE_KEY` | Private key for `wharescore` user |

---

## 9. Monitoring & Alerts

### Free/Cheap Monitoring Stack

| Tool | Purpose | Cost |
|------|---------|------|
| **Azure Monitor (basic)** | VM CPU, RAM, disk metrics | Free with VM |
| **Cloudflare Analytics** | Request volume, cache hit ratio, threats blocked | Free |
| **Docker healthchecks** | Service-level health | Free |
| **UptimeRobot** | External uptime monitoring + alerts | Free (50 monitors) |

### UptimeRobot Monitors (Free)

1. `https://wharescore.co.nz/` — homepage loads (5 min interval)
2. `https://wharescore.co.nz/api/v1/health` — API health (5 min interval)

Alerts via email or Telegram.

### Azure VM Alerts (Free)

```bash
# Alert if CPU > 90% for 5 minutes
az monitor metrics alert create \
  --resource-group wharescore-rg \
  --name high-cpu \
  --scopes /subscriptions/<sub>/resourceGroups/wharescore-rg/providers/Microsoft.Compute/virtualMachines/wharescore-vm \
  --condition "avg Percentage CPU > 90" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action-group <email-action-group>

# Alert if disk > 85%
az monitor metrics alert create \
  --resource-group wharescore-rg \
  --name high-disk \
  --scopes /subscriptions/<sub>/resourceGroups/wharescore-rg/providers/Microsoft.Compute/virtualMachines/wharescore-vm \
  --condition "avg Data Disk Used Percentage > 85" \
  --window-size 15m
```

---

## 10. Security Checklist

### VM Hardening

- [ ] Disable password SSH login (key-only)
- [ ] Change SSH port from 22 to non-standard (e.g., 2222)
- [ ] Enable `fail2ban` for SSH brute-force protection
- [ ] Enable automatic security updates (`unattended-upgrades`)
- [ ] NSG: only allow Cloudflare IPs on 80/443, your IP on SSH
- [ ] No public access to PostgreSQL (5432), Redis (6379), or Martin (3000) ports

### Application Security (already implemented)

- [ ] CORS restricted to `wharescore.co.nz`
- [ ] Rate limiting per endpoint (slowapi + Redis)
- [ ] Bot detection middleware
- [ ] Security headers (CSP, HSTS, X-Frame-Options)
- [ ] Input validation on all endpoints
- [ ] Admin portal behind bcrypt auth
- [ ] No secrets in Docker images (use .env)

### Database Security

- [ ] Strong PostgreSQL password (not `postgres:postgres`)
- [ ] PostgreSQL only listening on Docker network (not host 0.0.0.0)
- [ ] Regular backups to Azure Blob Storage
- [ ] No public access to database port

---

## 11. Scale Path

When/if WhareScore grows beyond what a single B2ms can handle:

### Stage 1: Vertical Scale (minutes of downtime)

Resize VM: B2ms → B4ms → D4s_v5. One Azure CLI command, ~2 min downtime.

### Stage 2: Separate Database (when DB is the bottleneck)

Move PostGIS to **Azure Database for PostgreSQL Flexible Server** (General Purpose D2ds_v5, ~$100/mo). Benefits: managed backups, auto-patching, read replicas, HA. Keep app services on VM.

### Stage 3: Container Apps (when you want zero-ops app layer)

Move FastAPI + Next.js + Nginx to **Azure Container Apps** (consumption plan). Keep PostGIS + Martin on VM or managed DB. Auto-scaling, zero-downtime deploys.

### Stage 4: Full Managed (if you have revenue)

- Azure Database for PostgreSQL (HA, read replicas)
- Azure Container Apps (auto-scale)
- Azure Cache for Redis
- Azure Front Door (CDN + WAF, replaces Cloudflare)
- Azure Key Vault (secrets management)

Monthly cost at Stage 4: ~$300-500/mo. Only worth it with paying customers.

---

## Quick Start Checklist

1. [ ] Sign up at [microsoft.com/startups](https://www.microsoft.com/en-us/startups) → get $1,000 credits
2. [ ] Complete business verification → unlock $5,000 credits
3. [x] Register `wharescore.co.nz` + `wharescore.nz` + `wharescore.com` domains (Regery, $42.49 USD, 2026-03-24)
4. [ ] Add domains to Cloudflare (free plan)
5. [ ] Create Azure resource group + B2ms VM (Section 4A)
6. [ ] Configure VM: mount data disk, install Docker (Section 4B)
7. [ ] Deploy Docker Compose (Section 4C)
8. [ ] Restore database dump (Section 4D)
9. [ ] Apply PostGIS tuning (Section 4E)
10. [ ] Point Cloudflare DNS to Azure VM IP (Section 7)
11. [ ] Configure NSG to only allow Cloudflare IPs (Section 7)
12. [ ] Set up UptimeRobot monitors (Section 9)
13. [ ] Set up GitHub Actions deploy (Section 8)
14. [ ] Run end-to-end test: `curl https://wharescore.co.nz/api/v1/health`
15. [ ] Test: `curl https://wharescore.co.nz/api/v1/property/1753062/report`
