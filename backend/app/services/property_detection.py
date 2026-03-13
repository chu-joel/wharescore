# backend/app/services/property_detection.py
"""
Auto-detect dwelling type from address metadata + spatial signals.
Used by: report endpoint, BuildingInfoBanner, market auto-select.
"""
from __future__ import annotations


async def detect_property_type(conn, address_id: int) -> dict | None:
    """Returns {detected_type, unit_count, is_multi_unit, building_address, footprint_m2}."""

    # Get address details + title info
    cur = await conn.execute(
        """
        SELECT a.full_address, a.unit_type, a.unit_value,
               a.address_number, a.road_name, a.road_type_name,
               a.gd2000_xcoord, a.gd2000_ycoord,
               pt.estate_description
        FROM addresses a
        LEFT JOIN LATERAL (
            SELECT estate_description FROM property_titles pt
            WHERE ST_Contains(pt.geom, a.geom) LIMIT 1
        ) pt ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    addr = cur.fetchone()
    if not addr:
        return None

    # Count addresses at same coordinates (multi-unit indicator)
    cur = await conn.execute(
        """
        SELECT COUNT(*) AS cnt FROM addresses
        WHERE gd2000_xcoord = %s AND gd2000_ycoord = %s
          AND address_lifecycle = 'Current'
        """,
        [addr["gd2000_xcoord"], addr["gd2000_ycoord"]],
    )
    unit_count = (cur.fetchone())["cnt"]

    # Get building footprint area
    cur = await conn.execute(
        """
        SELECT round(ST_Area(b.geom::geography)::numeric, 1) AS area_m2
        FROM building_outlines b, addresses a
        WHERE a.address_id = %s
          AND b.geom && ST_Expand(a.geom, 0.0005)
          AND ST_Contains(b.geom, a.geom)
        LIMIT 1
        """,
        [address_id],
    )
    bld = cur.fetchone()
    footprint = float(bld["area_m2"]) if bld else None

    # Detection rules (priority order)
    detected = "House"
    is_multi = False

    if unit_count > 4:
        detected = "Apartment"
        is_multi = True
    elif addr.get("estate_description") and "Unit Title" in addr["estate_description"]:
        detected = "Apartment"
        is_multi = True
    elif addr.get("unit_type") and addr["unit_type"].lower() in ("flat", "unit"):
        detected = "Flat"
        is_multi = True
    elif addr.get("unit_type") and addr["unit_type"].lower() == "apartment":
        detected = "Apartment"
        is_multi = True
    elif not addr.get("unit_type") and footprint and footprint < 300:
        detected = "House"

    # Build base street address (strip unit info)
    building_address = f"{addr['address_number']} {addr['road_name']}"
    if addr.get("road_type_name"):
        building_address += f" {addr['road_type_name']}"

    return {
        "detected_type": detected,
        "unit_count": unit_count,
        "is_multi_unit": is_multi,
        "building_address": building_address,
        "footprint_m2": footprint,
    }
