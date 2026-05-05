## Goal

A thin HTTP endpoint that uploads bytes and returns a content-addressed CID, gated by a short-lived signed grant minted over WebSocket. The eventual upload path for Fireproof `_files`, and the right unit for verifying the storage layer end-to-end without `req-ensure-app-slug`'s post-storage long tail.

## What we found chasing the 8 MiB push timeout

The progress-events round (commits `24c2bf14..d05528b0` on `jchris/r2-storage-activation`) wired per-call `onProgress` through `storage.ensure → S3Peer → R2ToS3Api`, emitted `vibes.diy.res-progress` envelopes from the push handler, and dropped the CLI's idle bump from 30s back to 10s. End-to-end verification surfaced the next bottleneck:

- 5 progress events fire and reach the client correctly within the first ~7s of an 8 MiB push (verified via tail + a temporary client-side `[cli-onMessage]` log).
- After the last storage event, the push handler runs ~10–13s of *silent* work — `transformJSXAndImports` does a second `storage.ensure` for the transformed JS (also ~8 MiB → multipart), `createImportMap` does a third, `ensureApps` runs DB writes, then `postQueue` posts to the queue worker. None of that emits keepalive.
- 10s of post-storage silence trips the client idle timer. The push fails even though the server eventually finishes successfully.

Threading `onProgress` through every internal call is viral and explicitly out of scope per [storage-progress.md](storage-progress.md). The protocol already anticipates a better answer.

## Why we're not streaming `req-ensure-app-slug`

`req-ensure-app-slug` carries asset content inline as `Uint8Array` in a single WS message. Storage internally streams from a `ReadableStream` wrapped around already-buffered bytes, but the WS frame is monolithic. We are **not** changing that.

The protocol already includes [`VibeCodeRef`, `VibeStrAssetRef`, `VibeUint8AssetRef`](../vibes.diy/api/types/common.ts) — file-system items with a `refId` (CID) instead of inline content. Currently rejected by [ensure-app-slug-item.ts](../vibes.diy/api/svc/public/ensure-app-slug-item.ts) with `unsupported file system item type`, but the shape is reserved.

Forward path:

1. Client streams asset(s) ahead of time → gets CIDs.
2. Client sends `req-ensure-app-slug` with `*-ref` items pointing at those CIDs. Tiny WS payload.
3. Handler implements the `*-ref` types: confirm asset exists, use the CID directly without re-uploading.

This is also exactly the eventual `_files` flow — Fireproof attaches a CID to a doc field, the asset was already uploaded.

## Why HTTP for the upload, but WebSocket for the grant

Object stores work this way for a reason. The upload itself wants HTTP semantics: streaming body, no idle-timer concern, browser-native (`fetch(url, {body: file})`). The *authorization* wants the existing WS auth context: the user is already authenticated on the connection, the server already knows what apps they have access to.

Three options were considered for the upload endpoint shape:

1. **HTTP POST `/assets` with a presigned grant (chosen).** Body streams via `request.body` directly into `vctx.storage.ensure(...)`. The grant in the request validates the upload. ~30 lines of HTTP handler + a small grant issuer.
2. **WS streaming (`begin → chunks → end`).** ~80–120 lines including server-side `Map<uploadId, WritableStream>` state. Duplicates what HTTP body-streaming gives natively.
3. **WS single-message.** Trivial but hardcodes the single-message constraint we're trying to escape.

HTTP wins on every axis except "tests the WS progress events" — which the existing push handler still exercises. We don't need a second test surface for the same plumbing.

HTTP is a first-class pattern in the API: [cf-serve.ts:201-205](../vibes.diy/api/svc/cf-serve.ts#L201-L205) routes non-WS requests to `processRequest`, [svc-http-send-provider.ts](../vibes.diy/api/svc/svc-http-send-provider.ts) handles HTTP responses, and existing handlers like [cid-asset.ts](../vibes.diy/api/svc/public/cid-asset.ts) (`GET /assets/cid?url=...`) sit in the same `EventoHandler<Request, ...>` slot.

`POST /assets` and `GET /assets/cid?url=...` are clean siblings: the upload returns a CID, the existing fetch route resolves it.

## Authorization model: presigned grants

### Why not a static auth header

We initially considered carrying `DashAuthType` in an `Authorization` header. The fundamental problem: the natural permission check at upload time is "is user U allowed to upload to app X?" — and at *runtime* (the `_files` use case), the answer isn't "U is the owner of X." Apps have many users; any authorized user can write `_files`. Owner-binding is the wrong gate.

Presigned grants get this right by issuing a short-lived signed token over the WS connection where the access check naturally lives.

### Flow

```
1. Client (CLI or browser) has a WS connection authenticated as user U.
2. Client → server (over WS):
     ReqAssetUploadGrant {
       type: "vibes.diy.req-asset-upload-grant",
       auth, userSlug, appSlug,
     }
3. Server WS handler:
     - verifyAuth (existing): user U is who they claim
     - app-access check: user U has permission to upload to (userSlug, appSlug)
       (same access semantics as Firefly read/write — including invite-grants
        and public-access apps)
     - mint signed JWT with claims { userId, userSlug, appSlug, exp, jti }
       and TTL ~60s
     - reply ResAssetUploadGrant { uploadUrl, grant, expiresAt }
4. Client → server (over HTTP):
     POST /assets
     X-Asset-Grant: <jwt>
     Content-Type: application/octet-stream
     Body: <bytes>
5. HTTP handler:
     - verify grant signature, check exp
     - vctx.storage.ensure(req.body)
     - INSERT INTO AssetUploads (uploadId=jti, userId, userSlug, appSlug, cid, size, mimeType, created)
     - return JSON { cid, getURL, size, uploadId }
```

The HTTP endpoint never calls `verifyAuth`. The grant *is* the auth, and it carries everything the audit row needs.

### Settled details

- **Header `X-Asset-Grant`**, not query string or path segment. Keeps the JWT out of access logs. The WS response returns `uploadUrl` (no grant in URL) and `grant` (separate field); client opaquely combines them.
- **Audit row on upload, not grant.** Grants are abundant and uninteresting; only successful uploads matter for quota math.
- **`uploadId` = the JWT's `jti`.** Single source of truth; client can reference it before upload completes if needed.
- **Replay is benign.** R2 is content-addressed; a replayed upload with the same bytes produces the same CID. Worst case: a duplicate `AssetUploads` audit row, which is what an event log is for.
- **Grant TTL: 60s.** Long enough for slow clients to start the upload after receiving the URL; short enough that a leaked grant is mostly useless.

### Signing key — HKDF-derived from `CLOUD_SESSION_TOKEN_SECRET`

The worker already has signing infrastructure: `CLOUD_SESSION_TOKEN_SECRET` (used by `createFPToken` for FPCloud sandbox JWTs), `deviceIdCA` (heavier — full CA private key for cert issuance), and `jose` is in deps and used.

Provisioning a new env var per environment is real ops cost. A shared root secret with audience-discrimination is operationally cheap but cryptographically weak (a leak of either system leaks both). HKDF gives both: zero new env vars *and* cryptographic separation.

```ts
// once at worker startup, cached
const grantSigningKey = await hkdf(rootSecret = CLOUD_SESSION_TOKEN_SECRET,
                                   info = "vibes.diy.asset-grant.v1");
```

A leak of the derived asset-grant key never exposes the FPCloud signing key (HKDF is one-way). Rotating the root invalidates both cleanly. Future "asset-grant-v2" rotates the derived key without touching env. New signed-token use cases (browser doc-upload grants, sub-resource grants, etc.) get their own `info` strings — same root, different keys, no new secrets to provision.

Implementation: `crypto.subtle.deriveKey(HKDF, ...)` is one call. The derivation runs at handler-construct time and the derived key is held in the per-worker context.

## Database — content-addressed plus an upload audit log

[vibes-diy-api-schema-pg.ts:11](../vibes.diy/api/sql/vibes-diy-api-schema-pg.ts#L11):

```ts
sqlAssets = pgTable("Assets", {
  assetId: text().primaryKey(),  // CID
  content: bytea().notNull(),
  created: text().notNull(),
});
```

No `userId`, no `appSlug`, no foreign keys. Same for R2 (global `s3://r2/<cid>` keys). The architecture is content-addressed — two users uploading the same bytes get the same CID; dedup is automatic.

The `Apps.fileSystem` jsonb references are how assets get *bound* to apps in the existing system. The new `POST /assets` flow needs an explicit audit table, mirroring how `PromptContexts` audits LLM token usage:

```ts
sqlAssetUploads = pgTable("AssetUploads", {
  uploadId: text().primaryKey(),     // = JWT jti
  userId: text().notNull(),          // who uploaded (Clerk userId)
  userSlug: text().notNull(),        // app owner namespace
  appSlug: text().notNull(),
  cid: text().notNull(),             // logical FK into Assets / R2
  size: integer().notNull(),         // for SUM-based quota math
  mimeType: text(),                  // optional client hint
  created: text().notNull(),
}, (table) => [
  index("AssetUploads_app_idx").on(table.userSlug, table.appSlug, table.created),
  index("AssetUploads_user_idx").on(table.userId, table.created),
  index("AssetUploads_cid_idx").on(table.cid),
]);
```

This way:

- `Assets` table stays content-addressed and dedup-friendly. Same CID space as today; nothing changes for existing referenced blobs.
- `AssetUploads` is the audit/quota layer — every upload event is a row, attributing bytes to (user, app). Same shape and indexing as `PromptContexts`.
- Quota becomes `SUM(size) WHERE userSlug=? AND appSlug=?` — identical pattern to `SUM(totalTokens)` for LLM rollups.
- For the runtime-`_files` case where any app user uploads: `userId` records who, `userSlug`/`appSlug` records the app, ownership is implicit via the app — exactly the right model.

## Endpoint shapes

### WS — grant issuance

```ts
ReqAssetUploadGrant = type({
  type: "'vibes.diy.req-asset-upload-grant'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  "mimeType?": "string",
});

ResAssetUploadGrant = type({
  type: "'vibes.diy.res-asset-upload-grant'",
  uploadUrl: "string",        // absolute, e.g. https://api.../assets
  grant: "string",            // JWT
  expiresAt: "string",        // ISO 8601
  uploadId: "string",         // = jti, returned for client-side correlation
});
```

Handler in `vibes.diy/api/svc/public/asset-upload-grant.ts`. Uses `checkAuth` for the user's identity, then app-access check (whatever existing helper applies — `verifyAppAccess` / equivalent of the FPCloud token grant logic), then mints the JWT.

### HTTP — upload

```
POST /assets
X-Asset-Grant: <jwt>
Content-Type: application/octet-stream
Body: <raw bytes, streaming>

→ 200 application/json
   { "cid": "...", "getURL": "s3://r2/<cid>", "size": 123, "uploadId": "..." }
→ 401 application/json { "type": "error", "message": "invalid grant" }
→ 410 application/json { "type": "error", "message": "grant expired" }
→ 500 application/json { "type": "error", "message": "..." }
```

Handler in `vibes.diy/api/svc/public/put-asset.ts`. Validates `X-Asset-Grant` (signature, expiry), runs `vctx.storage.ensure(req.body)`, INSERTs the audit row, returns JSON.

## CLI

```
vibes-diy put-asset <file> [--api-url=...] [--user-slug=...] [--app-slug=...] [--verify-fetch]
```

1. Open WS, authenticate (existing device-id flow).
2. Send `req-asset-upload-grant { userSlug, appSlug, mimeType: <inferred from filename> }`.
3. Receive grant, expiresAt, uploadUrl.
4. `fetch(uploadUrl, { method: "POST", body: createReadStream(file), headers: { "X-Asset-Grant": grant, "Content-Type": "application/octet-stream" } })`.
5. Print `cid getURL size uploadId` (text, no JSON formatting flag — the CLI doesn't pretend to JSON output anywhere).
6. With `--verify-fetch`: follow up with `GET /assets/cid?url=<encoded-getURL>`, byte-compare to source.

Browser future: identical shape — `await ws.send(reqAssetUploadGrant); const { uploadUrl, grant } = await ws.recv(); await fetch(uploadUrl, { method: "POST", body: file, headers: { "X-Asset-Grant": grant } });`.

## Verification plan

Run `vibes-diy put-asset` against the PR preview at:

- 6 KB (small path, single PUT) — sanity check.
- 8 MiB (multipart put + multipart rename) — the size that broke `req-ensure-app-slug` post-storage.
- 50 MiB and 100 MiB to confirm there's no hidden ceiling.

Success criteria: each upload returns a CID within the storage layer's natural latency, no idle-timeout (HTTP doesn't have one), `--verify-fetch` matches byte-for-byte. The progress-event diagnostic logs from the prior round get reverted before merge.

## Open work in this round

- Revert the temporary diagnostic logs in [ensure-app-slug-item.ts emitProgress](../vibes.diy/api/svc/public/ensure-app-slug-item.ts), [WSSendProvider.send](../vibes.diy/api/svc/svc-ws-send-provider.ts), and [VibesDiyApi.request cli-onMessage](../vibes.diy/api/impl/index.ts) before merge.
- The push handler's post-storage silence (transformJSXAndImports + ensureApps + queue post taking >10s for an 8 MiB JSX) is now a known deficiency, but it's the existing path — not regressed. Not in scope for this round; the put-asset endpoint moves the long-term answer forward without touching push.

## Forward path

Once `POST /assets` is solid in prod:

1. **Implement `*-ref` types in [ensure-app-slug-item.ts](../vibes.diy/api/svc/public/ensure-app-slug-item.ts).** When an item is `code-ref` / `str-asset-ref` / `uint8-asset-ref`, look up the asset by CID, validate it exists, use it directly. Push handler stops doing inline `storage.ensure` for ref'd items.
2. **CLI's `vibes-diy push` switches to two-phase upload.** For each large file: `put-asset` first to get a CID, then `req-ensure-app-slug` with refs. Eliminates the WS message size pressure and the post-storage silence (because storage is no longer happening inside the push handler).
3. **Fireproof `_files` lands.** Same upload endpoint. Doc carries `{ cid, size, mimeType }`; sync just propagates the doc, the asset bytes already live in R2.

Each step preserves all prior behavior. Push keeps working with inline blocks; refs become an additional case the handler accepts. No flag-day cutover.

## Future: direct-to-R2 presigned URLs

Deliberately *not* in this round. R2 supports S3-style presigned PUT URLs natively, which would let uploads bypass the Worker entirely. The downside is that the client decides locality, which means we end up with many small files distributed however the client uploaded them — losing dedup-by-CID at the storage layer (CID computation requires reading the bytes, which the Worker is doing today). For multi-GB blobs the bypass would be valuable, but for the small/medium files we expect from `_files` initially, routing through the Worker keeps storage layout under our control. The grant-based protocol shape is compatible with a future cutover; we just swap what the WS handler returns in `uploadUrl`.
