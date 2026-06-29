#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

USER_SLUG="og"

gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  echo "Starting $slug..." >> _status.log
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> "${slug}.log" 2>&1 \
    && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

# 1. Party WYR — spotlight
gen "wyr-party-mode" "neon" \
  "Would You Rather party game. Two wild options flash on screen, everyone in the room votes in real time, the split reveals who's boring and who's feral. Hot takes, social chaos, instant replay."

# 2. Deep / existential WYR
gen "wyr-deep-cuts" "vault" \
  "Philosophical Would You Rather. Time vs money, fame vs anonymity, knowing the day you die vs not knowing. Moody and contemplative. Show how the world split on each question."

# 3. Food battle WYR
gen "wyr-food-battle" "scrapbook" \
  "Food-only Would You Rather face-offs. Pizza vs tacos, sushi vs burgers, hot coffee vs iced. Real-time vote percentage after you answer. Crown the most divisive food."

# 4. Superpower WYR
gen "wyr-superpower-showdown" "rift" \
  "Superpower Would You Rather. Fly vs invisible, read minds vs see the future, super strength vs teleportation. Reveal what your picks say about your personality."

# 5. Mundane / micro-decision WYR
gen "wyr-tiny-decisions" "broadsheet" \
  "Mundane everyday Would You Rather. Always 10 minutes late vs always 10 minutes early. Never use punctuation vs never use capitals. Absurd micro-stakes decisions with deadpan presentation."

# 6. Family / kids WYR
gen "wyr-family-silly" "neomario" \
  "Kid-safe Would You Rather for family game night. Silly animal and food scenarios — be a talking dog vs a flying cat, eat only pizza vs only ice cream forever. Big choices, zero consequences."

wait
echo "ALL DONE" >> _status.log
