#!/usr/bin/env bash
# Create a Scraper Studio collector. Does not print the API key.
# usage: scripts/studio-create.sh <name> <url> <description>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 3 ]]; then
  echo "usage: scripts/studio-create.sh <name> <url> <description>" >&2
  exit 1
fi

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

export BRIGHTDATA_API_KEY="${BRIGHTDATA_API_KEY:-$BRIGHT_DATA_API_TOKEN}"
if [[ -z "${BRIGHTDATA_API_KEY:-}" ]]; then
  echo "BRIGHT_DATA_API_TOKEN missing in .env.local" >&2
  exit 1
fi

NAME="$1"
URL="$2"
DESC="$3"
mkdir -p data/raw
OUT="data/raw/${NAME}-create.json"

npx -p @brightdata/cli bdata scraper create "$URL" "$DESC" \
  --name "$NAME" \
  --timeout 600 \
  --json \
  --pretty \
  -o "$OUT"

echo "wrote $OUT"
