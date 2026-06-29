# today-bike-summer-rides

> "Rolling Today" — todays Portland bike rides for Pedalpalooza Bike Summer.

DATA: GET https://www.shift2bikes.org/api/events.php?startdate=YYYY-MM-DD&enddate=YYYY-MM-DD with headers Accept: application/json and Api-Version: 3. CORS is enabled, fetch directly. Response: { events: [{ id, title, time (HH:MM:SS), endtime, venue, address, organizer, details, weburl, image, audience (G/F/A), area (P/V/W/E/C), loopride, locend, shareable, exportable, date, cancelled, newsflash }] }.

BEHAVIOR: Sort by time ascending. Filter out events where cancelled is true. If todays fetch returns zero events, auto-advance one day at a time (re-fetching each day) until you find a day with rides; show a small "skipped to <date>" notice. Prev/Next buttons jump to neighboring days that have rides (skip empty days the same way). Show a big current-day header.

EACH RIDE CARD: prominent start time (format 12h with AM/PM) and end time if present, title (large), venue, address as a Google Maps link (https://maps.google.com/?q=ENCODED_ADDRESS), organizer, audience badge with full label (G=General, F=Family-Friendly, A=21+ Only), area badge (P=Portland, V=Vancouver, W=Westside, E=East PDX, C=Clackamas), the newsflash if present as a callout, ridelength if present, "Add to Calendar" link to exportable URL, "Details" link to shareable URL. If image is set, render <img src="https://www.shift2bikes.org{image}" /> (image path begins with /eventimages/...).

STYLE: Kinetic 70s bike club flier — saturated orange and teal on warm cream, condensed italic display type, sticker-pack badges with rotation. Loud, friendly, anti-corporate.

Live at [https://vibes.diy/vibe/jchris/today-bike-summer-rides](https://vibes.diy/vibe/jchris/today-bike-summer-rides)

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory
- `npx vibes-diy push --instant-join` — deploy with auto-accept sharing
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
