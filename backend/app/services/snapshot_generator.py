# backend/app/services/snapshot_generator.py
"""
Generates pre-computed report snapshots for the hosted interactive report page.

At purchase time, pre-computes all variant combinations and stores as JSONB:
- Base report (property, hazards, scores, market, area profile)
- Rent advisor baselines per dwelling_type:bedrooms combo
- Price advisor result
- Delta tables for client-side recalculation (finish, bathrooms, toggles)
- Chart data (rent history, HPI, crime trend)

The snapshot is immutable — works forever regardless of code changes.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import date, datetime

from .market import YIELD_TABLE, cv_uncertainty, market_confidence_stars
from .rent_advisor import (
    BATHROOM_ADJ,
    FINISH_TIERS,
    HAZARD_ADJ,
    TYPICAL_FOOTPRINT,
    _clamp,
    _compute_prevalence,
    _detect_hazards,
    _get_area_context,
    _get_cbd_point,
    _get_location_metrics,
    _get_unit_cv_from_rates,
    _prevalence_scale,
    get_sa2_rental_baseline,
)
from .risk_score import enrich_with_scores

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Phase A: Prefetch all property-specific data (run ONCE per property)
# ---------------------------------------------------------------------------

async def prefetch_property_data(conn, address_id: int) -> dict | None:
    """Fetch all property-specific data in ~10 queries. Reused across all variants."""

    # 1. Full report from PL/pgSQL function
    cur = await conn.execute(
        "SELECT get_property_report(%s) AS report", [address_id]
    )
    row = cur.fetchone()
    if not row or not row["report"]:
        return None

    report = enrich_with_scores(row["report"])

    # 2. Property detection
    from .property_detection import detect_property_type
    detection = await detect_property_type(conn, address_id)
    if detection:
        report["property_detection"] = detection

    # 3. Area profile
    sa2_code = (report.get("address") or {}).get("sa2_code")
    if sa2_code:
        cur = await conn.execute(
            "SELECT profile FROM area_profiles WHERE sa2_code = %s", [sa2_code]
        )
        pr = cur.fetchone()
        report["area_profile"] = pr["profile"] if pr else None

    # 4. Fix unit CV from rates cache
    prop = report.get("property") or {}
    addr = report.get("address") or {}
    cur = await conn.execute(
        "SELECT unit_value, address_number, road_name, road_type_name FROM addresses WHERE address_id = %s",
        [address_id],
    )
    addr_row = cur.fetchone()
    if addr_row and addr_row.get("unit_value"):
        uv = addr_row["unit_value"]
        street = f"{addr_row.get('address_number', '')} {addr_row.get('road_name', '')}"
        if addr_row.get("road_type_name"):
            street += f" {addr_row['road_type_name']}"
        street = street.strip()
        if street:
            cur = await conn.execute(
                """
                SELECT capital_value, land_value, improvements_value
                FROM wcc_rates_cache
                WHERE capital_value > 0
                  AND (address ILIKE %s OR address ILIKE %s OR address ILIKE %s)
                LIMIT 1
                """,
                [f"Unit {uv} {street}%", f"Apt {uv} {street}%", f"Flat {uv} {street}%"],
            )
            rates = cur.fetchone()
            if rates and report.get("property"):
                report["property"]["capital_value"] = rates["capital_value"]
                report["property"]["land_value"] = rates["land_value"] or 0
                report["property"]["improvements_value"] = rates["improvements_value"] or 0
                report["property"]["cv_is_per_unit"] = True
    report["_cv_from_rates"] = True

    # 5. SA2 lookup
    cur = await conn.execute(
        """
        SELECT sa2.sa2_code, sa2.sa2_name, sa2.ta_name, sa2.ta_code
        FROM addresses a
        JOIN LATERAL (
            SELECT sa2_code, sa2_name, ta_name, ta_code
            FROM sa2_boundaries WHERE ST_Within(a.geom, geom) LIMIT 1
        ) sa2 ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    sa2 = cur.fetchone()
    if not sa2:
        return None

    # 6. Property data for adjustments
    cur = await conn.execute(
        """
        SELECT
            a.unit_value,
            (SELECT round(ST_Area(b.geom::geography)::numeric, 1)
             FROM building_outlines b
             WHERE b.geom && ST_Expand(a.geom, 0.0005)
               AND ST_Contains(b.geom, a.geom) LIMIT 1) AS footprint_m2,
            (SELECT COUNT(*)::int FROM addresses a2
             WHERE a2.gd2000_xcoord = a.gd2000_xcoord
               AND a2.gd2000_ycoord = a.gd2000_ycoord
               AND a2.address_lifecycle = 'Current') AS unit_count,
            cv.capital_value, cv.land_value
        FROM addresses a
        LEFT JOIN LATERAL (
            SELECT capital_value, land_value FROM council_valuations cv
            WHERE ST_Contains(cv.geom, a.geom) LIMIT 1
        ) cv ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    prop_row = cur.fetchone()

    # Use rates-fixed values if available
    capital_value = report["property"].get("capital_value") or (prop_row["capital_value"] if prop_row else None)
    land_value = report["property"].get("land_value") or (prop_row["land_value"] if prop_row else 0)

    # 7. Hazard detection
    hazards = await _detect_hazards(conn, address_id)

    # 8. Hazard prevalence
    detected_keys = set()
    if hazards.get("flood_zone"):
        detected_keys.add("flood")
    if hazards.get("liquefaction") and hazards["liquefaction"] in ("High", "Very High"):
        detected_keys.add("liquefaction")
    if hazards.get("tsunami_zone"):
        detected_keys.add("tsunami")
    if hazards.get("epb_count") and hazards["epb_count"] > 0:
        detected_keys.add("epb")
    if hazards.get("contam_count") and hazards["contam_count"] > 0:
        detected_keys.add("contamination")
    if hazards.get("on_overland_flow"):
        detected_keys.add("overland_flow")
    if hazards.get("slope_failure") and str(hazards["slope_failure"]).startswith("5"):
        detected_keys.add("slope_failure")
    if hazards.get("noise_db") and hazards["noise_db"] >= 65:
        detected_keys.add("noise_high")
    if hazards.get("aircraft_noise_dba") and hazards["aircraft_noise_dba"] >= 60:
        detected_keys.add("aircraft_noise")
    wz = hazards.get("wind_zone") or ""
    if any(wz.startswith(p) for p in ("VH", "EH", "SED", "Very high", "High Risk")):
        detected_keys.add("wind_high")
    if hazards.get("coastal_erosion_nearby"):
        detected_keys.add("coastal_erosion")

    prevalence = await _compute_prevalence(conn, sa2["sa2_code"], detected_keys) if detected_keys else {}

    # 9. Location metrics
    location = await _get_location_metrics(conn, address_id, sa2["ta_name"])

    # 10. SA2 comparisons
    cur = await conn.execute(
        "SELECT * FROM mv_sa2_comparisons WHERE sa2_code = %s", [sa2["sa2_code"]]
    )
    sa2_comp = cur.fetchone()

    # 11. Area context
    area_context = await _get_area_context(conn, sa2["sa2_code"], sa2["ta_name"])

    # 12. SA2 median improvements (for quality adjustment — cached once)
    cur = await conn.execute(
        """
        SELECT
            percentile_cont(0.5) WITHIN GROUP (ORDER BY (cv.capital_value - cv.land_value)) AS median_house_imp,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY cv.capital_value)
                FILTER (WHERE cv.land_value = 0 OR cv.land_value IS NULL) AS median_unit_cv
        FROM council_valuations cv, sa2_boundaries s
        WHERE ST_Contains(s.geom, cv.geom) AND s.sa2_code = %s
          AND cv.capital_value > 0
        """,
        [sa2["sa2_code"]],
    )
    sa2_med_row = cur.fetchone()

    # 13. Rent history (10 years)
    rent_history = []
    cur = await conn.execute(
        """
        SELECT time_frame, median_rent, lower_quartile_rent, upper_quartile_rent, active_bonds
        FROM bonds_detailed
        WHERE location_id = %s
          AND time_frame >= (CURRENT_DATE - interval '10 years')
        ORDER BY time_frame ASC
        """,
        [sa2["sa2_code"]],
    )
    rent_history = [dict(r) for r in cur.fetchall()]

    # 14. HPI data
    hpi_data = []
    cur = await conn.execute(
        """
        SELECT quarter_end, house_price_index, house_sales
        FROM rbnz_housing
        WHERE quarter_end >= (CURRENT_DATE - interval '10 years')
        ORDER BY quarter_end ASC
        """
    )
    hpi_data = [dict(r) for r in cur.fetchall()]

    # 15. Crime trend data (3 years monthly)
    crime_trend = []
    sa2_name = sa2["sa2_name"]
    try:
        cur = await conn.execute(
            """
            SELECT date_trunc('month', year_month)::date AS month,
                   SUM(victimisations)::int AS count
            FROM crime
            WHERE (area_unit ILIKE %s OR area_unit ILIKE %s)
              AND year_month >= (CURRENT_DATE - interval '3 years')
            GROUP BY 1
            ORDER BY 1
            """,
            [f"%{sa2_name}%", f"%{(report.get('address') or {}).get('suburb', '')}%"],
        )
        crime_trend = [dict(r) for r in cur.fetchall()]
    except Exception:
        pass  # Crime data may not exist for all areas

    # 16. Market data (rental overview from report)
    market_data = report.get("market") or {}

    is_multi_unit = ((prop_row["unit_count"] or 1) > 1 or bool(prop_row.get("unit_value"))) if prop_row else False

    # 17. Nearby highlights (good/caution/info categorised amenities)
    nearby_highlights = {"good": [], "caution": [], "info": []}
    try:
        from ..routers.nearby import AMENITY_CLASSES
        target_subcats = tuple(AMENITY_CLASSES.keys())
        placeholders = ",".join(["%s"] * len(target_subcats))
        cur = await conn.execute(f"""
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT DISTINCT ON (oa.subcategory)
                   oa.name, oa.subcategory,
                   round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m
            FROM osm_amenities oa, addr
            WHERE oa.geom && ST_Expand(addr.geom, 1500 * 0.00001)
              AND ST_DWithin(oa.geom::geography, addr.geom::geography, 1500)
              AND oa.subcategory IN ({placeholders})
            ORDER BY oa.subcategory, ST_Distance(oa.geom, addr.geom)
        """, [address_id, *target_subcats])
        for r in cur.fetchall():
            subcat = r["subcategory"]
            if subcat not in AMENITY_CLASSES:
                continue
            sentiment, label = AMENITY_CLASSES[subcat]
            item = {"name": r["name"] or label, "label": label, "distance_m": float(r["distance_m"])}
            nearby_highlights[sentiment].append(item)
        for group in nearby_highlights.values():
            group.sort(key=lambda x: x["distance_m"])
    except Exception as e:
        logger.warning(f"Snapshot nearby highlights failed: {e}")

    # 18. Nearby supermarkets
    nearby_supermarkets = []
    try:
        cur = await conn.execute("""
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT oa.name, oa.subcategory, oa.brand,
                   round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m
            FROM osm_amenities oa, addr
            WHERE oa.geom && ST_Expand(addr.geom, 10000 * 0.00001)
              AND ST_DWithin(oa.geom::geography, addr.geom::geography, 10000)
              AND oa.subcategory IN ('supermarket', 'greengrocer', 'convenience')
            ORDER BY distance_m LIMIT 5
        """, [address_id])
        nearby_supermarkets = [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logger.warning(f"Snapshot supermarkets failed: {e}")

    # 19. Council rates (region-specific)
    rates_data = None
    try:
        city = (report.get("address") or {}).get("city", "")
        full_address = (report.get("address") or {}).get("full_address", "")
        if "wellington" in city.lower():
            from .rates import fetch_wcc_rates
            rates_data = await fetch_wcc_rates(full_address, conn)
        elif "auckland" in city.lower():
            from .auckland_rates import fetch_auckland_rates
            rates_data = await fetch_auckland_rates(full_address, conn)
        elif city.lower() == "lower hutt":
            from .hcc_rates import fetch_hcc_rates
            rates_data = await fetch_hcc_rates(full_address)
        elif city.lower() == "porirua":
            from .pcc_rates import fetch_pcc_rates
            rates_data = await fetch_pcc_rates(full_address)
        elif "kapiti" in city.lower() or city.lower() in ("paraparaumu", "waikanae", "otaki", "paekakariki", "raumati"):
            from .kcdc_rates import fetch_kcdc_rates
            rates_data = await fetch_kcdc_rates(full_address)
        elif "horowhenua" in city.lower() or city.lower() in ("levin", "foxton", "shannon"):
            from .hdc_rates import fetch_hdc_rates
            rates_data = await fetch_hdc_rates(full_address)
        elif "hamilton" in city.lower():
            from .hamilton_rates import fetch_hamilton_rates
            rates_data = await fetch_hamilton_rates(full_address)
        elif "dunedin" in city.lower():
            from .dcc_rates import fetch_dcc_rates
            rates_data = await fetch_dcc_rates(full_address)
        elif "christchurch" in city.lower():
            from .ccc_rates import fetch_ccc_rates
            rates_data = await fetch_ccc_rates(full_address, conn)
        elif city.lower() == "new plymouth":
            from .taranaki_rates import fetch_taranaki_rates
            rates_data = await fetch_taranaki_rates(full_address)
        elif city.lower() in ("richmond", "motueka", "takaka", "mapua", "brightwater", "wakefield"):
            from .tasman_rates import fetch_tasman_rates
            rates_data = await fetch_tasman_rates(full_address)
        elif "tauranga" in city.lower() or city.lower() == "mount maunganui":
            from .tcc_rates import fetch_tcc_rates
            rates_data = await fetch_tcc_rates(full_address)
        elif city.lower() in ("papamoa", "te puke", "katikati", "omokoroa", "waihi beach", "maketu"):
            from .wbop_rates import fetch_wbop_rates
            rates_data = await fetch_wbop_rates(full_address)
        elif "palmerston" in city.lower():
            from .pncc_rates import fetch_pncc_rates
            rates_data = await fetch_pncc_rates(full_address)
        elif "whangarei" in city.lower() or "whangārei" in city.lower():
            from .wdc_rates import fetch_wdc_rates
            rates_data = await fetch_wdc_rates(full_address)
        elif "queenstown" in city.lower() or city.lower() in ("wanaka", "arrowtown", "frankton", "cromwell", "alexandra"):
            from .qldc_rates import fetch_qldc_rates
            rates_data = await fetch_qldc_rates(full_address)
        elif "invercargill" in city.lower():
            from .icc_rates import fetch_icc_rates
            rates_data = await fetch_icc_rates(full_address)
        elif "hastings" in city.lower() or city.lower() in ("havelock north", "flaxmere", "clive"):
            from .hastings_rates import fetch_hastings_rates
            rates_data = await fetch_hastings_rates(full_address)
        elif "upper hutt" in city.lower():
            from .uhcc_rates import fetch_uhcc_rates
            rates_data = await fetch_uhcc_rates(full_address)
        elif "gisborne" in city.lower():
            from .gdc_rates import fetch_gdc_rates
            rates_data = await fetch_gdc_rates(full_address)
        elif "nelson" in city.lower() and city.lower() != "nelson south":
            from .ncc_rates import fetch_ncc_rates
            rates_data = await fetch_ncc_rates(full_address)
        elif "rotorua" in city.lower():
            from .rlc_rates import fetch_rlc_rates
            rates_data = await fetch_rlc_rates(full_address)
        elif "timaru" in city.lower() or city.lower() in ("temuka", "geraldine", "pleasant point"):
            from .timaru_rates import fetch_timaru_rates
            rates_data = await fetch_timaru_rates(full_address)
        elif "blenheim" in city.lower() or "marlborough" in city.lower() or city.lower() in ("picton", "renwick", "havelock", "seddon"):
            from .mdc_rates import fetch_mdc_rates
            rates_data = await fetch_mdc_rates(full_address)
        elif "whanganui" in city.lower() or "wanganui" in city.lower():
            from .wdc_whanganui_rates import fetch_whanganui_rates
            rates_data = await fetch_whanganui_rates(full_address)

        # Apply CV from rates data (generic handler for all councils)
        if rates_data and rates_data.get("current_valuation"):
            cv_data = rates_data["current_valuation"]
            live_cv = cv_data.get("capital_value")
            if live_cv and report.get("property"):
                old_cv = report["property"].get("capital_value", 0)
                report["property"]["capital_value"] = live_cv
                report["property"]["land_value"] = cv_data.get("land_value") or 0
                report["property"]["improvements_value"] = cv_data.get("improvements_value") or 0
                report["property"]["cv_is_per_unit"] = True
                if live_cv != old_cv:
                    logger.info(f"CV fixed via rates API for {city}: ${live_cv:,} (was ${old_cv or 0:,})")
    except Exception as e:
        logger.warning(f"Snapshot rates failed: {e}")

    # 20. DOC huts, tracks, campsites (within 5km)
    nearby_doc = {"huts": [], "tracks": [], "campsites": []}
    try:
        for layer, table in [("huts", "doc_huts"), ("tracks", "doc_tracks"), ("campsites", "doc_campsites")]:
            geom_col = "geom" if layer != "tracks" else "geom"
            cur = await conn.execute(f"""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT d.name, d.status, d.category,
                       round(ST_Distance(d.geom::geography, addr.geom::geography)::numeric) AS distance_m
                FROM {table} d, addr
                WHERE d.geom && ST_Expand(addr.geom, 5000 * 0.00001)
                  AND ST_DWithin(d.geom::geography, addr.geom::geography, 5000)
                ORDER BY distance_m LIMIT 10
            """, [address_id])
            nearby_doc[layer] = [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logger.warning(f"Snapshot DOC nearby failed: {e}")

    # 21a. Nearest 5 supermarkets (brand-priority for NZ chains)
    nearest_supermarkets = []
    try:
        cur = await conn.execute("""
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT COALESCE(oa.brand, oa.name) AS name, oa.brand, oa.subcategory,
                   round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_Y(oa.geom) AS latitude, ST_X(oa.geom) AS longitude
            FROM osm_amenities oa, addr
            WHERE (oa.subcategory = 'supermarket'
              OR oa.brand IN ('Woolworths','New World','PAK''nSAVE','FreshChoice','SuperValue','Four Square','Countdown'))
              AND oa.geom && ST_Expand(addr.geom, 0.05)
              AND ST_DWithin(oa.geom::geography, addr.geom::geography, 5000)
            ORDER BY
              CASE WHEN oa.brand IN ('Woolworths','New World','PAK''nSAVE','FreshChoice','SuperValue','Four Square','Countdown') THEN 0 ELSE 1 END,
              oa.geom <-> addr.geom
            LIMIT 5
        """, [address_id])
        nearest_supermarkets = [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logger.warning(f"Snapshot nearest supermarkets failed: {e}")

    # 21b. School zones this property falls within (enriched with distance, EQI, roll)
    school_zones = []
    try:
        cur = await conn.execute("""
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT sz.school_name, sz.school_id, sz.institution_type,
                   s.eqi_index AS eqi, s.total_roll AS roll,
                   s.suburb, s.city,
                   round(ST_Distance(s.geom::geography, addr.geom::geography)::numeric) AS distance_m
            FROM school_zones sz, addr
            LEFT JOIN schools s ON s.school_id = sz.school_id
            WHERE ST_Contains(sz.geom, addr.geom)
            ORDER BY sz.institution_type, COALESCE(ST_Distance(s.geom::geography, addr.geom::geography), 999999)
        """, [address_id])
        school_zones = [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logger.warning(f"Snapshot school zones failed: {e}")

    # 22. Road noise level at property (NZTA national contours)
    road_noise = None
    try:
        cur = await conn.execute("""
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT nc.laeq24h
            FROM noise_contours nc, addr
            WHERE nc.source_council = 'nzta_national'
              AND ST_Contains(nc.geom, addr.geom)
            ORDER BY nc.laeq24h DESC LIMIT 1
        """, [address_id])
        row = cur.fetchone()
        if row:
            road_noise = {"laeq24h": int(row["laeq24h"]) if row["laeq24h"] else None}
    except Exception as e:
        logger.warning(f"Snapshot road noise failed: {e}")

    # 23. Weather events history (extreme weather near property)
    weather_history = []
    try:
        cur = await conn.execute("""
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT we.event_date, we.event_type, we.severity, we.title, we.description,
                   we.precipitation_mm, we.wind_gust_kmh,
                   round(ST_Distance(we.geom::geography, addr.geom::geography)::numeric / 1000, 1) AS dist_km
            FROM weather_events we, addr
            WHERE ST_DWithin(we.geom::geography, addr.geom::geography, 50000)
              AND we.event_date >= (CURRENT_DATE - interval '5 years')
              AND we.severity IN ('critical', 'warning')
            ORDER BY we.severity, we.event_date DESC
            LIMIT 15
        """, [address_id])
        for r in cur.fetchall():
            weather_history.append({
                "date": r["event_date"].isoformat() if hasattr(r["event_date"], "isoformat") else str(r["event_date"]),
                "type": r["event_type"],
                "severity": r["severity"],
                "title": r["title"],
                "description": r["description"],
                "precipitation_mm": float(r["precipitation_mm"]) if r["precipitation_mm"] else None,
                "wind_gust_kmh": float(r["wind_gust_kmh"]) if r["wind_gust_kmh"] else None,
                "distance_km": float(r["dist_km"]) if r["dist_km"] else None,
            })
    except Exception as e:
        logger.warning(f"Snapshot weather history failed: {e}")

    # 24. Walking isochrone + terrain data
    terrain_data = {}
    isochrone_data = {}
    try:
        from .walking_isochrone import (
            count_stops_in_isochrone,
            get_terrain_at_property,
            classify_landslide_risk_from_slope,
        )

        # Terrain: elevation, slope, aspect
        terrain_data = await get_terrain_at_property(conn, address_id)
        if terrain_data.get("slope_degrees") is not None:
            terrain_data["landslide_risk"] = classify_landslide_risk_from_slope(
                terrain_data["slope_degrees"]
            )

        # Walking isochrone: 10-min walk transit stops (replaces 400m radius)
        isochrone_data = await count_stops_in_isochrone(conn, address_id, minutes=10)

        # Waterway proximity
        try:
            cur = await conn.execute("""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT w.name, w.feat_type,
                       round(ST_Distance(w.geom::geography, addr.geom::geography)::numeric) AS distance_m
                FROM nz_waterways w, addr
                WHERE ST_DWithin(w.geom::geography, addr.geom::geography, 500)
                ORDER BY ST_Distance(w.geom::geography, addr.geom::geography)
                LIMIT 3
            """, [address_id])
            ww = cur.fetchall()
            if ww:
                terrain_data["nearest_waterway_m"] = int(ww[0]["distance_m"])
                terrain_data["nearest_waterway_name"] = ww[0]["name"]
                terrain_data["nearest_waterway_type"] = ww[0]["feat_type"]
                terrain_data["waterways_within_500m"] = len(ww)
            else:
                terrain_data["nearest_waterway_m"] = None
                terrain_data["nearest_waterway_name"] = None
                terrain_data["nearest_waterway_type"] = None
                terrain_data["waterways_within_500m"] = 0
        except Exception:
            terrain_data["nearest_waterway_m"] = None
            terrain_data["nearest_waterway_name"] = None
            terrain_data["nearest_waterway_type"] = None
            terrain_data["waterways_within_500m"] = 0
    except Exception as e:
        logger.warning(f"Snapshot terrain/isochrone failed: {e}")

    return {
        "report": report,
        "sa2": dict(sa2),
        "property": {
            "footprint_m2": float(prop_row["footprint_m2"]) if prop_row and prop_row.get("footprint_m2") else None,
            "unit_count": prop_row["unit_count"] if prop_row else 1,
            "capital_value": int(capital_value) if capital_value else None,
            "land_value": int(land_value) if land_value else 0,
            "is_multi_unit": is_multi_unit,
        },
        "hazards_raw": hazards,
        "detected_hazard_keys": detected_keys,
        "hazard_prevalence": prevalence,
        "location": dict(location) if location else {},
        "sa2_comp": dict(sa2_comp) if sa2_comp else {},
        "area_context": area_context,
        "sa2_median_house_imp": float(sa2_med_row["median_house_imp"]) if sa2_med_row and sa2_med_row.get("median_house_imp") else None,
        "sa2_median_unit_cv": float(sa2_med_row["median_unit_cv"]) if sa2_med_row and sa2_med_row.get("median_unit_cv") else None,
        "rent_history": rent_history,
        "hpi_data": hpi_data,
        "crime_trend": crime_trend,
        "nearby_highlights": nearby_highlights,
        "nearby_supermarkets": nearby_supermarkets,
        "nearest_supermarkets": nearest_supermarkets,
        "rates_data": rates_data,
        "nearby_doc": nearby_doc,
        "school_zones": school_zones,
        "road_noise": road_noise,
        "weather_history": weather_history,
        "terrain": terrain_data,
        "isochrone": isochrone_data,
    }


# ---------------------------------------------------------------------------
# Phase B: Compute rent baselines (one per dwelling_type:bedrooms combo)
# ---------------------------------------------------------------------------

def _compute_property_hazard_adjustments(cache: dict) -> list[dict]:
    """Compute hazard + location adjustments from cached property data.
    These are the same for ALL variants (property-specific, not input-specific)."""
    adjustments = []
    detected_keys = cache["detected_hazard_keys"]
    prevalence = cache["hazard_prevalence"]

    area_wide_hazards = []
    for key in sorted(detected_keys):
        cfg = HAZARD_ADJ.get(key)
        if not cfg:
            continue
        prev = prevalence.get(key, 0.0)
        scale = _prevalence_scale(prev)
        prev_pct = round(prev * 100)

        if scale == 0.0:
            area_wide_hazards.append({
                "factor": key,
                "label": cfg["label"],
                "prevalence_pct": prev_pct,
                "description": f"{cfg['label']} — area-wide ({prev_pct}% of properties), already reflected in local rents",
            })
        else:
            lo = cfg["low"] * scale
            hi = cfg["high"] * scale
            reason = cfg["label"]
            if prev_pct > 0:
                reason += f" ({prev_pct}% of area)"
            adjustments.append({
                "factor": key,
                "label": cfg["label"],
                "pct_low": round(lo * 100, 1),
                "pct_high": round(hi * 100, 1),
                "reason": reason,
                "category": "hazard",
                "prevalence_pct": prev_pct,
            })

    return adjustments, area_wide_hazards


def _compute_location_adjustments(cache: dict) -> list[dict]:
    """Compute location adjustments from cached data."""
    from .rent_advisor import _location_adjustment

    adjustments = []
    loc = cache["location"]
    sa2_comp = cache["sa2_comp"]

    if not loc or not sa2_comp:
        return adjustments

    # Transit stops
    prop_transit = loc.get("transit_stops_400m")
    sa2_transit = sa2_comp.get("transit_count_400m")
    if prop_transit is not None and sa2_transit is not None and sa2_transit > 0:
        adj = _location_adjustment(prop_transit, sa2_transit, "transit", "Transit access", 0.01, 0.03, True)
        if adj:
            ratio = prop_transit / sa2_transit
            adj["reason"] = f"{prop_transit} stops vs area avg {sa2_transit}"
            adjustments.append(adj)

    # CBD distance
    prop_cbd = loc.get("cbd_distance_m")
    if prop_cbd is not None:
        cbd = _get_cbd_point(cache["sa2"]["ta_name"])
        if cbd:
            # Use a simplified SA2 CBD distance from comparisons if available
            sa2_cbd = sa2_comp.get("cbd_distance_m")
            if sa2_cbd and sa2_cbd > 0:
                adj = _location_adjustment(float(prop_cbd), float(sa2_cbd), "cbd_distance", "CBD distance", 0.01, 0.03, False)
                if adj:
                    prop_km = round(float(prop_cbd) / 1000, 1)
                    sa2_km = round(float(sa2_cbd) / 1000, 1)
                    adj["reason"] = f"{prop_km}km vs area avg {sa2_km}km"
                    adjustments.append(adj)

    # Schools
    prop_schools = loc.get("schools_1500m")
    sa2_schools = sa2_comp.get("school_count_1500m")
    if prop_schools is not None and sa2_schools is not None and sa2_schools > 0:
        adj = _location_adjustment(prop_schools, sa2_schools, "schools", "School proximity", 0.005, 0.015, True)
        if adj:
            adj["reason"] = f"{prop_schools} schools vs area avg {sa2_schools}"
            adjustments.append(adj)

    # Nearest park
    prop_park = loc.get("nearest_park_m")
    if prop_park is not None:
        park_m = float(prop_park)
        if park_m < 200:
            adjustments.append({
                "factor": "park", "label": "Near park",
                "pct_low": 0.5, "pct_high": 1.5,
                "reason": f"Park within {round(park_m)}m", "category": "location",
            })
        elif park_m > 800:
            adjustments.append({
                "factor": "park", "label": "Far from parks",
                "pct_low": -1.0, "pct_high": -0.5,
                "reason": f"Nearest park {round(park_m)}m away", "category": "location",
            })

    # Nearest rail
    prop_rail = loc.get("nearest_rail_m")
    if prop_rail is not None:
        rail_m = float(prop_rail)
        if rail_m < 500:
            adjustments.append({
                "factor": "rail", "label": "Near rail station",
                "pct_low": 1.0, "pct_high": 3.0,
                "reason": f"Rail station {round(rail_m)}m away", "category": "location",
            })

    return adjustments


async def compute_rent_baselines(conn, cache: dict, dwelling_type: str) -> dict:
    """Compute rent baselines for all bedroom counts for a dwelling type.
    Returns dict keyed by 'dwelling_type:bedrooms'."""

    baselines = {}
    bedroom_options = ["1", "2", "3", "4", "5+"]

    # Property-specific adjustments (same for all variants)
    hazard_adjs, area_wide_hazards = _compute_property_hazard_adjustments(cache)
    location_adjs = _compute_location_adjustments(cache)
    property_fixed_adjs = hazard_adjs + location_adjs

    # Enrich area context with area-wide hazards
    full_area_context = list(cache["area_context"])
    for awh in area_wide_hazards:
        full_area_context.append({
            "factor": awh["factor"],
            "label": awh["label"],
            "value": awh["prevalence_pct"],
            "city_avg": None,
            "max_scale": 100,
            "direction": "down",
            "description": awh["description"],
            "is_area_wide_hazard": True,
        })

    for beds in bedroom_options:
        # Query SA2 rental baseline (this varies per bedrooms)
        baseline = await get_sa2_rental_baseline(
            conn, cache["sa2"]["sa2_code"], cache["sa2"]["ta_name"],
            dwelling_type, beds
        )

        if not baseline:
            continue

        raw_median = baseline["median"]

        # Size adjustment (property-specific but doesn't vary by bedroom/bathroom)
        size_adj = None
        if cache["property"]["footprint_m2"] and not cache["property"]["is_multi_unit"]:
            footprint = cache["property"]["footprint_m2"]
            typical = TYPICAL_FOOTPRINT.get(dwelling_type, 140)
            if typical > 0:
                ratio = (footprint - typical) / typical
                adj_low = _clamp(ratio * 0.3, -0.03, 0.10)
                adj_high = _clamp(ratio * 0.5, -0.08, 0.20)
                if adj_low > adj_high:
                    adj_low, adj_high = adj_high, adj_low
                if abs(adj_high) >= 0.01:
                    size_adj = {
                        "factor": "size", "label": "Property size",
                        "pct_low": round(adj_low * 100, 1),
                        "pct_high": round(adj_high * 100, 1),
                        "reason": f"{round(footprint)}m² vs typical {typical}m²",
                        "category": "property",
                    }

        # Quality adjustment (uses cached SA2 median)
        quality_adj = None
        cv = cache["property"]["capital_value"]
        lv = cache["property"]["land_value"]
        if cv:
            imp = cv - (lv or 0)
            beds_num = int(beds.replace("+", ""))
            rooms = beds_num + 1  # default 1 bathroom for baseline
            if imp > 0 and rooms > 0:
                imp_per_room = imp / rooms
                if cache["property"]["is_multi_unit"]:
                    sa2_med = cache["sa2_median_unit_cv"]
                    typical_rooms = 3
                else:
                    sa2_med = cache["sa2_median_house_imp"]
                    typical_rooms = 4

                if sa2_med and sa2_med > 0:
                    sa2_per_room = sa2_med / typical_rooms
                    if sa2_per_room > 0:
                        ratio = imp_per_room / sa2_per_room
                        if ratio > 1.3:
                            adj_low = _clamp((ratio - 1) * 0.1, 0.01, 0.04)
                            adj_high = _clamp((ratio - 1) * 0.2, 0.02, 0.08)
                            quality_adj = {
                                "factor": "quality", "label": "Above-average build",
                                "pct_low": round(adj_low * 100, 1), "pct_high": round(adj_high * 100, 1),
                                "reason": f"${round(imp_per_room/1000)}K/room vs area ${round(sa2_per_room/1000)}K",
                                "category": "property",
                            }
                        elif ratio < 0.7:
                            adj_low = _clamp((ratio - 1) * 0.2, -0.08, -0.02)
                            adj_high = _clamp((ratio - 1) * 0.1, -0.04, -0.01)
                            quality_adj = {
                                "factor": "quality", "label": "Below-average build",
                                "pct_low": round(adj_low * 100, 1), "pct_high": round(adj_high * 100, 1),
                                "reason": f"${round(imp_per_room/1000)}K/room vs area ${round(sa2_per_room/1000)}K",
                                "category": "property",
                            }

        # Combine property-fixed adjustments
        all_adjs = list(property_fixed_adjs)
        if size_adj:
            all_adjs.append(size_adj)
        if quality_adj:
            all_adjs.append(quality_adj)

        # Compute base band (without bathroom/finish/toggle adjustments)
        product_low = 1.0
        product_high = 1.0
        for adj in all_adjs:
            product_low *= 1 + adj["pct_low"] / 100
            product_high *= 1 + adj["pct_high"] / 100

        band_low = round(raw_median * min(product_low, product_high) * 0.99)
        band_high = round(raw_median * max(product_low, product_high) * 1.01)
        band_low_outer = round(band_low * 0.97)
        band_high_outer = round(band_high * 1.03)

        # Sort adjustments
        cat_order = {"hazard": 0, "location": 1, "property": 2}
        all_adjs.sort(key=lambda a: (cat_order.get(a.get("category", ""), 3), -abs(a.get("pct_high", 0))))

        # Add dollar amounts
        for adj in all_adjs:
            adj["dollar_low"] = round(raw_median * adj["pct_low"] / 100)
            adj["dollar_high"] = round(raw_median * adj["pct_high"] / 100)

        key = f"{dwelling_type}:{beds}"
        baselines[key] = {
            "raw_median": round(raw_median),
            "bond_count": baseline["bond_count"],
            "data_source": baseline["data_source"],
            "period": baseline.get("period"),
            "band_low": band_low,
            "band_high": band_high,
            "band_low_outer": band_low_outer,
            "band_high_outer": band_high_outer,
            "adjustments": all_adjs,
            "area_context": full_area_context,
        }

    return baselines


# ---------------------------------------------------------------------------
# Phase C: Compute price advisor snapshot
# ---------------------------------------------------------------------------

async def compute_price_snapshot(conn, cache: dict, bedrooms: str | None = None, bathrooms: str | None = None, finish_tier: str | None = None) -> dict | None:
    """Compute price advisor result using cached property data.
    Passes bedrooms/bathrooms/finish from user inputs if available."""
    from .price_advisor import compute_price_advice
    try:
        return await compute_price_advice(
            conn,
            address_id=int(cache["report"]["address"]["address_id"]),
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            finish_tier=finish_tier,
        )
    except Exception as e:
        logger.warning(f"Price advisor failed for snapshot: {e}")
        return None


# ---------------------------------------------------------------------------
# Phase D: Build delta tables (pure constants)
# ---------------------------------------------------------------------------

def build_delta_tables() -> dict:
    """Export adjustment constants as JSON-serializable delta tables."""
    return {
        "finish_deltas": {
            tier: {"pct_low": round(lo * 100, 1), "pct_high": round(hi * 100, 1)}
            for tier, (lo, hi) in FINISH_TIERS.items()
        },
        "bathroom_deltas": {
            f"{beds}:{baths}": {"pct_low": round(lo * 100, 1), "pct_high": round(hi * 100, 1)}
            for (beds, baths), (lo, hi) in BATHROOM_ADJ.items()
        },
        "toggle_deltas": {
            "parking_yes": {"pct_low": 1.0, "pct_high": 3.0},
            "parking_no": {"pct_low": -3.0, "pct_high": -1.0},
            "furnished": {"pct_low": 3.0, "pct_high": 8.0},
            "unfurnished": {"pct_low": -5.0, "pct_high": -2.0},
            "partially_furnished": {"pct_low": -1.0, "pct_high": 2.0},
            "not_insulated": {"pct_low": -4.0, "pct_high": -2.0},
            "shared_kitchen": {"pct_low": -10.0, "pct_high": -5.0},
            "utilities_included": {"pct_low": 4.0, "pct_high": 10.0},
            "outdoor_space": {"pct_low": 2.0, "pct_high": 5.0},
            "character_property": {"pct_low": 3.0, "pct_high": 7.0},
        },
    }


def _build_hazard_advice(cache: dict) -> list[dict]:
    """Generate actionable advice based on detected hazards.
    Based on NZ Civil Defence, GNS Science, NEMA, and post-disaster research."""
    advice = []
    hazards = cache.get("hazards_raw", {})
    detected = cache.get("detected_hazard_keys", set())
    weather = cache.get("weather_history", [])

    if "flood" in detected or hazards.get("flood_zone"):
        advice.append({
            "hazard": "flood",
            "severity": "warning",
            "title": "Flood Risk Preparedness",
            "actions": [
                "Check your insurance covers flood damage — standard policies may exclude it in known flood zones",
                "Store important documents above potential flood level or in waterproof containers",
                "Know your evacuation route to higher ground — practice with household members",
                "Install non-return valves on drains to prevent sewage backflow during floods",
                "Consider flood barriers or sandbags for doorways if property has flooded before",
            ],
            "source": "NZ Civil Defence / NEMA",
        })

    if "tsunami" in detected or hazards.get("tsunami_zone"):
        advice.append({
            "hazard": "tsunami",
            "severity": "critical",
            "title": "Tsunami Evacuation Zone",
            "actions": [
                "LONG OR STRONG = GET GONE — if shaking lasts more than a minute, evacuate immediately",
                "Know your nearest high ground or tsunami evacuation assembly point",
                "Do NOT wait for an official warning — natural warning (earthquake) may be the only one",
                "Keep a grab bag ready with 3 days of water, food, medications, and documents",
                "Register for NZ Emergency Alerts at getready.govt.nz",
            ],
            "source": "NEMA / Civil Defence",
        })

    if "liquefaction" in detected:
        advice.append({
            "hazard": "liquefaction",
            "severity": "warning",
            "title": "Liquefaction Risk Area",
            "actions": [
                "Get a geotechnical report before purchasing — liquefaction can cause severe foundation damage",
                "Check if the property has TC3 foundation requirements (increased building costs)",
                "Review EQC settlement history for properties in this area",
                "Consider earthquake strengthening for older unreinforced masonry buildings",
            ],
            "source": "GNS Science / EQC",
        })

    if "epb" in detected:
        advice.append({
            "hazard": "earthquake_prone",
            "severity": "critical",
            "title": "Earthquake-Prone Building",
            "actions": [
                "The building must be strengthened or demolished within the council's deadline",
                "Check the MBIE EPB Register for the specific notice and deadline",
                "Strengthening costs typically range from $500-$3,000 per square metre",
                "Tenants: landlords must disclose EPB status — you may negotiate reduced rent",
                "Buyers: factor strengthening costs into your offer price",
            ],
            "source": "MBIE / Building Act 2004",
        })

    if "wind_high" in detected:
        advice.append({
            "hazard": "wind",
            "severity": "warning",
            "title": "High Wind Exposure",
            "actions": [
                "Ensure roof fixings meet NZS 3604 for this wind zone — get a building inspection",
                "Secure outdoor furniture, trampolines, and loose items before storms",
                "Consider wind-rated fencing and shelter planting for exposed sides",
                "Check insurance covers storm damage — excess may be higher in high-wind zones",
            ],
            "source": "BRANZ / NZS 3604",
        })

    if "coastal_erosion" in detected:
        advice.append({
            "hazard": "coastal_erosion",
            "severity": "warning",
            "title": "Coastal Erosion Hazard",
            "actions": [
                "Check the council's coastal hazard assessment for projected erosion rates",
                "Sea level rise of 0.3-1.0m by 2100 will accelerate coastal erosion",
                "Insurance availability may be limited or premiums significantly higher",
                "Council may restrict future building or renovation consents in erosion zones",
                "Consider long-term managed retreat policies that may affect property value",
            ],
            "source": "MfE Coastal Hazards Guidance / NIWA",
        })

    # Add weather-based advice if extreme events found
    critical_weather = [w for w in weather if w["severity"] == "critical"]
    if critical_weather:
        rain_events = [w for w in critical_weather if w["type"] == "heavy_rain"]
        wind_events = [w for w in critical_weather if w["type"] == "extreme_wind"]
        actions = []
        if rain_events:
            actions.append(f"{len(rain_events)} extreme rainfall events (80mm+) recorded nearby in the last 5 years — check drainage and guttering")
        if wind_events:
            actions.append(f"{len(wind_events)} destructive wind events (120km/h+) recorded nearby — check roof condition and secure loose items")
        actions.append("Keep emergency supplies: torch, radio, water, first aid kit, warm clothing")
        actions.append("Sign up for regional council flood warnings and MetService alerts")
        advice.append({
            "hazard": "extreme_weather",
            "severity": "warning",
            "title": "Extreme Weather History",
            "actions": actions,
            "source": "Open-Meteo / NIWA",
        })

    if "noise_high" in detected or "aircraft_noise" in detected:
        advice.append({
            "hazard": "noise",
            "severity": "info",
            "title": "Noise Exposure",
            "actions": [
                "Double glazing can reduce noise by 25-35 dB — significant improvement for sleep quality",
                "Check if the property qualifies for acoustic insulation subsidies (common near airports)",
                "Noise exposure above 65 dB is linked to increased cardiovascular risk (WHO guidelines)",
            ],
            "source": "WHO / Waka Kotahi",
        })

    if "contamination" in detected:
        advice.append({
            "hazard": "contamination",
            "severity": "info",
            "title": "Contaminated Land Nearby",
            "actions": [
                "Request a Detailed Site Investigation (DSI) report from the regional council",
                "Check if the contamination is on the HAIL list (Hazardous Activities and Industries List)",
                "Contaminated land may affect bore water quality — test before using for drinking/irrigation",
            ],
            "source": "MfE NES for Contaminated Soil",
        })

    # Terrain-based advice
    terrain = cache.get("terrain", {})
    slope = terrain.get("slope_degrees")
    slope_cat = terrain.get("slope_category", "unknown")
    aspect = terrain.get("aspect_label", "unknown")
    elev = terrain.get("elevation_m")

    if slope is not None and slope >= 15:
        advice.append({
            "hazard": "steep_terrain",
            "severity": "warning" if slope < 25 else "critical",
            "title": f"{'Very steep' if slope >= 25 else 'Steep'} Site — {slope:.0f}° Slope",
            "actions": [
                f"Commission a geotechnical investigation (typically $3,000-$8,000 for a slope stability assessment) — slopes above 15° have elevated landslide risk in NZ",
                "Check council records for any natural hazard conditions or engineering requirements on the title",
                "Inspect all retaining walls — look for cracking, tilting, or bulging that indicates ground movement",
                "Ensure stormwater drainage directs water away from the slope face — poor drainage is the #1 trigger for residential slope failures in NZ",
                "After heavy rain, check for new cracks in the ground, tilting fences, or doors/windows that suddenly stick — these are early warning signs of slope movement",
            ],
            "source": "GNS Science / BRANZ",
        })

    if aspect in ("south", "southeast", "southwest") and slope is not None and slope >= 5:
        advice.append({
            "hazard": "sun_exposure",
            "severity": "info",
            "title": f"{aspect.capitalize()}-Facing — Managing Low Sun Exposure",
            "actions": [
                "Prioritise wall and ceiling insulation (R4.0+ for walls, R6.0+ for ceiling) — south-facing homes need more thermal mass to stay warm",
                "Install a high-efficiency heat pump rated for the room size — heating demand will be above average for this orientation",
                "Ensure bathrooms and laundry have extractor fans vented to outside — condensation and mould risk is higher on south-facing properties",
                "Check for adequate ventilation under the house (if on piles) and in the roof space — trapped moisture causes framing rot over time",
                "If renting: check Healthy Homes heating standard compliance — south-facing rooms need larger heating capacity",
            ],
            "source": "BRANZ / Healthy Homes Standards",
        })

    if elev is not None and elev < 5:
        advice.append({
            "hazard": "low_elevation",
            "severity": "warning",
            "title": f"Low Elevation — {elev:.0f}m Above Sea Level",
            "actions": [
                "Check your insurance policy explicitly covers storm surge and coastal inundation — many standard policies exclude this for properties below 5m",
                "Review the regional council's coastal hazard maps for current and projected (2100) inundation extents",
                "Ensure the property has floor levels raised above known flood levels — council may have minimum floor level requirements",
                "Consider the long-term implications of IPCC sea level rise projections (0.3-1.0m by 2100) on property value and insurability",
                "Check if the local council has a managed retreat policy or climate adaptation plan for low-lying areas",
            ],
            "source": "MfE Coastal Hazards Guidance / NIWA",
        })

    return advice


def _build_terrain_insights(cache: dict) -> list[dict]:
    """Generate cross-referenced terrain insights from elevation, slope, aspect,
    and existing hazard data. Returns actionable, professional insights."""
    insights = []
    terrain = cache.get("terrain", {})
    isochrone = cache.get("isochrone", {})
    hazards = cache.get("hazards_raw", {})
    detected = cache.get("detected_hazard_keys", set())

    elev = terrain.get("elevation_m")
    slope = terrain.get("slope_degrees")
    slope_cat = terrain.get("slope_category", "unknown")
    aspect = terrain.get("aspect_label", "unknown")
    aspect_deg = terrain.get("aspect_degrees")

    if elev is None and slope is None:
        return insights

    # ── Elevation insights ──
    if elev is not None:
        if elev < 3:
            insights.append({
                "severity": "critical",
                "title": "Very low elevation",
                "detail": f"This property sits at just {elev:.0f}m above sea level — within the range of projected sea level rise and storm surge flooding. Even minor coastal weather events could affect this location.",
                "action": "Obtain a coastal hazard assessment from the regional council. Check whether your insurer covers coastal inundation. Consider future-proofing: NIWA projects up to 1m sea level rise by 2100 for NZ coastlines.",
                "category": "terrain",
            })
        elif elev < 10 and ("tsunami" in detected or "flood" in detected or "coastal_erosion" in detected):
            insights.append({
                "severity": "warning",
                "title": "Low-lying in a hazard zone",
                "detail": f"At {elev:.0f}m elevation and within a mapped {'tsunami' if 'tsunami' in detected else 'flood'} zone, this property's low elevation confirms its vulnerability. Water has a direct path here.",
                "action": "Know your evacuation route to higher ground. Ensure contents and building insurance explicitly covers flood/tsunami damage — standard policies may exclude it in mapped zones. Keep a 72-hour emergency kit ready.",
                "category": "terrain",
            })
        elif elev < 10 and not any(k in detected for k in ("tsunami", "flood", "coastal_erosion")):
            insights.append({
                "severity": "info",
                "title": "Low elevation",
                "detail": f"At {elev:.0f}m above sea level, this property is low-lying. While not in a currently mapped flood or tsunami zone, low elevation increases exposure to future coastal hazards as sea levels rise.",
                "action": "Monitor council long-term hazard planning for this area. The NZ Coastal Policy Statement requires councils to plan for at least 1m of sea level rise — future zone classifications may change.",
                "category": "terrain",
            })
        elif elev > 200:
            wind_high = "wind_high" in detected
            insights.append({
                "severity": "info" if not wind_high else "warning",
                "title": "Elevated site" + (" with wind exposure" if wind_high else ""),
                "detail": f"At {elev:.0f}m elevation, this property is well above coastal hazard levels{' but is exposed to stronger winds at this height' if wind_high else ' and likely enjoys expansive views'}. Higher elevations in NZ typically mean lower flood and tsunami risk but greater wind and weather exposure.",
                "action": "Check roof fixings and cladding meet wind zone requirements for this elevation. If building, ensure the design accounts for exposure — BRANZ recommends specific detailing for sites above 150m." if wind_high else "This elevation is a natural advantage for flood and tsunami resilience. Views from elevated sites can add 5-15% to property value in NZ markets.",
                "category": "terrain",
            })

    # ── Slope insights ──
    if slope is not None:
        if slope >= 25:
            has_landslide_data = hazards.get("slope_failure") or any(k for k in detected if "slope" in k)
            insights.append({
                "severity": "critical",
                "title": "Very steep terrain — high landslide risk",
                "detail": f"The {slope:.0f}° slope at this property falls in the 'very steep' category where shallow landslides are likely during heavy or prolonged rainfall. {'Mapped landslide data confirms historical instability in this area.' if has_landslide_data else 'No historical landslides are mapped here, but unmapped does not mean safe — many slopes in NZ have not been systematically surveyed.'}",
                "action": "Commission a geotechnical investigation before purchasing. A slope stability assessment (typically $3,000-$8,000) will identify whether the site needs engineered retaining, drainage, or foundation solutions. Check if council requires a natural hazard assessment for building consent on slopes >20°.",
                "category": "terrain",
            })
        elif slope >= 15:
            insights.append({
                "severity": "warning",
                "title": "Steep site — slope stability considerations",
                "detail": f"At {slope:.0f}°, this is a steep residential site. Soil creep (slow downhill movement) and shallow slope failures can occur during intense rainfall events, particularly on clay-rich NZ soils.",
                "action": "Request a geotechnical report if one hasn't been done. Check council records for any slope stability conditions on the title. Ensure stormwater drainage directs water away from the slope face — poor drainage is the most common trigger for residential slope failures in NZ.",
                "category": "terrain",
            })
        elif slope < 2:
            insights.append({
                "severity": "positive",
                "title": "Flat, stable terrain",
                "detail": f"At {slope:.0f}°, this is essentially flat ground — ideal for building, landscaping, and accessibility. Landslide risk from slope alone is negligible.",
                "action": "Flat sites are straightforward for foundation design, reducing construction costs. However, flat low-lying sites can be prone to ponding and poor drainage — check for overland flow paths that may cross the property.",
                "category": "terrain",
            })
        elif slope < 5:
            insights.append({
                "severity": "positive",
                "title": "Gentle slope — good site conditions",
                "detail": f"A {slope:.0f}° slope provides natural drainage away from the building without creating stability concerns. This is considered ideal building terrain in NZ.",
                "action": "A gentle slope is an advantage — natural drainage reduces the risk of damp and ponding around foundations. Ensure the slope falls away from the house, not towards it.",
                "category": "terrain",
            })

    # ── Aspect insights (southern hemisphere) ──
    if aspect not in ("unknown", "flat") and slope is not None and slope >= 3:
        if aspect in ("north", "northeast", "northwest"):
            insights.append({
                "severity": "positive",
                "title": f"{aspect.capitalize()}-facing — excellent sun exposure",
                "detail": f"In NZ's southern hemisphere, a {aspect}-facing slope captures maximum winter sun. This means warmer, drier interiors, lower heating costs, and better conditions for gardens and outdoor living.",
                "action": "North-facing aspect is the most desirable orientation in NZ and typically commands a price premium. If considering solar panels, a north-facing roof slope of 30-40° is optimal for NZ latitudes — this property's terrain naturally supports good solar generation.",
                "category": "terrain",
            })
        elif aspect in ("south", "southeast", "southwest"):
            insights.append({
                "severity": "warning" if slope >= 10 else "info",
                "title": f"{aspect.capitalize()}-facing — limited winter sun",
                "detail": f"South-facing slopes in NZ receive significantly less direct sunlight, especially in winter. {'Combined with the steep angle, this property may receive very limited direct sun from May to August, increasing heating costs and moisture risk.' if slope >= 10 else 'This affects indoor warmth and may increase heating costs during winter months.'}",
                "action": "Prioritise insulation and ventilation to manage moisture — south-facing properties in NZ are more prone to condensation and mould. Check the Healthy Homes Standards compliance if renting. Consider heat pump efficiency ratings for a south-facing home, as heating demand will be higher than average.",
                "category": "terrain",
            })

    # ── Depression / flood terrain risk ──
    is_depression = terrain.get("is_depression")
    depression_depth = terrain.get("depression_depth_m")
    flood_terrain = terrain.get("flood_terrain_risk", "none")
    flood_terrain_score = terrain.get("flood_terrain_score", 0)
    rel_pos = terrain.get("relative_position", "unknown")

    if is_depression and flood_terrain in ("high", "moderate"):
        depth_str = f" ({abs(depression_depth):.1f}m below surrounding terrain)" if depression_depth else ""
        in_flood = "flood" in detected
        insights.append({
            "severity": "warning" if flood_terrain == "high" else "info",
            "title": "Depression — water pooling risk",
            "detail": f"This property sits in a natural low point{depth_str} where water naturally collects. "
                       + ("This is confirmed by council flood mapping for this area." if in_flood
                          else "While no council flood zone is mapped here, the terrain itself creates ponding risk during heavy rain."),
            "action": "Check for signs of past water damage (staining on foundations, efflorescence on concrete, soft ground). "
                      "Ensure stormwater drainage is adequate — gravity cannot help water leave a depression. "
                      "Consider installing a sump pump if the property has a basement or sub-floor space.",
            "category": "terrain",
        })
    elif is_depression:
        insights.append({
            "severity": "info",
            "title": "Low point in local terrain",
            "detail": f"This property is lower than its immediate surroundings{f' by {abs(depression_depth):.1f}m' if depression_depth else ''}, which can affect drainage during heavy rain.",
            "action": "Check that stormwater systems direct water away from the building. Ponding around foundations increases dampness risk over time.",
            "category": "terrain",
        })

    if flood_terrain in ("moderate", "high") and not is_depression and "flood" not in detected and elev is not None:
        insights.append({
            "severity": "info",
            "title": "Flat, low-lying terrain — flood susceptibility",
            "detail": f"At {elev:.0f}m elevation on flat ground, this property has limited natural drainage. "
                      "No council flood zone is mapped here, but terrain shape suggests vulnerability to surface flooding during extreme rainfall.",
            "action": "Flat terrain doesn't drain naturally. Check the property's stormwater capacity, floor levels relative to surrounding ground, and proximity to waterways. Monitor council hazard plan updates — unmapped doesn't mean zero risk.",
            "category": "terrain",
        })

    # ── Wind exposure ──
    wind_exp = terrain.get("wind_exposure", "unknown")
    wind_score = terrain.get("wind_exposure_score")
    wind_zone = hazards.get("wind_zone")

    if wind_exp == "very_exposed":
        pos_label = "hilltop" if rel_pos == "hilltop" else "ridgeline"
        insights.append({
            "severity": "warning",
            "title": f"Very exposed {pos_label} — high wind risk",
            "detail": f"This {pos_label} position{f' at {elev:.0f}m elevation' if elev else ''} is exposed to NZ's prevailing westerly and northwesterly winds. "
                      f"{'Council wind zone data confirms elevated wind exposure here.' if wind_zone else 'No official wind zone is mapped, but the terrain profile indicates significantly above-average wind speeds.'}",
            "action": "Check roof fixings, cladding, and flashings meet NZS 3604 requirements for exposed sites. "
                      "Budget for higher exterior maintenance costs. Consider wind breaks (fencing, planting) for outdoor living areas. "
                      "BRANZ recommends specific detailing for sites above 150m or on exposed ridgelines.",
            "category": "terrain",
        })
    elif wind_exp == "exposed":
        insights.append({
            "severity": "info",
            "title": "Exposed site — above-average wind",
            "detail": f"{'Elevated position' if rel_pos in ('hilltop', 'ridgeline') else 'West-facing mid-slope'}{f' at {elev:.0f}m' if elev else ''} — wind speeds are likely above average for this area, particularly during westerly weather patterns.",
            "action": "Consider wind when planning outdoor spaces and garden plantings. Check cladding and roof condition during building inspection.",
            "category": "terrain",
        })
    elif wind_exp == "sheltered" and rel_pos in ("depression", "valley"):
        insights.append({
            "severity": "positive",
            "title": "Naturally sheltered from wind",
            "detail": f"This {'valley' if rel_pos == 'valley' else 'low-lying'} position is naturally protected from prevailing winds by surrounding higher terrain. Wind damage risk is lower than average.",
            "action": "Sheltered sites are an advantage for outdoor comfort and reduce wear on exterior finishes. However, sheltered valleys can trap cold air in winter — check for frost pockets if you're a keen gardener.",
            "category": "terrain",
        })

    # ── Waterway proximity ──
    waterway_m = terrain.get("nearest_waterway_m")
    waterway_name = terrain.get("nearest_waterway_name")
    waterway_type = terrain.get("nearest_waterway_type", "")
    waterway_count = terrain.get("waterways_within_500m", 0)
    type_label = "river" if waterway_type == "river_cl" else "stream" if waterway_type == "drain_cl" else "waterway"

    if waterway_m is not None and waterway_m <= 50:
        in_flood = "flood" in detected
        insights.append({
            "severity": "warning",
            "title": f"Very close to {'the ' + waterway_name if waterway_name else 'a ' + type_label}",
            "detail": f"A {type_label}{' (' + waterway_name + ')' if waterway_name else ''} is just {waterway_m}m from this property. "
                      f"{'Council flood mapping confirms flood risk in this area.' if in_flood else 'Even without a mapped flood zone, proximity this close to a waterway significantly increases flood risk during heavy or prolonged rainfall.'}"
                      f"{' The flat, low-lying terrain compounds this — water has nowhere to drain except towards the property.' if is_depression or (slope is not None and slope < 2) else ''}",
            "action": "Check the property's floor level relative to the waterway's normal and flood levels. "
                      "Ask the council for flood modelling specific to this waterway. "
                      "Ensure your insurance explicitly covers riverine flooding — many standard policies exclude or limit cover near waterways.",
            "category": "terrain",
        })
    elif waterway_m is not None and waterway_m <= 100:
        insights.append({
            "severity": "info",
            "title": f"Waterway within {waterway_m}m",
            "detail": f"A {type_label}{' (' + waterway_name + ')' if waterway_name else ''} passes within {waterway_m}m of this property. "
                      "Properties near waterways face elevated flood risk during extreme rainfall, particularly if the terrain is flat or low-lying.",
            "action": "Check council flood maps for this specific waterway. During heavy rain events, waterways can rise rapidly — "
                      "know whether this property is above the waterway's expected flood level.",
            "category": "terrain",
        })
    elif waterway_m is not None and waterway_m <= 200 and waterway_count >= 2:
        insights.append({
            "severity": "info",
            "title": f"{waterway_count} waterways within 500m",
            "detail": f"Multiple waterways pass near this property (nearest: {waterway_m}m). "
                      "While not immediately adjacent, the density of waterways in this area increases flood exposure during extreme events.",
            "action": "Review council flood maps for this area. Multiple waterways suggest a low-lying drainage basin.",
            "category": "terrain",
        })

    # ── Cross-references: slope + rainfall ──
    climate_precip = None
    try:
        env = cache.get("report", {}).get("environment", {})
        climate_precip = env.get("climate_precip_change_pct") if env else None
    except Exception:
        pass

    if slope is not None and slope >= 15 and climate_precip is not None and climate_precip > 5:
        insights.append({
            "severity": "warning",
            "title": "Steep slope in a wetting climate",
            "detail": f"This {slope:.0f}° slope is in an area projected to receive {climate_precip:+.0f}% more rainfall by 2050. More rainfall on steep terrain increases the frequency and severity of slope failures over time.",
            "action": "Factor in climate change when assessing long-term slope stability. Ensure drainage systems are designed with capacity headroom. Regular maintenance of retaining walls and drainage channels becomes more important as rainfall intensifies.",
            "category": "terrain",
        })

    # ── Cross-references: slope + existing landslide data ──
    slope_failure_data = hazards.get("slope_failure")
    if slope is not None and slope >= 10 and slope_failure_data:
        landslide_count = hazards.get("landslide_count_500m", 0)
        if landslide_count and landslide_count > 0:
            insights.append({
                "severity": "critical",
                "title": "Steep terrain with mapped landslide history",
                "detail": f"This {slope:.0f}° slope has {landslide_count} documented landslide{'s' if landslide_count > 1 else ''} within 500m in the GNS Science database. The combination of steep terrain and historical instability is a strong indicator of ongoing risk.",
                "action": "This is a high-priority site for geotechnical assessment. Ask the council for any existing geotechnical reports filed for this area — there are likely relevant assessments from neighbouring properties. Consider the cost of slope remediation (retaining walls, ground anchors, drainage) when evaluating the property price.",
                "category": "terrain",
            })

    # ── Walking reach insights ──
    iso_method = isochrone.get("isochrone_method")
    total_stops = isochrone.get("transit_stops_walk_10min", 0)
    bus_stops = isochrone.get("bus_stops_walk_10min", 0)
    rail_stops = isochrone.get("rail_stops_walk_10min", 0)

    if iso_method == "valhalla" and total_stops is not None:
        if total_stops == 0:
            insights.append({
                "severity": "info",
                "title": "No transit within walking distance",
                "detail": "No bus, rail, or ferry stops are reachable within a 10-minute walk from this property, accounting for the actual street network and terrain. This is a car-dependent location.",
                "action": "Budget for vehicle ownership or check if the property has adequate parking. Consider the cost of commuting by car versus the savings from a potentially lower purchase price in car-dependent areas.",
                "category": "walkability",
            })
        elif total_stops >= 10:
            modes = []
            if bus_stops: modes.append(f"{bus_stops} bus")
            if rail_stops: modes.append(f"{rail_stops} rail")
            ferry = isochrone.get("ferry_stops_walk_10min", 0)
            if ferry: modes.append(f"{ferry} ferry")
            insights.append({
                "severity": "positive",
                "title": "Excellent transit access",
                "detail": f"{total_stops} transit stops are within a 10-minute walk ({', '.join(modes)} stop{'s' if total_stops > 1 else ''}). This calculation accounts for hills and the actual street network — not just straight-line distance.",
                "action": "Strong transit access typically supports property values and provides resilience against fuel price increases. Check peak-hour service frequency — stop count alone doesn't tell you how often services run.",
                "category": "walkability",
            })
        elif total_stops < 3:
            insights.append({
                "severity": "info",
                "title": "Limited transit access",
                "detail": f"Only {total_stops} transit stop{'s are' if total_stops > 1 else ' is'} reachable within a 10-minute walk. {'Hills in the area reduce how far you can walk in 10 minutes compared to flat terrain.' if slope and slope >= 5 else 'The street network limits direct walking routes to nearby stops.'}",
                "action": "Check the specific routes serving these stops — limited stops don't necessarily mean poor service if they're on a frequent route. Consider whether cycling or e-scooter access extends your practical transit reach.",
                "category": "walkability",
            })

    return insights


# ---------------------------------------------------------------------------
# Orchestrator: Generate complete snapshot
# ---------------------------------------------------------------------------

async def generate_snapshot(
    conn,
    address_id: int,
    persona: str = "buyer",
    dwelling_type: str = "House",
    inputs_at_purchase: dict | None = None,
    skip_ai: bool = False,
) -> dict | None:
    """Generate a complete report snapshot with all pre-computed variants."""

    # Phase A: Prefetch everything
    cache = await prefetch_property_data(conn, address_id)
    if not cache:
        return None

    # Phase B: Rent baselines (5 bedroom variants for this dwelling type)
    rent_baselines = await compute_rent_baselines(conn, cache, dwelling_type)

    # Phase C: Price advisor (pass user inputs for property adjustments)
    inp = inputs_at_purchase or {}
    price_advisor = await compute_price_snapshot(
        conn, cache,
        bedrooms=inp.get("bedrooms"),
        bathrooms=inp.get("bathrooms"),
        finish_tier=inp.get("finish_tier"),
    )

    # Phase D: Delta tables
    deltas = build_delta_tables()

    # Phase E: Pre-compute recommendations + insights (same as PDF generation)
    recommendations = []
    insights = {}
    lifestyle_fit = ([], [])
    try:
        from .report_html import build_recommendations, build_insights, build_lifestyle_fit
        recommendations = build_recommendations(cache["report"])
        insights = build_insights(cache["report"])
        lifestyle_fit = build_lifestyle_fit(cache["report"])
    except Exception as e:
        logger.warning(f"Recommendations/insights generation failed (non-critical): {e}")

    # Phase E2: Hazard-specific actionable advice
    hazard_advice = _build_hazard_advice(cache)

    # Phase E3: Terrain & walkability insights
    terrain_insights = _build_terrain_insights(cache)

    # Phase F: AI narrative (Claude/OpenAI — async, may take 10-30s)
    # Skip when called from PDF background task (which handles AI separately)
    ai_insights = None
    if not skip_ai:
        try:
            import asyncio
            from .ai_summary import generate_pdf_insights
            area_profile = cache["report"].get("area_profile")
            ai_insights = await asyncio.wait_for(
                generate_pdf_insights(cache["report"], area_profile, insights),
                timeout=45.0,
            )
        except Exception as e:
            logger.warning(f"AI insights generation failed for snapshot (non-critical): {e}")

    return {
        "report": cache["report"],
        "rent_baselines": rent_baselines,
        "price_advisor": price_advisor,
        "deltas": deltas,
        "recommendations": recommendations,
        "insights": insights,
        "ai_insights": ai_insights,
        "lifestyle_personas": lifestyle_fit[0] if lifestyle_fit else [],
        "lifestyle_tips": lifestyle_fit[1] if lifestyle_fit else [],
        "rent_history": cache["rent_history"],
        "hpi_data": cache["hpi_data"],
        "crime_trend": cache.get("crime_trend", []),
        "nearby_highlights": cache.get("nearby_highlights", {"good": [], "caution": [], "info": []}),
        "nearby_supermarkets": cache.get("nearby_supermarkets", []),
        "rates_data": cache.get("rates_data"),
        "nearby_doc": cache.get("nearby_doc", {"huts": [], "tracks": [], "campsites": []}),
        "school_zones": cache.get("school_zones", []),
        "road_noise": cache.get("road_noise"),
        "weather_history": cache.get("weather_history", []),
        "hazard_advice": hazard_advice,
        "terrain": cache.get("terrain", {}),
        "isochrone": cache.get("isochrone", {}),
        "terrain_insights": terrain_insights,
        "meta": {
            "schema_version": 1,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "address_id": address_id,
            "full_address": (cache["report"].get("address") or {}).get("full_address", ""),
            "persona": persona,
            "dwelling_type": dwelling_type,
            "inputs_at_purchase": inputs_at_purchase,
            "sa2_name": cache["sa2"]["sa2_name"],
            "ta_name": cache["sa2"]["ta_name"],
        },
    }


# ---------------------------------------------------------------------------
# Create and store snapshot
# ---------------------------------------------------------------------------

async def create_report_snapshot(
    conn,
    address_id: int,
    persona: str = "buyer",
    dwelling_type: str = "House",
    user_id: str | None = None,
    guest_purchase_id: int | None = None,
    inputs_at_purchase: dict | None = None,
    skip_ai: bool = False,
    report_tier: str = "full",
) -> str | None:
    """Generate snapshot, store in DB, return plaintext share_token.

    report_tier: 'quick' or 'full' — controls frontend rendering only.
    Snapshot data is identical regardless of tier.
    """

    snapshot = await generate_snapshot(conn, address_id, persona, dwelling_type, inputs_at_purchase, skip_ai=skip_ai)
    if not snapshot:
        return None

    token = secrets.token_urlsafe(12)  # 16 chars, URL-safe
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    full_address = snapshot["meta"]["full_address"]

    import orjson
    snapshot_bytes = orjson.dumps(snapshot, default=str)

    # Insert without user_id FK to avoid constraint violations
    # (user may not exist in users table yet during first purchase)
    await conn.execute(
        """
        INSERT INTO report_snapshots
            (address_id, full_address, persona,
             share_token_hash, snapshot_json, inputs_at_purchase, report_tier, created_at, expires_at)
        VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, now(),
                CASE WHEN %s = 'quick' THEN now() + interval '30 days' ELSE NULL END)
        """,
        [
            address_id, full_address, persona,
            token_hash, snapshot_bytes.decode(), orjson.dumps(inputs_at_purchase or {}).decode(),
            report_tier, report_tier,
        ],
    )

    # Explicit commit — our AsyncPoolWrapper doesn't auto-commit
    await conn.execute("COMMIT")

    return token
