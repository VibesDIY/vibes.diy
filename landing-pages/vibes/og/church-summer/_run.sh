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

gen "vbs-station-signup" "VBS volunteer station signup. Stations: Bible story, crafts, snacks, games, music, check-in. Each station needs 2 volunteers per day. People add their name to a slot. Shows gaps at a glance."

gen "snack-contribution-list" "Church event snack signup. Upcoming events listed. Each event has items needed (drinks, fruit, chips, paper goods). People claim one item. No duplicates, no coordinator calls."

gen "kids-camp-roster" "Summer kids camp roster. Each child: name, age, grade, parent contact, allergy notes, cabin or group. Staff can view and filter. No login required to read."

gen "summer-smallgroup-finder" "Church summer small groups directory. Each group: topic, day/time, location, leader name, spots left. Tap to express interest. Simple, no account."

gen "sunday-volunteer-slots" "Sunday kids room volunteer schedule. Six Sundays listed. Each Sunday has roles: greeter, teacher, helper. People add their name to a slot. Shows who still needs coverage."

wait
echo "ALL DONE" >> _status.log
