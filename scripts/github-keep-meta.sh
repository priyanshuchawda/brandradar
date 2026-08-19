#!/usr/bin/env bash
# Keep GitHub About metadata: description, homepage, topics, private. Does not touch README.
# Do not run `gh` from the terminal — use this script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE="${1:-origin}"
URL="$(git remote get-url "$REMOTE")"
REPO="$(echo "$URL" | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?$#\1#')"

DESCRIPTION="Competitive intelligence from public storefronts — rival discovery, catalog extraction, and growth plays with self-healing scrapers."
HOMEPAGE="https://brandradar-beta.vercel.app"
TOPICS=(
  competitive-intelligence
  web-scraping
  nextjs
  typescript
  bright-data
  self-healing
)

gh api -X PATCH "/repos/$REPO" \
  -F private=true \
  -f description="$DESCRIPTION" \
  -f homepage="$HOMEPAGE" \
  --jq '{full_name, private, description, homepage}'

TOPIC_ARGS=()
for topic in "${TOPICS[@]}"; do
  TOPIC_ARGS+=(-f "names[]=$topic")
done
gh api -X PUT "/repos/$REPO/topics" "${TOPIC_ARGS[@]}" --jq '.names'
