#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/bike-summer"
cd "$HERE"

USER_SLUG="jchris"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen bike-summer-ride-log "Personal Bike Summer season tracker. Tap a ride title to mark it done, add a one-line note. Shows how many rides you've logged this season. Style: broadsheet newspaper community board."

gen bike-crew-builder "Bike ride crew builder. Enter a ride name, share a link. Friends tap to join and show their name. See everyone who is rolling. Style: guild collective warm."

gen bike-ride-host-kit "Ride leader checklist for hosting a Pedalpalooza ride. Covers what to post, route planning, corking basics, no-drop etiquette. One checklist per hosted ride. Style: bold poster minimal."

gen pedalpalooza-memory-wall "Post-ride memory wall for Bike Summer. Drop a one-line story or emoji after a ride. Crew sees all season posts in a live feed. Style: scrapbook paper warm."

wait
echo "ALL DONE" >> "$HERE/_status.log"
