# Whole-file experience: theme selection, themed cold open, reconnect convergence — Design

- **Date:** 2026-06-26
- **Status:** Approved in brainstorm (2026-06-26)
- **Branch:** experiment/codegen-magic-harness
- **Relates to:** PR VibesDIY/vibes.diy#2650 (whole-file agentic codegen, `USE_WHOLE_FILE_CODEGEN`), the magic-harness design (`docs/superpowers/specs/2026-06-25-codegen-magic-harness-design.md` §3, §5.4, §5.5), composable theme fidelity (`docs/superpowers/specs/2026-06-17-composable-theme-fidelity-design.md`, #2356, merged)

## Motivation

The experimental flag-gated whole-file codegen path (`USE_WHOLE_FILE_CODEGEN`) shipped the reliable generation core but skipped three things the production SEARCH/REPLACE path has. On the preview, browser testing surfaced all three:

1. **Every generation comes out with the same default theme.** The whole-file dispatch never runs pre-allocation, so no theme slug is selected or threaded into the agentic prompt — `{{THEME_DESIGN}}` resolves to empty and the prompt falls back to the default `stylePrompt` ("brutalist web") on every generation. Apps differ in content but share one visual identity.
2. **Long, blank time-to-paint.** The app preview only paints when `App.jsx` fully completes (no incremental compile; explicitly out of scope in the per-line diffusion design). Measured ≈30–34s of blank canvas for the _simplest_ app; 60–120s for typical 600–1300-line apps. There is no themed cold open — the magic-harness §5.5 idea ("the preview materializes in the real theme before any app code exists") is unbuilt, and the runtime color-override channel only fires on manual palette edits, never on fresh generation.
3. **A reconnect mid-generation wedges into a frozen "Reconnecting…" + blank canvas.** Recoverable only by a full reload. Generation succeeds server-side; the live view never converges.

These chain together: the long blank window (2) is exactly what gives the 45s watchdog time to trip into the reconnect path (3), and a default-only theme (1) makes the would-be cold open worthless. Fixing all three as one coherent change closes the gap between the whole-file path and a magical, reliable experience.

The priority order from the magic-harness design holds: **Fast → Fun**, and **never a white screen**.

## Grounded root causes

### 1. Theme selection — the whole-file path never runs pre-allocation

- The SEARCH/REPLACE / dry-run path runs `preAllocate(vctx, { prompt })` and threads the result `{ skills, theme, title, enrichedPrompt }` into assembly via `activeSettingsOverride` (`vibes.diy/api/svc/public/prompt-chat-section.ts:2095-2103`, fed to `assemblePromptPayload` at `:2110-2127`).
- The whole-file creation branch dispatches with `sessionDoc: { userPrompt }` only (`prompt-chat-section.ts:~2308`). No `preAllocate()` runs.
- `makeBaseSystemPrompt(model, { variant: "agentic-whole-file", … })` therefore receives an undefined theme, so `{{THEME_DESIGN}}` (placeholder present at `prompts/pkg/system-prompt-agentic.md:28`) is replaced with empty, and the prompt uses the default style.
- Theme **data** is healthy: composable theme fidelity (#2356) is merged — all 44 colorsets are complete and theme-true (`prompts/scripts/rebuild-colorsets-from-exemplars.mjs` present; commits `4d793e22a`, `b5ca3ff43`, `8c2e1ddd0`). So once a slug is threaded, themes are both varied and high quality. This is a wiring gap, not a data gap.

### 2. No themed cold open

- The runtime color-override channel (`vibes.diy/vibe/runtime/VibeContext.tsx`, bridge `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`) restyles a _running_ app in <100ms, but is only invoked on manual palette edits (`vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx:287-353`), never on fresh generation.
- The app preview cannot render partial JSX, so first paint waits for the full `App.jsx`. With no cold open, the preview area is a blank grid for the entire generation.

### 3. Reconnect convergence — the missing `fsRef` on the whole-file `block.end`

- The 45s stream watchdog (`vibes.diy/pkg/app/hooks/useStreamWatchdog.ts:7`) flips `connection → "reconnecting"` on silence while a turn is in flight (`vibes.diy/pkg/app/routes/chat/prompt-state.ts:258-259`).
- That state only settles back to `"live"` on a canonical `block.end` carrying `fsRef` (`prompt-state.ts:330-338`, gated on `!!block.fsRef`).
- The whole-file handler emits its live terminal `block.end` built from `buildBlockEvents` **before** persist, so it has no `fsRef` (`vibes.diy/api/svc/public/handle-whole-file-codegen.ts:403-404`), and after persisting (`:419-426`) it returns without re-emitting a `block.end` carrying `fsRef`.
- The production path _does_ re-emit post-persist with `fsRef` (`prompt-chat-section.ts:1389`, `evt: { ...value, fsRef: r.Ok().fsRef.toValue() }`). The whole-file path lacks this, so once it goes "reconnecting" it can never settle → frozen spinner + blank live view until reload.

## Design

Three threads in one change. They reinforce each other (see Data flow).

### Thread 1 — Run pre-allocation on the whole-file path and thread the theme

- In the whole-file creation branch (`prompt-chat-section.ts`, before dispatching to `handleWholeFileCodegenRequest`), run `preAllocate(vctx, { prompt: userText })` — the same call the SEARCH/REPLACE path uses.
- Pass the result into the handler's `sessionDoc`: `{ userPrompt, theme: pre.theme, skills: pre.skills, title: pre.pairs[0]?.title, enrichedPrompt: pre.enrichedPrompt }`, so `makeBaseSystemPrompt({ variant: "agentic-whole-file", … })` fills `{{THEME_DESIGN}}` and the skills/enriched-prompt slots. `pre.theme` is the theme **slug**; the colorset is resolved from it (the same resolution the SEARCH/REPLACE path uses).
- Persist the chosen theme slug into `app_settings.active` and emit it to the client immediately via the existing `set-theme` (slug) / `set-color-theme` (resolved colorset) events the production path already emits (the reducer handles `isSetTheme` / `isSetColorTheme` in `prompt-state.ts`). This makes the theme available to: the cold open (Thread 2), reload hydration, and the palette picker.
- Pre-allocation runs at the call site; the handler stays a pure orchestrator (pre-alloc is injected as data, not called inside the handler).
- **Failure handling:** on pre-alloc failure, fall through to a neutral default theme exactly as the dispatch path does today (`prompt-chat-section.ts:2104-2106` pattern) — never block generation.

### Thread 2 — Themed skeleton cold open

- As soon as pre-alloc returns the theme (~1–2s, before any code), the client renders a **`<ThemedSkeleton>`** in the preview pane: a generic app shell — header bar, two card placeholders, a button — styled entirely by the pre-allocated theme's canonical tokens (color / font / radius / spacing from the now-complete colorset).
- **Parametric, not per-theme:** the skeleton reads theme tokens, so it scales across all 47 themes with zero bespoke work. Static (no motion) in this scope.
- **Rendered as a client React component over the preview area** (`ResultPreview` / `PreviewApp`), not injected into the sandbox iframe — there is no app in the iframe yet at frame zero, so a client component is simpler and decoupled from the sandbox. Shown while `running && !appPainted`; removed when the real app paints on `code.end` / the first-paint iframe repoint.
- The theme tokens reach the client via the `set-theme` / `set-color-theme` events from Thread 1 plus the existing colorset bundle available client-side.

### Thread 3 — Reconnect convergence (`fsRef` re-emit)

- After `handlePromptContext` persist in `handle-whole-file-codegen.ts` (`:419-426`), re-emit the canonical `block.end` to the wire carrying `fsRef: rPersist.Ok().fsRef.toValue()`, mirroring `prompt-chat-section.ts:1389`.
- This satisfies the client settle (`prompt-state.ts:337`): `connection` goes `reconnecting → live`, the spinner clears, and the iframe repoints for first paint (the `fsRef` block.end is also the first-paint-nav / iframe-repoint anchor).
- The earlier (pre-persist) live `block.end` stays as the card-finalize signal; the post-persist re-emit is the additional convergence anchor, matching how the production path behaves. The reducer appends `block.end` events; the re-emit must be idempotent at the reducer level (same `blockId` / section identity), verified by test.

## Data flow (combined)

1. User submits → pre-alloc selects theme + enriches (**now on the whole-file path too**).
2. Server persists + emits the theme → **client paints the themed skeleton** at frame ~0.
3. Whole-file loop streams completed lines live (diffusion reveal); the skeleton holds the preview stage.
4. `code.end` + **post-persist `block.end` with `fsRef`** → iframe repoints, the real app paints, the skeleton is removed, `connection` settles to `live`.
5. A reconnect mid-generation → the skeleton keeps the preview non-blank and the client's blocks changing; the post-persist `fsRef` `block.end` converges the live view. Never blank, never wedged.

## Error handling & edge cases

- **Verify-failing file set:** existing behavior — refuse to persist (`handle-whole-file-codegen.ts:343-346`). The skeleton stays, then a graceful themed "couldn't build" state; never a white screen (magic-harness §7).
- **Pre-alloc failure:** neutral default theme; generation proceeds. The cold open still paints (in the default theme), never blank.
- **Reconnect:** covered by the skeleton (non-blank) + the `fsRef` convergence (settles the spinner).
- **Flag off / SEARCH/REPLACE path:** unchanged. All three threads are scoped to the whole-file path; the cold open is gated on the whole-file flow.

## Testing

- **Thread 1:** unit/integration test that the pre-alloc theme reaches the agentic prompt (`{{THEME_DESIGN}}` non-empty for a whole-file creation turn); preview spot-check that varied prompts produce varied themes.
- **Thread 2:** render test for `<ThemedSkeleton>` — theme tokens applied; visible while `running && !appPainted`, gone on paint; browser test on the preview (instant themed paint, never a blank grid).
- **Thread 3:** reducer convergence test (settles to `live` on an `fsRef` `block.end` after a `reconnecting` state) + handler test (a post-persist `block.end` with `fsRef` is emitted, idempotent at the reducer); browser reconnect test (no frozen spinner, converges without reload).

## Scope

**In:**

- Pre-allocation + theme persistence/emit on the whole-file path (Thread 1).
- Static themed-skeleton cold open, parametric by theme tokens (Thread 2).
- `fsRef` `block.end` re-emit + convergence/handler tests (Thread 3).

**Out (explicit follow-ups):**

- Parametric **motion** / diffusion shimmer / fix-as-settling (magic-harness §5.5 option C).
- Deeper mid-generation live re-streaming beyond convergence (re-hydrating in-flight blocks on reconnect, vs. converging on the persisted sequence).
- Applying the cold open to the production SEARCH/REPLACE path.
- Incremental mid-file compile / partial-JSX render.

## Files touched (anticipated)

- `vibes.diy/api/svc/public/prompt-chat-section.ts` — run `preAllocate()` in the whole-file branch; thread `{ theme, colorTheme, skills, title, enrichedPrompt }` into the handler `sessionDoc`; persist + emit the theme.
- `vibes.diy/api/svc/public/handle-whole-file-codegen.ts` — post-persist `block.end` re-emit with `fsRef`.
- `vibes.diy/pkg/app/components/ResultPreview/` (`PreviewApp.tsx` / `ResultPreview.tsx`) — render `<ThemedSkeleton>` while generating; drop on paint.
- `vibes.diy/pkg/app/components/ResultPreview/ThemedSkeleton.tsx` — new, parametric themed skeleton.
- `vibes.diy/pkg/app/routes/chat/prompt-state.ts` — confirm `set-theme` / `set-color-theme` flow feeds the skeleton; no settle-logic change (already gated on `fsRef`).
- Tests: a reducer convergence test, a handler `fsRef` re-emit test, a `<ThemedSkeleton>` render test, and a theme-threading test for the agentic prompt.
