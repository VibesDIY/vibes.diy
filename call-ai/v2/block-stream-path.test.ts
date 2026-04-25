import { describe, it, expect, beforeEach } from "vitest";
import { stream2array } from "@adviser/cement";
import { createBlockStream, isCodeBegin, isCodeLine, isCodeEnd, type CodeBeginMsg, type CodeEndMsg } from "./block-stream.js";
import type { LineStreamMsg } from "./line-stream.js";

const innerStreamId = "inner";
const streamId = "test";

function makeLineEvents(lines: string[]): LineStreamMsg[] {
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

async function runBlockStream(lines: string[]) {
  const events = makeLineEvents(lines);
  const input = new ReadableStream<LineStreamMsg>({
    start(controller) {
      events.forEach((e) => controller.enqueue(e));
      controller.close();
    },
  });
  let idCounter = 0;
  const createId = () => `id-${++idCounter}`;
  return stream2array(input.pipeThrough(createBlockStream(streamId, innerStreamId, createId)));
}

describe("block-stream path-line tracking", () => {
  beforeEach(() => {});

  it("attaches path 'App.jsx' (default) when no path line precedes the fence", async () => {
    const chunks = await runBlockStream(["Some intro prose.", "```jsx", "const x = 1;", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    const end = chunks.find((c) => isCodeEnd(c)) as CodeEndMsg | undefined;
    expect(begin?.path).toBe("App.jsx");
    expect(end?.path).toBe("App.jsx");
  });

  it("attaches the preceding path-line as the path", async () => {
    const chunks = await runBlockStream(["Building a layout.", "App.jsx", "```jsx", "const x = 1;", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    const end = chunks.find((c) => isCodeEnd(c)) as CodeEndMsg | undefined;
    expect(begin?.path).toBe("App.jsx");
    expect(end?.path).toBe("App.jsx");
  });

  it("recognizes nested-path filenames with allowed extensions", async () => {
    const chunks = await runBlockStream(["src/components/Foo.tsx", "```tsx", "export const Foo = () => null;", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    expect(begin?.path).toBe("src/components/Foo.tsx");
  });

  it("ignores a non-path-looking preceding line", async () => {
    const chunks = await runBlockStream(["Here is the code:", "```jsx", "const x = 1;", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    expect(begin?.path).toBe("App.jsx");
  });

  it("stamps path on every code.line within the block", async () => {
    const chunks = await runBlockStream(["App.jsx", "```jsx", "const a = 1;", "const b = 2;", "```"]);
    const lines = chunks.filter((c) => isCodeLine(c));
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l.path).toBe("App.jsx");
  });

  it("uses the most recent non-blank toplevel line, not earlier ones", async () => {
    const chunks = await runBlockStream(["First paragraph.", "App.jsx", "", "```jsx", "const x = 1;", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    expect(begin?.path).toBe("App.jsx");
  });

  it("does not carry a path-line forward across multiple blocks if the second has its own toplevel section", async () => {
    const chunks = await runBlockStream([
      "App.jsx",
      "```jsx",
      "const a = 1;",
      "```",
      "Now some more prose without a path line.",
      "```jsx",
      "const b = 2;",
      "```",
    ]);
    const begins = chunks.filter((c) => isCodeBegin(c)) as CodeBeginMsg[];
    expect(begins).toHaveLength(2);
    expect(begins[0].path).toBe("App.jsx");
    // Second block's preceding toplevel line is prose, so it falls back to default.
    expect(begins[1].path).toBe("App.jsx");
  });

  it("rejects a path line whose extension is not in the allowed set", async () => {
    const chunks = await runBlockStream(["foo.exe", "```", "binary", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    expect(begin?.path).toBe("App.jsx");
  });
});
