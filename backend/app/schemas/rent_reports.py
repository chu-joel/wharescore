from __future__ import annotations

# backend/app/schemas/rent_reports.py
from pydantic import BaseModel, Field


class RentReportSubmit(BaseModel):
    address_id: int
    dwelling_type: str = Field(pattern=r"^(House|Flat|Apartment|Room)$")
    bedrooms: str = Field(pattern=r"^(1|2|3|4|5\+)$")
    reported_rent: int = Field(ge=50, le=5000)
    website: str | None = Field(None, exclude=True)  # honeypot — must be empty


class RentReportResponse(BaseModel):
    building_address: str
    report_count: int
    median_rent: float | None
    reports: list[dict]
