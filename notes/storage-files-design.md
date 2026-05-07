# `_files` read API design — URL-canonical with `file()` shim

Specification for the read side of `_files` in **Firefly** (the codename for the Fireproof client running against vibes.diy as its cloud backend). Sibling to [storage-files.md](storage-files.md), which covers the upload path (`POST /assets` + WS upload-grant). This brief covers what `doc._files.x` looks like when read back: `meta.url` becomes the documented primary access path, while `meta.file()` collapses to a three-line shim over `fetch(meta.url)` so existing apps keep working byte-for-byte.

There is no encryption-at-rest in scope, no stored data to migrate (the storage backend was disabled before any users wrote files), and no breaking change anywhere — the shim absorbs the entire compat surface.

## Why now

Storage activation has landed (PR [#1537](https://github.com/VibesDIY/vibes.diy/pull/1537)). [storage-files.md](storage-files.md) specifies the upload path that produces CIDs in R2. This brief specifies the matching read API: how those CIDs are surfaced back to app code through `doc._files.<key>` after a sync round-trip. With `_publicFiles` already URL-canonical (today via `https://${cid}.ipfs.w3s.link/`), aligning `_files` on the same shape closes the gap and unblocks `<img src={meta.url}>` / `<audio src={meta.url}>` / `<video src={meta.url}>` as the documented idiom.

## The new shape

`DocFileMeta` becomes URL-canonical. `url` is always populated for `_files` (today it's only populated for `_publicFiles`); `file()` is retained but its body collapses to a shim:

```ts
export interface DocFileMeta {
  readonly type: string;
  readonly size: number;
  readonly cid: AnyLink;
  readonly car?: AnyLink;
  readonly lastModified?: number;
  url: string;                       // always-set in the Firefly-backed flavor
  file: () => Promise<File>;         // shim: fetch(url) → Blob → File
}
```

The `file()` body in [`readFileset`](../../code/fp/fireproof/core/base/crdt-helpers.ts#L252-L274) becomes:

```ts
file: async () => {
  const r = await fetch(fileMeta.url);
  return new File([await r.blob()], fileMeta.cid.toString(), {
    type: fileMeta.type,
    lastModified: fileMeta.lastModified,
  });
}
```

That's the entire compat layer. Programmatic `await meta.file()` callers (transcoding, hashing, ML feeding) keep working unchanged. UI consumers using `<img src={meta.url}>` get the canonical synchronous path. `<ImgFile>` is rewritten internally to consume `meta.url` directly, skipping the round-trip through `file()` for the image-rendering case.

## Why a shim, not a throw or warn

The shim is so trivial — three lines in `readFileset` — that breaking compat earns nothing. Throwing on `meta.file()` forces ~70 apps (113 invocations) to rewrite immediately for no functional gain. Warning is just visual noise that trains developers to ignore the console. The shim is invisible: programmatic callers keep working byte-for-byte, UI consumers migrate to `meta.url` naturally as they discover it in the docs. We get the URL-canonical idiom for free without burning compatibility.

## Consumer code

Pulled from the corpus analysis in [FILES.md](/Users/jchris/code/vibes-analytics/FILES.md):

```jsx
// Canonical, synchronous (recommended going forward)
<img src={doc._files.original.url} alt={doc.title} />
<audio src={track._files.audio.url} controls />
<video src={clip._files.video.url} controls />

// Programmatic — fetch the bytes directly
const bytes = await (await fetch(doc._files.original.url)).arrayBuffer();

// Component path — unchanged in app code; <ImgFile> internally uses meta.url
<ImgFile file={doc._files.original} alt={doc.title} />

// Legacy — still works via the shim, no migration required
const fileObj = await trackDoc._files.audio.file();
```

## Compat table

Numbers from [FILES.md](/Users/jchris/code/vibes-analytics/FILES.md) (2,072 `_files` references across 403 apps):

| Pattern | Apps | What changes |
|---|---:|---|
| `<ImgFile file={meta} />` | 53 | Nothing in app code. `<ImgFile>` is rewritten internally to consume `meta.url`, so image rendering becomes synchronous and faster. Transparent speedup. |
| `URL.createObjectURL(_files.x)` | 69 | Still works (the freshly-uploaded `File` case is unchanged). Post-roundtrip apps can switch to `meta.url` for one-line simplification, but no migration is required. |
| `await _files.x.file()` | ~70 (113 invocations) | Continues to work via the shim — same `File` object, same bytes, same `lastModified`. `meta.url` is available alongside if they want to simplify. |
| `<audio>` | 55 | Most-idiomatic path is now `<audio src={meta.url}>`. Existing `URL.createObjectURL` usage keeps working. |
| `<video>` | 73 | Same — `<video src={meta.url}>` is the natural form. |

Zero apps break. 53 transparently get faster image rendering. The remaining ~140 apps have an opt-in path to simpler synchronous code.

## Access control

`_files` rights ride on the same per-db ACL as documents (the per-dbName ACL system from [PR #1514](https://github.com/VibesDIY/vibes.diy/pull/1514)): if you can read the doc, you can read the file CIDs it references; if you can write the doc, you can attach files to it. The asset-serving endpoint must authorize through the same db ACL gate, not invent a separate token mechanism. Today's [`/assets/cid` handler](../vibes.diy/api/svc/public/cid-asset.ts) is **unauthenticated** — it does a raw `vctx.storage.fetch(url)` with no ACL check, which is fine for icons (effectively public-by-CID) but wrong for `_files`. A server-side change is required (see Seam 2 below). Fine-grained `read-files` / `write-files` permissions distinct from `read-doc` / `write-doc` are future work, out of scope for this brief.

## Implementation seams

### Seam 1 — Client-side `readFileset` (Fireproof)

Change site: [`core/base/crdt-helpers.ts:252-280`](../../code/fp/fireproof/core/base/crdt-helpers.ts#L252-L280).

Today `_publicFiles` get `meta.url = "https://${cid}.ipfs.w3s.link/"` (line 257) and `_files` get `meta.file = async () => decodeFile(...)` (lines 260–275). Under this change `_files` get **both** populated:

```ts
function readFileset(blocks: EncryptedBlockstore, files: DocFiles, isPublic = false) {
  const { baseUrl, dbName } = blocks.ebOpts;       // new accessors (see Seam 3)
  for (const filename in files) {
    const fileMeta = files[filename] as DocFileMeta;
    if (fileMeta.cid) {
      if (isPublic) {
        fileMeta.url = `https://${fileMeta.cid.toString()}.ipfs.w3s.link/`;
      } else {
        fileMeta.url = `${baseUrl}/assets/cid?url=${encodeURIComponent(fileMeta.getURL ?? `s3://r2/${fileMeta.cid.toString()}`)}&mime=${encodeURIComponent(fileMeta.type)}&user=${userSlug}&app=${appSlug}&db=${dbName}`;
      }
      fileMeta.file = async () => {
        const r = await fetch(fileMeta.url!);
        return new File([await r.blob()], fileMeta.cid.toString(), {
          type: fileMeta.type,
          lastModified: fileMeta.lastModified,
        });
      };
    }
    files[filename] = fileMeta;
  }
}
```

About 10 added lines plus removal of the existing `decodeFile` block. The legacy `decodeFile` path stays available as a fallback for non-Firefly storage backends (in-memory, local-only) where `baseUrl`/`dbName` are absent — gate on their presence.

The schema in [`core/types/base/doc-base.zod.ts:6-18`](../../code/fp/fireproof/core/types/base/doc-base.zod.ts#L6-L18) and the type in [`core/types/base/types.ts:263-271`](../../code/fp/fireproof/core/types/base/types.ts#L263-L271) keep the same fields. `url` and `file` remain marked optional at the type level (the in-memory test flavor doesn't always populate `url`), but in the Firefly-backed read path both are always present.

### Seam 2 — Server-side asset serving with ACL (vibes.diy)

**Recommended: extend [`cid-asset.ts`](../vibes.diy/api/svc/public/cid-asset.ts)** (option 2a) — the put-asset plan already returns `getURL` as a full assetURI ([storage-assets-post.md:181](storage-assets-post.md#L181)) and the CLI's `--verify-fetch` already reads via `/assets/cid?url=<encoded-getURL>` ([:200](storage-assets-post.md#L200)). `/assets/cid` is the designed reader for assets uploaded through put-asset. Per-doc `_files` should ride the same path with an additive ACL gate, not a sibling handler.

Concretely: add three optional query params `?user=<userSlug>&app=<appSlug>&db=<dbName>`. When all three are present, the handler verifies the Bearer token, runs `checkDocAccess` + `resolveDbAcl` + `aclAllows("read", access)`, then proceeds to the existing `vctx.storage.fetch(url)` body. When absent, the current public-by-CID behavior is preserved unchanged (icons keep working, CLI `--verify-fetch` keeps working).

This is ~30–40 added lines in one file rather than a 170-line sibling handler. The ACL predicate is reused from `db-acl-resolver.ts` and `access-helpers.ts` — no new shared helper needed.

**ACL semantics caveat**: cid-asset without `?db=` remains public-by-CID, which means a client who knows a private `_files` CID can fetch the bytes via the unguarded path. The ACL gate is therefore *discovery-gating* (controls who can learn the CID exists in a given db) rather than *byte-gating*. Acceptable for v1: Firefly clients only learn CIDs via authorized doc reads. Future tightening — track per-CID privacy in the `AssetUploads` audit table and fail unguarded reads of CIDs flagged private — is a separate iteration.

### Seam 3 — URL shape and base discovery (Firefly client)

URL shape (extended cid-asset):

```
${baseUrl}/assets/cid?url=${encodeURIComponent(getURL)}&mime=${encodeURIComponent(meta.type)}&user=${userSlug}&app=${appSlug}&db=${dbName}
```

`getURL` is the assetURI returned by put-asset (e.g., `s3://r2/<cid>` or `pg://Assets/<cid>`); Firefly stores it on `_files.<key>.getURL` alongside `cid`. `mime` is advisory. `user`/`app`/`db` together are the ACL key — if any of the three is absent the handler treats the request as the public-by-CID path (icons, app code).

`baseUrl` is the same origin Firefly uses for WS sync, minus the `/api` suffix and the `?.stable-entry.=...` query — both are already known to the storage context. Add accessors on `EncryptedBlockstoreOpts` (or a dedicated `FireflyContext` if cleaner) so `readFileset` can read them. Threading is local: blockstore options already flow into `readFileset` via the `blocks` parameter.

`dbName` flows from the ledger config into the blockstore options at construction time. Confirm the exact threading during implementation — it's likely already present as `blocks.ebOpts.name` or similar; if not, add it once in the blockstore constructor.

## Test surface

**Existing tests continue to pass without assertion changes.** The shim returns a `File` whose bytes match the original, same as today's `decodeFile` round-trip:

- [`core/tests/fireproof/database.test.ts:492-625`](../../code/fp/fireproof/core/tests/fireproof/database.test.ts#L492-L625) — the three tests in `describe("ledger with files input")`. All assert on `fileMeta.file?.()` returning a `File` with matching `type`/`size`/`lastModified`. The shim preserves all three.
- [`core/quick-silver/fireproof.test.ts:28-45`](../../code/fp/fireproof/core/quick-silver/fireproof.test.ts#L28-L45) — `db.bulk` with `_files`, `instanceOf(File)` assertion. Continues to pass.

**New parallel `meta.url` assertions** added next to existing `meta.file()` assertions in the same test bodies — assert `meta.url` is a non-empty string, and that `fetch(meta.url)` returns the same bytes as `await meta.file()`. These can run against the in-memory flavor only if we add a tiny in-memory URL handler to the test ledger; otherwise gate them behind a Firefly-backed test ctx.

**New ACL test** — cross-app denial. Lives in vibes.diy's `api/tests/` against the real handler stack via `createVibeDiyTestCtx` (per the pattern in [storage-files.md](storage-files.md)). Asserts: an `/assets/cid?url=…&user=…&app=…&db=…` request from a user without read access on the named db returns 403, the same request from a user with read access returns 200 with matching bytes, and an unauthenticated request to the same gated URL returns 401. The unguarded `/assets/cid?url=…` (no `db`) path is unchanged. **Commitment: the new ACL test lives in vibes.diy api/tests, not fireproof core** — fireproof core has no real handler stack and shouldn't grow one for this.

## Open questions

- **`dbName` plumbing.** Is it already on `blocks.ebOpts` under a name we can read directly, or does it need a new field? Confirm during Seam 1 implementation.
- **`/assets/cid` future.** With the gated path now layered into the same handler (option 2a), the open question is whether to eventually flag certain CIDs as private in the `AssetUploads` audit table and refuse unguarded reads of those CIDs — closing the discovery-vs-byte gap. Separate iteration once the audit table exists.
- **Sync-session token vs cookie auth.** The serving endpoint needs to authenticate the requester. The existing FPCloud-token / cookie machinery is the obvious choice. If Firefly is running outside a browser context (CLI, server-side), a short-lived bearer token minted by the WS session is the fallback — same shape as the upload-grant token in [storage-files.md](storage-files.md).
- **`Cache-Control`.** `/assets/cid` returns `public, max-age=31536000, immutable`. For ACL-gated `_files` URLs, immutable is still correct (CID-addressed) but `public` is wrong — switch to `private, max-age=31536000, immutable` so shared caches don't serve cross-user.

## Out of scope

- Encryption-at-rest (separate design).
- `_publicFiles` migration off the IPFS gateway (separate brief).
- Fine-grained `read-files` / `write-files` permission split (future).
- Quota policy for file reads (future).
- The implementation itself — this brief is the spec; coding follows.

## Cross-links

- Upload side: [storage-files.md](storage-files.md).
- Corpus usage data: [/Users/jchris/code/vibes-analytics/FILES.md](/Users/jchris/code/vibes-analytics/FILES.md).
- Per-db ACL: [PR #1514](https://github.com/VibesDIY/vibes.diy/pull/1514).
- Storage activation: [PR #1537](https://github.com/VibesDIY/vibes.diy/pull/1537).
