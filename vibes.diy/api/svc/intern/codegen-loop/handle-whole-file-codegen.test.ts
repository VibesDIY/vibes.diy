// Lives in the codegen-loop test project (not next to the handler under
// svc/public/, which no vitest project covers) because it exercises the same
// whole-file-codegen feature and must run in CI. It locks the live-stream
// ordering contract the client section reducer depends on — the invariant whose
// violation (a `code.end` delivered before its `code.begin`) crashed the client
// with "Cannot read properties of undefined (reading 'sectionId')".
import { describe, it, expect } from "vitest";
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
 * Build the injected deps for the handler, with a fake loop that drives `onLine`
 * exactly as the supplied callback dictates, then resolves to `result`. Captures
 * every wire-emitted event (in delivery order) and the persisted call.
 */
function makeDeps(
  drive: (onLine: NonNullable<Parameters<WholeFileCodegenDeps["runWholeFileCodegen"]>[0]["onLine"]>) => void,
  result: WholeFileResult
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
    sessionDoc: { userPrompt: "make an app" },
    needsAccess: false,
    frontierModel: "frontier",
    cheapModel: "cheap",
    maxSteps: 4,
    maxCostUsd: 0.5,
    terminal: { promptBlockEndEmitted: false },
    makeBaseSystemPrompt: async () => ({ systemPrompt: "sys" }),
    runWholeFileCodegen: async ({ onLine }) => {
      if (onLine) drive(onLine);
      return result;
    },
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
 * uses and assert it never violates the contract: block.begin first, block.end
 * last, and between them each section is `code.begin → code.line* → code.end`
 * with no interleaving and no end before its begin.
 */
function assertStrictOrdering(events: PromptAndBlockMsgs[]): void {
  expect(events.length).toBeGreaterThanOrEqual(2);
  expect(events[0].type).toBe("block.begin");
  expect(events[events.length - 1].type).toBe("block.end");
  let openSection: string | undefined;
  for (const e of events.slice(1, -1)) {
    const evt = e as { type: string; sectionId?: string };
    if (evt.type === "block.code.begin") {
      expect(openSection).toBeUndefined(); // a prior section must be closed first
      openSection = evt.sectionId;
    } else if (evt.type === "block.code.line") {
      expect(openSection).toBe(evt.sectionId); // a line belongs to the open section
    } else if (evt.type === "block.code.end") {
      expect(openSection).toBe(evt.sectionId); // an end closes the section it opened
      openSection = undefined;
    } else {
      throw new Error(`unexpected event between block.begin/end: ${evt.type}`);
    }
  }
  expect(openSection).toBeUndefined(); // every section closed before block.end
}

/** Pull the path + line text out of every `block.code.line` event, in delivery order. */
function streamedLines(events: PromptAndBlockMsgs[]): { path: string; line: string }[] {
  return events
    .filter((e) => (e as { type: string }).type === "block.code.line")
    .map((e) => {
      const m = e as { path: string; line: string };
      return { path: m.path, line: m.line };
    });
}

describe("handleWholeFileCodegenRequest live streaming", () => {
  it("emits a strictly-ordered, non-interleaved block.begin → sections → block.end stream", async () => {
    const result: WholeFileResult = {
      files: [
        { filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" },
        { filename: "/access.js", lang: "js", content: "x\ny" },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
    const { deps, emitted } = makeDeps((onLine) => {
      // App.jsx streams two completed lines (its trailing "c" is withheld — no
      // newline yet), then the model switches to access.js (one completed line).
      onLine("/App.jsx", "jsx", "a", 0);
      onLine("/App.jsx", "jsx", "b", 1);
      onLine("/access.js", "js", "x", 0);
    }, result);

    const r = await handleWholeFileCodegenRequest(deps);
    expect(r.isOk()).toBe(true);
    assertStrictOrdering(emitted);

    // Both sections appear, App.jsx fully before access.js (no interleave).
    const sectionOrder = emitted
      .filter((e) => (e as { type: string }).type === "block.code.begin")
      .map((e) => (e as { path: string }).path);
    expect(sectionOrder).toEqual(["/App.jsx", "/access.js"]);
  });

  it("tops up the last open file to its final content (the withheld trailing line)", async () => {
    const result: WholeFileResult = {
      files: [{ filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
    const { deps, emitted } = makeDeps((onLine) => {
      onLine("/App.jsx", "jsx", "a", 0);
      onLine("/App.jsx", "jsx", "b", 1);
      // "c" never streams (no trailing newline) — reconciliation must add it.
    }, result);

    await handleWholeFileCodegenRequest(deps);
    assertStrictOrdering(emitted);
    expect(streamedLines(emitted)).toEqual([
      { path: "/App.jsx", line: "a" },
      { path: "/App.jsx", line: "b" },
      { path: "/App.jsx", line: "c" },
    ]);
  });

  it("emits a full section for a file that never produced a streamed line", async () => {
    const result: WholeFileResult = {
      files: [
        { filename: "/App.jsx", lang: "jsx", content: "a\nb" },
        { filename: "/config.js", lang: "js", content: "z" }, // single line, never streams
      ],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
    const { deps, emitted } = makeDeps((onLine) => {
      onLine("/App.jsx", "jsx", "a", 0);
    }, result);

    await handleWholeFileCodegenRequest(deps);
    assertStrictOrdering(emitted);
    const sections = emitted
      .filter((e) => (e as { type: string }).type === "block.code.begin")
      .map((e) => (e as { path: string }).path);
    expect(sections).toContain("/config.js");
    expect(streamedLines(emitted)).toContainEqual({ path: "/config.js", line: "z" });
  });

  it("persists the canonical buildBlockEvents sequence and the resolved files verbatim", async () => {
    const result: WholeFileResult = {
      files: [{ filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" }],
      usage: { prompt_tokens: 7, completion_tokens: 8, total_tokens: 15 },
    };
    const { deps, persisted } = makeDeps((onLine) => {
      onLine("/App.jsx", "jsx", "a", 0);
    }, result);

    await handleWholeFileCodegenRequest(deps);
    expect(persisted).toHaveLength(1);
    const { collectedMsgs, fileSystem, value } = persisted[0];
    // Canonical sequence: block.begin, 3 code.line (a,b,c), framing, block.end.
    expect(collectedMsgs[0].type).toBe("block.begin");
    expect(collectedMsgs[collectedMsgs.length - 1].type).toBe("block.end");
    expect(value.usage.calculated).toEqual({ prompt_tokens: 7, completion_tokens: 8, total_tokens: 15 });
    // Files handed in verbatim (skips SEARCH/REPLACE resolution).
    expect(fileSystem).toEqual([{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: "a\nb\nc" }]);
  });
});
