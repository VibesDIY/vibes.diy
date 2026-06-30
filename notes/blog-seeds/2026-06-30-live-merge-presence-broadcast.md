# Live merge: presence without a presence API (#1756 spec)

- **Branch / PR:** `claude/brainstorm-1756-evwod8` — spec for #1756 (live data
  fanout hub: #2328)
- **Hook:** Multi-user cursors/typing/selection in a generated vibe with **no new
  API** — the author keeps writing `merge()` and `useLiveQuery()`, and presence
  "just works." `merge()` gains an emit-only broadcast leg; receivers fold the
  partial into an in-memory overlay that's never persisted and vanishes when the
  peer disconnects.

## The trade-off / why

The interesting design move is that the **`_id` is the peer**. One field does
four jobs at once: it's the broadcast gate (no `_id` → page-only, so every
existing `merge()`+`save()` form draft is byte-for-byte unchanged), the per-peer
identity (distinct `_id` → distinct overlay rows, no clobber), the overlay key,
and the disconnect-cleanup unit. That collapses what looked like four separate
decisions into one load-bearing convention.

Two constraints did most of the steering:

- **Generated vibes must stay simple.** That single constraint killed the
  "expose a keyed-by-`originPeer` collection and let the app merge streams"
  option, and forced the overlay *inside* `FireflyDatabase`'s read path
  (`get`/`query`/`allDocs`) so the hooks — and the app code — need zero changes.
- **`useLiveQuery` can't pre-declare `_id`s.** That's why the tempting "only push
  to clients interested in this `_id`" routing is deferred: the primary consumer
  reads a *collection*, so v1 routes by channel/db (reusing the `evt-doc-changed`
  machinery) and does backpressure at the **sender** (coalesce per-`_id` to one
  send per animation frame) instead of in the router.

## Gotcha worth a post

The issue's own example (`useDocument({ curX, curY })`, no `_id`) is subtly
under-specified — with no `_id` there's nothing to tell Alice's cursor from
Bob's, and partials clobber. Grounding the design in the *actual* `App.jsx`
corpus (13 files using `merge`) is what surfaced both the dominant safe pattern
(no-`_id` form drafts) and the one wart (`trip:current` — a form on an
already-`_id`'d singleton that will now broadcast keystrokes). We accepted the
wart on purpose: it's self-correcting on `save()`, and the alternative was a flag
nobody wanted. Shared-`_id` writes are last-write-wins, which is fine when
delivery is sub-second and the only collision is two people typing the same form.
