# A Stop button in the vibe edit card — and what "stop" has to actually mean

Source: branch `claude/vibes-edit-card-stop-button-z8ubyv` (issue #2994). While an in-place edit
generates on the `/vibe` page, the edit card's round `↑` submit button now flips to a Stop button
(same shape/size/spot), the text input stays editable so you can queue your next change, and Stop
cancels the turn as if it never started.

Goal: give the owner a way to bail out of an edit that's going wrong — without wedging the codegen
session for the next edit.

Findings worth a full post:

- **The "reuse the Chat view's stop plumbing" premise was false.** The main Chat composer
  (`ChatInputStatus`) never had a stop — while a turn runs it just *disables* the button and shows a
  rotating "Writing code…" label, and the codegen `LLMChat` handle exposes no abort primitive (only
  `close()`, which tears down the whole socket). So there was nothing to reuse; the stop had to be
  built. Worth calling out because the visible UI ("busy button") looked like a stop and wasn't.

- **A shallow stop leaves a broken codegen session.** Just flipping the local `running` flag off
  isn't enough: the server keeps streaming on the open socket, and the next `chat.prompt()` fires
  onto a handle that's mid-turn. The honest fix closes + re-arms the socket. `useChatSession` grew a
  `resetChat()` that bumps the stream-generation fence *before* `close()` (so the stream's `finally`
  sees itself superseded and doesn't kick off the reconnect loop), drops the handle, and re-arms the
  open-once latch — so the *next* prompt opens a fresh chat whose replay rebuilds `blocks` from the
  persisted truth.

- **"As if the turn never started" = clear the in-memory blocks, not surgically drop one.** A new
  `abortTurn` reducer action wipes stream-derived state (blocks/current/running/hasCode) and clears
  the optimistic bubble + in-flight streamId + reconnect connection, while *preserving* settings
  (title/theme/icon) — deliberately unlike `clearChat`. Blocks are cleared (not just the partial
  one) because keeping them would double up when the reopened socket replays history. The card
  falls back to the server-projected chips in the meantime, so nothing visibly disappears.

- **Reverting the preview is best-effort, and that's a real seam.** Stop re-pushes the last settled
  source (from `blocks` minus the partial block) to the iframe so the running app looks pre-turn —
  but only when there's prior in-memory code to restore (there usually is: opening the card replays
  the persisted history into `blocks`). The first-ever build with no prior code has no defined
  "previous," so the preview is left as-is and self-heals on the next edit. Session correctness is
  guaranteed; the pixel-level revert is not.

- **The input had to move out of the overlay.** The card used to hide the whole chips+Other region
  behind the streaming narration overlay — so the input *disappeared* mid-edit. Requirement: keep it
  visible/editable to compose the next change while you wait. The fix pulls the composer row out of
  the `aria-hidden`/`inert` wrapper so only the chips sit under the overlay; Enter/submit is a no-op
  while generating (the button is Stop), and the typed text is preserved for when the turn ends.
