# Early UI Release — Decouple "generation done" from "fsId persisted" — Design

**Date:** 2026-06-19
**Scope:** the chat stream lifecycle end-of-turn: the server block.end handling
(`vibes.diy/api/svc/public/prompt-chat-section.ts`), the section-event wire
types (`vibes.diy/api/types/prompt.ts`), the client reducer
(`pkg/app/routes/chat/prompt-state.ts`), and the four client consumers of
`block.end.fsRef` (`useChatNavigation`, `PreviewApp`, `get-code`, `MessageList`).
**Status:** Proposed — spec-first, awaiting review before tests + implementation.
**Related:** stream-lifecycle extraction (#2015 / `2026-06-18-chat-stream-lifecycle-extraction-design.md`), nav-flash (#1972), edit-apply reliability (the streamingResolver / recovery work this builds on).

## Problem

After the last edit of a turn streams down and the iframe has already
hot-swapped the new code, the app preview stays **click-blocked** for a
noticeably long beat: the overlay is still up, the submit button still reads
"Finishing up…", and the trailing `▸ I'm done for now` suggestion chip hasn't
rendered yet. Then it all snaps into place at once.

Everything in that list is gated on a single flag — `promptState.running` —
and `running` flips `false` only when the client receives `block.end`
(`prompt-state.ts:313`).

`block.end` is the **fsId roundtrip**. On the server, when the LLM stream ends
the read loop calls `handleEndMsg → handlePromptContext`
(`prompt-chat-section.ts:1587-1592`, `:705-809`) which — **synchronously,
before `block.end` is forwarded to the client** — does:

1. `loadVersionTimeline` + `resolveCodeBlocksToFileSystem`
2. `ensureAppSlugItem`: **writes every file to R2 storage** (`vctx.storage.ensure`),
   writes the `Apps` row, processes access bindings, posts `evt-new-fs-id`,
   and on first turns can run a metadata LLM call
3. inserts `promptContexts` + chunked `chatSections`

The code already streamed down live (each intermediate event is
`appendBlockEvent(..., emitMode: "emit-only")`) and the iframe already
hot-swapped, so this entire persist window is dead time during which the app is
rendered but unclickable.

Historically the UI waited for the server's canonical fsId because a bad
stream edit-apply could leave the hot-swapped DOM wrong, and the server's
resolved filesystem was the source of truth. The streaming resolver + recovery
work has made client-side apply reliable, so blocking the UI on the persist is
no longer warranted.

## Why it can't be a one-line client change

`block.end` does double duty. Beyond flipping `running`, its `fsRef.fsId`
drives four client behaviors:

| Consumer | Location | Uses `fsRef` for |
|---|---|---|
| First-paint navigation | `useChatNavigation.ts:104-123` | navigate URL to the canonical fsId on the `running` true→false edge |
| Post-save navigation | `useChatNavigation.ts:69-84` | navigate after a manual code save matching its promptId |
| Iframe repoint | `PreviewApp.tsx:161-175` | repoint `pinnedFsId` for existing-chat iterations |
| Code snapshot | `get-code.ts:158-160` | key per-fsId source snapshots |
| Version pill | `MessageList.tsx:593-610` | the fsId-click affordance per turn |

So releasing the UI early means **decoupling "generation done" (drop the
overlay, render chips, re-enable submit) from "fsId persisted" (navigate +
repoint)**. The UI unblocks on the first signal; the fsId-dependent work fires
on the second, a beat later.

## Decision (from review)

- **New wire-additive event after an early bare `block.end`.** The server
  forwards `block.end` to the client the instant the LLM stream ends — **without
  `fsRef`** — which flips `running` off and releases the UI. It then persists
  (mint fsId) and emits a new `prompt.fsref` event carrying the `FileSystemRef`.
  Old clients ignore the unknown event; no double-`block.end` ambiguity.
- **Spec + characterization tests first**, then a reviewed implementation.

## Key invariant: the *persisted* block.end keeps its fsRef

`handlePromptContext` persists the buffered turn into `chatSections` by pushing
each `collectedMsgs` entry — including the `block.end` `value` object — into
`sections`, then mutates `value.fsRef = fsRef.toValue()` (`:772`) **before** the
DB insert. Because it's the same object reference, the persisted `block.end`
carries `fsRef`.

Reload/replay reconstruction therefore still delivers a single
`block.end`-with-`fsRef` and **no** `prompt.fsref`. The live path delivers a
bare `block.end` followed by `prompt.fsref`. So every client consumer must
accept `fsRef` from **either** source:

- **live:** bare `block.end` (→ `running` off) then `prompt.fsref` (→ nav/repoint)
- **reload:** `block.end` with `fsRef` (→ `running` off *and* the fsRef source)

This keeps historical chats working unchanged and is the load-bearing reason
the persisted record is not touched.

## Proposed design

### Wire type — `prompt.fsref` (additive)

Add to `vibes.diy/api/types/prompt.ts`, included in the `PromptMsgs` union so it
rides the existing section stream and the reducer narrows on `msg.type` like any
other event:

```ts
export const PromptFsRef = type({
  type: "'prompt.fsref'",
  fsRef: FileSystemRef,        // from @vibes.diy/call-ai-v2 (block-stream)
}).and(PromptBase);            // { streamId, chatId, seq, timestamp }
export type PromptFsRef = typeof PromptFsRef.infer;
export function isPromptFsRef(msg: unknown): msg is PromptFsRef { ... }
```

`streamId` lets consumers match the fsRef to the turn (mirrors how the post-save
effect matches `block.end.streamId === promptId`).

### Server — emit order in the read loop

`prompt-chat-section.ts` block.end branch (`:1587`) becomes:

1. `appendBlockEvent({ evt: <bare block.end, no fsRef>, emitMode: "emit-only" })`
   — fires immediately, flips the client's `running` off.
2. `handleEndMsg(...)` runs `handlePromptContext` exactly as today (persists the
   `block.end`-with-`fsRef` into `chatSections`, mints the fsId) **but no longer
   re-emits `block.end` live** (remove the live emit at `:1324-1332`; keep the
   persistence).
3. `appendBlockEvent({ evt: { type: "prompt.fsref", fsRef, streamId: promptId, ... }, emitMode: "emit-only" })`
   — fires after persist, carrying the canonical fsId.

The exhausted-recovery synthetic `block.end` (`:1636`) follows the same shape: a
bare live block.end is acceptable (no fsRef exists in that branch anyway).

### Client — reducer

`prompt-state.ts`:
- `isPromptBlockEnd` already flips `running` false regardless of `fsRef`; bare
  block.end works unchanged.
- Add an `isPromptFsRef` case that appends the event to the current block (the
  default-case append path; `current` is still the last block since block.end
  does not clear it) so the navigation/snapshot scanners can find it. It does
  **not** touch `running` (already false). It should also clear
  `inFlightStreamId`/settle `connection` to `live` for the matching streamId —
  i.e. move the `isInFlight` connection-settle that `block.end` does today onto
  whichever event is canonical; **open question Q3**.

### Client — the four fsRef consumers

Introduce one helper — `fsRefForBlock(block)` / `latestFsRef(blocks)` — that
returns the `FileSystemRef` from a `prompt.fsref` event **or** a
`block.end.fsRef`, and route all four consumers through it:

- `useChatNavigation` first-paint + post-save: scan for `prompt.fsref` (live) or
  `block.end.fsRef` (reload). First-paint's `running`-edge gate is the subtle
  one — see Q1.
- `PreviewApp` end-of-stream repoint: same.
- `get-code` snapshot keying.
- `MessageList` version-pill `lastFsRef`.

## Invariants that MUST be preserved (test targets)

1. `running` flips `false` on a bare `block.end` (no `fsRef`).
2. The **persisted** `block.end` still carries `fsRef`; reload reconstruction is
   unchanged (single block.end-with-fsRef, no prompt.fsref).
3. First-paint navigation still lands on the canonical fsId and still does **not**
   yank a user off a historical fsId they intentionally opened (the #1972 guard).
4. Post-save navigation still matches by promptId/streamId.
5. The iframe repoint for existing-chat iterations still fires (now on
   prompt.fsref).
6. `▸ I'm done for now` and option chips render as soon as `running` is false
   (the `option-lines` streaming guard already does this once `streaming: false`).
7. No double-`block.end` on the live wire; old clients (unknown `prompt.fsref`)
   are unaffected.

## Test strategy (tests land first)

- `option-lines.test.ts` / `OptionButtons.test.tsx`: already cover the streaming
  guard; add an assertion pinning that the trailing marker renders at
  `streaming: false`.
- `prompt-state` reducer unit tests: bare block.end flips running; prompt.fsref
  appends without re-flipping; connection/inFlightStreamId settle on the
  canonical event (per Q3).
- `ChatNavigation.test.tsx`: first-paint + post-save fire on `prompt.fsref`
  (live) and on `block.end.fsRef` (reload); the running-edge / historical guard
  still holds. Mutation-test the guard (break it → red) per the discipline used
  in the extraction PR.
- A server-side test (mirroring `append-turn-to-chat.test.ts` / the
  prompt-chat-section tests) asserting emit order: bare block.end is emitted
  before the persist call resolves, prompt.fsref after, and the persisted
  chatSections block.end retains `fsRef`.
- `get-code` / `PreviewApp`: snapshot + repoint resolve from either source.

Gate with `pnpm check` (touches tested paths + the wire types) and
`pnpm run rules-bag:constructors`.

## Questions for review

1. **First-paint nav gate.** Today it fires on the `running` true→false edge and
   then scans for `block.end.fsRef`. With early release, `running` flips on the
   bare block.end *before* `prompt.fsref` arrives, so the edge no longer
   coincides with fsRef availability. Preferred: drop the running-edge trigger
   for the live path and fire when a *new* `fsRef` appears (dedupe via
   `lastNavigatedFsIdRef`, still seeded from the URL fsId so reload doesn't
   re-navigate). Confirm this preserves the #1972 historical-fsId guard, or do
   we keep the edge and additionally react to prompt.fsref?
2. **Reconnect/replay.** On reconnect, `replayReset` clears blocks then replays.
   Historical turns replay `block.end`-with-`fsRef` (no prompt.fsref). Does any
   consumer need to distinguish "live fsRef for the in-flight turn" from
   "replayed fsRef of an older turn"? The post-save effect already matches by
   promptId; first-paint dedupes by fsId. Believed safe — confirm.
3. **Where the connection/inFlightStreamId settle lives.** `block.end` currently
   settles `connection: "live"` + clears `inFlightStreamId` when it's the
   in-flight turn (`prompt-state.ts:315-320`). With block.end now bare and early,
   should that settle stay on block.end (turn is generation-complete) or move to
   prompt.fsref (turn is fully persisted)? Leaning: keep it on block.end —
   "running is over" is the right moment to stop the reconnect watchdog.
4. **Single event vs. fold fsRef onto a kept block.end.** We chose a new event
   over re-emitting block.end. Confirm we do **not** also want to stop persisting
   fsRef on the stored block.end (we must keep it — invariant 2).
5. **`promptFS` / manual-save path.** `handleFSPrompt` builds its own block.end.
   Should it adopt the same bare-block.end + prompt.fsref split, or is the
   manual-save latency tolerable (it skips the LLM, so the persist is the whole
   turn)? Leaning: apply the split there too for consistency, since the post-save
   nav already keys off fsRef.

## Risk & rollout

- **Medium-high** behavior-change risk: this is the same delicate end-of-turn
  surface as #1972/#2015, and it intentionally changes *when* `running` flips.
  Mitigation: tests-first pinning invariants 1–7; the persisted record is
  untouched so reload/historical paths can't regress; the new event is additive.
- Wire-additive only — no migration. A new client talking to an old server still
  gets the old (late, fsRef-bearing) block.end and behaves as today.
- Land as: (a) wire type + reducer + consumer helper with tests, (b) server emit
  reorder, on separate commits so the suite proves each step.
