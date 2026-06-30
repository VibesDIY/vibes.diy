# Cached-read chip lane + system-owned cached-fork infra (design)

> **Status: design-level.** The product model is resolved (jchris, in
> `notes/2026-06-26-agent-in-vibe-ux-epic.md` §1a/§2/§8); this spec collects it
> into one implementable place. Before building, run `brainstorming` then
> `writing-plans` to settle the open questions at the end. Tracking issue: **#2801**
> (decision to build, not drop, taken on #2796). Tracks the cached-read half of the
> agent-in-vibe epic (#2675) — only the **write** lane shipped (#2677).

## Why this exists

The epic's core boundary is **cached chip = read** (navigate to an
already-generated vibe — no codegen, no login, nothing forked) vs **Other /
uncached = write** (real codegen, login at that moment, forks to your handle if
the source isn't yours). What shipped is **only the write lane**
(`useLatestVibeChips` + `useInVibeGeneration` fire real in-place codegen). The
**read** lane — instant cached page-views, anonymous browsing of the cached tree,
the "no login / no fork" half Charlie originally flagged — was never built, and it
has no backing infra. This spec is that infra plus the read-lane wiring.

## The resolved model (epic note §2 "The cached zone", §8)

The apparent fuzz of "what is cached content, who owns it" dissolves once cached
content has an **owner**:

- **Every app has an owner — user _or_ system.** Curated starters and precached
  transforms are **real, addressable apps owned by a platform/system handle**. The
  start tree is just a set of system-owned public apps. "System" is simply another
  owner, so the existing slug-vs-fsId rule covers everything uniformly:
  - editing your own app advances its `fsId`;
  - editing one you don't own (**including a system-owned cached app**) forks a new
    slug under your handle.
- **An anonymous browser is just reading system-owned public apps.** Cached chips
  are reads → navigate, commit nothing, no login. The **first write forks** to the
  visitor's handle, with `remixOf` → the system fork it came from, whose own
  `remixOf` chains back to the ultimate source (lineage intact, #15).
- **No GC.** Unkept pre-made forks are a negligible drop in the bucket vs.
  everything else (jchris) — they just persist. No reaping, no TTL.

## The two infra pieces (epic note §1a/§2/§8 "Infra follow-ups")

1. **A system/cache handle that owns the pre-made forks.** A reserved
   platform-owned handle (or a small set) under which curated starters and
   precached transforms live as ordinary public apps. Anything the read lane
   navigates to is one of these. Needs: provisioning, an ownership/identity that
   the access-fn + fork rules already understand (it's "just another owner"), and
   a way to mint a fork under it from a `(source, transform)`.
2. **A content-address dedupe key `(source, transform)`.** Precaching a predicted
   next-click is a fork keyed by _what it forks from_ (`source` app/fsId) and _what
   change produced it_ (`transform` — the chip prompt / typed edit, normalized).
   The key dedupes: the same transform of the same source resolves to the same
   pre-made fork instead of regenerating. This is what makes a cached chip an O(1)
   read rather than a codegen.

## Read-lane wiring (client)

- A chip whose `(source, transform)` resolves to an existing system fork renders as
  a **read**: navigate to that fork's `/vibe/<system-handle>/<slug>` — **no login,
  no codegen, no write**. (Today every chip falls through to the write lane.)
- A chip / "Other" with **no** cached fork is a **write**: the existing
  `useInVibeGeneration` path (login + codegen + implicit fork on non-owner).
- The cached/uncached lookup is the read/write (and login/fork) boundary — it must
  be decidable **before** the click commits anything. A _read_ that's unavailable
  may soft-fail (fall through to the write lane); a _write_ keeps its existing
  fail-loud semantics.
- **Future:** pre-cache predicted next-clicks even on user-generated vibes — then
  "cached" extends past curated content. Out of scope for v1; the `(source,
transform)` key is designed to make it a later toggle, not a rewrite.

## Resolved by the read-lane PR (`claude/curated-cached-starter-vibe-9ro0vn`)

The first slice ships the **decidable, safe-no-op core** of the read lane — the
two infra primitives as pure browser-safe code plus the client decision point —
and in doing so settles three of the open questions below:

- **OQ#1 (where the dedupe index lives) — the `apps` table itself.** The
  content-address key _is_ a slug under the system handle, so a precached fork is
  found by an ordinary `getAppByFsId` read — no separate D1 table or read shard.
  (`SYSTEM_CACHE_HANDLE`, `cachedForkKey`, both in `@vibes.diy/api-types`.)
- **OQ#2 (transform normalization) — `normalizeTransform`.** Strips the `▸`
  marker, lowercases, collapses whitespace, trims, drops trailing punctuation;
  model/version folds into the key separately via `cachedForkKey`'s `model`
  field. Slug-safe, ≤32 chars.
- **OQ#5 (anonymous read access) — confirmed via `getAppByFsId`.** It is
  `optAuth`, gates on app-access visibility, and returns `not-found`/`not-grant`
  for a miss/private app — so a logged-out viewer only resolves a _public_ system
  fork (the "no login" promise holds). `isReadableCachedGrant` encodes this.

The client wiring (`resolveCachedRead` in `handleEditPrompt`,
`vibe.$ownerHandle.$appSlug.tsx`) makes the read/write decision **purely on the
cache-hit, with zero reference to identity** (per §1a "keep the boundary defined
by cache-hit, not is-it-a-curated-chip"): every chip click — owner or not — asks
"has this `(source, transform)` already been generated?" The cache is keyed by
`(source, transform)`, so the source can be a curated/system vibe **or any user
vibe whose chips get precached**; the result always lives under
`SYSTEM_CACHE_HANDLE` (storage, not a source constraint). A HIT is a read
(navigate to the precomputed result, no codegen). A miss or lookup error
soft-fails to the write lane — and **identity matters only there** (owner edits
in place, non-owner forks). Until precaching exists every lookup misses, so all
clicks fall through to today's write lane unchanged.

**Open for when precache lands — what a hit does for the OWNER of the source.**
The decision (read vs generate) is identity-free, but the _action on a hit_ for
someone who owns the source is still to settle: navigate to the system fork (as
wired now), or **adopt** the precomputed result in place as their next `fsId`
(skip codegen but keep it in their slug/data namespace, §2). Adopt-in-place is
the nicer owner outcome but needs new plumbing (feed a cached result into the
in-place write path); it's deferred because the lookup can't fire until precache
exists.

**Still open (the backend provisioning half — deferred, brainstorm-gated):**
reserving `SYSTEM_CACHE_HANDLE` out of the user handle space (OQ#4), the precache
trigger + spend ceiling (OQ#3), and minting a fork under the system handle from a
`(source, transform)`. Until those land the lookup always misses → the read lane
is a correct no-op.

## Open questions (resolve in brainstorm before planning)

1. **Where the dedupe index lives.** D1 table keyed by a hash of `(source,
transform)` → system fork slug? On which DO/plane is the lookup served so an
   anonymous page-load can hit it cheaply (the SharedSessions/`sharedApi` global
   read shard is the natural home — see #2517/#2714)?
2. **`transform` normalization.** How is the chip prompt / typed edit canonicalized
   so trivially-different strings dedupe (casing, whitespace, model/version)? Does
   the codegen model+version belong in the key?
3. **Precache trigger + budget.** What populates the cache — only curated chips at
   author time, or a background job that predicts and pre-generates next-clicks?
   What's the spend ceiling, given "no GC" means every precache persists forever?
4. **System handle shape.** One handle or a namespace? How is it provisioned and
   kept out of normal user-facing handle pickers / rosters?
5. **Anonymous read access.** Confirm the access-fn + published-state path serves a
   system-owned public app to a logged-out browser with zero writes (it should, by
   the "just another owner" rule — verify no codepath assumes a user identity on
   read).

## References

- Tracking issue: #2801 · epic: #2675 · remaining-work tracker: #2796 · write lane: #2677.
- Design source: `notes/2026-06-26-agent-in-vibe-ux-epic.md` §1a (the edit
  affordance / read-write boundary), §2 "The cached zone — resolved", §8.
- Lineage / `remixOf`: #15. Read shard the lookup can ride: #2517, #2714.
