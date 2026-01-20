import { CodeBlockEvent, OpenRouterParser } from "@vibes.diy/call-ai-base";
import { describe, it, expect } from "vitest";
import { createCodeBlockHandler } from "@vibes.diy/call-ai-base";

function createParserStack() {
  const orParser = new OpenRouterParser();
  orParser.register(createCodeBlockHandler());
  return orParser;
}

function simulateDelta(orParser: OpenRouterParser, content: string) {
  const chunk = {
    choices: [{ delta: { content } }],
  };
  const sseData = `data: ${JSON.stringify(chunk)}

`;
  orParser.processChunk(sseData);
}

describe("CodeBlockHandler End of Stream", () => {
  it("closes block when message ends exactly at closing fence (no newline)", () => {
    const orParser = createParserStack();
    const events: CodeBlockEvent[] = [];
    orParser.onEvent((evt) => {
      if (["code.start", "code.end", "code.fragment"].includes(evt.type)) {
        events.push(evt as CodeBlockEvent);
      }
    });

    simulateDelta(orParser, "```js\nconst x = 1;\n```");
    // Signal end of stream
    orParser.processChunk("data: [DONE]\n\n");

    const types = events.map((e) => e.type);
    expect(types).toContain("code.start");
    expect(types).toContain("code.end");

    // Verify no extra backticks leaked into code
    const codeFragments = events.filter((e) => e.type === "code.fragment");
    const code = codeFragments.map((f) => (f as any).fragment).join("");
    expect(code).toBe("const x = 1;\n");
  });
});
