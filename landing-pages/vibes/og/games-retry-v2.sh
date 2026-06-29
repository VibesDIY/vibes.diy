#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
USER_SLUG="og"
LOG="/Users/jchris/code/landing-pages/vibes/_rename_status.log"
: > "$LOG"

gen() {
  local dir="$1" slug="$2"; shift 2
  local prompt="$*"
  ( cd "$dir" && "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$dir/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$LOG" ) &
}

# retro-arcade
gen /Users/jchris/code/landing-pages/vibes/games-retro-arcade paddle-brick-bust "Breakout: paddle at the bottom moved by mouse or arrow keys, ball bouncing off five rows of bricks at top. Clear all bricks to win the round; lives counter. Scores and high score saved in Fireproof; recent games listed below the play area."
gen /Users/jchris/code/landing-pages/vibes/games-retro-arcade river-hop-frog "Frog-hop road crossing: a frog hops with arrow keys across a busy multi-lane road, then across a log-river to safety. Cars and logs move at different speeds per lane. Lives, level counter. Scores saved to Fireproof; show top 10."
gen /Users/jchris/code/landing-pages/vibes/games-retro-arcade pellet-maze-pursuit "Pellet maze pursuit: eat all the dots in a small maze while four chasers with distinct behaviors pursue you. Arrow keys to move. Power pellets briefly let you eat the chasers. Lives, level counter. Runs save to Fireproof."

# classic-platformer
gen /Users/jchris/code/landing-pages/vibes/games-classic-platformer side-scroll-coin-grab "Side-scrolling platformer: arrow keys run, space jumps. Collect coins on floating brick platforms, avoid spike pits. Three short levels. Score = coins; per-level finish time saved in Fireproof, best-times leaderboard below."
gen /Users/jchris/code/landing-pages/vibes/games-classic-platformer underground-gem-drop "Vertical descent platformer: drop between ledges into a cave. Arrows move, space jumps up. Collect gems, avoid bats and spike pits. Depth counter. Each run saves depth + gems to Fireproof; top 10 descents shown."
gen /Users/jchris/code/landing-pages/vibes/games-classic-platformer girder-climb-dodge "Tower-climb platformer: ascend girders by ladders while rolling barrels descend at varying speeds. Arrows move, space jumps. Reach the top to clear the level. Lives, level counter. Runs save to Fireproof."
gen /Users/jchris/code/landing-pages/vibes/games-classic-platformer air-dash-rooms "Precision platformer with mid-air dash: arrows move, space jumps, shift dashes once per air-time. Tight spike traps and floating platforms across three rooms. Per-room best time + ghost-time replay of your best in Fireproof."

# modern
gen /Users/jchris/code/landing-pages/vibes/games-modern beat-target-tap "Rhythm tap: targets appear on screen on the beat; tap each when it reaches the target size. Three preset beat patterns. Combo counter, accuracy percent, S/A/B/C ranking. Best per track saved in Fireproof; show ranks history."

# sports
gen /Users/jchris/code/landing-pages/vibes/games-sports drag-aim-putt "Mini golf: drag from the ball to aim and set power, release to shoot. Top-down course with walls and sand traps. Nine holes, par per hole, stroke counter. Scorecards saved in Fireproof; show best round and last 10 rounds."
gen /Users/jchris/code/landing-pages/vibes/games-sports strike-pin-bowl "Ten-pin bowling: aim with arrow keys, set power with a power meter, release to roll. Standard 10-frame scoring including strikes and spares. Games saved in Fireproof; recent games and best shown."
gen /Users/jchris/code/landing-pages/vibes/games-sports puck-paddle-duel "Puck-paddle duel air hockey: two paddles, one puck, top and bottom goals. Mouse or touch drags your paddle; CPU controls the other side. First to 7 wins. Choose CPU difficulty. Match results saved in Fireproof; win/loss record shown."

wait
echo "RENAME ALL DONE" >> "$LOG"
