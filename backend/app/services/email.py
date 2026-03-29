# backend/app/services/email.py
"""Email sending via Brevo (ex-Sendinblue). Free tier: 300/day.

Usage:
    from ..services.email import send_email
    await send_email("user@example.com", "Subject", "<h1>HTML body</h1>")
"""
from __future__ import annotations

import logging

from ..config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email via Brevo. Returns True on success."""
    if not settings.BREVO_API_KEY:
        logger.info(f"[DEV] Email to {to}: {subject}")
        return True

    try:
        import sib_api_v3_sdk

        config = sib_api_v3_sdk.Configuration()
        config.api_key["api-key"] = settings.BREVO_API_KEY
        api = sib_api_v3_sdk.TransactionalEmailsApi(
            sib_api_v3_sdk.ApiClient(config)
        )

        email = sib_api_v3_sdk.SendSmtpEmail(
            sender={"name": settings.EMAIL_FROM_NAME, "email": settings.EMAIL_FROM_ADDRESS},
            to=[{"email": to}],
            subject=subject,
            html_content=html,
        )
        api.send_transac_email(email)
        logger.info(f"Email sent to {to[:3]}***")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to[:3]}***: {e}")
        return False
