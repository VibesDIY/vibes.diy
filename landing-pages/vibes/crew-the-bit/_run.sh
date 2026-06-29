#!/usr/bin/env bash
set -euo pipefail

gen() {
  local slug="$1"; shift
  npx vibes-diy@latest generate --user-slug=og --app-slug="$slug" "$@" &
  echo "STARTED $slug pid=$!" >> _status.log
  wait $!
  echo "DONE $slug exit=$?" >> _status.log
}

> _status.log

gen bad-movie-draft \
  "Draft board for bad movie night. Each person in the group claims a movie for the next session. After watching, everyone rates it 1-5 on how bad-good it was. Season standings track who picks the best worst movies. Crown a champion each season."

gen dinner-picker-tournament \
  "Bracket tournament to decide where to eat. Everyone adds restaurant options. Random seeding into a single-elimination bracket. Head-to-head matchups — everyone votes. Winner advances. Final winner is where you're eating tonight."

gen superlatives-tracker \
  "Weekly superlatives for a friend group. Rotating categories each week — most likely to fall asleep first, best parking job, worst take, best snack choice. Everyone nominates, everyone votes. Running hall of fame across weeks."

gen bit-commitment-log \
  "A log of your friend group's running bits and inside jokes. Add a bit with a name and origin story. Track the last time someone deployed it. Rate each execution. Hall of fame for retired bits that had a good run."
