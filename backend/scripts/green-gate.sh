#!/usr/bin/env bash
# green-gate.sh — local pre-push gate.
#
# Runs every cheap safety check in sequence. Fails loud on the first red.
# Used by /iterate before git push, but can also be run manually:
#
#   backend/scripts/green-gate.sh
#
# Exit codes:
#   0 — all green, safe to push
#   1 — a step failed; stdout/stderr explains which
#
# Steps (in order; fast checks first):
#   1. Backend Python syntax + import check
#   2. pytest (if tests exist)
#   3. Frontend typecheck (tsc --noEmit)
#   4. Frontend build (next build)
#   5. Docker compose build (smoke only — does not start)
#   6. Local stack up (docker compose --profile dev up -d)
#   7. Smoke endpoints (smoke-endpoints.sh --env=local)
#   8. Optional: /verify re-run if --verify flag passed (latest criteria in docs/criteria/)
#
# Assumes you have AUTH_SECRET set for step 7 (minted JWT depends on it).
# Local DB + Redis must be running via docker compose.

set -u
set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

step() { echo "${YELLOW}▶ $*${NC}"; }
pass() { echo "${GREEN}✓ $*${NC}"; }
fail() { echo "${RED}✗ $*${NC}" >&2; exit 1; }

RUN_VERIFY=false
for arg in "$@"; do
    [[ "$arg" == "--verify" ]] && RUN_VERIFY=true
done

# ---- 1. Backend Python imports ----
step "backend: python import check"
if [[ -d app ]]; then
    python -c "import app.main" 2>&1 | tee /tmp/green-gate-import.log
    grep -q "Error\|Traceback" /tmp/green-gate-import.log && fail "backend import broke"
    pass "backend imports clean"
else
    echo "  (skipped — no app/ in cwd)"
fi

# ---- 2. Backend tests ----
step "backend: pytest"
if [[ -d tests ]] || [[ -d app/tests ]]; then
    python -m pytest -q --tb=short 2>&1 | tail -30
    # shellcheck disable=SC2181
    [[ ${PIPESTATUS[0]} -ne 0 ]] && fail "pytest failed"
    pass "pytest green"
else
    echo "  (skipped — no tests/ dir)"
fi

# ---- 3. Frontend typecheck ----
step "frontend: typecheck"
if [[ -d ../frontend ]]; then
    (cd ../frontend && npx tsc --noEmit 2>&1 | tail -20)
    [[ ${PIPESTATUS[0]} -ne 0 ]] && fail "frontend tsc errors"
    pass "frontend types clean"
else
    echo "  (skipped — no ../frontend/)"
fi

# ---- 4. Frontend build ----
step "frontend: build"
if [[ -d ../frontend ]]; then
    (cd ../frontend && npm run build --silent 2>&1 | tail -10)
    [[ ${PIPESTATUS[0]} -ne 0 ]] && fail "next build failed"
    pass "frontend built"
fi

# ---- 5. Docker build (no run) ----
step "docker: build (no-run)"
if [[ -f ../docker-compose.yml ]]; then
    (cd .. && docker compose --profile dev build --quiet 2>&1 | tail -10)
    [[ ${PIPESTATUS[0]} -ne 0 ]] && fail "docker compose build failed"
    pass "docker images build"
else
    echo "  (skipped — no ../docker-compose.yml)"
fi

# ---- 6. Local stack up ----
step "docker: up (local stack)"
if [[ -f ../docker-compose.yml ]]; then
    (cd .. && docker compose --profile dev up -d 2>&1 | tail -10)
    [[ ${PIPESTATUS[0]} -ne 0 ]] && fail "docker compose up failed"
    # Wait briefly for backend to be ready
    for i in 1 2 3 4 5 6 7 8 9 10; do
        if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
            pass "backend healthy"
            break
        fi
        [[ $i -eq 10 ]] && fail "backend never became healthy on localhost:8000"
        sleep 3
    done
fi

# ---- 7. Smoke endpoints ----
step "smoke: endpoints"
if [[ -x "$REPO_ROOT/scripts/smoke-endpoints.sh" ]]; then
    "$REPO_ROOT/scripts/smoke-endpoints.sh" --env=local || fail "smoke endpoints failed"
    pass "smoke endpoints OK"
else
    echo "  (skipped — smoke-endpoints.sh not executable)"
fi

# ---- 8. /verify spot-check (only if --verify passed) ----
if $RUN_VERIFY; then
    step "verify: re-run latest criteria"
    latest="$(ls -t ../docs/criteria/*.md 2>/dev/null | head -1)"
    if [[ -n "$latest" ]]; then
        echo "  (manual step — run \`/verify $latest\` in Claude Code, then confirm 0 CRITICAL/WARNING)"
    else
        echo "  (no criteria files found in docs/criteria/)"
    fi
fi

echo ""
echo "${GREEN}═══ green gate passed ═══${NC}"
