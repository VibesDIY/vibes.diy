# `_files` read API design — app-subdomain URLs, server-minted, no signing

Specification for the read side of `_files` in **Firefly** (the Fireproof-shaped client running against vibes.diy as its cloud backend). Sibling to [storage-files.md](storage-files.md), which covers the upload path (`POST /assets` + WS upload-grant). This brief covers what `doc._files.x` looks like when read back: `meta.url` is a stable, app-subdomain-rooted URL minted server-side; `meta.file()` is a tiny `fetch(meta.url)` shim so existing `await meta.file()` callers keep working byte-for-byte.

There is no encryption-at-rest in scope, no stored data to migrate (the storage backend was disabled before any users wrote files), and no breaking change anywhere — the shim absorbs the entire compat surface.

## Why now

Storage activation has landed (PR [#1537](https://github.com/VibesDIY/vibes.diy/pull/1537)). [storage-files.md](storage-files.md) specifies the upload path that produces CIDs in R2. This brief specifies the matching read API: how those CIDs are surfaced back to app code through `doc._files.<key>` after a sync round-trip, in a shape that supports `<img src=…>` natively, works for anonymous viewers of public apps, is portable into third-party CMSes (Markdown, Notion, etc.), and forward-compatible with future WordPress-style embedded-widget mode.

## Constraint surface (drives the design)

The dominant `_files` consumers per the corpus analysis in [FILES.md](/Users/jchris/code/vibes-analytics/FILES.md) are native HTML elements: 53 `<ImgFile>`, 73 `<video>`, 55 `<audio>`, 69 `URL.createObjectURL` callsites. The URL has to work natively in `<img src>` / `<audio src>` / `<video src>`, which means:

1. **No `Authorization` header.** Native elements don't support custom headers. Bearer-token auth is off the table for the dominant code paths.
2. **No signed URLs with short TTL.** A `<img src>` set once renders for the lifetime of the DOM — there's no automatic refresh. Time-limited URLs would break long-rendered views.
3. **Must work cross-origin in `<img>`.** For embedded mode (a public vibe widget on someone's WordPress blog), the URL has to fetch from a third-party origin without any vibes.diy session.

This rules out the entire signed-URL / Bearer-header design space. What's left: stable URLs, same-origin-with-the-iframe, with auth (when needed) carried by ambient cookies.

## The new shape

`DocFileMeta` carries no CID and no storage URI to the client. The server resolves both internally:

```ts
export interface DocFileMeta {
  readonly type: string;
  readonly size: number;
  readonly lastModified?: number;
  url: string;                       // server-minted, stable, no signing
  file: () => Promise<File>;         // shim: fetch(url) → Blob → File
}
```

The shim:

```ts
file: async () => {
  const r = await fetch(meta.url);
  if (!r.ok) throw new Error(`fetch _files: ${r.status} ${r.statusText}`);
  return new File([await r.blob()], "<key>", {
    type: meta.type,
    lastModified: meta.lastModified,
  });
}
```

That's the compat layer. Programmatic `await meta.file()` callers (transcoding, hashing, ML) keep working unchanged. UI consumers using `<img src={meta.url}>` get the canonical synchronous path.

## URL shape

```
https://<userSlug>-<appSlug>.<host>/_files/<dbName>/<docId>/<key>
```

The URL is **same-origin with the iframe** running the vibe app. No CORS issues for in-app reads. Cookies (when set) attach automatically on `<img src>`, `<audio src>`, `<video src>`, and `fetch`. The URL is **permanent** — no signing, no expiry. Knowing the URL ≠ having access; the server's ACL evaluation gates the response. Pasting into a third-party CMS works for any content the destination viewer is authorized to see (most often: public apps).

CID never appears in any client-visible URL. Collision is moot because the URL is keyed by `(app, db, doc, fieldname)`, naturally scoped to the writer's namespace.

## Why a shim, not a throw or warn

The shim is one fetch and a Blob → File conversion — there's no upside to breaking compat. Throwing on `meta.file()` forces ~70 apps (113 invocations per FILES.md) to rewrite for no functional gain. Warning is just visual noise that trains developers to ignore the console. The shim is invisible: programmatic callers keep working byte-for-byte, UI consumers migrate to `meta.url` naturally as they discover it in the docs.

## Consumer code

```jsx
// Canonical, synchronous, native HTML (recommended)
<img src={doc._files.original.url} alt={doc.title} />
<audio src={track._files.audio.url} controls />
<video src={clip._files.video.url} controls />

// Programmatic — fetch the bytes directly
const bytes = await (await fetch(doc._files.original.url)).arrayBuffer();

// Component path — unchanged in app code; <ImgFile> rewritten to use meta.url internally
<ImgFile file={doc._files.original} alt={doc.title} />

// Legacy — still works via the shim, no migration required
const fileObj = await trackDoc._files.audio.file();
```

## Compat table

Numbers from [FILES.md](/Users/jchris/code/vibes-analytics/FILES.md) (2,072 `_files` references across 403 apps):

| Pattern | Apps | What changes |
|---|---:|---|
| `<ImgFile file={meta} />` | 53 | Nothing in app code. `<ImgFile>` is rewritten internally to consume `meta.url` (a future small PR) — image rendering becomes synchronous and faster. |
| `URL.createObjectURL(_files.x)` | 69 | Still works (the freshly-uploaded `File` case is unchanged). Post-roundtrip apps can switch to `meta.url` for one-line simplification. |
| `await _files.x.file()` | ~70 (113 invocations) | Continues to work via the shim — same `File` object, same bytes, same `lastModified`. |
| `<audio>` | 55 | Idiomatic path is now `<audio src={meta.url}>`. Existing usage keeps working. |
| `<video>` | 73 | Same — `<video src={meta.url}>` is natural; existing usage keeps working. |

Zero apps break. 53 transparently get faster image rendering. The remaining ~140 have an opt-in path to simpler synchronous code.

## Access control

The handler reuses three existing helpers:

- [`isPublicReadable(vctx, appSlug, userSlug)`](../vibes.diy/api/svc/public/access-helpers.ts#L47) — already gates on `publicAccess.enable === true && mode === "production"`.
- [`checkDocAccess(vctx, userId, appSlug, userSlug)`](../vibes.diy/api/svc/public/access-helpers.ts#L13) — owner / invite / request flows.
- [`resolveDbAcl`](../vibes.diy/api/svc/public/db-acl-resolver.ts#L39) + [`aclAllows`](../vibes.diy/api/svc/public/db-acl-resolver.ts#L61) — per-db overrides.

Decision matrix:

| App mode | Cookie? | Result |
|---|---|---|
| Public (`publicAccess.enable && mode === "production"`) | absent | `isPublicReadable` → serve, with `Access-Control-Allow-Origin: *` (CMS / embed-ready). |
| Public | present and valid | `checkDocAccess` → may upgrade access; serve with same CORS. |
| Private | absent | 401. |
| Private | present and valid | `aclAllows(resolveDbAcl, "read", checkDocAccess)`; serve or 403. |

Cookie attachment is the practical wrinkle: vibes.diy doesn't currently set a session cookie scoped to `<u>-<a>.<host>`, so cross-origin private-app reads have no auth signal today. Three modes follow:

- **Public apps**: anonymous reads work via `isPublicReadable`. CMS-portable, embed-ready. ✅ ships now.
- **Private apps from inside the iframe**: same-origin reads. If a session cookie scoped to `<u>-<a>.<host>` exists, `<img src>` carries it. If not, fetches via `meta.file()` shim can route through the WS RPC bridge as a fallback — Firefly's `getDoc` already proves the user has access to the doc, so a server-side WS path that streams bytes back is a viable fallback. ⚠️ requires either (a) a sticky-login cookie set on the app subdomain when the user enters from vibes.diy, or (b) the RPC fallback. Detail in "Open questions".
- **Private apps from cross-origin (embed)**: not supported today. Requires sticky-login cookie infrastructure. 🔮 future.

The future "sticky login" path: when a logged-in user browses a vibe via vibes.diy, vibes.diy sets a session cookie scoped to `<u>-<a>.<host>`. From then on, embedded views of the same vibe carry credentials transparently — even when seen as a widget on a third-party site. Out of scope for the initial `_files` work but the URL design above accommodates it without changes.

## Implementation seams

### Seam 1 — Server: new `/_files/...` handler at the app-subdomain worker

Routing: requests to `<u>-<a>.<host>/_files/<db>/<docId>/<key>` carve out into a new handler. Lives next to the existing app-subdomain worker entry (see [vibes.diy/pkg/workers/app.ts:124](../vibes.diy/pkg/workers/app.ts#L124) for where `/assets/cid` already plugs in). Forwarded into the api worker via the existing `cfServe` path or handled inline.

Handler steps:

1. Parse `(userSlug, appSlug)` from the hostname, `(dbName, docId, key)` from the path.
2. Resolve user identity: cookie → userId (if a session cookie attaches), else null.
3. Resolve ACL: `resolveDbAcl(u, a, db)` → either explicit ACL or undefined (default).
   - If a `dbAcl` is set: `aclAllows(acl, "read", userId ? checkDocAccess(...) : "none")`.
   - If undefined: allow if `userId && checkDocAccess(...) ≠ "none"` OR `isPublicReadable(a, u)`.
4. On allow: fetch the doc by `docId` from the (u, a, db) database, read `_files[key]` → resolve `uploadId` against `AssetUploads` → get `getURL` (the storage URI like `s3://r2/<cid>`) → `vctx.storage.fetch(getURL)` → stream bytes.
5. Headers: `Cache-Control: public, max-age=31536000, immutable` for public-readable apps (immutable because the URL is keyed by docId+key+content; the doc owner can replace the file but that produces a new uploadId which would imply a doc update); `Cache-Control: private, max-age=31536000, immutable` for ACL-gated reads. `Access-Control-Allow-Origin: *` on public reads (embed support).

Reuse: don't reimplement [check-auth.ts](../vibes.diy/api/svc/check-auth.ts), [db-acl-resolver.ts](../vibes.diy/api/svc/public/db-acl-resolver.ts), [access-helpers.ts](../vibes.diy/api/svc/public/access-helpers.ts), or [vibe-diy-test-ctx.ts](../vibes.diy/api/tests/vibe-diy-test-ctx.ts).

### Seam 2 — Server: doc-write validates `_files.<key>.uploadId`

When a put/bulk RPC arrives with `_files: { <key>: { uploadId, type, size, lastModified } }`, the handler validates each `uploadId` against `AssetUploads`:

- The row exists.
- `AssetUploads.userId` matches the writer (or someone with write access on this app/db).
- `AssetUploads.userSlug` and `appSlug` match the doc's owner (i.e., the upload-grant was minted for this app, not pasted from another app).

This closes the cross-user CID leak: a malicious client can't put another user's `uploadId` in their own doc to fetch bytes that belong elsewhere. The doc storage layer never accepts a `cid` directly from the client — only `uploadId`, which is opaque-from-the-client and bound to a writer at mint time.

### Seam 3 — Server: doc-read mints `meta.url`

When `getDoc` / `queryDocs` returns docs containing `_files`, walk each `_files.<key>` entry server-side, replace with the public-shape:

```ts
// stored:    { uploadId, type, size, lastModified }
// returned:  { type, size, lastModified, url }
```

`url` is the constructed `https://<u>-<a>.<host>/_files/<db>/<docId>/<key>`. No signing. No CID, no `uploadId`, no `getURL` exposed to the client.

### Seam 4 — Client: Firefly `decorateFiles` shim

Becomes a one-line helper: for each `_files.<key>` entry, attach `meta.file = () => fetch(meta.url).then(r => r.ok ? r.blob().then(b => new File([b], key, { type, lastModified })) : Promise.reject(...))`. Server already populates `meta.url`. Idempotent. Does not mutate the input doc.

For pre-save Files (the local `URL.createObjectURL` decoration discussed earlier in this design's iteration), Firefly's `put` workflow handles the upload via put-asset and replaces the `File`/`Blob` with `{ uploadId, type, size, lastModified }` before sending to the server. Pre-save UI uses `URL.createObjectURL(file)` directly the same way the existing 69 apps do — Firefly can optionally wrap this with a transparent getter on the local doc, but it's a nice-to-have, not core.

### Seam 5 — Worker routing

The app-subdomain worker [vibes.diy/pkg/workers/app.ts:124](../vibes.diy/pkg/workers/app.ts#L124) currently carves out `/assets/cid` and forwards `/api/*` elsewhere. The new `/_files/*` path needs an equivalent carve-out — either handled inline by `cfServe` or routed back to the api worker. Confirm during implementation; pick the path that keeps cookies and origin behavior right.

## Test surface

- **ACL test in api/tests** (modeled on [comments-acl.test.ts](../vibes.diy/api/tests/comments-acl.test.ts)): owner, viewer (auto-approved), stranger, anonymous-on-public-app, anonymous-on-private-app. Use `createVibeDiyTestCtx` + `processRequest` against `Request("https://<u>-<a>.<host>/_files/...")`.
- **CORS test**: assert `Access-Control-Allow-Origin: *` on the public-readable path; assert it's *absent* (or set to a specific origin) on private-readable.
- **Doc-write validation**: assert that putting a doc with a foreign `uploadId` is rejected.
- **Round-trip**: mint a put-asset upload, put a doc referencing the resulting `uploadId`, get the doc back, verify `meta.url` is the expected shape, fetch bytes, byte-compare.

## Open questions

- **Worker routing carve-out**: HTTP path for `/_files/*` on the app subdomain — handle inline at the stable-entry worker or proxy to the api worker? Either works; pick the simpler.
- **Cookie scope for sticky-login future**: whether the eventual sticky-login cookie is scoped to `*.vibes.diy` (covers all apps) or per-app (`<u>-<a>.vibes.diy` only). Per-app is more isolated but requires session minting per app entry.
- **Private-app iframe reads today**: until sticky-login lands, private-app `<img src>` reads from inside the iframe will not have auth. Three options: (a) WS-RPC fallback that returns bytes as a Blob URL, (b) explicit `?token=` query param the client appends from a WS-minted short-lived signature (re-introduces the constraints we tried to avoid; only used when no cookie path is available), (c) wait on sticky-login. Recommended: ship public-app reads first; private-app iframe reads via WS-RPC fallback for v1; then sticky-login.
- **Cache-Control for public**: `public, max-age=31536000, immutable` is right when the `(app, db, doc, key)` tuple is stable across writes — but if a doc-owner replaces a file (same doc/key, new bytes), CDN caches go stale. Two paths: (a) include a content-version segment in the URL (e.g., `…/<key>/<contentHash8>`); (b) `max-age=300` and trust the client cache for short windows. Pick during implementation.

## Out of scope

- Encryption-at-rest (separate design).
- `_publicFiles` cleanup — zero corpus usage; trim the codepath when convenient (separate small PR; see future architecture recs).
- Fine-grained `read-files` / `write-files` permissions distinct from doc ACL.
- Quota policy and enforcement on `_files` reads or writes.
- Sticky-login cookie infrastructure (future, separate brief).
- WordPress-style embedded-widget mode (future; URL design accommodates it).
- The implementation itself.

## Cross-links

- Upload side: [storage-files.md](storage-files.md).
- Corpus usage data: [/Users/jchris/code/vibes-analytics/FILES.md](/Users/jchris/code/vibes-analytics/FILES.md).
- Per-db ACL: [PR #1514](https://github.com/VibesDIY/vibes.diy/pull/1514).
- Storage activation: [PR #1537](https://github.com/VibesDIY/vibes.diy/pull/1537).
- Existing public-app primitive: [`isPublicReadable`](../vibes.diy/api/svc/public/access-helpers.ts#L47).
