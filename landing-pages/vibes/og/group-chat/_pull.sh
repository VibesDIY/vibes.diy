#!/usr/bin/env bash
AUTHOR=og
BASE="https://%s--${AUTHOR}.prod-v2.vibesdiy.net/App.jsx"
DIR="$(cd "$(dirname "$0")" && pwd)"
SLUGS=(group-reply-picker pirate-chat-filter colbert-room ambient-chat-art)
for slug in "${SLUGS[@]}"; do
  mkdir -p "$DIR/$slug"
  curl -sfL "$(printf "$BASE" "$slug")" -o "$DIR/$slug/App.jsx" && echo "ok $slug" || echo "ERR $slug"
done
