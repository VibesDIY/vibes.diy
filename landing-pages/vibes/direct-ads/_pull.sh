AUTHOR_MAP=(
  "book-exchange-log:og"
  "guest-address-book:og"
  "live-run-sheet:og"
  "garage-sale-coordinator:og"
  "pub-trivia-night:jchris"
  "skee-ball-alley:og"
  "neighbor-wish-board:og"
  "camping-adventure-story:og"
  "camp-gear-list:og"
  "group-gift-claimer:og"
  "rate-my-thrift:og"
  "bad-movie-draft:og"
  "bachelorette-planner:og"
  "frogger-crossing:og"
  "camp-meal-plan:og"
  "group-reply-picker:og"
  "block-party-setup-crew:og"
  "scifi-since-2000:bestboy"
)

for entry in "${AUTHOR_MAP[@]}"; do
  slug="${entry%%:*}"
  author="${entry##*:}"
  mkdir -p "$slug"
  url="https://${slug}--${author}.prod-v2.vibesdiy.net/App.jsx"
  curl -sfL "$url" -o "$slug/App.jsx" && echo "ok $slug ($author)" || echo "ERR $slug ($author)"
done
