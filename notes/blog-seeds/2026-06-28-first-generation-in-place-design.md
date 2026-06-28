# One iframe surface: the design that deletes the preview pane

Source: #2677 (first-generation in place), design phase of the agent-in-vibe epic #2675. Spec:
`docs/superpowers/specs/2026-06-28-first-generation-in-place-design.md`.

Goal: design (not build) in-place first-generation on `/vibe` — stream in the card, swap to
the live app on the first code block, de-blur the forming app behind, hot-swap subsequent
edits — plus the cached-read chip lane. The most interesting outcome: a risky-looking
decision turned into a **deletion**.

Decisions / findings worth a full post:

- **A risk that pays for itself in deletions.** The open question was which iframe forms
  behind the card during generation: hot-swap the existing `/vibe` deployed iframe (risky —
  it's a "real" app, not a preview shell), or swap in `/chat`'s `PreviewApp` preview iframe
  for the duration. jchris took the risk — "okay to do something risky if it's on the direct
  line toward core product value" — and then named the prize: **retire the preview iframe
  entirely, one iframe surface.** The risk *is* the simplification.

- **The seam that made the risk safe.** The deployed runtime's `registerDependencies`
  registers the hot-swap `set-source` listener and posts `runtime.ready`
  **unconditionally** — and `?preview=yes` only skips SSR viewer identity, it never gated
  hot-swap. So the deployed `/vibe` iframe *already* accepts `pushSource`. The "risky" path
  was load-bearing code we'd already shipped; we just weren't calling it from `/vibe`.
  Reading the runtime before sketching turned a guess into a fact.

- **"Don't spread fakeness" as a slicing rule, not just a code rule.** The cached-read lane
  needs a faked chat history for curated starters. jchris's constraint: only build the fake
  if it hits the *real* contract (real stored `chatSections`, real `getChatDetails` read) —
  "if it's gonna spread fakeness, defer instead." That single rule decided the PR slice: the
  cached lane ships real navigation to real pre-built apps now; the *system-owned-fork*
  backend (system handle, content-address dedupe, auth-skip) is the only coordinated piece,
  cleanly isolated — and if the honest version needs that backend first, the whole lane
  defers rather than stubs.

- **Verify the data before you draw it.** The history view shows a line/block-count summary
  and past narration. The counts (`blocks.length`, `getCode().code` length) are real and free.
  But the tidy bullets in the sketch — "built a 4×4 grid of pad buttons" — are *not* something
  the stream gives us: `block.toplevel.line` is the model's freeform prose, not a clean
  summary. Caught it during the sketch review, corrected the caption, and filed the
  auto-summary idea as its own issue (#2753) rather than letting a mockup imply a feature we
  hadn't built.

- **Sketch with the real component or the sketch lies.** The new first-gen states render the
  real `UnifiedVibeCard` via its `body` slot — the de-blur, the orange-pencil Edit nav, the
  handle tag are all production pixels; only the body content is the design target. The
  perf-contract sketch (cached READ vs real WRITE, side by side) makes the §8-Q4 contract
  legible at a glance precisely because both phones are the same real card.
