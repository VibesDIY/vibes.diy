import { describe, it, expect } from "vitest";
import { shouldAgentAutosave } from "~/vibes.diy/app/components/ResultPreview/agent-autosave.js";

const ts = new Date("2026-04-25T00:00:00Z");

function promptReq() {
  return {
    type: "prompt.req",
    streamId: "s",
    chatId: "c",
    seq: 0,
    timestamp: ts,
    request: { messages: [], model: "x" },
  };
}

function codeLine(line: string) {
  return {
    type: "block.code.line",
    blockId: "blk",
    blockNr: 1,
    streamId: "s",
    seq: 1,
    timestamp: ts,
    sectionId: "sec",
    lang: "jsx",
    path: "App.jsx",
    line,
    lineNr: 1,
  };
}

describe("shouldAgentAutosave", () => {
  it("triggers when an LLM turn contains a SEARCH marker", () => {
    const msgs = [
      promptReq(),
      codeLine("<<<<<<< SEARCH"),
      codeLine("old"),
      codeLine("======="),
      codeLine("new"),
      codeLine(">>>>>>> REPLACE"),
    ];
    expect(shouldAgentAutosave(msgs as never)).toBe(true);
  });

  it("does not trigger for a create-only LLM turn", () => {
    const msgs = [promptReq(), codeLine("export default function App() {}"), codeLine("// no markers here")];
    expect(shouldAgentAutosave(msgs as never)).toBe(false);
  });

  it("does not trigger for a manual save block (no prompt.req)", () => {
    const msgs = [
      codeLine("<<<<<<< SEARCH"),
      codeLine("x"),
      codeLine("======="),
      codeLine("y"),
      codeLine(">>>>>>> REPLACE"),
    ];
    expect(shouldAgentAutosave(msgs as never)).toBe(false);
  });

  it("ignores SEARCH-like prose in non-code messages", () => {
    const msgs = [
      promptReq(),
      // a SEARCH marker that's part of toplevel prose, not a code line, should not count
      // here we represent a code.line with non-marker text
      codeLine("the search box <<<<<<< SEARCH for the next button"),
    ];
    // The line begins with "the search box", not "<<<<<<< SEARCH", so no trigger
    expect(shouldAgentAutosave(msgs as never)).toBe(false);
  });

  it("tolerates trailing whitespace on the marker line", () => {
    const msgs = [promptReq(), codeLine("<<<<<<< SEARCH   ")];
    expect(shouldAgentAutosave(msgs as never)).toBe(true);
  });
});
