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

gen "cabin-arrival-tracker" "Camp check-in board. List of campers with name, cabin assignment, and arrival status (expected / arrived / on bus). Staff tap to mark arrived. One screen, no login."

gen "counselor-duty-board" "Today's duty rotation for camp staff. Slots: kitchen, waterfront, flag ceremony, evening program, overnight. Each slot shows who's assigned. Swap button sends a notification."

gen "activity-block-signup" "Summer camp activity sign-up. Three activity blocks per day (morning, afternoon, free choice). Each block has a list of activities with capacity. Campers add their name to one per block."

gen "camp-lost-found" "Camp lost-and-found board. Anyone posts an item: photo, description, location found. Claim button with your name. Items disappear once claimed."

gen "pickup-log" "End-of-session pickup tracker. List of campers. Staff mark each one picked up: time, name of adult, relationship. Running total of who's still waiting."

wait
echo "ALL DONE" >> _status.log
