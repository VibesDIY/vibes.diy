#!/bin/bash
LOG=vibes/camping/_status.log
> "$LOG"

gen() {
  local slug="$1"
  local prompt="$2"
  npx vibes-diy@latest generate --user-slug=og --app-slug="$slug" "$prompt" \
    >> "$LOG" 2>&1
  echo "DONE $slug exit=$?" >> "$LOG"
}

# Park Finder — prompt from file (contains embedded JSON)
(npx vibes-diy@latest generate --user-slug=og --app-slug="national-park-search" \
  "$(cat vibes/camping/park-finder-prompt.txt)" >> "$LOG" 2>&1
  echo "DONE national-park-search exit=$?" >> "$LOG") &

# Packing List
gen camp-gear-list "Camping group packing list. Categories: Shelter, Kitchen, Safety, Navigation, Personal. Each item: name, category, claimedBy (null if unclaimed), weight badge (light / medium / heavy). UI: items grouped by category. Each row shows item name, weight badge, and a Claim button — clicking prompts for the claimer's name and saves to Fireproof. Header per category shows count of unclaimed items. Add-item form at bottom: name input, category dropdown, weight dropdown. Persist all data in Fireproof. Simple and offline-first." &

gen camp-meal-plan "Camping meal planner for a trip. User can set number of days (2-7, default 3). Per day: Breakfast, Lunch, Dinner slots. Each slot: meal name and cook (Dinner slot only — who is cooking). UI: card grid, one column per day. Click any meal slot to edit name/cook inline. Below the grid: a shared shopping list textarea (persists in Fireproof). All data persists in Fireproof." &

gen group-trail-log "Group hiking log for a camping trip. Each entry: trailName, date (YYYY-MM-DD), distanceMi (number), elevationFt (number), difficulty (easy / moderate / hard / epic), hikers (comma-separated names), notes. UI: add-hike form at top. Below: list of all hikes, default sorted by date descending, toggle to sort by difficulty. Difficulty color badges: easy=green, moderate=yellow, hard=orange, epic=red. Stats bar at top: total miles, total elevation gain, hike count. Persist in Fireproof." &

gen camping-adventure-story "Choose-your-own-adventure camping story to read aloud at a campfire. Premise: you and your friends arrive at the trailhead as night falls. Three branching decision points, at least four different endings. One ending must involve a bear that is RIGHT THERE — not a far-off bear — a bear that is RIGHT THERE. Story tone: funny, warm, slightly spooky, written to be read aloud with dramatic pauses marked with ellipses. Each scene: title (h2), prose (2-3 paragraphs), 2-3 choice buttons. Terminal ending scenes show a star rating card (1-5 camp stars out of 5) with a Start Over button. Illustrated scenes: pure CSS art per scene (trees, mountains, moon, campfire, tent, bear as needed) — no external images. Design: dark navy #0D1117 background, warm amber #F4A300 for choice buttons and highlights, cream #FFF8E7 body text. Load Cinzel Decorative (Google Fonts) for scene titles, Crimson Text for prose." &

wait
echo "=== All generators finished ===" >> "$LOG"
