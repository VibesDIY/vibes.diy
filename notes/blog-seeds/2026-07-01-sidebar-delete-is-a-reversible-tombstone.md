# The sidebar "Delete" that never deletes: reusing an owner-only tombstone

Source: `claude/delete-owned-vibes-dby39g`

The ask was small: give the sidebar's "My Apps" list a Delete option for the
vibes you own, with a confirmation. The interesting part was what "delete"
should *mean* — and the answer was already sitting in the backend.

## The hook

Every row in the sidebar's recent-vibes list is already owner-scoped: the
`list-recent-vibes` handler joins on `handleBinding.userId = userId`, so the
list can only ever contain vibes the caller owns. No per-row ownership check
was needed on the client — the "for the vibes you own" requirement is enforced
by the query, not the UI.

## The trade-off / why

There is no per-app *hard* delete in this codebase, and adding one (wiping
apps / settings / chats / slug bindings) is exactly the schema-touching,
human-deploy-gated work you don't want behind a one-click sidebar action. But
`setUnpublish` already existed (#2688): an owner-only, reversible soft-tombstone
that sets `unpublishedAt`, takes the vibe down from public serving, and — by
design — keeps the row in the owner's own list for restore. It was implemented
and tested on the API class but never exposed on the `VibesDiyApiIface`, so the
frontend's `Conn<"shared">` view couldn't see it. Exposing it was a two-line
interface edit (the shard policy already listed `req-set-unpublish` as
`ALL_SHARDS`).

So "Delete" = `setUnpublish({ unpublish: true })`, and the sidebar filters out
any row with `unpublishedAt` so a deleted vibe disappears immediately. Nothing
is destroyed; `/vibes/mine` still lists tombstoned vibes, preserving a restore
surface. The confirmation copy says as much rather than implying a wipe.

## Gotcha worth a post

The test caught a real interaction: on a successful delete the handler fires
`notifyRecentVibesChanged()`, which makes the hook re-fetch. A naive mock that
returns the *same* published list on every call undoes the optimistic removal —
the row pops right back. The fix is to make the mock stateful (a `setUnpublish`
that tombstones its backing array), which is also what the real server does. The
lesson: when a component's success path triggers a refetch, a static fetch mock
tests a world that can't exist — the store has to move with the write.

(Also: this project's vitest runs `isolate: false` with globals off, so RTL's
automatic `afterEach(cleanup)` isn't registered. Multi-`it` component files must
`cleanup()` by hand or the previous test's DOM bleeds into "found multiple
elements".)
