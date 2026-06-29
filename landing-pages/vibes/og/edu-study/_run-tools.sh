#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/edu-study"
cd "$HERE"
USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status-tools.log" ) &
}

: > "$HERE/_status-tools.log"

gen pomodoro-focus-timer "Pomodoro focus timer. 25-minute sessions, 5-minute breaks, long break every four. Task list you check off. Daily session count. Ring sound on transition. Configurable intervals. Fireproof saves history and streak."

gen cornell-notes-gen "Cornell notes generator. User types a topic, AI outputs structured notes: cue column on left with key questions, notes column on right, summary strip at bottom. Save and browse past note sets. Fireproof."

gen habit-streak-tracker "Daily study streak tracker. Log subjects and minutes per day. Calendar heatmap shows consistency. Current streak counter and longest streak. Weekly subject breakdown. Fireproof."

wait
echo "ALL DONE" >> "$HERE/_status-tools.log"
