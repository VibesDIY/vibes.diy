import { describe, it, expect } from "vitest";
import { getCode } from "~/vibes.diy/app/components/ResultPreview/CodeEditor.js";
import type { PromptState, PromptBlock } from "~/vibes.diy/app/routes/chat/chat.$userSlug.$appSlug.js";
import type { PromptAndBlockMsgs } from "@vibes.diy/api-types";

const ts = new Date("2026-04-25T00:00:00Z");

function blockBegin(blockId: string): PromptAndBlockMsgs {
  return {
    type: "block.begin",
    blockId,
    blockNr: 0,
    streamId: "stream",
    seq: 0,
    timestamp: ts,
  } as PromptAndBlockMsgs;
}

function codeBegin(blockId: string, sectionId: string, path = "App.jsx"): PromptAndBlockMsgs {
  return {
    type: "block.code.begin",
    blockId,
    blockNr: 1,
    streamId: "stream",
    seq: 1,
    timestamp: ts,
    sectionId,
    lang: "jsx",
    path,
  } as PromptAndBlockMsgs;
}

function codeLine(blockId: string, sectionId: string, line: string, lineNr: number): PromptAndBlockMsgs {
  return {
    type: "block.code.line",
    blockId,
    blockNr: 1,
    streamId: "stream",
    seq: 2,
    timestamp: ts,
    sectionId,
    lang: "jsx",
    path: "App.jsx",
    line,
    lineNr,
  } as PromptAndBlockMsgs;
}

function codeEnd(blockId: string, sectionId: string): PromptAndBlockMsgs {
  return {
    type: "block.code.end",
    blockId,
    blockNr: 1,
    streamId: "stream",
    seq: 3,
    timestamp: ts,
    sectionId,
    lang: "jsx",
    path: "App.jsx",
    stats: { lines: 0, bytes: 0 },
  } as PromptAndBlockMsgs;
}

function blockEnd(blockId: string, fsId: string): PromptAndBlockMsgs {
  return {
    type: "block.end",
    blockId,
    blockNr: 2,
    streamId: "stream",
    seq: 4,
    timestamp: ts,
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
    fsRef: { appSlug: "a", userSlug: "u", mode: "dev", fsId },
  } as PromptAndBlockMsgs;
}

function blockOf(blockId: string, fsId: string, lines: string[]): PromptBlock {
  const sectionId = `${blockId}-sec`;
  const msgs: PromptAndBlockMsgs[] = [
    blockBegin(blockId),
    codeBegin(blockId, sectionId),
    ...lines.map((l, i) => codeLine(blockId, sectionId, l, i + 1)),
    codeEnd(blockId, sectionId),
    blockEnd(blockId, fsId),
  ];
  return { msgs };
}

function makeState(blocks: PromptBlock[], hydrated?: { fsId: string; code: string[] }): PromptState {
  const sp = new URLSearchParams();
  return {
    chat: { messages: [] } as unknown as PromptState["chat"],
    running: false,
    blocks,
    hasCode: blocks.length > 0,
    title: "",
    searchParams: sp,
    setSearchParams: (() => undefined) as PromptState["setSearchParams"],
    hydratedSource: hydrated,
  };
}

describe("CodeEditor getCode — aider replace across fsIds", () => {
  it("seeds a replace from the prior turn's create block when they have different fsIds", () => {
    // Turn 1: a `create` block under fsId-A produces the original App.jsx.
    // Turn 2: a `replace` block under fsId-B edits ADD → LIST.
    //
    // The user is currently viewing fsId-B (the URL just transitioned). Turn
    // 2's resolved source must include turn 1's create as the seed; otherwise
    // the SEARCH for "ADD" runs against an empty buffer and the preview is
    // empty (the bug seen in dev: "does not provide an export named default").
    const create = blockOf("blk-1", "fsid-A", [
      "export default function App() {",
      "  return (",
      "    <div>",
      "      <button>ADD</button>",
      "    </div>",
      "  );",
      "}",
    ]);
    const replace = blockOf("blk-2", "fsid-B", [
      "<<<<<<< SEARCH",
      "      <button>ADD</button>",
      "=======",
      "      <button>LIST</button>",
      ">>>>>>> REPLACE",
    ]);
    const state = makeState([create, replace]);

    const result = getCode(state, "fsid-B");
    const source = result.code.join("\n");
    expect(source).toContain("export default function App()");
    expect(source).toContain("<button>LIST</button>");
    expect(source).not.toContain("<button>ADD</button>");
    expect(source).not.toContain("<<<<<<< SEARCH");
  });

  it("returns the saved snapshot for an older fsId in chat history", () => {
    // Turn 1 under fsid-A, turn 2 under fsid-B. User navigates to fsid-A —
    // we want the historical snapshot (after turn 1 only), not turn 2's edits
    // applied on top.
    const create = blockOf("blk-1", "fsid-A", ["export default function App() { return null; }"]);
    const replace = blockOf("blk-2", "fsid-B", [
      "<<<<<<< SEARCH",
      "return null;",
      "=======",
      "return <div />;",
      ">>>>>>> REPLACE",
    ]);
    const state = makeState([create, replace]);

    const a = getCode(state, "fsid-A");
    expect(a.code.join("\n")).toContain("return null;");
    expect(a.code.join("\n")).not.toContain("<div />");
  });

  it("create-only single-block history still resolves correctly (back-compat)", () => {
    const create = blockOf("blk-1", "fsid-A", ["export default function App() { return <h1>hi</h1>; }"]);
    const state = makeState([create]);
    const result = getCode(state, "fsid-A");
    expect(result.code.join("\n")).toContain("<h1>hi</h1>");
  });
});
