# Rolling Today

A one-screen view of today's Portland bike rides for Pedalpalooza / Bike Summer.

- Pulls live from `https://www.shift2bikes.org/api/events.php` (CORS-open, no key).
- If today has zero rides, auto-zooms forward to the next day with rides.
- Prev / Today / Next buttons skip empty days in both directions.
- "Add to Calendar" uses each event's `.ics` export; "Details" links to the shift2bikes permalink.

Hand-built; not generated.
