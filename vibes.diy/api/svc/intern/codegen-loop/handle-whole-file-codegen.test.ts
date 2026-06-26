// Lives in the codegen-loop test project (not next to the handler under
// svc/public/, which no vitest project covers) because it exercises the same
// whole-file-codegen feature and must run in CI. It locks the emission contract
// the client section reducer depends on — the invariant whose violation (a
// `code.end` reaching a block with no open `code.begin`) crashed the client with
// "Cannot read properties of undefined (reading 'sectionId')" — plus the
// keepalive heartbeat that replaces the watchdog-tripping silent gap.
import { describe, it, expect, vi } from "vitest";
import { Option, Result } from "@adviser/cement";
import type { BlockEndMsg, FileSystemRef } from "@vibes.diy/call-ai-v2";
import type { PromptAndBlockMsgs, VibeFile } from "@vibes.diy/api-types";
import { handleWholeFileCodegenRequest, type WholeFileCodegenDeps } from "../../public/handle-whole-file-codegen.js";
import type { WholeFileResult } from "./whole-file-loop.js";

/** A monotonic id allocator (`id0`, `id1`, …) so blockId/sectionIds are distinct and stable per run. */
function idGen(): () => string {
  let n = 0;
  return () => `id${n++}`;
}

/**
 * Build the injected deps for the handler. By default the loop resolves
 * immediately to `result`; pass `runWholeFileCodegen` to control its timing
 * (e.g. to let the heartbeat fire). Captures every wire-emitted event in
 * delivery order and the persisted call.
 */
function makeDeps(
  result: WholeFileResult,
  overrides?: {
    runWholeFileCodegen?: WholeFileCodegenDeps["runWholeFileCodegen"];
    sessionDoc?: WholeFileCodegenDeps["sessionDoc"];
    makeBaseSystemPrompt?: WholeFileCodegenDeps["makeBaseSystemPrompt"];
  }
): {
  deps: WholeFileCodegenDeps;
  emitted: PromptAndBlockMsgs[];
  persisted: { collectedMsgs: PromptAndBlockMsgs[]; fileSystem?: VibeFile[]; value: BlockEndMsg }[];
} {
  const emitted: PromptAndBlockMsgs[] = [];
  const persisted: { collectedMsgs: PromptAndBlockMsgs[]; fileSystem?: VibeFile[]; value: BlockEndMsg }[] = [];
  const deps: WholeFileCodegenDeps = {
    promptId: "prompt-1",
    blockSeq: 1,
    nextId: idGen(),
    userPrompt: "make an app",
    sessionDoc: overrides?.sessionDoc ?? { userPrompt: "make an app" },
    needsAccess: false,
    frontierModel: "frontier",
    cheapModel: "cheap",
    maxSteps: 4,
    maxCostUsd: 0.5,
    terminal: { promptBlockEndEmitted: false },
    byteLength: (s) => s.length,
    makeBaseSystemPrompt: overrides?.makeBaseSystemPrompt ?? (async () => ({ systemPrompt: "sys" })),
    runWholeFileCodegen: overrides?.runWholeFileCodegen ?? (async () => result),
    appendBlockEvent: async ({ evt }) => {
      emitted.push(evt);
      return Result.Ok(undefined);
    },
    handlePromptContext: async ({ blockSeq, value, collectedMsgs, fileSystem }) => {
      persisted.push({ collectedMsgs: [...collectedMsgs], fileSystem, value });
      return Result.Ok({ blockSeq, fsRef: Option.None<FileSystemRef>() });
    },
  };
  return { deps, emitted, persisted };
}

/**
 * Replay the emitted stream through the same strict state machine the client
 * uses and assert it never violates the contract: starts with block.begin, ends
 * with block.end, each section is `code.begin → code.line* → code.end` with no
 * interleaving and no `code.end` (or `block.end`) while a section is unopened.
 * `block.begin` is a neutral framing reset (heartbeat or burst opener) and is
 * tolerated anywhere — the very bug this guards against was emitting it AWAY from
 * the code instead of as part of the burst.
 */
function assertStrictOrdering(events: PromptAndBlockMsgs[]): void {
  expect(events.length).toBeGreaterThanOrEqual(2);
  expect(events[0].type).toBe("block.begin");
  expect(events[events.length - 1].type).toBe("block.end");
  let openSection: string | undefined;
  for (const e of events) {
    const evt = e as { type: string; sectionId?: string };
    switch (evt.type) {
      case "block.begin":
        break; // neutral: clears an (empty) blockMsgs on the client
      case "block.code.begin":
        expect(openSection).toBeUndefined(); // a prior section must be closed first
        openSection = evt.sectionId;
        break;
      case "block.code.line":
        expect(openSection).toBe(evt.sectionId); // a line belongs to the open section
        break;
      case "block.code.end":
        expect(openSection).toBe(evt.sectionId); // an end closes the section it opened
        openSection = undefined;
        break;
      case "block.end":
        expect(openSection).toBeUndefined(); // every section closed before block.end
        break;
      default:
        throw new Error(`unexpected event type: ${evt.type}`);
    }
  }
  expect(openSection).toBeUndefined();
}

describe("handleWholeFileCodegenRequest emission", () => {
  it("emits one self-framed, strictly-ordered block.begin → sections → block.end burst", async () => {
    const result: WholeFileResult = {
      files: [
        { filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" },
        { filename: "/access.js", lang: "js", content: "x\ny" },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
    const { deps, emitted } = makeDeps(result);

    const r = await handleWholeFileCodegenRequest(deps);
    expect(r.isOk()).toBe(true);
    assertStrictOrdering(emitted);

    // Both sections appear, App.jsx fully before access.js (no interleave).
    const sectionOrder = emitted
      .filter((e) => (e as { type: string }).type === "block.code.begin")
      .map((e) => (e as { path: string }).path);
    expect(sectionOrder).toEqual(["/App.jsx", "/access.js"]);
  });

  it("persists the canonical buildBlockEvents sequence and the resolved files verbatim", async () => {
    const result: WholeFileResult = {
      files: [{ filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" }],
      usage: { prompt_tokens: 7, completion_tokens: 8, total_tokens: 15 },
    };
    const { deps, persisted } = makeDeps(result);

    await handleWholeFileCodegenRequest(deps);
    expect(persisted).toHaveLength(1);
    const { collectedMsgs, fileSystem, value } = persisted[0];
    expect(collectedMsgs[0].type).toBe("block.begin");
    expect(collectedMsgs[collectedMsgs.length - 1].type).toBe("block.end");
    expect(value.usage.calculated).toEqual({ prompt_tokens: 7, completion_tokens: 8, total_tokens: 15 });
    // Files handed in verbatim (skips SEARCH/REPLACE resolution).
    expect(fileSystem).toEqual([{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" }]);
  });

  it("returns an error and persists nothing when the loop's terminal verify failed", async () => {
    const result: WholeFileResult = {
      files: [{ filename: "/App.jsx", lang: "jsx", content: "const x = 1;" }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      verify: { ok: false, problems: ["App.jsx has no default export"] },
    };
    const { deps, persisted } = makeDeps(result);

    const r = await handleWholeFileCodegenRequest(deps);
    expect(r.isErr()).toBe(true);
    expect(persisted).toHaveLength(0); // a rejected file set is never written
  });

  it("streams code lines live (self-framed) and tags code.begin with reveal:'typewriter'", async () => {
    const result: WholeFileResult = {
      files: [{ filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
    // Drive onLine the way the loop would, mid-run, before resolving.
    const { deps, emitted } = makeDeps(result, {
      runWholeFileCodegen: async ({ onLine }) => {
        onLine?.({ file: "/App.jsx", lang: "jsx", line: "a", lineNr: 0 });
        onLine?.({ file: "/App.jsx", lang: "jsx", line: "b", lineNr: 1 });
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

  it("forwards the pre-allocated theme into the agentic system prompt", async () => {
    const seen: Array<{ variant?: string; theme?: unknown }> = [];
    const result: WholeFileResult = {
      files: [{ filename: "/App.jsx", lang: "jsx", content: "a" }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
    const { deps } = makeDeps(result, {
      sessionDoc: { userPrompt: "x", theme: "aether" },
      makeBaseSystemPrompt: async (_model: string, doc: { variant: string; theme?: unknown }) => {
        seen.push({ variant: doc.variant, theme: doc.theme });
        return { systemPrompt: "sp" };
      },
    });
    await handleWholeFileCodegenRequest(deps);
    expect(seen[0]).toEqual({ variant: "agentic-whole-file", theme: "aether" });
  });

  it("beats keepalive heartbeats during a slow loop without breaking ordering", async () => {
    vi.useFakeTimers();
    try {
      const result: WholeFileResult = {
        files: [{ filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      };
      let finishLoop!: () => void;
      const { deps, emitted } = makeDeps(result, {
        runWholeFileCodegen: () => new Promise<WholeFileResult>((res) => (finishLoop = () => res(result))),
      });

      const p = handleWholeFileCodegenRequest(deps);
      // Let the loop sit silent long enough for several heartbeats to fire.
      await vi.advanceTimersByTimeAsync(20_000);
      await vi.advanceTimersByTimeAsync(20_000);
      const heartbeatsBeforeBurst = emitted.filter((e) => (e as { type: string }).type === "block.begin").length;
      expect(heartbeatsBeforeBurst).toBeGreaterThanOrEqual(2);
      // No code/end has streamed yet — heartbeats are inert framing resets only.
      expect(emitted.every((e) => (e as { type: string }).type === "block.begin")).toBe(true);

      finishLoop();
      await p;

      // The closing burst is still strictly framed despite the leading heartbeats.
      assertStrictOrdering(emitted);
      expect(emitted.some((e) => (e as { type: string }).type === "block.code.end")).toBe(true);
      expect(emitted[emitted.length - 1].type).toBe("block.end");
    } finally {
      vi.useRealTimers();
    }
  });
});
