# backend/app/routers/auth_otp.py
"""Email OTP (magic code) authentication.

Flow:
  1. POST /auth/send-code {email} → generates 6-digit code, stores in Redis, sends via Resend
  2. POST /auth/verify-code {email, code} → verifies code, returns user info for NextAuth Credentials provider
  3. NextAuth issues JWT. same session flow as Google auth
"""
from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

from ..config import settings
from ..deps import limiter
from ..redis import cache_get, cache_set, cache_del

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class SendCodeRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


def _otp_key(email: str) -> str:
    return f"otp:{email.lower().strip()}"


def _otp_attempts_key(email: str) -> str:
    return f"otp_attempts:{email.lower().strip()}"


@router.post("/send-code")
@limiter.limit("5/minute")
@limiter.limit("10/hour")
async def send_code(request: Request, body: SendCodeRequest):
    """Generate a 6-digit OTP, store in Redis (5 min TTL), send via Resend."""
    email = body.email.lower().strip()

    # Generate 6-digit code
    code = f"{secrets.randbelow(900000) + 100000}"

    # Store in Redis with 5-minute TTL
    await cache_set(_otp_key(email), code, ex=300)
    # Reset attempt counter
    await cache_del(_otp_attempts_key(email))

    # Send via Brevo
    from ..services.email import send_email

    sent = send_email(
        email,
        f"WhareScore sign-in code: {code}",
        f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0f172a; margin-bottom: 8px;">Sign in to WhareScore</h2>
            <p style="color: #64748b; margin-bottom: 24px;">Enter this code to sign in:</p>
            <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">{code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
        """,
    )
    if not sent and settings.BREVO_API_KEY:
        raise HTTPException(500, "Failed to send verification email")

    return {"ok": True, "message": "Code sent to your email"}


@router.post("/verify-code")
@limiter.limit("10/minute")
async def verify_code(request: Request, body: VerifyCodeRequest):
    """Verify the 6-digit OTP. Returns user info for NextAuth Credentials provider."""
    email = body.email.lower().strip()
    code = body.code.strip()

    if not code or len(code) != 6:
        raise HTTPException(400, "Invalid code format")

    # Check attempt limit (max 5 attempts per code)
    attempts_key = _otp_attempts_key(email)
    attempts = await cache_get(attempts_key)
    if attempts and int(attempts) >= 5:
        await cache_del(_otp_key(email))  # Invalidate the code
        raise HTTPException(429, "Too many attempts. Request a new code.")

    # Increment attempts
    from ..redis import cache_incr
    await cache_incr(attempts_key, expire=300)

    # Verify code
    stored_code = await cache_get(_otp_key(email))
    if not stored_code:
        raise HTTPException(400, "Code expired. Request a new one.")

    if stored_code != code:
        raise HTTPException(400, "Incorrect code")

    # Code is valid. clean up
    await cache_del(_otp_key(email))
    await cache_del(attempts_key)

    # Return user info for NextAuth to create a JWT
    # Use email as the stable user ID (prefixed to distinguish from Google IDs)
    user_id = f"email:{email}"

    return {
        "id": user_id,
        "email": email,
        "name": email.split("@")[0],  # Default display name from email
    }
