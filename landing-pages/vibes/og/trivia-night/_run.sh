#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/trivia-night"
cd "$HERE"

USER_SLUG="jchris"

SPEC='Live multi-team trivia night app.

LANDING: two big buttons, HOST or JOIN.

HOST flow: pick a game name, app generates a 4-letter join code and shows a big QR pointing at the join URL (with code prefilled). Host manages a deck of questions; each question has a prompt, 4 options, and one correct option index. Buttons: "Next Question" reveals it to all joined phones; "Show Answer" reveals correctness and updates scores. Include an AI button: "Generate 10 questions about <topic>" using callAI with a schema returning {questions: [{prompt, options:[string,string,string,string], correctIndex:int}]}.

JOIN flow: enter the 4-letter code and a team name. When host reveals a question, every joined phone shows the prompt with a 20-second countdown synchronized via Fireproof useLiveQuery (compute remaining time from a revealAt timestamp on the game doc). Tap an option; locked when timer ends. After host taps Show Answer, every phone reveals which option was right and updates the leaderboard live.

PERSIST in Fireproof: game doc (code, name, currentQuestionId, revealAt, status), question docs, team docs (name, score), answer docs (teamId, questionId, optionIndex). Use useLiveQuery for synchronization across host and joiners.

STYLE:'

gen() {
  local slug="$1"; shift
  local style="$*"
  local prompt="$SPEC $style"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen pub-trivia-night "Late-night pub aesthetic — chalkboard slate background, condensation glow, beer-mat sticker textures, warm amber + cream + brick red, chunky condensed display type, hand-drawn divider rules, the QR rendered like it's chalked on a board."

gen family-trivia-room "Saturday-night board-game energy — bright primaries (tomato red, mustard yellow, royal blue, kelly green) on warm cream, big rounded chunky cards with thick black borders, friendly rounded sans (Fredoka or Quicksand), illustrated dice and pawn ornaments, kid-and-grandparent friendly contrast."

gen office-trivia-pulse "Quarterly offsite chic — muted slate gray base, single brand blue accent (#3b82f6), generous whitespace, clean sans (Inter), subtle shadows, professional restraint, fits next to Slack and Linear, no clipart, no childishness."

gen faculty-trivia-hall "Donnish faculty lounge — burgundy leather background, brass + parchment surfaces, Garamond or Crimson Pro serif for questions, brass-plate team-name badges, oak-panel sidebar texture, gold rule lines, scholarly restraint, slight library-stamp feel on the leaderboard."

gen dj-decks-trivia "After-hours club poster — near-black background, electric magenta + cyan accents, monospace + chunky display type (Space Grotesk and JetBrains Mono), VU-meter style countdown bar, slight CRT scanline overlay on the question card, glitch-shift transform on answer reveal."

wait
echo "ALL DONE" >> "$HERE/_status.log"
