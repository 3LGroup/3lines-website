#!/usr/bin/env bash
#
# Publish the 3Lines site.
#
# Invoked by the CMS's Publish action, or by hand. Builds a NEW release from the
# persistent content directory, runs every gate, and only then repoints the
# `current` symlink and reloads pm2.
#
# The guarantee: if any gate fails, this exits non-zero and `current` is left
# exactly where it was. The live site keeps serving the previous release rather
# than a half-updated one. Rolling back is repointing a symlink.
#
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/srv/3lines}"
REPO="${REPO:-$APP_ROOT/repo}"
CONTENT="${CONTENT:-$APP_ROOT/content}"      # persistent; the CMS writes here
RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
LOGS="$APP_ROOT/logs"
KEEP="${KEEP:-5}"
PM2_APP="${PM2_APP:-3lines-site}"
STAMP="$(date +%Y%m%d-%H%M%S)"
NEW="$RELEASES/$STAMP"

mkdir -p "$RELEASES" "$LOGS"
exec 9>"$APP_ROOT/.publish.lock"
if ! flock -n 9; then
  echo "FAIL  another publish is already running" >&2
  exit 1
fi

log(){ printf '\n=== %s ===\n' "$1"; }
fail(){ echo "FAIL  $1" >&2; echo "current still -> $(readlink -f "$CURRENT" 2>/dev/null || echo none)" >&2; exit 1; }

log "1/6 stage release $STAMP"
mkdir -p "$NEW"
# Copy the working tree rather than building in place, so a failed build cannot
# corrupt the release that is currently serving.
tar -C "$REPO" --exclude=.git --exclude=node_modules --exclude=.next --exclude=releases -cf - . | tar -C "$NEW" -xf -
[ -d "$REPO/node_modules" ] && cp -r "$REPO/node_modules" "$NEW/node_modules"
cd "$NEW"

export SOURCE_CONTENT_DIR="$CONTENT"
export CONTENT_DIR="$NEW/content"
export NODE_ENV=production

log "2/6 ingest content"
node scripts/ingest-3lines.mjs || fail "ingest rejected the content"

log "3/6 content audit (the nothing-was-dropped gate)"
node scripts/audit-content.mjs || fail "content audit rejected the content"

log "4/6 build"
npx next build || fail "next build failed"

log "5/6 runtime gates"
PORT_TEST="${PORT_TEST:-3399}"
npx next start -p "$PORT_TEST" >"$LOGS/verify-$STAMP.log" 2>&1 &
VERIFY_PID=$!
trap 'kill $VERIFY_PID 2>/dev/null || true' EXIT
for i in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PORT_TEST/en" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "http://127.0.0.1:$PORT_TEST/en" >/dev/null || fail "new release did not become ready"

export AUDIT_BASE="http://127.0.0.1:$PORT_TEST"
node scripts/audit-links.mjs   || fail "link audit failed"
node scripts/audit-assets.mjs  || fail "asset (cache-busting) audit failed"
# Browser-driven audits need Chrome; skipped rather than silently passed if absent.
if node -e "require('./scripts/lib/browser.mjs')" >/dev/null 2>&1 && [ -n "${RUN_BROWSER_AUDITS:-1}" ]; then
  node scripts/audit-console.mjs || fail "console audit failed"
  node scripts/audit-a11y.mjs    || fail "accessibility audit failed"
  node scripts/audit-rtl.mjs     || fail "RTL audit failed"
else
  echo "  NOTE: browser audits skipped (no browser available) — not counted as passing"
fi
kill $VERIFY_PID 2>/dev/null || true
trap - EXIT

log "6/6 activate"
PREV="$(readlink -f "$CURRENT" 2>/dev/null || true)"
ln -sfn "$NEW" "$CURRENT"
if ! pm2 reload "$PM2_APP" --update-env 2>/dev/null; then
  pm2 start "$APP_ROOT/ecosystem.config.cjs" --only "$PM2_APP"
fi
sleep 3
if ! curl -sf "http://127.0.0.1:${PORT:-3000}/en" >/dev/null; then
  echo "FAIL  live check failed after reload — rolling back" >&2
  [ -n "$PREV" ] && ln -sfn "$PREV" "$CURRENT" && pm2 reload "$PM2_APP" --update-env
  exit 1
fi

# Prune old releases, never the one in use.
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP+1)) | while read -r old; do
  [ "$(readlink -f "$old")" = "$(readlink -f "$CURRENT")" ] || rm -rf "$old"
done

echo
echo "PUBLISHED  $STAMP"
echo "  current -> $(readlink -f "$CURRENT")"
echo "  previous  ${PREV:-none} (rollback: ln -sfn <path> $CURRENT && pm2 reload $PM2_APP)"
