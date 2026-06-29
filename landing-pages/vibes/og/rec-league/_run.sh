#!/usr/bin/env bash
set -euo pipefail
USER_SLUG="og"
cd "$(dirname "$0")"
> _status.log

gen() {
  local slug="$1"; local prompt="$2"
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >> _status.log 2>&1 && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "game-sub-finder" "Rec league substitute finder. Can't make the game? Post the game details and your position. Available subs respond with their name. One page, no account, link shared in the team chat."

gen "team-roster-builder" "Rec league team roster. Each player: name, phone, position, experience level (casual/competitive), t-shirt size. Captain can share a link for players to add themselves."

gen "game-day-confirmation" "This week's game confirmation. Shows game time, field, and team roster. Players tap to confirm they're coming or mark themselves out. Captain sees headcount at a glance."

gen "season-score-tracker" "Rec league season scoreboard. All games listed with date, opponent, and score. Anyone can update after the game. Running win/loss record at the top."

gen "equipment-checkout" "Team equipment tracker. Items: game balls, training cones, pinnies (by color), first aid kit, pump. Player checks out an item with their name. Returns it when done. What's missing at a glance."

wait
echo "ALL DONE" >> _status.log
