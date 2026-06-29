# Verify the nouns in your spec before you commit to building them

Source: `claude/agent-vibe-remaining-work-jjujx2` — the #2518 design pass
(retire `/chat`, fold the editor surface into `/vibe`)

Writing the spec to retire `/chat`, I listed the editor surfaces `/vibe` would
have to absorb as "code view, full history, **and terminal output**." The human
asked one question: "what is 'terminal' in this context?" There was no terminal.
The `/chat` editor is exactly three views (`ViewType` = `preview | code | data`)
plus the chat log, with build/runtime errors surfaced inline in the chat — no
console pane anywhere. "Terminal" had been carried, unexamined, out of an
exploration agent's loose summary into a design doc, where it would have become a
phantom Phase-1 deliverable.

Worth a note:

- **A spec's nouns are commitments.** Every component you name becomes scope
  someone plans, estimates, and builds. An invented one ("terminal") is pure
  waste that survives precisely because it sounds plausible next to the real ones.
  Grep for the thing before you write that it exists — `ViewType` had three values,
  and that enum is the authoritative answer to "what views are there."
- **Summaries launder uncertainty into fact.** The exploration agent wrote
  "streams code blocks, terminal output, and structured responses" — a reasonable
  gloss of streamed narration. Two hops later it was a UI pane. The fix isn't
  "don't use sub-agents," it's "re-verify any load-bearing noun a summary hands
  you, especially before it enters a durable artifact."
- **The same pass found a real, cheaper truth.** Checking the code to kill the
  phantom also surfaced that Monaco is _already_ code-split (`const CodeEditor =
  lazy(() => import("./CodeEditor.js"))`) and that `CodeEditor` imports its types
  *from the very route file being deleted* — a genuine prerequisite. Grounding the
  spec in the code shrank one item (no terminal), de-risked another (Monaco stays
  lazy if you keep the `lazy()` boundary), and exposed a hidden one (extract the
  types first). Cheaper and more correct, all from reading instead of asserting.
