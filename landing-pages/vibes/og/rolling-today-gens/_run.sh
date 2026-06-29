#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/rolling-today-gens"
cd "$HERE"

USER_SLUG="jchris"

SPEC='"Rolling Today" — todays Portland bike rides for Pedalpalooza Bike Summer.

DATA: GET https://www.shift2bikes.org/api/events.php?startdate=YYYY-MM-DD&enddate=YYYY-MM-DD with headers Accept: application/json and Api-Version: 3. CORS is enabled, fetch directly. Response: { events: [{ id, title, time (HH:MM:SS), endtime, venue, address, organizer, details, weburl, image, audience (G/F/A), area (P/V/W/E/C), loopride, locend, shareable, exportable, date, cancelled, newsflash }] }.

BEHAVIOR: Sort by time ascending. Filter out events where cancelled is true. If todays fetch returns zero events, auto-advance one day at a time (re-fetching each day) until you find a day with rides; show a small "skipped to <date>" notice. Prev/Next buttons jump to neighboring days that have rides (skip empty days the same way). Show a big current-day header.

EACH RIDE CARD: prominent start time (format 12h with AM/PM) and end time if present, title (large), venue, address as a Google Maps link (https://maps.google.com/?q=ENCODED_ADDRESS), organizer, audience badge with full label (G=General, F=Family-Friendly, A=21+ Only), area badge (P=Portland, V=Vancouver, W=Westside, E=East PDX, C=Clackamas), the newsflash if present as a callout, ridelength if present, "Add to Calendar" link to exportable URL, "Details" link to shareable URL. If image is set, render <img src="https://www.shift2bikes.org{image}" /> (image path begins with /eventimages/...).

STYLE:'

gen() {
  local slug="$1"; shift
  local style="$*"
  local prompt="$SPEC $style"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen pdx-bike-rides-today "Summer bike festival poster — sun-warm palette (golden yellow, sky blue, dawn pink, cream, asphalt), chunky display type, playful zine energy, hard-edged cards with thick borders and offset shadows."

gen portland-bike-rolling "Risograph zine layout — duotone overprint feel (warm pink and cyan on cream), hand-drawn-looking ornaments, slight halftone texture, photocopy edges. Editorial type, big numerals for time, tactile and DIY."

gen today-bike-summer-rides "Kinetic 70s bike club flier — saturated orange and teal on warm cream, condensed italic display type, sticker-pack badges with rotation. Loud, friendly, anti-corporate."

wait
echo "ALL DONE" >> "$HERE/_status.log"
