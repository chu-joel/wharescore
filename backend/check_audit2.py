"""Quick comparison of audit2 vs audit1 for the key fields we fixed."""
import json, os

REPORTS = {
    "WLG": "wlg_report.json",
    "AKL": "akl_report.json",
    "CHC": "chc_report.json",
    "ZQN": "zqn_report.json",
}

for label, path in REPORTS.items():
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    p = d.get("planning") or {}
    h = d.get("hazards") or {}
    l = d.get("liveability") or {}
    s = d.get("scores") or {}
    cmp_s = (d.get("comparisons") or {}).get("suburb") or {}
    cmp_c = (d.get("comparisons") or {}).get("city") or {}
    print(f"\n=== {label} ===")
    print(f"  planning.zone_name        : {p.get('zone_name')!r}")
    print(f"  planning.zone_code        : {p.get('zone_code')!r}")
    print(f"  planning.zone_category    : {p.get('zone_category')!r}")
    print(f"  hazards.flood_extent_label: {h.get('flood_extent_label')!r}")
    print(f"  hazards.flood_extent_aep  : {h.get('flood_extent_aep')!r}")
    print(f"  liveability.crime_percentile : {l.get('crime_percentile')}")
    print(f"  liveability.crime_area_unit  : {l.get('crime_area_unit')}")
    print(f"  liveability.crime_victimisations : {l.get('crime_victimisations')}")
    print(f"  liveability.walking_reach_10min : {l.get('walking_reach_10min')}")
    print(f"  comparisons.suburb.transit_count_400m : {cmp_s.get('transit_count_400m')}")
    print(f"  comparisons.suburb.max_noise_db       : {cmp_s.get('max_noise_db')}")
    print(f"  comparisons.city.avg_transit_count_400m : {cmp_c.get('avg_transit_count_400m')}")
    print(f"  comparisons.city.avg_noise_db          : {cmp_c.get('avg_noise_db')}")
    print(f"  scores.categories.market : {(s.get('categories') or {}).get('market')}")
    mkt = d.get("market") or {}
    print(f"  market.rental_overview rows: {len(mkt.get('rental_overview') or [])}")
