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
- **OQ#5 (anonymous read access) — reframed, with a PII boundary.** Two parts:
  (a) Can a non-owner read a staged-but-**unpublished** version of a public app
  via an explicit-`fsId` read? (b) **What's safe to serve anonymously?** Only
  **chip-derived** results — the transform is a curated, finite, known
  suggestion chip, applied to already-public source code, and data is never in
  the code, so a chip result adds no new PII. A **custom "Other" / free-text**
  prompt can inject PII into the generated code, so its result must **never**
  become a publicly-readable cached page — and it doesn't need to, since a custom
  prompt is always a write (login-gated, fork-on-non-owner). The boundary:
  **anonymous cached reads are restricted to the offered-chip allowlist.**
  Enforcement is two-layer — the client only attempts the read lane when the
  click matches an offered chip (shipped: `cardChips` allowlist in
  `handleEditPrompt`), and the AUTHORITATIVE server gate is precache staging only
  chip-derived transforms + tagging them with a narrow "chip-derived,
  public-read-eligible" visibility state (distinct from owner-publish) that the
  anonymous serve path requires. This new visibility state is the real answer to
  "unpublished yet anonymously readable": readable because the platform staged a
  curated-chip result and marked it public-safe, not because the owner published.
- **OQ#3 (precache trigger + spend ceiling)** — what stages versions and how much
  we'll spend, given no GC. Plus **read-lane outcome telemetry**
  (`hit`/`miss`/`lookup-error→write`) so soft-fail can't mask an infra regression.
- **Owner's action on a hit** — navigate to the staged version (as wired), or
  **adopt** it in place as the owner's next `fsId` (skip codegen, keep their
  slug/data namespace). Adopt-in-place is the nicer owner outcome but needs new
  plumbing; deferred until the lookup can fire.

## Implementation plan — the enablement PR (proposed, for review)

This turns the re-opened questions into a concrete plan for the PR that makes the
read lane actually fire. **Posted for focused review before the code lands**;
decisions below were settled with jchris. The full auto-precompute remains
deferred — this enables the lane and a manual/owner-driven producer sufficient to
validate end-to-end in a PR preview.

**1. Storage — `AppSettings`, no SQL migration (resolves OQ#1).** The dedupe
index lives in the per-app `AppSettings` JSON, not a new table or column.
`AppSettings.entry.settings` is composed by `buildEnsureEntryResult` from an array
of `type`-tagged `ActiveEntry` variants; `dbAcls` is the precedent for _many of a
kind_ composing into a keyed map (`{ [dbName]: acl }`). So add an
`active.cached-suggestion` entry `{ type, key, fsId, sourceFsId }` (one appended
per cached chip) composing into
**`entry.settings.cachedSuggestions: { [cacheKey]: { fsId, sourceFsId } }`**, plus
a `reqEnsureAppSettingsCachedSuggestion` write. (`sourceFsId` records the
public-HEAD version the result was derived from, so the serve path can verify the
PII boundary — Codex P1, §5.) The `AppSettings_ownerHandle_appSlug_idx`
already serves the lookup; the `settings` column is already JSON, so this is a
code-only arktype change — **no `drizzle-kit push` migration**.

**2. Keying — on the served version, not the route param.** The cache key
(`cachedSuggestionKey`, already shipped) is `(source-version, transform, model)`
and is fsId-specific. The client must feed the **effective served fsId**
(`fsId ?? draftFsId ?? resolvedFsId`, the route's `effectiveFsId`), NOT the raw
route param (which is undefined on the canonical `/vibe/<owner>/<slug>` URL).
Producer and reader must agree on that concrete fsId or a result staged against
version A would be served for version B.

**3. Producer — hook the owner's existing in-place generation (no headless
codegen).** When an owner runs an **offered chip** and the turn settles to a new
fsId (`persistedFsRef`), write a `cached-suggestion` entry mapping
`cachedSuggestionKey(servedVersion, chipText) → newFsId`. So the first time the
owner runs a chip, it's cached for every later visitor — reusing the codegen path
that already exists. Auto/background precompute + spend ceiling stay deferred
(OQ#3).

> **The source version must itself be public (Codex P1, #2890).** The PII-safety
> invariant is "a cached read is a transform of _already-public_ source code." So
> the producer registers an entry **only when `servedVersion` was the app's public
> production HEAD** — never when the owner is pinned to an unpublished `draftFsId`
> (a draft's code isn't public and could carry unreleased/PII content forward into
> the staged result). The entry records the **source fsId** it was derived from, so
> the boundary is verifiable, not just inferred from "the app is public now."
> Chips run against a draft simply aren't cached (they stay a normal in-place edit).

**4. Reader — an anonymous `getCachedSuggestion` projection (mirrors `getVibeChips`
#2755).** Given `(ownerHandle, appSlug, key)`, return the staged `fsId` iff the
app is public and the entry exists. `optAuth`, gated on app-access visibility, so
a logged-out visitor can resolve it. The client `resolveCachedRead` `lookup` (the
`() => null` seam shipped in the core PR) calls this; on a hit it navigates to
`/vibe/<owner>/<slug>/<fsId>`.

**5. Serve — explicit grant allowance (resolves OQ#5; security-sensitive).**
`get-app-by-fsid` grants anonymous `public-access` only when
`app.mode === "production"`, so a staged _unpublished_ version is `not-found`
today. Add a narrow rule: **if the requested `fsId` is registered in the source
app's `cachedSuggestions` map, the app is public, AND the entry's recorded source
version was itself publicly readable (the production HEAD), grant `public-access`
for that exact fsId even when `mode !== "production"`.** The source-was-public
check (Codex P1) is what keeps the PII boundary intact — without it, a result
derived from an owner's unpublished draft on a public app would leak anonymously.
Staged versions stay genuinely unpublished (never the HEAD, not "published"); the
map entry — `{ key, fsId, sourceFsId }` — is the single, auditable source of truth
for "anonymously readable staged version." This change gets a dedicated
`/security-review` pass.

**6. Client — flag + the chip allowlist (PII boundary).** The read-lane lookup is
gated behind a preview env flag (default off; on in `[env.preview]`) so prod stays
a no-op while we validate in the PR preview. The offered-chip allowlist
(`cardChips` match, shipped) stays the client-side PII guard; the server reader is
the authority (it only returns chip-derived public entries).

**End-to-end validation (in the PR preview, flag on):** as a logged-out browser on
a pre-warmed public demo vibe — click a curated chip → instant navigate to the
staged version, no login/codegen/fork; click "Other"/custom → write lane (login).
Negative: a custom prompt never resolves to a read.

**Still deferred after this PR:** auto/background precompute + spend ceiling
(OQ#3), read-lane outcome telemetry, and the owner's adopt-in-place-on-hit option.

### Review guardrails (Charlie, #2890 — folded into the implementation)

Charlie approved the direction; these guardrails are committed constraints for the
implementation:

1. **Storage.** `sourceFsId` is **required** cache metadata, not optional, so the
   security check and future cleanup are deterministic. Add **bounded retention**
   (cap older source-versions/chips per app) and **size/count telemetry** so we
   see when per-row JSON growth becomes the bottleneck (the table-vs-JSON
   re-evaluation trigger).
2. **Grant.** Implement as a clearly-named branch (`cachedSuggestionGrant`) in
   `get-app-by-fsid` (the single access choke point — not a separate serve path
   that can drift), gated on ALL of: app currently public; requested `fsId`
   explicitly in that app's cached-suggestion map; the mapping carries
   `sourceFsId` and that source version is/was public; **deny if the app is
   tombstoned / unpublished / private**. Emit an **audit reason** whenever this
   path grants access.
3. **Producer.** Registration is **idempotent and best-effort — it must never
   block or fail the owner's generation flow** — and fires only for offered chips.
   Compute/store the key from the served `effectiveFsId` **at write time** to
   avoid param drift.
4. **Reader.** Returns `null` for miss/non-public so it can't become an
   **existence oracle**, and **reuses `getVibeChips`'s public-visibility
   semantics** to avoid policy skew.
5. **Keying.** Treat the route `fsId` as a **hint only**; canonicalize the served
   `effectiveFsId` **once** and use that same value in both producer and reader
   paths.

### Security-review findings (#2890 `/security-review`)

The owner-gated write is the key control: an anonymous/non-owner caller's `_auth`
is undefined and fails the owner check in `ensureAppSettings`, so **only an app's
own owner can register its `cachedSuggestions`** — the "register a victim's
private fsId" / cross-tenant attack is not possible. Cross-app confusion and
injection are also closed (all lookups are owner/slug-scoped, parameterized).

Two findings, both **bounded to owner-self-exposure** (no third-party victim):

- **Finding B — FIXED.** The `cachedSuggestionGrant` ran for a soft-unpublished
  (tombstoned) app, because the `isHiddenForCaller` tombstone gate only runs on
  the no-`fsId` path and the grant requires `fsId` (and `publicAccess` stays
  enabled across unpublish). The grant now re-checks `isHiddenForCaller`, mirroring
  the reader, so unpublishing a vibe also stops serving its staged cached versions.
- **Finding A — WON'T FIX (accepted, jchris).** The grant verifies the **source**
  version was public but does **not** verify the staged `fsId` is genuinely a
  chip-derived transform of it — the owner-written map entry is trusted for the
  served fsId. So an owner could register one of their own _unpublished draft_
  fsIds and have its `env`/`fileSystem` served anonymously. **Accepted as
  won't-fix:** impact is bounded to the owner exposing **their own** app's content
  (which they could publish anyway), and triggering it requires the owner to
  deliberately work around the normal flow (the producer only ever registers the
  actual chip result). No third-party victim. The fix, if ever wanted, is a
  codegen-time provenance `meta` tag the grant verifies.

  > **Gate before PRODUCTION enablement (Charlie #2890).** Won't-fix holds while
  > the lane is **preview-flag-only** (`VIBES_CACHED_SUGGESTIONS="on"` in
  > `[env.preview]`). Before flipping the flag on in **prod**, revisit the
  > provenance enforcement — owner-only writes + preview-only is what makes the
  > current bound acceptable; prod enablement widens exposure to all owners.

- **Key-specific source check (Charlie #2890) — DONE.** The source-was-public
  verification is per-entry: the reader checks THIS entry's `sourceFsId` (by key),
  and the grant (which resolves by fsId, no key) iterates EVERY entry mapping that
  fsId and grants iff at least one has a public source — no fsId first-match
  masking. (`cachedSuggestionSourceIsPublic` / `grantableCachedSuggestionSource`.)

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
