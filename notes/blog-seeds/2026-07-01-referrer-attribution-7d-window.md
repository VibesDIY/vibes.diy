# A 7-day toggle on the referrer report, and why the time filter is a string compare

Source: `vibes.diy/pkg/reports-app/src/App.tsx`,
`vibes.diy/api/svc/public/report-attribution-referrers.ts`,
`vibes.diy/api/types/report.ts`

The referrer attribution card on `/reports` was hard-coded to "All time." We added
a two-state chip toggle ("All time" / "Last 7 days") and threaded a `window`
param end-to-end: arktype request field (`'all'|'7d'`) → handler → a
`gte(ts, cutoff)` Drizzle filter.

Two things worth a post:

- **The window filter is a lexicographic string compare, no date cast.**
  `RefererEvents.ts` is stored as `Date.toISOString()` — a fixed-width UTC
  ISO-8601 string — so `ts >= '<cutoff>.toISOString()'` is a correct range
  filter that runs identically on Postgres (prod) and the SQLite test DB. No
  `::timestamp` cast, no dialect-specific date math. The same portability trick
  the `legacyVibePath` LIKE filter already uses.

- **`and(...)` ignoring `undefined` is the whole "default = all-time" story.**
  `windowStartFilter` returns `undefined` for `"all"`, and Drizzle's `and()`
  drops undefined operands — so the all-time query is literally the old query
  with a no-op slot. The window also gets folded into the report cache key so
  `all` and `7d` snapshots don't clobber each other in the 10-min CF cache.

Gotcha for the test: the shared seed is all `2025-01-01`, so a `7d` window
returns nothing against it. The window test seeds one *recent* row (`Date.now() -
1 day`) with a unique host and asserts it's the only `7d` row while `all` keeps
all six — a self-contained block that doesn't perturb the existing count asserts.

Also drive-by: in the drilled-down referrer detail, the landing-page path was
plain text; it's now a real `https://vibes.diy<path>` link that opens the vibe
in a new tab, matching the other `vibes.diy`-target links in the table.
