# Plan the port by tracing the loop you're porting

Source: `claude/retire-chat-phase-2-plan` — the Phase 2 plan for `/chat` retirement
(Monaco edit-and-save on the `/vibe` Code tab)

Phase 2 is "make the Code tab editable" — which sounds like a UI task and is
actually a distributed-save-loop port. Tracing the existing `/chat` path first
turned a vague plan into a concrete one and surfaced the single decision the whole
phase hinges on. The loop: a Monaco edit → `EditorState "edit"` → `chat.promptFS({
update:[code-block] })` → a `promptId` → **the new fsId arrives async at the save
stream's `block.end`** → `useChatNavigation` **navigates** to it.

That last step is the crux. The spec already decided `/vibe`'s URL never changes —
so the port isn't "call promptFS from a new place," it's "**replace the navigate
with a draft re-pin**" (`setDraftFsId(newFsId)`, reusing the #2772 owner-draft
mechanism Phase 1 already wires). Everything else (the editable Monaco swap, the
save-state UI) is comparatively easy.

Worth a note:

- **A "make X editable" task is often a "port the persistence loop" task.** The
  editor widget is the visible 10%. The save → version → rebuild → re-pin loop is
  the 90%, and it's where the coupling (chat session, `promptId`, navigation) lives.
  Estimate the loop, not the widget.
- **Find the one load-bearing decision and put it at the top of the plan.** Here
  it's re-pin-vs-navigate. Marking the plan "do not start until Charlie signs off on
  this one call" is cheaper than building against a guess and reworking — the rest
  of the plan is a function of that decision.
- **The async completion is the fiddly bit, name it.** "Save returns a promptId;
  the fsId comes later at block.end" is the kind of detail that's invisible until
  you trace it and brutal if you don't — the plan budgets a refactor (share
  `useChatNavigation`'s block.end→fsId resolution) instead of pretending the save is
  synchronous.
- **Seek the human's feedback on the design, not the diff.** Posting proposed
  *answers* (re-pin, reload, debounced save) for review beats posting open
  questions — the reviewer reacts to a concrete shape, and you find out you're wrong
  before you've written the code, not after.
