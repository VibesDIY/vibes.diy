import { describe, expect, it } from "vitest";
import { stream2array } from "@adviser/cement";
import { createBlockStream, isCodeBegin, type BlockStreamMsg } from "./block-stream.js";
import type { LineStreamMsg } from "./line-stream.js";
import {
  createFileSystemStream,
  isFsApplyError,
  isFsFileSnapshot,
  isFsTurnEnd,
  type FsApplyErrorMsg,
  type FsFileSnapshotMsg,
  type FsTurnEndMsg,
} from "./filesystem-stream.js";

const innerStreamId = "inner";
const streamId = "test";

function lineEvents(lines: readonly string[]): LineStreamMsg[] {
  const events: LineStreamMsg[] = [{ type: "line.begin", streamId: innerStreamId, timestamp: new Date() }];
  lines.forEach((content, i) => {
    events.push({
      type: "line.line",
      streamId: innerStreamId,
      content,
      lineNr: i + 1,
      timestamp: new Date(),
    });
  });
  events.push({ type: "line.end", streamId: innerStreamId, totalLines: lines.length, timestamp: new Date() });
  return events;
}

async function runFs(lines: readonly string[], seed?: ReadonlyMap<string, string>) {
  const events = lineEvents(lines);
  let n = 0;
  const createId = () => `id-${++n}`;
  const input = new ReadableStream<LineStreamMsg>({
    start(controller) {
      events.forEach((e) => controller.enqueue(e));
      controller.close();
    },
  });
  const piped = input
    .pipeThrough(createBlockStream(streamId, innerStreamId, createId))
    .pipeThrough(createFileSystemStream({ streamId, createId, seed }));
  return stream2array(piped);
}

describe("filesystem-stream — create blocks", () => {
  it("emits a create snapshot for a fence with no markers", async () => {
    const chunks = await runFs(["App.jsx", "```jsx", "const a = 1;", "const b = 2;", "```"]);
    const snapshots = chunks.filter((c) => isFsFileSnapshot(c)) as FsFileSnapshotMsg[];
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      type: "fs.file.snapshot",
      path: "App.jsx",
      source: "create",
      content: "const a = 1;\nconst b = 2;",
    });
  });

  it("emits no fs.apply.error when create succeeds", async () => {
    const chunks = await runFs(["App.jsx", "```jsx", "const x = 1;", "```"]);
    const errors = chunks.filter((c) => isFsApplyError(c));
    expect(errors).toEqual([]);
  });

  it("falls back to App.jsx when no path line precedes the fence", async () => {
    const chunks = await runFs(["```jsx", "const x = 1;", "```"]);
    const snapshots = chunks.filter((c) => isFsFileSnapshot(c)) as FsFileSnapshotMsg[];
    expect(snapshots[0].path).toBe("App.jsx");
  });
});

describe("filesystem-stream — replace blocks", () => {
  it("applies a single SEARCH/REPLACE against the seed", async () => {
    const seed = new Map([["App.jsx", "const greeting = 'hi';\n"]]);
    const chunks = await runFs(
      [
        "App.jsx",
        "```jsx",
        "<<<<<<< SEARCH",
        "const greeting = 'hi';",
        "=======",
        "const greeting = 'hello';",
        ">>>>>>> REPLACE",
        "```",
      ],
      seed
    );
    const snap = chunks.find((c) => isFsFileSnapshot(c)) as FsFileSnapshotMsg | undefined;
    expect(snap).toBeDefined();
    expect(snap?.source).toBe("replace");
    expect(snap?.content).toBe("const greeting = 'hello';\n");
    expect(snap?.appliedSections).toBe(1);
  });

  it("applies multiple SEARCH/REPLACE sections in one fence in order", async () => {
    const seed = new Map([["App.jsx", "let a = 1;\nlet b = 2;\n"]]);
    const chunks = await runFs(
      [
        "App.jsx",
        "```jsx",
        "<<<<<<< SEARCH",
        "let a = 1;",
        "=======",
        "let a = 10;",
        ">>>>>>> REPLACE",
        "<<<<<<< SEARCH",
        "let b = 2;",
        "=======",
        "let b = 20;",
        ">>>>>>> REPLACE",
        "```",
      ],
      seed
    );
    const snap = chunks.find((c) => isFsFileSnapshot(c)) as FsFileSnapshotMsg | undefined;
    expect(snap?.content).toBe("let a = 10;\nlet b = 20;\n");
    expect(snap?.appliedSections).toBe(2);
  });

  it("composes a create followed by a replace within one turn", async () => {
    const chunks = await runFs([
      "App.jsx",
      "```jsx",
      "const value = 1;",
      "```",
      "Adjusting the value.",
      "App.jsx",
      "```jsx",
      "<<<<<<< SEARCH",
      "const value = 1;",
      "=======",
      "const value = 42;",
      ">>>>>>> REPLACE",
      "```",
    ]);
    const snapshots = chunks.filter((c) => isFsFileSnapshot(c)) as FsFileSnapshotMsg[];
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({ source: "create", content: "const value = 1;" });
    expect(snapshots[1]).toMatchObject({ source: "replace", content: "const value = 42;" });
  });
});

describe("filesystem-stream — failures", () => {
  it("emits fs.apply.error and does not mutate VFS when SEARCH does not match", async () => {
    const seed = new Map([["App.jsx", "const x = 1;\n"]]);
    const chunks = await runFs(
      ["App.jsx", "```jsx", "<<<<<<< SEARCH", "const y = 99;", "=======", "const y = 100;", ">>>>>>> REPLACE", "```"],
      seed
    );
    const snapshots = chunks.filter((c) => isFsFileSnapshot(c));
    const errors = chunks.filter((c) => isFsApplyError(c)) as FsApplyErrorMsg[];
    expect(snapshots).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].failures[0]).toMatchObject({ reason: "no-match", sectionIndex: 0 });
    const turnEnd = chunks.find((c) => isFsTurnEnd(c)) as FsTurnEndMsg | undefined;
    expect(turnEnd?.files["App.jsx"]).toBe("const x = 1;\n");
  });

  it("emits fs.apply.error for ambiguous (multi-match) SEARCH", async () => {
    const seed = new Map([["App.jsx", "let a = 1;\nlet a = 1;\n"]]);
    const chunks = await runFs(
      ["App.jsx", "```jsx", "<<<<<<< SEARCH", "let a = 1;", "=======", "let a = 99;", ">>>>>>> REPLACE", "```"],
      seed
    );
    const errors = chunks.filter((c) => isFsApplyError(c)) as FsApplyErrorMsg[];
    expect(errors[0].failures[0]).toMatchObject({ reason: "multiple-match", sectionIndex: 0 });
  });

  it("reports parse-error failures from malformed bodies", async () => {
    const chunks = await runFs(["App.jsx", "```jsx", "<<<<<<< SEARCH", "missing divider and end", "```"]);
    const errors = chunks.filter((c) => isFsApplyError(c)) as FsApplyErrorMsg[];
    expect(errors).toHaveLength(1);
    expect(errors[0].failures[0]).toMatchObject({ reason: "parse-error" });
  });
});

describe("filesystem-stream — turn end", () => {
  it("emits fs.turn.end with the final files map", async () => {
    const chunks = await runFs(["App.jsx", "```jsx", "const x = 42;", "```"]);
    const turnEnd = chunks.find((c) => isFsTurnEnd(c)) as FsTurnEndMsg | undefined;
    expect(turnEnd).toBeDefined();
    expect(turnEnd?.files).toEqual({ "App.jsx": "const x = 42;" });
  });

  it("turn end carries forward seeded files even if no edits happened", async () => {
    const seed = new Map([
      ["App.jsx", "seeded\n"],
      ["other.jsx", "other\n"],
    ]);
    const chunks = await runFs(["just prose"], seed);
    const turnEnd = chunks.find((c) => isFsTurnEnd(c)) as FsTurnEndMsg | undefined;
    expect(turnEnd?.files).toEqual({ "App.jsx": "seeded\n", "other.jsx": "other\n" });
  });
});

describe("filesystem-stream — passthrough", () => {
  it("does not swallow upstream block messages", async () => {
    const chunks = await runFs(["App.jsx", "```jsx", "x", "```"]);
    // Upstream block messages should still be present alongside fs.* messages.
    const codeBegins = chunks.filter((c) => isCodeBegin(c));
    expect(codeBegins).toHaveLength(1);
  });
});

describe("filesystem-stream — block.code.truncated handling", () => {
  // Drive raw BlockStreamMsg events directly (skip createBlockStream) so we
  // can splice in a synthetic block.code.truncated. Mirrors what the server
  // emits when streamingResolver detects an apply error mid-block.
  async function runFsWithBlocks(blocks: readonly BlockStreamMsg[], seed?: ReadonlyMap<string, string>) {
    let n = 0;
    const createId = () => `id-${++n}`;
    const input = new ReadableStream<BlockStreamMsg>({
      start(controller) {
        blocks.forEach((b) => controller.enqueue(b));
        controller.close();
      },
    });
    const piped = input.pipeThrough(createFileSystemStream({ streamId, createId, seed }));
    return stream2array(piped);
  }

  const ts = new Date("2026-05-04T00:00:00Z");

  it("drops the in-flight accumulator and never applies the partial edit when truncate fires", async () => {
    const seed = new Map([["App.jsx", "before\n"]]);
    const events: BlockStreamMsg[] = [
      {
        type: "block.code.begin",
        blockId: "blk-A",
        streamId,
        seq: 0,
        blockNr: 1,
        timestamp: ts,
        sectionId: "sec-A",
        lang: "jsx",
        path: "App.jsx",
      },
      {
        type: "block.code.line",
        blockId: "blk-A",
        streamId,
        seq: 1,
        blockNr: 1,
        timestamp: ts,
        sectionId: "sec-A",
        lang: "jsx",
        path: "App.jsx",
        lineNr: 1,
        line: "<<<<<<< SEARCH",
      },
      {
        type: "block.code.line",
        blockId: "blk-A",
        streamId,
        seq: 2,
        blockNr: 1,
        timestamp: ts,
        sectionId: "sec-A",
        lang: "jsx",
        path: "App.jsx",
        lineNr: 2,
        line: "before",
      },
      // Server emits truncate INSTEAD of code.end. The fence body would have
      // applied (search matches "before") if it had gotten the rest, but the
      // suppression means nothing should hit the vfs.
      {
        type: "block.code.truncated",
        blockId: "blk-A",
        streamId,
        seq: 3,
        blockNr: 1,
        timestamp: ts,
        sectionId: "sec-A",
        lang: "jsx",
        path: "App.jsx",
        reason: "divider-as-end",
        kind: "fence-parse",
        truncatedAtLine: 2,
        errorCount: 1,
      },
    ];
    const chunks = await runFsWithBlocks(events, seed);

    // No fs.file.snapshot — truncate suppressed the apply.
    expect(chunks.filter((c) => isFsFileSnapshot(c))).toHaveLength(0);
    // No fs.apply.error — the upstream apply error already produced the
    // server-side log; the CLI does not re-emit one.
    expect(chunks.filter((c) => isFsApplyError(c))).toHaveLength(0);
    // The truncate event itself flows through (passthrough preserves it for
    // any UX layer downstream that wants to render "↻ recovering").
    const truncates = chunks.filter((c) => (c as { type?: string }).type === "block.code.truncated");
    expect(truncates).toHaveLength(1);
  });

  it("the recovery's clean replacement block (different sectionId) applies normally after a truncate", async () => {
    // Failed block A sec-A, then recovery block B sec-B both targeting App.jsx.
    const seed = new Map([["App.jsx", "before\n"]]);
    const events: BlockStreamMsg[] = [
      {
        type: "block.code.begin",
        blockId: "blk-A",
        streamId,
        seq: 0,
        blockNr: 1,
        timestamp: ts,
        sectionId: "sec-A",
        lang: "jsx",
        path: "App.jsx",
      },
      {
        type: "block.code.line",
        blockId: "blk-A",
        streamId,
        seq: 1,
        blockNr: 1,
        timestamp: ts,
        sectionId: "sec-A",
        lang: "jsx",
        path: "App.jsx",
        lineNr: 1,
        line: "garbage",
      },
      {
        type: "block.code.truncated",
        blockId: "blk-A",
        streamId,
        seq: 2,
        blockNr: 1,
        timestamp: ts,
        sectionId: "sec-A",
        lang: "jsx",
        path: "App.jsx",
        reason: "divider-as-end",
        kind: "fence-parse",
        truncatedAtLine: 1,
        errorCount: 1,
      },
      {
        type: "block.code.begin",
        blockId: "blk-B",
        streamId,
        seq: 3,
        blockNr: 2,
        timestamp: ts,
        sectionId: "sec-B",
        lang: "jsx",
        path: "App.jsx",
      },
      ...["<<<<<<< SEARCH", "before", "=======", "after", ">>>>>>> REPLACE"].map(
        (line, i) =>
          ({
            type: "block.code.line",
            blockId: "blk-B",
            streamId,
            seq: 4 + i,
            blockNr: 2,
            timestamp: ts,
            sectionId: "sec-B",
            lang: "jsx",
            path: "App.jsx",
            lineNr: i + 1,
            line,
          }) satisfies BlockStreamMsg
      ),
      {
        type: "block.code.end",
        blockId: "blk-B",
        streamId,
        seq: 9,
        blockNr: 2,
        timestamp: ts,
        sectionId: "sec-B",
        lang: "jsx",
        path: "App.jsx",
        stats: { lines: 5, bytes: 50 },
      },
    ];
    const chunks = await runFsWithBlocks(events, seed);
    const snaps = chunks.filter((c) => isFsFileSnapshot(c)) as FsFileSnapshotMsg[];
    expect(snaps).toHaveLength(1);
    expect(snaps[0].sectionId).toBe("sec-B");
    expect(snaps[0].content).toBe("after\n");
    // Apply errors: zero (the truncate suppressed the broken block; recovery applied cleanly).
    expect(chunks.filter((c) => isFsApplyError(c))).toHaveLength(0);
  });
});
