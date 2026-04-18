"""
mint-dev-jwt.py — mint a short-lived JWT for the seeded verify dev user.

Used by:
  - /iterate's green-gate smoke tests (local)
  - /verify's capture script (drives Playwright as signed-in Pro user)
  - Prod smoke tests (SSH into prod, run via docker exec, get a prod-scoped token)

Usage:
  # Local
  TOKEN=$(python backend/scripts/mint-dev-jwt.py)

  # On prod (over SSH)
  TOKEN=$(ssh wharescore@20.5.86.126 docker exec app-backend-1 python scripts/mint-dev-jwt.py)

  curl -H "Authorization: Bearer $TOKEN" https://wharescore.com/api/v1/account/credits

Reads AUTH_SECRET from the same env the backend reads it from (via app.config).
Prints a JWT to stdout. Nothing else. No logs, no colour, no prompts — so shell
capture is clean.

Token claims:
  sub  = verify-dev-service-account  (the seeded user from 0053 migration)
  exp  = now + 1 hour
  iat  = now
  iss  = wharescore-verify-dev

The backend's verify_jwt() validates via AUTH_SECRET — no special code path.
To revoke: drop credits + plan via a new migration, or rotate AUTH_SECRET (which
would also invalidate every real user's token — do not do this casually).
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path


DEV_USER_ID = "verify-dev-service-account"
TTL_SECONDS = 3600  # 1 hour


def _load_auth_secret() -> str:
    """Read AUTH_SECRET using the same resolution order the backend uses."""
    # 1. Already in env
    secret = os.environ.get("AUTH_SECRET")
    if secret:
        return secret

    # 2. Try loading app.config (this is how the backend resolves it in normal operation)
    try:
        repo_root = Path(__file__).resolve().parents[1]
        sys.path.insert(0, str(repo_root))
        from app.config import settings  # type: ignore

        secret = getattr(settings, "AUTH_SECRET", None) or getattr(settings, "auth_secret", None)
        if secret:
            return str(secret)
    except Exception:
        pass

    # 3. Fall back to .env / .env.local at repo root
    for envfile in (".env.local", ".env"):
        path = Path(__file__).resolve().parents[2] / envfile
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                if line.startswith("AUTH_SECRET="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")

    print(
        "ERROR: AUTH_SECRET not found in env, app.config, or .env files.",
        file=sys.stderr,
    )
    sys.exit(2)


def _mint(secret: str) -> str:
    try:
        import jwt  # type: ignore  # PyJWT
    except ImportError:
        print(
            "ERROR: PyJWT not installed. Run: pip install PyJWT",
            file=sys.stderr,
        )
        sys.exit(3)

    now = int(time.time())
    payload = {
        "sub": DEV_USER_ID,
        "iat": now,
        "exp": now + TTL_SECONDS,
        "iss": "wharescore-verify-dev",
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    # PyJWT >= 2 returns str; older returns bytes
    if isinstance(token, bytes):
        token = token.decode("ascii")
    return token


def main() -> int:
    secret = _load_auth_secret()
    print(_mint(secret))
    return 0


if __name__ == "__main__":
    sys.exit(main())
