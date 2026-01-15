import { describe, it, expect } from "vitest";
import { createVibesParser } from "../../pkg/parser/index.js";

describe("createVibesParser", () => {
  it("should handle stream ending without finalize - open code block", () => {
    const parser = createVibesParser();

    // Simulate SSE stream with code block that doesn't have closing fence
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Here is code:\\n"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"```js\\n"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"const x = 1;\\n"}}]}\n\n',
      // Stream ends without closing ``` - simulates incomplete response
    ];

    for (const chunk of sseChunks) {
      parser.processChunk(chunk);
    }

    expect(parser.segments.length).toBeGreaterThan(0);

    // Now finalize by sending DONE
    parser.processChunk("data: [DONE]\n\n");

    expect(parser.segments).toHaveLength(2);
    expect(parser.segments[0].type).toBe("markdown");
    expect(parser.segments[0].content).toBe("Here is code:\n");
    expect(parser.segments[1].type).toBe("code");
    expect(parser.segments[1].content).toBe("const x = 1;\n");
  });

  it("should handle stream ending with complete code block", () => {
    const parser = createVibesParser();

    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"```js\\nconst x = 1;\\n```\\n"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    for (const chunk of sseChunks) {
      parser.processChunk(chunk);
    }

    // Complete code block produces just the code segment
    expect(parser.segments.length).toBeGreaterThanOrEqual(1);
    expect(parser.segments[0].type).toBe("code");
    expect(parser.segments[0].content).toBe("const x = 1;\n");
  });

  it("should flush pending content on finalize", () => {
    const parser = createVibesParser();

    // Partial content without newline at end
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hello world"}}]}\n\n',
    ];

    for (const chunk of sseChunks) {
      parser.processChunk(chunk);
    }

    // Before finalize - content might be buffered
    const beforeFinalize = parser.segments.map((s) => s.content).join("");

    parser.processChunk("data: [DONE]\n\n");

    // After finalize - all content should be flushed
    const afterFinalize = parser.segments.map((s) => s.content).join("");

    expect(afterFinalize).toBe("Hello world");
    expect(afterFinalize.length).toBeGreaterThanOrEqual(beforeFinalize.length);
  });
});
