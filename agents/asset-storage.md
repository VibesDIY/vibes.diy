# Asset Storage

How to store and retrieve binary assets (images, files) in vibes.diy.

## The Interface

All asset operations go through `VibesAssetStorage` (`vibes.diy/api/types/index.ts:66-69`):

```ts
interface VibesAssetStorage {
  fetch: (url: string) => Promise<FetchResult>;
  ensure: (...items: ReadableStream<Uint8Array | string>[]) => Promise<Result<StorageResult>[]>;
}
```

Access it via `vctx.storage` in any server-side handler that has `VibesApiSQLCtx`.

The storage backend is abstract — SQLite in dev, could be Postgres or R2 in production. Code against the interface, not the implementation.

## Storing a File

Pass one or more `ReadableStream<Uint8Array>` to `ensure()`. Each stream is content-hashed (CID) and stored. If the same bytes already exist, the existing entry is returned.

```ts
import { uint8array2stream } from "@adviser/cement";

// From raw bytes:
const bytes = new Uint8Array([...]);
const [result] = await vctx.storage.ensure(uint8array2stream(bytes));

// From a fetch response body:
const response = await fetch("https://example.com/image.png");
const [result] = await vctx.storage.ensure(response.body);

// Multiple files at once:
const results = await vctx.storage.ensure(stream1, stream2, stream3);
```

### StorageResult

```ts
interface StorageResult {
  cid: string; // Content-addressed ID (base58btc hash)
  getURL: string; // Internal storage URL (e.g. "sqlite://Assets/z98qy...")
  mode: "created" | "existing"; // Whether this was a new store or dedup hit
  created: Date;
  size: number; // Bytes stored
}
```

## Retrieving a File

```ts
const result = await vctx.storage.fetch(storageResult.getURL);

if (isFetchOkResult(result)) {
  // result.data is ReadableStream<Uint8Array>
  // result.url is the URL you fetched
}
if (isFetchNotFoundResult(result)) {
  // Asset doesn't exist
}
if (isFetchErrResult(result)) {
  // result.error has details
}
```

Type guards: `isFetchOkResult`, `isFetchErrResult`, `isFetchNotFoundResult` from `@vibes.diy/api-types`.

## Serving via HTTP

The `/assets/cid` endpoint serves stored assets over HTTP. Build the URL from the `StorageResult`:

```ts
const httpUrl = `/assets/cid?url=${encodeURIComponent(storageResult.getURL)}&mime=${encodeURIComponent(mimeType)}`;
```

This URL works in `<img src>`, `<a href>`, `fetch()`, etc. It works on both the main domain and vibe subdomains.

**Response**: raw binary with `Content-Type` from the `mime` param, cached immutably (content-addressed).

**CORS**: `Access-Control-Allow-Origin: *` set globally — no cross-origin issues.

Handler: `vibes.diy/api/svc/public/cid-asset.ts`

## Helper: base64 data URL to stored asset

```ts
const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
if (match) {
  const mime = match[1];
  const raw = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  const [result] = await vctx.storage.ensure(uint8array2stream(raw));
  if (result?.isOk()) {
    const httpUrl = `/assets/cid?url=${encodeURIComponent(result.Ok().getURL)}&mime=${encodeURIComponent(mime)}`;
  }
}
```

## WebSocket Size Limit

Cloudflare Workers WebSocket silently drops messages over ~1MB. Raw base64 images are typically ~2MB. Always store large binary data as assets and pass the short URL reference instead of inline data.

## Current Uses

- **Screenshots**: Queue worker stores JPEG screenshots, references them in `apps.meta`
- **Image generation**: `prompt-chat-section.ts` stores generated images (from Prodia or OpenRouter), replaces `block.image` URLs with asset references before WebSocket delivery

## Key Files

- `vibes.diy/api/types/index.ts:22-69` — `FetchResult`, `StorageResult`, `VibesAssetStorage` interfaces
- `vibes.diy/api/svc/public/cid-asset.ts` — HTTP serving endpoint
- `vibes.diy/api/svc/types.ts:46` — `vctx.storage` on `VibesApiSQLCtx`
