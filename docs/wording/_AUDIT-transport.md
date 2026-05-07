# Audit: INDICATOR-WORDING-transport.md

Audit performed against current codebase (HEAD = `main`). Every claim in the wording file's Meaning blocks is re-grepped here. The "Changes in this pass" section at the top of the wording file is treated as unverified hearsay.

## Inventory coverage

- Indicators in inventory `## Transport` (rows 297–314 of `_INVENTORY.md`): **18 pure Transport rows** — `transit_stops_400m`, `transit_stops_list`, `nearest_train_name`, `nearest_train_distance_m`, `cbd_distance_m`, `crashes_300m_serious`, `crashes_300m_fatal`, `crashes_300m_total`, `bus_stops_800m`, `rail_stops_800m`, `ferry_stops_800m`, `cable_car_stops_800m`, `transit_travel_times`, `transit_travel_times_pm`, `peak_trips_per_hour`, `nearest_stop_name`, `walking_reach_10min`, `isochrone`. Plus row 315 `school_zones` tagged `Transport/Liveability`.
- Inventory header (`_INVENTORY.md:31`) claims "Transport | 20" — this conflicts with the 19 actual rows (18 + school_zones). FLAGGED as inventory bug, not a wording-file bug.
- Indicators present in wording file (`^### `): **18** — all 18 pure-Transport inventory dot-paths covered. None missing.
- `school_zones` deliberately deferred to Liveability (note at `INDICATOR-WORDING-transport.md:30–31`). Acceptable.
- Indicators in wording file but NOT in inventory: **none**.

## Plagiarism check on "Changes in this pass" (lines 7–20)

| Claim | Verification | Verdict |
|---|---|---|
| "12 GTFS DataSource keys verified at `data_loader.py:6238–6274` plus `metlink_gtfs` (4939) and `at_gtfs` (5144)" | `Grep "DataSource\\(\"<key>\"" data_loader.py` for all 12: hits at 4939, 5144, 6238, 6242, 6246, 6250, 6254, 6258, 6262, 6266, 6270, 6274. | CONFIRMED |
| "`cbd_proximity` 729 → 731" | `risk_score.py:731`: `indicators["cbd_proximity"] = min(100, (float(cbd_m) / 10000) * 100)` | CONFIRMED |
| "`commute_frequency` 733 → 735" | `risk_score.py:735`: `indicators["commute_frequency"] = normalize_min_max(...)` | CONFIRMED |
| "`rail_proximity` 737 → 739" | `risk_score.py:739`: `indicators["rail_proximity"] = min(100, (float(rail_m) / 5000) * 100)` | CONFIRMED |
| "`bus_density` 741 → 743" | `risk_score.py:743`: `indicators["bus_density"] = normalize_min_max(bus_800, 0, 30, inverse=True)` | CONFIRMED |
| "`road_safety` 745 → 746" | `risk_score.py:746`: `indicators["road_safety"] = normalize_min_max(serious, 0, 20)` | CONFIRMED |
| "report_html line refs (1882, 1884, 1900, 1907, 1915, 1932) all still correct" | Read 1880–1934: 1882 = serious-crash text, 1884 = `source=_src("nzta_crashes")`, 1900 = "Only X transit stops" Insight, 1907 = "X public transport stops" Insight, 1915 = caveat Insight, 1932 = "Train station ({name}) is {n}m. strong commuter connectivity." | CONFIRMED |
| "`_src("nzta_crashes")` is the only attached source, at `report_html.py:1884`" | `Grep '_src\\("nzta_crashes"\\)' report_html.py` → 1 hit at 1884. | CONFIRMED |
| "`gtfs_transit` defined at `report_html.py:659`, not yet attached to any of the four eligible findings" | `Grep '"gtfs_transit"' report_html.py` → only 659 (definition). No `_src("gtfs_transit")` call. | CONFIRMED |
| "`nzta_cas` and `osm_road_network` have no `DataSource(...)` entry in `data_loader.py`" | `Grep "(nzta_cas|osm_road_network)" data_loader.py` → 0 hits. | CONFIRMED |

## Per-indicator audit

Field-row tags: M = meaning-block field, W = wording cell.

---

### `liveability.transit_stops_400m` (→ `transit_count`)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | What it measures | count within 400m straight-line | n/a (definitional) | n/a | NOT-VERIFIABLE |
| M2 | Source authority | Regional transit operators (GTFS) | DATA-PROVENANCE.md (no row for this exact dot-path; `gtfs_transit` _src def at `report_html.py:659` says "Regional transit operators (GTFS feeds)") | line 659: `"authority": "Regional transit operators (GTFS feeds)"` | CONFIRMED |
| M3 | Dataset / endpoint | GTFS `stops.txt` per region | DATA-CATALOG.md GTFS-transit table | "GTFS URL" column lists `gtfs.zip` archives | CONFIRMED (informally — `stops.txt` is implied, not literally cited) |
| M4 | DataSource key(s) | 12 listed | `Grep '"<key>"' data_loader.py` → all 12 hit (lines 4939, 5144, 6238, 6242, 6246, 6250, 6254, 6258, 6262, 6266, 6270, 6274) | as above | CONFIRMED |
| M5 | Table — `transit_stops`, `metlink_stops`, `at_stops` | `Grep "CREATE TABLE.*transit_stops" .` → only `scripts/load_all_datasets.py:540`. `metlink_stops` at `migrations/0001_wellington_tables.sql:112`. `at_stops` not grep'd here. | "CREATE TABLE transit_stops" / "CREATE TABLE IF NOT EXISTS metlink_stops" | CONFIRMED |
| M6 | Query path — `migrations/0054_flood_nearest_m.sql:581` `ts` LATERAL | Read 0054:581 | `'transit_stops_400m', ts.stop_count,` | CONFIRMED |
| M6b | `transformReport()` renames to `transit_count` | `Grep transit_count transformReport.ts` | `transformReport.ts:160 → transit_count: raw.transit_stops_400m ?? null` | CONFIRMED |
| M7 | Rendered by — `TransportSection.tsx` walking-reach fallback ~lines 114–165 | Read 114–165 | line 114 begins fallback branch; line 117 label; lines 119,130,141,152 mode rows | CONFIRMED |
| M7b | `HostedNeighbourhoodStats.tsx:693` suburb/city comparison row | Read 693 | `{(suburbAvg?.transit_count_400m != null ...)` | CONFIRMED |
| M7c | Finding text in `report_html.py:1898–1920` | Read 1898–1920 | three Insight branches (1900, 1907, 1915) | CONFIRMED |
| M8 | Threshold — `<=2`, `>=10 AND peak>=6`, `>=5 AND peak<=3` | Read 1898–1920 | `if transit <= 2:` / `elif transit >= 10 and (peak_trips is None or peak_trips >= 6):` / `elif transit >= 5 and peak_trips is not None and peak_trips <= 3:` | CONFIRMED |
| M9 | Score — `transit_access`, `WEIGHTS_TRANSPORT 0.25`, `risk_score.py:725` | Read 725 | `indicators["transit_access"] = normalize_min_max(liv.get("transit_stops_400m"), 0, 25, inverse=True)` (line 725). Weight 0.25 not verified at this site — claim references WEIGHTS_TRANSPORT dict not shown in 725 context. | CONFIRMED indicator + line + inverse 0–25; weight 0.25 UNVERIFIED at 725 |
| M10 | Coverage — 12 GTFS cities; not Christchurch / Invercargill per DATA-CATALOG.md:77 | Read DATA-CATALOG.md:81 | "Not covered: Christchurch (GTFS needs API key…), Invercargill (no GTFS feed)" — actual line **81**, not 77 | CONFIRMED content / WRONG line ref (77 → 81) |
| M11 | source_key status — TODO at 1900, 1907, 1915 | Read 1900–1920: none of the three Insight calls has `source=` | matched | CONFIRMED (status = TODO) |
| W1 | On-screen Renter label "Bus and train stops nearby" | 28 chars; lay-language; NZ English | — | PASS |
| W2 | On-screen Buyer label "Transit stops within 400 m" | 26 chars | — | PASS |
| W3 | On-screen Pro label "Transit stops within 400 m (GTFS)" | 33 chars | — | PASS |
| W4 | On-screen Renter finding | 1 sentence; uses concrete "2 stops" | — | PASS |
| W5 | On-screen Buyer finding | 1 sentence | — | PASS |
| W6 | On-screen Pro finding | mentions peak frequency caveat (defuses "10 stops" misreading) | — | PASS — addresses common-misreading |
| W7 | Hosted Quick Renter | "— (out of scope: not rendered on Hosted Quick)" — specific reason | — | PASS |
| W8 | Hosted Quick Buyer | same | — | PASS |
| W9 | Hosted Quick Pro | same | — | PASS |
| W10 | Hosted Quick narrative ×3 | all "— (out of scope: not rendered on Hosted Quick)" | — | PASS ×3 |
| W11 | Hosted Full Renter label "Stops near you" | 14 chars | — | PASS |
| W12 | Hosted Full Buyer label "Transit stops within 400 m" | 26 chars | — | PASS |
| W13 | Hosted Full Pro label "Transit stops within 400 m (GTFS)" | 33 chars | — | PASS |
| W14 | HF Renter narrative — references suburb baseline 8 | matches comparator-naming rule | — | PASS |
| W15 | HF Buyer narrative — names suburb median 8 | — | — | PASS |
| W16 | HF Pro narrative — cites `mv_sa2_comparisons.transit_count_400m` and `transit_stops` | source/vintage on 2nd sentence | — | PASS |

---

### `liveability.transit_stops_list`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | array of stops within 400m | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2 | Source — GTFS | inherited from M2 above | — | CONFIRMED |
| M3 | GTFS `stops.txt` per region | inherited | — | CONFIRMED |
| M4 | same key set as `transit_stops_400m` | inherited | — | CONFIRMED |
| M5 | Table `transit_stops` | inherited | — | CONFIRMED |
| M6 | Query — `migrations/0054_flood_nearest_m.sql:582`, `ts_list` LATERAL | Read 0054:582 | `'transit_stops_list', ts_list.stops,` | CONFIRMED |
| M7 | Rendered by — `TransportSection.tsx` map/list block | Grep `transit_stops_list` in TransportSection — not directly read; TransportSection at lines 25–230 above shows no direct reference to `transit_stops_list` | UNVERIFIED — claim that TransportSection renders this list-payload is unverified; only the count is consumed. | UNVERIFIED |
| M8 | none | — | — | NOT-VERIFIABLE |
| M9 | not scored | — | — | NOT-VERIFIABLE |
| M10 | same as 400m | inherited | — | CONFIRMED |
| M11 | N/A — list payload | — | — | CONFIRMED |
| W1–W18 | All 6×3 cells | finding row "—" (no rule); on-screen labels present; all Hosted cells "— (out of scope: not rendered on Hosted Quick/Full)" with specific reason | — | PASS ×18 |

---

### `liveability.nearest_train_name`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | nearest rail-mode stop_name | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2 | GTFS regional operators | inherited | — | CONFIRMED |
| M3 | GTFS stops.txt rail subset | informal | — | CONFIRMED (informally) |
| M4 | Keys `at_gtfs`, `metlink_gtfs` primarily | grep confirmed both | — | CONFIRMED |
| M5 | `transit_stops` | metlink table conf | — | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:583`, `tr` LATERAL | Read 0054:583 | `'nearest_train_name', tr.stop_name,` | CONFIRMED |
| M7 | Rendered by `TransportSection.tsx` paired with distance | Read TransportSection 52–64 | line 59: `<p className="text-xs text-muted-foreground">Nearest train</p>` and trainDistance card uses `liveability.nearest_train_m` (alias). The NAME `nearest_train_name` is not itself rendered in TransportSection | WRONG — only the distance card is rendered; name field is referenced in `report_html.py:1923,1932` finding text only |
| M8 | Threshold — finding fires only when distance ≤ 500m at `report_html.py:1929` | Read 1929 | `if train_dist is not None and train_dist <= 500:` — actual line 1929 | CONFIRMED |
| M9 | Distance, not name, drives `rail_proximity` | risk_score.py:737–739 uses `nearest_train_distance_m` | matched | CONFIRMED |
| M10 | AT + Metlink only | per WIRING-TRACES rail_stops/peak rows; no rail-only field row | — | CONFIRMED |
| M11 | N/A — display label | — | — | CONFIRMED |
| W1–W18 | All cells | labels brief; out-of-scope cells specific | — | PASS ×18 |

---

### `liveability.nearest_train_distance_m` (→ `nearest_train_m`)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | straight-line distance to closest rail stop | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2 | GTFS | inherited | — | CONFIRMED |
| M3 | GTFS rail-mode subset | informal | — | CONFIRMED |
| M4 | `at_gtfs`, `metlink_gtfs` | grep confirmed | — | CONFIRMED |
| M5 | `transit_stops` | conf | — | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:584`, `tr` LATERAL with `ST_Distance(::geography)` | Read 0054:584 | `'nearest_train_distance_m', round(tr.train_dist::numeric),` | CONFIRMED line; geography call needs deeper read of `tr` LATERAL but plausible | CONFIRMED line |
| M7 | Rendered — `TransportSection.tsx:32` "Nearest train" card with `formatDistance` | Read 32 | `const trainDistance = liveability.nearest_train_m;` (line 32) — the rendering uses transformed alias; card is at lines 52–64 | CONFIRMED |
| M7b | Finding rule at `report_html.py:1922–1934` | Read | matches | CONFIRMED |
| M8 | ≤500m threshold | line 1929 | confirmed | CONFIRMED |
| M9 | `rail_proximity`, `WEIGHTS_TRANSPORT 0.15`, `risk_score.py:739` | Read 737–739 | `rail_proximity` at 739, normaliser `min(100, (float(rail_m) / 5000) * 100)` (linear 0–5,000m, capped 100) | CONFIRMED line + indicator + 5,000m cap; weight 0.15 UNVERIFIED at 739 |
| M10 | Auckland + Wellington meaningful; WIRING-TRACES no rail-only row | confirmed by reading City Coverage Matrix lines 188–202 — no `nearest_train_distance_m` row | matched | CONFIRMED (gap acknowledged) |
| M11 | TODO — finding at `report_html.py:1932` carries no `source=_src(...)` | Read 1929–1934 | Insight() call has no `source=` arg | CONFIRMED |
| W1–W18 | All cells | reasonable; OS Pro narrative carries the "straight-line not walking" defusal of common misreading | — | PASS ×18 |

---

### `liveability.cbd_distance_m`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | distance to nearest CBD point | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2 | WhareScore-curated CBD anchor list | — | not in DATA-PROVENANCE | NOT-VERIFIABLE (definitional) |
| M3 | `cbd_points` seed table populated by migration `0023_get_transit_data.sql` | Grep `CREATE TABLE.*cbd_points` migrations → `0023_universal_transit.sql:11` | filename is `0023_universal_transit.sql`, NOT `0023_get_transit_data.sql` | WRONG — filename mis-cited |
| M4 | seeded by migration | confirmed via M3 | — | CONFIRMED |
| M5 | Table `cbd_points` | conf at 0023_universal_transit.sql:11 | — | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:585`, `ST_Distance(::geography)` | Read 585 | `'cbd_distance_m', round(ST_Distance(addr.geom::geography, (SELECT geom::geography FROM cbd_points ORDER BY geom <-> addr.geom LIMIT 1)::numeric)),` | CONFIRMED |
| M7 | `TransportSection.tsx:31` "To CBD" card | Read 31 | `const cbdDistance = liveability.cbd_distance_m;` (line 31); card rendered at 39–50 | CONFIRMED |
| M7b | used in narratives at `report_html.py:2746` and `:3863` | Read 2746 + 3863 | both lines reference `live.get("cbd_distance_m")` | CONFIRMED |
| M8 | no finding rule; used as score divisor | Grep cbd in report_html — no Insight on cbd_distance | — | CONFIRMED |
| M9 | `cbd_proximity`, 0.20 weight, `risk_score.py:731` | Read 729–731 | `cbd_proximity = min(100, (float(cbd_m) / 10000) * 100)` (linear 0–10,000m) at line 731 | CONFIRMED line + indicator + 10km divisor; weight 0.20 UNVERIFIED at 731 |
| M10 | UNKNOWN per claim | actually CBD covered in WIRING-TRACES City Coverage Matrix line 201 — `cbd_distance_m | Y x 14 cities` | matrix HAS a row for cbd_distance_m | WRONG — claim "UNKNOWN (no DATA-CATALOG row)" overlooks the WIRING-TRACES row |
| M11 | N/A — no finding rule fires | confirmed by absence | — | CONFIRMED |
| W1–W18 | All cells | OS labels OK; HF rows out-of-scope with specific reason ("surfaced only inside other narratives") | — | PASS ×18 |

---

### `liveability.crashes_300m_serious`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | count of `serious` crashes ≤300m, 5yr | n/a (definitional) | finding text says "in 5 years" at 1882 | NOT-VERIFIABLE (window inferred from text) |
| M2 | Waka Kotahi CAS | DATA-PROVENANCE.md:114 | `nzta_crashes` row | CONFIRMED |
| M3 | NZTA CAS export — UNKNOWN endpoint | confirmed: `nzta_cas` not in data_loader.py | — | CONFIRMED (gap acknowledged) |
| M4 | `nzta_cas` (inventory); no `DataSource(...)` entry | confirmed | — | CONFIRMED |
| M5 | Table `crashes` | `Grep "CREATE TABLE crashes"` → only `scripts/load_all_datasets.py:253` (script-loaded; no migration) | matched | CONFIRMED with caveat — table created by script not by migration |
| M6 | `migrations/0054_flood_nearest_m.sql:589`, `cr` LATERAL | Read 589 | `'crashes_300m_serious', cr.serious_count,` | CONFIRMED |
| M7 | `HostedNeighbourhoodStats.tsx:75–77` Road safety block | Read 75–77 | `const crashTotal = live.crashes_300m_total ...; const crashFatal = ...; const crashSerious = ...;` | CONFIRMED |
| M7b | Finding `report_html.py:1879–1885` and `:1907` (humanised), `:2153–2154` (insight roll-up) | Read 1879–1885 + 2153–2154 | 1882: "{n} serious/fatal crashes within 300m in 5 years."; 2153: `crashes_serious = _int(live.get("crashes_300m_serious")) or 0` | CONFIRMED — note 1907 is the *transit* "excellent transit access" Insight, NOT a humanised crash finding |
| M7c | "(humanised)" claim re 1907 | line 1907 reads `result["liveability"].append(Insight(\n "ok",\n f"{transit} public transport stops within 400m. excellent transit access.{peak_str}"...` — unrelated to crashes | matched | WRONG — 1907 is not a humanised crash finding; cross-reference is incorrect |
| M8 | finding fires when `serious + fatal >= 3` | Read 1879 | `if crashes_serious + crashes_fatal >= 3:` | CONFIRMED |
| M9 | `road_safety` indicator, 0.15 weight, `risk_score.py:746` | Read 744–746 | `serious = ... + ...; indicators["road_safety"] = normalize_min_max(serious, 0, 20)` at 746 | CONFIRMED indicator + 0–20 normalisation; weight 0.15 UNVERIFIED at 746 |
| M10 | National CAS; coverage matrix UNKNOWN | confirmed: City Coverage Matrix has no `crashes_300m_*` row | matched | CONFIRMED (gap stated) |
| M11 | present — `_src("nzta_crashes")` at `report_html.py:1884` | Read 1884 | `source=_src("nzta_crashes"),` | CONFIRMED |
| W1–W18 | All cells | OS Renter "Bad crashes near here" lay; OS Pro mentions "not normalised for traffic volume" — defuses misreading; HF Pro carries source/vintage | — | PASS ×18 |

---

### `liveability.crashes_300m_fatal`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | count of fatal crashes 300m/5yr | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2–M5 | Same as serious (CAS / `nzta_cas` / `crashes`) | inherited | — | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:590` | Read 590 | `'crashes_300m_fatal', cr.fatal_count,` | CONFIRMED |
| M7 | `HostedNeighbourhoodStats.tsx:76` | Read | line 76: `const crashFatal = live.crashes_300m_fatal as number;` | CONFIRMED |
| M7b | Finding text at `report_html.py:1873`, `:1907`, `:1915` | Read 1873 = `crashes_fatal = live.get("crashes_300m_fatal") or 0` (assignment, not finding text); 1907 + 1915 are TRANSIT findings, not crash | matched | WRONG — line 1873 is variable assignment; 1907 + 1915 are not fatal-crash findings |
| M8 | combined with serious in `>=3` rule (no separate rule) | Read 1879 | confirmed | CONFIRMED |
| M9 | feeds `road_safety` with serious | risk_score.py:745–746 | `serious = ... + (liv.get("crashes_300m_fatal") or 0)` | CONFIRMED |
| M10 | National CAS | inherited | — | CONFIRMED |
| M11 | shares `_src("nzta_crashes")` Insight at `:1884` | Insight at 1880 includes both serious + fatal in same sentence | matched | CONFIRMED |
| W1–W18 | All cells | OS row "—" (combined with serious) — explicit reason; HF Pro has source attribution | — | PASS ×18 |

---

### `liveability.crashes_300m_total` (→ `crash_total`)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | total any-severity 300m/5yr | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2–M5 | Same as serious | inherited | — | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:591`; renamed `crash_total` via `transformReport()` | Read 591 + `Grep crash_total transformReport.ts` | 591 confirmed; **`crash_total` rename — 0 hits** in transformReport.ts | line 591 CONFIRMED; rename claim WRONG / UNVERIFIED — no `crash_total` alias exists in transformReport.ts |
| M7 | `HostedNeighbourhoodStats.tsx:75` | Read 75 | `const crashTotal = live.crashes_300m_total as number;` | CONFIRMED (uses original name `crashes_300m_total`, NOT `crash_total`) |
| M8 | no finding rule; used in `_crash_minor` at `report_html.py:4828` | Read 4828 | `_crash_minor = min(_safe_int(live.get("crashes_300m_total")) - _safe_int(live.get("crashes_300m_serious")), 10)` | CONFIRMED |
| M9 | not scored | confirmed (only serious+fatal feed road_safety) | — | CONFIRMED |
| M10 | National CAS | inherited | — | CONFIRMED |
| M11 | TODO — no source badge | confirmed | — | CONFIRMED |
| W1–W18 | All cells | OS row "— (out of scope: not rendered on-screen)" — specific; HF cells reasonable | — | PASS ×18 |

---

### `liveability.bus_stops_800m`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | count of `bus`-mode stops ≤800m | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2 | Regional operators | DATA-PROVENANCE.md:121 lists | `liveability.bus_stops_800m | … | varies (12 GTFS feeds)` | CONFIRMED |
| M3 | GTFS `stops.txt` filtered to bus | informal | — | CONFIRMED |
| M4 | 12 GTFS keys | grep all 12 confirmed | — | CONFIRMED |
| M5 | `metlink_stops` (Wellington direct), `transit_stops` (regional union) | conf | — | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:601`; `ml` LATERAL on `metlink_stops`; non-WLG via `_overlay_transit_data()`; cite `DATA-CATALOG.md:60` | Read 601 + `_overlay_transit_data` at `routers/property.py:200`; DATA-CATALOG.md:60 is a comment header line ("UPDATE: When adding a new GTFS city...") not the description claimed | 601 confirmed; overlay confirmed; `:60` cite WRONG — desc line is 64 (`12 cities. Data in transit_stops + ...`) |
| M7 | `TransportSection.tsx:119` Bus card; `HostedNeighbourhoodStats.tsx:103` | Read TransportSection:119 + HNS:103 | TS:119 = `{liveability.bus_stops_800m != null && liveability.bus_stops_800m > 0 && (`; HNS:103 = `const busStops = hasWalkingReach ? walkingReach.bus_stops : (live.bus_stops_800m as number);` | CONFIRMED |
| M8 | no in-line finding | confirmed (no Insight text grep'd for `bus_stops_800m`) | — | CONFIRMED |
| M9 | `bus_density` 0.10 weight `risk_score.py:743` inverse 0–30 | Read 743 | `indicators["bus_density"] = normalize_min_max(bus_800, 0, 30, inverse=True)` | CONFIRMED indicator + line + 0–30 inverse; weight 0.10 UNVERIFIED at 743 |
| M10 | 12 GTFS cities; not Christchurch / Invercargill at DATA-CATALOG.md:77 | actual line 81 | — | CONFIRMED content / WRONG line |
| M11 | N/A no finding | confirmed | — | CONFIRMED |
| W1–W18 | All cells | all PASS — specific out-of-scope reasons; HF Pro carries `transit_stops.mode_type` source | — | PASS ×18 |

---

### `liveability.rail_stops_800m`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1–M5 | inherits | — | — | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:602` | Read 602 | `'rail_stops_800m', ml.rail_count,` | CONFIRMED |
| M7 | `TransportSection.tsx:130`; `HostedNeighbourhoodStats.tsx:104` | Read both | TS:130 = `{liveability.rail_stops_800m != null …`; HNS:104 = `const railStops = hasWalkingReach ? walkingReach.rail_stops : (live.rail_stops_800m …)` | CONFIRMED |
| M8 | no finding rule on this | confirmed | — | CONFIRMED |
| M9 | not scored (rail proximity uses distance) | matches risk_score.py:737–739 | — | CONFIRMED |
| M10 | AT + Metlink meaningful | per DATA-PROVENANCE:122 | "Wellington + Auckland" | CONFIRMED |
| M11 | N/A | — | — | CONFIRMED |
| W1–W18 | All cells | PASS — labels concise; HF Pro carries source | — | PASS ×18 |

---

### `liveability.ferry_stops_800m`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1–M5 | inherits | — | — | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:603` | Read 603 | `'ferry_stops_800m', ml.ferry_count,` | CONFIRMED |
| M7 | `TransportSection.tsx:141`; `HostedNeighbourhoodStats.tsx:105` | Read both | TS:141 confirmed; HNS:105 = `const ferryStops = hasWalkingReach ? walkingReach.ferry_stops : (live.ferry_stops_800m …)` | CONFIRMED |
| M8 | no finding rule | confirmed | — | CONFIRMED |
| M9 | not separately scored | — | — | CONFIRMED |
| M10 | Auckland + Wellington Harbour | DATA-PROVENANCE:123 | "Wellington + Auckland" | CONFIRMED |
| M11 | N/A | — | — | CONFIRMED |
| W1–W18 | All cells | PASS — HF Pro mentions straight-line caveat addressing common-misreading | — | PASS ×18 |

---

### `liveability.cable_car_stops_800m`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1–M3 | inherits | — | — | CONFIRMED |
| M4 | `metlink_gtfs` only | grep confirmed | — | CONFIRMED |
| M5 | `metlink_stops` | conf at 0001_wellington_tables.sql:112 | — | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:604` | Read 604 | `'cable_car_stops_800m', ml.cable_car_count,` | CONFIRMED |
| M7 | `TransportSection.tsx:152`; `HostedNeighbourhoodStats.tsx:106` zeroes when walking-reach | Read both | TS:152 conf; HNS:106 = `const cableCarStops = hasWalkingReach ? 0 : (live.cable_car_stops_800m as number);` | CONFIRMED |
| M8 | no finding | confirmed | — | CONFIRMED |
| M9 | not scored | — | — | CONFIRMED |
| M10 | Wellington only — five Cable Car stops | not separately verified; plausible | — | UNVERIFIED — claim of "five" stops is not in any doc/code grep'd here |
| M11 | N/A | — | — | CONFIRMED |
| W1–W18 | All cells | All HF cells "— (out of scope: hidden by walking-reach branch)" with specific reason matching HNS:106 | — | PASS ×18 |

---

### `liveability.transit_travel_times` (AM peak)

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | `{destination, minutes, route_names}` array | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2 | GTFS + `transit_travel_times` job | DATA-CATALOG.md GTFS-transit | "Travel times" column populated | CONFIRMED |
| M3 | GTFS schedules, `REGIONAL_DESTINATIONS` | Grep `REGIONAL_DESTINATIONS` data_loader.py — not separately re-grepped here, but heavily referenced in inventory and snapshot. Plausible. | — | UNVERIFIED — `REGIONAL_DESTINATIONS` reference not separately re-grepped in this audit pass |
| M4 | same key set | grep'd | — | CONFIRMED |
| M5 | Table `transit_travel_times` | `migrations/0001_wellington_tables.sql:125` | `CREATE TABLE IF NOT EXISTS transit_travel_times (` | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:606`, `tt` LATERAL | Read 606 | `'transit_travel_times', tt.times,` | CONFIRMED |
| M7 | `TransportSection.tsx:168` (top 3 free, rest gated) | Read 167–224 | line 168 starts `{liveability.transit_travel_times && ...`; PremiumGate at 205; `FREE_ROUTES = 3` at 169 | CONFIRMED |
| M8 | first 3 free, rest paywalled | conf | — | CONFIRMED |
| M9 | not scored | — | — | CONFIRMED |
| M10 | 12 GTFS cities | DATA-CATALOG GTFS-transit | confirmed | CONFIRMED |
| M11 | TODO — no `<DataSourceBadge>` | not verified by direct grep here, but consistent with no `_src("gtfs_transit")` usage anywhere | — | UNVERIFIED — no Grep performed for `<DataSourceBadge>` in TransportSection.tsx |
| W1–W18 | All cells | PASS — HF Pro narrative carries source/vintage and excludes wait-time misreading | — | PASS ×18 |

---

### `liveability.transit_travel_times_pm`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | PM-peak shape | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2–M5 | inherits AM | — | — | CONFIRMED |
| M6 | not in SQL function — overlaid by `_overlay_transit_data()` | Read `routers/property.py:200–230` | line 228: `("bus_stops_800m", "rail_stops_800m", "ferry_stops_800m", "cable_car_stops_800m", "transit_travel_times", "transit_travel_times_pm",` | CONFIRMED |
| M7 | `TransportSection.tsx:173` gated | Read 173 | line 173: `const hasPm = liveability.transit_travel_times_pm && ...`; gating via `<PremiumGate>` at 205 | CONFIRMED |
| M8 | gated render only | conf | — | CONFIRMED |
| M9 | not scored | — | — | CONFIRMED |
| M10 | 12 GTFS cities | inherits | — | CONFIRMED |
| M11 | TODO same as AM | inherits | — | UNVERIFIED (same caveat as AM) |
| W1–W18 | PASS ×18 | — | — | PASS ×18 |

---

### `liveability.peak_trips_per_hour`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | trips/hr at busiest stop in peak window | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2 | GTFS + `transit_stop_frequency` job | conf | — | CONFIRMED |
| M3 | GTFS `stop_times.txt` aggregated | informal | — | CONFIRMED |
| M4 | same key set | grep'd | — | CONFIRMED |
| M5 | Table `transit_stop_frequency` at `migrations/0001_wellington_tables.sql:137` | conf | `CREATE TABLE IF NOT EXISTS transit_stop_frequency (` | CONFIRMED |
| M6 | `migrations/0054_flood_nearest_m.sql:608`, `tf` LATERAL | Read 608 | `'peak_trips_per_hour', tf.peak_trips_per_hour,` | CONFIRMED |
| M7 | `TransportSection.tsx:185` peak-services pill; finding logic at `report_html.py:1893–1920` | Read | TS:185 = `{liveability.peak_trips_per_hour != null && (`; pill text at 187 | CONFIRMED |
| M8 | combined with transit count rules `>=10 stops AND peak>=6` ok; `>=5 stops AND peak<=3` info | matched lines 1905–1919 | — | CONFIRMED |
| M9 | `commute_frequency`, 0.15 weight, `risk_score.py:735`, inverse 0–30 | Read 733–735 | `indicators["commute_frequency"] = normalize_min_max(float(peak), 0, 30, inverse=True)` | CONFIRMED indicator + line + 0–30 inverse; weight 0.15 UNVERIFIED at 735 |
| M10 | 12 GTFS cities | per City Coverage Matrix line 194 (`peak_trips_per_hour | Y x 11`, `-` for Christchurch / Invercargill / Gisborne) | CONFIRMED — note matrix shows Gisborne `-`, not just Christchurch + Invercargill |
| M11 | TODO — `report_html.py:1907` and `:1917` no `source=` | Read 1907, 1915–1920 | confirmed; **note: the relevant frequency-caveat Insight starts at line 1915, not 1917; the f-string body is at 1917** | CONFIRMED status; line cite "1917" is the f-string body, the Insight() call starts at 1915 — minor mis-cite |
| W1–W18 | PASS ×18 | OS Pro narrative carries "summed across routes" defusal of misreading | — | PASS ×18 |

---

### `liveability.nearest_stop_name`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | GTFS stop_name anchoring frequency / travel-times calcs | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2–M5 | inherits | — | — | CONFIRMED |
| M5b | "joined to `transit_stops`" — strict claim | not separately verified by reading SQL `tf` LATERAL definition | — | UNVERIFIED |
| M6 | `migrations/0054_flood_nearest_m.sql:609` | Read 609 | `'nearest_stop_name', tf.stop_name` | CONFIRMED |
| M7 | `TransportSection.tsx:196`; `HostedNeighbourhoodStats.tsx:115` | Read both | TS:196 = `{liveability.nearest_stop_name && (`; HNS:115 = `const nearestStopName = live.nearest_stop_name as string;` | CONFIRMED |
| M8 | display only | confirmed | — | CONFIRMED |
| M9 | not scored | — | — | CONFIRMED |
| M10 | 12 GTFS cities | inherited | — | CONFIRMED |
| M11 | N/A | — | — | CONFIRMED |
| W1–W18 | PASS ×18 | — | — | PASS ×18 |

---

### `liveability.walking_reach_10min`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | count of stops within 10-min walking isochrone (Valhalla / OSM) | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2 | WhareScore-computed (Valhalla / OSM) | — | — | CONFIRMED (definitional) |
| M3 | OSM + Valhalla, snapshot pipeline | — | — | CONFIRMED (informal) |
| M4 | `osm_road_network` | confirmed not in data_loader.py — UNKNOWN status correctly flagged | — | CONFIRMED (gap acknowledged) |
| M5 | derived in `snapshot_generator.py:940` | Read 940 | line 940 = `"isochrone": isochrone_data,` (this is the dict key; the *isochrone block* itself is computed earlier — line 940 is the snapshot return-dict entry, NOT the computation site) | WRONG — line 940 is dict-assembly, not "isochrone block"; computation is upstream |
| M6 | snapshot only — not in `get_property_report()` | confirmed; not in 0054 fields | — | CONFIRMED |
| M7 | `frontend/src/lib/compareSections.ts:279` row id `walking-reach` | Read 270–283 | row id `'walking-reach'` is at **line 275**, not 279 | WRONG — line cite off by 4 (275 vs 279) |
| M7b | "not rendered in TransportSection.tsx directly (which uses underlying `walking_reach.total_stops`)" | TransportSection:69 = `walkingReach && walkingReach.method !== 'none' && walkingReach.total_stops > 0` | matched | CONFIRMED |
| M8 | comparison row uses `higher-better` strategy | Read 277 | `strategy: 'higher-better',` | CONFIRMED |
| M9 | not scored | — | — | CONFIRMED |
| M10 | OSM coverage; UNKNOWN whether populated for free on-screen | — | — | CONFIRMED (gap acknowledged) |
| M11 | N/A | — | — | CONFIRMED |
| W1–W18 | PASS ×18 — OS row "out of scope: only used in compare" specific; HF cells render-able | — | — | PASS ×18 |

---

### `isochrone`

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| M1 | GeoJSON polygon of 10-min walking reach | n/a | n/a | n/a | NOT-VERIFIABLE |
| M2 | WhareScore-computed | — | — | CONFIRMED (definitional) |
| M3 | OSM + Valhalla | — | — | CONFIRMED (informal) |
| M4 | `osm_road_network` | not in data_loader.py | — | CONFIRMED (gap) |
| M5 | derived in `snapshot_generator.py:940`; persisted only inside snapshot | Read 940 | line 940 = `"isochrone": isochrone_data,` (snapshot dict key) | CONFIRMED — but note line 940 is the dict-key, computation is upstream |
| M6 | snapshot only — not in `get_property_report()` | matches | — | CONFIRMED |
| M7 | `HostedTerrain.tsx` per inventory row 289 | Read HostedTerrain | lines 177, 180, 190 reference `snapshot.isochrone` and isochrone fields | CONFIRMED — actual cite would be HostedTerrain.tsx:177–193 |
| M8 | visualisation only | conf | — | CONFIRMED |
| M9 | not scored | — | — | CONFIRMED |
| M10 | snapshots only | conf | — | CONFIRMED |
| M11 | N/A | — | — | CONFIRMED |
| W1–W18 | PASS ×18 — labels concise; HF Pro narrative carries Valhalla/OSM source | — | — | PASS ×18 |

---

## Tally

### Meaning-block claims

Per indicator, M-rows count varies (typical 11). Counted across 18 indicators:

| | Confirmed | Wrong | Unverified | Not-verifiable |
|---|---|---|---|---|
| Total meaning-block field rows | 158 | 11 | 8 | 23 |

Breakdown of WRONG (11):
1. `nearest_train_name` M7 — TransportSection does not render the name (only the distance card).
2. `cbd_distance_m` M3 — wrong filename `0023_get_transit_data.sql` (actual `0023_universal_transit.sql`).
3. `cbd_distance_m` M10 — claim "UNKNOWN" overlooks City Coverage Matrix row 201.
4. `crashes_300m_serious` M7c — line 1907 cited as "humanised crash finding" but it is the transit-access ok-Insight.
5. `crashes_300m_fatal` M7b — lines 1873/1907/1915 mis-cited (1873 is variable assignment; 1907/1915 are transit findings).
6. `crashes_300m_total` M6 — claim "transformReport renames to `crash_total`" — no such alias exists in `transformReport.ts`.
7. `bus_stops_800m` M6 — DATA-CATALOG.md:60 cite is wrong (should be :64 / :81).
8. `transit_stops_400m` M10 / `bus_stops_800m` M10 — DATA-CATALOG.md:77 cite for "not covered" should be :81.
9. `walking_reach_10min` M5 — "snapshot_generator.py:940 isochrone block" — line 940 is dict-key assignment, not the block.
10. `walking_reach_10min` M7 — `compareSections.ts:279` should be `:275`.
11. `peak_trips_per_hour` M11 — line 1917 is f-string body; the Insight() begins at 1915.

UNVERIFIED (8): `transit_stops_list` M7 (TransportSection rendering claim); `cable_car_stops_800m` M10 (count of "five"); `transit_travel_times` M3 (REGIONAL_DESTINATIONS) and M11 (DataSourceBadge grep skipped); `transit_travel_times_pm` M11; `nearest_stop_name` M5b (join); plus weight literals (0.10, 0.15, 0.20, 0.25 from `WEIGHTS_TRANSPORT` dict) — these dict values were not directly read from `risk_score.py`. The indicator names + lines + normalisations are CONFIRMED, but the numeric weights themselves were not verified in this audit.

### Wording cells (PASS / FAIL)

18 indicators × 18 cells = 324 wording cells.

| | PASS | FAIL |
|---|---|---|
| Wording cells | 324 | 0 |

All cells satisfy the explicit rule set: ≤60 chars on labels (all observed labels well under 60); 1 sentence on findings/narratives; out-of-scope cells include a specific reason of the form `— (out of scope: <reason>)`; common-misreading defusal present in at least one of Buyer-HF / Pro-HF or Buyer-OS / Pro-OS for indicators with a stated common misreading.

## Flagged rows requiring fix

- `nearest_train_name` field M7 (Rendered by) — claim "TransportSection.tsx (label paired with `nearest_train_distance_m`)" → WRONG → Fix: TransportSection only renders the *distance* card; the *name* is referenced inside `report_html.py:1923,1932` finding text. Replace M7 cite with `report_html.py:1923` (`train_name = live.get("nearest_train_name")`) and `:1932` (used inside finding f-string).
- `cbd_distance_m` field M3 (Dataset / endpoint) — claim "migration `0023_get_transit_data.sql`" → WRONG → Fix: rename to `0023_universal_transit.sql` (actual filename per migrations/ glob).
- `cbd_distance_m` field M10 (Coverage) — claim "UNKNOWN (no DATA-CATALOG row enumerates the seed list)" → INCOMPLETE → Fix: WIRING-TRACES City Coverage Matrix line 201 has `cbd_distance_m: Y` for all 14 cities. Coverage is in fact "all cities WhareScore covers". (The UNKNOWN about which CBD points are seeded remains valid as a separate sub-claim.)
- `crashes_300m_serious` field M7b — claim "report_html.py:1907 (humanised)" → WRONG → Fix: 1907 is the transit-access "excellent" Insight, not a crash finding. Remove the `:1907` cite.
- `crashes_300m_fatal` field M7b — claim "report_html.py:1873, :1907, :1915" → WRONG → Fix: 1873 is variable assignment; 1907/1915 are transit-access Insights. The fatal-crash finding text is exactly the same Insight as serious (both fold into the `crashes_serious + crashes_fatal >= 3` branch at 1879–1885).
- `crashes_300m_total` field M6 — claim "renamed to `crash_total` via `transformReport()`" → WRONG → Fix: `transformReport.ts` has no `crash_total` mapping. The field stays as `crashes_300m_total` end-to-end. The local conflict list at line 529 also asserts this rename; both should be removed.
- `bus_stops_800m` field M6 — claim "(per DATA-CATALOG.md:60)" → WRONG → Fix: actual descriptive text is at DATA-CATALOG.md:64; the `<!-- UPDATE: ... -->` at line 62 and the heading at 61.
- `transit_stops_400m` M10 + `bus_stops_800m` M10 — claim "(DATA-CATALOG.md:77)" for "Not covered: Christchurch, Invercargill" → WRONG → Fix: actual line is `DATA-CATALOG.md:81`.
- `walking_reach_10min` field M5 (Table) — claim "derived in `snapshot_generator.py:940` (isochrone block)" → WRONG (misleading) → Fix: line 940 is the snapshot-return-dict key assignment (`"isochrone": isochrone_data,`); the actual computation is at an earlier line. Investigate further: grep for `isochrone_data =` to find the assignment site.
- `walking_reach_10min` field M7 — claim "`compareSections.ts:279`" → WRONG → Fix: change to `compareSections.ts:275`.
- `peak_trips_per_hour` field M11 — claim "`report_html.py:1907 and :1917`" → WRONG (1907 is transit ok-Insight, 1917 is f-string body) → Fix: replace with `:1915` (the Insight() call) for the frequency-caveat finding.
- "Changes in this pass" row line 14 (`1907, 1915, 1932`) — `1907` and `1915` belong to *transit_stops_400m* findings, not the train-distance finding (`1932`). The grouping in the changelog is misleading; keep the line refs but do not associate `1907/1915` with `nearest_train_distance_m`.

## Notes for the next audit pass

- Verify the four `WEIGHTS_TRANSPORT` weight literals (0.10, 0.15, 0.20, 0.25) by reading the `WEIGHTS_TRANSPORT = { ... }` dict in `risk_score.py` — this audit only verified the indicator names + line numbers + normaliser shapes.
- Verify `REGIONAL_DESTINATIONS` definition in `data_loader.py` for `transit_travel_times` M3.
- Verify `<DataSourceBadge>` absence in `TransportSection.tsx` for the "TODO" source_key claims on AM/PM travel times.
- Read the `tf` LATERAL definition in `migrations/0054_flood_nearest_m.sql` to verify `nearest_stop_name` join-to-`transit_stops` claim.
- Confirm the actual line where `isochrone_data =` is assigned in `snapshot_generator.py` (line 940 is the dict key only).
