# WhareScore — VM Migration Guide

How to move the entire WhareScore stack from one Azure tenancy/VM to another.

**Last verified:** 2026-03-28 against production VM at 20.5.86.126

---

## What You're Moving

| Component | Size | Location on current VM |
|---|---|---|
| PostgreSQL database (wharescore) | **49 GB** | `/data/postgres/` (Docker volume) |
| Application code | 73 MB | `/home/wharescore/app/` (git clone) |
| Valhalla routing tiles (NZ OSM + elevation) | 2.8 GB | `/data/valhalla/` |
| Docker images (7 images) | ~2.8 GB | Built on VM |
| Let's Encrypt SSL cert | Small | `/etc/letsencrypt/live/wharescore.australiaeast.cloudapp.azure.com/` |
| Host nginx config | Small | `/etc/nginx/sites-enabled/wharescore` |
| Environment secrets (.env.prod) | 1.5 KB | `/home/wharescore/app/.env.prod` |
| Docker volumes (orphaned) | ~90 volumes | Mostly orphaned, can be pruned |

**Total data to transfer: ~52 GB** (mostly the database)

---

## External Services (need re-pointing)

| Service | What to do | Where to configure |
|---|---|---|
| **GitHub repo** (chu-joel/wharescore) | Transfer repo to new account OR add new account as collaborator | GitHub Settings → Transfer |
| **GitHub Actions secrets** | Re-create `AZURE_VM_IP` and `SSH_PRIVATE_KEY` for new VM | GitHub → Settings → Secrets → Actions |
| **Google OAuth** (Auth.js) | Update authorized redirect URIs to new domain | Google Cloud Console → Credentials |
| **Stripe** | Update webhook endpoint URL to new domain | Stripe Dashboard → Webhooks |
| **Azure OpenAI** | Create new resource in new tenancy or share key | Azure Portal |
| **MBIE API key** | Same key works, no change needed | .env.prod |
| **LINZ API key** | Same key works, no change needed | .env.prod |
| **Metroinfo API key** | Same key works, no change needed | .env.prod |
| **Google Maps key** | Update HTTP referrer restrictions for new domain | Google Cloud Console → Credentials |
| **DNS** (if using custom domain) | Update A record to new VM IP | Domain registrar |

---

## Step-by-Step Migration

### Phase 1: Provision New VM

1. **Create Azure VM** in new tenancy:
   - **Size:** B2ms (2 vCPU, 8 GB RAM) — minimum for this stack
   - **OS:** Ubuntu 24.04 LTS
   - **Region:** Australia East (or preferred)
   - **Auth:** SSH key
   - **Public IP:** Static
   - **DNS label:** set a label (e.g., `wharescore`) to get `wharescore.<region>.cloudapp.azure.com`

2. **Attach data disk:**
   - 128 GB Premium SSD (P10) — for PostgreSQL + Valhalla
   - Mount at `/data`:
     ```bash
     sudo mkfs.ext4 /dev/sda    # or whatever the disk device is
     sudo mkdir /data
     sudo mount /dev/sda /data
     echo '/dev/sda /data ext4 defaults 0 2' | sudo tee -a /etc/fstab
     sudo mkdir -p /data/postgres /data/valhalla /data/backups
     ```

3. **Open Azure NSG ports:**
   - 22 (SSH)
   - 80 (HTTP — for Let's Encrypt challenge + redirect)
   - 443 (HTTPS)

4. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

5. **Install host nginx + certbot:**
   ```bash
   sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
   ```

6. **Create app user (if not using default):**
   ```bash
   sudo adduser wharescore
   sudo usermod -aG docker wharescore
   ```

### Phase 2: Export Database from Old VM

SSH into the **old** VM:

```bash
ssh wharescore@20.5.86.126

# Dump the full database (compressed, ~5-8 GB output)
docker exec app-postgres-1 pg_dump -U postgres -d wharescore \
  --format=custom --compress=6 \
  -f /var/lib/postgresql/data/wharescore_full.dump

# Copy dump out of container
docker cp app-postgres-1:/var/lib/postgresql/data/wharescore_full.dump /data/backups/

# Check dump size
ls -lh /data/backups/wharescore_full.dump
```

### Phase 3: Transfer Files to New VM

From your **local machine** (or old VM):

```bash
NEW_VM=wharescore@<NEW_VM_IP>

# 1. Transfer database dump (largest — do this first)
scp wharescore@20.5.86.126:/data/backups/wharescore_full.dump /tmp/
scp /tmp/wharescore_full.dump $NEW_VM:/data/backups/

# OR direct VM-to-VM (faster if both in same Azure region):
ssh wharescore@20.5.86.126 "scp /data/backups/wharescore_full.dump $NEW_VM:/data/backups/"

# 2. Transfer Valhalla tiles (2.8 GB — saves ~2hr rebuild)
ssh wharescore@20.5.86.126 "tar czf - /data/valhalla/" | ssh $NEW_VM "tar xzf - -C /"

# 3. Transfer env file (contains all secrets)
scp wharescore@20.5.86.126:~/app/.env.prod /tmp/.env.prod
scp /tmp/.env.prod $NEW_VM:~/app/.env.prod
rm /tmp/.env.prod  # Don't leave secrets on local disk
```

### Phase 4: Set Up Application on New VM

SSH into the **new** VM:

```bash
ssh $NEW_VM

# 1. Clone the repo
cd ~
git clone https://github.com/chu-joel/wharescore.git app
cd app

# 2. Symlink env file
ln -sf .env.prod .env

# 3. Update .env.prod:
#    - CORS_ORIGINS → new domain
#    - ALLOWED_HOSTS → new domain
#    - FRONTEND_URL → new domain URL
#    - AUTH_URL → new domain URL (for Google OAuth callback)
nano .env.prod

# 4. Start PostgreSQL first
docker compose -f docker-compose.prod.yml up -d postgres
# Wait for healthy:
docker compose -f docker-compose.prod.yml ps postgres

# 5. Restore database
docker cp /data/backups/wharescore_full.dump app-postgres-1:/tmp/
docker exec app-postgres-1 pg_restore -U postgres -d wharescore \
  --clean --if-exists --no-owner --no-privileges \
  /tmp/wharescore_full.dump

# 6. Start remaining services
docker compose -f docker-compose.prod.yml up -d redis martin
docker compose -f docker-compose.prod.yml up -d api web

# 7. Run migrations (in case dump was from before latest migrations)
docker exec app-api-1 python -c "
from app.db import init_db; from app.config import settings
import asyncio; asyncio.run(init_db(settings.DATABASE_URL))
"

# 8. Verify API works
curl -s http://localhost:8000/health
curl -s http://localhost:3000 | head -5
```

### Phase 5: Set Up SSL & Host Nginx

```bash
# 1. Copy the nginx site config
sudo tee /etc/nginx/sites-available/wharescore << 'EOF'
server {
    listen 80;
    server_name YOUR_NEW_DOMAIN;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name YOUR_NEW_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/YOUR_NEW_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_NEW_DOMAIN/privkey.pem;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/vnd.mapbox-vector-tile;
    gzip_min_length 256;

    location /api/auth/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    location = /health {
        proxy_pass http://127.0.0.1:8000;
    }

    location /tiles/ {
        rewrite ^/tiles/(.*?)(?:\.pbf)?$ /$1 break;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header Cache-Control "public, max-age=3600";
    }

    location = /tiles/catalog {
        rewrite ^/tiles/catalog$ /catalog break;
        proxy_pass http://127.0.0.1:3001;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /_next/webpack-hmr {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# 2. Get SSL cert BEFORE enabling the HTTPS server block
#    First, create a temp HTTP-only config for the certbot challenge:
sudo tee /etc/nginx/sites-available/wharescore-temp << 'EOF'
server {
    listen 80;
    server_name YOUR_NEW_DOMAIN;
    location / { return 200 'ok'; }
}
EOF

sudo ln -sf /etc/nginx/sites-available/wharescore-temp /etc/nginx/sites-enabled/wharescore
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 3. Get the cert
sudo certbot --nginx -d YOUR_NEW_DOMAIN --non-interactive --agree-tos -m your@email.com

# 4. Now enable the full config
sudo ln -sf /etc/nginx/sites-available/wharescore /etc/nginx/sites-enabled/wharescore
sudo nginx -t && sudo systemctl restart nginx

# 5. Enable auto-renewal
sudo systemctl enable certbot.timer
```

### Phase 6: Update External Services

| Service | Action | URL |
|---|---|---|
| **GitHub Actions** | Update `AZURE_VM_IP` secret to new VM IP. Generate new SSH key pair, add public key to new VM's `~/.ssh/authorized_keys`, set `SSH_PRIVATE_KEY` secret | github.com/chu-joel/wharescore/settings/secrets/actions |
| **Google OAuth** | Add `https://NEW_DOMAIN/api/auth/callback/google` as authorized redirect URI | console.cloud.google.com → Credentials → OAuth Client |
| **Stripe webhook** | Add new webhook endpoint `https://NEW_DOMAIN/api/v1/webhooks/stripe`, select `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`. Update `STRIPE_WEBHOOK_SECRET` in `.env.prod` | dashboard.stripe.com → Webhooks |
| **Google Maps** | Add new domain to HTTP referrer restrictions | console.cloud.google.com → Credentials → API Key |
| **DNS** (if custom domain) | Update A record to new VM's public IP | Your domain registrar |

### Phase 7: Verify Everything Works

```bash
# On new VM:
# 1. Health check
curl -s https://YOUR_NEW_DOMAIN/health

# 2. Test a report
curl -s https://YOUR_NEW_DOMAIN/api/v1/property/1335346/report | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('address',{}).get('full_address','FAILED'))"

# 3. Test search
curl -s "https://YOUR_NEW_DOMAIN/api/v1/search/address?q=driftwood+mangawhai"

# 4. Test tiles
curl -s -o /dev/null -w '%{http_code}' https://YOUR_NEW_DOMAIN/tiles/catalog

# 5. Test Google sign-in (in browser)
# Open https://YOUR_NEW_DOMAIN and click Sign In

# 6. Test Stripe (in browser)
# Open a property, click Upgrade, verify checkout redirects to Stripe

# 7. Push a test commit to verify CI/CD
git commit --allow-empty -m "test deploy to new VM"
git push origin main
# Watch GitHub Actions for green deploy
```

### Phase 8: Decommission Old VM

Only after verifying everything works on the new VM:

```bash
# 1. Stop services on old VM
ssh wharescore@20.5.86.126 "cd ~/app && docker compose down"

# 2. Take a final backup (just in case)
ssh wharescore@20.5.86.126 "docker exec app-postgres-1 pg_dump -U postgres -d wharescore -Fc -f /var/lib/postgresql/data/final_backup.dump"

# 3. Delete the old VM in Azure Portal
# Portal → Virtual Machines → wharescore-vm → Delete
# Also delete: NIC, Public IP, NSG, OS disk, Data disk (if no longer needed)
```

---

## Inventory Checklist

Use this to verify nothing was missed:

- [ ] PostgreSQL database restored (138 tables, ~5.3M rows)
- [ ] All Docker services running (postgres, redis, api, web, martin, valhalla)
- [ ] Host nginx serving HTTPS with valid cert
- [ ] `.env.prod` has all 24 environment variables set
- [ ] `docker compose -f docker-compose.prod.yml ps` shows all healthy
- [ ] Reports load (test 3+ addresses)
- [ ] Search works
- [ ] Map tiles load
- [ ] Google sign-in works
- [ ] Stripe checkout works (test mode)
- [ ] GitHub Actions deploy works (push a commit)
- [ ] Certbot auto-renewal enabled (`sudo certbot renew --dry-run`)
- [ ] Valhalla walking isochrones work (test terrain section)

---

## Environment Variables Reference

All 24 variables needed in `.env.prod`:

| Variable | Source | Notes |
|---|---|---|
| `POSTGRES_USER` | You set it | `postgres` |
| `POSTGRES_PASSWORD` | You set it | Strong random password |
| `REDIS_PASSWORD` | You set it | Strong random password |
| `MBIE_API_KEY` | developer.mbie.govt.nz | Tenancy bond data |
| `LINZ_API_KEY` | data.linz.govt.nz | Address/parcel data |
| `NEXT_PUBLIC_LINZ_API_KEY` | Same as LINZ_API_KEY | Frontend basemap tiles |
| `AZURE_OPENAI_ENDPOINT` | Azure Portal | For AI summaries |
| `AZURE_OPENAI_API_KEY` | Azure Portal | For AI summaries |
| `AZURE_OPENAI_DEPLOYMENT` | Azure Portal | e.g. `gpt-5-mini` |
| `ADMIN_PASSWORD_HASH` | `python -c "import bcrypt; print(bcrypt.hashpw(b'yourpass', bcrypt.gensalt()).decode())"` | Admin panel auth |
| `AUTH_SECRET` | `openssl rand -base64 32` | NextAuth.js session encryption |
| `AUTH_GOOGLE_ID` | Google Cloud Console | OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google Cloud Console | OAuth client secret |
| `STRIPE_SECRET_KEY` | Stripe Dashboard | `sk_live_xxx` or `sk_test_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks | `whsec_xxx` |
| `STRIPE_PRICE_SINGLE` | Stripe Dashboard → Products | Quick Report price ID |
| `STRIPE_PRICE_PACK3` | Stripe Dashboard → Products | Full Report price ID |
| `STRIPE_PRICE_PRO` | Stripe Dashboard → Products | Pro monthly price ID |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard | `pk_live_xxx` or `pk_test_xxx` |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Cloud Console | Maps JavaScript API |
| `METROINFO_API_KEY` | apidevelopers.metroinfo.co.nz | Christchurch GTFS |
| `CORS_ORIGINS` | You set it | `["https://your-domain"]` |
| `ALLOWED_HOSTS` | You set it | `["your-domain"]` |
| `FRONTEND_URL` | You set it | `https://your-domain` |

---

## Custom Domain Setup

Three domains all redirect to the canonical `wharescore.co.nz`. Domains registered at [Regery](https://regery.com).

| Domain | Role |
|---|---|
| `wharescore.co.nz` | **Canonical** — all traffic ends up here |
| `wharescore.nz` | Redirects to .co.nz |
| `wharescore.com` | Redirects to .co.nz |

### 1. DNS Records at Regery

Log into [regery.com](https://regery.com) → My Domains → manage each domain.

**wharescore.co.nz:**

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `<VM_PUBLIC_IP>` | 300 (increase to 3600 once working) |
| A | `www` | `<VM_PUBLIC_IP>` | 300 |

**wharescore.nz:**

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `<VM_PUBLIC_IP>` | 300 |
| A | `www` | `<VM_PUBLIC_IP>` | 300 |

**wharescore.com:**

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `<VM_PUBLIC_IP>` | 300 |
| A | `www` | `<VM_PUBLIC_IP>` | 300 |

All 6 A records point to the same VM IP. Nginx handles the redirects server-side.

### 2. SSL Cert (one cert for all 6 variants)

```bash
# On the VM — DNS must be pointing here first
sudo certbot --nginx \
  -d wharescore.co.nz \
  -d www.wharescore.co.nz \
  -d wharescore.nz \
  -d www.wharescore.nz \
  -d wharescore.com \
  -d www.wharescore.com \
  --non-interactive --agree-tos -m your@email.com

# Enable auto-renewal
sudo systemctl enable certbot.timer
```

### 3. Nginx Config

```bash
sudo tee /etc/nginx/sites-available/wharescore << 'NGINX'
# Redirect all HTTP to HTTPS (canonical)
server {
    listen 80;
    server_name wharescore.co.nz www.wharescore.co.nz
                wharescore.nz www.wharescore.nz
                wharescore.com www.wharescore.com;
    return 301 https://wharescore.co.nz$request_uri;
}

# Redirect .nz, .com, and www variants to canonical
server {
    listen 443 ssl;
    server_name www.wharescore.co.nz
                wharescore.nz www.wharescore.nz
                wharescore.com www.wharescore.com;

    ssl_certificate /etc/letsencrypt/live/wharescore.co.nz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wharescore.co.nz/privkey.pem;

    return 301 https://wharescore.co.nz$request_uri;
}

# Canonical — wharescore.co.nz
server {
    listen 443 ssl;
    server_name wharescore.co.nz;

    ssl_certificate /etc/letsencrypt/live/wharescore.co.nz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wharescore.co.nz/privkey.pem;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/vnd.mapbox-vector-tile;
    gzip_min_length 256;

    # Auth.js (Next.js handles these)
    location /api/auth/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    location = /health {
        proxy_pass http://127.0.0.1:8000;
    }

    # Vector tiles (Martin)
    location /tiles/ {
        rewrite ^/tiles/(.*?)(?:\.pbf)?$ /$1 break;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header Cache-Control "public, max-age=3600";
    }

    location = /tiles/catalog {
        rewrite ^/tiles/catalog$ /catalog break;
        proxy_pass http://127.0.0.1:3001;
    }

    # Frontend (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /_next/webpack-hmr {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/wharescore /etc/nginx/sites-enabled/wharescore
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

### 4. Update .env.prod

```bash
CORS_ORIGINS=["https://wharescore.co.nz"]
ALLOWED_HOSTS=["wharescore.co.nz"]
FRONTEND_URL=https://wharescore.co.nz
```

Then restart:
```bash
cd ~/app
docker compose -f docker-compose.prod.yml up -d api web
sudo systemctl restart nginx
```

### 5. Update external services for new domain

| Service | What to update | Where |
|---|---|---|
| **Google OAuth** | Authorized redirect URI → `https://wharescore.co.nz/api/auth/callback/google` | Google Cloud Console → Credentials |
| **AUTH_URL** in `.env.prod` | `https://wharescore.co.nz` | `.env.prod` on VM |
| **Stripe webhook** | Endpoint URL → `https://wharescore.co.nz/api/v1/webhooks/stripe` | Stripe Dashboard → Webhooks |
| **Google Maps key** | HTTP referrer → `https://wharescore.co.nz/*` | Google Cloud Console → Credentials |

### 6. Verify

```bash
# All should return 301 → https://wharescore.co.nz
curl -sI http://wharescore.co.nz | head -3
curl -sI http://wharescore.com | head -3
curl -sI http://wharescore.nz | head -3
curl -sI https://www.wharescore.co.nz | head -3
curl -sI https://wharescore.com | head -3
curl -sI https://wharescore.nz | head -3

# Canonical should return 200
curl -s -o /dev/null -w '%{http_code}' https://wharescore.co.nz
```

---

## Azure Free Tier & Credits

### New Account Credits

1. **Sign up with a NEW email** at [azure.microsoft.com/free](https://azure.microsoft.com/en-us/free/)
2. You get:
   - **$200 USD credit** for 30 days (use for anything)
   - **12 months of free services** including:
     - B1s VM (1 vCPU, 1 GB) — too small for WhareScore, but free
     - 64 GB managed SSD
     - 5 GB blob storage
   - **Always-free services** (not time-limited):
     - Azure Cosmos DB: 1000 RU/s (not needed for this project)
     - Azure Functions: 1M requests/month

3. **What you actually need to pay for:**
   - B2ms VM (~$60-80 USD/month in Australia East) — the $200 credit covers ~2.5 months
   - 128 GB Premium SSD (~$20/month)
   - Public IP (~$4/month)
   - Bandwidth (~$5-10/month for NZ traffic)

### How to maximise free credits

- Use the **$200 credit** to run the B2ms VM for the first month while testing
- After credits expire, consider:
  - **B2s** ($30/month) if traffic is low — 2 vCPU, 4 GB RAM, tighter but workable
  - **Spot instances** for dev/staging (up to 90% off)
  - **Reserved instances** (1-year commit) for ~40% savings on B2ms
- **Stop the VM** when not in use during development (you only pay for disk when stopped)

### Azure for Startups (if applicable)

- [Microsoft for Startups Founders Hub](https://www.microsoft.com/en-us/startups) — up to **$150K in Azure credits** over multiple years
- Requires: a startup idea, a website, and a brief application
- No funding required, no equity taken
- Also includes: GitHub Enterprise, LinkedIn premium, OpenAI credits

### Student/Education

- [Azure for Students](https://azure.microsoft.com/en-us/free/students/) — $100 credit, no credit card required
- Requires a .edu email or student verification

---

## Stripe: Test Mode → Live Mode

### Prerequisites

Before activating live payments:

1. **Business details** — Stripe needs to know who you are
2. **Bank account** — NZ bank account for payouts (NZD)
3. **Privacy policy & terms** — Must be accessible on your site
4. **Refund policy** — Required for card payments

### Step-by-Step Activation

1. **Go to** [dashboard.stripe.com](https://dashboard.stripe.com)

2. **Complete account activation:**
   - Click the banner "Activate your account" (or Settings → Account details)
   - Fill in:
     - Business type: Individual / Sole trader (or Company if registered)
     - Business name: WhareScore (or your legal name)
     - Country: New Zealand
     - Address, phone, DOB
     - Industry: "Software" or "Information Services"
     - Website: `https://wharescore.co.nz`
   - Add bank account for NZD payouts
   - Verify identity (may need NZ driver's licence or passport photo)

3. **Create live products & prices:**
   - Dashboard → Products → **switch to Live mode** (toggle at top)
   - Create 3 products:

   | Product | Price | Type |
   |---|---|---|
   | Quick Report | $4.99 NZD | One-time |
   | Full Report | $9.99 NZD | One-time |
   | Pro Monthly | $99.00 NZD | Recurring (monthly) |

   - Optionally create: Upgrade Quick→Full ($5.00 NZD, one-time)
   - Copy each `price_xxx` ID

4. **Create live webhook:**
   - Dashboard → Developers → Webhooks → **Add endpoint** (in Live mode)
   - URL: `https://wharescore.co.nz/api/v1/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `invoice.paid`
     - `customer.subscription.deleted`
   - Copy the webhook signing secret (`whsec_xxx`)

5. **Update .env.prod** on the VM:
   ```bash
   # Replace test keys with live keys:
   STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
   STRIPE_PRICE_SINGLE=price_xxxxxxxx      # Quick Report $4.99
   STRIPE_PRICE_PACK3=price_xxxxxxxx       # Full Report $9.99
   STRIPE_PRICE_PRO=price_xxxxxxxx         # Pro Monthly $99
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxx
   ```

6. **Restart services:**
   ```bash
   cd ~/app
   docker compose -f docker-compose.prod.yml up -d api web
   ```

7. **Test with a real card:**
   - Make a $4.99 purchase
   - Verify webhook fires (check Stripe Dashboard → Events)
   - Verify credit appears in the app
   - Refund the test payment in Stripe Dashboard

### Stripe Fees (NZ)

| Fee type | Amount |
|---|---|
| Domestic cards (NZ) | 2.7% + 30c NZD |
| International cards | 3.7% + 30c NZD |
| Payouts to NZ bank | Free |
| Disputes/chargebacks | $25 NZD |

On a $4.99 Quick Report: ~$0.43 in fees → you keep ~$4.56
On a $9.99 Full Report: ~$0.57 in fees → you keep ~$9.42
On a $99/mo Pro: ~$2.97 in fees → you keep ~$96.03

### Keep Test Mode Working

Your test Stripe keys should stay in `.env` (local dev). Live keys only go in `.env.prod` on the VM. The two environments are completely separate in Stripe — test purchases never charge real cards.

---

## If Transferring GitHub Repo to New Account

1. **GitHub → Settings → Transfer repository** to new owner
2. OR fork it under the new account and update the remote:
   ```bash
   # On new VM:
   cd ~/app
   git remote set-url origin https://NEW_USER:TOKEN@github.com/NEW_USER/wharescore.git
   ```
3. Re-create GitHub Actions secrets under the new repo
4. Update deploy.yml if the username changed
