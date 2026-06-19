# Early UI Release — Decouple "generation done" from "fsId persisted" — Design

**Date:** 2026-06-19
**Scope:** the chat stream lifecycle end-of-turn: the server prompt handler
(`vibes.diy/api/svc/public/prompt-chat-section.ts`), the client reducer
(`pkg/app/routes/chat/prompt-state.ts`), and the consumers of `block.end.fsRef`
(`useChatNavigation`, `PreviewApp` repoint, `get-code`, `MessageList`).
**Status:** Proposed — spec-first, awaiting review before tests + implementation.
**Revision:** v2 (2026-06-19) — corrects v1's mechanism after Codex review. v1
wrongly claimed `running` flips on `block.end`; it actually flips on the
separate `prompt.block-end` event. See "Corrected mechanism" below.
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

| Event | Wire `type` | Source | Role |
|---|---|---|---|
| `block.end` | `"block.end"` (`BlockEndMsg`, call-ai-v2) | emitted inside `handleEndMsg` **after** the R2 persist | carries `fsRef.fsId`; drives navigation / iframe repoint / snapshots |
| `prompt.block-end` | `"prompt.block-end"` (`PromptMsgs`, api-types) | emitted in the handler's `.finally()` **after** `prompSectionAction` returns | flips `running` off |

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
   + `ensureAppSlugItem` (**writes every file to R2** via `vctx.storage.ensure`,
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
- v1's "new `prompt.fsref` event after a bare `block.end`" is **dropped**: it
  targeted the wrong event and is unnecessary. `block.end` already carries
  `fsRef` and already arrives right after the persist. The fix is (a) emit
  `prompt.block-end` early and (b) rewire the two running-edge consumers onto
  `block.end.fsRef` arrival. (A dedicated "persist done" event remains a possible
  alternative — see Q4 — but is not the primary plan.)

## Proposed design

### Server — emit `prompt.block-end` when generation ends

Emit `prompt.block-end` from inside `prompSectionAction` the moment the terminal
`block.end` is observed in the read loop (`:1587`) — i.e. **before**
`handleEndMsg` runs the persist — and make the outer `.finally()` idempotent so
it does not double-emit (guard on a "already emitted" flag, or move the
`build-complete` notify alongside the early emit). The persist + the live
`block.end`-with-`fsRef` then run after, exactly as today.

Cover all terminal paths consistently:
- natural end (read-loop `block.end` branch, `:1587`)
- recovery-exhausted synthetic `block.end` (`:1636-1666`)
- error path (`catch` → `prompt.error`, `:2250-2267`): keep emitting
  `prompt.block-end` in the finally (running must release on error too). The
  reducer already flips `running` false on `prompt.error` (`:322`), so the error
  path is already early; only the success path needs the move.

### Client — reducer

No new event. `prompt.block-end` continues to flip `running` false; it just
arrives earlier. The reducer's `block.end` handling (default-case append) is
unchanged.

**Open Q3:** today `prompt.block-end` does not settle `connection`/`inFlightStreamId`
— that settle lives on the `block.end` handling path. Confirm the reconnect
watchdog still behaves when `running` flips before the persist completes (the
watchdog keys on `running`; releasing early stops it earlier, which is fine since
generation is done, but verify the ack→persist window can't strand a reconnect).

### Client — the fsRef consumers (rewire off the running edge)

Introduce one helper — `latestFsRef(blocks)` — returning the newest
`block.end.fsRef`. Route the two **running-edge-gated** consumers through it,
triggering on a *new* fsRef appearing in `blocks` rather than the `running` edge:

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
   persist (not after).
2. The persisted `chatSections` `block.end` still carries `fsRef`; reload/replay
   reconstruction is unchanged (single `block.end`-with-`fsRef`, no new event).
3. First-paint navigation still lands on the canonical fsId and still does **not**
   yank a user off a historical fsId they intentionally opened (#1972).
4. Post-save navigation still matches by promptId/streamId.
5. The iframe repoint for existing-chat iterations still fires (now on fsRef
   arrival).
6. `▸ I'm done for now` and option chips render as soon as `running` is false
   (the `option-lines` streaming guard already does this at `streaming: false`).
7. `prompt.block-end` is emitted exactly once per turn (no double-emit from the
   early path + the finally).

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

Impact is bounded: it only affects tabs opened *before* the deploy (new page
loads get the new client, served by the same deploy), it self-heals on reload,
and existing-chat iterations already carry an fsId in the URL — the main
casualty is brand-new-chat first paint in a stale tab. Options:

- **(a) Accept + document** the transient skew (recommended for the web app,
  where client and server ship together and the window is short). 
- **(b) Capability-gate** the early emit on a client-advertised version so old
  clients keep the late `prompt.block-end` until they reload.
- **(c) Belt-and-suspenders:** keep navigation reacting to *both* the running
  edge and fsRef arrival on the new client, and accept (a) for old clients.

Recommend (a) + (c). Call this out explicitly in the implementation PR.

## Test strategy (tests land first)

- `option-lines` / `OptionButtons`: pin that the trailing marker renders at
  `streaming: false` (already covered; add an explicit assertion).
- `prompt-state` reducer: `running` flips on `prompt.block-end`; `block.end`
  (BlockEndMsg) does not; ordering of a `block.end` then `prompt.block-end`
  leaves `running` false with `fsRef` in `blocks`.
- `ChatNavigation.test.tsx`: first-paint fires on `block.end.fsRef` arrival (new
  ordering: fsRef after the running edge) and still dedupes against the URL fsId
  (#1972 guard); mutation-test the guard (break it → red).
- `PreviewApp` / `get-code`: repoint + snapshot resolve from `block.end.fsRef`
  regardless of running timing.
- Server: a `prompt-chat-section` test asserting `prompt.block-end` is emitted
  **before** the persist (`handlePromptContext`) resolves, exactly once, on the
  natural / exhausted-recovery / error paths; and that the persisted `block.end`
  retains `fsRef`.

Gate with `pnpm check` and `pnpm run rules-bag:constructors`.

## Questions for review

1. **First-paint nav trigger.** Confirm replacing the `running`-edge trigger with
   a "new fsRef in blocks" trigger (dedup via `lastNavigatedFsIdRef` seeded from
   the URL) preserves the #1972 historical-fsId guard — or do we keep the edge
   *and* additionally react to fsRef arrival (option (c) above)?
2. **Reconnect/replay.** Historical turns replay `block.end`-with-`fsRef`. The
   post-save effect matches by promptId; first-paint dedupes by fsId. Believed
   safe — confirm no consumer needs to distinguish the in-flight turn's fsRef
   from a replayed older turn's.
3. **Connection settle timing.** With `running` flipping before the persist, does
   the reconnect watchdog / `inFlightStreamId` settle need any adjustment, or is
   "generation done" the right moment to stop the watchdog regardless of persist?
4. **Dedicated "persist done" event?** We dropped the v1 `prompt.fsref`. Do we
   want an explicit persist-complete signal anyway (clearer than overloading
   `block.end.fsRef` arrival), or is keying off `block.end.fsRef` arrival fine?
5. **Old-client policy.** Accept the transient stale-tab skew (a), or
   capability-gate the early emit (b)? (See compatibility section.)
6. **`promptFS` / manual-save path.** `handleFSPrompt` builds its own block.end;
   the manual-save turn skips the LLM so the persist is essentially the whole
   turn. Apply the same early `prompt.block-end` there, or leave as-is?

## Risk & rollout

- **Medium-high** behavior-change risk: same delicate end-of-turn surface as
  #1972/#2015, and it intentionally changes *when* `running` flips. Mitigation:
  tests-first pinning invariants 1–7; the persisted record is untouched so
  reload/historical paths can't regress.
- **Not** purely additive (unlike v1's mistaken framing) — there is a real
  old-client window during a server-ahead deploy (see compatibility section).
- Land as: (a) client nav/repoint rewired onto `block.end.fsRef` arrival with
  tests (safe on its own — still works with the current late `prompt.block-end`),
  then (b) the server early-emit, on separate commits so the suite proves each
  step.
