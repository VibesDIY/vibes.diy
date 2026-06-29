# Retire /chat — Phase 2: Monaco edit-and-save on the /vibe Code tab (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans. Steps use checkbox (`- [ ]`) tracking.
>
> **STATUS: draft — pending @CharlieHelps sign-off on the two load-bearing decisions (§Architecture: re-pin vs navigate, and reload vs pushSource), posted on #2518. Do not start implementation until those are confirmed; the rest of the plan adjusts to them.**

**Goal:** Make the `/vibe` editor surface's **Code** tab editable — port the Monaco edit-and-save loop from `/chat` so an owner can hand-edit source and have the running app update, **without leaving `/vibe`** (no navigation; the URL stays the running vibe, per the spec's Q2).

**Architecture:** A Monaco edit moves `EditorState` → `"edit"` (carries the edited `buffer`/`filePath`/`lang`). On save we call `chat.promptFS({ update: [{ type: "code-block", filename, lang, content: buffer }] })` on the vibe's lazy codegen chat session (the same handle `useInVibeGeneration` already opens), which returns a `promptId`; the new fsId arrives async at the save stream's `block.end`. **Instead of `useChatNavigation.navigateToFsId` (which `/chat` uses to jump to the new fsId), we re-pin `setDraftFsId(newFsId)`** — reusing the #2772 owner-draft mechanism Phase 1 already wires via `effectiveFsId` — so the iframe reloads to the saved version and the URL never changes. A hand-edited full-file save **reloads** the iframe (via the re-pin) rather than `pushSource`-hot-swapping (that's for streamed codegen blocks).

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

- [ ] **Step 1 (TDD):** a pure `save-state.ts` state machine: `type SaveState = "idle" | "saving" | "saved" | "error"`; a reducer/transition fn `nextSaveState(cur, event)` for events `start | settled(fsId) | failed`. Unit-test the transitions (idle→saving→saved; saving→error; error→saving on retry). (This keeps the testable logic out of the React hook, per repo convention.)
- [ ] **Step 2:** add to `useInVibeGeneration`:
  - `saveCode(args: { buffer: string; filePath: string; lang: string }): void` — `activate()` if the chat isn't open, then `chat.promptFS({ update: [{ type:"code-block", filename: normalizeCodeViewPath(filePath), lang, content: buffer }], remove: [] })`; set save-state `saving`; register the returned `promptId` to watch for its `block.end`.
  - watch the reducer for the saved `promptId`'s `block.end` → resolve the new fsId → set save-state `saved` and **invoke an `onSavedFsId?(fsId)` callback** (the route wires this to `setDraftFsId`). On `promptFS` error or stream error → save-state `error`, surface the message, **do not** clear the editor buffer.
  - expose `readonly saveState`, `readonly saveCode`, and `readonly isSaving` on the returned object.
  - **Interleaving:** reuse the in-flight guard — `saveCode` no-ops (or queues, TBD with Charlie) while `isGenerating`, and `sendPrompt` is blocked while `isSaving`.
- [ ] **Step 3:** `pnpm build && pnpm lint`; the save-state unit test passes. Commit.

> **Open (confirm with Charlie):** resolving the new fsId from `block.end` reuses `useChatNavigation`'s save-tracking logic — factor that resolution into a shared helper both `useChatNavigation` (navigate) and this hook (re-pin) call, rather than duplicating. If the block.end→fsId resolution is non-trivial, this is the task to budget extra time on.

## Task 2: make the Code tab editable (Monaco), behind an owner Edit toggle

Phase 1's `CodeViewPanel` is read-only shiki. Add an **Edit** affordance (owner-only) that swaps to the editable `CodeEditor` (Monaco, already `lazy()`-imported) wired to `saveCode`.

**Files:** `components/vibe-editor/CodeViewPanel.tsx` (add an `onEdit`/editable mode or a sibling `CodeEditPanel.tsx`); `components/vibe-editor/VibeEditorPanel.tsx` (thread `isOwner`, `saveCode`, `saveState`); `routes/vibe.$ownerHandle.$appSlug.tsx` (pass `generation.saveCode`/`saveState`, wire `onSavedFsId → setDraftFsId`).

- [ ] **Step 1:** Code tab shows the read-only shiki view by default + an **Edit** button for owners (`isOwner`). Toggling to edit mounts `CodeEditor` (Monaco) seeded from the resolved `activeCode`/file; non-owners never see Edit (read-only only). Keep Monaco lazy (only mounts in edit mode).
- [ ] **Step 2:** wire `CodeEditor`'s `onCode`/save → `generation.saveCode({ buffer, filePath, lang })`. Route passes `onSavedFsId={(fsId) => setDraftFsId(fsId)}` to the hook so the running app re-pins to the saved version (URL stays put).
- [ ] **Step 3:** `pnpm build && pnpm lint`; Storybook story for the edit mode (desktop + 390px — always-mobile per Phase 1). Commit.

## Task 3: save-state UI + failure recovery

- [ ] Surface `idle / Saving… / Saved / Save failed — Retry` inline in the Code tab header, driven by `saveState`. On `error`, keep the editor buffer and show a Retry that re-invokes `saveCode`. Storybook stories per state. `pnpm build && pnpm lint`. Commit.

## Task 4: draft/publish continuity

- [ ] Confirm a manual save produces an owner draft exactly like a codegen edit: `setDraftFsId(newFsId)` → the "Draft · unpublished" badge shows → the existing `onPublish` publishes it. Add/extend a unit test asserting `onSavedFsId` re-pins `draftFsId` (and the badge logic already keys on `draftFsId`/`isDraft`). No new publish path. Commit.

## Task 5: acceptance tests (Charlie's Phase 2 block)

- [ ] Save-state machine test (Task 1) covers `queued/saving/rebuilt(saved)` transitions + the failure branch. Add a focused test that `saveCode` failure preserves the buffer (no silent loss) and that success invokes `onSavedFsId` with the resolved fsId. Record the agreed hot-swap/reload **timing threshold** as an asserted bound where testable, else a documented criterion. Commit.

## Task 6: verify + PR

- [ ] Full `pnpm build` + `pnpm lint` + unit tests + Storybook build green. Branch off Phase 1 (`claude/retire-chat-phase-1-vibe-editor`); rebase onto `main` once #2860 merges. Blog seed; open PR (label `agent-created`, @-mention `@CharlieHelps`, link #2518); verify on preview (authed owner: open Editor → Code → Edit → change a line → save → app reloads to the edit, URL unchanged, draft badge shows).

---

## Risks / open questions (for Charlie / `writing-plans` refinement)

1. **Re-pin vs navigate (crux).** Plan assumes `setDraftFsId(newFsId)` is the right "stay-put" mechanism. If there's a cleaner seam than piggybacking the draft pin, Tasks 1–2 change.
2. **block.end → fsId resolution.** The new fsId arrives async via the save stream; reusing `useChatNavigation`'s tracking (refactored to a shared helper) is the assumed approach — the single most fiddly piece.
3. **Reload vs pushSource.** Plan reloads via re-pin for full-file saves; if Charlie wants `pushSource` parity for snappiness, Task 2 swaps the channel.
4. **Autosave debounce vs explicit save.** Plan leans explicit/debounced save (not per-keystroke) to avoid draft churn; confirm.
5. **Interleaving** (codegen turn vs manual save): block vs queue.
