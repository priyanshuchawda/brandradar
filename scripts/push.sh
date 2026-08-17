#!/usr/bin/env bash
# Commit and push. Do not call `git push` from the terminal — run this script.
# Does not touch git config. Uses the existing local identity (priyanshuchawda).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/push.sh \"Commit message\"" >&2
  exit 1
fi

if git status --porcelain | grep -E '(^..|\s)\.env\.local$' >/dev/null; then
  echo "refusing: .env.local must stay untracked" >&2
  exit 1
fi

git add -A
git reset -q HEAD -- .env.local .env 2>/dev/null || true

if git diff --cached --quiet; then
  echo "nothing to commit; pushing current branch"
  git push -u origin HEAD
  git status -sb
  exit 0
fi

if git diff --cached --name-only | grep -E '(^|/)\.env\.local$' >/dev/null; then
  echo "refusing: .env.local staged" >&2
  exit 1
fi

MESSAGE="$1"

git commit -m "$(cat <<EOF
$MESSAGE

EOF
)"

git push -u origin HEAD
git status -sb
git log -1 --format='committed as %an <%ae>%n%h %s'
