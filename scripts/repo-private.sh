#!/usr/bin/env bash
# Ensure the GitHub repo stays private. Do not run `gh` from the terminal — use this script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE="${1:-origin}"
URL="$(git remote get-url "$REMOTE")"

case "$URL" in
  *github.com*)
    REPO="$(echo "$URL" | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?$#\1#')"
    ;;
  *)
    echo "unsupported remote: $URL" >&2
    exit 1
    ;;
esac

VISIBILITY="$(gh api "/repos/$REPO" --jq .private)"
if [[ "$VISIBILITY" == "true" ]]; then
  echo "already private: $REPO"
  exit 0
fi

gh api -X PATCH "/repos/$REPO" -f private=true --jq '"now private: " + .full_name'
echo "visibility: private"
