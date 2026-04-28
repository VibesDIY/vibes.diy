import { describe, expect, it } from "vitest";
import type { SectionEvent } from "@vibes.diy/api-types";
import { resolveSectionStream } from "./resolve-section-stream.js";

const streamId = "stream-1";

interface BlockBaseFields {
  readonly blockId: string;
  readonly seq: number;
  readonly blockNr: number;
}

function blockBase(fields: BlockBaseFields) {
  return {
    blockId: fields.blockId,
    streamId,
    seq: fields.seq,
    blockNr: fields.blockNr,
    timestamp: new Date(),
  };
}

interface CodeBlockFixture {
  readonly blockId: string;
  readonly blockNr: number;
  readonly sectionId: string;
  readonly path: string;
  readonly lines: readonly string[];
}

function codeBlockMessages(fx: CodeBlockFixture) {
  const lang = "jsx";
  const baseSeq = fx.blockNr * 100;
  const messages: unknown[] = [];
  messages.push({
    type: "block.code.begin",
    sectionId: fx.sectionId,
    lang,
    path: fx.path,
    ...blockBase({ blockId: fx.blockId, seq: baseSeq, blockNr: fx.blockNr }),
  });
  fx.lines.forEach((line, idx) => {
    messages.push({
      type: "block.code.line",
      sectionId: fx.sectionId,
      lang,
      path: fx.path,
      lineNr: idx + 1,
      line,
      ...blockBase({ blockId: fx.blockId, seq: baseSeq + 1 + idx, blockNr: fx.blockNr }),
    });
  });
  const afterLines = baseSeq + 1 + fx.lines.length;
  messages.push({
    type: "block.code.end",
    sectionId: fx.sectionId,
    lang,
    path: fx.path,
    stats: { lines: fx.lines.length, bytes: fx.lines.join("\n").length },
    ...blockBase({ blockId: fx.blockId, seq: afterLines, blockNr: fx.blockNr }),
  });
  messages.push({
    type: "block.end",
    stats: {
      toplevel: { lines: 0, bytes: 0 },
      code: { lines: fx.lines.length, bytes: fx.lines.join("\n").length },
      image: { lines: 0, bytes: 0 },
      total: { lines: fx.lines.length, bytes: fx.lines.join("\n").length },
    },
    usage: {
      given: [],
      calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    },
    ...blockBase({ blockId: fx.blockId, seq: afterLines + 1, blockNr: fx.blockNr }),
  });
  return messages;
}

function sectionEventStream(blockFixtures: readonly CodeBlockFixture[]): ReadableStream<SectionEvent> {
  return new ReadableStream<SectionEvent>({
    start(controller) {
      blockFixtures.forEach((fx, idx) => {
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: "prompt-1",
          blockSeq: idx,
          timestamp: new Date(),
          blocks: codeBlockMessages(fx) as SectionEvent["blocks"],
        });
      });
      controller.close();
    },
  });
}

describe("resolveSectionStream", () => {
  it("resolves a single create block into one file", async () => {
    const stream = sectionEventStream([
      {
        blockId: "b1",
        blockNr: 1,
        sectionId: "s1",
        path: "App.jsx",
        lines: ['import React from "react";', "", "export default function App() { return <h1>Hi</h1>; }"],
      },
    ]);

    const r = await resolveSectionStream({ sectionStream: stream, streamId });
    expect(r.isOk()).toBe(true);
    const ok = r.Ok();
    expect(ok.errors).toEqual([]);
    expect(ok.files["App.jsx"]).toBe('import React from "react";\n\nexport default function App() { return <h1>Hi</h1>; }');
  });

  it("composes a SEARCH/REPLACE edit against the prior block", async () => {
    const scaffoldLines = ['import React from "react";', "", "export default function App() {", "  return <h1>Hello</h1>;", "}"];
    const editLines = [
      "<<<<<<< SEARCH",
      "  return <h1>Hello</h1>;",
      "=======",
      "  return <h1>Hello, world</h1>;",
      ">>>>>>> REPLACE",
    ];
    const stream = sectionEventStream([
      { blockId: "b1", blockNr: 1, sectionId: "s1", path: "App.jsx", lines: scaffoldLines },
      { blockId: "b2", blockNr: 2, sectionId: "s2", path: "App.jsx", lines: editLines },
    ]);

    const r = await resolveSectionStream({ sectionStream: stream, streamId });
    expect(r.isOk()).toBe(true);
    const ok = r.Ok();
    expect(ok.errors).toEqual([]);
    expect(ok.files["App.jsx"]).toContain("Hello, world");
    expect(ok.files["App.jsx"]).not.toContain("<<<<<<< SEARCH");
    expect(ok.files["App.jsx"]).not.toContain(">>>>>>> REPLACE");
  });

  it("captures apply errors when SEARCH does not match and keeps prior content", async () => {
    const scaffoldLines = ['import React from "react";', "export default function App() { return <h1>Hi</h1>; }"];
    const badEditLines = ["<<<<<<< SEARCH", "this string is not in the file", "=======", "replacement", ">>>>>>> REPLACE"];
    const stream = sectionEventStream([
      { blockId: "b1", blockNr: 1, sectionId: "s1", path: "App.jsx", lines: scaffoldLines },
      { blockId: "b2", blockNr: 2, sectionId: "s2", path: "App.jsx", lines: badEditLines },
    ]);

    const r = await resolveSectionStream({ sectionStream: stream, streamId });
    expect(r.isOk()).toBe(true);
    const ok = r.Ok();
    expect(ok.errors.length).toBeGreaterThan(0);
    expect(ok.errors[0]).toMatch(/no-match/);
    expect(ok.files["App.jsx"]).toBe(scaffoldLines.join("\n"));
  });

  it("tracks multiple paths independently", async () => {
    const stream = sectionEventStream([
      { blockId: "b1", blockNr: 1, sectionId: "s1", path: "App.jsx", lines: ["// app"] },
      { blockId: "b2", blockNr: 2, sectionId: "s2", path: "Helpers.jsx", lines: ["// helpers"] },
    ]);

    const r = await resolveSectionStream({ sectionStream: stream, streamId });
    expect(r.isOk()).toBe(true);
    const ok = r.Ok();
    expect(ok.files["App.jsx"]).toBe("// app");
    expect(ok.files["Helpers.jsx"]).toBe("// helpers");
  });

  it("invokes onSnapshot per code.end and onError per apply failure", async () => {
    const scaffoldLines = ["// scaffold"];
    const badEditLines = ["<<<<<<< SEARCH", "missing", "=======", "x", ">>>>>>> REPLACE"];
    const stream = sectionEventStream([
      { blockId: "b1", blockNr: 1, sectionId: "s1", path: "App.jsx", lines: scaffoldLines },
      { blockId: "b2", blockNr: 2, sectionId: "s2", path: "App.jsx", lines: badEditLines },
    ]);

    const snapshots: string[] = [];
    const errors: string[] = [];
    const r = await resolveSectionStream({
      sectionStream: stream,
      streamId,
      onSnapshot: (s) => snapshots.push(`${s.source}:${s.path}`),
      onError: (e) => errors.push(e.path),
    });
    expect(r.isOk()).toBe(true);
    expect(snapshots).toEqual(["create:App.jsx"]);
    expect(errors).toEqual(["App.jsx"]);
  });
});
