#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

USER_SLUG="og"
LOG="_status.log"
> "$LOG"

gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec
  theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null || echo "")
  npx vibes-diy@latest generate \
    --user-slug "$USER_SLUG" \
    --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> "$LOG" 2>&1 \
    && echo "DONE $slug exit=0" >> "$LOG" \
    || echo "DONE $slug exit=1" >> "$LOG" &
}

# 01 — spotlight: band similarity explorer
gen "psych-rabbit-hole" "vault" \
  "Music explorer for late-60s psych rock. User types a band name, gets five similar artists each with a one-line description of the sonic connection. Shuffle button picks a random starting band. Clean search input."

# 02 — deep cut oracle
gen "b-side-oracle" "codex" \
  "Deep cut recommendation oracle. User types a famous band or album. App returns one obscure recommendation from the same era with a two-sentence note on what makes it singular. Button to draw another recommendation."

# 03 — coordinated listening session
gen "psych-listen-along" "guild" \
  "Coordinated listening session app. Host enters album name and start time. Others join with their name. Countdown to start. After start, shared note field appears so people can post reactions during each side."

# 04 — crate digger journal
gen "dig-log" "poster" \
  "Personal listening journal for vinyl diggers. Log an album: artist, title, year, rating out of five, one-line impression. Shows recent entries in reverse order. Generate a shareable read-only link."

# 05 — psych canon quiz
gen "psych-canon-quiz" "terminal" \
  "Quiz about the psychedelic rock canon 1965-1975. Multiple-choice questions about albums, bands, connections, personnel. Covers Silver Apples, Can, Soft Machine, 13th Floor Elevators, Gong, Quicksilver. Score tracker."

wait
echo "ALL DONE" >> "$LOG"
echo "Generation complete — check $LOG"
