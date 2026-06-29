#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/bike-summer"

USER_SLUG="jchris"

upgrade() {
  local slug="$1"
  local theme="$2"
  local theme_spec
  theme_spec=$("$TSX" "$MAIN" themes --slug "$theme" 2>/dev/null)
  local prompt="Apply this theme to the entire app — colors, typography, layout. Theme spec:

$theme_spec"
  (
    "$TSX" "$MAIN" edit --user-slug "$USER_SLUG" --dir "$HERE/$slug" \
      "$slug" "$prompt" \
      >"$HERE/${slug}-theme.log" 2>&1
    echo "DONE $slug ($theme) exit=$?" >> "$HERE/_theme_status.log"
  ) &
}

: > "$HERE/_theme_status.log"

upgrade bike-summer-ride-log   broadsheet
upgrade bike-crew-builder       guild
upgrade bike-ride-host-kit      poster
upgrade pedalpalooza-memory-wall scrapbook

wait
echo "ALL DONE" >> "$HERE/_theme_status.log"
