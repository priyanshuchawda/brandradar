#!/usr/bin/env bash
# Link this folder to a Vercel project and connect the GitHub repo. Do not run vercel link manually.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO="${1:-priyanshuchawda/brandradar}"
PROJECT="${2:-brandradar}"

vercel link --yes --project "$PROJECT" 2>/dev/null || vercel link --yes

if vercel git connect "$REPO" 2>/dev/null; then
  echo "git connected: $REPO"
else
  echo "git connect skipped or already linked ($REPO)"
fi

echo "vercel project linked"
