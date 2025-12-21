import { describe, it, expect, vi } from "vitest";
import {
  createIdExtractorStream,
  createUsageExtractorStream,
  StreamingUsageData,
} from "../../../base/utils/streaming-id-extractor.js";

// Helper to process chunks through the stream using pipeTo
async function processStream(
  stream: TransformStream<Uint8Array, Uint8Array>,
  input: Uint8Array[],
): Promise<Uint8Array[]> {
  const output: Uint8Array[] = [];

  // Create a source stream from input chunks
  const sourceStream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of input) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  // Create a sink to collect output
  const sinkStream = new WritableStream<Uint8Array>({
    write(chunk) {
      output.push(chunk);
    },
  });

  // Pipe through the transform stream
  await sourceStream.pipeThrough(stream).pipeTo(sinkStream);

  return output;
}

describe("Streaming ID Extractor", () => {
  it("should pass through all chunks unchanged", async () => {
    const onIdFound = vi.fn();
    const stream = createIdExtractorStream(onIdFound);

    const input = new TextEncoder().encode(
      'data: {"id":"gen-123","choices":[]}\n\n',
    );
    const output = await processStream(stream, [input]);

    // Verify chunks passed through unchanged
    const combined = new Uint8Array(
      output.reduce((acc, chunk) => acc + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of output) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    expect(combined).toEqual(input);
  });

  it("should extract generation id from first chunk", async () => {
    let extractedId: string | null = null;
    const onIdFound = (id: string) => {
      extractedId = id;
    };

    const stream = createIdExtractorStream(onIdFound);
    const input = new TextEncoder().encode(
      'data: {"id":"gen-abc123","choices":[]}\n\n',
    );
    await processStream(stream, [input]);

    expect(extractedId).toBe("gen-abc123");
  });

  it("should only extract id once from multiple chunks", async () => {
    let callCount = 0;
    let extractedId: string | null = null;
    const onIdFound = (id: string) => {
      callCount++;
      extractedId = id;
    };

    const stream = createIdExtractorStream(onIdFound);
    await processStream(stream, [
      new TextEncoder().encode('data: {"id":"gen-first"}\n\n'),
      new TextEncoder().encode('data: {"id":"gen-second"}\n\n'),
      new TextEncoder().encode('data: {"id":"gen-third"}\n\n'),
    ]);

    expect(callCount).toBe(1);
    expect(extractedId).toBe("gen-first");
  });

  it("should handle chunks without id gracefully", async () => {
    let extractedId: string | null = null;
    const onIdFound = (id: string) => {
      extractedId = id;
    };

    const stream = createIdExtractorStream(onIdFound);
    await processStream(stream, [
      new TextEncoder().encode(
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      ),
      new TextEncoder().encode('data: {"id":"gen-delayed","choices":[]}\n\n'),
    ]);

    expect(extractedId).toBe("gen-delayed");
  });

  it("should handle OpenRouter generation id format", async () => {
    let extractedId: string | null = null;
    const onIdFound = (id: string) => {
      extractedId = id;
    };

    const stream = createIdExtractorStream(onIdFound);
    await processStream(stream, [
      new TextEncoder().encode(
        'data: {"id":"gen-1765587248-xXxy5bnRAic6RTKsV59S","object":"chat.completion.chunk","created":1702403200,"model":"anthropic/claude-4.5-opus-20251124","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}\n\n',
      ),
    ]);

    expect(extractedId).toBe("gen-1765587248-xXxy5bnRAic6RTKsV59S");
  });

  it("should handle split chunks where id spans multiple chunks", async () => {
    let extractedId: string | null = null;
    const onIdFound = (id: string) => {
      extractedId = id;
    };

    const stream = createIdExtractorStream(onIdFound);
    await processStream(stream, [
      new TextEncoder().encode('data: {"id":"gen-'),
      new TextEncoder().encode('split123","choices":[]}\n\n'),
    ]);

    expect(extractedId).toBe("gen-split123");
  });

  it("should not call callback if no id found in any chunk", async () => {
    const onIdFound = vi.fn();

    const stream = createIdExtractorStream(onIdFound);
    await processStream(stream, [
      new TextEncoder().encode(
        'data: {"choices":[{"delta":{"content":"test"}}]}\n\n',
      ),
      new TextEncoder().encode("data: [DONE]\n\n"),
    ]);

    expect(onIdFound).not.toHaveBeenCalled();
  });

  it("should handle empty chunks", async () => {
    let extractedId: string | null = null;
    const onIdFound = (id: string) => {
      extractedId = id;
    };

    const stream = createIdExtractorStream(onIdFound);
    await processStream(stream, [
      new Uint8Array(0),
      new TextEncoder().encode('data: {"id":"gen-after-empty"}\n\n'),
    ]);

    expect(extractedId).toBe("gen-after-empty");
  });
});

describe("Usage Extractor Stream", () => {
  it("should extract complete usage data from final chunk", async () => {
    let extractedData: StreamingUsageData | null = null;
    const onUsageExtracted = (data: StreamingUsageData) => {
      extractedData = data;
    };

    const stream = createUsageExtractorStream(onUsageExtracted);

    // Simulate a real OpenRouter streaming response with usage in final chunk
    await processStream(stream, [
      new TextEncoder().encode(
        'data: {"id":"gen-test-123","model":"openai/gpt-4o-mini","choices":[{"delta":{"content":"Hello"}}]}\n\n',
      ),
      new TextEncoder().encode(
        'data: {"id":"gen-test-123","model":"openai/gpt-4o-mini","choices":[{"delta":{"content":" world"}}]}\n\n',
      ),
      new TextEncoder().encode(
        'data: {"id":"gen-test-123","model":"openai/gpt-4o-mini","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150,"cost":0.0025}}\n\n',
      ),
      new TextEncoder().encode("data: [DONE]\n\n"),
    ]);

    expect(extractedData).not.toBeNull();
    expect(extractedData!.id).toBe("gen-test-123");
    expect(extractedData!.model).toBe("openai/gpt-4o-mini");
    expect(extractedData!.cost).toBe(0.0025);
    expect(extractedData!.tokensPrompt).toBe(100);
    expect(extractedData!.tokensCompletion).toBe(50);
    expect(extractedData!.hasUsageData).toBe(true);
  });

  it("should extract usage from real OpenRouter format", async () => {
    let extractedData: StreamingUsageData | null = null;
    const onUsageExtracted = (data: StreamingUsageData) => {
      extractedData = data;
    };

    const stream = createUsageExtractorStream(onUsageExtracted);

    // Real OpenRouter final chunk format
    const finalChunk = JSON.stringify({
      id: "gen-1765663988-DOV9yTVM8DX6itQU0fRh",
      provider: "OpenAI",
      model: "openai/gpt-4o-mini",
      object: "chat.completion.chunk",
      created: 1765663990,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "" },
          finish_reason: null,
        },
      ],
      usage: {
        prompt_tokens: 2848,
        completion_tokens: 159,
        total_tokens: 3007,
        cost: 0.0205226,
        is_byok: false,
      },
    });

    await processStream(stream, [
      new TextEncoder().encode(`data: ${finalChunk}\n\n`),
    ]);

    expect(extractedData).not.toBeNull();
    expect(extractedData!.id).toBe("gen-1765663988-DOV9yTVM8DX6itQU0fRh");
    expect(extractedData!.model).toBe("openai/gpt-4o-mini");
    expect(extractedData!.cost).toBe(0.0205226);
    expect(extractedData!.tokensPrompt).toBe(2848);
    expect(extractedData!.tokensCompletion).toBe(159);
    expect(extractedData!.hasUsageData).toBe(true);
  });

  it("should fallback to ID-only when no usage data", async () => {
    let extractedData: StreamingUsageData | null = null;
    const onUsageExtracted = (data: StreamingUsageData) => {
      extractedData = data;
    };

    const stream = createUsageExtractorStream(onUsageExtracted);

    // Chunks without usage data
    await processStream(stream, [
      new TextEncoder().encode(
        'data: {"id":"gen-no-usage","model":"test-model","choices":[{"delta":{"content":"test"}}]}\n\n',
      ),
      new TextEncoder().encode("data: [DONE]\n\n"),
    ]);

    // Should still get callback with hasUsageData=false
    expect(extractedData).not.toBeNull();
    expect(extractedData!.id).toBe("gen-no-usage");
    expect(extractedData!.model).toBe("test-model");
    expect(extractedData!.hasUsageData).toBe(false);
    expect(extractedData!.cost).toBe(0);
  });

  it("should pass through all chunks unchanged", async () => {
    const onUsageExtracted = vi.fn();
    const stream = createUsageExtractorStream(onUsageExtracted);

    const input = new TextEncoder().encode(
      'data: {"id":"gen-123","usage":{"cost":0.001,"prompt_tokens":10,"completion_tokens":5}}\n\n',
    );
    const output = await processStream(stream, [input]);

    // Verify chunks passed through unchanged
    const combined = new Uint8Array(
      output.reduce((acc, chunk) => acc + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of output) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    expect(combined).toEqual(input);
  });

  it("should only call callback once", async () => {
    let callCount = 0;
    const onUsageExtracted = () => {
      callCount++;
    };

    const stream = createUsageExtractorStream(onUsageExtracted);

    await processStream(stream, [
      new TextEncoder().encode(
        'data: {"id":"gen-1","model":"m1","usage":{"cost":0.01,"prompt_tokens":10,"completion_tokens":5}}\n\n',
      ),
      new TextEncoder().encode(
        'data: {"id":"gen-2","model":"m2","usage":{"cost":0.02,"prompt_tokens":20,"completion_tokens":10}}\n\n',
      ),
    ]);

    expect(callCount).toBe(1);
  });

  it("should handle zero cost correctly", async () => {
    let extractedData: StreamingUsageData | null = null;
    const onUsageExtracted = (data: StreamingUsageData) => {
      extractedData = data;
    };

    const stream = createUsageExtractorStream(onUsageExtracted);

    await processStream(stream, [
      new TextEncoder().encode(
        'data: {"id":"gen-free","model":"free-model","usage":{"cost":0,"prompt_tokens":100,"completion_tokens":50}}\n\n',
      ),
    ]);

    expect(extractedData).not.toBeNull();
    expect(extractedData!.cost).toBe(0);
    expect(extractedData!.hasUsageData).toBe(true); // Even with 0 cost, we have usage data
  });

  it("should extract usage when an SSE line is split across chunks", async () => {
    let extractedData: StreamingUsageData | null = null;
    const onUsageExtracted = (data: StreamingUsageData) => {
      extractedData = data;
    };

    const stream = createUsageExtractorStream(onUsageExtracted);

    const encoder = new TextEncoder();
    const input = encoder.encode(
      'data: {"id":"gen-split","model":"split-model","usage":{"cost":0.01,"prompt_tokens":1,"completion_tokens":2}}\n\n',
    );

    const splitIndex = Math.floor(input.length / 2);
    const output = await processStream(stream, [
      input.slice(0, splitIndex),
      input.slice(splitIndex),
    ]);

    // Verify chunks passed through unchanged
    const combined = new Uint8Array(
      output.reduce((acc, chunk) => acc + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of output) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    expect(combined).toEqual(input);

    expect(extractedData).not.toBeNull();
    expect(extractedData!.id).toBe("gen-split");
    expect(extractedData!.model).toBe("split-model");
    expect(extractedData!.cost).toBe(0.01);
    expect(extractedData!.tokensPrompt).toBe(1);
    expect(extractedData!.tokensCompletion).toBe(2);
  });

  it("should decode UTF-8 across chunk boundaries", async () => {
    let extractedData: StreamingUsageData | null = null;
    const onUsageExtracted = (data: StreamingUsageData) => {
      extractedData = data;
    };

    const stream = createUsageExtractorStream(onUsageExtracted);

    const encoder = new TextEncoder();
    const input = encoder.encode(
      'data: {"id":"gen-utf8","model":"m€","usage":{"cost":0.01,"prompt_tokens":1,"completion_tokens":1}}\n\n',
    );

    // Split in the middle of the UTF-8 encoding of "€" (0xE2 0x82 0xAC)
    const euroBytes = [0xe2, 0x82, 0xac];
    let euroIndex = -1;
    for (let i = 0; i < input.length - euroBytes.length; i++) {
      if (
        input[i] === euroBytes[0] &&
        input[i + 1] === euroBytes[1] &&
        input[i + 2] === euroBytes[2]
      ) {
        euroIndex = i;
        break;
      }
    }

    expect(euroIndex).not.toBe(-1);
    const splitIndex = euroIndex + 1;
    await processStream(stream, [
      input.slice(0, splitIndex),
      input.slice(splitIndex),
    ]);

    expect(extractedData).not.toBeNull();
    expect(extractedData!.model).toBe("m€");
  });

  it("should not break streaming when callback throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const stream = createUsageExtractorStream(() => {
        throw new Error("boom");
      });

      const input = new TextEncoder().encode(
        'data: {"id":"gen-throw","model":"m1","usage":{"cost":0.01,"prompt_tokens":1,"completion_tokens":1}}\n\n',
      );
      const output = await processStream(stream, [input]);

      const combined = new Uint8Array(
        output.reduce((acc, chunk) => acc + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of output) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      expect(combined).toEqual(input);
    } finally {
      consoleError.mockRestore();
    }
  });
});
