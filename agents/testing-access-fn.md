# Testing Access Functions

How to write unit/integration tests for access-function behavior — channel routing,
grant reduction, channel-gated reads, and doc-changed fan-out — using the api test
harness. For the runtime semantics themselves see [fireproof-channels.md](fireproof-channels.md);
for the _generation_ eval harness (does the LLM emit a good access.js) see
[eval-access-fn.md](eval-access-fn.md). This doc is about testing the _server behavior_.

Tests live in `vibes.diy/api/tests/` (project name `api-tests`). Treat that directory
as core code — see [code-quality.md § core code](code-quality.md).

## Running

```bash
# one file by substring, just the api-tests project (fast)
npx vitest --run --project api-tests <substring>
# e.g.
npx vitest --run --project api-tests subscribe-channel-keys
```

The project's globalSetup provisions an isolated libsql SQLite db per run
(`vibe-diy-test-ctx.ts` → `createIsolatedSqliteDB`). Don't point tests at Neon/prod.

## The harness: `createVibeDiyTestCtx`

`createVibeDiyTestCtx(sthis, deviceCA, opts)` returns the app context. Key opts:

- `invokeAccessFn(params) => AccessDescriptor | { forbidden }` — **stub the access fn
  result.** The access.js _source_ is only used for binding extraction (below); the
  _result_ a write/read sees comes from this stub. The standard pattern is a mutable
  recorder you flip per write:
  ```js
  const access = { result: { channels: ["notes"], grant: { public: ["notes"] }, allowAnonymous: true } };
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, { invokeAccessFn: async () => access.result });
  // later: access.result = { channels: ["secret"], allowAnonymous: false };
  ```
- `notifyDocChanged(evt, senderConnId)` — record or fan out doc-changed events. Leave
  unset if a test drives fan-out manually (see end-to-end below).
- `notifyViewerGrantsChanged`, `notifyRequestGrantChanged` — same idea for grant events.

### One socket per context

The harness models **one WebSocket = one `WSSendProvider` = one connection**. Multiple
"users" multiplex over the **same** `wsPair.p1` by handing each `VibesDiyApi` a different
`getToken`. See `access-fn-cross-user-grant.test.ts` — owner and reader share one socket.

```js
const wsPair = TestWSPair.create();
const wsEvento = vibesMsgEvento();
const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
appCtx.vibesCtx.connections.add(wsSendProvider);
wsPair.p2.onmessage = (event) =>
  wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });

const ownerApi = new VibesDiyApi({ apiUrl: "...", ws: wsPair.p1, timeoutMs: 10000, getToken: async () => Result.Ok(await ownerUser.getDashBoardToken()) });
```

**Pitfall:** do **not** create a second `wsPair`/provider per "tab" and expect the handler
to register on the provider you pass. The handler resolves its provider via
`clientWsSend(ctx) = ctx.send.provider`; a hand-rolled multi-socket setup will register
keys on a different provider than the one you inspect, and your assertions silently read
an empty set. Use the single-socket model and, for cross-connection fan-out, drive
`localBroadcastCallbacks` directly (below).

## Binding extraction: named exports → db bindings

`processAccessBindings` (via `parseExportNames`) creates **one access-fn binding per
`export function NAME`**, where `NAME` is the **db name** it gates. `export default` →
db `*` (wildcard). So to set up a channel ≠ db app, name the function after the db:

```js
const ACCESS_JS = `export function quicknotes(doc, oldDoc, user) {
  return { channels: ["notes"], grant: { public: ["notes"] }, allowAnonymous: true };
}
export function emptyroom(doc, oldDoc, user) {       // a binding that's never written
  return { channels: ["whispers"], allowAnonymous: true };
}`;
```

Bindings are created at `ensureAppSlug` time (extraction reads the `/access.js` code
block). You can read them back from `vctx.sql.tables.accessFunctionBindings`.

## Materializing channels & grants

Channel membership and public channels are **discovered from materialized access-fn
outputs**, not from the access.js text. A `putDoc` whose stubbed result carries a grant
writes an `accessFnOutputs` row with `hasGrants=1`:

```js
access.result = { channels: ["notes"], grant: { public: ["notes"] }, allowAnonymous: true };
await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "quicknotes", doc: { type: "note", text: "seed" } });
```

This is what makes `notes` discoverable to a _later_ `subscribeDocs`. A db with a binding
but no such write has **no materialized channel** — see the "join before grant" gap in
[#2337]. You can also seed `accessFnOutputs` rows directly when you need precise state
(see `access-fn-channel-read.test.ts` for the insert/upsert shape).

## Asserting subscription keys

`subscribeDocs` registers per-`(ownerHandle/appSlug/<key>)` strings on the connection's
`WSSendProvider.subscribedDocKeys`. Inspect it directly after a subscribe:

- **Access-fn db, channel materialized** → registers the **channel** key
  `owner/app/<channel>` (one per effective + public channel), **not** the bare db key.
- **Access-fn db, no materialized channel** → falls back to the **bare db** key
  `owner/app/<db>`.
- **No binding** → bare db key.

`subscribedDocKeys` **accumulates** across subscribes on a shared connection — call
`wsSendProvider.subscribedDocKeys.clear()` at the start of each test (as the override test
in `access-fn-channel-read.test.ts` does).

### Override vs non-override

The owner only takes the **override** path (subscribe to _all_ channels in any output)
when the connection is in **adminMode**, set via
`ownerApi.whoAmI({ tid, appSlug, ownerHandle, adminMode: true })`. adminMode is **sticky
per connection** once set — don't expect to re-test the non-override path on the same
socket afterward. Without adminMode the owner takes the grant/public-channel path.

## Doc-changed fan-out

`evt-doc-changed` is **routed by channel** but **carries the real dbName** so the
client's `data.dbName === this.name` filter matches (see [#2301]). Two layers to test:

- **Unit (routing):** `local-broadcast-doc-changed.test.ts` — construct `WSSendProvider`s,
  set `subscribedDocKeys`, call `localBroadcastCallbacks(connections, env).notifyDocChanged`,
  assert who receives and that the payload keeps the real dbName + excludes the sender.
- **Emit:** `doc-changed-channel-fanout.test.ts` — a `notifyDocChanged` recorder asserts
  putDoc/edit/delete notify **per channel** with the real dbName.
- **End-to-end (subscribe → write → deliver):** subscribe via the api (real key
  computation), register `ownerApi.onDocChanged(cb)`, then drive the real fan-out with an
  **external sender id** so the receiver isn't excluded:
  ```js
  const fanout = localBroadcastCallbacks(appCtx.vibesCtx.connections, { ENVIRONMENT: "test" });
  await fanout.notifyDocChanged(
    { ownerHandle, appSlug, dbName: "quicknotes", docId: "live-1", channel: "notes" },
    "external-writer-conn"
  );
  // cb fires with dbName === "quicknotes"
  ```
  See `subscribe-channel-keys.test.ts`.

## Channel-gated reads

`queryDocs` / `getDoc` filter to the caller's effective channels + public channels.
`access-fn-channel-read.test.ts` covers: query returns only in-channel docs, getDoc
returns `not-found` for gated docs, and owner adminMode override sees across channels.
Cross-user grants ("follow"/scan) are in `access-fn-cross-user-grant.test.ts`.

## Files to copy from

| Scenario                                       | File                                  |
| ---------------------------------------------- | ------------------------------------- |
| Channel-gated reads, override, adminMode       | `access-fn-channel-read.test.ts`      |
| Cross-user grant, two users on one socket      | `access-fn-cross-user-grant.test.ts`  |
| Per-channel emit carries real dbName           | `doc-changed-channel-fanout.test.ts`  |
| Fan-out routing (unit)                         | `local-broadcast-doc-changed.test.ts` |
| Subscribe-key computation + end-to-end deliver | `subscribe-channel-keys.test.ts`      |

[#2301]: https://github.com/VibesDIY/vibes.diy/issues/2301
[#2337]: https://github.com/VibesDIY/vibes.diy/issues/2337
