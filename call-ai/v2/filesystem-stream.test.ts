import { describe, expect, it } from "vitest";
import { stream2array } from "@adviser/cement";
import {
  createBlockStream,
  isCodeBegin,
} from "./block-stream.js";
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

async function runFs(
  lines: readonly string[],
  seed?: ReadonlyMap<string, string>
) {
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
    const chunks = await runFs([
      "App.jsx",
      "```jsx",
      "const a = 1;",
      "const b = 2;",
      "```",
    ]);
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
      [
        "App.jsx",
        "```jsx",
        "<<<<<<< SEARCH",
        "const y = 99;",
        "=======",
        "const y = 100;",
        ">>>>>>> REPLACE",
        "```",
      ],
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
      [
        "App.jsx",
        "```jsx",
        "<<<<<<< SEARCH",
        "let a = 1;",
        "=======",
        "let a = 99;",
        ">>>>>>> REPLACE",
        "```",
      ],
      seed
    );
    const errors = chunks.filter((c) => isFsApplyError(c)) as FsApplyErrorMsg[];
    expect(errors[0].failures[0]).toMatchObject({ reason: "multiple-match", sectionIndex: 0 });
  });

  it("reports parse-error failures from malformed bodies", async () => {
    const chunks = await runFs([
      "App.jsx",
      "```jsx",
      "<<<<<<< SEARCH",
      "missing divider and end",
      "```",
    ]);
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
