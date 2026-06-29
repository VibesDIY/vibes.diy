#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/free-library"
cd "$HERE"
USER_SLUG="og"

gen() {
  local slug="$1"; local theme="$2"; shift 2; local prompt="$*"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen "book-exchange-log" "codex"      "Little free library tracker. Show current books in the box, log when someone takes a book or leaves one, add a note. Simple inventory for a neighborhood book exchange box."
gen "neighbor-wish-board" "broadsheet" "Wish board for a little free library. People post what book they are looking for; steward marks it fulfilled when it shows up. Public read, anyone can post a request."
gen "tool-shelf"       "vault"       "Tool lending library for neighbors. List tools available to borrow, claim one with your name and return date, mark it returned. See what is available right now."
gen "chore-swap"       "capsule"     "Neighbor chore swap board. Post a chore you will do for someone, request a chore in return. No money, just neighbors trading favors."
gen "block-bulletin"   "poster"      "Neighborhood block bulletin board. Post found items, announcements, community events. Public read. Anyone can post."
gen "seed-library"     "guild"       "Seed and seedling lending library for a neighborhood. List seeds and starts available, claim a packet, return seeds at end of season if you can."

wait
echo "ALL DONE" >> "$HERE/_status.log"
