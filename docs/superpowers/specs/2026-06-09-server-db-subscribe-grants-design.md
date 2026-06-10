# Server-side `db.subscribe()` grant-reactivity (connect-backend-data) — design

## Summary

A backend consumer using the documented [`connect-backend-data`](https://good.vibes.diy/connect-backend-data) pattern —

```javascript
import { fireproof } from "use-vibes";
const db = fireproof("todos", { appSlug: "my-todo-app" });
db.subscribe((changes) => {
  console.log("live update:", changes);
}, true);
```

— does **not** receive live changes for a channel it is granted **after** subscribe time. A bot subscribed while it could read `bot-message-type-a`, then promoted (a new grant) to also read `bot-message-type-b`, keeps seeing only type-a until it restarts. This is normal ops (a role/grant change on a stable connection), and the runtimes that hit this are exactly the ones the doc targets: Node, Deno, Bun, Cloudflare Workers.

This is the **server/library** sibling of the already-shipped iframe fix ([`2026-06-09-live-doc-grants-resubscribe-design.md`](2026-06-09-live-doc-grants-resubscribe-design.md), `vibes-diy@c2.4.70`). That fix covers the React iframe runtime via `viewerEnv`/postMessage. **This spec does not touch the iframe transport.** It adds the analogous behavior for the headless `fireproof()` consumer, sourced from the consumer's own connection.

## Background — how the headless path works today

`fireproof(name, { appSlug })` builds a `FireflyDatabase` over a `VibesDiyApi` connection. Two facts about that path cause the gap:

**Routing.** The CLI/headless factory constructs `VibesDiyApi` without `skipShard` ([`vibes-diy/cli/main.ts:84`](../../../vibes-diy/cli/main.ts)), so the client appends `?shard=<random-uuid>` ([`vibes.diy/api/impl/index.ts:259`](../../../vibes.diy/api/impl/index.ts)) and lands on a **per-connection `CHAT_SESSIONS` Durable Object**. The iframe/preview path instead connects via `/api/app?vibe=ownerHandle--appSlug` with `skipShard: true` ([`index.ts:195-198`, `:253`](../../../vibes.diy/api/impl/index.ts)), so all clients of one vibe share a single per-vibe `AppSessions` DO and see each other's writes via local broadcast. A headless subscriber on its own `CHAT_SESSIONS` DO therefore does not share a broadcast domain with the writers — cross-client live updates are structurally absent, grant change or not.

**Grant-reactivity trigger.** `FireflyDatabase` calls `subscribeDocs(name)` exactly once, in its constructor ([`firefly-database.ts:124`, `:151`](../../../vibes.diy/vibe/runtime/firefly-database.ts)). That call takes a **static server-side channel snapshot** of the reader's effective channels. Nothing re-issues it on a grant change in the headless path — `resubscribe()` is only re-called by (a) the constructor, (b) the React `useFireproof` grants-signature effect ([`use-firefly.ts:130-134`](../../../vibes.diy/vibe/runtime/use-firefly.ts), iframe-only), and (c) websocket reconnect ([`vibes-diy-api-listeners.ts:140`](../../../vibes.diy/api/impl/vibes-diy-api-listeners.ts)). So a newly-granted channel's snapshot stays frozen; even subsequent edits to the new channel are filtered out.

The primitives needed to fix the trigger already exist and are unused in the headless path: `subscribeViewerGrants` ([`index.ts:556`](../../../vibes.diy/api/impl/index.ts)), `onViewerGrantsChanged` ([`index.ts:752`](../../../vibes.diy/api/impl/index.ts)), and `resubscribe()` ([`firefly-database.ts:151`](../../../vibes.diy/vibe/runtime/firefly-database.ts)).

## Goal

Make the documented `connect-backend-data` pattern react to a grant change without restart: after a promotion, the existing `db.subscribe()` callback starts receiving live `changes` on the newly-granted channel **going forward**. Backfill of pre-existing docs is **not** automatic — it is surfaced to the consumer as an opt-in signal (see Piece 2). Behavior for apps **without** an access function (no grants) is unchanged.

## Design — two pieces

Both are needed end-to-end: routing puts the subscriber in the right broadcast domain; the trigger refreshes its channel snapshot on a grant change.

### Piece 1 — Routing: share the per-vibe DO

The headless `fireproof()` connection adopts the same transport the iframe uses: `/api/app?vibe=ownerHandle--appSlug` with `skipShard: true`, so a backend subscriber shares the per-vibe `AppSessions` DO with writers and receives their doc-changed broadcasts at all. The route already exists; the headless path simply opts in. This is also **required** for grant-reactivity, not merely preferable: the legacy `?shard=<uuid>` `CHAT_SESSIONS` route does not wire the `viewer-grants-changed` notify callbacks at all (review finding), so the trigger in Piece 2 cannot work there.

**Deliberate topology tradeoff (review-confirmed).** The `?shard=<uuid>` default ([`index.ts:249,259`](../../../vibes.diy/api/impl/index.ts)) spreads each connection across its own DO to avoid per-DO CPU limits under concurrent load. Moving headless clients onto `APP_SESSIONS.idFromName(vibe)` re-concentrates per-vibe fanout/CPU onto one DO for a **hot vibe** with many backend subscribers. This is an accepted tradeoff: correctness (live grant fanout) for a topology change that matters only at high per-vibe concurrency. The implementation plan must call this out explicitly; if a hot-vibe ceiling becomes a concern it couples to the broader DO-sharding work, not to this change.

### Piece 2 — Grant-reactivity, wired in the headless adapter

The locus is the **headless adapter** (`FireflyApiAdapter` / `fireproof-node`), not an environment-gated branch inside `FireflyDatabase` (review decision). This keeps `FireflyDatabase` transport-agnostic and the iframe path entirely untouched, while still covering **both** the CLI and the documented library snippet — they share this adapter. The adapter self-subscribes to `viewer-grants-changed` on its own connection (`onViewerGrantsChanged` / `subscribeViewerGrants`), and on a grant change does two things:

1. **Auto `resubscribe()` — automatic, forward-only.** Refreshes the server-side channel snapshot so future writes to the newly-granted channel flow to the existing `db.subscribe()` callback through the unchanged `onMsg → notifyListeners` path ([`firefly-database.ts:133`](../../../vibes.diy/vibe/runtime/firefly-database.ts)). A raw change-subscriber has nothing to re-run, so this is forward-only by construction — no backfill, no pushdown into owned queries.

2. **Emit a grant-changed signal — consumer's choice for backfill.** The adapter surfaces the grant change to the consumer as a generic notification. **What the app does with it is app-specific** and out of scope to standardize: it might re-pull current visible state, bump a `useEffect` counter to re-pull app state (≈ a fresh login), or ignore it. The `evt.refresh()` shown in discussion is illustrative pseudo-code for "the app re-pulls," not a fixed API contract. The point is the consumer is _told_ a promotion happened and can re-initialize on its own terms; without acting, it still gets forward events from step 1.

**Resubscribe scope: all open dbs for the app.** The `viewer-grants-changed` payload is **app-coarse** — it carries `ownerHandle`/`appSlug`, not a db-level delta (review finding). So on the signal the adapter re-issues `subscribeDocs(name)` for **every open `FireflyDatabase` of that app**, rather than attempting per-db scoping it cannot derive from the event. `subscribeDocs` already dedupes by key on the client, so re-subscribing dbs whose grants did not change is harmless. Apps **without** an access function carry no grants and never receive the event, so the path stays inert for them.

## What is explicitly not changing

- **The iframe transport and its `viewer-grants-changed` handling.** The React runtime keeps its `viewerEnv`/postMessage → resubscribe + re-query path (c2.4.70). No shipped code is refactored.
- **No-grants apps.** The documented pattern says nothing about access control; for apps without an access function the grant-signature is empty and the path is inert.
- **`db.subscribe(fn, true)` semantics.** The `true` initial-state fire still happens once at subscribe time; a grant change does not re-trigger it (that is the consumer's opt-in via the signal).

## Out of scope

- **Cross-DO live fanout / a coordinator DO.** Wontfix per the iframe design doc; Piece 1 (share the per-vibe `AppSessions` DO) is the sanctioned answer, not a coordinator. The dead `DocNotify` DO (#2265) is being retired, not revived.
- **Standardizing the consumer's refresh.** The signal is a notification; backfill/re-pull is app-specific.

## Testing

- **Failing test first (headless).** Drive a `FireflyDatabase` built the headless way with a viewer whose grants initially lack a doc's channel; assert `db.subscribe` does not deliver writes to that channel. Then deliver a `viewer-grants-changed` that adds the channel and assert: (a) `subscribeDocs(name)` is **re-called** (resubscribe), (b) a subsequent **write** to the now-granted channel reaches the `db.subscribe` callback, and (c) a pre-existing doc is **not** auto-delivered (forward-only) but the grant-changed signal **is** emitted to the consumer. Reuse existing runtime/node test harnesses (`firefly-nodejs.test.ts`, `firefly-database.test.ts`); do not add new infrastructure.
- **No-grants control.** An app without an access function sees no behavior change and no extra subscribe round-trips.
- **Routing.** Assert the headless factory connects via `/api/app?vibe=…` + `skipShard: true` (no `?shard=` param).

## Review resolutions

Spec-review pass by @CharlieHelps ([PR #2304](https://github.com/VibesDIY/vibes.diy/pull/2304)) — direction supported. Resolutions folded into the design above:

1. **Routing safety (Piece 1).** ✅ Resolved. The `?shard=<uuid>` default is intentional load distribution; moving headless onto `/api/app` re-concentrates per-vibe CPU/fanout for hot vibes — a deliberate, documented tradeoff (see Piece 1). No clean alternative exists: the legacy route does not wire the grant-notify callbacks, so `/api/app` is required for the trigger to work.
2. **Grant event delivery.** ✅ Resolved. The same subscribing connection does receive `viewer-grants-changed` on `AppSessions` (sender is not skipped for this event), but the payload is **app-coarse** (`ownerHandle`/`appSlug`, no db delta). Design updated: resubscribe **all open dbs for the app** (dedupe makes redundant resubscribes harmless).
3. **Locus.** ✅ Resolved. Headless adapter (`FireflyApiAdapter`/`fireproof-node`), not an env-gate in `FireflyDatabase` — keeps the DB transport-agnostic and iframe untouched.
4. **Forward-only contract.** ✅ Resolved. Forward-only by default matches `subscribeDocs` live-registration semantics; backfill stays an explicit app-opt-in, never auto-replayed on promotion.

**Implementation caveat to carry into the plan:** the `/api/app` switch is a correctness win for grant fanout but a deliberate CPU/fanout topology tradeoff for high-concurrency vibes — state it explicitly in the rollout-watch.
