# Retire /chat — Phase 2: Monaco edit-and-save on the /vibe Code tab (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans. Steps use checkbox (`- [ ]`) tracking.
>
> **STATUS: ready — @CharlieHelps signed off on both load-bearing decisions on #2866 (re-pin via `setDraftFsId`, resolved from canonical `block.end(...fsRef)`; manual full-file saves reload/re-pin, `pushSource` stays for streamed codegen). Two guardrails folded in (see §Architecture). Codex review folded in: reducer states are now `idle | queued | saving | rebuilt | error` (matches the `queued → saving → rebuilt` acceptance sequence), and the first manual save **queues until the lazy chat handle exists** rather than assuming `activate()` opens it synchronously. Implementation may start off #2860 (the Phase 1 branch).**

**Goal:** Make the `/vibe` editor surface's **Code** tab editable — port the Monaco edit-and-save loop from `/chat` so an owner can hand-edit source and have the running app update, **without leaving `/vibe`** (no navigation; the URL stays the running vibe, per the spec's Q2).

**Architecture:** A Monaco edit moves `EditorState` → `"edit"` (carries the edited `buffer`/`filePath`/`lang`). On save we call `chat.promptFS({ update: [{ type: "code-block", filename, lang, content: buffer }] })` on the vibe's lazy codegen chat session (the same handle `useInVibeGeneration` already opens), which returns a `promptId`; the new fsId arrives async at the save stream's `block.end`. **Instead of `useChatNavigation.navigateToFsId` (which `/chat` uses to jump to the new fsId), we re-pin `setDraftFsId(newFsId)`** — reusing the #2772 owner-draft mechanism Phase 1 already wires via `effectiveFsId` — so the iframe reloads to the saved version and the URL never changes. A hand-edited full-file save **reloads** the iframe (via the re-pin) rather than `pushSource`-hot-swapping (that's for streamed codegen blocks).

The new fsId is **resolved from the canonical post-persist `block.end(...fsRef)`** — the hook already exposes exactly this as `persistedFsRef` (`useInVibeGeneration.ts:44,238`: "the vibe-scoped fsRef carried by the latest canonical POST-PERSIST `block.end`"), so the save path watches `persistedFsRef` change after submitting `promptFS` rather than re-implementing block.end tracking. (This collapses the old risk #2.)

**Charlie's guardrails (#2866 sign-off — load-bearing):**
1. **Target unversioned owner `/vibe` only.** The re-pin works because resolution there is `fsId ?? draftFsId` (a versioned `/vibe/:fsId` view has `fsId` set and won't draft-pin). Save/Edit affordance is owner-only and only on the unversioned view; do not change versioned-view resolution.
2. **Never `pushSource` + re-pin on the same manual-save event.** A manual full-file save re-pins (reload) and must NOT also hot-swap via `pushSource` — `pushSource` is reserved for streamed codegen updates. Keep the two channels mutually exclusive per event.

**Tech Stack:** same as Phase 1. **Spec:** `docs/superpowers/specs/2026-06-29-retire-chat-fold-into-vibe-design.md` (Phase 2 row). **Builds on:** Phase 1 (#2860 — `VibeEditorPanel`, `CodeViewPanel`, the route's `editorPromptState`/`useChatHydration`/`effectiveFsId`/`draftFsId`). **Non-goals:** no `/chat` teardown / 301 (Phase 3); no chat-history replay (#2677).

**Acceptance (Charlie's Phase 2 block, #2847):** save flow asserts `queued → saving → rebuilt`; correct UI per state + failure handling; rebuild hot-swaps/reloads within an agreed timing threshold; a failed save keeps in-progress work recoverable/visible (no silent loss); these pass **before** Phase 3 teardown.

**Verification:** `pnpm build`, `pnpm lint`, `pnpm test <file>` (vitest), Storybook build — as Phase 1.

---

## Reference: the existing save loop (`/chat`)

- `EditorState` (`types/code-editor.ts`): `idle | start-generating | more-lines | to-edit | edit`. A user edit produces `"edit"` with `{ buffer, hash, filePath, lang, toEdit }`.
- `CodeEditor` (`components/ResultPreview/CodeEditor.tsx`) fires `onCode(editorState)`; an explicit save fires `onCodeSave`.
- Save handler (`routes/chat/chat.$ownerHandle.$appSlug.tsx:505-538`): `chat.promptFS({ update: [{ type:"code-block", filename, lang, content: editorState.buffer }], remove: [] })` → `{ promptId }`; on ok → `onSaveQueued(promptId)` + `dispatch setInFlightStreamId` (waits for the matching `block.end`); on err → `toast` + restore the unsaved `editorState`.
- `useChatNavigation` (`hooks/useChatNavigation.ts`) owns `onSaveQueued` + `navigateToFsId`: when the queued save's `block.end` lands, it resolves the new fsId and **navigates**.
- `useChatSession` exposes `{ chat: LLMChat | null }`; `useInVibeGeneration` wraps it but today only exposes `sendPrompt` (not `chat`/`promptFS`).

---

## Task 1: expose `saveCode` + save-completion → draft re-pin from `useInVibeGeneration`

The hook already owns the lazy codegen chat handle. Add a save path that persists an edited buffer and reports the new fsId so the route can re-pin (not navigate).

**Files:** `vibes.diy/pkg/app/hooks/useInVibeGeneration.ts` (modify); new pure helper `vibes.diy/pkg/app/hooks/save-state.ts` + test `vibes.diy/pkg/test/save-state.test.ts`.

- [ ] **Step 1 (TDD):** a pure `save-state.ts` state machine matching the acceptance sequence `queued → saving → rebuilt`:
  - `type SaveState = "idle" | "queued" | "saving" | "rebuilt" | "error"` and a transition fn `nextSaveState(cur, event)` for events `request | submitted | settled(fsRef) | failed | reset`.
  - Transitions: `idle --request--> queued` (save intent recorded; may be waiting on the lazy chat to open or on an in-flight generation to clear); `queued --submitted--> saving` (`promptFS` accepted, `promptId` in hand, awaiting the canonical `block.end`); `saving --settled--> rebuilt` (post-persist `block.end(...fsRef)` arrived → re-pin); `queued|saving --failed--> error`; `error --request--> queued` (retry); `rebuilt|error --reset--> idle`.
  - Unit-test every transition incl. retry (`error→queued→saving→rebuilt`) and that illegal events are no-ops. (Keeps the testable logic out of the React hook, per repo convention.) `isSaving = state === "queued" || state === "saving"`.
- [ ] **Step 2:** add to `useInVibeGeneration`:
  - `saveCode(args: { buffer: string; filePath: string; lang: string }): void` — dispatch `request` (save-state `queued`), `activate()`, and **stash the pending save in a ref**. Do NOT assume `chat`/`promptFS` is available synchronously: `activate()` only flips `active` state; `useChatSession` opens the `LLMChat` in a later effect, so `chat` is still null in the same tick (Codex #2). A flush effect watches for the chat handle becoming available (and for `!isGenerating`, per interleaving) and only then calls `chat.promptFS({ update: [{ type:"code-block", filename: normalizeCodeViewPath(filePath), lang, content: buffer }], remove: [] })`, transitions `submitted` (→ `saving`), and records the returned `promptId`. This makes the **first** manual save from the Code tab persist instead of being dropped.
  - watch `persistedFsRef` (already exposed — the canonical post-persist `block.end(...fsRef)`) for a change after `submitted` → transition `settled(fsRef)` (→ `rebuilt`) and **invoke `onSavedFsId?(fsRef.fsId)`** (the route wires this to `setDraftFsId`). On `promptFS` error or stream error → `failed` (→ `error`), surface the message, **do not** clear the pending buffer/editor.
  - expose `readonly saveState`, `readonly saveCode`, and `readonly isSaving` on the returned object.
  - **Interleaving:** reuse the in-flight guard — while `isGenerating`, a `saveCode` stays `queued` and the flush effect holds until the generation settles (no interleaved `promptFS`); `sendPrompt` is blocked while `isSaving`. (Queue, not drop — Codex #2 / risk #5.)
- [ ] **Step 3:** `pnpm build && pnpm lint`; the save-state unit test passes. Commit.

> **Resolved (Charlie #2866):** the new fsId is resolved from `persistedFsRef` (canonical `block.end(...fsRef)`) — no new shared helper with `useChatNavigation` is needed; the hook already tracks this. Re-pin (not navigate) is confirmed.

## Task 2: make the Code tab editable (Monaco), behind an owner Edit toggle

Phase 1's `CodeViewPanel` is read-only shiki. Add an **Edit** affordance (owner-only) that swaps to the editable `CodeEditor` (Monaco, already `lazy()`-imported) wired to `saveCode`.

**Files:** `components/vibe-editor/CodeViewPanel.tsx` (add an `onEdit`/editable mode or a sibling `CodeEditPanel.tsx`); `components/vibe-editor/VibeEditorPanel.tsx` (thread `isOwner`, `saveCode`, `saveState`); `routes/vibe.$ownerHandle.$appSlug.tsx` (pass `generation.saveCode`/`saveState`, wire `onSavedFsId → setDraftFsId`).

- [ ] **Step 1:** Code tab shows the read-only shiki view by default + an **Edit** button for owners (`isOwner`). Toggling to edit mounts `CodeEditor` (Monaco) seeded from the resolved `activeCode`/file; non-owners never see Edit (read-only only). Keep Monaco lazy (only mounts in edit mode).
- [ ] **Step 2:** wire `CodeEditor`'s `onCode`/save → `generation.saveCode({ buffer, filePath, lang })`. Route passes `onSavedFsId={(fsId) => setDraftFsId(fsId)}` to the hook so the running app re-pins to the saved version (URL stays put).
- [ ] **Step 3:** `pnpm build && pnpm lint`; Storybook story for the edit mode (desktop + 390px — always-mobile per Phase 1). Commit.

## Task 3: save-state UI + failure recovery

- [ ] Surface `idle / Queued… / Saving… / Saved / Save failed — Retry` inline in the Code tab header, driven by `saveState` (`queued` → "Queued…", `saving` → "Saving…", `rebuilt` → "Saved", `error` → "Save failed — Retry"). On `error`, keep the editor buffer and show a Retry that re-invokes `saveCode`. Storybook stories per state. `pnpm build && pnpm lint`. Commit.

## Task 4: draft/publish continuity

- [ ] Confirm a manual save produces an owner draft exactly like a codegen edit: `setDraftFsId(newFsId)` → the "Draft · unpublished" badge shows → the existing `onPublish` publishes it. Add/extend a unit test asserting `onSavedFsId` re-pins `draftFsId` (and the badge logic already keys on `draftFsId`/`isDraft`). No new publish path. Commit.

## Task 5: acceptance tests (Charlie's Phase 2 block)

- [ ] Save-state machine test (Task 1) covers the `queued → saving → rebuilt` sequence + the failure branch + retry (`error → queued`). Add a focused test that `saveCode` failure preserves the buffer (no silent loss), that a save fired before the chat opens **queues and flushes** once the handle exists (Codex #2), and that success invokes `onSavedFsId` with the `persistedFsRef.fsId`. Record the agreed hot-swap/reload **timing threshold** as an asserted bound where testable, else a documented criterion. Commit.

## Task 6: verify + PR

- [ ] Full `pnpm build` + `pnpm lint` + unit tests + Storybook build green. Branch off Phase 1 (`claude/retire-chat-phase-1-vibe-editor`); rebase onto `main` once #2860 merges. Blog seed; open PR (label `agent-created`, @-mention `@CharlieHelps`, link #2518); verify on preview (authed owner: open Editor → Code → Edit → change a line → save → app reloads to the edit, URL unchanged, draft badge shows).

---

## Risks / open questions

1. ~~**Re-pin vs navigate (crux).**~~ **Resolved (Charlie #2866):** `setDraftFsId(newFsId)` on manual save; URL stays put. Guardrail: unversioned owner `/vibe` only (`fsId ?? draftFsId`).
2. ~~**block.end → fsId resolution.**~~ **Resolved:** the hook already exposes `persistedFsRef` (canonical post-persist `block.end(...fsRef)`); the save path watches it — no shared-helper refactor needed.
3. ~~**Reload vs pushSource.**~~ **Resolved (Charlie #2866):** manual full-file saves re-pin/reload; `pushSource` stays for streamed codegen. Guardrail: never both on the same manual-save event.
4. **Autosave debounce vs explicit save.** Plan leans explicit save (not per-keystroke) to avoid draft churn; debounce is a later refinement. (Not blocking — explicit save ships first.)
5. ~~**Interleaving** (codegen turn vs manual save): block vs queue.~~ **Resolved:** queue — a `saveCode` during generation stays `queued` and flushes when the turn settles (Codex #2 / Task 1 Step 2). `sendPrompt` blocked while `isSaving`.
