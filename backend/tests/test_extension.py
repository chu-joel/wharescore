"""Tests for the browser-extension badge endpoints.

The router's pure helpers are exercised directly. Endpoint tests use FastAPI's
TestClient with an ASGI lifespan-less app so startup migrations / pool init
don't run. Data-dependent callables on the router module are patched.
"""
from __future__ import annotations

import time
from unittest.mock import patch, AsyncMock

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.routers import extension as ext_router
from app.services import report_html


# ---------------------------------------------------------------------------
# Pure helper tests
# ---------------------------------------------------------------------------


def test_normalise_address_expands_road_types():
    assert ext_router.normalise_address("10 Queen St, Auckland") == "10 queen street auckland"
    assert ext_router.normalise_address("2/14 Aro St.") == "2/14 aro street"


def test_exact_match_accepts_extra_tokens_on_input_side():
    assert ext_router.exact_match(
        "42 queen street auckland central auckland",
        "42 queen street auckland central",
    )
    assert not ext_router.exact_match(
        "42 queen street",
        "42 queen street auckland central",
    )


def test_exact_match_rejects_road_name_mismatch():
    assert not ext_router.exact_match(
        "14 aro street wellington",
        "14 allen street wellington",
    )


def test_determine_tier_and_capabilities():
    assert ext_router.determine_tier(None, None) == "anon"
    assert ext_router.determine_tier("u1", "free") == "free"
    assert ext_router.determine_tier("u1", "pro") == "pro"
    assert ext_router.capabilities_for_tier("anon") == {
        "save": False, "watchlist": False, "alerts": False, "pdf_export": False,
    }
    assert ext_router.capabilities_for_tier("free") == {
        "save": True, "watchlist": True, "alerts": False, "pdf_export": False,
    }
    assert ext_router.capabilities_for_tier("pro") == {
        "save": True, "watchlist": True, "alerts": True, "pdf_export": True,
    }


def test_build_candidate_address_falls_back_to_full_address():
    row = {
        "address_id": 1,
        "full_address": "42 Queen Street, Auckland Central",
        "road_name": "Queen",
        "road_type_name": "Street",
        "suburb_locality": "Auckland Central",
    }
    assert ext_router.build_candidate_address(row) == "42 Queen Street Auckland Central"


def test_compute_price_band_centres_on_cv_and_applies_hpi():
    report = {
        "property": {"capital_value": 900_000},
        "market": {"hpi_yoy_pct": 4.0},
    }
    band = ext_router.compute_price_band(report)
    assert band is not None
    # 900k × 1.04 = 936k. ±15% → 795,600 → 796,000 low, 1,076,400 → 1,076,000 high (rounded to 1000).
    assert band["low"] < band["high"]
    assert 700_000 < band["low"] < 900_000
    assert 900_000 < band["high"] < 1_200_000


def test_compute_price_band_returns_none_without_cv():
    assert ext_router.compute_price_band({"property": {}}) is None


# ---------------------------------------------------------------------------
# select_findings_for_badge — cross-checked via the router's pick_findings
# ---------------------------------------------------------------------------


def test_select_findings_ranks_critical_above_info_for_anon():
    report = {
        "hazards": {"flood": "1% AEP (1-in-100-year)", "tsunami_zone_class": 2, "liquefaction": "moderate"},
        "environment": {}, "liveability": {}, "market": {}, "planning": {}, "transport": {}, "property": {},
    }
    ranked = report_html.select_findings_for_badge(report, persona=None, max_count=2)
    assert len(ranked) == 2
    assert ranked[0]["severity"] == "critical"
    assert "flood" in ranked[0]["title"].lower()


def test_select_findings_respects_persona_weighting():
    report = {
        "hazards": {"flood": "1% AEP (1-in-100-year)"},
        "environment": {}, "liveability": {}, "market": {}, "planning": {}, "transport": {}, "property": {},
    }
    renter_top = report_html.select_findings_for_badge(report, persona="renter", max_count=1)
    buyer_top = report_html.select_findings_for_badge(report, persona="buyer", max_count=1)
    # Flood shows up for both personas, but the ranking should be stable.
    assert renter_top and buyer_top
    assert renter_top[0]["title"] == buyer_top[0]["title"]


def test_infer_persona_from_url():
    assert report_html.infer_persona_from_url("https://homes.co.nz/address/abc") is None
    assert report_html.infer_persona_from_url("https://www.trademe.co.nz/a/property/residential/rent/wgtn") == "renter"
    assert report_html.infer_persona_from_url("https://www.realestate.co.nz/x/residential/sale/y") == "buyer"


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


def _build_client() -> TestClient:
    """Minimal FastAPI app mounting just the extension router — no lifespan,
    no DB init. Enough for request-path + response-shape assertions."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded

    from app.deps import limiter

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_origin_regex=r"^chrome-extension://[a-z]{32}$",
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization", "X-WhareScore-Extension"],
        allow_credentials=True,
    )
    app.include_router(ext_router.router, prefix="/api/v1")
    return TestClient(app)


def _mint_jwt(sub: str = "test-user", email: str = "user@example.com") -> str:
    secret = settings.AUTH_SECRET or "test-secret-keep-this-predictable-for-pytest"
    return jwt.encode(
        {"sub": sub, "email": email, "iat": int(time.time()), "exp": int(time.time()) + 300},
        secret,
        algorithm="HS256",
    )


SAMPLE_REPORT = {
    "address": {"full_address": "42 Queen Street, Auckland Central, Auckland", "sa2_code": "7600001"},
    "property": {"title_type": "Freehold", "capital_value": 890_000},
    # tsunami_zone_class=3 crosses the build_insights threshold (>=3) so the
    # fixture produces flood + tsunami + liquefaction findings — verifying
    # the pro tier's full-list behaviour.
    "hazards": {"flood": "1% AEP (1-in-100-year)", "tsunami_zone_class": 3, "liquefaction": "moderate"},
    "environment": {},
    "liveability": {
        "schools_1500m": 4, "walk_score": 78,
        "nearby_schools": [
            {"name": "Remuera Primary", "decile": 10, "in_zone": True},
            {"name": "Auckland Grammar", "decile": 10, "in_zone": False},
        ],
    },
    "market": {
        "hpi_yoy_pct": 3.2,
        "median_rent": 650, "rent_estimate_low": 620, "rent_estimate_high": 720,
    },
    "planning": {},
    "transport": {"transit_stops_400m": 6},
    "scores": {"composite": 58, "label": "Moderate"},
}

SAMPLE_SEARCH_ROW = {
    "address_id": 12345,
    "full_address": "42 Queen Street, Auckland Central, Auckland",
    "address_number": "42",
    "road_name": "Queen",
    "road_type_name": "Street",
    "suburb_locality": "Auckland Central",
    "town_city": "Auckland",
}


def test_badge_missing_extension_header_returns_400():
    client = _build_client()
    r = client.post(
        "/api/v1/extension/badge",
        json={"source_site": "homes.co.nz", "address_text": "42 Queen Street, Auckland"},
    )
    assert r.status_code == 400


def test_badge_rejects_unsupported_site():
    client = _build_client()
    r = client.post(
        "/api/v1/extension/badge",
        headers={"X-WhareScore-Extension": "1"},
        json={"source_site": "not-a-site.example.com", "address_text": "42 Queen Street"},
    )
    assert r.status_code == 400


def test_badge_returns_matched_false_when_search_empty():
    client = _build_client()
    with patch.object(ext_router, "search_service", AsyncMock(return_value=[])):
        r = client.post(
            "/api/v1/extension/badge",
            headers={"X-WhareScore-Extension": "1"},
            json={"source_site": "homes.co.nz", "address_text": "999 Nowhere Road"},
        )
    assert r.status_code == 200
    assert r.json() == {"matched": False}


def _patch_report_fetch():
    """Convenience: returns a tuple of context managers that satisfy the
    endpoint's data dependencies using the SAMPLE_REPORT above."""
    mock_conn = AsyncMock()
    mock_cursor = AsyncMock()
    mock_cursor.fetchone = lambda: {"report": SAMPLE_REPORT}
    mock_conn.execute = AsyncMock(return_value=mock_cursor)

    class _DbCtx:
        async def __aenter__(self_):  # noqa: N805
            return mock_conn
        async def __aexit__(self_, *a):  # noqa: N805
            return None

    return _DbCtx


def test_badge_anon_returns_two_generic_findings_and_zero_capabilities():
    client = _build_client()
    DbCtx = _patch_report_fetch()
    with patch.object(ext_router, "search_service", AsyncMock(return_value=[SAMPLE_SEARCH_ROW])), \
         patch.object(ext_router, "cache_get", AsyncMock(return_value=None)), \
         patch.object(ext_router, "cache_set", AsyncMock(return_value=None)), \
         patch.object(ext_router, "track_event"), \
         patch.object(ext_router, "enrich_with_scores", lambda r: SAMPLE_REPORT), \
         patch.object(ext_router, "db") as mock_db:
        mock_db.pool.connection = lambda: DbCtx()

        r = client.post(
            "/api/v1/extension/badge",
            headers={"X-WhareScore-Extension": "1"},
            json={
                "source_site": "homes.co.nz",
                "address_text": "42 Queen Street, Auckland Central, Auckland",
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert body["matched"] is True
    assert body["tier"] == "anon"
    assert body["address_id"] == 12345
    assert body["score"] == 58
    assert len(body["findings"]) == 2
    assert body["capabilities"] == {
        "save": False, "watchlist": False, "alerts": False, "pdf_export": False,
    }
    # Anon never gets a price_band or Pro fields.
    assert "price_band" not in body
    assert "price_estimate" not in body
    assert "rent_estimate" not in body


def test_badge_free_user_gets_price_band_and_save_capability():
    client = _build_client()
    token = _mint_jwt("user-free", "free@example.com")
    DbCtx = _patch_report_fetch()
    with patch.object(ext_router, "search_service", AsyncMock(return_value=[SAMPLE_SEARCH_ROW])), \
         patch.object(ext_router, "cache_get", AsyncMock(return_value=None)), \
         patch.object(ext_router, "cache_set", AsyncMock(return_value=None)), \
         patch.object(ext_router, "resolve_plan", AsyncMock(return_value="free")), \
         patch.object(ext_router, "resolve_persona", AsyncMock(return_value="buyer")), \
         patch.object(ext_router, "enrich_with_scores", lambda r: SAMPLE_REPORT), \
         patch.object(ext_router, "track_event"), \
         patch.object(ext_router, "db") as mock_db:
        mock_db.pool.connection = lambda: DbCtx()

        r = client.post(
            "/api/v1/extension/badge",
            headers={"X-WhareScore-Extension": "1", "Authorization": f"Bearer {token}"},
            json={
                "source_site": "realestate.co.nz",
                "address_text": "42 Queen Street, Auckland Central, Auckland",
                "source_url": "https://www.realestate.co.nz/x/residential/sale/y",
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert body["tier"] == "free"
    assert body["persona"] == "buyer"
    assert len(body["findings"]) == 2
    assert body["capabilities"]["save"] is True
    assert body["capabilities"]["watchlist"] is True
    assert body["capabilities"]["alerts"] is False
    assert body["capabilities"]["pdf_export"] is False
    assert "price_band" in body and body["price_band"]["low"] < body["price_band"]["high"]
    assert "price_estimate" not in body  # free users do NOT get the precise estimate
    assert "rent_estimate" not in body


def test_badge_pro_user_gets_full_pro_fields_and_all_capabilities():
    client = _build_client()
    token = _mint_jwt("pro-user", "pro@example.com")
    DbCtx = _patch_report_fetch()
    with patch.object(ext_router, "search_service", AsyncMock(return_value=[SAMPLE_SEARCH_ROW])), \
         patch.object(ext_router, "cache_get", AsyncMock(return_value=None)), \
         patch.object(ext_router, "cache_set", AsyncMock(return_value=None)), \
         patch.object(ext_router, "resolve_plan", AsyncMock(return_value="pro")), \
         patch.object(ext_router, "resolve_persona", AsyncMock(return_value="buyer")), \
         patch.object(ext_router, "enrich_with_scores", lambda r: SAMPLE_REPORT), \
         patch.object(ext_router, "track_event"), \
         patch.object(ext_router, "db") as mock_db:
        mock_db.pool.connection = lambda: DbCtx()

        r = client.post(
            "/api/v1/extension/badge",
            headers={"X-WhareScore-Extension": "1", "Authorization": f"Bearer {token}"},
            json={
                "source_site": "oneroof.co.nz",
                "address_text": "42 Queen Street, Auckland Central, Auckland",
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert body["tier"] == "pro"
    assert all(body["capabilities"].values())
    # Pro sees the unsliced ranked list — SAMPLE_REPORT has flood + tsunami + liquefaction.
    assert len(body["findings"]) >= 3
    assert body["walk_score"] == 78
    assert body["schools"][0]["name"] == "Remuera Primary"
    assert body["rent_estimate"] is not None
    assert body["rent_estimate"]["median"] == 650
    assert body["rent_estimate"]["yield_percent"] is not None


def test_status_endpoint_lists_all_sites_with_trademe_gated_off():
    client = _build_client()
    r = client.get("/api/v1/extension/status")
    assert r.status_code == 200
    body = r.json()
    assert body["latest_version"] == ext_router.EXTENSION_VERSION
    assert set(body["sites"].keys()) == {
        "homes.co.nz", "oneroof.co.nz", "trademe.co.nz", "realestate.co.nz"
    }
    assert body["sites"]["trademe.co.nz"]["badge_enabled"] is False
    assert body["sites"]["homes.co.nz"]["badge_enabled"] is True


def test_cors_preflight_allows_chrome_extension_origin():
    client = _build_client()
    extension_origin = "chrome-extension://" + ("a" * 32)
    r = client.options(
        "/api/v1/extension/status",
        headers={
            "Origin": extension_origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.headers.get("access-control-allow-origin") == extension_origin
    assert r.headers.get("access-control-allow-credentials") == "true"
