"""Shared pytest fixtures. Keeps every test module DB-free by default —
each test that needs DB / Redis / search patches the module locally."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Make `app.*` importable from the repo root whichever dir pytest is invoked from.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

# AUTH_SECRET must be present for verify_jwt() to not raise at import. Deliberately
# only set when missing so locally-configured dev secrets keep working.
os.environ.setdefault("AUTH_SECRET", "test-secret-keep-this-predictable-for-pytest")
os.environ.setdefault("ENVIRONMENT", "development")
