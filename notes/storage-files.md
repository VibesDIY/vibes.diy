# Implementation plan — `POST /assets` + WS upload-grant

Forward-planning doc for the `_files` upload path. The full design is in [storage-assets-post.md](storage-assets-post.md); this file captures **how to ship it** — file layout, natural seams, branching, ordering. Follow up after the storage-activation PR ([#1537](https://github.com/VibesDIY/vibes.diy/pull/1537)) merges.

## Files to create

### Server

| Path | Purpose |
|---|---|
| `vibes.diy/api/svc/asset-grant.ts` | HKDF-over-EC-scalar signer/verifier. Derives an HS256 HMAC key from `CLOUD_SESSION_TOKEN_SECRET` (its JWK `d` parameter) at startup and caches the result. Exposes `sign(claims)` / `verify(token)` over a small fixed claim shape. |
| `vibes.diy/api/types/asset.ts` | `ReqAssetUploadGrant` / `ResAssetUploadGrant` / `ResPutAsset` / `AssetGrantClaims`. arktype validators + isXxx guards matching the existing pattern. |
| `vibes.diy/api/svc/public/asset-upload-grant.ts` | WS handler. `checkAuth` for user identity, app-access check (mirror of the FPCloud-token grant logic — handles owner, invite-grant, and public-access apps), then `signer.sign({ userId, userSlug, appSlug, jti, exp })`. Reply `{ uploadUrl, grant, expiresAt, uploadId }`. |
| `vibes.diy/api/svc/public/put-asset.ts` | HTTP `POST /assets` handler. Read `X-Asset-Grant` header, `signer.verify(grant)`, run `vctx.storage.ensure(req.body)`, INSERT one `AssetUploads` row, return `{ cid, getURL, size, uploadId }` JSON. No `verifyAuth` call — the grant is the auth. |
| `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts` | Add `sqlAssetUploads` table (see schema below). |
| `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts` | Same for sqlite flavour. |
| `vibes.diy/api/sql/tables.ts` | Wire new table into `createVibesApiTables`. |
| `vibes.diy/api/svc/types.ts` | Extend `VibesApiSQLCtx` with the asset-grant signer. |
| `vibes.diy/api/svc/create-handler.ts` | Instantiate signer once, attach to ctx, register both new handlers. |
| `vibes.diy/api/svc/vibes-msg-evento.ts` | Register the WS grant handler. |

### Client

| Path | Purpose |
|---|---|
| `vibes-diy/cli/cmds/put-asset-cmd.ts` | New cmd-ts subcommand. WS-mints grant via existing `VibesDiyApi.request`, then `fetch(uploadUrl, {method:"POST", body: createReadStream(file), headers: {"X-Asset-Grant": grant}})`, prints result. Optional `--verify-fetch` does the round-trip integrity check. |
| `vibes-diy/cli/main.ts` | Wire new subcommand into `subcommands(...)`. |

### Tests

| Path | Purpose |
|---|---|
| `vibes.diy/api/tests/asset-grant.test.ts` | Sign/verify roundtrip, expiry rejection, tamper detection, distinct keys per `info`-string round (anti-cross-domain test). |
| `vibes.diy/api/tests/put-asset.test.ts` | End-to-end through test ctx: mint grant → POST bytes → verify response shape, audit row, R2 contents. Use existing `createVibeDiyTestCtx` infra. |

## Schema

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

Mirror in `sqlite` flavour with `int()` for size.

## Natural seams (chunked commits)

1. **Seam A — signer + types + tests.** `asset-grant.ts` and the type module land together with a focused test suite. Self-contained: provable correctness without any handler code. Drift-resistant — once the crypto is right, future changes are mostly additive.
2. **Seam B — schema migration.** Add `AssetUploads` table alone. Drizzle migration runs in CI's existing path; nothing reads from or writes to the table yet.
3. **Seam C — server handlers.** `asset-upload-grant.ts` (WS), `put-asset.ts` (HTTP), wiring in `create-handler.ts` and `vibes-msg-evento.ts`. End-to-end test exercises the full path with the test ctx.
4. **Seam D — CLI subcommand.** Local-source `tsx vibes-diy/cli/main.ts put-asset` against PR preview verifies real R2 + real auth.
5. **Seam E — verification round.** Push 6 KB / 8 MiB / 50 MiB / 100 MiB through the new endpoint, byte-compare retrievals.

Each seam lands as one commit, ideally with a focused test. C is the largest; could subdivide WS/HTTP if it grows.

## Branching

**New branch off `main`.** This feature is forward-path work, not a fix for the storage-activation PR. Cleaner review surface, independent merge timing.

```bash
git checkout main && git pull
git checkout -b jchris/storage-asset-endpoint
```

Avoid stacking on `jchris/r2-storage-activation` — that branch is in PR cleanup mode (revert diagnostic logs, then merge), and stacking would entangle the two timelines. The asset endpoint can be the *next* PR after #1537.

## Ordering with the current PR

1. **First:** finish #1537 (the storage-activation PR). Revert the temporary diagnostic logs ([ensure-app-slug-item.ts emitProgress](../vibes.diy/api/svc/public/ensure-app-slug-item.ts), [WSSendProvider.send](../vibes.diy/api/svc/svc-ws-send-provider.ts), [VibesDiyApi.request cli-onMessage](../vibes.diy/api/impl/index.ts)). Get the storage activation merged. Per saved policy, prod tag (`vibes-diy@p*`) only with explicit confirmation; cli soak first.
2. **Then:** branch for the asset endpoint and ship in seam order A → B → C → D → E.
3. **Then:** implement `*-ref` types in `ensure-app-slug-item.ts` so push can use the asset endpoint, retiring the inline-content code path. (Separate PR.)
4. **Then:** `_files` lands on top.

Each step preserves prior behavior. Push keeps working with inline blocks throughout. The asset endpoint is additive; the *-ref support is additive; `_files` lands as a Fireproof-side change consuming the existing put endpoint.

## HKDF derivation note (implementation-time concern)

`CLOUD_SESSION_TOKEN_SECRET` is base58btc-encoded JSON containing a P-256 ES256 JWK private key, not a raw HMAC secret. The `d` parameter is the EC scalar — 32 bytes of high-entropy private material, base64url-encoded inside the JWK.

```ts
// pseudocode for asset-grant.ts derivation
const env = sthis.env.get("CLOUD_SESSION_TOKEN_SECRET");
const jwkJson = sthis.txt.base58.decode(env);
const jwk = JSON.parse(jwkJson) as { d: string };
const ikm = base64url.decode(jwk.d);  // 32 bytes
const ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
const grantKey = await crypto.subtle.deriveKey(
  { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: textEncode("vibes.diy.asset-grant.v1") },
  ikmKey,
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);
```

HKDF over an EC scalar is cryptographically sound — HKDF treats the IKM as opaque entropic input. The derived key is one-way separated from the signing key (a leak of the derived HMAC key never reveals the EC scalar). Document this clearly in the helper's file header so future readers understand why the IKM looks unusual.

## Open implementation questions

- **App-access check semantics.** The grant issuer needs the same access predicate the FPCloud-token issuer uses ([get-fp-cloud-token.ts](../vibes.diy/api/svc/public/get-fp-cloud-token.ts) builds it via `hasAccessInvite` + `settings.entry.publicAccess`). Likely refactor that into a shared helper before adding the grant handler, so both endpoints share one access definition.
- **Quota gate — at grant time or upload time?** Upload time is more accurate (we know the size); grant time is preemptive. Defer to a later round; the audit table makes either possible without schema changes.
- **`mimeType` enforcement.** If the grant carries a mimeType claim, should the upload handler reject mismatched `Content-Type` headers? Probably yes for browser uploads, no for CLI (where the type is advisory). Keep the field in claims, enforce loosely (warning, not error) at first.
- **Error response shapes.** Existing API uses `{ type: "error", message }` for HTTP errors. Match that — don't invent a new error envelope.

## Verification commands (post-deploy)

```bash
# 6 KB sanity
echo -n "tiny" > /tmp/asset-tiny.txt
tsx vibes-diy/cli/main.ts put-asset /tmp/asset-tiny.txt --api-url=https://pr-NNNN-vibes-diy-v2.jchris.workers.dev/api --user-slug=... --app-slug=... --verify-fetch

# 8 MiB multipart
yes 'x' | head -c 8388608 > /tmp/asset-8m.bin
tsx vibes-diy/cli/main.ts put-asset /tmp/asset-8m.bin --api-url=... --user-slug=... --app-slug=... --verify-fetch

# 100 MiB confirmation
yes 'x' | head -c 104857600 > /tmp/asset-100m.bin
tsx vibes-diy/cli/main.ts put-asset /tmp/asset-100m.bin --api-url=... --user-slug=... --app-slug=... --verify-fetch
```

Tail the worker during each: should see exactly one `put-asset` log line per upload, no `R2ToS3Api.*` errors. The 100 MiB run is the proof that we've actually escaped the 1 MiB WS message ceiling for blob uploads.
