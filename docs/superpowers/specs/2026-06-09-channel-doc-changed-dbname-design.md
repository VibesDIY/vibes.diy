# Channel-scoped `evt-doc-changed` reaches other clients (fix #2301)

## Problem

On a vibe that binds an **access function**, document changes made on one device
do not show up live on another connected client of the same vibe — they only
appear after the viewer's next local write or a full reload. The data is correct
(a reload shows it), so this is not a data/grants bug; the live re-query is never
triggered for remote changes. No-access-fn vibes are unaffected.

### Root cause

For access-fn vibes the server fans out `evt-doc-changed` **by channel**, and it
overloads the event's `dbName` field with the **channel name**:

- Write notify ([`app-documents-write-eventos.ts:461-469`](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts)):
  when the access fn returns channels, it calls
  `notifyDocChanged({ ownerHandle, appSlug, dbName: channel, docId }, …)` —
  `dbName` is set to the **channel**, never the real db.
- Fan-out ([`cf-serve.ts:91-114`](../../../vibes.diy/api/svc/cf-serve.ts)):
  `key = ownerHandle/appSlug/evt.dbName` matches subscribers (who registered
  channel keys), and the delivered payload is `{ type, ...evt }` — so the event
  reaches the client carrying `dbName = channel`.

The client **drops any `evt-doc-changed` whose `dbName` isn't the real database
name** ([`firefly-database.ts:138-148`](../../../vibes.diy/vibe/runtime/firefly-database.ts)):
`data.dbName === this.name` fails because `data.dbName` is the channel and
`this.name` is the real db (e.g. `default`). `notifyListeners` never fires, so
the `useLiveQuery`/`useDocument`/`useAllDocs`/`useChanges` re-query never runs.

The `dbName` filter exists deliberately (so a sibling db's events don't trigger
spurious reloads), but it assumes `dbName` is the real db — false for channel
fan-out.

**Why no-access-fn works:** with no channels, notify takes the else branch and
sends `dbName = <real db>`, so the client filter matches.

**Why #2299 doesn't cover this:** #2299 fixes the _new-grant_ path via a separate
`viewer-grants-changed` event. A plain **edit** (or any change that doesn't alter
the viewer's grants) emits no `viewer-grants-changed`, so the `evt-doc-changed`
path — the one that's broken here — is the only path that runs.

## Approach (chosen)

**Server-side decouple** the _routing key_ (channel) from the payload's `dbName`
(real db), so the strict client filter keeps working. Rejected alternative:
relaxing the client filter to match `ownerHandle/appSlug` only — that
reintroduces the cross-db spurious-reload problem the filter was added to prevent.

This change also fixes the adjacent **delete** gap (see Scope).

### Review note (Charlie, #2302)

Direction approved, no design fork. Three refinements folded in below:

- **Channel normalization (point 1).** `channel ?? dbName` only falls through on
  `null`/`undefined` — **not** `""`. An empty/whitespace-only channel would build
  a broken routing key (`ownerHandle/appSlug/`) instead of falling back to
  `dbName`. `channels` is currently an unconstrained `string[]` (readability only
  checks array length), so this is reachable. Fix: a shared `normalizeChannels`
  helper (trim, drop empty/whitespace-only, dedupe) applied in **both** the
  subscribe-key construction and the notify fan-out, so subscriber keys and
  notify keys still match. Route with `normalizedChannel ?? dbName`.
- **Delete fallback (point 2).** Treat the `accessFnOutputs` lookup as
  best-effort: fan out per-channel when valid channels exist, otherwise fall back
  to one `dbName` notify (output row can be missing — upsert failure, backfill
  skip).
- **`channel` in payload (point 3).** Keep it, informational only; ensure
  schema/types/forwarders accept it. `dbName` stays the real db identity; client
  matching stays `data.dbName === this.name`.

## Design

### 0. Shared helper: `normalizeChannels`

A small pure helper (colocated with the access-fn channel logic) that takes a
raw `string[]` and returns trimmed, non-empty, de-duplicated channels:

```ts
export function normalizeChannels(channels: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const c of channels) {
    const t = c.trim();
    if (t.length > 0) seen.add(t);
  }
  return [...seen];
}
```

Used by the subscribe handler (channel-key construction), the write notify path,
and the delete notify path — so a normalized channel never desyncs subscriber
keys from notify keys.

### 1. Type: add optional `channel` to `evtDocChanged`

[`api/types/app-documents.ts`](../../../vibes.diy/api/types/app-documents.ts) —
add an optional `channel` field. `dbName` continues to carry the real db (the
per-db ACL boundary). `channel`, when present, is the fan-out routing channel and
is purely informational to the client (the client filter ignores it).

```ts
export const evtDocChanged = type({
  type: "'vibes.diy.evt-doc-changed'",
  ownerHandle: "string",
  appSlug: "string",
  dbName: "string", // real db — the ACL boundary; client filter matches on this
  docId: "string",
  "channel?": "string", // fan-out routing channel for access-fn vibes
});
```

### 2. `notifyDocChanged` signature + routing

Both interface declarations ([`api/svc/types.ts:58`](../../../vibes.diy/api/svc/types.ts),
[`api/svc/create-handler.ts:51`](../../../vibes.diy/api/svc/create-handler.ts))
gain an optional `channel` on the `evt` arg:

```ts
notifyDocChanged?(
  evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; channel?: string },
  senderConnId: string
): Promise<void>;
```

The implementation in [`cf-serve.ts`](../../../vibes.diy/api/svc/cf-serve.ts)
`localBroadcastCallbacks` routes by `channel ?? dbName` but emits the payload
verbatim (so it carries the real `dbName` plus optional `channel`):

```ts
const routingKey = evt.channel ?? evt.dbName;
const key = `${evt.ownerHandle}/${evt.appSlug}/${routingKey}`;
const fullEvt = { type: "vibes.diy.evt-doc-changed", ...evt };
```

If a cross-shard DocNotify coordinator implementation also exists, it gets the
same `channel ?? dbName` routing treatment. (Verify during implementation;
`grep notifyDocChanged` shows only the local-broadcast impl today.)

### 3. Write path — pass real `dbName` + channel separately

[`app-documents-write-eventos.ts:461-474`](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts):

```ts
const channels = normalizeChannels(accessResult?.channels ?? []);
if (channels.length) {
  for (const channel of channels) {
    vctx.notifyDocChanged(
      { ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId, channel },
      clientWsSend(ctx).connId
    ).catch(...);
  }
} else {
  vctx.notifyDocChanged(
    { ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId },
    clientWsSend(ctx).connId
  ).catch(...);
}
```

`dbName` is now always the real db; the channel is a distinct routing argument.
Channels are normalized first, so an all-empty/whitespace `channels` array
correctly falls back to the single `dbName` notify. The subscribe handler
([read-eventos](../../../vibes.diy/api/svc/public/app-documents-read-eventos.ts))
applies the same `normalizeChannels` before building `channelKeys`, keeping
subscriber keys and notify keys in sync.

### 4. Delete path — per-channel fan-out (adjacent gap, in scope)

[`app-documents-write-eventos.ts:617-624`](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts)
currently notifies only with the real `dbName`, so on access-fn vibes nobody
(subscribed by channel key) receives delete events. Mirror the write path:

- Look up the AFB binding for `(ownerHandle, appSlug, dbName | "*")` (same query
  the write/subscribe paths use).
- If bound, read the deleted doc's stored channels from `accessFnOutputs` for
  `(ownerHandle, appSlug, dbName, docId, fnCid)` — the delete handler writes a
  tombstone but does **not** clean up `accessFnOutputs`, so the last write's
  output (with `channels`) is still present at notify time. Parse `channels` from
  the stored output JSON and run them through `normalizeChannels`.
- Fan out `notifyDocChanged({ …, dbName, docId, channel })` once per channel.
- **Best-effort fallback (Charlie point 2):** if unbound, the output row is
  missing (upsert failure / backfill skip), or normalization yields zero
  channels, fall back to the single `notifyDocChanged({ …, dbName, docId })`
  (current behavior, correct for no-access-fn vibes). The lookup never blocks the
  delete from completing.

This keeps deletes live on access-fn vibes without changing no-access-fn
behavior.

## Testing

### Server-side (primary — `createVibeDiyTestCtx`, one `AppSessions` DO)

- **Edit reaches channel subscriber with real dbName:** two connections on one DO.
  B subscribes (access-fn vibe → channel keys registered). A edits a doc in a
  channel B is subscribed to. Assert B's `WSSendProvider` receives an
  `evt-doc-changed` whose **`dbName` equals the real db name** (so the client
  filter would pass) and whose `channel` equals the routing channel.
- **Delete reaches channel subscriber:** same setup; A deletes the doc; assert B
  receives an `evt-doc-changed` with real `dbName` (+ channel).
- **No-access-fn regression:** plain vibe, A writes, B (subscribed by dbName)
  receives event with `dbName = real db`, no `channel`. Unchanged.
- **Sender exclusion preserved:** A does not receive its own event.
- **Empty-channel output (Charlie):** access-fn output whose `channels` are all
  empty/whitespace → `normalizeChannels` yields `[]` → write falls back to the
  single `dbName` notify (no broken `ownerHandle/appSlug/` routing key).
- **Delete with absent output row (Charlie):** delete a doc that has no
  `accessFnOutputs` row → falls back to the single `dbName` notify; delete still
  completes successfully.
- **`normalizeChannels` unit test:** trims, drops empty/whitespace-only, dedupes;
  order-independent set semantics.

### Manual

Two browser tabs of an access-fn vibe, same handle. Edit on A surfaces live on B
with no reload. Delete on A removes the doc live on B.

## Out of scope

- Owner-override "channels added after subscribe aren't covered" limitation
  (pre-existing, noted in the subscribe handler).
- Any change to the `viewer-grants-changed` path (#2299 owns it).
