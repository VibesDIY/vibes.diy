import { describe, expect, it } from "vitest";
import type { PromptAndBlockMsgs, ResChatResponseTurn } from "@vibes.diy/api-types";
import { buildSectionStream, extractUserPrompts, reconstructVerbatim, renderJsonl, turnBlocks } from "./chat-response-render.js";
import { resolveSectionStream } from "./resolve-section-stream.js";

const base = (seq: number) => ({
  blockId: "blk",
  streamId: "stream-1",
  seq,
  blockNr: 0,
  timestamp: new Date(0),
});

function toplevelLine(seq: number, line: string): PromptAndBlockMsgs {
  return { type: "block.toplevel.line", sectionId: "s", lineNr: seq, line, ...base(seq) } as unknown as PromptAndBlockMsgs;
}
function codeBegin(seq: number, lang: string, path: string): PromptAndBlockMsgs {
  return { type: "block.code.begin", sectionId: "s", lang, path, ...base(seq) } as unknown as PromptAndBlockMsgs;
}
function codeLine(seq: number, lang: string, path: string, line: string): PromptAndBlockMsgs {
  return { type: "block.code.line", sectionId: "s", lang, path, lineNr: seq, line, ...base(seq) } as unknown as PromptAndBlockMsgs;
}
function codeEnd(seq: number, lang: string, path: string): PromptAndBlockMsgs {
  return {
    type: "block.code.end",
    sectionId: "s",
    lang,
    path,
    stats: { lines: 1, bytes: 1 },
    ...base(seq),
  } as unknown as PromptAndBlockMsgs;
}

describe("reconstructVerbatim", () => {
  it("renders prose, a fenced code block with its bound path, and close fence", () => {
    const blocks = [
      toplevelLine(0, "Here is the app:"),
      codeBegin(1, "jsx", "App.jsx"),
      codeLine(2, "jsx", "App.jsx", "export default function App() {}"),
      codeEnd(3, "jsx", "App.jsx"),
    ];
    expect(reconstructVerbatim(blocks)).toBe(
      ["Here is the app:", "```jsx App.jsx", "export default function App() {}", "```"].join("\n")
    );
  });

  it("surfaces a path clobber: an orphaned label as prose, then a fence bound to the wrong path", () => {
    // The blank-separator bug: the `access.js` label was flushed as prose
    // (toplevel line) and the following fence defaulted to App.jsx.
    const blocks = [
      codeBegin(0, "jsx", "App.jsx"),
      codeLine(1, "jsx", "App.jsx", "const a = 1;"),
      codeEnd(2, "jsx", "App.jsx"),
      toplevelLine(3, "access.js"),
      toplevelLine(4, ""),
      codeBegin(5, "js", "App.jsx"),
      codeLine(6, "js", "App.jsx", "export const x = 1;"),
      codeEnd(7, "js", "App.jsx"),
    ];
    const out = reconstructVerbatim(blocks);
    expect(out).toContain("access.js");
    // Two fences both bound to App.jsx — the clobber is visible.
    expect(out.match(/```js App\.jsx/g)).toHaveLength(1);
    expect(out.match(/```jsx App\.jsx/g)).toHaveLength(1);
  });

  it("omits the path from the info-string when a fence carries none", () => {
    const blocks = [{ type: "block.code.begin", sectionId: "s", lang: "txt", ...base(0) } as unknown as PromptAndBlockMsgs];
    expect(reconstructVerbatim(blocks)).toBe("```txt");
  });
});

describe("renderJsonl", () => {
  it("emits one JSON object per line", () => {
    const blocks = [toplevelLine(0, "a"), codeBegin(1, "js", "x.js")];
    const lines = renderJsonl(blocks).split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).type).toBe("block.toplevel.line");
    expect(JSON.parse(lines[1]).type).toBe("block.code.begin");
  });
});

describe("extractUserPrompts", () => {
  it("pulls user message text from prompt.req blocks", () => {
    const promptReq = {
      type: "prompt.req",
      streamId: "stream-1",
      chatId: "c",
      seq: 0,
      timestamp: new Date(0),
      request: {
        messages: [
          { role: "system", content: [{ type: "text", text: "ignore me" }] },
          { role: "user", content: [{ type: "text", text: "build a todo app" }] },
        ],
      },
    } as unknown as PromptAndBlockMsgs;
    expect(extractUserPrompts([promptReq])).toEqual(["build a todo app"]);
  });
});

describe("buildSectionStream + resolveSectionStream", () => {
  it("resolves files from a stored turn via the shared generate/edit resolver", async () => {
    const blocks: PromptAndBlockMsgs[] = [
      { type: "block.begin", ...base(0) } as unknown as PromptAndBlockMsgs,
      codeBegin(0, "jsx", "App.jsx"),
      codeLine(1, "jsx", "App.jsx", "export default function App() { return null; }"),
      codeEnd(2, "jsx", "App.jsx"),
      {
        type: "block.end",
        stats: {
          toplevel: { lines: 0, bytes: 0 },
          code: { lines: 1, bytes: 1 },
          image: { lines: 0, bytes: 0 },
          total: { lines: 1, bytes: 1 },
        },
        usage: { given: [], calculated: {} },
        ...base(3),
      } as unknown as PromptAndBlockMsgs,
    ];
    const turn: ResChatResponseTurn = {
      chatId: "c",
      promptId: "stream-1",
      created: "2026-01-01T00:00:00Z",
      sections: [{ blockSeq: 0, blocks }],
    };
    expect(turnBlocks(turn)).toHaveLength(blocks.length);
    const rResolved = await resolveSectionStream({
      sectionStream: buildSectionStream(turn),
      streamId: "stream-1",
    });
    expect(rResolved.isOk()).toBe(true);
    const files = rResolved.Ok().files;
    expect(files["App.jsx"]).toContain("export default function App()");
  });
});
