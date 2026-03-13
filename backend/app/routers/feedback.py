# backend/app/routers/feedback.py
from __future__ import annotations
import orjson
from fastapi import APIRouter, Request

from .. import db
from ..deps import limiter
from ..schemas.feedback import FeedbackSubmit

router = APIRouter()


@router.post("/feedback", status_code=201)
@limiter.limit("5/hour")
async def submit_feedback(request: Request, body: FeedbackSubmit):
    """Submit user feedback (bug report, feature request, general)."""
    if body.website:
        return {"status": "submitted"}

    async with db.pool.connection() as conn:
        await conn.execute(
            """
            INSERT INTO feedback
                (type, description, context, page_url, property_address,
                 importance, satisfaction, email, browser_info)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            [
                body.type, body.description, body.context, body.page_url,
                body.property_address, body.importance, body.satisfaction,
                body.email,
                orjson.dumps(body.browser_info).decode() if body.browser_info else None,
            ],
        )
        await conn.commit()

    return {"status": "submitted"}
