# Handoff: get PR #2650 to an acceptable, shippable state — brainstorm from first principles

> **How to use this:** Start a fresh session in this repo and paste:
> *"Read `docs/superpowers/2026-06-26-pr2650-delivery-handoff.md` and follow it."*
> This is deliberately a **thinking** brief, not an implementation brief.

## Your task

Use the **`brainstorming`** skill (superpowers) to think, from first principles, about how to deliver **PR VibesDIY/vibes.diy#2650** in an *acceptable, mergeable* state. Do **not** start by writing code or patching the next symptom. The explicit goal is to break a pattern of reactive, circular fixing and replace it with one systematic decision about what "done enough to ship" means here and how to get there.

**Start the brainstorm by answering, before anything else: what is the minimum acceptable state to ship this PR, and for whom?** Work backward from that. Everything below is evidence to reason over — not a plan to execute.

## The meta-problem (why this handoff exists)

Across many sessions this PR has been advanced by a chain of *individually-correct* fixes, each of which uncovered the next gap:

> whole-file codegen core → per-line "diffusion" streaming → a `sectionId` reconnect crash → a frozen-"Reconnecting" wedge (missing `fsRef`) → themes defaulting to brutalist → a themed cold open that paints neutral → theme variety that still isn't visible.

Each fix was sound in isolation and passed review. But the through-line is that **the whole-file path is a parallel reimplementation of the production codegen path that keeps missing small things production already does, and the "magic" layer (cold open, diffusion) was built on top before the foundation it depends on — the pre-allocated theme actually flowing through to the prompt *and* the client, and the app painting fast — was ever verified end-to-end on the preview.** We optimized "make the experimental path match production + add magic" via incremental patches. That is the circle to break.

Treat that as a **hypothesis to test, not a conclusion.** Re-derive it yourself.

## What PR #2650 is

- **Title:** "Whole-file agentic codegen path (experimental, flag-gated) — magic harness Plan 1."
- **Branch:** `experiment/codegen-magic-harness`. **~50 commits** from `main`.
- **Flag:** `USE_WHOLE_FILE_CODEGEN` (default **off**). Preview enablement via the PR label `preview:whole-file-codegen`.
- **Preview:** https://pr-2650-vibes-diy-v2.jchris.workers.dev (logged in as `marcus-e`; browser tools available).
- **Premise:** replace the production streamed SEARCH/REPLACE edit protocol (brittle exact-byte anchoring → mid-stream "recovery" stalls) with a whole-file `write_file` tool-loop + a Workers-safe verify gate, then layer "magic" (themed cold open, diffusion reveal) on top. It is **additive and flag-gated**; the flag-off SEARCH/REPLACE path is meant to be untouched.

## The work that exists on the branch (the whole PR, not just the last session)

1. **Generation core** — `@openrouter/agent` `write_file` tool-loop (`vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts`), Workers-safe verify gate (`verify.ts`, no esbuild), emit adapter (`emit-blocks.ts`), handler (`vibes.diy/api/svc/public/handle-whole-file-codegen.ts`), flag branch in `prompt-chat-section.ts` (first-creation-turn only).
2. **Per-line diffusion streaming** — live `onLine` emission + `reveal:"typewriter"` marker on `CodeBeginMsg` + client `useTypewriterReveal` paced reveal (`MessageList.tsx`).
3. **Reconnect crash fix** — `MessageList` skips an orphaned `code.end`/`toplevel.end` (the `sectionId` crash). Verified fixed.
4. **Theme threading** — whole-file dispatch reads the persisted `active.theme` via `loadActiveSettings` and threads it into the agentic prompt (`{{THEME_DESIGN}}`); `buildWholeFileSessionDoc`.
5. **Themed cold open** — parametric `<ThemedSkeleton>` painted during the "generating, nothing pinned" window; slug→tokens via `getColorsetBySlug` (`coldOpenSlugFrom`, `colorsetToSkeletonTokens`).
6. **Reconnect convergence** — handler re-emits the canonical `block.end` with `fsRef` post-persist so the reducer settles `reconnecting → live`.

**Read these to understand intent (don't re-derive the whole design):**
- Design: `docs/superpowers/specs/2026-06-25-codegen-magic-harness-design.md` (esp. §1 Fast→Fun, §3 "theme is the keystone", §5.5 stage layer / themed cold open, §7 never-a-white-screen).
- `docs/superpowers/specs/2026-06-25-per-line-diffusion-streaming-design.md`.
- `docs/superpowers/specs/2026-06-26-whole-file-theme-cold-open-reconnect-design.md` + its plan `docs/superpowers/plans/2026-06-26-whole-file-theme-cold-open-reconnect.md` (the most recent thread).
- Memory: `workerd-getitemsstream-buffers.md`, `whole-file-theme-coldopen-reconnect.md` (root causes + gotchas, in the project memory dir).

## Verified truths from on-preview browser testing (2026-06-26) — build on these, don't re-litigate

**Working (confirmed in the browser, head `166ed80f4`, all CI green):**
- No `sectionId` crash, even through watchdog-triggered reconnects.
- The cold-open skeleton renders — the preview is no longer a permanently blank grid.
- Reconnect no longer hard-wedges: it converges to idle, or degrades gracefully to "Connection lost — your app may have finished building · Reload" (the app is rendered; Reload converges). This is a real improvement over the old frozen-"Reconnecting" + blank.
- The generated app renders and is fully functional after completion/reload.

**NOT delivering the headline, despite correct-and-reviewed code (the crux):**
- **Themed cold open paints NEUTRAL on a fresh generation.** `promptState.theme` is empty on the client *during* the live stream — the pre-allocated theme only hydrates on reload, and the whole-file path never *emits* it to the client at dispatch (the "emit `set-theme`/`set-color-theme`" piece was deferred). So the cold open's "themed" property cannot be true on first view.
- **Theme variety is not visibly happening.** ~6 generated apps across sessions all share the same brutalist look (white bg, black borders, R/Y/G/B blocks, mono-uppercase). The wiring is correct (`preAllocEligible` is true for any non-empty prompt; `loadActiveSettings` reads `active.theme` correctly), so the open question is whether: (a) pre-alloc isn't selecting *varied* slugs, (b) the agentic system prompt variant doesn't honor `{{THEME_DESIGN}}` the way production does (it's known to drop other blocks like `{{IMPORT_STATEMENTS}}`), or (c) the theme carries color but the model invents brutalist structure regardless (the design's own §5.4 caveat). **This has not been isolated.**
- Reconnect ending in "Connection lost / Reload" is graceful but is not the clean settle-to-live the `fsRef` re-emit intended.

**Process lesson encoded for you:** unit tests passed at every step and missed all of the above. On this PR, **the preview browser pass is the only load-bearing verification.** Any approach you propose must be cheap to verify on the preview *before* building further on it.

## First-principles questions to explore in the brainstorm (open — do not assume the answer)

- What is PR #2650 actually *for* right now, and who is the audience of an "acceptable" merge — Chris (technical manager) evaluating the magic, future development behind the flag, or just not losing the verified reliability work? Each implies a different "acceptable."
- Is the **whole-file path the right vehicle** for these wins, or are some of them (reliability, theme) better delivered to the production path / a smaller surface?
- Should the PR be **scoped down** — e.g., ship the verified reliability core (whole-file loop + verify gate + crash/reconnect fixes) as an honest "Plan 1," and *cut* the theme + cold-open "magic" into a separate effort that can be built foundation-first (theme proven to flow end-to-end *before* a skeleton is painted from it)? Or is a scoped-down PR not worth merging?
- Is the **theme-not-flowing** a fundamental architecture mismatch (theme delivery is reload-time hydration, but the cold open and live experience need it at stream-time) — and if so, what is the *one* right place to fix it, rather than another client-side fallback?
- Is a **~50-commit experimental PR** reviewable/mergeable with confidence, or should it be split? What does Charlie (the review bot) and a human need to say yes?
- What is the smallest set of changes that makes the PR *honest and safe* to merge (flag-off untouched, claims matching reality) even if the magic isn't fully there yet?
- Is there a case for **not merging** this PR as-is at all (close, or convert to draft, and restart the magic layer with the foundation verified first)?

## Constraints / guardrails

- Flag-gated experimental: the **flag-off SEARCH/REPLACE path must stay behaviorally identical** — any plan must preserve that.
- **Don't overclaim.** The prior PR comment summarizing "three threads working" overstated the theme outcomes; reality is the browser findings above. Honesty in the PR is part of "acceptable."
- The **preview browser pass is the verification of record** — design any plan so its key claims are preview-checkable quickly.
- Repo workflow: never push to `main`; rebase don't squash; CI = `compile_test` (format/lint/**build (tsc)** — run `pnpm run build`, not just tests/lint), `deploy-preview`, `pg_concurrency`; honor the `agents/` rules (rules-bag, flaky-tests rerun) and the PR lifecycle in `CLAUDE.md`.
- There is a separate, still-open Charlie review note on unicode-escape parsing in `extractJsonStringField` (pre-existing whole-file loop) — factor it into "what's needed to merge."

## What the brainstorm should produce

A single, defensible **delivery decision** for PR #2650 — what "acceptable" is, what's in vs cut/deferred, and the route to get there (which may be "scope down + merge honestly," "fix the theme flow at its root then ship," "split the PR," or "convert to draft and restart the magic"). Capture it as a short spec/decision doc. Only *after* that decision is approved should it turn into an implementation plan. Resist the urge to start fixing before the decision is made — that is the exact loop this handoff exists to break.
