#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
USER_SLUG="og"

gen() {
  local dir="$1" slug="$2"; shift 2
  local prompt="$*"
  ( cd "$dir" && "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$dir/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$dir/_status.log" ) &
}

# retro-arcade: 2 missing
gen /Users/jchris/code/landing-pages/vibes/games-retro-arcade maze-ghost-chase "Pac-style maze chase: dot-eat through a small maze while four chasers with distinct behaviors pursue. Arrow keys move. Power pellets briefly let you eat chasers. Lives, level counter. Save runs to Fireproof."
gen /Users/jchris/code/landing-pages/vibes/games-retro-arcade frog-traffic-hop "Frogger-style road crossing: a frog hops with arrow keys across a busy road then a log-river to safety. Cars and logs move at different speeds per lane. Lives, level counter. Save scores to Fireproof; show top 10."

# classic-platformer: 4 missing
gen /Users/jchris/code/landing-pages/vibes/games-classic-platformer coin-jump-platformer "Side-scrolling platformer: arrow keys to run, space to jump. Collect coins on floating brick platforms, avoid spike pits. Three short levels. Score = coins collected; finish time saved per level in Fireproof. Best times leaderboard below."
gen /Users/jchris/code/landing-pages/vibes/games-classic-platformer cave-spelunk-descent "Vertical platformer: descend a cave by dropping between ledges. Arrow keys move, space jumps up. Collect gems, avoid bats and spikes. Depth counter. Each run saves depth + gems to Fireproof; show top 10 descents."
gen /Users/jchris/code/landing-pages/vibes/games-classic-platformer ladder-barrel-climb "Climb-style platformer: ascend a tower of girders by ladders while rolling barrels descend at varying speeds. Arrow keys move, space jumps. Reach the top to win the level. Lives, level counter. Save runs in Fireproof."
gen /Users/jchris/code/landing-pages/vibes/games-classic-platformer dash-precision-platformer "Precision platformer with mid-air dash: arrow keys move, space jumps, shift dashes once per air-time. Tight spike traps and floating platforms. Three rooms. Track per-room best time in Fireproof; ghost-time replay of your best."

# modern: 2 missing
gen /Users/jchris/code/landing-pages/vibes/games-modern swipe-shape-puzzle "Swipe-merge puzzle on a 4x4 grid: tiles slide on swipe, matching tiles merge and increase value (2 to 4 to 8 ...). Game ends when no moves remain. Score saved per game in Fireproof; daily best and lifetime best displayed."
gen /Users/jchris/code/landing-pages/vibes/games-modern rhythm-tap-circles "Rhythm tap: circles appear on screen on the beat; tap each when it reaches the target size. Three tracks of preset beat patterns. Combo counter, accuracy percentage. Save best run per track in Fireproof; show ranks (S/A/B/C)."

# sports: 3 missing
gen /Users/jchris/code/landing-pages/vibes/games-sports mini-putt-drag-aim "Mini golf: drag from the ball to aim and set power, release to shoot. Top-down course with walls, sand traps, and one hole. Nine holes, par per hole, stroke counter. Save scorecards in Fireproof; show best round and last 10 rounds."
gen /Users/jchris/code/landing-pages/vibes/games-sports bowling-lane-strike "Ten-pin bowling: aim with the arrow keys, set power with a power meter, release to roll. Standard 10-frame scoring including strikes and spares. Save games in Fireproof; show recent games and best."
gen /Users/jchris/code/landing-pages/vibes/games-sports air-hockey-puck-duel "Air hockey: two paddles, one puck, top and bottom goals. Mouse or touch drag your paddle; CPU controls the other side. First to 7 wins. Choose CPU difficulty. Save match results in Fireproof; win/loss record shown."

wait
echo "RETRY ALL DONE" >> /Users/jchris/code/landing-pages/vibes/_retry_status.log
