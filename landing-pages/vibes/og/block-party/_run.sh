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

gen "potluck-dish-signup" "Block party potluck signup. Categories: mains, sides, desserts, drinks, condiments. Each neighbor posts what they're bringing with how many servings. No duplicates within category."

gen "block-party-setup-crew" "Block party setup and teardown crew signup. Shifts: setup Saturday 9am, event crew noon, teardown 5pm. Each shift needs 6 people. Name and phone number to sign up."

gen "neighbor-contact-list" "Neighborhood contact directory. Each household: name, address on the block, phone, email (optional). Anyone on the block can add their entry. Shared link, no login."

gen "street-permit-checklist" "Block party permit task list. Steps to get a street closure permit: contact city, submit form, notify utilities, post signs, confirm closure. Each task: who owns it, done or not."

gen "supply-donation-list" "Block party supply contribution list. Items needed: folding tables, folding chairs, extension cords, coolers, trash cans, canopies. Neighbors claim what they can bring. Shows what's still needed."

wait
echo "ALL DONE" >> _status.log
