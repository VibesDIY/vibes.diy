#!/usr/bin/env bash
cd "$(dirname "$0")"
: > _status.log

USER_SLUG="og"
gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> _status.log 2>&1 && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "puppy-daily-log" "capsule" "Puppy daily routine tracker. Log meals, potty breaks with success/accident, crate time, naps, and energy level. Shows the day's pattern at a glance."
gen "puppy-vet-schedule" "codex" "Puppy vet and vaccine timeline. Add vaccines with date given, next due date, and vet notes. Track deworming, flea/tick, heartworm. Share with vet or sitter."
gen "training-cue-log" "proof" "Puppy training cue tracker. Each cue: name, goal behavior, current success rate, training notes. Log sessions with date and progress. Share with trainer."
gen "puppy-feeding-log" "terminal" "Puppy feeding and treat log. Each meal: time, amount, food brand, any reaction. Track treats separately. Helpful when changing food or adjusting portions."
gen "puppy-milestone-journal" "guild" "Puppy milestone photo journal. Each entry: milestone name, date, photo, notes. First bath, first walk, first 'sit', first night through. Sharable as a timeline."

wait
echo "ALL DONE" >> _status.log
