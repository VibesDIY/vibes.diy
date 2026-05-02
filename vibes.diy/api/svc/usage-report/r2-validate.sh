#!/usr/bin/env bash
#
# r2-validate.sh — post-cli-deploy validation for the R2 storage activation.
#
# Pushes a vibe with a controlled-size App.jsx, then queries the Apps table
# to read each file's assetURI directly (CLI doesn't output JSON, so the DB
# is the source of truth for routing decisions).
#
# Prerequisites:
#   - cli env has the new code deployed (`vibes-diy@c<version>` tag pushed)
#   - You are logged in: `npx vibes-diy login`
#   - vibes.diy/api/svc/.dev.vars has NEON_DATABASE_URL set
#   - From the repo root so `pnpm --dir vibes.diy/api/svc run db:inspect ...`
#     works
#
# Usage:
#   ./vibes.diy/api/svc/usage-report/r2-validate.sh [size_bytes]
#
# Default size 6144 (~6 KB) straddles the 4 KB cutoff so raw + transformed
# JS route to R2 while the import map stays in SQL.

set -uo pipefail

SIZE="${1:-6144}"
RUN_ID="$(date +%s)"
SLUG="r2-validate-${RUN_ID}"
DIR="$(mktemp -d -t r2-validate-XXXXXX)"
SUCCESS=0

cleanup() {
  if [ "$SUCCESS" -eq 1 ]; then
    rm -rf "$DIR"
  else
    echo
    echo "Test dir kept for inspection: ${DIR}"
  fi
}
trap cleanup EXIT

# Generate a controlled-size App.jsx.
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

echo "=== vibes-diy push --mode dev --app-slug ${SLUG} ==="
( cd "$DIR" && npx vibes-diy push --mode dev --app-slug "${SLUG}" ) | tee "$DIR/push.log"
PUSH_EXIT=${PIPESTATUS[0]}
echo
if [ "$PUSH_EXIT" -ne 0 ]; then
  echo "FAIL: push exited ${PUSH_EXIT}"
  exit 1
fi

# CLI doesn't honor --json today; query the Apps table for the slug we just
# pushed and read assetURI from the fileSystem column. That's the server's
# authoritative record of where each file landed.
echo "=== Apps row (assetURIs from server) ==="
APPS_JSON_FILE="$DIR/apps-row.json"
pnpm --dir vibes.diy/api/svc run db:inspect sql \
  "select \"appSlug\", \"userSlug\", \"fileSystem\" from \"Apps\" where \"appSlug\" = '${SLUG}' order by created desc limit 1" \
  > "$APPS_JSON_FILE" 2>&1
DB_EXIT=$?
if [ "$DB_EXIT" -ne 0 ]; then
  echo "FAIL: db:inspect exited ${DB_EXIT}"
  cat "$APPS_JSON_FILE"
  exit 1
fi

# Strip pnpm header lines so it's pure JSON
JSON=$(awk '/^{/{flag=1} flag' "$APPS_JSON_FILE")
if [ -z "$JSON" ]; then
  echo "FAIL: could not extract JSON from db:inspect output"
  cat "$APPS_JSON_FILE"
  exit 1
fi

URIS=$(echo "$JSON" | jq -r '.rows[0].fileSystem[]?.assetURI // empty')
if [ -z "$URIS" ]; then
  echo "FAIL: no assetURIs found in Apps row for ${SLUG}"
  echo "$JSON" | jq . 2>/dev/null || echo "$JSON"
  exit 1
fi
echo "$URIS"
echo

S3_COUNT=$(echo "$URIS" | grep -c '^s3://r2/' || true)
SQL_COUNT=$(echo "$URIS" | grep -cE '^(pg|sqlite)://Assets/' || true)
TOTAL=$(echo "$URIS" | wc -l | tr -d ' ')

echo "=== routing tally ==="
echo "  total assets : ${TOTAL}"
echo "  s3://r2/     : ${S3_COUNT}"
echo "  pg|sqlite:// : ${SQL_COUNT}"
echo

# Cross-check each CID directly: query Assets table for SQL presence
echo "=== Assets cross-check ==="
CIDS_IN_SQL=()
CIDS_IN_R2=()
while IFS= read -r uri; do
  cid="${uri##*/}"
  if [[ "$uri" =~ ^s3://r2/ ]]; then
    CIDS_IN_R2+=("$cid")
  else
    CIDS_IN_SQL+=("$cid")
  fi
done <<< "$URIS"

if [ ${#CIDS_IN_SQL[@]} -gt 0 ]; then
  IDS_LIST=$(printf "'%s'," "${CIDS_IN_SQL[@]}")
  IDS_LIST="${IDS_LIST%,}"
  echo "  SQL-routed CIDs (should appear in Assets):"
  pnpm --dir vibes.diy/api/svc run db:inspect sql \
    "select \"assetId\", length(content) as size from \"Assets\" where \"assetId\" in (${IDS_LIST})" \
    2>&1 | awk '/"assetId"/' | sed 's/^/    /'
fi

if [ ${#CIDS_IN_R2[@]} -gt 0 ]; then
  IDS_LIST=$(printf "'%s'," "${CIDS_IN_R2[@]}")
  IDS_LIST="${IDS_LIST%,}"
  echo "  R2-routed CIDs (should be ABSENT from Assets):"
  R2_IN_SQL=$(pnpm --dir vibes.diy/api/svc run db:inspect sql \
    "select count(*) as n from \"Assets\" where \"assetId\" in (${IDS_LIST})" \
    2>&1 | awk '/"n":/' | head -1)
  echo "    Assets count for R2 CIDs: ${R2_IN_SQL}"

  echo "  R2 bucket lookup (npx wrangler):"
  for cid in "${CIDS_IN_R2[@]}"; do
    if npx wrangler r2 object get "vibes-diy-fs-ids/${cid}" -o /dev/null 2>/dev/null; then
      echo "    OK in R2: ${cid}"
    else
      echo "    MISSING from R2: ${cid}"
    fi
  done
fi
echo

echo "=== verdict ==="
# We expect the import-map (small) to be SQL and the >4KB files to be R2
# only when new code is deployed. Two named scenarios:
EXPECTED_NEW="${TOTAL} total, S3>=2 (raw + transformed), SQL>=1 (import-map)"
EXPECTED_OLD="${TOTAL} total, S3=0, SQL=${TOTAL} (everything inline)"

if [ "$S3_COUNT" -ge 2 ] && [ "$SQL_COUNT" -ge 1 ]; then
  echo "OK (NEW CODE): ${EXPECTED_NEW}"
  SUCCESS=1
  exit 0
elif [ "$S3_COUNT" -eq 0 ] && [ "$SQL_COUNT" -ge "$TOTAL" ]; then
  echo "BASELINE (OLD CODE): ${EXPECTED_OLD}"
  echo "  -> all assets routed to SQL. Deploy new code to flip >4KB to R2."
  SUCCESS=1
  exit 0
else
  echo "INCONCLUSIVE: ${TOTAL} total, ${S3_COUNT} R2, ${SQL_COUNT} SQL — review above"
  exit 2
fi
