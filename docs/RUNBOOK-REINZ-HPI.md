# Monthly REINZ HPI Import

One-page runbook. Run once per month after REINZ releases their monthly HPI PDF (around the 15th of the following month).

## TL;DR

1. Download the month's PDF from REINZ.
2. Paste it at Claude (or any tool) and ask it to extract page 14 + page 6 into the JSON shape below.
3. `POST /api/v1/admin/reinz-hpi/upload` with the JSON.
4. Flush Redis so existing cached reports pick up the new HPI.

Everything downstream (`price_advisor`, hosted reports, quick reports) keeps working with zero code changes as long as the JSON matches the schema.

---

## Step 1 — Download the PDF

REINZ publishes monthly via their news page. The direct URL pattern is:
```
https://www.reinz.co.nz/libraryviewer?ResourceID=XXX
```
Where `XXX` increments ~monthly. As of Mar 2026 the IDs were 822 and 823 (one is the monthly market report, the other is the HPI report — the **HPI** report is what we need; filename `REINZ Monthly HPI Report_MonthName_YYYY.pdf`).

Easiest route: go to `https://www.reinz.co.nz/` → scroll to "Latest news" → click the month's market update page → the linked ResourceID gives the PDF.

## Step 2 — Extract the data

The PDF has two relevant sections:

- **Page 14** — Table of all 73 territorial authorities with `(council, calculated_over, hpi)` for the latest month.
- **Page 6** — "Summary of Movements" table with `(ta, index, 1m%, 3m%, 1y%, 5y CGR%)` for ~27 major TAs (national + regional aggregates + big councils).

Extract into this JSON shape and save it (e.g. `reinz_hpi_YYYY_MM.json`):

```json
{
  "month_end": "2026-04-30",
  "rows": [
    {
      "ta_name": "Christchurch City",
      "hpi": 3795,
      "calculated": "Actual Month",
      "change_1m_pct": -0.1,
      "change_3m_pct": 2.9,
      "change_1y_pct": 4.5,
      "change_5y_cgr_pct": 4.7
    },
    {
      "ta_name": "Ashburton District",
      "hpi": 4094,
      "calculated": "3 month rolling"
    }
  ]
}
```

**Rules:**
- `month_end` is the last day of the month the PDF covers (e.g. `"2026-04-30"` for the April report published in May).
- Every TA from page 14 goes in `rows` with `ta_name`, `hpi`, `calculated`. Spell TA names exactly as they appear in page 14 (e.g. `"Christchurch City"` not `"Chch"`; `"Central Hawke's Bay District"` with the apostrophe).
- For the ~27 TAs that appear on page 6, also add `change_1m_pct`, `change_3m_pct`, `change_1y_pct`, `change_5y_cgr_pct`. TAs not on page 6 omit those fields.
- Percentages are plain numbers, not strings. `-0.1` not `"-0.1%"`.
- `calculated` is one of: `"Actual Month"`, `"2 month rolling"`, `"3 month rolling"`, `"6 month rolling"`.

**Easiest way to produce the JSON:** drop the PDF in a Claude chat with: "Extract page 14's full TA table and page 6's summary-of-movements into the JSON shape in `docs/RUNBOOK-REINZ-HPI.md`." Claude reads PDFs natively. Takes 30 seconds.

## Step 3 — Upload

You need an admin bearer token. Generate one the usual way (see `services/admin_auth.py`).

```bash
curl -X POST https://wharescore.co.nz/api/v1/admin/reinz-hpi/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @reinz_hpi_YYYY_MM.json
```

Response:
```json
{ "month_end": "2026-04-30", "inserted": 73, "updated": 0 }
```

If you re-upload the same month, it upserts in place — safe to re-run. `updated` shows how many rows were overwritten.

## Step 4 — Verify

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://wharescore.co.nz/api/v1/admin/reinz-hpi
```

Response lists every month with `total` (row count) and `with_cgr` (how many have 5yr CGR populated). Expect `total ≈ 73` and `with_cgr ≈ 24-27` per month.

## Step 5 — Flush Redis

Cached `price-advisor` responses are 24h-TTL. After upload, flush so users see the new numbers immediately:

```bash
ssh wharescore@20.5.86.126 \
  "docker exec app-redis-1 redis-cli -a \$REDIS_PASSWORD --no-auth-warning FLUSHDB"
```

---

## What happens next

`price_advisor.py:245` queries the **most recent** `reinz_hpi_ta` row per TA, so once the new month is uploaded it becomes the default. The `change_5y_cgr_pct` from that row drives the back-calculation to each property's reval date. No code change needed.

If REINZ changes the PDF layout (new column, renamed TA, etc.), extend the parser/JSON and the table DDL in `migrations/0055_reinz_hpi_ta.sql`. Otherwise this is stable.

## Known gaps

- **~46 TAs have no 5yr CGR** (page 14 list them; page 6 only covers ~27). For those councils `price_advisor` falls back to `change_1y_pct`, and if that's also missing, skips HPI entirely and anchors to CV. Most non-page-6 TAs are small/rural — acceptable.
- **2022-era revaluations** (Buller, Whanganui, Porirua, Hastings) sit near the late-2021 HPI peak. 5yr CGR back-extrapolates as a smooth line that over-corrects through the peak. `market_confidence_stars` should downgrade these — currently a TODO.
- **Adding a new TA to `REVALUATION_DATES`** — edit `backend/app/services/market.py` and redeploy. The audit checklist is in commit `273e3c0` message.

## Historical backfill (one-time, if wanted later)

`price_advisor` only needs HPI at each council's reval month, not a continuous timeline. If a specific stale-reval council (Buller 2022-10, Whanganui 2022-10, Porirua 2022-10, Hastings 2022-08, Kapiti 2023-08, Tauranga 2023-05, etc.) is producing wildly off estimates, download the REINZ HPI PDF for that specific month and upload it — the back-calc from that historical HPI to today's HPI gives an exact ratio. See `docs/SYSTEM-FLOWS.md` § "Price estimation" for the formula.
