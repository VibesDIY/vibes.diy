#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/games-retro-arcade"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen snake-arcade-leaderboard "Classic snake: arrow keys move a growing snake on a grid; eat food pellets, don't hit walls or yourself. Speed ramps with length. Game over saves name + score to Fireproof. Show today's top 10 and lifetime best to the side."

gen brick-breaker-paddle "Breakout: paddle at bottom (mouse or arrow keys), ball bouncing off bricks at top. Five rows of bricks; clear all to win. Lives counter. Each game saves score in Fireproof; show recent games and high score below the play area."

gen asteroid-vector-shooter "Asteroids in vector style: triangle ship, rotate with left/right, thrust with up, fire with space. Floating asteroids split when shot. Wrap-around screen. Wave counter. Save score on death; show top 10 runs."

gen space-invader-defender "Space invaders: a row-grid of aliens marches left/right and down toward your ship at the bottom. Move with arrow keys, fire with space. Three barriers absorb hits. Wave counter, lives, score. Save runs to Fireproof."

gen maze-ghost-chase "Pac-style maze chase: dot-eat through a small maze while four chasers with distinct behaviors pursue. Arrow keys move. Power pellets briefly let you eat chasers. Lives, level counter. Save runs to Fireproof."

gen frog-traffic-hop "Frogger-style road crossing: a frog hops with arrow keys across a busy road then a log-river to safety. Cars and logs move at different speeds per lane. Lives, level counter. Save scores to Fireproof; show top 10."

wait
echo "ALL DONE" >> "$HERE/_status.log"
