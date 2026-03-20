"""Audit data coverage per city — compare against Wellington baseline."""
import psycopg

conn = psycopg.connect("postgresql://postgres:postgres@localhost:5432/wharescore")
cur = conn.cursor()

city_councils = {
    "Wellington": ["greater_wellington", "wellington_city", None],
    "Auckland": ["auckland", "auckland_flood_sensitive"],
    "Christchurch": ["christchurch"],
    "Hamilton": ["hamilton", "hamilton_overland", "waikato"],
    "Tauranga": ["tauranga"],
    "Dunedin": ["dunedin", "dunedin_h2", "dunedin_h3", "dunedin_coastal"],
    "Napier/Hastings": ["hawkes_bay", "hawkes_bay_coastal"],
    "Nelson": ["nelson"],
}

# Categories: (label, table, uses_source_council)
categories = [
    ("Flood hazard (council)", "flood_hazard", True),
    ("Tsunami (council)", "tsunami_hazard", True),
    ("Liquefaction (council)", "liquefaction_detail", True),
    ("Slope failure / landslide", "slope_failure", True),
    ("Ground shaking", "ground_shaking", True),
    ("Earthquake hazard (CHI)", "earthquake_hazard", True),
    ("District plan zones", "district_plan_zones", True),
    ("Landslide susceptibility", "landslide_susceptibility", True),
    ("Flood extent (AEP)", "flood_extent", True),
    ("Viewshafts", "viewshafts", True),
    ("Character precincts", "character_precincts", True),
    ("Contaminated land", "contaminated_land", True),
    ("Coastal inundation", "coastal_inundation", True),
    ("Ecological areas", "significant_ecological_areas", True),
    ("Coastal erosion (council)", "coastal_erosion", True),
    ("Fault zones (council)", "fault_zones", True),
    ("Heritage overlay (points)", "historic_heritage_overlay", True),
    ("Heritage extent (polygons)", "heritage_extent", True),
    ("Aircraft noise", "aircraft_noise_overlay", True),
    ("Special character areas", "special_character_areas", True),
    ("Notable trees", "notable_trees", True),
    ("Height variation control", "height_variation_control", True),
    ("Mana whenua sites", "mana_whenua_sites", True),
    ("Geotech reports", "geotechnical_reports", True),
    ("Parks", "park_extents", True),
    ("Overland flow paths", "overland_flow_paths", True),
    ("Stormwater mgmt areas", "stormwater_management_area", True),
]

# Wellington-only tables (TRUNCATE-based, no source_council)
wellington_only = [
    ("Solar radiation", "wcc_solar_radiation"),
    ("EPBs", "earthquake_prone_buildings"),
    ("Resource consents", "resource_consents"),
    ("Height controls", "height_controls"),
    ("Corrosion zones", "corrosion_zones"),
    ("Rail vibration", "rail_vibration"),
    ("Erosion prone land", "erosion_prone_land"),
    ("Coastal elevation", "coastal_elevation"),
]

# National tables (cover all cities)
national = [
    ("Addresses", "addresses"),
    ("Parcels", "parcels"),
    ("Building outlines", "building_outlines"),
    ("Flood zones (national)", "flood_zones"),
    ("Tsunami zones (national)", "tsunami_zones"),
    ("Liquefaction zones (national)", "liquefaction_zones"),
    ("Earthquakes (GeoNet)", "earthquakes"),
    ("Schools (MOE)", "schools"),
    ("School zones", "school_zones"),
    ("Crashes (CAS)", "crashes"),
    ("Crime", "crime"),
    ("Heritage sites (HNZPT)", "heritage_sites"),
    ("Wind zones", "wind_zones"),
    ("Noise contours", "noise_contours"),
    ("Air quality", "air_quality_sites"),
    ("Water quality", "water_quality_sites"),
    ("Climate grid", "climate_grid"),
    ("Infrastructure projects", "infrastructure_projects"),
    ("SA2 boundaries", "sa2_boundaries"),
    ("Council valuations", "council_valuations"),
    ("OSM amenities", "osm_amenities"),
    ("Conservation land", "conservation_land"),
    ("Transmission lines", "transmission_lines"),
    ("Active faults (GNS)", "active_faults"),
    ("Landslide events (GNS)", "landslide_events"),
    ("Landslide areas (GNS)", "landslide_areas"),
    ("NZDep", "nzdep"),
    ("Transit stops", "transit_stops"),
]


def count_rows(table, councils=None):
    """Count rows for a table, optionally filtered by source_council."""
    try:
        if councils is None:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            return cur.fetchone()[0]
        total = 0
        for c in councils:
            if c is None:
                cur.execute(f"SELECT COUNT(*) FROM {table} WHERE source_council IS NULL")
            else:
                cur.execute(f"SELECT COUNT(*) FROM {table} WHERE source_council = %s", (c,))
            total += cur.fetchone()[0]
        return total
    except Exception:
        conn.rollback()
        return -1  # table doesn't exist


# Print national data first
print("=" * 65)
print("NATIONAL DATA (covers all cities)")
print("=" * 65)
for label, table in national:
    cnt = count_rows(table)
    status = f"{cnt:>12,}" if cnt >= 0 else "   NOT FOUND"
    print(f"  {label:<40} {status}")

# Audit each city
for city, councils in city_councils.items():
    print()
    print("=" * 65)
    print(f"{city.upper()}")
    print("=" * 65)

    has_list = []
    missing_list = []

    # Council-specific data
    for label, table, uses_council in categories:
        if uses_council:
            cnt = count_rows(table, councils)
        else:
            cnt = 0
        if cnt > 0:
            has_list.append((label, cnt))
        elif cnt == 0:
            missing_list.append(label)
        # cnt == -1 means table doesn't exist, also missing

    # Wellington-only tables
    if city == "Wellington":
        for label, table in wellington_only:
            cnt = count_rows(table)
            if cnt > 0:
                has_list.append((label, cnt))
            else:
                missing_list.append(label)

    # Transit
    if city == "Wellington":
        cnt = count_rows("metlink_stops")
        if cnt > 0:
            has_list.append(("Transit (Metlink GTFS)", cnt))
        cnt2 = count_rows("transit_travel_times")
        if cnt2 > 0:
            has_list.append(("Transit travel times", cnt2))
    elif city == "Auckland":
        cnt = count_rows("at_stops")
        if cnt > 0:
            has_list.append(("Transit (AT GTFS)", cnt))
        cnt2 = count_rows("at_travel_times")
        if cnt2 > 0:
            has_list.append(("Transit travel times", cnt2))
    else:
        missing_list.append("Transit (regional GTFS)")

    # Print results
    pct = len(has_list) / (len(has_list) + len(missing_list)) * 100 if (has_list or missing_list) else 0
    print(f"  Coverage: {len(has_list)}/{len(has_list) + len(missing_list)} ({pct:.0f}%)")
    print()
    print("  HAS DATA (%d):" % len(has_list))
    for label, cnt in has_list:
        print(f"    {label:<40} {cnt:>10,}")
    print()
    print("  MISSING (%d):" % len(missing_list))
    for label in missing_list:
        print(f"    - {label}")

conn.close()
