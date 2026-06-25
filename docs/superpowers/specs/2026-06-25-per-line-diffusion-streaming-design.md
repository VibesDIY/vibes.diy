# Per-line diffusion streaming for whole-file codegen

- **Date:** 2026-06-25
- **Status:** Design approved; ready for implementation plan
- **Branch:** experiment/codegen-magic-harness
- **PR:** VibesDIY/vibes.diy#2650
- **Flag:** USE_WHOLE_FILE_CODEGEN (default off; preview label `preview:whole-file-codegen`)

## Problem

The flag-gated whole-file codegen path (the agentic `write_file` tool-loop) currently reveals all code at once when generation finishes. We want the code to **materialize line-by-line as the model writes it** — the "diffusion" reveal — without re-introducing the client crash that an earlier streaming attempt caused.

## Findings that shape the design

An on-preview diagnostic (commit `a54a5e736`, `/_streamdiag` card) measured how the SDK's full-response stream is delivered under workerd for a 991-line `App.jsx` + 43-line `access.js` turn:

- **first delta at 18.4s, last at 79.9s, 21 deltas total.**

Interpretation:

- The beta-responses SSE body **does** stream incrementally under workerd (deltas spread across a 61s window), overturning the earlier "fully buffered" conclusion. That conclusion was a reverse-engineering error / run-variance.
- Delivery is **coarse**: ~21 chunks of ~50 lines each, roughly one every ~3s, after an ~18s initial model-planning silence. Cloudflare/workerd coalesces the SSE body into ~1.5KB flushes; it is not per-token.
- All `@openrouter/agent` stream accessors (`getItemsStream`, `getFullResponsesStream`, `getToolStream`) consume one shared broadcaster over a single `reusableStream`, so the granularity is a transport property, not a method choice. The loop consumes the **documented** `getFullResponsesStream` (`response.function_call_arguments.delta`), surfaced via the OpenRouter SDK skill.

Therefore: genuine per-line diffusion = an incremental (chunky) server stream + a **client-side smoothing layer** that paces the chunks into a steady line-by-line reveal (the design doc's "stage layer").

## Architecture & data flow

```
model → OpenRouter SSE → workerd (coarse ~50-line chunks)
  → getFullResponsesStream → makeLineEmitter → onLine(file,lang,line,nr)   [loop, done]
  → handler emits block.begin(lazy)/code.begin(reveal)/code.line/code.end/block.end   [① server]
  → WebSocket → client dispatch → promptState.blocks → MessageList
  → CodeMsg holds all received lines, reveals them paced                   [② ③ client]
```

**The reveal contract:** the server emits `code.line` as chunks arrive (few wire events, chunky). The client receives them all into `promptState.blocks`, but does **not** display them immediately. `CodeMsg` owns a per-section "revealed count" that a `requestAnimationFrame` loop walks toward the total at a steady rate; it renders only `lines.slice(0, revealedCount)`. Display pace is decoupled from network pace — a client-side buffer-drain typewriter.

Three layers:

1. **Server/handler** — re-add live `onLine` emission with safe framing.
2. **CodeMsg reveal** — un-collapse the card body during streaming so lines show.
3. **Reveal controller** — the paced drain inside `CodeMsg`.

## ① Server/handler streaming

Files: `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts` (done), `vibes.diy/api/svc/public/handle-whole-file-codegen.ts`.

- The loop already drives `onLine` from `getFullResponsesStream` argument deltas (diagnostic commit). Keep; drop the `streamDiag` surfacing once the feature lands (the measurement field may stay for logging).
- The handler emits a **continuous, self-framed** stream:
  - lazy `block.begin` on the **first** `onLine` (block.begin travels with the code, never hoisted to turn start — the crash lesson);
  - `code.begin` (carrying `reveal: "typewriter"`) on first sight of each file; close the previous file's section before opening the next (never interleave);
  - `code.line` per emitted line;
  - after the loop: close the open section, emit any file that produced no streamed line as a full section, then `block.end`;
  - persist `buildBlockEvents(result.files)` (also carrying the `reveal` marker) via `handlePromptContext`, unchanged.
- **Remove the diagnostic `/_streamdiag` card.**
- **Keepalive:** a `block.begin` heartbeat runs only until the first `onLine` (covers the ~18s plan gap; stops on the first line so it never wipes an in-progress card). Within a turn the ~3s delta cadence keeps the watchdog alive.
- **Crash-safety:** continuous `code.line` means no silent gap → no mid-turn reconnect → no race. If a run buffers, `onLine` fires at the end → the same self-framed burst as today's safe reveal. This brings the path to **parity with the production SEARCH/REPLACE streaming path**, which emits the same event types and handles reconnect correctly. Residual: a `>45s` pause *within a single file* (between its `code.begin` and `code.end`) could still reconnect mid-section; the measured ~3s cadence makes this effectively impossible, and it is the same risk the production path already carries.

## ② CodeMsg reveal + gate

File: `vibes.diy/pkg/app/components/MessageList.tsx` (`CodeMsg`, ~lines 269-397).

- Gate: add an optional `reveal?: "typewriter"` field to `CodeBeginMsg` in `call-ai/v2/block-stream.ts` (additive, backward-compatible). The whole-file handler sets it; the production path does not. `CodeMsg` checks `begin.reveal === "typewriter"`.
- When gated on **and** streaming: un-collapse the card body (remove the `h-0 max-h-0 min-h-0 opacity-0` collapse and the `lines.slice(0,3)` cap) and render the revealed lines with per-line keys.
- When the turn completes (or the marker is absent): keep today's behavior — collapse back to the "N lines /path" summary. Finished-state and production UX are unchanged.

## ③ Reveal controller

A `useTypewriterReveal(totalLines, isStreaming)` hook (new file `vibes.diy/pkg/app/hooks/useTypewriterReveal.ts`, alongside `useStreamWatchdog`), used inside `CodeMsg`:

- Maintains `revealedCount`; a `requestAnimationFrame` loop advances it toward `totalLines`.
- **Steady base rate** ~24 lines/s. **Adaptive catch-up:** if the backlog (`totalLines - revealedCount`) grows large, increase the rate (capped) so the reveal does not lag far behind generation. **Pause** when caught up (`revealedCount === totalLines`) while still streaming.
- **Accelerate-to-finish:** when `isStreaming` goes false, clear any remaining backlog within ~1–2s, then settle at `totalLines`, so "done" never lags far behind the model.
- State persists per `CodeMsg` instance (stable `sectionId` React key) across MessageList re-renders.
- `CodeMsg` renders `lines.slice(0, revealedCount)`.

## App preview

Unchanged. `PreviewApp` hot-swaps per completed file (`code.end`); partial JSX cannot compile. So **the code diffuses; the app snaps in when each file completes.** A themed skeleton during the plan gap and incremental compile are explicitly out of scope.

## Gating & rollout

- Behind the existing `USE_WHOLE_FILE_CODEGEN` flag + `preview:whole-file-codegen` label (already wired).
- The client reveal is gated per-block by the `reveal` marker, so production code cards are untouched.

## Testing

- **Loop** (`whole-file-loop.test.ts`): done — event-contract mocks (`function_call_arguments.delta` / `output_item.added`), `onLine` per line, `streamDiag` count.
- **Handler** (`handle-whole-file-codegen.test.ts`): add a streaming-`onLine` case asserting the self-framed ordering invariant (lazy `block.begin`, per-file framing, no interleave, `code.end` never before its `code.begin`), the `reveal` marker on `code.begin`, and verbatim persistence. Keep the buffering-fallback and heartbeat tests.
- **Reveal controller**: unit test that `revealedCount` paces toward `totalLines`, pauses when caught up, and clears the backlog quickly when `isStreaming` goes false (fake timers / rAF stub).
- **CodeMsg**: render test that a gated card shows the revealed subset and an ungated card is unchanged.
- **Browser**: validate on the preview — lines diffuse smoothly, no "Reconnecting", no `sectionId` crash, app renders, reload converges.

## Out of scope / deferred

- Finer transport granularity (per-token) — not needed; client smoothing makes transport granularity moot for the visual.
- App-preview progressive rendering / themed cold-open skeleton.
- Applying the reveal to the production SEARCH/REPLACE path (gated off by decision).
