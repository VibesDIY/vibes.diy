#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/.claude/worktrees/harvest-runbook-prompt-spec/vibes/behavioral-economics"
USER_SLUG="edu"

gen() {
  local slug="$1"
  local prompt_file="$HERE/$2.prompt"
  local prompt
  prompt="$(cat "$prompt_file")"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.edu.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_retry_edu.log" ) &
}

: > "$HERE/_retry_edu.log"

gen default-architecture-policy-tool default-architecture-policy-tool
gen nudge-intervention-designer nudge-intervention-designer
gen experiment-design-builder experiment-design-builder
gen behavioral-science-reading-group behavioral-science-reading-group

wait
echo "ALL DONE" >> "$HERE/_retry_edu.log"
