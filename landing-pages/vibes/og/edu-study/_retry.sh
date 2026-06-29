#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/edu-study"
cd "$HERE"
USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status-retry.log" ) &
}

: > "$HERE/_status-retry.log"

gen quote-flip-v2 "Party flashcard app with movie and TV quotes. Front shows quote, back shows character and show. Tap to flip. GOT IT removes it, NOPE shuffles back. Tracks score. AI generates new decks from any genre the user types."

gen vocab-deck-v2 "Vocabulary study flashcard app. User types a topic, AI builds a deck of term-definition pairs. Tap card to flip. Mark Known or Still Learning. Progress bar fills as deck drains. Persist decks in Fireproof."

gen exam-drill-v2 "Certification exam flashcard app with three confidence levels. KNEW IT, UNSURE, MISSED IT. Missed cards come back next. Cards need two consecutive KNEW ITs to graduate. Confidence dots on each card. AI generates deck from any domain."

gen type-quiz-v2 "Personality quiz with no right answers. 8 questions, each option maps to an archetype: Architect, Wildcard, Diplomat, or Analyst. Tally the most-chosen archetype. Result screen shows archetype name, description, and shareable copy text."

gen knowledge-check-v2 "AI-powered knowledge check quiz. User types a topic, AI generates 10 multiple-choice questions. Answer one at a time, confirm, see correct answer. Score at end with pass badge at 70%. Review all questions. Fireproof persistence."

gen exam-practice-v2 "Timed practice exam. AI generates 20 questions in 3 sections. 45-second countdown per question. Section-by-section score breakdown. Pass/fail verdict at configurable threshold. Explanation shown after each answer. Resume on reload."

wait
echo "ALL DONE" >> "$HERE/_status-retry.log"
