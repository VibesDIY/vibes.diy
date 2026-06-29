#!/usr/bin/env bash
set -u
HERE="/Users/jchris/code/landing-pages/vibes/golf-league"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen golf-scorecard "Digital golf scorecard for casual leagues. Track strokes per hole for multiple players across 18 holes. Auto-total gross and net scores. Supports stroke play and stableford. Share results with the group via link."

gen golf-handicap-tracker "Golf handicap tracker for informal leagues. Log each round score and course rating. Running handicap index updates after every entry. Shows differential trend over the season. No USGA membership needed."

gen golf-league-standings "Golf league season standings. Commissioner posts weekly round results. League table tracks points, wins, and net scores across the season. One shareable link for the whole group."

gen skins-game-tracker "Golf skins game tracker. Log hole-by-hole skins results with carryovers and side bets. End-of-round totals show who owes what. No arguments at the 19th hole."

gen tee-time-signup "Golf tee time sign-up board. Post an upcoming round with date and time. Group members sign up. Caps at 4 per tee. Shows who is committed and who is still deciding."

wait
echo "ALL DONE" >> "$HERE/_status.log"
