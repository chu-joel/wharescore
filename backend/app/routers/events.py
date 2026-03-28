# backend/app/routers/events.py
"""Frontend event ingestion endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import Response
from pydantic import BaseModel

from ..deps import limiter
from ..services.event_writer import track_event

router = APIRouter(tags=["events"])

ALLOWED_EVENT_TYPES = frozenset([
    "page_view", "search", "report_view", "report_section_viewed",
    "upgrade_modal_shown", "upgrade_modal_dismissed",
    "payment_started", "download_started",
    "share_report_clicked", "compare_upsell_shown",
])


class EventPayload(BaseModel):
    event_type: str
    session_id: str | None = None
    properties: dict | None = None


@router.post("/events", response_class=Response)
@limiter.limit("60/minute")
async def ingest_event(request: Request, payload: EventPayload):
    if payload.event_type not in ALLOWED_EVENT_TYPES:
        return Response(status_code=204)

    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or (request.client.host if request.client else None)
    )

    track_event(
        payload.event_type,
        session_id=payload.session_id,
        ip=ip,
        properties=payload.properties,
    )
    return Response(status_code=204)
