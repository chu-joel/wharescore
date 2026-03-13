# backend/app/services/abuse_logger.py
from __future__ import annotations
import logging

from fastapi import Request

abuse_logger = logging.getLogger("abuse")


def log_rate_limit(request: Request, endpoint: str):
    abuse_logger.warning("rate_limit_hit", extra={
        "ip": request.client.host,
        "endpoint": endpoint,
        "ua": request.headers.get("user-agent", "")[:200],
    })


def log_bot_block(request: Request, reason: str):
    abuse_logger.warning("bot_blocked", extra={
        "ip": request.client.host,
        "reason": reason,
        "ua": request.headers.get("user-agent", "")[:200],
    })


def log_scraping_pattern(request: Request, count: int):
    abuse_logger.warning("scraping_detected", extra={
        "ip": request.client.host,
        "unique_properties_10min": count,
    })


def log_admin_login(request: Request, success: bool):
    abuse_logger.info("admin_login", extra={
        "ip": request.client.host,
        "success": success,
    })
