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

gen shared-grocery-run \
  "Shared grocery list for a house or friend group. Anyone adds items with quantity. Claim items you're picking up so there's no duplication. Check off what you got. Running total per person of what they spent. Shared link, no login."

gen chore-rotation-board \
  "Chore rotation board for roommates or a family. Weekly rotating assignments. Anyone can propose a swap. Tracks completion streaks. Simple — just names, chores, and checkboxes. No gamification, no rewards, just accountability."

gen group-expense-split \
  "Group expense tracker for trips, dinners, shared living. Anyone adds an expense with who it was for. Calculates who owes who. Settlement suggestions. Running balance per person."
