#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
USER_SLUG="og"

gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec
  theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> _status.log 2>&1 \
    && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

: > _status.log

gen "course-price-calculator" "vault" \
  "Calculator for course creators. Enter email list size, estimated conversion rate, and target monthly revenue. Shows the price point needed, expected sales, and breakeven analysis. Simple numeric inputs, clear output table."

gen "course-outline-builder" "codex" \
  "Outline builder for online courses. Input your topic and target audience, get a structured curriculum with modules, lessons, and learning objectives. Reorder items. Export as markdown."

gen "launch-waitlist-countdown" "broadsheet" \
  "Launch waitlist for a digital product. Email signup form, countdown timer to a configurable launch date, live subscriber count. Clean and shareable."

gen "lead-magnet-quiz" "poster" \
  "Lead magnet quiz for newsletter growth. Five questions that qualify readers by interest or skill level. Results page with personalized recommendations and email capture field."

gen "student-qa-board" "guild" \
  "Q and A board for online course students. Students post questions, upvote others. Instructor marks questions answered. Organized by module. Compact and focused."

wait
echo "ALL DONE" >> _status.log
