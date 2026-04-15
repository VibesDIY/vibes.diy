import { describe, expect, it } from "vitest";
import { reconstructConversationMessages } from "@vibes.diy/api-svc";
import type { PromptAndBlockMsgs } from "@vibes.diy/api-types";

const base = {
  blockId: "b1",
  streamId: "s1",
  blockNr: 0,
  timestamp: new Date(),
};

function makePromptReq(text: string, seq: number): PromptAndBlockMsgs {
  return {
    type: "prompt.req",
    chatId: "test-chat",
    seq,
    streamId: "s1",
    timestamp: new Date(),
    request: {
      messages: [{ role: "user", content: [{ type: "text", text }] }],
    },
  } as unknown as PromptAndBlockMsgs;
}

function makeToplevelLine(line: string, seq: number): PromptAndBlockMsgs {
  return {
    type: "block.toplevel.line",
    sectionId: "sec1",
    ...base,
    seq,
    lineNr: 0,
    line,
  } as unknown as PromptAndBlockMsgs;
}

function makeCodeBegin(lang: string, seq: number): PromptAndBlockMsgs {
  return {
    type: "block.code.begin",
    sectionId: "sec1",
    ...base,
    seq,
    lang,
  } as unknown as PromptAndBlockMsgs;
}

function makeCodeLine(line: string, lang: string, seq: number): PromptAndBlockMsgs {
  return {
    type: "block.code.line",
    sectionId: "sec1",
    ...base,
    seq,
    lang,
    lineNr: 0,
    line,
  } as unknown as PromptAndBlockMsgs;
}

function makeCodeEnd(lang: string, seq: number): PromptAndBlockMsgs {
  return {
    type: "block.code.end",
    sectionId: "sec1",
    ...base,
    seq,
    lang,
    stats: { lines: 0, bytes: 0 },
  } as unknown as PromptAndBlockMsgs;
}

describe("reconstructConversationMessages", () => {
  it("returns user messages only when no assistant blocks exist", () => {
    const msgs = [makePromptReq("hello", 0)];
    const result = reconstructConversationMessages(msgs);
    expect(result).toEqual([{ role: "user", content: [{ type: "text", text: "hello" }] }]);
  });

  it("reconstructs assistant text from toplevel lines", () => {
    const msgs = [makePromptReq("hello", 0), makeToplevelLine("Hi there!", 1), makeToplevelLine("How can I help?", 2)];
    const result = reconstructConversationMessages(msgs);
    expect(result).toEqual([
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "Hi there!\nHow can I help?" }] },
    ]);
  });

  it("reconstructs assistant code blocks", () => {
    const msgs = [
      makePromptReq("make an app", 0),
      makeToplevelLine("Here is the code:", 1),
      makeCodeBegin("jsx", 2),
      makeCodeLine("function App() {", "jsx", 3),
      makeCodeLine("  return <div>Hello</div>;", "jsx", 4),
      makeCodeLine("}", "jsx", 5),
      makeCodeEnd("jsx", 6),
    ];
    const result = reconstructConversationMessages(msgs);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: [{ type: "text", text: "make an app" }] });
    expect(result[1].role).toBe("assistant");
    expect(result[1].content[0].text).toBe("Here is the code:\n```jsx\nfunction App() {\n  return <div>Hello</div>;\n}\n```");
  });

  it("preserves multi-turn conversation order", () => {
    const msgs = [
      // Turn 1
      makePromptReq("build a todo app", 0),
      makeToplevelLine("Sure, here it is:", 1),
      makeCodeBegin("jsx", 2),
      makeCodeLine("function App() { return <div>Todo</div>; }", "jsx", 3),
      makeCodeEnd("jsx", 4),
      // Turn 2
      makePromptReq("add a button", 5),
      makeToplevelLine("Done:", 6),
      makeCodeBegin("jsx", 7),
      makeCodeLine("function App() { return <div>Todo<button>Add</button></div>; }", "jsx", 8),
      makeCodeEnd("jsx", 9),
    ];
    const result = reconstructConversationMessages(msgs);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: "user", content: [{ type: "text", text: "build a todo app" }] });
    expect(result[1].role).toBe("assistant");
    expect(result[1].content[0].text).toContain("```jsx");
    expect(result[2]).toEqual({ role: "user", content: [{ type: "text", text: "add a button" }] });
    expect(result[3].role).toBe("assistant");
    expect(result[3].content[0].text).toContain("button");
  });

  it("handles empty input", () => {
    expect(reconstructConversationMessages([])).toEqual([]);
  });
});
