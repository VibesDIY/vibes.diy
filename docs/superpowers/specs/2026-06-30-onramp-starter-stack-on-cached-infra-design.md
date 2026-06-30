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

The **client spine is built**: the curated graph (`routes/starter-graph.ts` +
unit tests), the `handleEditPrompt` cross-slug pre-check (curated-edge-wins,
slug-scoped, no producer capture), the distinct `→` jump glyph in
`UnifiedVibeCard` (never the shield), and the public `/start` route. It's a
**correct no-op until the seed chats land** — like the read lane, it lights up the
instant the Blooms surface their curated chips. **Remaining: OQ-A** (synthetic seed
chats — the D1 write path so `getVibeChips` returns the curated chips for the four
Blooms; non-producible by construction since seeding writes only chat narration,
never a `cachedSuggestions` produce entry).

## Open questions (resolve in `writing-plans`)

- **OQ-A — synthetic-chat persistence.** Where/how is the seed turn written so
  `getVibeChips` returns it for the deployed `fsId`? (A CLI/script that posts a
  curated turn into the vibe's chat store, vs a build-time fixture, vs a small
  server seed path.) Must be idempotent and re-runnable when the graph changes.
- **OQ-B — curated-edge matching key. Resolved: slug-scoped (v1, implemented).**
  Edges match on `(ownerHandle, appSlug, normalizedChipLabel)` and ignore `fsId`
  entirely, so the lookup is correct on the canonical `/vibe/<owner>/<slug>` URL
  where the route `fsId` is absent (sidesteps the Codex #2950 trap without needing
  the `fsId ?? draftFsId ?? resolvedFsId` canonicalization for the match). A
  visitor's fork has a different owner/slug, so an edge can only fire on the
  curated starter itself. A future per-`fsId` keying (to re-aim/drop an edge on a
  new starter version) remains an easy extension. See `routes/starter-graph.ts`.
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
