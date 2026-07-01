# Denormalize at save time so a cross-day "favorites" view doesn't refetch every day

**Hook:** `rolling-today` browses one calendar day at a time — the shift2bikes feed is
queried per-date. When we added an all-days **Favorites** screen ("show every day I've
saved a ride, with a header per day"), the obvious implementation is a trap: a favorite
doc only stored `{ rideId, userId }`, so to render a saved ride you'd have to know its
date and refetch that day's feed. Favorites can span dozens of days → dozens of fetches
just to paint a list.

**Source:** `vibes/rolling-today/` (branch `claude/rolling-today`). Fix: **snapshot the
ride onto the favorite at save time** — copy the lightweight fields the view needs
(id, date, time, title, venue, badges, action links) onto the favorite doc, minus the
long description and hero image (the all-days view hides those anyway). Then the view is
pure client-side grouping:

```js
const favByDay = {};
for (const f of favorites) {
  if (f.userId !== me || !f.event?.date) continue;   // f.event = the snapshot
  (favByDay[f.event.date] ||= []).push(f.event);
}
// render Object.keys(favByDay).sort() → one header + condensed cards per day
```

Zero network. Empty days never appear because only days with a favorite become keys.

**Trade-off / gotcha:** denormalizing means the snapshot can go stale (if a ride's time
moves, the favorite still shows the old time until re-saved) — fine here, ride details
are effectively immutable once posted. The real gotcha is **migration**: favorites
created *before* the snapshot field existed have no `f.event`, so they silently drop out
of the all-days view (they still work as the per-ride star and in friends' "N rolling"
piles, which only need `rideId`/`userId`). That surfaced immediately in testing — "it
says I have no faves when I do." Options: backfill the snapshot lazily as the user
browses days that contain a snapshot-less favorite, or accept the gap for pre-existing
favorites. We shipped the accept-the-gap version; the lazy backfill is a clean follow-up.

**Repeatable lesson:** when a view needs to aggregate across the exact axis your data
source is *partitioned* by (here: date), store enough on the write to render without
re-querying the source. And whenever you add a required field to an existing doc shape,
decide what the reader does with docs that predate it — before a user finds the hole for
you.
