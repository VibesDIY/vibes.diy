#!/usr/bin/env bash
cd "$(dirname "$0")"
USER_SLUG="og"
> _status.log

gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> _status.log 2>&1 \
    && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "daily-specials-board" "broadsheet" \
  "Digital whiteboard for today's specials. Owner types the dish, price, and a note from their phone; a public view shows it live. Resets each morning."

gen "catering-quote-form" "proof" \
  "Catering inquiry form. Client fills event date, headcount, dietary needs, budget. Owner sees a clean summary and can mark it quoted or booked."

gen "kitchen-prep-checklist" "terminal" \
  "Opening and closing checklist for a kitchen. Staff check off tasks each shift. Shows who checked what and when. Resets daily."

gen "loyalty-stamp-card" "hearth" \
  "Digital loyalty punch card. Tap to add a stamp. Ten stamps earns a free item. Owner sets the reward. No app install needed."

gen "food-truck-location-ping" "poster" \
  "Food truck location board. Owner posts where they're parked today with a one-tap update. Regulars check the current spot. Auto-archives at midnight."

wait
echo "ALL DONE" >> _status.log
