# backend/app/services/rent_reports.py
"""
User-contributed rent report validation pipeline.
5 layers: hard bounds → SA2 deviation → bedroom coherence → rate limit → dedup.
"""
from __future__ import annotations

from fastapi import HTTPException


async def _get_sa2_for_address(conn, address_id: int) -> str | None:
    """Spatial join: address point → SA2 code."""
    cur = await conn.execute(
        """
        SELECT sa2.sa2_code FROM addresses a
        JOIN LATERAL (
            SELECT sa2_code FROM sa2_boundaries WHERE ST_Within(a.geom, geom) LIMIT 1
        ) sa2 ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    r = cur.fetchone()
    return r["sa2_code"] if r else None


async def _get_sa2_median(
    conn, sa2_code: str | None, dwelling_type: str, bedrooms: str
) -> float | None:
    """Get current SA2 median rent for this type+beds from bonds_detailed."""
    if not sa2_code:
        return None
    cur = await conn.execute(
        """
        SELECT median_rent FROM bonds_detailed
        WHERE location_id = %s AND dwelling_type = %s AND number_of_beds = %s
        ORDER BY time_frame DESC LIMIT 1
        """,
        [sa2_code, dwelling_type, bedrooms],
    )
    r = cur.fetchone()
    return float(r["median_rent"]) if r and r["median_rent"] else None


async def _get_building_address(conn, address_id: int) -> str:
    """Get base street address (without unit info) for grouping multi-unit reports."""
    cur = await conn.execute(
        """
        SELECT address_number || ' ' || road_name ||
               COALESCE(' ' || road_type_name, '') AS building_address
        FROM addresses WHERE address_id = %s
        """,
        [address_id],
    )
    r = cur.fetchone()
    return r["building_address"] if r else "Unknown"


async def submit(conn, body, ip_hash: str) -> dict:
    """Submit a rent report with 5-layer validation."""

    # 1. Hard bounds. already enforced by Pydantic (50-5000)

    # 2. SA2 deviation check. flag if >3x or <0.25x SA2 median
    sa2 = await _get_sa2_for_address(conn, body.address_id)
    sa2_median = await _get_sa2_median(conn, sa2, body.dwelling_type, body.bedrooms)
    is_outlier = False
    if sa2_median and (
        body.reported_rent > sa2_median * 3 or body.reported_rent < sa2_median * 0.25
    ):
        is_outlier = True

    # 3. Bedroom coherence. national maxima
    BED_MAX = {"1": 800, "2": 1200, "3": 1800, "4": 2500, "5+": 3500}
    if body.reported_rent > BED_MAX.get(body.bedrooms, 5000) * 1.5:
        is_outlier = True

    # 4. Rate limiting. Max 20 submissions per IP per 24h — generous enough to
    # allow progressive enrichment (rent first, then bathrooms/finish/etc
    # arriving as separate POSTs from the same user) while still bounding
    # abuse. The per-address dedup that used to live here is gone: a user
    # filling in more details about a property they already reported should
    # UPSERT into the same row, not get a 409.
    cur = await conn.execute(
        """
        SELECT COUNT(*) AS cnt FROM user_rent_reports
        WHERE ip_hash = %s AND reported_at > NOW() - interval '24 hours'
        """,
        [ip_hash],
    )
    if (cur.fetchone())["cnt"] >= 20:
        raise HTTPException(429, "Too many rent submissions from this network in 24h")

    # 5. Progressive enrichment: if the same ip+address reported in the last
    # 24h, UPDATE that row with any new non-null fields instead of inserting
    # a duplicate. Keeps one row per (ip, address) per day while letting the
    # frontend send partial updates as the user fills out the advisor form.
    cur = await conn.execute(
        """
        SELECT id FROM user_rent_reports
        WHERE ip_hash = %s AND address_id = %s
          AND reported_at > NOW() - interval '24 hours'
        ORDER BY reported_at DESC
        LIMIT 1
        """,
        [ip_hash, body.address_id],
    )
    existing = cur.fetchone()

    building_addr = await _get_building_address(conn, body.address_id)

    if existing:
        # UPDATE with COALESCE so existing non-null values aren't wiped by
        # nullable fields absent from this partial submission.
        await conn.execute(
            """
            UPDATE user_rent_reports SET
                dwelling_type = %s,
                bedrooms = %s,
                reported_rent = %s,
                is_outlier = %s,
                bathrooms = COALESCE(%s, bathrooms),
                finish_tier = COALESCE(%s, finish_tier),
                has_parking = COALESCE(%s, has_parking),
                is_furnished = COALESCE(%s, is_furnished),
                is_partially_furnished = COALESCE(%s, is_partially_furnished),
                has_outdoor_space = COALESCE(%s, has_outdoor_space),
                is_character_property = COALESCE(%s, is_character_property),
                shared_kitchen = COALESCE(%s, shared_kitchen),
                utilities_included = COALESCE(%s, utilities_included),
                not_insulated = COALESCE(%s, not_insulated),
                source_context = COALESCE(%s, source_context),
                notice_version = COALESCE(%s, notice_version),
                reported_at = NOW()
            WHERE id = %s
            """,
            [
                body.dwelling_type, body.bedrooms, body.reported_rent, is_outlier,
                body.bathrooms, body.finish_tier, body.has_parking,
                body.is_furnished, body.is_partially_furnished,
                body.has_outdoor_space, body.is_character_property,
                body.shared_kitchen, body.utilities_included, body.not_insulated,
                body.source_context, body.notice_version,
                existing["id"],
            ],
        )
    else:
        await conn.execute(
            """
            INSERT INTO user_rent_reports
                (address_id, building_address, sa2_code, dwelling_type, bedrooms,
                 reported_rent, is_outlier, ip_hash,
                 bathrooms, finish_tier, has_parking, is_furnished,
                 is_partially_furnished, has_outdoor_space, is_character_property,
                 shared_kitchen, utilities_included, not_insulated,
                 source_context, notice_version)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                body.address_id, building_addr, sa2, body.dwelling_type,
                body.bedrooms, body.reported_rent, is_outlier, ip_hash,
                body.bathrooms, body.finish_tier, body.has_parking,
                body.is_furnished, body.is_partially_furnished,
                body.has_outdoor_space, body.is_character_property,
                body.shared_kitchen, body.utilities_included, body.not_insulated,
                body.source_context, body.notice_version,
            ],
        )
    # conn is our custom wrapper which auto-commits via psycopg defaults
    try:
        await conn.commit()
    except AttributeError:
        pass  # custom db wrapper auto-commits

    return {"status": "accepted", "is_outlier": is_outlier}


async def get_building_reports(conn, address_id: int) -> dict:
    """Return crowd-sourced rent data for a building address.
    Only displayed if 3+ non-outlier reports exist."""
    building_addr = await _get_building_address(conn, address_id)
    cur = await conn.execute(
        """
        SELECT dwelling_type, bedrooms, reported_rent, reported_at
        FROM user_rent_reports
        WHERE building_address = %s AND is_outlier = FALSE
        ORDER BY reported_at DESC
        """,
        [building_addr],
    )
    reports = cur.fetchall()

    if len(reports) < 3:
        return {
            "building_address": building_addr,
            "report_count": len(reports),
            "median_rent": None,
            "reports": [],  # below display threshold
        }

    rents = sorted(r["reported_rent"] for r in reports)
    median = rents[len(rents) // 2]

    return {
        "building_address": building_addr,
        "report_count": len(reports),
        "median_rent": median,
        "reports": reports,
    }
