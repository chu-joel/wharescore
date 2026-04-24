from __future__ import annotations

# backend/app/schemas/rent_reports.py
from pydantic import BaseModel, Field


class RentReportSubmit(BaseModel):
    # Required core fields (unchanged for backward compat).
    address_id: int
    dwelling_type: str = Field(pattern=r"^(House|Flat|Apartment|Room)$")
    bedrooms: str = Field(pattern=r"^(1|2|3|4|5\+)$")
    reported_rent: int = Field(ge=50, le=5000)
    # Honeypot — must be empty.
    website: str | None = Field(None, exclude=True)

    # Richer details from RentAdvisorCard (migration 0059). All optional so
    # RentComparisonFlow's thinner body still validates.
    bathrooms: str | None = Field(None, pattern=r"^(1|2|3\+)$")
    finish_tier: str | None = Field(None, pattern=r"^(basic|standard|modern|premium|luxury)$")
    has_parking: bool | None = None
    is_furnished: bool | None = None
    is_partially_furnished: bool | None = None
    has_outdoor_space: bool | None = None
    is_character_property: bool | None = None
    shared_kitchen: bool | None = None
    utilities_included: bool | None = None
    not_insulated: bool | None = None

    # Where the submission came from (rent_comparison_flow / rent_advisor_card / etc)
    # and which privacy-notice version the user saw. Both optional — absence is fine.
    source_context: str | None = Field(None, max_length=40)
    notice_version: str | None = Field(None, max_length=20)


class RentReportResponse(BaseModel):
    building_address: str
    report_count: int
    median_rent: float | None
    reports: list[dict]
