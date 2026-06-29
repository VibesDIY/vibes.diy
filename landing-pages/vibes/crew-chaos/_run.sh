#!/usr/bin/env bash
set -euo pipefail

gen() {
  local slug="$1"; shift
  npx vibes-diy@latest generate --user-slug=og --app-slug="$slug" "$@" &
  echo "STARTED $slug pid=$!" >> _status.log
  wait $!
  echo "DONE $slug exit=$?" >> _status.log
}

> _status.log

gen house-rules-scoreboard \
  "Scoreboard for any game your crew plays. Anyone in the room can change the rules mid-game — add a bonus round, change point values, rename teams. Real-time sync so everyone sees the score update instantly. Big bold numbers. Team colors. A history of rule changes so you can argue about them later."

gen cookout-playlist-queue \
  "Shared playlist queue for a cookout or party. Anyone adds songs by title. Anyone can bump a song up or veto it. The host has a now-playing view. Shows who added what. No login, just a shared link."
