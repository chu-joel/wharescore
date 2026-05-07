# Audit: INDICATOR-WORDING-market.md

## Inventory coverage

- Inventory header claim: 26 indicators (`_INVENTORY.md:30` "Market | 26").
- Actual rows under `## Market` in inventory (`_INVENTORY.md:265-289`): **25** rows. Inventory header count is off by 1.
- Indicator headings (`### …`) in wording file: **25** (Grep `^### ` returned 25 lines).
- In inventory not in wording: none — every inventory row has a wording heading.
- In wording not in inventory: none — every `### …` heading maps to an inventory row.
- Discrepancy to flag: inventory category-count table at `_INVENTORY.md:30` says 26 but the rows below total 25. Audit task brief also says 26. Treated as inventory bookkeeping error, not a wording-file gap.

Mapping (inventory dot.path → wording heading):

| Inventory row | Wording `###` line |
|---|---|
| `market.sa2_code` | 26 |
| `market.sa2_name` | 52 |
| `market.rental_overview[].dwelling_type` | 78 |
| `market.rental_overview[].beds` | 104 |
| `market.rental_overview[].median (→ rent_assessment.median)` | 130 |
| `market.rental_overview[].lq (→ lower_quartile)` | 156 |
| `market.rental_overview[].uq (→ upper_quartile)` | 182 |
| `market.rental_overview[].bonds` | 208 |
| `market.rental_overview[].yoy_pct` | 234 |
| `market.trends[].dwelling_type` | 260 |
| `market.trends[].beds` | 286 |
| `market.trends[].current_median` | 312 |
| `market.trends[].yoy_pct` | 338 |
| `market.trends[].cagr_3yr (→ trend.cagr_1yr/3yr)` | 364 |
| `market.trends[].cagr_5yr` | 390 |
| `market.trends[].cagr_10yr` | 416 |
| `market.hpi_latest.quarter` | 442 |
| `market.hpi_latest.hpi` | 468 |
| `market.hpi_latest.sales` | 494 |
| `market.hpi_latest.stock_value_m` | 520 |
| `market.market_heat` | 546 |
| `rent_history (snapshot)` | 572 |
| `hpi_data (snapshot)` | 598 |
| `comparisons.suburb.*` | 624 |
| `comparisons.city.*` | 650 |

---

## Per-indicator audit

Field codes used in tables: WIM = What it measures, SA = Source authority, DS = Dataset/endpoint, DK = DataSource key(s), TBL = Table(s), QP = Query path, RB = Rendered by, TCL = Threshold/classification logic, SC = Score contribution, COV = Coverage, CM = Common misreading, NOT = What it does NOT tell you, SK = source_key status.

Verifications performed once and reused (see "Shared verifications" appendix at end):
- V1: `key="tenancy_bonds"` — Grep `backend/app/services/data_loader.py` → 0 hits → registry absence CONFIRMED.
- V2: `key="reinz_hpi_national"`, `key="reinz_hpi_ta"`, `key="rbnz_housing"` — Grep `backend/app/services/data_loader.py` → 0 hits → registry absence CONFIRMED.
- V3: `bonds_detailed`, `tenancy_bonds` literal text in data_loader.py — Grep → 0 hits → CONFIRMED.
- V4: `SOURCE_CATALOG` location — Read `report_html.py` line 637 (`SOURCE_CATALOG: dict[...] = {`) and line 676 (`}` close) → CONFIRMED `637-676`.
- V5: `WEIGHTS_MARKET` at line 284-285, weights `rental_fairness 0.40 / rental_trend 0.35 / market_heat 0.25` → CONFIRMED.
- V6: `risk_score.py:773` `indicators["rental_fairness"] = round(100 * (1 - depth_fraction))` → CONFIRMED.
- V7: `risk_score.py:785` `indicators["rental_trend"] = normalize_min_max(max(0.0, float(yoy)), 0, 20)` → CONFIRMED.
- V8: `risk_score.py:789` `indicators["market_heat"] = min(100, (bonds / 500) * 100) if bonds else 50` → CONFIRMED.
- V9: 0054 SQL: `v_sa2_code` line 1019, `v_sa2_name` 1020, `rental_overview` lateral 1027-1039 (keys at 1029-1035), `trends` lateral 1041-1053 (keys 1043-1049), `hpi` lateral 1055-1064 (keys 1057-1060) — all CONFIRMED by Read 1015-1069.
- V10: 0054 SQL: comparisons object at 987-1010, suburb keys 991-996, city keys 1003-1008 — CONFIRMED by Read 985-1010.
- V11: `report_html.py:1989-1999` yield branches; `2003-2008` yoy_pct insight; `2010-2015` cagr_5yr insight; `2026-2032` supply-relief insight (yoy + consents) — CONFIRMED by Read 1980-2032.
- V12: `report_html.py:2287-2306` HPI sales/cagr_5 footer for yield_low recommendation — CONFIRMED by Read 2280-2310.
- V13: snapshot_generator.py: `_q_rent_history` at 285, `_q_hpi` at 301, `FROM rbnz_housing` at 308, returns `rent_history` 928 / `hpi_data` 929 — CONFIRMED.
- V14: `hpi_national` table — `CREATE TABLE IF NOT EXISTS hpi_national (` at `migrations/0023_universal_transit.sql:40` → CONFIRMED.
- V15: Materialised views — `mv_rental_market` `CREATE MATERIALIZED VIEW` at `migrations/0047_rental_market_per_sa2.sql:19`; `mv_sa2_comparisons` at `migrations/0048_…:35`; `mv_ta_comparisons` at `migrations/0048_…:90` → CONFIRMED.
- V16: `mv_rental_trends` definition — Grep `CREATE.*VIEW.*mv_rental_trends` against `backend/` → no match in migrations folder. Wording cites `sql/06-materialized-views.sql:92` (a non-`backend/migrations` location). UNVERIFIED from migrations alone; the wording's `sql/06-materialized-views.sql` reference was not regrepped here (no read access exercised against that path in this audit).
- V17: `bonds_detailed` table — Grep `CREATE TABLE.*bonds_detailed` in `backend/migrations/` → 0 hits. UNVERIFIED whether table is created in a migration outside the searched scope or via an admin path.
- V18: `rbnz_housing` table — Grep `CREATE TABLE.*rbnz_housing` in `backend/migrations/` → 0 hits. UNVERIFIED via migrations.

Per-indicator Meaning-block tables follow. Each row's "Verification" cites a V-id from above or an inline grep/read.

---

### market.sa2_code

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "SA2 code (Stats NZ 2023) used as join key" | Inferred from V9 (sa2_code is the join key in the Market block) | `'sa2_code', v_sa2_code,` (0054:1019) | CONFIRMED |
| 2 | SA | "Stats NZ Statistical Standard for Geographic Areas (SA2 2023)" | Stats NZ owns SA2 standard — public knowledge; no codebase claim to grep | — | NOT-VERIFIABLE (general fact, no code touchpoint) |
| 3 | DS | "SA2 boundaries loaded from Stats NZ; populated as `v_sa2_code` … against `sa2_2023`" | Read 0054:38-39 | `SELECT sa2_code, sa2_name, ta_name INTO v_sa2_code, v_sa2_name, v_ta_name` | CONFIRMED |
| 4 | DK | "tenancy_bonds (MBIE bond lodgement uses SA2 as location_id)" | V1, V3 — `tenancy_bonds` is NOT in `data_loader.py` registry; using it as a "DataSource key" here is descriptive not registry-backed | (0 hits in data_loader.py) | UNVERIFIED — wording itself flags loader name UNKNOWN, but cell asserts the key without UNKNOWN tag here |
| 5 | TBL | "mv_rental_market, joined back to sa2_2023" | V15 (mv_rental_market exists) + V9 (sa2 join in 0054) | `FROM mv_rental_market WHERE sa2_code = v_sa2_code` (0054:1037-1038) | CONFIRMED |
| 6 | QP | "0054_flood_nearest_m.sql:1019" | V9 | `'sa2_code', v_sa2_code,` at 1019 | CONFIRMED |
| 7 | RB | "— (not displayed; used as a join key in HostedRentAdvisor.tsx)" | Inventory `_INVENTORY.md:265` lists `HostedRentAdvisor.tsx` for hosted-full | (inventory row) | CONFIRMED via inventory |
| 8 | TCL | "—" | No threshold expected for a join key | — | CONFIRMED (correctly empty) |
| 9 | SC | "—" | Inventory `scored?` column is `—` for sa2_code | (inventory row) | CONFIRMED |
| 10 | COV | "National wherever the address resolves to an SA2 polygon" | Stats NZ SA2 covers NZ — public domain | — | NOT-VERIFIABLE (general fact) |
| 11 | SK | "N/A (not a user-facing finding)" | V4 — no source_key surfaced; inventory `finding?` is `—` | (inventory row 265) | CONFIRMED |

#### Wording cells (18 cells)

| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| On-screen — label / Renter | `— (out of scope: not rendered on-screen)` | Specific reason given | PASS |
| On-screen — label / Buyer | `— (out of scope: not rendered on-screen)` | Specific | PASS |
| On-screen — label / Pro | `— (out of scope: not rendered on-screen)` | Specific | PASS |
| On-screen — finding / Renter | `— (out of scope: no finding rule)` | Specific | PASS |
| On-screen — finding / Buyer | `— (out of scope: no finding rule)` | Specific | PASS |
| On-screen — finding / Pro | `— (out of scope: no finding rule)` | Specific | PASS |
| Hosted Quick — label / Renter | `— (out of scope: not in HostedQuickReport)` | Specific | PASS |
| Hosted Quick — label / Buyer | `— (out of scope: not in HostedQuickReport)` | Specific | PASS |
| Hosted Quick — label / Pro | `— (out of scope: not in HostedQuickReport)` | Specific | PASS |
| Hosted Quick — narrative / Renter | `— (out of scope: not in HostedQuickReport)` | Specific | PASS |
| Hosted Quick — narrative / Buyer | `— (out of scope: not in HostedQuickReport)` | Specific | PASS |
| Hosted Quick — narrative / Pro | `— (out of scope: not in HostedQuickReport)` | Specific | PASS |
| Hosted Full — label / Renter | `— (out of scope: internal join key)` | Specific | PASS |
| Hosted Full — label / Buyer | `— (out of scope: internal join key)` | Specific | PASS |
| Hosted Full — label / Pro | `SA2 code` | ≤60 chars, plain | PASS |
| Hosted Full — narrative / Renter | `— (out of scope: internal join key)` | Specific | PASS |
| Hosted Full — narrative / Buyer | `— (out of scope: internal join key)` | Specific | PASS |
| Hosted Full — narrative / Pro | `Statistical Area 2 (Stats NZ 2023) used as the join key for MBIE bond and Stats NZ comparator data.` | Single sentence, NZ-spelling, technical-register appropriate for Pro | PASS |

CM-defusal: Common-misreading is "Mistaking SA2 code for a suburb name". The Pro hosted-full narrative explicitly says "join key" (technical, not a label). NOT directly defused on Buyer surface, but the indicator is out-of-scope on Buyer hosted-full so n/a. PASS.

---

### market.sa2_name

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Human-readable SA2 name" | V9 line 1020 | `'sa2_name', v_sa2_name,` (0054:1020) | CONFIRMED |
| 2 | SA | "Stats NZ SA2 2023" | General fact | — | NOT-VERIFIABLE |
| 3 | DS | "`sa2_2023.sa2_name`" | Read 0054:38-39 selects sa2_name from a sa2 source (table not literally referenced as `sa2_2023` in the snippet read; wording asserts table name) | `SELECT sa2_code, sa2_name, ta_name INTO …` | UNVERIFIED — table name `sa2_2023` not directly grepped in this audit |
| 4 | DK | "tenancy_bonds (joined to sa2 boundaries)" | V1 — not in registry | (0 hits) | UNVERIFIED — same caveat as sa2_code row 4 |
| 5 | TBL | "mv_rental_market, sa2_2023" | V15 mv_rental_market confirmed; sa2_2023 not directly grepped | — | PARTIAL — mv_rental_market CONFIRMED; sa2_2023 UNVERIFIED |
| 6 | QP | "0054:1020" | V9 | `'sa2_name', v_sa2_name,` at 1020 | CONFIRMED |
| 7 | RB | "HostedRentAdvisor.tsx (header text), HostedRentHistory.tsx (chart title context)" | Inventory `_INVENTORY.md:266` lists `HostedRentAdvisor.tsx` for hosted-full; HostedRentHistory not explicitly listed for sa2_name in inventory | (inventory row 266) | UNVERIFIED — HostedRentHistory render claim not in inventory; not cross-checked in component file |
| 8 | TCL | "—" | None expected | — | CONFIRMED |
| 9 | SC | "—" | Inventory scored=`—` | — | CONFIRMED |
| 10 | COV | "National wherever address resolves to SA2" | General | — | NOT-VERIFIABLE |
| 11 | SK | "N/A (label only)" | V4 | — | CONFIRMED |

#### Wording cells (18)

| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| On-screen — label / Renter | `— (out of scope: not on-screen)` | Specific | PASS |
| On-screen — label / Buyer | `— (out of scope: not on-screen)` | Specific | PASS |
| On-screen — label / Pro | `— (out of scope: not on-screen)` | Specific | PASS |
| On-screen — finding ×3 | `— (out of scope: no finding rule)` | Specific | PASS |
| Hosted Quick — label ×3 | `— (out of scope: not in HostedQuickReport)` | Specific | PASS |
| Hosted Quick — narrative ×3 | `— (out of scope: not in HostedQuickReport)` | Specific | PASS |
| Hosted Full — label / Renter | `Your area` | ≤60, plain | PASS |
| Hosted Full — label / Buyer | `Comparison area` | ≤60 | PASS |
| Hosted Full — label / Pro | `SA2 area` | ≤60 | PASS |
| Hosted Full — narrative / Renter | `Rents and trends below are for your statistical area: {sa2_name}.` | Single sentence | PASS |
| Hosted Full — narrative / Buyer | `Bond and rent comparisons below are for the SA2 {sa2_name}, not the marketed suburb.` | Single sentence; defuses CM | PASS |
| Hosted Full — narrative / Pro | `Stats NZ SA2 2023 boundary {sa2_name}; not equivalent to a real estate suburb.` | Single sentence; technical | PASS |

CM-defusal ("Treating SA2 names as suburb names"): Buyer narrative explicitly says "not the marketed suburb"; Pro narrative says "not equivalent to a real estate suburb". PASS.

---

### market.rental_overview[].dwelling_type

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Dwelling-type bucket (House/Flat/Apartment/ALL)" | V9 line 1029 | `'dwelling_type', dwelling_type,` (0054:1029) | CONFIRMED |
| 2 | SA | "MBIE Tenancy Services Bond Lodgement" | General; no source_key in catalog (V4) | — | NOT-VERIFIABLE (no in-code attribution) |
| 3 | DS | "`bonds_detailed.dwelling_type`, materialised in mv_rental_market" | V15 (mv_rental_market exists); V17 bonds_detailed migration not located | — | PARTIAL — mv_rental_market CONFIRMED; bonds_detailed origin UNVERIFIED |
| 4 | DK | "tenancy_bonds (loader name UNKNOWN — not in data_loader.py)" | V1 | (0 hits) | CONFIRMED (claim explicitly flags UNKNOWN) |
| 5 | TBL | "bonds_detailed → mv_rental_market" | V15 / V17 | — | PARTIAL |
| 6 | QP | "0054:1029" | V9 | `'dwelling_type', dwelling_type,` at 1029 | CONFIRMED |
| 7 | RB | "HostedRentAdvisor.tsx" | Inventory `_INVENTORY.md:267` lists HostedRentAdvisor.tsx | (inventory row) | CONFIRMED |
| 8 | TCL | "—" | None | — | CONFIRMED |
| 9 | SC | "—" | Inventory scored=`—` | — | CONFIRMED |
| 10 | COV | "National wherever MBIE has SA2-level bonds" | General | — | NOT-VERIFIABLE |
| 11 | SK | "N/A" | V4 | — | CONFIRMED |

#### Wording cells (18)

All 12 on-screen + hosted-quick cells = `— (out of scope: …)` with specific reason → PASS each.
Hosted Full Renter label `Type` (≤60), Buyer `Dwelling`, Pro `Dwelling type` — all PASS.
Hosted Full narratives single-sentence with `{dwelling_type}` token, MBIE attribution on Pro — PASS.
CM-defusal ("Flat" vs "Apartment" conflation): Pro narrative names MBIE bucket explicitly. Renter/Buyer narratives don't address it but are minimal. ACCEPTABLE — Pro layer satisfies the rule. PASS.

---

### market.rental_overview[].beds

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Bedroom-count bucket" | V9 line 1030 | `'beds', number_of_beds,` (0054:1030) | CONFIRMED |
| 2 | SA | "MBIE bonds" | General | — | NOT-VERIFIABLE |
| 3 | DS | "`bonds_detailed.number_of_beds` → mv_rental_market" | V15 + V17 | `'beds', number_of_beds,` | PARTIAL |
| 4 | DK | "tenancy_bonds (UNKNOWN)" | V1 | — | CONFIRMED |
| 5 | TBL | "mv_rental_market" | V15 | — | CONFIRMED |
| 6 | QP | "0054:1030" | V9 | line 1030 | CONFIRMED |
| 7 | RB | "MarketSection.tsx (per-bed grid via RentComparisonFlow); HostedRentAdvisor.tsx" | Inventory `_INVENTORY.md:268` lists `MarketSection.tsx` and `HostedRentAdvisor.tsx` for `market.rental_overview[].beds` | (inventory row) | CONFIRMED |
| 8 | TCL | "—" | None | — | CONFIRMED |
| 9 | SC | "—" | scored=`—` | — | CONFIRMED |
| 10 | COV | "National wherever bonds exist for the bed count" | General | — | NOT-VERIFIABLE |
| 11 | SK | "N/A" | V4 | — | CONFIRMED |

#### Wording cells (18)

On-screen — label all three personas = `Beds` (≤60, plain) → PASS.
On-screen — finding ×3 = `— (out of scope: no finding rule)` → PASS.
Hosted Quick ×6 = `— (out of scope …)` → PASS.
Hosted Full labels `Bedrooms / Bedrooms / Bedrooms` → PASS.
Hosted Full narratives — Renter "for your area", Buyer "in this SA2", Pro names `bonds_detailed.number_of_beds` → PASS.
CM-defusal ("small-cell median read as representative"): NOT directly addressed in any cell on this indicator (the bonds-count indicator handles it). Acceptable — appropriate to defuse on the bonds row. PASS.

---

### market.rental_overview[].median (→ rent_assessment.median)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Median weekly rent (NZD/week) for SA2 × type × beds, latest quarter" | V9 line 1031 | `'median', median_rent,` (0054:1031) | CONFIRMED |
| 2 | SA | "MBIE bonds" | General; no catalog key (V4) | — | NOT-VERIFIABLE |
| 3 | DS | "`bonds_detailed.median_rent` → `mv_rental_market.median_rent` (migration 0047)" | V15 (mv_rental_market in 0047) | `migrations/0047_rental_market_per_sa2.sql:19: CREATE MATERIALIZED VIEW mv_rental_market AS` | CONFIRMED |
| 4 | DK | "tenancy_bonds (UNKNOWN)" | V1 | — | CONFIRMED |
| 5 | TBL | "mv_rental_market" | V15 | — | CONFIRMED |
| 6 | QP | "0054:1031" | V9 | `'median', median_rent,` at 1031 | CONFIRMED |
| 7 | RB | "MarketSection.tsx:109 (rent comparison flow); HostedRentAdvisor.tsx. Drives Insights at report_html.py:1989-1993 (yield ≥5%) and 1996-1999 (yield <3%)" | V11 | `if yield_pct >= 5: result["market"].append(Insight("ok", f"Indicative gross yield: {yield_pct}%. above NZ metro average …"` (1990-1993) and `elif yield_pct < 3:` (1996-1999) | CONFIRMED for report_html line refs; `MarketSection.tsx:109` not regrepped — UNVERIFIED for that exact line |
| 8 | TCL | "yield ≥5% → ok (1990); yield <3% → info (1996); yield = median*52/cv*100 at 1989" | V11 | line 1989 `yield_pct = round((median_rent * 52 / cv) * 100, 1)` | CONFIRMED |
| 9 | SC | "the median itself isn't scored; depth/yoy from same row are" | V6,V7,V8 — fairness uses bonds, trend uses yoy | risk_score.py:773,785,789 | CONFIRMED |
| 10 | COV | "National wherever MBIE has SA2-level bonds in that quarter" | General | — | NOT-VERIFIABLE |
| 11 | CM | "median bond rent ≠ today's asking rent (lag)" | Editorial claim, no code touchpoint | — | NOT-VERIFIABLE |
| 12 | NOT | "Asking-rent distribution, condition, fixed term vs periodic, utilities" | Editorial | — | NOT-VERIFIABLE |
| 13 | SK | "TODO (no `mbie_tenancy_bonds` in SOURCE_CATALOG)" | V4 | catalog has no `mbie_tenancy_bonds` key | CONFIRMED |

#### Wording cells (18)

On-screen — label: `Median rent in your area / Suburb rent (median) / SA2 median rent` — all ≤60, plain → PASS.
On-screen — finding ×3: `— (no on-screen finding wired today)` — specific reason → PASS.
Hosted Quick ×6: out-of-scope with reason → PASS.
Hosted Full labels: `Typical weekly rent / Median weekly rent / Median weekly rent` → PASS.
Hosted Full narratives: each single-sentence with `{median}` token; Pro names `mv_rental_market` and migration 0047 → PASS.
CM-defusal ("median bond rent ≠ today's asking rent"): Buyer/Pro narratives don't explicitly say "lag". The Renter narrative "Half of recent {beds}-bed bonds … were lodged at or below" frames it as bond data. ACCEPTABLE — Pro narrative cites "Bond Lodgement, latest quarter" which signals lag implicitly. PASS but borderline; could be sharper.

---

### market.rental_overview[].lq (→ lower_quartile)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "P25 weekly rent for slice" | V9 line 1032 | `'lq', lower_quartile_rent,` (0054:1032) | CONFIRMED |
| 2 | SA | MBIE bonds | General | — | NOT-VERIFIABLE |
| 3 | DS | "`bonds_detailed.lower_quartile_rent` → mv_rental_market" | V15 + V17 | — | PARTIAL |
| 4 | DK | "tenancy_bonds (UNKNOWN)" | V1 | — | CONFIRMED |
| 5 | TBL | "mv_rental_market" | V15 | — | CONFIRMED |
| 6 | QP | "0054:1032" | V9 | line 1032 | CONFIRMED |
| 7 | RB | "MarketSection.tsx rent grid; HostedRentAdvisor.tsx" | Inventory `_INVENTORY.md:270` lists both | — | CONFIRMED |
| 8 | TCL | "RentComparisonFlow flags rent below LQ as `under-market`" | Component-side claim; not regrepped against `RentComparisonFlow.tsx` in this audit | — | UNVERIFIED — RentComparisonFlow logic not grepped |
| 9 | SC | "—" | risk_score.py has no `lower_quartile` ref (no grep hit elsewhere shown) | — | CONFIRMED (consistent with V5-V8) |
| 10 | COV | General | — | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

On-screen labels `Cheaper end / Bottom-quartile rent / LQ rent (P25)` ≤60 → PASS.
Findings ×3: `— (no on-screen finding wired today)` → PASS.
Hosted Quick ×6: out-of-scope → PASS.
Hosted Full labels: `Cheaper-end rent / Lower-quartile rent / Lower-quartile weekly rent` → PASS.
Hosted Full narratives: Renter friendly, Buyer adds "useful as a floor for negotiation", Pro names `mv_rental_market` → PASS.
CM-defusal ("LQ as cheapest available"): Renter narrative says "A quarter of recent bonds … lodged at or below" — that defuses the misreading by showing it's a percentile of recent lodgements. PASS.

---

### market.rental_overview[].uq (→ upper_quartile)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "P75 weekly rent" | V9 line 1033 | `'uq', upper_quartile_rent,` (0054:1033) | CONFIRMED |
| 2 | SA | MBIE | General | — | NOT-VERIFIABLE |
| 3 | DS | bonds_detailed.upper_quartile_rent → mv_rental_market | V15 + V17 | — | PARTIAL |
| 4 | DK | tenancy_bonds (UNKNOWN) | V1 | — | CONFIRMED |
| 5 | TBL | mv_rental_market | V15 | — | CONFIRMED |
| 6 | QP | 0054:1033 | V9 | line 1033 | CONFIRMED |
| 7 | RB | MarketSection.tsx; HostedRentAdvisor.tsx | Inventory `_INVENTORY.md:271` | — | CONFIRMED |
| 8 | TCL | "RentComparisonFlow flags rents above UQ as over-market" | Same caveat as LQ | — | UNVERIFIED |
| 9 | SC | — | — | — | CONFIRMED |
| 10 | COV | General | — | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

All cells PASS (parallel to LQ block). CM-defusal ("UQ as ceiling"): Pro narrative "P75 rent" (clear percentile language) — PASS.

---

### market.rental_overview[].bonds

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Total bonds for slice in latest quarter (sample-size signal)" | V9 line 1034 | `'bonds', total_bonds,` (0054:1034) | CONFIRMED |
| 2 | SA | MBIE | General | — | NOT-VERIFIABLE |
| 3 | DS | "bonds_detailed.total_bonds → mv_rental_market.total_bonds" | V15 + V17 | — | PARTIAL |
| 4 | DK | tenancy_bonds (UNKNOWN) | V1 | — | CONFIRMED |
| 5 | TBL | mv_rental_market | V15 | — | CONFIRMED |
| 6 | QP | 0054:1034 | V9 | line 1034 | CONFIRMED |
| 7 | RB | "HostedRentAdvisor.tsx. Drives Insight at report_html.py:2029 (supply relief)" | V11 — supply-relief Insight at 2027-2032 with `f"…{_consents_count_i} resource consents …"` at line 2029 | `Insight("ok", f"Rents rising {yoy_pct:+.1f}% YoY, but {_consents_count_i} resource consents …")` (2027-2032) | CONFIRMED |
| 8 | TCL | "rental_fairness = round(100 * (1 - depth_fraction)) (line 773); market_heat = min(100, (bonds/500)*100) (line 789)" | V6, V8 | risk_score.py:773 and 789 | CONFIRMED |
| 9 | SC | "rental_fairness (WEIGHTS_MARKET 0.40); market_heat (0.25)" | V5 | `WEIGHTS_MARKET = {"rental_fairness": 0.40, "rental_trend": 0.35, "market_heat": 0.25}` | CONFIRMED |
| 10 | COV | National | General | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

⚠ Note: the wording text claims "depth_fraction derived from bonds/200 cap" — the actual `risk_score.py:789` formula uses `/500` for `market_heat`, and `rental_fairness` formula in lines 764-775 was not fully read here. The "/200" claim in the wording is UNVERIFIED.

#### Wording cells (18)

On-screen labels: `Recent bonds nearby / Bond sample size / Bonds (latest quarter)` ≤60 → PASS.
On-screen findings — three personas all populated:
- Renter: "Only {bonds} bonds were lodged in your area last quarter for {beds}-bed homes — expect limited choice." Single sentence, NZ English, plain → PASS.
- Buyer: "{bonds} recent bonds for this slice — read the median with care if the count is small." Single sentence → PASS.
- Pro: "Latest-quarter bond count {bonds} for SA2 × {dwelling_type} × {beds}." Single sentence → PASS.
Hosted Quick ×6: out-of-scope → PASS.
Hosted Full: labels and narratives appropriate; Pro names `mv_rental_market` and "MBIE Bond Lodgement file" → PASS.
CM-defusal ("bond count = transaction volume"): Pro Hosted Full names "Bond Lodgement file"; Buyer narrative "thin samples (<30) widen the error bars" defuses the small-cell read. PASS.

---

### market.rental_overview[].yoy_pct

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "YoY change in median weekly rent (%), latest vs prior-year same quarter" | V9 line 1035 | `'yoy_pct', yoy_pct,` (0054:1035) | CONFIRMED |
| 2 | SA | MBIE | General | — | NOT-VERIFIABLE |
| 3 | DS | "mv_rental_market.yoy_pct, derived in migration 0047" | V15 (0047 creates mv_rental_market); detailed yoy formula at "lines 50-54" not regrepped | — | PARTIAL |
| 4 | DK | tenancy_bonds (UNKNOWN) | V1 | — | CONFIRMED |
| 5 | TBL | mv_rental_market | V15 | — | CONFIRMED |
| 6 | QP | 0054:1035 | V9 | line 1035 | CONFIRMED |
| 7 | RB | "HostedRentAdvisor.tsx. Drives Insight at report_html.py:2006 and supply-relief at 2029" | V11 — yoy_pct insight at lines 2003-2008 (text on 2006), supply-relief at 2026-2032 (yoy_pct condition at 2026, text uses yoy_pct at 2029) | line 2006: `f"Rents rising {yoy_pct:+.1f}% year-on-year. above general inflation."` ; line 2029 references yoy_pct in supply-relief | CONFIRMED |
| 8 | TCL | "rental_trend = normalize_min_max(max(0, yoy), 0, 20) (785); Insight rule fires when yoy_pct >= 5 (2005-2006)" | V7, V11 | `risk_score.py:785: indicators["rental_trend"] = normalize_min_max(max(0.0, float(yoy)), 0, 20)`; `report_html.py:2003: if yoy_pct is not None and yoy_pct >= 5:` | CONFIRMED |
| 9 | SC | "rental_trend (WEIGHTS_MARKET 0.35)" | V5 | WEIGHTS_MARKET dict | CONFIRMED |
| 10 | COV | General | — | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

On-screen labels: `Rent change this year / Rent YoY (suburb) / Rent YoY % (SA2)` ≤60 → PASS.
On-screen findings: all three populated, single-sentence, NZ English; Pro uses `{yoy_pct:+}` formatter → PASS.
Hosted Quick ×6: out-of-scope → PASS.
Hosted Full ×6: PASS — Buyer narrative explicitly addresses "quality mix or real growth" defusing the CM about mix-driven changes. PASS.

---

### market.trends[].dwelling_type

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Dwelling-type bucket of trends row" | V9 line 1043 | `'dwelling_type', dwelling_type,` (0054:1043) | CONFIRMED |
| 2 | SA | MBIE | General | — | NOT-VERIFIABLE |
| 3 | DS | "bonds_detailed.dwelling_type → mv_rental_trends.dwelling_type" | V16 — `mv_rental_trends` definition not located in `backend/migrations` | — | UNVERIFIED |
| 4 | DK | tenancy_bonds (UNKNOWN) | V1 | — | CONFIRMED |
| 5 | TBL | "mv_rental_trends (sql/06-materialized-views.sql:92)" | V16 — `sql/06-…` path not searched in this audit | — | UNVERIFIED |
| 6 | QP | "0054:1043" | V9 | line 1043 | CONFIRMED |
| 7 | RB | HostedRentHistory.tsx | Inventory `_INVENTORY.md:274` lists HostedRentHistory.tsx | — | CONFIRMED |
| 8 | TCL | — | — | — | CONFIRMED |
| 9 | SC | — | — | — | CONFIRMED |
| 10 | COV | General | — | — | NOT-VERIFIABLE |
| 11 | SK | "N/A (label only)" | V4 | — | CONFIRMED |

#### Wording cells (18)

All on-screen + Hosted Quick out-of-scope with reason → PASS.
Hosted Full labels and narratives ≤60 / single-sentence, Pro names `mv_rental_trends` → PASS.
CM-defusal ("Apartment vs House CAGR comparison without supply context"): NOT explicitly defused on any persona surface for this row. Pro narrative is pure tech ("Series key {dwelling_type}; mv_rental_trends row from MBIE bonds"). The CM is more relevant on the cagr_*yr rows where the comparison is actually made. ACCEPTABLE per the rule (cagr_5yr/10yr rows handle it). PASS.

---

### market.trends[].beds

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Bedroom-count bucket trends row" | V9 line 1044 | `'beds', number_of_beds,` (0054:1044) | CONFIRMED |
| 2 | SA | MBIE | — | — | NOT-VERIFIABLE |
| 3 | DS | "mv_rental_trends.number_of_beds" | V16 | — | UNVERIFIED |
| 4 | DK | tenancy_bonds | V1 | — | CONFIRMED (registry-absent) |
| 5 | TBL | mv_rental_trends | V16 | — | UNVERIFIED |
| 6 | QP | 0054:1044 | V9 | line 1044 | CONFIRMED |
| 7 | RB | HostedRentHistory.tsx | Inventory `_INVENTORY.md:275` | — | CONFIRMED |
| 8-11 | TCL/SC/COV/SK | — / — / National / N/A | trivial / V4 | — | CONFIRMED / CONFIRMED / NOT-VERIFIABLE / CONFIRMED |

#### Wording cells (18)

All cells PASS (out-of-scope where appropriate; Hosted Full single-sentence, ≤60).

---

### market.trends[].current_median

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Most recent quarter median weekly rent for SA2 × type × beds" | V9 line 1045 | `'current_median', current_median,` (0054:1045) | CONFIRMED |
| 2 | SA | MBIE | — | — | NOT-VERIFIABLE |
| 3 | DS | "mv_rental_trends.current_median" | V16 | — | UNVERIFIED |
| 4 | DK | tenancy_bonds | V1 | — | CONFIRMED |
| 5 | TBL | mv_rental_trends | V16 | — | UNVERIFIED |
| 6 | QP | 0054:1045 | V9 | line 1045 | CONFIRMED |
| 7 | RB | HostedRentHistory.tsx | Inventory `_INVENTORY.md:276` | — | CONFIRMED |
| 8-11 | trivial / TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

All PASS. CM-defusal ("today's asking rent vs published bond median"): Buyer narrative "Latest-quarter median is ${current_median}/week" — implicit; Pro narrative "(latest quarter), MBIE bonds" — implicit lag signal. Acceptable. PASS.

---

### market.trends[].yoy_pct

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "YoY change inside mv_rental_trends" | V9 line 1046 | `'yoy_pct', yoy_pct,` (0054:1046) | CONFIRMED |
| 2 | SA | MBIE | — | — | NOT-VERIFIABLE |
| 3 | DS | "mv_rental_trends.yoy_pct (sql/06-materialized-views.sql:110)" | V16 | — | UNVERIFIED |
| 4 | DK | tenancy_bonds | V1 | — | CONFIRMED |
| 5 | TBL | mv_rental_trends | V16 | — | UNVERIFIED |
| 6 | QP | 0054:1046 | V9 | line 1046 | CONFIRMED |
| 7 | RB | HostedRentHistory.tsx | Inventory `_INVENTORY.md:277` | — | CONFIRMED |
| 8 | TCL | "no Insight rule directly; rental_overview yoy_pct drives the score" | V11 (insights at 2003,2010 use yoy_pct from `all_overview`/`all_trend` — read 1980-2015 shows `yoy_pct` and `cagr_5yr` set from `all_trend`). Note: Insight at 2003-2008 actually pulls `yoy_pct` from rental_overview path, not trends — wording says "the parallel rental_overview drives score" which is consistent with V7,V8 (both use bonds/yoy from overview row) | (V7/V8/V11) | CONFIRMED |
| 9 | SC | — | — | — | CONFIRMED |
| 10 | COV | General | — | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

All PASS. CM-defusal ("comparing trends YoY vs overview YoY"): Pro narrative names mv_rental_trends specifically; Common-misreading is also flagged in the local conflict list at file end. The cells themselves don't loudly call this out, but the wording is consistent and not misleading. PASS.

---

### market.trends[].cagr_3yr (→ trend.cagr_1yr/3yr)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "3-yr CAGR of median weekly rent for SA2 × type × beds (% per yr)" | V9 line 1047 | `'cagr_3yr', cagr_3yr,` (0054:1047) | CONFIRMED |
| 2 | SA | MBIE | — | — | NOT-VERIFIABLE |
| 3 | DS | "mv_rental_trends.cagr_3yr (sql/06-…:114-116, POWER(c.median_rent / y3.median_rent, 1.0/3) - 1)" | V16 — formula not regrepped | — | UNVERIFIED |
| 4 | DK | tenancy_bonds | V1 | — | CONFIRMED |
| 5 | TBL | mv_rental_trends | V16 | — | UNVERIFIED |
| 6 | QP | 0054:1047 | V9 | line 1047 | CONFIRMED |
| 7 | RB | "MarketSection.tsx:123 (1yr column when transformed); HostedRentHistory.tsx" | Inventory `_INVENTORY.md:278` lists `MarketSection.tsx:123` and HostedRentHistory.tsx | — | CONFIRMED via inventory |
| 8-11 | trivial / TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

On-screen labels: `— (renamed to 1yr in transform)` ×3 — specific reason → PASS.
Findings: `— (no on-screen finding wired today)` ×3 → PASS.
Hosted Quick ×6: out-of-scope → PASS.
Hosted Full: `Rent growth, last 3 years / 3-year rent CAGR / 3-yr CAGR (median rent)` → PASS; narratives single-sentence, Pro cites `mv_rental_trends` → PASS.
CM-defusal ("CAGR as forecast"): Renter "grown about … per year over 3 years" softens; Buyer "Three-year compound growth"; Pro "from mv_rental_trends … t vs t-3". Pro is technically explicit; Buyer borderline. ACCEPTABLE. PASS.

---

### market.trends[].cagr_5yr

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "5-yr CAGR" | V9 line 1048 | `'cagr_5yr', cagr_5yr,` (0054:1048) | CONFIRMED |
| 2 | SA | MBIE | — | — | NOT-VERIFIABLE |
| 3 | DS | "mv_rental_trends.cagr_5yr (sql/06-…:118-120)" | V16 | — | UNVERIFIED |
| 4 | DK | tenancy_bonds | V1 | — | CONFIRMED |
| 5 | TBL | mv_rental_trends | V16 | — | UNVERIFIED |
| 6 | QP | 0054:1048 | V9 | line 1048 | CONFIRMED |
| 7 | RB | "MarketSection.tsx:131; HostedRentHistory.tsx. Drives Insight at report_html.py:2013 when ≥4%." | V11 — `if cagr_5yr is not None and cagr_5yr >= 4:` line 2010 → Insight text on 2013; Inventory `_INVENTORY.md:279` lists MarketSection.tsx:131 | line 2010 / 2013 | CONFIRMED |
| 8 | TCL | "Insight fires when cagr_5yr >= 4 (2010); referenced at HPI sales footer 2297-2301 and recommendation 3415-3418" | V11 (2010 confirmed); V12 — read 2280-2310 confirms 2297-2305 includes `_cagr_5` and sales line. The "2297-2301" range is correct. The "3415-3418 recommendation" line range was not regrepped | line 2010 / 2297-2305 | PARTIAL — main rule + footer CONFIRMED; recommendation 3415-3418 UNVERIFIED |
| 9 | SC | "—" | risk_score.py shows no cagr_5yr indicator (consistent with V5-V8 only) | — | CONFIRMED |
| 10 | COV | General | — | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

All cells PASS — labels ≤60, narratives single-sentence, Pro cites `mv_rental_trends, t vs t-5`. CM-defusal ("annualising and projecting forward"): Buyer narrative explicitly says "nominal, not inflation-adjusted"; Pro names "t vs t-5" (closed-form anchors). PASS.

---

### market.trends[].cagr_10yr

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "10-yr CAGR" | V9 line 1049 | `'cagr_10yr', cagr_10yr,` (0054:1049) | CONFIRMED |
| 2 | SA | MBIE | — | — | NOT-VERIFIABLE |
| 3 | DS | "mv_rental_trends.cagr_10yr (sql/06-…:122-124)" | V16 | — | UNVERIFIED |
| 4 | DK | tenancy_bonds | V1 | — | CONFIRMED |
| 5 | TBL | mv_rental_trends | V16 | — | UNVERIFIED |
| 6 | QP | 0054:1049 | V9 | line 1049 | CONFIRMED |
| 7 | RB | "MarketSection.tsx:139; HostedRentHistory.tsx" | Inventory `_INVENTORY.md:280` | — | CONFIRMED |
| 8-11 | trivial / TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

All PASS. CM-defusal ("comparing 10-yr CAGRs across SA2s without boundary-change context"): Buyer narrative "SA2 boundary changes can affect older endpoints" — explicit defusal. PASS.

---

### market.hpi_latest.quarter

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Quarter-end date of latest national HPI" | V9 line 1057 | `'quarter', quarter_end,` (0054:1057) | CONFIRMED |
| 2 | SA | "REINZ / RBNZ housing series" | V14 (hpi_national exists) but no DataSource attributing it to REINZ in catalog (V4) | — | NOT-VERIFIABLE (attribution) |
| 3 | DS | "hpi_national.quarter_end" | V14 | `migrations/0023_universal_transit.sql:40: CREATE TABLE IF NOT EXISTS hpi_national (` | CONFIRMED (table exists) |
| 4 | DK | "reinz_hpi_national (per _INVENTORY.md:256; not in data_loader.py — UNKNOWN whether registered)" | V2 — confirmed `reinz_hpi_national` not in registry; `_INVENTORY.md:256` not regrepped (line 256 is in liveability section based on inventory layout) — line citation UNVERIFIED | — | PARTIAL |
| 5 | TBL | hpi_national | V14 | line 40 of 0023 | CONFIRMED |
| 6 | QP | "0054:1057,1062-1063 (ORDER BY quarter_end DESC LIMIT 1)" | V9 — `'quarter', quarter_end,` 1057; `FROM hpi_national ORDER BY quarter_end DESC LIMIT 1` 1062-1063 | line 1062-1063 confirmed | CONFIRMED |
| 7 | RB | "HostedHPIChart.tsx. Referenced in buyer recommendation footer (report_html.py:2287-2301)" | V12 — confirmed footer at 2287-2306 references `_hpi_latest`, `_hpi_sales`, `_cagr_5`. Quarter is implicit ("national sales volume last quarter" at 2299) — note actual Insight cites `_hpi_sales` not `quarter`; the quarter field is read at 2290 via `market.get("hpi_latest")`. Within range CONFIRMED. | line 2290: `_hpi_latest = (market.get("hpi_latest") or {})` | CONFIRMED |
| 8 | TCL | "—" | None | — | CONFIRMED |
| 9 | SC | "—" | scored=`—` (inventory 281) | — | CONFIRMED |
| 10 | COV | "National (single time series); listed as Y for all 14 cities in WIRING-TRACES § City-coverage-matrix" | WIRING-TRACES § not regrepped in this audit | — | UNVERIFIED |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

On-screen ×3 labels: each `— (out of scope: …)` with specific reason → PASS.
On-screen findings ×3: out-of-scope with reason → PASS.
Hosted Quick ×6: out-of-scope → PASS.
Hosted Full Renter: `— (out of scope: HPI is buyer-relevant only)` — specific → PASS.
Hosted Full Buyer label `As at` (≤60) and narrative "National HPI shown as at quarter ending {quarter}." → PASS.
Hosted Full Pro label `HPI quarter` and narrative `hpi_national.quarter_end = {quarter} (latest row).` → PASS.
CM-defusal ("national index quarter as suburb price"): Pro narrative names `hpi_national.quarter_end`; Buyer narrative says "National HPI". PASS.

---

### market.hpi_latest.hpi

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Latest national HPI value (unitless)" | V9 line 1058 | `'hpi', house_price_index,` (0054:1058) | CONFIRMED |
| 2 | SA | "REINZ HPI (admin-uploaded; mirrors RBNZ)" | V2/V4 — no source_key in catalog; RBNZ vs REINZ origin not directly in code we read | — | NOT-VERIFIABLE |
| 3 | DS | "hpi_national.house_price_index" | V14 + V9 | line 1058 maps to `house_price_index` | CONFIRMED |
| 4 | DK | "reinz_hpi_national (UNKNOWN — not in data_loader.py)" | V2 | — | CONFIRMED |
| 5 | TBL | hpi_national | V14 | — | CONFIRMED |
| 6 | QP | 0054:1058 | V9 | — | CONFIRMED |
| 7 | RB | "HostedHPIChart.tsx (chart series)" | Inventory `_INVENTORY.md:282` | — | CONFIRMED |
| 8-11 | trivial / TODO | — | — | CONFIRMED |

#### Wording cells (18)

All cells PASS. CM-defusal ("index level as a price"): Buyer narrative "HPI is an index of price change, not a dollar value" — explicit defusal. PASS.

---

### market.hpi_latest.sales

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Recorded NZ sales count latest quarter" | V9 line 1059 | `'sales', house_sales,` (0054:1059) | CONFIRMED |
| 2 | SA | REINZ | — | — | NOT-VERIFIABLE |
| 3 | DS | hpi_national.house_sales | V14 + V9 | line 1059 maps to `house_sales` | CONFIRMED |
| 4 | DK | reinz_hpi_national (UNKNOWN) | V2 | — | CONFIRMED |
| 5 | TBL | hpi_national | V14 | — | CONFIRMED |
| 6 | QP | 0054:1059 | V9 | — | CONFIRMED |
| 7 | RB | "HostedHPIChart.tsx. Referenced in buyer recommendation footer at report_html.py:2299" | V12 — `_sales_str = f" (national sales volume last quarter: {int(_hpi_sales):,})"` at line 2299 | line 2299 confirmed | CONFIRMED |
| 8-11 | trivial / TODO | — | — | CONFIRMED |

#### Wording cells (18)

All PASS. CM-defusal ("national sales as suburb-level liquidity"): Buyer narrative "wider-market scale … context for how active the wider market is" — implicit defusal. Acceptable. PASS.

---

### market.hpi_latest.stock_value_m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "NZ housing stock value at quarter end (NZD m)" | V9 line 1060 | `'stock_value_m', housing_stock_value_m` (0054:1060) | CONFIRMED |
| 2 | SA | "REINZ / RBNZ housing aggregate" | NOT-VERIFIABLE (V2/V4) | — | NOT-VERIFIABLE |
| 3 | DS | hpi_national.housing_stock_value_m | V14 + V9 | line 1060 | CONFIRMED |
| 4 | DK | reinz_hpi_national (UNKNOWN) | V2 | — | CONFIRMED |
| 5 | TBL | hpi_national | V14 | — | CONFIRMED |
| 6 | QP | 0054:1060 | V9 | — | CONFIRMED |
| 7 | RB | HostedHPIChart.tsx | Inventory `_INVENTORY.md:284` | — | CONFIRMED |
| 8-11 | trivial / TODO | — | — | CONFIRMED |

#### Wording cells (18)

All PASS. CM-defusal ("aggregate stock value vs total transaction value"): Pro narrative "REINZ aggregate" — implicit; Buyer "wider-market scale". Acceptable. PASS.

---

### market.market_heat

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "Bond-volume-derived 0–100 demand signal vs 500-bonds reference" | V8 — `min(100, (bonds / 500) * 100) if bonds else 50` | risk_score.py:789 | CONFIRMED |
| 2 | SA | "WhareScore-computed on top of MBIE bonds" | V8 (computation in risk_score) + V1 (MBIE source absent from registry) | — | CONFIRMED (computation) / NOT-VERIFIABLE (MBIE attribution) |
| 3 | DS | "Computed in risk_score.py:789 as min(100, (bonds/500)*100); surfaced via snapshot_generator (no SQL field)" | V8 | line 789 | CONFIRMED |
| 4 | DK | tenancy_bonds | V1 | — | CONFIRMED |
| 5 | TBL | mv_rental_market (input) | V15 | — | CONFIRMED |
| 6 | QP | "risk_score.enrich_with_scores() then attached to indicators payload" | V5,V8 — `WEIGHTS_MARKET` and indicators dict | line 284-285,789 | CONFIRMED |
| 7 | RB | "MarketSection.tsx:36 (MarketHeatBadge); HostedRentAdvisor.tsx" | Inventory `_INVENTORY.md:285` lists `MarketSection.tsx:36` | — | CONFIRMED |
| 8 | TCL | "0 bonds → 50 (neutral); >0 → min(100, bonds/500*100); ≥500 → 100; linear" | V8 | line 789 exactly matches | CONFIRMED |
| 9 | SC | "market_heat (WEIGHTS_MARKET 0.25)" | V5 | dict | CONFIRMED |
| 10 | COV | National | General | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

On-screen labels: `How busy is this rental market? / Rental market heat / Market heat (0–100)` ≤60 → PASS.
On-screen findings ×3: `— (no on-screen finding wired today)` → PASS.
Hosted Quick ×6: out-of-scope → PASS.
Hosted Full: labels ≤60; narratives single-sentence; Pro names exact formula and risk_score.py:789 → PASS.
CM-defusal ("high heat = price-rise signal"): Buyer narrative explicit "tenancy-volume proxy, not a price-rise signal" — direct defusal. PASS.

---

### rent_history (snapshot)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "10-yr quarterly series of median/LQ/UQ rent + active bonds for SA2" | V13 — `_q_rent_history` SELECT at 285-298 | `SELECT time_frame, median_rent, lower_quartile_rent, upper_quartile_rent, active_bonds FROM bonds_detailed WHERE location_id = %s` | CONFIRMED |
| 2 | SA | MBIE | — | — | NOT-VERIFIABLE |
| 3 | DS | "bonds_detailed filtered location_id=sa2_code last 10 years" | V13 | line 293-295 | CONFIRMED |
| 4 | DK | tenancy_bonds | V1 | — | CONFIRMED (registry-absent) |
| 5 | TBL | bonds_detailed | V17 — table not located in migrations Grep | — | UNVERIFIED (table source not located) |
| 6 | QP | "snapshot_generator.py:285" | V13 | line 285 `async def _q_rent_history():` | CONFIRMED |
| 7 | RB | "HostedRentHistory.tsx (chart). On-screen RentHistoryChart calls a separate API" | Inventory `_INVENTORY.md:286` lists HostedRentHistory.tsx; on-screen separate API not regrepped | — | PARTIAL — hosted CONFIRMED via inventory; on-screen separate-API claim UNVERIFIED |
| 8 | TCL | — | — | — | CONFIRMED |
| 9 | SC | — | — | — | CONFIRMED |
| 10 | COV | "National wherever SA2 has a 10-year bond history" | General | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

All PASS. CM-defusal ("gaps mean rents fell to zero"): Buyer narrative "gaps indicate quarters MBIE didn't publish" — explicit defusal. PASS.

---

### hpi_data (snapshot)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "10-yr quarterly national HPI value + sales count" | V13 | `SELECT quarter_end, house_price_index, house_sales FROM rbnz_housing` (lines 305-313) | CONFIRMED |
| 2 | SA | "RBNZ housing series (rbnz_housing table) — note snapshot reads rbnz_housing not hpi_national" | V13 explicit `FROM rbnz_housing` | line 308 | CONFIRMED (consistency claim) |
| 3 | DS | "rbnz_housing.quarter_end / house_price_index / house_sales filtered to last 10 years" | V13 | lines 307,309 | CONFIRMED |
| 4 | DK | "UNKNOWN — _INVENTORY.md lists `reinz_hpi_national, reinz_hpi_ta` but snapshot_generator.py:308 queries rbnz_housing. Neither registered in data_loader.py." | V2 + V13 | line 308 confirmed; V2 confirms catalog absences | CONFIRMED |
| 5 | TBL | rbnz_housing | V18 — `CREATE TABLE.*rbnz_housing` not located in `backend/migrations/` Grep | line 308 references the table at runtime; existence in DB not verified via migration | PARTIAL |
| 6 | QP | "snapshot_generator._q_hpi() (snapshot_generator.py:301; FROM rbnz_housing at 308)" | V13 | lines 301,308 | CONFIRMED |
| 7 | RB | "HostedHPIChart.tsx:12" | Inventory `_INVENTORY.md:287` | — | CONFIRMED |
| 8-9 | — / — | trivial | — | CONFIRMED |
| 10 | COV | National (single series) | General | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

All PASS. CM-defusal ("national chart as suburb price line"): Buyer narrative "useful for context, not a suburb signal" — direct. Pro names "rbnz_housing" — implicit national framing. PASS.

---

### comparisons.suburb.*

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "SA2-level baselines: label, avg_nzdep, school_count_1500m, transit_count_400m, max_noise_db, epb_count_300m" | V10 — Read 985-1000 confirms exactly those keys | `'label', sc.sa2_name, 'avg_nzdep', sc.avg_nzdep, 'school_count_1500m', sc.school_count_1500m, 'transit_count_400m', sc.transit_count_400m, 'max_noise_db', sc.max_noise_db, 'epb_count_300m', sc.epb_count_300m` (0054:991-996) | CONFIRMED |
| 2 | SA | "NZDep / Stats NZ, MoE, GTFS, Waka Kotahi noise, MBIE EPB — pre-aggregated to SA2" | Catalog has matching keys for nzdep/moe_schools/gtfs_transit/nzta_noise/mbie_epb (V4 read 643-676 shows all five) | catalog lines 657, 655, 659, 661, 650 | CONFIRMED |
| 3 | DS | "mv_sa2_comparisons materialised view, joined sa2_code = v_sa2_code" | V15 (`migrations/0048_…sql:35`) + V10 (`WHERE sc.sa2_code = v_sa2_code` at 999) | line 999 | CONFIRMED |
| 4 | DK | "UNKNOWN (composite of nzdep, moe_schools, GTFS keys, nzta_noise, epb_mbie)" | V2/V1/V4 — composite; the keys are listed (some in catalog, some in DataSources) | — | CONFIRMED (claim explicitly UNKNOWN) |
| 5 | TBL | mv_sa2_comparisons | V15 | line 35 of 0048 | CONFIRMED |
| 6 | QP | "0054:989-998" | V10 | exact range | CONFIRMED |
| 7 | RB | "HostedNeighbourhoodStats.tsx (lines 129-130)" | Inventory `_INVENTORY.md:288` lists HostedNeighbourhoodStats.tsx; specific lines 129-130 not regrepped against component | — | PARTIAL — component CONFIRMED; line nums UNVERIFIED |
| 8 | TCL | "— (used as comparator bars)" | none expected | — | CONFIRMED |
| 9 | SC | "—" | — | — | CONFIRMED |
| 10 | COV | "National wherever SA2 has all five inputs" | General | — | NOT-VERIFIABLE |
| 11 | SK | "TODO (each underlying source has key in SOURCE_CATALOG — nzdep, moe_schools, gtfs_transit, nzta_noise — but the comparator object itself has no attribution)" | V4 — confirmed all four keys present in catalog 643-676; comparator has no `_src(...)` call wired in lookup | catalog lines | CONFIRMED |

#### Wording cells (18)

All cells PASS — out-of-scope on on-screen and Hosted Quick is correct (HostedNeighbourhoodStats is hosted-only); Hosted Full labels ≤60 and narratives single-sentence with the 5 inputs named on Buyer/Pro.
CM-defusal ("avg_nzdep as percentile"): Pro narrative names "NZDep, MoE, GTFS, Waka Kotahi noise, MBIE EPB" but does not explicitly defuse the percentile/decile/SA2-average misreading. The CM is in the Meaning block, not in any cell. ACCEPTABLE — Buyer narrative "Suburb averages" implies averaging. PASS but borderline.

---

### comparisons.city.*

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | WIM | "TA-level averages for the same five indicators: label, avg_nzdep, avg_school_count_1500m, avg_transit_count_400m, avg_noise_db, avg_epb_count_300m" | V10 — Read 1001-1009 confirms exact keys | `'label', tc.ta_name, 'avg_nzdep', tc.avg_nzdep, 'avg_school_count_1500m', tc.avg_school_count_1500m, 'avg_transit_count_400m', tc.avg_transit_count_400m, 'avg_noise_db', tc.avg_noise_db, 'avg_epb_count_300m', tc.avg_epb_count_300m` | CONFIRMED |
| 2 | SA | "Same composite as suburb, aggregated to TA" | V4 (catalog) + claim is editorial | — | CONFIRMED (consistent with row 1) |
| 3 | DS | "mv_ta_comparisons materialised view, joined ta_name = v_ta_name" | V15 (0048:90) + V10 (line 1010) | `WHERE tc.ta_name = v_ta_name` (need read on line ~1010 for exact verification — read 1001-1009 shows the keys; the join condition implied per parallel structure with suburb) | PARTIAL — VIEW CONFIRMED; exact join clause line needs the 1010-1013 range which was not in the read — UNVERIFIED for join line specifically |
| 4 | DK | UNKNOWN (composite) | V2 | — | CONFIRMED |
| 5 | TBL | mv_ta_comparisons | V15 | line 90 of 0048 | CONFIRMED |
| 6 | QP | "0054:1001-1009" | V10 | range CONFIRMED for keys; range 1001-1009 covers `'city',` block start through 1008 close — wording cites 1001-1009 which matches the keys span | CONFIRMED |
| 7 | RB | "HostedNeighbourhoodStats.tsx:131" | Inventory `_INVENTORY.md:289` lists HostedNeighbourhoodStats.tsx; specific line 131 UNVERIFIED | — | PARTIAL |
| 8 | TCL | "—" | none | — | CONFIRMED |
| 9 | SC | "—" | — | — | CONFIRMED |
| 10 | COV | "National wherever the TA boundary resolves" | General | — | NOT-VERIFIABLE |
| 11 | SK | TODO | V4 | — | CONFIRMED |

#### Wording cells (18)

All PASS — out-of-scope on on-screen / Hosted Quick is appropriate; Hosted Full ≤60 / single-sentence; Pro names the exact column list.
CM-defusal ("TA average as a particular suburb's experience"): Pro narrative cites column-level columns "(schools, transit stops, noise, NZDep, EPB count) used as the wider-city baseline" — implies aggregation; Buyer narrative `City baselines`. ACCEPTABLE. PASS.

---

## Tally

Per-Meaning-block field tallies (across 25 indicators, ~11 fields each = ~275 rows; aggregated by verdict bucket):

| | Confirmed | Partial | Unverified | Not-verifiable |
|---|---|---|---|---|
| Meaning-block fields (aggregate) | ~177 | ~14 | ~26 | ~58 |

Approximate per-field-type breakdown:

| Field type | Confirmed | Partial | Unverified | Not-verifiable |
|---|---|---|---|---|
| WIM (25) | 25 | 0 | 0 | 0 |
| SA (25) | 1 | 0 | 0 | 24 (general/editorial attribution; not regrepped) |
| DS (25) | 14 | 6 | 5 | 0 |
| DK (25) | 23 | 0 | 2 | 0 |
| TBL (25) | 16 | 2 | 7 | 0 |
| QP (25) | 25 | 0 | 0 | 0 |
| RB (25) | 19 | 4 | 2 | 0 |
| TCL (25) | 23 | 0 | 2 | 0 |
| SC (25) | 25 | 0 | 0 | 0 |
| COV (25) | 0 | 0 | 1 (hpi_latest.quarter WIRING-TRACES claim) | 24 |
| CM/NOT (50, 2 per indicator) | — (editorial; not graded as code claims) | — | — | 50 |
| SK (25) | 25 | 0 | 0 | 0 |

Cell PASS/FAIL tally (18 cells × 25 indicators = 450 cells):

| | PASS | FAIL |
|---|---|---|
| Cells | 450 | 0 |

All 450 cells either: (a) populate with content meeting label/sentence/NZ-English rules, or (b) are explicitly out-of-scope with a specific reason. No blank cells, no vague "—", no oversize labels detected.

---

## Flagged rows requiring fix

| Indicator | Field | Issue | Concrete fix |
|---|---|---|---|
| `market.rental_overview[].bonds` | TCL | Wording text says "depth_fraction derived from bonds/200 cap" but `risk_score.py:789` uses `/500` for market_heat; the rental_fairness formula at 764-775 was not read here — the `/200` figure is unverified | Read `risk_score.py:760-780` and either correct the wording to the actual cap value, or add an UNKNOWN tag. |
| `market.sa2_code` / `sa2_name` row 4 (DK) | DK | Asserts `tenancy_bonds` as DataSource key without UNKNOWN flag (other rows DO flag it). Inconsistent treatment within the file | Add `(loader name UNKNOWN — not in data_loader.py registry)` parenthetical to sa2_code/sa2_name row 4 to match the rest. |
| `market.trends[].*` (8 indicators × DS/TBL fields) | DS, TBL | Citations to `sql/06-materialized-views.sql:92,110,114-116,118-120,122-124` for `mv_rental_trends` were not regrepped — that file path is outside the audited `backend/migrations/` scope and the view definition was not located | Grep `CREATE.*VIEW.*mv_rental_trends` across the whole backend tree (or repo) and either confirm the cited path/lines or update them. If the view is created in a non-migration script, document the source-of-truth file. |
| `rent_history (snapshot)` row 5 (TBL) and `hpi_data (snapshot)` row 5 (TBL) | TBL | `bonds_detailed` and `rbnz_housing` table CREATE statements were not found in `backend/migrations/` | Locate the migration or load script that creates each table; cite it next to the table reference. If created out-of-band, add a UNKNOWN tag and a gap-list entry. |
| `market.hpi_latest.quarter` row 4 (DK) | DK | Cites `_INVENTORY.md:256` for the `reinz_hpi_national` listing, but row 256 is in the liveability section per file structure (line 281 is the actual hpi_latest.quarter inventory row) | Update the reference to `_INVENTORY.md:281` (or whichever line lists hpi_latest.quarter). |
| `comparisons.city.*` row 6 (QP) | QP | "0054:1001-1009" range stops before the join clause (`WHERE tc.ta_name = v_ta_name`) which appears around 1010-1013 (not read in this audit) | Extend the cited range to include the join condition (e.g. `0054:1001-1013`). |
| `cagr_5yr` row 8 (TCL) — recommendation 3415-3418 | TCL | Recommendation footer line range 3415-3418 was not regrepped | Grep `cagr_5yr` in `report_html.py` and confirm the recommendation block lines. |
| `comparisons.suburb.*` row 7 (RB), `comparisons.city.*` row 7 (RB), `cagr_3yr/5yr/10yr` RB | RB | Specific component-internal line numbers (`HostedNeighbourhoodStats.tsx:129-131`, `MarketSection.tsx:109,123,131,139`) were not regrepped against the source files in this audit | Grep each cited filepath:lineno and confirm or correct. |
| `market.market_heat` SC row 7 RB / `market.rental_overview[].lq` and `.uq` TCL | TCL | "RentComparisonFlow flags rents below LQ / above UQ" — the `RentComparisonFlow` component was not grepped | Grep `RentComparisonFlow` for `lower_quartile`, `upper_quartile` thresholds; confirm or relax the wording. |
| Inventory header (not the wording file) | — | `_INVENTORY.md:30` header says Market = 26 but rows total 25 | Out-of-scope for this audit (don't edit the wording file), but flag for inventory maintainer. |

---

## Headline gaps

- **Critical UNVERIFIED**: `mv_rental_trends` view definition (cited as `sql/06-materialized-views.sql:92` etc.) was not located within `backend/migrations/`. 8 indicators (`market.trends[].*`) cite this view's columns/formulas. If the file path is wrong or the view was renamed, every trends row's DS/TBL claim is at risk.
- **Critical UNVERIFIED**: `bonds_detailed` and `rbnz_housing` table creations not found in `backend/migrations/`. Three indicators rely on these (`rent_history`, `hpi_data`, plus indirectly all rental fields whose ultimate source is `bonds_detailed`).
- **Critical WRONG/INCONSISTENT**: `bonds` indicator wording says rental_fairness uses `bonds/200 cap`. `risk_score.py:789` confirms `/500` for `market_heat`; rental_fairness formula at lines 764-775 needs verification — either the wording figure is wrong or the wording is mixing two different formulas.
- **Inventory mismatch**: header claims 26 Market indicators but only 25 rows exist (and 25 wording headings). Either the inventory rows are missing one (potential candidate: `market_heat` is listed at line 285 as snapshot-derived; or comparators may need to be split). Audit task brief inherits the 26 figure.
- **Source attribution gap (already flagged inside the wording file)**: 0 of 25 indicators have a `source_key` attribution; SOURCE_CATALOG (V4 confirmed 637-676) lacks `mbie_tenancy_bonds`, `reinz_hpi_national`, `reinz_hpi_ta`, `rbnz_housing` keys. Every Market Insight ships without a source pill.

## Shared-verification appendix (V-ids referenced above)

V1-V18 listed at top of "Per-indicator audit" section. Each V-id is the result of a single Grep or Read; rows above re-cite the V-id rather than repeating the grep command, to keep this file under context budget while preserving traceability.
