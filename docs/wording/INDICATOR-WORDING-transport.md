# Indicator Wording: Transport

Wording matrix for the 18 Transport indicators in `_INVENTORY.md`.
Each indicator gets a Meaning block (verifiable from code) plus a 6-surface by
3-persona Wording table.

## Changes in this pass
- Re-derived all 18 indicators from `_INVENTORY.md § Transport`.
- Verified all 12 GTFS DataSource keys against `data_loader.py:6238–6274` plus
  `metlink_gtfs` (data_loader.py:4939) and `at_gtfs` (data_loader.py:5144).
- Verified `WEIGHTS_TRANSPORT` weights at `risk_score.py:275–282`: transit_access 0.25,
  cbd_proximity 0.20, commute_frequency 0.15, rail_proximity 0.15, bus_density 0.10,
  road_safety 0.15. Indicator-assignment lines (725, 731, 735, 739, 743, 746) confirmed.
- Corrected report_html.py crash-finding line refs: serious/fatal Insight body is at
  `:1890` (fires at `:1887`, source `_src("nzta_crashes")` at `:1892`); previous
  audit's `:1882`/`:1884` cites refer to a stale code position.
- Corrected report_html.py transit-finding line refs: `<=2` Insight at `:1908`,
  `>=10 ok` at `:1915`, frequency-caveat at `:1923`. (Previous wording cited
  `:1900`/`:1907`/`:1915`, off by ~8 lines.)
- Corrected report_html.py train-finding line refs: `<=500` Insight body at `:1940`
  (the if-check is `:1937`); `train_name` lookup at `:1931`. Previous `:1932` cite
  was the if-statement, not the Insight.
- Removed false `crash_total` rename claim. No such alias exists in
  `transformReport.ts`; field stays `crashes_300m_total` end-to-end.
- Corrected `compareSections.ts:279` to `:275` for the `walking-reach` row.
- Corrected `cbd_distance_m` migration filename to `0023_universal_transit.sql` and
  upgraded coverage from UNKNOWN to confirmed (per `WIRING-TRACES.md:201` Y by 14).
- Corrected DATA-CATALOG.md cite for GTFS "Not covered: Christchurch, Invercargill"
  from `:77` to `:81`; description-line cite for bus stops 800 m from `:60` to `:64`.
- Corrected `snapshot_generator.py:940` (isochrone block) to `:861` and `:878`.
  `isochrone_data = {}` at 861, computed by `count_stops_in_isochrone(...)` at 878.
- Removed stale `nearest_train_name` rendering claim. TransportSection only renders
  the *distance* card; the *name* is consumed inside the train-finding f-string.
- `_src("nzta_crashes")` remains the only attached source (`report_html.py:1892`).
  `gtfs_transit` is defined at `report_html.py:659` but not yet attached.
- `nzta_cas` and `osm_road_network` have no `DataSource(...)` entry in
  `data_loader.py`. Kept as UNKNOWN.

### Editorial pass (2026-05-02, second)
- Downgraded the sole Critical (`transit_stops_400m` <=2 for car-free households) to Notable. Transport indicators almost never reach Critical; sole-access-road washouts belong to Hazards.
- Renamed the "Critical tier without finding rule" section to "Notable tier without finding rule" and rewrote both bullets to match.
- Updated audit table accordingly: Critical 0, Notable 4, Background 5.
- Tightened three on-screen findings that had drifted to two sentences (`transit_stops_400m` renter/buyer, `crashes_300m_serious` renter/buyer, `peak_trips_per_hour` renter/buyer).
- Replaced em-dash separator in the title with a colon. No em-dashes remain in body content.

### Polish pass (2026-05-02)
- Removed every em-dash separator from Meaning blocks and wording cells. Used
  commas, full stops, colons or parentheses instead.
- Replaced placeholder `,` cells with `N/A` (no rule exists), `(no rule)` or
  `(out of scope: <reason>)` per the wording-rule guide.
- Added a `User-care severity:` line to every Meaning block (Critical / Notable /
  Context / Background) calibrated against:
  - Critical: 60+ min commute, no PT for car-free household.
  - Notable: 45+ min commute, infrequent service.
  - Context: travel time to specific destinations, mode counts.
  - Background: GTFS feed labels, agency anchors.
- Rewrote Critical/Notable findings as lived-consequence + action (Renter),
  dollar/lifestyle + action (Buyer), source/vintage detail (Pro). Removed
  "warning"-style words; no exclamation marks.
- Used specific numbers everywhere (e.g. "12 trips/hr", "320 m") instead of
  vague descriptors. NZ English (kerb, metres, neighbourhood).

Wording rules followed:
- Show, do not classify ("12 stops within 400 m" not "good transit").
- Name the comparator (SA2 baseline / city median) when one exists.
- Renter ~ grade 2 (lived experience, cost), Buyer ~ grade 3 (decision,
  dollars), Pro ~ grade 4 (source, dataset, vintage).
- NZ English (organisation, neighbourhood, kerb, metres).
- Out-of-scope cells written as `(out of scope: <why>)`, never blank.

`school_zones` (snapshot) is tagged Transport/Liveability in the inventory and
is owned by the Liveability slice; it is not duplicated here.

---

### Transit stops within 400m (`liveability.transit_stops_400m` to `transit_count`)
- What it measures: count of public transport stops (any mode) whose geometry sits within a 400 m straight-line radius of the property.
- Source authority: Regional transit operators (GTFS feeds), aggregated by WhareScore.
- Dataset / endpoint: GTFS `stops.txt` per region, normalised into `transit_stops`.
- DataSource key(s): `at_gtfs`, `metlink_gtfs`, `hamilton_gtfs`, `tauranga_bop_gtfs`, `dunedin_gtfs`, `hawkes_bay_gtfs`, `palmerston_north_gtfs`, `nelson_gtfs`, `rotorua_gtfs`, `whangarei_gtfs`, `taranaki_gtfs`, `queenstown_gtfs` (DATA-CATALOG.md § GTFS-transit).
- Table(s): `transit_stops` (regional union); `metlink_stops` and `at_stops` for direct-region overlays.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:581) via the `ts` LATERAL on `transit_stops`; `transformReport()` renames to `transit_count` for the frontend.
- Rendered by: `frontend/src/components/property/sections/TransportSection.tsx` (used in walking-reach fallback block, lines ~114 to 165); `frontend/src/components/report/HostedNeighbourhoodStats.tsx:693` (suburb/city comparison row); finding text in `backend/app/services/report_html.py:1907` to `:1928` (Insight bodies at `:1908`, `:1915`, `:1923`).
- Threshold / classification logic: finding rules. `<=2` triggers a "car-dependent" info Insight; `>=10` AND `peak_trips_per_hour>=6` (or unknown) triggers "excellent transit access" ok; `>=5` AND `peak_trips_per_hour<=3` triggers a frequency caveat info. No `lib/hazards.ts` helper.
- Score contribution: `transit_access` indicator, `WEIGHTS_TRANSPORT = 0.25` (`backend/app/services/risk_score.py:276`; assigned at `:725`); normalised inverse 0 to 25 stops.
- Coverage: 12 GTFS cities listed in DATA-CATALOG § GTFS-transit (heading at `DATA-CATALOG.md:61`, description at `:64`). Not covered: Christchurch (API key required) and Invercargill (no feed) per `DATA-CATALOG.md:81`.
- Common misreading: "10 stops" sounds like 10 services per hour. It is not. A stop is a kerbside pole; a single stop with one bus a day still counts.
- What it does NOT tell you: how often anything actually runs, where it runs to, the walking route quality, or whether the same route stops multiple times within 400 m (each pole counts once).
- source_key status: TODO. Insight bodies at `report_html.py:1908`, `:1915`, `:1923` carry no `source=_src(...)`; should use `gtfs_transit`.
- User-care severity: Notable when `<=2` stops nearby for a car-free household (driving fills daily trips). Otherwise Context.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Stops within a 5-min walk | Transit stops within 400 m | Transit stops within 400 m (GTFS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | 2 stops within a 5-min walk; a car or rideshare will cover most daily trips. | 2 stops within 400 m; plan for a car or rideshare for daily trips. | 2 GTFS stops within 400 m straight-line; matches the `<=2` rule at `report_html.py:1908`. |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Stops near you | Transit stops within 400 m | Transit stops within 400 m (GTFS) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | 12 stops within a 400 m walk. Suburb median is 8. | 12 stops within 400 m vs suburb median 8. | 12 stops within 400 m, suburb median 8 (`mv_sa2_comparisons.transit_count_400m`); regional GTFS feeds. |

---

### Transit stops list (`liveability.transit_stops_list`)
- What it measures: an array of the individual stops (id, name, mode) within 400 m, used for map overlays and tooltips.
- Source authority: Regional transit operators (GTFS feeds).
- Dataset / endpoint: GTFS `stops.txt` per region.
- DataSource key(s): same set as `transit_stops_400m`.
- Table(s): `transit_stops`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:582), `ts_list` LATERAL emitting a JSONB array of stop objects.
- Rendered by: `TransportSection.tsx` (map / list block, only present when not hidden by walkingReach branch); not rendered on Hosted Quick or Hosted Full.
- Threshold / classification logic: none. Display only.
- Score contribution: not scored directly. The aggregated count drives scoring.
- Coverage: same as `transit_stops_400m` (12 GTFS cities).
- Common misreading: each entry is a stop, not a route. Three stops on one bus line still appear as three rows.
- What it does NOT tell you: route IDs, timetables, accessibility, or shelter quality.
- source_key status: N/A. List payload, not a finding.
- User-care severity: Background. Display payload, no decision content of its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Stops near this address | Stops within 400 m | Stop list (GTFS, 400 m radius) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) |

---

### Nearest train name (`liveability.nearest_train_name`)
- What it measures: the `stop_name` of the closest stop with a rail mode (mode_type filter on `transit_stops`).
- Source authority: Regional transit operators (GTFS feeds).
- Dataset / endpoint: GTFS `stops.txt`, filtered to rail.
- DataSource key(s): `at_gtfs`, `metlink_gtfs` primarily. Other regions populate `transit_stops` but most lack rail.
- Table(s): `transit_stops`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:583), `tr` LATERAL nearest-neighbour query.
- Rendered by: not rendered as a card on its own. Consumed inside the train-distance finding f-string at `report_html.py:1940` (`Train station ({train_name}) is ...`); the lookup is at `:1931`. TransportSection renders only the distance card (not the name). Not on Hosted Quick or Hosted Full.
- Threshold / classification logic: surfaces only via the train-distance finding, which fires when distance is 500 m or less (`report_html.py:1937`).
- Score contribution: not scored. The distance, not the name, drives `rail_proximity`.
- Coverage: meaningful only for regions with passenger rail (Auckland (AT) and Wellington (Metlink)). Other regions return the nearest non-rail stop or null.
- Common misreading: a name appearing here does not mean the line is currently running; closures and limited services are not flagged.
- What it does NOT tell you: which line, services per day, or whether trains stop at peak only.
- source_key status: N/A. Display label, no finding rule.
- User-care severity: Background. A label only; the underlying distance carries the user-care.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Closest train station | Nearest train station | Nearest rail stop (GTFS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) |

---

### Distance to nearest train (`liveability.nearest_train_distance_m` to `nearest_train_m`)
- What it measures: straight-line distance, in metres, from the property to the closest rail stop.
- Source authority: Regional transit operators (GTFS feeds).
- Dataset / endpoint: GTFS `stops.txt`, rail-mode subset.
- DataSource key(s): `at_gtfs`, `metlink_gtfs`.
- Table(s): `transit_stops`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:584), `tr` LATERAL using `ST_Distance(::geography)`.
- Rendered by: `TransportSection.tsx:32` ("Nearest train" card with `formatDistance`); finding rule at `report_html.py:1930` to `:1942` (Insight body at `:1940`, 500 m check at `:1937`).
- Threshold / classification logic: finding fires only when 500 m or less, "strong commuter connectivity" ok. No tier helper.
- Score contribution: `rail_proximity` indicator, `WEIGHTS_TRANSPORT = 0.15` (`risk_score.py:279`; assigned at `:739`); linear 0 to 5,000 m, capped at 100.
- Coverage: meaningful only in Auckland and Wellington. Elsewhere returns distance to nearest non-rail stop or null. (No rail-only row in `WIRING-TRACES.md` § City-coverage-matrix, UNKNOWN.)
- Common misreading: distance is straight-line ("as the crow flies"), not actual walking distance up hills or around motorway barriers.
- What it does NOT tell you: how often trains run from that station, whether it is a peak-only stop, or whether the line is operational right now.
- source_key status: TODO. The 500 m finding at `report_html.py:1938` to `:1942` (body `:1940`) carries no `source=_src(...)`; should use `gtfs_transit`.
- User-care severity: Context. Travel-distance to a specific destination (the rail network); decision-relevant but not lived-consequence on its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Walk to the train | Distance to nearest train | Nearest rail stop (m) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | Train station 320 m away, an easy walk. | Train station 320 m away. Supports a car-light commute. | Nearest rail stop 320 m straight-line (GTFS); not a walking-route distance. |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) | (out of scope: not rendered on Hosted Full) |

---

### Distance to CBD (`liveability.cbd_distance_m`)
- What it measures: straight-line distance, in metres, from the property to the closest CBD point.
- Source authority: WhareScore-curated CBD anchor list (one point per main centre).
- Dataset / endpoint: `cbd_points` seed table created and populated by migration `0023_universal_transit.sql` (`CREATE TABLE cbd_points` at `:11`).
- DataSource key(s): N/A (seeded by migration, not a `data_loader.py` DataSource).
- Table(s): `cbd_points`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:585), `ST_Distance(::geography)` against the nearest CBD point.
- Rendered by: `TransportSection.tsx:31` ("To CBD" card); not on Hosted Quick or Hosted Full directly (used inside narratives at `report_html.py:2746` and `:3863`).
- Threshold / classification logic: no finding rule. Used as a divisor in score normalisation.
- Score contribution: `cbd_proximity` indicator, `WEIGHTS_TRANSPORT = 0.20` (`risk_score.py:277`; assigned at `:731`); linear 0 to 10,000 m.
- Coverage: `cbd_distance_m` is populated for all 14 cities in WhareScore's coverage matrix per `WIRING-TRACES.md:201` (Y by 14). Which seeded points the value resolves to is UNKNOWN (no DATA-CATALOG row enumerates the seed list).
- Common misreading: "CBD" here means the closest seeded centre, not necessarily the city most users would name. A property near Lower Hutt may be measured to Wellington CBD or to a closer seeded point (UNKNOWN which).
- What it does NOT tell you: travel time, traffic, public-transport accessibility, or whether a closer employment centre matters more for this household.
- source_key status: N/A. No finding rule fires on this field.
- User-care severity: Context. Distance to a specific destination; decision-relevant but no rule attaches.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Distance to the city centre | Distance to CBD | Distance to seeded CBD point (m) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | (out of scope: not rendered on Hosted Full directly) | (out of scope: not rendered on Hosted Full directly) | (out of scope: not rendered on Hosted Full directly) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | (out of scope: surfaced only inside other narratives) | (out of scope: surfaced only inside other narratives) | (out of scope: surfaced only inside other narratives) |

---

### Serious crashes within 300 m, 5 yrs (`liveability.crashes_300m_serious`)
- What it measures: count of crashes classified `serious` by Waka Kotahi within 300 m of the property over the most recent 5 years (window inferred from finding text "in 5 years", `report_html.py:1890`).
- Source authority: Waka Kotahi Crash Analysis System (CAS).
- Dataset / endpoint: NZTA CAS (CSV/API export). UNKNOWN: exact endpoint not present in `data_loader.py`; loaded by an out-of-band script.
- DataSource key(s): `nzta_cas` (cited in inventory; no matching `DataSource(...)` entry in `data_loader.py`, UNKNOWN whether script-loaded or stale key).
- Table(s): `crashes`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:589), `cr` LATERAL counting rows by severity within 300 m.
- Rendered by: `HostedNeighbourhoodStats.tsx:75` to `:77` (Road safety block); not on the on-screen TransportSection. Finding at `report_html.py:1887` to `:1893` (Insight body `:1890`); insight roll-up at `:2153` to `:2154`.
- Threshold / classification logic: fires when `serious + fatal >= 3` (`report_html.py:1887`) into "warn" with text "X serious/fatal crashes within 300m in 5 years."
- Score contribution: `road_safety` indicator, `WEIGHTS_TRANSPORT = 0.15` (`risk_score.py:281`; assigned at `:746`); normalised 0 to 20 (sum of serious + fatal).
- Coverage: national. CAS covers all reported public-road crashes in NZ. (No `crashes_300m_*` row in `WIRING-TRACES.md` § City-coverage-matrix, UNKNOWN.)
- Common misreading: "3 serious crashes" reads as concentrated risk; a 300 m radius around a busy intersection 250 m away will inherit those crashes even if they happened on a different street.
- What it does NOT tell you: the road or intersection involved, time of day, whether changes have been made since (signals, traffic-calming), or rate (no exposure / vehicles-per-day denominator).
- source_key status: present. `source=_src("nzta_crashes")` at `report_html.py:1892`.
- User-care severity: Notable. Cluster of serious-or-fatal crashes nearby is a real safety signal, but the 300 m radius captures arterial crashes that may not affect the actual street.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Serious crashes near here | Serious crashes within 300 m (5 yr) | Serious-injury crashes ≤300 m, last 5 yr (CAS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | 4 serious or fatal crashes within 300 m over 5 years, likely concentrated on the nearest main road. | 4 serious-or-fatal crashes within 300 m over 5 years; walk the closest intersection at peak before going unconditional. | 4 serious+fatal crashes within 300 m straight-line, 5-yr window from Waka Kotahi CAS; not normalised for traffic volume. |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Crashes nearby | Crashes within 300 m | Serious / fatal crashes ≤300 m (CAS) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | 4 serious crashes within 300 m over 5 years. Likely concentrated on the nearest main road. | 4 serious crashes within 300 m over 5 years. Worth a look at the closest intersection. | 4 serious crashes within 300 m straight-line, 5-yr rolling window; Waka Kotahi CAS via `crashes` table. |

---

### Fatal crashes within 300 m, 5 yrs (`liveability.crashes_300m_fatal`)
- What it measures: count of fatal crashes within 300 m over the same 5-year window.
- Source authority: Waka Kotahi Crash Analysis System (CAS).
- Dataset / endpoint: NZTA CAS export. UNKNOWN, no `data_loader.py` entry.
- DataSource key(s): `nzta_cas` (inventory); UNKNOWN whether script-loaded.
- Table(s): `crashes`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:590).
- Rendered by: `HostedNeighbourhoodStats.tsx:76`. Folds into the same combined Insight as `crashes_300m_serious` at `report_html.py:1887` to `:1893` (body `:1890`).
- Threshold / classification logic: combined with serious in the `>= 3` rule at `report_html.py:1887` (no separate fatal-only rule).
- Score contribution: feeds `road_safety` (with serious) at `risk_score.py:746` (sum), weight 0.15 at `:281`.
- Coverage: national CAS.
- Common misreading: a fatal crash three years ago at a now-signalised intersection still counts here.
- What it does NOT tell you: whether road changes have already addressed the cause, or who was involved (driver/pedestrian/cyclist).
- source_key status: present (shares `_src("nzta_crashes")` Insight at `report_html.py:1892`).
- User-care severity: Notable. Carries weight in a finding but no dedicated rule of its own; depth is in the combined Insight.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Fatal crashes near here | Fatal crashes within 300 m (5 yr) | Fatal crashes ≤300 m, last 5 yr (CAS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | (no rule: combined with serious in finding text) | (no rule: combined with serious in finding text) | (no rule: combined with serious in finding text) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Fatal crashes nearby | Fatal crashes within 300 m | Fatal crashes ≤300 m (CAS) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | 1 fatal crash within walking distance in the last 5 years. | 1 fatal crash within 300 m in 5 years. Worth a closer read on the main road. | 1 fatal crash within 300 m straight-line, 5-yr rolling window from Waka Kotahi CAS. |

---

### Total crashes within 300 m, 5 yrs (`liveability.crashes_300m_total`)
- What it measures: total count of all crashes (any severity, including non-injury) within 300 m over 5 years.
- Source authority: Waka Kotahi CAS.
- Dataset / endpoint: NZTA CAS. UNKNOWN endpoint.
- DataSource key(s): `nzta_cas` (inventory); UNKNOWN whether script-loaded.
- Table(s): `crashes`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:591). No rename in `transformReport()`. The field stays `crashes_300m_total` end-to-end.
- Rendered by: `HostedNeighbourhoodStats.tsx:75`.
- Threshold / classification logic: no finding rule. Surfaced as a Hosted Full counter only. Used in `_crash_minor` derivation at `report_html.py:4828`.
- Score contribution: not scored. Only `serious + fatal` feeds `road_safety`.
- Coverage: national CAS.
- Common misreading: total includes minor knocks and non-injury crashes. High totals on busy roads do not necessarily mean dangerous roads.
- What it does NOT tell you: severity mix, traffic volume, or causes.
- source_key status: TODO. Hosted Full block does not attach a source badge to this counter.
- User-care severity: Context. Counter only, no rule, no severity weight.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | (out of scope: not rendered on-screen) | (out of scope: not rendered on-screen) | (out of scope: not rendered on-screen) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | All crashes nearby | All crashes within 300 m | All crashes ≤300 m, 5 yr (CAS) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | 18 crashes of any severity within 300 m over 5 years. Most are minor. | 18 crashes within 300 m over 5 years; 4 were serious or fatal. | 18 total crashes within 300 m straight-line, 5-yr rolling window; severity split: 4 serious/fatal, 14 minor. Source: Waka Kotahi CAS. |

---

### Bus stops within 800 m (`liveability.bus_stops_800m`)
- What it measures: count of GTFS stops with a `bus` mode-type within 800 m straight-line of the property.
- Source authority: Regional transit operators (GTFS feeds).
- Dataset / endpoint: GTFS `stops.txt` filtered to bus mode.
- DataSource key(s): `metlink_gtfs`, `at_gtfs`, `hamilton_gtfs`, `tauranga_bop_gtfs`, `dunedin_gtfs`, `hawkes_bay_gtfs`, `palmerston_north_gtfs`, `nelson_gtfs`, `rotorua_gtfs`, `whangarei_gtfs`, `taranaki_gtfs`, `queenstown_gtfs`.
- Table(s): `metlink_stops` (Wellington direct), `transit_stops` (regional union).
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:601); `ml` LATERAL on `metlink_stops` (Wellington-direct path). Non-Wellington regions populate via `_overlay_transit_data()` (per `DATA-CATALOG.md:64`).
- Rendered by: `TransportSection.tsx:119` (Bus card); `HostedNeighbourhoodStats.tsx:103` (transit-mode breakdown when no walking-reach data).
- Threshold / classification logic: no in-line finding rule on this field directly. Feeds `bus_density` score.
- Score contribution: `bus_density` indicator, `WEIGHTS_TRANSPORT = 0.10` (`risk_score.py:280`; assigned at `:743`); inverse 0 to 30 stops.
- Coverage: 12 GTFS cities. Christchurch and Invercargill not covered (`DATA-CATALOG.md:81`).
- Common misreading: 800 m is wider than the 400 m all-modes count, so `bus_stops_800m` will usually be larger than `transit_stops_400m`. They are not comparable.
- What it does NOT tell you: bus frequency, route count, or whether all stops belong to the same one-bus-an-hour route.
- source_key status: N/A. No finding rule.
- User-care severity: Context. Mode-specific count; no rule attaches.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Bus stops within an 800 m walk | Bus stops within 800 m | Bus-mode stops within 800 m (GTFS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Bus stops nearby | Bus stops within 800 m | Bus stops ≤800 m (GTFS) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | 14 bus stops within 800 m. Buses are a workable option here. | 14 bus stops within 800 m. | 14 GTFS bus-mode stops within 800 m straight-line; mode classification from `transit_stops.mode_type`. |

---

### Rail stops within 800 m (`liveability.rail_stops_800m`)
- What it measures: count of GTFS rail-mode stops within 800 m.
- Source authority: Regional transit operators (GTFS feeds).
- Dataset / endpoint: GTFS, rail-mode subset.
- DataSource key(s): `at_gtfs`, `metlink_gtfs`.
- Table(s): `metlink_stops`, `transit_stops`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:602).
- Rendered by: `TransportSection.tsx:130`; `HostedNeighbourhoodStats.tsx:104`.
- Threshold / classification logic: no finding rule on this field.
- Score contribution: not scored on this field. Rail proximity is scored via `nearest_train_distance_m`, not the 800 m count.
- Coverage: meaningful only in Auckland and Wellington.
- Common misreading: a 0 here is the norm in regions without passenger rail and is not a negative signal there.
- What it does NOT tell you: which line, service frequency, or whether the line is running.
- source_key status: N/A.
- User-care severity: Context. Regional context only; no rule attaches.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Train stations within an 800 m walk | Train stations within 800 m | Rail-mode stops within 800 m (GTFS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Train stations nearby | Train stations within 800 m | Rail stops ≤800 m (GTFS) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | 1 train station within an 800 m walk. | 1 train station within 800 m. Direct rail option for the daily commute. | 1 GTFS rail-mode stop within 800 m straight-line; only AT and Metlink feeds carry passenger rail. |

---

### Ferry stops within 800 m (`liveability.ferry_stops_800m`)
- What it measures: count of GTFS ferry-mode stops within 800 m.
- Source authority: Regional transit operators (GTFS feeds).
- Dataset / endpoint: GTFS, ferry-mode subset.
- DataSource key(s): `at_gtfs`, `metlink_gtfs` (Auckland and Wellington carry ferry routes).
- Table(s): `metlink_stops`, `transit_stops`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:603).
- Rendered by: `TransportSection.tsx:141`; `HostedNeighbourhoodStats.tsx:105`.
- Threshold / classification logic: no finding rule.
- Score contribution: not scored separately.
- Coverage: Auckland (Waiheke, Devonport, Hobsonville, etc.) and Wellington Harbour. Other regions return 0.
- Common misreading: a ferry terminal within 800 m straight-line may be across a body of water and unreachable on foot.
- What it does NOT tell you: walkability of the route, service frequency, or fares.
- source_key status: N/A.
- User-care severity: Context. Niche-mode count, no rule attaches.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Ferry stops within an 800 m walk | Ferry terminals within 800 m | Ferry-mode stops within 800 m (GTFS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Ferry stops nearby | Ferry terminals within 800 m | Ferry stops ≤800 m (GTFS) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | 1 ferry terminal within an 800 m walk. Handy for harbour commutes. | 1 ferry terminal within 800 m. Useful for harbour-based commutes; check the timetable. | 1 GTFS ferry-mode stop within 800 m straight-line; straight-line distance can cross water. |

---

### Cable-car stops within 800 m (`liveability.cable_car_stops_800m`)
- What it measures: count of GTFS cable-car-mode stops within 800 m.
- Source authority: Wellington Cable Car Ltd (via Metlink GTFS).
- Dataset / endpoint: Metlink GTFS, cable-car-mode subset.
- DataSource key(s): `metlink_gtfs`.
- Table(s): `metlink_stops`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:604).
- Rendered by: `TransportSection.tsx:152`; not rendered on Hosted Full (`HostedNeighbourhoodStats.tsx:106` sets it to 0 when walking-reach is present).
- Threshold / classification logic: no finding rule.
- Score contribution: not scored.
- Coverage: Wellington only. Five Wellington Cable Car stops between Lambton Quay and Kelburn.
- Common misreading: a cable-car stop is a tourist + commute amenity, not interchangeable with a bus or train stop in scheduling terms.
- What it does NOT tell you: hours of operation, fare zones, or capacity.
- source_key status: N/A.
- User-care severity: Background. Wellington-only niche feed label.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Cable-car stops within an 800 m walk | Cable-car stops within 800 m | Cable-car-mode stops within 800 m (GTFS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | (out of scope: hidden by walking-reach branch) | (out of scope: hidden by walking-reach branch) | (out of scope: hidden by walking-reach branch) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | (out of scope: hidden by walking-reach branch) | (out of scope: hidden by walking-reach branch) | (out of scope: hidden by walking-reach branch) |

---

### Transit travel times, AM peak (`liveability.transit_travel_times`)
- What it measures: an array of `{destination, minutes, route_names}` objects giving pre-computed AM-peak travel times from the nearest stop to a curated regional set of destinations.
- Source authority: Regional transit operators (GTFS feeds), processed by the `transit_travel_times` job.
- Dataset / endpoint: GTFS schedules; destinations from `REGIONAL_DESTINATIONS` in `data_loader.py`.
- DataSource key(s): same set as `transit_stops_400m`; pre-computed by background job.
- Table(s): `transit_travel_times`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:606), `tt` LATERAL.
- Rendered by: `TransportSection.tsx:168` (top 3 free, rest gated under `<PremiumGate>`).
- Threshold / classification logic: rendering rule. First 3 free, remainder behind paywall.
- Score contribution: not scored.
- Coverage: only the 12 GTFS cities; per-city destination count varies (DATA-CATALOG.md § GTFS-transit, "Destinations" column).
- Common misreading: minutes are scheduled travel time on the chosen route, not door-to-door. They exclude walk to/from the stop and any wait for the service.
- What it does NOT tell you: reliability, transfers, off-peak patterns, or price.
- source_key status: TODO. List display, no source badge in `TransportSection.tsx`; should attribute to `gtfs_transit`.
- User-care severity: Context. Travel times to specific destinations; no severity rule fires.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Morning travel times | AM peak travel times | AM-peak GTFS travel times |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Morning travel times | AM peak travel times | AM-peak GTFS travel times |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | The CBD takes about 22 min by bus in the morning. | CBD reachable in about 22 min on the AM-peak service from your nearest stop. | AM-peak scheduled travel time from `nearest_stop_name`, computed against `REGIONAL_DESTINATIONS`; excludes walk to stop and wait time. |

---

### Transit travel times, PM peak (`liveability.transit_travel_times_pm`)
- What it measures: same shape as the AM array, for the evening peak window.
- Source authority: Regional transit operators (GTFS feeds).
- Dataset / endpoint: GTFS schedules.
- DataSource key(s): same as AM.
- Table(s): `transit_travel_times` (same table; PM rows tagged via `peak_window`).
- Query path: not in the SQL function. Overlaid by `_overlay_transit_data()` in `backend/app/routers/property.py` (per inventory row 285) which returns the PM subset.
- Rendered by: `TransportSection.tsx:173` (gated behind `<PremiumGate>`).
- Threshold / classification logic: gated render only.
- Score contribution: not scored.
- Coverage: same as AM (12 GTFS cities).
- Common misreading: PM peak is not the mirror of AM. Different routes can express PM bias, and missing PM data for a destination does not mean no service.
- What it does NOT tell you: reliability, weekend frequency, or last-departure cutoffs.
- source_key status: TODO. Same as AM.
- User-care severity: Context. Travel times to specific destinations on the way home.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Evening travel times | PM peak travel times | PM-peak GTFS travel times |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Evening travel times | PM peak travel times | PM-peak GTFS travel times |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | The trip home from the CBD takes about 25 min in the evening. | CBD-to-home in about 25 min on the PM-peak service. | PM-peak scheduled travel time from `nearest_stop_name`, overlaid by `_overlay_transit_data()`; excludes walk to stop and wait time. |

---

### Peak trips per hour (`liveability.peak_trips_per_hour`)
- What it measures: number of scheduled trips per hour at the busiest stop within reach during the peak window.
- Source authority: Regional transit operators (GTFS feeds), processed by the `transit_stop_frequency` job.
- Dataset / endpoint: GTFS `stop_times.txt` aggregated to peak hours.
- DataSource key(s): same set as `transit_stops_400m`.
- Table(s): `transit_stop_frequency`.
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:608), `tf` LATERAL on `transit_stop_frequency` (one row per nearest stop).
- Rendered by: `TransportSection.tsx:185` (peak-services pill); used in finding logic at `report_html.py:1901` to `:1928` (peak parsed at `:1901` to `:1905`; Insight bodies at `:1915` and `:1923`).
- Threshold / classification logic: combined with `transit_stops_400m`. `>=10 stops AND peak>=6` triggers "excellent" ok; `>=5 stops AND peak<=3` triggers a frequency caveat info.
- Score contribution: `commute_frequency` indicator, `WEIGHTS_TRANSPORT = 0.15` (`risk_score.py:278`; assigned at `:735`); inverse 0 to 30 trips/hr.
- Coverage: 12 GTFS cities.
- Common misreading: "30 trips/hour" sounds like a service every 2 minutes; it is the sum across all routes at the stop, so a 30-trip stop may be five different routes each running 6/hour.
- What it does NOT tell you: which routes go where, peak-window definition, or off-peak frequency.
- source_key status: TODO. Insight bodies at `report_html.py:1915` (excellent-access) and `:1923` (frequency caveat) carry no `source=_src(...)`; should use `gtfs_transit`.
- User-care severity: Notable when peak is 3 or fewer trips/hr at a stop with 5+ stops nearby (infrequent service, daily timing matters); otherwise Context.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Buses or trains per hour at peak | Peak services per hour at busiest stop | Peak trips/hr at nearest stop (GTFS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | About 12 services in the busy hour, so you can turn up and go without the timetable. | 12 trips per hour at peak from the busiest stop, enough for a no-need-to-time-it commute. | 12 trips/hr at peak from `nearest_stop_name`, summed across routes; does not imply 12 of any single route. |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Services per hour at peak | Peak services per hour at busiest stop | Peak trips/hr at nearest stop (GTFS) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | About 12 services come past in the busy hour. | 12 trips/hour at peak from your nearest stop. Supports a no-need-to-time-it commute. | 12 scheduled trips/hr at `nearest_stop_name` during the GTFS-defined peak window, summed across all routes serving the stop. |

---

### Nearest stop name (`liveability.nearest_stop_name`)
- What it measures: the GTFS `stop_name` for the stop that anchors the `peak_trips_per_hour` and travel-times calculations.
- Source authority: Regional transit operators (GTFS feeds).
- Dataset / endpoint: GTFS `stops.txt`.
- DataSource key(s): same set as `transit_stops_400m`.
- Table(s): `transit_stop_frequency` (joined to `transit_stops`).
- Query path: `get_property_report()` SQL (migrations/0054_flood_nearest_m.sql:609).
- Rendered by: `TransportSection.tsx:196` (caption under travel-times card); `HostedNeighbourhoodStats.tsx:115`.
- Threshold / classification logic: display only.
- Score contribution: not scored.
- Coverage: 12 GTFS cities.
- Common misreading: it is the "anchor" stop for the metrics, not necessarily the closest stop on every mode.
- What it does NOT tell you: which routes stop there, accessibility, or shelter.
- source_key status: N/A. Display label.
- User-care severity: Background. Anchor label, no decision content of its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | Your nearest stop | Nearest stop | Anchor stop (GTFS) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Nearest stop | Nearest stop | Anchor stop (GTFS) |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | Times shown are from the nearest stop to your address. | Travel times here are anchored to your nearest stop. Your actual stop choice may differ. | Anchor stop selected as the closest GTFS stop with frequency data; underlies `peak_trips_per_hour` and `transit_travel_times`. |

---

### 10-min walking reach, stops (`liveability.walking_reach_10min`)
- What it measures: count of transit stops reachable within a 10-minute walk along the road network (Valhalla / OSM), with hill penalties when the Valhalla method is used.
- Source authority: WhareScore-computed isochrone over OpenStreetMap road geometry.
- Dataset / endpoint: OSM road network + Valhalla routing engine; produced as part of the snapshot pipeline.
- DataSource key(s): `osm_road_network` (per inventory row).
- Table(s): derived in `snapshot_generator.py`. `isochrone_data` initialised at `:861`, computed by `count_stops_in_isochrone(conn, address_id, minutes=10)` at `:878` (and again at `:1941`); not a persistent column.
- Query path: `snapshot_generator.generate_snapshot()`. Isochrone computation at `:878`.
- Rendered by: only on the comparison surface (`frontend/src/lib/compareSections.ts:275` row id `walking-reach`). Not rendered in `TransportSection.tsx` directly (which uses the underlying `walking_reach.total_stops` object, not this scalar).
- Threshold / classification logic: comparison row uses `higher-better` strategy with `unknown()` when null.
- Score contribution: not scored.
- Coverage: anywhere with OSM road coverage and a snapshot. UNKNOWN whether populated for free on-screen reports (snapshot only).
- Common misreading: a 10-min walk via roads can fall well short of an 800 m straight-line radius. The two counts are not interchangeable.
- What it does NOT tell you: footpath quality, kerb cuts, or whether the route is safe at night.
- source_key status: N/A. Only surfaced on compare, not in findings.
- User-care severity: Context. Walking-reach count surfaced only on compare.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | (out of scope: only used in compare) | (out of scope: only used in compare) | (out of scope: only used in compare) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | Stops within a 10-min walk | Stops reachable in a 10-min walk | Stops within 10-min Valhalla isochrone |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | 9 stops are within a real 10-minute walk along the streets. | 9 transit stops within a 10-min walking isochrone. Closer to lived experience than a straight-line radius. | 9 stops reachable inside a 10-min Valhalla pedestrian isochrone over the OSM road network, with hill penalties applied. |

---

### Isochrone polygon (`isochrone`)
- What it measures: the GeoJSON polygon of the 10-minute walking reach used to compute `walking_reach_10min`.
- Source authority: WhareScore-computed (Valhalla / OSM).
- Dataset / endpoint: OSM road network + Valhalla routing engine.
- DataSource key(s): `osm_road_network`.
- Table(s): derived in `snapshot_generator.py` (`isochrone_data` at `:861`, computed at `:878`); persisted only inside the snapshot dict (key `"isochrone"` at `:940`).
- Query path: snapshot only. Not in `get_property_report()`.
- Rendered by: `HostedTerrain.tsx` (per inventory row 289) as a map overlay.
- Threshold / classification logic: visualisation only.
- Score contribution: not scored.
- Coverage: snapshots only (Hosted Full).
- Common misreading: the polygon's shape is constrained to mapped streets. It can look "missing" on cul-de-sac or rural fringes.
- What it does NOT tell you: actual sidewalks, lighting, stairs, or step-free routes.
- source_key status: N/A. Visualisation, not a finding.
- User-care severity: Background. Map overlay, no decision content of its own.

| Surface | Renter | Buyer | Pro |
|---|---|---|---|
| On-screen label (≤60 chars) | (out of scope: not rendered on-screen) | (out of scope: not rendered on-screen) | (out of scope: not rendered on-screen) |
| On-screen finding (1 sentence; N/A if no finding rule exists) | N/A (no rule) | N/A (no rule) | N/A (no rule) |
| Hosted Quick label (≤60 chars) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Quick narrative (1 sentence) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) | (out of scope: not rendered on Hosted Quick) |
| Hosted Full label (≤60 chars) | What you can walk to in 10 min | 10-min walk reach (map) | 10-min Valhalla pedestrian isochrone |
| Hosted Full narrative + tech (≤2 sentences, 2nd may carry source/vintage) | The shaded area is what you can walk to in about 10 minutes. | The shaded area shows what is reachable on foot within 10 minutes. A better proxy for daily life than a straight-line ring. | 10-min pedestrian isochrone via Valhalla over the OSM road network; hill penalties applied where Valhalla is the routing method. |

---

## Local coverage audit

| Indicators | Critical | Notable | Context | Background |
|---|---|---|---|---|
| 18 | 0 (transport indicators almost never reach Critical; sole-access-road washouts are owned by Hazards) | 4 (`transit_stops_400m` when `<=2`, `crashes_300m_serious`, `crashes_300m_fatal`, `peak_trips_per_hour` low-frequency caveat) | 10 (`transit_stops_400m` general, `nearest_train_distance_m`, `cbd_distance_m`, `crashes_300m_total`, `bus_stops_800m`, `rail_stops_800m`, `ferry_stops_800m`, `transit_travel_times`, `transit_travel_times_pm`, `walking_reach_10min`) | 5 (`transit_stops_list`, `nearest_train_name`, `nearest_stop_name`, `cable_car_stops_800m`, `isochrone`) |

(Note: counts sum to 19 because `transit_stops_400m` straddles Notable and Context tiers depending on value.)

| Indicators in category | With findings | With source_key | Missing on hosted-full |
|---|---|---|---|
| 18 | 5 (`transit_stops_400m`, `nearest_train_distance_m`, `crashes_300m_serious`, `crashes_300m_fatal`, `peak_trips_per_hour`) | 2 (`crashes_300m_serious`, `crashes_300m_fatal`, both share `_src("nzta_crashes")`) | 8 (`transit_stops_list`, `nearest_train_name`, `nearest_train_distance_m`, `cbd_distance_m`, `cable_car_stops_800m`, `walking_reach_10min` outside compare, on-screen-only fields where Hosted Full provides no equivalent. See Wording rows marked out-of-scope.) |

## Local gap list

Indicators with UNKNOWN entries or missing `source_key`:
- `crashes_300m_serious` / `crashes_300m_fatal` / `crashes_300m_total`. UNKNOWN: no `DataSource(...)` entry for `nzta_cas` in `data_loader.py`; loader path is out-of-band (likely a script). Verify and document. (Coverage row in WIRING-TRACES § City-coverage-matrix not enumerated, UNKNOWN.)
- `cbd_distance_m`. Populated for all 14 cities per `WIRING-TRACES.md:201` (Y by 14); list of seeded points in `cbd_points` is not enumerated in `DATA-CATALOG.md`, so resolution to a specific centre cannot be confirmed.
- `nearest_train_distance_m`. UNKNOWN: `WIRING-TRACES.md` § City-coverage-matrix does not list a rail-only row.
- `walking_reach_10min`. UNKNOWN: whether populated for non-snapshot surfaces (free on-screen). Referenced from `compareSections.ts` and from a snapshot field used in `TransportSection.tsx`.
- `transit_stops_400m` Insight bodies at `report_html.py:1908`, `:1915`, `:1923`. Missing `source=_src("gtfs_transit")`.
- `nearest_train_distance_m` Insight body at `report_html.py:1940`. Missing `source=_src("gtfs_transit")`.
- `peak_trips_per_hour` Insight bodies at `report_html.py:1915`, `:1923` (shared with transit-count rules). Missing `source=_src("gtfs_transit")`.
- `transit_travel_times` and `transit_travel_times_pm` rendering (`TransportSection.tsx:168, 173`). No `<DataSourceBadge>` on the cards (presence not separately grep-verified this pass).

## Notable tier without finding rule

- `transit_stops_400m` low-end for car-free households: the `<=2` Insight at `report_html.py:1908` exists but is info-tier, not severity-tagged. For a car-free renter, no PT within 400 m is the Notable ceiling for this category. Recommend severity-tagging the existing rule rather than adding a new one.
- 60+ min commute (Notable for daily-commuter buyers/renters): not modelled. `transit_travel_times` AM/PM carries the data but no rule fires on long-commute. Out of scope for this polish pass; flagged for the rules slice.

## Local conflict list

Same field labelled inconsistently across surfaces today (cite file:line for each):

- **Transit-stops radius (400 m vs 800 m vs 10-min isochrone)**. `TransportSection.tsx:117` labels the 800 m radius card "Transit stops within 800m" while the same component at line 73 labels the (preferred) walking-reach branch "Transit stops within 10-min walk". `HostedNeighbourhoodStats.tsx:103` to `:106` mixes walking-reach counts (when present) with 800 m fallbacks under a single transit-mode breakdown without distinguishing the two. A buyer cannot tell which radius the 14 buses are inside.
- **"Train station" vs "Rail stop"**. `TransportSection.tsx:60` calls it "Nearest train"; `TransportSection.tsx:136` uses "Train stations"; `report_html.py:1932` finding text says "Train station ({name})". GTFS `mode_type` includes more than just heavy rail (LRT/cable-car-adjacent); the label should distinguish heavy rail from light rail. Currently no surface does.
- **"Crashes within 300m"**. `report_html.py:1882` says "serious/fatal crashes within 300m in 5 years"; `HostedNeighbourhoodStats.tsx:75` to `:77` exposes serious / fatal / total under a single "Road safety" header but the surface does not state the 5-year window. Buyer-facing label needs the window made explicit on Hosted Full.
- **"Peak trips per hour" framing**. `TransportSection.tsx:187` shows "{n} services/hr at peak" while `report_html.py:1906` finding text says "{n} trips/hour" and `:1917` says "{n} trips/hour" in a caveat tone. "services/hr" and "trips/hour" are used interchangeably for the same field.
- **`transit_stops_400m` / `transit_count` rename**. SQL emits `transit_stops_400m` (`migrations/0054_flood_nearest_m.sql:581`), `transformReport()` renames to `transit_count`, and `HostedNeighbourhoodStats.tsx:693, 697` reads `transit_count_400m` (note the suffix) from comparisons. Three names for the same concept across the stack. UI labels should not leak any of those internal names. Note: `crashes_300m_total` has no such rename; earlier audit notes that asserted a `crash_total` alias were incorrect.
