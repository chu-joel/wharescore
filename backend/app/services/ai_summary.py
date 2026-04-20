# backend/app/services/ai_summary.py
"""
Real-time AI property summary using Azure OpenAI.
Called after scores are computed, before caching.
"""

from __future__ import annotations

import json
import logging

from openai import AsyncAzureOpenAI

from ..config import settings

logger = logging.getLogger(__name__)

# Initialize Azure OpenAI client (async)
_client: AsyncAzureOpenAI | None = None


def _get_client() -> AsyncAzureOpenAI | None:
    """Lazy-init Azure OpenAI client. Returns None if not configured."""
    global _client
    if _client is not None:
        return _client
    if not settings.AZURE_OPENAI_API_KEY or not settings.AZURE_OPENAI_ENDPOINT:
        return None
    _client = AsyncAzureOpenAI(
        api_key=settings.AZURE_OPENAI_API_KEY,
        azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
        api_version="2024-12-01-preview",
    )
    return _client


SUMMARY_SYSTEM_PROMPT = """You are WhareScore's AI analyst for New Zealand properties.
Given a property data report, write 2-3 short sentences highlighting what matters most.

Pick the 1-2 biggest positives and 1-2 biggest risks from the data. Be specific with
numbers. End with a one-line market verdict (fair/overpriced/good value).

Keep it punchy. like a text message from a property-savvy friend, not a report.
Do NOT repeat the suburb description. Output ONLY the summary text."""


async def generate_property_summary(
    report: dict, area_profile: str | None
) -> str | None:
    """Generate AI summary for a property report.
    Returns summary text or None on failure."""
    client = _get_client()
    if not client:
        return None

    user_content = ""
    if area_profile:
        user_content += f"Area profile:\n{area_profile}\n\n"
    user_content += f"Property report data:\n{json.dumps(report, indent=2, default=str)}"

    try:
        response = await client.chat.completions.create(
            model=settings.AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_completion_tokens=2000,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.warning(f"AI summary generation failed: {e}")
        return None


# =============================================================================
# PDF Report AI Insights
# =============================================================================

PDF_REPORT_SYSTEM_PROMPT = """You are WhareScore's senior property analyst for New Zealand.
You are generating content for a premium property intelligence report that a buyer or
renter will pay for. This is a full analytical report, not a summary.

You receive: (1) area profile text, (2) full property report data, (3) pre-computed
insight flags from our rules engine showing what thresholds have been triggered.

Your job is ADDITIONAL depth and narrative connecting findings across sections.
Do NOT repeat what the rules engine already flags. add context, NZ-specific knowledge,
and nuanced judgement that data alone cannot provide.

Output ONLY this JSON (no markdown, no commentary):
{
  "executive_summary": "3-5 sentences. Lead with the single most important finding. Include composite score context and a clear recommendation.",
  "hazards_narrative": "2-3 sentences synthesising hazard combination. Is it typical for this suburb or unusual? Are hazards correlated?",
  "environment_narrative": "2-3 sentences. Contextualise noise/air/water vs Wellington norms. Be honest about genuine issues.",
  "liveability_narrative": "2-4 sentences weaving crime, schools, transit, amenities into what daily life is actually like here. Name trade-offs explicitly.",
  "market_narrative": "2-3 sentences. Trending up or cooling? What does rental yield suggest for investors vs renters? Fair value?",
  "planning_narrative": "2 sentences. What does the planning environment mean in practice? Will this area intensify?",
  "key_questions": ["3-5 specific questions a buyer or renter should ask. NZ-specific (LIM, builder's report, geotechnical, body corporate minutes if multi-unit)."],
  "bottom_line": "One sentence plain verdict. No hedging."
}

Rules:
- Specific numbers from data only. never vague
- NZ context, not global averages
- If multi-unit: include body corporate / strata considerations in key_questions
- Do NOT fabricate facts not in the data
- Under 600 tokens total output"""


async def generate_pdf_insights(
    report: dict,
    area_profile: str | None,
    python_insights: dict,
) -> dict | None:
    """Generate AI narrative sections for the PDF report.
    Returns parsed JSON dict or None on failure."""
    client = _get_client()
    if not client:
        return None

    user_content = ""
    if area_profile:
        user_content += f"Area profile:\n{area_profile}\n\n"

    user_content += f"Property report data:\n{json.dumps(report, indent=2, default=str)}\n\n"
    user_content += f"Pre-computed insight flags:\n{json.dumps(python_insights, indent=2, default=str)}"

    try:
        response = await client.chat.completions.create(
            model=settings.AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": PDF_REPORT_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_completion_tokens=1500,
        )
        raw = response.choices[0].message.content
        if raw:
            return json.loads(raw)
        return None
    except json.JSONDecodeError as e:
        logger.warning(f"PDF insights JSON parse failed: {e}")
        return None
    except Exception as e:
        logger.warning(f"PDF insights generation failed: {e}")
        return None
