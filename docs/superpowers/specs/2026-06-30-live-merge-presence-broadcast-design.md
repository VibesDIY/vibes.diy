# Live merge: `merge()` broadcasts an ephemeral overlay to peers (#1756)

## Problem

`useDocument().merge()` is page-only. It updates local React state (`setDoc`)
and is lost on refresh. The only way to make a doc change visible to other peers
today is `save()`, which writes every event to the op log forever — the wrong
tool for ephemeral, high-frequency presence state (cursor position, hover,
selection, "user is typing").

We want `merge()` to _also_ fan out the partial doc to peers subscribed to the
same database/channel, who see it as an in-memory overlay on top of persisted
state — **without** persisting anything and **without** changing the `merge()`
API. `save()` stays the persistence path; `merge()` becomes the always-emit,
never-store primitive.

## Context: this is all in-repo

The issue assumes `merge()` lives in the `use-fireproof` npm package
(`use-fireproof/base/react/use-document.ts`). For vibes.diy it does **not**: this
repo ships its own drop-in hooks in
[`vibes.diy/vibe/runtime/use-firefly.ts`](../../../vibes.diy/vibe/runtime/use-firefly.ts)
(`createUseDocument`, `createUseLiveQuery`, …), backed by the custom
[`FireflyDatabase`](../../../vibes.diy/vibe/runtime/firefly-database.ts) (no
Fireproof storage — all I/O routes through the vibes-diy API). `use-fireproof`
is a plain npm dep (`0.24.19`, unpatched) used only for types/non-runtime paths.
So the entire feature is implementable here with no upstream change and no patch.

`merge()` today ([`use-firefly.ts:193`](../../../vibes.diy/vibe/runtime/use-firefly.ts)):

```ts
const merge = useCallback((newDoc: Record<string, unknown>) => {
  updateHappenedRef.current = true;
  setDoc((prev) => ({ ...prev, ...newDoc }));
}, []);
```

## Architectural precedent: `emitMode`

vibes.diy already has the "emit live, don't persist" pattern one layer up, in
[`prompt-chat-section.ts`](../../../vibes.diy/api/svc/public/prompt-chat-section.ts)
(`appendBlockEvent`, `emitMode: "store" | "emit-only" | "store-only"`): fan out
the wire message to subscribed connections, and only insert into the DB when the
mode says to. `merge()` is the document-layer analogue of `emit-only` — always
emit, never store. `evt-doc-changed` already proves the fan-out/route/filter
machinery; this feature adds an emit-only sibling that carries a **payload**
instead of a re-fetch ping.

### Why the existing `evt-doc-changed` path can't be reused as-is

`evt-doc-changed` carries only `{ docId }`; receivers re-`get()` persisted state
([`firefly-database.ts:158-168`](../../../vibes.diy/vibe/runtime/firefly-database.ts)).
For presence there is nothing persisted to re-fetch, so the new message must
carry the partial **body**, and the receiver must fold it in **without** a store
read overwriting it.

## Design spine: the `_id` is the peer

The canonical presence recipe gives each peer a stable `_id` (matching how the
corpus already shapes per-user docs — `friend-${handle}`, `favorite-${userId}-…`):

```jsx
// each peer broadcasts under its own stable _id. The `type` (and any other
// indexed field) lives in the doc so the merged snapshot a peer broadcasts is
// itself queryable — see "Broadcast the merged snapshot, not the bare partial".
const { merge } = useDocument({ _id: `cursor-${myHandle}`, type: "cursor", curX: 0, curY: 0 });
onMouseMove = (e) => merge({ curX: e.clientX, curY: e.clientY }); // broadcasts (has _id)

// everyone reads the room with the hook they already use — no new surface:
const others = useLiveQuery("type", { key: "cursor" }).docs; // ephemeral rows appear here
others.map((c) => <Cursor x={c.curX} y={c.curY} />);
```

The `_id` is load-bearing in four ways at once, which is why it is the spine:

1. **Broadcast gate** — no `_id` (form drafts) stay page-only; `_id` present
   (presence docs) broadcast.
2. **Per-peer identity** — distinct `_id` per peer → distinct overlay rows, no
   clobber.
3. **Overlay key** — receivers store ephemeral docs keyed by `_id`.
4. **Cleanup unit** — paired with `originPeer`, dropped on disconnect.

**Shared `_id` across peers is supported as last-write-wins.** Delivery is
sub-second, so the only observable collision is two people typing into the _same
already-`_id`'d form_ simultaneously; it degrades gracefully (the next keystroke
or the eventual `save()` reconciles). We explicitly accept this rather than
inventing a per-peer reconciliation surface that would leak into generated vibe
code.

### Broadcast the merged snapshot, not the bare partial

`merge()` broadcasts the **merged client doc snapshot** (`{ ...doc, ...partial }`
— the same shape `useDocument().doc` exposes), not just the changed fields. This
is required for the read side to work: a presence `_id` has no persisted doc, so
the receiver synthesizes its `useLiveQuery` / `useAllDocs` row entirely from the
broadcast. If we shipped only `{ curX, curY }`, that synthesized row would carry
no `type` (or any other indexed field) and `useLiveQuery("type", { key:
"cursor" })` would never match it. Shipping the full snapshot keeps every
synthesized row queryable with no per-`merge()` discipline required from the vibe
author. Snapshots stay small (presence docs are a handful of fields), and the
sender already holds the merged doc, so this is free.

### Keeping the vibe author's code simple (the hard constraint)

Generated vibes must never see per-peer streams or do their own merging. All
reconciliation is hidden inside the runtime: the author broadcasts with the
ordinary `merge()` and reads with the ordinary `useDocument`/`useLiveQuery`. This
is the constraint that rules out exposing a keyed-by-`originPeer` collection to
apps, and is why the overlay is applied **inside the read path** (below).

## Behavior contract

- `merge(partial)` — unchanged signature; unchanged local effect (`setDoc` still
  wins for self).
- **New leg:** when the doc has an `_id`, `merge()` additionally emit-only
  broadcasts the **merged doc snapshot** (`{ ...doc, ...partial }`) to peers on
  the **same channel** of `(ownerHandle, appSlug, dbName, channel)`. No `_id` →
  page-only. **Exact channel match only — no bare-db fallback** (see Piece 3:
  unlike the doc-changed ping, the snapshot is the disclosure).
- Receivers fold the snapshot into an in-memory overlay keyed by `_id`, surfaced
  transparently through `useDocument` / `useLiveQuery` / `useAllDocs`. Never
  persisted. Dropped on the originating peer's disconnect.
- Nothing hits the SQL store, indexer, clock, carstore, or the `evt-doc-changed`
  path. A late-joining client sees persisted state only.

## Pieces

### 1. Wire messages (new, emit-only)

In [`api/types/app-documents.ts`](../../../vibes.diy/api/types/app-documents.ts),
sibling to `evtDocChanged`:

```ts
export const evtDocEphemeral = type({
  type: "'vibes.diy.evt-doc-ephemeral'",
  ownerHandle: "string",
  appSlug: "string",
  dbName: "string", // real db — the ACL boundary; client filter matches on this
  docId: "string",
  originPeer: "string", // sender connId — the disconnect-cleanup key
  doc: "object", // the merged client doc snapshot ({ ...doc, ...partial }) — see "Broadcast the merged snapshot"
  "channel?": "string", // fan-out routing channel for access-fn vibes (mirrors evtDocChanged)
});

export const evtDocEphemeralDrop = type({
  type: "'vibes.diy.evt-doc-ephemeral-drop'",
  originPeer: "string",
});
```

Both ship `is*` type guards in the same file (matching `isEvtDocChanged`).

`dbName` always carries the real db (so the strict client filter keeps working,
per #2301); `channel` is the routing key only and is informational to the
client.

### 2. Sender leg

- `FireflyTransport`
  ([`firefly-database.ts:38`](../../../vibes.diy/vibe/runtime/firefly-database.ts))
  gains `broadcastEphemeral(docId: string, doc: Record<string, unknown>,
dbName?: string): void` — **fire-and-forget, no request/response, no await** so
  a 60Hz caller never blocks. Implemented in the WS adapter
  ([`firefly-api-adapter.ts`](../../../vibes.diy/api/impl/firefly-api-adapter.ts))
  and the in-iframe `VibeSandboxApi`.
- `FireflyDatabase` gets a thin `broadcastEphemeral(docId, doc)` forwarding to
  the transport with `this.name` as `dbName`.
- `use-firefly.ts` `merge()` adds exactly one branch — broadcasting the **merged
  snapshot**, not the bare `newDoc`:

  ```ts
  const merge = useCallback(
    (newDoc: Record<string, unknown>) => {
      updateHappenedRef.current = true;
      setDoc((prev) => {
        const next = { ...prev, ...newDoc };
        if (next._id) database.broadcastEphemeral(next._id as string, next); // new
        return next;
      });
    },
    [database]
  );
  ```

  Broadcasting from inside the `setDoc` updater uses the freshest merged state
  (so a burst of `merge()`s each broadcast the cumulative doc, not a stale base)
  and removes the `[doc._id]` dependency. The public `merge()` API is
  byte-for-byte identical.

- **Backpressure — sender-side coalescing, keyed by `_id`.** A small per-db
  coalescer collapses bursts to one send per animation frame (~16–50ms, env- or
  constant-tunable), keeping only the latest snapshot per `_id`. Routing cannot
  do backpressure (rosters need channel-wide fan-out), so the sender owns it.

### 3. Server fan-out (emit-only, never store)

- A new `notifyDocEphemeral` callback in
  [`cf-serve.ts`](../../../vibes.diy/api/svc/cf-serve.ts) `localBroadcastCallbacks`,
  routed by the channel key (`normalizeChannels` → `owner/app/<dbName>/<channel>`,
  or `owner/app/<dbName>` when the vibe has no access fn), iterating `connections`
  and skipping the `originPeer`'s own connection. It **never inserts anything** —
  a pure relay. No CRDT, clock, or carstore.
- **Channels are derived from the access fn, exactly like the write path — NOT
  from the sender's own subscriptions.** The inbound handler runs the same
  channel computation the persisted write runs (`resolveAccessBinding` →
  `resolveAccessFnSource` → `invokeAccessFn` → `normalizeChannels(accessResult.channels)`)
  on the ephemeral snapshot, then fans out per channel. This is what makes the
  **asymmetric write→channel** case work: a visitor typing a contact form whose
  access fn routes the doc to an `inbox` channel only the **owner** reads will
  have their in-progress ephemeral reach the owner watching `inbox` — even though
  the visitor cannot read `inbox`. Routing by the sender's own channels would
  silently break this. Security is unchanged from the persisted model: the
  ephemeral reaches exactly the audience the persisted doc would, and a sender
  writing to a channel it can't read is already how the inbox pattern works.
  Channels can change mid-session (a keystroke that changes a routing field
  re-routes within the TTL below).
- **Bounding the access-fn cost.** Running the access fn per ephemeral is the one
  real cost. Two things keep it cheap: (a) the high-rate case (60Hz cursors) is
  symmetric — everyone-in-the-room channels — while the asymmetric case
  (form→inbox) is inherently low-rate (typing); (b) channel membership depends on
  stable fields (`type`, recipient), not `curX/curY`, so the handler **caches the
  computed channels per `docId` with a short TTL (`EPHEMERAL_CHANNEL_TTL_MS =
2000`)** — a cursor burst re-evaluates at most once per 2s, not per frame. The
  circuit breaker + metrics (below) are the backstop. (Seeding this cache from the
  write path's already-computed channels on `save()` is a deferred optimization —
  the TTL alone bounds cost.)
- **Exact channel match — NO bare-db fallback (security, P1).** `notifyDocChanged`
  deliberately delivers to connections holding **either** the channel key **or the
  bare-db key** ([`cf-serve.ts:139`](../../../vibes.diy/api/svc/cf-serve.ts):
  `!has(channelKey) && !has(dbKey)`), to cover the join-before-grant window. That
  is safe there only because `evt-doc-changed` carries **no payload** — a
  connection that can't read the channel re-queries through the grant-gated read
  path and "sees nothing new" (the inline comment at `cf-serve.ts:114-121` says
  exactly this). For `evt-doc-ephemeral` the **snapshot _is_ the disclosure**:
  there is no re-query gate, so the bare-db fallback would leak in-progress
  presence/form fields to ungranted bare-db subscribers. The ephemeral fan-out
  therefore matches the **channel key only** (`conn.subscribedDocKeys.has(channelKey)`).
  When the vibe has no access fn, `channelKey === dbKey` and bare-db delivery is
  correct (no channel boundary exists); the no-fallback rule only changes
  behavior for access-fn vibes, which is exactly where the boundary matters.
- The client `broadcastEphemeral` send is received by an evento handler that calls
  `notifyDocEphemeral`. (Mirror the existing subscribe/notify wiring; reuse
  `normalizeChannels` for the routing key.)
- `VibesApiSQLCtx` (`api/svc/types.ts`, `api/svc/create-handler.ts`) gains an
  optional `notifyDocEphemeral?(evt, senderConnId)` alongside `notifyDocChanged`.
- **Payload-size cap (day one).** The handler rejects (drops + counts, never
  throws to the caller) any ephemeral whose snapshot exceeds a small byte ceiling
  (constant, env-tunable — presence docs are tiny; a multi-KB ephemeral is a
  misuse). Keeps a buggy app from pushing large bodies through the never-store
  relay.
- **Server-side circuit breaker (ephemerals only).** A per-connection rate ceiling
  on `evt-doc-ephemeral`: above it, drop + increment a counter + `console.warn`
  (same spirit as the existing 200-conn warn). This is a safety net against a
  buggy/malicious client, _not_ the primary backpressure (that stays sender-side,
  Piece 2). It must not touch the roster/persisted (`notifyDocChanged`) flows.
- **Instrumentation (day one).** Counters for ephemeral in / out / dropped
  (size-cap, rate-breaker, no-subscriber) plus fan-out timing, so we can _prove_
  whether the shared `Sessions` DO path needs a dedicated transport later rather
  than guessing. Reusing the existing fan-out for v1 is deliberate; the metrics
  are how we'll know when to revisit it.

### 4. Receiver overlay (the hidden bit)

In [`FireflyDatabase`](../../../vibes.diy/vibe/runtime/firefly-database.ts):

- State: `ephemeralOverlay: Map<docId, { doc, originPeer, seq }>` (where `doc` is
  the broadcast merged snapshot) plus a `peerDocs: Map<originPeer, Set<docId>>`
  index for cleanup.
- On `evt-doc-ephemeral` (matched on `ownerHandle`/`appSlug`/`dbName` exactly like
  the existing `evt-doc-changed` filter): upsert the slice (latest `seq` wins),
  update `peerDocs`, then `notifyListeners([{ _id: docId }])` — reusing the exact
  notify→refetch path. The server's exact-channel routing (Piece 3) is the
  authoritative read gate. As **defense-in-depth (v1)**, the receiver also drops
  any ephemeral whose `channel` isn't in the viewer's granted set
  (`viewerEnv.grants`) before folding it in — this catches races/bugs (e.g. a
  slice still arriving in the window after a grant is revoked), but it is _not_
  the primary auth; routing is. The `dbName` match is retained to mirror the
  existing `evt-doc-changed` filter.
- **Overlay applied inside the read methods** so hooks need zero changes:
  - `get(id)` → `{ ...persisted, ...overlay[id]?.doc }` (and returns the overlay
    snapshot directly when there is no persisted doc).
  - `query()` / `allDocs()` → fold overlay slices over the persisted rows; an
    overlay-only `_id` is emitted as a synthesized row **from the full snapshot**
    (which carries `type` and any other indexed field), so it appears in
    `useLiveQuery` / `useAllDocs`.
- `updateHappenedRef` on the originating peer already suppresses its own
  refetch (so local `setDoc` wins); remote peers have `updateHappenedRef ===
false` and refetch normally. No change needed there.

### 5. Disconnect cleanup (close-hook + TTL backstop)

Two mechanisms, because a clean close is not guaranteed:

- **Close-hook drop (primary).** `cf-serve.ts` already removes a connection on
  close/error. Hook there to emit `evt-doc-ephemeral-drop { originPeer }` to the
  remaining peers on that vibe. Receivers purge every overlay slice whose
  `originPeer` matches (via `peerDocs`), then `notifyListeners` the affected
  `_id`s, so a departed user's cursor vanishes immediately. A shared-`_id` slice
  last written by a still-connected peer survives, because each slice records its
  writer. Drop carries only `originPeer`; the per-vibe DO scopes it and slices
  record their writer.
- **Receiver TTL backstop.** A clean WS close isn't always delivered (crash,
  network partition, mobile backgrounding). So each overlay slice also carries a
  last-seen timestamp and expires after a slice-level TTL (~10–15s default,
  constant/env-tunable); an expired slice is purged and its `_id` re-notified.
  Continuous signals (cursors) refresh well within the TTL, so this is invisible
  for them. **One-shot-ish signals (a "typing" flag set once) must be refreshed
  periodically while active** — the recommended app pattern — so TTL expiry is the
  intended "they stopped" behavior, not flicker. (Documented in the app-facing
  recipe.)

## Testing

### Server (one `Sessions` DO, `createVibeDiyTestCtx`)

- A's `broadcastEphemeral` reaches B with the real `dbName` + the merged snapshot;
  A is excluded (sender skip).
- Nothing is persisted: after the broadcast, B's `getDoc`/`queryDocs` for a
  never-saved `_id` still returns not-found / persisted-only.
- Access-fn vibe: routed by channel; a subscriber on the wrong channel does not
  receive it.
- **No bare-db leak (P1):** on an access-fn vibe, a connection holding only the
  **bare-db** subscription key (join-before-grant window, not yet granted the
  channel) receives an `evt-doc-changed` ping for a channel write but **does not**
  receive the `evt-doc-ephemeral` snapshot for that channel.
- Disconnect: closing A's connection delivers `evt-doc-ephemeral-drop` to B.
- **Payload-size cap:** an ephemeral whose snapshot exceeds the byte ceiling is
  dropped (counter increments) and not fanned out; the sender's connection is not
  errored.
- **Circuit breaker:** a connection exceeding the per-conn ephemeral rate ceiling
  has excess ephemerals dropped + counted, while a concurrent `notifyDocChanged`
  / persisted write on the same connection is unaffected.

### Receiver overlay (unit, against `FireflyDatabase`)

- Overlay folds into `get()` (merge over persisted; synthesized when absent).
- Overlay-only `_id` appears as a `query()` / `allDocs()` row.
- Last-write-wins on a shared `_id`.
- Drop-by-peer removes only that peer's slices; a co-written `_id` kept alive by
  another peer survives.
- **TTL backstop:** a slice not refreshed within the TTL is purged and its `_id`
  re-notified, even with no `evt-doc-ephemeral-drop` (simulating an unclean
  disconnect).
- **Defense-in-depth gate:** an ephemeral on a `channel` absent from
  `viewerEnv.grants` is dropped, not folded in.

### Sender (unit)

- Coalescer collapses a burst to one send per frame, keeping the latest merged
  snapshot per `_id`; distinct `_id`s are not collapsed together.

### Manual

- Two browser tabs of a cursor vibe (`useDocument({ _id: "cursor-"+handle })` +
  `useLiveQuery`): A's cursor tracks live on B; closing A removes it; a reload of
  B shows no persisted cursor docs.

## Out of scope (v1)

- **Per-`_id` interest routing.** A later optimization (clients registering
  per-doc interest so a 60Hz cursor only reaches `useDocument(sameId)` viewers).
  Deferred because the primary consumer is `useLiveQuery`, which reads a
  collection and cannot pre-declare `_id`s; v1 routes by channel/db and throttles
  at the sender. Channel scope is the granularity that serves both
  `useDocument(id)` and `useLiveQuery` rosters, and it already exists.
- **A `merge()` opt-out flag — not implemented, but its shape is reserved.** v1
  ships flag-free (the `_id` gate is the only switch). To avoid painting us into a
  corner if real usage demands it, the spec reserves the **shape** of the
  escape hatch — a `useDocument(initial, { ephemeral: false })` (equivalently a
  `useFireproof(name, { ephemeral: false })`) option that forces page-only — as
  the agreed extension point. No behavior is built for it now.
- **The `trip:current` wart — accepted, and documented.** A _form_ on an
  already-`_id`'d singleton (`useDocument({ _id: "trip:current" })` edited
  keystroke-by-keystroke) will broadcast in-progress input. It is self-correcting
  (the `save()` value replaces the overlay) and accepted as the price of a
  flag-free surface. The app-facing recipe must call out two things explicitly:
  (a) a singleton-`_id` form broadcasts in-progress values to peers; (b) for a
  **private draft**, keep it page-local (no `_id`, or local component state) until
  `save()` mints the persisted doc.
- **Cross-DO / cross-shard fan-out.** Out of scope by the same reasoning as the
  rest of the live-data-fanout work (#2328): everyone lands on the same per-vibe
  `Sessions` DO via `/api/app`. Do not resurrect a cross-DO coordinator.

## Review decisions (resolved on PR #2968)

Five open questions were put to review; the design above incorporates the
answers. Net: core design intact, with two cheap v1 safety nets — **receiver TTL
backstop** and **server ephemeral circuit breaker + metrics**.

1. **Disconnect cleanup** — ship **both** close-hook drop _and_ a receiver TTL
   backstop (~10–15s slice-level). (Piece 5)
2. **60Hz relay** — reuse the `Sessions` DO fan-out for v1; add a payload-size cap
   - in/out/drop counters + fan-out timing now, so a transport split is data-driven
     later. (Piece 3)
3. **Channel gating** — server routing is the auth boundary (exact channel key, no
   db fallback); receiver "am I still subscribed?" is defense-in-depth, not primary.
   (Pieces 3–4)
4. **Backpressure** — sender-side coalescing stays primary; add a tiny server-side
   per-conn circuit breaker for ephemerals only, never touching roster/persisted
   flows. (Pieces 2–3)
5. **Flag-free `_id` gate** — ship flag-free; document the singleton-`_id` form
   broadcast + the private-draft pattern; reserve the `{ ephemeral: false }`
   escape-hatch shape without building it. (Out of scope)

Codex review (P1 bare-db leak, P2 indexed fields) folded in earlier in the same
PR.

## Related

- Status hub: #2328 (live data fanout). This is the one un-started thread.
- `emitMode` precedent:
  [`prompt-chat-section.ts`](../../../vibes.diy/api/svc/public/prompt-chat-section.ts)
  (`appendBlockEvent`).
- `evt-doc-changed` channel/dbName decouple:
  [channel-doc-changed-dbname](2026-06-09-channel-doc-changed-dbname-design.md)
  (#2301).
- Auto-save-on-`merge()` (fireproof-storage/fireproof#1188) is a separate,
  orthogonal direction.
