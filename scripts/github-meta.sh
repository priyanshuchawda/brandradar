#!/usr/bin/env bash
# Show GitHub repo description, homepage, topics, and visibility.
# Do not run `gh` from the terminal — use this script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE="${1:-origin}"
URL="$(git remote get-url "$REMOTE")"
REPO="$(echo "$URL" | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?$#\1#')"

gh api "/repos/$REPO" --jq '{
  full_name,
  private,
  description,
  homepage,
  default_branch,
  html_url
}'
echo "--- topics ---"
gh api "/repos/$REPO/topics" --jq '.names'
echo "--- readme (first 8 lines) ---"
gh api "/repos/$REPO/readme" --jq .content | base64 -d | head -n 8
