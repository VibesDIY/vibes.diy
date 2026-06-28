# Delete / unpublish a deployed vibe — design

Status: **proposal for review** (resolves the design half of [#2688](https://github.com/VibesDIY/vibes.diy/issues/2688))
Filed-from: [#2688](https://github.com/VibesDIY/vibes.diy/issues/2688), which itself spun out of [#2683](https://github.com/VibesDIY/vibes.diy/pull/2683).

## The problem in one line

Once a vibe is deployed to `ownerHandle/appSlug` there is no way to take it back
down — `vibes-diy` has no `delete`/`unpublish` command, and `push` can only
create or overwrite a slug, never remove one. #2688 (correctly) asks us to
**decide the semantics before building anything**, because a vibe is not a
standalone file — one slug fans out across code versions, Firefly data, grants,
lineage, live URLs, and chat history.

This note proposes a concrete model for each of those, grounded in the current
schema, so implementation can proceed against a settled spec.

## What "a vibe" actually is (grounded map)

A single `ownerHandle/appSlug` touches these tables (file:
`vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts` unless noted):

| System | Table(s) | Keyed by | Notes |
|---|---|---|---|
| URL binding / recency | `AppSlugBindings` | `(appSlug, ownerHandle)` | One row per slug. Already carries soft-state columns `updated` and `pinnedAt`. |
| Code versions | `Apps` | `(appSlug, userId, releaseSeq)` | Append-only; every publish mints a new `releaseSeq` (`app-seq-allocation.ts`). `fsId` is the content hash served by URL. |
| Firefly data | `AppDocuments` | `(ownerHandle, appSlug, dbName, docId, seq)` | Append-only CRDT log, already has a per-doc `deleted` tombstone flag. Survives across all code versions of the slug. |
| Lineage | `Apps.meta` | `{ type: 'remix-of', srcFsId }` | Forks anchor to the **source `fsId`** (`fork-app.ts`), not the slug — display slugs are resolved live, so renames already propagate. |
| Grants | `RequestGrants`, `InviteGrants` | `(userId, appSlug, ownerHandle, …)` | Member access to a shared vibe. |
| Access fn | `AccessFunctionBindings`, `AccessFnOutputs` | `(ownerHandle, appSlug, dbName)` | Immutable per deployment. Outputs are already cleared when a doc is tombstoned. |
| Chat history | `ChatContexts`, `ChatSections`, `PromptContexts`, `ApplicationChats` | `(…, appSlug, ownerHandle)` | Codegen + in-app chat logs. |
| App settings | `AppSettings` | `(appSlug, ownerHandle)` | Public-access / auto-accept flags. |
| Assets | `Assets` | `assetId` (CID) | Content-addressed, shared across apps — **never** safe to GC on a single delete. |
| Serving | `stable-entry` → `get-app-by-fsid.ts` → `render-vibe.ts` | — | No-fsId reads resolve "latest production"; explicit `fsId` reads serve that exact version. 404 returns `grant: "not-found"`. |

Two facts from this map drive the whole design:

1. **There is no `deleted`/`archived` column on `Apps` or `AppSlugBindings`
   today.** But `AppSlugBindings` already models reversible soft-state the exact
   way we'd want (`pinnedAt`: empty string = off, ISO timestamp = on, doubles as
   a sort key). That's the precedent to copy.
2. **Lineage already survives slug churn** — forks anchor to `srcFsId`, an
   immutable content hash, and resolve display slugs on read. So an unpublished
   slug whose `Apps` rows still exist will not break a remix chain. Hard-deleting
   the rows *would*.

## Proposal

### 1. Soft unpublish is the default and the only thing we ship first

Add **`vibes-diy unpublish <vibe>`** (alias `vibes-diy rm`), implemented as a
reversible tombstone, not a row delete.

- New column `unpublishedAt` on **`AppSlugBindings`**, mirroring `pinnedAt`
  exactly: `text().notNull().default("")`, empty = published, ISO timestamp =
  unpublished. One column, one row, one write.
- A non-empty `unpublishedAt` means the slug stops resolving on the public
  serving path. `get-app-by-fsid.ts`'s no-fsId "latest production" lookup treats
  a tombstoned binding as `not-found` (same 404 + `grant: "not-found"` it
  already returns for a missing slug). **Explicit `fsId` reads still resolve** —
  see §4 (lineage/permalinks must not break).
- The slug disappears from `list` and recent-vibes (it already filters through
  `AppSlugBindings`); `versions` continues to show history to the owner.
- **Nothing in `Apps`, `AppDocuments`, grants, or chat history is touched.** Code
  versions, data, and lineage are all preserved. This is deliberately the
  cheapest correct thing and it's fully reversible.

Rationale: every hard question in #2688 (lineage, member data, caching, "did I
really mean it") is answered by "we kept the bytes." Soft unpublish is the 90%
use case — the `system/bloom` orphan, a fat-fingered slug, a renamed app — and
it's safe by construction.

### 2. Re-publish / restore is just clearing the tombstone

`vibes-diy push` to a tombstoned slug, or an explicit `vibes-diy publish`
(restore), clears `unpublishedAt` back to `""`. Because the `Apps` history is
intact, restore is exact — same `fsId`, same data, same grants. No "recreate a
deleted slug and serve stale esm.sh" hazard (see §5).

### 3. Hard delete is a separate, later, guarded operation — out of scope for v1

A true purge (drop `Apps` rows, `AppDocuments`, grants, chat history) is
destructive, irreversible, and entangled with lineage and member data. We
**do not ship it in v1.** When/if we do, it must be gated on:

- **Ownership**: account-level owner of the handle only — the same
  `ensureSlugBinding` / `publishApp` check that already guards push
  (`owner.userId !== userId → err`). Not editors, not grantees.
- **Lineage guard**: refuse (or require `--force`) if any other app's
  `Apps.meta` references this app's `fsId` as `remix-of` `srcFsId`. Hard-deleting
  a remixed source is exactly the orphaning #2688 warns about.
- **Member-data guard**: refuse (or require explicit `--with-data --yes`) if the
  vibe has approved grants or non-owner-authored `AppDocuments` — deleting then
  destroys other people's data, not just the owner's.
- **Asset GC**: never cascade. `Assets` are CID-shared; leave them. A separate,
  reference-counted sweep job is the only safe way to reclaim them, and it's its
  own issue.

This split keeps v1 small and safe while writing down the constraints so the
hard-delete follow-up doesn't have to re-derive them.

### 4. Lineage & permalinks: tombstone the latest pointer, keep the versions

The serving path has two modes (`get-app-by-fsid.ts`): no-fsId → "latest
production", explicit `fsId` → that exact row. Unpublish only blocks the
**no-fsId** mode. Explicit-`fsId` URLs (and therefore remix `srcFsId`
resolution, and any deep permalink) keep resolving.

This is the deliberate seam: unpublishing removes the vibe from discovery and
its bare public URL, **without** breaking a remix chain that points at one of its
versions. It matches the existing fork model, where lineage is anchored to the
immutable `srcFsId`, not the mutable slug.

(If product later wants unpublish to *also* dark the explicit-fsId reads for
non-owners, that's a one-line policy change in the same lookup — but the default
should preserve lineage.)

### 5. Live URLs & esm.sh caching

The caching hazard #2688 raises ("delete then recreate a slug → serve stale")
is sidestepped by soft-unpublish: the slug is never reused for *different*
content, because restore reuses the *same* `fsId` history. Stamped vibe-pkg
requests (`?v={commit-sha}`) are immutable-cached for a year precisely because a
URL never maps to two different payloads; soft-unpublish preserves that
invariant. A tombstoned bare URL serves the existing 404 path, which is
short-TTL, so re-publish goes live promptly.

### 6. System-owned / curated apps: unpublish applies, GC still doesn't

The epic's "no GC for the curated starter tree" stance (#2675 §2/§20) is about
**automatic** reclamation of unkept forks — that's untouched. An **explicit**
owner-initiated `unpublish` is a different action and is fine for system apps:
it's exactly what clears the `system/bloom` orphan from #2683 without destroying
anything. So: orphans like `system/bloom` remain acceptable to leave, *and* the
owner now has a clean, reversible way to hide one when they want to.

## What ships in v1 (scope)

- `AppSlugBindings.unpublishedAt` column (drizzle push, default `""`, same
  zero-downtime pattern as `pinnedAt`/`updated`).
- API: `unpublishAppSlug` / `republishAppSlug` mutations, owner-only, that flip
  the column. Reuse the `ensureSlugBinding` ownership check.
- Serving: no-fsId lookup in `get-app-by-fsid.ts` treats tombstoned bindings as
  `not-found`; explicit-fsId unchanged.
- Listing: recent-vibes / `list` exclude tombstoned slugs; `versions` still shows
  owner history.
- CLI: `vibes-diy unpublish <vibe>` (alias `rm`) + `vibes-diy publish <vibe>`
  (restore). Mirrors the `push`/`versions` arg-resolution (`resolveVibeArgs`).
- Tests: tombstone hides from serve + list, explicit fsId still resolves, remix
  `srcFsId` still resolves through a tombstoned source, restore is exact,
  non-owner is rejected.

**Explicitly not in v1:** hard delete / data purge, asset GC, any UI affordance
(CLI-first; UI is a fast-follow once the CLI semantics settle).

## Open questions for review

1. **Naming.** `unpublish` (reversible, accurate) vs `rm`/`delete` (familiar but
   implies destruction). Proposal: `unpublish` is the canonical verb, `rm` an
   alias, and we *reserve* `delete` for the future hard-delete so we don't have
   to retrain muscle memory later.
2. **Explicit-fsId visibility after unpublish.** Default proposed: keep
   resolving (preserves lineage/permalinks). Acceptable, or should non-owners get
   404 on every version too?
3. **Does hard delete ever get a CLI surface,** or does it stay an
   ops/admin-only operation behind the guards in §3?

---

*Implementation note for whoever picks this up:* the smallest correct first PR is
just the `unpublishedAt` column + the two mutations + the serving-path filter +
the CLI verb. Everything else in the map (data, grants, chat, assets) is
intentionally left alone in v1.
