from __future__ import annotations

# backend/app/routers/property.py
import asyncio
import logging

import orjson

logger = logging.getLogger(__name__)
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse

from .. import db
from ..deps import limiter
from ..redis import cache_get, cache_set
from ..services.ai_summary import generate_pdf_insights, generate_property_summary
from ..services.property_detection import detect_property_type
from ..services.report_html import build_insights, build_lifestyle_fit, build_recommendations
from ..services.report_html import render as render_report_html
from ..services.risk_score import enrich_with_scores
from ..services.pdf_jobs import (
    create_job, get_job_status, get_job_html,
    set_job_generating, set_job_completed, set_job_failed,
)

router = APIRouter()


@router.get("/property/{address_id}/report")
@limiter.limit("20/minute")
async def get_report(request: Request, address_id: int):
    """Full property report with risk scores.
    Calls get_property_report() PL/pgSQL function, enriches with Python scoring.
    AI summary is NOT included — fetch separately from /ai-summary.
    Cached 24h in Redis."""

    logger.info(f"get_report called for address_id={address_id}, db.pool={db.pool}")

    # 1. Check Redis cache
    cache_key = f"report:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    # 2. Call PL/pgSQL function — single DB round-trip
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT get_property_report(%s) AS report", [address_id]
        )
        row = cur.fetchone()

    if not row or not row["report"]:
        raise HTTPException(404, "Address not found")

    # 3. Compute risk scores + run detection + fetch area profile concurrently
    report = enrich_with_scores(row["report"])

    sa2_code = (report.get("address") or {}).get("sa2_code")

    async def _get_detection():
        async with db.pool.connection() as conn_det:
            return await detect_property_type(conn_det, address_id)

    async def _get_area_profile():
        if not sa2_code:
            return None
        async with db.pool.connection() as conn2:
            cur2 = await conn2.execute(
                "SELECT profile FROM area_profiles WHERE sa2_code = %s", [sa2_code]
            )
            pr = cur2.fetchone()
            return pr["profile"] if pr else None

    detection, area_profile = await asyncio.gather(_get_detection(), _get_area_profile())

    if detection:
        report["property_detection"] = detection
    report["area_profile"] = area_profile
    report["ai_summary"] = None  # fetched separately via /ai-summary

    # 4. Cache 24h
    await cache_set(cache_key, orjson.dumps(report).decode(), ex=86400)

    return report


@router.get("/property/{address_id}/ai-summary")
@limiter.limit("20/minute")
async def get_ai_summary(request: Request, address_id: int):
    """Generate AI summary for a property report. Slow — call after report loads.
    Returns {ai_summary: str | null, area_profile: str | null}."""

    # Try to use the cached report as input (avoids re-running the DB function)
    cache_key = f"report:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        report = orjson.loads(cached)
    else:
        async with db.pool.connection() as conn:
            cur = await conn.execute(
                "SELECT get_property_report(%s) AS report", [address_id]
            )
            row = cur.fetchone()
        if not row or not row["report"]:
            raise HTTPException(404, "Address not found")
        report = enrich_with_scores(row["report"])

    sa2_code = (report.get("address") or {}).get("sa2_code")
    area_profile = report.get("area_profile")

    # Fetch area profile if not already in the cached report
    if area_profile is None and sa2_code:
        async with db.pool.connection() as conn2:
            cur2 = await conn2.execute(
                "SELECT profile FROM area_profiles WHERE sa2_code = %s", [sa2_code]
            )
            pr = cur2.fetchone()
            area_profile = pr["profile"] if pr else None

    try:
        summary = await asyncio.wait_for(
            generate_property_summary(report, area_profile),
            timeout=30.0,
        )
    except (asyncio.TimeoutError, Exception) as e:
        logger.warning(f"AI summary failed for {address_id}: {e}")
        summary = None

    return {"ai_summary": summary, "area_profile": area_profile}


# =============================================================================
# GET /property/{address_id}/summary — Lightweight for map popups + SSR
# =============================================================================

@router.get("/property/{address_id}/summary")
@limiter.limit("60/minute")
async def get_summary(request: Request, address_id: int):
    """Lightweight property summary for map popups and SSR metadata.
    Returns key facts only — no hazard details, no nearby data.
    Tries cached report first, falls back to minimal DB query."""

    # 1. Try extracting from cached full report
    cache_key = f"report:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        report = orjson.loads(cached)
        return _extract_summary(report, address_id)

    # 2. Fall back to full report (generates cache for future requests)
    try:
        report = await get_property_report(address_id)
        return _extract_summary(report, address_id)
    except HTTPException:
        raise
    except Exception as e:
        # If full report fails, return minimal data
        async with db.pool.connection() as conn:
            cur = await conn.execute(
                """
                SELECT a.address_id, a.full_address,
                       a.suburb_locality AS suburb, a.town_city AS city,
                       a.unit_type,
                       sa2.sa2_name
                FROM addresses a
                LEFT JOIN LATERAL (
                    SELECT sa2_name FROM sa2_boundaries
                    WHERE ST_Within(a.geom, geom) LIMIT 1
                ) sa2 ON true
                WHERE a.address_id = %s
                """,
                [address_id],
            )
            row = cur.fetchone()

        if not row:
            raise HTTPException(404, "Address not found")

        return {
            "address_id": row["address_id"],
            "full_address": row["full_address"],
            "suburb": row["suburb"],
            "city": row["city"],
            "sa2_name": row["sa2_name"],
            "unit_type": row["unit_type"],
            "scores": None,
            "notable_findings": [],
        }


def _get_headline_rent(rental_overview) -> int | None:
    """Extract headline median rent from rental_overview list."""
    if not isinstance(rental_overview, list):
        return None
    row = next(
        (r for r in rental_overview if isinstance(r, dict)
         and r.get("dwelling_type") == "House" and r.get("beds") == "ALL"),
        next((r for r in rental_overview if isinstance(r, dict) and r.get("beds") == "ALL"), None),
    )
    return row.get("median") if row else None


def _extract_summary(report: dict, address_id: int) -> dict:
    """Extract lightweight summary from a full cached report."""
    addr = report.get("address") or {}
    scores = report.get("scores") or {}
    rental = (report.get("market") or {}).get("rental_overview") or []

    # Pick top 2 notable findings from category scores
    notable = []
    categories = scores.get("categories") or {}
    indicators = scores.get("indicators") or {}
    for cat_name, cat_score in categories.items():
        if isinstance(cat_score, (int, float)):
            if cat_score >= 70:
                notable.append(f"High {cat_name} risk")
            elif cat_score <= 30:
                notable.append(f"Low {cat_name} risk")

    return {
        "address_id": address_id,
        "full_address": addr.get("full_address"),
        "suburb": addr.get("suburb"),
        "city": addr.get("city"),
        "sa2_name": addr.get("sa2_name"),
        "unit_type": addr.get("unit_type"),
        "scores": {
            "composite": scores.get("composite"),
            "rating": scores.get("rating", {}).get("label") if isinstance(scores.get("rating"), dict) else scores.get("rating"),
        } if scores.get("composite") else None,
        "median_rent": _get_headline_rent(rental),
        "notable_findings": notable[:3],
    }


# =============================================================================
# PDF Generation (Background)
# =============================================================================

async def _generate_pdf_background(job_id: str, address_id: int):
    """Background task to generate PDF report."""
    try:
        await set_job_generating(job_id)

        # 1. Get full report (cache or DB)
        cache_key = f"report:{address_id}"
        cached = await cache_get(cache_key)
        if cached:
            report = orjson.loads(cached)
        else:
            async with db.pool.connection() as conn:
                cur = await conn.execute(
                    "SELECT get_property_report(%s) AS report", [address_id]
                )
                row = cur.fetchone()
            if not row or not row["report"]:
                await set_job_failed(job_id, "Address not found")
                return
            report = enrich_with_scores(row["report"])

        # 2. Get area profile
        area_profile = report.get("area_profile")
        if area_profile is None:
            sa2_code = (report.get("address") or {}).get("sa2_code")
            if sa2_code:
                async with db.pool.connection() as conn2:
                    cur2 = await conn2.execute(
                        "SELECT profile FROM area_profiles WHERE sa2_code = %s", [sa2_code]
                    )
                    pr = cur2.fetchone()
                    area_profile = pr["profile"] if pr else None

        # 3. Fetch 5 nearby supermarkets for the report
        nearby_supermarkets = []
        try:
            async with db.pool.connection() as conn_sm:
                cur_sm = await conn_sm.execute("""
                    WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                    SELECT oa.name, oa.subcategory, oa.brand,
                           round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                           ST_X(oa.geom) AS lng, ST_Y(oa.geom) AS lat
                    FROM osm_amenities oa, addr
                    WHERE oa.geom && ST_Expand(addr.geom, 10000 * 0.00001)
                      AND ST_DWithin(oa.geom::geography, addr.geom::geography, 10000)
                      AND oa.subcategory IN ('supermarket', 'greengrocer', 'convenience', 'grocery', 'wholesale', 'general')
                    ORDER BY distance_m LIMIT 5
                """, [address_id])
                nearby_supermarkets = [dict(r) for r in cur_sm.fetchall()]
        except Exception as e:
            logger.warning(f"Nearby supermarkets query failed: {e}")

        # 3b. Fetch categorised nearby amenities for the report
        from .nearby import AMENITY_CLASSES
        nearby_highlights = {"good": [], "caution": [], "info": []}
        try:
            target_subcats = tuple(AMENITY_CLASSES.keys())
            placeholders = ",".join(["%s"] * len(target_subcats))
            async with db.pool.connection() as conn_nh:
                cur_nh = await conn_nh.execute(f"""
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
                for r in cur_nh.fetchall():
                    subcat = r["subcategory"]
                    if subcat not in AMENITY_CLASSES:
                        continue
                    sentiment, label = AMENITY_CLASSES[subcat]
                    item = {"name": r["name"] or label, "label": label, "distance_m": float(r["distance_m"])}
                    nearby_highlights[sentiment].append(item)
            for group in nearby_highlights.values():
                group.sort(key=lambda x: x["distance_m"])
        except Exception as e:
            logger.warning(f"Nearby highlights query failed: {e}")

        # 4. Run Python insight rule engine
        python_insights = build_insights(report)

        # 5. Run lifestyle fit engine
        lifestyle_fit = build_lifestyle_fit(report)

        # 6. Build "Before You Buy" recommendations (with admin overrides)
        rec_overrides = {}
        try:
            async with db.pool.connection() as conn_ro:
                cur_ro = await conn_ro.execute(
                    "SELECT value FROM admin_content WHERE key = 'recommendations'"
                )
                row_ro = cur_ro.fetchone()
                if row_ro:
                    rec_overrides = (row_ro["value"] or {}).get("overrides", {})
        except Exception:
            pass
        recommendations = build_recommendations(report, overrides=rec_overrides)

        # 7. Call AI for narrative sections
        try:
            ai_insights = await asyncio.wait_for(
                generate_pdf_insights(report, area_profile, python_insights),
                timeout=45.0,
            )
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"PDF AI insights failed for {address_id}: {e}")
            ai_insights = None

        # 8. Render premium HTML
        html = render_report_html(
            report, python_insights, lifestyle_fit, ai_insights, recommendations,
            nearby_supermarkets=nearby_supermarkets,
            nearby_highlights=nearby_highlights,
        )

        # 8. Mark job as completed
        await set_job_completed(job_id, html)

    except Exception as e:
        logger.error(f"PDF generation failed for job {job_id}: {e}")
        await set_job_failed(job_id, str(e))


# =============================================================================
# POST /property/{address_id}/export/pdf/start — Initiate PDF generation
# =============================================================================

@router.post("/property/{address_id}/export/pdf/start")
@limiter.limit("5/hour")
async def start_pdf_export(request: Request, address_id: int, background_tasks: BackgroundTasks):
    """Start background PDF generation. Returns job ID for polling."""
    job_id = await create_job(address_id)
    background_tasks.add_task(_generate_pdf_background, job_id, address_id)
    return JSONResponse({
        "job_id": job_id,
        "status_url": f"/api/v1/property/{address_id}/export/pdf/status/{job_id}",
        "download_url": f"/api/v1/property/{address_id}/export/pdf/download/{job_id}",
    })


# =============================================================================
# GET /property/{address_id}/export/pdf/status/{job_id} — Check generation status
# =============================================================================

@router.get("/property/{address_id}/export/pdf/status/{job_id}")
@limiter.limit("30/minute")
async def check_pdf_status(request: Request, address_id: int, job_id: str):
    """Check the status of a PDF generation job."""
    status = await get_job_status(job_id)
    if not status:
        raise HTTPException(404, "Job not found")
    return JSONResponse(status)


# =============================================================================
# GET /property/{address_id}/export/pdf/download/{job_id} — Download generated PDF
# =============================================================================

@router.get("/property/{address_id}/export/pdf/download/{job_id}")
@limiter.limit("20/minute")
async def download_pdf(request: Request, address_id: int, job_id: str):
    """Download the generated PDF report HTML."""
    html = await get_job_html(job_id)
    if not html:
        status = await get_job_status(job_id)
        if not status:
            raise HTTPException(404, "Job not found")
        if status["status"] == "failed":
            raise HTTPException(400, f"PDF generation failed: {status['error']}")
        raise HTTPException(202, "PDF still generating")

    return HTMLResponse(
        content=html,
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-store",
        },
    )


