#!/usr/bin/env bash
# wait-for-deploy.sh — block until the GitHub Actions deploy for the current HEAD finishes.
#
# Called by /iterate after `git push origin main` and before any prod op.
# Uses `gh` CLI to poll the latest run on main until completed.
#
# Usage:
#   backend/scripts/wait-for-deploy.sh
#   backend/scripts/wait-for-deploy.sh --timeout=600   # default 600s (10 min)
#
# Exit:
#   0 — deploy completed successfully (conclusion: success)
#   1 — deploy completed but failed (conclusion: failure/cancelled/etc.) — prints run URL
#   2 — timeout reached before deploy finished
#
# Requires `gh auth status` to be OK.

set -u
set -o pipefail

TIMEOUT=600
for arg in "$@"; do
    case "$arg" in
        --timeout=*) TIMEOUT="${arg#--timeout=}" ;;
    esac
done

if ! command -v gh >/dev/null 2>&1; then
    echo "ERROR: gh CLI not installed" >&2
    exit 1
fi

# Get the SHA of the commit we just pushed
sha="$(git rev-parse HEAD 2>/dev/null)"
if [[ -z "$sha" ]]; then
    echo "ERROR: could not resolve HEAD sha" >&2
    exit 1
fi
short_sha="${sha:0:7}"

echo "waiting for GitHub Actions deploy of $short_sha on main..."

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

deadline=$(($(date +%s) + TIMEOUT))
last_status=""

while true; do
    now=$(date +%s)
    if (( now >= deadline )); then
        echo "${RED}TIMEOUT after ${TIMEOUT}s — deploy did not finish in time.${NC}" >&2
        echo "Check: gh run list --branch main --limit 1" >&2
        exit 2
    fi

    # Find the run for this sha
    run_json="$(gh run list --branch main --limit 5 --json databaseId,headSha,status,conclusion,url,event 2>/dev/null || echo '[]')"

    # Find the one matching our sha (could take a moment to appear after push)
    match="$(echo "$run_json" | python -c "
import json, sys
runs = json.loads(sys.stdin.read())
sha = sys.argv[1]
for r in runs:
    if r.get('headSha') == sha:
        print(json.dumps(r))
        sys.exit(0)
" "$sha" 2>/dev/null || echo "")"

    if [[ -z "$match" ]]; then
        echo "  no run yet for $short_sha — waiting..."
        sleep 5
        continue
    fi

    status="$(echo "$match" | python -c "import json,sys; print(json.loads(sys.stdin.read()).get('status',''))")"
    conclusion="$(echo "$match" | python -c "import json,sys; print(json.loads(sys.stdin.read()).get('conclusion') or '')")"
    url="$(echo "$match" | python -c "import json,sys; print(json.loads(sys.stdin.read()).get('url',''))")"

    if [[ "$status" != "$last_status" ]]; then
        echo "  status: $status${NC}"
        last_status="$status"
    fi

    if [[ "$status" == "completed" ]]; then
        case "$conclusion" in
            success)
                echo "${GREEN}✓ deploy success: $url${NC}"
                exit 0
                ;;
            "")
                echo "${YELLOW}completed with no conclusion field — treating as unknown${NC}"
                exit 1
                ;;
            *)
                echo "${RED}✗ deploy $conclusion: $url${NC}" >&2
                exit 1
                ;;
        esac
    fi

    sleep 10
done
