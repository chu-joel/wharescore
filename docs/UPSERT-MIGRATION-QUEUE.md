# UPSERT-MIGRATION-QUEUE.md

> AUTO-GENERATED from `backend/app/services/data_loader.py::DATA_SOURCES`.
> Do NOT hand-edit. Re-run `python scripts/dump_upsert_queue.py` after
> migrating a source. The skill `.claude/skills/upsert-loader/` reads
> this file to find the next pending entry.

The diff/upsert refactor (see `auckland_flood` — the worked example)
brings sources onto the per-row diff path that records changes in
`data_change_log` and avoids the DELETE-then-INSERT inconsistency
window. Each source is migrated independently — small, reviewable,
verifiable on prod before the next.

## Status

| Status | Count | Meaning |
|---|---|---|
| done | 1 | Already migrated to upsert |
| pending | 1 | Good candidate; awaiting skill invocation |
| skipped | 564 | Deliberately NOT migrated (reason in row) |

## How to use

1. Pick the **first pending** row (highest priority — already sorted).
2. Invoke the upsert-loader skill with that source key.
3. Skill walks Phases 1-5; you approve each checkpoint.
4. On Phase 5 success, edit this file's `DONE_KEYS` in
   `scripts/dump_upsert_queue.py` to add the key, then re-run the
   script to refresh the table.

## Pending sources (priority order)

| # | source_key | tables | authority | cadence | check | detection | priority |
|---|---|---|---|---|---|---|---|

| 1 | `auckland_flood_sensitive` | flood_hazard | Auckland Council | revisable | monthly | arcgis_lastEditDate | 115 |

## Done

| source_key | tables | notes |
|---|---|---|
| `auckland_flood` | flood_hazard | already migrated |

## Skipped (with reason)

| source_key | reason |
|---|---|
| `ashburton_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `at_gtfs` | no upstream_url set — populate URL first |
| `auckland_aircraft_noise` | static cadence — no refresh, no upsert benefit |
| `auckland_coastal` | no upstream_url set — populate URL first |
| `auckland_coastal_erosion` | no upstream_url set — populate URL first |
| `auckland_coastal_erosion_2130` | no upstream_url set — populate URL first |
| `auckland_ecological` | no upstream_url set — populate URL first |
| `auckland_geotech` | no upstream_url set — populate URL first |
| `auckland_height_variation` | no upstream_url set — populate URL first |
| `auckland_heritage` | no upstream_url set — populate URL first |
| `auckland_heritage_extent` | no upstream_url set — populate URL first |
| `auckland_landslide` | static cadence — no refresh, no upsert benefit |
| `auckland_liquefaction` | static cadence — no refresh, no upsert benefit |
| `auckland_mana_whenua` | no upstream_url set — populate URL first |
| `auckland_notable_trees` | no upstream_url set — populate URL first |
| `auckland_overland_flow` | static cadence — no refresh, no upsert benefit |
| `auckland_parks` | no upstream_url set — populate URL first |
| `auckland_plan_zones` | no upstream_url set — populate URL first |
| `auckland_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `auckland_schools` | no upstream_url set — populate URL first |
| `auckland_special_character` | no upstream_url set — populate URL first |
| `auckland_stormwater` | static cadence — no refresh, no upsert benefit |
| `auckland_tsunami` | static cadence — no refresh, no upsert benefit |
| `auckland_viewshafts` | no upstream_url set — populate URL first |
| `auckland_volcanic_5km_buffer` | no upstream_url set — populate URL first |
| `auckland_volcanic_deposits` | no upstream_url set — populate URL first |
| `auckland_volcanic_field` | no upstream_url set — populate URL first |
| `auckland_volcanic_vents` | no upstream_url set — populate URL first |
| `bop_active_faults` | static cadence — no refresh, no upsert benefit |
| `bop_calderas` | static cadence — no refresh, no upsert benefit |
| `bop_coastal_hazard_ohiwa` | no upstream_url set — populate URL first |
| `bop_coastal_hazard_sensitive` | no upstream_url set — populate URL first |
| `bop_contaminated` | no upstream_url set — populate URL first |
| `bop_historic_floods` | no upstream_url set — populate URL first |
| `bop_liquefaction_a` | static cadence — no refresh, no upsert benefit |
| `bop_liquefaction_b` | static cadence — no refresh, no upsert benefit |
| `bop_tsunami_2500yr` | static cadence — no refresh, no upsert benefit |
| `bop_tsunami_evac` | static cadence — no refresh, no upsert benefit |
| `buller_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `business_demography` | no upstream_url set — populate URL first |
| `canterbury_faults` | static cadence — no refresh, no upsert benefit |
| `carterton_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `census_commute` | static cadence — no refresh, no upsert benefit |
| `census_demographics` | static cadence — no refresh, no upsert benefit |
| `census_households` | static cadence — no refresh, no upsert benefit |
| `central_otago_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `character_precincts` | no upstream_url set — populate URL first |
| `chch_airport_noise_50db` | static cadence — no refresh, no upsert benefit |
| `chch_airport_noise_55db` | static cadence — no refresh, no upsert benefit |
| `chch_airport_noise_65db` | static cadence — no refresh, no upsert benefit |
| `chch_coastal_erosion` | no upstream_url set — populate URL first |
| `chch_coastal_inundation` | no upstream_url set — populate URL first |
| `chch_flood` | no upstream_url set — populate URL first |
| `chch_flood_high` | no upstream_url set — populate URL first |
| `chch_heritage` | no upstream_url set — populate URL first |
| `chch_liquefaction` | static cadence — no refresh, no upsert benefit |
| `chch_notable_trees` | no upstream_url set — populate URL first |
| `chch_plan_zones` | no upstream_url set — populate URL first |
| `chch_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `chch_slope` | static cadence — no refresh, no upsert benefit |
| `chch_slope_hazard` | static cadence — no refresh, no upsert benefit |
| `chch_tsunami` | static cadence — no refresh, no upsert benefit |
| `christchurch_gtfs` | no upstream_url set — populate URL first |
| `climate_normals` | static cadence — no refresh, no upsert benefit |
| `clutha_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `coastal_elevation` | static cadence — no refresh, no upsert benefit |
| `coastal_inundation` | no upstream_url set — populate URL first |
| `contaminated_land` | no upstream_url set — populate URL first |
| `corrosion_zones` | no upstream_url set — populate URL first |
| `cycleways` | no upstream_url set — populate URL first |
| `district_plan` | no upstream_url set — populate URL first |
| `doc_campsites` | no upstream_url set — populate URL first |
| `doc_huts` | no upstream_url set — populate URL first |
| `doc_tracks` | no upstream_url set — populate URL first |
| `dunedin_airport_noise` | static cadence — no refresh, no upsert benefit |
| `dunedin_coastal_hazard` | no upstream_url set — populate URL first |
| `dunedin_flood_h1` | no upstream_url set — populate URL first |
| `dunedin_flood_h2` | no upstream_url set — populate URL first |
| `dunedin_flood_h3` | no upstream_url set — populate URL first |
| `dunedin_gtfs` | no upstream_url set — populate URL first |
| `dunedin_heritage` | no upstream_url set — populate URL first |
| `dunedin_heritage_precinct` | no upstream_url set — populate URL first |
| `dunedin_land_instability` | static cadence — no refresh, no upsert benefit |
| `dunedin_orc_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `dunedin_plan_zones` | no upstream_url set — populate URL first |
| `dunedin_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `dunedin_trees` | no upstream_url set — populate URL first |
| `dunedin_tsunami` | static cadence — no refresh, no upsert benefit |
| `ecan_coastal_hazard` | no upstream_url set — populate URL first |
| `ecan_fault_awareness_2019` | static cadence — no refresh, no upsert benefit |
| `ecan_flood_kaikoura` | no upstream_url set — populate URL first |
| `ecan_flood_waitaki` | no upstream_url set — populate URL first |
| `ecan_floodways` | no upstream_url set — populate URL first |
| `ecan_kaikoura_debris_fan` | static cadence — no refresh, no upsert benefit |
| `ecan_kaikoura_faults` | static cadence — no refresh, no upsert benefit |
| `ecan_kaikoura_landslide` | static cadence — no refresh, no upsert benefit |
| `ecan_liquefaction_ashburton` | static cadence — no refresh, no upsert benefit |
| `ecan_liquefaction_hurunui` | static cadence — no refresh, no upsert benefit |
| `ecan_liquefaction_kaikoura` | static cadence — no refresh, no upsert benefit |
| `ecan_liquefaction_mackenzie` | static cadence — no refresh, no upsert benefit |
| `ecan_liquefaction_selwyn` | static cadence — no refresh, no upsert benefit |
| `ecan_liquefaction_timaru` | static cadence — no refresh, no upsert benefit |
| `ecan_liquefaction_waimakariri` | static cadence — no refresh, no upsert benefit |
| `ecan_liquefaction_waimate` | static cadence — no refresh, no upsert benefit |
| `ecan_liquefaction_waitaki` | static cadence — no refresh, no upsert benefit |
| `ecan_ostler_fault` | static cadence — no refresh, no upsert benefit |
| `ecan_rcep_coastal_hazard` | no upstream_url set — populate URL first |
| `ecan_resource_consents` | no upstream_url set — populate URL first |
| `ecan_sea_inundation` | no upstream_url set — populate URL first |
| `ecan_tsunami` | static cadence — no refresh, no upsert benefit |
| `epb_mbie` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `epb_wcc` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `erosion_prone_land` | no upstream_url set — populate URL first |
| `far_north_coastal` | no upstream_url set — populate URL first |
| `far_north_flood` | no upstream_url set — populate URL first |
| `fibre_coverage` | no upstream_url set — populate URL first |
| `gisborne_airport_noise` | static cadence — no refresh, no upsert benefit |
| `gisborne_coastal_erosion` | no upstream_url set — populate URL first |
| `gisborne_coastal_flooding` | no upstream_url set — populate URL first |
| `gisborne_coastal_hazard` | no upstream_url set — populate URL first |
| `gisborne_contaminated` | no upstream_url set — populate URL first |
| `gisborne_flood` | no upstream_url set — populate URL first |
| `gisborne_heritage` | no upstream_url set — populate URL first |
| `gisborne_liquefaction` | static cadence — no refresh, no upsert benefit |
| `gisborne_port_noise` | static cadence — no refresh, no upsert benefit |
| `gisborne_stability` | static cadence — no refresh, no upsert benefit |
| `gisborne_tsunami` | static cadence — no refresh, no upsert benefit |
| `gisborne_zones` | no upstream_url set — populate URL first |
| `gns_active_faults` | static cadence — no refresh, no upsert benefit |
| `gns_landslides` | no upstream_url set — populate URL first |
| `grey_westland_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `gwrc_earthquake` | static cadence — no refresh, no upsert benefit |
| `gwrc_flood_1pct` | no upstream_url set — populate URL first |
| `gwrc_flood_extents` | no upstream_url set — populate URL first |
| `gwrc_landslide` | static cadence — no refresh, no upsert benefit |
| `gwrc_storm_surge_100cm` | static cadence — no refresh, no upsert benefit |
| `gwrc_storm_surge_50cm` | static cadence — no refresh, no upsert benefit |
| `gwrc_storm_surge_present` | static cadence — no refresh, no upsert benefit |
| `gwrc_tsunami` | static cadence — no refresh, no upsert benefit |
| `hamilton_airport_noise` | static cadence — no refresh, no upsert benefit |
| `hamilton_flood` | no upstream_url set — populate URL first |
| `hamilton_flood_depressions` | no upstream_url set — populate URL first |
| `hamilton_flood_extents` | no upstream_url set — populate URL first |
| `hamilton_gtfs` | no upstream_url set — populate URL first |
| `hamilton_heritage` | no upstream_url set — populate URL first |
| `hamilton_natural_hazard` | static cadence — no refresh, no upsert benefit |
| `hamilton_overland_flood` | no upstream_url set — populate URL first |
| `hamilton_plan_zones` | no upstream_url set — populate URL first |
| `hamilton_riverbank_hazard` | static cadence — no refresh, no upsert benefit |
| `hamilton_seismic` | static cadence — no refresh, no upsert benefit |
| `hamilton_sna` | no upstream_url set — populate URL first |
| `hamilton_trees` | no upstream_url set — populate URL first |
| `hauraki_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `hawkes_bay_gtfs` | no upstream_url set — populate URL first |
| `hbrc_amplification` | static cadence — no refresh, no upsert benefit |
| `hbrc_coastal_erosion_present` | no upstream_url set — populate URL first |
| `hbrc_coastal_hazard` | no upstream_url set — populate URL first |
| `hbrc_coastal_inundation_2023` | no upstream_url set — populate URL first |
| `hbrc_contaminated` | no upstream_url set — populate URL first |
| `hbrc_earthflow_moderate` | static cadence — no refresh, no upsert benefit |
| `hbrc_earthflow_severe` | static cadence — no refresh, no upsert benefit |
| `hbrc_earthquake_amp` | static cadence — no refresh, no upsert benefit |
| `hbrc_flood` | no upstream_url set — populate URL first |
| `hbrc_flood_risk` | no upstream_url set — populate URL first |
| `hbrc_gully_risk` | static cadence — no refresh, no upsert benefit |
| `hbrc_hastings_ponding` | static cadence — no refresh, no upsert benefit |
| `hbrc_landslide_high` | static cadence — no refresh, no upsert benefit |
| `hbrc_landslide_high_delivery` | static cadence — no refresh, no upsert benefit |
| `hbrc_landslide_high_nodelivery` | static cadence — no refresh, no upsert benefit |
| `hbrc_liquefaction` | static cadence — no refresh, no upsert benefit |
| `hbrc_liquefaction_chb` | static cadence — no refresh, no upsert benefit |
| `hbrc_liquefaction_vulnerability` | static cadence — no refresh, no upsert benefit |
| `hbrc_plan_zones` | no upstream_url set — populate URL first |
| `hbrc_tsunami` | static cadence — no refresh, no upsert benefit |
| `hbrc_tsunami_evac_2024` | static cadence — no refresh, no upsert benefit |
| `hbrc_wairoa_bank` | static cadence — no refresh, no upsert benefit |
| `hcc_archaeological` | no upstream_url set — populate URL first |
| `hcc_coastal_inundation_high` | no upstream_url set — populate URL first |
| `hcc_coastal_inundation_medium` | no upstream_url set — populate URL first |
| `hcc_flood_inundation` | no upstream_url set — populate URL first |
| `hcc_flood_overland_flow` | no upstream_url set — populate URL first |
| `hcc_flood_stream_corridor` | no upstream_url set — populate URL first |
| `hcc_heritage` | no upstream_url set — populate URL first |
| `hcc_notable_trees` | no upstream_url set — populate URL first |
| `hcc_plan_zones` | no upstream_url set — populate URL first |
| `hcc_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `hcc_tsunami_high` | static cadence — no refresh, no upsert benefit |
| `hcc_tsunami_medium` | static cadence — no refresh, no upsert benefit |
| `hdc_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `height_controls` | no upstream_url set — populate URL first |
| `horizons_coastal_hazard` | no upstream_url set — populate URL first |
| `horizons_flood_200yr` | no upstream_url set — populate URL first |
| `horizons_flood_modelled` | no upstream_url set — populate URL first |
| `horizons_floodways` | no upstream_url set — populate URL first |
| `horizons_lahar_ruapehu` | static cadence — no refresh, no upsert benefit |
| `horizons_liquefaction` | static cadence — no refresh, no upsert benefit |
| `horizons_observed_flooding` | no upstream_url set — populate URL first |
| `horizons_tsunami` | static cadence — no refresh, no upsert benefit |
| `hurunui_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `invercargill_amplification` | static cadence — no refresh, no upsert benefit |
| `invercargill_archaeological` | no upstream_url set — populate URL first |
| `invercargill_biodiversity` | static cadence — no refresh, no upsert benefit |
| `invercargill_coastal_erosion` | no upstream_url set — populate URL first |
| `invercargill_heritage` | no upstream_url set — populate URL first |
| `invercargill_liquefaction` | static cadence — no refresh, no upsert benefit |
| `invercargill_liquefaction` | static cadence — no refresh, no upsert benefit |
| `invercargill_noise_airport` | static cadence — no refresh, no upsert benefit |
| `invercargill_noise_port` | static cadence — no refresh, no upsert benefit |
| `invercargill_notable_trees` | no upstream_url set — populate URL first |
| `invercargill_riverine_inundation` | no upstream_url set — populate URL first |
| `invercargill_sea_level_rise` | static cadence — no refresh, no upsert benefit |
| `invercargill_zones` | no upstream_url set — populate URL first |
| `kaikoura_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `kapiti_coastal_erosion_2120` | no upstream_url set — populate URL first |
| `kapiti_coastal_erosion_present` | no upstream_url set — populate URL first |
| `kapiti_ecological` | no upstream_url set — populate URL first |
| `kapiti_fault_avoidance` | static cadence — no refresh, no upsert benefit |
| `kapiti_flood` | no upstream_url set — populate URL first |
| `kapiti_flood_ponding` | no upstream_url set — populate URL first |
| `kapiti_flood_river_corridor` | no upstream_url set — populate URL first |
| `kapiti_heritage` | no upstream_url set — populate URL first |
| `kapiti_trees` | no upstream_url set — populate URL first |
| `kapiti_tsunami` | static cadence — no refresh, no upsert benefit |
| `kapiti_zones` | no upstream_url set — populate URL first |
| `kcdc_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `linz_waterways` | no upstream_url set — populate URL first |
| `mackenzie_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `manawatu_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `marlborough_flood` | no upstream_url set — populate URL first |
| `marlborough_liq_a` | static cadence — no refresh, no upsert benefit |
| `marlborough_liq_b` | static cadence — no refresh, no upsert benefit |
| `marlborough_liq_c` | static cadence — no refresh, no upsert benefit |
| `marlborough_liq_d` | static cadence — no refresh, no upsert benefit |
| `marlborough_liq_e` | static cadence — no refresh, no upsert benefit |
| `marlborough_liq_f` | static cadence — no refresh, no upsert benefit |
| `marlborough_liquefaction_a` | static cadence — no refresh, no upsert benefit |
| `marlborough_liquefaction_b` | static cadence — no refresh, no upsert benefit |
| `marlborough_liquefaction_c` | static cadence — no refresh, no upsert benefit |
| `marlborough_liquefaction_d` | static cadence — no refresh, no upsert benefit |
| `marlborough_liquefaction_e` | static cadence — no refresh, no upsert benefit |
| `marlborough_liquefaction_f` | static cadence — no refresh, no upsert benefit |
| `marlborough_noise` | static cadence — no refresh, no upsert benefit |
| `marlborough_notable_trees` | no upstream_url set — populate URL first |
| `marlborough_plan_zones` | no upstream_url set — populate URL first |
| `marlborough_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `marlborough_slr` | static cadence — no refresh, no upsert benefit |
| `marlborough_steep_erosion` | no upstream_url set — populate URL first |
| `marlborough_steep_erosion` | no upstream_url set — populate URL first |
| `marlborough_tsunami` | static cadence — no refresh, no upsert benefit |
| `masterton_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `matamata_piako_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `metlink_gtfs` | no upstream_url set — populate URL first |
| `nelson_coastal_inundation` | no upstream_url set — populate URL first |
| `nelson_fault_awareness` | static cadence — no refresh, no upsert benefit |
| `nelson_fault_corridor` | static cadence — no refresh, no upsert benefit |
| `nelson_fault_deformation` | static cadence — no refresh, no upsert benefit |
| `nelson_fault_hazard` | static cadence — no refresh, no upsert benefit |
| `nelson_fault_hazard_nrmp` | static cadence — no refresh, no upsert benefit |
| `nelson_flood` | no upstream_url set — populate URL first |
| `nelson_flood_future` | no upstream_url set — populate URL first |
| `nelson_flood_overlay` | no upstream_url set — populate URL first |
| `nelson_floodway` | no upstream_url set — populate URL first |
| `nelson_gtfs` | no upstream_url set — populate URL first |
| `nelson_heritage` | no upstream_url set — populate URL first |
| `nelson_high_flood` | no upstream_url set — populate URL first |
| `nelson_inundation` | no upstream_url set — populate URL first |
| `nelson_liquefaction` | static cadence — no refresh, no upsert benefit |
| `nelson_liquefaction_nrmp` | static cadence — no refresh, no upsert benefit |
| `nelson_maitai_flood_2013` | no upstream_url set — populate URL first |
| `nelson_maitai_flood_2100` | no upstream_url set — populate URL first |
| `nelson_notable_trees` | no upstream_url set — populate URL first |
| `nelson_plan_zones` | no upstream_url set — populate URL first |
| `nelson_river_flood_2130` | no upstream_url set — populate URL first |
| `nelson_river_flood_present` | no upstream_url set — populate URL first |
| `nelson_slope` | static cadence — no refresh, no upsert benefit |
| `nelson_slope_failure_register` | static cadence — no refresh, no upsert benefit |
| `nelson_slope_instability` | static cadence — no refresh, no upsert benefit |
| `nelson_slope_instability_pc29` | static cadence — no refresh, no upsert benefit |
| `nelson_tahunanui_liquefaction` | static cadence — no refresh, no upsert benefit |
| `nelson_tasman_tsunami` | static cadence — no refresh, no upsert benefit |
| `nelson_trees` | no upstream_url set — populate URL first |
| `nelson_tsunami_evac` | static cadence — no refresh, no upsert benefit |
| `northland_coastal_erosion` | no upstream_url set — populate URL first |
| `northland_coastal_flood` | no upstream_url set — populate URL first |
| `northland_coastal_flood_full` | no upstream_url set — populate URL first |
| `northland_erosion_prone` | no upstream_url set — populate URL first |
| `northland_flood_10yr` | no upstream_url set — populate URL first |
| `northland_flood_50yr` | no upstream_url set — populate URL first |
| `northland_river_flood_100yr` | no upstream_url set — populate URL first |
| `northland_river_flood_10yr` | no upstream_url set — populate URL first |
| `northland_river_flood_50yr` | no upstream_url set — populate URL first |
| `northland_tsunami` | static cadence — no refresh, no upsert benefit |
| `npdc_coastal_erosion` | no upstream_url set — populate URL first |
| `npdc_coastal_flood` | no upstream_url set — populate URL first |
| `npdc_fault_hazard` | static cadence — no refresh, no upsert benefit |
| `npdc_flood_plain` | no upstream_url set — populate URL first |
| `npdc_heritage` | no upstream_url set — populate URL first |
| `npdc_liquefaction` | static cadence — no refresh, no upsert benefit |
| `npdc_noise` | static cadence — no refresh, no upsert benefit |
| `npdc_sna` | no upstream_url set — populate URL first |
| `npdc_stormwater_flood` | no upstream_url set — populate URL first |
| `npdc_trees` | no upstream_url set — populate URL first |
| `npdc_volcanic_hazard` | static cadence — no refresh, no upsert benefit |
| `npdc_zones` | no upstream_url set — populate URL first |
| `nrc_contaminated_land` | no upstream_url set — populate URL first |
| `nrc_flood_susceptible` | no upstream_url set — populate URL first |
| `nzta_noise_contours` | no upstream_url set — populate URL first |
| `orc_coastal_erosion_dunedin` | no upstream_url set — populate URL first |
| `orc_coastal_hazard` | no upstream_url set — populate URL first |
| `orc_dunedin_tsunami` | static cadence — no refresh, no upsert benefit |
| `orc_floodway_clutha` | no upstream_url set — populate URL first |
| `orc_floodway_hendersons` | no upstream_url set — populate URL first |
| `orc_floodway_taieri` | no upstream_url set — populate URL first |
| `orc_hail` | no upstream_url set — populate URL first |
| `orc_liquefaction_otago` | static cadence — no refresh, no upsert benefit |
| `orc_storm_surge` | static cadence — no refresh, no upsert benefit |
| `orc_storm_surge` | static cadence — no refresh, no upsert benefit |
| `orc_tsunami_affected` | static cadence — no refresh, no upsert benefit |
| `orc_waitaki_floodplain` | no upstream_url set — populate URL first |
| `otago_liquefaction` | static cadence — no refresh, no upsert benefit |
| `otorohanga_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `palmerston_north_gtfs` | no upstream_url set — populate URL first |
| `palmerston_north_heritage` | no upstream_url set — populate URL first |
| `palmerston_north_trees` | no upstream_url set — populate URL first |
| `palmerston_north_zones` | no upstream_url set — populate URL first |
| `pcc_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `pncc_airport_noise` | static cadence — no refresh, no upsert benefit |
| `pncc_flood_prone` | no upstream_url set — populate URL first |
| `pncc_heritage_dp` | no upstream_url set — populate URL first |
| `pncc_notable_trees` | no upstream_url set — populate URL first |
| `pncc_overlays` | static cadence — no refresh, no upsert benefit |
| `porirua_coastal_erosion_current` | no upstream_url set — populate URL first |
| `porirua_coastal_erosion_slr` | no upstream_url set — populate URL first |
| `porirua_coastal_inundation` | no upstream_url set — populate URL first |
| `porirua_coastal_inundation_slr` | no upstream_url set — populate URL first |
| `porirua_ecological` | no upstream_url set — populate URL first |
| `porirua_fault_rupture` | static cadence — no refresh, no upsert benefit |
| `porirua_flood` | no upstream_url set — populate URL first |
| `porirua_ground_shaking` | static cadence — no refresh, no upsert benefit |
| `porirua_heritage` | no upstream_url set — populate URL first |
| `porirua_landslide_runout` | static cadence — no refresh, no upsert benefit |
| `porirua_landslide_suscept` | static cadence — no refresh, no upsert benefit |
| `porirua_liquefaction` | static cadence — no refresh, no upsert benefit |
| `porirua_tsunami_1000yr` | static cadence — no refresh, no upsert benefit |
| `porirua_tsunami_100yr` | static cadence — no refresh, no upsert benefit |
| `porirua_tsunami_500yr` | static cadence — no refresh, no upsert benefit |
| `porirua_zones` | no upstream_url set — populate URL first |
| `qldc_active_faults` | static cadence — no refresh, no upsert benefit |
| `qldc_active_folds` | static cadence — no refresh, no upsert benefit |
| `qldc_alluvial_fans` | static cadence — no refresh, no upsert benefit |
| `qldc_avalanche` | static cadence — no refresh, no upsert benefit |
| `qldc_damburst` | static cadence — no refresh, no upsert benefit |
| `qldc_debris_rockfall` | static cadence — no refresh, no upsert benefit |
| `qldc_erosion` | no upstream_url set — populate URL first |
| `qldc_flood` | no upstream_url set — populate URL first |
| `qldc_heritage` | no upstream_url set — populate URL first |
| `qldc_landslide` | static cadence — no refresh, no upsert benefit |
| `qldc_liquefaction` | static cadence — no refresh, no upsert benefit |
| `qldc_rainfall_flood` | no upstream_url set — populate URL first |
| `qldc_zones` | no upstream_url set — populate URL first |
| `queenstown_gtfs` | no upstream_url set — populate URL first |
| `queenstown_orc_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `rail_vibration` | static cadence — no refresh, no upsert benefit |
| `rangitikei_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `resource_consents` | no upstream_url set — populate URL first |
| `rotorua_airport_noise` | static cadence — no refresh, no upsert benefit |
| `rotorua_caldera` | static cadence — no refresh, no upsert benefit |
| `rotorua_fault_avoidance` | static cadence — no refresh, no upsert benefit |
| `rotorua_geothermal` | static cadence — no refresh, no upsert benefit |
| `rotorua_gtfs` | no upstream_url set — populate URL first |
| `rotorua_gucm_flood` | no upstream_url set — populate URL first |
| `rotorua_heritage` | no upstream_url set — populate URL first |
| `rotorua_landslide` | static cadence — no refresh, no upsert benefit |
| `rotorua_liquefaction` | static cadence — no refresh, no upsert benefit |
| `rotorua_ncm_flood` | no upstream_url set — populate URL first |
| `rotorua_scm_flood` | no upstream_url set — populate URL first |
| `rotorua_sna` | no upstream_url set — populate URL first |
| `rotorua_soft_ground` | static cadence — no refresh, no upsert benefit |
| `rotorua_trees` | no upstream_url set — populate URL first |
| `rotorua_zones` | no upstream_url set — populate URL first |
| `ruapehu_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `school_zones` | no upstream_url set — populate URL first |
| `selwyn_faults` | static cadence — no refresh, no upsert benefit |
| `selwyn_flood_zones` | no upstream_url set — populate URL first |
| `selwyn_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `south_waikato_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `south_wairarapa_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `southland_active_faults` | static cadence — no refresh, no upsert benefit |
| `southland_contaminated` | no upstream_url set — populate URL first |
| `southland_dc_coastal_hazard` | no upstream_url set — populate URL first |
| `southland_dc_flood` | no upstream_url set — populate URL first |
| `southland_dc_heritage` | no upstream_url set — populate URL first |
| `southland_dc_noise` | static cadence — no refresh, no upsert benefit |
| `southland_floodplains` | no upstream_url set — populate URL first |
| `southland_hail` | no upstream_url set — populate URL first |
| `southland_liquefaction` | static cadence — no refresh, no upsert benefit |
| `southland_shaking` | static cadence — no refresh, no upsert benefit |
| `southland_tsunami` | static cadence — no refresh, no upsert benefit |
| `taranaki_active_faults` | static cadence — no refresh, no upsert benefit |
| `taranaki_faults` | static cadence — no refresh, no upsert benefit |
| `taranaki_gtfs` | no upstream_url set — populate URL first |
| `taranaki_hail` | no upstream_url set — populate URL first |
| `taranaki_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `taranaki_tsunami` | static cadence — no refresh, no upsert benefit |
| `taranaki_volcanic` | no upstream_url set — populate URL first |
| `taranaki_volcanic_evac` | no upstream_url set — populate URL first |
| `tararua_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `tasman_coastal_erosion_structures` | no upstream_url set — populate URL first |
| `tasman_coastal_slr_05m` | no upstream_url set — populate URL first |
| `tasman_coastal_slr_15m` | no upstream_url set — populate URL first |
| `tasman_coastal_slr_1m` | no upstream_url set — populate URL first |
| `tasman_coastal_slr_2m` | no upstream_url set — populate URL first |
| `tasman_coastal_slr_present` | no upstream_url set — populate URL first |
| `tasman_faults` | static cadence — no refresh, no upsert benefit |
| `tasman_historic_floods` | no upstream_url set — populate URL first |
| `tasman_liquefaction` | static cadence — no refresh, no upsert benefit |
| `tasman_plan_zones` | no upstream_url set — populate URL first |
| `tasman_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `taupo_fault_avoidance` | static cadence — no refresh, no upsert benefit |
| `taupo_fault_awareness` | static cadence — no refresh, no upsert benefit |
| `taupo_flood` | no upstream_url set — populate URL first |
| `taupo_geothermal` | static cadence — no refresh, no upsert benefit |
| `taupo_heritage` | no upstream_url set — populate URL first |
| `taupo_landslide` | static cadence — no refresh, no upsert benefit |
| `taupo_liquefaction` | static cadence — no refresh, no upsert benefit |
| `taupo_noise` | static cadence — no refresh, no upsert benefit |
| `taupo_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `taupo_trees` | no upstream_url set — populate URL first |
| `taupo_zones` | no upstream_url set — populate URL first |
| `tauranga_archaeological` | no upstream_url set — populate URL first |
| `tauranga_bop_gtfs` | no upstream_url set — populate URL first |
| `tauranga_coastal_erosion` | no upstream_url set — populate URL first |
| `tauranga_flood` | no upstream_url set — populate URL first |
| `tauranga_flood_dxv` | no upstream_url set — populate URL first |
| `tauranga_harbour_inundation` | no upstream_url set — populate URL first |
| `tauranga_heritage` | no upstream_url set — populate URL first |
| `tauranga_liquefaction` | static cadence — no refresh, no upsert benefit |
| `tauranga_noise` | static cadence — no refresh, no upsert benefit |
| `tauranga_plan_zones` | no upstream_url set — populate URL first |
| `tauranga_slope` | static cadence — no refresh, no upsert benefit |
| `tauranga_slope_hazard` | static cadence — no refresh, no upsert benefit |
| `tauranga_trees` | no upstream_url set — populate URL first |
| `tauranga_tsunami` | static cadence — no refresh, no upsert benefit |
| `thames_coromandel_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `timaru_coastal_hazard` | no upstream_url set — populate URL first |
| `timaru_earthquake_fault` | static cadence — no refresh, no upsert benefit |
| `timaru_ecological` | no upstream_url set — populate URL first |
| `timaru_flood` | no upstream_url set — populate URL first |
| `timaru_heritage` | no upstream_url set — populate URL first |
| `timaru_liquefaction` | static cadence — no refresh, no upsert benefit |
| `timaru_noise` | static cadence — no refresh, no upsert benefit |
| `timaru_notable_trees_extra` | no upstream_url set — populate URL first |
| `timaru_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `timaru_trees` | no upstream_url set — populate URL first |
| `timaru_zones` | no upstream_url set — populate URL first |
| `uhcc_100yr_flood` | no upstream_url set — populate URL first |
| `uhcc_contaminated_land` | no upstream_url set — populate URL first |
| `uhcc_ecological` | no upstream_url set — populate URL first |
| `uhcc_erosion` | no upstream_url set — populate URL first |
| `uhcc_heritage` | no upstream_url set — populate URL first |
| `uhcc_notable_trees` | no upstream_url set — populate URL first |
| `uhcc_overland_flow` | static cadence — no refresh, no upsert benefit |
| `uhcc_peat_overlay` | static cadence — no refresh, no upsert benefit |
| `uhcc_pinehaven_flood` | no upstream_url set — populate URL first |
| `uhcc_plan_zones` | no upstream_url set — populate URL first |
| `uhcc_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `uhcc_slope_hazard` | static cadence — no refresh, no upsert benefit |
| `uhcc_wellington_fault` | static cadence — no refresh, no upsert benefit |
| `viewshafts` | no upstream_url set — populate URL first |
| `waikato_dc_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `waikato_flood` | no upstream_url set — populate URL first |
| `waikato_flood_1pct` | no upstream_url set — populate URL first |
| `waikato_flood_depth` | no upstream_url set — populate URL first |
| `waikato_geothermal` | static cadence — no refresh, no upsert benefit |
| `waikato_geothermal_subsidence` | static cadence — no refresh, no upsert benefit |
| `waikato_ground_shaking` | static cadence — no refresh, no upsert benefit |
| `waikato_liquefaction` | static cadence — no refresh, no upsert benefit |
| `waikato_regional_flood` | no upstream_url set — populate URL first |
| `waikato_tsunami` | static cadence — no refresh, no upsert benefit |
| `waikato_tsunami_inundation` | static cadence — no refresh, no upsert benefit |
| `waimakariri_ashley_fault` | static cadence — no refresh, no upsert benefit |
| `waimakariri_ecological` | no upstream_url set — populate URL first |
| `waimakariri_fault_awareness` | static cadence — no refresh, no upsert benefit |
| `waimakariri_flood_ashley` | no upstream_url set — populate URL first |
| `waimakariri_flood_coastal` | no upstream_url set — populate URL first |
| `waimakariri_flood_localised` | no upstream_url set — populate URL first |
| `waimakariri_heritage` | no upstream_url set — populate URL first |
| `waimakariri_liquefaction` | static cadence — no refresh, no upsert benefit |
| `waimakariri_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `waimakariri_trees` | no upstream_url set — populate URL first |
| `waimakariri_zones` | no upstream_url set — populate URL first |
| `waimate_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `waipa_airport_noise` | static cadence — no refresh, no upsert benefit |
| `waipa_flood_hazard` | no upstream_url set — populate URL first |
| `waipa_heritage` | no upstream_url set — populate URL first |
| `waipa_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `waipa_sna` | no upstream_url set — populate URL first |
| `waipa_trees` | no upstream_url set — populate URL first |
| `waipa_zones` | no upstream_url set — populate URL first |
| `wairarapa_contaminated` | no upstream_url set — populate URL first |
| `wairarapa_erosion` | no upstream_url set — populate URL first |
| `wairarapa_fault_hazard` | static cadence — no refresh, no upsert benefit |
| `wairarapa_flood_100yr` | no upstream_url set — populate URL first |
| `wairarapa_flood_50yr` | no upstream_url set — populate URL first |
| `wairarapa_heritage` | no upstream_url set — populate URL first |
| `wairarapa_liquefaction` | static cadence — no refresh, no upsert benefit |
| `wairarapa_noise` | static cadence — no refresh, no upsert benefit |
| `wairarapa_notable_trees` | no upstream_url set — populate URL first |
| `wairarapa_plan_zones` | no upstream_url set — populate URL first |
| `wairarapa_sna` | no upstream_url set — populate URL first |
| `wairarapa_tsunami` | static cadence — no refresh, no upsert benefit |
| `waitaki_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `waitomo_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `wcc_hazards` | static cadence — no refresh, no upsert benefit |
| `wcc_heritage` | no upstream_url set — populate URL first |
| `wcc_heritage_areas` | no upstream_url set — populate URL first |
| `wcc_notable_trees` | no upstream_url set — populate URL first |
| `wcc_solar` | static cadence — no refresh, no upsert benefit |
| `westcoast_active_faults` | static cadence — no refresh, no upsert benefit |
| `westcoast_alpine_fault` | static cadence — no refresh, no upsert benefit |
| `westcoast_coastal_hazard` | no upstream_url set — populate URL first |
| `westcoast_earthquake_landslides` | static cadence — no refresh, no upsert benefit |
| `westcoast_landslide_catalog` | static cadence — no refresh, no upsert benefit |
| `westcoast_plan_zones` | no upstream_url set — populate URL first |
| `westcoast_rain_landslides` | static cadence — no refresh, no upsert benefit |
| `westcoast_rockfall` | static cadence — no refresh, no upsert benefit |
| `westcoast_tsunami_evac` | static cadence — no refresh, no upsert benefit |
| `westcoast_ttpp_fault_avoid` | static cadence — no refresh, no upsert benefit |
| `westcoast_ttpp_flood_severe` | no upstream_url set — populate URL first |
| `westcoast_ttpp_flood_suscept` | no upstream_url set — populate URL first |
| `westcoast_ttpp_floodplain` | no upstream_url set — populate URL first |
| `westcoast_ttpp_tsunami` | static cadence — no refresh, no upsert benefit |
| `whakatane_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `whanganui_coastal_erosion` | no upstream_url set — populate URL first |
| `whanganui_flood_risk_a` | no upstream_url set — populate URL first |
| `whanganui_flood_risk_b` | no upstream_url set — populate URL first |
| `whanganui_heritage` | no upstream_url set — populate URL first |
| `whanganui_land_stability_a` | static cadence — no refresh, no upsert benefit |
| `whanganui_land_stability_b` | static cadence — no refresh, no upsert benefit |
| `whanganui_liquefaction_high` | static cadence — no refresh, no upsert benefit |
| `whanganui_liquefaction_low` | static cadence — no refresh, no upsert benefit |
| `whanganui_liquefaction_moderate` | static cadence — no refresh, no upsert benefit |
| `whanganui_plan_zones` | no upstream_url set — populate URL first |
| `whanganui_protected_trees` | no upstream_url set — populate URL first |
| `whanganui_rates` | continuous (lazy-fetch placeholder, not bulk-loaded) |
| `whanganui_tsunami_orange` | static cadence — no refresh, no upsert benefit |
| `whanganui_tsunami_red` | static cadence — no refresh, no upsert benefit |
| `whanganui_tsunami_yellow` | static cadence — no refresh, no upsert benefit |
| `whangarei_airport_noise` | static cadence — no refresh, no upsert benefit |
| `whangarei_coastal_hazard` | no upstream_url set — populate URL first |
| `whangarei_flood` | no upstream_url set — populate URL first |
| `whangarei_gtfs` | no upstream_url set — populate URL first |
| `whangarei_heritage` | no upstream_url set — populate URL first |
| `whangarei_land_stability` | static cadence — no refresh, no upsert benefit |
| `whangarei_land_stability` | static cadence — no refresh, no upsert benefit |
| `whangarei_liquefaction` | static cadence — no refresh, no upsert benefit |
| `whangarei_liquefaction` | static cadence — no refresh, no upsert benefit |
| `whangarei_noise_control` | static cadence — no refresh, no upsert benefit |
| `whangarei_trees` | no upstream_url set — populate URL first |
| `whangarei_tsunami` | static cadence — no refresh, no upsert benefit |
| `whangarei_zones_commercial` | no upstream_url set — populate URL first |
| `whangarei_zones_industrial` | no upstream_url set — populate URL first |
| `whangarei_zones_residential` | no upstream_url set — populate URL first |
| `whangarei_zones_rural` | no upstream_url set — populate URL first |