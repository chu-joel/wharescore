# backend/app/config.py
from __future__ import annotations
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/wharescore"
    REDIS_URL: str = "redis://localhost:6379/0"
    MBIE_API_KEY: str = ""
    LINZ_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-5-mini"
    MAPBOX_ACCESS_TOKEN: str = ""
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]
    ADMIN_PASSWORD_HASH: str = ""
    ENVIRONMENT: str = "development"  # "production" enables HSTS, bot UA blocking

    # Auth.js shared secret (same value as frontend AUTH_SECRET)
    AUTH_SECRET: str = ""

    # Stripe payments
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_SINGLE: str = ""  # price_xxx for $4.99 single report
    STRIPE_PRICE_PACK3: str = ""   # price_xxx for $9.99 3-pack
    STRIPE_PRICE_PRO: str = ""     # price_xxx for $49/mo pro

    FRONTEND_URL: str = "http://localhost:3000"

    # Valhalla routing engine (walking isochrones + elevation)
    VALHALLA_URL: str = "http://valhalla:8002"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    def validate_secrets(self):
        """Warn if secrets missing in production. Only ADMIN_PASSWORD_HASH is fatal."""
        if self.ENVIRONMENT == "production":
            # Fatal — admin panel won't work without this
            if not self.ADMIN_PASSWORD_HASH:
                raise RuntimeError("Missing required secret: ADMIN_PASSWORD_HASH")

            # Warn-only — features degrade gracefully without these
            optional = {
                "AUTH_SECRET": self.AUTH_SECRET,
                "STRIPE_SECRET_KEY": self.STRIPE_SECRET_KEY,
                "STRIPE_WEBHOOK_SECRET": self.STRIPE_WEBHOOK_SECRET,
            }
            missing = [k for k, v in optional.items() if not v]
            if missing:
                import logging
                logging.getLogger(__name__).warning(f"Optional secrets not set (features disabled): {', '.join(missing)}")

            if "sslmode=" not in self.DATABASE_URL:
                raise RuntimeError("DATABASE_URL must include sslmode= parameter in production")


settings = Settings()
