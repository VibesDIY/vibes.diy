#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/games-classic-platformer"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen coin-jump-platformer "Side-scrolling platformer: arrow keys to run, space to jump. Collect coins on floating brick platforms, avoid spike pits. Three short levels. Score = coins collected; finish time saved per level in Fireproof. Best times leaderboard below."

gen cave-spelunk-descent "Vertical platformer: descend a cave by dropping between ledges. Arrow keys move, space jumps up. Collect gems, avoid bats and spikes. Depth counter. Each run saves depth + gems to Fireproof; show top 10 descents."

gen auto-runner-platforms "Auto-runner: character runs right continuously; tap or press space to jump over gaps and spike traps. Distance counter rises. Single death ends run. Save run distance to Fireproof; daily best and lifetime best shown."

gen ice-slide-jumper "Platformer with slippery ice physics: arrow keys steer, space jumps. Player keeps sliding after release. Collect snowflakes; reach the end flag. Three levels of increasing slick. Times saved per level in Fireproof."

gen ladder-barrel-climb "Climb-style platformer: ascend a tower of girders by ladders while rolling barrels descend at varying speeds. Arrow keys move, space jumps. Reach the top to win the level. Lives, level counter. Save runs in Fireproof."

gen dash-precision-platformer "Precision platformer with mid-air dash: arrow keys move, space jumps, shift dashes once per air-time. Tight spike traps and floating platforms. Three rooms. Track per-room best time in Fireproof; ghost-time replay of your best."

wait
echo "ALL DONE" >> "$HERE/_status.log"
