#!/usr/bin/env bash
# Volunteer coordinator apps — batch generator
# Run from this directory. Tails _status.log when done.
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

gen "volunteer-shift-signup" \
  "Volunteer shift sign-up kiosk for tablet use. Pick a time slot, enter name, choose role from a preset list. No login required. Confirmation screen shows shift details. Coordinator sees all sign-ups in a live list."

gen "volunteer-checkin-kiosk" \
  "Volunteer check-in station. Look up your name from today's roster, tap to check in, see arrival time and role. Coordinator gets a live view of who has arrived and who is still expected."

gen "volunteer-hours-log" \
  "Volunteer hours log. Submit name, date, event, hours worked, and tasks completed after a shift. Coordinator reviews and approves entries. Shows totals by volunteer and by event with simple data export."

gen "event-roster-slots" \
  "Event volunteer roster builder. Create role slots with times and headcounts. Volunteers claim slots with name and contact. Shows filled vs open capacity. Coordinator can close full slots. Shareable link."

gen "volunteer-onboarding" \
  "New volunteer onboarding form. Collects emergency contact, role preferences, photo release consent, and simple liability waiver. Marks completion status. Coordinator sees a list of completed onboarding submissions."

wait
echo "ALL DONE" >> "$LOG"
echo "--- All generators finished. Check $LOG for results. ---"
