# Delete / unpublish a deployed vibe — design

Status: **implemented in this PR** — v1 soft-unpublish shipped; model reviewed and open questions settled (resolves [#2688](https://github.com/VibesDIY/vibes.diy/issues/2688))
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
- A non-empty `unpublishedAt` means the slug stops resolving on **every**
  no-fsId, slug-keyed public resolver — not just the obvious one. The tombstone
  has to be checked at each place a bare `ownerHandle/appSlug` becomes content
  for a non-owner (see §4a for the full list); a filter on `get-app-by-fsid.ts`
  alone would leave the slug reachable via remix and version-listing. Each treats
  a tombstoned binding as `not-found` (same 404 + `grant: "not-found"` already
  returned for a missing slug). **Explicit `fsId` reads still resolve** — see §4
  (lineage/permalinks must not break).
- The slug is hidden from public discovery and serving, but stays visible **to
  its owner** in `list`/recent-vibes with an `[unpublished]` marker (that list is
  owner-scoped, joined on the caller's `userId`, so this is not a public leak) —
  hiding it from the owner too would strand an orphan with no way to find it for
  restore. `versions` continues to show full history to the owner.
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

- **Ownership**: account-level owner of the handle only (`owner.userId !==
  userId → err`, same rule `publishApp` enforces). Not editors, not grantees.
  **Use a read-only check** — read the existing `AppSlugBindings` row and verify
  the handle owner. Do **not** route this through `ensureSlugBinding`: it calls
  `ensureAppSlug` (`ensure-slug-binding.ts:356`), which *creates* a binding when
  the slug is missing, so a typo or nonexistent slug would mint a stray binding
  (and consume quota) before "tombstoning" it. The same read-only rule applies to
  the v1 unpublish/republish mutations below.
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

**Product semantics to state explicitly:** unpublish is **de-index + block the
latest route, *not* access revocation.** Explicit-fsId reads keep resolving for
everyone, including non-owners, in v1 — anyone holding a deep `~{fsId}~`
permalink can still load that exact version. If a user needs to actually revoke
access, that's the grants/visibility surface (or a future hard delete), not
unpublish. Saying this out loud avoids the trap of unpublish being mistaken for
"make it private."

(If product later wants unpublish to *also* dark the explicit-fsId reads for
non-owners, that's a one-line policy change in the same lookup — but the default
should preserve lineage.)

### 4a. The full set of no-fsId slug resolvers the tombstone must gate

The serving lookup is **not** the only path that turns a bare
`ownerHandle/appSlug` into content without an explicit `fsId`. Unpublish is only
real if every one of these consults `unpublishedAt` for non-owners; otherwise a
known public slug stays reachable:

| Resolver | File | Why it leaks today |
|---|---|---|
| Latest-production serve | `get-app-by-fsid.ts` (no-fsId → `selectLatestAppPerSlug`) | The bare public URL. |
| **Remix without a source fsId** | `fork-app.ts:79-80` (no `srcFsId` → `selectLatestAppPerSlug` by `ownerHandle/appSlug`), reached from `pkg/app/routes/remix.$ownerHandle.$appSlug.tsx` | `/remix/:owner/:slug` forks the latest row directly; never consults `AppSlugBindings`. |
| **Version listing for non-owners** | `list-versions.ts:49-61` (selects `Apps` by `ownerHandle/appSlug`, returns production rows to non-owners) | Hands out live production `fsId`s for a tombstoned slug. |

All three select from `Apps` keyed only by `ownerHandle/appSlug` and never look
at the binding. The fix is one shared helper — "is this binding tombstoned for
this caller?" — applied at each non-owner entry point (or an explicit reject of
no-fsId fork / non-owner version-listing when the binding is tombstoned). Owners
keep full access to all three so restore and history still work. This is why the
v1 scope and tests below name remix and `listVersions`, not just serve.

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
  the column via a **read-only** owner check (read the binding + verify owner; do
  not use the create-on-missing `ensureSlugBinding`, see §3).
- Serving / resolvers: every no-fsId, slug-keyed resolver from §4a treats a
  tombstoned binding as `not-found` for non-owners —
  `get-app-by-fsid.ts` (latest serve), `fork-app.ts`'s no-`srcFsId`
  path (remix), and `list-versions.ts` (non-owner listing). The gate is keyed on
  the **tombstone, not the resolved row's mode**: `selectLatestAppPerSlug` orders
  `dev` < `production` and returns the last row, so when a slug has *only* dev
  rows it resolves to a dev row — block no-fsId public resolution regardless, so
  a tombstoned slug can't still resolve via that dev-path fallback. Explicit-fsId
  and owner reads are unchanged.
- Listing: recent-vibes / `list` exclude tombstoned slugs; owner `versions` still
  shows history.
- CLI: `vibes-diy unpublish <vibe>` + `vibes-diy publish <vibe>` (restore).
  Mirrors the `push`/`versions` arg-resolution (`resolveVibeArgs`). **No `rm`
  alias in v1** — `rm` reads as destructive, but this action is intentionally
  reversible (see Decisions §1).
- Tests: tombstone hides from serve, **non-owner remix (`/remix/:owner/:slug`,
  no `srcFsId`)**, and **non-owner `listVersions`**, plus `list`; explicit fsId
  still resolves; remix via an explicit `srcFsId` still resolves through a
  tombstoned source; owner still sees everything; restore is exact; non-owner
  unpublish and unpublish of a nonexistent slug are both rejected **without
  creating a binding**.

**Explicitly not in v1:** hard delete / data purge, asset GC, any UI affordance
(CLI-first; UI is a fast-follow once the CLI semantics settle).

## Decisions (settled in review)

These were open questions in the first draft; resolved in PR #2811 review
([@CharlieHelps](https://github.com/VibesDIY/vibes.diy/pull/2811)):

1. **Naming.** `unpublish` is the canonical verb. We **reserve `delete`** for the
   future irreversible hard-delete, and ship **no `rm` alias in v1** — `rm` reads
   as destructive, which misrepresents a reversible action.
2. **Explicit-fsId visibility after unpublish.** Explicit-fsId reads **keep
   resolving for everyone, including non-owners**, in v1 — this preserves
   permalinks/lineage and avoids cache/identity weirdness. Framed as product
   semantics: unpublish = de-index + block the latest route, **not** access
   revocation (see §4).
3. **Hard delete surface.** Deferred. Stays **ops/admin-only** until the lineage +
   member-data guards and failure UX are proven; no CLI surface in v1.

## As-built (v1, this PR)

The smallest-correct first cut landed exactly the scope above:

- **Schema** — `unpublishedAt` column on `AppSlugBindings` (sqlite + pg),
  `default("")`, same zero-downtime push pattern as `pinnedAt`.
- **Mutation** — `set-unpublish` handler (`svc/public/set-unpublish.ts`) cloned
  from the pin handler: read-only owner check (join `AppSlugBindings` ×
  `UserSlugBindings` on the caller's `userId`, **not** `ensureSlugBinding`), then
  a single-column write. Types in `api/types/app.ts` (`reqSetUnpublish` /
  `resSetUnpublish`), client `setUnpublish()` in `api/impl`, registered in the
  handler manifest + `shard-policy`.
- **Resolver gate** — one shared helper (`svc/public/unpublished-binding.ts`,
  `isHiddenForCaller` / `getUnpublishedAt`) consulted by all three no-fsId
  resolvers: `get-app-by-fsid` (no-fsId serve), `fork-app` (no-`srcFsId` remix),
  `list-versions` (non-owner). Explicit-fsId and owner reads untouched; keyed on
  the tombstone, not the row mode.
- **Owner list** — `list-recent-vibes` surfaces the `unpublishedAt` marker
  (owner-scoped), and the CLI `list` prints `[unpublished]`.
- **CLI** — `vibes-diy unpublish <vibe>` + `vibes-diy publish <vibe>`
  (`cli/cmds/unpublish-cmd.ts`), no `rm` alias.
- **Tests** — `api/tests/set-unpublish.test.ts` (round-trip; non-owner
  serve/remix/versions hidden; explicit-fsId + owner still resolve; restore
  exact; non-owner + nonexistent-slug rejected without creating a binding) and
  `cli/cmds/unpublish-cmd.test.ts`.

Everything else in the map (data, grants, chat, assets, hard delete) is
intentionally left alone in v1.
