#!/usr/bin/env bash
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
: > "$HERE/_status_edu.log"
for slug in behavior-journal be-book-club nudge-pipeline field-experiment-design retirement-policy-design; do
  ( npx vibes-diy@latest generate \
      --user-slug=edu \
      --app-slug="$slug" \
      "$(cat "$HERE/$slug.prompt")" \
      > "$HERE/$slug.log" 2>&1
    echo "DONE $slug exit=$?" >> "$HERE/_status_edu.log"
  ) &
done
wait
echo "ALL DONE" >> "$HERE/_status_edu.log"
