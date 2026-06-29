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

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

gen gear-checkout "Gear Checkout Ledger. Each item: serial number, version, current holder, status (RACK / OUT / FIELD / RETIRED). Users check items out with a project tag and ETA; return with a state-update note. Each event saved as a Fireproof doc. Home view: a strict ledger table sorted by serial. Click an item to see its full lineage. Filter ledger by status. Style: dark purple-near-black background, warm amber accent, Inter body + Space Mono for serials, sharp corners, single-file React with useFireproof."

wait
echo "ALL DONE RETRY5" >> "$HERE/_status.log"
