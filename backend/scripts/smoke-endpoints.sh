#!/usr/bin/env bash
# smoke-endpoints.sh — hit load-bearing endpoints, validate shapes.
#
# Used by green-gate.sh locally and as a prod sanity check after deploy.
#
# Usage:
#   backend/scripts/smoke-endpoints.sh --env=local
#   backend/scripts/smoke-endpoints.sh --env=prod
#
# Behaviour:
#   - Mints a dev JWT via mint-dev-jwt.py (locally from AUTH_SECRET, or over SSH for prod)
#   - Hits six load-bearing endpoints
#   - Validates each response has the expected top-level keys
#   - Fails loud on first mismatch
#
# Exit: 0 all green, 1 any failed

set -u
set -o pipefail

ENV="local"
for arg in "$@"; do
    case "$arg" in
        --env=*) ENV="${arg#--env=}" ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$ENV" in
    local)
        BASE="http://localhost:8000"
        TOKEN="$(python "$REPO_ROOT/scripts/mint-dev-jwt.py")" || { echo "failed to mint local JWT" >&2; exit 1; }
        ;;
    prod)
        BASE="https://wharescore.com"
        # Service name is "api" (not "backend"); compose project dir on prod assumed /home/wharescore/app.
        TOKEN="$(ssh wharescore@20.5.86.126 'cd /home/wharescore/app && docker compose -f docker-compose.prod.yml exec -T api python scripts/mint-dev-jwt.py' 2>/dev/null)" \
            || { echo "failed to mint prod JWT over SSH (check /home/wharescore/app path + docker compose exec -T api)" >&2; exit 1; }
        ;;
    *)
        echo "unknown --env value: $ENV (expected: local, prod)" >&2
        exit 1
        ;;
esac

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
NC=$'\033[0m'

fail=0
try() {
    local label="$1" method="$2" path="$3" expect_keys="$4"
    local url="$BASE$path"
    local body
    body="$(curl -sS -X "$method" -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" "$url" 2>&1)" \
        || { echo "${RED}✗${NC} $label — curl error: $body"; fail=1; return; }

    for key in $expect_keys; do
        if ! echo "$body" | python -c "import json,sys; d=json.loads(sys.stdin.read()); sys.exit(0 if '$key' in d else 1)" 2>/dev/null; then
            echo "${RED}✗${NC} $label — missing key '$key' in response"
            echo "  body: $(echo "$body" | head -c 200)"
            fail=1
            return
        fi
    done
    echo "${GREEN}✓${NC} $label ($method $path)"
}

# TODO: replace fixture IDs with known-good address_id + share_token for each env.
# For local: seed a known property via migration or fixture script.
# For prod: use a stable, public property address_id (pick one that won't be deleted).
FIXTURE_ADDRESS_ID="${FIXTURE_ADDRESS_ID:-1}"
FIXTURE_SHARE_TOKEN="${FIXTURE_SHARE_TOKEN:-}"

try "health"              GET  "/health"                                           ""
try "report"              GET  "/api/v1/property/$FIXTURE_ADDRESS_ID/report"       "score hazards liveability"
try "rates"               GET  "/api/v1/property/$FIXTURE_ADDRESS_ID/rates"        "cv"
try "search"              GET  "/api/v1/search/address?q=queen+street&limit=3"     "results"
try "account credits"     GET  "/api/v1/account/credits"                           "plan"

if [[ -n "$FIXTURE_SHARE_TOKEN" ]]; then
    try "hosted report"   GET  "/api/v1/reports/$FIXTURE_SHARE_TOKEN"              "snapshot"
fi

if (( fail )); then
    echo ""
    echo "${RED}═══ smoke failed — do not proceed ═══${NC}"
    exit 1
fi

echo ""
echo "${GREEN}═══ smoke passed ($ENV) ═══${NC}"
