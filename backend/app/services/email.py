# backend/app/services/email.py
"""Email sending via Brevo (ex-Sendinblue). Free tier: 300/day.

Usage:
    from ..services.email import send_email, send_report_ready_email
    send_email("user@example.com", "Subject", "<h1>HTML body</h1>")
    send_report_ready_email("user@example.com", "123 Main St", "abc123token", "buyer", "https://wharescore.co.nz")
"""
from __future__ import annotations

import logging

from ..config import settings

logger = logging.getLogger(__name__)


REPLY_TO = {"name": "WhareScore", "email": "wharescore@gmail.com"}


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
            reply_to=REPLY_TO,
            subject=subject,
            html_content=html,
        )
        api.send_transac_email(email)
        logger.info(f"Email sent to {to[:3]}***")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to[:3]}***: {e}")
        return False


def send_report_ready_email(
    to: str,
    address: str,
    share_token: str,
    persona: str,
    frontend_url: str,
) -> bool:
    """Send a 'your report is ready' email with a link to the hosted report."""
    report_url = f"{frontend_url}/report/{share_token}"
    persona_label = "Renter" if persona == "renter" else "Buyer"
    html = f"""
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <div style="background: #1a56db; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Your WhareScore report is ready</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 28px 32px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 8px; font-size: 15px; color: #374151;">
          Your <strong>{persona_label}</strong> report for
        </p>
        <p style="margin: 0 0 24px; font-size: 18px; font-weight: 600;">{address}</p>
        <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">
          Your full interactive report is ready to view. It includes your risk score,
          hazard analysis, {" rent advisor," if persona == "renter" else " price advisor,"}
          transport, planning, and neighbourhood insights.
        </p>
        <a href="{report_url}"
           style="display: inline-block; background: #1a56db; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          View Report
        </a>
        <p style="margin: 28px 0 0; font-size: 12px; color: #9ca3af;">
          This report reflects data at the time of generation. The link will remain accessible.
          If you did not request this report, you can ignore this email.
        </p>
      </div>
    </div>
    """
    return send_email(to, f"Your WhareScore report: {address}", html)
