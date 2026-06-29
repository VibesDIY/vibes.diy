#!/usr/bin/env bash
# Pull App.jsx for all mind-games apps from prod subdomain
set -euo pipefail

AUTHOR=jchris
BASE="https://%s--${AUTHOR}.prod-v2.vibesdiy.net/App.jsx"
DIR="$(cd "$(dirname "$0")" && pwd)"

SLUGS=(
  chromatic-families
  color-sudoku
  cuisine-sort
  diagonal-crossword
  digit-dash
  edge-connect
  emoji-combo
  emoji-connections
  glyph-search
  glyph-sudoku
  hex-spell
  hue-hunt
  killer-sudoku
  letter-boxed
  letter-hive
  letter-ring
  letter-square
  melodle
  memory-pairs
  memory-tiles
  mini-crossword
  pentagon-words
  phonetic-four
  picto-crossword
  quick-sudoku
  rebus-crossword
  snake-words
  spelling-hive
  stellar-search
  strand-search
  triangle-words
  triple-match
)

for slug in "${SLUGS[@]}"; do
  url="$(printf "$BASE" "$slug")"
  dest="$DIR/$slug/App.jsx"
  mkdir -p "$DIR/$slug"
  if curl -sfL "$url" -o "$dest"; then
    echo "ok  $slug"
  else
    echo "ERR $slug ($url)"
  fi
done
