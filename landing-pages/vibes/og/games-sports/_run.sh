#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/games-sports"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen mini-putt-drag-aim "Mini golf: drag from the ball to aim and set power, release to shoot. Top-down course with walls, sand traps, and one hole. Nine holes, par per hole, stroke counter. Save scorecards in Fireproof; show best round and last 10 rounds."

gen arc-basketball-flick "Basketball arcade: drag-and-flick the ball at a hoop on the right side of the screen. Arc physics with gravity; backboard and rim collisions. 60-second timer, score per make. Wind gust randomizer. Save sessions to Fireproof."

gen dartboard-bullseye-toss "Darts: a moving crosshair sways across a dartboard; click or tap to throw. Standard 501 scoring (subtract score per throw, finish on double). Three throws per turn. Save matches in Fireproof; lifetime average per dart shown."

gen bowling-lane-strike "Ten-pin bowling: aim with the arrow keys, set power with a power meter, release to roll. Standard 10-frame scoring including strikes and spares. Save games in Fireproof; show recent games and best."

gen air-hockey-puck-duel "Air hockey: two paddles, one puck, top and bottom goals. Mouse or touch drag your paddle; CPU controls the other side. First to 7 wins. Choose CPU difficulty. Save match results in Fireproof; win/loss record shown."

gen penalty-kick-keeper "Penalty kick: aim with the mouse or arrows, set power with a meter, shoot. The keeper dives based on your wind-up. Best of 5 round; switch to keeping side after. Save sessions in Fireproof; show win streak."

wait
echo "ALL DONE" >> "$HERE/_status.log"
