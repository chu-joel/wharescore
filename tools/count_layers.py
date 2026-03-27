"""Count DataSource layers per region."""
import re
from collections import defaultdict

code = open('backend/app/services/data_loader.py', encoding='utf-8').read()

# Extract (table, source_council) from _load_council_arcgis calls
pairs = re.findall(
    r'_load_council_arcgis\(conn, log,\s*\n\s*"[^"]+",\s*\n\s*"(\w+)",\s*"([^"]+)"',
    code
)

# Also count custom loaders by their DataSource key prefixes
custom_keys = re.findall(r'DataSource\(\s*"(\w+)"', code)

# Map source_council values to regions
REGION_MAP = {
    # Auckland
    'auckland': 'Auckland', 'auckland_flood_sensitive': 'Auckland', 'auckland_ascie': 'Auckland',
    'auckland_avf_vents': 'Auckland', 'auckland_avf_boundary': 'Auckland',
    'auckland_avf_5km': 'Auckland', 'auckland_avf_deposits': 'Auckland',
    # Wellington
    'wellington': 'Wellington', 'wellington_city': 'Wellington', 'wellington_heritage': 'Wellington',
    'greater_wellington': 'Wellington', 'gwrc_1pct_aep': 'Wellington',
    'gwrc_storm_present': 'Wellington', 'gwrc_storm_50cm': 'Wellington', 'gwrc_storm_100cm': 'Wellington',
    # Christchurch
    'christchurch': 'Christchurch', 'christchurch_regional': 'Christchurch',
    # Hamilton
    'hamilton': 'Hamilton', 'hamilton_overland': 'Hamilton',
    # Tauranga
    'tauranga': 'Tauranga', 'tauranga_landslide': 'Tauranga',
    # Dunedin
    'dunedin': 'Dunedin', 'dunedin_coastal': 'Dunedin',
    # QLDC
    'queenstown_lakes': 'QLDC',
    # Otago/ORC
    'otago': 'Otago/ORC', 'orc_storm_surge': 'Otago/ORC',
    'orc_waitaki_floodplain': 'Otago/ORC', 'orc_coastplan': 'Otago/ORC',
    # Hawke's Bay
    'hawkes_bay': "Hawke's Bay", 'hawkes_bay_regional': "Hawke's Bay",
    'hastings_ponding': "Hawke's Bay", 'hawkes_bay_2024': "Hawke's Bay",
    'hbrc_high_delivery': "Hawke's Bay", 'hbrc_high_nodelivery': "Hawke's Bay",
    'hbrc_earthflow_mod': "Hawke's Bay", 'hbrc_earthflow_severe': "Hawke's Bay",
    'hbrc_gully': "Hawke's Bay", 'hbrc_heretaunga': "Hawke's Bay",
    'hbrc_chb_hdc_wdc': "Hawke's Bay", 'hbrc_present': "Hawke's Bay",
    'hbrc_2023': "Hawke's Bay", 'hbrc_wairoa_bank': "Hawke's Bay",
    # Nelson
    'nelson': 'Nelson', 'nelson_nrmp': 'Nelson', 'nelson_awareness': 'Nelson',
    'nelson_deformation': 'Nelson', 'nelson_fault_hazard': 'Nelson',
    'nelson_inundation': 'Nelson', 'nelson_slope': 'Nelson',
    'nelson_flood_overlay': 'Nelson', 'nelson_high_flood': 'Nelson',
    'nelson_river_present': 'Nelson', 'nelson_river_2130': 'Nelson',
    'nelson_coastal': 'Nelson', 'nelson_tahunanui': 'Nelson',
    'nelson_slope_register': 'Nelson', 'nelson_corridor': 'Nelson',
    'nelson_maitai_2013': 'Nelson', 'nelson_maitai_2100': 'Nelson',
    # Nelson/Tasman shared
    'nelson_tasman': 'Nelson/Tasman',
    # Tasman
    'tasman': 'Tasman',
    # Whangarei
    'whangarei': 'Whangarei', 'whangarei_residential': 'Whangarei',
    'whangarei_commercial': 'Whangarei', 'whangarei_rural': 'Whangarei',
    'whangarei_industrial': 'Whangarei',
    # Northland
    'northland': 'Northland', 'northland_coastal': 'Northland',
    'northland_current': 'Northland', 'northland_river_100yr': 'Northland',
    'northland_river_50yr': 'Northland', 'northland_river_10yr': 'Northland',
    'northland_erosion': 'Northland', 'northland_flood_suscept': 'Northland',
    # Bay of Plenty
    'bop_volcanic': 'Bay of Plenty', 'bop_ohiwa': 'Bay of Plenty',
    'bop_sensitive': 'Bay of Plenty',
    # Waikato
    'waikato': 'Waikato', 'waikato_1pct': 'Waikato', 'waipa': 'Waikato',
    # Gisborne
    'gisborne': 'Gisborne',
    # Southland
    'invercargill': 'Southland', 'southland': 'Southland',
    # Canterbury/ECan
    'canterbury': 'Canterbury/ECan', 'ecan_kaikoura': 'Canterbury/ECan',
    'ecan_waitaki': 'Canterbury/ECan', 'ecan_floodway': 'Canterbury/ECan',
    'ecan_rcep': 'Canterbury/ECan', 'ecan_sea_inundation': 'Canterbury/ECan',
    'ecan_kaikoura_landslide': 'Canterbury/ECan', 'ecan_kaikoura_debris': 'Canterbury/ECan',
    'ecan_kaikoura_faults': 'Canterbury/ECan', 'ecan_fault_awareness': 'Canterbury/ECan',
    'ecan_ostler_fault': 'Canterbury/ECan',
    # Marlborough
    'marlborough': 'Marlborough', 'marlborough_erosion': 'Marlborough',
    'marlborough_slr': 'Marlborough',
    'marlborough_liq_a': 'Marlborough', 'marlborough_liq_b': 'Marlborough',
    'marlborough_liq_c': 'Marlborough', 'marlborough_liq_d': 'Marlborough',
    'marlborough_liq_e': 'Marlborough', 'marlborough_liq_f': 'Marlborough',
    # Taranaki
    'taranaki': 'Taranaki', 'taranaki_volcanic': 'Taranaki',
    'taranaki_volcanic_evac': 'Taranaki',
    # West Coast
    'westcoast_active': 'West Coast', 'westcoast_alpine': 'West Coast',
    'westcoast_landslide': 'West Coast', 'westcoast_eq_landslide': 'West Coast',
    'westcoast_rain_landslide': 'West Coast', 'westcoast': 'West Coast',
    'westcoast_coastal': 'West Coast', 'westcoast_rockfall': 'West Coast',
    'westcoast_floodplain': 'West Coast', 'westcoast_flood_severe': 'West Coast',
    'westcoast_flood_suscept': 'West Coast', 'westcoast_fault_avoid': 'West Coast',
    'westcoast_ttpp': 'West Coast',
    # Horizons
    'horizons_200yr': 'Horizons', 'horizons_observed': 'Horizons',
    'horizons_floodways': 'Horizons', 'horizons_lahar': 'Horizons',
    'horizons_coastal': 'Horizons',
    # Smaller councils
    'kapiti_coast': 'Kapiti Coast', 'porirua': 'Porirua',
    'palmerston_north': 'Palmerston North', 'rotorua': 'Rotorua',
    'taupo': 'Taupo', 'timaru': 'Timaru', 'waimakariri': 'Waimakariri',
}

council_counts = defaultdict(int)
for table, council in pairs:
    region = REGION_MAP.get(council)
    if not region:
        # Try prefix match
        for prefix, reg in REGION_MAP.items():
            if council.startswith(prefix):
                region = reg
                break
        else:
            region = council
    council_counts[region] += 1

# Count custom loaders (non-_load_council_arcgis)
# These are national datasets + special loaders
custom_loader_keys = [k for k in custom_keys if not any(
    k.startswith(p) for p in [
        'auckland', 'wellington', 'christchurch', 'hamilton', 'tauranga', 'dunedin',
        'queenstown', 'nelson', 'tasman', 'hawkes', 'whangarei', 'northland',
        'bop', 'waikato', 'waipa', 'gisborne', 'invercargill', 'southland',
        'canterbury', 'ecan', 'marlborough', 'taranaki', 'westcoast', 'horizons',
        'gwrc', 'hbrc', 'orc', 'nrc', 'kapiti', 'porirua', 'palmerston',
        'rotorua', 'taupo', 'timaru', 'waimakariri', 'chch', 'qldc',
        'wcc', 'tauranga'
    ]
)]

national_count = 0
for k in custom_keys:
    if k.startswith(('gns_', 'doc_', 'school_', 'nzta_', 'weather_', 'linz_', 'niwa_')):
        national_count += 1
    elif k in ('earthquakes', 'climate_projections', 'air_quality', 'water_quality',
               'crime_data', 'nzdep', 'heritage_nz', 'infrastructure_projects',
               'wildfire_risk', 'conservation_land', 'building_outlines',
               'property_titles', 'road_noise'):
        national_count += 1

if national_count > 0:
    council_counts['National'] = national_count

# Sort by count
sorted_counts = sorted(council_counts.items(), key=lambda x: -x[1])
total_mapped = sum(c for _, c in sorted_counts)
print(f'| Region | Layers |')
print(f'|--------|-------:|')
for region, count in sorted_counts:
    print(f'| {region} | {count} |')
print(f'| **TOTAL (mapped)** | **{total_mapped}** |')
print(f'| Total DataSource entries | {len(custom_keys)} |')
