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

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
