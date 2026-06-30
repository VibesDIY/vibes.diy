# Live merge: `merge()` broadcasts an ephemeral overlay to peers (#1756)

## Problem

`useDocument().merge()` is page-only. It updates local React state (`setDoc`)
and is lost on refresh. The only way to make a doc change visible to other peers
today is `save()`, which writes every event to the op log forever — the wrong
tool for ephemeral, high-frequency presence state (cursor position, hover,
selection, "user is typing").

We want `merge()` to *also* fan out the partial doc to peers subscribed to the
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
// each peer broadcasts under its own stable _id:
const { merge } = useDocument({ _id: `cursor-${myHandle}`, curX: 0, curY: 0 });
onMouseMove = (e) => merge({ curX: e.clientX, curY: e.clientY }); // broadcasts (has _id)

// everyone reads the room with the hook they already use — no new surface:
const others = useLiveQuery("type", { key: "cursor" }).docs;       // ephemeral rows appear here
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
sub-second, so the only observable collision is two people typing into the *same
already-`_id`'d form* simultaneously; it degrades gracefully (the next keystroke
or the eventual `save()` reconciles). We explicitly accept this rather than
inventing a per-peer reconciliation surface that would leak into generated vibe
code.

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
  broadcasts `partial` to peers on the same `(ownerHandle, appSlug, dbName,
  channel)`. No `_id` → page-only.
- Receivers fold `partial` into an in-memory overlay keyed by `_id`, surfaced
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
  dbName: "string",        // real db — the ACL boundary; client filter matches on this
  docId: "string",
  originPeer: "string",    // sender connId — the disconnect-cleanup key
  partial: "object",       // the merged fields
  "channel?": "string",    // fan-out routing channel for access-fn vibes (mirrors evtDocChanged)
});

export const evtDocEphemeralDrop = type({
  type: "'vibes.diy.evt-doc-ephemeral-drop'",
  ownerHandle: "string",
  appSlug: "string",
  dbName: "string",
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
  gains `broadcastEphemeral(docId: string, partial: Record<string, unknown>,
  dbName?: string): void` — **fire-and-forget, no request/response, no await** so
  a 60Hz caller never blocks. Implemented in the WS adapter
  ([`firefly-api-adapter.ts`](../../../vibes.diy/api/impl/firefly-api-adapter.ts))
  and the in-iframe `VibeSandboxApi`.
- `FireflyDatabase` gets a thin `broadcastEphemeral(docId, partial)` forwarding to
  the transport with `this.name` as `dbName`.
- `use-firefly.ts` `merge()` adds exactly one branch:

  ```ts
  const merge = useCallback((newDoc: Record<string, unknown>) => {
    updateHappenedRef.current = true;
    setDoc((prev) => ({ ...prev, ...newDoc }));
    if (doc._id) database.broadcastEphemeral(doc._id as string, newDoc); // new
  }, [doc._id]);
  ```

  The public `merge()` API is byte-for-byte identical.

- **Backpressure — sender-side coalescing, keyed by `_id`.** A small per-db
  coalescer collapses bursts to one send per animation frame (~16–50ms, env- or
  constant-tunable), keeping only the latest partial per `_id`. Routing cannot do
  backpressure (rosters need channel-wide fan-out), so the sender owns it.
  Coalescing merges partials within a frame so no field is dropped, only
  intermediate frames.

### 3. Server fan-out (emit-only, never store)

- A new `notifyDocEphemeral` callback in
  [`cf-serve.ts`](../../../vibes.diy/api/svc/cf-serve.ts) `localBroadcastCallbacks`,
  routed by the **same `channel ?? dbName` key** as `notifyDocChanged`, iterating
  `connections` and skipping the `originPeer`'s own connection. It **never
  inserts anything** — a pure relay. No CRDT, clock, or carstore.
- The client `broadcastEphemeral` send is received by an evento handler that calls
  `notifyDocEphemeral`. (Mirror the existing subscribe/notify wiring; reuse
  `normalizeChannels` for the routing key.)
- `VibesApiSQLCtx` (`api/svc/types.ts`, `api/svc/create-handler.ts`) gains an
  optional `notifyDocEphemeral?(evt, senderConnId)` alongside `notifyDocChanged`.

### 4. Receiver overlay (the hidden bit)

In [`FireflyDatabase`](../../../vibes.diy/vibe/runtime/firefly-database.ts):

- State: `ephemeralOverlay: Map<docId, { partial, originPeer, seq }>` plus a
  `peerDocs: Map<originPeer, Set<docId>>` index for cleanup.
- On `evt-doc-ephemeral` (matched on `ownerHandle`/`appSlug`/`dbName` exactly like
  the existing `evt-doc-changed` filter): upsert the slice (latest `seq` wins),
  update `peerDocs`, then `notifyListeners([{ _id: docId }])` — reusing the exact
  notify→refetch path.
- **Overlay applied inside the read methods** so hooks need zero changes:
  - `get(id)` → `{ ...persisted, ...overlay[id]?.partial }` (and returns a
    synthesized doc when there is no persisted doc but an overlay exists).
  - `query()` / `allDocs()` → fold overlay slices over the persisted rows; an
    overlay-only `_id` is emitted as a synthesized row so it appears in
    `useLiveQuery` / `useAllDocs`.
- `updateHappenedRef` on the originating peer already suppresses its own
  refetch (so local `setDoc` wins); remote peers have `updateHappenedRef ===
  false` and refetch normally. No change needed there.

### 5. Disconnect cleanup

- `cf-serve.ts` already removes a connection on close/error. Hook there to emit
  `evt-doc-ephemeral-drop { originPeer }` to the remaining peers on that vibe.
- Receivers purge every overlay slice whose `originPeer` matches (via `peerDocs`),
  then `notifyListeners` the affected `_id`s, so a departed user's cursor vanishes
  automatically. A shared-`_id` slice last written by a still-connected peer
  survives, because each slice records its writer.

## Testing

### Server (one `Sessions` DO, `createVibeDiyTestCtx`)

- A's `broadcastEphemeral` reaches B with the real `dbName` + `partial`; A is
  excluded (sender skip).
- Nothing is persisted: after the broadcast, B's `getDoc`/`queryDocs` for a
  never-saved `_id` still returns not-found / persisted-only.
- Access-fn vibe: routed by channel; a subscriber on the wrong channel does not
  receive it.
- Disconnect: closing A's connection delivers `evt-doc-ephemeral-drop` to B.

### Receiver overlay (unit, against `FireflyDatabase`)

- Overlay folds into `get()` (merge over persisted; synthesized when absent).
- Overlay-only `_id` appears as a `query()` / `allDocs()` row.
- Last-write-wins on a shared `_id`.
- Drop-by-peer removes only that peer's slices; a co-written `_id` kept alive by
  another peer survives.

### Sender (unit)

- Coalescer collapses a burst to one send per frame, keeping the merged latest
  partial per `_id`; distinct `_id`s are not collapsed together.

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
- **A `merge()` opt-out flag.** None added; the `_id` gate is the only switch.
- **The `trip:current` wart.** A *form* on an already-`_id`'d singleton
  (`useDocument({ _id: "trip:current" })` edited keystroke-by-keystroke) will
  broadcast in-progress input. It is self-correcting (the `save()` value replaces
  the overlay) and accepted as the price of a flag-free surface.
- **Cross-DO / cross-shard fan-out.** Out of scope by the same reasoning as the
  rest of the live-data-fanout work (#2328): everyone lands on the same per-vibe
  `Sessions` DO via `/api/app`. Do not resurrect a cross-DO coordinator.

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
