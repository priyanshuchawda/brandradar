#!/usr/bin/env bash
# Push latest to GitHub (private) and deploy on Vercel. Run this — not raw git/gh/vercel commands.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/release.sh \"Commit message\" [github-org/repo]" >&2
  exit 1
fi

MESSAGE="$1"
REPO="${2:-priyanshuchawda/brandradar}"

"$ROOT/scripts/push.sh" "$MESSAGE"
"$ROOT/scripts/vercel-deploy.sh" "$REPO"

echo "release complete: $REPO (private) + vercel production"
