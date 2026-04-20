FROM python:3.13-slim

WORKDIR /app

# System deps for psycopg binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY migrations/ migrations/
COPY scripts/ scripts/

RUN addgroup --gid 1000 appuser && adduser --disabled-password --uid 1000 --ingroup appuser appuser
USER appuser

EXPOSE 8000

# uvicorn directly. --proxy-headers + --forwarded-allow-ips * is
# required so slowapi (and anything else reading the client IP) sees
# the real X-Forwarded-For value from host nginx. Without these, every
# request looks like it came from the Docker bridge gateway and ALL
# users share a single rate-limit bucket. Trusting * is safe here
# because compose binds :8000 to 127.0.0.1 only, so the api is
# unreachable from the internet and only host nginx (on the same VM)
# can forward to it.
CMD ["uvicorn", "app.main:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--workers", "4", \
    "--no-server-header", \
    "--proxy-headers", \
    "--forwarded-allow-ips", "*"]
