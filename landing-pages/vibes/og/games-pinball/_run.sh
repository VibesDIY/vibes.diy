#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/games-pinball"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen flipper-physics-arcade "Single-ball pinball: two flippers (A and L keys), three pop bumpers, side rails, drain at bottom. Ball physics with gravity and bumper kick. Score increments on bumper hits, persists per-game in Fireproof. Show last 10 game scores below the playfield."

gen pachinko-drop-grid "Pachinko: a vertical grid of pegs. Tap the top to drop a ball; it bounces randomly through pegs into one of 7 scoring slots at the bottom (slot values vary). Each drop saves the score in Fireproof. Daily total and ball-by-ball log displayed."

gen pinball-leaderboard-daily "Mini one-key pinball (space to launch and flip both flippers): one ball, score on every bumper, drain ends run. After each run, save name + score to Fireproof. Today's top 10 highlighted; yesterday and all-time tabs below."

gen multiball-bumper-bash "Pinball with three balls in play simultaneously. One pair of flippers, four bumpers, drain. Each bumper hit scores; balls multiply briefly when hitting a center target. Show ball-in-play count and round score. Fireproof saves rounds."

gen tilt-gyro-flippers "Pinball where flippers are triggered by tilting the phone left/right (DeviceOrientation API; fall back to A/L keys). One ball, three bumpers, drain. Calibrate-tilt button. Each session saves to Fireproof; show tilt-sensitivity slider and last 5 scores."

gen dot-matrix-pinball-replay "Pinball that records the ball's path during play and replays your best run on a dot-matrix-style overlay above the playfield. One ball, two flippers, three bumpers. Each round saves path + score in Fireproof; replay any past round from a list."

wait
echo "ALL DONE" >> "$HERE/_status.log"
