# Autoresearching a system prompt: building a metric so an LLM can iterate access.js codegen and keep/discard on its own

Source: #2602 (issue), #2621 (harness), #2631 (loop run)

The goal: get newly-generated vibes to adopt the #2588 multiplayer access model
(author-owned, per-object sharing — not owner-gated) by *iterating the
`prompts/pkg/` corpus automatically* instead of by hand. #2595 was that loop run
manually; this work built the machine so `/autoresearch` can run it unattended.
The interesting part isn't the prompt edits — it's that **you can't autoresearch
what you can't measure**, so the real engineering was constructing a defensible
metric for a fuzzy property ("does the generated `access.js` let a stranger do the
thing the app is *for*?").

Decisions worth a full post:

- **Static-first grader, LLM judging used sparingly.** Greppable access-model
  invariants (Form-A strict/broad, the `isOwner` write-gate, the per-object recipe,
  owner-published vs author-owned) do most of the scoring deterministically; the
  semantic judging is the minority. The harness (#2621) started with a single
  second-visitor judge ("can a second signed-in visitor do the core action?")
  reserved for the multiplayer dimension; the loop run (#2631) later added a
  consent-side judge. Composite = `mean(PASS=1/SOFT=.5/FAIL=0)` over an
  8-prompt × 8-rep matrix. The grader was validated against 8 ground-truth corpus
  rows before being trusted to grade anything.
- **Freeze the ruler (and record the exceptions).** The grader, both matrices, and
  `baseline.json` are frozen by default — only `prompts/pkg/**` may change — so the
  loop can't "improve" by editing its own metric. Re-baselining is allowed but
  explicit and recorded when warranted (e.g. #2631 re-captured `baseline.json`
  against the preview env). That separation — frozen-by-default, deliberately
  re-baselined — is what makes an autonomous keep/discard loop trustworthy.
- **A gate that enforces a prompt-writing principle.** One of the 5 discard-gates
  rejects any prompt diff that *enumerates prohibitions or names the anti-pattern* —
  the negative-tokenization / "examples bias, grammar enables" rule, turned from
  advice into an automated tripwire (the `489ff77` lesson). Plus a two-file-emission
  regression gate (catching the `9cf43ea`-class bug) and `pnpm check`.
- **Loop discipline as the actual deliverable.** Predict-gate each edit before
  spending a batch, ≥8 reps, accept only gains beyond noise, verify-twice, and define
  success as the metric *plateauing* — not hitting a number. Codified in
  `agents/access-model-autoresearch.md`.

Two bonus nuggets the run surfaced: (1) the iteration target subtlety — system
prompts are backend-served, so the loop iterates against a per-PR **preview env**
that redeploys on every push, not local files; and (2) a footgun — `DEFAULT_CODING_MODEL`
is dead code (the default resolves server-side and was dispatching opus-4.7), so the
eval pins `anthropic/claude-opus-4.8` explicitly and fails loudly if the live
dispatched model ever drifts off the pin.
