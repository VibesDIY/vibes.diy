# Storage progress events for generic file uploads

## Problem

`vibes-diy push` sends a single WebSocket request (`vibes.diy.req-ensure-app-slug`) and waits for a single response. With `R2ToS3Api`'s multipart streaming path, server-side R2 work for a multi-MB asset takes real network time (5-30s+ for tens of MB). During that window the protocol is silent — no messages flow client → server → client. Hits the client-side request timeout.

[VibesDIY/vibes.diy#1537](https://github.com/VibesDIY/vibes.diy/pull/1537) bumped the CLI's idle timeout to 30s as a workaround. That gives breathing room for ~50 MB pushes, but as soon as someone pushes a real binary asset (50+ MB, video, large CSV, etc.) the silence wins again.

The right fix is for the server to emit progress events from where the work actually happens, so the client's idle window keeps resetting on real signal.

## Scope

**In scope: generic file uploads via push.** Anything the user pushes through `vibes-diy push` that ends up calling `storage.ensure(...streams)` on the server side. Today this is `App.jsx` + transformed JS + import-map; tomorrow it's whatever multi-MB binary assets users want to ship alongside their vibes.

**Out of scope:**
- **Image generation** (`prompt-chat-section.ts:856`, Prodia). Chat already has `SectionEvent`s flowing to subscribed connections during streaming via `appendBlockEvent`. That mechanism already keeps clients alive; adding a parallel storage-progress channel would be redundant noise.
- **Chat block image base64** (`prompt-chat-section.ts:230`). Same reason — chat's existing event stream covers this.
- **Internal `write-apps` helpers** (`write-apps.ts:141, 200`). Always small (KB to single-digit MB) and called downstream of push; the push handler's own progress events implicitly cover them.
- **Queue screenshot writes** (`store-screenshot.ts:50`). Background queue worker; no client connection to keep alive.

## Why progress at the call point, not a `setInterval`

Two designs were considered:

1. **Synthetic heartbeat** — `setInterval(() => sendProgress(...), 5000)` wrapping the long await. Simple but vacuous: emits messages even when nothing's happening, and the client can't distinguish "still working" from "wedged but our heartbeat fired one last time before the worker died."
2. **Real progress at the call point** — emit a message every time the server actually makes progress: per `uploadPart` completion, per asset commit. Real signal, doubles as keepalive.

Going with (2). Each `R2ToS3Api.uploadPart` finishing is a concrete "X bytes of asset Y are durably in R2" event. For an 8 MiB raw + 8 MiB transformed push that's ~6 events naturally (2 parts × 2 large assets, plus rename parts), well within a 10s idle window without padding.

## Design

### Type

[api/types/common.ts](../vibes.diy/api/types/common.ts):

```ts
export const resProgress = type({
  type: "'vibes.diy.res-progress'",
  "stage?": "string",      // free-form: "uploading-part" | "asset-stored" | "rename-part"
  "bytes?": "number",      // bytes durably stored so far for the current asset
  "partNumber?": "number", // for multipart paths
});
export type ResProgress = typeof resProgress.infer;
export function isResProgress(obj: unknown): obj is ResProgress { ... }
```

This payload doesn't match `isResEnsureAppSlug` so the client's `request()` evento-validate returns `Option.None()` — the message is silently ignored at the routing layer. But `onMessage` already fired, which resets the idle timer ([api-impl idle timeout, PR 1537](https://github.com/VibesDIY/vibes.diy/pull/1537)).

### Plumbing

Per-call `onProgress` on `storage.ensure`, mirroring how `ensureStorage(opts, ...peers)` already overloads:

```ts
interface EnsureCallOptions {
  onProgress?: (info: ProgressInfo) => void;
}

ensure(...items: ReadableStream<Uint8Array | string>[]): Promise<Result<StorageResult>[]>;
ensure(opts: EnsureCallOptions, ...items: ReadableStream<Uint8Array | string>[]): Promise<Result<StorageResult>[]>;
```

The 5 call sites that don't need progress (chat blocks, Prodia, write-apps internal, screenshot queue) stay byte-for-byte unchanged. Only the push handler opts in.

**Why per-call, not factory-level**: [cf-serve.ts:131](../vibes.diy/api/svc/cf-serve.ts#L131) builds one `R2ToS3Api` and one `vctx.storage` per worker invocation. A WebSocket worker handles many requests over its lifetime, so a factory-level callback can't route correctly — the same singleton serves a push from connection A and a write-apps call downstream of a chat from connection B. The handler that owns the request needs to own the routing.

### Plumb-through path

Progress flows up from where work happens:

```
R2ToS3Api.uploadPart() succeeds
  → calls onProgressPart? cb registered at put() entry
  → S3PeerStream forwards to onProgress? cb registered at begin()
  → ensureStorage forwards to onProgress? cb registered on storage.ensure() call
  → push handler's onProgress callback
  → wrapMsgBase + conn.send back to the requester
```

Each layer takes the callback as an option, defaults to no-op. Nothing in the existing call chain changes shape unless a caller opts in.

### Emit point: `R2ToS3Api`

The natural granularity is per `uploadPart` resolve. In the unified put path:

```ts
// inside flushPartBackground (background promise):
const r = await exception2Result(() => mp.uploadPart(myPartNumber, merged));
if (r.isErr()) return Result.Err(r.Err());
completedParts.push(r.Ok());
onProgress?.({ stage: "uploading-part", partNumber: myPartNumber, bytes: PART_SIZE });
```

Same in `copyLargeObjectStreaming` (rename multipart copy). Small-path single-PUT emits one terminal `{ stage: "asset-stored", bytes: total }`.

### Wire-up at the push handler

[ensure-app-slug-item.ts:174-194](../vibes.diy/api/svc/public/ensure-app-slug-item.ts#L174-L194). Replace:

```ts
const rAppSlugBinding = await ensureAppSlugItem(vctx, req);
```

with an `onProgress` callback that builds a `wrapMsgBase` envelope and sends it back via the same connection that received the request. Reuses the request's tid (clean: client correlates, doesn't have to invent a separate channel).

`ensureAppSlugItem` itself takes a callback param it can pass through to `vctx.storage.ensure(opts, ...streams)`.

### Cadence

Per `uploadPart` is 5 MiB granularity. For a 100 MB push that's 20 events — fine, not chatty. For pushes <5 MiB the small path is single-PUT and emits one `asset-stored` event at the end (which is also when the response goes out — no idle window concern).

If someone pushes a 5 GiB asset, that's 1024 events. Still fine for our use case; if it ever becomes an issue we'd switch to byte-thresholded coalescing (`emit at most once per 64 MB`).

## Drop the 30s CLI bump

Once progress events flow during multipart, the [vibes-diy/cli/main.ts CLI default of 30s idle](../vibes-diy/cli/main.ts) goes back to api-impl's 10s default. A truly silent connection is detected within 10s; an actively-progressing push stays alive indefinitely.

## What this doesn't fix

- **Server pages of work that aren't storage**. A handler doing slow LLM-side work or slow DB-side work still appears silent. Each long-tail handler needs its own progress emission. This PR scopes to storage; we'll add others as they manifest.
- **True streaming progress to the user as a UX feature** (e.g. "uploading 47% of MyVideo.mp4"). The payload supports it (`bytes`, `partNumber`) but the CLI doesn't render it. Future work.

## Verification

1. `pnpm test r2-to-s3api` — add a case asserting `onProgress` is called the expected number of times for a multipart upload.
2. PR preview: push an 8+ MiB vibe with the CLI's idle reset to 10s. Should succeed (progress events keep it alive).
3. Wrangler tail during the push: should see N `vibes.diy.res-progress` messages emitted before the final response.
