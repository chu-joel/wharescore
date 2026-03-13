#!/usr/bin/env python3
"""Comprehensive report verification."""

from app.services.report_html import build_insights, build_lifestyle_fit, build_humanized_hazards, render

# Full test report
r = {
    'address': {
        'full_address': '162 Cuba Street, Wellington',
        'suburb': 'Te Aro',
        'city': 'Wellington',
        'sa2_name': 'Te Aro',
        'latitude': -41.2955,
        'longitude': 174.7762,
    },
    'scores': {
        'composite': 56,
        'rating': {'label': 'Moderate', 'color': '#E69F00'},
        'categories': {
            'hazards': 48.0,
            'environment': 59.0,
            'liveability': 62.0,
            'planning': 60.0,
        }
    },
    'hazards': {
        'flood': None,
        'liquefaction': 'High',
        'wind_zone': 'VH',
        'tsunami_zone_class': 2,
        'earthquake_count_30km': 13,
        'epb_count_300m': 7,
        'wildfire_trend': 'Very likely decreasing',
        'wildfire_vhe_days': 5,
    },
    'environment': {
        'road_noise_db': 67,
        'air_pm10_site': 'Willis St',
        'air_pm10_distance_m': 270,
        'contam_nearest_name': 'Old Gasworks',
        'contam_nearest_distance_m': 150,
        'contam_nearest_category': 'B',
    },
    'liveability': {
        'nzdep_decile': 3,
        'crime_victimisations': 45,
        'crime_percentile': 72,
        'crime_city_median': 38,
        'transit_stops_400m': 15,
        'nearest_supermarket_name': 'Countdown Cuba',
        'nearest_supermarket_distance_m': 120,
        'nearest_gp_name': 'Cuba St Medical',
        'nearest_gp_distance_m': 250,
        'crashes_300m_serious': 2,
        'amenities_500m': {'cafe': 45, 'restaurant': 38, 'shop': 120},
        'schools': [
            {'name': 'Te Aro School', 'eqi': 430, 'in_zone': True, 'distance_m': 400, 'school_type': 'Primary', 'total_roll': 250},
            {'name': 'Te Aro Intermediate', 'eqi': 445, 'in_zone': True, 'distance_m': 500, 'school_type': 'Intermediate', 'total_roll': 400},
            {'name': 'Wellington High', 'eqi': 455, 'in_zone': False, 'distance_m': 1200, 'school_type': 'Secondary', 'total_roll': 1200},
        ],
    },
    'market': {
        'rental_overview': [
            {'dwelling_type': 'House', 'beds': 'ALL', 'median': 550, 'bonds': 120, 'yoy_pct': 3.2},
        ],
        'trends': [
            {'dwelling_type': 'ALL', 'beds': 'ALL', 'cagr_1yr': 3.2, 'cagr_5yr': 3.1},
        ]
    },
    'planning': {
        'zone_name': 'City Centre',
        'max_height_m': 24,
        'resource_consents_500m_2yr': 8,
    },
    'property': {
        'capital_value': 750000,
        'land_value': 400000,
    },
}

# Build
insights = build_insights(r)
lf, tips = build_lifestyle_fit(r)
html = render(r, insights, (lf, tips), None)

print("=" * 70)
print("COMPREHENSIVE REPORT VERIFICATION")
print("=" * 70)

# Checklist
checks = {
    'Executive Summary': 'Executive Summary' in html,
    'Hazard Table (all 8)': 'Flood Zone' in html and 'Liquefaction' in html and 'Wind Zone' in html,
    'Hazard Humanization': 'Outside mapped flood zones' in html,
    'In-Zone Schools': 'In-Zone Schools' in html and 'Te Aro School' in html,
    'Other Schools': 'Other Nearby Schools' in html and 'Wellington High' in html,
    'Nearest Supermarket (cover)': 'Countdown Cuba' in html,
    'Crime Data': 'Crime' in html and '72' in html,
    'Transit': 'Public Transport' in html and '15' in html,
    'Amenities': 'Amenities within 500m' in html,
    'Investment Box': 'Investment Snapshot' in html and '$750' in html,
    'Collapsible Sections': 'details class="sec"' in html,
    'Section Badges': 'sec-badge' in html,
    'Red Flags': 'Issue' in html or 'issues' in html,
    'Key Questions': 'Key Questions' in html,
    'Disclaimer': 'Disclaimer' in html,
}

passed = 0
for name, result in checks.items():
    status = '[OK]' if result else '[FAIL]'
    print(f"{status} {name}")
    if result:
        passed += 1

print(f"\nPassed: {passed}/{len(checks)}\n")

# Insights summary
print("INSIGHTS GENERATED:")
print("-" * 70)
total_insights = 0
for section, sec_ins in insights.items():
    if sec_ins:
        total_insights += len(sec_ins)
        warn_count = sum(1 for i in sec_ins if i['level'] == 'warn')
        print(f"  {section:15} {len(sec_ins):2} insights ({warn_count} warn)")

print(f"\nTotal insights: {total_insights}\n")

# Schools
in_zone = [s for s in r['liveability']['schools'] if s.get('in_zone')]
print("SCHOOLS:")
print("-" * 70)
print(f"  In-zone schools: {len(in_zone)} ({', '.join(s['name'] for s in in_zone)})")
print(f"  Other schools: {len(r['liveability']['schools']) - len(in_zone)}\n")

# Map
print("MAP & COORDINATES:")
print("-" * 70)
has_coords = 'latitude' in r['address'] and 'longitude' in r['address']
print(f"  Address has lat/lng: {has_coords}")
map_tag = '<img class="map-img"'
has_map = map_tag in html
print(f"  Map in HTML: {has_map}")
print("  Note: To enable map, set MAPBOX_ACCESS_TOKEN in .env\n")

print("HTML SIZE:", f"{len(html):,} bytes")
sec_count = html.count('<details class="sec"')
print("Section count:", sec_count)
result = "PASS" if passed == len(checks) else f"FAILED ({len(checks) - passed} issues)"
print("All checks:", f"[RESULT] {result}")
