import {
  CodeBlockParser,
  CodeBlockEvent,
  OpenRouterParser,
  JsonParser,
  SSEDataParser,
  LineStreamParser,
  LineStreamState,
} from "call-ai";
import { describe, it, expect } from "vitest";

function createCodeBlockParser() {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  const sseParser = new SSEDataParser(lineParser);
  const jsonParser = new JsonParser(sseParser);
  const orParser = new OpenRouterParser(jsonParser);
  const codeParser = new CodeBlockParser(orParser);
  return { codeParser, orParser };
}

function simulateDelta(orParser: OpenRouterParser, content: string) {
  const chunk = {
    choices: [{ delta: { content } }],
  };
  const sseData = `data: ${JSON.stringify(chunk)}

`;
  orParser.processChunk(sseData);
}

describe("CodeBlockParser End of Stream", () => {
  it("closes block when message ends exactly at closing fence (no newline)", () => {
    const { codeParser, orParser } = createCodeBlockParser();
    const events: CodeBlockEvent[] = [];
    codeParser.onEvent((evt) => events.push(evt));

    simulateDelta(orParser, "```js\nconst x = 1;\n```"); 
    // Signal end of stream
    orParser.processChunk("data: [DONE]\n\n");

    const types = events.map(e => e.type);
    expect(types).toContain("codeStart");
    expect(types).toContain("codeEnd");
    
    // Verify no extra backticks leaked into code
    const codeFragments = events.filter(e => e.type === "codeFragment");
    const code = codeFragments.map(f => (f as any).fragment).join("");
    expect(code).toBe("const x = 1;\n");
  });
});
