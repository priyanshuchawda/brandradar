#!/usr/bin/env bash
# Open a GitHub pull request. Do not run `gh pr create` from the terminal.
# usage: scripts/pr.sh "PR title" <<'EOF'
# body markdown
# EOF
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/pr.sh \"PR title\" [base-branch]" >&2
  echo "pass the body on stdin" >&2
  exit 1
fi

TITLE="$1"
BASE="${2:-main}"
BODY="$(cat)"

if [[ -z "$BODY" ]]; then
  echo "PR body on stdin is required" >&2
  exit 1
fi

# REST, not GraphQL — gh pr create 503s on this account sometimes.
HEAD_BRANCH="$(git branch --show-current)"
gh api -X POST "/repos/{owner}/{repo}/pulls" \
  -f title="$TITLE" \
  -f head="$HEAD_BRANCH" \
  -f base="$BASE" \
  -f body="$BODY" \
  --jq .html_url
