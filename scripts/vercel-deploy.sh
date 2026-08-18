#!/usr/bin/env bash
# Link GitHub → Vercel, sync env, and deploy production. Do not run vercel/gh/git directly.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO="${1:-priyanshuchawda/brandradar}"

"$ROOT/scripts/repo-private.sh"
"$ROOT/scripts/vercel-link.sh" "$REPO"
"$ROOT/scripts/github-keep-meta.sh"

if [[ -f .env.local ]]; then
  "$ROOT/scripts/vercel-env.sh" .env.local
else
  echo "warning: no .env.local — skipping env sync" >&2
fi

vercel deploy --prod --yes
echo "production deploy triggered"
