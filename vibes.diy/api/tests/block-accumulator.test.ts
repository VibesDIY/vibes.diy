import { describe, expect, it } from "vitest";
import { createBlockAccumulator } from "@vibes.diy/api-svc";
import type { CodeBeginMsg, CodeLineMsg, CodeEndMsg } from "@vibes.diy/call-ai-v2";

const ts = new Date("2026-05-04T00:00:00Z");

function begin(blockId: string, path = "App.jsx"): CodeBeginMsg {
  return {
    type: "block.code.begin",
    blockId,
    blockNr: 1,
    streamId: "stream",
    seq: 1,
    timestamp: ts,
    sectionId: `sec-${blockId}`,
    lang: "jsx",
    path,
  };
}
function line(blockId: string, text: string, lineNr: number, path = "App.jsx"): CodeLineMsg {
  return {
    type: "block.code.line",
    blockId,
    blockNr: 1,
    streamId: "stream",
    seq: 2,
    timestamp: ts,
    sectionId: `sec-${blockId}`,
    lang: "jsx",
    path,
    line: text,
    lineNr,
  };
}
function end(blockId: string, lineCount: number, byteCount: number, path = "App.jsx"): CodeEndMsg {
  return {
    type: "block.code.end",
    blockId,
    blockNr: 1,
    streamId: "stream",
    seq: 3,
    timestamp: ts,
    sectionId: `sec-${blockId}`,
    lang: "jsx",
    path,
    stats: { lines: lineCount, bytes: byteCount },
  };
}

describe("createBlockAccumulator", () => {
  it("emits a closed block on code.end with the block's begin and lines", () => {
    const acc = createBlockAccumulator();
    expect(acc.ingest(begin("A"))).toBeUndefined();
    expect(acc.ingest(line("A", "first", 1))).toBeUndefined();
    expect(acc.ingest(line("A", "second", 2))).toBeUndefined();
    const closed = acc.ingest(end("A", 2, 11));
    expect(closed).toBeDefined();
    expect(closed?.begin.blockId).toBe("A");
    expect(closed?.lines.map((l) => l.line)).toEqual(["first", "second"]);
    expect(closed?.end.blockId).toBe("A");
  });

  it("routes interleaved blockIds to the correct block (A and B in flight)", () => {
    const acc = createBlockAccumulator();
    acc.ingest(begin("A"));
    acc.ingest(begin("B"));
    acc.ingest(line("A", "a-1", 1));
    acc.ingest(line("B", "b-1", 1));
    acc.ingest(line("A", "a-2", 2));
    const closedA = acc.ingest(end("A", 2, 6));
    expect(closedA?.begin.blockId).toBe("A");
    expect(closedA?.lines.map((l) => l.line)).toEqual(["a-1", "a-2"]);
    acc.ingest(line("B", "b-2", 2));
    const closedB = acc.ingest(end("B", 2, 6));
    expect(closedB?.begin.blockId).toBe("B");
    expect(closedB?.lines.map((l) => l.line)).toEqual(["b-1", "b-2"]);
  });

  it("ignores code.line and code.end without a matching code.begin", () => {
    const acc = createBlockAccumulator();
    expect(acc.ingest(line("orphan", "stray", 1))).toBeUndefined();
    expect(acc.ingest(end("orphan", 1, 5))).toBeUndefined();
  });

  it("returns undefined for non-code messages", () => {
    const acc = createBlockAccumulator();
    // Only block.code.{begin,line,end} matter; anything else is a no-op pass-through.
    const irrelevant = { type: "block.toplevel.line", line: "x" } as unknown as CodeBeginMsg;
    expect(acc.ingest(irrelevant)).toBeUndefined();
  });

  it("can be reused across consecutive prompts (state cleared on close)", () => {
    const acc = createBlockAccumulator();
    acc.ingest(begin("A"));
    acc.ingest(line("A", "x", 1));
    acc.ingest(end("A", 1, 1));
    // After A closes, a new begin with the same blockId starts fresh.
    acc.ingest(begin("A"));
    acc.ingest(line("A", "y", 1));
    const closed = acc.ingest(end("A", 1, 1));
    expect(closed?.lines.map((l) => l.line)).toEqual(["y"]);
  });
});
