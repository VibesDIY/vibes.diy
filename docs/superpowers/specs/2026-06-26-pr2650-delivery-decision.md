# Delivery decision: PR #2650 — "live magic for Chris," foundation-first

> **Status:** Decision approved (brainstorm). Not yet an implementation plan.
> **Parent:** `docs/superpowers/2026-06-26-pr2650-delivery-handoff.md` (the thinking brief this answers).
> **PR:** VibesDIY/vibes.diy#2650 — "Whole-file agentic codegen path (experimental, flag-gated) — magic harness Plan 1." Branch `experiment/codegen-magic-harness`. Currently a **draft**, CI green, `mergeable: CLEAN`, 53 commits / 42 files / +5,135−64.

## The decision

Deliver the "magic" on the whole-file path **for Chris (the technical manager evaluating it)** — but build it **foundation-first with a hard preview gate at each step**. The PR stays in draft until _all three_ are simultaneously true and confirmed in the browser on the preview:

1. the themed cold open paints in the pre-allocated theme's colors on a **fresh** generation (not neutral),
2. theme variety is demonstrated to a bar we set **after** isolating its cause, and
3. the honest-merge cleanup is done (correctness bugs fixed, rules-bag green, PR claims match reality).

This is the explicit, single decision that replaces the reactive fix-loop: **nothing gets built on a foundation that has not first been verified on the preview.**

### Audience and why it sets the bar

The audience is **Chris evaluating the magic live**, which is the highest of the candidate bars (vs. "just preserve the reliability work" or "future flagged dev"). It requires the headline — themed cold open + visible theme variety — to actually work on the preview before merge, not merely to exist as correct-and-reviewed code. The prior sessions produced correct-and-reviewed code that did **not** deliver the headline; this decision treats on-preview delivery as the only acceptance that counts.

## The load-bearing finding that shaped this

The handoff hypothesized the themed cold open paints neutral because _the whole-file path_ never emits the theme to the client. Verified on the branch (read-only investigation, head `166ed80f4`):

- **Neither path emits the theme to the client during the live stream.** Production SEARCH/REPLACE and whole-file both persist `active.theme` to `app_settings` _before_ dispatch (`ensure-chat-id.ts:328`) and use it only in the system prompt. The `PromptMsgs` section-event union (`vibes.diy/api/types/prompt.ts:83`) has **no** theme entry. The client hydrates theme only on reload/reconnect via a separate `ensureAppSettings` call (`useChatSession.ts`). An in-code comment at `PreviewApp.tsx:37` already admits a fresh gen's cold open "would paint neutral."
- Therefore **"themed cold open paints neutral" is not a one-line emit fix and not a whole-file regression.** The foundation the cold open depends on — _stream-time theme delivery to the client_ — was never built in any path. The magic was layered on an unbuilt foundation. This validates the handoff's meta-diagnosis and sharpens it.

Consequence: the keystone fix is a **shared streaming-protocol change**, which must be carefully flag-gated so the flag-off production path stays behaviorally identical.

## Sealed acceptance (all preview-verifiable)

| #   | Acceptance check                                                                                                                                            | How verified         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1  | On a **fresh** generation, the cold-open skeleton paints in the pre-allocated theme's colors, not neutral.                                                  | Browser on preview   |
| A2  | Theme variety is visible to an agreed bar. **Bar deliberately unset** until Phase 1 isolates the cause.                                                     | Browser on preview   |
| A3  | No `sectionId` crash; reconnect converges; generated app renders and functions. (Already verified — must not regress.)                                      | Browser on preview   |
| A4  | Unicode-escape bug fixed; whole-file routing gating matches its stated claim; verify-before-return + EOF-flush addressed.                                   | Build/test + browser |
| A5  | `rules-bag` green (`pnpm run rules-bag:constructors`); CI green incl. `pnpm run build` (tsc); Charlie/Codex threads resolved.                               | CI + command         |
| A6  | PR description matches browser reality — **no overclaiming**.                                                                                               | Manual               |
| A7  | **Flag-off SEARCH/REPLACE behaviorally identical** — the new theme event emits _only_ when the flag is on; a test asserts flag-off emits zero theme events. | Test + manual        |

## Route — phases, each gated on the preview before the next

### Phase 0 — Foundation: theme as a first-class stream event

Add a theme entry to the `PromptMsgs` section-event protocol; the whole-file handler emits it as the **first** event of the stream (slug, plus `colorTheme` if present); the client reducer sets `promptState.theme` live so the cold open can read it before any code arrives.

- **Flag isolation:** emit happens only on the whole-file (flag-on) path. Production never emits it → flag-off behavior identical (A7). Add a test asserting this.
- **GATE 0:** preview shows a themed cold open on a fresh gen (A1). **If it does not, stop and diagnose — do not build variety on top.**

### Phase 1 — Variety isolation (instrument-only, no fix)

Determine _why_ generated apps all look brutalist, among: (a) pre-alloc not selecting varied slugs, (b) the agentic system prompt not honoring `{{THEME_DESIGN}}` (it is known to drop other blocks like `{{IMPORT_STATEMENTS}}`), (c) the model inventing brutalist structure regardless of theme (design §5.4 caveat).

- Log the selected slug server-side per gen; run 3–4 varied prompts on the preview; compare _selected slug_ vs. _rendered look_; diff the agentic system prompt against production to confirm `{{THEME_DESIGN}}` is present **and** populated.
- **GATE/DECISION 1:** bring the identified cause back; **then set the A2 acceptance bar together** with the cause known (bounded "visible difference" if cause is a/b; an explicit cap if cause is c).

### Phase 2 — Variety fix (scope set by Phase 1)

Apply the bounded fix for slug-selection / prompt-honoring. If the cause is "model ignores theme structurally," apply the cap agreed at Gate 1 rather than chasing prompt-engineering indefinitely.

- **GATE 2:** preview shows 3–4 fresh gens visibly differ to the agreed A2 bar.

### Phase 3 — Honest-merge cleanup

- Fix the `\uXXXX` unicode-escape parse in `whole-file-loop.ts:117` (currently throws `Bad Unicode escape`, aborting the stream for the turn).
- Reconcile the gating contradiction: the handoff claims "first-creation-turn only"; Codex P1 says the condition matches every codegen request including follow-up edit turns. Verify and fix so behavior matches the claim.
- Address Codex P2s: verify-before-return (`write_file` stores contents before `ok:false`) and EOF flush of the final unterminated line.
- Clear the rules-bag debt (all in the new whole-file code): `new TextEncoder/TextDecoder` (×4), falsy `if(!x)` checks, 4-positional-param functions (`OnLine`, `emitCodeLine/End`, `stepReveal`), try/catch → `exception2Result`, `makeOpenRouterClient` throwing → `Result`, default `import React`, cast-papered guard in `MessageList`. Run `pnpm run rules-bag:constructors` to green.
- Rewrite the PR description to match browser reality (A6); resolve Charlie/Codex threads.
- **GATE 3:** CI green incl. `pnpm run build` (tsc); rules-bag green; browser pass re-confirmed (A1–A3 still hold). Then take the PR out of draft and label `ready-to-merge`.

## Scope: in / cut / deferred

- **In:** Phases 0–3 above. The whole-file path is the vehicle (audience chose live magic on this PR).
- **Cut to a follow-up:** structural-variety prompt-engineering _if_ Phase 1 reveals cause (c) and we cap it at Gate 1 — filed honestly as a known follow-up, not chased in this PR.
- **Not in scope:** porting theme stream-delivery to the production SEARCH/REPLACE path. The protocol is extended in a shared, reusable way, but production does not emit (preserves A7). A later effort may opt production in.

## Risks and how the design contains them

| Risk                                         | Containment                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Variety cause (c) is open-ended prompt work  | Gate 1 sets a bounded bar _with the cause known_; cap + honest follow-up rather than indefinite chase.                                                                         |
| Shared-protocol change leaks into production | Emit only when flag-on; test asserts flag-off emits zero theme events (A7).                                                                                                    |
| Reopening the reactive loop                  | No phase proceeds until its preview gate passes. The preview browser pass is the verification of record — unit tests passed at every prior step and missed every headline gap. |
| 53-commit PR hard to review with confidence  | Phase 3 makes claims honest and code clean; if review still stalls, splitting can be reconsidered, but is not assumed here.                                                    |

## Guardrails (non-negotiable)

- Flag-off SEARCH/REPLACE path stays behaviorally identical.
- The **preview browser pass is the verification of record**; design every claim to be preview-checkable cheaply, before building further on it.
- Repo workflow: never push to `main`; rebase, don't squash; CI = `compile_test` (run `pnpm run build`, not just tests/lint), `deploy-preview`, `pg_concurrency`; honor `agents/` rules (rules-bag, flaky-test rerun) and the `CLAUDE.md` PR lifecycle.
- Honesty in the PR is part of "acceptable" — do not overclaim outcomes.
