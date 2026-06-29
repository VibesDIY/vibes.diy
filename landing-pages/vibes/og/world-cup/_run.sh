#!/usr/bin/env bash
set -u
HERE="/Users/jchris/code/landing-pages/vibes/world-cup"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen world-cup-bracket-picks "World Cup bracket prediction app. Group members enter picks stage by stage before kickoff. Points auto-calculate as results come in. Live leaderboard for the whole tournament. Share via link, no login needed."

gen match-score-predictor "Match score predictor for World Cup. Players guess exact scorelines before each game. Points for correct outcome plus bonus points for guessing the exact score. Running standings update live."

gen watch-party-planner "Watch party planner for World Cup matches. Propose venues and times, group votes on best option. Confirm the plan and share via link. Covers the full tournament schedule."

gen fan-loyalty-wall "World Cup fan loyalty wall. Each person claims a national team. Live board tracks whose countries are still alive through each stage. Celebrates wins and records eliminations."

gen pool-standings-board "World Cup pool leaderboard. Commissioner enters match results. Everyone watches their group ranking update in real time. One shareable link for the whole pool, no spreadsheet needed."

wait
echo "ALL DONE" >> "$HERE/_status.log"
