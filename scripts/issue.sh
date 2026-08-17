#!/usr/bin/env bash
# Open a GitHub issue. Do not run `gh issue create` from the terminal.
# usage: scripts/issue.sh "Issue title" <<'EOF'
# body markdown
# EOF
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/issue.sh \"Issue title\"" >&2
  echo "pass the body on stdin" >&2
  exit 1
fi

TITLE="$1"
BODY="$(cat)"

if [[ -z "$BODY" ]]; then
  echo "issue body on stdin is required" >&2
  exit 1
fi

# REST, not GraphQL — gh issue create 503s on this account sometimes.
gh api -X POST "/repos/{owner}/{repo}/issues" \
  -f title="$TITLE" \
  -f body="$BODY" \
  --jq .html_url
