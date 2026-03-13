"""
PDF generation job management.
Uses Redis for job state so it works across multiple Uvicorn workers.
"""
from __future__ import annotations

import json
import uuid
import logging
from typing import Optional, Dict, Any

from .. import redis as redis_mod

logger = logging.getLogger(__name__)

# Job states
STATE_PENDING = "pending"
STATE_GENERATING = "generating"
STATE_COMPLETED = "completed"
STATE_FAILED = "failed"

# Redis key prefix and TTL
_PREFIX = "pdf_job:"
_TTL = 3600  # 1 hour


def _key(job_id: str) -> str:
    return f"{_PREFIX}{job_id}"


def _client():
    """Get the current Redis client (set after init_redis runs)."""
    return redis_mod.redis_client


async def create_job(address_id: int) -> str:
    """Create a new PDF generation job and return its ID."""
    job_id = str(uuid.uuid4())
    job_data = {
        "id": job_id,
        "address_id": address_id,
        "status": STATE_PENDING,
        "error": None,
    }
    client = _client()
    if client:
        try:
            await client.set(_key(job_id), json.dumps(job_data), ex=_TTL)
        except Exception as e:
            logger.warning(f"Redis write failed for PDF job: {e}")
    logger.info(f"Created PDF job {job_id} for address {address_id}")
    return job_id


async def _get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get raw job data from Redis."""
    client = _client()
    if not client:
        return None
    try:
        raw = await client.get(_key(job_id))
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return None


async def _set_job(job_id: str, data: Dict[str, Any]) -> bool:
    """Write job data to Redis."""
    client = _client()
    if not client:
        return False
    try:
        await client.set(_key(job_id), json.dumps(data), ex=_TTL)
        return True
    except Exception:
        return False


async def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    """Get the current status of a PDF job."""
    job = await _get_job(job_id)
    if not job:
        return None
    return {
        "job_id": job["id"],
        "address_id": job["address_id"],
        "status": job["status"],
        "error": job.get("error"),
    }


async def set_job_generating(job_id: str) -> bool:
    """Mark a job as currently generating."""
    job = await _get_job(job_id)
    if not job:
        return False
    job["status"] = STATE_GENERATING
    return await _set_job(job_id, job)


async def set_job_completed(job_id: str, html: str) -> bool:
    """Mark a job as completed with the generated HTML."""
    job = await _get_job(job_id)
    if not job:
        return False
    job["status"] = STATE_COMPLETED
    logger.info(f"PDF job {job_id} completed")
    client = _client()
    if client:
        try:
            await client.set(f"{_key(job_id)}:html", html, ex=_TTL)
        except Exception as e:
            logger.warning(f"Redis write failed for PDF HTML: {e}")
            return False
    return await _set_job(job_id, job)


async def set_job_failed(job_id: str, error: str) -> bool:
    """Mark a job as failed with an error message."""
    job = await _get_job(job_id)
    if not job:
        return False
    job["status"] = STATE_FAILED
    job["error"] = error
    logger.warning(f"PDF job {job_id} failed: {error}")
    return await _set_job(job_id, job)


async def get_job_html(job_id: str) -> Optional[str]:
    """Get the generated HTML for a completed job."""
    job = await _get_job(job_id)
    if not job or job["status"] != STATE_COMPLETED:
        return None
    client = _client()
    if not client:
        return None
    try:
        return await client.get(f"{_key(job_id)}:html")
    except Exception:
        return None
