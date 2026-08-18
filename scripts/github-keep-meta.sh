#!/usr/bin/env bash
# Keep GitHub About metadata: description, homepage, private. Does not touch README.
# Do not run `gh` from the terminal — use this script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE="${1:-origin}"
URL="$(git remote get-url "$REMOTE")"
REPO="$(echo "$URL" | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?$#\1#')"

DESCRIPTION="BrandRadar — competitive intelligence for Into the Scrape-Verse (WeMakeDevs × Bright Data)."
HOMEPAGE="https://brandradar-beta.vercel.app"

gh api -X PATCH "/repos/$REPO" \
  -F private=true \
  -f description="$DESCRIPTION" \
  -f homepage="$HOMEPAGE" \
  --jq '{full_name, private, description, homepage}'
