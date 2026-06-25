# Codegen Magic Harness — Design

**One line:** Re-architect the production vibe-generation path from a streamed SEARCH/REPLACE edit protocol into a whole-file tool-loop with an invisible verify-and-fix gate, presented through a stage/backstage "magic" layer and powered by the theme system promoted into a deterministic visual substrate — shipped as an experimental PR + preview deploy, not a production cutover.

**Status:** Approved in brainstorm (2026-06-25). Full-boldness scope. Experimental.

---

## 1. Why this exists

VibesDIY competes in a crowded vibe-coding market on one axis above all: **it feels like magic.** Users have told us the real-time partial rendering — code materializing diffusion-style — is the moment of delight. The product is best understood not as a coding tool but as **media generation for mini-apps**: an opinionated, enforced stack (React + Fireproof + use-vibes + the system-prompt constraints) that deliberately narrows what can be built so that what _is_ built comes out fast and good.

The priority order is **Fast → Fun**. Fast means snappy, but we have slack measured in seconds, not milliseconds — we are already far faster than the market and can spend a few seconds on quality and still be near the fastest. Fun means high-quality, ambitious mini-apps with nice UI and a sense of joy.

Two findings from the just-merged `eval/codegen-agentic` work (PR #2638) point at unrealized upside in the live product:

1. **Making generation properly agentic — a write-file loop with build feedback — dramatically improves outcomes.** Many model "failures" were one-shot/output-format artifacts, not capability gaps (`openai/gpt-oss-20b` 0% → 100% build-pass; `deepseek-v3.2` 44% → 100%). The biggest wins are on **weak/cheap models** reaching tenability — which is exactly the lever for **value engineering**: making cheaper models capable enough to run the product economically at scale.
2. The production path captures _some_ of this already (transient retry + model fallback, a structural recovery loop, a runtime crash-report loop) but has **no build/render-correctness feedback** before the user sees the app.

This design turns those findings into a live-product bet, and fuses three goals — magic, reliability, and cheap-model economics — into one self-reinforcing system, with the theme system as the keystone.

## 2. What the production path does today (grounded)

- **Protocol:** streamed SEARCH/REPLACE edits. The model emits fenced code blocks tagged with a file path containing `<<<<<<< SEARCH / ======= / >>>>>>> REPLACE` diff markers. Parsed live by `call-ai/v2/fence-body-parser.ts`; applied to an in-memory VFS by `applyEdits` in `vibes.diy/api/svc/intern/prompt-streaming.ts`.
- **Streaming:** raw SSE tokens flow through a bespoke transform pipeline (`createLineStream → createDataStream → createSseStream → createDeltaStream → createSectionsStream`, `prompt-chat-section.ts:1520`), are grouped into closed code blocks by `createBlockAccumulator`, applied as each block closes, and emitted to the browser over WebSocket (`appendBlockEvent`, `emitMode: "emit-only"`). The preview re-mounts as edits land.
- **The "strange experience":** a `SEARCH` block must echo the _exact existing bytes_ of the file to anchor an edit. Small mismatches are routine (the model works from memory, not the live buffer), so the **recovery engine** fires a mid-stream continuation re-prompt with a VFS snapshot, up to 3 tries (`prompt-chat-section.ts:1754`). The stream visibly stalls and re-does work. This is a _textual_ failure mode with nothing to do with code quality — and it is concentrated in **edit turns** (a first-turn generation is a whole-file `create`, which has nothing to anchor against; `fence-body-parser.ts:118`).
- **Models:** strong closed models — `anthropic/claude-opus-4.8` primary, `google/gemini-3.1-pro` fallback (`models.json`) — through a single OpenRouter-compatible backend (`default-llm-request.ts`). Transient retry + model fallback already exists at the orchestration layer (`prompt-chat-section.ts:151–620`). No provider-routing/tool-call awareness.
- **No build/render feedback loop.** Generated code is never compiled, type-checked, or rendered server-side and re-prompted on error. The only loops are structural-recovery (edit-apply) and a runtime crash-report path the model can be handed after the fact.

**Key insight:** SEARCH/REPLACE is an optimization for editing _large_ files. Vibes deliberately makes _small_ files ("Keep your component file as short as possible"). So the product pays the protocol's entire cost — anchoring brittleness, recovery stalls, the strange experience — for almost none of its benefit. For short mini-app files, whole-file rewrites are simpler, more reliable, cheaper for weak models, and the token overhead is negligible.

## 3. The theme system is the keystone (grounded)

The theme system is the deterministic part of a vibe — and the infrastructure to apply it _independently of generated code already exists_.

- **47 themes** (`prompts/pkg/themes/index.ts`), each with instant tokens (`accentColor`, `bgColor`, `bodyFont`) plus a full colorset YAML (canonical token → oklch/hex, light + dark) and a structural `.md` (typography, spacing, radius + prose).
- **Theme is chosen at pre-allocation** — a fast, cheap LLM call _before_ codegen (`pre-allocate.ts:107`) returns a validated theme slug; the user can override via the palette picker.
- **A code-independent style channel already ships.** The runtime injects a `<style id="vibe-color-override">` into the iframe `<head>` via postMessage, with `!important` on every token, restyling a _running_ app in **<100ms with no codegen, no LLM** (`VibeContext.tsx:31-50,171-178`; bridge in `srv-sandbox.ts:246`). Today it powers live palette edits.
- **A Tailwind remap already ships.** A second injected stylesheet maps `rounded-md`, `p-4`, `text-lg`, `font-sans` → canonical theme variables (`VibeContext.tsx:184`), so even literal-Tailwind apps re-theme without regeneration. This is the embryo of a deterministic design system.
- **The prompt already separates style from structure:** _"Applying or switching a theme restyles the app; it must NEVER rewrite it"_ (`prompts.ts`).

Today the model still **hardcodes** values (`bg-[#dcbfa6]`, self-authored `:root`). The deterministic layer carries color but the model invents most of the look.

## 4. Architecture: stage and backstage

The governing principle is the magician's: run two layers at once.

- **Backstage (the truth):** whole-file generation → verify (build + render + theme-conformance) → fix. Guarantees the _result_.
- **On-stage (the performance):** the smooth, diffusion-esque materialization the user falls in love with. Controls the _experience_.

Today these are welded together, so when the truth stutters, the magic breaks in front of the audience. We decouple them. The rule that keeps it honest rather than hollow: **illusion in the process, honesty in the result.** The user always gets a real, working, on-theme app; we control how it appears.

This split is what lets all three goals coexist: the cheap model's failures happen backstage and are fixed before the curtain; the theme paints the stage instantly; the materialization stays magical because the seams are hidden, not because the result is faked.

## 5. Components

Each unit has one purpose, a defined interface, and can be built and tested on its own. The new codegen path lives behind a flag, parallel to the existing SEARCH/REPLACE path, so nothing about production users changes.

### 5.1 Generation core — whole-file tool-loop

- **Purpose:** replace streamed SEARCH/REPLACE with a `write_file` tool loop that produces whole files and reacts to verify feedback.
- **Mechanism:** `@openrouter/agent` `callModel` with a `write_file({path, contents})` tool whose `execute` runs the verify gate and returns `{ ok, feedback }`. Bounded by `stopWhen: [stepCountIs(n), maxCost(usd)]`, plus a clean-verify success. This is the same SDK and shape already proven in `eval/codegen-agentic/src/agentic.ts`.
- **Streaming preserved:** the file body streams as the tool-call's argument deltas (`response.function_call_arguments.delta`), consumed via `getItemsStream()` (render `message`/`function_call` items by replacing on `item.id`). The diffusion materialization survives the re-protocol.
- **Depends on:** the verify gate (5.2), the model router (5.3), `@openrouter/agent`.

### 5.2 Verify gate — the truth layer (quality ladder)

- **Purpose:** decide whether a generated app is good enough to reveal, and produce actionable feedback for a fix turn when it is not.
- **Rung 1 — structural/build check:** esbuild parse, default export present, relative imports resolve, bare imports treated as external (port `eval/codegen-agentic/src/build-check.ts`). **Extended** with theme-token conformance: does the app use the theme's canonical token vocabulary?
- **Rung 2 — headless render check (the impression-maker):** mount the app in the _fixed_ runtime, assert it renders without crashing (no white screen). Feasible only because the stack is enforced — a general-purpose competitor cannot do this cheaply. This is the piece that makes "it always works" real.
- **Interface:** `verify(files, theme) → { ok, problems: string[] }`. `problems` is fed straight back into the tool loop as the next-turn message (port the shape of `feedback.ts`).
- **Depends on:** the fixed runtime / sandbox, the theme token vocabulary.

### 5.3 Model router — value engineering

- **Purpose:** spend the frontier model where it creates delight (design) and the cheap model where it creates volume (edits/fixes).
- **Mechanism:** `@openrouter/agent` dynamic `model: (ctx) => ...` keyed on `ctx.numberOfTurns` / work-type. First turn (design-heavy scaffold) → frontier model (`claude-opus-4.8` / current primary). Edit and fix turns → cheap downshift candidate (chosen via the eval). Routing is on turn-index/work-type, not cumulative cost (`TurnContext` exposes neither).
- **Reliability:** lean on OpenRouter Auto Exacto / the `:exacto` variant for tool-calling provider quality; reuse the eval's `retryWithBackoff` + `isTransientError` for transient provider errors (mid-stream `finish_reason: "error"` at HTTP 200 counts as transient).
- **Caveat to document:** switching models mid-loop invalidates the model-scoped prompt cache; for a large system prompt this is a real per-handoff cost. Mitigations: prompt caching keyed per model, or a one-model main loop with the cheap model as a subagent for sub-tasks.

### 5.4 Theme as deterministic substrate (bold)

- **Purpose:** make the theme own the visual identity deterministically, so the model generates _structure_, not styling.
- **Semantic tokens:** rewrite the styling instructions in `prompts/pkg/system-prompt-initial.md` / `system-prompt.md` so the model emits **semantic token classes** (`bg-surface`, `text-primary`, `rounded`) instead of hardcoded brackets and a self-authored `:root`.
- **Extended remap:** extend the runtime Tailwind remap (`VibeContext.tsx:184`) to comprehensively map the full token set — color + spacing + radius + typography — so any generated structure is painted by the theme.
- **Verify oracle:** rung-1 conformance checks the app speaks the theme vocabulary (the app already publishes its `:root` tokens back, `VibeContext.tsx:86`).
- **Payoff:** beautiful cold open, far smaller target for cheap models, total/instant re-theming, trivial design verification — all at once.

### 5.5 Stage layer — the performance (where the impression lives)

- **Purpose:** the visible magic. A client-side presentation layer that consumes generation/verify events and owns the frame-by-frame experience.
- **Themed cold open:** the instant pre-alloc returns a theme, fire the existing color-override channel at frame zero — the preview materializes in the real theme _before any app code exists_. Motion is **parametric**, driven by each theme's tokens (scales across all 47 without bespoke per-theme work).
- **Steady-hand smoothing:** buffer the bursty arriving item/token stream and re-emit into the preview at a smooth, designed cadence — slightly faster than readable, never stalling. Felt-time becomes a designed variable, not a network side effect. (Erases a large fraction of today's "strange" feeling on its own.)
- **Stream-the-build, gate-the-commit:** stream the materializing structure into the themed stage, but only make the app _canonical_ — interactive, persisted, remixable — when verify passes. The streamed draft is the performance; the verified file is the truth.
- **Fix-as-settling:** present a verify-fix turn as the final sharpening pass of the diffusion (details resolving, the app settling into itself), not a recovery stall. Same backstage event, opposite on-stage emotion.
- **Depends on:** generation core events, verify gate result, the theme override channel.

## 6. End-to-end data flow

1. User submits a prompt → pre-alloc selects theme + enriches (exists).
2. **Client fires the themed cold open** — the preview materializes in the real theme via the override channel (new use of an existing mechanism).
3. Server runs the generation core with the frontier model: `write_file` tool, streamed items.
4. **Stage layer** renders the streaming structure into the themed stage with steady-hand smoothing.
5. Verify gate runs on each `write_file`; on `!ok`, the loop fires a fix turn (cheap model), presented as settling.
6. On clean verify, the app **commits/reveals** — becomes interactive, persisted, remixable.
7. Subsequent edit turns route to the cheap model through the same loop and stage.

## 7. Error handling & edge cases

- **Transient provider errors:** `retryWithBackoff` + `isTransientError`; mid-stream `finish_reason: "error"` treated as transient.
- **Tool-calling provider variance:** Auto Exacto / `:exacto`; optionally pin `provider.order`/`only` for reproducibility in the eval.
- **Verify never converges** (hits `stepCountIs`/`maxCost`): reveal the last build-passing version if one exists; otherwise hold a tasteful "still cooking" stage state rather than reveal a broken app. The stage must _never_ promote an unverified app to canonical.
- **Total generation failure:** the cold-open stage + a graceful message; never a white screen.
- **Stage/backstage desync:** the performance is non-load-bearing; canonical state is only ever the verified file.

## 8. Validation

- **Eval (parallel confidence, cheap, we own the rig):** extend `eval/codegen-agentic` with the frontier model + candidate cheap models, one-shot vs whole-file-loop, on the real prompt corpus, measuring `$/acceptable-app` **and** build/render-pass. This confirms the downshift economics and picks the cheap model _before_ relying on it.
- **Preview deploy (the real gate):** the PR triggers a CI preview link (a production copy of the branch). Chris, the technical manager, and real users test the magic feel directly. Success = a _significant, demonstrable_ impression — the materialization is smoother, the result reliably works and looks on-theme, and the strange recovery experience is gone.
- **Unit tests:** verify gate (build + render + theme conformance), steady-hand smoothing cadence, extended Tailwind remap token coverage.

## 9. Scope

**In (experimental PR):**

- New whole-file `write_file` tool-loop codegen path, behind a flag, parallel to SEARCH/REPLACE.
- Verify gate: rung-1 build/structure + theme conformance, plus a rung-2 render smoke check.
- Model router: frontier first turn, cheap edit/fix turns.
- Theme-as-substrate: semantic-token styling in the prompt + extended runtime remap.
- Stage layer: themed cold open, steady-hand smoothing, gate-the-commit, fix-as-settling.
- Eval extension for the downshift economics.

**Out (future, explicitly deferred):**

- Vision-model design-check rung.
- Bespoke per-theme choreography (we ship parametric, token-driven motion).
- Production cutover and migration of existing vibes to semantic tokens (the remap partially covers legacy literal-Tailwind apps).
- Replacing the existing SEARCH/REPLACE path (it stays; the new path is additive and flagged).

## 10. Risks & mitigations

- **Replacing Chris's subtle streaming pipeline.** Mitigated by branch + preview; production users are untouched. The new path is additive and flag-gated.
- **Whole-file token cost vs diffs.** Offset by small files + cheap models; measured directly on the eval before relying on it.
- **Semantic-token migration of legacy vibes.** Out of scope for the PR; the existing remap already re-themes literal-Tailwind apps, softening the gap.
- **Tool-arg streaming reliability across OpenRouter providers** (`eager_input_streaming` is likely-but-unverified). Validate on the preview; fall back to a chunked reveal if a provider buffers tool arguments.
- **The magic must actually feel magical** — subjective. The preview + real-user testing is the gate, and the design biases toward visible-impact pieces (themed cold open, render-verify reliability, fix-as-settling) precisely so the impression is unmistakable.

## 11. Prior art in this repo

- `eval/codegen-agentic/` — the proven write_file-loop + build-check + feedback core, and the validation rig.
- `docs/superpowers/specs/2026-06-24-codegen-agentic-tenability-eval-design.md` — the eval design.
- `docs/superpowers/specs/2026-06-24-codegen-agentic-harness-hardening-design.md` — transient-retry/preflight reliability work.
- `prompts/pkg/themes/` + `vibes.diy/vibe/runtime/VibeContext.tsx` — the theme catalog and the code-independent style channel this design promotes into the substrate.
