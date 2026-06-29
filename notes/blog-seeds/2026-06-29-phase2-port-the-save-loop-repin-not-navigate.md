# Porting a save loop: re-pin, don't navigate (and the two events that look alike)

Source: `claude/retire-chat-phase-2-editor` — Phase 2 of retiring `/chat`: the
`/vibe` Code tab becomes editable (Monaco edit-and-save), without ever leaving
`/vibe`.

The plan called this "make the Code tab editable." The actual work was porting a
distributed save loop and getting two subtle things right that only show up when
you trace the events.

## Re-pin instead of navigate

`/chat`'s save loop ends by **navigating** to the new fsId. `/vibe`'s URL must
never change (it's the shareable running-vibe URL). So the port replaces the
navigate with a **draft re-pin**: `setDraftFsId(newFsId)` — reusing the #2772
owner-draft mechanism the route already resolves through (`fsId ?? draftFsId`).
The iframe reloads to the saved version; the URL stays put. The whole phase
hinged on that one decision, which is why the plan was marked "do not start
until signed off."

## The new fsId was already exposed

The fiddly part of any async save is "the id you need arrives later." Here the
new fsId rides the **canonical post-persist `block.end(...fsRef)`** — and the
hook already surfaced exactly that as `persistedFsRef`. So "resolve the new fsId"
became "watch `persistedFsRef` advance past a pre-save baseline," not a new
stream-tracking refactor. Worth a habit: before you build the mechanism, check
whether the value you need is already flowing past you.

## Two gotchas that only a trace reveals

- **`activate()` doesn't open the chat synchronously.** It flips React state;
  `useChatSession` opens the `LLMChat` in a *later* effect. A naive
  `activate(); chat.promptFS(...)` drops the first save against a null handle.
  Fix: `saveCode` records the intent and a flush effect submits once the handle
  exists. The save *queues* — and "Queued…" is a real state, not a fiction.
- **A manual save streams its file back too** — so the iframe hot-swap effect
  (`pushSource`) would fire *and* the re-pin would reload: two updates for one
  save. The guardrail was "never both on one manual-save event." Fix: suppress
  hot-swap while a save is in flight (a non-null `savePromptIdRef`) and let the
  re-pin do the single reload.

## Make the state machine match the acceptance sequence

The first draft had `idle | saving | saved | error`. The acceptance criteria
asked to assert `queued → saving → rebuilt` — which the machine literally
couldn't represent (no slot for "submitted, awaiting `block.end`"). Renaming to
`idle | queued | saving | rebuilt | error` wasn't cosmetic: `queued` is where the
lazy-chat wait *and* the codegen-interleaving hold both live, and `rebuilt` is
the re-pin moment. When the test you must write can't be written against your
types, the types are wrong — fix them before the code.

The editor widget was the visible 10%. The save → version → re-pin loop, and
these two look-alike events, were the 90%.
