# Per-line Diffusion Streaming Implementation Plan

> **For agentic workers:** Parallel execution: use `ultrapowers:ultrapowers` (this plan carries ultraplan markers). Sequential fallback: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make whole-file codegen materialize code line-by-line as the model writes it (the "diffusion" reveal), driven by an incremental server stream and a client-side typewriter that paces the coarse chunks into a steady per-line reveal.

**Architecture:** The loop already streams `onLine` from `getFullResponsesStream` argument deltas. The handler emits a continuous, self-framed `block.begin(lazy)/code.begin(reveal)/code.line/code.end/block.end` sequence. A new `reveal:"typewriter"` marker on `CodeBeginMsg` gates a client-side paced reveal: `CodeMsg` holds all received lines but renders only `lines.slice(0, revealedCount)`, where `revealedCount` is advanced toward the total by `useTypewriterReveal` (a `requestAnimationFrame` buffer-drain). Production code cards are untouched (they never set the marker).

**Tech Stack:** TypeScript, arktype (`@vibes.diy/call-ai-v2` block-stream schemas), `@openrouter/agent` streaming, React + `requestAnimationFrame`, Vitest (node project `codegen-loop` / `pkg-infra`; browser project `vibes.diy`).

---

## Global Constraints

- **Flag-gated, additive.** The whole-file path stays behind `USE_WHOLE_FILE_CODEGEN` (default off) + the `preview:whole-file-codegen` PR label. The production SEARCH/REPLACE streaming path must stay behavior-unchanged: the typewriter reveal activates ONLY when `CodeBeginMsg.reveal === "typewriter"`, which only the whole-file handler sets.
- **No client crash.** The client section reducer (`vibes.diy/pkg/app/components/MessageList.tsx`) crashes with "Cannot read properties of undefined (reading 'sectionId')" if a `code.end` reaches a block with no open `code.begin`. Every emitted turn must be ONE self-framed sequence — `block.begin → (per file: code.begin → code.line* → code.end) → block.end`, sections never interleaved, `block.begin` emitted WITH the code (lazily on the first line), never hoisted to turn start.
- **Backward-compatible schema.** The new `CodeBeginMsg.reveal` field is optional; existing events and persisted sections without it must continue to validate.
- **Repo conventions.** Rebase, never squash. Run `pnpm check` and `pnpm run rules-bag:constructors` before declaring ready. Never push to main.

---

## Task 1: Add the `reveal` marker to `CodeBeginMsg`

**Type:** implementation
**Depends-on:** none

**Files:**
- Modify: `call-ai/v2/block-stream.ts` (the `CodeBeginMsg` definition, ~line 135)
- Test: `call-ai/v2/reveal-marker.test.ts` (create)

**Interfaces:**
- Produces: `CodeBeginMsg.reveal?: "typewriter"` — an optional literal field on the existing `CodeBeginMsg` arktype.

- [ ] **Step 1: Write the failing test**

Create `call-ai/v2/reveal-marker.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CodeBeginMsg } from "./block-stream.js";
import { type } from "arktype";

const base = {
  type: "block.code.begin",
  sectionId: "s1",
  lang: "jsx",
  blockId: "b1",
  streamId: "p1",
  seq: 0,
  blockNr: 0,
  timestamp: new Date(),
};

describe("CodeBeginMsg.reveal", () => {
  it("accepts a code.begin WITH reveal: 'typewriter'", () => {
    const r = CodeBeginMsg({ ...base, reveal: "typewriter" });
    expect(r instanceof type.errors).toBe(false);
  });

  it("accepts a code.begin WITHOUT reveal (backward compatible)", () => {
    const r = CodeBeginMsg({ ...base });
    expect(r instanceof type.errors).toBe(false);
  });

  it("rejects an unknown reveal value", () => {
    const r = CodeBeginMsg({ ...base, reveal: "sparkle" });
    expect(r instanceof type.errors).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run call-ai/v2/reveal-marker.test.ts`
Expected: FAIL — the "WITH reveal" case errors because `reveal` is an undeclared key (arktype rejects extra keys), or the "rejects unknown" case fails if extra keys are silently allowed. Either way RED.

- [ ] **Step 3: Add the optional field**

In `call-ai/v2/block-stream.ts`, the current definition (~line 135) is:

```ts
export const CodeBeginMsg = type({
  type: "'block.code.begin'",
  sectionId: "string",
  lang: "string",
  "path?": "string",
}).and(BlockBase);
```

Change it to add the optional literal field:

```ts
export const CodeBeginMsg = type({
  type: "'block.code.begin'",
  sectionId: "string",
  lang: "string",
  "path?": "string",
  // Optional reveal hint. Only the whole-file codegen handler sets it; the
  // client gates its paced typewriter reveal on `reveal === "typewriter"`.
  "reveal?": "'typewriter'",
}).and(BlockBase);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run call-ai/v2/reveal-marker.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the existing call-ai v2 suite to confirm no regression**

Run: `pnpm exec vitest run call-ai/v2`
Expected: PASS (existing block-stream / filesystem-stream / code-truncated tests still green).

- [ ] **Step 6: Commit**

```bash
git add call-ai/v2/block-stream.ts call-ai/v2/reveal-marker.test.ts
git commit -m "feat(block-stream): optional reveal:'typewriter' marker on CodeBeginMsg"
```

---

## Task 2: Server handler — live, self-framed per-line emission

**Type:** implementation
**Depends-on:** 1

**Files:**
- Modify: `vibes.diy/api/svc/public/handle-whole-file-codegen.ts`
- Modify: `vibes.diy/api/svc/intern/codegen-loop/emit-blocks.ts` (thread the `reveal` marker through `buildBlockEvents`)
- Test: `vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts`

**Interfaces:**
- Consumes: `CodeBeginMsg.reveal` (from Task 1) — set to `"typewriter"` on every emitted and persisted `code.begin`.
- Produces: `BlockIds.reveal?: "typewriter"` on `buildBlockEvents` (so the persisted sequence carries the marker).
- Consumes: `runWholeFileCodegen({ onLine })` and `WholeFileResult` (existing, `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts`) — the loop already drives `onLine` from `getFullResponsesStream`.
- Produces: the handler's live emission behavior (no new exported symbol).

**Parallelization rationale:** none — this is a normal modification of one file. The contract-first split is Task 1 (the `reveal` marker), which this and Task 4 both consume; this task is independent of the client tasks by file seam (handler vs. `MessageList.tsx`).

The handler currently runs a safe reveal+heartbeat path with a diagnostic `/_streamdiag` card and does NOT pass `onLine`. Replace that with live, self-framed streaming that degrades safely if a run buffers.

- [ ] **Step 1: Update the streaming-ordering test (RED)**

In `vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts`, the fake loop currently ignores `onLine`. Add a streaming test and a `reveal`-marker assertion. Add this test inside the existing `describe("handleWholeFileCodegenRequest emission", ...)` block:

```ts
it("streams code lines live (self-framed) and tags code.begin with reveal:'typewriter'", async () => {
  const result: WholeFileResult = {
    files: [{ filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" }],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  };
  // Drive onLine the way the loop would, mid-run, before resolving.
  const { deps, emitted } = makeDeps(result, {
    runWholeFileCodegen: async ({ onLine }) => {
      onLine?.("/App.jsx", "jsx", "a", 0);
      onLine?.("/App.jsx", "jsx", "b", 1);
      // "c" withheld (no trailing newline) — reconciliation must add it.
      return result;
    },
  });

  await handleWholeFileCodegenRequest(deps);
  assertStrictOrdering(emitted);
  // First wire event is block.begin (emitted lazily WITH the code, not before).
  expect(emitted[0].type).toBe("block.begin");
  // Every streamed code.begin carries the reveal marker.
  const begins = emitted.filter((e) => (e as { type: string }).type === "block.code.begin");
  expect(begins.length).toBeGreaterThanOrEqual(1);
  expect(begins.every((e) => (e as { reveal?: string }).reveal === "typewriter")).toBe(true);
  // All three lines reach the wire (the withheld "c" via reconciliation).
  const lines = emitted
    .filter((e) => (e as { type: string }).type === "block.code.line")
    .map((e) => (e as { line: string }).line);
  expect(lines).toEqual(["a", "b", "c"]);
  // No diagnostic card.
  expect(emitted.some((e) => ((e as { path?: string }).path ?? "").startsWith("/_streamdiag"))).toBe(false);
});
```

The existing `makeDeps` already accepts `{ runWholeFileCodegen }`. Update the `makeDeps` signature in that file to allow an async `runWholeFileCodegen` that receives `onLine` (it already passes the deps object through). No other change to `makeDeps`.

Also update the existing "self-framed burst" sectionOrder test: it currently filters out `/_streamdiag`; that filter can stay (harmless) since the diag card is removed.

- [ ] **Step 2: Run to verify RED**

Run: `cd /Users/marcusestes/Websites/vibes.diy && pnpm exec vitest run vibes.diy/api/svc/intern/codegen-loop`
Expected: FAIL — the new test fails because the handler does not pass `onLine`, so no `code.line` events are emitted live and `code.begin` lacks `reveal`.

- [ ] **Step 3: Implement live emission in the handler**

In `vibes.diy/api/svc/public/handle-whole-file-codegen.ts`, replace the body from the heartbeat block through the burst (the section currently labeled "Keepalive heartbeat" / "Run the loop" / "Emit the whole sequence" / the diagnostic card) with the following. Keep the serialized `enqueue`/`chain`/`firstErr` block above it, and the persist (`handlePromptContext`) block below it, unchanged.

```ts
  // --- Keepalive heartbeat (until the first streamed line) -------------------
  // The model plans for ~18s before the first write_file argument delta; after
  // that, deltas arrive every few seconds and keep the client's 45s watchdog
  // alive on their own. So beat a benign `block.begin` until the first onLine,
  // then stop (a heartbeat block.begin splices the client's blockMsgs, which is
  // inert while empty but would WIPE an in-progress card once code is streaming).
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const heartbeat = (): void => {
    if (stopped) return;
    enqueue({ type: "block.begin", seq: liveSeq++, blockId, streamId: promptId, blockNr: 0, timestamp: new Date() } satisfies BlockBeginMsg);
    timer = setTimeout(heartbeat, HEARTBEAT_MS);
  };
  timer = setTimeout(heartbeat, HEARTBEAT_MS);
  const stopHeartbeat = (): void => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  // --- Live per-file framing driven by `onLine` ------------------------------
  // Emit one self-framed sequence: block.begin (lazy, on the first line) →
  // per-file code.begin(reveal) → code.line* → code.end → block.end. block.begin
  // travels WITH the code so a client that reconnected mid-turn stays framed.
  const base = () => ({ blockId, streamId: promptId, blockNr: 0, timestamp: new Date() });
  const streamedFiles = new Set<string>();
  const lineCount = new Map<string, number>();
  const byteCount = new Map<string, number>();
  let blockBegun = false;
  let openFile: string | null = null;
  const emitCodeBegin = (filename: string, lang: string): void => {
    enqueue({ type: "block.code.begin", sectionId: sectionIdFor(filename), lang, path: filename, reveal: "typewriter", seq: liveSeq++, ...base() } satisfies CodeBeginMsg);
  };
  const emitCodeLine = (filename: string, lang: string, line: string, lineNr: number): void => {
    enqueue({ type: "block.code.line", sectionId: sectionIdFor(filename), lang, path: filename, line, lineNr, seq: liveSeq++, ...base() } satisfies CodeLineMsg);
  };
  const emitCodeEnd = (filename: string, lang: string, lines: number, bytes: number): void => {
    enqueue({ type: "block.code.end", sectionId: sectionIdFor(filename), lang, path: filename, stats: { lines, bytes }, seq: liveSeq++, ...base() } satisfies CodeEndMsg);
  };
  const onLine: OnLine = (filename, lang, line, lineNr) => {
    if (!blockBegun) {
      blockBegun = true;
      stopHeartbeat();
      enqueue({ type: "block.begin", seq: liveSeq++, ...base() } satisfies BlockBeginMsg);
    }
    if (openFile !== filename) {
      if (openFile !== null) {
        emitCodeEnd(openFile, langFor(openFile), lineCount.get(openFile) ?? 0, byteCount.get(openFile) ?? 0);
      }
      openFile = filename;
      streamedFiles.add(filename);
      emitCodeBegin(filename, lang);
    }
    emitCodeLine(filename, lang, line, lineNr);
    lineCount.set(filename, (lineCount.get(filename) ?? 0) + 1);
    byteCount.set(filename, (byteCount.get(filename) ?? 0) + new TextEncoder().encode(line).length + 1);
  };

  // Run the loop, streaming completed lines live through `onLine`.
  let result: WholeFileResult;
  try {
    result = await runWholeFileCodegen({
      systemPrompt,
      userPrompt,
      needsAccess,
      maxSteps,
      maxCostUsd,
      model: (ctx) => (ctx.numberOfTurns > 1 ? cheapModel : frontierModel),
      onLine,
    });
  } finally {
    stopHeartbeat();
  }

  // Reconcile the live stream against the resolved files. If a run buffered,
  // onLine fired at the end and produced the same self-framed burst; either way
  // close the open section (topping up the withheld trailing line) and emit any
  // file that never streamed a line as a full section.
  if (!blockBegun) {
    blockBegun = true;
    enqueue({ type: "block.begin", seq: liveSeq++, ...base() } satisfies BlockBeginMsg);
  }
  const byName = new Map(result.files.map((f) => [f.filename, f] as const));
  if (openFile !== null) {
    const f = byName.get(openFile);
    if (f) {
      const finalLines = f.content.split("\n");
      for (let nr = lineCount.get(openFile) ?? 0; nr < finalLines.length; nr++) {
        emitCodeLine(openFile, f.lang, finalLines[nr], nr);
      }
      emitCodeEnd(openFile, f.lang, finalLines.length, new TextEncoder().encode(f.content).length);
    } else {
      emitCodeEnd(openFile, langFor(openFile), lineCount.get(openFile) ?? 0, byteCount.get(openFile) ?? 0);
    }
    openFile = null;
  }
  for (const f of result.files) {
    if (streamedFiles.has(f.filename)) continue;
    emitCodeBegin(f.filename, f.lang);
    const lines = f.content.split("\n");
    for (let nr = 0; nr < lines.length; nr++) emitCodeLine(f.filename, f.lang, lines[nr], nr);
    emitCodeEnd(f.filename, f.lang, lines.length, new TextEncoder().encode(f.content).length);
  }

  // Build the canonical persisted sequence (also carrying the reveal marker so a
  // reload renders identically), then close the live block.
  let seqForBuild = 0;
  const collectedMsgs = buildBlockEvents(result.files, {
    blockId,
    streamId: promptId,
    sectionIdFor,
    nextSeq: () => seqForBuild++,
    blockNr: 0,
    reveal: "typewriter",
    usage: {
      given: [],
      calculated: {
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
      },
    },
  });
  const blockEnd = collectedMsgs[collectedMsgs.length - 1] as BlockEndMsg;
  enqueue({ ...blockEnd, seq: liveSeq++, timestamp: new Date() });

  await chain;
  if (firstErr) return Result.Err(firstErr);
```

This references `CodeBeginMsg`, `CodeLineMsg`, `CodeEndMsg` (already imported) and `OnLine` (already imported). Remove the now-unused diagnostic imports/locals if the linter flags them.

- [ ] **Step 4: Thread the `reveal` marker through `buildBlockEvents`**

In `vibes.diy/api/svc/intern/codegen-loop/emit-blocks.ts`, add an optional `reveal` to `BlockIds` and set it on each `code.begin`. The current `BlockIds` interface and the per-file `code.begin` push are:

```ts
export interface BlockIds {
  blockId: string;
  streamId: string;
  sectionIdFor: (filename: string) => string;
  nextSeq: () => number;
  blockNr: number;
  usage: BlockUsage;
}
```

Change to:

```ts
export interface BlockIds {
  blockId: string;
  streamId: string;
  sectionIdFor: (filename: string) => string;
  nextSeq: () => number;
  blockNr: number;
  usage: BlockUsage;
  reveal?: "typewriter";
}
```

And in the per-file loop, add `reveal: ids.reveal` to the `block.code.begin` object (alongside `lang`, `path`):

```ts
    events.push({
      type: "block.code.begin",
      sectionId,
      lang: file.lang,
      path: file.filename,
      reveal: ids.reveal,
      seq: ids.nextSeq(),
      ...base,
    } satisfies CodeBeginMsg);
```

(`reveal: undefined` is valid for the optional field, so existing callers that omit `reveal` are unaffected.)

- [ ] **Step 5: Run the handler + emit-blocks suite to verify GREEN**

Run: `cd /Users/marcusestes/Websites/vibes.diy && pnpm exec vitest run vibes.diy/api/svc/intern/codegen-loop`
Expected: PASS — the new streaming test passes; the emit-blocks, loop, and existing handler tests stay green.

- [ ] **Step 6: Typecheck and lint**

Run: `cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/api/svc && pnpm exec tsc --noEmit -p . && pnpm exec eslint public/handle-whole-file-codegen.ts intern/codegen-loop/emit-blocks.ts intern/codegen-loop/handle-whole-file-codegen.test.ts`
Expected: clean (exit 0).

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/api/svc/public/handle-whole-file-codegen.ts vibes.diy/api/svc/intern/codegen-loop/emit-blocks.ts vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts
git commit -m "feat(whole-file-codegen): live self-framed per-line emission + reveal marker"
```

---

## Task 3: `useTypewriterReveal` — paced buffer-drain hook

**Type:** implementation
**Depends-on:** none

**Files:**
- Create: `vibes.diy/pkg/app/hooks/useTypewriterReveal.ts`
- Test: `vibes.diy/pkg/test/typewriter-reveal.test.ts` (pure pacing math, node project)

**Interfaces:**
- Produces: `stepReveal(state: RevealState, total: number, isStreaming: boolean, nowMs: number): RevealState` — pure pacing step.
- Produces: `useTypewriterReveal(total: number, isStreaming: boolean, enabled: boolean): number` — the React hook returning the current revealed line count.
- Produces: `RevealState` interface `{ revealedFloat: number; lastTickMs: number }` and constants `BASE_RATE`, `MAX_RATE`, `FINISH_MS`.

**Parallelization rationale:** the hook depends on nothing in the message schema — it operates on `(total, isStreaming, enabled)` numbers/booleans — so it is genuinely independent of Tasks 1 and 2 and shares no file with them. It can be built in the same wave as Task 1.

- [ ] **Step 1: Write the failing test for the pure pacing math**

Create `vibes.diy/pkg/test/typewriter-reveal.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { stepReveal, BASE_RATE, FINISH_MS, type RevealState } from "../app/hooks/useTypewriterReveal.js";

describe("stepReveal", () => {
  it("advances at the steady base rate while streaming and not backlogged", () => {
    const s0: RevealState = { revealedFloat: 0, lastTickMs: 0 };
    const s1 = stepReveal(s0, 1000, true, 1000); // 1 second elapsed
    expect(Math.floor(s1.revealedFloat)).toBe(BASE_RATE);
    expect(s1.lastTickMs).toBe(1000);
  });

  it("never reveals past the total", () => {
    const s0: RevealState = { revealedFloat: 5, lastTickMs: 0 };
    const s1 = stepReveal(s0, 6, true, 10_000); // huge elapsed
    expect(s1.revealedFloat).toBe(6);
  });

  it("accelerates to clear the backlog within FINISH_MS once streaming stops", () => {
    const backlog = 600;
    const s0: RevealState = { revealedFloat: 0, lastTickMs: 0 };
    // After FINISH_MS with isStreaming=false, the whole backlog is revealed.
    const s1 = stepReveal(s0, backlog, false, FINISH_MS);
    expect(s1.revealedFloat).toBe(backlog);
  });

  it("scales the rate up when backlogged while still streaming", () => {
    const s0: RevealState = { revealedFloat: 0, lastTickMs: 0 };
    const steady = stepReveal({ ...s0 }, BASE_RATE + 1, true, 100).revealedFloat;
    const backlogged = stepReveal({ ...s0 }, 500, true, 100).revealedFloat;
    expect(backlogged).toBeGreaterThan(steady); // catch-up advances faster
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `cd /Users/marcusestes/Websites/vibes.diy && pnpm exec vitest run vibes.diy/pkg/test/typewriter-reveal.test.ts`
Expected: FAIL — `useTypewriterReveal.js` does not exist.

- [ ] **Step 3: Implement the hook + pure step**

Create `vibes.diy/pkg/app/hooks/useTypewriterReveal.ts`:

```ts
import { useEffect, useRef, useState } from "react";

/** Steady reveal rate (lines/second) when caught up and streaming. */
export const BASE_RATE = 24;
/** Cap on the adaptive catch-up rate (lines/second). */
export const MAX_RATE = 600;
/** Once streaming stops, clear the remaining backlog within this many ms. */
export const FINISH_MS = 1500;

export interface RevealState {
  /** Lines revealed so far, tracked as a float so sub-line-per-frame progress accumulates. */
  revealedFloat: number;
  /** Wall-clock (ms) of the last step. */
  lastTickMs: number;
}

/**
 * Pure pacing step. Advances `revealedFloat` toward `total` based on elapsed
 * wall-clock since `lastTickMs`. While streaming, the rate is BASE_RATE, scaled
 * up toward MAX_RATE when the backlog grows. When `isStreaming` is false, the
 * rate is whatever clears the current backlog within FINISH_MS (never below
 * BASE_RATE), so "done" never lags far behind the model.
 */
export function stepReveal(state: RevealState, total: number, isStreaming: boolean, nowMs: number): RevealState {
  if (state.revealedFloat >= total) return { revealedFloat: total, lastTickMs: nowMs };
  const dt = Math.max(0, (nowMs - state.lastTickMs) / 1000);
  const backlog = total - state.revealedFloat;
  let rate: number;
  if (!isStreaming) {
    rate = Math.max(BASE_RATE, backlog / (FINISH_MS / 1000));
  } else if (backlog > BASE_RATE) {
    rate = Math.min(MAX_RATE, backlog);
  } else {
    rate = BASE_RATE;
  }
  const next = Math.min(total, state.revealedFloat + rate * dt);
  return { revealedFloat: next, lastTickMs: nowMs };
}

/**
 * Reveal lines at a steady typewriter pace, draining a buffer fed by coarse
 * network chunks. Returns the number of lines to display. When `enabled` is
 * false the hook is inert and returns `total` (everything shown, no animation),
 * so non-whole-file code cards are unaffected.
 *
 * A single requestAnimationFrame loop reads `total`/`isStreaming` from refs and
 * advances the reveal; it re-arms while not caught up or still streaming, and is
 * restarted by the effect whenever `total` or `isStreaming` changes (e.g. new
 * lines arrive, or the turn completes).
 */
export function useTypewriterReveal(total: number, isStreaming: boolean, enabled: boolean): number {
  const [revealed, setRevealed] = useState(enabled ? 0 : total);
  const stateRef = useRef<RevealState>({ revealedFloat: 0, lastTickMs: 0 });
  const totalRef = useRef(total);
  const streamingRef = useRef(isStreaming);
  totalRef.current = total;
  streamingRef.current = isStreaming;

  useEffect(() => {
    if (!enabled) {
      setRevealed(total);
      return;
    }
    let mounted = true;
    let raf = 0;
    const tick = (now: number): void => {
      if (!mounted) return;
      const s = stateRef.current;
      if (s.lastTickMs === 0) s.lastTickMs = now;
      const nextState = stepReveal(s, totalRef.current, streamingRef.current, now);
      stateRef.current = nextState;
      const count = Math.floor(nextState.revealedFloat);
      setRevealed((prev) => (prev !== count ? count : prev));
      const caughtUp = nextState.revealedFloat >= totalRef.current;
      if (!caughtUp || streamingRef.current) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [enabled, total, isStreaming]);

  return enabled ? Math.min(revealed, total) : total;
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `cd /Users/marcusestes/Websites/vibes.diy && pnpm exec vitest run vibes.diy/pkg/test/typewriter-reveal.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/pkg && pnpm exec tsc --noEmit -p . 2>&1 | head -5 || true`
Expected: no errors referencing `useTypewriterReveal.ts`. (If the pkg has no standalone tsconfig for this, rely on the repo `pnpm check` gate in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/hooks/useTypewriterReveal.ts vibes.diy/pkg/test/typewriter-reveal.test.ts
git commit -m "feat(hooks): useTypewriterReveal paced buffer-drain reveal"
```

---

## Task 4: `CodeMsg` — gated typewriter reveal

**Type:** implementation
**Depends-on:** 1, 3

**Files:**
- Modify: `vibes.diy/pkg/app/components/MessageList.tsx` (`CodeMsg` ~lines 269-397; its call sites in the reducer ~lines 598-616 and ~670-695)
- Test: `vibes.diy/tests/app/code-msg-reveal.test.tsx` (create; browser project `vibes.diy`)

**Interfaces:**
- Consumes: `CodeBeginMsg.reveal` (from Task 1) — `begin.reveal === "typewriter"` enables the reveal.
- Consumes: `useTypewriterReveal(total, isStreaming, enabled)` (from Task 3).
- Produces: `CodeMsg` gains an `isStreaming?: boolean` prop.

**Parallelization rationale:** none beyond the contract-first dependency on Tasks 1 and 3. It modifies only `MessageList.tsx`, disjoint from Task 2's handler file, so it runs in the same wave as Task 2.

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/code-msg-reveal.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CodeMsg } from "../../pkg/app/components/MessageList.js";

const begin = (reveal?: "typewriter") => ({
  type: "block.code.begin" as const,
  sectionId: "s1",
  lang: "jsx",
  path: "/App.jsx",
  blockId: "b1",
  streamId: "p1",
  seq: 0,
  blockNr: 0,
  timestamp: new Date(),
  ...(reveal ? { reveal } : {}),
});
const lines = Array.from({ length: 40 }, (_, i) => ({
  type: "block.code.line" as const,
  sectionId: "s1",
  lang: "jsx",
  line: `line ${i}`,
  lineNr: i,
  blockId: "b1",
  streamId: "p1",
  seq: i + 1,
  blockNr: 0,
  timestamp: new Date(),
}));

describe("CodeMsg typewriter reveal", () => {
  it("reveals a partial subset while a gated card is streaming", async () => {
    render(<CodeMsg begin={begin("typewriter")} lines={lines} isStreaming onClick={() => {}} />);
    // Early in the reveal, far fewer than all 40 lines are visible.
    await waitFor(() => {
      const shown = screen.queryAllByText(/^line \d+$/).length;
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(lines.length);
    });
  });

  it("does NOT animate an ungated card (no reveal marker)", () => {
    render(<CodeMsg begin={begin()} lines={lines} isStreaming onClick={() => {}} />);
    // Ungated cards keep the existing collapsed summary (no expanded line list).
    expect(screen.queryByText("line 39")).toBeNull();
  });
});
```

If `CodeMsg` is not currently exported, add `export` to its declaration as part of Step 3.

- [ ] **Step 2: Run to verify RED**

Run: `cd /Users/marcusestes/Websites/vibes.diy && pnpm exec vitest run --project vibes.diy vibes.diy/tests/app/code-msg-reveal.test.tsx`
Expected: FAIL — `CodeMsg` is not exported and/or never renders an expanded line list.

- [ ] **Step 3: Implement the gated reveal in CodeMsg**

In `vibes.diy/pkg/app/components/MessageList.tsx`:

1. Import the hook near the top (with the other imports):

```ts
import { useTypewriterReveal } from "../hooks/useTypewriterReveal.js";
```

2. Add `isStreaming` to `CodeMsg`'s props and `export` the component. The current signature is:

```ts
function CodeMsg({
  lines,
  begin,
  end,
  truncated,
  onClick,
  onDiffClick,
}: {
  begin: CodeBeginMsg;
  lines: LineMsg[];
  end?: CodeEndMsg;
  truncated?: { reason: string; kind: string; truncatedAtLine: number };
  onClick: () => void;
  onDiffClick?: (diff: { path: string; lines: string[] } | null) => void;
}) {
```

Change to:

```ts
export function CodeMsg({
  lines,
  begin,
  end,
  truncated,
  onClick,
  onDiffClick,
  isStreaming = false,
}: {
  begin: CodeBeginMsg;
  lines: LineMsg[];
  end?: CodeEndMsg;
  truncated?: { reason: string; kind: string; truncatedAtLine: number };
  onClick: () => void;
  onDiffClick?: (diff: { path: string; lines: string[] } | null) => void;
  isStreaming?: boolean;
}) {
```

3. Inside `CodeMsg`, after the existing `const codeReady = end !== undefined;` line, derive the reveal:

```ts
  const revealEnabled = begin.reveal === "typewriter";
  const revealed = useTypewriterReveal(lines.length, isStreaming, revealEnabled);
  // While a gated card is mid-reveal, show the streaming line-by-line body;
  // once caught up (and not streaming) it falls back to the existing summary.
  const revealing = revealEnabled && revealed < lines.length;
  const revealLines = revealing ? lines.slice(0, revealed) : lines;
```

4. Replace the collapsed body block (the `<div>` with `h-0 max-h-0 min-h-0 ... opacity-0 ... overflow-hidden`, currently ~lines 382-392, rendering `lines.slice(0, 3)`) with a body that expands while revealing and renders `revealLines`:

```tsx
      {/* Code body: expanded + line-by-line while a gated card reveals;
          otherwise the existing collapsed summary preview. */}
      <div
        className={
          revealing
            ? "bg-light-background-02 dark:bg-dark-background-02 overflow-hidden font-mono text-xs leading-relaxed"
            : "bg-light-background-02 dark:bg-dark-background-02 h-0 max-h-0 min-h-0 overflow-hidden opacity-0"
        }
      >
        {(revealing ? revealLines : revealLines.slice(0, 3)).map((line, idx) => (
          <div key={`${begin.sectionId}-${line.lineNr ?? idx}`}>{line.line || " "}</div>
        ))}
        {!revealing && revealLines.length > 3 && <div>…</div>}
      </div>
```

(Match the existing surrounding class names / structure; the key change is the conditional `h-0 ... opacity-0` collapse and rendering `revealLines` instead of a hard `lines.slice(0,3)` when revealing.)

5. Thread `isStreaming` from the reducer's `CodeMsg` call sites. In the reducer, `promptProcessing` is the turn-running flag (already a parameter of `MessageList`). At the `isBlockEnd` flush site (~line 598) and any other `<CodeMsg .../>` render, pass `isStreaming={promptProcessing}`:

```tsx
                <CodeMsg
                  key={`code-${block.begin.sectionId}-${idx}`}
                  begin={block.begin}
                  lines={block.lines}
                  end={block.end}
                  truncated={block.truncated}
                  isStreaming={promptProcessing}
                  onDiffClick={onDiffClick}
                  onClick={() => {
                    /* unchanged */
                  }}
                />
```

Apply the same `isStreaming={promptProcessing}` to the pre-truncate `CodeMsg` render (~line 673) and the truncated `CodeMsg` render if present. Do not change any other props.

- [ ] **Step 4: Run to verify GREEN**

Run: `cd /Users/marcusestes/Websites/vibes.diy && pnpm exec vitest run --project vibes.diy vibes.diy/tests/app/code-msg-reveal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the broader app test project to confirm no MessageList regression**

Run: `cd /Users/marcusestes/Websites/vibes.diy && pnpm exec vitest run --project vibes.diy vibes.diy/tests/app/code-view-files.test.ts`
Expected: PASS (existing code-view behavior unaffected).

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/components/MessageList.tsx vibes.diy/tests/app/code-msg-reveal.test.tsx
git commit -m "feat(MessageList): gated typewriter reveal in CodeMsg"
```

---

## Task 5: Full verification gate

**Type:** gate
**Depends-on:** 2, 4

**Files:**
- (none — verification only)

- [ ] **Step 1: Run the full check**

Run: `cd /Users/marcusestes/Websites/vibes.diy && pnpm check`
Expected: format + build + test + lint all pass. (Per repo flaky-test guidance, rerun a failing suite in isolation before treating it as real.)

- [ ] **Step 2: Run the constructors guard**

Run: `cd /Users/marcusestes/Websites/vibes.diy && pnpm run rules-bag:constructors`
Expected: exit 0.

---

## Task 6: Browser validation on the preview

**Type:** manual
**Depends-on:** 5

**Files:**
- (none — drives the deployed preview)

- [ ] **Step 1: Wait for the preview deploy of the merged/pushed branch**

The `preview:whole-file-codegen` label + `USE_WHOLE_FILE_CODEGEN=true` are already wired. Watch `gh run watch <deploy-run-id>` for the branch.

- [ ] **Step 2: Drive a creation prompt and observe**

On `https://pr-2650-vibes-diy-v2.jchris.workers.dev`, submit a brand-new creation prompt. Confirm, via screenshots across the ~60–120s generation:
- code lines materialize line-by-line in the chat code card (steady typewriter), not all at once;
- NO "Reconnecting" appears;
- NO `Cannot read properties of undefined (reading 'sectionId')` in the console (read_console_messages);
- the app renders on the real runtime when generation completes;
- reload of the chat URL converges (cards + app re-render, no crash).

- [ ] **Step 3: Record the outcome on the PR**

Post a short comment on PR #2650 summarizing the observed behavior (with a screenshot), @-mentioning `@CharlieHelps`.

---

## Acceptance

To be set after plan approval (sealed exam authored from the spec if executed via ultrapowers; otherwise the committed Vitest suites in Tasks 1–4 plus the Task 6 browser validation are the verification).
