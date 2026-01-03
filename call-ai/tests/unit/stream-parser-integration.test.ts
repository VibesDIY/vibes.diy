import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseAIStream } from "../../pkg/stream-parser.js";
import { StreamTypes, StreamMessage, createMessage } from "../../pkg/stream-messages.js";
import * as streaming from "../../pkg/streaming.js";

// Mock callAIStreamingSemantic (the internal function used by parseAIStream)
vi.mock("../../pkg/streaming.js", () => ({
  callAIStreamingSemantic: vi.fn(),
}));

/**
 * Helper to create a mock generator that yields StreamMessage events.
 * This simulates what callAIStreamingSemantic yields.
 */
function createMockSemanticGenerator(
  textFragments: string[],
  model = "test-model",
): () => AsyncGenerator<StreamMessage, void, unknown> {
  return async function* () {
    let seq = 0;
    for (const frag of textFragments) {
      yield createMessage(StreamTypes.TEXT_FRAGMENT, model, "client", {
        streamId: 1,
        seq: String(seq++),
        frag,
      });
    }
  };
}

describe("parseAIStream Integration", () => {
  const mockOptions = {
    apiKey: "test-key",
    model: "test-model",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates text fragments eagerly from callAIStreamingSemantic", async () => {
    // Mock the generator to yield StreamMessage events
    const mockGenerator = createMockSemanticGenerator(["Hel", "lo ", "Wor", "ld"]);

    vi.mocked(streaming.callAIStreamingSemantic).mockImplementation(mockGenerator);

    const messages: StreamMessage[] = [];
    for await (const msg of parseAIStream("test prompt", mockOptions)) {
      messages.push(msg);
    }

    // Filter for text fragments
    const textFrags = messages.filter((m) => m.type === StreamTypes.TEXT_FRAGMENT);

    // Should have 4 fragments corresponding to the 4 yields
    expect(textFrags).toHaveLength(4);
    expect(textFrags[0].payload.frag).toBe("Hel");
    expect(textFrags[1].payload.frag).toBe("lo ");
    expect(textFrags[2].payload.frag).toBe("Wor");
    expect(textFrags[3].payload.frag).toBe("ld");

    // Verify callAIStreamingSemantic was called with the options
    expect(streaming.callAIStreamingSemantic).toHaveBeenCalledWith("test prompt", mockOptions);
  });

  it("handles code blocks splitting across chunks", async () => {
    // Simulate semantic events for: Text -> Start Fence -> Code -> End Fence -> Text
    // The CodeBlockDetector in streaming.ts processes the raw chunks and produces these events
    const mockGenerator = async function* (): AsyncGenerator<StreamMessage, void, unknown> {
      let seq = 0;
      const model = "test-model";
      const streamId = 1;
      const blockId = "block_1";

      // Text before code
      yield createMessage(StreamTypes.TEXT_FRAGMENT, model, "client", {
        streamId,
        seq: String(seq++),
        frag: "Here is some code:\n",
      });

      // Code start
      yield createMessage(StreamTypes.CODE_START, model, "client", {
        streamId,
        blockId,
        language: "ts",
        seq: String(seq++),
      });

      // Code fragments
      yield createMessage(StreamTypes.CODE_FRAGMENT, model, "client", {
        streamId,
        blockId,
        seq: String(seq++),
        frag: "const x = 1;\n",
      });

      // Code end
      yield createMessage(StreamTypes.CODE_END, model, "client", {
        streamId,
        blockId,
        language: "ts",
      });

      // Text after code
      yield createMessage(StreamTypes.TEXT_FRAGMENT, model, "client", {
        streamId,
        seq: String(seq++),
        frag: "Done.",
      });
    };

    vi.mocked(streaming.callAIStreamingSemantic).mockImplementation(mockGenerator);

    const messages: StreamMessage[] = [];
    for await (const msg of parseAIStream("test prompt", mockOptions)) {
      messages.push(msg);
    }

    // Verify sequence of event types
    const types = messages.map((m) => m.type);

    // Should start with STREAM_START
    expect(types[0]).toBe(StreamTypes.STREAM_START);

    // Text fragments before code
    const textBefore = messages.filter((m) => m.type === StreamTypes.TEXT_FRAGMENT && m.payload.frag.includes("Here is"));
    expect(textBefore.length).toBeGreaterThan(0);

    // Code start
    const codeStart = messages.find((m) => m.type === StreamTypes.CODE_START);
    expect(codeStart).toBeDefined();
    expect(codeStart?.payload.language).toBe("ts");

    // Code fragments
    const codeFrags = messages.filter((m) => m.type === StreamTypes.CODE_FRAGMENT);
    expect(codeFrags.length).toBeGreaterThan(0);
    const codeContent = codeFrags.map((m) => m.payload.frag).join("");
    expect(codeContent).toBe("const x = 1;\n");

    // Code end
    const codeEnd = messages.find((m) => m.type === StreamTypes.CODE_END);
    expect(codeEnd).toBeDefined();

    // Text after
    const textAfter = messages.filter((m) => m.type === StreamTypes.TEXT_FRAGMENT && m.payload.frag === "Done.");
    expect(textAfter).toHaveLength(1);

    // Stream end
    expect(types[types.length - 1]).toBe(StreamTypes.STREAM_END);
  });

  it("handles errors from callAIStreamingSemantic", async () => {
    // Mock generator that yields a StreamMessage then throws
    const mockGenerator = async function* (): AsyncGenerator<StreamMessage, void, unknown> {
      yield createMessage(StreamTypes.TEXT_FRAGMENT, "test-model", "client", {
        streamId: 1,
        seq: "0",
        frag: "Start",
      });
      throw new Error("Network failure");
    };

    vi.mocked(streaming.callAIStreamingSemantic).mockImplementation(mockGenerator);

    const messages: StreamMessage[] = [];

    try {
      for await (const msg of parseAIStream("test prompt", mockOptions)) {
        messages.push(msg);
      }
    } catch (e) {
      // Expected error re-throw
    }

    // Should have emitted STREAM_ERROR before throwing
    const errorMsg = messages.find((m) => m.type === StreamTypes.STREAM_ERROR);
    expect(errorMsg).toBeDefined();
    expect(errorMsg?.payload.message).toBe("Network failure");
    expect(errorMsg?.payload.recoverable).toBe(false);
  });

  it("collectStreamMessages throws on error but captures partial messages if caught", async () => {
    // This test documents current behavior: collectStreamMessages throws, so you lose the return value
    // unless you implement your own collection logic or we modify collectStreamMessages.
    const mockGenerator = async function* (): AsyncGenerator<StreamMessage, void, unknown> {
      yield createMessage(StreamTypes.TEXT_FRAGMENT, "test-model", "client", {
        streamId: 1,
        seq: "0",
        frag: "Start",
      });
      throw new Error("Network failure");
    };

    vi.mocked(streaming.callAIStreamingSemantic).mockImplementation(mockGenerator);

    // We can't easily get the partial messages from collectStreamMessages if it throws
    // because the promise rejects.
    // This test confirms that it DOES throw.
    const { collectStreamMessages } = await import("../../pkg/stream-parser.js");

    await expect(collectStreamMessages("test", mockOptions)).rejects.toThrow("Network failure");
  });
});
