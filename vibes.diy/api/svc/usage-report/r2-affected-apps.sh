#!/usr/bin/env bash
#
# r2-affected-apps.sh — list Apps that have at least one s3://r2/<cid>
# assetURI in their fileSystem.
#
# These are the apps that would 404 on /assets/cid lookups if we rolled
# back to code that doesn't understand the s3:// peer. They're the rollback
# blast radius.
#
# Usage:
#   ./vibes.diy/api/svc/usage-report/r2-affected-apps.sh           # list mode (default)
#   ./vibes.diy/api/svc/usage-report/r2-affected-apps.sh count     # just the count
#   ./vibes.diy/api/svc/usage-report/r2-affected-apps.sh cids      # flat CID list (for rehydration)
#   ./vibes.diy/api/svc/usage-report/r2-affected-apps.sh since 2h  # only apps created since
#
# Prereqs:
#   - vibes.diy/api/svc/.dev.vars has NEON_DATABASE_URL set
#   - run from repo root

set -uo pipefail

MODE="${1:-list}"
SINCE_ARG="${3:-}"
SINCE_FILTER=""
if [ "${2:-}" = "since" ] && [ -n "$SINCE_ARG" ]; then
  # Expect e.g. "2h", "30m", "1d" — Postgres interval-compatible
  SINCE_FILTER="and created::timestamptz > now() - interval '${SINCE_ARG}'"
fi

DB() {
  pnpm --dir vibes.diy/api/svc run db:inspect sql "$1" 2>&1 | awk '/^{/{flag=1} flag'
}

case "$MODE" in
  count)
    DB "select count(*) as affected_apps from \"Apps\" where \"fileSystem\"::text like '%\"assetURI\":\"s3://r2/%' ${SINCE_FILTER}" \
      | jq '.rows[0]'
    ;;

  list)
    echo "=== Apps with one or more s3://r2/<cid> assetURIs ==="
    DB "select \"appSlug\", \"userSlug\", \"fsId\", \"created\", (select count(*) from jsonb_array_elements(\"fileSystem\") f where f->>'assetURI' like 's3://r2/%') as r2_count, (select count(*) from jsonb_array_elements(\"fileSystem\") f where f->>'assetURI' like 'pg://Assets/%' or f->>'assetURI' like 'sqlite://Assets/%') as sql_count from \"Apps\" where \"fileSystem\"::text like '%\"assetURI\":\"s3://r2/%' ${SINCE_FILTER} order by created desc" \
      | jq '{rowCount, rows: .rows | map({appSlug, userSlug, fsId, created, r2_count, sql_count})}'
    ;;

  cids)
    # Flat list of every s3://r2/<cid> CID across all affected apps.
    # Useful as input to a rehydration script (read R2 -> write SQL).
    DB "select distinct (jsonb_array_elements(\"fileSystem\")->>'assetURI') as uri from \"Apps\" where \"fileSystem\"::text like '%\"assetURI\":\"s3://r2/%' ${SINCE_FILTER}" \
      | jq -r '.rows[].uri // empty' \
      | grep '^s3://r2/' \
      | sed 's|^s3://r2/||' \
      | sort -u
    ;;

  *)
    echo "Usage: $0 {list|count|cids} [since {2h|1d|...}]"
    exit 64
    ;;
esac
