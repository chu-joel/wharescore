from __future__ import annotations

# backend/app/schemas/feedback.py
from pydantic import BaseModel, EmailStr, Field


class FeedbackSubmit(BaseModel):
    type: str = Field(pattern=r"^(bug|feature|general)$")
    description: str = Field(min_length=10, max_length=5000)
    context: str | None = Field(None, max_length=1000)
    page_url: str | None = Field(None, max_length=500)
    property_address: str | None = Field(None, max_length=500)
    importance: str | None = Field(None, pattern=r"^(low|medium|high|critical)$")
    satisfaction: int | None = Field(None, ge=1, le=5)
    email: EmailStr | None = Field(None)
    browser_info: dict | None = None
    website: str | None = Field(None, exclude=True)  # honeypot
