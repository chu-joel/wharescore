# backend/app/routers/email_signups.py
from __future__ import annotations
from fastapi import APIRouter, Request

from .. import db
from ..deps import limiter
from ..schemas.email_signups import EmailSignupSubmit

router = APIRouter()


@router.post("/email-signups", status_code=201)
@limiter.limit("3/hour")
async def email_signup(request: Request, body: EmailSignupSubmit):
    """Sign up for email updates when a region becomes available."""
    if body.website:
        return {"status": "subscribed"}

    async with db.pool.connection() as conn:
        # Check for existing signup
        cur = await conn.execute(
            "SELECT id FROM email_signups WHERE email = %s", [body.email]
        )
        if cur.fetchone():
            return {"status": "already_subscribed"}

        await conn.execute(
            "INSERT INTO email_signups (email, requested_region) VALUES (%s, %s)",
            [body.email, body.requested_region],
        )
        await conn.commit()

    return {"status": "subscribed"}
