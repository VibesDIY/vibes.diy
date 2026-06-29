#!/usr/bin/env bash
# Organizer / event-production apps — batch generator
# Audience: event producers, AV crews, church production, theatre stage managers
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

# Spotlight: the run-of-show board — #1 pain for every crew
gen "live-run-sheet" \
  "Live run-of-show board for event crews. Each row: cue number, time, responsible person, status. Tap a row to mark it fired. Everyone on crew sees the same live state — no more stale PDFs. AV teams, church production, theatre."

# Supporting apps
gen "show-gear-checklist" \
  "Shared AV and production gear checklist. Add items with who is responsible. Mark each packed or missing. Everyone on crew sees the same live list. Gaps highlight red. Use it during load-in and strike."

gen "event-crew-roster" \
  "Event day crew roster. Add crew members with role, phone, and check-in status. Everyone taps to mark themselves arrived. Coordinator sees a live board of who's here, who's still en route, who's a no-show."

gen "on-site-vendor-contacts" \
  "Event day vendor and supplier directory. Add name, company, phone, what they handle. Searchable from any phone on-site. No more forwarding emails five minutes before doors open."

gen "post-show-debrief" \
  "Anonymous post-event debrief form for crew. Rate coordination, communication, and gear by category. Add free-text notes. Organizer reads a live aggregate summary immediately after strike."

wait
echo "ALL DONE" >> "$LOG"
echo "--- All generators finished. Check $LOG for results. ---"
