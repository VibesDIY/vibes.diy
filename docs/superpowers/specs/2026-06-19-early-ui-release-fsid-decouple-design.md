# Early UI Release — Decouple "generation done" from "fsId persisted" — Design

**Date:** 2026-06-19
**Scope:** the chat stream lifecycle end-of-turn: the server prompt handler
(`vibes.diy/api/svc/public/prompt-chat-section.ts`), the client reducer
(`pkg/app/routes/chat/prompt-state.ts`), and the consumers of `block.end.fsRef`
(`useChatNavigation`, `PreviewApp` repoint, `get-code`, `MessageList`).
**Status:** Implemented (v3 design) — Charlie-approved; tests-first build landed in
this PR. Client (reducer split + nav/repoint arm-on-fsRef) and server (early
emit-only `prompt.block-end`, store-only persist last) with reducer/nav/emit-order
tests; full api suite (910) + affected app tests green.
**Revision:** v3 (2026-06-19) — incorporates `@CharlieHelps`'s review. v2
corrected v1's core mechanism (`running` flips on `prompt.block-end`, not
`block.end`); v3 fixes a second v2 error — the reconnect settle lives on
`prompt.block-end` too — and splits "flip running" (early) from "settle
connection/fsRef" (post-persist). See "Corrected mechanism" + "Reducer".
**Related:** stream-lifecycle extraction (#2015 / `2026-06-18-chat-stream-lifecycle-extraction-design.md`), nav-flash (#1972), edit-apply reliability (the streamingResolver / recovery work this builds on).

## Problem

After the last edit of a turn streams down and the iframe has already
hot-swapped the new code, the app preview stays **click-blocked** for a
noticeably long beat: the overlay is still up, the submit button still reads
"Finishing up…", and the trailing `▸ I'm done for now` suggestion chip hasn't
rendered yet. Then it all snaps into place at once.

Everything in that list is gated on a single flag — `promptState.running` —
and the long beat is the **fsId roundtrip**: the server writes every file to R2
and persists the new fsId before the UI is allowed to unblock.

## Corrected mechanism (what actually drives `running`)

There are **two distinct terminal events** with confusingly similar names:

| Event              | Wire `type`                                    | Source                                                                       | Role                                                                 |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `block.end`        | `"block.end"` (`BlockEndMsg`, call-ai-v2)      | emitted inside `handleEndMsg` **after** the R2 persist                       | carries `fsRef.fsId`; drives navigation / iframe repoint / snapshots |
| `prompt.block-end` | `"prompt.block-end"` (`PromptMsgs`, api-types) | emitted in the handler's `.finally()` **after** `prompSectionAction` returns | flips `running` off                                                  |

The reducer flips `running`:

- `true` on `isPromptBlockBegin` = `prompt.block-begin` (`prompt-state.ts:303-307`)
- `false` on `isPromptBlockEnd` = `prompt.block-end` (`prompt-state.ts:313-318`)

`block.end` (`BlockEndMsg`) is **not** matched by the reducer — it falls through
to the `default` case and is appended to `current.msgs` for the fsRef consumers.
It does **not** touch `running`.

On the server (`prompt-chat-section.ts`):

1. `prompt.block-begin` is emitted (`:2290-2304`) **before** `prompSectionAction`
   → client `running` = true.
2. `prompSectionAction` runs the whole LLM stream. When the stream ends, the
   read loop's `block.end` branch (`:1587`) calls `handleEndMsg → handlePromptContext`
   which **synchronously** `loadVersionTimeline` + `resolveCodeBlocksToFileSystem`
   - `ensureAppSlugItem` (**writes every file to R2** via `vctx.storage.ensure`,
     writes `Apps`, processes access bindings, inserts `promptContexts` +
     `chatSections`), then emits `block.end`-with-`fsRef` live (`:1324-1332`).
3. After `prompSectionAction` returns, the `.finally()` (`:2312-2327`) emits
   `prompt.block-end` → client `running` = false.

So `running` only flips false at step 3 — **after** the entire R2/DB persist.
The code already streamed down and the iframe already hot-swapped well before
step 2's persist, so the whole persist window is dead time during which the app
is rendered but unclickable.

Historically the UI waited for the canonical fsId because a bad stream
edit-apply could leave the hot-swapped DOM wrong. The streaming resolver +
recovery work has made client-side apply reliable, so blocking the UI on the
persist is no longer warranted.

## Why it's not a one-line change

To release the UI early, `prompt.block-end` must be emitted **when generation
finishes** (before the persist), not in the post-persist `.finally()`. But the
fsId genuinely does not exist until `ensureAppSlugItem` mints it, so `fsRef`
**cannot** arrive before the persist. Decoupling is therefore unavoidable:

- **"generation done"** → emit `prompt.block-end` early → `running` off → overlay
  drops, chips render, submit re-enables.
- **"fsId persisted"** → `block.end`-with-`fsRef` arrives after the persist (as it
  does today) → drives navigation + iframe repoint.

The catch: today first-paint navigation (`useChatNavigation.ts:104-123`) and the
iframe repoint (`PreviewApp.tsx:161-175`) fire on the `running` true→false
**edge** and then scan `blocks` for `block.end.fsRef`. That works today only
because `block.end`-with-`fsRef` (step 2) lands in `blocks` **before**
`prompt.block-end` (step 3) flips `running`. Moving `prompt.block-end` early
inverts that order — the edge fires before `fsRef` is in `blocks` — so these
consumers must be rewired to trigger on **`fsRef` arrival**, not the running edge.

## Decision (from review)

- **Spec + characterization tests first**, then a reviewed implementation.
- **Split the two responsibilities of `prompt.block-end`** (Charlie Q3):
  - `prompt.block-end`, emitted **early** (when generation ends, before persist)
    → flips `running` false **only**. Drop the `connection`/`inFlightStreamId`
    settle from this case.
  - `block.end`-with-`fsRef`, emitted **after persist** (live, unchanged) → the
    canonical signal that settles `connection: "live"` + clears
    `inFlightStreamId` **and** drives nav/repoint. Stream-scoped via `streamId`.
- **No new `prompt.fsref` wire event** (refines Charlie Q4). Charlie's reason for
  keeping it was "avoid dual-`block.end`" — but v2/v3 already avoid that: there is
  exactly **one** `block.end` (live, post-persist), and the early event is the
  distinct `prompt.block-end`. So `block.end`-with-`fsRef` already _is_ the
  explicit post-persist anchor Charlie wants for the settle; a separate event
  would be redundant. Consumers read `block.end.fsRef` uniformly for live + replay
  (Charlie Q2: source-agnostic value, stream-scoped side effects). **Flagging this
  one divergence from Charlie's literal Q4 for confirmation** — if an explicit
  `prompt.fsref` is still preferred for clarity, it's a small additive change.
- **Apply the same split to the `promptFS` / manual-save path** (Charlie Q5),
  phaseable, so normal + manual-save semantics match.

## Proposed design

### Server — emit `prompt.block-end` early, persist it last (as built)

`handleEndMsg` is the single terminal chokepoint (LLM, FS, and exhausted-recovery
all funnel through it). It emits `prompt.block-end` **emit-only** as its first
step — **before** `handlePromptContext` runs the R2/DB persist — so the client
flips `running` off and releases the UI immediately. The post-persist
`block.end`-with-`fsRef` still follows.

**Persistence constraint discovered during impl:** `prompt.block-end` must remain
**persisted as the terminal block** for replay (`seed-chat-section` asserts the
last replayed block is `prompt.block-end`; the reopen flow waits for it). The
early emit is `emit-only` (not persisted), so the outer `.finally()` still
persists it — but **store-only** (no duplicate live emit) once the early emit
fired. This required a new `appendBlockEvent` `emitMode: "store-only"` and a
`terminal: { promptBlockEndEmitted }` flag threaded from the handler's outer
scope through `handleLlmResponse`/`handleFSPrompt` into `handleEndMsg`. Net wire
result: **exactly one** live `prompt.block-end` (early), and the persisted record
is unchanged in shape/order.

Terminal paths covered consistently (all reach `handleEndMsg`):

- natural end (read-loop `block.end` branch, `:1587`)
- recovery-exhausted synthetic `block.end` (`:1636-1666`)
- `promptFS` / manual-save terminal (Charlie Q5)

Paths that never reach `handleEndMsg` keep today's behavior — the `.finally()`
emits `prompt.block-end` `store` (store+emit) as the safety net:

- the image/Prodia path
- an empty stream (no `block.end` terminal) — preserves `emptySectorStream`
- the error path (`catch` → `prompt.error`, `:2250-2267`): the reducer already
  flips `running` false on `prompt.error` (`:322`), so release is already early;
  the finally's `prompt.block-end` persists the terminal as before.

### Client — reducer (the split)

Today the `isPromptBlockEnd` case (`prompt-state.ts:313-320`) does **both** jobs:
flips `running` false **and** settles `connection: "live"` + clears
`inFlightStreamId` when `block.streamId === inFlightStreamId`. Moving
`prompt.block-end` early would move the settle early too — so a disconnect in the
**gap** between early `prompt.block-end` and the post-persist `block.end` would
flip `running` off (watchdog stops) yet never settle/repoint, orphaning the
canonical fsId until a reload (Charlie Q3). Split it:

- **`prompt.block-end`** (now early): `running: false` **only**. Remove the
  `connection`/`inFlightStreamId` settle.
- **`block.end`** (`BlockEndMsg`): add an explicit reducer case (it currently
  falls to `default`). When `fsRef` is present and `streamId === inFlightStreamId`,
  settle `connection: "live"` + clear `inFlightStreamId`. It must still append to
  `current.msgs` exactly as the default case does, so the fsRef consumers keep
  finding it in `blocks`.

Net effect on the reconnect gap: if the stream drops after the early
`prompt.block-end` but before `block.end`, `inFlightStreamId` is still set, so the
reconnect loop can still re-open and the replayed `block.end`-with-`fsRef` (or the
in-flight turn's) settles + navigates on arrival. `running` being already false is
acceptable — generation _is_ done; only persistence is outstanding.

### Client — the fsRef consumers (rewire off the running edge)

Introduce one helper — `latestFsRef(blocks)` — returning the newest
`block.end.fsRef`. Route the two **running-edge-gated** consumers through it,
triggering on a _new_ fsRef appearing in `blocks` rather than the `running` edge.
Per Charlie Q1/Q2 the value is source-agnostic (live vs replay) but the side
effects stay **stream-scoped** — match the in-flight `streamId` and dedupe by
fsId so a replayed historical turn can't trigger a navigation:

- `useChatNavigation` first-paint (`:104-123`): fire when `latestFsRef` changes
  to a value `!== lastNavigatedFsIdRef.current` (still seeded from the URL fsId,
  so reload/historical chats don't re-navigate — the #1972 guard). See Q1.
- `PreviewApp` end-of-stream repoint (`:161-175`): fire on the same fsRef-change
  signal instead of the `streamingRef` running edge.

`useChatNavigation` post-save (`:69-84`), `get-code` snapshots (`:158-160`), and
`MessageList` version pill (`:593-610`) already key off `block.end.fsRef`
directly (not the running edge) and need no change.

## Invariants that MUST be preserved (test targets)

1. `running` flips `false` as soon as generation ends — **before** the R2/DB
   persist (not after) — and `prompt.block-end` no longer settles
   `connection`/`inFlightStreamId`.
2. `connection: "live"` + `inFlightStreamId` cleared happens on the post-persist
   `block.end`-with-`fsRef` for the matching `streamId` (the canonical anchor),
   not on the early `prompt.block-end`.
3. The persisted `chatSections` `block.end` still carries `fsRef`; reload/replay
   reconstruction is unchanged (single `block.end`-with-`fsRef`, no new event).
4. First-paint navigation still lands on the canonical fsId and still does **not**
   yank a user off a historical fsId they intentionally opened (#1972).
5. Post-save navigation still matches by promptId/streamId.
6. The iframe repoint for existing-chat iterations still fires (now on fsRef
   arrival).
7. `▸ I'm done for now` and option chips render as soon as `running` is false
   (the `option-lines` streaming guard already does this at `streaming: false`).
8. `prompt.block-end` is emitted exactly once per turn (no double-emit from the
   early path + the finally).
9. **Reconnect-gap:** a disconnect after the early `prompt.block-end` but before
   `block.end` still re-opens (inFlightStreamId is still set) and settles +
   navigates when the canonical `block.end`-with-`fsRef` arrives via replay.

## Old-client / deploy compatibility (Codex P2)

This is a **behavior change for already-open clients during a server-ahead
deploy**, and there is no purely additive wire shape that avoids it:

- `block.end`-with-`fsRef` is **unchanged**, so the fsRef itself still reaches
  every client.
- But old clients' first-paint nav + iframe repoint are gated on the `running`
  edge, which (with the early `prompt.block-end`) now fires **before**
  `block.end.fsRef` is in `blocks`. So a **stale tab** talking to a new server
  would finish the turn without navigating/repointing to the persisted fsId
  until a reload or a reconnect replay.

Impact is bounded: it only affects tabs opened _before_ the deploy (new page
loads get the new client, served by the same deploy), it self-heals on reload,
and existing-chat iterations already carry an fsId in the URL — the main
casualty is brand-new-chat first paint in a stale tab. Options:

- **(a) Accept + document** the transient skew (recommended for the web app,
  where client and server ship together and the window is short).
- **(b) Capability-gate** the early emit on a client-advertised version so old
  clients keep the late `prompt.block-end` until they reload.
- **(c) Belt-and-suspenders:** keep navigation reacting to _both_ the running
  edge and fsRef arrival on the new client, and accept (a) for old clients.

Recommend (a) + (c). Call this out explicitly in the implementation PR.

## Test strategy (tests land first)

The set Charlie asked to lock before implementation:

- **Event-semantic test for `running` release:** `prompt.block-end` flips
  `running` false; `block.end` (`BlockEndMsg`) does **not**. And the inverse:
  `prompt.block-end` no longer settles `connection`/`inFlightStreamId`; the
  post-persist `block.end`-with-`fsRef` (matching `streamId`) does.
- **Emit-order test (server):** the early completion event (`prompt.block-end`)
  is emitted **before** the persist (`handlePromptContext`) resolves;
  `block.end`-with-`fsRef` after; exactly once each; on the natural /
  exhausted-recovery / error paths; persisted `block.end.fsRef` still present.
- **Reconnect-gap test:** disconnect after the early completion event but before
  `fsRef` arrives → reconnect re-opens and the replayed/late
  `block.end`-with-`fsRef` settles + navigates (invariant 9).
- **Nav-guard regression (#1972):** historical URLs don't re-navigate; first-paint
  fires on fsRef arrival + streamId match + fsId dedupe. Mutation-test the guard
  (break it → red).
- **Dual-source fsRef consumer tests:** `PreviewApp` repoint, `get-code`
  snapshot, `MessageList` pill resolve from `block.end.fsRef` for both live and
  replay timing.
- `option-lines` / `OptionButtons`: pin that the trailing marker renders at
  `streaming: false` (already covered; add an explicit assertion).

Gate with `pnpm check` and `pnpm run rules-bag:constructors`.

## Questions for review

Resolved with `@CharlieHelps` (2026-06-19):

1. **Q1 First-paint nav trigger → resolved.** Drop the `running`-edge trigger;
   navigate on fsRef arrival for the active stream, with `streamId` matching +
   fsId dedupe so the #1972 historical-URL protections stay intact.
2. **Q2 Reconnect/replay → resolved.** fsRef _value_ is source-agnostic
   (`block.end.fsRef` live or replay); nav/repoint _side effects_ stay
   stream-scoped (match in-flight `streamId`).
3. **Q3 Connection settle → resolved.** Settle `connection`/`inFlightStreamId` on
   the canonical post-persist `block.end`-with-`fsRef`, **not** on the early
   `prompt.block-end`, so a disconnect in the gap can't orphan repoint/nav.
4. **Q4 Dedicated "persist done" event → resolved (with one divergence to
   confirm).** Charlie recommended keeping an additive `prompt.fsref`; v3 instead
   reuses the single post-persist `block.end`-with-`fsRef` as the anchor, since
   v2/v3 already avoid the dual-`block.end` that motivated `prompt.fsref`. Net
   behavior is identical; flagging for a thumbs-up that reuse is acceptable vs an
   explicit event.
5. **Q5 `promptFS` / manual-save → resolved.** Apply the same split there too
   (phaseable) for consistent semantics.

Still open:

6. **Old-client policy.** Accept the transient stale-tab skew (a), or
   capability-gate the early emit (b)? (See compatibility section — leaning (a)+(c).)

## Risk & rollout

- **Medium-high** behavior-change risk: same delicate end-of-turn surface as
  #1972/#2015, and it intentionally changes _when_ `running` flips. Mitigation:
  tests-first pinning invariants 1–7; the persisted record is untouched so
  reload/historical paths can't regress.
- **Not** purely additive (unlike v1's mistaken framing) — there is a real
  old-client window during a server-ahead deploy (see compatibility section).
- Land as: (a) client nav/repoint rewired onto `block.end.fsRef` arrival with
  tests (safe on its own — still works with the current late `prompt.block-end`),
  then (b) the server early-emit, on separate commits so the suite proves each
  step.
