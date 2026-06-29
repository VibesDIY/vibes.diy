#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="$(cd "$(dirname "$0")" && pwd)"
USER_SLUG="og"

gen() {
  local slug="$1"
  local prompt_file="$HERE/$slug.prompt"
  local prompt
  prompt="$(cat "$prompt_file")"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen epi-study-design-explainer
gen outbreak-investigation-tracker
gen surveillance-case-workflow
gen cohort-study-design-tool
gen systematic-review-evidence-grader

wait
echo "ALL DONE" >> "$HERE/_status.log"
