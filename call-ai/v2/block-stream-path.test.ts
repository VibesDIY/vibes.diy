import { describe, it, expect } from "vitest";
import { stream2array } from "@adviser/cement";
import {
  createBlockStream,
  isCodeBegin,
  isCodeLine,
  isCodeEnd,
  isToplevelLine,
  type CodeBeginMsg,
  type CodeEndMsg,
  type ToplevelLineMsg,
} from "./block-stream.js";
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

describe("block-stream path-line suppression from toplevel emissions", () => {
  const toplevelLines = (chunks: unknown[]): string[] =>
    chunks.filter((c): c is ToplevelLineMsg => isToplevelLine(c)).map((c) => c.line);

  it("does not emit the path-line as toplevel.line when followed by a fence", async () => {
    const chunks = await runBlockStream(["App.jsx", "```jsx", "const x = 1;", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    expect(begin?.path).toBe("App.jsx");
    expect(toplevelLines(chunks)).toEqual([]);
  });

  it("emits prose lines but suppresses the trailing path-line before a fence", async () => {
    const chunks = await runBlockStream(["do this", "App.jsx", "```jsx", "x", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    expect(begin?.path).toBe("App.jsx");
    expect(toplevelLines(chunks)).toEqual(["do this"]);
  });

  it("emits a prose-only line at end-of-stream", async () => {
    const chunks = await runBlockStream(["hello world"]);
    expect(toplevelLines(chunks)).toEqual(["hello world"]);
  });

  it("emits a path-shape sentence as prose (regex requires bare path)", async () => {
    const chunks = await runBlockStream(["see App.jsx for details"]);
    expect(toplevelLines(chunks)).toEqual(["see App.jsx for details"]);
  });

  it("flushes a buffered path-candidate when the next line is non-path prose (no fence)", async () => {
    // "App.jsx is great" is a sentence (not a bare path), so it's treated as prose
    // and forces the previously buffered "App.jsx" candidate to flush.
    const chunks = await runBlockStream(["App.jsx", "App.jsx is great"]);
    expect(toplevelLines(chunks)).toEqual(["App.jsx", "App.jsx is great"]);
  });

  it("when two path-candidate lines back-to-back precede a fence, last wins; earlier flushes as prose", async () => {
    const chunks = await runBlockStream(["App.jsx", "Utils.ts", "```ts", "x", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    expect(begin?.path).toBe("Utils.ts");
    expect(toplevelLines(chunks)).toEqual(["App.jsx"]);
  });

  it("flushes a buffered path-candidate at end-of-stream with no closing fence", async () => {
    const chunks = await runBlockStream(["App.jsx"]);
    expect(toplevelLines(chunks)).toEqual(["App.jsx"]);
  });

  it("path-line at very start with no prior prose is suppressed when fence follows", async () => {
    const chunks = await runBlockStream(["src/components/Foo.tsx", "```tsx", "export const Foo = () => null;", "```"]);
    const begin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg | undefined;
    expect(begin?.path).toBe("src/components/Foo.tsx");
    expect(toplevelLines(chunks)).toEqual([]);
  });
});

describe("block-stream trailing horizontal-rule suppression", () => {
  const toplevelLines = (chunks: unknown[]): string[] =>
    chunks.filter((c): c is ToplevelLineMsg => isToplevelLine(c)).map((c) => c.line);

  it("drops a trailing '---' at end of stream", async () => {
    const chunks = await runBlockStream(["Some closing thoughts.", "---"]);
    expect(toplevelLines(chunks)).toEqual(["Some closing thoughts."]);
  });

  it("drops a stream consisting only of '---'", async () => {
    const chunks = await runBlockStream(["---"]);
    expect(toplevelLines(chunks)).toEqual([]);
  });

  it("emits '---' mid-content when followed by more prose", async () => {
    const chunks = await runBlockStream(["intro", "---", "outro"]);
    expect(toplevelLines(chunks)).toEqual(["intro", "---", "outro"]);
  });

  it("emits '---' as prose when a code fence follows (fence is not end-of-stream)", async () => {
    const chunks = await runBlockStream(["intro", "---", "```jsx", "x", "```"]);
    expect(toplevelLines(chunks)).toEqual(["intro", "---"]);
  });

  it("drops trailing '---' that follows a code block", async () => {
    const chunks = await runBlockStream(["App.jsx", "```jsx", "x", "```", "---"]);
    expect(toplevelLines(chunks)).toEqual([]);
  });

  it("path-candidate followed by '---' then EOF: path flushes as prose, '---' is dropped", async () => {
    const chunks = await runBlockStream(["App.jsx", "---"]);
    expect(toplevelLines(chunks)).toEqual(["App.jsx"]);
  });
});
