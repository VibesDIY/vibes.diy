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

STYLE='STYLE — Vault. Load Google Fonts: Space Mono, Inter (display=optional). Body Inter; mono labels in Space Mono. Background oklch(0.08 0.03 280) deep purple-near-black. Cards oklch(0.12 0.03 280 / 0.7) with backdrop-blur. Borders oklch(0.65 0.15 80 / 0.12). Foreground oklch(0.93 0.02 80). Muted oklch(0.50 0.04 290). Accent oklch(0.72 0.15 75) warm amber. Sharp corners. Status pips: 8px squares. Buttons amber bg + dark text. Single-file React with useFireproof.'

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

gen lab-sample-custody "Sample Custody Tracker. A lab inventory app: each item has unique ID, type (one of A, B, C, D), date logged, current keeper, current location. Every transfer writes a Fireproof doc with itemId, from, to, ts, notes. Home view: ledger sorted by ID. Click an item to see its full transfer chain. Flag items with no recent transfer. $STYLE"
gen prototype-checkout "Equipment Checkout Ledger. Each item has serial number, version, current holder, state (one of A, B, C, D). Users check items out with a project tag and ETA, return with a state-update note. Each event a Fireproof doc. Home ledger sorted by serial. Click an item for full history. Filter by state. $STYLE"

wait
echo "ALL DONE RETRY3" >> "$HERE/_status.log"
