// Pure state machine for the /vibe Code-tab manual save (Phase 2 of retiring
// /chat, #2518). Kept out of the React hook so the transitions are unit-testable
// in the node env, per repo convention (mirrors editor-tab-state.ts).
//
// The states match Charlie's acceptance sequence `queued → saving → rebuilt`
// (#2847):
//   - queued:  save intent recorded. The owner hit save but `promptFS` hasn't
//              been submitted yet — the lazy codegen chat may still be opening
//              (`activate()` only flips state; useChatSession opens the LLMChat
//              in a later effect, Codex #2), or a codegen turn is in flight and
//              the save is held until it settles (interleaving guard).
//   - saving:  `promptFS` accepted, a promptId is in hand, awaiting the canonical
//              post-persist `block.end(...fsRef)`.
//   - rebuilt: the persisted block.end arrived; the new fsId is re-pinned via
//              setDraftFsId so the running app reloads to the saved version.
//   - error:   `promptFS` rejected or the save stream errored. The edited buffer
//              is preserved (no silent loss); the owner can retry.
//
// The fsRef carried by `settled` is resolved by the hook (from the already-exposed
// `persistedFsRef`); the pure machine only needs the discriminator to advance.

export type SaveState = "idle" | "queued" | "saving" | "rebuilt" | "error";

export type SaveEvent =
  | { type: "request" } // owner hit save (initial or retry)
  | { type: "submitted" } // promptFS accepted, awaiting block.end
  | { type: "settled" } // canonical post-persist block.end(...fsRef) arrived
  | { type: "failed" } // promptFS rejected / stream error
  | { type: "reset" }; // editor returned to idle (e.g. tab closed, new edit)

/**
 * Advance the save state for an event. Illegal (state, event) pairs are no-ops
 * (return the current state) so a stray event can never wedge the UI.
 */
export function nextSaveState(cur: SaveState, event: SaveEvent): SaveState {
  switch (event.type) {
    case "request":
      // From idle or a prior error (retry) → queued. Re-requesting while already
      // queued is idempotent. A request mid-save is ignored (one save at a time).
      return cur === "idle" || cur === "error" || cur === "queued" ? "queued" : cur;
    case "submitted":
      return cur === "queued" ? "saving" : cur;
    case "settled":
      return cur === "saving" ? "rebuilt" : cur;
    case "failed":
      // Either before or after promptFS submission can fail.
      return cur === "queued" || cur === "saving" ? "error" : cur;
    case "reset":
      return "idle";
  }
}

/** True while a save is in flight (queued waiting on chat/turn, or saving). */
export function isSaving(state: SaveState): boolean {
  return state === "queued" || state === "saving";
}
