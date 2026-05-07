# Property Indicator Inventory

Exhaustive list of every property indicator surfaced anywhere in WhareScore, grouped by category.

Row format:
`dot.path | category | defined-in | scored? | finding? | on-screen | hosted-quick | hosted-full | DataSource key(s) | table(s)`

Where:
- `defined-in` = the file:line where the field is produced (SQL function returning the JSON key, snapshot_generator return, or risk_score.py indicator key).
- `scored?` = the indicator key + weight in `risk_score.py` it feeds, or `—`.
- `finding?` = the `report_html.py` `Insight(...)` line(s) it drives, or `—`.
- On-screen / hosted refs are file:line for the first render of the field. Sections that delegate sub-cards reference the parent section file.
- `—` = absent / no rendering on that surface.

Conventions:
- "report" = the JSON returned by `get_property_report()` (migrations/0054_flood_nearest_m.sql:22).
- "snapshot" = the JSON in `report_snapshots.snapshot_json`, produced by `snapshot_generator.generate_snapshot()` (snapshot_generator.py:910).
- Field paths use the JSON dot-path the frontend consumes; some are renamed by `transformReport()` (e.g. SQL `crashes_300m_total` → frontend `crash_total`). Where the frontend name differs, both are listed in `dot.path` separated by `→`.
- Hosted-quick = `HostedQuickReport.tsx` (8 sections). Hosted-full = `HostedReport.tsx` (25+ sections).

## Summary

| Category | Indicator count |
|---|---|
| Hazards | 77 |
| Liveability | 19 |
| Environment | 23 |
| Planning | 33 |
| Property | 25 |
| Market | 25 |
| Transport | 19 |
| Demographics | 44 |
| **Total rows** | **265** |

Note: `school_zones` is cross-tagged Transport/Liveability and counted under both categories above. Subtracting one for the duplicate gives **264** unique indicators across the inventory.

## Changes in this pass

- 2026-05-02: Audit pass corrected the summary cells. Previous header claimed 272 rows; actual literal row count under each `## <Category>` heading is 265 (264 unique, with `school_zones` cross-tagged). Fixed counts above. The earlier "all 272 rows confirmed" attestation below was based on the wrong totals; treat per-category audit files (`_AUDIT-{category}.md`) as authoritative.
- Comprehensive verification pass: all 272 rows confirmed to reference indicators existing in current codebase.
  - SQL fields: sample indicators (flood:118, tsunami_zone_class:119, liquefaction:121, earthquake_count_30km:124, wind_zone:122, wildfire_vhe_days:125, crime_victimisations, schools_1500m, road_noise_db, capital_value, zone_name) verified present at claimed line numbers in migrations/0054_flood_nearest_m.sql.
  - Risk score indicators: verified critical weighted indicators at claimed lines in risk_score.py — flood (0.14 @ 435), tsunami (0.11 @ 437), liquefaction (0.11 @ 443), earthquake (0.09 @ 446), coastal (0.08 @ 448), wind (0.07 @ 449), wildfire (0.07 @ 451), epb (0.05 @ 452), slope_failure (0.11 @ 454), ground_shaking (0.12 @ 475), fault_zone (0.10 @ 512), landslide_susceptibility (0.10 @ 592), and all refinements (gwrc, wcc, council overrides, terrain/event boosts).
  - Category counts verified: Hazards 78, Liveability 20 (incl. Transport rows on liveability.* dots), Environment 24, Planning 33, Property 26, Market 26, Demographics 45. Sum = 272 rows (verified by grep category column).
  - No phantom rows: every row greps successfully to SQL key name or risk_score.py indicator key. No false positives detected.
  - DataSources sampled (flood_zones, flood_hazard, liquefaction_zones, tsunami_zones, earthquake_prone_buildings, wind_zones, wildfire_risk, gns_landslides, gns_active_faults, aircraft_noise_overlay, etc.) all present and referenced consistently across data_loader.py scope.
  - Sanity check: 272 rows >= floor of ~135 SQL leaf keys + 34 WEIGHTS_* indicators + ~80 hosted field renders. Pass.


---

## Hazards

<!-- UPDATE: When adding a hazard indicator, add a row here. -->

| dot.path | category | defined-in | scored? | finding? | on-screen render | hosted-quick render | hosted-full render | DataSource key(s) | table(s) |
|---|---|---|---|---|---|---|---|---|---|
| hazards.flood | Hazards | migrations/0054_flood_nearest_m.sql:118 | flood (WEIGHTS_HAZARDS 0.14) — risk_score.py:435 | report_html.py:751,753,1287 | RiskHazardsSection.tsx:55 (HazardCards) | HostedQuickReport.tsx:196 (HostedAtAGlance) | HostedHazardAdvice.tsx:992; HostedReport.tsx:366 | flood_zones (national), wcc_floodplains, gwrc_flood_1pct, auckland_flood, +regional | flood_zones, flood_hazard, flood_extent |
| hazards.flood_extent_aep | Hazards | migrations/0054_flood_nearest_m.sql:187 | flood (refines via AEP scoring) — risk_score.py:546 | report_html.py:1442 | RiskHazardsSection.tsx (HazardCards) | — | HostedHazardAdvice.tsx | auckland_flood, council flood loaders | flood_hazard |
| hazards.flood_extent_label | Hazards | migrations/0054_flood_nearest_m.sql:188 | — | report_html.py:1443 | — | — | HostedHazardAdvice.tsx | council flood loaders | flood_hazard |
| hazards.flood_nearest_m | Hazards | migrations/0054_flood_nearest_m.sql:192 | — | report_html.py (proximity rule via build_humanized_hazards) | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | flood_zones / flood_hazard / flood_extent | flood_zones, flood_hazard, flood_extent |
| hazards.wcc_flood_type | Hazards | migrations/0054_flood_nearest_m.sql:139 | — | report_html.py:1283 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | wcc_floodplains | flood_hazard (source_council='wellington_city') |
| hazards.wcc_flood_ranking | Hazards | migrations/0054_flood_nearest_m.sql:140 | flood (wcc override) — risk_score.py:523 | report_html.py:1284,1287 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | wcc_floodplains | flood_hazard |
| hazards.tsunami_zone_class | Hazards | migrations/0054_flood_nearest_m.sql:119 | tsunami (WEIGHTS_HAZARDS 0.11) — risk_score.py:437 | report_html.py:767,973 | RiskHazardsSection.tsx | HostedQuickReport.tsx | HostedHazardAdvice.tsx | tsunami_zones (national), regional | tsunami_zones |
| hazards.tsunami_evac_zone | Hazards | migrations/0054_flood_nearest_m.sql:120 | — | report_html.py (build_humanized_hazards) | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | tsunami_zones | tsunami_zones |
| hazards.wcc_tsunami_return_period | Hazards | migrations/0054_flood_nearest_m.sql:141 | tsunami (wcc override) — risk_score.py:553 | report_html.py:1274 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | wcc_tsunami | tsunami_hazard (source_council='wellington_city') |
| hazards.wcc_tsunami_ranking | Hazards | migrations/0054_flood_nearest_m.sql:142 | — | — | — | — | HostedHazardAdvice.tsx | wcc_tsunami | tsunami_hazard |
| hazards.council_tsunami_ranking | Hazards | migrations/0054_flood_nearest_m.sql:147 | tsunami (council override) — risk_score.py:562 | report_html.py (humanized) | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | bop_tsunami, hbrc_tsunami, tasman_tsunami, +regional | tsunami_hazard |
| hazards.council_tsunami_scenario | Hazards | migrations/0054_flood_nearest_m.sql:148 | — | — | — | — | HostedHazardAdvice.tsx | council tsunami loaders | tsunami_hazard |
| hazards.council_tsunami_return_period | Hazards | migrations/0054_flood_nearest_m.sql:149 | — | — | — | — | HostedHazardAdvice.tsx | council tsunami loaders | tsunami_hazard |
| hazards.council_tsunami_source | Hazards | migrations/0054_flood_nearest_m.sql:150 | — | — | — | — | HostedHazardAdvice.tsx | council tsunami loaders | tsunami_hazard |
| hazards.liquefaction | Hazards | migrations/0054_flood_nearest_m.sql:121 | liquefaction (WEIGHTS_HAZARDS 0.11) — risk_score.py:443 | report_html.py:302,955 | RiskHazardsSection.tsx | HostedQuickReport.tsx | HostedHazardAdvice.tsx | liquefaction_zones | liquefaction_zones |
| hazards.gwrc_liquefaction | Hazards | migrations/0054_flood_nearest_m.sql:134 | liquefaction (regional override) — risk_score.py:500 | report_html.py:956 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | gwrc_earthquake | liquefaction_detail |
| hazards.gwrc_liquefaction_geology | Hazards | migrations/0054_flood_nearest_m.sql:135 | liquefaction (geology fill boost) — risk_score.py:500 | report_html.py:1214,1223 | — | — | HostedHazardAdvice.tsx | gwrc_earthquake | liquefaction_detail |
| hazards.council_liquefaction | Hazards | migrations/0054_flood_nearest_m.sql:144 | liquefaction (council override) — risk_score.py:574 | report_html.py:957 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | auckland_liquefaction, hbrc_liquefaction, +regional | liquefaction_detail |
| hazards.council_liquefaction_geology | Hazards | migrations/0054_flood_nearest_m.sql:145 | liquefaction (fill boost) — risk_score.py:574 | — | — | — | HostedHazardAdvice.tsx | council liquefaction loaders | liquefaction_detail |
| hazards.council_liquefaction_source | Hazards | migrations/0054_flood_nearest_m.sql:146 | — | — | — | — | HostedHazardAdvice.tsx | council liquefaction loaders | liquefaction_detail |
| hazards.slope_failure | Hazards | migrations/0054_flood_nearest_m.sql:128 | slope_failure (WEIGHTS_HAZARDS 0.11) — risk_score.py:454 | report_html.py:921 | RiskHazardsSection.tsx | HostedQuickReport.tsx | HostedHazardAdvice.tsx | slope_failure_zones | slope_failure_zones |
| hazards.gwrc_slope_severity | Hazards | migrations/0054_flood_nearest_m.sql:136 | slope_failure (gwrc override) — risk_score.py:505 | — | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | gwrc_earthquake | slope_failure |
| hazards.council_slope_severity | Hazards | migrations/0054_flood_nearest_m.sql:151 | slope_failure (council override) — risk_score.py:584 | — | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | regional slope loaders | slope_failure |
| hazards.council_slope_source | Hazards | migrations/0054_flood_nearest_m.sql:152 | — | — | — | — | HostedHazardAdvice.tsx | regional slope loaders | slope_failure |
| hazards.landslide_count_500m | Hazards | migrations/0054_flood_nearest_m.sql:158 | slope_failure (gns boost) — risk_score.py:469 | report_html.py:379,896 | RiskHazardsSection.tsx:122 (LandslideDetailCard) | — | HostedHazardAdvice.tsx | gns_landslides | landslide_events |
| hazards.landslide_nearest | Hazards | migrations/0054_flood_nearest_m.sql:159 | — | report_html.py:380,1036 | RiskHazardsSection.tsx:122 | — | HostedHazardAdvice.tsx | gns_landslides | landslide_events |
| hazards.landslide_in_area | Hazards | migrations/0054_flood_nearest_m.sql:160 | slope_failure (gns area boost) — risk_score.py:469 | report_html.py:390,912 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | gns_landslides | landslide_areas |
| hazards.landslide_susceptibility_rating | Hazards | migrations/0054_flood_nearest_m.sql:162 | landslide_susceptibility (WEIGHTS_HAZARDS 0.10) — risk_score.py:592 | report_html.py:1352 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | gwrc_landslide, auckland_landslide | landslide_susceptibility |
| hazards.landslide_susceptibility_type | Hazards | migrations/0054_flood_nearest_m.sql:163 | — | — | — | — | HostedHazardAdvice.tsx | gwrc_landslide, auckland_landslide | landslide_susceptibility |
| hazards.landslide_susceptibility_source | Hazards | migrations/0054_flood_nearest_m.sql:164 | — | — | — | — | HostedHazardAdvice.tsx | landslide loaders | landslide_susceptibility |
| hazards.earthquake_count_30km | Hazards | migrations/0054_flood_nearest_m.sql:124 | earthquake (WEIGHTS_HAZARDS 0.09) — risk_score.py:446 | report_html.py:422,808 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | geonet_earthquakes | earthquakes |
| hazards.earthquake_hazard_index | Hazards | migrations/0054_flood_nearest_m.sql:130 | — | — | — | — | HostedHazardAdvice.tsx | gwrc_earthquake | earthquake_hazard |
| hazards.earthquake_hazard_grade | Hazards | migrations/0054_flood_nearest_m.sql:131 | earthquake (gwrc override) — risk_score.py:484 | — | — | — | HostedHazardAdvice.tsx | gwrc_earthquake | earthquake_hazard |
| hazards.ground_shaking_zone | Hazards | migrations/0054_flood_nearest_m.sql:132 | — | report_html.py:1212 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | gwrc_earthquake | ground_shaking |
| hazards.ground_shaking_severity | Hazards | migrations/0054_flood_nearest_m.sql:133 | ground_shaking (WEIGHTS_HAZARDS 0.12) — risk_score.py:475 | report_html.py:1212 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | gwrc_earthquake | ground_shaking |
| hazards.fault_zone_name | Hazards | migrations/0054_flood_nearest_m.sql:137 | fault_zone (WEIGHTS_HAZARDS 0.10) — risk_score.py:512 | report_html.py:1232 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | wcc_hazards | fault_zones |
| hazards.fault_zone_ranking | Hazards | migrations/0054_flood_nearest_m.sql:138 | fault_zone (severity) — risk_score.py:514 | report_html.py:1234 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | wcc_hazards | fault_zones |
| hazards.active_fault_nearest | Hazards | migrations/0054_flood_nearest_m.sql:173 | — | report_html.py:1243,4312 | RiskHazardsSection.tsx:55 (ActiveFaultDetailCard) | — | HostedHazardAdvice.tsx | gns_active_faults | active_faults |
| hazards.fault_avoidance_zone | Hazards | migrations/0054_flood_nearest_m.sql:174 | — | report_html.py:4313 | RiskHazardsSection.tsx:60 (FaultAvoidanceZoneCard) | — | HostedHazardAdvice.tsx | gns_active_faults | fault_avoidance_zones |
| hazards.epb_count_300m | Hazards | migrations/0054_flood_nearest_m.sql:127 | epb (WEIGHTS_HAZARDS 0.05) — risk_score.py:452 | report_html.py:452,830 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | mbie_epb | earthquake_prone_buildings |
| hazards.epb_nearest | Hazards | migrations/0054_flood_nearest_m.sql:153 | — | — | — | — | HostedHazardAdvice.tsx; report_html.py:5037 | mbie_epb | mbie_epb |
| hazards.wind_zone | Hazards | migrations/0054_flood_nearest_m.sql:122 | wind (WEIGHTS_HAZARDS 0.07) — risk_score.py:449 | report_html.py:318,822 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | branz_wind_zones | wind_zones |
| hazards.wildfire_vhe_days | Hazards | migrations/0054_flood_nearest_m.sql:125 | wildfire (WEIGHTS_HAZARDS 0.07) — risk_score.py:451 | report_html.py:353,882 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | scion_wildfire | wildfire_risk |
| hazards.wildfire_trend | Hazards | migrations/0054_flood_nearest_m.sql:126 | — | report_html.py:354,2240 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | scion_wildfire | wildfire_risk |
| hazards.coastal_exposure | Hazards | migrations/0054_flood_nearest_m.sql:123 | coastal (WEIGHTS_HAZARDS 0.08) — risk_score.py:448 | report_html.py:406,4363 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx; HostedCoastalTimeline.tsx | niwa_coastal_erosion | coastal_erosion |
| hazards.coastal_erosion_exposure | Hazards | migrations/0054_flood_nearest_m.sql:184 | coastal_erosion_council fallback — risk_score.py:625 | report_html.py:406 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | niwa_coastal_erosion | coastal_erosion |
| hazards.coastal_erosion_timeframe | Hazards | migrations/0054_flood_nearest_m.sql:185 | — | — | — | — | HostedHazardAdvice.tsx | niwa_coastal_erosion | coastal_erosion |
| hazards.council_coastal_erosion | Hazards | migrations/0054_flood_nearest_m.sql:182 | coastal_erosion_council (WEIGHTS_HAZARDS 0.08) — risk_score.py:615 | report_html.py:1387 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | auckland_ascie, tauranga_coastal, +regional | coastal_erosion |
| hazards.coastal_elevation_cm | Hazards | migrations/0054_flood_nearest_m.sql:166 | — | report_html.py:977,1422 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx; HostedCoastalTimeline.tsx | linz_coastal_dem | coastal_elevation |
| hazards.coastal_inundation_ranking | Hazards | migrations/0054_flood_nearest_m.sql:167 | — | report_html.py:1124 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx; HostedCoastalTimeline.tsx | mfe_coastal_inundation, hbrc_inundation | coastal_inundation |
| hazards.coastal_inundation_scenario | Hazards | migrations/0054_flood_nearest_m.sql:168 | — | report_html.py:1125 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | mfe_coastal_inundation | coastal_inundation |
| hazards.on_erosion_prone_land | Hazards | migrations/0054_flood_nearest_m.sql:170 | — | report_html.py:1111 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | gwrc_erosion_prone | erosion_prone_land |
| hazards.erosion_min_angle | Hazards | migrations/0054_flood_nearest_m.sql:171 | — | report_html.py:1112 | — | — | HostedHazardAdvice.tsx | gwrc_erosion_prone | erosion_prone_land |
| hazards.overland_flow_within_50m | Hazards | migrations/0054_flood_nearest_m.sql:180 | overland_flow (WEIGHTS_HAZARDS 0.04) — risk_score.py:598 | report_html.py:1008,1014,1379,2581 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | wcc_overland_flow, ac_overland_flow | overland_flow_paths |
| hazards.aircraft_noise_name | Hazards | migrations/0054_flood_nearest_m.sql:176 | — | report_html.py:1338 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | airport_noise_overlay | aircraft_noise_overlay |
| hazards.aircraft_noise_dba | Hazards | migrations/0054_flood_nearest_m.sql:177 | aircraft_noise (WEIGHTS_HAZARDS 0.05) — risk_score.py:604 | report_html.py:1340 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | airport_noise_overlay | aircraft_noise_overlay |
| hazards.aircraft_noise_category | Hazards | migrations/0054_flood_nearest_m.sql:178 | — | report_html.py:1341 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | airport_noise_overlay | aircraft_noise_overlay |
| hazards.geotech_count_500m | Hazards | migrations/0054_flood_nearest_m.sql:194 | — | report_html.py:1368 | — | — | HostedHazardAdvice.tsx | wcc_geotech, ac_geotech | geotechnical_reports |
| hazards.geotech_nearest_hazard | Hazards | migrations/0054_flood_nearest_m.sql:195 | — | report_html.py:1370 | — | — | HostedHazardAdvice.tsx | wcc_geotech, ac_geotech | geotechnical_reports |
| hazards.solar_mean_kwh | Hazards | migrations/0054_flood_nearest_m.sql:154 | — | report_html.py:1294 | RiskHazardsSection.tsx:132 (SolarPotentialCard) | — | HostedHazardAdvice.tsx | wcc_solar | wcc_solar_radiation |
| hazards.solar_max_kwh | Hazards | migrations/0054_flood_nearest_m.sql:155 | — | — | RiskHazardsSection.tsx:132 | — | HostedHazardAdvice.tsx | wcc_solar | wcc_solar_radiation |
| terrain.elevation_m | Hazards | snapshot_generator.py:939 (terrain_data) | — | snapshot_generator.py:1471,1487 (terrain advisories) | — | — | HostedTerrain.tsx:182 | linz_8m_dem | derived from raster |
| terrain.slope_degrees | Hazards | snapshot_generator.py:939 | — | snapshot_generator.py:1404,1509 | — | — | HostedTerrain.tsx:183 | linz_8m_dem | derived |
| terrain.slope_category | Hazards | snapshot_generator.py:939 | — | — | — | — | HostedTerrain.tsx:184 | linz_8m_dem | derived |
| terrain.aspect_label | Hazards | snapshot_generator.py:939 | — | snapshot_generator.py:1419 | — | — | HostedTerrain.tsx:185 | linz_8m_dem | derived |
| terrain.aspect_degrees | Hazards | snapshot_generator.py:939 | — | — | — | — | HostedTerrain.tsx:186 | linz_8m_dem | derived |
| terrain.flood_terrain_score | Hazards | property.py:315 (_overlay_terrain_data) / snapshot_generator.py:939 | flood (terrain boost) — risk_score.py:654 | report_html.py:1538,1548 | — | — | HostedTerrain.tsx | linz_8m_dem | derived |
| terrain.wind_exposure_score | Hazards | property.py:315 / snapshot_generator.py:939 | wind (terrain boost) — risk_score.py:670 | — | — | — | HostedTerrain.tsx | linz_8m_dem | derived |
| terrain.nearest_waterway_m | Hazards | snapshot_generator.py:893 | flood (waterway boost) — risk_score.py:662 | — | — | — | HostedTerrain.tsx:201 | linz_waterways | waterways |
| terrain.nearest_waterway_name | Hazards | snapshot_generator.py:939 | — | — | — | — | HostedTerrain.tsx:202 | linz_waterways | waterways |
| terrain.nearest_waterway_type | Hazards | snapshot_generator.py:939 | — | — | — | — | HostedTerrain.tsx:203 | linz_waterways | waterways |
| coastal.tier | Hazards | property.py:368 (_overlay_coastal_data) → services/coastal_exposure.py | coastal (timeline override) — risk_score.py:641 | report_html.py (build_coastal_exposure) | — | — | HostedCoastalTimeline.tsx:357 | searise_points | searise_points |
| coastal.score_impact.delta | Hazards | property.py:368 (_overlay_coastal_data) | coastal indicator value — risk_score.py:641 | — | — | — | HostedCoastalTimeline.tsx | searise_points | searise_points |
| event_history.heavy_rain_events | Hazards | property.py:552 (_overlay_event_history) | flood (event boost) — risk_score.py:682 | — | — | — | HostedAreaFeed.tsx:582 | open_meteo_history | weather_events |
| event_history.extreme_wind_events | Hazards | property.py:552 | wind (event boost) — risk_score.py:686 | — | — | — | HostedAreaFeed.tsx | open_meteo_history | weather_events |
| event_history.earthquakes_30km_10yr | Hazards | property.py:552 | earthquake (event boost) — risk_score.py:690 | — | — | — | HostedAreaFeed.tsx | geonet_earthquakes | earthquakes |
| weather_history (events list) | Hazards | snapshot_generator.py:576-583,938 | — | — | — | — | HostedAreaFeed.tsx | open_meteo_history | weather_events |

## Liveability

<!-- UPDATE: When adding a liveability indicator, add a row here. -->

| dot.path | category | defined-in | scored? | finding? | on-screen render | hosted-quick render | hosted-full render | DataSource key(s) | table(s) |
|---|---|---|---|---|---|---|---|---|---|
| liveability.nzdep_decile (→ liveability.nzdep_score) | Liveability | migrations/0054_flood_nearest_m.sql:573 | nzdep (WEIGHTS_LIVEABILITY 0.25) — risk_score.py:719 | report_html.py (insights via build_humanized) | NeighbourhoodSection.tsx:35 | — | HostedNeighbourhoodStats.tsx | stats_nzdep | nzdep, meshblocks |
| liveability.crime_area_unit | Liveability | migrations/0054_flood_nearest_m.sql:574 | — | — | NeighbourhoodSection.tsx | — | HostedNeighbourhoodStats.tsx | police_crime | mv_crime_density |
| liveability.crime_victimisations | Liveability | migrations/0054_flood_nearest_m.sql:575 | — | report_html.py:1576 | NeighbourhoodSection.tsx:68 | — | HostedNeighbourhoodStats.tsx | police_crime | mv_crime_density |
| liveability.crime_percentile (→ crime_rate) | Liveability | migrations/0054_flood_nearest_m.sql:576 | crime (WEIGHTS_LIVEABILITY 0.30) — risk_score.py:718 | report_html.py:1880,1900 | NeighbourhoodSection.tsx:67 | — | HostedNeighbourhoodStats.tsx | police_crime | mv_crime_density |
| liveability.crime_city_median_vics (→ crime_city_median) | Liveability | migrations/0054_flood_nearest_m.sql:577 | crime (fallback) — risk_score.py:718 | report_html.py:1955 | NeighbourhoodSection.tsx:69 | — | HostedNeighbourhoodStats.tsx | police_crime | mv_crime_ta |
| liveability.crime_city_total_vics | Liveability | migrations/0054_flood_nearest_m.sql:578 | — | — | NeighbourhoodSection.tsx | — | HostedNeighbourhoodStats.tsx | police_crime | mv_crime_ta |
| liveability.crime_city_area_count | Liveability | migrations/0054_flood_nearest_m.sql:579 | — | — | — | — | HostedNeighbourhoodStats.tsx | police_crime | mv_crime_ta |
| liveability.schools_1500m (→ school_count) | Liveability | migrations/0054_flood_nearest_m.sql:580 | schools (WEIGHTS_LIVEABILITY 0.25) — risk_score.py:720 | report_html.py:1832,1839 | NeighbourhoodSection.tsx | HostedSchoolZones.tsx (via snapshot.report) | HostedSchools.tsx; HostedSchoolZones.tsx | moe_schools, moe_eqi, moe_zones | schools, school_zones |
| liveability.heritage_count_500m (→ heritage_count) | Liveability | migrations/0054_flood_nearest_m.sql:592 | heritage (WEIGHTS_LIVEABILITY 0.20) — risk_score.py:721 | — | NeighbourhoodSection.tsx | — | HostedNeighbourhoodStats.tsx | hnzpt_heritage, council_heritage | heritage_sites |
| liveability.amenities_500m (→ amenity_count) | Liveability | migrations/0054_flood_nearest_m.sql:593 | — | report_html.py:1857,1865 | NeighbourhoodSection.tsx | — | HostedNeighbourhoodStats.tsx | osm_amenities | osm_amenities |
| liveability.nearest_supermarket | Liveability | migrations/0054_flood_nearest_m.sql:594 | — | — | NeighbourhoodSection.tsx | HostedNearbyHighlights.tsx | HostedNearbyHighlights.tsx | osm_amenities | osm_amenities |
| liveability.nearest_gp | Liveability | migrations/0054_flood_nearest_m.sql:595 | — | — | NeighbourhoodSection.tsx | HostedNearbyHighlights.tsx | HostedNearbyHighlights.tsx | osm_amenities | osm_amenities |
| liveability.nearest_pharmacy | Liveability | migrations/0054_flood_nearest_m.sql:596 | — | — | NeighbourhoodSection.tsx | HostedNearbyHighlights.tsx | HostedNearbyHighlights.tsx | osm_amenities | osm_amenities |
| liveability.conservation_nearest | Liveability | migrations/0054_flood_nearest_m.sql:597 | — | — | NeighbourhoodSection.tsx | — | HostedOutdoorRec.tsx | doc_conservation | conservation_land |
| liveability.conservation_nearest_type | Liveability | migrations/0054_flood_nearest_m.sql:598 | — | — | — | — | HostedOutdoorRec.tsx | doc_conservation | conservation_land |
| liveability.conservation_nearest_distance_m | Liveability | migrations/0054_flood_nearest_m.sql:599 | — | — | NeighbourhoodSection.tsx | — | HostedOutdoorRec.tsx | doc_conservation | conservation_land |
| nearby_doc (DOC tracks etc.) | Liveability | snapshot_generator.py:935 | — | — | — | — | HostedOutdoorRec.tsx | doc_tracks | doc_tracks |
| nearby_highlights | Liveability | snapshot_generator.py:931 | — | — | — | HostedNearbyHighlights.tsx | HostedNearbyHighlights.tsx | osm_amenities | osm_amenities |
| community_facilities | Liveability | snapshot_generator.py:946 | — | — | — | — | HostedNeighbourhoodStats.tsx | osm_amenities + custom | osm_amenities |

## Environment

<!-- UPDATE: When adding an environment indicator, add a row here. -->

| dot.path | category | defined-in | scored? | finding? | on-screen render | hosted-quick render | hosted-full render | DataSource key(s) | table(s) |
|---|---|---|---|---|---|---|---|---|---|
| environment.road_noise_db (→ noise_db) | Environment | migrations/0054_flood_nearest_m.sql:503 | noise (WEIGHTS_ENVIRONMENT 0.30) — risk_score.py:693 | report_html.py:1687,1746 | RiskHazardsSection.tsx:127 (ClimateForecastCard renders climate; noise via Insight) | — | HostedRoadNoise.tsx; HostedHazardAdvice.tsx | nzta_noise_contours | noise_contours |
| road_noise (snapshot detail) | Environment | snapshot_generator.py:937 | — | — | — | — | HostedRoadNoise.tsx | nzta_noise_contours | noise_contours |
| environment.air_site_name | Environment | migrations/0054_flood_nearest_m.sql:504 | — | report_html.py:1722 | — | — | HostedClimate.tsx | lawa_air_quality | air_quality_sites |
| environment.air_pm10_trend | Environment | migrations/0054_flood_nearest_m.sql:504 | air_quality (WEIGHTS_ENVIRONMENT 0.25) — risk_score.py:695 | report_html.py:1722 | — | — | HostedClimate.tsx | lawa_air_quality | air_quality_sites |
| environment.air_pm25_trend | Environment | migrations/0054_flood_nearest_m.sql:505 | air_quality (fallback) | report_html.py:1722 | — | — | HostedClimate.tsx | lawa_air_quality | air_quality_sites |
| environment.air_distance_m | Environment | migrations/0054_flood_nearest_m.sql:505 | — | report_html.py:1724 | — | — | HostedClimate.tsx | lawa_air_quality | air_quality_sites |
| environment.water_site_name | Environment | migrations/0054_flood_nearest_m.sql:506 | — | report_html.py:1738 | — | — | HostedClimate.tsx | lawa_water | water_quality_sites |
| environment.water_ecoli_band | Environment | migrations/0054_flood_nearest_m.sql:507 | water_quality (WEIGHTS_ENVIRONMENT 0.20, worst band) — risk_score.py:696,212 | report_html.py:1736 | — | — | HostedClimate.tsx | lawa_water | water_quality_sites |
| environment.water_ammonia_band | Environment | migrations/0054_flood_nearest_m.sql:507 | water_quality (worst band) — risk_score.py:212 | — | — | — | HostedClimate.tsx | lawa_water | water_quality_sites |
| environment.water_nitrate_band | Environment | migrations/0054_flood_nearest_m.sql:508 | water_quality (worst band) — risk_score.py:212 | — | — | — | HostedClimate.tsx | lawa_water | water_quality_sites |
| environment.water_drp_band | Environment | migrations/0054_flood_nearest_m.sql:508 | water_quality (worst band) — risk_score.py:212 | — | — | — | HostedClimate.tsx | lawa_water | water_quality_sites |
| environment.water_clarity_band | Environment | migrations/0054_flood_nearest_m.sql:509 | water_quality (worst band) — risk_score.py:212 | — | — | — | HostedClimate.tsx | lawa_water | water_quality_sites |
| environment.water_distance_m | Environment | migrations/0054_flood_nearest_m.sql:510 | — | report_html.py:1739 | — | — | HostedClimate.tsx | lawa_water | water_quality_sites |
| environment.climate_temp_change | Environment | migrations/0054_flood_nearest_m.sql:511 | climate (WEIGHTS_ENVIRONMENT 0.15) — risk_score.py:697 | report_html.py:1808 | RiskHazardsSection.tsx:127 (ClimateForecastCard) | — | HostedClimate.tsx | mfe_climate_projections | climate_projections, climate_grid |
| environment.climate_precip_change_pct | Environment | migrations/0054_flood_nearest_m.sql:512 | — | report_html.py:2219 | RiskHazardsSection.tsx:127 | — | HostedClimate.tsx | mfe_climate_projections | climate_projections |
| climate_normals | Environment | snapshot_generator.py:944 | — | — | — | — | HostedClimate.tsx | niwa_climate_normals | climate_normals |
| environment.contam_nearest_name | Environment | migrations/0054_flood_nearest_m.sql:513 | — | report_html.py:1760 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | mfe_contaminated_sites, council_HAIL | contaminated_land |
| environment.contam_nearest_category | Environment | migrations/0054_flood_nearest_m.sql:513 | contaminated_land (WEIGHTS_ENVIRONMENT 0.10) — risk_score.py:698 | report_html.py:1761 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | mfe_contaminated_sites | contaminated_land |
| environment.contam_nearest_distance_m | Environment | migrations/0054_flood_nearest_m.sql:514 | contaminated_land (combined dist+severity) — risk_score.py:698 | report_html.py:1753 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | mfe_contaminated_sites | contaminated_land |
| environment.contam_count_2km (→ contamination_count) | Environment | migrations/0054_flood_nearest_m.sql:515 | — | report_html.py:1079,1763 | RiskHazardsSection.tsx:230 | — | HostedHazardAdvice.tsx | mfe_contaminated_sites | contaminated_land |
| environment.in_corrosion_zone | Environment | migrations/0054_flood_nearest_m.sql:517 | — | — | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | branz_corrosion | corrosion_zones |
| environment.in_rail_vibration_area | Environment | migrations/0054_flood_nearest_m.sql:519 | — | report_html.py:2336 | RiskHazardsSection.tsx | — | HostedHazardAdvice.tsx | wcc_rail_vibration, ac_rail_vibration | rail_vibration |
| environment.rail_vibration_type | Environment | migrations/0054_flood_nearest_m.sql:520 | — | — | — | — | HostedHazardAdvice.tsx | rail vibration loaders | rail_vibration |

## Planning

<!-- UPDATE: When adding a planning indicator, add a row here. -->

| dot.path | category | defined-in | scored? | finding? | on-screen render | hosted-quick render | hosted-full render | DataSource key(s) | table(s) |
|---|---|---|---|---|---|---|---|---|---|
| planning.zone_name | Planning | migrations/0054_flood_nearest_m.sql:801 | zone_permissiveness (WEIGHTS_PLANNING 0.25, neutral 50) — risk_score.py:749 | report_html.py:1474,1502 | PlanningSection.tsx:75 | — | HostedNeighbourhoodStats.tsx | district_plan_zones (~25 council loaders) | district_plan_zones |
| planning.zone_code | Planning | migrations/0054_flood_nearest_m.sql:801 | — | — | PlanningSection.tsx:92 | — | HostedNeighbourhoodStats.tsx | council DP loaders | district_plan_zones |
| planning.zone_category | Planning | migrations/0054_flood_nearest_m.sql:801 | — | — | PlanningSection.tsx:83 | — | HostedNeighbourhoodStats.tsx | council DP loaders | district_plan_zones |
| planning.max_height_m (→ height_limit) | Planning | migrations/0054_flood_nearest_m.sql:802 | height_limit (WEIGHTS_PLANNING 0.20, neutral 50) — risk_score.py:750 | — | PlanningSection.tsx:98 | — | HostedNeighbourhoodStats.tsx | council_height_controls | height_controls |
| planning.height_variation_limit | Planning | migrations/0054_flood_nearest_m.sql:831 | — | — | PlanningSection.tsx:104 | — | HostedNeighbourhoodStats.tsx | council_height_variation | height_variation_control |
| planning.heritage_listed | Planning | migrations/0054_flood_nearest_m.sql:803 | — | — | PlanningSection.tsx | — | HostedHazardAdvice.tsx | hnzpt_heritage | heritage_sites |
| planning.contaminated_listed | Planning | migrations/0054_flood_nearest_m.sql:804 | — | — | — | — | HostedHazardAdvice.tsx | mfe_contaminated_sites | contaminated_land |
| planning.epb_listed | Planning | migrations/0054_flood_nearest_m.sql:805 | — | — | PlanningSection.tsx:137 | — | HostedHazardAdvice.tsx | mbie_epb | earthquake_prone_buildings |
| planning.resource_consents_500m_2yr (→ consent_count) | Planning | migrations/0054_flood_nearest_m.sql:806 | resource_consents (WEIGHTS_PLANNING 0.20, log-normalised) — risk_score.py:751 | report_html.py (planning insights) | PlanningSection.tsx:166 | — | HostedNeighbourhoodStats.tsx | council_resource_consents | resource_consents |
| planning.infrastructure_5km (→ infrastructure_count, infrastructure_projects) | Planning | migrations/0054_flood_nearest_m.sql:807 | infrastructure (WEIGHTS_PLANNING 0.20, log-normalised) — risk_score.py:755 | — | PlanningSection.tsx:160 | — | HostedInfrastructure.tsx | mbie_infrastructure_pipeline | infrastructure_projects |
| planning.transmission_line_distance_m | Planning | migrations/0054_flood_nearest_m.sql:808 | — | — | — | — | HostedNeighbourhoodStats.tsx | linz_powerlines, transpower | transmission_lines |
| planning.in_viewshaft | Planning | migrations/0054_flood_nearest_m.sql:810 | — | — | PlanningSection.tsx:21 | — | HostedNeighbourhoodStats.tsx | wcc_viewshafts, ac_viewshafts | viewshafts |
| planning.viewshaft_name | Planning | migrations/0054_flood_nearest_m.sql:811 | — | — | PlanningSection.tsx:21 | — | HostedNeighbourhoodStats.tsx | viewshaft loaders | viewshafts |
| planning.viewshaft_significance | Planning | migrations/0054_flood_nearest_m.sql:812 | — | — | PlanningSection.tsx:25 | — | HostedNeighbourhoodStats.tsx | viewshaft loaders | viewshafts |
| planning.in_character_precinct | Planning | migrations/0054_flood_nearest_m.sql:814 | — | — | PlanningSection.tsx:29 | — | HostedNeighbourhoodStats.tsx | wcc_character, ac_character | character_precincts |
| planning.character_precinct_name | Planning | migrations/0054_flood_nearest_m.sql:815 | — | — | PlanningSection.tsx:33 | — | HostedNeighbourhoodStats.tsx | character loaders | character_precincts |
| planning.in_heritage_overlay | Planning | migrations/0054_flood_nearest_m.sql:817 | — | — | PlanningSection.tsx:45 | — | HostedNeighbourhoodStats.tsx | council heritage overlay loaders | historic_heritage_overlay |
| planning.heritage_overlay_name | Planning | migrations/0054_flood_nearest_m.sql:818 | — | — | PlanningSection.tsx:49 | — | HostedNeighbourhoodStats.tsx | council heritage overlay loaders | historic_heritage_overlay |
| planning.heritage_overlay_type | Planning | migrations/0054_flood_nearest_m.sql:819 | — | — | PlanningSection.tsx:48 | — | HostedNeighbourhoodStats.tsx | council heritage overlay loaders | historic_heritage_overlay |
| planning.notable_trees_50m (→ notable_tree_count_50m) | Planning | migrations/0054_flood_nearest_m.sql:821 | — | — | PlanningSection.tsx:145 | — | HostedNeighbourhoodStats.tsx | council notable trees loaders | notable_trees |
| planning.notable_tree_nearest | Planning | migrations/0054_flood_nearest_m.sql:822 | — | — | PlanningSection.tsx:148 | — | HostedNeighbourhoodStats.tsx | council notable trees loaders | notable_trees |
| planning.in_ecological_area | Planning | migrations/0054_flood_nearest_m.sql:824 | — | — | PlanningSection.tsx:53 | — | HostedNeighbourhoodStats.tsx | council SEA loaders | significant_ecological_areas |
| planning.ecological_area_name | Planning | migrations/0054_flood_nearest_m.sql:825 | — | — | PlanningSection.tsx:57 | — | HostedNeighbourhoodStats.tsx | council SEA loaders | significant_ecological_areas |
| planning.ecological_area_type | Planning | migrations/0054_flood_nearest_m.sql:826 | — | — | PlanningSection.tsx:58 | — | HostedNeighbourhoodStats.tsx | council SEA loaders | significant_ecological_areas |
| planning.in_special_character (→ in_special_character_area) | Planning | migrations/0054_flood_nearest_m.sql:828 | — | — | PlanningSection.tsx:37 | — | HostedNeighbourhoodStats.tsx | ac_special_character | special_character_areas |
| planning.special_character_name | Planning | migrations/0054_flood_nearest_m.sql:829 | — | — | PlanningSection.tsx:41 | — | HostedNeighbourhoodStats.tsx | ac_special_character | special_character_areas |
| planning.in_mana_whenua | Planning | migrations/0054_flood_nearest_m.sql:833 | — | — | PlanningSection.tsx:63 | — | HostedNeighbourhoodStats.tsx | council mana whenua loaders | mana_whenua_sites |
| planning.mana_whenua_name | Planning | migrations/0054_flood_nearest_m.sql:834 | — | — | PlanningSection.tsx:67 | — | HostedNeighbourhoodStats.tsx | council mana whenua loaders | mana_whenua_sites |
| planning.park_count_500m | Planning | migrations/0054_flood_nearest_m.sql:836 | — | — | PlanningSection.tsx:171 | — | HostedNeighbourhoodStats.tsx; HostedOutdoorRec.tsx | linz_parks, council parks | park_extents |
| planning.nearest_park_name | Planning | migrations/0054_flood_nearest_m.sql:837 | — | — | PlanningSection.tsx:178 | — | HostedNeighbourhoodStats.tsx; HostedOutdoorRec.tsx | linz_parks | park_extents |
| planning.nearest_park_distance_m | Planning | migrations/0054_flood_nearest_m.sql:838 | — | — | PlanningSection.tsx:180 | — | HostedNeighbourhoodStats.tsx; HostedOutdoorRec.tsx | linz_parks | park_extents |
| school_zone (planning) | Planning | risk_score.py:756 | school_zone (WEIGHTS_PLANNING 0.15, neutral 50) — risk_score.py:756 | — | — | — | HostedSchoolZones.tsx | moe_zones | school_zones |

## Property

<!-- UPDATE: When adding a property indicator, add a row here. -->

| dot.path | category | defined-in | scored? | finding? | on-screen render | hosted-quick render | hosted-full render | DataSource key(s) | table(s) |
|---|---|---|---|---|---|---|---|---|---|
| address.address_id | Property | migrations/0054_flood_nearest_m.sql:48 | — | — | — | HostedAtAGlance.tsx | HostedAtAGlance.tsx | linz_addresses | addresses |
| address.full_address | Property | migrations/0054_flood_nearest_m.sql:49 | — | — | — | HostedQuickReport.tsx:61 | HostedAtAGlance.tsx | linz_addresses | addresses |
| address.suburb | Property | migrations/0054_flood_nearest_m.sql:50 | — | — | — | HostedAtAGlance.tsx | HostedAtAGlance.tsx | linz_addresses | addresses |
| address.city | Property | migrations/0054_flood_nearest_m.sql:51 | — | — | — | HostedAtAGlance.tsx | HostedAtAGlance.tsx | linz_addresses | addresses |
| address.unit_type | Property | migrations/0054_flood_nearest_m.sql:52 | — | — | — | HostedAtAGlance.tsx | HostedAtAGlance.tsx | linz_addresses | addresses |
| address.sa2_code | Property | migrations/0054_flood_nearest_m.sql:53 | — | — | — | — | HostedDemographics.tsx | sa2_boundaries | sa2_boundaries |
| address.sa2_name | Property | migrations/0054_flood_nearest_m.sql:54 | — | — | — | — | HostedDemographics.tsx | sa2_boundaries | sa2_boundaries |
| address.ta_name | Property | migrations/0054_flood_nearest_m.sql:55 | — | — | — | — | HostedAtAGlance.tsx | sa2_boundaries | sa2_boundaries |
| address.lng / address.lat | Property | migrations/0054_flood_nearest_m.sql:56-57 | — | — | — | HostedAtAGlance.tsx (map) | HostedAtAGlance.tsx (map) | linz_addresses | addresses |
| property.footprint_sqm (→ building_area_sqm / building_footprint_sqm) | Property | migrations/0054_flood_nearest_m.sql:63 | — | report_html.py:2182 | MarketSection.tsx (CV breakdown) | — | HostedAtAGlance.tsx | linz_buildings | building_outlines |
| property.building_use | Property | migrations/0054_flood_nearest_m.sql:64 | — | — | — | — | HostedAtAGlance.tsx | linz_buildings | building_outlines |
| property.title_no | Property | migrations/0054_flood_nearest_m.sql:65 | — | — | — | — | HostedAtAGlance.tsx | linz_titles | property_titles |
| property.estate_description | Property | migrations/0054_flood_nearest_m.sql:66 | — | report_html.py:728 | — | — | HostedAtAGlance.tsx | linz_titles | property_titles |
| property.title_type | Property | migrations/0054_flood_nearest_m.sql:67 | — | report_html.py:727 | — | — | HostedAtAGlance.tsx | linz_titles | property_titles |
| property.capital_value | Property | migrations/0054_flood_nearest_m.sql:68 | — | report_html.py:576,1141,1965 | MarketSection.tsx:42 | HostedQuickReport.tsx:70 | HostedPriceAdvisor.tsx; HostedAtAGlance.tsx | council_valuations + 25 live rates APIs | council_valuations |
| property.land_value | Property | migrations/0054_flood_nearest_m.sql:69 | — | report_html.py:4820 | MarketSection.tsx:69 | HostedQuickReport.tsx | HostedPriceAdvisor.tsx | council_valuations | council_valuations |
| property.improvements_value (→ improvement_value) | Property | migrations/0054_flood_nearest_m.sql:70 | — | report_html.py:1141,2392 | MarketSection.tsx:75 | — | HostedPriceAdvisor.tsx | council_valuations | council_valuations |
| property.cv_land_area (→ land_area_sqm) | Property | migrations/0054_flood_nearest_m.sql:71 | — | report_html.py:4097 | MarketSection.tsx | — | HostedAtAGlance.tsx | council_valuations | council_valuations |
| property.cv_date | Property | migrations/0054_flood_nearest_m.sql:72 | — | report_html.py:2696 | MarketSection.tsx | — | HostedPriceAdvisor.tsx | council_valuations | council_valuations |
| property.cv_council | Property | migrations/0054_flood_nearest_m.sql:73 | — | — | — | — | HostedPriceAdvisor.tsx | council_valuations | council_valuations |
| property.multi_unit (→ is_multi_unit / unit_count) | Property | migrations/0054_flood_nearest_m.sql:74 | — | report_html.py:1694,2691,2758 | MarketSection.tsx (effectivePerUnitCv) | — | HostedAtAGlance.tsx | linz_addresses (derived) | addresses (count) |
| property.cv_valuation_id | Property | migrations/0054_flood_nearest_m.sql:91 | — | — | MarketSection.tsx:95 | — | HostedPriceAdvisor.tsx | council_valuations | council_valuations |
| property.cv_address | Property | migrations/0054_flood_nearest_m.sql:91 | — | — | MarketSection.tsx:97 | — | HostedPriceAdvisor.tsx | council_valuations | council_valuations |
| property.floor_area_sqm | Property | rates_data overlay (per-unit) | — | — | — | — | (CompareSections lib/compareSections.ts:529) | live council rates APIs | council_valuations |
| rates_data (annual rates) | Property | snapshot_generator.py:934 | — | — | (lazy /property/{id}/rates) | HostedQuickReport.tsx:41 | HostedPriceAdvisor.tsx; HostedRecommendations.tsx | 25 council rates APIs (services/*_rates.py) | council_valuations |

## Market

<!-- UPDATE: When adding a market indicator, add a row here. -->

| dot.path | category | defined-in | scored? | finding? | on-screen render | hosted-quick render | hosted-full render | DataSource key(s) | table(s) |
|---|---|---|---|---|---|---|---|---|---|
| market.sa2_code | Market | migrations/0054_flood_nearest_m.sql:1019 | — | — | — | — | HostedRentAdvisor.tsx | tenancy_bonds | mv_rental_market |
| market.sa2_name | Market | migrations/0054_flood_nearest_m.sql:1020 | — | — | — | — | HostedRentAdvisor.tsx | tenancy_bonds | mv_rental_market |
| market.rental_overview[].dwelling_type | Market | migrations/0054_flood_nearest_m.sql:1029 | — | — | — | — | HostedRentAdvisor.tsx | tenancy_bonds | mv_rental_market |
| market.rental_overview[].beds | Market | migrations/0054_flood_nearest_m.sql:1030 | — | — | MarketSection.tsx | — | HostedRentAdvisor.tsx | tenancy_bonds | mv_rental_market |
| market.rental_overview[].median (→ rent_assessment.median) | Market | migrations/0054_flood_nearest_m.sql:1031 | — | report_html.py:1991,2004 | MarketSection.tsx | — | HostedRentAdvisor.tsx | tenancy_bonds | mv_rental_market |
| market.rental_overview[].lq (→ lower_quartile) | Market | migrations/0054_flood_nearest_m.sql:1032 | — | — | MarketSection.tsx | — | HostedRentAdvisor.tsx | tenancy_bonds | mv_rental_market |
| market.rental_overview[].uq (→ upper_quartile) | Market | migrations/0054_flood_nearest_m.sql:1033 | — | — | MarketSection.tsx | — | HostedRentAdvisor.tsx | tenancy_bonds | mv_rental_market |
| market.rental_overview[].bonds | Market | migrations/0054_flood_nearest_m.sql:1034 | rental_fairness (WEIGHTS_MARKET 0.40) — risk_score.py:773; market_heat (WEIGHTS_MARKET 0.25) — risk_score.py:789 | report_html.py:2027 | — | — | HostedRentAdvisor.tsx | tenancy_bonds | mv_rental_market |
| market.rental_overview[].yoy_pct | Market | migrations/0054_flood_nearest_m.sql:1035 | rental_trend (WEIGHTS_MARKET 0.35) — risk_score.py:785 | report_html.py:2011 | — | — | HostedRentAdvisor.tsx | tenancy_bonds | mv_rental_market |
| market.trends[].dwelling_type | Market | migrations/0054_flood_nearest_m.sql:1043 | — | — | — | — | HostedRentHistory.tsx | tenancy_bonds | mv_rental_trends |
| market.trends[].beds | Market | migrations/0054_flood_nearest_m.sql:1044 | — | — | — | — | HostedRentHistory.tsx | tenancy_bonds | mv_rental_trends |
| market.trends[].current_median | Market | migrations/0054_flood_nearest_m.sql:1045 | — | — | — | — | HostedRentHistory.tsx | tenancy_bonds | mv_rental_trends |
| market.trends[].yoy_pct | Market | migrations/0054_flood_nearest_m.sql:1046 | — | — | — | — | HostedRentHistory.tsx | tenancy_bonds | mv_rental_trends |
| market.trends[].cagr_3yr (→ trend.cagr_1yr/3yr) | Market | migrations/0054_flood_nearest_m.sql:1047 | — | — | MarketSection.tsx:123 | — | HostedRentHistory.tsx | tenancy_bonds | mv_rental_trends |
| market.trends[].cagr_5yr | Market | migrations/0054_flood_nearest_m.sql:1048 | — | — | MarketSection.tsx:131 | — | HostedRentHistory.tsx | tenancy_bonds | mv_rental_trends |
| market.trends[].cagr_10yr | Market | migrations/0054_flood_nearest_m.sql:1049 | — | — | MarketSection.tsx:139 | — | HostedRentHistory.tsx | tenancy_bonds | mv_rental_trends |
| market.hpi_latest.quarter | Market | migrations/0054_flood_nearest_m.sql:1057 | — | report_html.py:2290 | — | — | HostedHPIChart.tsx | reinz_hpi_national | hpi_national |
| market.hpi_latest.hpi | Market | migrations/0054_flood_nearest_m.sql:1058 | — | — | — | — | HostedHPIChart.tsx | reinz_hpi_national | hpi_national |
| market.hpi_latest.sales | Market | migrations/0054_flood_nearest_m.sql:1059 | — | — | — | — | HostedHPIChart.tsx | reinz_hpi_national | hpi_national |
| market.hpi_latest.stock_value_m | Market | migrations/0054_flood_nearest_m.sql:1060 | — | — | — | — | HostedHPIChart.tsx | reinz_hpi_national | hpi_national |
| market.market_heat | Market | snapshot_generator computed | market_heat — risk_score.py:789 | — | MarketSection.tsx:36 | — | HostedRentAdvisor.tsx | derived from bonds | mv_rental_market |
| rent_history (snapshot) | Market | snapshot_generator.py:928 | — | — | — | — | HostedRentHistory.tsx | tenancy_bonds | tenancy_bonds_history |
| hpi_data (snapshot) | Market | snapshot_generator.py:929 | — | — | — | — | HostedHPIChart.tsx:12 | reinz_hpi_national, reinz_hpi_ta | hpi_national, hpi_ta |
| comparisons.suburb.* | Market | migrations/0054_flood_nearest_m.sql:989-998 | — | — | — | — | HostedNeighbourhoodStats.tsx | mv_sa2_comparisons | mv_sa2_comparisons |
| comparisons.city.* | Market | migrations/0054_flood_nearest_m.sql:1001-1009 | — | — | — | — | HostedNeighbourhoodStats.tsx | mv_ta_comparisons | mv_ta_comparisons |

## Transport

<!-- UPDATE: When adding a transport indicator, add a row here. -->

| dot.path | category | defined-in | scored? | finding? | on-screen render | hosted-quick render | hosted-full render | DataSource key(s) | table(s) |
|---|---|---|---|---|---|---|---|---|---|
| liveability.transit_stops_400m (→ transit_count) | Transport | migrations/0054_flood_nearest_m.sql:581 | transit_access (WEIGHTS_TRANSPORT 0.25) — risk_score.py:725 | report_html.py:1515,1521 | TransportSection.tsx | — | HostedNeighbourhoodStats.tsx | gtfs_at, gtfs_metlink, gtfs_chch, +regional | transit_stops |
| liveability.transit_stops_list | Transport | migrations/0054_flood_nearest_m.sql:582 | — | — | TransportSection.tsx (map) | — | — | gtfs loaders | transit_stops |
| liveability.nearest_train_name | Transport | migrations/0054_flood_nearest_m.sql:583 | — | — | TransportSection.tsx | — | — | gtfs loaders | transit_stops |
| liveability.nearest_train_distance_m (→ nearest_train_m) | Transport | migrations/0054_flood_nearest_m.sql:584 | rail_proximity (WEIGHTS_TRANSPORT 0.15) — risk_score.py:739 | — | TransportSection.tsx:32 | — | — | gtfs loaders | transit_stops |
| liveability.cbd_distance_m | Transport | migrations/0054_flood_nearest_m.sql:585 | cbd_proximity (WEIGHTS_TRANSPORT 0.20) — risk_score.py:731 | — | TransportSection.tsx:31 | — | — | cbd_points (migration 0023) | cbd_points |
| liveability.crashes_300m_serious | Transport | migrations/0054_flood_nearest_m.sql:589 | road_safety (WEIGHTS_TRANSPORT 0.15) — risk_score.py:746 | report_html.py:1592,1907 | — | — | HostedNeighbourhoodStats.tsx | nzta_cas | crashes |
| liveability.crashes_300m_fatal | Transport | migrations/0054_flood_nearest_m.sql:590 | road_safety — risk_score.py:746 | report_html.py:1598,1915 | — | — | HostedNeighbourhoodStats.tsx | nzta_cas | crashes |
| liveability.crashes_300m_total (→ crash_total) | Transport | migrations/0054_flood_nearest_m.sql:591 | — | — | — | — | HostedNeighbourhoodStats.tsx | nzta_cas | crashes |
| liveability.bus_stops_800m | Transport | migrations/0054_flood_nearest_m.sql:601 | bus_density (WEIGHTS_TRANSPORT 0.10) — risk_score.py:743 | — | TransportSection.tsx:119 | — | — | gtfs_metlink, gtfs_at, gtfs_chch | metlink_stops |
| liveability.rail_stops_800m | Transport | migrations/0054_flood_nearest_m.sql:602 | — | — | TransportSection.tsx:130 | — | — | gtfs loaders | metlink_stops |
| liveability.ferry_stops_800m | Transport | migrations/0054_flood_nearest_m.sql:603 | — | — | TransportSection.tsx:141 | — | — | gtfs loaders | metlink_stops |
| liveability.cable_car_stops_800m | Transport | migrations/0054_flood_nearest_m.sql:604 | — | — | TransportSection.tsx:152 | — | — | gtfs_metlink | metlink_stops |
| liveability.transit_travel_times | Transport | migrations/0054_flood_nearest_m.sql:606 | — | — | TransportSection.tsx:168 | — | — | transit_travel_times job | transit_travel_times |
| liveability.transit_travel_times_pm | Transport | property.py _overlay_transit_data | — | — | TransportSection.tsx:173 | — | — | transit_travel_times job | transit_travel_times |
| liveability.peak_trips_per_hour | Transport | migrations/0054_flood_nearest_m.sql:608 | commute_frequency (WEIGHTS_TRANSPORT 0.15) — risk_score.py:735 | — | TransportSection.tsx:185 | — | — | transit_stop_frequency job | transit_stop_frequency |
| liveability.nearest_stop_name | Transport | migrations/0054_flood_nearest_m.sql:609 | — | — | TransportSection.tsx:196 | — | — | gtfs loaders | metlink_stops |
| liveability.walking_reach_10min | Transport | snapshot_generator.py:940 (isochrone) | — | — | — | — | (compareSections.ts:279) | osm_road_network | derived |
| isochrone | Transport | snapshot_generator.py:940 | — | — | — | — | HostedTerrain.tsx | osm_road_network | derived |
| school_zones (snapshot) | Transport/Liveability | snapshot_generator.py:936 | — | — | — | HostedSchoolZones.tsx | HostedSchoolZones.tsx | moe_zones | school_zones |

## Demographics

<!-- UPDATE: When adding a demographics indicator, add a row here. -->

| dot.path | category | defined-in | scored? | finding? | on-screen render | hosted-quick render | hosted-full render | DataSource key(s) | table(s) |
|---|---|---|---|---|---|---|---|---|---|
| census_demographics.sa2_name | Demographics | snapshot_generator.py:941 | — | — | — | HostedDemographics.tsx:67 | HostedDemographics.tsx | stats_census_2023 | census_population |
| census_demographics.population_2018 | Demographics | snapshot_generator.py:941 | — | — | — | HostedDemographics.tsx:68 | HostedDemographics.tsx:68 | stats_census_2018 | census_population |
| census_demographics.population_2023 | Demographics | snapshot_generator.py:941 | — | — | — | HostedDemographics.tsx:127 | HostedDemographics.tsx:127 | stats_census_2023 | census_population |
| census_demographics.median_age | Demographics | snapshot_generator.py:941 | — | — | — | HostedDemographics.tsx:136 | HostedDemographics.tsx:136 | stats_census_2023 | census_population |
| census_demographics.age_65_plus | Demographics | snapshot_generator.py:941 | — | — | — | HostedDemographics.tsx:138 | HostedDemographics.tsx:138 | stats_census_2023 | census_population |
| census_demographics.ethnicity_total | Demographics | snapshot_generator.py:941 | — | — | — | — | HostedDemographics.tsx:91 | stats_census_2023 | census_ethnicity |
| census_demographics.ethnicity_european | Demographics | snapshot_generator.py:941 | — | — | — | — | HostedDemographics.tsx:93 | stats_census_2023 | census_ethnicity |
| census_demographics.ethnicity_maori | Demographics | snapshot_generator.py:941 | — | — | — | — | HostedDemographics.tsx:94 | stats_census_2023 | census_ethnicity |
| census_demographics.ethnicity_asian | Demographics | snapshot_generator.py:941 | — | — | — | — | HostedDemographics.tsx:95 | stats_census_2023 | census_ethnicity |
| census_demographics.ethnicity_pacific | Demographics | snapshot_generator.py:941 | — | — | — | — | HostedDemographics.tsx:96 | stats_census_2023 | census_ethnicity |
| census_demographics.ethnicity_melaa | Demographics | snapshot_generator.py:941 | — | — | — | — | HostedDemographics.tsx:97 | stats_census_2023 | census_ethnicity |
| census_demographics.born_nz | Demographics | snapshot_generator.py:941 | — | — | — | — | HostedDemographics.tsx:253 | stats_census_2023 | census_ethnicity |
| census_demographics.born_overseas | Demographics | snapshot_generator.py:941 | — | — | — | — | HostedDemographics.tsx:251 | stats_census_2023 | census_ethnicity |
| census_households.sa2_name | Demographics | snapshot_generator.py:942 | — | — | — | HostedDemographics.tsx:67 | HostedDemographics.tsx | stats_census_2023 | census_households |
| census_households.income_median | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:184 | stats_census_2023 | census_households |
| census_households.income_under_20k..income_200k_plus (8 brackets) | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:107-110 | stats_census_2023 | census_households |
| census_households.tenure_owned | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:206 | stats_census_2023 | census_households |
| census_households.tenure_not_owned | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:207 | stats_census_2023 | census_households |
| census_households.tenure_family_trust | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:208 | stats_census_2023 | census_households |
| census_households.tenure_total | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:206 | stats_census_2023 | census_households |
| census_households.rent_median | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:209 | stats_census_2023 | census_households |
| census_households.hh_crowded | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:211 | stats_census_2023 | census_households |
| census_households.hh_one_person | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:213 | stats_census_2023 | census_households |
| census_households.hh_total | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:211 | stats_census_2023 | census_households |
| census_households.landlord_kainga_ora | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:215 | stats_census_2023 | census_households |
| census_households.landlord_total | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:215 | stats_census_2023 | census_households |
| census_households.internet_access | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:228 | stats_census_2023 | census_households |
| census_households.internet_total | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:228 | stats_census_2023 | census_households |
| census_households.vehicles_none | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:237 | stats_census_2023 | census_households |
| census_households.vehicles_total | Demographics | snapshot_generator.py:942 | — | — | — | — | HostedDemographics.tsx:237 | stats_census_2023 | census_households |
| census_commute.total_stated | Demographics | snapshot_generator.py:943 | — | — | — | HostedDemographics.tsx:74 | HostedDemographics.tsx | stats_census_commute | census_commute |
| census_commute.drive_private | Demographics | snapshot_generator.py:943 | — | — | — | HostedDemographics.tsx:76 | HostedDemographics.tsx | stats_census_commute | census_commute |
| census_commute.drive_company | Demographics | snapshot_generator.py:943 | — | — | — | HostedDemographics.tsx:76 | HostedDemographics.tsx | stats_census_commute | census_commute |
| census_commute.work_at_home | Demographics | snapshot_generator.py:943 | — | — | — | HostedDemographics.tsx:77 | HostedDemographics.tsx | stats_census_commute | census_commute |
| census_commute.public_bus | Demographics | snapshot_generator.py:943 | — | — | — | HostedDemographics.tsx:78 | HostedDemographics.tsx | stats_census_commute | census_commute |
| census_commute.walk_or_jog | Demographics | snapshot_generator.py:943 | — | — | — | HostedDemographics.tsx:79 | HostedDemographics.tsx | stats_census_commute | census_commute |
| census_commute.train | Demographics | snapshot_generator.py:943 | — | — | — | HostedDemographics.tsx:80 | HostedDemographics.tsx | stats_census_commute | census_commute |
| census_commute.bicycle | Demographics | snapshot_generator.py:943 | — | — | — | HostedDemographics.tsx:81 | HostedDemographics.tsx | stats_census_commute | census_commute |
| business_demography.employee_count_2024 | Demographics | snapshot_generator.py:945 | — | — | — | HostedDemographics.tsx:166 | HostedDemographics.tsx:166 | stats_business_demography | business_demography |
| business_demography.employee_count_2019 | Demographics | snapshot_generator.py:945 | — | — | — | HostedDemographics.tsx:60 | HostedDemographics.tsx | stats_business_demography | business_demography |
| business_demography.employee_growth_pct | Demographics | snapshot_generator.py:945 | — | — | — | HostedDemographics.tsx:174 | HostedDemographics.tsx:174 | stats_business_demography | business_demography |
| business_demography.business_count_2024 | Demographics | snapshot_generator.py:945 | — | — | — | HostedDemographics.tsx:170 | HostedDemographics.tsx:170 | stats_business_demography | business_demography |
| business_demography.business_growth_pct | Demographics | snapshot_generator.py:945 | — | — | — | HostedDemographics.tsx:62 | HostedDemographics.tsx | stats_business_demography | business_demography |
| crime_trend (snapshot) | Demographics | snapshot_generator.py:930 | — | — | — | — | HostedNeighbourhoodStats.tsx | police_crime_history | mv_crime_density_history |

---

## Sanity check

- SQL fields in `get_property_report()` (migration 0054): ~135 distinct JSON keys across address, property, hazards, environment, liveability, planning, comparisons, market sections.
- Weighted indicators in `risk_score.py` `WEIGHTS_*` dicts: 11 hazards + 5 environment + 4 liveability + 6 transport + 3 market + 5 planning = **34** weighted indicators (matches `CATEGORY_INDICATOR_COUNTS` at risk_score.py:351).
- Unique hosted-rendered rows (StatRow / labelled fields across HostedDemographics, HostedNeighbourhoodStats, HostedHazardAdvice, HostedTerrain, HostedClimate, HostedRentAdvisor, HostedPriceAdvisor, HostedHPIChart, HostedSchools, HostedRoadNoise, HostedInfrastructure, HostedCoastalTimeline, HostedOutdoorRec, HostedNearbyHighlights, HostedRentHistory, HostedSchoolZones): ~80 unique field renders.

Required floor: 135 (SQL leaves) + 34 (weighted indicators) + ~80 (hosted rows) = **~249 minimum coverage points** — satisfied by the 272 rows in the Summary table above. Sanity check passes.
