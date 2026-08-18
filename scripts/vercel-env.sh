#!/usr/bin/env bash
# Sync .env.local secrets to Vercel (production + preview). Do not run vercel env manually.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${1:-.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing $ENV_FILE" >&2
  exit 1
fi

if [[ ! -d .vercel ]]; then
  echo "run scripts/vercel-link.sh first" >&2
  exit 1
fi

add_var() {
  local key="$1"
  local value="$2"
  local target="$3"

  if vercel env ls "$target" 2>/dev/null | awk '{print $1}' | grep -qx "$key"; then
    vercel env rm "$key" "$target" --yes >/dev/null 2>&1 || true
  fi
  printf '%s' "$value" | vercel env add "$key" "$target" >/dev/null
  echo "  $key → $target"
}

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$line" ]] && continue
  [[ "$line" != *=* ]] && continue

  key="${line%%=*}"
  value="${line#*=}"
  key="$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  value="$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$key" ]] && continue

  echo "sync $key"
  add_var "$key" "$value" production
  add_var "$key" "$value" preview
done < "$ENV_FILE"

echo "env sync complete"
