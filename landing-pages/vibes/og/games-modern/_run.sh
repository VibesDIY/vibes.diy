#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/games-modern"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen endless-tap-runner "One-tap endless runner: a character auto-runs along a path; tap (or space) to switch lanes left/right. Avoid obstacles, collect orbs. Speed ramps over time. Distance + orbs saved per run in Fireproof. Today's best vs lifetime best."

gen merge-fruit-stack "Suika-style merge: drop circles from the top; same-sized circles merge into the next bigger size on collision. Box has a max height; reaching the top ends the run. Score = merge chain. Save scores to Fireproof; high score table."

gen idle-tap-empire "Idle clicker: tap a central button to earn coins; coins buy auto-tappers that generate per-second income; auto-tappers upgrade. Five upgrade tiers. State persists in Fireproof so you keep earning across sessions. Show coins/sec and total earned."

gen swipe-shape-puzzle "Swipe-merge puzzle on a 4x4 grid: tiles slide on swipe, matching tiles merge and increase value (2 to 4 to 8 ...). Game ends when no moves remain. Score saved per game in Fireproof; daily best and lifetime best displayed."

gen bubble-pop-cascade "Bubble shooter: aim and fire colored bubbles upward; matching three or more of the same color pops them and any disconnected bubbles fall. Clear the board to win. Levels of increasing density. Save scores to Fireproof."

gen rhythm-tap-circles "Rhythm tap: circles appear on screen on the beat; tap each when it reaches the target size. Three tracks of preset beat patterns. Combo counter, accuracy percentage. Save best run per track in Fireproof; show ranks (S/A/B/C)."

wait
echo "ALL DONE" >> "$HERE/_status.log"
