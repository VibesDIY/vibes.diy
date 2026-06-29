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

: > "$HERE/_status.log"

gen swag-closet "Marketing Swag Closet — t-shirts, stickers, tumblers, nobody owns it. Add items with SKU, name, size variants (S/M/L/XL), color, current count. Track checkouts: who took how many and when (for a trade show, a customer gift, etc). Each checkout is a Fireproof doc. Low-stock items (count < threshold) auto-flag amber. The home ledger shows all items in a strict table sorted by SKU; click any row to expand to its checkout history. A request box for items not yet stocked. Audit log below shows every mutation. $STYLE"

gen demo-unit-pool "Sales Demo Unit Pool — laptops/devices. 'Where is the demo?' Each device has a SKU, model name, condition, current holder. Reps can [ CHECK OUT ] (claim it for an event) and [ RETURN ] (with optional damage notes). Each event is a Fireproof doc { device, holder, ts, action, notes }. The home view: ledger of devices, status pip + holder name + last-action date. Filter by location, model, or available-only. A leaderboard of who-checks-out-most. Reminder system (visual badge) for devices held >14 days. Audit log below. $STYLE"

gen booth-gear "Conference Booth Gear — banners, scanners, cables, lives in a Sheet. Pre-populate with categories (BANNERS, SCANNERS, CABLES, LIGHTING, FURNITURE, AV, MISC). Each item has SKU, description, condition, current location (warehouse / event-name / in-transit). Plan a conference: list which items are committed to which event, with checkout-date and return-date. Each commitment is a Fireproof doc. The home view: a table per category with status pips. A 'committed elsewhere' warning if you try to double-book. Past events catalogued by date with a checklist of what came back. $STYLE"

gen lab-sample-custody "Lab Sample Chain of Custody — small bio/chem teams below LIMS scale. Each sample has a unique ID, type (BLOOD / SOIL / CULTURE / TISSUE / OTHER), date collected, current custodian, current location (FREEZER A / BENCH / IN TRANSIT). Every handoff writes a Fireproof doc { sampleId, from, to, ts, freezer-temp, notes }. The home view: a strict ledger sorted by sample ID. Click any sample to see its full custody chain (every handoff in chronological order). A red flag for any sample >7 days without a custody event (potentially lost). $STYLE"

gen training-kit-returns "Training Kit Returns — internal trainers' equipment circulating. Trainers can [ ASSIGN KIT ] to a training event with a return-date. Kits include items (e.g. tablets, sample materials, projection equipment). The home view: ledger of kits with their current status (HOME / DEPLOYED-{location} / OVERDUE-{days}). Each event is a Fireproof doc; returns are docs that close out a deployment. Overdue kits surface in red at the top. Trainer leaderboard: most-returned-on-time. Below: an event log with dates and trainer names. $STYLE"

gen brand-asset-rights "Brand Asset Library with Rights Timer — image rights expire, nobody tracks. Add assets with SKU, asset name, asset URL/path, rights-holder, license-type (UNLIMITED / TIME-BOXED / EVENT-ONLY), expiry-date. Each asset is a Fireproof doc. The home view: a ledger sorted by expiry-date soonest-first; expiring-within-30-days flagged amber, expired flagged red and locked from use. Filter by license-type. A renewal-request workflow: tap [ REQUEST RENEWAL ] which opens a textarea + creates a request doc. Audit log below. $STYLE"

gen customer-gift-inventory "Customer Gift Inventory — country regulatory caps + rep request log. Pre-populate gift items (mugs, gift cards, books) with cost-basis. Pre-populate countries with their gifting cap (e.g. US $50, JP $0, DE $30). Reps request gifts for a customer in a specific country. The app validates the request against the country cap and either approves or flags for legal review. Each request is a Fireproof doc; legal review is a separate doc that approves/denies. The home view: pending requests at the top, then a country-by-country gift-spend ledger this quarter. $STYLE"

gen loaner-laptop-pool "Loaner-Laptop Pool — execs and contractors, IT inventory ignores it. Each laptop has a SKU, model, OS, condition, current holder. The IT-admin view: ledger of all loaners with status pips. The user-self-service view: a [ REQUEST LOANER ] form (purpose: travel / contractor / break-fix / event) that creates a Fireproof request doc. The admin assigns from available pool — the assignment doc moves the laptop to that holder. Returns include damage notes + IT-checkup checklist. Audit log shows every transition. Overdue (>30 days) flagged red. $STYLE"

gen prototype-checkout "Prototype Hardware Checkout — engineering loaners, no IT system covers. Each prototype has a serial number, hardware version, current owner, current state (POWERED / IN-DEV / BENCH / FIELD). Engineers [ CHECK OUT ] with a project tag and ETA. Returns include a state-update note (was-bench, now-broken, etc). Each event is a Fireproof doc. The home ledger: prototypes sorted by serial; click a prototype to see its full lineage. A field-deployment view shows all units currently in FIELD with their owner + project. NDA flag per item gates visibility. $STYLE"

gen av-gear-pool "Internal AV Gear Pool — internal media team, 5 cameras, 12 lavs, tracked in nothing. Pre-populate with cameras (with serial), lavalier mics, lights, tripods, SD cards. Each item has condition + last-used. The home view: ledger of all gear with status pips. Producers [ RESERVE ] gear for a shoot (specify shoot name, dates, items). The app validates no-double-bookings. Each reservation is a Fireproof doc. Past shoots show what gear came back vs what got lost. A daily check-in: producers note any malfunctions. $STYLE"

wait
echo "ALL DONE" >> "$HERE/_status.log"
