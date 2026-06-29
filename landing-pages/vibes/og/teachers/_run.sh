#!/usr/bin/env bash
# Classroom coordination apps — batch generator
# Audience: K-12 teachers, classroom teachers who hack Google Sheets for coordination
set -euo pipefail

USER_SLUG="og"
LOG="_status.log"
> "$LOG"

gen() {
  local slug="$1"; local prompt="$2"
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >> "$LOG" 2>&1 \
    && echo "DONE $slug exit=0" >> "$LOG" \
    || echo "DONE $slug exit=1" >> "$LOG" &
}

# Spotlight: visible countdown timer — most visual, obvious in 15-second video
gen "class-countdown-timer" \
  "Classroom countdown timer. Teacher sets duration from their desk; a big visible countdown shows on every student device. Plays a sound at zero. Works for timed writing, group work, transitions. No login."

# Supporting apps
gen "exit-ticket-collector" \
  "End-of-class exit ticket. Students type one takeaway or one question before leaving — anonymous by default. Teacher sees a live list of responses and can flag any for tomorrow's discussion."

gen "live-vocab-quiz" \
  "Live vocabulary quiz game. Teacher adds word and definition pairs. Students get randomized questions and submit answers. Live leaderboard updates as results come in. No install, works on any phone."

gen "group-project-tracker" \
  "Per-group project tracker. Teacher sets shared milestone checklist. Each group checks off their own progress. Teacher sees all groups on one page — spots who is behind before the due date."

gen "classroom-quick-poll" \
  "Instant classroom poll. Teacher types a yes/no or multiple-choice question and shares a link. Students tap their answer. Live bar chart updates in real time on the teacher's screen. No accounts."

wait
echo "ALL DONE" >> "$LOG"
echo "--- All generators finished. Check $LOG for results. ---"
