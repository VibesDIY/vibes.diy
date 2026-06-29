#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/.claude/worktrees/harvest-runbook-prompt-spec/vibes/research-methods-regression"
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

gen longitudinal-study-coordinator longitudinal-study-coordinator
gen education-research-quality-grader education-research-quality-grader
gen dissertation-methods-advisor dissertation-methods-advisor

wait
echo "ALL DONE" >> "$HERE/_retry_edu.log"
