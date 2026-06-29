#!/usr/bin/env bash
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

# Pin namespace explicitly; CLI default can drift.
HANDLE="og"

gen() {
  local slug="$1"; local theme="$2"; shift 2
  local prompt="$*"
  local theme_spec
  theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  (
    npx vibes-diy@latest generate --handle "$HANDLE" --app-slug "$slug" \
      "Theme: $theme_spec

$prompt" >"$HERE/$slug.log" 2>&1
    echo "DONE $slug exit=$?" >> "$HERE/_status.log"
  ) &
}

: > "$HERE/_status.log"

# ── Spotlight ──
gen order-10k proof \
  "The 10-K of your fast food order. Paste items or upload a receipt photo. App parodies an SEC annual report: revenue (spend), COGS (calories), MD&A (one paragraph of dry commentary on this order), risk factors (ice cream machine, mid-shift swap, fries freshness), forward outlook. Save filings in Fireproof. Each filing gets a shareable card."

# ── Supporters ──
gen every-store-in broadsheet \
  "Every-store-in-city completionist tracker. Pick a chain and a city; the app shows every location and lets you check them off with a timestamped visit and a photo. Newspaper-broadsheet aesthetic. Personal completion percentage, leaderboard among friends. Save visits in Fireproof."

gen burger-partner hearth \
  "Burger Partner compatibility scorer. Two people enter their standing fast-food orders; the app rates compatibility (overlap on chains, sauce agreement, price gap, calorie gap, breakfast/lunch alignment) and writes a one-paragraph relationship verdict. Save couple profiles in Fireproof. Output a shareable card."

gen mascot-lore-card vault \
  "Mascot lore card generator. Pick a fast-food mascot (Ronald, the King, the Colonel, Jack, the Noid, Wendy). Generate an archival 'lore card' with era, status, controversies, key episodes, and a one-line elegy. Vault aesthetic — dark amber, archival. Save card collection in Fireproof."

gen from-the-machine terminal \
  "Kiosk-versus-human order ledger. Every fast food visit, log whether you ordered from a kiosk, the app, the drive-thru speaker, or a cashier. App tallies your automation ratio over time and projects when 'human cashier' will be a rare encounter. Terminal CRT aesthetic. Save log in Fireproof."

gen not-franchised codex \
  "Franchise ownership explorer. Look up a fast-food location and surface what's known about the operator: independent franchisee, multi-unit, corporate-owned. Codex aesthetic. Users annotate locations with notes ('Black-owned, opened 1987'). A communal field guide. Save annotations in Fireproof."

gen menu-passport poster \
  "Global menu passport. Browse a deck of fast-food items that exist only in specific countries (McAloo Tikki India, Teriyaki Burger Japan, McSpicy Paneer, Croque McDo France). Quiz mode guesses the country; passport mode tracks which you've tried. Poster aesthetic. Save passport in Fireproof."

wait
echo "ALL DONE" >> "$HERE/_status.log"
