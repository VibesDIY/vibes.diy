#!/usr/bin/env bash
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

gen "relationship-quiz-maker" "hearth" "Custom relationship quiz builder. Create a 'how well do you know me?' quiz with your own questions, photos, and inside jokes. Share a link to see how your partner scores."
gen "anniversary-countdown" "codex" "Anniversary countdown with daily memories. Set a date. Each day leading up, add a photo or memory. On the day, it reveals everything. Perfect for a surprise reveal."
gen "date-night-picker" "capsule" "Date night random activity picker. Add your favorite activities in categories (stay in, go out, adventurous, chill). Spin the wheel when you can't decide."
gen "love-letter-album" "guild" "Digital love letter and memory album. Add letters, notes, photos, and memories. Each entry has a date and a mood tag. Private and sharable."
gen "galentines-tribute" "proof" "Galentine's tribute page for a best friend. Add photos, inside jokes, shared memories, a playlist, and reasons they matter. Shareable as a permanent celebration page."

wait
echo "ALL DONE" >> _status.log
