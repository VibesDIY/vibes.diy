# Resume state — PR #2650 (whole-file codegen magic), 2026-06-26 EOD

> **To resume:** new session in this repo, paste: *"Read `docs/superpowers/2026-06-26-pr2650-resume-state.md` and continue."*

## One-line status

The themed-cold-open **foundation + correctness cleanup is shipped, browser-verified, CI-green** on PR #2650 (still draft). A **new, confirmed bug** is mid-investigation: **generated apps don't cohere to the selected theme — they render the default (brutalist) style.** Root cause localized (systematic-debugging Phase 1 complete); the next step is a Phase-3 fix-and-verify on the agentic prompt template. **Do NOT start coding before reading "The open bug" + "Next action" below — and answer the one open question first.**

## Coordinates

- **Branch:** `experiment/codegen-magic-harness` · **PR:** VibesDIY/vibes.diy#2650 (draft, labels `agent-created`, `preview:whole-file-codegen`)
- **HEAD:** `6186a8660` (pushed; `compile_test`/`deploy-preview`/`pg` all green — the green runs report merge-commit SHAs `f7e37f2`/`26373f2`, which is why a head-SHA filter looks empty)
- **Preview:** https://pr-2650-vibes-diy-v2.jchris.workers.dev (logged in as `marcus-e`; browser tools available)
- **Flag:** `USE_WHOLE_FILE_CODEGEN`; first-creation-turn only.
- **Decision doc:** `docs/superpowers/specs/2026-06-26-pr2650-delivery-decision.md`
- **Plan (done):** `docs/superpowers/plans/2026-06-26-pr2650-themed-coldopen-foundation.md`
- **Parent handoff:** `docs/superpowers/2026-06-26-pr2650-delivery-handoff.md`

## What shipped this session (done, verified)

Delivered via an ultrapowers parallel run (8 tasks, 3 waves, acceptance waived — browser pass is verification of record). Integration fast-forwarded onto the PR branch.

1. **`prompt.section-theme` wire event** (`api/types/prompt.ts`) — pre-allocated theme reaches the client at stream START (was reload-only, in BOTH paths). Pure builder `api/svc/intern/codegen-loop/section-theme-event.ts`; emitted first in `handle-whole-file-codegen.ts`; client translation `pkg/app/hooks/section-theme-actions.ts` → `dispatch(setTheme)` in `useChatSession.ts`. Production never emits it → flag-off identical.
2. **3 correctness fixes** in `whole-file-loop.ts`: `\uXXXX` unicode-escape crash; EOF flush of the trailing line; verify-before-commit in the `write_file` executor.
3. **First-creation-turn gating** regression test (Codex P1 was already gated on HEAD — confirmed stale).
4. **rules-bag remnants** (`useTypewriterReveal.ts`, `PreviewApp.tsx`); `chatId: req.chatId` threaded into the section-theme emit.
5. **PR description** rewritten honestly (applied via `gh pr edit`).

**Browser-verified:** theme name renders live in the toolbar during a fresh gen ("Neon Arcade", "Hearth Sim" — impossible before); cold-open skeleton renders (caught it once); apps render + functional; reconnect graceful (no sectionId crash). Recordings downloaded: `pr2650-whole-file-coldopen-browser-pass.gif`, `pr2650-latest-preview-test.gif`.

## THE OPEN BUG (investigation in progress — start here tomorrow)

**Symptom (confirmed by Marcus on the preview):** the generated app does NOT cohere to the selected theme. Whatever theme the toolbar shows ("Neon Arcade" etc.), the rendered app is the **default brutalist** look — bold black borders, mono-uppercase, R/Y/G/B accent bars — only the prompt's own color *words* leak through. Three test apps: synthwave (neon-pink/dark), gratitude (purple/dark), lemonade (cream-yellow/light) — palette varied but **structure stayed default brutalist**.

**Phase-1 root-cause findings (systematic-debugging; all evidence is static + one passing repro test):**
- ✅ Boundary A — pre-alloc picks a valid slug, persists `{type:"active.theme", theme:<slug>}` (`ensure-chat-id.ts:328`). "Neon Arcade"→slug `neon`, "Hearth Sim"→slug `hearth`; both valid (`themes/index.ts:113,142`), both have `.md` files.
- ✅ Boundary B — `loadActiveSettings` → `buildWholeFileSessionDoc` copies slug into `sessionDoc.theme` (`whole-file-session-doc.ts:20`).
- ✅ Boundary C (assembly) — **RULED OUT as a code bug.** Wrote a throwaway repro (since deleted): `makeBaseSystemPrompt({theme:"neon", variant:"agentic-whole-file", fetch})` **DOES inject `<theme-design-md>`** (validatedTheme=`neon`, no leftover `{{THEME_DESIGN}}`). The agentic template `prompts/pkg/system-prompt-agentic.md` **does** contain `{{THEME_DESIGN}}` (line 28); it is replaced at `prompts/pkg/prompts.ts:363`.
- ✅ Delivery wiring — `handle-whole-file-codegen.ts:192` computes the prompt, `:349-350` passes `systemPrompt` → `runWholeFileCodegen` → `callModel({instructions})` (`whole-file-loop.ts:215-217`). The model DOES receive the themed prompt.
- ✅ Fetch — whole-file uses the IDENTICAL `createPromptAssetFetch({fetchAsset: vctx.fetchAsset})` as production (`prompt-chat-section.ts:2309` vs `prompt-assembly.ts:270`). Since theming is a shipped, working production feature, the deployed fetch serves theme markdown → the whole-file prompt contains the theme prose. (H-fetch ruled out.)

**ROOT CAUSE (confirmed to the limit static analysis allows):** not the selection/assembly/delivery engine — it's the **agentic prompt template content** defeating the theme for a from-scratch build:
1. `system-prompt-agentic.md:6` hard-codes a DEFAULT classNames example (`const c = { bg:'bg-[#f1f5f9]', ink:'text-[#0f172a]', border:'border-[#0f172a]', accent:'bg-[#0f172a]' }`) — the gray-bg/dark-border/dark-text anchor the model copies = the "default brutalist" look.
2. The `{{THEME_DESIGN}}` block + `system-prompt-agentic.md:9` frame the theme as a **RETHEME of an existing app** ("a theme change restyles the app, never rewrites it; change ONLY styling and leave the app as-is"). On a from-scratch whole-file build there's no app to restyle, so the model treats the theme as a later concern and builds the anchored default. (This guard prose is correct for production *edit* turns but wrong for a first-turn whole-file *build*.)
- The `defaultStylePrompt` fallback at `prompts.ts:336` (`stylePrompt = sessionDoc?.stylePrompt || (themeDesignSection ? "" : defaultStylePrompt)`) is the mechanism that yields brutalist when `themeDesignSection` is empty — but here `themeDesignSection` is NON-empty, so the issue is framing/anchoring, not the fallback.

**Dry-run note:** `chat.prompt(msg,{dryRun:true,dryRunPreAllocate:true})` (`llm-chat.ts:238`) exists but assembles via the PRODUCTION `assemblePromptPayload` (`prompt-chat-section.ts:2112`), BEFORE the whole-file branch (`:2279`) — so it dumps the production prompt, not the agentic one. Useful only as belt-and-suspenders on the shared fetch.

### ⚠️ OPEN QUESTION FOR MARCUS (answer before fixing)

**Do themes cohere on the PRODUCTION (flag-off) first generation today?**
- If **yes** → the fix is purely the agentic template (`system-prompt-agentic.md`): reframe to "BUILD the app IN this theme from the start," drop/neutralize the line-6 default classNames anchor, and gate the retheme-guard prose to edit turns.
- If **no** (production also looks default) → it's a deeper shared prompt-engineering issue; widen the fix beyond the agentic template.

## Next action (Phase 3 — do this after the question is answered)

1. TDD-ish: it's a model-behavior fix, so the real test is **change framing → regenerate on preview → observe**. Minimal change to `prompts/pkg/system-prompt-agentic.md`: (a) reframe the theme section to from-scratch "build in this theme," (b) remove/neutralize the default classNames example on line 6 (or make it explicitly "replace these with the theme's tokens"), (c) scope the retheme guard to edit turns.
2. Keep it ONE change at a time (systematic-debugging Phase 4). Push, let preview deploy, regen 2-3 varied prompts, confirm the app structure/palette actually reflects the theme (not just color words).
3. This is a small, attributable, corpus-adjacent change — exactly the bounded shape Chris asked for.

## Other threads (parked, not blocking)

- **Chris PR comment (scope/bounded-output):** Marcus is workshopping a reply (NOT posted). Draft is in the session above — explains this is a personal lab not autoresearch; names the 3 bundled systems (OpenRouter agent SDK `@openrouter/agent` [new this week, commit `71e3c61ff`]; whole-file codegen; stream-time theming); rationale = chasing time-to-first-meaningful-paint, measuring the systems in unison. Concedes splitting the always-on pieces (#2652 reconnect hardening, #2653 verify gate). **Marcus owns posting.**
- **Held social signals (do NOT do autonomously — tied to Marcus's Chris thread + the open bug):** exit draft, `ready-to-merge` label, @CharlieHelps ping, per-thread replies to stale Charlie/Codex comments. Exit-draft is gated on the theme-coherence bug being fixed + variety settled.
- **AI SDK 7 investigation:** report delivered in-session (qualified yes; strongest reason = typed streamed tool-input would delete our hand-rolled `extractJsonStringField`/`makeLineEmitter`; keep OpenRouter underneath via `@openrouter/ai-sdk-provider@6 alpha`; workerd-compat conditional on `@workflow/serde` — unverified). No action taken; spike not started.
- **Variety isolation (Phase 1 of decision doc):** partly answered by this bug — palette varies, structure doesn't. The agentic-template fix above IS the structural-variety fix. Re-evaluate variety after it lands.
- **CI display quirk:** PR checks panel may show only `dedupe` because the passing runs anchored to merge-commit SHAs; refreshes on next push / leaving draft. `mergeStateStatus: DIRTY` → branch likely needs a rebase on `main` before merge (not urgent while draft).

## Guardrails (unchanged)

Flag-off SEARCH/REPLACE stays behaviorally identical. Preview browser pass is verification of record (unit tests missed every headline gap). Never push to main; rebase don't squash. `pnpm check` = format+build(tsc)+test+lint; `pnpm run rules-bag:constructors` must stay green. Always end a session with a PR (already open: #2650).
