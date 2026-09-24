#!/usr/bin/env bash
# Build app/ and publish it to the gh-pages branch (the live GitHub Pages site).
#
#   ./scripts/deploy-gh-pages.sh ["commit message"]
#
# The gh-pages root is exactly app/dist after a build: index.html + assets/ +
# corpus/ (vite copies the repo-root public/ dir, including all datasets, into
# dist via publicDir) + favicon.svg + .nojekyll.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
MSG="${1:-deploy: update site}"

echo "==> Building app…"
( cd app && npm install --no-audit --no-fund && npm run build )

echo "==> Fetching gh-pages…"
git fetch origin gh-pages

TMP="$(mktemp -d)"
cleanup() { git -C "$ROOT" worktree remove --force "$TMP/ghp" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
git worktree add --detach "$TMP/ghp" FETCH_HEAD

echo "==> Syncing build output…"
find "$TMP/ghp" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -R app/dist/. "$TMP/ghp/"

cd "$TMP/ghp"
git add -A
if git diff --cached --quiet; then
  echo "==> No changes to deploy."
  exit 0
fi
git -c user.name="${GIT_AUTHOR_NAME:-$(git -C "$ROOT" config user.name || echo deploy)}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-$(git -C "$ROOT" config user.email || echo deploy@local)}" \
    commit -m "$MSG"
git push origin HEAD:gh-pages
echo "==> Deployed to gh-pages: https://saintus-create.github.io/personal-846704-788650/"
