# On-ramp Instant Starter Stack on the cached-fork infra (design)

> **Status: design-level.** Brainstormed with jchris (2026-06-30). Tracks the
> bridge between the touch-first on-ramp concept (#1896 "Instant Starter Stack" +
> children #2243–2247) and the now-live system-vibe cached-suggestion infra
> (#2801 read lane → #2928 prod flip → #2929 deferred enhancements). Tracking
> issue: **#2941**. Part of the Agent-in-Vibe UX epic (#2675). Before building, run
> `writing-plans` to turn this into an implementation plan.

## Why this exists

The on-ramp concept and the cached-fork infra were designed as two separate
threads and never stitched together. #1896's "land in a live app → tap a curated
chip → boom, it changed → tap → … → prompt when you're ready" was specced (the
2026-06-05 session, children #2243–2247) **before** the cached-suggestion model
existed, so it leans on a bespoke "`<500ms` cached-swap mechanism" that was never
built. Meanwhile the cached-suggestion read lane shipped and went live in prod
(#2928). This spec says how the Instant Starter Stack is actually built on that
live infra — almost entirely by **using what already ships**, plus one thin new
dispatch branch, a checked-in curated graph, synthetic seed chats, and the
`/start` route.

## The resolved model: three coexisting lanes

Every chip on a starter vibe's "Make it yours" tray resolves to exactly one of
three lanes. Two already differ in the code today; the third is the small new
piece. **"We need both"** (jchris) is these lanes coexisting:

| Lane                           | What it is                                                                                                    | Slug behavior                                                                                     | Login / fork                   | Status               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------- |
| **Curated spine** (hand-tuned) | A curated jump from one hand-tuned system vibe to another (`bloom-root → bloom-machine`)                      | **Cross-slug** navigation to another public vibe — a **new namespace, which is appropriate here** | None — it's a public read      | **New** (thin)       |
| **Emergent transforms**        | The #2928 cached-suggestion lane: an offered chip, produced + blessed, served as an instant in-namespace stay | **Same-slug**, new `fsId`                                                                         | None                           | **Live** — untouched |
| **Other / unblessed**          | Real codegen                                                                                                  | Owner edits in place; non-owner forks to their handle                                             | Login-gated; fork on non-owner | **Live** — untouched |

- The **spine** is the **designed, hand-tuned skeleton** — a curated set of
  polished system vibes and the curated steps between them. It is authored, not
  generated.
- The **emergent lane** is the one that **"falls out of usage naturally"**: as
  owners/curators (and the producer hook) run offered chips in place and bless the
  good ones, each app individually gains instant same-slug transforms — without
  anyone touching the spine. Fast-fork-from-cache and owner adopt-in-place (#2929)
  accelerate this further as they land.
- **Other** is the existing write lane, unchanged: the moment a visitor types a
  custom prompt, they're committed and they fork.

### Principle: categories are doors, not fences

A starter's curated tree is free to leave its category. `bloom-says` is reached
from the **Music** root but **is a Game**. The `/start` tiles are entry doors into
the experience, not silos — the spine graph spans categories.

### Why "new namespace is appropriate" for the spine

The #2928 shield promises a same-slug **stay** — "click this and you stay here:
same namespace, same data, no fork." A curated spine jump lands in a _different_
slug (a different curated app), so it is **not** a same-namespace stay. jchris's
call: for the curated spine, **a new namespace is appropriate** — the destination
is a pre-built, public, curated app, so the jump is still instant, login-free, and
fork-free; only the "same data namespace" property differs, and an on-ramp visitor
has no data to carry yet. So a spine jump is a **first-class, instant, curated**
affordance — not second-class.

**Affordance — decided (jchris, on Charlie's #2950 rec): a distinct glyph.** The
🛡 shield keeps its precise, server-authoritative meaning — "you stay in this same
namespace" — and is never drawn for a cross-slug jump (a client-asserted "stays
here" is a documented phishing risk). The cross-slug curated jump gets its **own
distinct glyph** (e.g. `→`) that signals "instant · curated · no-login" without
impersonating the same-namespace stay. Both are first-class and instant; only the
mark differs.

## Grounding in the current code

What is already true (verified against `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`
and `vibes.diy/api/types/chat-chips.ts`):

- **Chip dispatch** lives in `handleEditPrompt`. For an offered chip it runs
  `resolveCachedRead`: a hit navigates **same-slug** to `/vibe/<owner>/<slug>/<fsId>`;
  a miss or any lookup error soft-fails to the write lane (owner → in place;
  non-owner → fork). The read decision is identity-free; identity only matters in
  the write lane. The `isOwner` gate at the producer-capture line is only about
  _recording_ a produced entry, not about who may read.
- **Chips come from `getVibeChips`** → `latestTurnChips` → `chipsFromNarration`,
  which peels the trailing `▸` option group from the latest chat turn's
  toplevel-line narration (cap 3, drop the terminal "I'm done for now" chip).
- **Hand-tuned vibes have no chips.** A `vibes-diy push` of a hand-built `App.jsx`
  produces a turn whose narration carries no `▸` lines (the code even notes the
  "CLI-seeded generation turn whose narration was just `File: /App.jsx`" case), so
  `getVibeChips` returns `[]` for the existing Blooms.
- **Shield + bless** are server-authoritative (`getCachedSuggestion` returns a
  stay-`fsId` only when blessed AND source-public AND visible); the client never
  asserts a shield. Bless/unbless controls are owner-only.
- **No `/start` route exists** yet (`vibes.diy/pkg/app/routes/` has no `start.tsx`).

## Architecture revision (2026-06-30, jchris) — cross-slug routing lives in the bless map

The "checked-in curated graph + `handleEditPrompt` pre-check" framing in the next
two sections is **superseded for the routing**. jchris's better, narrower design:
**a chip's destination is resolved server-side by `getCachedSuggestion`, for both
kinds.** A cached-suggestion **bless record** now has two shapes (`cached-suggestion.ts`):

- **same-slug STAY** — `{ fsId, sourceFsId }` (existing): the chip stays on this
  vibe at a staged version. The 🛡 shield.
- **cross-slug VIBE link** — `{ targetOwnerHandle, targetAppSlug }` (#2941): the
  chip navigates to ANOTHER curated public vibe (a new namespace). The `→` jump.

So **both kinds are blessed data in `AppSettings`, keyed by the same content-address
`cachedSuggestionKey(source, transform)`**, and the existing read lane resolves
them — the cross-slug edge is just another blessed cached-suggestion. This **removes
the separate client graph + pre-check entirely**: there is no runtime curated graph.
The implemented surface:

- **Reader** (`get-cached-suggestion`): a cross-slug bless returns the target;
  the safety analog of the stay's source-public check is **"the TARGET vibe is
  public"** (navigating to it must be a real anonymous read). Same no-oracle miss
  shape. The same-slug path is unchanged (it falls through the new branch).
- **Bless write** (`ensure-app-settings`): a cross-slug bless/revoke variant with
  **no produce-before-bless** step — a curated link to already-public content is
  not a generated artifact, so there's no PII provenance to verify and nothing
  produced to match. Owner-gated like every bless. The same-slug bless is unchanged.
- **Client**: the read-lane lookup navigates cross-slug on a target hit; the glyph
  (🛡 vs `→`) is driven by **which the server returned** (`fsId` vs `targetAppSlug`)
  — server-authoritative, never a client assertion (preserves the OQ-C / Charlie
  #2950 anti-phishing property). `curatedEdgeTarget` + `jumpChips` are deleted.
- **`starter-graph.ts`** is now **setup-only config**: `STARTER_CATEGORIES` (the
  `/start` tiles) + `CURATED_EDGES` (the single source the post-deploy setup reads
  to seed chip labels AND bless `chipLabel → targetVibe` links). Not a runtime resolver.

The **within-vibe (same-slug) fsId bless path is behaviorally unchanged** — the
cross-slug branch is additive; stays fall through it. (Schemas loosened `fsId`/
`sourceFsId` to optional so one record covers both shapes, with runtime guards at
every serve/write site so a malformed stay fails safe.) Tests: same-slug grant/
reader/bless (10) + cross-slug bless/target-public/revoke/owner-gated + hardening (8) all green.

### Charlie #2941 safety review — resolutions

Verdict: **approve-with-conditions; no new data-exposure bypass.** Resolutions:

- **No produce-before-bless for a cross-slug link** — accepted as curated
  navigation. **Condition met:** malformed/mixed bless payloads (partial `target*`
  tuple, or a stay+link mix) are **rejected at write time** in `ensure-app-settings`,
  not just missed at read. (Tests: "rejects malformed/mixed bless payloads at WRITE
  time".)
- **Cross-owner linking — open, no restriction (jchris).** "Target must be public"
  is sufficient for confidentiality (no hidden data served); the residual is
  social/trust, accepted. A source owner may link a chip at any **public** vibe,
  any owner. Kept a non-gating telemetry line (`crossOwnerCuratedLink`) for
  visibility only.
- **Optional-schema + runtime guards (v1) → `kind` discriminated union (later).**
  Ships on optional+guards (fail-safe; Charlie confirmed no serve/grant bypass).
  The `kind`-union migration is an aftertask: **#2965**.
- **Hardening assertions added** (Charlie's list): grant-lane isolation (a
  cross-slug bless never grants a staged `fsId`), uniform no-oracle miss shape
  across reasons, and target-visibility-flip (public → not) → immediate miss.

> Sections below describe the original curated-graph approach; read them for the
> product intent (the tree, the seed chats, the `/start` tiles), but the **routing**
> is the bless-map model above, not a client graph or a `handleEditPrompt` pre-check.

## What's new (small)

### 1. The curated graph — a checked-in config, the single source of truth

A checked-in module (same pattern as `FeaturedVibes.tsx`) describing:

- **Roots** — the `/start` category tiles: `{ category, label, entryVibe: {ownerHandle, appSlug}, thumb }`.
- **Edges** — the spine: `{ sourceVibe: {ownerHandle, appSlug}, chipLabel, target: {ownerHandle, appSlug} }`.

Re-curating a starter or swapping a category root is a one-line PR. The `system`
handle is **illustrative** — the graph stores whatever owner/slug each curated
vibe actually has; **nothing gates on the handle.** Some starters may come from
other handles.

### 2. Synthetic seed chats — so curated chips ride the existing pipeline

Each curated starter vibe is seeded with one chat turn whose assistant narration
ends with its curated `▸` chips, so `getVibeChips` emits them with **no
chip-pipeline change** (`latestTurnChips` already projects exactly this). The chip
text is generated **from the curated graph**, so the graph stays the single source
of truth and the seed chat can't drift from it. The seed turn is pinned to the
vibe's deployed `fsId` (version-scoped chip semantics).

> **Guardrail — seed turns are display-only and non-producible (Charlie #2950).**
> A synthetic seed turn supplies chip _labels_ only. It must be explicitly marked
> non-producible (excluded from produce registration) so a produce→bless tuple can
> **only** originate from real codegen output, never from a fabricated turn. The
> serve path stays the sole authority (blessed tuple + visibility + source recheck
> in `get-cached-suggestion` / `get-app-by-fsid` / `ensure-app-settings`); the seed
> chat never becomes a producible source. (Precision, Charlie #2950: the enforced
> source condition is **production/public source version**, not strict "latest
> public HEAD" latestness — phrase it that way throughout.)

> The authoring tool that writes these seed turns is an implementation concern; the
> spec's requirement is only **what must be true**: each curated starter carries a
> turn whose narration yields its curated chips through the unmodified
> `getVibeChips` projection, and that turn is non-producible. (Open question OQ-A
> below: exactly where/how the seed turn is persisted.)

### 3. The dispatch pre-check — the only change to `handleEditPrompt`

Before the existing dispatch, add one branch: if the clicked chip (normalized the
same way the cache key normalizes) matches a **curated edge** for the current
source, `navigate(/vibe/<target>)` — an instant public read. **Everything else
runs the existing dispatch verbatim** (offered chip → #2928 read lane; else
write/fork). Precedence: **a curated edge wins** over a same-slug blessed version
for the same label (the hand-tuned app is the intended destination).

> **Match on the effective resolved source version, never the raw route param
> (Codex P2).** The `/start` tile lands the visitor on `/vibe/<owner>/<slug>` with
> **no** route `fsId`, so the pre-check must canonicalize the source the SAME way
> the cached-chip path already does — `fsId ?? draftFsId ?? resolvedFsId` (the
> `sourceFsId` at `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx:460`) —
> and match the edge against that resolved version. The synthetic seed chat is
> pinned to the same resolved deployed `fsId`, so the chip renders and the edge
> matches on the same value. Matching the bare optional route param (undefined on
> the canonical starter URL) would miss every v1 edge and fall through to
> codegen/fork — the exact bug this note exists to prevent.

### 4. The `/start` route (#2245)

Renders the 4 category tiles from the curated graph roots. Tapping a tile lands the
visitor on the entry vibe's `/vibe/<owner>/<slug>` — a live, running app — with its
curated "Make it yours" chips already showing.

## v1 scope: Music / the Blooms

v1 wires the **four existing hand-tuned Bloom vibes** (already pushed under the
`system` handle) — no new app content:

```
bloom-root          /start "Music" tile entry — 4×4 tone grid
  ├─▸ "Add a pattern sequencer"  → system/bloom-machine  (looper/sequencer)
  │      └─▸ "Make it a drum machine" → system/bloom-drums   ·leaf
  └─▸ "Make it a memory game"    → system/bloom-says      ·leaf · GAME (leaves Music)
```

- **3 curated edges** in the graph.
- **Synthetic seed chats** for `bloom-root` (2 chips) and `bloom-machine` (1 chip).
- Within any of the four apps, same-slug cached transforms and "Other"-forks
  emerge from use — no v1 authoring required.

End-to-end validation (PR preview, `VIBES_CACHED_SUGGESTIONS` already on in
preview/prod): as a logged-out visitor, `/start` → tap **Music** → land in
`bloom-root` running → tap "Add a pattern sequencer" → **instant** navigate to
`bloom-machine` (no login/codegen/fork) → tap "Make it a drum machine" → instant
`bloom-drums`; back on `bloom-root`, tap "Make it a memory game" → instant
`bloom-says` (a Game). Tap "Other" / type a custom prompt → write lane (login,
fork on non-owner). The curated chips appear because the seed chats surfaced them
through `getVibeChips`.

## Re-grounding the existing children (#2243–2247)

This design re-grounds the pre-cached-model children; it does not re-file them:

- **#2246** ("`<500ms` cached-swap mechanism") — the swap **is** cross-slug
  navigation (spine) + the live #2928 read lane (emergent). Not new mechanism.
- **#2244** ("3 + Other" chiclet) and **#2245** (`/start` route) — the real UI work.
- **#2243** (Music starter) and **#2247** (Music branch content) — satisfied by the
  existing Blooms; the work is the curated-graph + synthetic-chat wiring, not new apps.
- **#1836** (first-run VibesPanel) — the "Make it yours" tray is the existing chip
  card; relationship to the panel is a UI detail for the plan.

## Out of scope

- **Auto/background precompute + spend ceiling** (#2929 #2) — v1 is hand-curated;
  the emergent lane warms from organic owner usage. The precompute seam already
  exists (the `lookup` injection) for when a tree gets too deep to hand-curate.
- **Admin-on-behalf bless** (#2929 #3) — not needed: each starter is owned by
  whoever curates it, so owner-gated bless already covers it.
- **Deeper-than-shown trees / the other 3 categories** (Creative/Productive/Games) —
  pure content/curation follow-ups once Music proves the loop; no new code.
- The deliberate "generating for real" visual treatment — the read-lane (instant
  nav) vs write-lane (streaming build) contrast already distinguishes them by
  construction; any amplification is a downstream polish pass.

## Implementation status (this PR)

**The full v1 is built.**

- **Client spine** — the curated graph (`routes/starter-graph.ts` + unit tests),
  the `handleEditPrompt` cross-slug pre-check (curated-edge-wins, slug-scoped, no
  producer capture), the distinct `→` jump glyph in `UnifiedVibeCard` (never the
  shield), and the public `/start` route.
- **Seed mechanism (OQ-A, resolved)** — `seedStarterChips` (`api/svc/intern/seed-starter-chips.ts`)
  writes a talk-only narration turn so `getVibeChips` surfaces the curated chips;
  idempotent; **non-producible by construction** (writes only chat narration). An
  **owner-gated handler** (`seedStarterChips` evento + `api.seedStarterChips`)
  exposes it so the curator runs it against prod. `starterSeedPlan()` turns the
  curated graph into the exact per-vibe seed calls. Round-trip + idempotency +
  owner-gating tests pass.

It's a **correct no-op until the seed is run** — like the read lane, it lights up
the instant the Blooms surface their curated chips.

### Operating the seed (post-deploy)

After this ships to prod, the owner of the `system` handle runs the seed once to
set up the tree. `starterSeedPlan()` yields the calls (v1): seed `system/bloom-root`
with `["Add a pattern sequencer", "Make it a memory game"]` and `system/bloom-machine`
with `["Make it a drum machine"]` — one `api.seedStarterChips({ ownerHandle, appSlug, chips })`
each, authed as the `system` owner. Re-running is safe (idempotent: replaces, never
stacks). The leaves (`bloom-drums`, `bloom-says`) have no outgoing edges, so no seed.

**Runbook (2026-07-01): this is now one committed command.**
`pnpm --dir vibes.diy/pkg run starters:activate` (`--dry-run` to preview) derives
the seed calls AND the cross-slug `cachedSuggestionBless` writes from
`starter-graph.ts` and runs them against prod, authed via the keybag or
`VIBES_DEVICE_ID`. Run it whenever the curated graph changes. First run executed
2026-07-01 (2 seeds + 3 blesses, all ok).

**Version-pinning gotcha (found on activation, fixed):** the talk-only seed turn
was documented as "inherits the deployed version" but `getVibeChips`' inheritance
actually pinned it to the chat's nearest older turn — a long-stale release on any
re-pushed starter (CLI pushes append no chat turns), so the non-member
deployed-version restriction filtered the chips out (bloom-machine: 8 releases,
1 chat turn → no chips; bloom-root: 1 release → worked by luck). Fixed in
`get-vibe-chips.ts`: a `starter-chip-seed` turn with no own `fsId` pins to the
resolved app row's `fsId` (the served version), with a re-pushed-shape regression
test.

## Open questions (resolve in `writing-plans`)

- **OQ-A — synthetic-chat persistence. Resolved/implemented.** A talk-only
  narration turn written via the owner-gated `seedStarterChips` server path
  (`api/svc/intern/seed-starter-chips.ts` + the evento handler), idempotent under a
  deterministic seed `promptId`, re-runnable from `starterSeedPlan()` whenever the
  graph changes. The turn inherits the deployed `fsId` (no version coupling) and is
  non-producible (chat narration only). See "Operating the seed" above.
- **OQ-B — curated-edge matching key. Resolved: slug-scoped (v1, implemented).**
  Edges match on `(ownerHandle, appSlug, normalizedChipLabel)` and ignore `fsId`
  entirely, so the lookup is correct on the canonical `/vibe/<owner>/<slug>` URL
  where the route `fsId` is absent (sidesteps the Codex #2950 trap without needing
  the `fsId ?? draftFsId ?? resolvedFsId` canonicalization for the match). A
  visitor's fork has a different owner/slug, so an edge can only fire on the
  curated starter itself.

  **Update (post-redesign): the bless-map move re-coupled this to the source
  `fsId`; now decoupled again (jchris).** When cross-slug routing moved into the
  cached-suggestion bless map, the bless became content-addressed under the
  source's _resolved deployed `fsId`_ (the version-pinned `cachedSuggestionKey`).
  That meant updating a source Bloom minted a new `fsId` → orphaned the curated
  edge → forced an administrative re-bless. Fixed by keying curated cross-slug
  links on the **slug alone** via `cachedSuggestionVibeLinkKey({ ownerHandle,
appSlug, transform })` (no `fsId`, model-agnostic). `resolveCachedRead` now
  tries the version-pinned **stay** key first, then falls back to the slug-scoped
  **link** key, so a same-slug stay (a specific version's cached result, which
  _should_ break on update) stays `fsId`-pinned while a curated vibe link survives
  every source-vibe update with zero re-bless. See `api/types/cached-suggestion.ts`
  and `routes/vibe.$ownerHandle.$appSlug.tsx`.

- **OQ-C — affordance rendering (settled, jchris on Charlie's #2950 rec).**
  **Distinct glyph.** The shield stays server-authoritative and strictly
  same-namespace ("stays here"); it is never drawn for a cross-slug jump. The
  cross-slug curated jump gets its own glyph (e.g. `→`) signaling "instant ·
  curated · no-login." See §"Why 'new namespace is appropriate'".
- **OQ-D — Q3 trust boundary (settled, Charlie #2950).** The cross-slug nav target
  coming from the checked-in curated graph (client config) is acceptable **because
  it is navigation-only** — no grant/serve truth rides on it. The destination
  keeps the full server-authoritative path: public-visibility check + the same
  miss-shape / no-oracle behavior; client nav never implies shield or grant truth.

## References

- Tracking: **#2941**. On-ramp concept: #1896 (+ #2243, #2244, #2245, #2246, #2247,
  #2701); first-run panel #1836; prompt-preservation #1695.
- Infra: #2801 (read lane), #2928 (prod flip), #2929 (deferred enhancements),
  epic #2675. Infra spec: `docs/superpowers/specs/2026-06-28-cached-fork-infra-design.md`.
- Code touchpoints: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`
  (`handleEditPrompt`), `vibes.diy/api/types/chat-chips.ts` (`latestTurnChips`),
  `vibes.diy/api/types/cached-suggestion.ts` (`resolveCachedRead`),
  `vibes.diy/pkg/app/components/FeaturedVibes.tsx` (curation-config precedent),
  `vibes/bloom-root|bloom-machine|bloom-drums|bloom-says/` (the v1 content).
