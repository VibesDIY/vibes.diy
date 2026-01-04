import { describe, it, expect } from "vitest";
import { detectCodeBlocks } from "../../pkg/code-block-detector.js";
import { StreamTypes, StreamMessage } from "../../pkg/stream-messages.js";
import { accumulateCodeBlocks, accumulateText } from "../../pkg/stream-accumulators.js";
import { sseCodeBlock, sseMultipleBlocks, sseIncompleteBlock, parseSSEToChunks, rebuffer } from "../fixtures/sse-code-block.js";

// Helper to convert string array to AsyncIterable
async function* toAsyncIterable(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

// Helper to collect all messages from detector
async function collectMessages(chunks: string[], streamId = 1): Promise<StreamMessage[]> {
  const messages: StreamMessage[] = [];
  for await (const msg of detectCodeBlocks(toAsyncIterable(chunks), streamId, "test-model")) {
    messages.push(msg);
  }
  return messages;
}

describe("SSE Fixture: Simple Code Block", () => {
  it("parses code block from SSE fixture", async () => {
    const chunks = parseSSEToChunks(sseCodeBlock);
    const messages = await collectMessages(chunks);

    // Should have TEXT_FRAGMENT, CODE_START, CODE_FRAGMENT(s), CODE_END
    const types = messages.map((m) => m.type);
    expect(types).toContain(StreamTypes.TEXT_FRAGMENT);
    expect(types).toContain(StreamTypes.CODE_START);
    expect(types).toContain(StreamTypes.CODE_FRAGMENT);
    expect(types).toContain(StreamTypes.CODE_END);

    // Check CODE_START has correct language
    const codeStart = messages.find((m) => m.type === StreamTypes.CODE_START);
    expect(codeStart?.payload).toMatchObject({
      language: "js",
    });

    // Accumulate and verify content
    const blocks = accumulateCodeBlocks(messages);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("js");
    expect(blocks[0].content).toBe("const x = 1;\n");
    expect(blocks[0].complete).toBe(true);

    // Verify text fragment
    const textFrags = messages.filter((m) => m.type === StreamTypes.TEXT_FRAGMENT);
    const text = textFrags.map((m) => (m.payload as { frag: string }).frag).join("");
    expect(text).toContain("Here's some code:");
  });

  it("handles char-by-char rebuffering", async () => {
    const chunks = parseSSEToChunks(sseCodeBlock);
    const charByChar = rebuffer(chunks, "single");

    // Each char is a separate chunk - tests buffering logic
    const messages = await collectMessages(charByChar);
    const blocks = accumulateCodeBlocks(messages);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("js");
    expect(blocks[0].content).toBe("const x = 1;\n");
  });

  it("handles single-batch rebuffering", async () => {
    const chunks = parseSSEToChunks(sseCodeBlock);
    const batch = rebuffer(chunks, "all");

    // All content in one chunk
    const messages = await collectMessages(batch);
    const blocks = accumulateCodeBlocks(messages);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe("const x = 1;\n");
  });
});

describe("SSE Fixture: Multiple Code Blocks", () => {
  it("parses multiple code blocks", async () => {
    const chunks = parseSSEToChunks(sseMultipleBlocks);
    const messages = await collectMessages(chunks);

    const blocks = accumulateCodeBlocks(messages);
    expect(blocks).toHaveLength(2);

    expect(blocks[0]).toMatchObject({
      language: "js",
      content: "a();\n",
      complete: true,
    });

    expect(blocks[1]).toMatchObject({
      language: "py",
      content: "b()\n",
      complete: true,
    });
  });

  it("preserves text between blocks", async () => {
    const chunks = parseSSEToChunks(sseMultipleBlocks);
    const messages = await collectMessages(chunks);

    const text = accumulateText(messages);
    expect(text).toContain("First:");
    expect(text).toContain("Second:");
  });
});

describe("SSE Fixture: Incomplete Block", () => {
  it("auto-closes block when stream ends without closing fence", async () => {
    const chunks = parseSSEToChunks(sseIncompleteBlock);
    const messages = await collectMessages(chunks);

    // detectCodeBlocks emits CODE_END at finalize for incomplete blocks
    // This is correct behavior - it auto-closes for cleanup
    const codeEnds = messages.filter((m) => m.type === StreamTypes.CODE_END);
    expect(codeEnds).toHaveLength(1);

    // Block is marked complete because CODE_END was emitted
    const blocks = accumulateCodeBlocks(messages);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      language: "ts",
      content: "const partial =",
      complete: true, // Auto-closed by detector finalization
    });
  });

  it("shows in-progress block BEFORE stream ends", async () => {
    // To test in-progress state, we need to check during streaming
    // not after the generator completes
    const chunks = parseSSEToChunks(sseIncompleteBlock);
    const messages: StreamMessage[] = [];

    // Manually iterate and check state partway through
    const gen = detectCodeBlocks(toAsyncIterable(chunks), 1, "test");
    for await (const msg of gen) {
      messages.push(msg);

      // Check state after CODE_START but before stream ends
      if (msg.type === StreamTypes.CODE_START) {
        const blocks = accumulateCodeBlocks(messages);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].complete).toBe(false); // In-progress at this point
      }
    }
  });
});

describe("rebuffer utility", () => {
  it("single mode returns chars", () => {
    const chunks = ["abc", "de"];
    const result = rebuffer(chunks, "single");
    expect(result).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("all mode returns single string", () => {
    const chunks = ["abc", "de"];
    const result = rebuffer(chunks, "all");
    expect(result).toEqual(["abcde"]);
  });

  it("custom sizes work", () => {
    const chunks = ["abcdef"];
    const result = rebuffer(chunks, [2, 3]);
    expect(result).toEqual(["ab", "cde", "f"]);
  });
});
