#!/usr/bin/env bash
set -euo pipefail
USER_SLUG="og"
cd "$(dirname "$0")"
> _status.log

gen() {
  local slug="$1"; local prompt="$2"
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >> _status.log 2>&1 && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "field-day-station-signup" "Field day volunteer signup. Stations: sack race, relay, water balloons, tug of war, face painting, snack table. Each needs 2 volunteers. Parents sign up by name. Shows open slots."

gen "teacher-appreciation-assignments" "Teacher appreciation week contribution tracker. Each classroom listed. Items needed per class: flowers, snack, card, coffee gift card. Parents claim one item per class. No duplicates."

gen "graduation-volunteer-signup" "Graduation ceremony volunteer slots. Roles: parking crew, program handout, reception table, chair setup, cleanup. Each role shows how many needed and how many signed up."

gen "officer-handoff-notes" "PTA officer transition notes. Outgoing officers leave structured notes for their successor: Google Drive link, key contacts, recurring dates, what to watch out for. Read-only after submission."

gen "class-fundraiser-tracker" "School fundraiser tracker. Each class listed with a goal and current total. Teachers post updates. Parents see progress. Simple tally, no payment processing."

wait
echo "ALL DONE" >> _status.log
