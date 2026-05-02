#!/usr/bin/env bash
#
# r2-validate.sh — post-cli-deploy validation for the R2 storage activation.
#
# Pushes a vibe with a controlled-size App.jsx, then inspects SQL and R2 to
# confirm that >4 KB content routed to R2 and the import-map (small JSON)
# stayed in SQL.
#
# Prerequisites:
#   - cli env has the new code deployed (`vibes-diy@c<version>` tag pushed)
#   - You are logged in: `npx vibes-diy login`
#   - wrangler is authenticated for the Cloudflare account that owns the
#     vibes-diy-fs-ids bucket
#   - From the repo root so `pnpm --dir vibes.diy/api/svc run db:inspect ...`
#     works
#
# Usage:
#   ./vibes.diy/api/svc/usage-report/r2-validate.sh [size_bytes]
#
# Default size is 6144 (~6 KB) — straddles the 4 KB cutoff so the raw and
# transformed JS route to R2 while the import map stays in SQL.

set -uo pipefail

SIZE="${1:-6144}"
RUN_ID="$(date +%s)"
SLUG="r2-validate-${RUN_ID}"
DIR="$(mktemp -d -t r2-validate-XXXXXX)"

cleanup() {
  rm -rf "$DIR"
}
trap cleanup EXIT

# Generate a controlled-size App.jsx. Padding is text, so size on disk is
# close to the requested byte count.
{
  printf 'export default function App() { return <div data-run="%s">' "$RUN_ID"
  yes 'firefly r2 validation ' | head -c "$((SIZE - 200))"
  printf '</div>; }\n'
} > "$DIR/App.jsx"

ACTUAL_SIZE=$(wc -c < "$DIR/App.jsx" | tr -d ' ')

echo "=== r2-validate ==="
echo "  slug   : ${SLUG}"
echo "  dir    : ${DIR}"
echo "  size   : ${ACTUAL_SIZE} bytes (target ${SIZE})"
echo

# Push via cli (default apiUrl already targets cli env via stable-entry).
echo "=== vibes-diy push --mode dev --app-slug ${SLUG} ==="
( cd "$DIR" && npx vibes-diy push --mode dev --app-slug "${SLUG}" --json ) \
  | tee "$DIR/push-response.json"
PUSH_EXIT=${PIPESTATUS[0]}
echo
if [ "$PUSH_EXIT" -ne 0 ]; then
  echo "FAIL: push exited ${PUSH_EXIT}"
  exit 1
fi

# Pull CIDs out of the response. The push response includes a fileSystem
# array with assetURI + assetId entries — we want the URIs to confirm
# routing.
echo "=== assetURIs from push response ==="
URIS=$(jq -r '.fileSystem[]?.assetURI // empty' "$DIR/push-response.json" 2>/dev/null)
if [ -z "$URIS" ]; then
  echo "WARN: could not parse assetURIs from response (jq missing or shape changed)"
  echo "       inspect $DIR/push-response.json manually"
fi
echo "$URIS"
echo

# Tally: anything starting with s3://r2/ should be in R2; anything with
# pg://Assets/ or sqlite://Assets/ should be in SQL.
S3_COUNT=$(echo "$URIS" | grep -c '^s3://r2/' || true)
SQL_COUNT=$(echo "$URIS" | grep -cE '^(pg|sqlite)://Assets/' || true)

echo "=== routing tally ==="
echo "  s3://r2/      ${S3_COUNT}  (expected >= 1 for >4KB content)"
echo "  pg|sqlite://  ${SQL_COUNT}  (expected >= 1 for the import-map)"
echo

# SQL probe — recent rows
echo "=== SQL Assets — recent rows ==="
pnpm --dir vibes.diy/api/svc run db:inspect sql \
  "select \"assetId\", length(content) as size, created from \"Assets\" where created > now() - interval '5 minutes' order by created desc limit 20" \
  2>/dev/null | tail -40
echo

# R2 probe — recent objects (no native filter on creation time, so we
# list a window and grep for our CIDs)
echo "=== R2 finals (vibes-diy-fs-ids root, last 20) ==="
wrangler r2 object list vibes-diy-fs-ids --limit=20 2>/dev/null | head -25
echo
echo "=== R2 temp/* (orphan in-flights, should be empty) ==="
wrangler r2 object list vibes-diy-fs-ids --prefix=temp/ --limit=10 2>/dev/null | head -15
echo

echo "=== verdict ==="
if [ "$S3_COUNT" -ge 1 ] && [ "$SQL_COUNT" -ge 1 ]; then
  echo "OK: routing split observed (>=1 R2, >=1 SQL)"
  echo
  echo "Spot-check a fetch:"
  for u in $(echo "$URIS" | head -2); do
    enc=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$u")
    echo "  curl -I 'https://cli-v2.vibesdiy.net/assets/cid?url=${enc}'"
  done
  exit 0
else
  echo "INCONCLUSIVE: expected at least one R2 and one SQL routing — review output above"
  exit 2
fi
