#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/science-kits"
cd "$HERE"
USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen "chemistry-reaction-log" "Log observations during a chemistry experiment — step label, color change, temperature, pH, notes, photo. Timestamped entries. Shareable result card at the end."
gen "circuit-build-guide" "Step-by-step assembly checklist for an electronics kit. Check off each component as you place it. Flag where you're stuck. Show completion percentage."
gen "plant-growth-tracker" "Daily measurement log for a plant biology kit. Height, photo upload, prediction vs actual. Auto-generates a growth timeline chart. Shareable."
gen "rocket-launch-log" "Pre-launch checklist, launch data entry (weather, angle, altitude estimate), post-flight notes. Shareable mission debrief card."
gen "experiment-discovery-board" "Gallery of completed experiments — title, photo, result summary, star rating. Shareable link. Works across any kit type."

wait
echo "ALL DONE" >> "$HERE/_status.log"
