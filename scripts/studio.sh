#!/usr/bin/env bash
# Run / heal / approve a Scraper Studio collector.
# usage:
#   scripts/studio.sh run <collector_id> <url>
#   scripts/studio.sh heal <collector_id> <url> <prompt>
#   scripts/studio.sh approve <collector_id> <url>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi
export BRIGHTDATA_API_KEY="${BRIGHTDATA_API_KEY:-$BRIGHT_DATA_API_TOKEN}"

CMD="${1:-}"
shift || true

case "$CMD" in
  run)
    npx -p @brightdata/cli bdata scraper run "$1" "$2" --pretty
    ;;
  heal)
    npx -p @brightdata/cli bdata scraper heal "$1" "$3" --url "$2" --pretty
    ;;
  approve)
    npx -p @brightdata/cli bdata scraper approve "$1" --url "$2" --pretty
    ;;
  *)
    echo "usage: scripts/studio.sh run|heal|approve ..." >&2
    exit 1
    ;;
esac
