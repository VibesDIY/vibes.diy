# Cached-read chip lane + system-owned cached-fork infra (design)

> **Status: design-level.** The product model is resolved (jchris, in
> `notes/2026-06-26-agent-in-vibe-ux-epic.md` §1a/§2/§8); this spec collects it
> into one implementable place. **The converged product model — produce / bless /
> publish, fork-by-default — is in §"Converged model (2026-06-30)"; read that
> first**, as it supersedes earlier framings on the stay-vs-fork default and names
> the one change the current build still needs (an explicit _blessing_ gate before
> a produced result becomes a visitor stay). Before building, run `brainstorming`
> then `writing-plans` to settle the open questions at the end. Tracking issue:
> **#2801** (decision to build, not drop, taken on #2796). Tracks the cached-read
> half of the agent-in-vibe epic (#2675) — only the **write** lane shipped (#2677).

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

## Converged model (2026-06-30, jchris) — produce / bless / publish, fork-by-default

A long design pass with jchris closed the model. It is best stated as **three
distinct verbs an owner's chip result can pass through**, a **default**, and a
small set of **invariants**. Everything below is the target; the §"Implementation
plan" build is _behind_ it on one consequential point (see "Delta from the current
build").

### The three verbs (don't conflate them)

- **Produced** = _generated_. The codegen ran for an offered chip; a result
  `fsId` exists and is cached (staged as an unpublished draft under the source's
  `(ownerHandle, appSlug)`). Automatic, happens on the relevant click. **This is
  deny-by-default.**
- **Blessed** = the owner _explicitly elevated that produced result_ to a
  fast-path **stay**. Pinned to the exact result `fsId` / content-address — never
  to the abstract chip. This is the new middle tier.
- **Published** = the owner promoted code to the **production HEAD** — the default
  landing you get with **no `fsId` param**. The existing, heaviest act; it governs
  the namespace.

Blessing is **not a new permission system** — _publish-to-production is the
blessing primitive we already have_, and production sits at the top of the
hierarchy (it's what you get by default). The chip work adds only the **middle
tier**: a way to elevate a _draft_ result to a fast-path stay **without** promoting
it to HEAD — so an owner can feature an alternative/ending variant without
replacing their actual app. The two elevations (bless-as-stay, publish-as-HEAD)
are independent and both explicit.

### The default: fork is the normal behavior; stay is the marked exception

Inverting the earlier framing is what makes the UX non-surprising. **A click forks
by default**; staying in the source namespace is the rare, _curated_, explicitly
marked case. Because forking is the advertised default ("remix makes a copy" — an
idiom users already hold), the one surprising-if-unannounced behavior (you stayed
on the owner's namespace + data) only ever happens **announced**.

The announcement is a **shield** on the chip = _"this one stays here, in the same
namespace, on the same data."_ There is no separate "fast" indicator: once warm,
**everything** is fast (see "Universal cache"), so "fast" isn't a distinguishing
signal — the shield's single, honest meaning is "stays."

### Universal cache; blessing only routes stay-vs-fork

Two **independent** bits doing two jobs:

- **`cached`** (materialization) — warm every _offered_ chip we can. Used by both
  paths.
- **`blessed`** (approval) — decides whether a warm result is a stay or a fork.

The cached `fsId` is therefore used two ways: **blessed → navigate-and-stay**
(shield, read-only, source namespace); **unblessed → seed the fork** (no codegen
wait — a _fast fork_ instead of a slow one). Blessing never gates _caching_; it
gates only the one capability that matters (staying).

### The result lifecycle is linear (no "blessed but cold")

You bless a **result**, not a chip — so there is nothing to bless until a result
exists. `blessed ⊃ cached`. The states are a progression, not a 2×2:

| state                            | what a non-owner click does            |
| -------------------------------- | -------------------------------------- |
| **cold** (no result yet)         | codegen → **slow fork**                |
| **cached, unblessed**            | **fast fork** (seeded from the result) |
| **blessed** (necessarily cached) | **fast stay** (shield)                 |

### Invariants (the load-bearing rules)

1. **Only the owner edits the codebase in place.** Everyone else — anonymous,
   member, outsider — **forks on a code edit.** (Members can write _data_ under the
   access function; that's an orthogonal axis the cache never touches. There is no
   "member edits code in place" case.) The fork-on-edit boundary is exactly
   **is-owner**, not `checkDocAccess`.
2. **Stay is strictly read-only for every non-owner.** The first code edit forks.
   The shield promises a fast _read_, never a write capability.
3. **Produce ≠ bless.** Clicking is _exploration_, and exploration includes
   clicking bad ideas (the "this chip deletes all my data" case). So a produced
   result is **deny-by-default**; it becomes a visitor-facing stay **only** via an
   explicit, revocable, content-pinned bless. A regretted result just sits as an
   unblessed cache entry doing nothing.
4. **Fail-to-fork.** Every failure — cold, unblessed, bless revoked, source went
   private, network error, model bump (→ new key) — degrades to a **fork**. No
   failure path degrades to an _unsafe stay_. This is what makes the whole thing
   robust rather than a stack of gates that must all hold.
5. **Shield is server-authoritative.** Rendered **only** when the server actually
   returns a stay-`fsId` (`blessed AND source-public AND visible`) — never from a
   client heuristic. A client-assertable shield would be a phishing vector.

### Data model

The cached result is a staged **draft** `fsId`; production results need no
approval entry (they're stays by default via the existing no-`fsId`→HEAD
resolver). Two composed entries (dbAcls-style), keyed by the content-address:

- **production entry** `{ key, fsId, sourceFsId }` — "owner _produced_ this."
- **approval entry** `{ key, approvedBy, approvedAt }` — "owner _blessed_ this."

The approval entry **depends on** the production entry (you can't bless a `key`
with no result) — the structural expression of invariant 3. `approvedBy` is the
forward hook for admin-on-behalf (a different identity blesses), defaulted to the
owner today. **Note:** enabling that future case needs more than the field — the
AppSettings owner-gate (`ensure-app-settings.ts`) currently blocks any non-owner
write, so admin approvals will need their own write-path. Out of scope here.

### Scope: owner-only for v1

The approver is the **owner**, blessing **their own** content — which is just the
owner-self-exposure already accepted (Finding A). No delegation, no third-party
consent, no audit-of-who-vouched requirement, so the entire admin-governance
branch **does not exist yet**. Because jchris owns the system/starter vibes,
owner-only already covers ~all near-term value. Admin-on-behalf ("fast-path other
owners' vibes without them participating") is cleanly additive later.

### Delta from the current build — RESOLVED (bless gate shipped)

The first enablement slice (#2890, merged) served a **stay** for _any_ produced
result whose source was public — it **auto-stayed**, with no blessing gate, which
contradicted invariant 3 ("owner clicks a bad chip and it's instantly live as a
stay"). **This is now closed by the bless gate** (follow-up PR): a produced result
is deny-by-default and **forks** until the owner explicitly **blesses** it.

What shipped (matches Charlie's acceptance criteria below):

- **Bless record + revoke** — `active.cached-suggestion-bless` composes into
  `entry.cachedSuggestionBlesses: { [key]: { fsId, sourceFsId, approvedBy,
approvedAt } }`. The write is owner-gated (the `ensureAppSettings` non-owner
  early-return), keyed per content-address; `op: "revoke"` removes it. `approvedBy`
  /`approvedAt` are stamped server-side from the authenticated owner — the
  approver is the forward hook for admin-on-behalf without a schema change.
- **Reader + grant require the bless** — the reader (`getCachedSuggestion`) and the
  grant (`get-app-by-fsid` `cachedSuggestionGrant`) read the **bless** map, not the
  produce map. Unblessed/revoked = absent = uniform miss / deny → **fork**
  (fail-to-fork). The grant-time source-public recheck is kept.
- **Bless ⇒ produce, by construction** — the bless map is the serve-eligibility
  layer; the produce map (`cachedSuggestions`) is just the owner's record of what
  was generated (for the bless UI / future fast-fork-seed / telemetry) and no
  longer affects serving.

This is the **real resolution of Finding A**: a human owner vouching for a specific
result _is_ the provenance verification the grant can't do automatically. The lane
**stays preview-flag-only** (`VIBES_CACHED_SUGGESTIONS="on"` in `[env.preview]`)
until prod enablement is separately decided; the gate is the prerequisite, now met.

**Still to do for preview validation (usability, not security):** an owner-facing
**bless / unbless control** in the vibe route so an owner can elevate a produced
result to a stay (and revoke). Until that lands, the lane is safe but inert
(nothing is blessed → everything forks). Tracked as the immediate follow-up.

Two precisions the build must hold to:

- **Cache only _offered_ chips, never custom prompts.** A custom/free-text prompt
  can carry PII in code → never produced-into-cache, never seeds a fork, never
  stays; it is always a fresh-codegen write/fork. The cache key binds the
  **pristine offered-chip output `fsId`**, so an owner's later hand-edits to a
  result don't leak through a fork-seed. ("Cache all the chips" = all _offered_
  chips.)
- **Cache is owner-produced only in v1.** A non-owner's miss does a fresh-codegen
  fork and writes **nothing** under the owner's namespace (preserves invariant 1).
  The "lazy-cache on heavy anonymous traffic" aspiration is deferred — it needs a
  producing identity that is _not_ the visitor writing into someone else's
  namespace.

The **fast-fork-from-cache** path (serving a cached result as a fork _seed_ for
unblessed clicks) is **additive and not yet built** — today's reader serves only
the stay path. Recorded here as the intended next capability, not something shipped.

### Adjacent hazards (parked — not fixed by this model)

- **#2902** — saving an unpublished dev draft re-binds the live per-`(ownerHandle,
appSlug)` access function for the whole namespace, no publish/consent. The cache
  read lane introduces no new instance of this (reads never re-bind), but the
  **producer/staging** path must not re-bind access when it stages a result. Filed
  separately.
- **Destructive-evaluation.** Invariant 3 stops a regretted result reaching
  _visitors_, but an owner _reviewing_ a destructive chip still runs it against
  their **live** data before deciding not to bless. That's a producer/evaluation
  safety concern (same family as #2902: staging/evaluating must be non-destructive),
  handled separately from the read lane. The offered-chip allowlist should also
  avoid data-destructive transforms.

### Charlie's safety validation (#2890, 2026-06-30)

Charlie validated the converged model against the current branch (spec +
reader/grant + writer auth). **Verdict: directionally correct; the bless gate is
the right prerequisite for prod; keep the lane preview-flag-only until it lands.**
No blockers. The substantive additions:

- **Finding A resolution holds — with one condition.** Blessing resolves Finding A
  **iff** the bless is a **server-authenticated owner action over a specific
  `{cacheKey, fsId, sourceFsId}` tuple**, and the grant **requires that bless
  record** (plus the grant-time source-public recheck). If bless is just another
  unverified map write, Finding A remains. Owner-self-bless in v1 is acceptable
  self-exposure, not a new third-party exposure.
- **Invariants are sufficient _if enforced server-side_.** Current code status he
  confirmed: (a) owner-only in-place code edit — **enforced** (`isOwner` lane +
  server chat-ownership checks); (b) non-owner stay read-only — **enforced** for
  the code path (non-owner edit → fork/remix); (c) produce ≠ bless — **not
  implemented yet** (map is `{fsId, sourceFsId}` only); (d) fail-to-fork —
  lookup/projection failures already degrade to fork, though a staged-URL grant
  failure currently lands in `not-grant` UI (safe, but not full auto-fork UX); (e)
  server-authoritative shield — modeled in spec, **not yet in grant logic**.
- **Parked hazards confirmed out-of-scope.** #2902 and destructive-evaluation are
  correctly adjacent; read-lane gating is **not** load-bearing on those fixes —
  the one caveat is that producer/staging must not re-bind access during stage
  creation (already noted).

**Prod-enable minimum checklist (Charlie) — acceptance criteria for the bless
gate. All DONE (follow-up PR):**

1. ✅ Explicit **bless record** (`{key, fsId, sourceFsId, approvedBy, approvedAt}`,
   owner-authed) **+ a revoke path** (`op: "revoke"`).
2. ✅ **Require the bless** in both the `getCachedSuggestion` reader and the
   `get-app-by-fsid` stay allowance (both read the bless map).
3. ✅ **Grant-time source-public recheck** kept (`cachedSuggestionSourceIsPublic`).
4. ✅ Tests: **unblessed → fork**, **blessed → stay**, **revoked → fork**,
   **non-owner cannot bless**, **non-owner cannot produce** (plus source-not-public,
   app-not-public, and Finding-B-after-unpublish all still hold under a bless).

Remaining before a prod flip is a **product decision**, not new gate code: the
owner-facing bless UI (for real preview validation) and the explicit go-ahead to
enable `VIBES_CACHED_SUGGESTIONS` in prod.

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
