#!/usr/bin/env bash
cd "$(dirname "$0")"
: > _status.log

USER_SLUG="og"
gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> _status.log 2>&1 && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "hw-collection-catalog" "poster" "Hot Wheels collection catalog. Each car: photo, name, series, year, color, wheel type, condition, estimated value. Searchable and sortable. Personal inventory."
gen "hw-trade-list" "broadsheet" "Hot Wheels trade list builder. Two sections: Have (duplicates), Want (wishlist). Each entry: name, series, condition notes. Generate a shareable link for meetups."
gen "treasure-hunt-log" "vault" "Hot Wheels treasure hunt and Super TH find logger. Date found, store, city, car name, photos, notes. Builds a personal find history."
gen "mainline-series-check" "terminal" "Hot Wheels mainline series completion tracker. Select a series (Car Culture, Boulevard, Premium, mainline by year). Check off each car. See your completion percentage."
gen "store-hunt-tracker" "proof" "Hot Wheels store run tracker. Log each store visit: name, location, date, what you found, shelf status. Know which stores are worth hitting and when."

wait
echo "ALL DONE" >> _status.log
