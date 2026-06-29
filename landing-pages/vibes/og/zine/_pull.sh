#!/usr/bin/env bash
AUTHOR=og
BASE="https://%s--${AUTHOR}.prod-v2.vibesdiy.net/App.jsx"
DIR="$(cd "$(dirname "$0")" && pwd)"
SLUGS=(
  ghost-static-band
  rough-draft-zine
  dead-letter-press
  void-transmissions
  silver-archive
  dispatch-bureau
)
for slug in "${SLUGS[@]}"; do
  mkdir -p "$DIR/$slug"
  url="$(printf "$BASE" "$slug")"
  curl -sfL "$url" -o "$DIR/$slug/App.jsx" && echo "ok $slug" || echo "ERR $slug"
done
