#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/.claude/worktrees/worktree-tailgate/vibes/tailgate"
cd "$HERE"
USER_SLUG="og"

gen() {
  local slug="$1"; local theme="$2"; shift 2; local prompt="$*"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen "tailgate-food-signup" "broadsheet" \
  "Tailgate food and drink signup. Categories: grillables, sides, snacks, drinks, desserts. Enter your name and what you're bringing. Show totals per category so people know what's covered. No login, shareable link."

gen "carpool-board" "capsule" \
  "Game day carpool board. Drivers post their car, number of open seats, departure time, and general area. Riders claim a seat by adding their name. Show who still needs a ride and who has space. No login, one shared link for the crew."

gen "grill-time" "poster" \
  "Grill time slot signup for a tailgate. Enter your name, what you're cooking, and how many minutes you need. Show the queue in order. First come first served. Keep it simple and fast."

gen "cooler-split" "guild" \
  "Group cooler fund tracker for a tailgate. Track who contributed money toward shared supplies (beer, ice, drinks). Show each person's contribution, total collected, and a running list of what was purchased. Use plain, friendly language — no fantasy or medieval vocabulary. Normal words for normal people."

gen "gameday-checklist" "hearth" \
  "Tailgate gear checklist. Items needed: folding chairs, portable grill, cooler, charcoal, lighter, paper plates, napkins, trash bags, parking pass, pop-up tent. Anyone can claim what they're bringing. Show what's still unclaimed. No login, one link for the crew."

wait
echo "ALL DONE" >> "$HERE/_status.log"
