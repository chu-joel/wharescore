#!/bin/bash
# PreToolUse hook: blocks git commit if changed files need doc updates
# and the corresponding docs aren't also staged.
#
# Handles both separate (git add + git commit) and chained (git add X && git commit)
# by combining already-staged files with files mentioned in `git add` within the command.

INPUT=$(cat)

# Extract command without jq (jq may not be installed on Windows/Git Bash)
# The input is JSON like: {"tool_input":{"command":"git add X && git commit ..."}}
COMMAND=$(echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1)

if [[ ! "$COMMAND" =~ git\ commit ]]; then
  exit 0
fi

cd "D:/Projects/Experiments/propertyiq-poc"

# Get already-staged files (only those with actual changes)
STAGED=$(git diff --cached --name-only 2>/dev/null)

# Also parse files from any `git add <files>` in the same command chain
# This handles: git add file1 file2 && git commit ...
ADD_FILES=""
if [[ "$COMMAND" =~ git\ add\ ([^&\|;]+) ]]; then
  ADD_FILES="${BASH_REMATCH[1]}"
fi

# Combine both sources, then filter to only files with real diffs.
# This prevents staging an unchanged doc from satisfying the check.
ALL_RAW=$(printf '%s\n%s' "$STAGED" "$ADD_FILES" | sort -u)
ALL_FILES=""
for f in $ALL_RAW; do
  # Check if file has staged changes or unstaged changes (about to be staged by git add)
  if git diff --cached --quiet -- "$f" 2>/dev/null && git diff --quiet -- "$f" 2>/dev/null; then
    continue  # No changes — skip
  fi
  ALL_FILES=$(printf '%s\n%s' "$ALL_FILES" "$f")
done

if [ -z "$(echo "$ALL_FILES" | tr -d '[:space:]')" ]; then
  exit 0
fi

MISSING=""

# Check: code file changed → is the required doc also staged?
echo "$ALL_FILES" | grep -q 'data_loader.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/DATA-CATALOG.md' && \
  MISSING="${MISSING}\n- data_loader.py changed: update docs/DATA-CATALOG.md DataSources-by-region"

echo "$ALL_FILES" | grep -q '_rates.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/DATA-CATALOG.md' && \
  MISSING="${MISSING}\n- *_rates.py changed: update docs/DATA-CATALOG.md Live-rates-APIs + wire in TWO places"

echo "$ALL_FILES" | grep -q 'snapshot_generator.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/FRONTEND-WIRING.md' && \
  MISSING="${MISSING}\n- snapshot_generator.py changed: update docs/FRONTEND-WIRING.md Snapshot-structure"

echo "$ALL_FILES" | grep -qE 'routers/' && \
  ! echo "$ALL_FILES" | grep -q 'docs/FRONTEND-WIRING.md' && \
  MISSING="${MISSING}\n- routers/ changed: update docs/FRONTEND-WIRING.md API-endpoints if you added/changed endpoints"

echo "$ALL_FILES" | grep -q 'Hosted.*\.tsx' && \
  ! echo "$ALL_FILES" | grep -q 'docs/FRONTEND-WIRING.md' && \
  MISSING="${MISSING}\n- Hosted*.tsx changed: update docs/FRONTEND-WIRING.md Hosted-sections"

echo "$ALL_FILES" | grep -q 'sections/.*\.tsx' && \
  ! echo "$ALL_FILES" | grep -q 'docs/FRONTEND-WIRING.md' && \
  MISSING="${MISSING}\n- sections/*.tsx changed: update docs/FRONTEND-WIRING.md On-screen-sections"

echo "$ALL_FILES" | grep -qE 'components/property/[A-Z].*\.tsx' && \
  ! echo "$ALL_FILES" | grep -q 'docs/FRONTEND-WIRING.md' && \
  MISSING="${MISSING}\n- property component changed: update docs/FRONTEND-WIRING.md Report-fields if new fields/components added"

echo "$ALL_FILES" | grep -q 'risk_score.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- risk_score.py changed: update docs/SYSTEM-FLOWS.md Scoring-system"

echo "$ALL_FILES" | grep -q 'credit_check.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- credit_check.py changed: update docs/SYSTEM-FLOWS.md Payment-credit-system"

echo "$ALL_FILES" | grep -qE 'stores/(pdfExport|downloadGate)' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- export/payment store changed: update docs/SYSTEM-FLOWS.md Report-export-flow"

echo "$ALL_FILES" | grep -q 'UpgradeModal.tsx' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- UpgradeModal.tsx changed: update docs/SYSTEM-FLOWS.md Payment-credit-system if pricing changed"

echo "$ALL_FILES" | grep -q 'services/email.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- email.py changed: update docs/SYSTEM-FLOWS.md if email flow changed"

echo "$ALL_FILES" | grep -q 'payments.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- payments.py changed: update docs/SYSTEM-FLOWS.md Payment-credit-system"

echo "$ALL_FILES" | grep -q 'webhooks.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- webhooks.py changed: update docs/SYSTEM-FLOWS.md Payment-credit-system if flow changed"

echo "$ALL_FILES" | grep -qE 'components/admin/|hooks/useAdmin' && \
  ! echo "$ALL_FILES" | grep -q 'docs/FRONTEND-WIRING.md' && \
  MISSING="${MISSING}\n- admin component/hook changed: update docs/FRONTEND-WIRING.md if admin endpoints or UI changed"

echo "$ALL_FILES" | grep -q 'routers/admin.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/FRONTEND-WIRING.md' && \
  MISSING="${MISSING}\n- admin router changed: update docs/FRONTEND-WIRING.md API-endpoints if admin endpoints changed"

echo "$ALL_FILES" | grep -q 'admin_auth.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- admin_auth.py changed: update docs/SYSTEM-FLOWS.md Admin-auth if auth flow changed"

echo "$ALL_FILES" | grep -q 'AdminAuthGate.tsx' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- AdminAuthGate changed: update docs/SYSTEM-FLOWS.md Admin-auth if gate logic changed"

echo "$ALL_FILES" | grep -q 'rent_advisor.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- rent_advisor.py changed: update docs/SYSTEM-FLOWS.md if estimation logic changed"

echo "$ALL_FILES" | grep -q 'price_advisor.py' && \
  ! echo "$ALL_FILES" | grep -q 'docs/SYSTEM-FLOWS.md' && \
  MISSING="${MISSING}\n- price_advisor.py changed: update docs/SYSTEM-FLOWS.md if estimation logic changed"

echo "$ALL_FILES" | grep -qE 'migrations/00' && \
  ! echo "$ALL_FILES" | grep -qE 'docs/' && \
  MISSING="${MISSING}\n- migration changed: update relevant docs (DATA-CATALOG.md tables, WIRING-TRACES.md traces)"

if [ -n "$MISSING" ]; then
  # Detect whether this command is a chain (&&, ||, ;). A blocked PreToolUse
  # hook cancels the ENTIRE Bash tool call. If the caller relied on chaining
  # `git add` with `git commit`, the chain's `git add` hasn't run — nothing
  # is staged. Not making this explicit wastes minutes of debugging when the
  # caller assumes staging happened.
  IS_CHAIN=false
  if echo "$COMMAND" | grep -qE '\&\&|\|\||;'; then
    IS_CHAIN=true
  fi

  # Pull the unique doc paths mentioned in MISSING so we can suggest a concrete
  # `git add` command. MISSING text is e.g. "- routers/ changed: update
  # docs/FRONTEND-WIRING.md ..." — grep the paths, dedupe, space-join.
  SUGGESTED_DOCS=$(printf "%b" "$MISSING" | grep -oE 'docs/[A-Z-]+\.md' | sort -u | tr '\n' ' ' | sed 's/ $//')

  {
    printf "BLOCKED: Code changes need doc updates in the same commit.\n"

    if [ "$IS_CHAIN" = true ]; then
      printf "\nThis command is chained (&&/;/||). A blocked PreToolUse hook cancels the\n"
      printf "ENTIRE chain — no \`git add\` or \`git commit\` has run, nothing is staged.\n"
      printf "Stage separately first, OR include missing docs in the chain's \`git add\`.\n"
    fi

    printf "\nMissing docs:"
    printf "%b\n" "$MISSING"

    if [ -n "$SUGGESTED_DOCS" ]; then
      printf "\nTo unblock, stage these docs alongside your code:\n"
      printf "  git add %s\n" "$SUGGESTED_DOCS"
    fi

    printf "\nAlso: update docs with anything a future agent working in this area should know to get their job done quicker and with 100%% accuracy.\n"
  } >&2

  exit 2
fi

exit 0
