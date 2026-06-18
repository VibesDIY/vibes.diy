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
    expect(ok.snapshotCount).toBe(1);
    expect(ok.applyErrorCount).toBe(0);
    expect(ok.turnEndSeen).toBe(true);
  });

  it("flags a turn-end with no snapshots — silent no-op when seeded from disk", async () => {
    // Reproduces the post-#1685 symptom: the new edit turn's block.end fires
    // but no code blocks land, so fs.turn.end emits the seed unchanged and
    // snapshotCount stays at zero. The CLI needs this signal to avoid a
    // byte-identical re-push.
    const seed = new Map([["App.jsx", "export default () => <h1>before</h1>;"]]);
    const stream = new ReadableStream<SectionEvent>({
      start(controller) {
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: streamId,
          blockSeq: 0,
          timestamp: new Date(),
          blocks: [
            {
              type: "block.end",
              stats: {
                toplevel: { lines: 0, bytes: 0 },
                code: { lines: 0, bytes: 0 },
                image: { lines: 0, bytes: 0 },
                total: { lines: 0, bytes: 0 },
              },
              usage: {
                given: [],
                calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              },
              blockId: "b1",
              streamId,
              seq: 0,
              blockNr: 1,
              timestamp: new Date(),
            },
          ] as SectionEvent["blocks"],
        });
        controller.close();
      },
    });

    const r = await resolveSectionStream({ sectionStream: stream, streamId, seed });
    expect(r.isOk()).toBe(true);
    const ok = r.Ok();
    expect(ok.snapshotCount).toBe(0);
    expect(ok.applyErrorCount).toBe(0);
    expect(ok.turnEndSeen).toBe(true);
    expect(ok.files["App.jsx"]).toBe("export default () => <h1>before</h1>;");
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

  it("composes a SEARCH/REPLACE edit against seeded file content", async () => {
    const editLines = [
      "<<<<<<< SEARCH",
      "  return <h1>Hello</h1>;",
      "=======",
      "  return <h1>Hello from seed</h1>;",
      ">>>>>>> REPLACE",
    ];
    const stream = sectionEventStream([{ blockId: "b1", blockNr: 1, sectionId: "s1", path: "App.jsx", lines: editLines }]);

    const r = await resolveSectionStream({
      sectionStream: stream,
      streamId,
      seed: new Map([["App.jsx", 'import React from "react";\n\nexport default function App() {\n  return <h1>Hello</h1>;\n}']]),
    });
    expect(r.isOk()).toBe(true);
    const ok = r.Ok();
    expect(ok.errors).toEqual([]);
    expect(ok.files["App.jsx"]).toContain("Hello from seed");
    expect(ok.files["App.jsx"]).not.toContain("<<<<<<< SEARCH");
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
    expect(ok.applyErrorCount).toBe(1);
    expect(ok.snapshotCount).toBe(1); // only the scaffold block applied
    expect(ok.turnEndSeen).toBe(true);
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

  it("ignores prompt.block-end from a different streamId (historical chat replay)", async () => {
    // When `edit` opens an existing chat, the server replays prior section events
    // via resendChatSectionsPrevMsg before the new turn's response arrives. Those
    // historical sections carry the original prompt's streamId — including their
    // own `prompt.block-end` terminator. The resolver must filter the break
    // condition by streamId so it doesn't exit on the historical terminator and
    // miss the new turn entirely. Regression test for #1682.
    const newStreamId = "stream-new";
    const historicalStreamId = "stream-historical";

    const blockBaseFor = (streamIdFor: string, fields: BlockBaseFields) => ({
      blockId: fields.blockId,
      streamId: streamIdFor,
      seq: fields.seq,
      blockNr: fields.blockNr,
      timestamp: new Date(),
    });

    const historicalBlocks: unknown[] = [
      {
        type: "block.code.begin",
        sectionId: "hist-s1",
        lang: "jsx",
        path: "App.jsx",
        ...blockBaseFor(historicalStreamId, { blockId: "hist-b1", seq: 0, blockNr: 1 }),
      },
      {
        type: "block.code.line",
        sectionId: "hist-s1",
        lang: "jsx",
        path: "App.jsx",
        lineNr: 1,
        line: "// historical content that must not become a file",
        ...blockBaseFor(historicalStreamId, { blockId: "hist-b1", seq: 1, blockNr: 1 }),
      },
      {
        type: "block.code.end",
        sectionId: "hist-s1",
        lang: "jsx",
        path: "App.jsx",
        stats: { lines: 1, bytes: 0 },
        ...blockBaseFor(historicalStreamId, { blockId: "hist-b1", seq: 2, blockNr: 1 }),
      },
      {
        type: "prompt.block-end",
        chatId: "chat-1",
        ...blockBaseFor(historicalStreamId, { blockId: "hist-pbe", seq: 3, blockNr: 1 }),
      },
    ];

    const newBlocks: unknown[] = [
      {
        type: "block.code.begin",
        sectionId: "new-s1",
        lang: "jsx",
        path: "App.jsx",
        ...blockBaseFor(newStreamId, { blockId: "new-b1", seq: 0, blockNr: 1 }),
      },
      {
        type: "block.code.line",
        sectionId: "new-s1",
        lang: "jsx",
        path: "App.jsx",
        lineNr: 1,
        line: "// edited content from the new turn",
        ...blockBaseFor(newStreamId, { blockId: "new-b1", seq: 1, blockNr: 1 }),
      },
      {
        type: "block.code.end",
        sectionId: "new-s1",
        lang: "jsx",
        path: "App.jsx",
        stats: { lines: 1, bytes: 0 },
        ...blockBaseFor(newStreamId, { blockId: "new-b1", seq: 2, blockNr: 1 }),
      },
      {
        type: "block.end",
        stats: {
          toplevel: { lines: 0, bytes: 0 },
          code: { lines: 1, bytes: 0 },
          image: { lines: 0, bytes: 0 },
          total: { lines: 1, bytes: 0 },
        },
        usage: {
          given: [],
          calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        },
        ...blockBaseFor(newStreamId, { blockId: "new-b1", seq: 3, blockNr: 1 }),
      },
    ];

    const stream = new ReadableStream<SectionEvent>({
      start(controller) {
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: historicalStreamId,
          blockSeq: 0,
          timestamp: new Date(),
          blocks: historicalBlocks as SectionEvent["blocks"],
        });
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: newStreamId,
          blockSeq: 1,
          timestamp: new Date(),
          blocks: newBlocks as SectionEvent["blocks"],
        });
        controller.close();
      },
    });

    const r = await resolveSectionStream({ sectionStream: stream, streamId: newStreamId });
    expect(r.isOk()).toBe(true);
    const ok = r.Ok();
    expect(ok.errors).toEqual([]);
    expect(ok.files["App.jsx"]).toBe("// edited content from the new turn");
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

  it("recovers snapshot files and captures prompt.error on an abnormal turn end (#2048)", async () => {
    // gpt-5 signature: code streams and applies (a snapshot is emitted), but the
    // upstream stream dies before `block.end`, so no `fs.turn.end` fires. The
    // server's `finally`/`onCatch` still emit `prompt.error` + `prompt.block-end`.
    // Pre-fix this discarded the resolved file and bottomed out as "No files
    // resolved from AI response." despite a complete App.jsx having streamed.
    const codeBlock = codeBlockMessages({
      blockId: "b1",
      blockNr: 1,
      sectionId: "s1",
      path: "App.jsx",
      lines: ["export default () => <h1>recovered</h1>;"],
    });
    // Drop the trailing block.end (last element) to simulate the abnormal end.
    const blocks: unknown[] = [
      ...codeBlock.slice(0, -1),
      {
        type: "prompt.error",
        chatId: "chat-1",
        error: "Upstream connection closed mid-stream",
        ...blockBase({ blockId: "b1", seq: 998, blockNr: 1 }),
      },
      {
        type: "prompt.block-end",
        chatId: "chat-1",
        ...blockBase({ blockId: "b1", seq: 999, blockNr: 1 }),
      },
    ];
    const stream = new ReadableStream<SectionEvent>({
      start(controller) {
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: streamId,
          blockSeq: 0,
          timestamp: new Date(),
          blocks: blocks as SectionEvent["blocks"],
        });
        controller.close();
      },
    });

    const r = await resolveSectionStream({ sectionStream: stream, streamId });
    expect(r.isOk()).toBe(true);
    const ok = r.Ok();
    expect(ok.turnEndSeen).toBe(false);
    expect(ok.snapshotCount).toBe(1);
    expect(ok.files["App.jsx"]).toBe("export default () => <h1>recovered</h1>;");
    expect(ok.promptErrors).toEqual(["Upstream connection closed mid-stream"]);
  });

  it("does not recover seed files when an abnormal end produced zero snapshots (#2442 review)", async () => {
    // edit seeds the resolver from disk. If the provider disconnects before any
    // completed code block (0 snapshots, no fs.turn.end), the only thing in the
    // recovered map is the unchanged seed — returning it would push a
    // byte-identical app while claiming recovery. The abnormal-end-with-no-code
    // case must surface as empty so callers hit the no-files/prompt.error path.
    const seed = new Map([
      ["App.jsx", "export default () => <h1>unchanged</h1>;"],
      ["Helpers.jsx", "// untouched helper"],
    ]);
    const stream = new ReadableStream<SectionEvent>({
      start(controller) {
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: streamId,
          blockSeq: 0,
          timestamp: new Date(),
          blocks: [
            {
              type: "prompt.error",
              chatId: "chat-1",
              error: "Upstream connection closed before any code",
              streamId,
              seq: 0,
              timestamp: new Date(),
            },
            {
              type: "prompt.block-end",
              chatId: "chat-1",
              streamId,
              seq: 1,
              timestamp: new Date(),
            },
          ] as SectionEvent["blocks"],
        });
        controller.close();
      },
    });

    const r = await resolveSectionStream({ sectionStream: stream, streamId, seed });
    expect(r.isOk()).toBe(true);
    const ok = r.Ok();
    expect(ok.turnEndSeen).toBe(false);
    expect(ok.snapshotCount).toBe(0);
    expect(ok.files).toEqual({});
    expect(ok.promptErrors).toEqual(["Upstream connection closed before any code"]);
  });

  it("ignores prompt.error from a different streamId (historical chat replay)", async () => {
    // Same streamId-filtering concern as the prompt.block-end break (#1682):
    // replayed historical sections carry the prior turn's prompt.error, which
    // must not be attributed to the in-flight turn.
    const newStreamId = "stream-new";
    const historicalStreamId = "stream-historical";
    const stream = new ReadableStream<SectionEvent>({
      start(controller) {
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: historicalStreamId,
          blockSeq: 0,
          timestamp: new Date(),
          blocks: [
            {
              type: "prompt.error",
              chatId: "chat-1",
              error: "stale error from a prior turn",
              streamId: historicalStreamId,
              seq: 0,
              timestamp: new Date(),
            },
          ] as SectionEvent["blocks"],
        });
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: newStreamId,
          blockSeq: 1,
          timestamp: new Date(),
          blocks: [
            {
              type: "prompt.block-end",
              chatId: "chat-1",
              streamId: newStreamId,
              seq: 0,
              timestamp: new Date(),
            },
          ] as SectionEvent["blocks"],
        });
        controller.close();
      },
    });

    const r = await resolveSectionStream({ sectionStream: stream, streamId: newStreamId });
    expect(r.isOk()).toBe(true);
    expect(r.Ok().promptErrors).toEqual([]);
  });
});
