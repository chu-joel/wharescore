from __future__ import annotations

# backend/app/schemas/email_signups.py
from pydantic import BaseModel, EmailStr, Field


class EmailSignupSubmit(BaseModel):
    email: EmailStr
    requested_region: str | None = Field(None, max_length=100)
    website: str | None = Field(None, exclude=True)  # honeypot
