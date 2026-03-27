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

RUN addgroup --gid 1000 appuser && adduser --disabled-password --uid 1000 --ingroup appuser appuser
USER appuser

EXPOSE 8000

# uvicorn directly — no Windows event loop hack needed in Linux
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
