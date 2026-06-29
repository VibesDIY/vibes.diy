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

STYLE='STYLE — Vault. Load Google Fonts: Space Mono, Inter (display=optional). Body Inter 1rem; mono labels in Space Mono for IDs/SKUs. Background oklch(0.08 0.03 280) (deep purple-near-black). Cards oklch(0.12 0.03 280 / 0.7) with backdrop-blur. Borders oklch(0.65 0.15 80 / 0.12). Foreground text oklch(0.93 0.02 80). Muted oklch(0.50 0.04 290). Accent oklch(0.72 0.15 75) (warm amber). Sharp corners. Status pips: 8px squares. Buttons amber bg + dark text. Single-file React with useFireproof.'

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

gen lab-sample-custody "Lab Sample Custody Tracker. Each sample has unique ID, type (BLOOD/SOIL/CULTURE/TISSUE), date collected, current custodian, current location. Every handoff writes a Fireproof doc with sampleId, from, to, ts, notes. Home view: a ledger sorted by sample ID. Click a sample to see its full custody chain. Red flag for any sample without a custody event in over 7 days. $STYLE"
gen prototype-checkout "Prototype Hardware Checkout. Each prototype has serial number, hardware version, current owner, current state (POWERED/IN-DEV/BENCH/FIELD). Engineers check out with project tag and ETA. Returns include state-update note. Each event is a Fireproof doc. Home ledger sorted by serial. Click prototype for full lineage. Field-deployment view shows all units in FIELD. NDA flag per item. $STYLE"

wait
echo "ALL DONE RETRY2" >> "$HERE/_status.log"
