# backend/app/middleware/request_metrics.py
"""Middleware that adds request IDs and records per-request performance metrics."""
from __future__ import annotations

import time
import uuid

from fastapi import Request

from ..services.event_writer import write_perf_metric

# Paths to skip — high-frequency or not useful
_SKIP_PATHS = frozenset({"/health", "/openapi.json", "/docs", "/favicon.ico"})


async def request_metrics_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    response.headers["X-Request-ID"] = request_id

    path = request.url.path
    if path in _SKIP_PATHS or path.startswith("/_next"):
        return response

    # Extract path template from matched route for grouping
    path_template = None
    route = request.scope.get("route")
    if route and hasattr(route, "path"):
        path_template = route.path

    # Get user_id if auth middleware set it
    user_id = getattr(request.state, "user_id", None)

    # Get client IP
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or (request.client.host if request.client else None)
    )

    write_perf_metric(
        method=request.method,
        path=path[:500],
        path_template=path_template,
        status_code=response.status_code,
        duration_ms=duration_ms,
        user_id=user_id,
        ip=ip,
        request_id=request_id,
    )

    return response
