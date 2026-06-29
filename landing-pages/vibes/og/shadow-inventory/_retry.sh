#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/shadow-inventory"
cd "$HERE"

# Pin the publishing namespace explicitly so a stale `vibes-diy login`
# default (account swap, re-auth, CLI upgrade) cannot land deploys at the
# wrong user-slug. See src/pages/featured-apps/README.md for context.
USER_SLUG="og"

STYLE='STYLE — Vault. Load Google Fonts: Space Mono, Inter (display=optional). Body Inter 1rem; mono labels in Space Mono for IDs/SKUs/dates. Background bg oklch(0.08 0.03 280) (deep purple-near-black). Cards card-bg oklch(0.12 0.03 280 / 0.7) with backdrop-blur. Borders oklch(0.65 0.15 80 / 0.12) (faint amber-tinted hairlines). Foreground text oklch(0.93 0.02 80) (warm cream). Muted oklch(0.50 0.04 290) (dim purple). Accent oklch(0.72 0.15 75) (warm amber); accent-text oklch(0.10 0.03 280) (near-bg). Secondary purple oklch(0.55 0.18 300) for special states. Sharp corners. Layout: a fixed-width inventory ledger with monospace SKU column, item name in Inter, quantities right-aligned in Space Mono. Status pips: small 8px squares (amber filled = available, dim purple = checked-out, red = missing/overdue). Buttons: amber background, near-bg text, hover deepens to purple. Inputs: transparent with amber bottom-border; quantity inputs are square 64px boxes monospace. Tone: a back-of-house ledger app, not corporate SaaS — low-light warehouse vibes. Single-file React with useFireproof; persist as inventory mutations with full audit log below.'

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

gen lab-sample-custody "Lab Sample Chain of Custody — small bio/chem teams below LIMS scale. Each sample has a unique ID, type (BLOOD / SOIL / CULTURE / TISSUE / OTHER), date collected, current custodian, current location (FREEZER A / BENCH / IN TRANSIT). Every handoff writes a Fireproof doc { sampleId, from, to, ts, freezer-temp, notes }. The home view: a strict ledger sorted by sample ID. Click any sample to see its full custody chain (every handoff in chronological order). A red flag for any sample >7 days without a custody event (potentially lost). $STYLE"
gen customer-gift-inventory "Customer Gift Inventory — country regulatory caps + rep request log. Pre-populate gift items (mugs, gift cards, books) with cost-basis. Pre-populate countries with their gifting cap (e.g. US 50, JP 0, DE 30). Reps request gifts for a customer in a specific country. The app validates the request against the country cap and either approves or flags for legal review. Each request is a Fireproof doc; legal review is a separate doc that approves/denies. The home view: pending requests at the top, then a country-by-country gift-spend ledger this quarter. $STYLE"
gen loaner-laptop-pool "Loaner-Laptop Pool — execs and contractors, IT inventory ignores it. Each laptop has a SKU, model, OS, condition, current holder. The IT-admin view: ledger of all loaners with status pips. The user-self-service view: a [ REQUEST LOANER ] form (purpose: travel / contractor / break-fix / event) that creates a Fireproof request doc. The admin assigns from available pool — the assignment doc moves the laptop to that holder. Returns include damage notes + IT-checkup checklist. Audit log shows every transition. Overdue (>30 days) flagged red. $STYLE"
gen prototype-checkout "Prototype Hardware Checkout — engineering loaners, no IT system covers. Each prototype has a serial number, hardware version, current owner, current state (POWERED / IN-DEV / BENCH / FIELD). Engineers [ CHECK OUT ] with a project tag and ETA. Returns include a state-update note (was-bench, now-broken, etc). Each event is a Fireproof doc. The home ledger: prototypes sorted by serial; click a prototype to see its full lineage. A field-deployment view shows all units currently in FIELD with their owner + project. NDA flag per item gates visibility. $STYLE"
gen av-gear-pool "Internal AV Gear Pool — internal media team, 5 cameras, 12 lavs, tracked in nothing. Pre-populate with cameras (with serial), lavalier mics, lights, tripods, SD cards. Each item has condition + last-used. The home view: ledger of all gear with status pips. Producers [ RESERVE ] gear for a shoot (specify shoot name, dates, items). The app validates no-double-bookings. Each reservation is a Fireproof doc. Past shoots show what gear came back vs what got lost. A daily check-in: producers note any malfunctions. $STYLE"

wait
echo "ALL DONE RETRY" >> "$HERE/_status.log"
