#!/usr/bin/env bash
set -euo pipefail

LOG=vibes/road-trip/_status.log
> "$LOG"

gen() {
  local slug="$1"
  local prompt="$2"
  npx vibes-diy@latest generate --user-slug=og --app-slug="$slug" "$prompt" \
    >> "$LOG" 2>&1
  echo "DONE $slug exit=$?" >> "$LOG"
}

gen road-signpost \
  "Community corkboard for road travelers. Each entry: a location name (text field), a short tip (1–3 sentences), and an optional direction note. Entries sorted newest first. No accounts — just add and share. Anyone can add an entry with a location name and tip text. Dark background, warm amber accent color, minimal UI. Fireproof for offline persistence." &

gen road-party-finder \
  "Spontaneous gathering coordinator for road trippers. Single active gathering per link: spot name, 'here until' date/time, and a list of who's coming. Anyone with the link taps to add their name. Live list updates. Dark campfire aesthetic with warm amber accent. Fireproof for offline-first sync." &

gen road-resource-share \
  "Crowdsourced resource finder for road travelers. Add a spot: type (water / electricity / dump station / free overnight / gas), location name, brief note. Browse entries by type using filter tabs. Newest first. Fireproof for offline persistence. Dark background, warm ember tones, minimal." &

gen road-encounters \
  "Personal travel journal of people met on the road. Each entry: name, where you crossed paths (location field), one thing you remember (text area). Entries in reverse chronological order. Private — stored locally in Fireproof. Warm intimate aesthetic, dark campfire palette, serif-inspired feel." &

gen route-advisor \
  "Road trip route chooser. User enters: where they are now (text), roughly where they're headed (text). Tap 'Get Routes' to receive three route options generated as short descriptions: The Fast One, The Beautiful One, The Weird One. Each gets a 2–3 sentence description of what to expect on that path. Fireproof saves last 3 queries. Minimal atmospheric UI, dark background, warm amber text." &

wait
echo "=== ALL DONE ===" >> "$LOG"
cat "$LOG"
