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

## Model refinement (2026-06-30, jchris) — cached results stage under the SOURCE vibe, not a system handle

The "system-owned cached-fork" framing above (§"resolved model"/§"two infra
pieces") is **superseded** by a simpler model jchris settled during the read-lane
PR. The earlier framing was a workable but wrong-shaped guess; the real model:

- **A cached suggestion result is a new `fsId` under the SOURCE vibe's own
  `(ownerHandle, appSlug)`** — same owner, same slug, a new code version (§2:
  same slug + new fsId = new code, data carried). It is **NOT a fork under a
  system handle.** A chip is a transform; "if tokens were free we'd precompute
  every chip" — so the cache is just the precomputed result staged as a version.
- **Never published except by the owner.** Precompute stages versions; it never
  advances the public HEAD. The owner publishes if/when they want.
- **The system handle is not infra.** `SYSTEM_CACHE_HANDLE` was only ever a
  convenience for jchris's demo content; homepage starters will be ordinary user
  vibes. So there is no reserved-handle requirement, no "mint a fork under
  system." (OQ#4 dissolves; the constant is dropped from the code.)
- **A cache hit is a read to `/vibe/<sourceOwner>/<sourceSlug>/<stagedFsId>`** —
  the source vibe at the staged version.

## Shipped by the read-lane PR (`claude/curated-cached-starter-vibe-9ro0vn`)

The first slice ships the **decidable, safe-no-op core** under the refined model —
pure browser-safe primitives plus the client decision point. In
`@vibes.diy/api-types/cached-suggestion.ts`:

- **OQ#2 (transform normalization) — `normalizeTransform`.** Strips the `▸`
  marker, lowercases, collapses whitespace, trims, drops trailing punctuation;
  model/version folds into the key separately via `cachedSuggestionKey`'s `model`
  field.
- **The content-address key — `cachedSuggestionKey(source, transform[, model])`.**
  Deterministic `[a-z0-9-]` ≤32-char key over `(source-version, transform, model)`.
  It is the index key / the tag a staged version carries — **not** a slug or owner
  (the result keeps the source's slug).
- **The decision — `resolveCachedRead`.** Identity-free: it depends only on
  whether the result exists, never on who clicks (per §1a "keep the boundary
  defined by cache-hit, not is-it-a-curated-chip"). A hit navigates to the staged
  version; a miss or any lookup error soft-fails to the write lane, where identity
  _does_ matter (owner edits in place, non-owner forks).

The client wiring (`resolveCachedRead` in `handleEditPrompt`,
`vibe.$ownerHandle.$appSlug.tsx`) runs for **every** chip click; the injected
`lookup` is the single seam the precache index plugs into. It returns `null`
today (no index yet), so every click is a write — a correct no-op that lights up
the instant precache starts staging versions.

**Re-opened / still open (the deferred backend half):**

- **OQ#1 (where the index lives) — re-opened.** The slug-as-key trick is gone
  (the result keeps the source's slug), so a real `(source-version, transform) →
staged-fsId` map is needed: likely a tag in the staged version's `meta` plus a
  list/lookup over that vibe's versions, or a small KV/D1 map. The
  `cachedSuggestionKey` is the key it's keyed on.
- **OQ#5 (anonymous read access) — reframed.** Can a non-owner read a staged-but-
  **unpublished** version of a public app via an explicit-`fsId` read?
  `isReadableCachedGrant` encodes the grant check; confirm the published-state
  path serves an explicit staged version to a logged-out viewer.
- **OQ#3 (precache trigger + spend ceiling)** — what stages versions and how much
  we'll spend, given no GC. Plus **read-lane outcome telemetry**
  (`hit`/`miss`/`lookup-error→write`) so soft-fail can't mask an infra regression.
- **Owner's action on a hit** — navigate to the staged version (as wired), or
  **adopt** it in place as the owner's next `fsId` (skip codegen, keep their
  slug/data namespace). Adopt-in-place is the nicer owner outcome but needs new
  plumbing; deferred until the lookup can fire.

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
