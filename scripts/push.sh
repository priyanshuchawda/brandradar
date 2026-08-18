#!/usr/bin/env bash
# Commit and push. Do not call `git push` from the terminal — run this script.
# Author is set per commit below (does not touch global git config).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GIT_AUTHOR_NAME="Priyanshu Chawda"
export GIT_AUTHOR_EMAIL="hellopriyanshu4@gmail.com"
export GIT_COMMITTER_NAME="Priyanshu Chawda"
export GIT_COMMITTER_EMAIL="hellopriyanshu4@gmail.com"

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/push.sh \"Commit message\"" >&2
  exit 1
fi

if git ls-files --error-unmatch .env.local >/dev/null 2>&1; then
  echo "refusing: .env.local is tracked" >&2
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
