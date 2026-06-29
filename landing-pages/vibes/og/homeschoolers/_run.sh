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

gen "curriculum-week-plan" "codex" "Weekly homeschool planner for one child. Fields per day: subject, resource/book, goal, done checkbox, notes. Simple weekly view. Parent fills it out each Sunday."
gen "reading-log-tracker" "capsule" "Book log for a homeschooled reader. Track: title, author, genre, pages read, date finished, a short narration/summary. Shows total books read this year."
gen "daily-learning-journal" "guild" "Daily homeschool journal entry. Date, what we studied, what was interesting, what was hard, a photo or drawing space. Builds a portfolio automatically."
gen "science-project-planner" "proof" "Science fair and big-project planner. Question/hypothesis, materials list with checkboxes, steps/timeline, observations log, and a conclusion section."
gen "portfolio-report-builder" "broadsheet" "Homeschool portfolio and state reporting helper. Log subjects, hours, attendance, learning samples. Generates a printable summary for end-of-year reporting."

wait
echo "ALL DONE" >> _status.log
