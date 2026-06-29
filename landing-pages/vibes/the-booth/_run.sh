#!/usr/bin/env bash
set -u
cd "$(dirname "$0")"
: > _status.log
USER_SLUG="og"

gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> _status.log 2>&1 && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "live-basketball-scoreboard" "console" \
"A live basketball scoreboard the whole crew updates from their phones. Two teams, tap +1/+2/+3 to score, foul counts, a quarter selector, and a game clock you can start, stop, and reset. Editable team names. Big readable digits."

gen "basketball-slang-glossary" "atlas" \
"A shared glossary for a basketball crew's invented slang and play names. Add a term, a definition, and an example. Search and filter alphabetically. Upvote the best entries."

gen "basketball-mvp-rankings" "broadsheet" \
"A weekly basketball MVP power ranking. Add players, cast votes each week, and see a ranked chart with bars showing vote totals. Track how the ranking shifts week over week."

gen "sports-hot-take-tracker" "poster" \
"A hot-take accountability board for a sports commentary crew. Post a bold prediction with who said it and the date. Later mark each take Correct or Cooked and keep a running scoreboard of who is most often right."

gen "broadcast-rundown-board" "dossier" \
"A run-of-show board for a basketball broadcast crew. List segments in order with a time, the host on the mic, and the topic. Reorder segments, check them off as they air, and total the runtime."

wait
echo "ALL DONE" >> _status.log
