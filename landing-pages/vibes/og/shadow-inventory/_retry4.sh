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

gen sample-ledger "Sample Ledger. A custody tracker. Each entry has unique ID, kind label (one of K1, K2, K3, K4), date logged, current keeper, current location. Every transfer writes a Fireproof doc with entryId, from, to, ts, notes. Home view: ledger table sorted by ID. Click an entry to see its full transfer chain rendered chronologically. Flag entries with no recent transfer in the last week. $STYLE"
gen prototype-ledger "Prototype Equipment Ledger. Each item has serial number, version label, current holder, state (one of S1, S2, S3, S4). Users check items out with a project tag and an ETA; return with a state-update note. Each event is a Fireproof doc. Home ledger sorted by serial. Click an item for its full check-in/check-out history. Filter the ledger by current state. $STYLE"

wait
echo "ALL DONE RETRY4" >> "$HERE/_status.log"
