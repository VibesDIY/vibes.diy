#!/usr/bin/env bash
set -u
HERE="/Users/jchris/code/landing-pages/vibes/fantasy-league"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen fantasy-draft-board "Fantasy sports live draft board. Commissioner runs it in real time. Each pick logs instantly and everyone in the room sees the same board update. Works for football, baseball, and soccer drafts."

gen fantasy-power-rankings "Fantasy league weekly power rankings app. Commissioner posts rankings with a short hot take per team. League members comment and react. The whole point is the bulletin board fuel."

gen trade-proposal-tracker "Fantasy sports trade proposal tracker. Log trade offers between teams. League members vote to approve or veto each deal. Full history for the season with no disputed trades."

gen fantasy-trash-talk-wall "Fantasy league trash talk wall. Dedicated feed for smack talk, victory laps, and taunts after big wins. Reactions and reply threads. Keeps the main group chat from getting buried."

gen waiver-wire-log "Fantasy sports waiver wire log. Track every free agent claim and drop across the season. Log waiver priority order. Searchable history so nobody disputes who picked up what."

wait
echo "ALL DONE" >> "$HERE/_status.log"
