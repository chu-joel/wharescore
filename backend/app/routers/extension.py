"""WhareScore Badge browser extension endpoints.

Phase 1 is badge-only: the extension sends ONLY the address shown on the host
listing page plus the page URL (for persona detection). Nothing from the host
page content (bedrooms, price, photos, etc.) is ever captured, stored, or
forwarded.

Endpoints:
    POST /extension/badge . resolve an address, return a tiered payload
    GET  /extension/status. per-site kill-switch + version floor
"""
from __future__ import annotations

import logging
import re
from typing import Any

import orjson
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi.util import get_remote_address

from .. import db
from ..deps import limiter, user_or_ip_key
from ..redis import cache_get, cache_set
from ..services.abbreviations import expand_abbreviations
from ..services.auth import _extract_bearer, verify_jwt
from ..services.event_writer import track_event
from ..services.report_html import (
    build_insights, infer_persona_from_url, select_findings_for_badge,
)
from ..services.risk_score import enrich_with_scores
from ..services.search import search as search_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/extension", tags=["extension"])


EXTENSION_VERSION = "0.1.0"
MIN_EXTENSION_VERSION = "0.1.0"

ALLOWED_SITES = {
    "homes.co.nz",
    "oneroof.co.nz",
    "trademe.co.nz",
    "realestate.co.nz",
}

# Tier names match the brief exactly. Tests + extension client key off these
# literals, so don't rename without updating both.
TIER_ANON = "anon"
TIER_FREE = "free"
TIER_PRO = "pro"

# Anon badge findings. 2 severity-ranked, no persona weighting, no
# relative-to-baseline filtering (spec: "generic, no persona applied").
ANON_FINDING_COUNT = 2
FREE_FINDING_COUNT = 2

# Plans that unlock Pro capabilities. `pro` plan is the subscription; the
# transient credit-holder states (single/pack3/promo) stay on the free tier
# for the badge. they aren't recurring pro users, and the price/rent
# advisor is metered separately.
_PRO_PLAN_VALUES = {"pro"}

# Road-type aliases used by _normalise_for_match so that "10 Queen St"
# compares equal to "10 Queen Street" for the badge exact-match check.
_ROAD_TYPE_ALIASES = {
    "st": "street", "str": "street",
    "rd": "road",
    "ave": "avenue", "av": "avenue",
    "dr": "drive", "drv": "drive",
    "pl": "place",
    "cres": "crescent", "cr": "crescent",
    "tce": "terrace", "ter": "terrace",
    "ct": "court",
    "ln": "lane",
    "hwy": "highway",
    "pde": "parade",
    "sq": "square",
    "gr": "grove", "grv": "grove",
    "bvd": "boulevard", "blvd": "boulevard",
    "qy": "quay",
}


class BadgeRequest(BaseModel):
    source_site: str = Field(..., min_length=3, max_length=40)
    address_text: str = Field(..., min_length=4, max_length=300)
    # Optional: full URL of the host listing page. Used ONLY to infer persona
    # from the path (e.g. /rent/ → renter, /sale/ → buyer). Path-only. we
    # never read query strings or fragments.
    source_url: str | None = Field(None, max_length=500)


# ---------------------------------------------------------------------------
# Helpers. pure, unit-testable.
# ---------------------------------------------------------------------------

def normalise_address(text: str) -> str:
    """Lowercase, strip punctuation except slash, collapse whitespace, expand
    road-type aliases. Result is what we compare for exact-match acceptance."""
    if not text:
        return ""
    lowered = text.lower().strip()
    cleaned = re.sub(r"[^\w\s/]", " ", lowered)
    tokens = [t for t in cleaned.split() if t]
    expanded = [_ROAD_TYPE_ALIASES.get(t, t) for t in tokens]
    return " ".join(expanded)


def build_candidate_address(result: dict) -> str:
    number = (result.get("address_number") or "").strip()
    if not number:
        fa = result.get("full_address") or ""
        m = re.match(r"^\s*([0-9]+[A-Za-z]?(?:/[0-9]+[A-Za-z]?)?)\b", fa)
        number = m.group(1) if m else ""
    road_name = (result.get("road_name") or "").strip()
    road_type = (result.get("road_type_name") or "").strip()
    suburb = (result.get("suburb_locality") or "").strip()
    return " ".join(filter(None, [number, road_name, road_type, suburb]))


def exact_match(input_norm: str, candidate_norm: str) -> bool:
    if not input_norm or not candidate_norm:
        return False
    input_tokens = set(input_norm.split())
    return all(tok in input_tokens for tok in candidate_norm.split())


def determine_tier(user_id: str | None, plan: str | None) -> str:
    if not user_id:
        return TIER_ANON
    if plan and plan.lower() in _PRO_PLAN_VALUES:
        return TIER_PRO
    return TIER_FREE


def capabilities_for_tier(tier: str) -> dict[str, bool]:
    if tier == TIER_PRO:
        return {"save": True, "watchlist": True, "alerts": True, "pdf_export": True}
    if tier == TIER_FREE:
        return {"save": True, "watchlist": True, "alerts": False, "pdf_export": False}
    return {"save": False, "watchlist": False, "alerts": False, "pdf_export": False}


def compute_price_band(report: dict) -> dict[str, int] | None:
    """Free-tier price band: CV × HPI direction, widened for low confidence.

    Intentionally wide (±15% default). the precise Pro-tier `price_estimate`
    is the upsell. If there's no CV anchor we return None; the free badge
    simply omits the price_band field in that case.
    """
    prop = report.get("property") or {}
    cv = prop.get("capital_value")
    try:
        cv_val = float(cv) if cv is not None else None
    except (TypeError, ValueError):
        cv_val = None
    if not cv_val or cv_val <= 0:
        return None

    # HPI adjustment: use the most recent national HPI movement vs CV date as
    # a cheap directional nudge. Missing data → no adjustment.
    hpi_multiplier = 1.0
    market = report.get("market") or {}
    hpi_yoy = market.get("hpi_yoy_pct")
    try:
        if hpi_yoy is not None:
            hpi_multiplier = 1.0 + (float(hpi_yoy) / 100.0)
    except (TypeError, ValueError):
        pass

    centre = cv_val * hpi_multiplier
    low = int(round(centre * 0.85 / 1000.0) * 1000)
    high = int(round(centre * 1.15 / 1000.0) * 1000)
    return {"low": low, "high": high}


def extract_pro_fields(report: dict) -> dict[str, Any]:
    """Shape the Pro-only flat fields from existing report data.

    Phase 1 keeps this deterministic and report-driven. the precise
    rent/price advisor engines hit separate services and are deferred to
    Phase 1.1. Fields whose underlying source isn't wired yet are surfaced
    as None so the badge UI renders a consistent shape.
    """
    transport = report.get("transport") or {}
    liv = report.get("liveability") or {}
    market = report.get("market") or {}
    prop = report.get("property") or {}

    walk_score: int | None = None
    walk_raw = liv.get("walk_score") or transport.get("walk_score")
    try:
        if walk_raw is not None:
            walk_score = int(round(float(walk_raw)))
    except (TypeError, ValueError):
        walk_score = None

    # Schools. up to 3 nearest school rows from the liveability payload.
    schools_src = liv.get("nearby_schools") or liv.get("schools") or []
    schools: list[dict[str, Any]] = []
    if isinstance(schools_src, list):
        for s in schools_src[:3]:
            if not isinstance(s, dict):
                continue
            schools.append({
                "name": s.get("name"),
                "decile": s.get("decile"),
                "zone": "in-zone" if s.get("in_zone") else "out-of-zone"
                        if s.get("in_zone") is False else None,
            })

    # Rent estimate shape. precise values require rent_advisor; surface what
    # we have from the snapshot-friendly fields when present.
    rent_estimate: dict[str, Any] | None = None
    rent_low = market.get("rent_estimate_low")
    rent_median = market.get("rent_estimate_median") or market.get("median_rent")
    rent_high = market.get("rent_estimate_high")
    if rent_median is not None:
        rent_estimate = {
            "low": rent_low,
            "median": rent_median,
            "high": rent_high,
            "yield_percent": _calc_yield(
                median_weekly_rent=rent_median,
                capital_value=prop.get("capital_value"),
            ),
        }

    # Precise price estimate. reuse the same band shape. If we only have the
    # CV anchor, omit entirely (the wide `price_band` already covered that).
    price_estimate: dict[str, Any] | None = None
    pe_low = market.get("price_estimate_low")
    pe_median = market.get("price_estimate_median")
    pe_high = market.get("price_estimate_high")
    if pe_median is not None:
        price_estimate = {
            "low": pe_low,
            "median": pe_median,
            "high": pe_high,
            "confidence": market.get("price_estimate_confidence"),
            "comps": market.get("price_estimate_comps") or [],
        }

    return {
        "price_estimate": price_estimate,
        "rent_estimate": rent_estimate,
        "walk_score": walk_score,
        "schools": schools,
    }


def _calc_yield(median_weekly_rent: Any, capital_value: Any) -> float | None:
    try:
        rent = float(median_weekly_rent)
        cv = float(capital_value)
    except (TypeError, ValueError):
        return None
    if rent <= 0 or cv <= 0:
        return None
    return round((rent * 52.0) / cv * 100.0, 1)


_RENTER_DROP_TITLE_MARKERS = ("school",)


def _drop_persona_irrelevant(findings: list[dict], persona: str | None) -> list[dict]:
    """Persona-rank cleanup: renters don't care about school catchments
    (per brief. school proximity is a buyer signal). Strip any finding whose
    title leads with school-related copy. Buyer path is untouched."""
    if persona != "renter":
        return findings
    out: list[dict] = []
    for f in findings:
        title = (f.get("title") or "").lower().strip()
        if any(title.startswith(m) for m in _RENTER_DROP_TITLE_MARKERS):
            continue
        # Also drop "N schools within ..." style titles that don't lead with
        # the word but clearly are school findings.
        if "schools within" in title or "school zone" in title or "in-zone for" in title:
            continue
        out.append(f)
    return out


def pick_findings(report: dict, tier: str, persona: str | None) -> list[dict]:
    """Tier → findings selection:
        anon: 2 generic findings, severity-ranked, persona-neutral.
        free: 2 persona-tailored via select_findings_for_badge.
        pro : all findings, persona-ranked (no slice).
    """
    if tier == TIER_ANON:
        return select_findings_for_badge(report, persona=None, max_count=ANON_FINDING_COUNT)
    if tier == TIER_FREE:
        ranked = select_findings_for_badge(report, persona=persona, max_count=0)
        return _drop_persona_irrelevant(ranked, persona)[:FREE_FINDING_COUNT]
    # pro
    ranked = select_findings_for_badge(report, persona=persona, max_count=0) or _all_findings(report)
    return _drop_persona_irrelevant(ranked, persona)


def _all_findings(report: dict) -> list[dict]:
    """Fallback. shouldn't be reached since select_findings_for_badge with
    max_count=0 returns every ranked finding, but defensively keep a path
    that flattens raw insights in case the helper changes."""
    out: list[dict] = []
    for _section, items in build_insights(report).items():
        for item in items:
            text = item.get("text") or ""
            if not text:
                continue
            level = item.get("level") or "info"
            out.append({
                "severity": "warning" if level == "warn" else ("info" if level == "info" else "positive"),
                "title": text,
                "detail": item.get("action") or "",
            })
    return out


async def resolve_plan(user_id: str) -> str:
    """Effective plan lookup. mirrors /account/credits so tier decisions are
    consistent with the rest of the app."""
    try:
        async with db.pool.connection() as conn:
            cur = await conn.execute(
                "SELECT plan FROM users WHERE user_id = %s", [user_id]
            )
            row = cur.fetchone()
            base_plan = (row or {}).get("plan") or "free"

            cur = await conn.execute(
                """
                SELECT credit_type FROM report_credits
                WHERE user_id = %s
                  AND (expires_at IS NULL OR expires_at > now())
                  AND cancelled_at IS NULL
                  AND (credits_remaining > 0 OR credit_type = 'pro')
                ORDER BY CASE credit_type WHEN 'pro' THEN 0 ELSE 1 END,
                         purchased_at DESC
                LIMIT 1
                """,
                [user_id],
            )
            credit = cur.fetchone()
        if credit and credit.get("credit_type") == "pro":
            return "pro"
        return base_plan
    except Exception as e:
        logger.warning(f"resolve_plan failed for user={user_id}: {e}")
        return "free"


async def resolve_persona(user_id: str | None, source_url: str | None) -> str | None:
    """Persona precedence: logged-in user's stored persona wins; fallback to
    URL-path inference. Unknown → None (anon badge uses generic weights)."""
    if user_id:
        try:
            async with db.pool.connection() as conn:
                cur = await conn.execute(
                    "SELECT persona FROM users WHERE user_id = %s", [user_id]
                )
                row = cur.fetchone()
                stored = (row or {}).get("persona")
                if stored in {"renter", "buyer"}:
                    return stored
        except Exception as e:
            # users.persona may not exist yet on every deployment. fall
            # through to URL inference rather than hard-failing the request.
            logger.debug(f"persona column lookup failed: {e}")
    return infer_persona_from_url(source_url)


# ---------------------------------------------------------------------------
# Rate limit key func. per user for authed, per IP for anon.
# ---------------------------------------------------------------------------

def _badge_limit(key: str) -> str:
    """Dynamic rate-limit provider. slowapi passes the key returned by
    `user_or_ip_key`; that key starts with `user:` for verified-JWT callers
    and is an IP otherwise. 60/min authed, 30/min anon. per brief § Rate."""
    if isinstance(key, str) and key.startswith("user:"):
        return "60/minute"
    return "30/minute"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status")
@limiter.limit("60/minute", key_func=get_remote_address)
async def extension_status(request: Request):
    """Public kill-switch + version floor. Extension polls every 60 minutes
    via chrome.alarms. Phase 1: trademe.co.nz ships with badge_enabled=false
    until verified rendered-page fixtures land."""
    return {
        "min_version": MIN_EXTENSION_VERSION,
        "latest_version": EXTENSION_VERSION,
        "sites": {
            "homes.co.nz":      {"badge_enabled": True},
            "oneroof.co.nz":    {"badge_enabled": True},
            "trademe.co.nz":    {"badge_enabled": False},
            "realestate.co.nz": {"badge_enabled": True},
        },
        "message": None,
    }


@router.post("/badge")
@limiter.limit(_badge_limit, key_func=user_or_ip_key)
async def extension_badge(request: Request, body: BadgeRequest):
    """Resolve an address scraped from a host listing page, return a tiered
    payload. Host-page DOM content other than the address text is neither
    captured nor forwarded."""
    # 1. Header gate.
    if request.headers.get("X-WhareScore-Extension") != "1":
        raise HTTPException(400, "Missing X-WhareScore-Extension header")

    source_site = body.source_site.strip().lower()
    if source_site not in ALLOWED_SITES:
        raise HTTPException(400, "Unsupported source_site")

    # 2. Optional auth.
    user_id: str | None = None
    token = _extract_bearer(request)
    if token:
        try:
            payload = verify_jwt(token)
            user_id = payload.get("sub")
        except HTTPException:
            user_id = None

    # 3. Address search + exact-match acceptance.
    expanded = expand_abbreviations(body.address_text)
    results = await search_service(expanded, 3)
    if not results:
        return {"matched": False}

    input_norm = normalise_address(body.address_text)
    matched_row: dict | None = None
    ambiguous = False
    for result in results:
        candidate_norm = normalise_address(build_candidate_address(result))
        if exact_match(input_norm, candidate_norm):
            if matched_row is None:
                matched_row = result
            else:
                ambiguous = True
                break

    if matched_row is None:
        return {"matched": False}

    address_id = matched_row["address_id"]
    full_address = matched_row.get("full_address") or ""

    # 4. Report fetch. reuse the 24h Redis cache.
    cache_key = f"report:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        report = orjson.loads(cached)
        if not (report.get("scores") or {}).get("composite"):
            report = enrich_with_scores(report)
    else:
        async with db.pool.connection() as conn:
            cur = await conn.execute(
                "SELECT get_property_report(%s) AS report", [address_id]
            )
            row = cur.fetchone()
        if not row or not row["report"]:
            return {"matched": False}
        report = enrich_with_scores(row["report"])
        await cache_set(cache_key, orjson.dumps(report).decode(), ex=86400)

    # 5. Tier + persona.
    plan = await resolve_plan(user_id) if user_id else None
    tier = determine_tier(user_id, plan)
    persona = await resolve_persona(user_id, body.source_url)

    # 6. Scores + findings + tier-specific fields.
    scores = report.get("scores") or {}
    score_value = scores.get("composite")
    score_band = (scores.get("label") or "").lower() or None
    findings = pick_findings(report, tier, persona)

    response: dict[str, Any] = {
        "matched": True,
        "ambiguous": ambiguous,
        "address_id": address_id,
        "full_address": full_address,
        "tier": tier,
        "persona": persona,
        "score": round(score_value) if isinstance(score_value, (int, float)) else None,
        "score_band": score_band,
        "findings": findings,
        "capabilities": capabilities_for_tier(tier),
        "report_url": f"https://wharescore.com/property/{address_id}",
    }

    # Tier-gated fields. the brief forbids leaking pro data to free, and
    # free/pro get the wide price band (pro also gets the precise estimate).
    if tier in {TIER_FREE, TIER_PRO}:
        band = compute_price_band(report)
        if band is not None:
            response["price_band"] = band

    if tier == TIER_PRO:
        response.update(extract_pro_fields(report))

    # 7. Telemetry. no address content, only id + site + tier.
    client_ip = request.client.host if request.client else None
    track_event(
        "extension_badge_rendered",
        user_id=user_id,
        ip=client_ip,
        properties={
            "address_id": address_id,
            "source_site": source_site,
            "tier": tier,
            "persona": persona,
            "ambiguous": ambiguous,
        },
    )

    return response
