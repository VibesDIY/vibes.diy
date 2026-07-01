# Optimistic writes belong in the hook, not copy-pasted into every vibe

Source: #2985 (`claude/impl-2985-dn2crc`)

`useFireproof` writes with `database.put`/`del` and renders from `useLiveQuery`.
The lag every app fights: a write costs *two* round-trips before the UI moves —
the put itself, then the live query re-fetching from the server to echo it back
(~294ms on a favorite toggle in `og/pickathon-picker`). So a tapped heart sits
empty until the network agrees. Every app that wants instant feedback hand-rolls
the same ~25 lines: an optimistic overlay, a cleanup effect that clears each
entry once the query catches up, a revert on failure.

The fix moves that pattern into the runtime (`FireflyDatabase` + the Firefly
hooks), on by default via `useFireproof`. A few things worth a post:

1. **The second round-trip is the real cost, not the write.** The instinct is
   "the put is slow." It isn't especially — it's that `useLiveQuery`'s only way
   to learn about the write was to re-query the server. The overlay lets the hook
   re-materialize *locally* (server docs it already had + the pending change) and
   paint at 0ms, then reconcile when the confirm lands. `query()` still applies
   the overlay too, so even the async refresh during the pending window shows the
   doc — no flicker when the optimistic value and the confirmed value match.

2. **Client-mint the id so there's nothing to swap.** The scary part of optimism
   is a new doc with no `_id`: you need a key *now*, but the server usually mints
   it. Since the server honors a provided `docId`, we mint it on the client
   (`hexTime(12)-random(6)-counter`) — fixed-width hex time keeps `allDocs`
   sorted-by-`_id` chronological like the server's ids, the random suffix avoids
   cross-client collisions. Same id in the overlay and on the server → the
   authoritative doc takes over with zero key churn.

3. **Roll back, never silently lie.** On an `access.js` rejection / conflict /
   network error the overlay entry is dropped and a rollback notification fires,
   so the UI reverts — and the `put` still rejects, so apps keep their `.catch`
   for a toast. The trap: only roll back if the entry is still pending (a
   confirmed-then-cleared entry must stay gone).

4. **Layer it, don't default it globally.** The overlay is off at the raw
   `FireflyDatabase` level (standalone `fireproof()` / Node scripts keep their
   exact single-notification semantics) and turned on by `useFireproof` — because
   the issue is literally "`useFireproof` should provide optimistic writes by
   default." Opt out per-db with `useFireproof(db, { optimistic: false })`. The
   trade-off surfaced immediately: default-on at the DB level double-notifies
   direct subscribers and broke 9 low-level tests; scoping the default to the hook
   is the honest boundary.
